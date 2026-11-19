import type { Look } from '../core/look';
// The game controller: owns the save, runs battles and tutorials, and glues the
// Phaser world to the DOM interface. Game rules live in src/core and stay pure.

import { answerBoss, startBoss, type BossFight } from '../core/boss';
import { makeQuestion, monsterStats, pickHint, resetClassFx, resolveTurn, startBattle, type Battle, type Question, type TurnReport, type Tutorial } from '../core/combat';
import { CONFIG, xpToNext } from '../core/config';
import { favour, FAVOUR, KONRAD_WORDS, QUESTS, questEvent, questState, startQuest, type QuestEvent } from '../core/quests';
import { CHEST_ZH, CHESTS, lockWord, openChest, type ChestKind } from '../core/chest';
import { gradeTyped } from '../core/grading';
import { buy as buyItem, openShop, refresh as refreshShop, sell as sellItem } from '../core/shop';
import { CLASSES, respec, respecCost, spent, TALENT_FROM_LEVEL, type ClassId } from '../core/classes';
import { makeItem } from '../core/loot';
import { applyLoss, applyWin, postFightHeal } from '../core/outcomes';
import { defaultRng, type Rng } from '../core/rng';
import { atLeastHalfShare, instantGuiming, kindOf, recordAnswer, stageOf } from '../core/srs';
import { pickSpawns, zoneWords } from '../core/spawn';
import {
  addXp,
  clearSave,
  dayKey,
  exportJson,
  importJson,
  maxHp,
  newGame,
  now,
  rollDay,
  save,
  todayLog,
  type GameState,
} from '../core/state';
import type { Move, Slot, Word, ZoneId } from '../core/types';
import { has, UNLOCK_TEXT } from '../core/unlocks';
import { BOSS } from '../data/boss';
import { BOSS2 } from '../data/boss2';
import { SKILLS } from '../data/skills';
import { fullForm, hasArticleQuestion, WORD_BY_ID, WORDS } from '../data/words';
import { initAudio, setBattleMusic, setVolumes, sfx, speak, speechAvailable, hasGermanVoice } from './audio';
import type { MonsterEntity, WorldScene } from './WorldScene';
import { BattleUI } from '../ui/battle';
import { BossUI } from '../ui/boss';
import { advance, banner, dialogHasChoices, dialogOpen, say, setPrompt, toast, type Line } from '../ui/feedback';
import { renderHud } from '../ui/hud';
import { Panels } from '../ui/panels';
import { $, isTyping } from '../ui/dom';

const SYS = '系统';
const HILDE = '守火人 Hilde';
const GRETA = '导师 Greta';
const MIRA = '商人 Mira';
const TRIAL_FIGHTS = 3;

export class Controller {
  state: GameState;
  scene!: WorldScene;
  rng: Rng = defaultRng;
  battle: Battle | null = null;
  entity: MonsterEntity | null = null;
  /** 群怪: every battle in the current fight (just [battle] one-on-one) and its world entity. */
  pack: Battle[] = [];
  packEntities: MonsterEntity[] = [];
  private killer: Battle | null = null;
  /** Greta's class trial in progress: which class, fights still to win. */
  private trial: { cls: ClassId; left: number } | null = null;
  boss: BossFight | null = null;
  battleUI = new BattleUI(this);
  bossUI = new BossUI(this);
  panels = new Panels(this);
  dev: boolean;
  private lastInput = Date.now();

  constructor(state: GameState, dev: boolean) {
    this.state = state;
    this.dev = dev;
    // A class trial borrows the class for its fights; undo it if the page closed mid-trial.
    if ('trialPrev' in state.flags) {
      state.cls = (state.flags.trialPrev as ClassId) || null;
      delete state.flags.trialPrev;
    }
    window.addEventListener('keydown', (e) => this.onKey(e));
    for (const ev of ['keydown', 'mousedown', 'mousemove']) window.addEventListener(ev, () => (this.lastInput = Date.now()), { passive: true });
    // Count active minutes for the playtest log (idle > 2 min doesn't count).
    window.setInterval(() => {
      if (document.visibilityState === 'visible' && Date.now() - this.lastInput < 120_000) {
        todayLog(this.state).minutes += 1;
        this.persist();
      }
    }, 60_000);
    window.setInterval(() => this.persist(), 20_000);
    window.addEventListener('beforeunload', () => this.persist());
  }

  // ---- Scene hooks ---------------------------------------------------------------

  onSceneReady(scene: WorldScene): void {
    this.scene = scene;
    initAudio(this.state.settings.music, this.state.settings.sfx);
    this.renderMenu();
    this.refresh();
    if (rollDay(this.state)) this.scene.spawnAll();
    if (this.state.region === 2 && startQuest(this.state, 'main2')) questEvent(this.state, 'enterMarket');
    if (!this.state.flags.intro) this.intro();
    else this.welcomeBack();
  }

  wordById(id: string): Word | undefined {
    return WORD_BY_ID[id];
  }

  pickSpawns(zone: ZoneId, n: number, alive: Set<string>) {
    // The tutorial bread only lives by the bonfire until it is named.
    if (!this.state.flags.brotDone) alive.add('brot');
    return pickSpawns(this.state, zone, n, alive, this.rng);
  }

  /** Called by the scene after every full respawn. */
  afterSpawnAll(): void {
    if (this.state.flags.intro && !this.state.flags.brotDone) this.spawnBread();
  }

  private spawnBread() {
    if (this.scene.monsters.some((m) => m.word.id === 'brot')) return;
    const b = this.scene.map.bonfire;
    this.scene.addMonster(WORD_BY_ID['brot'], 'new', 'camp', (b.x + 2) * 16 + 8, (b.y - 1) * 16 + 8);
  }

  /** Standing by the bonfire (looks can be changed there for free). */
  nearBonfire(): boolean {
    const b = this.scene?.map?.bonfire;
    const p = this.scene?.player;
    return !!b && !!p && Math.hypot(b.x * 16 + 8 - p.x, b.y * 16 + 8 - p.y) < 40;
  }

  setLook(look: Look): void {
    this.state.look = look;
    this.scene?.applyLook();
    this.persist();
  }

  uiBlocking(): boolean {
    return !!this.battle || !!this.boss || dialogOpen() || !$('modal').hidden || !$('title').hidden || document.activeElement?.id === 'chat-input';
  }

  refresh(): void {
    renderHud(this.state);
  }

  persist(): void {
    save(this.state);
  }

  speak(text: string): void {
    speak(text, this.state.settings.tts);
  }

  voiceNote(): string {
    if (!speechAvailable()) return '这个浏览器不支持朗读';
    return hasGermanVoice() ? '使用浏览器自带的德语语音' : '没找到德语语音：请用电脑上的 Chrome';
  }

  applyVolumes(): void {
    setVolumes(this.state.settings.music, this.state.settings.sfx);
    this.persist();
  }

  // ---- Story & tutorials --------------------------------------------------------------

