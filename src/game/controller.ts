// The game controller: owns the save, runs battles and tutorials, and glues the
// Phaser world to the DOM interface. Game rules live in src/core and stay pure.

import { answerBoss, startBoss, type BossFight } from '../core/boss';
import { makeQuestion, pickHint, resolveTurn, startBattle, type Battle, type Question, type TurnReport, type Tutorial } from '../core/combat';
import { CONFIG, xpToNext } from '../core/config';
import { makeItem } from '../core/loot';
import { applyLoss, applyWin } from '../core/outcomes';
import { defaultRng, type Rng } from '../core/rng';
import { atLeastHalfShare, instantGuiming, kindOf, recordAnswer, stageOf } from '../core/srs';
import { pickSpawns, zoneWords } from '../core/spawn';
import {
  addXp,
  clearSave,
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
import { SKILLS } from '../data/skills';
import { fullForm, WORD_BY_ID, WORDS } from '../data/words';
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

export class Controller {
  state: GameState;
  scene!: WorldScene;
  rng: Rng = defaultRng;
  battle: Battle | null = null;
  entity: MonsterEntity | null = null;
  boss: BossFight | null = null;
  battleUI = new BattleUI(this);
  bossUI = new BossUI(this);
  panels = new Panels(this);
  dev: boolean;
  private lastInput = Date.now();

  constructor(state: GameState, dev: boolean) {
    this.state = state;
    this.dev = dev;
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

  uiBlocking(): boolean {
    return !!this.battle || !!this.boss || dialogOpen() || !$('modal').hidden || !$('title').hidden;
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
        s.flags.pendingBlock = true;
        s.flags.pendingBreak = true;
        lines.push({ who: SYS, text: '下面两只怪会教你格挡和破防。看它说什么：要打你就格挡，缩起来就破防。' });
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
        lines.push({ who: SYS, text: '浓雾在退。面包集市和选职业在第 2 区，下一版开放。在那之前，把这片街区的名字都叫回来吧。' });
        break;
    }
    if (lines.length) say(lines);
    this.scene.restyleAll();
  }

  // ---- Encounters ----------------------------------------------------------------------

  encounter(m: MonsterEntity): void {
    if (this.battle) return;
    const s = this.state;
    rollDay(s);
    let tutorial: Tutorial = null;
    if (s.flags.pendingLoss && !m.isEcho) tutorial = 'loss';
    else if (s.flags.pendingBlock) tutorial = 'block';
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
      this.battle = startBattle(s, m.word, this.rng, { isEcho: m.isEcho, tutorial });
    }
    if (m.word.id === 'brot' && !s.flags.brotDone) {
      this.battle.monster.hp = this.battle.monster.maxHp = 1;
      this.battle.monster.dmg = 1;
    }
    this.scene.focusBattle(m);
    setBattleMusic(true);
    setPrompt(null);
    this.battleUI.open();
  }

  askQuestion(move: Move): Question {
    return makeQuestion(this.state, this.battle!, move, this.rng);
  }

  useHint(q: Question): string | null {
    return pickHint(this.battle!, q);
  }

  answer(move: Move, q: Question, input: string): TurnReport {
    const s = this.state;
    const b = this.battle!;
    const r = resolveTurn(s, b, move, q, input, this.rng);
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
    if (b.tutorial === 'block' && r.parried) s.flags.pendingBlock = false;
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

  finishBattle(): void {
    const s = this.state;
    const b = this.battle!;
    const m = this.entity!;
    this.battleUI.close();
    setBattleMusic(false);
    this.battle = null;
    this.entity = null;

    if (b.outcome === 'win') {
      const isBread = b.word.id === 'brot' && !s.flags.brotDone;
      const res = applyWin(s, b, this.rng);
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
        if (res.overCap && !s.flags.taughtCap) {
          s.flags.taughtCap = true;
          say([{ who: SYS, text: `今天已经学了 ${CONFIG.srs.dailyNewCap} 个新词。大脑一天记不住更多：之后新怪经验减半，去复习到期的词更划算。` }]);
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
        for (const lv of res.levelUp.levels) this.onLevelUp(lv);
        if (res.levelUp.capped && !s.flags.taughtCapLevel) {
          s.flags.taughtCapLevel = true;
          say([{ who: SYS, text: `你到了这一版的等级上限（${CONFIG.levelCap} 级）。经验会存着，第 2 区开放后接着升。继续打，归名和装备都还在涨。` }]);
        }
      }
    } else if (b.outcome === 'lose') {
      sfx.death();
      const at = { x: m.x, y: m.y };
      const loss = applyLoss(s, b, at);
      if (b.tutorial === 'loss') s.flags.pendingLoss = false;
      this.scene.removeMonster(m, 'flee');
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
      this.scene.removeMonster(m, 'flee');
      if (!m.isEcho) this.scene.time.delayedCall(10, () => this.scene.fillZone(m.zone));
    }
    this.scene.endFocus();
    this.scene.restyleAll();
    this.refresh();
    this.persist();
  }

  // ---- World interactions -------------------------------------------------------------------

  setPrompt(it: { kind: string; data?: string } | null): void {
    if (!it || this.uiBlocking()) return setPrompt(null);
    const text: Record<string, string> = {
      bonfire: '<kbd>E</kbd>在篝火旁休息',
      npc: '<kbd>E</kbd>和守火人 Hilde 说话',
      door: '<kbd>E</kbd>敲门',
      sign: '<kbd>E</kbd>看路牌',
    };
    setPrompt(text[it.kind]);
  }

  interact(it: { kind: string; data?: string }): void {
    if (it.kind === 'bonfire') this.rest();
    else if (it.kind === 'npc') this.talkHilde();
    else if (it.kind === 'door') this.knock();
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

  regionWords(): Word[] {
    return [...zoneWords('echogasse'), ...zoneWords('schilderstrasse'), ...zoneWords('aschehof')];
  }

  private knock() {
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
    if (f.outcome === 'win') {
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
      const learnable = Object.values(SKILLS).filter((k) => !s.skills.includes(k.id));
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
    btn('图鉴', 'B', () => this.panels.toggle('codex'));
    btn('数据', '', () => this.panels.toggle('data'));
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
    else if (k === 'h') this.panels.toggle('help');
    // First interaction unlocks audio in browsers.
    initAudio(this.state.settings.music, this.state.settings.sfx);
  }
}

export function freshState(name: string, origin: string): GameState {
  return newGame(name, origin);
}
