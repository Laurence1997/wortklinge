import { loadPron, pronCached } from '../ui/phoneme';
import { icon, setRestored, SLOT_TILE } from '../ui/icons';
import { answerPlacement, applyPlacement, canPlaceToday, regionFor, startPlacement, stopPlacement, type PlaceRun } from '../core/placement';
import { answerScreen, claimScene, SCREEN, startScreen, type ScreenRun, type ScreenScope } from '../core/screen';
import type { Look } from '../core/look';
// The game controller: owns the save, runs battles and tutorials, and glues the
// Phaser world to the DOM interface. Game rules live in src/core and stay pure.

import { answerBoss, startBoss, type BossFight } from '../core/boss';
import { bonfireRefill, grantStarter, tabletHeal, useItem, CONSUMABLE, count as itemCount, buyConsumable, type Consumable } from '../core/items';
import { alignPairs, canHint, hintOf, ITEM_TURN, linkPack, phraseCards, startPhraseBattle, makeQuestion, monsterStats, pickHint, resetClassFx, resolveTurn, rollSaying, shoutLine, startBattle, type Battle, type Question, type TurnReport, type Tutorial } from '../core/combat';
import { CONFIG, xpToNext } from '../core/config';
import { favour, FAVOUR, KONRAD_WORDS, QUESTS, questEvent, questState, startQuest, type QuestEvent } from '../core/quests';
import { CHEST_ZH, CHESTS, lockWord, openChest, type ChestKind } from '../core/chest';
import { playChest } from '../ui/chestFx';
import { gradeTyped } from '../core/grading';
import { buy as buyItem, openShop, refresh as refreshShop, sell as sellItem } from '../core/shop';
import { CLASSES, resMax, respec, respecCost, spent, TALENT_FROM_LEVEL, type ClassId } from '../core/classes';
import { makeItem } from '../core/loot';
import { applyLoss, applyWin, postFightHeal } from '../core/outcomes';
import { defaultRng, type Rng } from '../core/rng';
import { atLeastHalfShare, flushSkill, gapZh, instantGuiming, kindOf, recordAnswer, reviewedByWriting, stageOf } from '../core/srs';
import { dailyBoard, dailyKill, dailyText } from '../core/dailies';
import { engraveQuestion, identify, socketItems, unidentifiedItems } from '../core/identify';
import { pickSpawns, zoneMinLevel, zoneWords } from '../core/spawn';
import {
  addXp,
  gearTier,
  type Affinity,
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
import { shadowScore } from '../core/shadow';
import { noteEliteWin, type ElitePick } from '../core/elite';
import type { Move, Quality, Slot, Word, ZoneId } from '../core/types';
import { has, UNLOCK, UNLOCK_TEXT } from '../core/unlocks';
import { checkJournal, JOURNAL_KEEP, JOURNAL_WORDS, JOURNAL_XP_SHARE, journalWords, usesWord, type JournalEntry } from '../core/journal';
import { BOSS } from '../data/boss';
import { BOSS2 } from '../data/boss2';
import { BOSS3 } from '../data/boss3';
import { LINA } from '../data/lina';
import { WEBER, WEBER_POOL, usesDu } from '../data/weber';
import { answerExam, BREAK, examPassed, PART_ZH, startExam, startGrammarExam, type Exam } from '../core/breakthrough';
import { DUNGEON, RULES, type Rule } from '../data/dungeon';
import { AI_TUTOR, aiGradeText, duelTurn } from '../net/aiTutor';
import { DUEL, DUEL_SCENES, type DuelScene } from '../data/grammar/duels';
import { partnerChoices, partnerOf, setPartner } from '../core/gram/partner';
import { cleared, floorRun, floorsOf, GRAM_DUNGEON, markCleared, type DungeonKind, type Floor } from '../core/gram/dungeons';
import { SKILLS } from '../data/skills';
import { fullForm, hasArticleQuestion, WORD_BY_ID, WORDS, zhWithPos } from '../data/words';
import { initAudio, setBattleMusic, setVolumes, sfx, speak, speechAvailable, hasGermanVoice } from './audio';
import type { MonsterEntity, WorldScene } from './WorldScene';
import type { RegionId } from './map';
import { BattleUI } from '../ui/battle';
import { BossUI } from '../ui/boss';
import { advance, banner, dialogHasChoices, dialogOpen, say, setPrompt, toast, type Line } from '../ui/feedback';
import { logLine } from '../ui/gamelog';
import { ACHIEVEMENTS, NOTES } from '../data/achievements';
import { SCENE_BY_ID } from '../data/world';
import { dropPages, pageNo, pageRegion, readPage, regionRestored, restorePage } from '../core/diary';
import { SAYING_CFG, SAYINGS } from '../data/sayings';
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
    // Jonas is the neighbour (boss 1): lit once you have beaten him; Lina once her name is back.
    setRestored((who) => (who === 'lina' ? !!this.state.flags.linaFreed : !!this.state.flags.bossKills));
    this.state = state;
    this.dev = dev;
    // Levels gained when an old save was re-levelled on the faster curve: play their lessons once.
    const catchUp = String(state.flags.catchUpLevels ?? '');
    if (catchUp) {
      delete state.flags.catchUpLevels;
      window.setTimeout(() => {
        for (const l of catchUp.split(',').map(Number).filter(Boolean)) this.onLevelUp(l);
        this.refresh();
      }, 2500);
    }
    // A class trial borrows the class for its fights; undo it if the page closed mid-trial.
    if ('trialPrev' in state.flags) {
      state.cls = (state.flags.trialPrev as ClassId) || null;
      delete state.flags.trialPrev;
    }
    // 物品栏 (2026-11-22): saves already past Lv4 get the starter 纸条 / 药片 once.
    grantStarter(state);
    // 发音训练 (2026-11-23): start the phoneme model in the background when it is on and already downloaded.
    if (state.settings.pron) void pronCached().then((c) => (c ? loadPron().catch(() => undefined) : undefined));
    window.addEventListener('keydown', (e) => this.onKey(e));
    for (const ev of ['keydown', 'mousedown', 'mousemove']) window.addEventListener(ev, () => (this.lastInput = Date.now()), { passive: true });
    // Count active minutes for the playtest log (idle > 2 min doesn't count).
    window.setInterval(() => {
      if (document.visibilityState === 'visible' && Date.now() - this.lastInput < 120_000) {
        todayLog(this.state).minutes += 1;
        this.persist();
      }
    }, 60_000);
    // 开局计时 (0.5 block 6): active play seconds, so milestones can be checked against the 60-minute table.
    window.setInterval(() => {
      if (document.visibilityState === 'visible' && Date.now() - this.lastInput < 120_000 && $('title').hidden)
        this.state.flags.playSec = ((this.state.flags.playSec as number) ?? 0) + 10;
    }, 10_000);
    window.setInterval(() => (this.checkDiary(), this.persist()), 20_000);
    window.addEventListener('beforeunload', () => this.persist());
  }

  /** 成就: a title in the codex and a gold toast; nothing else. */
  achieve(id: string): void {
    const k = `ach_${id}`;
    if (this.state.flags[k]) return;
    const a = ACHIEVEMENTS.find((x) => x.id === id);
    if (!a) return;
    this.state.flags[k] = true;
    this.milestone(k);
    sfx.levelUp();
    toast(`成就：${a.zh} · 称号${a.title}`, 'gold');
    logLine(`成就：${a.zh}（${a.how}）`, 'good');
  }

  /** 日记残页: drop the pages whose word group is all 半名 (old saves get theirs on the first check). */
  checkDiary(): void {
    const ps = dropPages(this.state);
    if (!ps.length) return;
    this.milestone('diary_drop');
    sfx.levelUp();
    for (const p of ps) {
      const sc = SCENE_BY_ID[p.scene];
      toast(`日记残页：第 ${pageRegion(p.scene)} 区第 ${pageNo(p.scene)} 页（${sc?.zh ?? p.scene}）。按 B 在图鉴里复原`, 'gold');
      logLine(`掉落日记残页：${sc?.zh ?? p.scene} 这组词全到半名了。按 B 打开图鉴，把这一页填回去。`, 'good');
    }
    this.persist();
  }

  /** 日记残页 rewards (no level-gap decay); the region title once every page of it is restored. */
  diaryDone(scene: string, firstTry: number): number {
    const xp = restorePage(this.state, scene, firstTry);
    if (xp) this.diaryXp(xp, `复原日记残页（一次填对 ${firstTry} 空）`);
    const r = pageRegion(scene);
    if (regionRestored(this.state, r)) this.achieve(`diary${r}`);
    this.persist();
    return xp;
  }

  diaryRead(scene: string): number {
    const xp = readPage(this.state, scene);
    if (xp) this.diaryXp(xp, '把日记残页读出来');
    this.persist();
    return xp;
  }

  /** 篝火日记: today's 3 words, or null when locked, already written today or too few words fought. */
  journalOffer(): Word[] | null {
    const s = this.state;
    if (!has(s.level, 'diaryWrite')) return null;
    const today = dayKey(now(s));
    if ((s.journal ?? []).some((e) => e.day === today)) return null;
    const start = new Date(`${today}T00:00:00`).getTime() + CONFIG.dayStartHour * 3600_000;
    const ws = journalWords(s.words, start);
    return ws.length >= JOURNAL_WORDS ? ws : null;
  }

  /** Save a 篝火日记 entry; the first of the day gives a little XP. */
  saveJournal(words: Word[], text: string): number {
    const s = this.state;
    const today = dayKey(now(s));
    const first = !(s.journal ?? []).some((e) => e.day === today);
    const e: JournalEntry = { day: today, words: words.map((w) => w.id), text: text.trim() };
    s.journal = [...(s.journal ?? []), e].slice(-JOURNAL_KEEP);
    // 写对就算复习 (rev 51): a given word the entry uses without a flagged problem counts as reviewed.
    const hints = checkJournal(text, words).filter((x) => x.kind === 'article' || x.kind === 'verb');
    const bare = (w: Word) => w.de.replace(/^(der|die|das|sich) /i, '');
    for (const w of words) if (usesWord(text, w) && !hints.some((x) => x.text.includes(bare(w)))) reviewedByWriting(s, w);
    const xp = first ? Math.max(1, Math.round(xpToNext(s.level) * JOURNAL_XP_SHARE)) : 0;
    if (xp) this.diaryXp(xp, '写了篝火日记');
    this.persist();
    // AI 批改 (40 级): logged-in players get a teacher's note on the entry; offline or over the cap, nothing changes.
    if (s.level >= AI_TUTOR.from && s.owner) {
      void aiGradeText(text.trim(), words, '篝火日记：用今天打过的词写两三句话', s.level).then((r) => {
        if ('error' in r) return r.error === 'quota' ? toast('今天的 AI 批改次数用完了') : undefined;
        const lines: Line[] = r.ok && !r.errors.length ? [{ who: '批改', text: `写得对。${r.better ? `更自然的说法：${r.better}` : ''}` }] : [...r.errors.map((x) => ({ who: '批改', text: `「${x.bad}」→「${x.fix}」：${x.why}` })), ...(r.better ? [{ who: '批改', text: `改好的句子：${r.better}` }] : [])];
        if (lines.length) say(lines);
      });
    }
    return xp;
  }

  private diaryXp(xp: number, why: string): void {
    const lv = addXp(this.state, xp);
    logLine(`${why}，经验 +${xp}`, 'good');
    for (const l of lv.levels) this.onLevelUp(l);
    this.refresh();
  }

  /** 纸条: a story note found as a drop, kept in the codex. */
  findNote(id: string): void {
    const n = NOTES.find((x) => x.id === id);
    if (!n || this.state.flags[`note_${id}`]) return;
    this.state.flags[`note_${id}`] = true;
    this.milestone(`note_${id}`);
    window.setTimeout(() => say([{ who: SYS, text: `它散开的地方留下一张纸。【${n.zh}】` }, { who: '纸条', text: n.text }, { who: SYS, text: '纸条收进了图鉴。' }]), 400);
  }

  /** 剧情片段 (节奏表 45–50 分): the first time you reach the crossroads, the neighbour's door is in sight. */
  /** 全量筛选: walking into a scene pays the XP its town-named words stored there. */
  claimScene(sceneId: string): { words: number; xp: number } | null {
    const r = claimScene(this.state, sceneId);
    if (!r) return null;
    logLine(`你在城里认出的 ${r.words} 个词就住在这里 · +${r.xp} 经验`, 'good');
    for (const l of r.levelUp.levels) this.onLevelUp(l);
    this.checkDiary();
    this.refresh();
    this.persist();
    return r;
  }

  sawNeighbour(): void {
    if (this.state.flags.sawNeighbour) return;
    this.state.flags.sawNeighbour = true;
    this.milestone('story_door');
    say([
      { who: SYS, text: '路的尽头有一扇门。门缝里漏出红光，一下一下，像在呼吸。' },
      { who: SYS, text: '门后有人在念名字。念一个，停一下。听不清是谁的。' },
      { who: HILDE, text: '（远远地喊）别过去！那是「邻居」。你现在叫不出它的名字。' },
      { who: SYS, text: '【无名的邻居】区域首领。8 级起可以敲门，这片街区的名字叫回四成，门才会开' },
    ]);
  }

  /** 开局计时: the active-play minute something happened for the first time (kept once). */
  milestone(key: string): void {
    const k = `ms_${key}`;
    if (k in this.state.flags) return;
    this.state.flags[k] = Math.round((((this.state.flags.playSec as number) ?? 0) / 60) * 10) / 10;
  }

  // ---- Scene hooks ---------------------------------------------------------------

  onSceneReady(scene: WorldScene): void {
    this.scene = scene;
    initAudio(this.state.settings.music, this.state.settings.sfx);
    this.renderMenu();
    this.refresh();
    if (rollDay(this.state)) this.scene.spawnAll();
    if (this.state.region === 2 && startQuest(this.state, 'main2')) questEvent(this.state, 'enterMarket');
    if (!this.state.flags.intro) {
      if (!this.state.flags.placeAsked) this.askPlacement();
      else this.intro();
    } else this.welcomeBack();
  }

  wordById(id: string): Word | undefined {
    return WORD_BY_ID[id];
  }

  pickSpawns(zone: ZoneId, n: number, alive: Set<string>) {
    // The tutorial bread only lives by the bonfire until it is named.
    if (!this.state.flags.brotDone) alive.add('brot');
    const s = this.state;
    const phraseOk = s.level >= SAYING_CFG.fromLevel && phraseCards().some((x) => !s.sayings?.[x.id]);
    return pickSpawns(s, zone, n, alive, this.rng, { phraseOk });
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

  /** 相亲和: switch the amulet's affinity (free, at a bonfire). */
  setAffinity(a: Affinity | null): void {
    if (a) this.state.flags.affinity = a;
    else delete this.state.flags.affinity;
    this.persist();
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
      { who: SYS, text: '……心跳恢复。' },
      { who: HILDE, text: '醒了？别动。火边那块面包，刚才咬了我一口。' },
      { who: HILDE, text: '它怕名字。叫它。' },
      { who: SYS, text: '【名词带上 der / die / das，错一个字它都不认】' },
    ];
    say(lines, () => {
      this.state.flags.intro = true;
      this.spawnBread();
      this.persist();
      toast(this.scene.nodes ? '在右边的场景面板里点它（或按 1）' : '走过去碰它（WASD 或方向键移动）');
    });
  }

  private welcomeBack() {
    const s = this.state;
    const due = WORDS.filter((w) => kindOf(s, w) === 'due').length;
    if (due > 0) toast(`${due} 个名字又长出了牙（头上有「!」）`, 'gold');
    // 0.5: existing players get one note on what moved, instead of the level-up lessons they already passed.
    if (!s.flags.seen05) {
      s.flags.seen05 = true;
      if (s.level < 2) return;
      const lines: Line[] = [{ who: SYS, text: '【0.5】地图改成一站一站走：点地图上的圆点或右边面板的出口，数字键打怪，M 打开大地图。' }];
      if (s.level >= 3) lines.push({ who: SYS, text: '装备提前到 3 级开放。' });
      if (s.level >= 4) lines.push({ who: SYS, text: '铭刻 Q、低语（答题时按 W）和言灵提前到 4 级：打中弱点、答对打字题攒言灵，铭刻答错扣 1 点。' });
      if (s.level >= 5) lines.push({ who: SYS, text: '终结技 F 提前到 5 级；5 级起技能栏有「读出来」（S）：新词读出来就是必中一击，答对后还可以跟读整句多拿经验（都可选）。' });
      if (s.level >= 3) lines.push({ who: SYS, text: '金色名牌的「残句」是句子怪，打散它收短句卡。' });
      window.setTimeout(() => say(lines), 800);
    }
    // 0.6: one note for players who were already playing.
    if (!s.flags.seen06) {
      s.flags.seen06 = true;
      if (s.level < 3) return;
      const lines: Line[] = [{ who: SYS, text: '【0.6】每个场景有了自己的小插画和一组固定的词：词学到半名，画里对应的东西就亮起来。' }];
      lines.push({ who: SYS, text: '一个场景的词全到半名，会掉一页邻居的日记残页，按 B 在图鉴里填回去，还可以读出来。' });
      if (s.level >= 9) lines.push({ who: SYS, text: '护符亲和改了：对上亲和的怪选对相，墨水或沉着 +2；破甲照旧。' });
      if (s.level >= 18) lines.push({ who: SYS, text: '第 3 区铁轨镇开了（21–30 级），等级上限到 30。打赢第 2 区首领吞秤者就能过去；21 级起几乎每一级都有新东西。' });
      window.setTimeout(() => say(lines), 900);
    }
  }

  /** Lessons tied to a level (游戏设计 › 新手引导). */
  /** `quiet` (入学测试 jumps): set the level's flags and gifts but say nothing; the caller shows one summary. */
  private onLevelUp(level: number, quiet = false) {
    const s = this.state;
    this.milestone(`lv${level}`);
    if (!quiet) {
      sfx.levelUp();
      banner(`Lv ${level}`, (UNLOCK_TEXT[level] ?? [])[0] ?? '');
    }
    const unlocked = UNLOCK_TEXT[level] ?? [];
    const lines: Line[] = unlocked.map((t) => ({ who: SYS, text: `【新能力】${t}` }));
    if (grantStarter(s)) lines.push({ who: SYS, text: `【物品栏】送你 ${itemCount(s, 'hint')} 张低语纸条和 ${itemCount(s, 'tablet')} 片药片。${CONSUMABLE.hint.zh}：${CONSUMABLE.hint.use}。${CONSUMABLE.tablet.zh}：${CONSUMABLE.tablet.use}。篝火休息会把纸条补到 3 张。` });
    switch (level) {
      case 23:
        if (!s.flags.glassesGift) {
          s.flags.glassesGift = true;
          const g = makeItem(this.rng, level, 'white', 'glasses');
          if (!s.equipped.glasses) s.equipped.glasses = g;
          else if (s.bag.length < CONFIG.loot.bagSize) s.bag.push(g);
          lines.push(
            { who: HILDE, text: '拿着。站台上捡的，镜片裂了一片，还能用。' },
            { who: SYS, text: `【眼镜】${g.name}已经戴上：怪蓄力的那一下砸到你身上会轻 ${Math.round(g.main * 100)}%。下一只蓄大招的怪，看看伤害。` },
          );
        }
        break;
      case 2:
        lines.push({ who: SYS, text: '【默写】有些怪要你把名字打出来。名词带冠词：der Tee' });
        break;
      case 3:
        lines.push({ who: HILDE, text: this.scene.nodes ? '累了就回营地坐坐。打散的东西会再长出来。牙少一点。' : '累了就回来坐（E）。打散的东西会再长出来。牙少一点。' });
        lines.push({ who: SYS, text: `【装备】下一只怪会掉东西。C 打开角色，穿上。打得越多，碎片越多，攒够 40 片装备升一档${gearTier(s) ? `。你一路打来已经攒够了：现在是第 ${gearTier(s)} 档，伤害更高，同级的怪少挨一下` : ''}` });
        s.flags.teachRest = true;
        break;
      case 4:
        s.flags.pendingLoss = true;
        s.flags.teachSkills = true;
        lines.push(
          { who: SYS, text: '【铭刻 Q】下一题难一级，答对伤害 ×1.5，答错丢 1 点言灵。不限次数' },
          { who: SYS, text: '【低语 W】看到题后卡住了，按 W（打字时按 ?）用一张低语纸条要提示：选择题去掉一个错选项，打字题给首字母。那题不算会写，也不能归名' },
          { who: SYS, text: '【言灵】打中弱点、答对打字题都会攒言灵，最多 5 点' },
        );
        break;
      case 5:
        s.flags.teachFinisher = true;
        lines.push(
          { who: HILDE, text: '光叫名字不够。说一整句，它们更怕。' },
          { who: HILDE, text: '「Ich möchte einen Tee.」听见了？der 到了这里变成 einen。die 变 eine，das 变 ein。' },
          { who: SYS, text: '【终结技 F】言灵攒满后，对任何怪看中文写整句：吃的喝的 Ich möchte，地方 Wo ist，人 Ich habe。写对破甲。下一场你的言灵是满的，试一下' },
        );
        break;
      case 6:
        lines.push({ who: SYS, text: '【元素】选对相附带元素：der 冰 · die 火 · das 毒' });
        break;
      case 8:
        lines.push({ who: HILDE, text: `东边那扇门后面，住着个「邻居」。这片街区的名字你叫回四成，它才肯开门。` });
        break;
      case 10:
        lines.push(
          { who: HILDE, text: s.flags.bossKills ? '门开了。后面是面包集市。人多，东西也多。' : '雾在退。门后那个邻居倒下，路就通到集市。' },
          { who: HILDE, text: '到了那边，找 Greta。她会教你怎么打。' },
        );
        break;
      case 11:
        lines.push({ who: SYS, text: '【群怪】集市里的东西成群。先盯住一只（Tab），再喊它的冠词' });
        break;
      case 12:
        lines.push({ who: SYS, text: '【变位】du ___（nehmen）→ nimmst。强变化动词经验 ×1.3' });
        if (s.cls) lines.push({ who: SYS, text: '【天赋】第一个点到手。按 T' });
        break;
      case 13:
        lines.push({ who: SYS, text: '【mich / dich】「Ich kratze dich!」挠你。「Ich kratze mich.」挠它自己' });
        break;
      case 18:
        lines.push({ who: SYS, text: '粮仓尽头，秤房的门开了。里面那个东西只认数字：价签上写多少，就用德语说多少。' });
        break;
    }
    if (lines.length && !quiet) say(lines);
    this.scene.restyleAll();
  }

  // ---- Encounters ----------------------------------------------------------------------

  encounter(m: MonsterEntity, opts: { trial?: ClassId } = {}): void {
    if (this.battle) return;
    const s = this.state;
    rollDay(s);
    this.milestone(m.phrase ? 'm_phrase' : m.rare ? 'm_rare' : m.isEcho ? 'm_echo' : `m_${m.word.pos ?? 'n'}`);
    let tutorial: Tutorial = null;
    if (s.flags.pendingLoss && !m.isEcho) tutorial = 'loss';

    // The forced loss uses a dog that bites three times (Lv4 lesson).
    if (tutorial === 'loss') {
      const dog = WORD_BY_ID['hund'];
      this.entity = m;
      this.battle = startBattle(s, dog, this.rng, { tutorial: 'loss' });
    } else if (m.elite && !tutorial) {
      // 场景精英 (9 级): part 1 of 3 (认 → 用 → 写), one word of its scene each.
      this.entity = m;
      this.battle = this.eliteBattle(m.elite, 0);
      if (!s.flags.eliteTaught) {
        s.flags.eliteTaught = true;
        say([
          { who: SYS, text: '【场景精英 ◈】这个场景的词你学了一半，它把其中 3 个攥在一起来考你。' },
          { who: SYS, text: '分 3 段，每段换一个词：先认（选择题），再用（例句填空），最后写（默写）。中间不回血，每段打完都算打败这个词。' },
          { who: SYS, text: '第一次打赢必掉铁箱。以后这个场景有 3 个词到期复习，它还会再来。' },
        ]);
      }
    } else if (m.phrase && !tutorial) {
      // 残句 (0.5): a sentence monster, no word behind it.
      this.entity = m;
      this.battle = startPhraseBattle(s, m.phrase, this.rng, m.zone);
    } else {
      this.entity = m;
      this.battle = startBattle(s, m.word, this.rng, { isEcho: m.isEcho, tutorial, trial: opts.trial, rare: m.rare, challenge: m.challenge });
      // 斩杀: a word being verified shouts no half sentence (it could show its letters).
      if (!tutorial && !opts.trial && !this.battle.verify) {
        const say = rollSaying(s, m.word, this.rng);
        if (say) {
          this.milestone('m_saying');
          this.battle.saying = say;
          if (this.battle.intent.kind !== 'charge' && this.battle.intent.kind !== 'flee') this.battle.intent = { ...this.battle.intent, ...shoutLine(say) };
        }
      }
      if (this.battle.rusty && !s.flags.rustyTaught) {
        s.flags.rustyTaught = true;
        say([{ who: SYS, text: '【锈名】这只遗忘之物拖了太久，名字生了锈：高 1 级、血多三成。打败它经验和金币翻倍，必掉 1 片碎片。它不会逃，也不会追你。' }]);
      }
      // 怪物诅咒 (0.6, 25 级): about one in ten carries 遗忘 or 沉默; the first one after the hall gate is certain.
      if (s.level >= CONFIG.curse.from && !m.isEcho && (s.flags.curseNext || this.rng() < CONFIG.curse.chance)) {
        const first = !!s.flags.curseNext;
        delete s.flags.curseNext;
        this.battle.curse = first ? 'forget' : this.rng() < 0.5 ? 'forget' : 'silence';
        this.battle.cursed = true;
        if (!s.flags.curseTaught) {
          s.flags.curseTaught = true;
          say([
            { who: SYS, text: '【怪物诅咒】这只怪身上缠着咒文（名牌上标着）。遗忘：这场不能低语，也没有中文提示。沉默：这场不能读出来和跟读。' },
            { who: SYS, text: '答对一道难题（铭刻、蓄力时的那题都算）就能破咒。带诅咒的怪经验 ×1.3，多 1 片碎片。' },
          ]);
        }
      }
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
    // 教学战 (Lv5): the first fight after 终结技 opens starts with a full 言灵 bar.
    if (s.flags.teachFinisher && !tutorial && !opts.trial && !m.phrase && has(s.level, 'sentence') && resMax(s)) {
      delete s.flags.teachFinisher;
      this.battle.cfx.res = resMax(s);
      this.battle.teachFin = true;
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
        { who: HILDE, text: '一群！这两只是同一个冠词。' },
        { who: HILDE, text: '选对相，按「齐鸣」：一题打两只，连那只喊「Moment!」的蓄力也一起打断。相选错，齐鸣不响，只打到目标。' },
      ]);
    }
  }

  /** 场景精英: the battle for one part. Never rusty, plural or cursed; hits ×1.2; statuses and hints carry over. */
  private eliteBattle(pick: ElitePick, seg: number, prev?: Battle): Battle {
    const b = startBattle(this.state, WORD_BY_ID[pick.words[seg]], this.rng, { elite: true });
    b.elite = { scene: pick.scene, words: pick.words, seg, review: pick.review };
    // 挑战怪 in the 3rd part (rev 342): same elite level, but ×1.75 XP and the quick 斩杀 if written unseen.
    if (pick.challengeSeg === seg) b.challenge = true;
    b.monster.dmg = Math.max(1, Math.round(b.monster.dmg * CONFIG.elite.dmgMult));
    if (prev) {
      b.fx = prev.fx;
      b.hintsLeft = prev.hintsLeft;
      b.skillCooldown = prev.skillCooldown;
      b.turn = prev.turn + 1;
    }
    return b;
  }

  /** 场景精英: a part is down and another follows. Settles that word (no heal) and starts the next part. */
  nextElitePart(): boolean {
    const b = this.battle;
    const m = this.entity;
    if (!b?.elite || b.outcome !== 'win' || !m?.elite || b.elite.seg >= b.elite.words.length - 1) return false;
    this.settleKill(b, m, true, true);
    const nb = this.eliteBattle(m.elite, b.elite.seg + 1, b);
    this.battle = nb;
    this.pack = [nb];
    this.packEntities = [m];
    toast(`精英第 ${nb.elite!.seg + 1} / ${nb.elite!.words.length} 段：${['认', '用', '写'][nb.elite!.seg]}`, 'gold');
    this.refresh();
    this.persist();
    return true;
  }

  /** Region 2 (Lv11+): nearby nouns of the same scene join the fight (群怪, 游戏设计 六「群怪」 rev 49).
   *  Lv11–12: 2, same or different article half each (the first pack: 2 of the same article, the mate charging);
   *  Lv13+: up to 3 = a same-article pair + one with another article; B1: up to 4 with at least one pair.
   *  A pair's lines use the same case (alignPairs), so a stance right on one is right on the other. */
  private gatherPack(m: MonsterEntity) {
    const s = this.state;
    if (!has(s.level, 'packs') || (s.region ?? 1) < 2 || m.isEcho || m.scripted || m.rare || m.phrase || m.elite || !m.word.art || m.word.family === 'truhe') return;
    const firstPack = !s.flags.firstPackDone;
    const max = firstPack || s.level < CONFIG.pack.max3From ? 2 : s.level >= CONFIG.pack.max4From ? CONFIG.pack.max4 : CONFIG.pack.max;
    const r = CONFIG.pack.radiusTiles * 16;
    const near = this.scene.monsters
      .filter((o) => o !== m && !o.isEcho && !o.scripted && !o.rare && !o.phrase && !o.elite && o.zone === m.zone && !!o.word.art && o.word.family !== 'truhe' && o.word.id !== m.word.id && Math.hypot(o.x - m.x, o.y - m.y) <= r)
      .sort((a, b) => Math.hypot(a.x - m.x, a.y - m.y) - Math.hypot(b.x - m.x, b.y - m.y));
    const same = near.filter((o) => o.word.art === m.word.art);
    const diff = near.filter((o) => o.word.art !== m.word.art);
    // Wanted articles after the target, in order: 'same' or 'diff'.
    const want: Array<'same' | 'diff'> = firstPack ? ['same'] : max === 2 ? [this.rng() < 0.5 ? 'same' : 'diff'] : max === 3 ? ['same', 'diff'] : ['same', 'diff', this.rng() < 0.5 ? 'same' : 'diff'];
    const picked: MonsterEntity[] = [];
    const take = (list: MonsterEntity[]) => {
      const o = list.find((x) => !picked.includes(x));
      if (o) picked.push(o);
      return !!o;
    };
    for (const w of want) if (!take(w === 'same' ? same : diff)) take(w === 'same' ? diff : same);
    if (firstPack && (!picked.length || picked[0].word.art !== m.word.art)) return; // the teaching pack waits for a same-article pair
    const tut = firstPack ? 'packCharge' : null;
    const lead = this.pack[0];
    for (const o of picked.slice(0, max - 1)) {
      const ob = startBattle(s, o.word, this.rng, { tutorial: tut, challenge: o.challenge });
      // A same-article pair stays a pair: a crowd (复数怪, always die) pairs with a crowd, a single with a single.
      if (o.word.art === m.word.art && !!ob.pluralMon !== !!lead.pluralMon && o.word.pl && o.word.pl !== '-' && !o.word.plOnly && !tut) {
        const k = CONFIG.phase.pluralHp;
        ob.pluralMon = !!lead.pluralMon;
        ob.pluralDue = ob.pluralMon;
        ob.monster.hp = ob.monster.maxHp = Math.max(1, Math.round(ob.monster.maxHp * (ob.pluralMon ? k : 1 / k)));
        if (ob.pluralMon && ob.intent.kind === 'attack') ob.intent = { ...ob.intent, line: '… mmh … mmh …', zh: '一群同一个词的怪挤在一起嘟囔 · 复数一律 die', full: undefined, fullZh: undefined, caseArt: undefined };
      }
      this.pack.push(ob);
      this.packEntities.push(o);
    }
    if (this.pack.length === 1) return;
    // Pack-wide values (player statuses, hints, skill cooldown) are shared; same-article pairs read in one case.
    linkPack(this.pack);
    alignPairs(s, this.pack);
    this.retarget();
  }

  /** 每日委托: count a kill (zone) or a right 语境复习 answer toward today's tasks and pay what finished. */
  private dailyTick(zone: ZoneId | undefined, reviewOk: boolean): void {
    const s = this.state;
    if (!has(s.level, 'dailies')) return;
    const d = dailyKill(s, this.rng, zone, reviewOk);
    for (const p of d.paid) {
      toast(`每日委托完成：${dailyText(p.task)} · +${p.xp} 经验 · +${p.gold} 金币 · 碎片 +2`, 'gold');
      for (const lv of p.levelUp.levels) this.onLevelUp(lv);
    }
    if (d.chest) {
      toast('今天的三条委托都做完了：铁箱一个', 'gold');
      this.gotChest('iron', s.level);
    }
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

  /** 跟读 (Lv5+): can the player still earn the read-along bonus in this fight? */
  canShadow(): boolean {
    return has(this.state.level, 'shadowing') && !!this.battle && this.battle.curse !== 'silence' && !this.pack.some((b) => b.shadowed) && !this.battle.tutorial;
  }

  /** 跟读 result. Sounding right pays CONFIG.shadow.xp once per fight; a miss costs nothing. */
  shadowed(target: string, heard: string[]): { ok: boolean; score: number; xp: number } {
    const score = shadowScore(target, heard);
    const ok = score >= CONFIG.shadow.match;
    if (!ok || !this.canShadow()) return { ok, score, xp: 0 };
    for (const b of this.pack.length ? this.pack : [this.battle!]) b.shadowed = true;
    this.milestone('shadow');
    const xp = CONFIG.shadow.xp;
    const lv = addXp(this.state, xp);
    logLine(`跟读：「${target}」读得像，经验 +${xp}`, 'good');
    for (const l of lv.levels) this.onLevelUp(l);
    return { ok, score, xp };
  }

  askQuestion(move: Move): Question {
    const q = makeQuestion(this.state, this.battle!, move, this.rng, undefined, this.pack.length > 1, this.pack);
    this.milestone(`q_${q.type}${q.type === 'cloze' && q.prompt.startsWith('代词') ? '_pron' : ''}`);
    if (move !== 'attack') this.milestone(`mv_${move}`);
    if (move === 'inscribe') delete this.state.flags.teachSkills;
    if (this.dungeon) this.dungeon.asked = Date.now();
    if (move === 'whisper') this.onWhisper();
    return q;
  }

  /** 低语 taken as a hint on the question already shown (2026-11-22); null when not allowed. */
  hint(move: Move, q: Question): Question | null {
    if (!canHint(this.state, this.battle!, move, q) || !useItem(this.state, 'hint')) return null;
    this.milestone('mv_whisper');
    this.persist();
    this.onWhisper();
    return hintOf(this.battle!, q);
  }

  /** 药片 (物品栏): heal, then the monsters act (the turn is spent). Null when there is none or HP is full. */
  useTablet(): { report: TurnReport; heal: number } | null {
    const s = this.state;
    const b = this.battle;
    if (!b || b.outcome || b.tutorial || s.hp >= maxHp(s) || itemCount(s, 'tablet') <= 0) return null;
    useItem(s, 'tablet');
    const before = s.hp;
    s.hp = Math.min(maxHp(s), s.hp + tabletHeal(s));
    const heal = s.hp - before;
    this.milestone('tablet');
    const r = resolveTurn(s, b, 'item', ITEM_TURN, '', this.rng, this.pack);
    if (r.killer) this.killer = r.killer;
    if (r.monsterDamage > 0) {
      sfx.hurt();
      this.scene.shake(0.004);
    }
    this.refresh();
    this.persist();
    return { report: r, heal };
  }

  buyConsumable(k: Consumable, sentence: string) {
    const r = buyConsumable(this.state, k, sentence);
    if (r.ok) sfx.loot();
    this.refresh();
    this.persist();
    return r;
  }

  private onWhisper(): void {
    delete this.state.flags.teachSkills;
    if (this.dungeon?.rule.id === 'keineHilfe' && this.dungeon.kept) {
      this.dungeon.kept = false;
      toast('「Keine Hilfe.」你用了低语：这次的规则加成作废了。');
    }
  }

  useHint(q: Question): string | null {
    return pickHint(this.battle!, q);
  }

  answer(move: Move, q: Question, input: string): TurnReport {
    const s = this.state;
    const b = this.battle!;
    if (this.dungeon?.rule.id === 'schnell' && this.dungeon.kept && Date.now() - this.dungeon.asked > DUNGEON.seconds * 1000) {
      this.dungeon.kept = false;
      toast('「Schnell!」超过 10 秒了：这次的规则加成作废了。');
    }
    const r = resolveTurn(s, b, move, q, input, this.rng, this.pack);
    if (r.killer) this.killer = r.killer;
    if (r.review) {
      const rv = r.review;
      if (rv.placed) {
        logLine(rv.ok ? `✓ 抽查 · ${fullForm(rv.word)}：确认会了，斩杀` : `抽查没答上：${fullForm(rv.word)} 会作为复习怪跟着你。`, rv.ok ? 'good' : 'bad');
        if (rv.reverted) toast(`这一段的词抽查错得多，剩下 ${rv.reverted} 个推定会的词改成复习怪，跟着你练`, 'gold');
      } else
      logLine(rv.ok ? `✓ 复习 · ${fullForm(rv.word)}，${rv.next ? `下次 ${gapZh(rv.next)}` : '不用再复习了'}` : `复习没答上：${fullForm(rv.word)} 复发了，会作为复习怪回到野外。`, rv.ok ? 'good' : 'bad');
      if (rv.ok) this.dailyTick(undefined, true);
    }
    // 成就 · 五连弱点: right stances in a row (a wrong one resets; turns without a stance don't count).
    if (r.phase === 'right') {
      s.flags.weakRun = ((s.flags.weakRun as number) ?? 0) + 1;
      if ((s.flags.weakRun as number) >= 5) this.achieve('weak5');
    } else if (r.phase === 'wrong' || r.phase === 'soft') s.flags.weakRun = 0;
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
    flushSkill(s, b.word, b);
    if (r.correct) this.checkDiary();
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
    // 前 10 级连错 2 次自动给中文提示
    if (!r.correct && b.wrongStreak >= 2 && s.level <= 10) r.verdict.notes.push(`提示：${b.word.zh}`);
    this.refresh();
    return r;
  }

  /** 斩杀 (0.6.x): a verified monster dies in one click; XP and drops as usual. True when the fight is over. */
  cut(): boolean {
    const b = this.battle;
    if (!b || !b.cutReady || b.outcome) return false;
    b.monster.hp = 0;
    b.outcome = 'win';
    b.lastKillTyped = true;
    sfx.crit();
    this.milestone('cut');
    if (this.pack.length > 1 && !this.fightOver()) {
      this.settleKill(b, this.packEntities[this.pack.indexOf(b)]);
      this.retarget();
      this.refresh();
      return false;
    }
    this.finishBattle();
    return true;
  }

  flee(): void {
    if (!this.battle) return;
    if (this.battle.tutorial === 'loss') {
      toast('逃不掉。');
      return;
    }
    this.state.combo = 0;
    this.battle.outcome = 'fled';
    this.finishBattle();
  }

  /** Rewards for one dead monster: XP, gold, 归名, drops, lessons. Packs call it per kill. */
  private settleKill(b: Battle, m: MonsterEntity, inPack = this.pack.length > 1, keepEntity = false) {
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
          { who: SYS, text: '牙一颗颗掉下来。它又是一块面包了。' },
          { who: SYS, text: '【归名】这次是借你的。以后要在不同的三天各打败它一次，最后一下默写全名' },
          { who: HILDE, text: '……真叫回来了。东边回声巷，这种东西到处都是。去吧。火我守着。' },
        ], () => {
          const target = regionFor(s.level);
          if (target > (s.region ?? 1)) this.offerPlaceTravel(target);
        });
      } else {
        if (!keepEntity) this.scene.removeMonster(m, res.kill.guiming || b.cutReady ? 'guiming' : 'scatter');
        if (b.cutReady) {
          sfx.guiming();
          toast(b.verify === 'recheck' ? `斩杀 · ${fullForm(b.word)} 永久退役` : `斩杀 · ${fullForm(b.word)} 已退役，30 天后回响抽查一次`, 'gold');
          this.speak(fullForm(b.word));
        } else if (res.kill.guiming) {
          sfx.guiming();
          banner('归名', `${fullForm(b.word)} · ${b.word.zh}`);
          this.speak(fullForm(b.word));
        }
        if (res.card) this.achieve('card1');
        if (stageOf(s, b.word) >= 2) this.achieve('half1');
        // 剧情片段 (节奏表 20–25 分): from Lv2 the first kill drops the neighbour's note.
        if (s.level >= 2 && !s.flags.note_neighbour && !b.phrase) this.findNote('neighbour');
        logLine(b.phrase ? `击败残句：${b.phrase.a} ${b.phrase.b}（${b.phrase.zh}）` : `击败 ${fullForm(b.word)}（${b.word.zh}）`, 'good');
        if (res.card) {
          const x = SAYINGS.find((y) => y.id === res.card!.id);
          if (x) toast(res.card.first ? `短句卡「${x.a} ${x.b}」收进收集册：${x.when}` : `又打散一个「${x.a} ${x.b}」`, res.card.first ? 'gold' : '');
        }
        const bits = [`+${res.xp} 经验`, `+${res.gold} 金币`];
        if (res.review) bits.push('复习 +50%');
        if (res.kill.to > res.kill.from && !res.kill.guiming) bits.push(`${b.word.de}：${['无名', '裂形', '半名', '归名'][res.kill.to]}`);
        toast(bits.join(' · '));
        if (res.kill.needsTypedFinal && !s.flags.taughtFinal) {
          s.flags.taughtFinal = true;
          say([{ who: SYS, text: '【差一步】选择题叫不回名字。下次遇到它，默写全名收尾' }]);
        }
        if (res.kill.kind === 'shadow' && !s.flags.taughtShadow) {
          s.flags.taughtShadow = true;
          toast('半透明的是影子：还没到时候，打它不算复习');
        }
        if (res.echoRecovered) {
          banner('回响', `取回 ${res.echoRecovered.gold} 金币和 ${res.echoRecovered.xp} 经验`);
        }
        this.milestone(`z_${m.zone}`);
        if (res.drop) this.milestone('drop');
        if (res.card) this.milestone('card');
        if (res.gearUp) this.milestone(`gear${res.gearUp}`);
        if (res.kill.guiming) this.milestone('guiming');
        if (res.drop) {
          (res.drop.quality === 'orange' ? sfx.orange : sfx.loot)();
          toast(`掉落：${res.drop.name}（${{ white: '普通', green: '优秀', purple: '史诗', orange: '传说' }[res.drop.quality]}）`, res.drop.quality === 'white' ? '' : 'gold', icon(SLOT_TILE[res.drop.slot], 1, false, `slot-icon q-${res.drop.quality}`));
          if (!s.flags.taughtGear) {
            s.flags.taughtGear = true;
            say([{ who: SYS, text: '【装备】C 打开角色，点「穿上」' }]);
          }
        }
        if (res.bagFull) toast('背包满了，没捡起来（C 整理）');
        for (const k of res.items) toast(`捡到：${CONSUMABLE[k].zh}（现有 ${itemCount(s, k)}）`);
        if (res.gearUp) {
          sfx.loot();
          toast(`装备升到第 ${res.gearUp} 档：伤害 +${Math.round(CONFIG.gear.dmg * 100 * res.gearUp)}%，破甲 ${Math.round(CONFIG.gear.pen * 100 * res.gearUp)}%`, 'gold');
        }
        if (res.chest) this.gotChest(res.chest, b.monster.lvl);
        if (b.word.family === 'krume') this.questFire('krumeKill');
        this.dailyTick(m.zone, false);
        for (const lv of res.levelUp.levels) this.onLevelUp(lv);
        if (res.levelUp.capped && !s.flags.taughtCapLevel) {
          s.flags.taughtCapLevel = true;
          say([{ who: SYS, text: `【等级上限 ${CONFIG.levelCap}】经验先存着（最多存一级）。去主城找考官考 A1 突破试炼；A2 的区域 0.7 开放。归名和装备照样涨` }]);
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
      if (b.elite && m.elite) {
        noteEliteWin(s, b.elite.scene);
        this.milestone('elite');
        banner('场景精英', `${SCENE_BY_ID[b.elite.scene]?.zh ?? ''} · ${b.elite.words.map((id) => fullForm(WORD_BY_ID[id])).join(' · ')}`);
      }
    } else if (b.outcome === 'lose') {
      sfx.death();
      const km = ents[pack.indexOf(b)] ?? m;
      const at = { x: km.x, y: km.y };
      const loss = applyLoss(s, b, at);
      if (b.tutorial === 'loss') s.flags.pendingLoss = false;
      pack.forEach((x, i) => { if (!x.settled) this.scene.removeMonster(ents[i], 'flee'); });
      this.scene.teleportToBonfire();
      this.scene.spawnAll();
      const lines: Line[] = [{ who: SYS, text: '火光。焦味。你又回来了。' }];
      if (has(s.level, 'echo')) {
        lines.push(
          { who: SYS, text: '记住的名字还在。这个，它们拿不走。' },
          { who: SYS, text: `【回响】${loss.newEcho?.gold ?? 0} 金币和 ${loss.newEcho?.xp ?? 0} 经验留在了「${fullForm(b.word)}」身上。打败它就能拿回；再死一次，就没了` },
        );
        if (loss.lostEcho) lines.push({ who: SYS, text: `上一份回响（${loss.lostEcho.gold} 金币、${loss.lostEcho.xp} 经验）散了。` });
      }
      say(lines);
    } else {
      pack.forEach((x, i) => { if (!x.settled) this.scene.removeMonster(ents[i], 'flee'); });
      if (!m.isEcho) this.scene.time.delayedCall(10, () => this.scene.fillZone(m.zone));
    }
    this.scene.endFocus();
    this.scene.restyleAll();
    if (this.trial) this.trialNext(won);
    else if (this.dungeon) this.dungeonNext(won);
    else if (this.gramRun) this.gramRunNext(won);
    if (b.outcome === 'fled' && b.flees && !lost) toast('它抱着铁箱跑了。下次，在它喊「Ich muss los!」之前。');
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
    if (this.state.settings.chestAnim !== false) {
      playChest({ kind, title: CHEST_ZH[kind], result: r }, () => this.refresh(), this.chestSfx);
      return;
    }
    sfx.loot();
    banner(CHEST_ZH[kind], [...r.items.map((it) => it.name), r.gold ? `${r.gold} 金币` : ''].filter(Boolean).join('、') || '背包满了');
    if (r.bagFull) toast('背包满了，有东西没装下');
  }

  readonly chestSfx = { open: () => sfx.loot(), item: (q: Quality) => (q === 'orange' ? sfx.orange : q === 'white' ? () => {} : sfx.loot)() };

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
    if (input !== null) recordAnswer(this.state, word, ok, 'write');
    const r = openChest(this.state, kind, ilvl, this.rng, ok);
    // With the animation on, the sounds come with each item as it pops out (ui/chestFx).
    if (this.state.settings.chestAnim === false) for (const it of r.items) (it.quality === 'orange' ? sfx.orange : sfx.loot)();
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
      say([{ who: K, text: '「Brot……Brot。」他只剩这一个词。手里攥着张纸条，上面的字在爬。（12 级）' }]);
      return;
    }
    const p = questState(s, 'konrad');
    if (!p) {
      say(
        [
          { who: K, text: 'Brot……Brot！你听得懂？' },
          { who: K, text: '起雾那天，面粉袋长了嘴，自己跑了。跑去菜摊街。没面粉，我什么也烤不出来。' },
          { who: K, text: '还有我女儿。她叫……' },
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
    if (p.done && s.flags.linaFreed && !s.flags.konradReunion) {
      s.flags.konradReunion = true;
      say([
        { who: K, text: 'Lina … Lina! Meine Tochter heißt Lina!' },
        { who: K, text: '她回来了？在铁轨镇？……我这就烤一炉最好的面包。Die Bäckerei ist wieder offen!' },
        { who: SYS, text: '面包房重新开张了。' },
      ]);
      this.persist();
      return;
    }
    if (p.done) {
      const last = (s.flags.konradBread as number) ?? 0;
      if (now(s) - last >= 3600_000) {
        s.flags.konradBread = now(s);
        const heal = Math.round(maxHp(s) * 0.5);
        s.hp = Math.min(maxHp(s), s.hp + heal);
        say([{ who: K, text: `「Ein Brot für dich!」还烫手。生命 +${heal}。（每小时一个）` }]);
        this.refresh();
      } else say([{ who: K, text: '「Das Brot ist noch nicht fertig.」还在炉子里。' }]);
      return;
    }
    if (p.step === 0) {
      say([{ who: K, text: `面粉还在菜摊街那些碎屑兽肚子里。（${p.count}/5）` }]);
      return;
    }
    if (p.step === 1) {
      say(
        [
          { who: K, text: '面粉回来了。可店里这些东西……我叫不出来。你教我。带冠词。' },
        ],
        () => {
          const words = KONRAD_WORDS.map((id) => WORD_BY_ID[id]).filter(Boolean);
          this.panels.showQuiz('教 Konrad 说话', 'Konrad 指着店里的东西。用德语说出来（名词带冠词）。', words, () => {
            this.questFire('taughtKonrad');
            say([{ who: K, text: 'das Brot。das Brötchen。der Kuchen。……还差一个名字。你明天再来。' }]);
            this.persist();
          });
        },
      );
      return;
    }
    // Step 2: the story, the apron.
    say(
      [
        { who: K, text: '她每天早上来。买两个 Brötchen。' },
        { who: K, text: 'L……是 L 开头的。' },
        { who: K, text: '雾是从粮仓后面那条路来的。她也往那边去了。你哪天走那条路，替我看一眼。' },
        { who: K, text: '围裙你拿着。饿了就来。' },
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
      toast('背包满了。Konrad 先替你收着围裙。');
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
      say([{ who: MIRA, text: `货还没到。你也还没长大。（${UNLOCK.shop} 级）` }]);
      return;
    }
    this.questFire('metMira');
    const open = () => {
      openShop(s, this.rng, now(s));
      this.panels.buying = null;
      this.panels.show('shop');
    };
    const unid = unidentifiedItems(s);
    if (unid.length && s.flags.miraMet) {
      say([{ who: MIRA, text: `你身上有 ${unid.length} 件没鉴定的紫装。先看哪件？鉴定不要钱。` }], undefined, [
        ...unid.slice(0, 3).map((it) => ({
          label: `鉴定「${it.name}」`,
          act: () => {
            this.singleTask = { kind: 'identify', itemId: it.id };
            this.boss = startBoss(s, this.rng, 6);
            setPrompt(null);
            this.bossUI.open(this.boss);
          },
        })),
        { label: '先看看货', act: open },
      ]);
      return;
    }
    if (!s.flags.miraMet) {
      s.flags.miraMet = true;
      say(
        [
          { who: MIRA, text: (s.region ?? 1) === 1 ? 'Hallo! 集市回不去，我先在火边摆个摊。笔、外套、护符、词典。要什么？' : 'Hallo! 笔、外套、护符、词典。要什么？' },
          { who: MIRA, text: '在这儿，东西靠嘴买。说「Ich nehme den Stift.」，它就是你的。' },
          { who: MIRA, text: 'der 跟在 nehme 后面要变 den，das 不变。嫌贵？「Geht das billiger?」看我心情。' },
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
      say([{ who: GRETA, text: `太嫩。${CONFIG.region2Level} 级再来。` }]);
      return;
    }
    // 刻字孔 (0.6, 25 级): Greta engraves auch / denn into a socket (again any time, one cloze each).
    const sockets = s.level >= CONFIG.engrave.from && s.flags.gretaMet ? socketItems(s) : [];
    if (sockets.length && !this.gretaPlain) {
      const intro: Line[] = s.flags.engraveSeen
        ? [{ who: GRETA, text: '要刻字？挑一件，再挑一个词。' }]
        : [
            { who: GRETA, text: '这几件带孔。孔里能刻一个小词，德国人天天挂在嘴边的那种。' },
            { who: SYS, text: '【刻字孔】auch（也）：齐鸣打到的其他怪伤害 +20%。denn（呢、到底）：难题答对伤害 +20%。刻字要答对一道把这个词挖掉的填空；想换随时来，再答一次。' },
          ];
      s.flags.engraveSeen = true;
      say(intro, undefined, [
        ...sockets.slice(0, 3).flatMap((it) =>
          (['auch', 'denn'] as const).map((w) => ({
            label: `「${it.name}」${it.socket ? `（现在：${it.socket}）` : ''}刻 ${w}`,
            act: () => {
              this.singleTask = { kind: 'engrave', itemId: it.id, word: w };
              this.boss = startBoss(s, this.rng, 6, engraveQuestion(w, this.rng));
              setPrompt(null);
              this.bossUI.open(this.boss);
            },
          })),
        ),
        {
          label: '别的事',
          act: () => {
            this.gretaPlain = true;
            this.talkGreta();
            this.gretaPlain = false;
          },
        },
      ]);
      return;
    }
    const lines: Line[] = [];
    if (!s.flags.gretaMet) {
      s.flags.gretaMet = true;
      lines.push(
        { who: GRETA, text: '营地来的？Hilde 说过你。在这儿光会叫名字，活不久。' },
        { who: GRETA, text: '书写者，写得越多下手越狠。守护者，挨得住，还打得回去。' },
        { who: GRETA, text: '各打一场试炼。过了，就是你的。第一个不要钱，以后想换随时来。' },
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
    if (!lines.length) lines.push({ who: GRETA, text: s.cls ? `${CLASSES[s.cls].zh}，今天想练什么？` : '想好了？' });
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
      say([{ who: GRETA, text: '倒得挺快。歇够了再来。' }]);
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
    say([{ who: GRETA, text: `还行。${CLASSES[t.cls].zh}，你走得通。现在定？` }], undefined, choices);
  }

  private pickClass(id: ClassId) {
    const s = this.state;
    const first = !s.cls;
    s.cls = id;
    resetClassFx(s);
    banner(first ? '职业' : '换职业', CLASSES[id].zh);
    this.renderMenu();
    const lines: Line[] = [{ who: GRETA, text: `今天起你是${CLASSES[id].zh}。【G】${CLASSES[id].skillZh}` }];
    if (s.level >= TALENT_FROM_LEVEL) lines.push({ who: SYS, text: '【天赋】按 T 加点' });
    else lines.push({ who: SYS, text: `【天赋】${TALENT_FROM_LEVEL} 级起每级 1 点（T）` });
    say(lines);
    this.refresh();
    this.persist();
  }

  private doRespec() {
    const s = this.state;
    const cost = respecCost(s);
    if (!respec(s)) {
      say([{ who: GRETA, text: `${cost} 金币。你没有。` }]);
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
      door: this.state.region === 3 ? '<kbd>E</kbd>走上末班站台' : this.state.region === 2 ? '<kbd>E</kbd>推开秤房的门' : '<kbd>E</kbd>敲门',
      sign: '<kbd>E</kbd>看路牌',
      gate: it.data === '3' ? '<kbd>E</kbd>过铁路桥去铁轨镇' : it.data === '2' ? '<kbd>E</kbd>过桥回面包集市' : '<kbd>E</kbd>回余烬营地',
    };
    const NPC_TEXT: Record<string, string> = {
      hilde: '<kbd>E</kbd>和守火人 Hilde 说话',
      greta: '<kbd>E</kbd>和导师 Greta 说话',
      mira: '<kbd>E</kbd>和商人 Mira 说话',
      konrad: '<kbd>E</kbd>和面包师傅 Konrad 说话',
      examiner: '<kbd>E</kbd>找考官筛选你会的词',
      brandt: '<kbd>E</kbd>和站长 Herr Brandt 说话',
      lina: '<kbd>E</kbd>和 Lina 说话',
      weber: '<kbd>E</kbd>去秩序会办事处找 Frau Weber',
    };
    setPrompt(it.kind === 'npc' ? NPC_TEXT[it.data ?? 'hilde'] : text[it.kind]);
  }

  interact(it: { kind: string; data?: string }): void {
    if (it.kind === 'bonfire') this.rest();
    else if (it.kind === 'npc') this.talkNpc(it.data ?? 'hilde');
    else if (it.kind === 'door') (this.state.region === 3 ? this.knockRegion3() : this.state.region === 2 ? this.knockRegion2() : this.knock());
    else if (it.kind === 'gate') this.travel((Number(it.data) || (this.state.region === 3 ? 2 : 1)) as RegionId);
    else if (it.kind === 'sign') {
      const w = WORD_BY_ID[it.data!];
      const st = stageOf(this.state, w);
      if (st >= 3) {
        say([{ who: '路牌', text: `「${fullForm(w)}」——${w.zh}。字不动了。` }]);
        this.speak(fullForm(w));
      } else say([{ who: '路牌', text: '字母在木板上爬。读不出来。（这个词归名后，字会停下）' }]);
    }
  }

  /** 越区引导: a field above your level asks once; after a yes its monsters keep their full level. */
  mayEnterZone(zone: ZoneId): boolean {
    const s = this.state;
    const gap = zoneMinLevel(zone) - s.level;
    if (gap <= 0 || s.flags[`zoneOk_${zone}`]) return true;
    say([{ who: SYS, text: `这里的怪比你高 ${gap} 级起。等级每差 1 级，它们的护甲翻一倍，也打得更疼。` }], undefined, [
      { label: '进去', act: () => { s.flags[`zoneOk_${zone}`] = true; this.persist(); } },
      { label: '先回去', act: () => undefined },
    ]);
    return false;
  }

  rest(): void {
    const s = this.state;
    if (!has(s.level, 'bonfireRest')) {
      say([{ who: HILDE, text: '火还弱。先去把名字叫回来。（3 级）' }]);
      return;
    }
    rollDay(s);
    this.milestone('bonfire');
    s.hp = maxHp(s);
    s.combo = 0;
    resetClassFx(s);
    const notes = bonfireRefill(s);
    if (notes) toast(`低语纸条补到了 ${itemCount(s, 'hint')} 张`);
    this.scene.spawnAll();
    const due = WORDS.filter((w) => kindOf(s, w) === 'due').length;
    banner('篝火', '生命回满，怪物全部刷新');
    const lines: Line[] = [{ who: SYS, text: due ? `火噼啪响。外面有 ${due} 个名字又长出了牙（头上有「!」）。` : '火噼啪响。外面很安静。明天，昨天打散的东西会回来。' }];
    // 越区引导: about 70% of this region written → point at the higher fields and the examiner (once per region).
    const region = s.region ?? 1;
    const rw = WORDS.filter((w) => (w.region ?? 1) === region && w.pos !== 'phr');
    const written = rw.filter((w) => (s.words[w.id]?.write ?? 0) > 0).length / Math.max(1, rw.length);
    if (written >= 0.7 && !s.flags[`moveOn${region}`]) {
      s.flags[`moveOn${region}`] = true;
      lines.push({ who: region === 1 ? HILDE : '守火人', text: `这片的名字你写得出七成了（${Math.round(written * 100)}%）。这里的东西认得你了，不会再扑上来。往更深的野外走走，或者去找考官。` });
      lines.push({ who: SYS, text: '【分级考核】主城考官那里每天可以考一次：测你会到哪一级，会的直接跳过，等级只往上调' });
    }
    // 篝火日记 (Lv16+, 2026-11-22): once a day, write a few sentences with words fought today.
    const jw = this.journalOffer();
    if (jw) {
      lines.push({ who: SYS, text: `【篝火日记】今天打过 ${jw.map((w) => w.de).join('、')}。用它们写两三句话？不判对错，只提示查得出的错。` });
      say(lines, undefined, [{ label: '写日记', act: () => this.panels.showJournal(jw) }, { label: '今天不写', act: () => undefined }]);
    } else say(lines);
    if (s.flags.teachRest) s.flags.teachRest = false;
    this.refresh();
    this.persist();
  }

  private talkHilde() {
    const s = this.state;
    const tips: Line[][] = [
      [{ who: HILDE, text: '光叫「Tee」，它不理你。叫「der Tee」，它才抖。' }],
      [{ who: HILDE, text: '头上带「!」的，今天该叫了。拖久了，会变凶。' }],
      [{ who: HILDE, text: '听它说什么。喊「Moment!」的，在憋大的。那时候打。' }],
      [{ who: HILDE, text: '一天别叫太多新名字。睡一觉，明天再叫一遍，才长得牢。' }],
    ];
    if (s.level >= 8) {
      const share = Math.round(atLeastHalfShare(s, this.regionWords()) * 100);
      tips.push([{ who: HILDE, text: `东边那扇门……这片街区你叫回了 ${share}%。到 ${Math.round(CONFIG.boss.halfNameShare * 100)}%，它会开。` }]);
    }
    if (s.level >= 6) tips.push([{ who: HILDE, text: 'Wo ist der Tisch。Ich suche den Tisch。同一个词，换句话，冠词就变。' }]);
    const i = ((s.flags.hildeIdx as number) ?? 0) % tips.length;
    s.flags.hildeIdx = i + 1;
    say(tips[i]);
  }

  private talkExaminer() {
    const s = this.state;
    const region = s.region ?? 1;
    if (s.level < SCREEN.fromLevel)
      return say([{ who: '考官', text: `「Noch nicht.」筛选 ${SCREEN.fromLevel} 级再来。不过你要是以前学过德语，可以先考分级考核。` }], undefined, [
        ...(canPlaceToday(s) ? [{ label: '分级考核（测你会到哪一级）', act: () => this.openPlacement(true) }] : []),
        { label: '先不了', act: () => {} },
      ]);
    void region;
    const intro = !s.flags.screenIntro;
    s.flags.screenIntro = true;
    const scopes: Array<{ label: string; scope: ScreenScope }> = [
      { label: '筛第 1 区', scope: '1' },
      { label: '筛第 2 区', scope: '2' },
      { label: '筛第 3 区', scope: '3' },
      { label: '全部筛一遍', scope: 'all' },
    ];
    say([
      intro
        ? { who: '考官', text: '「Was kannst du schon?」你会的词先写给我，就不用在野外再打一遍。' }
        : { who: '考官', text: '「Weiter?」接着写你会的词。' },
      ...(intro ? [{ who: SYS, text: '【全量筛选】只给中文，名词连冠词写。写对的词直接斩杀，经验存在它住的场景，走到那里就领。不会就跳过，什么都不扣。' }] : []),
    ], undefined, [
      ...scopes.map((x) => ({ label: x.label, act: () => (this.milestone('screen'), this.panels.showScreen(startScreen(s, x.scope))) })),
      ...(s.level >= BREAK.from && !s.flags.a1Passed ? [{ label: 'A1 突破试炼', act: () => this.breakExam() }] : []),
      ...(s.level >= BREAK.from && s.flags.a1Passed && !s.flags.a1Grammar ? [{ label: '补考语法', act: () => this.grammarRetake() }] : []),
      ...(canPlaceToday(s) ? [{ label: '分级考核（测你会到哪一级）', act: () => this.openPlacement(true) }] : []),
      { label: '先不了', act: () => {} },
    ]);
  }

  /** A1 突破试炼 (30 级): 听 读 写 语法 8 questions each, 5 right per part. */
  private breakExam() {
    say([
      { who: '考官', text: '「Die Prüfung A1. Hören, Lesen, Schreiben, Grammatik.」听、读、写、语法，各八题。只考你见过的词。' },
      { who: SYS, text: `【A1 突破试炼】每部分对 ${BREAK.pass} 题算过。不挨打，没过不罚，随时再考` },
    ], () => this.panels.showExam(startExam(this.state, Math.random)));
  }

  /** 补考语法 (0.6.x): saves that passed the three parts before the grammar part existed keep the title; 0.7 needs it for Lv31. */
  private grammarRetake() {
    say([
      { who: '考官', text: '「Noch ein Teil: Grammatik.」上次的章还算数，不过结业考现在多了一段语法。' },
      { who: SYS, text: `【补考语法】8 题：宾格、与格、变位、完成时各 2 题，对 ${BREAK.pass} 题算过。称号不收回；0.7 升 31 级前要补过` },
    ], () => this.panels.showExam(startGrammarExam(this.state, Math.random)));
  }

  examAnswer(e: Exam, input: string): void {
    const q = e.qs[e.at];
    answerExam(e, input);
    const l = e.last;
    if (l?.ok && q?.word && q.part === 'write') reviewedByWriting(this.state, q.word);
    if (l && q) logLine(`突破试炼（${PART_ZH[q.part]}）：${l.ok ? '✓' : `✗ 正确：${q.part === 'write' ? fullForm(q.word) : q.full ?? q.answer}`}`, l.ok ? 'good' : 'bad');
  }

  /** Called when the exam panel closes after the last question. */
  examDone(e: Exam): void {
    const s = this.state;
    if (!examPassed(e)) return;
    if (e.grammarOnly) {
      if (s.flags.a1Grammar) return;
      s.flags.a1Grammar = true;
      banner('语法补考通过', 'A1 四段全过');
      say([{ who: '考官', text: '「Gut. Jetzt ist alles komplett.」四段都盖章了。' }]);
      this.persist();
      return;
    }
    if (s.flags.a1Passed && s.flags.a1Grammar) return;
    s.flags.a1Passed = true;
    s.flags.a1Grammar = true;
    s.flags.title = 'A1 突破者';
    banner('A1 突破试炼通过', '称号「A1 突破者」');
    say([
      { who: '考官', text: '「Bestanden.」章盖好了。' },
      { who: SYS, text: '【A1 突破】这一阶段学完了。A2 的区域在 0.7 开放；在那之前经验替你存着，最多存一级。' },
    ]);
    this.refresh();
    this.persist();
  }

  // ---- 入学测试 / 分级考核 (2026-11-25) -------------------------------------------------------

  /** New game (daily = false) or the examiner's once-a-day 分级考核. */
  openPlacement(daily: boolean): void {
    this.panels.showPlacement(daily);
  }

  canPlaceNow(): boolean {
    return canPlaceToday(this.state);
  }

  placeStart(band: number): void {
    const run = startPlacement(this.state, this.rng, band);
    this.panels.setPlaceRun(run);
  }

  placeAnswer(run: PlaceRun, input: string, skip = false): void {
    answerPlacement(this.state, run, input, this.rng, skip);
    const l = run.last;
    if (l) logLine(`入学测试：${zhWithPos(l.word)} ${l.res === 'ok' ? `✓ ${fullForm(l.word)}` : l.res === 'half' ? `差一点 · ${fullForm(l.word)}` : `✗ ${fullForm(l.word)}`}`, l.res === 'ok' ? 'good' : 'bad');
  }

  placeStop(run: PlaceRun): void {
    stopPlacement(run);
  }

  /** Apply the result (levels without a lesson each; one summary comes when the panel closes). */
  placeFinish(run: PlaceRun, daily: boolean): void {
    if (!run.outcome) {
      stopPlacement(run);
      const o = applyPlacement(this.state, run, undefined, { daily });
      for (const l of o.gained) this.onLevelUp(l, true);
      this.refresh();
      this.persist();
    }
    this.panels.setPlaceRun(run);
  }

  /** The test panel closed: apply what was answered, sum up the levels, then carry on (the opening for a new game). */
  placeClosed(run: PlaceRun | null, daily: boolean): void {
    const s = this.state;
    if (run && !run.outcome && run.results.length) {
      stopPlacement(run);
      const o = applyPlacement(s, run, undefined, { daily });
      for (const l of o.gained) this.onLevelUp(l, true);
    }
    s.flags.placeAsked = true;
    this.refresh();
    this.persist();
    const o = run?.outcome;
    const next = () => {
      if (!s.flags.intro) return this.intro();
      if (o && o.region > (s.region ?? 1)) this.offerPlaceTravel(o.region);
    };
    if (!o?.gained.length) return next();
    banner(`Lv ${o.level}`, '分级入场');
    sfx.levelUp();
    const heads = o.gained.map((l) => ((UNLOCK_TEXT[l] ?? [])[0] ? `${l} 级 ${(UNLOCK_TEXT[l] ?? [])[0].split(/[：:，,]/)[0]}` : '')).filter(Boolean);
    const lines: Line[] = [{ who: SYS, text: `【跳到 ${o.level} 级】这一路的功能都开了，每样第一次出现时还会提示。按 H 能看怎么玩。` }];
    for (let i = 0; i < heads.length; i += 8) lines.push({ who: SYS, text: heads.slice(i, i + 8).join(' · ') });
    say(lines, next);
  }

  private offerPlaceTravel(region: number): void {
    const zh = ['', '余烬营地', '面包集市', '铁轨镇'][region];
    say([{ who: HILDE, text: `你叫得出的名字比我想的多。这片营地留不住你，去${zh}吧。` }], undefined, [
      { label: `去${zh}`, act: () => this.travel(region as RegionId) },
      { label: '先在这里转转', act: () => toast('以后在大地图（M）上随时能过去') },
    ]);
  }

  /** New game: asked once before the opening. */
  private askPlacement(): void {
    say([{ who: SYS, text: '开始之前：你学过德语吗？学过的话，先测一下你会多少词，会的直接跳过。' }], undefined, [
      { label: '没学过，从头开始', act: () => { this.state.flags.placeAsked = true; this.persist(); this.intro(); } },
      { label: '学过一些，先测一下（5 到 10 分钟）', act: () => this.openPlacement(false) },
    ]);
  }

  /** 全量筛选: called by the panel after each answer (skip = 「不会，下一个」). */
  screenAnswer(run: ScreenRun, input: string, skip = false): void {
    answerScreen(this.state, run, input, skip);
    this.scene.nodes?.draw(); // gold dots for scenes with XP waiting
    const l = run.last;
    if (l && !l.skipped) {
      logLine(
        l.ok
          ? `筛选：${zhWithPos(l.word)} 你写 ${l.input} ✓ 斩杀 · ${fullForm(l.wrote ?? l.word)}${l.scene ? `（经验存在「${l.scene.zh}」）` : ''}`
          : `筛选：${zhWithPos(l.word)} 你写 ${l.input || '（空）'} ✗，正确：${fullForm(l.word)}`,
        l.ok ? 'good' : 'bad',
      );
    }
    this.refresh();
    this.persist();
  }

  private talkNpc(id: string) {
    if (id === 'hilde') return this.talkHilde();
    if (id === 'greta') return this.talkGreta();
    if (id === 'mira') return this.talkMira();
    if (id === 'konrad') return this.talkKonrad();
    if (id === 'examiner') return this.talkExaminer();
    if (id === 'brandt') return this.talkBrandt();
    if (id === 'lina') return this.talkLina();
    if (id === 'weber') return this.talkWeber();
    // Region-2 NPCs: their systems (class, shop, Konrad's quest) open with the region-2 build.
    const lines: Record<string, string> = {
      greta: '导师 Greta：「营地来的？10 级再来。」',
      mira: '商人 Mira：「货还没到。摊子摆好了，你用德语跟我买。」',
      konrad: '面包师傅 Konrad：「Brot……Brot。」他只剩这一个词。',
    };
    say([{ who: id === 'greta' ? 'Greta' : id === 'mira' ? 'Mira' : 'Konrad', text: lines[id] ?? '……' }]);
  }

  /** Walk between regions: the neighbour's door (region 1) and the market's west gate (region 2). */
  travel(to: RegionId, arrive?: { x: number; y: number }): void {
    const s = this.state;
    if (s.region === to) return;
    const from = s.region ?? 1;
    s.region = to;
    if (to === 2 && startQuest(s, 'main2')) this.questFire('enterMarket');
    if (to === 3) this.enterRegion3();
    // Arrive next to the door you came through (大地图: at the area's hub).
    s.pos =
      arrive ??
      (to === 3
        ? { x: 13 * 16 + 8, y: 24 * 16 + 8 }
        : to === 2
          ? from === 3
            ? { x: 67 * 16 + 8, y: 44 * 16 + 8 }
            : { x: 4 * 16 + 8, y: 24 * 16 + 8 }
          : { x: 67 * 16 + 8, y: 24 * 16 + 12 });
    this.persist();
    this.scene.scene.restart({ ctrl: this });
  }

  /** First steps into 铁轨镇 (0.6 第 5 块). */
  private enterRegion3() {
    const s = this.state;
    s.flags.seenArea3 = true;
    if (startQuest(s, 'main3')) {
      this.questFire('enterRails');
      say([
        { who: SYS, text: '铁路桥那头是一座小镇。铁轨从镇子正中穿过去，站台上的钟全停在 23:59。' },
        { who: SYS, text: '【第 3 章】去站长室找站长 Herr Brandt（广场北边）。' },
      ]);
    }
  }

  /** 站长 Herr Brandt (0.6 第 5 块): main chapter 3; his first talk is the Perfekt teaching fight. */
  private talkBrandt() {
    const s = this.state;
    const B = '站长 Herr Brandt';
    if (!s.flags.brandtMet) {
      say(
        [
          { who: B, text: 'Guten Tag! Ich bin Herr Brandt, der Stationsvorsteher. Willkommen in Gleisdorf.' },
          { who: B, text: '这里的东西不说现在，只说过去。它们一直在说自己「做过了」什么。' },
          { who: B, text: 'Und Sie? Was haben Sie gestern gemacht?' },
          { who: SYS, text: '【现在完成时】haben / sein 的变位 + 句末的分词：Ich habe Brot gekauft. Ich bin nach Hause gefahren.' },
          { who: SYS, text: '移动和变化（fahren、kommen、gehen、aufstehen）多用 sein，其余大多用 haben。' },
          { who: SYS, text: '【haben / sein 相】动词怪说完成时，它吞掉的是 haben 还是 sein，你就选哪个相。23 级前选错不罚。' },
          { who: B, text: '外面那个就是。它说它「坐车走了」。听听它用的是哪个。' },
        ],
        () => {
          s.flags.brandtMet = true;
          this.questFire('metBrandt');
          this.persist();
          const p = this.scene.player;
          const m = this.scene.addMonster(WORD_BY_ID['fahren'], 'new', 'gleisdorf', p.x + 20, p.y, { scripted: 'trial' });
          this.encounter(m);
        },
      );
      return;
    }
    const lines: Line[] = [];
    if (!has(s.level, 'boss3')) lines.push({ who: B, text: '末班站台那个东西，28 级以前别去。它会问你几点、怎么走、为什么来晚了。' });
    else if (!s.flags.boss3Kills) lines.push({ who: B, text: '末班站台在大厅最里面。看时刻牌，看地图，说完成时。Viel Glück!' });
    else lines.push({ who: B, text: 'Die Uhren gehen wieder. 钟又走了。谢谢你。' });
    if (questState(s, 'konrad')?.done && !s.flags.linaFreed)
      lines.push({ who: B, text: s.level >= CONFIG.lina.fromLevel ? '大厅里有个检票员，穿着面包房的围裙。她总在问别人要票，却说不出自己的名字。' : '最近大厅里有人在查票。等你再强一点（25 级）去看看。' });
    if (!s.flags.zeroSeen) lines.push({ who: B, text: '时刻表墙上原来有个零号站台。等你认得 Fahrkarte 这个词，也许就能看见。' });
    say(lines);
  }

  /** 幽灵检票员 Lina: entering a timetable-hall scene may bring her (Lv25+, after Konrad's quest). */
  private gretaPlain = false;
  /** The one-question task the which-6 conversation is for (Mira's 鉴定 or Greta's 刻字). */
  singleTask: { kind: 'identify' | 'engrave'; itemId: string; word?: 'auch' | 'denn' } | null = null;

  private finishIdentify(f: BossFight) {
    const s = this.state;
    const task = this.singleTask;
    this.singleTask = null;
    if (task?.kind === 'engrave') {
      const it = socketItems(s).find((x) => x.id === task.itemId);
      if (!it) return;
      if (!f.misses.length) {
        it.socket = task.word!;
        toast(`「${it.name}」刻上了 ${task.word}`, 'gold');
      } else toast('没刻上。再来一次就行。');
      this.persist();
      this.refresh();
      return;
    }
    const it = unidentifiedItems(s).find((x) => x.id === task?.itemId);
    if (!it) return;
    identify(it, f.misses.length === 0, this.rng);
    this.persist();
    this.refresh();
    toast(`${it.name} 鉴定好了${f.misses.length ? '' : '：每条词缀都挑了更好的那个'}`, 'gold');
  }

  // ---- 决斗场 · AI 对话 (40) -----------------------------------------------------------------------
  openDuel(): void {
    const s = this.state;
    if (s.level < DUEL.from) return;
    if (!s.owner) return say([{ who: SYS, text: '决斗场要登录才能用（AI 对话在云端）。' }]);
    const lines: Line[] = [];
    if (!s.flags.duelSeen) {
      s.flags.duelSeen = true;
      lines.push({ who: SYS, text: '【决斗场】和 AI 扮演的人用德语把一件事办完：点单、约医生、看房、去市政厅……每次回答它会指出你最重要的一处错。每天有次数上限；每天第一次办成给一点经验。' });
    }
    lines.push({ who: SYS, text: '选一个场景：' });
    say(lines, undefined, [...DUEL_SCENES.map((d) => ({ label: d.title, act: () => this.duelStep(d, [], '') })), { label: '先不', act: () => {} }]);
  }

  private duelStep(d: DuelScene, history: Array<{ who: 'npc' | 'me'; de: string }>, reply: string): void {
    const s = this.state;
    toast('……');
    void duelTurn(d.scene, history, reply, s.level).then((r) => {
      if ('error' in r) return say([{ who: SYS, text: r.error === 'quota' ? '今天的决斗场次数用完了，明天再来。' : r.error === 'login' ? '登录过期了，重新登录后再来。' : '连不上决斗场（网络或服务出错），稍后再试。' }]);
      const h2 = [...history, ...(reply ? [{ who: 'me' as const, de: reply }] : []), { who: 'npc' as const, de: r.de }];
      const turns = h2.filter((x) => x.who === 'me').length;
      const lines: Line[] = [...(r.note ? [{ who: '纠错', text: r.note }] : []), { who: d.npc, text: `${r.de}\n（${r.zh}）` }];
      if (r.done || turns >= d.turns) {
        const today = dayKey(now(s));
        const first = r.done && s.flags.duelDay !== today;
        if (first) {
          s.flags.duelDay = today;
          this.diaryXp(Math.max(1, Math.round(xpToNext(s.level) * DUEL.xpShare)), `决斗场「${d.title}」办成了`);
          this.persist();
        }
        lines.push({ who: SYS, text: r.done ? `「${d.title}」办成了。` : '时间到了，这次先到这里。' });
        return say(lines);
      }
      say(lines, () => this.panels.ask(d.npc, r.de, (text: string) => (text.trim() ? this.duelStep(d, h2, text.trim()) : say([{ who: SYS, text: '你转身走了。' }]))));
    });
  }

  // ---- 复习伙伴 (43) -----------------------------------------------------------------------------
  choosePartner(): void {
    const s = this.state;
    const cur = partnerOf(s);
    const list = partnerChoices(s).sort((a, b) => (s.words[b.id].lastSeen ?? 0) - (s.words[a.id].lastSeen ?? 0)).filter((w) => w.id !== cur?.id).slice(0, 5);
    const lines: Line[] = [];
    if (!s.flags.partnerSeen) {
      s.flags.partnerSeen = true;
      lines.push({ who: SYS, text: '【复习伙伴】带一个已经归名的词一起打。每场你第二次出手时，它出一道它自己的例句题；答对，它和你一起出手（这一下 ×1.5）。答错也不会让它掉回复习。' });
    }
    lines.push({ who: SYS, text: cur ? `现在的伙伴：${fullForm(cur)}（${cur.zh}）。换一个？` : '还没有归名的词可以当伙伴。' });
    say(lines, undefined, [...list.map((w) => ({ label: `${fullForm(w)} · ${w.zh}`, act: () => (setPartner(s, w.id), toast(`复习伙伴：${fullForm(w)}`), this.persist()) })), { label: '不换', act: () => {} }]);
  }

  // ---- 语法秘境 (0.7–0.8: 变音 24 · 介词 31 · 词族 37), entered from a camp's 「语法秘境」 button -------------------
  gramRun: { kind: DungeonKind; floor: Floor; words: string[]; i: number } | null = null;

  /** The camp button: pick a dungeon, then a floor. */
  enterGramDungeon(): void {
    const s = this.state;
    if (this.battle || this.boss || this.dungeon || this.gramRun) return;
    const kinds = (Object.keys(GRAM_DUNGEON.from) as DungeonKind[]).filter((k) => s.level >= GRAM_DUNGEON.from[k] && floorsOf(k, s).length);
    if (!kinds.length) return say([{ who: SYS, text: `语法秘境的门还关着。（${GRAM_DUNGEON.from.ablaut} 级）` }]);
    const lines: Line[] = [];
    if (!s.flags.gramDungeonSeen) {
      s.flags.gramDungeonSeen = true;
      lines.push({ who: SYS, text: '【语法秘境】不属于哪个词的规则在这里集中练：每层几只怪，都在你的等级，每一题都考这一层的规则，题目就出在怪自己的词上。打通一层有奖励；变音秘境打通一族后，这一族的动词在野外也会考它的变音。' });
    }
    lines.push({ who: SYS, text: '选一个秘境：' });
    say(lines, undefined, [
      ...kinds.map((k) => ({ label: GRAM_DUNGEON.name[k], act: () => this.pickGramFloor(k) })),
      { label: '先不进', act: () => {} },
    ]);
  }

  private pickGramFloor(kind: DungeonKind): void {
    const s = this.state;
    const done = cleared(s, kind);
    const floors = floorsOf(kind, s);
    say([{ who: SYS, text: `${GRAM_DUNGEON.name[kind]}：选一层（✓ 已打通，可以再刷）` }], undefined, [
      ...floors.map((f) => ({ label: `${done.includes(f.id) ? '✓ ' : ''}${f.label}`, act: () => this.startGramRun(kind, f) })),
      { label: '回去', act: () => {} },
    ]);
  }

  private startGramRun(kind: DungeonKind, floor: Floor): void {
    this.gramRun = { kind, floor, words: floorRun(floor, this.rng), i: 0 };
    toast(`${GRAM_DUNGEON.name[kind]} · ${floor.label}：${this.gramRun.words.length} 场`);
    this.gramFight();
  }

  private gramFight(): void {
    const s = this.state;
    const r = this.gramRun!;
    const word = WORD_BY_ID[r.words[r.i]];
    const p = this.scene.player;
    const m = this.scene.addMonster(word, s.words[word.id] ? 'due' : 'new', word.zone, p.x + 20, p.y, { scripted: 'trial' });
    this.encounter(m);
    if (!this.battle) return;
    const b = this.battle;
    b.gramDungeon = { kind: r.kind, floor: r.floor.id === 'fam' ? '' : r.floor.id };
    // Every fight stands at your level, whatever the word's own level (零号站台 frame).
    const mon = b.monster;
    const st = monsterStats(s.level, b.stage, b.kind, b.overdue);
    mon.lvl = s.level;
    mon.hp = mon.maxHp = st.hp;
    mon.dmg = st.dmg;
  }

  private gramRunNext(won: boolean): void {
    const s = this.state;
    const r = this.gramRun!;
    if (!won) {
      this.gramRun = null;
      say([{ who: SYS, text: `你被推出了${GRAM_DUNGEON.name[r.kind]}。这一层还在，下次再来。` }]);
      return;
    }
    r.i += 1;
    if (r.i < r.words.length) {
      toast(`${GRAM_DUNGEON.name[r.kind]}：还剩 ${r.words.length - r.i} 场`);
      this.scene.time.delayedCall(500, () => this.gramFight());
      return;
    }
    this.gramRun = null;
    const first = markCleared(s, r.kind, r.floor.id);
    const xp = Math.round(xpToNext(s.level) * GRAM_DUNGEON.clearXp * (r.words.length / GRAM_DUNGEON.fights));
    const lv = addXp(s, xp);
    banner(`${GRAM_DUNGEON.name[r.kind]} · ${r.floor.label}`, `打通 · ${xp} 经验`);
    if (first && r.kind === 'ablaut' && r.floor.id !== 'praet') say([{ who: SYS, text: `${r.floor.id} 族打通了：这一族的动词在野外也会考它的变音（du / er 的形式${s.level >= CONFIG.perfekt.irregularFrom ? '、完成时' : ''}）。` }]);
    if (first) this.gotChest('iron', s.level);
    for (const l of lv.levels) this.onLevelUp(l);
    this.persist();
    this.nextChest();
  }

  // ---- 零号站台 地下城 (0.6 第 6 块, 28 级) ----------------------------------------------------
  dungeon: { rule: Rule; left: number; kept: boolean; asked: number; redrawn: boolean } | null = null;

  /** Entered from the 零号站台 scene panel. */
  enterDungeon(): void {
    const s = this.state;
    if (this.battle || this.boss || this.dungeon) return;
    if (s.level < DUNGEON.from) return say([{ who: SYS, text: `站台尽头的门锁着。（${DUNGEON.from} 级）` }]);
    const draw = (redrawn: boolean, not?: string) => {
      const pool = RULES.filter((r) => r.id !== not);
      const rule = pool[Math.floor(this.rng() * pool.length)];
      const lines: Line[] = [];
      if (!s.flags.dungeonSeen) {
        s.flags.dungeonSeen = true;
        lines.push({ who: SYS, text: '【地下城规则表】零号站台：5 场战斗加一个小首领。门口贴着一张德语规则卡，读懂了再进。守规矩有加成；破了规矩不会怎样，只是这次的加成没了。每天第一次通关给金箱。' });
      }
      lines.push({ who: '规则卡', text: `「${rule.de}」` });
      say(lines, undefined, [
        { label: `接受（通关奖励 ×${rule.mult}）`, act: () => this.startDungeon(rule, redrawn) },
        ...(redrawn ? [] : [{ label: '重抽一次', act: () => draw(true, rule.id) }]),
        { label: '先不进', act: () => {} },
        { label: '这张卡什么意思？', act: () => say([{ who: SYS, text: rule.zh }], () => draw(redrawn, undefined)) },
      ]);
    };
    draw(false);
  }

  private startDungeon(rule: Rule, redrawn: boolean) {
    this.dungeon = { rule, left: DUNGEON.fights + 1, kept: true, asked: Date.now(), redrawn };
    toast(`零号站台：${DUNGEON.fights} 场，然后是站台尽头的那个东西`);
    this.dungeonFight();
  }

  private dungeonFight() {
    const s = this.state;
    const d = this.dungeon!;
    const boss = d.left === 1;
    const pool = WORDS.filter((w) => w.region === 3 && w.lvl <= s.level && w.family !== 'truhe' && w.pos !== 'phr' && (d.rule.id !== 'verben' || w.pos === 'v') && (!boss || w.pos === 'n' || d.rule.id === 'verben'));
    const word = pool[Math.floor(this.rng() * pool.length)];
    const p = this.scene.player;
    const m = this.scene.addMonster(word, s.words[word.id] ? 'due' : 'new', 'fahrplanhalle', p.x + 20, p.y, { scripted: 'trial' });
    this.encounter(m);
    if (this.battle) {
      // Every fight stands at your level (the boss DUNGEON.bossLvl above), whatever the word's own level.
      const b = this.battle;
      const mon = b.monster;
      const lvl = s.level + (boss ? DUNGEON.bossLvl : 0);
      if (mon.lvl < lvl) {
        const st = monsterStats(lvl, b.stage, b.kind, b.overdue);
        mon.lvl = lvl;
        mon.hp = mon.maxHp = st.hp;
        mon.dmg = st.dmg;
      }
      if (boss) {
        mon.hp = mon.maxHp = Math.round(mon.maxHp * DUNGEON.bossHp);
        mon.dmg = Math.round(mon.dmg * 1.2);
        toast('站台尽头的东西站起来了');
      }
    }
  }

  private dungeonNext(won: boolean) {
    const s = this.state;
    const d = this.dungeon!;
    if (!won) {
      this.dungeon = null;
      say([{ who: SYS, text: '你被推回了站台入口。规则卡还贴在门上，下次再来。' }]);
      return;
    }
    d.left -= 1;
    if (d.left > 0) {
      const go = () => this.scene.time.delayedCall(500, () => this.dungeonFight());
      // 「Bitte siezen!」: the night guard asks one formal question between fights.
      if (d.rule.id === 'siezen' && d.left % 2 === 0) {
        const q = WEBER_POOL[Math.floor(this.rng() * WEBER_POOL.length)];
        const ask = q.ask[0];
        say([{ who: '守夜人', text: `「${ask}」（回答你自己的情况。他用的是 Sie，你也别用 du）` }], undefined, [
          { label: '回答', act: () => this.siezenAnswer(ask, go) },
        ]);
        return;
      }
      toast(`零号站台：还剩 ${d.left === 1 ? '最后的小首领' : `${d.left - 1} 场`}`);
      go();
      return;
    }
    this.dungeon = null;
    const today = dayKey(now(s));
    const daily = s.flags.dungeonDay !== today;
    s.flags.dungeonDay = today;
    s.flags.dungeonClears = ((s.flags.dungeonClears as number) ?? 0) + 1;
    const mult = d.kept ? d.rule.mult : 1;
    const xp = Math.round(xpToNext(s.level) * DUNGEON.clearXp * mult);
    const gold = Math.round(CONFIG.gold.perKill(s.level) * DUNGEON.clearGoldKills * mult);
    const lv = addXp(s, xp);
    s.gold += gold;
    if (daily) this.gotChest('gold', s.level);
    banner('零号站台通关', `${xp} 经验 · ${gold} 金币${daily ? ' · 金箱' : ''}`);
    say([{ who: SYS, text: d.kept ? `规矩守住了（「${d.rule.de}」）：奖励 ×${d.rule.mult}。` : '这次破了规矩，只拿基础奖励。' }]);
    for (const l of lv.levels) this.onLevelUp(l);
    this.persist();
    this.nextChest();
  }

  /** The night guard's formal question (Bitte siezen!): du voids the bonus, any answer goes on. */
  private siezenAnswer(ask: string, go: () => void) {
    this.panels.ask('守夜人', `「${ask}」`, (text: string) => {
      if (!text) toast('你没说话。守夜人哼了一声，还是让开了。');
      else if (this.dungeon && usesDu(text) && this.dungeon.kept) {
        this.dungeon.kept = false;
        toast('「Bitte siezen!」你用了 du：这次的规则加成作废了。');
      } else toast('守夜人点点头，让开了路。');
      go();
    });
  }

  /** 秩序会 (0.6 第 6 块): Frau Weber's 登记表, untimed; reputation 10 / 25 / 50 forms. */
  private talkWeber() {
    const s = this.state;
    const W = WEBER.name;
    if (!has(s.level, 'order')) return say([{ who: W, text: '「Bitte warten Sie.」（21 级再来）' }]);
    const forms = (s.flags.weberForms as number) ?? 0;
    const next = WEBER.tiers.find((t) => t > forms);
    const lines: Line[] = forms
      ? [{ who: W, text: `「Guten Tag. Noch ein Formular?」（已交 ${forms} 份${next ? `，再交 ${next - forms} 份升下一档声望` : '，秩序会声望已满'}）` }]
      : WEBER.intro.map((t, i) => ({ who: i === 2 ? SYS : W, text: t }));
    say(lines, undefined, [
      {
        label: '填一份登记表',
        act: () => {
          this.boss = startBoss(this.state, this.rng, 5);
          setPrompt(null);
          this.bossUI.open(this.boss);
        },
      },
      { label: '下次再说', act: () => {} },
    ]);
  }

  private finishWeber(f: BossFight) {
    const s = this.state;
    if (f.outcome !== 'win') return;
    const forms = ((s.flags.weberForms as number) ?? 0) + 1;
    s.flags.weberForms = forms;
    const W = WEBER.name;
    const lines: Line[] = [{ who: W, text: `「Danke schön. Alles richtig ausgefüllt.」（秩序会登记表 ${forms} 份）` }];
    const room = () => s.bag.length < CONFIG.loot.bagSize;
    if (forms === WEBER.tiers[0]) {
      const it = makeItem(this.rng, s.level, 'green', 'dict');
      if (room()) s.bag.push(it);
      lines.push({ who: SYS, text: `【秩序会声望 1 档】Frau Weber 送你一本${it.name}${room() ? '' : '（背包满了，没拿到）'}。` });
      this.achieve('order10');
    } else if (forms === WEBER.tiers[1]) {
      if (!s.skills.includes('wiederholen')) s.skills.push('wiederholen');
      lines.push({ who: SYS, text: '【秩序会声望 2 档】学会句子技能「Könnten Sie das bitte wiederholen?」：每场一次，之后有一题可以换成同难度的另一题。' });
    } else if (forms === WEBER.tiers[2]) {
      const it = makeItem(this.rng, s.level, 'purple', 'dict');
      if (room()) s.bag.push(it);
      s.flags.title = '秩序会书记';
      lines.push({ who: SYS, text: `【秩序会声望 3 档】称号「秩序会书记」，还有一本${it.name}${room() ? '' : '（背包满了，没拿到）'}。` });
    }
    this.persist();
    say(lines);
  }

  /** 每日委托 board (0.6 第 6 块): in 铁轨镇广场 and at every bonfire, from Lv21. */
  showDailies(): void {
    const s = this.state;
    const b = dailyBoard(s, this.rng);
    const lines: Line[] = [];
    if (!s.flags.dailiesSeen) {
      s.flags.dailiesSeen = true;
      lines.push({ who: SYS, text: '【每日委托】每天清晨 4 点换 3 条新的。每条给本级 8% 经验、5 只怪的金币和 2 片碎片；三条都做完再给一个铁箱。没做完也没关系，第二天换新的。' });
    }
    lines.push({
      who: '委托板',
      text: b.list.map((d, i) => `${i + 1}. ${d.done ? '✓ ' : ''}${dailyText(d)}（${d.have}/${d.need}）`).join('\n') + (b.bonus ? '\n今天的铁箱已经领了。' : ''),
    });
    this.persist();
    say(lines);
  }

  maybeLina(): void {
    const s = this.state;
    if (this.battle || this.boss || s.flags.linaFreed || s.level < CONFIG.lina.fromLevel || !questState(s, 'konrad')?.done) return;
    const miss = (s.flags.linaMiss as number) ?? 0;
    if (miss + 1 < LINA.pity && this.rng() >= LINA.chance) {
      s.flags.linaMiss = miss + 1;
      return;
    }
    s.flags.linaMiss = 0;
    if (startQuest(s, 'lina')) toast('新任务：末班车上的人（按 J 查看）', 'gold');
    this.questFire('brandtTalk');
    say(
      LINA.intro.map((t) => ({ who: LINA.name, text: t })),
      () => {
        this.boss = startBoss(this.state, this.rng, 4);
        setBattleMusic(true);
        setPrompt(null);
        this.bossUI.open(this.boss);
      },
    );
  }

  private finishLina(f: BossFight) {
    const s = this.state;
    if (f.outcome === 'win') {
      s.flags.linaFreed = true;
      this.questFire('linaFreed');
      const o = makeItem(this.rng, s.level, 'orange');
      if (s.bag.length < CONFIG.loot.bagSize) s.bag.push(o);
      s.flags.title = '还名者';
      sfx.orange();
      banner('Lina', '她的名字回来了 · 传说装备 + 称号「还名者」');
      say(LINA.outroWin.map((t) => ({ who: SYS, text: t })));
    } else {
      const fine = Math.min(s.gold, LINA.fine);
      s.gold -= fine;
      const miss = f.misses.slice(-1).map((m) => ({ who: '回顾', text: `她问「${m.asked}」——可以答：${m.model}` }));
      say([{ who: LINA.name, text: LINA.outroFine }, { who: SYS, text: `罚票：−${fine} 金币。她还会再出现。` }, ...miss]);
    }
  }

  private talkLina() {
    const s = this.state;
    const lines: Line[] = [
      { who: 'Lina', text: 'Ich heiße Lina. 我记得了。' },
      { who: 'Lina', text: '那天晚上我想赶末班车去找工作。车一直没来。我就一直站在那里，问别人要票。' },
    ];
    if (!s.flags.konradReunion) lines.push({ who: 'Lina', text: '我爸爸还在集市吗？告诉他，我很快回去。' });
    else lines.push({ who: 'Lina', text: 'Papa backt wieder. 爸爸又开始烤面包了。' });
    say(lines);
  }

  /** 末班站台: 晚点之王 (Lv28). */
  private knockRegion3() {
    const s = this.state;
    if (!has(s.level, 'boss3')) {
      say([{ who: '末班站台', text: '站台尽头的钟停在 23:59。有什么在等车，等了很久。（28 级）' }]);
      return;
    }
    const go = () =>
      say(
        BOSS3.intro.map((t) => ({ who: BOSS3.name, text: t })),
        () => {
          this.boss = startBoss(this.state, this.rng, 3);
          setBattleMusic(true);
          setPrompt(null);
          this.bossUI.open(this.boss);
        },
      );
    if (s.hp < maxHp(s) * 0.5) {
      say([{ who: SYS, text: '你身上的血不到一半。先回火边？' }], undefined, [
        { label: '直接走上站台', act: go },
        { label: '先去休息', act: () => undefined },
      ]);
      return;
    }
    go();
  }

  /** 晚点之王 rewards (as 吞秤者): gold chest on the first kill each day, orange + title 「准点者」 the first time,
   *  then one of its three sentences as a skill. */
  private finishBoss3() {
    const s = this.state;
    const first = !s.flags.boss3Kills;
    s.flags.boss3Kills = ((s.flags.boss3Kills as number) ?? 0) + 1;
    const today = dayKey(now(s));
    const dailyFirst = s.flags.boss3Day !== today;
    s.flags.boss3Day = today;
    const lv = addXp(s, CONFIG.boss3.xp);
    s.gold += CONFIG.boss3.gold;
    this.questFire('boss3');
    this.chestQueue.push({ kind: dailyFirst ? 'gold' : 'iron', ilvl: s.level });
    if (first) {
      const o = makeItem(this.rng, s.level, 'orange');
      if (s.bag.length < CONFIG.loot.bagSize) s.bag.push(o);
      s.flags.title = '准点者';
    }
    sfx.orange();
    banner('晚点之王倒下了', first ? '首杀：传说装备 + 称号「准点者」' : dailyFirst ? '金箱' : '铁箱');
    const lines: Line[] = BOSS3.outro.map((t) => ({ who: SYS, text: t }));
    lines.push({ who: SYS, text: `获得 ${CONFIG.boss3.xp} 经验、${CONFIG.boss3.gold} 金币和一个${dailyFirst ? '金' : '铁'}箱。` });
    const after = () => {
      for (const l of lv.levels) this.onLevelUp(l);
      this.refresh();
      this.persist();
      this.nextChest();
    };
    const learnable = Object.values(SKILLS).filter((k) => k.boss === 3 && !s.skills.includes(k.id));
    if (dailyFirst && learnable.length) {
      lines.push({ who: SYS, text: '它说过的话，你能留下一句。【句子技能 R】选一句：' });
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
  }

  private knockRegion2() {
    const s = this.state;
    if (!has(s.level, 'boss2')) {
      say([{ who: '秤房', text: '门后，秤砣一下一下地响。有什么在数。数你兜里有多少。（18 级）' }]);
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
      say([{ who: SYS, text: '你身上的血不到一半。先回火边？' }], undefined, [
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
      lines.push({ who: SYS, text: '它说过的话，你能留下一句。【句子技能 R】选一句：' });
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
      say([{ who: '门', text: '门开着。后面不是屋子，是一条集市街。有面包的味道。' }], undefined, [
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
      say([{ who: '门', text: '门后有东西在呼吸。（8 级）' }]);
      return;
    }
    const share = atLeastHalfShare(s, this.regionWords());
    if (share < CONFIG.boss.halfNameShare && !this.dev) {
      say([{ who: '门', text: `门没动。它还不认得你。（这片街区的词打到半名：${Math.round(share * 100)}% / ${Math.round(CONFIG.boss.halfNameShare * 100)}%）` }]);
      return;
    }
    if (s.hp < maxHp(s) * 0.5) {
      say([{ who: SYS, text: '你身上的血不到一半。先回火边？' }], undefined, [
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
    if (f.which === 6) {
      this.finishIdentify(f);
    } else if (f.which === 5) {
      this.finishWeber(f);
    } else if (f.which === 4) {
      this.finishLina(f);
    } else if (f.outcome === 'win' && f.which === 3) {
      this.finishBoss3();
    } else if (f.outcome === 'win' && f.which === 2) {
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
        lines.push({ who: SYS, text: '它说过的话，你能留下一句。【句子技能 R】写对整句释放。选一句：' });
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
      const miss = f.misses.slice(-3).map((m) => ({ who: '回顾', text: `它问「${m.asked}」——可以答：${m.model}` }));
      say([{ who: SYS, text: '它不听了。你在火边醒来。它问的事不会变，问法会变。' }, ...miss]);
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
    btn('单词本', 'N', () => this.panels.toggle('words'));
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
    else if (k === 'n') this.panels.toggle('words');
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