  private intro() {
    const lines: Line[] = [
      { who: SYS, text: '……检测到宿主生命体征。重生完成。' },
      { who: SYS, text: '欢迎回来。这个世界的名字被吃掉了。没有名字的东西会扭曲、长牙、吃人。' },
      { who: SYS, text: '你能做的只有一件事：叫出它们的名字。叫对了，它们才会变回原样。' },
      { who: HILDE, text: '你醒了？别动……篝火边那块面包，它刚才咬了我一口。' },
      { who: HILDE, text: '你能看见它的名字吗？试试叫它。名词前面要加 der、die 或 das，叫错了它不认。' },
    ];
    say(lines, () => {
      this.state.flags.intro = true;
      this.spawnBread();
      this.persist();
      toast('走过去碰它，开始战斗（WASD 或方向键移动）');
    });
  }

  private welcomeBack() {
    const s = this.state;
    const due = WORDS.filter((w) => kindOf(s, w) === 'due').length;
    if (due > 0) toast(`${due} 个词到期了：它们在地图上等你（头上有「!」）`, 'gold');
  }

  /** Lessons tied to a level (游戏设计 › 新手引导). */
  private onLevelUp(level: number) {
    const s = this.state;
    sfx.levelUp();
    banner(`Lv ${level}`, (UNLOCK_TEXT[level] ?? [])[0] ?? '');
    const unlocked = UNLOCK_TEXT[level] ?? [];
    const lines: Line[] = unlocked.map((t) => ({ who: SYS, text: `新能力：${t}` }));
    switch (level) {
      case 2:
        lines.push({ who: SYS, text: '从现在起，有些怪要你把名字打出来。名词要带冠词，比如「der Tee」。' });
        break;
      case 3:
        lines.push({ who: HILDE, text: '累了就回篝火边坐坐（按 E）。打过的东西，到了时候会重新长出来……但牙会少一些。' });
        s.flags.teachRest = true;
        break;
      case 4:
        s.flags.pendingLoss = true;
        break;
      case 5:
        lines.push({ who: SYS, text: '下一只被你打散的怪会掉装备。按 C 打开角色面板穿上它。' });
        break;
      case 6:
        lines.push(
          { who: HILDE, text: '听好了，光叫名字不够。完整的一句话，力量大得多。' },
          { who: HILDE, text: '说「Ich möchte einen Tee.」——我想要一杯茶。der Tee 在这句里变成 einen，die Tasse 变成 eine，das Brot 变成 ein。' },
          { who: SYS, text: '战斗里按 F 用句式攻击，句子里可以放任何你见过的名词。名词的性决定元素：der 冰（推迟蓄力）、die 火（灼烧）、das 毒（叠层）。' },
        );
        break;
      case 7:
        s.flags.pendingBreak = true;
        lines.push({ who: SYS, text: '从现在起，怪会缩起来防御（Ich verteidige mich.）。这时选择题只能刮掉三成，写对它的名字（带冠词）才能破防：全额伤害，还让它易伤两回合。' });
        lines.push({ who: SYS, text: '连击怪（Ich beiße zweimal!）也来了：答对的话，它只打得出第一下。下一只举盾的怪会教你破防。' });
        break;
      case 8:
        s.flags.pendingHeal = true;
        lines.push({ who: HILDE, text: `营地东边的门后住着一个「邻居」。等你叫得出这片街区四成的名字（打到半名），它才会开门。` });
        break;
      case 9:
        s.flags.pendingNegation = true;
        lines.push({ who: SYS, text: '注意 nicht：「Ich greife jetzt nicht an.」说了动词，但它这回合不会动手。' });
        break;
      case 10:
        lines.push(
          { who: HILDE, text: s.flags.bossKills ? '邻居家的门开了。门后是面包集市，那边的人比这里多，怪也多。' : '雾在退。等你打败门后的邻居，那扇门就会通向面包集市。' },
          { who: HILDE, text: '到了集市，先去找导师 Greta 选个职业。' },
        );
        break;
      case 11:
        lines.push({ who: SYS, text: '集市里的怪会扎堆。离得近、冠词不一样的几只会一起扑上来：先点选一只（Tab 切换），再喊出它的冠词。' });
        break;
      case 12:
        lines.push({ who: SYS, text: '动词怪开始要变位了：题目给出人称，比如「du ___（nehmen）」，写 nimmst。强变化动词（nehmen、essen、sehen……）经验 ×1.3。' });
        if (s.cls) lines.push({ who: SYS, text: '你有了第一个天赋点：按 T 打开职业与天赋。' });
        break;
      case 13:
        lines.push({ who: SYS, text: '听清 mich 和 dich：「Ich kratze dich!」是挠你，「Ich kratze mich.」是挠它自己，不会打你。' });
        break;
      case 18:
        lines.push({ who: SYS, text: '粮仓尽头的秤房开门了。吞秤者只问价格和数量：价签上的数字，用德语单词说出来。' });
        break;
    }
    if (lines.length) say(lines);
    this.scene.restyleAll();
  }

  // ---- Encounters ----------------------------------------------------------------------

  encounter(m: MonsterEntity, opts: { trial?: ClassId } = {}): void {
    if (this.battle) return;
    const s = this.state;
    rollDay(s);
    let tutorial: Tutorial = null;
    if (s.flags.pendingLoss && !m.isEcho) tutorial = 'loss';
    else if (s.flags.pendingBreak) tutorial = 'break';
    else if (s.flags.pendingNegation) tutorial = 'negation';
    else if (s.flags.pendingHeal) tutorial = 'heal';

    // The forced loss uses a dog that bites three times (Lv4 lesson).
    if (tutorial === 'loss') {
      const dog = WORD_BY_ID['hund'];
      this.entity = m;
      this.battle = startBattle(s, dog, this.rng, { tutorial: 'loss' });
    } else {
      this.entity = m;
      this.battle = startBattle(s, m.word, this.rng, { isEcho: m.isEcho, tutorial, trial: opts.trial, rare: m.rare });
      if (m.rare && m.word.family !== 'truhe') {
        // Rare monsters: half again as tough. They carry an iron chest and run when hurt.
        const mon = this.battle.monster;
        mon.hp = mon.maxHp = Math.round(mon.maxHp * 1.5);
      }
    }
    if (opts.trial) {
      // Trial monsters fight at your level, whatever word they carry.
      const st = monsterStats(s.level, 1, 'new', 0);
      Object.assign(this.battle.monster, { lvl: s.level, hp: st.hp, maxHp: st.hp, dmg: st.dmg });
    }
    if (opts.trial === 'guardian') {
      // 守护者试炼: review monsters left too long (three intervals overdue): fatter and meaner.
      const mon = this.battle.monster;
      mon.hp = mon.maxHp = Math.round(mon.maxHp * (1 + CONFIG.monster.overdueHpStep * 3));
      mon.dmg = Math.round(mon.dmg * 1.3);
    }
    if (m.word.id === 'brot' && !s.flags.brotDone) {
      this.battle.monster.hp = this.battle.monster.maxHp = 1;
      this.battle.monster.dmg = 1;
    }
    this.pack = [this.battle];
    this.packEntities = [m];
    this.killer = null;
    if (!tutorial && !opts.trial) this.gatherPack(m);
    this.scene.focusBattle(m);
    setBattleMusic(true);
    setPrompt(null);
    this.battleUI.open();
    if (this.pack.length > 1 && !s.flags.firstPackDone) {
      say([
        { who: HILDE, text: '好几只一起扑上来了！先盯住一只（点它的卡片），再喊出它的冠词，它就会挨打。' },
        { who: HILDE, text: '喊成别的怪的冠词，就打偏到那只身上，只剩一半伤害。看到「Moment!」的那只了吗？先打它。' },
      ]);
    }
  }

  /** Region 2 (Lv11+): nearby nouns with different articles join the fight (群怪). */
  private gatherPack(m: MonsterEntity) {
    const s = this.state;
    if (!has(s.level, 'packs') || s.region !== 2 || m.isEcho || m.scripted || m.rare || !m.word.art || m.word.family === 'truhe') return;
    const firstPack = !s.flags.firstPackDone;
    const max = firstPack || s.level < CONFIG.pack.max3From ? 2 : CONFIG.pack.max;
    const r = CONFIG.pack.radiusTiles * 16;
    const used = new Set([m.word.art]);
    const near = this.scene.monsters
      .filter((o) => o !== m && !o.isEcho && !o.scripted && !o.rare && o.zone === m.zone && !!o.word.art && o.word.family !== 'truhe' && Math.hypot(o.x - m.x, o.y - m.y) <= r)
      .sort((a, b) => Math.hypot(a.x - m.x, a.y - m.y) - Math.hypot(b.x - m.x, b.y - m.y));
    for (const o of near) {
      if (this.pack.length >= max) break;
      if (used.has(o.word.art!)) continue;
      used.add(o.word.art!);
      const ob = startBattle(s, o.word, this.rng, { tutorial: firstPack ? 'packCharge' : null });
      this.pack.push(ob);
      this.packEntities.push(o);
    }
    if (this.pack.length === 1) return;
    // Pack-wide values (player statuses, hints, skill cooldown) are shared.
    for (const b of this.pack) {
      b.fx = this.pack[0].fx;
      b.cfx = this.pack[0].cfx;
      b.hintsLeft = this.pack[0].hintsLeft;
    }
    this.retarget();
  }

  /** Default target: a monster that is charging, else the first one still standing. */
  retarget(): void {
    const alive = this.pack.map((b, i) => ({ b, i })).filter((x) => !x.b.outcome);
    if (!alive.length) return;
    const pickOne = alive.find((x) => x.b.intent.kind === 'charge') ?? alive[0];
    this.setTarget(pickOne.i);
  }

  setTarget(i: number): void {
    const b = this.pack[i];
    if (!b || b.outcome) return;
    this.battle = b;
    this.entity = this.packEntities[i];
  }

  /** The whole fight is over (everyone down, you died, or you fled). */
  fightOver(): boolean {
    if (!this.pack.length) return true;
    return this.pack.every((b) => b.outcome === 'win') || this.pack.some((b) => b.outcome === 'lose' || b.outcome === 'fled');
  }

  askQuestion(move: Move): Question {
    return makeQuestion(this.state, this.battle!, move, this.rng, undefined, this.pack.length > 1);
  }

  useHint(q: Question): string | null {
    return pickHint(this.battle!, q);
  }

  answer(move: Move, q: Question, input: string): TurnReport {
    const s = this.state;
    const b = this.battle!;
    const r = resolveTurn(s, b, move, q, input, this.rng, this.pack);
    if (r.killer) this.killer = r.killer;
    if (b.tutorial === 'packCharge' || this.pack.some((x) => x.tutorial === 'packCharge')) s.flags.firstPackDone = true;
    // Packs settle every kill at once; the fight goes on with the next target.
    if (this.pack.length > 1) {
      for (const k of r.kills) {
        const i = this.pack.indexOf(k);
        if (!this.fightOver() || r.outcome === 'lose') this.settleKill(k, this.packEntities[i]);
      }
      if (!this.fightOver() && b.outcome) this.retarget();
    }
    recordAnswer(s, b.word, r.correct);
    const log = todayLog(s);
    if (r.correct) log.correct += 1;
    else log.wrong += 1;
    // Feedback.
    if (r.correct) (r.crit ? sfx.crit : sfx.correct)();
    else sfx.wrong();
    if (r.parried) sfx.parry();
    if (r.monsterDamage > 0) {
      sfx.hurt();
      this.scene.shake(0.004);
    }
    if (r.playerDamage > 0 && this.entity) this.scene.flashMonster(this.entity);
    if (r.crit) {
      this.scene.shake(0.008);
      this.speak(fullForm(b.word));
    }
    // Tutorial bookkeeping.
    if (b.tutorial === 'break' && b.monster.vulnerable > 0) s.flags.pendingBreak = false;
    if (b.tutorial === 'negation' && b.turn > 1) s.flags.pendingNegation = false;
    if (b.tutorial === 'heal' && b.trapUsed) s.flags.pendingHeal = false;
    // 前 10 级连错 2 次自动给中文提示
    if (!r.correct && b.wrongStreak >= 2 && s.level <= 10) r.verdict.notes.push(`提示：${b.word.zh}`);
    this.refresh();
    return r;
  }

  flee(): void {
    if (!this.battle) return;
    if (this.battle.tutorial === 'loss') {
      toast('这一场逃不掉。');
      return;
    }
    this.state.combo = 0;
    this.battle.outcome = 'fled';
    this.finishBattle();
  }

  /** Rewards for one dead monster: XP, gold, 归名, drops, lessons. Packs call it per kill. */
  private settleKill(b: Battle, m: MonsterEntity, inPack = this.pack.length > 1) {
    if (b.settled) return;
    b.settled = true;
    const s = this.state;
    {
      const isBread = b.word.id === 'brot' && !s.flags.brotDone;
      const res = applyWin(s, b, this.rng, { heal: !inPack });
      if (isBread) {
        instantGuiming(s, b.word);
        s.flags.brotDone = true;
        this.scene.removeMonster(m, 'guiming');
        sfx.guiming();
        banner('归名', 'das Brot · 面包');
        say([
          { who: SYS, text: '面包的牙一颗颗掉下来，变回了一块面包。这叫「归名」。' },
          { who: SYS, text: '这次是借给你的。从现在起，名字要叫熟了才会回来：同一只怪要在不同的日子打败三次，最后一下还要默写出全名。' },
          { who: HILDE, text: '……你真的叫回来了。东边的回声巷里，这样的东西到处都是。去吧，我守着火。' },
        ]);
      } else {
        this.scene.removeMonster(m, res.kill.guiming ? 'guiming' : 'scatter');
        if (res.kill.guiming) {
          sfx.guiming();
          banner('归名', `${fullForm(b.word)} · ${b.word.zh}`);
          this.speak(fullForm(b.word));
        }
        const bits = [`+${res.xp} 经验`, `+${res.gold} 金币`];
        if (res.overload === 'due') bits.push('复习加成');
        if (res.overload === 'new') bits.push('过载');
        if (res.kill.to > res.kill.from && !res.kill.guiming) bits.push(`${b.word.de}：${['无名', '裂形', '半名', '归名'][res.kill.to]}`);
        toast(bits.join(' · '));
        if (res.kill.needsTypedFinal && !s.flags.taughtFinal) {
          s.flags.taughtFinal = true;
          say([{ who: SYS, text: '它只剩一层了，但选择题叫不回名字。下次遇到它，用默写打出带冠词的全名，给它最后一击。' }]);
        }
        if (res.kill.kind === 'shadow' && !s.flags.taughtShadow) {
          s.flags.taughtShadow = true;
          toast('半透明的是影子：还没到复习时间，打它不推进归名');
        }
        if (b.kind === 'new' && s.daily.newCount === CONFIG.srs.dailyNewCap) {
          // Just entered 言灵过载. Explain once, then only a banner on later days.
          if (!s.flags.taughtCap) {
            s.flags.taughtCap = true;
            const O = CONFIG.overload;
            say([
              { who: SYS, text: `今天你已经叫出了 ${CONFIG.srs.dailyNewCap} 个新名字。言灵过载：脑子里的名字太多，新叫出的名字站不稳。` },
              { who: SYS, text: `你可以接着打。只是今天剩下的时间里，新怪的经验、金币和掉率减半；到期复习的怪经验和金币 ×${O.dueXp}。明早 4 点过载消退。` },
            ]);
          } else banner('言灵过载', '新怪收益减半 · 复习收益提高');
        }
        if (res.echoRecovered) {
          banner('回响', `取回 ${res.echoRecovered.gold} 金币和 ${res.echoRecovered.xp} 经验`);
        }
        if (res.drop) {
          (res.drop.quality === 'orange' ? sfx.orange : sfx.loot)();
          toast(`掉落：${res.drop.name}（${{ white: '普通', green: '优秀', purple: '史诗', orange: '传说' }[res.drop.quality]}）`, res.drop.quality === 'white' ? '' : 'gold');
          if (!s.flags.taughtGear) {
            s.flags.taughtGear = true;
            say([{ who: SYS, text: '你捡到了一件装备。按 C 打开角色面板，点「穿上」。' }]);
          }
        }
        if (res.bagFull) toast('背包满了，装备没捡起来：按 C 丢掉一些');
        if (res.chest) this.gotChest(res.chest, b.monster.lvl);
        if (b.word.family === 'krume') this.questFire('krumeKill');
        for (const lv of res.levelUp.levels) this.onLevelUp(lv);
        if (res.levelUp.capped && !s.flags.taughtCapLevel) {
          s.flags.taughtCapLevel = true;
          say([{ who: SYS, text: `你到了这一版的等级上限（${CONFIG.levelCap} 级）。经验会存着，第 3 区开放后接着升。继续打，归名和装备都还在涨。` }]);
        }
      }
    }
  }

  finishBattle(): void {
    const s = this.state;
    const pack = this.pack;
    const ents = this.packEntities;
    const target = this.battle!;
    const m = this.entity!;
    this.battleUI.close();
    setBattleMusic(false);
    this.battle = null;
    this.entity = null;
    this.pack = [];
    this.packEntities = [];
    const won = pack.length > 0 && pack.every((x) => x.outcome === 'win');
    const lost = pack.some((x) => x.outcome === 'lose');
    const b = lost ? (this.killer ?? target) : target;
    if (lost) b.outcome = 'lose';
    else if (won) b.outcome = 'win';
    else b.outcome = 'fled';

    if (won) {
      if (pack.length > 1) {
        pack.forEach((x, i) => { if (!x.settled) this.settleKill(x, ents[i], true); });
        postFightHeal(s);
      } else this.settleKill(b, m);
    } else if (b.outcome === 'lose') {
      sfx.death();
      const km = ents[pack.indexOf(b)] ?? m;
      const at = { x: km.x, y: km.y };
      const loss = applyLoss(s, b, at);
      if (b.tutorial === 'loss') s.flags.pendingLoss = false;
      pack.forEach((x, i) => { if (!x.settled) this.scene.removeMonster(ents[i], 'flee'); });
      this.scene.teleportToBonfire();
      this.scene.spawnAll();
      const lines: Line[] = [{ who: SYS, text: '你死了。你在篝火旁重生。' }];
      if (has(s.level, 'echo')) {
        lines.push(
          { who: SYS, text: '学过的东西一个都没丢：死亡永远不会拿走你的学习进度。' },
          { who: SYS, text: `但你身上的 ${loss.newEcho?.gold ?? 0} 金币和这一级的 ${loss.newEcho?.xp ?? 0} 经验，留在了杀死你的「${fullForm(b.word)}」身上，变成回响。回去打败它，就能捡回来。再死一次之前没捡回，就永远没了。` },
        );
        if (loss.lostEcho) lines.push({ who: SYS, text: `上一份回响（${loss.lostEcho.gold} 金币、${loss.lostEcho.xp} 经验）没来得及捡回，消散了。` });
      }
      say(lines);
    } else {
      pack.forEach((x, i) => { if (!x.settled) this.scene.removeMonster(ents[i], 'flee'); });
      if (!m.isEcho) this.scene.time.delayedCall(10, () => this.scene.fillZone(m.zone));
    }
    this.scene.endFocus();
    this.scene.restyleAll();
    if (this.trial) this.trialNext(won);
    if (b.outcome === 'fled' && b.flees && !lost) toast('它带着铁箱跑了。下次在它喊「Ich muss los!」之前打死它。');
    this.refresh();
    this.persist();
    this.nextChest();
  }

  // ---- Chests -----------------------------------------------------------------------------

  /** Locked chests (iron, gold) wait until the fight is over; the rest open on the spot. */
  private chestQueue: Array<{ kind: ChestKind; ilvl: number }> = [];

  private gotChest(kind: ChestKind, ilvl: number) {
    if (CHESTS[kind].locked) {
      this.chestQueue.push({ kind, ilvl });
      return;
    }
    const r = openChest(this.state, kind, ilvl, this.rng);
    sfx.loot();
    banner(CHEST_ZH[kind], [...r.items.map((it) => it.name), r.gold ? `${r.gold} 金币` : ''].filter(Boolean).join('、') || '背包满了');
    if (r.bagFull) toast('背包满了，有东西没装下');
  }

  private nextChest() {
    if (this.battle || this.boss) return;
    const c = this.chestQueue.shift();
    if (!c) return;
    const w = lockWord(this.state, WORDS[0]);
    this.panels.showChest({ kind: c.kind, ilvl: c.ilvl, word: w });
  }

  /** 言灵锁: right = every item's quality is rolled twice (keep the better). Wrong still opens. */
  openLockedChest(kind: ChestKind, ilvl: number, word: Word, input: string | null) {
    const ok = input !== null && gradeTyped(input, word, hasArticleQuestion(word)).ok;
    if (input !== null) recordAnswer(this.state, word, ok);
    const r = openChest(this.state, kind, ilvl, this.rng, ok);
    for (const it of r.items) (it.quality === 'orange' ? sfx.orange : sfx.loot)();
    this.refresh();
    this.persist();
    return { ok, ...r };
  }

  chestClosed(): void {
    this.nextChest();
  }

  // ---- Quests and Konrad -------------------------------------------------------------------

  questFire(ev: QuestEvent): void {
    this.renderMenu();
    for (const a of questEvent(this.state, ev)) {
      const def = QUESTS[a.id];
      if (a.done) banner('任务完成', def.zh);
      else toast(`任务：${def.steps[a.finished].zh} ✓  下一步：${def.steps[a.finished + 1].zh}`, 'gold');
      if (a.id === 'konrad') toast(`Konrad 好感：${FAVOUR[favour(this.state)]}`);
    }
  }

  private talkKonrad() {
    const s = this.state;
    const K = '面包师傅 Konrad';
    if (!has(s.level, 'quests')) {
      say([{ who: K, text: '「Brot……Brot。」他只会说这一个词，手里攥着一张写不出名字的纸条。（12 级后再来）' }]);
      return;
    }
    const p = questState(s, 'konrad');
    if (!p) {
      say(
        [
          { who: K, text: 'Brot……对，Brot！你能听懂我？' },
          { who: K, text: '浓雾来的那天，我的面粉袋子长出了嘴，跑到菜摊街去了。没有面粉，我连面包都做不了。' },
          { who: K, text: '更糟的是，我忘了好多词……连我女儿的名字都想不起来了。帮帮我吧。' },
        ],
        () => {
          startQuest(s, 'konrad');
          this.renderMenu();
          toast('新任务：面包师傅的名字（按 J 查看）', 'gold');
          this.persist();
        },
      );
      return;
    }
    if (p.done && s.flags.apronOwed) {
      this.giveApron();
      return;
    }
    if (p.done) {
      const last = (s.flags.konradBread as number) ?? 0;
      if (now(s) - last >= 3600_000) {
        s.flags.konradBread = now(s);
        const heal = Math.round(maxHp(s) * 0.5);
        s.hp = Math.min(maxHp(s), s.hp + heal);
        say([{ who: K, text: `「Ein Brot für dich!」刚出炉的面包，你回复了 ${heal} 点生命。（每小时一个）` }]);
        this.refresh();
      } else say([{ who: K, text: '「Das Brot ist noch nicht fertig.」面包还在炉子里，过一会儿再来。' }]);
      return;
    }
    if (p.step === 0) {
      say([{ who: K, text: `面粉还在菜摊街那些碎屑兽身上。（${p.count}/5）` }]);
      return;
    }
    if (p.step === 1) {
      say(
        [
          { who: K, text: '面粉回来了，可我还是叫不出店里东西的名字。你教教我：我说中文意思，你告诉我德语，带上冠词。' },
        ],
        () => {
          const words = KONRAD_WORDS.map((id) => WORD_BY_ID[id]).filter(Boolean);
          this.panels.showQuiz('教 Konrad 说话', 'Konrad 指着店里的东西。用德语说出来（名词带冠词）。', words, () => {
            this.questFire('taughtKonrad');
            say([{ who: K, text: 'das Brot、das Brötchen、der Kuchen……都回来了。等等，还有一个名字……再来找我。' }]);
            this.persist();
          });
        },
      );
      return;
    }
    // Step 2: the story, the apron.
    say(
      [
        { who: K, text: '我想起来了一点。她每天早上都来店里，买两个 Brötchen。' },
        { who: K, text: '她的名字……是 L 开头的。L……就差一点。' },
        { who: K, text: '雾是从东边粮仓后面的路上来的。她也是往那边走的。等你能走那条路的时候，替我找找她。' },
        { who: K, text: '这条围裙给你。从今天起，你就是这家店的朋友，饿了就来拿面包。' },
      ],
      () => {
        this.questFire('heardKonrad');
        const it = makeItem(this.rng, s.level, 'green', 'coat');
        it.name = 'Konrads Schürze';
        this.giveApron();
        this.refresh();
        this.persist();
      },
    );
  }

  private giveApron() {
    const s = this.state;
    if (s.bag.length >= CONFIG.loot.bagSize) {
      s.flags.apronOwed = true;
      toast('背包满了，Konrad 先替你收着围裙。腾出位置再来找他。');
      return;
    }
    const it = makeItem(this.rng, s.level, 'green', 'coat');
    it.name = 'Konrads Schürze';
    s.bag.push(it);
    s.flags.apronOwed = false;
    banner('获得', 'Konrads Schürze（优秀 · 外套）');
  }

  // ---- Shop (Mira) ---------------------------------------------------------------------

  private talkMira() {
    const s = this.state;
    if (!has(s.level, 'shop')) {
      say([{ who: MIRA, text: '货还在路上。你再长大一点（11 级）再来。' }]);
      return;
    }
    this.questFire('metMira');
    const open = () => {
      openShop(s, this.rng, now(s));
      this.panels.buying = null;
      this.panels.show('shop');
    };
    if (!s.flags.miraMet) {
      s.flags.miraMet = true;
      say(
        [
          { who: MIRA, text: 'Hallo! 我这儿什么都卖：笔、外套、护符、词典。' },
          { who: MIRA, text: '不过在集市上，东西是用嘴买的。指着它说「Ich nehme den Stift.」，我就卖给你。' },
          { who: MIRA, text: '注意：der Stift、der Mantel 在 nehmen 后面要变成 den；das Amulett、das Wörterbuch 不变。嫌贵就说「Geht das billiger?」，我心情好会打九折。' },
        ],
        open,
      );
      return;
    }
    open();
  }

  shopBuy(i: number, sentence: string, bargain: string) {
    const r = buyItem(this.state, i, sentence, bargain, CONFIG.loot.bagSize);
    if (r.ok) sfx.loot();
    this.refresh();
    this.persist();
    return r;
  }

  shopSell(id: string): void {
    const g = sellItem(this.state, id);
    if (g) toast(`卖掉了，+${g} 金币`);
    this.refresh();
    this.persist();
    this.panels.render();
  }

  shopRefresh(): void {
    if (!refreshShop(this.state, this.rng)) toast('金币不够');
    this.refresh();
    this.persist();
    this.panels.render();
  }

  // ---- Classes (Greta) ---------------------------------------------------------------------

  private talkGreta() {
    const s = this.state;
    if (s.level < CONFIG.region2Level) {
      say([{ who: GRETA, text: `你还太嫩。到 ${CONFIG.region2Level} 级再来找我。` }]);
      return;
    }
    const lines: Line[] = [];
    if (!s.flags.gretaMet) {
      s.flags.gretaMet = true;
      lines.push(
        { who: GRETA, text: '营地来的？Hilde 跟我提过你。在集市里光会叫名字不够，你得有自己的打法。' },
        { who: GRETA, text: '书写者靠默写：写得越多，墨水越多，下笔越狠。守护者靠站得住：答错也不容易倒，挡得住，反弹得回去。' },
        { who: GRETA, text: '先各试一场试炼。打完一次，这个职业就永久归你。第一个职业白送，之后随时来我这儿换。' },
      );
    }
    const choices: Array<{ label: string; act: () => void }> = [];
    for (const id of ['writer', 'guardian'] as ClassId[]) {
      const c = CLASSES[id];
      if (!s.classes.includes(id)) choices.push({ label: `试炼：${c.zh}（${c.trialZh}）`, act: () => this.startTrial(id) });
      else if (s.cls !== id) choices.push({ label: `${s.cls ? '换成' : '选择'}${c.zh}`, act: () => this.pickClass(id) });
    }
    if (s.cls && s.level >= TALENT_FROM_LEVEL) choices.push({ label: '看天赋（T）', act: () => this.panels.show('talents') });
    if (s.cls && spent(s) > 0) choices.push({ label: `洗点（${respecCost(s)} 金币）`, act: () => this.doRespec() });
    choices.push({ label: '离开', act: () => undefined });
    if (!lines.length) lines.push({ who: GRETA, text: s.cls ? `${CLASSES[s.cls].zh}，今天想练什么？` : '想好试哪个了吗？' });
    say(lines, undefined, choices);
  }

  private startTrial(id: ClassId) {
    const s = this.state;
    this.trial = { cls: id, left: TRIAL_FIGHTS };
    s.flags.trialPrev = s.cls ?? '';
    s.cls = id;
    resetClassFx(s);
    say([{ who: GRETA, text: `${CLASSES[id].zh}试炼：${CLASSES[id].trialZh}。${CLASSES[id].blurb.join('')}` }], () => this.trialFight());
  }

  /** Trial fights use words you have already met, so they test the class, not new words. */
  private trialFight() {
    const s = this.state;
    const known = WORDS.filter((w) => s.words[w.id] && w.pos !== 'phr' && w.pos !== 'num' && !w.digit && w.family !== 'truhe');
    const pool = known.length >= 3 ? known : zoneWords('gemuesegasse');
    const word = pool[Math.floor(this.rng() * pool.length)];
    const p = this.scene.player;
    const m = this.scene.addMonster(word, 'new', 'markt', p.x + 20, p.y, { scripted: 'trial' });
    this.encounter(m, { trial: this.trial!.cls });
  }

  private trialNext(won: boolean) {
    const s = this.state;
    const t = this.trial!;
    if (!won) {
      this.trial = null;
      s.cls = (s.flags.trialPrev as ClassId) || null;
      delete s.flags.trialPrev;
      resetClassFx(s);
      say([{ who: GRETA, text: '试炼断了。没关系，什么时候准备好了再来。' }]);
      return;
    }
    t.left -= 1;
    if (t.left > 0) {
      toast(`试炼：还剩 ${t.left} 场`);
      this.scene.time.delayedCall(600, () => this.trialFight());
      return;
    }
    this.trial = null;
    const prev = (s.flags.trialPrev as ClassId) || null;
    delete s.flags.trialPrev;
    s.cls = prev;
    resetClassFx(s);
    if (!s.classes.includes(t.cls)) s.classes.push(t.cls);
    banner('试炼完成', `${CLASSES[t.cls].zh} 已解锁`);
    const choices = [
      { label: `${prev ? '换成' : '选择'}${CLASSES[t.cls].zh}`, act: () => this.pickClass(t.cls) },
      { label: prev ? `继续当${CLASSES[prev].zh}` : '再想想', act: () => undefined },
    ];
    say([{ who: GRETA, text: `不错。${CLASSES[t.cls].zh}这条路你走得通。要现在就选吗？` }], undefined, choices);
  }

  private pickClass(id: ClassId) {
    const s = this.state;
    const first = !s.cls;
    s.cls = id;
    resetClassFx(s);
    banner(first ? '职业' : '换职业', CLASSES[id].zh);
    this.renderMenu();
    const lines: Line[] = [{ who: GRETA, text: `从今天起，你是${CLASSES[id].zh}。战斗里按 G 用职业技能「${CLASSES[id].skillZh}」。` }];
    if (s.level >= TALENT_FROM_LEVEL) lines.push({ who: SYS, text: '按 T 打开职业与天赋，把天赋点花掉。' });
    else lines.push({ who: SYS, text: `${TALENT_FROM_LEVEL} 级起每升一级得 1 点天赋（按 T 查看）。` });
    say(lines);
    this.refresh();
    this.persist();
  }

  private doRespec() {
    const s = this.state;
    const cost = respecCost(s);
    if (!respec(s)) {
      say([{ who: GRETA, text: `洗点要 ${cost} 金币。你身上不够。` }]);
      return;
    }
    toast(`天赋已重置，花了 ${cost} 金币`);
    this.refresh();
    this.persist();
  }

  // ---- World interactions -------------------------------------------------------------------

  setPrompt(it: { kind: string; data?: string } | null): void {
    if (!it || this.uiBlocking()) return setPrompt(null);
    const text: Record<string, string> = {
      bonfire: '<kbd>E</kbd>在篝火旁休息',
      npc: '<kbd>E</kbd>和守火人 Hilde 说话',
      door: this.state.region === 2 ? '<kbd>E</kbd>推开秤房的门' : '<kbd>E</kbd>敲门',
      sign: '<kbd>E</kbd>看路牌',
      gate: '<kbd>E</kbd>回余烬营地',
    };
    const NPC_TEXT: Record<string, string> = {
      hilde: '<kbd>E</kbd>和守火人 Hilde 说话',
      greta: '<kbd>E</kbd>和导师 Greta 说话',
      mira: '<kbd>E</kbd>和商人 Mira 说话',
      konrad: '<kbd>E</kbd>和面包师傅 Konrad 说话',
    };
    setPrompt(it.kind === 'npc' ? NPC_TEXT[it.data ?? 'hilde'] : text[it.kind]);
  }

  interact(it: { kind: string; data?: string }): void {
    if (it.kind === 'bonfire') this.rest();
    else if (it.kind === 'npc') this.talkNpc(it.data ?? 'hilde');
    else if (it.kind === 'door') (this.state.region === 2 ? this.knockRegion2() : this.knock());
    else if (it.kind === 'gate') this.travel(1);
    else if (it.kind === 'sign') {
      const w = WORD_BY_ID[it.data!];
      const st = stageOf(this.state, w);
      if (st >= 3) {
        say([{ who: '路牌', text: `「${fullForm(w)}」——${w.zh}。字迹清清楚楚。` }]);
        this.speak(fullForm(w));
      } else say([{ who: '路牌', text: '字母在木板上扭动，读不出来。这个词归名以后，路牌就会变清楚。' }]);
    }
  }

  rest(): void {
    const s = this.state;
    if (!has(s.level, 'bonfireRest')) {
      say([{ who: HILDE, text: '火还太弱。先去把那些东西的名字叫回来，等你到 3 级再来坐。' }]);
      return;
    }
    rollDay(s);
    s.hp = maxHp(s);
    s.combo = 0;
    resetClassFx(s);
    this.scene.spawnAll();
    const due = WORDS.filter((w) => kindOf(s, w) === 'due').length;
    banner('篝火', '生命回满，怪物全部刷新');
    say([{ who: SYS, text: due ? `你在篝火旁坐了一会儿。${due} 个到期的词重新长出了牙，在街上游荡（头上有「!」）。` : '你在篝火旁坐了一会儿。现在没有到期的词：明天再来，昨天打过的词就会重生。' }]);
    if (s.flags.teachRest) s.flags.teachRest = false;
    this.refresh();
    this.persist();
  }

  private talkHilde() {
    const s = this.state;
    const tips: Line[][] = [
      [{ who: HILDE, text: '名词前面的 der、die、das 是它的一部分。只叫「Tee」，它不认；叫「der Tee」，它才发抖。' }],
      [{ who: HILDE, text: '头上有感叹号的，是今天该叫的名字。别让它们拖太久，拖久了会变凶。' }],
      [{ who: HILDE, text: '它说话的时候仔细听。「Moment!」就是在憋大招，这时候打它最好。' }],
      [{ who: HILDE, text: '一天别学太多新名字。睡一觉，第二天再叫一遍，名字才长得牢。' }],
    ];
    if (s.level >= 8) {
      const share = Math.round(atLeastHalfShare(s, this.regionWords()) * 100);
      tips.push([{ who: HILDE, text: `东边那扇门……你已经能叫出这片街区 ${share}% 的名字了。到 ${Math.round(CONFIG.boss.halfNameShare * 100)}%，它就会开门。` }]);
    }
    if (s.level >= 6) tips.push([{ who: HILDE, text: '同一个名词在句子里用太多次就不灵了。换着用：einen Tee、eine Tasse、ein Glas。' }]);
    const i = ((s.flags.hildeIdx as number) ?? 0) % tips.length;
    s.flags.hildeIdx = i + 1;
    say(tips[i]);
  }

  private talkNpc(id: string) {
    if (id === 'hilde') return this.talkHilde();
    if (id === 'greta') return this.talkGreta();
    if (id === 'mira') return this.talkMira();
    if (id === 'konrad') return this.talkKonrad();
    // Region-2 NPCs: their systems (class, shop, Konrad's quest) open with the region-2 build.
    const lines: Record<string, string> = {
      greta: '导师 Greta：「你就是从营地那边过来的？到 10 级、选职业的时候再来找我。」',
      mira: '商人 Mira：「货还在路上。等我把摊子摆好，你就能用德语跟我买东西了。」',
      konrad: '面包师傅 Konrad：「Brot……Brot。」他只会说这一个词，手里攥着一张写不出名字的纸条。',
    };
    say([{ who: id === 'greta' ? 'Greta' : id === 'mira' ? 'Mira' : 'Konrad', text: lines[id] ?? '……' }]);
  }

  /** Walk between regions: the neighbour's door (region 1) and the market's west gate (region 2). */
  travel(to: 1 | 2): void {
    const s = this.state;
    if (s.region === to) return;
    s.region = to;
    if (to === 2 && startQuest(s, 'main2')) this.questFire('enterMarket');
    // Arrive next to the door you came through.
    s.pos = to === 2 ? { x: 4 * 16 + 8, y: 24 * 16 + 8 } : { x: 67 * 16 + 8, y: 24 * 16 + 12 };
    this.persist();
    this.scene.scene.restart({ ctrl: this });
  }

  private knockRegion2() {
    const s = this.state;
    if (!has(s.level, 'boss2')) {
      say([{ who: '秤房', text: '门后传来秤砣一下一下的撞击声。有什么东西在数……数你身上有多少钱。（第 2 区首领，18 级开放）' }]);
      return;
    }
    const go = () =>
      say(
        BOSS2.intro.map((t) => ({ who: BOSS2.name, text: t })),
        () => {
          this.boss = startBoss(this.state, this.rng, 2);
          setBattleMusic(true);
          setPrompt(null);
          this.bossUI.open(this.boss);
        },
      );
    if (s.hp < maxHp(s) * 0.5) {
      say([{ who: SYS, text: '你的生命不到一半。先回篝火休息？' }], undefined, [
        { label: '直接推门', act: go },
        { label: '先去休息', act: () => undefined },
      ]);
      return;
    }
    go();
  }

  /** 吞秤者 rewards: gold chest on the first kill each day (iron after), orange + title the first time. */
  private finishBoss2(f: BossFight) {
    const s = this.state;
    const first = !s.flags.boss2Kills;
    s.flags.boss2Kills = ((s.flags.boss2Kills as number) ?? 0) + 1;
    const today = dayKey(now(s));
    const dailyFirst = s.flags.boss2Day !== today;
    s.flags.boss2Day = today;
    const lv = addXp(s, CONFIG.boss2.xp);
    s.gold += CONFIG.boss2.gold;
    this.questFire('boss2');
    this.chestQueue.push({ kind: dailyFirst ? 'gold' : 'iron', ilvl: s.level });
    if (first) {
      const o = makeItem(this.rng, s.level, 'orange');
      if (s.bag.length < CONFIG.loot.bagSize) s.bag.push(o);
      s.flags.title = 'Preisbrecher';
    }
    sfx.orange();
    banner('吞秤者倒下了', first ? '首杀：传说装备 + 称号「Preisbrecher」' : dailyFirst ? '金箱' : '铁箱');
    const lines: Line[] = BOSS2.outro.map((t) => ({ who: SYS, text: t }));
    lines.push({ who: SYS, text: `获得 ${CONFIG.boss2.xp} 经验、${CONFIG.boss2.gold} 金币和一个${dailyFirst ? '金' : '铁'}箱。` });
    const after = () => {
      for (const l of lv.levels) this.onLevelUp(l);
      this.refresh();
      this.persist();
      this.nextChest();
    };
    const learnable = Object.values(SKILLS).filter((k) => k.boss === 2 && !s.skills.includes(k.id));
    if (dailyFirst && learnable.length) {
      lines.push({ who: SYS, text: '它说过的话，你可以收一句作为句子技能（按 R 释放；最新学的那句排在第一位）。选一句：' });
      say(
        lines,
        undefined,
        learnable.map((k) => ({
          label: `${k.de}（${k.zh}：${k.effect}）`,
          act: () => {
            s.skills = [k.id, ...s.skills].slice(0, 3);
            toast(`学会句子技能：${k.de}`, 'gold');
            after();
          },
        })),
      );
    } else say(lines, after);
    void f;
  }

  regionWords(): Word[] {
    return [...zoneWords('echogasse'), ...zoneWords('schilderstrasse'), ...zoneWords('aschehof')];
  }

  private knock() {
    const s = this.state;
    if (s.flags.bossKills && s.level >= CONFIG.region2Level) {
      say([{ who: '门', text: '门开着。门后不是邻居的屋子，而是一条飘着面包香的集市街。' }], undefined, [
        { label: '穿过门去面包集市', act: () => this.travel(2) },
        { label: '再和无名的邻居打一场', act: () => this.knockBoss() },
        { label: '先不去', act: () => undefined },
      ]);
      return;
    }
    this.knockBoss();
  }

  private knockBoss() {
    const s = this.state;
    if (!has(s.level, 'boss')) {
      say([{ who: '门', text: '门后有什么东西在呼吸。（8 级开放）' }]);
      return;
    }
    const share = atLeastHalfShare(s, this.regionWords());
    if (share < CONFIG.boss.halfNameShare && !this.dev) {
      say([{ who: '门', text: `门后的东西还叫不出你的名字。先把这片街区 ${Math.round(CONFIG.boss.halfNameShare * 100)}% 的词打到半名（现在 ${Math.round(share * 100)}%）。` }]);
      return;
    }
    if (s.hp < maxHp(s) * 0.5) {
      say([{ who: SYS, text: '你的生命不到一半。先回篝火休息？' }], undefined, [
        { label: '直接敲门', act: () => this.openBoss() },
        { label: '先去休息', act: () => undefined },
      ]);
      return;
    }
    this.openBoss();
  }

  private openBoss() {
    say(
      BOSS.intro.map((t) => ({ who: BOSS.name, text: t })),
      () => {
        this.boss = startBoss(this.state, this.rng);
        setBattleMusic(true);
        setPrompt(null);
        this.bossUI.open(this.boss);
      },
    );
  }

  answerBoss(input: string, timedOut: boolean) {
    const v = answerBoss(this.state, this.boss!, input, this.rng, timedOut);
    (v.ok ? sfx.correct : sfx.wrong)();
    const log = todayLog(this.state);
    if (v.ok) log.correct += 1;
    else log.wrong += 1;
    this.refresh();
    return v;
  }

  finishBoss(): void {
    const s = this.state;
    const f = this.boss!;
    this.bossUI.close();
    setBattleMusic(false);
    this.boss = null;
    if (f.outcome === 'win' && f.which === 2) {
      this.finishBoss2(f);
    } else if (f.outcome === 'win') {
      const first = !s.flags.bossKills;
      s.flags.bossKills = ((s.flags.bossKills as number) ?? 0) + 1;
      const today = String(now(s) - (now(s) % 86400000));
      const dailyFirst = s.flags.bossDay !== today;
      s.flags.bossDay = today;
      const lv = addXp(s, CONFIG.xp.boss);
      s.gold += 120;
      // 金箱 (first kill of the day): ≥1 purple; first kill ever: an orange too. Otherwise an iron chest.
      const drops = dailyFirst
        ? [makeItem(this.rng, 9, 'purple'), makeItem(this.rng, 9, 'green'), makeItem(this.rng, 9, this.rng() < 0.3 ? 'purple' : 'green')]
        : [makeItem(this.rng, 9, 'green'), makeItem(this.rng, 9, 'white')];
      if (first) drops.unshift(makeItem(this.rng, 9, 'orange'));
      for (const d of drops) if (s.bag.length < CONFIG.loot.bagSize) s.bag.push(d);
      sfx.orange();
      banner('首领被唤醒', first ? '首杀：传说装备 + 称号「被记住的人」' : dailyFirst ? '金箱' : '铁箱');
      const lines: Line[] = BOSS.outro.map((t) => ({ who: SYS, text: t }));
      lines.push({ who: SYS, text: `获得 ${CONFIG.xp.boss} 经验、120 金币和 ${drops.length} 件装备（按 C 查看）。` });
      const learnable = Object.values(SKILLS).filter((k) => k.boss === 1 && !s.skills.includes(k.id));
      const after = () => {
        for (const l of lv.levels) this.onLevelUp(l);
        this.refresh();
        this.persist();
      };
      if (dailyFirst && learnable.length && has(s.level, 'skills')) {
        lines.push({ who: SYS, text: '它说过的话，你可以收一句作为句子技能（战斗里按 R，写对整句释放）。选一句：' });
        say(
          lines,
          undefined,
          learnable.map((k) => ({
            label: `${k.de}（${k.zh}：${k.effect}）`,
            act: () => {
              s.skills = [k.id, ...s.skills].slice(0, 3);
              toast(`学会句子技能：${k.de}`, 'gold');
              after();
            },
          })),
        );
      } else {
        say(lines, after);
      }
    } else {
      sfx.death();
      s.hp = maxHp(s);
      this.scene.teleportToBonfire();
      const miss = f.misses.slice(-3).map((m) => ({ who: '回顾', text: `它问「${m.asked}」，可以答：${m.model}` }));
      say([{ who: SYS, text: '它不再听你说话了。你在篝火旁醒来。首领的套路不会变，但问法每次不同：练熟了再来。' }, ...miss]);
    }
    this.scene.restyleAll();
    this.refresh();
    this.persist();
  }

  // ---- Gear -----------------------------------------------------------------------------

  equip(id: string): void {
    const s = this.state;
    const i = s.bag.findIndex((x) => x.id === id);
    if (i < 0) return;
    const it = s.bag[i];
    const old = s.equipped[it.slot];
    s.bag.splice(i, 1);
    if (old) s.bag.push(old);
    s.equipped[it.slot] = it;
    s.hp = Math.min(s.hp, maxHp(s));
    sfx.ui();
    this.panels.render();
    this.refresh();
  }

  unequip(slot: Slot): void {
    const s = this.state;
    const it = s.equipped[slot];
    if (!it || s.bag.length >= CONFIG.loot.bagSize) return;
    delete s.equipped[slot];
    s.bag.push(it);
    s.hp = Math.min(s.hp, maxHp(s));
    this.panels.render();
    this.refresh();
  }

  discard(id: string): void {
    this.state.bag = this.state.bag.filter((x) => x.id !== id);
    this.panels.render();
  }

  // ---- Saves ---------------------------------------------------------------------------------

  exportSave(): void {
    const blob = new Blob([exportJson(this.state)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `wortklinge-${this.state.name}-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    window.setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    toast('存档已导出');
  }

  importSave(text: string): void {
    const s = importJson(text);
    if (!s) {
      toast('这个文件不是失语纪元的存档');
      return;
    }
    save(s);
    location.reload();
  }

  resetSave(): void {
    if (!window.confirm('删除存档后无法恢复（除非你导出过）。确定吗？')) return;
    clearSave();
    location.reload();
  }

  // ---- Menu & keys -----------------------------------------------------------------------------

  renderMenu(): void {
    const menu = $('menu');
    menu.replaceChildren();
    const btn = (label: string, key: string, act: () => void) => {
      const b = document.createElement('button');
      b.className = 'btn panel';
      b.innerHTML = key ? `<kbd>${key}</kbd>${label}` : label;
      b.onclick = act;
      menu.append(b);
    };
    btn('角色', 'C', () => this.panels.toggle('hero'));
    if (this.state.cls || this.state.level >= CONFIG.region2Level) btn('职业', 'T', () => this.panels.toggle('talents'));
    if (this.state.quests) btn('任务', 'J', () => this.panels.toggle('quests'));
    btn('图鉴', 'B', () => this.panels.toggle('codex'));
    btn('数据', '', () => this.panels.toggle('data'));
    btn('账号', '', () => this.panels.toggle('account'));
    btn('设置', '', () => this.panels.toggle('settings'));
    btn('帮助', 'H', () => this.panels.toggle('help'));
    if (this.dev) {
      btn('+1 天', '', () => this.devSkip(24));
      btn('+1 级', '', () => {
        const lv = addXp(this.state, xpToNext(this.state.level) - this.state.xp);
        for (const l of lv.levels) this.onLevelUp(l);
        this.refresh();
      });
      btn('刷新怪', '', () => this.scene.spawnAll());
    }
  }

  devSkip(hours: number): void {
    this.state.timeOffset += hours * 3600_000;
    rollDay(this.state);
    this.scene.spawnAll();
    toast(`时间前进 ${hours} 小时`);
    this.refresh();
  }

  private onKey(e: KeyboardEvent) {
    if (!$('title').hidden) return;
    if (this.bossUI.onKey(e)) return;
    if (this.battleUI.onKey(e)) return;
    if (dialogOpen() && !isTyping()) {
      if ((e.key === 'Enter' || e.key === ' ') && !dialogHasChoices()) {
        e.preventDefault();
        advance();
      }
      return;
    }
    if (isTyping()) return;
    if (e.key === 'Escape' && this.panels.open) {
      this.panels.close();
      return;
    }
    if (this.battle || this.boss) return;
    const k = e.key.toLowerCase();
    if (k === 'c' || k === 'i') this.panels.toggle('hero');
    else if (k === 'b') this.panels.toggle('codex');
    else if (k === 't') this.panels.toggle('talents');
    else if (k === 'j') this.panels.toggle('quests');
    else if (k === 'h') this.panels.toggle('help');
    // First interaction unlocks audio in browsers.
    initAudio(this.state.settings.music, this.state.settings.sfx);
  }
}

export function freshState(name: string, origin: string): GameState {
  return newGame(name, origin);
}
