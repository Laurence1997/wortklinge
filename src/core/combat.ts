// Turn-based combat as a reading game: the monster says its next move in German,
// you pick a counter, then answer a question. You act first.

import { CONFIG, DAY, HOUR, monsterHpAt, playerBaseHp } from './config';
import { gradeTyped, levenshtein, normalize, type Verdict } from './grading';
import { ELEMENT_ZH, generateIntent, INTENT_ZH } from './intents';
import { between, makeRng, pick, shuffle, type Rng } from './rng';
import { contextDueWords, contextFail, contextPass, gapZh, reviewedByUse, reviewedByWriting, reviewMon, failVerify, retire, setGuiming, kindOf, stageOf, overdueSteps, verifyOf, type Kind, type Stage } from './srs';
import { typoOk } from './cut';
import { isPlaced, placedCheck, placedPick, regionFor } from './placement';
import { blindLine, blindTask, LISTEN, passageFor, passageTask, rollListen } from './listening';
import { fillGems, gemSum } from './gems';
import { PHONES_PER_TIER } from './loot';
import { itemTier } from './state';
import { addGearKill, gear, affinityOf, affixTotal, attack, engraved, critChance, gearPen, hintsPerFight, maxHp, now, type GameState } from './state';
import type { Element, Intent, Move, Word } from './types';
import { gradeCompose } from './aiPractice';
import { clozeModeAt, noteCloze } from './adaptive';
import { gradeLink, gradeOrder, gradeSlot, linkTask, orderTask, SLOT_RECENT, slotNouns, slotTask, WRITE_CHANCE, type SlotTask } from './writing';
import type { LinkRow } from '../data/links';
import { has } from './unlocks';
import { B2_CFG, B2_MON, b2Task, rollB2Mon, type B2Mon } from './b2mons';
import { echoOptions, echoTask, notePron, PRON_MON, pronMonOk, type EchoTask } from './pron';
import { count } from './items';
import { fullForm, genderOf, hasArticleQuestion, WORD_BY_ID, WORDS, zhWithPos } from '../data/words';
import { LEX_REL } from '../data/lexicon';
import { canTarget, collocOf, gradeSplit, combatSkills, MULT, POOL, SEAL_TURNS, splitOf, type PoolId, type SplitTask } from './skillPool';
import { SAYING_CFG, SAYINGS } from '../data/sayings';
import { expectedSentence, gradeSentence, nextPattern, PATTERNS, sentenceTags, type Pattern } from './sentence';
import { PERFEKT, perfektFull, perfektParts } from '../data/perfekt';
import { EXAMPLES, caseOf, clozeWhy, maskZh, pronounClozes, slotArticle, type Case, type Stance, clozeOptions, exampleSplits, gradeCloze, hasExamples, makeCloze, parse, showsWord, twoBlank, voiceLine, wholeSentence, type ClozeMode } from './cloze';
import { CONJ, PERSON_LABEL, type Person } from '../data/verbs';
import { QTYPES, type QKey } from '../data/questionTypes';
import { critRunNeeded, litStars, rank, resMax, STAR_BONUS, wrongHitShare } from './classes';
import { gradeStorm, stormForms, type StormForm } from './storm';
import { gradeGram, gramKey, type GramTask } from './gram/task';
import { gramFor } from './gram/hook';
import { boardDue, markBoard, type ShownBoard } from './gram/boards';
import { notePrep, prepBlankTask, PREP_CFG } from './gram/prepBlank';
import { dungeonTask } from './gram/dungeons';
import { hasMirror, mirrorTask, MIRROR } from './gram/mirror';
import { partnerOf } from './gram/partner';
import { articleOfWord, ARTICLE_B2_CFG, c1ArticleFor, contextLine } from './gram/articleB2';
import { articleFor, KIND_ZH, noticeById, noticeFor, noticeTask, NOTICE_CFG } from './gram/notice';

/** A grammar task as a battle question (choice when it has options, typed otherwise). */
export function gramQuestion(t: GramTask, board: ShownBoard | null = null): Question {
  return { type: 'grammar', prompt: t.prompt, focus: t.focus, options: t.options, answer: t.answer, gram: t, ...(board ? { board } : {}) };
}
import { CHALLENGE_CFG } from './challenge';

/** callout = 点名 in packs (shout the target's article); conj = write a verb form (Lv12+); plural = write the plural (Lv11+). */
/** storm = 书写者「墨水风暴」(write 2–3 forms of the target's word); steady = 守护者「稳住」(an easy question on the target's word). */
export type QuestionType = 'article' | 'pickDe' | 'pickZh' | 'typed' | 'sentence' | 'skill' | 'callout' | 'conj' | 'plural' | 'storm' | 'steady' | 'saying' | 'cloze' | 'grammar';

export interface Question {
  type: QuestionType;
  /** What the player sees as the task, in Chinese. */
  prompt: string;
  /** Big text: the German word or the Chinese meaning, depending on the type. */
  focus: string;
  options?: string[];
  answer?: string;
  /** Typed questions on nouns need the article. */
  withArticle?: boolean;
  skillId?: string;
  /** 技能池: which pool skill asked this (split / colloc / seal / dictate; storm and steady have their own types). */
  pool?: PoolId;
  split?: SplitTask;
  /** 听写: the sentence the monster shouts (read aloud, no Chinese shown). */
  listen?: string;
  /** Milliseconds from the question showing to the answer (set by the battle screen; 速记 / 快答 / 一气呵成). */
  ms?: number;
  /** Answered by reading aloud (读音攻击). */
  spoken?: boolean;
  /** 开口作答: the answer was said, not typed — counts as 认得, never as 会写 or the 归名 blow. */
  voiced?: boolean;
  /** 静听: extra time on this question's quick line. */
  earMs?: number;
  /** 格位连锁: the same noun in another case, asked right after; right → one more hit ×1.5, the monster doesn't act. */
  chain?: boolean;
  /** 即时战: a cast bar ran out (no answer; the monsters act in full). */
  tick?: boolean;
  /** 即时战: answered in the last second of an attack's cast (弹反 window). */
  parryWindow?: boolean;
  /** conj questions: other accepted forms. */
  alts?: string[];
  /** storm questions: the long word to write. */
  word?: Word;
  /** conj questions: which person to conjugate for. */
  person?: import('../data/verbs').Person;
  /** saying questions (接句怪): what it shouts and what you finish. */
  say?: SayLine;
  /** und (0.5, Lv13+ packs): the second monster the finisher names (Ich möchte einen Tee und eine Tasse.). */
  undWord?: Word;
  /** sentence questions: which pattern (Ich brauche …, Wo ist …). */
  pattern?: Pattern;
  /** cloze questions: pick / type the dictionary form / type the form the sentence needs. */
  clozeMode?: ClozeMode;
  /** 完形填空: the sentence's Chinese (decides whether another article of the same case also counts). */
  clozeZh?: string;
  /** cloze questions: the whole sentence, read aloud after answering. */
  full?: string;
  /** 铭刻: one step harder than usual, ×2 on a hit. */
  inscribed?: boolean;
  /** 低语: the first letter (typed) shown as a hint; ×0.5 on a hit. */
  whisper?: string;
  whispered?: boolean;
  /** 语境复习 (2026-11-24): the word id of a due 归名 word asked in this fight; counts as an attack on the target. */
  review?: string;
  /** 句中默写 (练中学): a typed cloze on the word's own example with no letters shown; counts as 会写 for 斩杀. */
  dict?: boolean;
  /** 直接叫名: right → retired on the spot (全量筛选 rule, 30-day 回响); wrong → learn it as usual, no penalty. */
  directName?: boolean;
  /** 复习伙伴 (43): this cloze is on the partner word (id); right → it strikes with you. */
  partner?: string;
  /** 药片 turn (物品栏): nothing to answer. */
  item?: boolean;
  /** 齐鸣: a correct answer hits every monster in the pack. */
  chorus?: boolean;
  /** 终极技能 (30 级): the two blanks of the frame, in order. */
  ult?: string[];
  /** 终极技能最终形态「提示词造句」(97): the two hint word ids; the sentence is checked (rules → LanguageTool → AI)
   *  before the turn, and the result lands here. */
  prompt97?: { hints: string[] };
  ultGrade?: 'full' | 'target' | 'fail';
  /** 终极技能: the German frame with two ___. */
  frame?: string;
  /** A1 写作 (2026-11-22): 排句 / 槽位造句 (on a cloze slot) or 连句 (a finisher). */
  write?: 'order' | 'slot' | 'link' | 'compose';
  /** 槽位造句: the frame and the monster's own sentence. */
  slot?: SlotTask;
  /** 连句: the pair and its answer. */
  link?: LinkRow;
  /** 回音怪 (2026-11-23): the minimal pair asked (type pickDe; options are the two words). */
  echo?: EchoTask;
  /** Several boxes in one question, sent joined with | (墨水风暴 forms, 齐鸣 mates): one label per box. */
  boxes?: string[];
  /** 墨水风暴 (rev 234): the forms of the target's word, in order. */
  forms?: StormForm[];
  /** 齐鸣 (点名齐鸣, rev 234): the same-stance mates, by word id; each one's box asks its own word with the article. */
  mates?: string[];
  /** 语法题 (0.6.x–0.8 语法线): the task behind a 'grammar' question. */
  gram?: GramTask;
  /** 规则怪谈看板: shown above the first question of a newly opened grammar system. */
  board?: ShownBoard;
}

/** Row of the 题型奖励表 (src/data/questionTypes.ts) this question belongs to. */
export function qKey(q: Question): QKey {
  if (q.echo) return q.echo.say ? 'echoSay' : 'echoListen';
  if (q.review) return 'clozeForm'; // 语境复习 is a hard question (breaks armor)
  if (q.gram) return q.gram.tier === 0 ? 'gramPick' : q.gram.tier === 1 ? 'gramTyped' : 'gramHard';
  if (q.write) return q.write;
  if (q.type === 'cloze') return q.clozeMode === 'form' ? 'clozeForm' : q.clozeMode === 'base' ? 'clozeBase' : 'clozePick';
  if (q.type === 'saying') return q.options ? 'sayingPick' : 'sayingTyped';
  if (q.type === 'grammar') return 'gramTyped';
  return q.type;
}

/** 0.4 题型档位: 0 = choice (full armor), 1 = typed (half armor), 2 = hard (breaks armor). */
export function qTier(q: Question): 0 | 1 | 2 {
  return QTYPES[qKey(q)].tier;
}

/** Name of the resource: the class's, or 言灵 before you pick one. */
export function resName(_s: GameState): string {
  return '言灵';
}

export interface MonsterState {
  lvl: number;
  hp: number;
  maxHp: number;
  dmg: number;
  vulnerable: number;
  burn: number;
  poison: number;
  chilled: boolean;
  /** 破甲: hits left that ignore armor (a hard question sets it to 3, counting its own hit). */
  broken: number;
}

export interface PlayerFx {
  /** 语境复习: this fight's one context question was asked and answered. */
  ctxAsked?: boolean;
  burn: number;
  poison: number;
  chilled: boolean;
  shield: boolean;
  /** 「Das ist zu teuer!」: this turn's hits on you are halved. */
  cheap?: boolean;
  /** 「Wie viel kostet das?」: turns left in which next turn's intent is shown. */
  peek?: number;
  /** 「Stimmt so.」: monsters killed this fight drop double gold. */
  stimmt?: boolean;
  /** 「Der Zug fährt ab!」: the next right answer hits twice as hard. */
  doubleNext?: boolean;
  /** 「Ich habe den Zug verpasst.」: the next wrong answer costs no resource. */
  keepRes?: boolean;
  /** 「Nächster Halt!」: when this monster dies, the next one starts with its armor one tier down. */
  nextHalt?: boolean;
  /** 「Könnten Sie das bitte wiederholen?」 (秩序会): one later question may be swapped for another of the same kind. */
  swap?: boolean;
  /** 秘术栏: what this fight's shouts set. */
  charm?: import('./charms').CharmFx;
}

/** Class resource for one fight (shared by a whole pack, like PlayerFx). */
export interface ClassFx {
  res: number;
  /** Typed answers right in a row (书写者 passive). */
  run: number;
  critReady: boolean;
  /** Talent 冷静: the first typed miss this fight keeps your combo. */
  calmUsed: boolean;
  /** Talent 以守为攻 (old flag, unused now). */
  yishou?: boolean;
  /** 稳住: wrong answers still covered (no HP lost, combo kept). */
  guard?: number;
  /** 铭刻 cooldown in turns: carries across fights (the doc's 30 s), cleared at the bonfire. */
  inscribeCd?: number;
  /** Talent state for this fight (天赋节点表), reset when a fight starts. */
  tf?: TalentFx;
}

export interface TalentFx {
  /** 余韵: turns left of the typed bonus after a finisher. */
  glow?: number;
  /** 锋利: the next hit's crit chance bonus. */
  sharp?: number;
  /** 声盾: the next hit on you is 30% lighter. */
  voiceShield?: boolean;
  /** 坚守: a shield (HP) that soaks hits first. */
  ward?: number;
  /** 抢先: the next question hits harder (after an interrupt). */
  preempt?: boolean;
  /** 心流: turns left; quickRun counts quick right answers in a row. */
  flow?: number;
  quickRun?: number;
  /** 一气呵成: some answer this fight took 8 s or more (or was wrong). */
  slow?: boolean;
  /** 无提示: 低语 was used this fight. */
  whispered?: boolean;
  /** 静听: the next question's quick line is 2 s longer; `ear` is set for the question it applies to. */
  earNext?: boolean;
}

export type Tutorial = 'loss' | 'block' | 'break' | 'negation' | 'heal' | 'packCharge' | null;

export interface Battle {
  word: Word;
  kind: Kind;
  stage: Stage;
  /** Intervals overdue when the fight started: fatter monster, bigger reward. */
  overdue: number;
  isEcho: boolean;
  tutorial: Tutorial;
  monster: MonsterState;
  fx: PlayerFx;
  cfx: ClassFx;
  /** 宝箱怪 and rare monsters run away (「Ich muss los!」) and drop an iron chest. */
  flees: boolean;
  /** Old class trial flag (classes were cancelled): always null. */
  trial: string | null;
  intent: Intent;
  /** 「Wie viel kostet das?」: next turn's intent, already decided. */
  queued?: Intent;
  /** 0.6.x: this turn asks no haben/sein stance (its question would give the verb away). */
  perfektRest?: boolean;
  /** 词性三相 (0.5): the stance the player attacks in. Sticky for this monster until changed.
   *  From Lv7 (格位姿态) it is the declined article the monster's line needs (den, einem…). */
  phase?: Stance;
  /** The right stance has landed on it once: its gender shows from then on. */
  phaseHit?: boolean;
  /** 相亲和: the +2 resource was paid for this pick (a case change asks for a new pick and pays again). */
  affinityPaid?: boolean;
  /** 群怪 (rev 49): the stance pick and case before this turn's line, so alignPairs can keep or clear it. */
  phasePrev?: { phase?: Stance; affinityPaid?: boolean; c: Case };
  /** 先教后考 (0.5): the turn on which a never-met noun had its stance picked for it and shown. */
  phaseTaught?: number;
  /** 「Nächster Halt!」: this monster's armor is one tier down for the whole fight. */
  armorDown?: boolean;
  /** 结构魔 (B1 红名): its questions ask subordinate-clause word order; other answers hit for half. */
  structMon?: boolean;
  /** 搭配记忆 / 乘隙: turns left with its armor one tier down. */
  armorDownT?: number;
  /** 格位连锁: a follow-up question is due now; chainAt = the turn it was last offered (once per 3 turns). */
  chainOffer?: boolean;
  chainAt?: number;
  /** 即时战 弹反: the next cast that runs out is caught (set by a right answer in its last second). */
  parryReady?: boolean;
  /** 21 级「时间」进难题预告: turns left until an announced big attack («gleich», «in zwei Runden»). */
  chargeIn?: number;
  /** 现在完成时 (0.6, region 3 Lv21+): a verb monster speaking in the Perfekt; its stance is haben / sein. */
  perfekt?: boolean;
  /** 复数怪 (0.5, Lv11+): a whole crowd of this word, die Äpfel. Only the die stance is right. */
  pluralMon?: boolean;
  /** 残句 (0.5): a sentence monster with no word nameplate. Finish the half → pick its meaning → write it whole. */
  phrase?: SayLine;
  /** 残句: how many of its three steps are done. */
  phraseStep?: number;
  /** 野外精英 · 场景精英 (2026-11-23): this fight is part `seg` (0 认 / 1 用 / 2 写) of a scene elite carrying `words`. */
  elite?: { scene: string; words: string[]; seg: number; review: boolean };
  turn: number;
  turnsSinceCharge: number;
  trapUsed: boolean;
  wrongStreak: number;
  slipped: boolean;
  qIndex: number;
  /** Correct answers so far: the question ladder moves on only when you get one right. */
  step: number;
  /** Pack fights: its article was called right (点名), so its card shows the article colour. */
  named: boolean;
  /** Lv11+: about 1 in 3 due nouns ask for the plural. */
  pluralDue: boolean;
  /** Rewards already paid (packs settle each kill at once). */
  settled?: boolean;
  /** 教学战: this fight started with a full 言灵 bar to try 终结技. */
  teachFin?: boolean;
  /** 怪物诅咒 (0.6, 25 级): 遗忘 = no 低语 and no Chinese hints; 沉默 = no 读出来 / 跟读. A hard question right lifts it. */
  curse?: 'forget' | 'silence';
  /** 锈名 (27 级): the rusted look of a review monster 3+ intervals overdue (越久越肥 layers 3–4). */
  rusty?: boolean;
  /** 审查修订: sentences shown in this fight (normalized), kept out of writing questions. */
  seenLines?: string[];
  /** It carried a curse at the start (pays ×1.3 XP and one more shard even once lifted). */
  cursed?: boolean;
  /** 跟读 paid out in this fight (once per fight). */
  shadowed?: boolean;
  hintsLeft: number;
  /** 低语 used on this word and not yet answered right without a hint. */
  hinted?: boolean;
  firstCorrectDone: boolean;
  lastKillTyped: boolean;
  skillCooldown: number;
  /** 技能池 cooldowns in turns, per skill. */
  poolCd: Partial<Record<PoolId, number>>;
  /** 格之封印: turns this monster can't charge. */
  sealed?: number;
  /** 齐鸣 cooldown in turns (shared by a pack). 铭刻's lives on cfx and carries across fights. */
  chorusCd: number;
  /** Orange 冠词审判: the next hit after a correct article answer deals double. */
  judgement: boolean;
  /** 接句怪: the half sentence it shouts; its first attack question asks for the rest. */
  saying?: SayLine;
  sayingDone?: boolean;
  /** 回音怪: the pair question was answered this fight (once per fight). */
  echoDone?: boolean;
  /** 发音怪 (83): every attack question is its sound pair. */
  pronMon?: boolean;
  /** B2 怪种 (转述怪, 数字怪, 改写怪, 时间线怪, 三语域怪, 回顾怪): every other attack question is its own. */
  b2Mon?: B2Mon;
  /** 听段题 (34) / 盲听 (91): this monster opens with a listening question; done once answered. */
  listenMon?: import('./listening').ListenKind;
  listenDone?: boolean;
  /** Replays left on the listening question (1, +1 with 「Wie bitte?」). */
  replays?: number;
  /** 言石 刻满 this turn (grammars): the controller pays the XP. */
  gemFilled?: import('./gram/task').GramSys[];
  /** Sentence attacks used on this monster this fight (each pattern once, in tag order). */
  sxUsed?: number;
  /** 终极技能 (30 级): used this fight; how many of its two blanks were right. */
  ultUsed?: boolean;
  ultHits?: number;
  /** 墨水风暴 (rev 234): forms written right in the last chain. */
  stormHits?: number;
  /** 齐鸣 (rev 234): mates whose own word was written right this turn (word ids). */
  chorusHits?: string[];
  /** 语法秘境: every attack question is this floor's grammar on the monster's word. */
  gramDungeon?: { kind: import('./gram/dungeons').DungeonKind; floor: string };
  /** 复习怪: its opening 句中默写 was right, so the word is back at 归名. */
  backToGuiming?: boolean;
  /** 复习伙伴: its question was asked this fight. */
  partnerDone?: boolean;
  /** 告示怪 / 信件怪 (15): the notice it carries, and how many of its questions were asked. */
  notice?: { id: string; i: number };
  /** 文章群怪 (121+): the article sentence this new word stands in; its own blow picks the meaning from it. */
  artCtx?: string;
  /** 镜像怪 (35): every attack question is the reflexive pronoun on this verb. */
  mirror?: boolean;
  /** 审查修订: an extra-damage question left it at 1 HP; the next attack asks its own word. */
  finishOwn?: boolean;
  /** 语法线: grammar questions asked on this word this fight. */
  gramAsked?: number;
  /** 挑战怪 (rev 342): a word from the scene's challenge pool: your level + 2, ×1.75 XP, opens with a dictation,
   *  and written right before its spelling showed it takes the field's quick 斩杀 even in its first fight. */
  challenge?: boolean;
  /** The first written answer of this fight: right by dictation (no spelling seen yet), right, or wrong. */
  firstTry?: import('./challenge').FirstTry;
  /** 挑战怪 written right unseen in its first fight: the word goes 待验证 once the kill creates its entry. */
  pendOnWin?: boolean;
  /** 斩杀 (0.6.x): this fight verifies a 待验证 word ('pend') or a retired word's 30-day 回响 check ('recheck'):
   *  glitched name, first question fixed (typing, no hint). */
  verify?: 'pend' | 'recheck';
  /** 斩杀: the verification question was answered. */
  verifyDone?: boolean;
  /** 斩杀: verified — the 「可斩杀」 button kills it on the spot, and its kill retires the word. */
  cutReady?: boolean;
  /** 直接叫名 (Lucas 2026-11-25): a word met for the first time offers an unhinted dictation before its first question. */
  directOffer?: boolean;
  /** 快速通道 (Lucas 2026-11-25): a 推定会 word met in the field. 「我认识它」 written right retires it (3 shards, no
   *  XP); declined or wrong, it is a missed word and is learned as new. */
  presumed?: boolean;
  /** The player took the 直接叫名 offer: the next attack question is that dictation. */
  direct?: boolean;
  /** 斩杀: this fight showed the word's spelling (a question with the German on screen, or a wrong answer's
   *  correction), so a typed answer after it no longer counts as 会写. */
  spellSeen?: boolean;
  /** 认得 / 会写 earned on this word this fight, not yet written to the wordbook (new words join it on the kill). */
  readOk?: number;
  writeOk?: number;
  /** 归名 (2026-11-24): a cloze on this word was answered right in this fight (用). */
  usedOk?: boolean;
  /** 复习怪 (relapsed, or a 归名 word 2 gaps overdue): your level, ×1.5 XP, an extra shard. A learning respawn is not one. */
  reviewMon?: boolean;
  /** A wrong answer or a 低语 on this word in this fight (a clean 归名 skips the review schedule). */
  flawed?: boolean;
  /** Wrong answers on this word this fight (复习按表现: the first gap after 归名). */
  wrongs?: number;
  outcome: null | 'win' | 'lose' | 'fled';
  log: LogLine[];
  recap: string[];
}

export interface LogLine {
  text: string;
  tone: 'sys' | 'good' | 'bad' | 'crit' | 'info';
}

export function monsterStats(level: number, stage: Stage, kind: Kind, overdue: number) {
  const m = CONFIG.monster;
  const stageMult =
    kind === 'shadow' ? m.stageHp.shadow : stage === 0 ? m.stageHp.new : stage === 1 ? m.stageHp.cracked : m.stageHp.half;
  // 0.4: HP grows ×1.08 per level; one action takes a fixed share of a same-level player's HP.
  const hp = Math.max(4, Math.round(monsterHpAt(level) * stageMult * (1 + m.overdueHpStep * overdue)));
  const dmg = Math.max(1, Math.round(m.dmgPct(level) * playerBaseHp(level)));
  return { hp, dmg };
}

export function startBattle(
  s: GameState,
  word: Word,
  rng: Rng,
  opts: { isEcho?: boolean; tutorial?: Tutorial; trial?: string; rare?: boolean; elite?: boolean; challenge?: boolean; struct?: boolean } = {},
): Battle {
  const t = now(s);
  // 快速通道: a 推定会 word comes as a new monster with the 「我认识它」 offer; its entry is dropped (missed unless named).
  const presumed = !opts.tutorial && !opts.trial && isPlaced(s.words[word.id]);
  if (presumed) delete s.words[word.id];
  const kind = kindOf(s, word, t);
  const stage = stageOf(s, word, t);
  // The word holding your echo waits at your level, so you can win it back.
  // 0.4: armor doubles per level above you, and a zone mixes words of several levels (schilderstrasse 3–7,
  // kornspeicher 12–20), so a field monster stands at most one level above you.
  // A field you chose to enter above your level (越区引导) keeps its monsters' full level.
  // Review monsters (2026-11-21) stand at your level wherever they turn up: old word, current-region monster, full pay.
  const isReview = kind === 'due' && reviewMon(s.words[word.id], t);
  const challenge = !!opts.challenge && !opts.isEcho && !opts.tutorial && !opts.trial;
  // 审查修订 B2: Lv1–5 a challenge monster is your level (the 1–5 cap of 0 above), +2 from Lv6.
  // 快速通道: a placed player's not-yet-归名 words in the regions before the entry region stand at the player's level.
  const lvl = (presumed || fastTrackWord(s, word)) && !opts.isEcho ? Math.max(word.lvl, s.level) : challenge ? s.level + (s.level <= 5 ? 0 : CHALLENGE_CFG.levelAbove) : opts.isEcho ? Math.min(word.lvl, s.level) : isReview ? Math.max(word.lvl, s.level) : s.flags[`zoneOk_${word.zone}`] ? word.lvl : Math.min(word.lvl, s.level + CONFIG.monster.maxAbove(s.level));
  const overdue = overdueSteps(s, word, t);
  // 锈名 (27 级): 审查修订 — only the look of 越久越肥 layers 3–4 (3+ intervals overdue); the HP comes from 越久越肥.
  const rusty = isReview && overdue >= CONFIG.rusty.overdue && s.level >= CONFIG.rusty.from && !opts.tutorial && !opts.elite;
  const st = monsterStats(lvl, stage, kind, overdue);
  const hp0 = st.hp;
  const monster: MonsterState = { lvl, hp: hp0, maxHp: hp0, dmg: st.dmg, vulnerable: 0, burn: 0, poison: 0, chilled: false, broken: 0 };
  const tutorial = opts.tutorial ?? null;
  if (tutorial === 'loss') {
    monster.lvl = s.level + 6;
    monster.hp = monster.maxHp = 999;
    monster.dmg = Math.ceil(maxHp(s) / 2.5);
  }
  const b: Battle = {
    word,
    kind,
    challenge: challenge || undefined,
    reviewMon: isReview || undefined,
    overdue,
    rusty: rusty || undefined,
    presumed: presumed || undefined,
    stage,
    isEcho: !!opts.isEcho,
    tutorial,
    monster,
    fx: { burn: 0, poison: 0, chilled: false, shield: false },
    // 墨水 / 沉着 and the typed streak carry over between fights (reset at the bonfire): the same object lives on the save.
    cfx: classFx(s),
    trial: opts.trial ?? null,
    flees: !!opts.rare || word.family === 'truhe',
    intent: null as unknown as Intent,
    turn: 1,
    turnsSinceCharge: 0,
    trapUsed: false,
    wrongStreak: 0,
    slipped: false,
    qIndex: 0,
    step: 0,
    named: false,
    pluralDue: false,
    hintsLeft: hintsPerFight(s),
    firstCorrectDone: false,
    lastKillTyped: false,
    skillCooldown: 0,
    poolCd: {},
    chorusCd: 0,
    judgement: false,
    outcome: null,
    log: [],
    recap: [],
  };
  // 斩杀: a 待验证 word (from an earlier day) or a due 回响 check is verified in this fight.
  const verify = opts.tutorial || opts.trial ? null : verifyOf(s.words[word.id], t);
  if (verify) b.verify = verify;
  const canPlural = !verify && !!word.art && !!word.pl && word.pl !== '-' && !word.plOnly && has(s.level, 'plural') && (s.words[word.id]?.plOk ?? 0) < CONFIG.phase.pluralRetire;
  b.pluralDue = kind === 'due' && canPlural && rng() < 1 / 3;
  // 复数怪 (0.5): from Lv11 about one noun monster in five is a crowd of it (die Äpfel): only die is right,
  // its typed questions ask for the plural, and it is half again as tough.
  // 斩杀: a retired noun only comes back as its plural crowd (复数怪 don't retire with the word).
  const retiredPl = canPlural && !!s.words[word.id]?.retired;
  if (canPlural && !opts.isEcho && !tutorial && !opts.trial && !opts.elite && word.family !== 'truhe' && (retiredPl || rng() < CONFIG.phase.pluralChance)) {
    b.pluralMon = true;
    b.pluralDue = true;
    monster.hp = monster.maxHp = Math.round(monster.maxHp * CONFIG.phase.pluralHp);
  }
  if (s.flags.nextHalt && !tutorial) {
    b.armorDown = true;
    delete s.flags.nextHalt;
  }
  // 红名怪 (opts.struct) is always the 结构魔: no Perfekt, notice or mirror roll.
  b.perfekt = opts.struct ? false : perfektBattle(s, word, kind, rng, !!tutorial || !!opts.trial);
  // 告示怪 / 信件怪 (15): now and then a field monster of a zone with a notice carries it.
  if (!b.perfekt && !opts.struct && !tutorial && !opts.trial && !opts.elite && !opts.isEcho && !challenge && s.level >= NOTICE_CFG.from && kind !== 'new' && rng() < NOTICE_CFG.chance) {
    const n = s.level >= NOTICE_CFG.articleFrom && rng() < NOTICE_CFG.articleChance / NOTICE_CFG.chance ? (c1ArticleFor(s.region ?? 1, rng) ?? articleFor(rng)) : noticeFor(word.zone, rng, word.region);
    if (n) {
      b.notice = { id: n.id, i: 0 };
      b.log.push({ text: `${KIND_ZH[n.kind]}：它身上${n.kind === 'article' ? '带着一篇文章' : '贴着一张'}「${n.title}」。读懂它，答对上面的问题才打得中。`, tone: 'info' });
    }
  }
  // 文章群怪 (121+): a new word of a B2 article always comes with its article (the pack joins in the controller).
  if (!b.notice && !opts.struct && !tutorial && !opts.trial && !opts.elite && !opts.isEcho && !challenge && kind === 'new' && s.level >= ARTICLE_B2_CFG.from) {
    const a = articleOfWord(word);
    if (a) {
      b.notice = { id: a.id, i: 0 };
      b.perfekt = false;
      const line = contextLine(a, word);
      if (line) b.artCtx = line;
      b.log.push({ text: `文章群怪：它从文章「${a.title}」里爬出来。先读懂文章答内容题，最后按上下文认出它的意思。`, tone: 'info' });
    }
  }
  // 镜像怪 (35): a verb with a reflexive use sometimes comes as its mirror (not before you have met it).
  if (!b.perfekt && !b.notice && !opts.struct && !tutorial && !opts.trial && !opts.elite && s.level >= MIRROR.from && kind !== 'new' && hasMirror(word) && rng() < MIRROR.chance) {
    b.mirror = true;
    b.log.push({ text: `镜像怪：它照出了你的样子——这一战考反身代词（mich / dich / sich…）。`, tone: 'info' });
  }
  // 结构魔 (B1 红名): a verb you have met sometimes comes as a weil-worm — it drags the verb to the end of the clause.
  if (!b.perfekt && !b.notice && !b.mirror && !tutorial && !opts.trial && !opts.elite && s.level >= STRUCT.from && kind !== 'new' && word.pos === 'v' && structTasks(word).length && (opts.struct || rng() < STRUCT.chance)) {
    b.structMon = true;
    b.log.push({ text: `结构魔：weil 蠕虫缠在它身上，把动词拖到了句尾。用从句语序回答（…, weil ich … 动词），别的招式只刮掉一半。`, tone: 'info' });
  }
  // 发音怪 (83): a word on a hard sound pair sometimes comes as one.
  if (!b.perfekt && !b.notice && !b.mirror && !b.structMon && !tutorial && !opts.trial && !opts.elite && !opts.isEcho && s.level >= PRON_MON.from && kind !== 'new' && pronMonOk(word) && rng() < PRON_MON.chance) {
    b.pronMon = true;
    b.log.push({ text: `发音怪：它只认清楚的发音——每一击都要分清它和它的近音词。别的招式只擦过它。`, tone: 'info' });
  }
  // B2 怪种 (121+): a word monster sometimes comes as one of the kinds open at your level.
  if (!b.perfekt && !b.notice && !b.mirror && !b.structMon && !b.pronMon && !tutorial && !opts.trial && !opts.elite && !opts.isEcho && !challenge && kind !== 'new' && word.pos !== 'phr') {
    const k = rollB2Mon(s, word, rng);
    if (k) {
      b.b2Mon = k;
      b.log.push({ text: `${B2_MON[k].log}别的招式只擦过它。`, tone: 'info' });
    }
  }
  // 听段题 (34) / 盲听 (91): about 1 in 8 field monsters opens with a listening question.
  if (!b.perfekt && !b.notice && !b.mirror && !b.structMon && !b.pronMon && !b.b2Mon && !tutorial && !opts.trial && !opts.elite && !opts.isEcho && kind !== 'new') {
    const lk = rollListen(s.level, word, rng);
    if (lk) {
      b.listenMon = lk;
      b.log.push({ text: lk === 'passage' ? '听段怪：它先播一段话，不给文字。听懂了回答它的问题（可以免费重听一次）。' : '盲听：它说一句话，不给文字，打出缺的那个词（可以免费重听一次）。', tone: 'info' });
    }
  }
  b.intent = nextIntent(s, b, rng);
  perfektGuard(s, b);
  // 直接叫名: only on the very first meeting, once typing is open, never in teaching, trial, elite or phrase fights.
  if (kind === 'new' && !s.words[word.id] && has(s.level, 'typing') && !tutorial && !opts.trial && !opts.elite && !opts.isEcho && !challenge && !b.pluralMon && word.family !== 'truhe' && word.pos !== 'phr') b.directOffer = true;
  return b;
}

/** 21 级「时间」进难题预告: a big attack says when it comes — jetzt (this turn, as before), gleich (next turn) or
 *  in zwei Runden — and comes exactly then. Announcing turns are a breath (no attack). */
function timeCharge(b: Battle, intent: Intent, rng: Rng): Intent {
  const r = rng();
  if (r < 1 / 3) return { ...intent, line: 'Jetzt kommt mein großer Schlag!', zh: '现在就放大招！', layers: [...intent.layers, 'time'] };
  const n = r < 2 / 3 ? 1 : 2;
  b.chargeIn = n;
  return {
    kind: 'wait',
    shown: 'charge',
    hits: 0,
    element: 'phys',
    line: n === 1 ? 'Gleich kommt mein großer Schlag!' : 'In zwei Runden kommt mein großer Schlag!',
    zh: n === 1 ? '马上（下回合）就放大招！' : '再过两回合放大招！',
    layers: ['time'],
  };
}

/** 现在完成时 (0.6 第 5 块): from Lv21 every region-3 verb monster in region 3 speaks in the Perfekt, and a region-1/2
 *  verb coming back as a review does so one time in three (as plurals do in region 2). */
export function perfektBattle(s: GameState, w: Word, kind: Kind, rng: Rng, scripted = false): boolean {
  if (scripted || w.pos !== 'v' || !PERFEKT[w.de] || s.level < CONFIG.perfekt.from) return false;
  if ((w.region ?? 1) === 3) return (s.region ?? 1) === 3;
  return kind !== 'new' && rng() < CONFIG.perfekt.reviewChance;
}

/** 填分词 opens by kind: ge-…-t at Lv21, strong and mixed at Lv24, separable and prefixed at Lv27. */
export function ppOpen(level: number, w: Word): boolean {
  const e = PERFEKT[w.de];
  if (!e || level < CONFIG.perfekt.from) return false;
  return e.kind === 'reg' || (e.kind === 'irr' && level >= CONFIG.perfekt.irregularFrom) || level >= CONFIG.perfekt.prefixFrom;
}

/** 填分词: Ich habe Brot ___ (kaufen) → gekauft. Counts as a form cloze. */
export function ppQ(w: Word): Question | null {
  const e = PERFEKT[w.de];
  if (!e) return null;
  const x = perfektParts(e);
  return {
    type: 'cloze',
    prompt: `填分词：打出 Partizip II · ${x.zh}`,
    focus: `${x.before}${x.aux}${x.mid}___ (${w.de})${x.after}`.replace(/\s+/g, ' ').trim(),
    answer: x.pp,
    clozeMode: 'form',
    full: perfektFull(e),
  };
}

/** The Perfekt line a verb monster mumbles: its auxiliary swallowed (that is the stance to pick). */
function perfektLine(w: Word): { line: string; zh: string; full: string; fullZh: string } {
  const e = PERFEKT[w.de];
  const x = perfektParts(e);
  const line = `${x.before}… mmh …${x.mid}${x.pp}${x.after}`.replace(/\s+/g, ' ').trim();
  return { line, zh: maskZh(x.zh, w), full: perfektFull(e), fullZh: x.zh };
}

/** 0.6.x (docs, 完成时台词): a turn whose question would be 选意思 / 选德语 / 填分词 asks no haben/sein stance (like a
 *  verb monster before 21) and mumbles one of the verb's plain example sentences (verb swallowed, Chinese blanked),
 *  or just 「… mmh …」; a stance turn keeps the participle in the line. The question is predicted with a throwaway rng. */
function perfektGuard(s: GameState, b: Battle): void {
  b.perfektRest = false;
  if (!b.perfekt || !b.intent?.full || b.intent.kind === 'charge' || b.intent.kind === 'flee') return;
  const x = perfektParts(PERFEKT[b.word.de]);
  const leaks = (['attack', 'inscribe', 'whisper'] as Move[]).some((m) => {
    const q = makeQuestion(s, b, m, makeRng(b.turn + 1));
    return q.type === 'pickZh' || q.type === 'pickDe' || (q.type === 'cloze' && q.answer === x.pp);
  });
  if (!leaks) return;
  b.perfektRest = true;
  const v = voiceLine(b.word, b.turn);
  b.intent = v
    ? { ...b.intent, line: v.line, zh: v.zh, full: v.full, fullZh: v.fullZh, caseArt: undefined }
    : { ...b.intent, line: '… mmh …', zh: '（它含糊地念着什么，听不清。）', full: undefined, fullZh: undefined, caseArt: undefined };
}

function nextIntent(s: GameState, b: Battle, rng: Rng): Intent {
  const tut = b.tutorial;
  const ctx = {
    level: s.level,
    family: b.word.family,
    hpRatio: b.monster.hp / b.monster.maxHp,
    turnsSinceCharge: b.turnsSinceCharge,
    trapUsed: b.trapUsed,
  };
  let intent: Intent;
  if (tut === 'loss') {
    intent = generateIntent(rng, { ...ctx, force: { kind: 'attack', hits: 3, line: 'Ich beiße dreimal!', zh: '我咬三下！', layers: ['count'] } });
  } else if (b.flees && b.turn >= 2 && (ctx.hpRatio < 0.5 || b.turn >= 3)) {
    intent = generateIntent(rng, { ...ctx, force: { kind: 'flee', line: 'Ich muss los!', zh: '我得走了！（这回合打不死它，它就跑了）' } });
  } else if (tut === 'packCharge' && b.turn === 1) {
    intent = generateIntent(rng, { ...ctx, force: { kind: 'charge', line: 'Moment!', zh: '等一下！（在蓄力）' } });
  } else if (b.monster.chilled && b.intent?.kind === 'charge') {
    // Ice pushed the charge back: it is still charging.
    intent = { ...b.intent, line: 'Moment … noch nicht …', zh: '等等……还没好……（冰把蓄力往后推了）' };
  } else if (!tut && b.chargeIn !== undefined) {
    // An announced big attack: normal turns until the time runs out, then it lands as said.
    b.chargeIn -= 1;
    if (b.chargeIn <= 0) {
      b.chargeIn = undefined;
      intent = generateIntent(rng, { ...ctx, force: { kind: 'charge', line: 'Jetzt!', zh: '现在！（说好的大招来了）', layers: ['time'] } });
    } else intent = generateIntent(rng, { ...ctx, turnsSinceCharge: 0 });
  } else {
    intent = generateIntent(rng, ctx);
    if (intent.kind === 'charge' && !tut && s.level >= CONFIG.timeWords.from) intent = timeCharge(b, intent, rng);
  }
  // 格之封印: a sealed monster can't charge; it attacks instead (and an announced charge waits).
  if ((b.sealed ?? 0) > 0 && intent.kind === 'charge') intent = generateIntent(rng, { ...ctx, force: { kind: 'attack', hits: 1, line: '… mmh …', zh: '它想蓄力，封印压着它（只能普通攻击）', layers: [] } });
  if (intent.kind === 'charge') b.turnsSinceCharge = 0;
  else b.turnsSinceCharge += 1;
  // 怪的台词 (2026-11-21): outside tutorials it mumbles one of its own example sentences with its name swallowed
  // (a listening clue that never says the answer). Only the big attack keeps the shouted stock lines as a warning.
  if (b.phrase && intent.kind !== 'flee') {
    // 残句: it only ever shouts its half sentence (its big attack included).
    intent = { ...intent, ...shoutLine(b.phrase) };
  } else if (!tut && intent.kind !== 'charge' && intent.kind !== 'flee' && !intent.layers.includes('time') && b.saying && !b.sayingDone) {
    // 接句怪: until you finish its line, the line is its half sentence (no mumbled example giving the rest away).
    intent = { ...intent, ...shoutLine(b.saying) };
  } else if (!tut && intent.kind !== 'charge' && intent.kind !== 'flee' && !intent.layers.includes('time') && b.perfekt) {
    // 现在完成时: the Perfekt sentence with haben / sein swallowed.
    intent = { ...intent, ...perfektLine(b.word), caseArt: undefined };
  } else if (!tut && intent.kind !== 'charge' && intent.kind !== 'flee' && !intent.layers.includes('time') && b.pluralMon) {
    // 复数怪: its examples are singular (「… mmh … beginnt um neun」 asks der), so a crowd only mumbles; the stance is always die.
    intent = { ...intent, line: '… mmh … mmh …', zh: '一群同一个词的怪挤在一起嘟囔 · 复数一律 die', full: undefined, fullZh: undefined, caseArt: undefined };
  } else if (!tut && intent.kind !== 'charge' && intent.kind !== 'flee' && !intent.layers.includes('time')) {
    // 格位姿态 (Lv7+): only sentences whose slot is in a case this level reads, and the stance must match the slot.
    const g = genderOf(b.word);
    const open = casesOpen(s.level);
    const caseOk = (i: number) => {
      const c = caseOf(g, slotArticle(b.word, i));
      return !!c && open.includes(c);
    };
    const reads = !!b.word.art && s.level >= CONFIG.phase.accFrom;
    const v = voiceLine(b.word, b.turn, reads ? caseOk : undefined);
    if (v) intent = { ...intent, line: v.line, zh: v.zh, full: v.full, fullZh: v.fullZh, caseArt: reads && caseOk(v.idx) ? slotArticle(b.word, v.idx)! : undefined };
  }
  // 格位姿态: the stance stays picked while the case stays the same; a line in another case asks for a new pick.
  if (b.intent) b.phasePrev = { phase: b.phase, affinityPaid: b.affinityPaid, c: lineCase(b, b.intent) };
  if (b.phase && b.intent) {
    if (lineCase(b, b.intent) !== lineCase(b, intent)) (b.phase = undefined), (b.affinityPaid = false);
  }
  return intent;
}

/** The case a line asks for (nom when the stance comes from the name alone). */
function lineCase(b: Battle, it: Intent): Case {
  return !it.caseArt || b.pluralMon ? 'nom' : caseOf(genderOf(b.word), it.caseArt) ?? 'nom';
}

/** Whether this turn's line is a plain mumbled example (the only kind alignPairs may swap). */
function plainVoice(s: GameState, b: Battle): boolean {
  const it = b.intent;
  return !b.tutorial && it.kind === 'attack' && !it.layers.includes('time') && !b.phrase && !(b.saying && !b.sayingDone) && !b.perfekt && !b.pluralMon && !!b.word.art && s.level >= CONFIG.phase.accFrom;
}

/** Cases this monster has a line for at this level. */
export function voiceCases(s: GameState, b: Battle): Case[] {
  const g = genderOf(b.word);
  const open = casesOpen(s.level);
  const n = (EXAMPLES[b.word.id] ?? []).length;
  const out = new Set<Case>();
  for (let i = 0; i < n; i++) {
    const a = slotArticle(b.word, i);
    const c = caseOf(g, a);
    // kein lines don't count: a pair reads plain lines (voiceIn skips kein too).
    if (c && open.includes(c) && !a?.startsWith('kein')) out.add(c);
  }
  return [...out];
}

/** Re-voice a plain line in the wanted case (a mumble with the name stance when nothing fits and nom is wanted). */
function voiceIn(b: Battle, want: Case): void {
  const g = genderOf(b.word);
  const ok = (i: number) => caseOf(g, slotArticle(b.word, i)) === want && !slotArticle(b.word, i)?.startsWith('kein');
  const v = voiceLine(b.word, b.turn, ok);
  if (v && ok(v.idx)) b.intent = { ...b.intent, line: v.line, zh: v.zh, full: v.full, fullZh: v.fullZh, caseArt: slotArticle(b.word, v.idx)! };
  else if (want === 'nom') b.intent = { ...b.intent, line: '… mmh …', zh: '（它含糊地念着什么，听不清。）', full: undefined, fullZh: undefined, caseArt: undefined };
}

/** The key a pair shares: same article (a plural crowd only pairs with another crowd). */
function pairKey(b: Battle): string | null {
  if (!b.word.art || b.perfekt) return null;
  return b.pluralMon ? 'pl' : b.word.art;
}

/** 群怪 (rev 49): a same-article pair reads in one case, so the stance right on one is right on the other.
 *  A member whose line is fixed (charging, fleeing, 接句, crowd) stands in the name's case, so the others follow it;
 *  otherwise the pair takes a case every member has a line for (the first member's case when it can). */
export function alignPairs(s: GameState, pack: Battle[]): void {
  const groups = new Map<string, Battle[]>();
  for (const x of pack) {
    const k = !x.outcome ? pairKey(x) : null;
    if (k) groups.set(k, [...(groups.get(k) ?? []), x]);
  }
  for (const g of groups.values()) {
    if (g.length < 2) continue;
    const free = g.filter((x) => plainVoice(s, x));
    let want: Case = 'nom';
    if (free.length === g.length) {
      const both = (['nom', 'acc', 'dat'] as Case[]).filter((c) => g.every((x) => voiceCases(s, x).includes(c)));
      // No case both have a line in (e.g. Tisch has only acc / dat examples): they can't read one case; leave them.
      if (!both.length) continue;
      const lead = lineCase(g[0], g[0].intent);
      want = both.includes(lead) ? lead : both[g[0].turn % Math.max(1, both.length)] ?? 'nom';
    } else if (free.length < g.length) want = 'nom';
    // A kein line takes only the exact kein stance, so a pair reads plain (non-kein) lines to share one stance.
    for (const x of free) {
      if (lineCase(x, x.intent) === want && !x.intent.caseArt?.startsWith('kein')) continue;
      voiceIn(x, want);
    }
    // Keep a stance pick the case did not change; clear it when it did.
    for (const x of g) {
      const pv = x.phasePrev;
      if (!pv) continue;
      const now = lineCase(x, x.intent);
      if (now === pv.c && !x.phase && pv.phase) (x.phase = pv.phase), (x.affinityPaid = pv.affinityPaid);
      else if (now !== pv.c && x.phase && x.phase === pv.phase) (x.phase = undefined), (x.affinityPaid = false);
    }
  }
}

/** 齐鸣 shows only when another monster still standing shares the target's stance (rev 49). */
export function chorusMates(b: Battle, pack: Battle[]): Battle[] {
  const ph = phaseOf(b);
  return pack.filter((o) => o !== b && !o.outcome && (ph ? needsPhase(o) && phasePair(o).includes(ph) : pairKey(o) === pairKey(b)));
}

/** What a 接句怪 shouts while its line is open. */
export function shoutLine(say: SayLine): { line: string; zh: string; full: undefined; fullZh: undefined } {
  return { line: `${say.a} …`, zh: '（它喊出半句，等你接上。）', full: undefined, fullZh: undefined };
}

// ---- Questions -------------------------------------------------------------

/** Meanings that overlap (a shared gloss) count as synonyms. */
const zhParts = (zh: string) => zh.split(/[、，,;；/（）()\s]+/).map((x) => x.trim()).filter((x) => x.length > 0);
function synonym(a: Word, b: Word): boolean {
  const pa = zhParts(a.zh);
  return zhParts(b.zh).some((x) => pa.includes(x));
}

/** 审查修订「干扰项」: same part of speech, same gender (nouns), and never a synonym. */
function distractors(rng: Rng, w: Word, field: 'de' | 'zh', n: number): string[] {
  const fits = (x: Word) => x.id !== w.id && x.pos === w.pos && x[field] !== w[field] && !synonym(w, x) && (!w.art || x.art === w.art);
  const strict = WORDS.filter(fits);
  const samePos = strict.length >= n ? strict : WORDS.filter((x) => x.id !== w.id && x.pos === w.pos && x[field] !== w[field] && !synonym(w, x));
  const pool = samePos.length >= n ? samePos : WORDS.filter((x) => x.id !== w.id);
  const out: string[] = [];
  for (const x of shuffle(rng, pool)) {
    const v = field === 'de' ? x.de : x.zh;
    if (!out.includes(v) && v !== (field === 'de' ? w.de : w.zh)) out.push(v);
    if (out.length >= n) break;
  }
  return out;
}

/** 审查 C3 跟进 (Lucas 11-26 选 1): wrong options for 听整句选德语 must fit the sentence just as well, so only the ear
 *  decides: same part of speech (nouns: same article), and sounding or looking close (形近 from relations.tsv first,
 *  then the closest spellings). */
export function soundAlikes(rng: Rng, w: Word, n: number): string[] {
  const fits = (x: Word) => x.id !== w.id && x.pos === w.pos && x.de !== w.de && !synonym(w, x) && (!w.art || x.art === w.art) && !x.tutorial && x.pos !== 'phr';
  const out: string[] = [];
  for (const id of LEX_REL[w.id]?.[2] ?? []) {
    const x = WORD_BY_ID[id];
    if (x && fits(x) && !out.includes(x.de)) out.push(x.de);
    if (out.length >= n) return shuffle(rng, out);
  }
  const me = normalize(w.de);
  const near = WORDS.filter(fits)
    .map((x) => ({ de: x.de, d: levenshtein(me, normalize(x.de)) + Math.abs(x.de.length - w.de.length) * 0.3 + (x.de[0]?.toLowerCase() === w.de[0]?.toLowerCase() ? 0 : 0.8) }))
    .sort((a, b) => a.d - b.d);
  for (const x of near) {
    if (!out.includes(x.de)) out.push(x.de);
    if (out.length >= n) break;
  }
  return out.length >= n ? shuffle(rng, out) : [...out, ...distractors(rng, w, 'de', n - out.length)];
}

/** Moves on the bar. 0.4: no sentence button (the whole sentence is the finisher); 铭刻 / 齐鸣 change the next question.
 *  2026-11-22 (Lucas, 精简出手按钮): 低语 is no longer a move on the bar but a hint taken after the question is shown (canHint). */
export function availableMoves(s: GameState, b: Battle, alive = 1, mates = alive - 1): Move[] {
  if (b.tutorial === 'loss') return ['attack'];
  if (b.verify && !b.verifyDone) return ['attack']; // 斩杀: the verification question comes first, no 低语
  const moves: Move[] = ['attack'];
  if (has(s.level, 'inscribe')) moves.push('inscribe');
  if (has(s.level, 'chorus') && alive > 1 && mates > 0) moves.push('chorus');
  if (has(s.level, 'sentence')) moves.push('sentence');
  if (combatSkills(s).length && !b.tutorial) moves.push('skill');
  return moves;
}

/** 低语 is unlocked and allowed in this fight (not in the loss tutorial, not on the 斩杀 verification question). */
function hintOpen(s: GameState, b: Battle): boolean {
  return has(s.level, 'whisper') && b.tutorial !== 'loss' && !(b.verify && !b.verifyDone);
}

/** 低语 as a hint (2026-11-22): after seeing a normal attack's question, before answering. Same costs as before
 *  (not 会写, no resource, one armor tier lower, never the 归名 blow, the word is flagged). Not on 铭刻 / 齐鸣 /
 *  finisher / skill questions, and only once per question. */
export function canHint(s: GameState, b: Battle, move: Move, q: Question | null): boolean {
  if (!q || move !== 'attack' || q.whispered || q.inscribed || q.chorus || !q.answer || q.item || q.review) return false;
  if (count(s, 'hint') <= 0) return false; // 物品栏: each 低语 uses a 纸条
  if (q.type === 'sentence' || q.type === 'skill' || q.type === 'storm' || q.type === 'steady' || q.ult || q.echo) return false;
  return hintOpen(s, b) && moveReady(s, b, 'whisper');
}

/** The placeholder question of a 药片 turn (物品栏): nothing is asked. */
/** 终极技能最终形态 (97, 游戏设计 六). */
export const ULT97 = { from: 97, full: 3, target: 1.5, sweep: 0.5 };

/** Two hint words for 提示词造句: learned (归名 or written) words other than the target, in Chinese. */
export function ult97Hints(s: GameState, w: Word, rng: Rng): string[] {
  const pool = Object.entries(s.words)
    .filter(([id, p]) => id !== w.id && WORD_BY_ID[id] && WORD_BY_ID[id].pos !== 'phr' && !WORD_BY_ID[id].digit && (p.stage === 3 || (p.write ?? 0) > 0))
    .map(([id]) => id);
  const out: string[] = [];
  while (out.length < 2 && pool.length) out.push(...pool.splice(Math.floor(rng() * pool.length), 1));
  return out;
}

export const ITEM_TURN: Question = { type: 'steady', prompt: '吃药片', focus: '', item: true };
/** 即时战: the placeholder for a cast bar running out. */
export const TICK_TURN: Question = { type: 'steady', prompt: '', focus: '', item: true, tick: true };

/** The hinted version of a question (choice: one wrong option removed; typed: the first letter). */
export function hintOf(b: Battle, q: Question): Question {
  return whisperOf(q, b.word);
}

/** Whether a move can be used right now (cooldown, resource). */
export function moveReady(s: GameState, b: Battle, move: Move): boolean {
  if (move === 'skill') return combatSkills(s).some((id) => poolReady(s, b, id));
  if (move === 'inscribe') return !b.cfx.inscribeCd;
  // 低语 is free, but a word you were hinted on is asked again without it first.
  if (move === 'whisper') return b.curse !== 'forget' && !b.hinted && !s.words[b.word.id]?.hinted;
  if (move === 'sentence') return resMax(s) > 0 && b.cfx.res >= resMax(s);
  if (move === 'chorus') return b.chorusCd === 0;
  return true;
}

/** 技能池: this skill is off cooldown and can target this monster's word. */
export function poolReady(s: GameState, b: Battle, id: PoolId): boolean {
  return combatSkills(s).includes(id) && !(b.poolCd[id] ?? 0) && canTarget(id, b.word) && !b.phrase;
}

/** Share of a hit this monster's armor stops, for the given question tier (0.4 战斗修正版):
 *  A = 2^(monster level − your level) × (1 − gear penetration), halved for typed questions, 0 for hard ones
 *  or while broken; the hit is divided by (1 + A), i.e. A / (1 + A) is stopped (at most 90%). */
/** 词性三相: the stance that hits this monster's weak point (null for words without an article). */
export function phaseOf(b: Battle): Stance | null {
  if (b.perfekt) return b.perfektRest ? null : PERFEKT[b.word.de].aux;
  if (!b.word.art) return null;
  if (b.pluralMon) return 'die';
  // 格位姿态 (Lv7+): the article its line's slot needs; otherwise (no usable line) the name's own der/die/das.
  return (b.intent?.caseArt as Stance | undefined) ?? b.word.art;
}

/** 同格同性都算对 (0.6.x, Lucas 2026-11-22): on a stance from the line's slot, the definite and the indefinite
 *  article of the same case and gender both land (den or einen, das or ein); the stance tests case and gender,
 *  not definite vs indefinite. A stance from the name alone, plural monsters and Perfekt stay exact. */
export function phasePair(b: Battle): Stance[] {
  const ph = phaseOf(b);
  if (!ph) return [];
  if (b.perfekt || b.pluralMon || !b.intent?.caseArt || ph.startsWith('kein')) return [ph];
  const g = genderOf(b.word);
  const c = phaseCase(b);
  if (!g) return [ph];
  const T: Record<Case, Record<'m' | 'f' | 'n' | 'pl', Stance[]>> = {
    nom: { m: ['der', 'ein'], f: ['die', 'eine'], n: ['das', 'ein'], pl: ['die'] },
    acc: { m: ['den', 'einen'], f: ['die', 'eine'], n: ['das', 'ein'], pl: ['die'] },
    dat: { m: ['dem', 'einem'], f: ['der', 'einer'], n: ['dem', 'einem'], pl: ['den'] },
  };
  const pair = T[c][g];
  return pair.includes(ph) ? pair : [ph];
}

/** Masculine: der/ein is only nominative. */
function g2(b: Battle): boolean {
  return genderOf(b.word) === 'm';
}

export function phaseRight(b: Battle, p: Stance | undefined = b.phase): boolean {
  return !!p && phasePair(b).includes(p);
}

/** 选错相时的说明 (0.6.x): a stance from the line's slot says the noun's own article and the form the slot needs,
 *  so a right der/die/das is not read as wrong; a stance from the name alone keeps the answer hidden. */
export function phaseWrongWhy(b: Battle): string {
  const ph = phaseOf(b);
  if (b.perfekt) return `${b.word.de} 的完成时不用 ${b.phase}`;
  if (!ph || !b.intent?.caseArt || b.pluralMon) return b.pluralMon ? '复数一律 die' : `它不是 ${b.phase ?? '这个'} 词`;
  const c = phaseCase(b);
  // Neuter/feminine forms look the same in nom and acc, so only a form that shows its case names it.
  const why = [ph.startsWith('kein') ? '否定 kein' : ph.startsWith('ein') ? '不定冠词' : '定冠词', ...(c === 'acc' ? ['第四格'] : c === 'dat' ? ['第三格'] : [])].join('，');
  const pair = phasePair(b);
  if (pair.length > 1) {
    const cz = c === 'acc' ? '第四格' : c === 'dat' ? '第三格' : g2(b) ? '第一格' : '';
    // Neuter/feminine nom and acc look the same: no case named (docs 0.6.x).
    return `${b.phase === b.word.art ? '没错，' : ''}${b.word.de} 是 ${b.word.art} 词，${cz ? `但这句的空要${cz}：` : '这句的空填 '}${pair.join(' 或 ')}`;
  }
  return `${b.phase === b.word.art ? '没错，' : ''}${b.word.de} 是 ${b.word.art} 词，但这句的空要填 ${ph}（${why}）`;
}

/** The case the right stance stands for (nom when it comes from the name alone). */
export function phaseCase(b: Battle): Case {
  if (!b.intent?.caseArt || b.pluralMon || b.perfekt) return 'nom';
  return caseOf(genderOf(b.word), b.intent.caseArt) ?? 'nom';
}

/** Which cases this level reads from the line: accusative from Lv7, dative from Lv15. */
export function casesOpen(level: number): Case[] {
  return ['nom', ...(level >= CONFIG.phase.accFrom ? (['acc'] as Case[]) : []), ...(level >= CONFIG.phase.datFrom ? (['dat'] as Case[]) : [])];
}

/** Stance buttons for this level: der/die/das; from Lv7 also den and ein/eine/einen; from Lv15 dem/einem/einer. */
export function stancesFor(level: number, b?: Battle): Stance[] {
  if (b?.perfekt) return ['haben', 'sein'];
  const out: Stance[] = ['der', 'die', 'das'];
  if (level >= CONFIG.phase.accFrom) out.push('den', 'ein', 'eine', 'einen');
  if (level >= CONFIG.phase.datFrom) out.push('dem', 'einem', 'einer');
  // kein stance (Lucas 2026-11-25): a line that needs kein swaps the ein buttons for kein ones, same keys.
  if (b?.intent?.caseArt?.startsWith('kein') && !b.pluralMon) {
    const swap: Partial<Record<Stance, Stance>> = { ein: 'kein', eine: 'keine', einen: 'keinen', einem: 'keinem', einer: 'keiner' };
    return out.map((x) => swap[x] ?? x);
  }
  return out;
}

/** Whether attacks on this monster need a stance (every noun outside the scripted tutorial fights). */
export function needsPhase(b: Battle): boolean {
  return !!phaseOf(b) && (!b.tutorial || b.tutorial === 'packCharge');
}

/** 先教后考: a noun you have never met (not in your word book) gets the right stance picked and shown on its
 *  first turn, so the first der/die/das is learned, not guessed. From the next turn the pick is cleared once and the
 *  player chooses it. Returns true while the stance shown is the taught one. */
export function teachPhase(b: Battle): boolean {
  if (b.phaseTaught) {
    if (b.turn === b.phaseTaught) return b.phase === phaseOf(b);
    if (b.turn > b.phaseTaught && b.phaseTaught > 0) (b.phase = undefined), (b.phaseTaught = -1);
    return false;
  }
  if (!needsPhase(b) || b.phase || b.kind !== 'new' || b.stage !== 0 || b.pluralMon) return false;
  b.phase = phaseOf(b)!;
  b.phaseTaught = b.turn;
  return true;
}

/** 读音攻击 (0.5, Lv5+ with 跟读): a never-met word, before its first right answer, may be read aloud as a sure hit.
 *  Returns what to read (nouns with their article), or null when not offered. */
export function readTarget(s: GameState, b: Battle): string | null {
  if (!has(s.level, 'shadowing') || b.curse === 'silence' || b.kind !== 'new' || b.stage !== 0 || b.firstCorrectDone || b.step !== 0) return null;
  if (b.tutorial || b.pluralMon || b.phrase || b.trial) return null;
  return b.word.art ? fullForm(b.word) : b.word.de;
}

/** What the read-aloud button shows and says (0.6.x): the bare noun, so the article is not given away before it is
 *  judged; only on the 先教后考 turn (stance already picked for you) the full form. */
export function readShown(b: Battle, target: string): string {
  if (!b.word.art || target !== fullForm(b.word)) return target;
  return b.phaseTaught && b.phaseTaught === b.turn && b.phase === phaseOf(b) ? target : b.word.de;
}

/** 读音攻击 on a word you have met (Lv5+): say it from its Chinese, nothing German on screen. Heard close enough →
 *  a 低语 hit (one armor tier lower, not 会写, no resource, never the 归名 blow; same per-word lock as 低语). */
export function readRecall(s: GameState, b: Battle): string | null {
  if (!has(s.level, 'shadowing') || b.curse === 'silence' || readTarget(s, b) || b.tutorial || b.pluralMon || b.phrase || b.trial) return null;
  if (!hintOpen(s, b) || !moveReady(s, b, 'whisper')) return null;
  return b.word.art ? fullForm(b.word) : b.word.de;
}

/** What the monster card may show: its plural crowd name or the word, never the article. */
export function shownDe(b: Battle): string {
  return b.pluralMon ? b.word.pl! : b.word.de;
}

/** 相亲和: the amulet's affinity is the monster's own gender (plural = die; a case change still counts the name's
 *  der/die/das) and the stance is right. Wrong-stance turns get nothing. */
export function affinityMatch(s: GameState, b: Battle): boolean {
  const aff = affinityOf(s);
  if (!aff || !b.word.art || !b.phase || !phaseRight(b)) return false;
  return (b.pluralMon ? 'die' : b.word.art) === aff;
}

export function effArmor(s: GameState, b: Battle, tier: 0 | 1 | 2, factor = 1): number {
  const C = CONFIG.armor;
  if ((b.armorDown || (b.armorDownT ?? 0) > 0) && tier < 2) tier = (tier + 1) as 1 | 2;
  if (tier === 2 || b.monster.broken > 0) return 0;
  let a = Math.pow(C.base, b.monster.lvl - s.level) * Math.max(0, 1 - gearPen(s) - affixTotal(s, 'pen')) * factor;
  if (tier === 1) a *= C.typedFactor;
  return Math.min(C.maxReduction, a / (1 + a));
}

/** Chinese for a whole-sentence finisher (看中文写整句). */
const SENTENCE_ZH: Record<Pattern, (zh: string) => string> = {
  moechte: (z) => `我想要一个${z}。`,
  brauche: (z) => `我需要一个${z}。`,
  nehme: (z) => `我要一个${z}。（买东西）`,
  moechte0: (z) => `我想要${z}。`,
  brauche0: (z) => `我需要${z}。`,
  woist: (z) => `${z}在哪儿？`,
  suche: (z) => `我在找那个${z}。`,
  habe: (z) => `我有一个${z}。`,
  mein: (z) => `这是我的${z}。`,
  sind: (z) => `这是我的${z}。（复数）`,
};

/** 语境复习 (2026-11-24): from the 2nd turn of an ordinary field fight, at most once per fight, a due 归名 word's
 *  example sentence with that word blanked (nouns with the declined article, verbs conjugated), typed. Words
 *  without an example sentence are asked as 看中文写 instead. */
export function contextQuestion(s: GameState, b: Battle, rng: Rng): Question | null {
  if (b.fx.ctxAsked || b.turn < 2 || b.tutorial || b.verify || b.elite || b.trial || b.phrase || b.isEcho || (b.saying && !b.sayingDone)) return null;
  if (!has(s.level, 'typing')) return null;
  const due = contextDueWords(s).find((x) => x !== b.word.id && WORD_BY_ID[x]);
  // 入学测试: with no review due, one 推定会 word is spot-checked instead.
  const id = due ?? placedPick(s, rng, b.word.id);
  if (!id || !WORD_BY_ID[id]) return null;
  const rw = WORD_BY_ID[id];
  // 审查修订: 复习伙伴 is the skin of 语境复习 — your partner word brings the due word's question.
  const pw = due ? partnerOf(s) : null;
  const tag = due ? (pw ? `复习伙伴 ${fullForm(pw)} · 语境复习` : '语境复习') : '抽查（入学测试推定你会）';
  const c = makeCloze(rw, 'form', rng);
  if (c) return { type: 'cloze', review: id, prompt: `${tag}：打出这里要的形式（名词带冠词，动词变位）· ${c.zh}`, focus: c.shown, answer: c.answer, clozeMode: 'form', full: c.full, clozeZh: c.zh };
  return { type: 'typed', review: id, prompt: `${tag}：${hasArticleQuestion(rw) ? '默写，带上冠词' : '默写这个词'}`, focus: zhWithPos(rw), withArticle: hasArticleQuestion(rw), answer: fullForm(rw) };
}

/** One whole example sentence of the word (for 「听整句选意思」), or null. */
function exampleOf(w: Word, rng: Rng): string | null {
  const ps = (EXAMPLES[w.id] ?? []).map(parse).filter((x): x is NonNullable<typeof x> => !!x);
  if (!ps.length) return null;
  const p = pick(rng, ps);
  return `${p.before}${p.blank}${p.after}`.replace(/\s+/g, ' ').trim();
}

/** 造句 (场景精英 ③): write a short sentence of your own with the word. `answer` is only the word, for 低语 and notes. */
function composeQ(w: Word): Question {
  const name = w.art ? `${w.art} ${w.de}` : w.de;
  // 审查修订「题面露词」: the word is given in Chinese only, or writing it would prove nothing.
  return { type: 'cloze', write: 'compose', prompt: `造句：用「${w.zh}」这个词写一句你自己的短句（德语${w.art ? '，名词带冠词' : ''}）`, focus: w.zh, answer: name };
}

/** 句中默写 (练中学, rev 425): the word's slot blanked in one of its examples, the whole Chinese given, no letters.
 *  Nouns only from slots that carry the article (einen Tee), so the answer shows the article and case. */
export function dictQ(w: Word, rng: Rng): Question | null {
  const noun = hasArticleQuestion(w);
  const ps = (EXAMPLES[w.id] ?? [])
    .map(parse)
    .filter((x): x is NonNullable<typeof x> => !!x && !!x.zh)
    .filter((x) => (noun ? ARTICLE_RE.test(`${x.blank} `) : true))
    .filter((x) => !showsWord(w, `${x.before} ${x.after}`));
  if (!ps.length) return null;
  const p = pick(rng, ps);
  // The dictionary form in its sentence (das Brot, kaufen) is a typed question; a changed form (einen Tee, kaufst) is 填变形.
  const same = normalize(p.blank) === normalize(fullForm(w)) || normalize(p.blank) === normalize(w.de);
  return {
    type: 'cloze',
    clozeMode: same ? 'base' : 'form',
    dict: true,
    prompt: `句中默写：看整句中文，打出空里的词${noun ? '（带冠词，按句子变格）' : '（按句子变形）'} · ${p.zh}`,
    focus: `${p.before}___${p.after}`.replace(/\s+/g, ' ').trim(),
    answer: p.blank,
    full: `${p.before}${p.blank}${p.after}`.replace(/\s+/g, ' ').trim(),
    clozeZh: p.zh,
  };
}

/** 审查修订: sentences already shown in this fight (the monster's lines, sentences shown after answers). Until every
 *  word has 3 examples, these are not reused for a writing question. Set by makeQuestion, read by clozeQ. */
let seenNow: Set<string> = new Set();
const lineKey = (x: string) => x.replace(/\s+/g, ' ').replace(/[.!?…]+$/, '').trim().toLowerCase();

export function makeQuestion(s: GameState, b: Battle, move: Move, rng: Rng, skillId?: string, inPack = false, mates: Battle[] = []): Question {
  const w = b.word;
  b.seenLines ??= [];
  for (const x of [b.intent?.line, b.intent?.full]) if (x && !b.seenLines.includes(lineKey(x))) b.seenLines.push(lineKey(x));
  seenNow = new Set(b.seenLines);
  const isNoun = hasArticleQuestion(w);
  const canType = has(s.level, 'typing');
  const promptZh = w.digit ? w.digit : w.zh;

  if (move === 'attack') {
    const rq = contextQuestion(s, b, rng);
    if (rq) return rq;
  }
  const articleQ = (): Question => ({
    type: 'article',
    prompt: '选对冠词',
    focus: w.de,
    options: ['der', 'die', 'das'],
    answer: w.art!,
  });
  // 词性三相 (0.5): the stance is the article question now, so the old one only survives in scripted tutorials.
  const article = (): Question => (needsPhase(b) ? pickDe() : articleQ());
  const pickDe = (): Question => {
    const opts = shuffle(rng, [w.de, ...distractors(rng, w, 'de', 2)]);
    return { type: 'pickDe', prompt: '选出对应的德语', focus: promptZh, options: opts, answer: w.de };
  };
  const pickZh = (): Question => {
    const opts = shuffle(rng, [w.zh, ...distractors(rng, w, 'zh', 2)]);
    // 练中学 (rev 425): 认 = hear the whole sentence and pick what the word means.
    const ex = exampleOf(w, rng);
    return { type: 'pickZh', prompt: ex ? `听整句，选出 ${fullForm(w)} 的意思：「${ex}」` : '它在说什么？选出意思', focus: fullForm(w), options: opts, answer: w.zh };
  };
  // 审查 C3 (Lucas 11-26「按推荐」): the name plate already shows the meaning, so 「选中文意思」 is only the
  // first-meeting teaching round. A word met before hears the whole sentence and picks the German word instead.
  const listenDe = (): Question => {
    const ex = exampleOf(w, rng);
    if (!ex) return pickDe();
    const opts = shuffle(rng, [w.de, ...soundAlikes(rng, w, 2)]);
    return { type: 'pickDe', prompt: '听整句，选出你听到的那个词', focus: '🔊 …', listen: ex, full: ex, options: opts, answer: w.de };
  };
  // Words met before go to 句中默写 when typing is open; the listening choice is only a bridge before that.
  const meaning = (): Question => (b.kind === 'new' && b.stage === 0 ? pickZh() : (canType && hasExamples(w) ? clozeQ(s, w, rng) : null) ?? listenDe());
  // 练中学 (rev 425): 写 = 句中默写 (the word blanked in its example, the whole Chinese given, no letters);
  // plain 看中文写 only for words without an example.
  const typed = (): Question => dictQ(w, rng) ?? bareTyped();
  const bareTyped = (): Question => ({
    type: 'typed',
    prompt: isNoun ? '默写：带上冠词（der / die / das）' : '默写这个词',
    focus: zhWithPos(w),
    withArticle: isNoun,
    answer: fullForm(w),
  });

  // 点名 (packs): an attack on a monster whose article you haven't called yet = shout its article.
  const callout = (): Question => ({
    type: 'callout',
    prompt: '点名：喊出你盯住的那只怪的冠词',
    focus: w.de,
    options: ['der', 'die', 'das'],
    answer: w.art!,
  });
  const conj = (): Question => {
    const c = CONJ[w.de];
    // Strong verbs: ask the forms that change (du, er) more often.
    const pool: Person[] = c.strong ? ['du', 'du', 'er', 'er', 'ich', 'wir', 'ihr', 'sie'] : ['ich', 'du', 'er', 'wir', 'ihr', 'sie'];
    const person = pick(rng, pool);
    return { type: 'conj', prompt: `写出变位：${PERSON_LABEL[person]} ___（${w.de}）`, focus: `${person === 'er' ? 'er' : person === 'sie' ? 'sie' : person} … (${w.de})`, answer: c.forms[person], person, alts: c.alt?.[person] };
  };
  const plural = (): Question => ({ type: 'plural', prompt: '写出复数（带 die）', focus: `${fullForm(w)} → die …`, answer: w.pl! });
  // 终结技 (0.4): read the Chinese, write the whole sentence with this monster's noun.
  const sentenceQ = (): Question | null => {
    const pat = sentencePattern(s, b);
    if (!pat) return null;
    const extra = pat === 'nehme' ? '（也可以 zwei + 复数）' : '';
    return { type: 'sentence', prompt: `终结技：看中文，写整句${extra}`, focus: SENTENCE_ZH[pat](w.digit ?? w.zh), pattern: pat, answer: expectedSentence(w, pat) };
  };
  // A1 写作 (2026-11-22): some cloze slots become 排句 or 槽位造句 once open (not on a word's very first questions).
  const writeQ = (): Question | null => {
    if (!canType || b.tutorial || b.trial || fresh) return null;
    if (has(s.level, 'slot') && isNoun && rng() < WRITE_CHANCE.slot) {
      const t = slotTask(w, rng);
      if (t) return { type: 'cloze', write: 'slot', slot: t, prompt: `槽位造句：它问「${t.ask}」（${t.askZh}）用眼前这只怪的词回答，冠词和格要对`, focus: `${t.ask}  →  ${t.frame}`, answer: t.answer };
    }
    if (has(s.level, 'wordOrder') && rng() < WRITE_CHANCE.order) {
      const t = orderTask(w, rng);
      if (t) return { type: 'cloze', write: 'order', prompt: `排句：把词块排成一句，打出整句（大写的那块在句首）· ${t.zh}`, focus: t.shown.join('  /  '), answer: t.answer, full: t.answer };
    }
    return null;
  };
  const canConj = w.pos === 'v' && conjOpen(s, w);
  /** One step harder than q, or null when nothing harder fits. */
  const harder = (q: Question): Question | null => {
    const t = qTier(q);
    if (t === 2 || !canType) return null;
    if (t === 0) {
      if (q.type === 'cloze') return clozeQ(s, w, rng, s.level >= 11 ? 'form' : 'base') ?? typed();
      return canConj ? conj() : typed();
    }
    if (b.perfekt && ppOpen(s.level, w)) return ppQ(w);
    const form = s.level >= 11 && hasExamples(w) ? clozeQ(s, w, rng, 'form') : null;
    return (form && form.clozeMode === 'form' ? form : null) ?? sentenceQ();
  };
  if (move === 'skill') {
    // 技能池 (游戏设计 十): every skill asks a layer of the target's own word that the plain attack doesn't.
    const id = ((skillId as PoolId) && POOL[skillId as PoolId] ? skillId : combatSkills(s).find((x) => poolReady(s, b, x)) ?? 'storm') as PoolId;
    const sk = POOL[id];
    if (id === 'steady') {
      // 天赋「稳固」: this monster's typed question instead of a choice; right → 3 covered misses.
      if (rank(s, 'wengu')) return { ...bareTyped(), type: 'steady', pool: id, prompt: `稳住（稳固）：默写${isNoun ? '（带冠词）' : ''}。答对，接下来 3 次答错不扣血、不断连击（答错只保 1 次）` };
      if (isNoun && rng() < 0.5) return { type: 'steady', pool: id, prompt: '稳住：选对它的冠词。答对，接下来 2 次答错不扣血、不断连击（答错只保 1 次）', focus: zhWithPos(w), options: ['der', 'die', 'das'], answer: w.art! };
      const opts = shuffle(rng, [w.zh, ...distractors(rng, w, 'zh', 2)]);
      return { type: 'steady', pool: id, prompt: '稳住：选出它的意思。答对，接下来 2 次答错不扣血、不断连击（答错只保 1 次）', focus: fullForm(w), options: opts, answer: w.zh };
    }
    if (id === 'split') {
      const t = splitOf(w)!;
      return { type: 'typed', pool: id, split: t, prompt: t.prompt, focus: zhWithPos(w), answer: t.answer };
    }
    if (id === 'colloc') {
      const c = collocOf(w)!;
      const shown = c.ex.replace(new RegExp(`\\b${c.prep}\\b`, 'i'), '___');
      return { type: 'typed', pool: id, prompt: `搭配：${c.combo.split(' ')[0]} 后面跟哪个介词？（${c.zh}）`, focus: `${shown}\n（${c.exZh}）`, answer: c.prep };
    }
    if (id === 'seal') {
      // 格之封印: the word put into a short sentence that needs a case or person form.
      const form = hasExamples(w) ? clozeQ(s, w, rng, 'form') : null;
      const q = form && form.clozeMode === 'form' ? form : w.pos === 'v' && conjOpen(s, w) ? conj() : form;
      if (q) return { ...q, pool: id, prompt: `格之封印：${q.prompt}（写对，它 ${SEAL_TURNS} 回合内蓄不了力）` };
      return { ...bareTyped(), pool: id, prompt: `格之封印：默写${isNoun ? '（带冠词）' : ''}（写对，它 ${SEAL_TURNS} 回合内蓄不了力）` };
    }
    if (id === 'dictate') {
      const d = dictQ(w, rng);
      if (d) return { ...d, pool: id, listen: d.full, clozeZh: undefined, prompt: '听写：听它喊出的句子，打出被挖掉的词（不给中文）', focus: (d.focus ?? '').split('\n')[0] };
      return { ...bareTyped(), pool: id, listen: w.de, prompt: '听写：听它喊出的词，打出来' };
    }
    void sk;
    const forms = stormForms(s.level, w, w.pos === 'v' && conjOpen(s, w));
    return { type: 'storm', pool: 'storm', prompt: `墨水风暴：连写这只怪的词的 ${forms.length} 种形式，写错一个就停（每写对一个伤害 +50%）`, focus: zhWithPos(w), boxes: forms.map((f) => f.label), forms, answer: forms.map((f) => f.answer).join(' · '), word: w };
  }
  // 格位连锁: the same noun in another case.
  if (b.chainOffer && move === 'attack') {
    const c = chainQ(s, b, rng);
    if (c) return c;
    b.chainOffer = false;
  }
  // 直接叫名 (Lucas 2026-11-25): plain dictation, no hint, nouns with the article.
  if (b.direct && move === 'attack') return { ...bareTyped(), directName: true, prompt: `直接叫名：不看提示写出它${isNoun ? '（带冠词）' : ''}。写对直接斩杀，写错照常学、不罚` };
  // 斩杀 (0.6.x): a verification fight opens with typing, no hint (nouns with the article).
  if (b.verify && !b.verifyDone && move === 'attack') {
    const v = typed();
    return { ...v, prompt: `${b.verify === 'recheck' ? '回响抽查' : '你昨天会写它'}——不看提示再写一次${isNoun ? '（带冠词）' : ''}${v.clozeZh ? ` · ${v.clozeZh}` : ''}` };
  }
  // 复习怪 (rev 425): its first question is the 句中默写; right brings it straight back to 归名.
  if (b.reviewMon && b.qIndex === 0 && move === 'attack' && canType && !b.tutorial) {
    const v = dictQ(w, rng);
    if (v) return { ...v, prompt: v.prompt.replace('句中默写', '复习怪 · 句中默写（写对直接回到归名）') };
  }
  // 挑战怪 (rev 342): it opens with a dictation, no hint — know it and you can cut it today.
  if (b.challenge && b.qIndex === 0 && move === 'attack' && canType) {
    const v = typed();
    return { ...v, prompt: `挑战怪：比你高两级的词——看中文，不看提示直接写${isNoun ? '（带冠词）' : ''}${v.clozeZh ? ` · ${v.clozeZh}` : ''}` };
  }
  const fresh = b.kind === 'new' && b.stage === 0 && b.step < 2;
  const am: Move = move === 'inscribe' || move === 'whisper' || move === 'chorus' ? 'attack' : move;

  // 残句 (0.5): three steps whatever the move — finish the half, pick its meaning, write it whole.
  if (b.phrase) {
    const x = b.phrase;
    const st = b.phraseStep ?? 0;
    let pq: Question;
    if (st === 0) {
      pq = sayingQuestion(s, { ...x, cardId: undefined }, rng);
      pq = { ...pq, prompt: pq.prompt.replace('接句怪：', '残句 1/3：').replace('（答对必暴击）', '') };
    }
    else if (st === 1) {
      const others = shuffle(rng, SAYINGS.filter((o) => o.zh !== x.zh).map((o) => o.zh)).slice(0, 2);
      pq = { type: 'pickZh', prompt: '残句 2/3：它把整句喊出来了，选出意思', focus: `${x.a} ${x.b}`, options: shuffle(rng, [x.zh, ...others]), answer: x.zh };
    } else pq = { type: 'sentence', prompt: '残句 3/3：看中文，写出整句', focus: x.zh, answer: `${x.a} ${x.b}` };
    if (move === 'inscribe') pq = { ...pq, inscribed: true };
    if (move === 'whisper') pq = whisperOf(pq, w);
    return pq;
  }

  // 终结技 (0.4): spends a full resource bar on the whole sentence. Every monster has one: its sentence pattern
  // when the word is in your wordbook, otherwise one of its example sentences (or a template).
  if (move === 'sentence') {
    const fin = sentenceQ();
    // und (0.5, Lv13+): in a pack the finisher can name a second monster with und, and hits both.
    const UND: Pattern[] = ['moechte', 'brauche', 'suche', 'habe', 'nehme'];
    // 终极技能 (30 级, 句型填空版): the first finisher of a fight gives the frame and two blanks: this monster
    // and another noun from your wordbook that fits the same pattern.
    // 97: 提示词造句 (logged in only: the AI judges the meaning; without it the cloze version stays).
    if (s.level >= ULT97.from && !b.ultUsed && s.owner) {
      const hints = ult97Hints(s, w, rng);
      if (hints.length === 2) {
        const hz = hints.map((id) => `「${WORD_BY_ID[id].zh}」`).join('');
        return {
          type: 'sentence',
          prompt: `终极技能 · 提示词造句：用上它的词和两个提示词${hz}造一句。全用上且没错 ×${ULT97.full}，还横扫场上每只怪；只用上它的词 ×${ULT97.target}`,
          focus: `${plateZh(w)} + ${hints.map((id) => WORD_BY_ID[id].zh).join(' + ')}`,
          answer: '',
          ult: [],
          prompt97: { hints },
        };
      }
    }
    if (fin && fin.pattern && PATTERNS[fin.pattern].art !== 'none' && has(s.level, 'ultimate') && !b.ultUsed) {
      const pat = fin.pattern;
      const known = WORDS.filter((x) => x.id !== w.id && !!x.art && !!s.words[x.id] && sentenceTags(x).includes(pat));
      if (known.length) {
        const mate = pick(rng, known);
        const P = PATTERNS[pat];
        const objOf = (x: Word) => expectedSentence(x, pat).slice(P.lead.length + 1).replace(/[.?]$/, '');
        const end = P.q ? '?' : '.';
        return {
          type: 'sentence',
          prompt: '终极技能 · 句型填空：两个空都填对 ×3，对一个 ×1.5（带冠词）',
          focus: `${SENTENCE_ZH[pat](w.digit ?? w.zh).replace(/[。？]$/, '')}，还有${mate.zh}。`,
          frame: `${P.lead} ___ und ___${end}`,
          pattern: pat,
          ult: [objOf(w), objOf(mate)],
          answer: `${P.lead} ${objOf(w)} und ${objOf(mate)}${end}`,
        };
      }
    }
    if (has(s.level, 'ultimate') && !b.ultUsed) {
      const two = twoBlank(w, rng, (x) => !!s.words[x.id]);
      if (two) return { type: 'sentence', prompt: '终极技能 · 句型填空：两个空都填对 ×3，对一个 ×1.5', focus: two.zh, frame: two.frame, ult: two.blanks, answer: two.full };
    }
    if (fin && fin.pattern && UND.includes(fin.pattern) && has(s.level, 'und')) {
      const mate = mates.find((o) => o !== b && !o.outcome && !!o.word.art && o.word.id !== w.id && sentenceTags(o.word).includes(fin.pattern!));
      if (mate) {
        const lead = PATTERNS[fin.pattern].lead;
        const objOf = (x: Word) => expectedSentence(x, fin.pattern!).slice(lead.length + 1).replace(/[.?]$/, '');
        return {
          ...fin,
          prompt: '终结技 · und：看中文，一句话说出两只怪，两只都挨打',
          focus: SENTENCE_ZH[fin.pattern](w.digit ?? w.zh).replace(/。.*$/, `，还有${fin.pattern === 'suche' ? '那个' : '一个'}${mate.word.zh}。`),
          answer: `${lead} ${objOf(w)} und ${objOf(mate.word)}.`,
          undWord: mate.word,
        };
      }
    }
    // 连句 (2026-11-22): now and then the finisher joins two short sentences (und / oder / aber / denn; weil / dass /
    // wenn later, verb to the end). Always the one answer, so the check is exact.
    if (has(s.level, 'link') && !b.tutorial && rng() < WRITE_CHANCE.link) {
      const r = linkTask(w, rng, has(s.level, 'linkSub'));
      if (r) {
        const tip = ['weil', 'dass', 'wenn'].includes(r.conj) ? '（动词放到句末）' : r.conj === 'aber' || r.conj === 'denn' ? '（前面加逗号）' : '';
        return { type: 'sentence', write: 'link', link: r, prompt: `终结技 · 连句：用 ${r.conj} 把两句连成一句${tip} · ${r.zh}`, focus: `${r.a}  +  ${r.b}`, answer: r.answer };
      }
    }
    if (fin) return fin;
    const ws = wholeSentence(w, rng);
    return { type: 'sentence', prompt: '终结技：看中文，写整句', focus: ws.zh, answer: ws.answer };
  }
  let q = ladderQ();
  // 难题就是预告 (0.4): a charging monster asks the hardest question (Lv11+ form cloze, before that typing);
  // a multi-hit one asks one step harder. A word you have never answered keeps its usual question.
  if (am === 'attack' && q.type !== 'saying' && q.type !== 'callout' && !q.echo && !b.tutorial && !fresh && canType) {
    if (b.intent.kind === 'charge') {
      const form = b.perfekt && ppOpen(s.level, w) ? ppQ(w) : s.level >= 11 && hasExamples(w) ? clozeQ(s, w, rng, 'form') : null;
      const hard = form?.clozeMode === 'form' ? form : qTier(q) === 0 ? (canConj ? conj() : typed()) : q;
      if (qTier(hard) > qTier(q)) q = hard;
    } else if (b.intent.kind === 'attack' && b.intent.hits > 1) q = harder(q) ?? q;
  }
  if (move === 'inscribe') q = { ...(q.echo ? q : harder(q) ?? q), inscribed: true };
  if (move === 'whisper') q = whisperOf(q, w);
  if (move === 'chorus') {
    // 点名齐鸣 (rev 234): after the target's answer, write each same-stance mate's own word (with the article).
    q = { ...q, chorus: true, mates: mates.length ? chorusMates(b, mates).map((o) => o.word.id) : undefined };
  }
  return q;

  function ladderQ(): Question {
  if (am === 'attack' && b.saying && !b.sayingDone && !inPack) return sayingQuestion(s, b.saying, rng);
  // 审查修订: once an extra-damage question has brought it to 1 HP, the last blow has to answer its own word.
  if (am === 'attack' && b.listenMon && !b.listenDone && !b.finishOwn) {
    const p = b.listenMon === 'passage' ? passageFor(w) : null;
    const line = b.listenMon === 'blind' ? blindLine(w, rng) : null;
    const t = p ? passageTask(p, rng) : line ? blindTask(w, line) : null;
    if (t) {
      b.replays = LISTEN.replays + (b.fx.charm?.replay ?? 0);
      return { ...gramQuestion(t), listen: t.full };
    }
  }
  if (am === 'attack' && b.notice && !b.finishOwn) {
    const n = noticeById(b.notice.id);
    if (n) return gramQuestion(noticeTask(n, b.notice.i, rng));
  }
  // 文章群怪: the word's own blow is its meaning, read from the article sentence (choice only).
  if (am === 'attack' && b.artCtx && b.kind === 'new') {
    return { type: 'pickZh', prompt: `文章群怪：按上下文推出 ${fullForm(w)} 的意思：「${b.artCtx}」`, focus: fullForm(w), options: shuffle(rng, [w.zh, ...distractors(rng, w, 'zh', 2)]), answer: w.zh };
  }
  if (am === 'attack' && b.mirror && !b.finishOwn) {
    const t = mirrorTask(w, rng, s.level);
    if (t) return gramQuestion(t, boardDue(s, t.sys));
  }
  if (am === 'attack' && b.gramDungeon) {
    const t = dungeonTask(s, b.gramDungeon.kind, b.gramDungeon.floor, w, rng, b.step);
    if (t) return gramQuestion(t, boardDue(s, t.sys));
  }
  // 场景精英: each part asks only its own layer. ① 认 choice questions; ② 用 cloze (conjugation for verbs,
  // typing when the word has no example); ③ 写 typing (conjugation for verbs).
  if (am === 'attack' && b.elite) {
    if (b.elite.seg === 0 || !canType) {
      const recog = (): Question => (b.kind === 'new' && b.stage === 0 ? pickZh() : listenDe());
      const rec: Array<() => Question> = isNoun ? [article, recog, pickDe] : [recog, pickDe];
      return rec[b.step % rec.length]();
    }
    if (b.elite.seg === 1) return (hasExamples(w) ? clozeQ(s, w, rng) : null) ?? (canConj ? conj() : typed());
    // ③ 写 (rev 425/459): a short sentence of your own with the word, every other attack; rule-checked here, and from
    // level 10 a logged-in player's sentence also goes to the AI teacher (the controller shows its note).
    if (b.step % 2 === 0) return composeQ(w);
    return canConj ? conj() : typed();
  }
  if (am === 'attack' && inPack && isNoun && !b.named && b.stage === 0 && !needsPhase(b)) return callout();
  // 防御 (Lv7+): a written answer breaks the guard. A word not yet at the typing step gets its usual choice question (×0.3).
  if (am === 'attack' && b.intent.kind === 'defend' && canType && (b.tutorial === 'break' || !(b.kind === 'new' && b.stage === 0 && b.step < 2))) {
    if (!isNoun && conjOpen(s, w)) return conj();
    return typed();
  }

  // Normal attack.
  if (b.tutorial === 'loss') return isNoun ? article() : meaning();
  // 半名 and due: the killing blow must be typed, so offer typing.
  if (b.stage === 2 && b.kind === 'due' && canType) return typed();
  // 回音怪 (2026-11-23): a word with a minimal-pair partner sometimes asks the pair instead (once per fight).
  if (am === 'attack' && b.pronMon) {
    const t = echoTask(s, w, rng, PRON_MON.cats);
    if (t) {
      const options = echoOptions(t, rng);
      return { type: 'pickDe', echo: t, prompt: `发音怪：${options.join(' 还是 ')}？`, focus: t.target, options, answer: t.target };
    }
  }
  if (am === 'attack' && has(s.level, 'pron') && !b.echoDone && !b.tutorial && !b.trial && !fresh && !b.pluralMon) {
    const t = echoTask(s, w, rng);
    if (t) {
      const options = echoOptions(t, rng);
      return { type: 'pickDe', echo: t, prompt: `回音怪：${options.join(' 还是 ')}？`, focus: t.target, options, answer: t.target };
    }
  }
  // 结构魔: every other attack question is the weil clause.
  if (am === 'attack' && b.structMon && b.qIndex % 2 === 0 && !b.finishOwn) {
    const t = structTasks(w);
    if (t.length) return gramQuestion(t[Math.floor(rng() * t.length)], null);
  }
  // B2 怪种: every other attack question is the monster's own kind.
  if (am === 'attack' && b.b2Mon && b.qIndex % 2 === 0) {
    const t = b2Task(s, w, rng, b.b2Mon);
    if (t) return gramQuestion(t, null);
  }
  // 语法线 (0.7–0.8): once a system is open, the word monster sometimes asks it on its own word (first time with its board).
  if (am === 'attack' && !fresh && !b.tutorial && !b.trial && !b.pluralMon && !b.verify && !b.gramDungeon && (b.stage >= 1 || b.kind !== 'new')) {
    const g = gramFor(s, w, rng, b.gramAsked ?? 0);
    if (g) return gramQuestion(g.task, g.board);
  }
  // Question ladder: each correct hit asks about another side of the word, never the same
  // question twice in a row (Lucas, playtest 2026-11-19: three der clicks in a row is boring).
  // New words: article → hear it and pick the meaning → type it (once typing is unlocked).
  // 完形填空: words with example sentences get the cloze into the ladder (Lucas 2026-11-20).
  // 介词空 (游戏设计 六, rev 707): takes about 1/5 (1/4 from 31) of the cloze slots when the word's own sentence has
  // an open preposition phrase.
  const prepQ = (): Question | null => {
    if (am !== 'attack' || fresh || b.tutorial || b.trial || !canType || (b.kind === 'new' && b.stage === 0)) return null;
    if (rng() >= (s.level >= PREP_CFG.highFrom ? PREP_CFG.shareHigh : PREP_CFG.shareLow)) return null;
    const t = prepBlankTask(s, w, rng, (full) => seenNow.has(lineKey(full)));
    return t ? gramQuestion(t, boardDue(s, t.sys)) : null;
  };
  const cl = hasExamples(w) || (isNoun && has(s.level, 'slot')) ? () => prepQ() ?? writeQ() ?? (hasExamples(w) ? clozeQ(s, w, rng) : null) ?? (isNoun ? article() : meaning()) : null;
  if (canConj) {
    const verbLadder = b.stage === 0 ? [meaning, cl ?? conj, conj, pickDe] : [conj, cl ?? pickDe, conj, meaning];
    return verbLadder[b.step % verbLadder.length]();
  }
  if (b.pluralDue && canType) {
    const pl = [plural, cl ?? typed, typed, article];
    return pl[b.step % pl.length]();
  }
  // Reviews from Lv6: never the old choice questions again; typing and cloze (form cloze from Lv11).
  if (b.kind === 'due' && canType && s.level >= 6) {
    const rv: Array<() => Question> = cl ? [cl, typed] : [typed];
    return rv[b.step % rv.length]();
  }
  if (cl) {
    // Lv6+: at least half the questions are cloze or typing; a plain choice only opens a new word.
    const lv6 = s.level >= 6;
    const ladder2: Array<() => Question> =
      b.stage === 0
        ? isNoun
          ? lv6 ? [article, cl, typed, cl] : [article, cl, meaning, cl]
          : lv6 ? [meaning, cl, typed, cl] : [meaning, cl, pickDe, cl]
        : lv6
          ? [cl, typed, cl, isNoun ? article : pickDe]
          : canType
            ? [cl, typed, isNoun ? article : pickDe]
            : [cl, isNoun ? article : pickDe];
    return ladder2[b.step % ladder2.length]();
  }
  const ladder: Array<() => Question> =
    b.stage === 0
      ? isNoun
        ? [article, meaning, ...(canType ? [typed] : []), pickDe]
        : [meaning, pickDe, ...(canType ? [typed] : [])]
      : isNoun
        ? canType
          ? [article, typed, pickDe]
          : [article, pickDe, meaning]
        : canType
          ? [pickDe, typed, meaning]
          : [pickDe, meaning];
  return ladder[b.step % ladder.length]();
  }
}

/** 低语: choice questions lose one wrong option, typed ones show the first letter. */
function whisperOf(q: Question, w: Word): Question {
  if (q.options && q.options.length > 2) {
    const wrong = q.options.find((o) => o !== q.answer)!;
    return { ...q, options: q.options.filter((o) => o !== wrong), whispered: true };
  }
  const a = q.answer ?? '';
  let hint = `${a[0] ?? ''}…`;
  if (q.write === 'order') hint = `${a.split(' ').slice(0, 2).join(' ')} …`;
  else if (q.write === 'compose') hint = `${a} …（随便一句，比如 Ich habe … / Das ist …）`;
  else if (q.write === 'slot' && q.slot) hint = `${PATTERNS[q.slot.pattern].lead} …（比如眼前这只怪）`;
  else if (q.write === 'link' && q.link) hint = `… ${q.link.conj} ${q.answer!.split(` ${q.link.conj} `)[1]?.split(' ')[0] ?? ''} …`;
  else if (q.type === 'sentence' && q.pattern) hint = `${PATTERNS[q.pattern].lead} …`;
  // 审查修订: only the word's first letter, never the article.
  else if (q.withArticle && w.art) hint = `${w.de[0]}…`;
  else if (q.type === 'cloze' && a.includes(' ')) hint = `${(a.split(' ').find((x) => !/^(der|die|das|den|dem|des|ein|eine|einen|einem|einer)$/i.test(x)) ?? a)[0]}…`;
  return { ...q, whisper: hint, whispered: true };
}

/** 完形填空 for this word at the player's level, or null when no sentence fits. */
export function clozeQ(s: GameState, w: Word, rng: Rng, mode: ClozeMode = clozeModeAt(s)): Question | null {
  // ihn / sie / es (0.5, Lv7+): now and then the cloze asks for the pronoun instead (counts as 填变形).
  if (s.level >= CONFIG.phase.accFrom && mode !== 'pick') {
    const pr = pronounClozes(w);
    if (pr.length && rng() < CONFIG.phase.pronounChance) {
      const p = pick(rng, pr);
      return { type: 'cloze', prompt: `代词：把名词换成 ihn / sie / es · ${p.zh}`, focus: p.shown, answer: p.answer, clozeMode: 'form', full: p.full };
    }
  }
  let c = makeCloze(w, mode, rng) ?? (mode === 'base' ? makeCloze(w, 'form', rng) : null);
  // Writing modes: not on a sentence this fight already showed (try a few, else no cloze here).
  if (mode !== 'pick') for (let i = 0; i < 4 && c && seenNow.has(lineKey(c.full)); i++) c = makeCloze(w, mode, rng);
  if (!c || (mode !== 'pick' && seenNow.has(lineKey(c.full)))) return null;
  const real: ClozeMode = mode === 'base' && c.answer !== w.de && !c.answer.endsWith(w.de) ? 'form' : mode;
  const tip = real === 'pick' ? '选出填进去的词' : real === 'base' ? '打出填进去的词' : '打出这里要的形式（带冠词、变位或复数）';
  return {
    type: 'cloze',
    prompt: `完形填空：${tip} · ${c.zh}`,
    focus: c.shown,
    answer: c.answer,
    options: real === 'pick' ? clozeOptions(w, c.answer, rng) : undefined,
    clozeMode: real,
    full: c.full,
    clozeZh: c.zh,
  };
}

/** 接句怪 (2026-11-21): always about this monster's own word. a = what it shouts, b = what you answer (contains the word). */
export interface SayLine {
  a: string;
  b: string;
  zh: string;
  /** Set when it is one of the 20 short sayings: a right answer drops its card. */
  cardId?: string;
}

const sayKey = (v: string) => normalize(v).replace(/\s+/g, ' ').trim();
const bareDe = (w: Word) => normalize(w.art ? w.de.replace(/^(der|die|das)\s+/i, '') : w.de).replace(/\s+/g, ' ').trim();
const hasWord = (text: string, w: Word) => ` ${sayKey(text)} `.includes(` ${bareDe(w)} `);

/** The 接句 line for this word: a short saying that contains it, else one of its example sentences split before it. */
export function sayLineFor(w: Word, rng: Rng): SayLine | undefined {
  const card = SAYINGS.filter((x) => hasWord(x.b, w));
  if (card.length) {
    const x = pick(rng, card);
    return { a: x.a, b: x.b, zh: x.zh, cardId: x.id };
  }
  const ex = exampleSplits(w).filter((p) => p.a.split(' ').length >= 2);
  return ex.length ? pick(rng, ex) : undefined;
}

/** 残句 (0.5): the short sayings no word monster carries — they drop only from sentence monsters. */
export function phraseCards(): typeof SAYINGS {
  return SAYINGS.filter((x) => !WORDS.some((w) => hasWord(x.b, w)));
}

/** The stand-in word of a 残句 (never enters the wordbook: ids start with say_). */
export function phraseWord(id: string, level: number, zone: Word['zone']): Word {
  const x = SAYINGS.find((y) => y.id === id)!;
  return { id: `say_${x.id}`, de: `${x.a} ${x.b}`, zh: x.zh, pos: 'phr', family: 'echo', lvl: level, zone };
}

export function isPhraseWord(w: Word): boolean {
  return w.id.startsWith('say_');
}

/** A fight against a 残句: same-level monster, its line is the half sentence. */
export function startPhraseBattle(s: GameState, id: string, rng: Rng, zone: Word['zone']): Battle {
  const x = SAYINGS.find((y) => y.id === id)!;
  const b = startBattle(s, phraseWord(id, s.level, zone), rng);
  b.phrase = { a: x.a, b: x.b, zh: x.zh, cardId: x.id };
  b.phraseStep = 0;
  b.pluralMon = false;
  b.intent = { ...b.intent, ...shoutLine(b.phrase) };
  return b;
}

/** 接句怪: the monster shouts the first half, you finish it (pick from three below Lv6, typed from Lv6). */
export function sayingQuestion(s: GameState, say: SayLine, rng: Rng): Question {
  const prompt = `接句怪：它喊出上半句，接上下半句（答对必暴击）· ${say.zh}`;
  const focus = `「${say.a} …」`;
  if (s.level >= SAYING_CFG.typedFrom) return { type: 'saying', prompt: prompt + '，打字', focus, answer: say.b, say };
  // Wrong endings come from other words' sentences, so the right one is the one that carries this word.
  const pool = say.cardId ? SAYINGS.map((o) => o.b) : Object.keys(EXAMPLES).flatMap((id) => (WORD_BY_ID[id] ? exampleSplits(WORD_BY_ID[id]).map((p) => p.b) : []));
  const others = shuffle(rng, pool.filter((o) => sayKey(o) !== sayKey(say.b))).slice(0, 2);
  return { type: 'saying', prompt, focus, options: shuffle(rng, [say.b, ...others]), answer: say.b, say };
}

/** Rolls whether a fresh one-on-one monster is a 接句怪 (Lv3+, about 1 in 8) — only when its word has a line. */
export function rollSaying(s: GameState, w: Word, rng: Rng): SayLine | undefined {
  if (s.level < SAYING_CFG.fromLevel || rng() >= SAYING_CFG.chance) return undefined;
  return sayLineFor(w, rng);
}


/** The sentence pattern the next 句式 on this monster uses: only for words in your wordbook, each pattern once per fight. */
export function sentencePattern(s: GameState, b: Battle): Pattern | null {
  if (!has(s.level, 'sentence') || !s.words[b.word.id]) return null;
  return nextPattern(b.word, b.sxUsed ?? 0);
}

/** A long word you have met (longest few of them), for 墨水风暴. Falls back to the target's word. */
export function stormWord(s: GameState, rng: Rng, fallback: Word): Word {
  const known = WORDS.filter((x) => s.words[x.id] && x.pos !== 'phr' && x.pos !== 'num' && !x.digit);
  const byLength = (xs: Word[]) => [...xs].sort((a, b) => letters(b) - letters(a));
  // 2026-11-21: words due within 12 hours or written wrong and seen in the last 3 days come first, so the
  // big attack doubles as review; fewer than 4 of them → topped up with the longest words you know.
  const t = now(s);
  const urgent = known.filter((x) => {
    const st = s.words[x.id];
    return (!st.retired && st.due <= t + 12 * HOUR) || (st.wrong > 0 && t - st.lastSeen <= 3 * DAY);
  });
  let pool = byLength(urgent).slice(0, 12);
  if (pool.length < 4) pool = [...pool, ...byLength(known.filter((x) => !pool.includes(x))).slice(0, 12 - pool.length)];
  return pool.length ? pick(rng, pool) : fallback;
}

export function letters(w: Word): number {
  return w.de.replace(/[^A-Za-zÄÖÜäöüß]/g, '').length;
}

/** 0.5: regular verbs are conjugated from Lv6, strong ones (nehmen → nimmt) from Lv12. */
export function conjOpen(s: GameState, w: Word): boolean {
  const c = CONJ[w.de];
  return !!c && has(s.level, 'conjugation') && (!c.strong || has(s.level, 'conjStrong'));
}

/** Region 2 (Lv11+): the sentence attack is 「Ich nehme …」, with plurals. */
export function nehmeRegion(s: GameState): boolean {
  return s.region === 2 && has(s.level, 'plural');
}

/** The class resource object kept on the save; 冷静 (calmUsed) is per fight. */
export function classFx(s: GameState): ClassFx {
  s.cfx ??= { res: 0, run: 0, critReady: false, calmUsed: false };
  s.cfx.calmUsed = false;
  s.cfx.tf = {};
  return s.cfx;
}

export function resetClassFx(s: GameState): void {
  s.cfx = { res: 0, run: 0, critReady: false, calmUsed: false };
}

export function knownMoechteNouns(s: GameState): Word[] {
  return WORDS.filter((w) => w.moechte && s.words[w.id]);
}

export function gradeQuestion(s: GameState, b: Battle, q: Question, input: string): Verdict & { word?: Word } {
  // 齐鸣 (点名齐鸣, rev 234): the mates' boxes come after the target's answer, joined with |; each mate written right
  // (its own word with the article) is hit, the others are not.
  if (q.mates?.length) {
    const parts = input.split('|');
    input = parts[0] ?? '';
    b.chorusHits = q.mates.filter((id, i) => WORD_BY_ID[id] && gradeTyped(parts[i + 1] ?? '', WORD_BY_ID[id], hasArticleQuestion(WORD_BY_ID[id])).ok);
  }
  if (q.pool === 'split' && q.split) {
    const ok = gradeSplit(q.split, input);
    return { ok, notes: ok ? [] : [`正确答案：${q.answer}`], correct: q.answer! };
  }
  if (q.pool === 'colloc') {
    const ok = input.trim().toLowerCase() === q.answer!.toLowerCase();
    return { ok, notes: ok ? [] : [`正确答案：${q.answer}`], correct: q.answer! };
  }
  switch (q.type) {
    case 'grammar': {
      return gradeGram(q.gram!, input);
    }
    case 'article':
    case 'callout':
    case 'pickDe':
    case 'pickZh': {
      const ok = input === q.answer;
      return { ok, notes: ok ? [] : [`正确答案：${q.type === 'article' ? fullForm(b.word) : q.answer}`], correct: q.answer! };
    }
    case 'typed':
      return gradeTyped(input, q.review ? WORD_BY_ID[q.review] : b.word, !!q.withArticle);
    case 'storm': {
      if (!q.forms) return gradeTyped(input, q.word!, !!q.withArticle);
      const g = gradeStorm(q.word!, q.forms, input, rank(s, 'xuxie') > 0);
      b.stormHits = g.n;
      const all = g.all;
      return { ok: g.n > 0, notes: all ? [] : [...g.notes, `全部：${q.answer}`], correct: q.answer!, word: all ? q.word : undefined };
    }
    case 'steady': {
      if (!q.options && q.answer && !q.item) return gradeTyped(input, b.word, !!q.withArticle);
      const ok = !q.options || input === q.answer;
      return { ok, notes: ok ? [] : [`正确答案：${q.answer}（这次只挡一半）`], correct: q.answer! };
    }
    case 'cloze': {
      if (q.write === 'order') {
        const ok = gradeOrder(input, q.answer!);
        return { ok, notes: ok ? [] : [`正确语序：${q.answer}`], correct: q.answer! };
      }
      if (q.write === 'compose') {
        const v = gradeCompose(input, b.word);
        return { ok: v.ok, notes: v.notes, correct: v.ok ? input.trim() : q.answer!, word: v.ok ? b.word : undefined };
      }
      if (q.write === 'slot' && q.slot) {
        const recent = String(s.flags.slotRecent ?? '').split(',').filter(Boolean);
        const v = gradeSlot(input, q.slot, slotNouns(q.slot.pattern, (x) => !!s.words[x.id], b.word), recent, b.word.id);
        if (v.ok && v.used && v.used.id !== b.word.id) s.flags.slotRecent = [v.used.id, ...recent.filter((x) => x !== v.used!.id)].slice(0, SLOT_RECENT).join(',');
        return { ok: v.ok, notes: v.notes, correct: v.ok ? input.trim() : q.answer!, word: v.ok && v.used?.id === b.word.id ? b.word : undefined };
      }
      const cw = q.review ? WORD_BY_ID[q.review] : q.partner ? WORD_BY_ID[q.partner] : b.word;
      const ok = gradeCloze(input, q.answer!, cw, q.clozeZh);
      return { ok, notes: ok ? [q.full!] : [`正确答案：${q.answer}`, q.full!, ...clozeWhy(q.answer!, cw, input)], correct: q.answer! };
    }
    case 'saying': {
      const x = q.say!;
      // The second half alone, or the whole sentence typed out, both count.
      const ok = sayKey(input) === sayKey(x.b) || sayKey(input) === sayKey(`${x.a} ${x.b}`);
      return { ok, notes: ok ? [`${x.a} ${x.b} —— ${x.zh}`] : [`正确答案：${x.a} ${x.b}（${x.zh}）`], correct: x.b };
    }
    case 'sentence': {
      if (q.write === 'link' && q.link) {
        const ok = gradeLink(input, q.link);
        return { ok, notes: ok ? [] : [`正确答案：${q.answer}`], correct: q.answer!, word: ok ? b.word : undefined };
      }
      if (q.prompt97) {
        const g = q.ultGrade ?? 'fail';
        b.ultHits = g === 'full' ? 2 : g === 'target' ? 1 : 0;
        return { ok: g !== 'fail', notes: [], correct: input, word: g !== 'fail' ? b.word : undefined };
      }
      if (q.ult) {
        // 终极技能: the two blanks come joined with |, each graded on its own (Bitte/gern ignored like sentences).
        const parts = input.split('|');
        const hits = q.ult.map((a, i) => sayKey(parts[i] ?? '') === sayKey(a));
        const n = hits.filter(Boolean).length;
        b.ultHits = n;
        return { ok: n > 0, notes: n === 2 ? [q.answer!] : [`正确答案：${q.answer}`], correct: q.answer!, word: n === 2 ? b.word : undefined };
      }
      if (q.pattern && q.undWord) {
        // Ich möchte einen Tee und eine Tasse: each half graded as its own sentence.
        const lead = PATTERNS[q.pattern].lead;
        const [a, c] = input.split(/\s+und\s+/i);
        if (!c) return { ok: false, notes: [`要用 und 连起两只怪：${q.answer}`], correct: q.answer! };
        const va = gradeSentence(a.trim() + '.', b.word, q.pattern);
        const vc = gradeSentence(`${lead} ${c.trim()}`, q.undWord, q.pattern);
        const ok = va.ok && vc.ok;
        return { ok, notes: ok ? [] : [...va.notes, ...vc.notes, `正确答案：${q.answer}`], correct: q.answer!, word: ok ? b.word : undefined };
      }
      if (q.pattern) return gradeSentence(input, b.word, q.pattern);
      const ok = sayKey(input) === sayKey(q.answer!);
      return { ok, notes: ok ? [] : [`正确答案：${q.answer}`], correct: q.answer!, word: ok ? b.word : undefined };
    }
    case 'skill': {
      const fake: Word = { id: 'skill', de: q.answer ?? '', zh: '', pos: 'phr', family: 'echo', lvl: 1, zone: 'camp' };
      return gradeTyped(input, fake, false);
    }
    case 'conj':
    case 'plural': {
      // "du nimmst" and "nimmst" both count; "die Äpfel" and "Äpfel" both count.
      const prefix = q.type === 'conj' ? (q.person ?? '') : 'die';
      let v = input.trim();
      if (prefix && v.toLowerCase().startsWith(prefix.toLowerCase() + ' ')) v = v.slice(prefix.length + 1);
      if (q.type === 'conj' && q.person === 'er') v = v.replace(/^(er|sie|es) /i, '');
      if (q.type === 'conj' && q.person === 'sie') v = v.replace(/^(sie|Sie) /, '');
      const fake: Word = { id: 'q', de: q.answer!, zh: '', pos: 'phr', family: 'echo', lvl: 1, zone: 'camp' };
      let r = gradeTyped(v, fake, false);
      for (const a of q.alts ?? []) {
        if (r.ok) break;
        const ra = gradeTyped(v, { ...fake, de: a }, false);
        if (ra.ok) r = { ...ra, notes: [`也对；更常见的是 ${q.answer}`] };
      }
      return { ...r, correct: q.type === 'conj' ? `${q.person === 'er' ? 'er' : q.person === 'sie' ? 'sie' : q.person} ${q.answer}` : `die ${q.answer}` };
    }
  }
}

// ---- Resolution --------------------------------------------------------------

export interface TurnReport {
  correct: boolean;
  verdict: Verdict;
  playerDamage: number;
  crit: boolean;
  newSpell: boolean;
  monsterDamage: number;
  parried: boolean;
  element: Element | null;
  log: LogLine[];
  outcome: Battle['outcome'];
  readRight: boolean;
  /** Monsters that died this turn (packs settle each kill at once). */
  kills: Battle[];
  /** On a loss: the monster that dealt the last blow (it keeps your echo). */
  killer: Battle | null;
  /** 词性三相 result of this hit. */
  phase?: 'right' | 'wrong' | 'soft' | null;
  /** 斩杀: pend = first 会写 (待验证 from tomorrow), ready = verified (可斩杀), fail = verification missed. */
  cut?: 'pend' | 'ready' | 'fail';
  /** 斩杀: the 会写 / verification was a 笔误 (one letter off) — counted, but not a hit. */
  cutTypo?: boolean;
  /** 语境复习 answered this turn: the word, right or wrong, and the next gap (null = no more reviews). */
  review?: { word: Word; ok: boolean; next: number | null; placed?: boolean; reverted?: number };
}

function comboMult(combo: number): number {
  for (const tier of CONFIG.combo) if (combo >= tier.at) return 1 + tier.dmg;
  return 1;
}

export function comboTier(combo: number): string | null {
  for (const tier of CONFIG.combo) if (combo >= tier.at) return tier.name;
  return null;
}

const ARTICLE_RE = /^(der|die|das|den|dem|des|ein|eine|einen|einem|einer|eines|kein|keine|keinen|mein|meine|meinen|meinem|dein|deine|deinen|ihr|ihre|ihren|ihrem|seine?n?)\s/i;
const ELEMENT_BY_GENDER: Record<'m' | 'f' | 'n' | 'pl', Element> = { m: 'ice', f: 'fire', n: 'poison', pl: 'lightning' };

/**
 * 墨水风暴 overkill in a pack spills once onto the next monster (charging first, then lowest HP),
 * under that monster's own intent (defend still cuts it, 誊写 still ignores it). It never kills:
 * the monster stays at 1 HP at least, so the last hit is still its own word (归名, review, kill count).
 */
export function spillStorm(s: GameState, pack: Battle[], from: Battle, overkill: number, typedLike: boolean, log: LogLine[]): number {
  const rest = pack.filter((x) => x !== from && !x.outcome && x.monster.hp > 1);
  if (!rest.length) return 0;
  const next = rest.find((x) => x.intent.kind === 'charge') ?? rest.reduce((a, x) => (x.monster.hp < a.monster.hp ? x : a));
  void typedLike, s; // 誊写 no longer touches defend (removed); kept for the call sites
  let d = overkill;
  if (next.intent.kind === 'defend') d *= CONFIG.damage.vsDefend;
  d = Math.min(Math.round(d), next.monster.hp - 1);
  if (d <= 0) return 0;
  next.monster.hp -= d;
  log.push({ text: `墨水溅到 ${fullForm(next.word)} 身上：${d}。最后一下，得写它自己的名字。`, tone: 'good' });
  return d;
}

/** Makes separate battles one pack fight: shared statuses, hints and resource; each monster has 0.6× HP (0.4). */
export function linkPack(pack: Battle[]): void {
  if (pack.length < 2) return;
  for (const b of pack) {
    b.fx = pack[0].fx;
    b.cfx = pack[0].cfx;
    b.hintsLeft = pack[0].hintsLeft;
    b.monster.hp = b.monster.maxHp = Math.max(1, Math.round(b.monster.maxHp * CONFIG.pack.hpMult));
  }
}

/** Per-monster damage multiplier in a pack (2 together ≈ 0.5×, 3 ≈ 0.45× one monster per turn; packs last longer since there is no parry any more). */
export function packDamageMult(alive: number): number {
  return alive <= 1 ? 1 : alive === 2 ? CONFIG.pack.dmgMult[0] : CONFIG.pack.dmgMult[1];
}

/** Pack-wide values live on every member; copy them from the one that acted. */
/** 秘术: damage effects of this fight's shouts. */
function charmDamage(s: GameState, b: Battle, typedLike: boolean): number {
  const f = b.fx.charm;
  if (!f) return 1;
  let m = 1 + (f.dmg ?? 0);
  if (f.firstQ && b.qIndex === 1) m *= f.firstQ;
  if (f.firstThree && b.qIndex <= 3) m *= 1 + f.firstThree;
  if (f.vsReview && b.reviewMon) m *= 1 + f.vsReview;
  if (f.vsHigher && b.monster.lvl > s.level) m *= 1 + f.vsHigher;
  if (f.typed && typedLike) m *= 1 + f.typed;
  return m;
}

/** 秘术: hits taken (Schon gut, slang −20/25%, Sicher ist sicher on the first wrong, backfire +50%). */
function charmTaken(b: Battle, ok: boolean): number {
  const f = b.fx.charm;
  if (!f) return 1;
  let m = 1 - Math.min(0.5, f.taken ?? 0);
  if (!ok && f.firstWrongHalf && !f.firstWrongDone) m *= 0.5;
  if (!ok && f.backfire) m *= 1.5;
  return m;
}

function syncShared(from: Battle, pack: Battle[]) {
  for (const o of pack) {
    if (o === from) continue;
    o.skillCooldown = from.skillCooldown;
    o.poolCd = from.poolCd;
    o.chorusCd = from.chorusCd;
    o.hintsLeft = from.hintsLeft;
    o.judgement = from.judgement;
    o.fx = from.fx;
    o.cfx = from.cfx;
  }
}

/** A pack mate's name in the log before its spelling has been shown: article (once it is a known noun) + half. */
/** 名牌 (Lucas 2026-11-25): the meaning in Chinese, short (first sense, no brackets), never the German letters. */
export function plateZh(w: Word): string {
  const z = w.zh.replace(/（[^）]*）|\([^)]*\)/g, '').split(/[；;，,／/]/)[0].trim() || w.zh;
  return z.length > 8 ? `${z.slice(0, 8)}…` : z;
}


/** Question types that put the word's German spelling on screen (斩杀: a typed answer after one is not 会写). */
const SHOWS_SPELLING = new Set(['article', 'callout', 'pickZh', 'pickDe', 'conj', 'plural', 'saying']);

/**
 * 斩杀 (0.6.x). Field: typing the word right (or a 笔误) before its spelling showed in this fight, no 低语, not in the
 * word's first fight → 待验证 from tomorrow. Verification fight: its first (typed) question right or a 笔误 →
 * 可斩杀; wrong → back to the normal reviews. The hit itself is judged as usual (a 笔误 is still a miss).
 */
function cutCheck(s: GameState, b: Battle, q: Question, input: string, ok: boolean): { notes: string[]; report: Pick<TurnReport, 'cut' | 'cutTypo'> } {
  const notes: string[] = [];
  const report: Pick<TurnReport, 'cut' | 'cutTypo'> = {};
  const w = b.word;
  const p = s.words[w.id];
  // A typed cloze counts too when its answer is the word's dictionary form (nouns with der/die/das) and the
  // question doesn't show the word (no conjugated / declined form, no «(gehen)» hint).
  const shown = normalize(`${q.prompt} ${q.focus ?? ''} ${q.frame ?? ''}`);
  const clozeDict = q.type === 'cloze' && q.clozeMode !== 'pick' && q.answer === fullForm(w) && !shown.includes(normalize(w.de));
  // 句中默写 (练中学): its answer is the slot's form (einen Tee), shown nowhere on screen.
  const plainTyped = (((q.type === 'typed' || clozeDict) && q.answer === fullForm(w)) || !!q.dict) && !q.whispered && !b.phrase;
  const typo = !ok && plainTyped && q.answer === fullForm(w) && typoOk(input, w, !!w.art);
  if (b.verify && !b.verifyDone && (q.type === 'typed' || q.dict)) {
    b.verifyDone = true;
    if (ok || typo) {
      b.cutReady = true;
      retire(s, w); // retired now, so fleeing or falling afterwards keeps it
      report.cut = 'ready';
      report.cutTypo = typo || undefined;
      const pass = b.verify === 'recheck' ? '还记得，永久斩杀' : '可以斩杀了';
      notes.push(typo ? `差一个字母：${fullForm(w)}。算你会，${pass}` : `✓ ${pass}`);
    } else {
      failVerify(s, w);
      report.cut = 'fail';
      notes.push(b.verify === 'recheck' ? '有点忘了，它回到复习里。' : '还没牢，它会按复习再来。会写 0/2');
    }
  } else if (plainTyped && (ok || typo) && b.challenge && b.kind === 'new' && !p && !b.spellSeen && !b.pendOnWin) {
    // 挑战怪: written right in its first fight, before seeing it → 待验证 tomorrow like any field word.
    b.pendOnWin = true;
    report.cut = 'pend';
    report.cutTypo = typo || undefined;
    notes.push(typo ? `差一个字母：${fullForm(w)}。算你会，会写 1/2` : '✓ 挑战怪写对了 · 打赢它，明天再写对就能斩杀');
  } else if (plainTyped && (ok || typo) && p && (b.kind !== 'new' || b.challenge) && !b.spellSeen && !b.verify && !b.pluralMon && !b.tutorial && !p.pend && !p.retired) {
    p.pend = now(s);
    report.cut = 'pend';
    report.cutTypo = typo || undefined;
    notes.push(typo ? `差一个字母：${fullForm(w)}。算你会，会写 1/2` : '✓ 会写 1/2 · 明天再遇到写对就能斩杀');
  }
  // Anything that put the spelling on screen (the question itself, or a wrong answer's correction).
  // 审查修订: the full sentence shown after a right answer counts as having seen the spelling too.
  if (SHOWS_SPELLING.has(q.type) || (q.type === 'cloze' && q.clozeMode === 'pick') || !ok || q.whispered || (ok && !!(q.full || q.gram?.full))) b.spellSeen = true;
  for (const x of [q.full, q.gram?.full]) if (x) (b.seenLines ??= []).push(lineKey(x));
  return { notes, report };
}

/** 语境复习 answered: right → next gap, +1 shard, 「✓ 复习 · der Apfel，下次 1 周后」; wrong → the whole sentence
 *  and the word relapses to a 半名 review monster. Either way this fight's one context question is used. */
function reviewAnswer(s: GameState, b: Battle, q: Question, ok: boolean): TurnReport['review'] {
  const w = WORD_BY_ID[q.review!];
  b.fx.ctxAsked = true;
  if (!w) return undefined;
  const p = s.words[w.id];
  if (p?.placed && !p.retired) {
    // 入学测试 spot check: right → retired; wrong → review monster (and maybe the whole band).
    const reverted = placedCheck(s, w, ok);
    if (ok) addGearKill(s, w.region ?? 1, 1, 1);
    return { word: w, ok, next: null, placed: true, reverted };
  }
  if (p) {
    if (ok) p.correct += 1;
    else p.wrong += 1;
  }
  if (ok && p?.artHalf && p.stage === 2) {
    // 文章群怪 半名 written right in a new sentence: 归名 (with the normal context schedule).
    delete p.artHalf;
    setGuiming(p, now(s), false);
    addGearKill(s, w.region ?? 1, 1, 1);
    s.flags.ctxDropBoost = ((s.flags.ctxDropBoost as number) ?? 0) + 1;
    return { word: w, ok, next: p.due - now(s) };
  }
  if (!ok && p?.artHalf && p.stage === 2) {
    p.due = now(s) + CONFIG.srs.respawn;
    return { word: w, ok, next: null };
  }
  if (ok) {
    const next = contextPass(s, w);
    // 审查修订: the review rewards live here now — an extra shard, and the next kill's drop chance ×1.5.
    addGearKill(s, w.region ?? 1, 1, 1);
    s.flags.ctxDropBoost = ((s.flags.ctxDropBoost as number) ?? 0) + 1;
    return { word: w, ok, next };
  }
  contextFail(s, w);
  return { word: w, ok, next: null };
}

/**
 * One turn. `b` is the monster you target; `pack` holds every monster in the fight
 * (just [b] for a one-on-one). You act first, then every monster still standing acts.
 */
export function resolveTurn(
  s: GameState,
  b: Battle,
  move: Move,
  q: Question,
  input: string,
  rng: Rng,
  pack: Battle[] = [b],
  /** 即时战 (81): 'act' = your answer only (the monsters act on their own cast bar), 'tick' = a cast bar ran out. */
  rt?: 'act' | 'tick',
): TurnReport {
  if (q.directName) return directTurn(s, b, q, input);
  if (q.chain) return chainTurn(s, b, q, input, rng);
  b.directOffer = false; // the offer stands only before the first question
  const log: LogLine[] = [];
  const multi = pack.length > 1;
  const tagOf = (x: Battle) => (multi ? `${x.spellSeen ? fullForm(x.word) : x.word.erode ? '它' : plateZh(x.word)} ` : '它');
  const alive0 = pack.filter((x) => !x.outcome);
  const dmgMult = packDamageMult(alive0.length);
  // 药片 (物品栏): no answer this turn; the monsters act as after a right one (a charged hit still lands).
  const itemTurn = move === 'item';
  const verdict: Verdict & { word?: Word } = itemTurn ? { ok: true, correct: '', notes: [] } : gradeQuestion(s, b, q, input);
  const m = b.monster;
  const intent = b.intent;
  const ok = verdict.ok;
  // 题型跟准确率走: plain example clozes on the target count toward the step up / down.
  if (q.type === 'cloze' && !q.write && !q.review && !q.partner && !q.dict && !q.gram) noteCloze(s, ok);
  // 点名 that names another monster in the pack hits that one for half damage (and counts as wrong).
  const stray = q.type === 'callout' && !ok ? alive0.find((x) => x !== b && x.word.art === input) ?? null : null;
  const clozeTyped = q.type === 'cloze' && q.clozeMode !== 'pick';
  // 墨水风暴 with every form right counts as written (rev 234: it can be the 归名 blow).
  const stormAll = q.type === 'storm' && !!q.forms && verdict.word?.id === b.word.id;
  // 审查修订 A6/A11: 排句 and 连句 show the words on screen: copying them is not 会写, 用过 or the 归名 blow.
  const shownWords = q.write === 'order' || q.write === 'link';
  const typedQ = !q.voiced && !shownWords && (q.type === 'typed' || q.type === 'sentence' || q.type === 'conj' || q.type === 'plural' || clozeTyped || stormAll);
  const kills: Battle[] = [];
  let lastHitter: Battle | null = null;
  let playerDamage = 0;
  let crit = false;
  let newSpell = false;
  let perfect = false;
  let element: Element | null = null;
  /** 词性三相 result of this hit: right = weak point, wrong = resisted (Lv6+), soft = wrong but not punished yet. */
  let phaseFx: TurnReport['phase'] = null;
  // 读对意图: a correct hit that interrupts (蓄力/回血/逃跑) or a written answer that breaks a guard.
  const writtenQ = q.type === 'typed' || q.type === 'conj' || q.type === 'plural' || q.type === 'storm' || clozeTyped || (q.type === 'callout' && !!q.withArticle);
  const readRight = !itemTurn && ok && move !== 'cls' && (['charge', 'heal', 'flee'].includes(intent.kind) || (intent.kind === 'defend' && writtenQ));
  let blocking = false;
  /** 稳住 answered wrong (rev 234): still blocks half of the first hit. */
  let halfBlock = false;
  /** 稳住 covered this wrong answer: the monsters' hits this turn cost no HP. */
  let guarded = false;
  let interrupted = false;
  const chorusStopped = new Set<Battle>();
  let cutFx: ReturnType<typeof cutCheck> = { notes: [], report: {} };
  let reviewFx: TurnReport['review'];
  if (!itemTurn) {
    b.qIndex += 1;
    if (q.type === 'sentence') b.sxUsed = (b.sxUsed ?? 0) + 1;
    if (q.gram && !q.gram.pb?.blank) b.gramAsked = (b.gramAsked ?? 0) + 1;
    // 介词空 / 介词秘境: per-preposition and per-kind accuracy (more questions where you miss, 3-choice below 60%).
    if (q.gram?.pb && !q.whispered) notePrep(s, q.gram.pb, ok);
    if (q.gram?.sys === 'notice' && b.notice) b.notice.i += 1;
    if (q.gram?.sys === 'listen' || q.gram?.sys === 'blind') {
      b.listenDone = true;
      log.push({ text: `原文：${q.gram.full ?? ''}${q.gram.zh ? `（${q.gram.zh}）` : ''}`, tone: 'info' });
    }
    // 词族秘境: a mixed-up contrast only marks the word 易混 (审查修订: no progress is taken back).
    if (q.gram?.mix && !ok && s.words[b.word.id]) {
      const p = s.words[b.word.id];
      p.mix = [...new Set([...(p.mix ?? []), q.gram.mix])];
    }
    if (q.partner) b.partnerDone = true;
    // 复习怪: its opening 句中默写 right → back to 归名 now (the gap restarts at 1 day).
    if (b.reviewMon && q.dict && ok && !q.whispered && b.qIndex === 1) {
      const p = s.words[b.word.id];
      if (p && !p.retired && (p.lapsed || p.stage === 3)) {
        p.relapse += p.lapsed ? 1 : 0;
        setGuiming(p, now(s), false, true);
        b.backToGuiming = true;
        log.push({ text: `✓ 还记得：${fullForm(b.word)} 回到归名。`, tone: 'good' });
      }
    }
    if (q.board) markBoard(s, q.board.sys);
    if (q.ult) b.ultUsed = true;
    if (q.echo) {
      b.echoDone = true;
      notePron(s, q.echo.cat, ok);
    }
    // 低语 (2026-11-21): a hinted answer is not 会写/认得, earns no resource and cannot be the 归名 blow.
    // The word is marked so its next appearance asks it again without the hint.
    if (q.whispered) {
      b.hinted = true;
      if (s.words[b.word.id]) s.words[b.word.id].hinted = true;
    } else if (ok && b.hinted) {
      b.hinted = false;
      if (s.words[b.word.id]) delete s.words[b.word.id].hinted;
    }
    // 审查修订: the 先教后考 turn (the answer was on screen) is teaching only: not 认得, not part of 全对跳阶.
    const taughtNow = !!b.phaseTaught && b.phaseTaught === b.turn;
    if (!taughtNow && !q.review && !q.partner && q.type !== 'saying' && (!ok || q.whispered)) b.flawed = true;
    if (!taughtNow && !q.review && !q.partner && q.type !== 'saying' && !ok) b.wrongs = (b.wrongs ?? 0) + 1;
    if (ok && !q.whispered && !q.review && !q.partner && q.type === 'cloze' && !shownWords) b.usedOk = true;
    // 介词空 right: one review of the word and 会用 (not 会写).
    if (ok && !q.whispered && q.gram?.pb?.blank) {
      b.usedOk = true;
      reviewedByUse(s, b.word);
    }
    if (ok && !q.whispered && !q.review && !q.partner && !taughtNow) {
      if (q.voiced || shownWords) b.readOk = (b.readOk ?? 0) + 1; // 开口作答 / 抄词块: 认得, not 会写
      else if (q.type === 'typed' || q.type === 'conj' || q.type === 'plural' || q.type === 'sentence' || stormAll || (q.type === 'cloze' && q.clozeMode !== 'pick')) {
        b.writeOk = (b.writeOk ?? 0) + 1;
        if (!b.phrase) reviewedByWriting(s, verdict.word ?? b.word); // 写对就算复习 (rev 51)
        else for (const id of Object.keys(s.words)) if (WORD_BY_ID[id] && hasWord(`${b.phrase.a} ${b.phrase.b}`, WORD_BY_ID[id])) reviewedByWriting(s, WORD_BY_ID[id]);
      }
      else if (q.type === 'article' || q.type === 'pickDe' || q.type === 'pickZh' || q.type === 'callout' || q.type === 'cloze') b.readOk = (b.readOk ?? 0) + 1;
    }
    // 挑战怪 share (rev 342): the first written answer of a fight, and whether its spelling had shown before.
    if (!b.firstTry && !q.review && !q.partner && writtenQ) b.firstTry = !ok || q.whispered ? 'bad' : b.spellSeen ? 'ok' : 'dict';
    if (q.partner) {
      /* 复习伙伴: company, not a test — nothing on either word's record */
    } else if (q.voiced) {
      /* 开口作答: says nothing about spelling, so no 斩杀 check either way */
    } else if (!q.review) cutFx = cutCheck(s, b, q, input, ok);
    else {
      reviewFx = reviewAnswer(s, b, q, ok);
      if (reviewFx) verdict.notes.unshift(reviewFx.ok ? `✓ 复习 · ${fullForm(reviewFx.word)}，${reviewFx.next ? `下次 ${gapZh(reviewFx.next)}` : '以后不用再复习了'}` : `复习没答上：${fullForm(reviewFx.word)} 复发了，会作为复习怪（半名）回到野外。`);
    }
    if (cutFx.notes.length) verdict.notes.push(...cutFx.notes);
    if (q.type === 'saying') {
      b.sayingDone = true;
      const x = q.say!;
      if (ok && x.cardId) {
        const id = x.cardId;
        s.sayings ??= {};
        const first = !s.sayings[id];
        s.sayings[id] = (s.sayings[id] ?? 0) + 1;
        log.push({ text: first ? `短句卡「${x.a} ${x.b}」收进了收集册。` : `又接上了「${x.a} ${x.b}」。`, tone: 'good' });
      } else if (ok) log.push({ text: `接上了：「${x.a} ${x.b}」`, tone: 'good' });
      else log.push({ text: `它替你说完：「${x.a} ${x.b}」`, tone: 'bad' });
    }

    // 言灵 (the only resource) and the 一气呵成 typed streak.
    const cfx = b.cfx;
    const critWasReady = cfx.critReady; // earned this turn = the *next* hit crits
    const typedLike = q.type === 'typed' || q.type === 'conj' || q.type === 'plural' || q.type === 'storm' || clozeTyped || (q.type === 'grammar' && !q.gram?.options);
    // 技能池: the cooldown starts when the skill is used, right or wrong.
    if (move === 'skill' && q.pool) b.poolCd[q.pool] = poolCdFor(s, q.pool, q.type === 'storm' && stormAll);
    // 0.4 techniques: 低语 is free (its price: no 会写, no resource, no 归名); 铭刻 / 齐鸣 cooldowns.
    // 天赋「滔滔不绝」: the finisher costs 3 instead of all of it.
    if (move === 'sentence') cfx.res = rank(s, 'taotao') ? Math.max(0, cfx.res - 3) : 0;
    const tf = (cfx.tf ??= {});
    // 静听: this question had 2 s more on its quick line (the answer before was a right listening one).
    if (tf.earNext) q.earMs = 2000;
    tf.earNext = false;
    if (b.fx.charm?.quickMs) q.earMs = (q.earMs ?? 0) + b.fx.charm.quickMs; // 秘术 Alles klar.
    if (q.whispered) tf.whispered = true;
    if (!ok || q.ms === undefined || q.ms >= 8000) tf.slow = true;
    // 铭刻 has no cooldown (Lucas 2026-11-20: encourage it); a miss on an inscribed question costs 1 resource.
    const kept = !ok && !!b.fx.keepRes;
    if (kept) {
      b.fx.keepRes = false;
      log.push({ text: '「Ich habe den Zug verpasst.」——这次答错，什么也没丢。', tone: 'good' });
    }
    if (q.inscribed && !ok && !kept) cfx.res = Math.max(0, cfx.res - CONFIG.tech.inscribeMissCost);
    // 言灵反噬 (语法线, Lucas 2026-11-25 provisional): breaking a grammar rule costs 1 resource point, never HP.
    if (q.gram && !ok && !kept && cfx.res > 0) {
      cfx.res -= 1;
      log.push({ text: '言灵反噬：规则没守住，资源 −1。', tone: 'bad' });
    }
    if (move === 'inscribe') cfx.inscribeCd = CONFIG.tech.inscribeCd;
    if (move === 'chorus') b.chorusCd = Math.max(1, CONFIG.tech.chorusCd - rank(s, 'qisheng'));
    // 题型奖励表: a correct answer earns its row's resource (guardians: +1 for every answer instead, their passive).
    if (ok && move !== 'skill' && !q.whispered) cfx.res += QTYPES[qKey(q)].res;
    if (ok && !q.whispered) cfx.res += talentRes(s, b, q);
    if (critRunNeeded(s) && typedLike && q.type !== 'storm') {
      if (ok) {
        cfx.run += 1;
        if (cfx.run >= critRunNeeded(s) && !cfx.critReady) {
          cfx.critReady = true;
          cfx.run = 0;
          log.push({ text: `连写对 ${critRunNeeded(s)} 个：下一击必暴。`, tone: 'good' });
        }
      }
    }
    // Any wrong answer breaks the writer's streak (it carries across fights otherwise).
    if (!ok && !kept) cfx.run = 0;
    cfx.res = Math.min(cfx.res, resMax(s));

    // --- 1. You act first.
    if (ok) {
      const afterWrong = b.wrongStreak > 0;
      b.wrongStreak = 0;
      if (q.type === 'callout') b.named = true;
      if (q.type !== 'saying' && !q.review && q.gram?.sys !== 'listen') b.step += 1; // 听段题 doesn't move the ladder
      s.combo += 1;
      if (readRight && move !== 'skill') s.combo += 1; // 读对意图并出对克制招式，连击额外 +1
      talentOnRight(s, b, q, log, afterWrong);
      if (rt === 'act' && q.parryWindow && intent.kind === 'attack') {
        b.parryReady = true;
        log.push({ text: '弹反架势：它这一下会被你接住。', tone: 'good' });
      }
      s.bestCombo = Math.max(s.bestCombo, s.combo);

      if (move === 'skill' && q.type === 'steady') {
        // 稳住 (rev 425): no damage; the next 2 wrong answers cost no HP and keep the combo.
        cfx.guard = rank(s, 'wengu') && !q.options ? 3 : 2;
        log.push({ text: `「稳住」——你沉下身子。接下来${cfx.guard === 3 ? '三' : '两'}次答错，都不扣血、不断连击。`, tone: 'good' });
      } else {
        const atk = attack(s);
        // 低语: the hinted question hits like one tier easier (typed → choice armor, hard → typed, no armor break).
        const tier = (q.whispered ? Math.max(0, qTier(q) - 1) : qTier(q)) as 0 | 1 | 2;
        let mult = between(rng, CONFIG.damage.roll[0], CONFIG.damage.roll[1]);
        const pen = 0.05 * rank(s, 'bifeng'); // 落笔
        // 0.4: the question type no longer multiplies damage (armor does that, below). Gear affixes stay.
        if (q.type === 'storm') {
          // rev 234: attack × (1 + 0.5 × forms right); talent 连写 +10% per form per point.
          const n = q.forms ? b.stormHits ?? 0 : 1;
          mult *= (1 + 0.5 * n) * (1 + 0.1 * rank(s, 'changci') * n) * (1 + pen);
          log.push({ text: `墨水风暴：连写对 ${n}${q.forms ? ` / ${q.forms.length}` : ''} 种形式。`, tone: 'good' });
        } else if (typedLike) mult *= 1 + pen; // 天赋「笔锋」; no question-type gear affix
        if (q.pool && MULT[q.pool]) {
          mult *= MULT[q.pool]!;
          log.push({ text: `${POOL[q.pool].zh}：×${MULT[q.pool]}。`, tone: 'good' });
        }
        if (q.pool === 'seal') {
          // 格之封印: no charging for 2 turns; a charge already building is gone.
          b.sealed = SEAL_TURNS + (rank(s, 'changfeng') ? 1 : 0);
          if (intent.kind === 'charge' || b.chargeIn) {
            b.chargeIn = undefined;
            if (b.queued?.kind === 'charge') b.queued = undefined;
            interrupted = true;
          }
          log.push({ text: `格之封印：它 ${b.sealed} 回合内蓄不了力。`, tone: 'good' });
        }
        if (q.type === 'sentence') {
          if (has(s.level, 'layerElement')) element = ELEMENT_BY_GENDER[genderOf(b.word) ?? 'n'];
        }
        if (q.inscribed) mult *= CONFIG.tech.inscribeMult;
        if (rt && q.spoken) mult *= REALTIME.spokenMult; // 即时战: 开口说对的攻击伤害 +20%
        if (q.prompt97) {
          const full = b.ultHits === 2;
          mult *= full ? ULT97.full : ULT97.target;
          log.push({ text: full ? `提示词造句：三个词都用上了，×${ULT97.full}，横扫！` : `提示词造句：只用上了它的词，×${ULT97.target}。`, tone: 'good' });
        } else if (q.ult) {
          const full = b.ultHits === 2;
          mult *= full ? CONFIG.ultimate.both : CONFIG.ultimate.one;
          log.push({ text: full ? `终极技能：两个空都对，×${CONFIG.ultimate.both}。` : `终极技能：对了一个空，×${CONFIG.ultimate.one}。`, tone: 'good' });
        }
        if (b.fx.doubleNext) {
          mult *= 2;
          b.fx.doubleNext = false;
          log.push({ text: '「Der Zug fährt ab!」——这一击翻倍。', tone: 'good' });
        }
        // 怪物诅咒: a hard question answered right breaks it.
        if (tier === 2 && b.curse) {
          log.push({ text: b.curse === 'forget' ? '咒文碎了：遗忘解除，低语和中文提示回来了。' : '咒文碎了：沉默解除，又能读出来了。', tone: 'good' });
          delete b.curse;
        }
        // 刻字 denn (0.6, 25 级): a hard question answered right hits +20% per engraved item.
        if (tier === 2 && engraved(s, 'denn')) mult *= 1 + CONFIG.engrave.bonus * engraved(s, 'denn');
        // 语气词孔 mal / doch (45): a right 终结技 that uses the engraved particle in its pattern.
        if (isFinisher(q)) {
          const pb = particleBonus(s, input);
          if (pb) {
            mult *= 1 + pb.add;
            log.push({ text: `语气词 ${pb.word}：+${Math.round(pb.add * 100)}%${pb.varied ? '（连用三个不同的小词）' : ''}。`, tone: 'good' });
          }
        }

        const breaking = intent.kind === 'defend' && writtenQ;
        const g = genderOf(b.word);
        mult *= comboMult(s.combo);
        mult *= charmDamage(s, b, typedLike);
        const gsys = q.gram?.sys;
        if (!q.whispered) for (const g of fillGems(s, gsys)) (b.gemFilled ??= []).push(g.sys);
        const gDmg = gemSum(s, gsys, 'dmg');
        if (gDmg) mult *= 1 + gDmg; // 言石
        const phones = gear(s).phones;
        if (phones && listenQ(q)) mult *= 1 + phones.main + PHONES_PER_TIER * itemTier(phones, s.region ?? 1); // 耳机

        // Crits: forced ones first (接句怪, 初识暴击), then the random roll.
        if (q.type === 'saying') {
          crit = true;
        } else if (b.stage === 0 && b.kind === 'new' && !b.firstCorrectDone) {
          crit = true;
          newSpell = true;
        } else if (perfectSpell(s, q, input, ok)) {
          // 完美言灵 (B1 起): a flawless sentence with a clause or a modifier — a sure crit at ×2.5.
          crit = true;
          perfect = true;
        } else if ((s.flags.wortgewalt as number) > 0) {
          crit = true;
        } else if (critWasReady) {
          crit = true;
          cfx.critReady = false;
        } else if (speedCrit(s, q)) {
          crit = true;
        } else {
          const chance = Math.min(CONFIG.player.critCap, critChance(s) + (tf.sharp ?? 0) + (b.fx.charm?.crit ?? 0));
          crit = rng() < chance;
        }
        if (q.type !== 'saying') b.firstCorrectDone = true;
        tf.sharp = 0;
        if (perfect) {
          mult *= rank(s, 'xiushi') ? 2.8 : PERFECT.mult;
          log.push({ text: '完美言灵：整句没错，还用了从句或修饰语。', tone: 'crit' });
        } else if (crit) mult *= critMultFor(s, q, typedLike);
        // 护甲和破甲: a hard question (or writing through a guard) breaks the armor for this hit and the next two.
        const stanceMove = move === 'attack' || move === 'inscribe' || move === 'whisper' || move === 'chorus' || move === 'sentence';
        if (stanceMove && needsPhase(b)) {
          const pc = phaseCase(b);
          // Not punished yet: Lv1–5, and the first level of each case (acc at 7, dat at 15).
          const soft = (b.perfekt && s.level <= CONFIG.perfekt.softUntil) || s.level <= CONFIG.phase.softUntil || (pc === 'acc' && s.level === CONFIG.phase.accFrom) || (pc === 'dat' && s.level === CONFIG.phase.datFrom);
          phaseFx = phaseRight(b) ? 'right' : soft ? 'soft' : 'wrong';
        }
        if (phaseFx === 'wrong') {
          // Resisted: whatever break it had is gone, and this hit meets doubled armor.
          if (m.broken > 0) log.push({ text: '破甲被抵消了。', tone: 'bad' });
          m.broken = 0;
        }
        const wasBroken = m.broken > 0;
        if ((tier === 2 || breaking) && !wasBroken && phaseFx !== 'wrong') {
          // 誊写 (书写者大天赋, 游戏设计 十): any hard-question break lasts 4 hits instead of 3.
          m.broken = CONFIG.armor.breakHits + (rank(s, 'tengxie') ? 1 : 0);
          log.push({ text: breaking ? `写对了。壳裂开了：这一下和之后 ${m.broken - 1} 下无视护甲。` : `难题破甲：这一下和之后 ${m.broken - 1} 下无视护甲。`, tone: 'good' });
        }
        // Right stance = the hit meets armor one tier lower (a choice answer as if typed, a typed one ignores it).
        const armor = phaseFx === 'right' ? effArmor(s, b, tier === 0 ? 1 : 2) : phaseFx === 'wrong' ? effArmor(s, b, tier === 2 ? 1 : tier, CONFIG.phase.wrongArmor) : effArmor(s, b, tier);
        if (m.broken > 0) m.broken -= 1;
        // 按性别的伤害词缀 (游戏设计 九): only on a right stance; a 复数怪 has no gender bonus.
        if (phaseFx === 'right' && !b.pluralMon) mult *= 1 + affixTotal(s, g === 'm' ? 'vsMasc' : g === 'f' ? 'vsFem' : g === 'n' ? 'vsNeut' : '-');
        const chorusMult = mult; // 齐鸣: the mates take the same hit before their own armor
        mult *= 1 - armor * (1 - Math.min(0.9, gemSum(s, q.gram?.sys, 'pen'))); // 言石 穿透
        const ph = phaseOf(b);
        if (phaseFx === 'right') {
          b.phaseHit = true;
          // 相亲和: the first right hit on a matching monster (per pick) gives +2 instead of +1.
          const aff = affinityMatch(s, b) && !b.affinityPaid;
          if (aff) b.affinityPaid = true;
          const gain = aff ? CONFIG.gear.affinityRes : CONFIG.phase.rightRes;
          if (resMax(s) && move !== 'sentence') cfx.res = Math.min(resMax(s), cfx.res + gain);
          if (has(s.level, 'layerElement')) element = ELEMENT_BY_GENDER[b.pluralMon ? 'pl' : genderOf(b.word) ?? 'n'] ?? element;
          if (Object.values(gear(s)).some((it) => it?.legendary === 'articleJudgement')) b.judgement = true;
          log.push({ text: `${b.phase} 相打中弱点：护甲降一档${resMax(s) && move !== 'sentence' ? `，${resName(s)} +${gain}${aff ? `（护符亲和 ${affinityOf(s)} 共鸣）` : ''}` : ''}。`, tone: 'good' });
        } else if (phaseFx === 'wrong') log.push({ text: `${b.phase ?? '无'} 相被抵抗：${phaseWrongWhy(b)}。护甲翻倍。`, tone: 'bad' });
        else if (phaseFx === 'soft') log.push({ text: `${b.phase ? `${b.phase} 相不对` : '没选相'}：这里要 ${ph}${b.pluralMon ? '（复数一律 die）' : phaseCase(b) === 'acc' ? '（第四格）' : phaseCase(b) === 'dat' ? '（第三格）' : ''}。这一级还不罚，选对了护甲降一档。`, tone: 'sys' });
        mult *= talentDamage(s, b, q, { typedLike, clozeTyped, tier, phaseRight: phaseFx === 'right', broken: wasBroken || tier === 2, log });
        if (b.structMon && q.gram?.sys !== 'struct') mult *= STRUCT.otherMult;
        if (b.pronMon && !q.echo) mult *= PRON_MON.otherMult;
        if (b.b2Mon && !q.gram?.special) mult *= B2_CFG.otherMult;
        const judged = b.judgement;
        if (judged) {
          mult *= 2;
          b.judgement = false;
        }
        if (q.type === 'article' && Object.values(gear(s)).some((it) => it?.legendary === 'articleJudgement')) b.judgement = true;

        const charging = intent.kind === 'charge';
        if (intent.kind === 'defend' && !breaking && !wasBroken) mult *= CONFIG.damage.vsDefend;
        mult = Math.min(mult, CONFIG.damage.maxMultiplierOfBase);
        playerDamage = Math.max(1, Math.round(atk * mult));
        if (b.tutorial === 'loss') playerDamage = Math.min(playerDamage, 3);
        // The saying alone never finishes it: the word itself still has to be answered.
        if (q.type === 'saying') playerDamage = Math.max(1, Math.min(playerDamage, m.hp - 1));
        // 残句: each right step takes a third; only the third step (writing it whole) finishes it.
        if (b.phrase) {
          b.phraseStep = (b.phraseStep ?? 0) + 1;
          playerDamage = b.phraseStep >= 3 ? m.hp : Math.max(1, Math.min(Math.ceil(m.maxHp / 3), m.hp - 1));
        }

        m.hp -= playerDamage;
        // 提示词造句 sweep: every other monster takes half, never below 1 HP (the last blow answers its own word).
        if (q.prompt97 && b.ultHits === 2 && multi) {
          const hit: string[] = [];
          for (const o of alive0) {
            if (o === b || o.outcome) continue;
            const d = Math.min(o.monster.hp - 1, Math.round(playerDamage * ULT97.sweep));
            if (d <= 0) continue;
            o.monster.hp -= d;
            hit.push(String(d));
          }
          if (hit.length) log.push({ text: `横扫：其余的怪各吃 ${hit.join('、')}。`, tone: 'good' });
        }
        const gHeal = gemSum(s, q.gram?.sys, 'heal');
        if (gHeal) s.hp = Math.min(maxHp(s), s.hp + Math.max(1, Math.round(maxHp(s) * gHeal))); // 言石 回血
        s.stats.maxHit = Math.max(s.stats.maxHit, playerDamage);
        if (crit) s.stats.crits += 1;
        if (charging || intent.kind === 'heal' || intent.kind === 'flee') interrupted = true;
        if (tier === 2 && rank(s, 'fengli')) tf.sharp = 0.1 * rank(s, 'fengli');
        if (rank(s, 'gesuo') && phaseFx === 'right' && caseQ(b, q) && b.turn - (b.chainAt ?? -99) >= 3 && chainForms(b.word)) {
          b.chainOffer = true;
          b.chainAt = b.turn;
          log.push({ text: '格位连锁：趁它还没回神，换一个格再叫它一次！', tone: 'good' });
        }
        if (isFinisher(q) && rank(s, 'yuyun')) tf.glow = 3; // this turn + the next 2
        if (q.pool === 'colloc' && rank(s, 'dapei')) {
          b.armorDownT = 3;
          log.push({ text: '搭配记忆：它的护甲降一档，2 回合。', tone: 'good' });
        }
        // 听懂了时间词: 铭刻 or the finisher on the turn before an announced big attack breaks it early.
        if (b.chargeIn === 1 && (q.inscribed || q.type === 'sentence')) {
          b.chargeIn = undefined;
          if (b.queued?.kind === 'charge') b.queued = undefined;
          log.push({ text: '你听懂了它说的时间：抢在大招之前打断了它。', tone: 'good' });
        }
        if (rank(s, 'yishou') && (cfx.guard ?? 0) > 0 && move !== 'skill') {
          const d = Math.max(1, Math.round(attack(s) * (1 - effArmor(s, b, 0)) * between(rng, CONFIG.damage.roll[0], CONFIG.damage.roll[1])));
          m.hp -= d;
          playerDamage += d;
          log.push({ text: `以守为攻：顺势再一下，${d}。`, tone: 'good' });
        }
        // 心流: each right answer adds a 30% chase (never the 归名 blow: it lands only while the monster has HP to spare).
        if ((tf.flow ?? 0) > 0 && m.hp > 1) {
          const d = Math.max(1, Math.min(m.hp - 1, Math.round(playerDamage * 0.3)));
          m.hp -= d;
          playerDamage += d;
          log.push({ text: `心流追击 ${d}。`, tone: 'good' });
        }
        if (element === 'ice') m.chilled = true;
        if (element === 'fire') m.burn = CONFIG.status.burnTurns;
        if (element === 'poison') m.poison = Math.min(CONFIG.status.poisonMaxStacks, m.poison + 1);

        // 齐鸣 (rev 49): only when the target's stance is right (or there is no stance to pick, e.g. 复数 crowds
        // without a pick yet are excluded by needsPhase). The mates sharing that stance take the same hit (crit, hard
        // question, combo all count) against their own right-stance armor; 刻字 auch +20% each. A charging mate is
        // interrupted. A wrong or soft stance on the target: only the target is hit, no chorus.
        if (q.chorus && multi) {
          const hitOthers: string[] = [];
          const rings = needsPhase(b) ? phaseFx === 'right' : true;
          if (!rings) log.push({ text: '目标的相没选对：齐鸣没响，只打中了目标。', tone: 'bad' });
          for (const o of rings ? chorusMates(b, pack).filter((x) => !q.mates || (b.chorusHits ?? []).includes(x.word.id)) : []) {
            const auch = 1 + CONFIG.engrave.bonus * engraved(s, 'auch');
            const oArmor = needsPhase(o) ? effArmor(s, o, tier === 0 ? 1 : 2) : effArmor(s, o, tier);
            const d = Math.max(1, Math.round(atk * Math.min(chorusMult, CONFIG.damage.maxMultiplierOfBase) * auch * (1 - oArmor)));
            o.monster.hp = Math.max(0, o.monster.hp - d);
            if (o.monster.broken > 0) o.monster.broken -= 1;
            if (o.intent.kind === 'charge' || o.intent.kind === 'flee') chorusStopped.add(o);
            o.phaseHit = true;
            hitOthers.push(`${o.named || o.stage > 0 ? fullForm(o.word) : '另一只'} ${d}${chorusStopped.has(o) ? '（打断）' : ''}`);
          }
          if (hitOthers.length) log.push({ text: `齐鸣：${hitOthers.join('，')}。`, tone: 'good' });
        }
        // und: the second named monster takes the same blow (against its own armor; a finisher breaks it anyway).
        if (q.undWord && multi) {
          const o = pack.find((x) => x !== b && !x.outcome && x.word.id === q.undWord!.id);
          if (o) {
            const d = Math.max(1, Math.round(playerDamage * (1 - effArmor(s, o, tier))));
            o.monster.hp = Math.max(0, o.monster.hp - d);
            log.push({ text: `und：${q.undWord.de} 也挨了 ${d}。`, tone: 'good' });
          }
        }

        const tag = (judged ? '冠词审判！' : '') + (crit ? (newSpell ? '新言灵！暴击 ' : '暴击 ') : '');
        const el = element ? `（${ELEMENT_ZH[element]}）` : '';
        log.push({ text: `${tag}你造成 ${playerDamage} 点伤害${el}。`, tone: crit ? 'crit' : 'good' });
        if (intent.kind === 'defend' && !breaking && !wasBroken) log.push({ text: '它缩着。选择题只刮三成，默写才撬得开。', tone: 'info' });
      }

      // 审查修订 (额外伤害): a context-review question, a notice question, the mirror's pronoun and the 结构魔's weil
      // clause never finish it — at most down to 1 HP; the last blow has to answer its own word.
      if (m.hp <= 0 && extraHit(q)) {
        m.hp = 1;
        b.finishOwn = true;
        log.push({ text: `${tagOf(b)}只剩一口气：最后一下要答它自己的词。`, tone: 'info' });
      }
      if (m.hp <= 0) {
        const overkill = -m.hp;
        m.hp = 0;
        b.outcome = 'win';
        if (q.type === 'storm' && multi && overkill > 0) spillStorm(s, pack, b, overkill, typedLike, log);
        b.lastKillTyped = typedQ && !q.whispered && !q.review && (q.type === 'sentence' ? verdict.word?.id === b.word.id : true);
        if (q.type === 'typed' && !q.withArticle && hasArticleQuestion(b.word)) b.lastKillTyped = false;
        // A noun's 归名 blow must write the article: only a form cloze that includes one (den Tee) counts.
        if (q.type === 'cloze' && hasArticleQuestion(b.word) && !((q.clozeMode === 'form' || q.dict) && ARTICLE_RE.test(q.answer ?? ''))) b.lastKillTyped = false;
        if (b.lastKillTyped && b.stage === 2 && rank(s, 'mingbihu')) heal(s, 0.1, '名之庇护', log);
        log.push({ text: `${tagOf(b)}散了。`, tone: 'sys' });
        kills.push(b);
      }
    } else {
      if (move === 'skill' && q.type === 'steady') {
        cfx.guard = 1;
        log.push({ text: '「稳住」——没答对，只保得住下一次答错。', tone: 'info' });
      } else if ((cfx.guard ?? 0) > 0) {
        cfx.guard! -= 1;
        guarded = true;
        log.push({ text: `稳住护着你：这次答错不扣血、连击还在${cfx.guard ? `（还能护 ${cfx.guard} 次）` : ''}。`, tone: 'info' });
      } else if (s.rift?.calmLeft) {
        s.rift.calmLeft = false;
        guarded = true;
        log.push({ text: '裂隙祝福「定」：这一层第一次答错，不扣血、连击还在。', tone: 'info' });
      } else if (b.fx.charm?.keepCombo) {
        b.fx.charm.keepCombo = false;
        log.push({ text: '「Keine Ahnung.」——这次答错，连击还在。', tone: 'info' });
      } else if (rank(s, 'buhuang') || starOf(s, q)) {
        s.combo = Math.floor(s.combo / 2);
        if (s.combo) log.push({ text: `${rank(s, 'buhuang') ? '不慌' : '星位'}：连击只减半（${s.combo}）。`, tone: 'info' });
      } else s.combo = 0;
      b.wrongStreak += 1;
      if (b.stage === 2 && !b.slipped && b.kind === 'due' && !q.review) {
        b.slipped = true;
        log.push({ text: '错了。它长回一颗牙（退回裂形）。', tone: 'bad' });
      }
      if (stray) {
        const d = Math.max(1, Math.round(attack(s) * (1 - effArmor(s, stray, 0)) * CONFIG.pack.strayMult * between(rng, CONFIG.damage.roll[0], CONFIG.damage.roll[1])));
        stray.monster.hp = Math.max(0, stray.monster.hp - d);
        log.push({ text: `你喊 ${input}，应声的是 ${fullForm(stray.word)}：只有 ${d}。`, tone: 'bad' });
        if (stray.monster.hp <= 0) {
          stray.outcome = 'win';
          stray.lastKillTyped = false;
          kills.push(stray);
          log.push({ text: `${fullForm(stray.word)} 被打散了。`, tone: 'sys' });
        }
      } else log.push({ text: q.type === 'callout' ? `没有谁叫 ${input}。落空。` : '没叫对。它没反应。', tone: 'bad' });
    }


    // Target died and nobody else is left: the fight ends before anyone acts.
    if (pack.every((x) => x.outcome === 'win')) {
      syncShared(b, pack);
      return finish(s, b, { correct: ok, verdict, playerDamage, crit, newSpell, monsterDamage: 0, parried: false, element, log, outcome: 'win', readRight, kills, killer: null, phase: phaseFx, ...cutFx.report, review: reviewFx });
    }
  }

  // --- 2. Every monster still standing acts (即时战: only when its cast bar runs out).
  let monsterDamage = 0;
  let parried = false;
  const target = b;
  if (rt === 'tick' && b.parryReady) {
    // 弹反: answered right in the last second of its cast — the hit is caught and countered (a crit).
    blocking = true;
    b.parryReady = false;
  }
  if (rt !== 'act')
    for (const actor of pack) {
      if (actor.outcome) continue;
      actAs(actor);
    }
  function actAs(b: Battle) {
    const m = b.monster;
    const intent = b.intent;
    const say = (l: LogLine) => log.push(multi ? { ...l, text: `${tagOf(b)}：${l.text}` } : l);
  const monsterCrit = target.wrongStreak >= 2;
  const wrongReduce = ok ? 0 : affixTotal(s, 'wrongDmgReduce');
  // 铁壁: the turn the right stance landed, hits on you are lighter.
  const takenMult = (phaseFx === 'right' ? 1 - 0.05 * rank(s, 'tiebi') : 1) * (ok && !itemTurn ? 1 - Math.min(0.5, gemSum(s, q.gram?.sys, 'guard')) : 1);
  const chillMult = (m.chilled ? CONFIG.status.iceDamageMult : 1) * (1 + CONFIG.armor.monsterDmgPerLevelBelow * Math.max(0, m.lvl - s.level));

  const hitPlayer = (raw: number) => {
    let d = Math.max(1, Math.round(raw * (1 - wrongReduce) * (ok ? 1 : wrongHitShare(s)) * (b.fx.cheap ? 0.5 : 1) * takenMult * charmTaken(target, ok)));
    if (guarded) d = 0;
    const tfx = target.cfx.tf;
    if (d > 0 && tfx?.voiceShield) {
      d = Math.max(1, Math.round(d * 0.7));
      tfx.voiceShield = false;
    }
    if (d > 0 && (tfx?.ward ?? 0) > 0) {
      const soak = Math.min(d, tfx!.ward!);
      tfx!.ward! -= soak;
      d -= soak;
    }
    monsterDamage += d;
    s.hp -= d;
    if (d > 0) lastHitter = b;
  };

  const cf = b.fx.charm;
  if (b === target && (cf?.delay ?? 0) > 0 && !b.outcome && intent.kind !== 'wait' && intent.kind !== 'defend' && !interrupted) {
    cf!.delay! -= 1;
    say({ text: '它被你那句话拖住了，这回合没出手。', tone: 'good' });
  } else if ((interrupted && b === target) || chorusStopped.has(b)) {
    // 「Wie bitte?」 cancels silently; a charge (on the target, or a mate hit by 齐鸣) says it broke.
    if (intent.kind === 'charge') say({ text: '打断了！它憋的那口气散了。', tone: 'good' });
  } else {
    switch (intent.kind) {
      case 'attack': {
        let per = m.dmg * dmgMult * chillMult * (monsterCrit ? 1.5 : 1);
        // 多段: a correct answer on this monster stops it after the first hit.
        const hitsN = ok && !q.tick && b === target && intent.hits > 1 ? 1 : intent.hits;
        if (hitsN < intent.hits) say({ text: '它只咬到一口。', tone: 'good' });
        for (let i = 0; i < hitsN; i++) {
          if (i === 0 && halfBlock) {
            hitPlayer(per / 2);
            continue;
          }
          if (i === 0 && blocking) {
            parried = true;
            const counter = Math.max(1, Math.round(attack(s) * CONFIG.player.critMult));
            m.hp = Math.max(0, m.hp - counter);
            say({ text: `弹反！挡住第一下并反击 ${counter} 点（算一次暴击）。`, tone: 'crit' });
            continue;
          }
          hitPlayer(per);
        }
        if (monsterDamage > 0) {
          const hitsTxt = hitsN > 1 ? `${hitsN} 下` : '';
          const el = intent.element !== 'phys' ? `（${ELEMENT_ZH[intent.element]}）` : '';
          say({ text: `${monsterCrit ? '它看准你的破绽，暴击！' : ''}它${hitsTxt}打中你，共 ${monsterDamage} 点${el}。`, tone: 'bad' });
          if (intent.element === 'ice') b.fx.chilled = true;
          if (intent.element === 'fire') b.fx.burn = CONFIG.status.burnTurns;
          if (intent.element === 'poison') b.fx.poison = Math.min(CONFIG.status.poisonMaxStacks, b.fx.poison + 1);
        }
        if (blocking && hitsN > 1) say({ text: '稳住只挡得住第一下。', tone: 'info' });
        per = 0;
        break;
      }
      case 'defend':
        if (blocking) say({ text: '它在缩着。你白挡了一回合。', tone: 'info' });
        else say({ text: '它缩起来防守。', tone: 'info' });
        break;
      case 'charge': {
        if (m.chilled) {
          say({ text: '冻住了。大的推迟了。', tone: 'good' });
          break;
        }
        // 眼镜 (0.6, 23 级): the charged hit lands this much softer.
        let heavy = m.dmg * dmgMult * chillMult * CONFIG.monster.chargeMult * (monsterCrit ? 1.5 : 1) * (1 - (gear(s).glasses?.main ?? 0));
        if (b.fx.charm?.chargeHalf) {
          heavy /= 2;
          b.fx.charm.chargeHalf = false;
          say({ text: '「Na und?」——大招只砸下来一半。', tone: 'good' });
        }
        if (blocking || halfBlock) {
          hitPlayer(blocking ? heavy / 2 : heavy * 0.75);
          say({ text: `你挡下一半大招，受到 ${monsterDamage} 点伤害。`, tone: 'bad' });
        } else {
          hitPlayer(heavy);
          say({ text: `憋了很久的那一下砸在你身上：${monsterDamage}！`, tone: 'bad' });
        }
        break;
      }
      case 'heal': {
        const heal = Math.round(m.maxHp * 0.35);
        m.hp = Math.min(m.maxHp, m.hp + heal);
        say({ text: `它回复了 ${heal} 点生命。${m.broken > 0 ? '甲还没长回来。' : ''}`, tone: 'bad' });
        break;
      }
      case 'flee':
        b.outcome = 'fled';
        say({ text: '「Ich muss los!」——它抱着箱子钻进人堆，没了。', tone: 'bad' });
        break;
      case 'wait':
        if (intent.layers.includes('object')) log.push({ text: blocking ? '它说的是 mich——挠的是它自己。格挡白费了。' : '它说的是 mich，对着自己出手，没打你。', tone: 'info' });
        else log.push({ text: blocking ? '它根本没出手——nicht 的意思是「不」。格挡白费了。' : '它说了不打，就真的没打。', tone: 'info' });
        break;
    }
  }

  }

  if (multi) b = target;
  // Misreads for the post-fight recap.
  if (!ok && (intent.kind === 'charge' || intent.kind === 'heal'))
    b.recap.push(`第 ${b.turn} 回合：「${intent.line}」是${intent.kind === 'charge' ? '蓄力' : '回血'}，这题答对就能打断。`);


  // --- 3. Damage over time and status ticks (every monster still standing; your own statuses once).
  if (rt !== 'act') for (const x of pack) if (!x.outcome) tickMonster(x);
  function tickMonster(b: Battle) {
    const m = b.monster;
    const say = (l: LogLine) => log.push(multi ? { ...l, text: `${tagOf(b)}：${l.text}` } : l);
    if (m.burn > 0) {
      const d = Math.max(1, Math.round(attack(s) * CONFIG.status.burnPctOfAtk));
      m.hp = Math.max(0, m.hp - d);
      m.burn -= 1;
      say({ text: `灼烧：它掉了 ${d} 点。`, tone: 'good' });
    }
    if (m.poison > 0) {
      const d = Math.max(1, Math.round(attack(s) * CONFIG.status.poisonPerStackPctOfAtk * m.poison));
      m.hp = Math.max(0, m.hp - d);
      say({ text: `中毒（${m.poison} 层）：它掉了 ${d} 点。`, tone: 'good' });
    }
    if (m.vulnerable > 0) m.vulnerable -= 1;
    if (b !== target || move !== 'sentence' || element !== 'ice') m.chilled = false;
  }
  const strongest = Math.max(...pack.filter((x) => !x.outcome).map((x) => x.monster.dmg), 1);
  if (rt !== 'act') endOfRound();
  if (rt !== 'tick') talentEndTurn(s, b, q, ok, interrupted, log);
  function endOfRound() {
  const cfe = b.fx.charm;
  if (cfe?.lowHeal && s.hp > 0 && s.hp < maxHp(s) * 0.3) {
    cfe.lowHeal = false;
    const before = s.hp;
    s.hp = Math.min(maxHp(s), s.hp + Math.round(maxHp(s) * 0.25));
    log.push({ text: `「Kopf hoch!」——回了 ${s.hp - before} 点生命。`, tone: 'good' });
  }
  if (!ok && !itemTurn && cfe) {
    cfe.firstWrongDone = true;
    cfe.backfire = false;
  }
  if (b.fx.burn > 0) {
    const d = Math.max(1, Math.round(strongest * 0.4));
    s.hp -= d;
    b.fx.burn -= 1;
    log.push({ text: `你被灼烧，掉了 ${d} 点。`, tone: 'bad' });
  }
  if (b.fx.poison > 0) {
    const d = Math.max(1, Math.round(strongest * 0.15 * b.fx.poison));
    s.hp -= d;
    log.push({ text: `你中毒了（${b.fx.poison} 层），掉了 ${d} 点。`, tone: 'bad' });
  }
  if (b.skillCooldown > 0) b.skillCooldown -= 1;
  for (const k of Object.keys(b.poolCd) as PoolId[]) if (b.poolCd[k]! > 0) b.poolCd[k]! -= 1;
  if ((b.sealed ?? 0) > 0) b.sealed! -= 1;
  for (const x of pack) if ((x.armorDownT ?? 0) > 0) x.armorDownT! -= 1;
  if ((b.cfx.inscribeCd ?? 0) > 0) b.cfx.inscribeCd! -= 1;
  if (b.chorusCd > 0) b.chorusCd -= 1;
  b.fx.cheap = false;
  if ((s.flags.wortgewalt as number) > 0) s.flags.wortgewalt = (s.flags.wortgewalt as number) - 1;
  if (s.combo >= 50 && !s.flags.wortgewaltUsedAt50) {
    s.flags.wortgewalt = 3;
    s.flags.wortgewaltUsedAt50 = true;
  }
  if (s.combo < 50) s.flags.wortgewaltUsedAt50 = false;
  }

  for (const x of pack) {
    if (x.outcome || x.monster.hp > 0) continue;
    x.outcome = 'win';
    x.lastKillTyped = false;
    kills.push(x);
    log.push({ text: `${tagOf(x)}被打散了。`, tone: 'sys' });
  }
  let killer: Battle | null = null;
  if (pack.every((x) => x.outcome === 'win')) {
    /* everyone down */
  } else if (s.hp <= 0) {
    s.hp = 0;
    killer = lastHitter ?? pack.find((x) => !x.outcome) ?? b;
    for (const x of pack) if (!x.outcome) x.outcome = 'lose';
    log.push({ text: '你倒下了……', tone: 'bad' });
  } else if (rt === 'act') {
    // 即时战: your answer alone; an interrupted cast (蓄力 / 回血 / 逃跑) gives way to its next move at once.
    if (interrupted && !b.outcome) {
      b.intent = nextIntent(s, b, rng);
      b.chargeIn = undefined;
    }
  } else {
    for (const x of pack) {
      if (x.outcome) continue;
      x.turn += 1;
      x.intent = x.queued ?? nextIntent(s, x, rng);
      perfektGuard(s, x);
      x.queued = (b.fx.peek ?? 0) > 0 ? nextIntent(s, x, rng) : undefined;
    }
    if (multi) alignPairs(s, pack);
    if ((b.fx.peek ?? 0) > 0) b.fx.peek! -= 1;
  }
  syncShared(b, pack);
  const outcome: Battle['outcome'] = pack.every((x) => x.outcome === 'win') ? 'win' : s.hp <= 0 ? 'lose' : b.outcome;
  return finish(s, b, { correct: ok, verdict, playerDamage, crit, newSpell, monsterDamage, parried, element, log, outcome, readRight, kills, killer, phase: phaseFx, ...cutFx.report, review: reviewFx });
}

/** 直接叫名 answered: not a combat turn (nobody hits). Right → retired now and 可斩杀; wrong → the spelling is shown and
 *  the word is learned as usual. Either way the offer is gone. */
function directTurn(s: GameState, b: Battle, q: Question, input: string): TurnReport {
  b.direct = false;
  b.directOffer = false;
  const w = b.word;
  const verdict = gradeTyped(input, w, !!q.withArticle);
  const log: LogLine[] = [];
  const t = now(s);
  let cut: TurnReport['cut'];
  if (verdict.ok) {
    s.words[w.id] ??= { stage: 1, due: t, firstSeen: t, lastSeen: t, relapse: 0, correct: 0, wrong: 0, read: 0 };
    const p = s.words[w.id];
    p.correct += 1;
    p.write = (p.write ?? 0) + 1;
    p.lastSeen = t;
    retire(s, w, t);
    b.cutReady = true;
    cut = 'ready';
    log.push({ text: `✓ 直接叫名：${fullForm(w)}，你本来就会。可以斩杀了（30 天后回响抽查一次）${b.presumed ? '。推定会的词：给 3 碎片，不给经验' : ''}`, tone: 'good' });
  } else {
    b.spellSeen = true;
    log.push({ text: `没叫出来：${fullForm(w)}。没关系，照常学它。`, tone: 'info' });
  }
  return finish(s, b, { correct: verdict.ok, verdict, playerDamage: 0, crit: false, newSpell: false, monsterDamage: 0, parried: false, element: null, log, outcome: b.outcome, readRight: false, kills: [], killer: null, cut });
}

function finish(_s: GameState, b: Battle, r: TurnReport): TurnReport {
  b.log.push(...r.log);
  return r;
}

/** 快速通道: a placed player's word in a region before the one the test put them in, not yet 归名 or retired. */
export function fastTrackWord(s: GameState, w: Word): boolean {
  if (!s.placement || s.placement.level <= 1) return false;
  const entry = regionFor(s.placement.level);
  if ((w.region ?? 1) >= entry) return false;
  const p = s.words[w.id];
  return !p || (!p.retired && p.stage < 3);
}

export function intentLabel(i: Intent): string {
  return INTENT_ZH[i.shown];
}

export function pickHint(b: Battle, q: Question): string | null {
  if (!q.answer || b.hintsLeft <= 0) return null;
  b.hintsLeft -= 1;
  const a = q.answer;
  // 审查修订 A14: the first letter of the word only, never the article.
  const bare = a.replace(/^(der|die|das|den|dem|des|ein|eine|einen|einem|einer|eines)\s+/i, '');
  return `${(q.withArticle && b.word.art ? b.word.de : bare)[0]}…`;
}

export function randomFrom<T>(rng: Rng, arr: T[]): T {
  return pick(rng, arr);
}

// ---- 天赋节点表 (游戏设计 十, rev 488) ---------------------------------------------------------------
// Every node rewards one kind of answering (typing, forms, cases, whole sentences, listening, quick answers, speaking)
// or changes one skill. None of them touches 认得 / 会写 / 归名 or spelling; all of it stays under the crit caps and the
// 6× single-hit cap (applied where the multipliers meet).

/** 终结技: the finisher in any of its shapes (整句, 连句, und 句, 句型填空). */
export function isFinisher(q: Question): boolean {
  return q.type === 'sentence';
}

/** 语气词 in a typed sentence: mal only in a request (imperative, bitte, kannst du / können Sie …), doch anywhere. */
export function particleIn(input: string): Array<'mal' | 'doch'> {
  const t = ` ${input.toLowerCase().replace(/[.,!?;:]/g, ' ')} `;
  const out: Array<'mal' | 'doch'> = [];
  const request = /!\s*$/.test(input.trim()) || /\b(bitte|kannst du|können sie|könnten sie|könntest du|würden sie|würdest du)\b/i.test(input) || /^\s*[a-zäöü]+(e|t|en)?\s+(mal|doch)\b/i.test(input);
  if (/ mal /.test(t) && request) out.push('mal');
  if (/ doch /.test(t)) out.push('doch');
  return out;
}

/** The engraved mal / doch bonus for this sentence, with the repeat decay over the last 5 sentences (state). */
export function particleBonus(s: GameState, input: string): { word: 'mal' | 'doch'; add: number; varied: boolean } | null {
  if (s.level < CONFIG.engrave.particleFrom) return null;
  const used = particleIn(input).filter((p) => engraved(s, p) > 0);
  const hist = String(s.flags.particleHist ?? '').split(',').filter(Boolean);
  const word = used[0];
  const next = [...hist, word ?? '-'].slice(-5);
  s.flags.particleHist = next.join(',');
  if (!word) return null;
  const rep = hist.filter((x) => x === word).length;
  const decay = CONFIG.engrave.decay[Math.min(rep, CONFIG.engrave.decay.length - 1)];
  const last3 = next.slice(-3);
  const varied = last3.length === 3 && !last3.includes('-') && new Set(last3).size === 3;
  return { word, add: CONFIG.engrave.bonus * engraved(s, word) * decay + (varied ? CONFIG.engrave.varied : 0), varied };
}

/** 变形题: plural, conjugation, or a cloze that wants the form the sentence needs. */
function formQ(q: Question): boolean {
  return q.type === 'conj' || q.type === 'plural' || (q.type === 'cloze' && q.clozeMode === 'form');
}

/** 格位题: the article or case the sentence needs. */
function caseQ(b: Battle, q: Question): boolean {
  if (q.gram) return ['kein', 'datPron', 'mein', 'prep', 'timePrep', 'prepDat', 'prepAcc', 'twoway', 'adj', 'article'].includes(q.gram.sys);
  if (q.write === 'slot') return true;
  return q.type === 'cloze' && q.clozeMode === 'form' && !!b.word.art;
}

/** 变位题: a person form or a tense form of a verb. */
function conjQ(b: Battle, q: Question): boolean {
  if (q.gram) return ['modal', 'praetSein', 'praetModal', 'praet', 'ablaut', 'mirror', 'imp'].includes(q.gram.sys);
  return q.type === 'conj' || (q.type === 'cloze' && q.clozeMode === 'form' && b.word.pos === 'v');
}

/** 语序题: separable verbs at the end, verbs at the end of a clause, putting blocks in order. */
function orderQ(q: Question): boolean {
  return q.write === 'order' || q.gram?.sys === 'sep' || q.gram?.sys === 'nicht';
}

/** 不规则动词形式: strong-verb past, participle, irregular present. */
function irregularQ(b: Battle, q: Question): boolean {
  if (q.gram) return ['ablaut', 'praet', 'praetSein', 'praetModal'].includes(q.gram.sys);
  return (q.type === 'conj' && !!CONJ[b.word.de]?.strong) || !!b.perfekt;
}

/** 听力题: pick by ear (听整句选意思), 回音怪, 听写. */
/** 审查修订: damage that doesn't come from answering the monster's own word (语境复习, 告示/信件, 镜像, 结构魔). */
export function extraHit(q: Question): boolean {
  return !!q.review || ['notice', 'mirror', 'struct', 'listen'].includes(q.gram?.sys ?? '');
}

function listenQ(q: Question): boolean {
  return !!q.echo || !!q.listen || (q.type === 'pickZh' && q.prompt.startsWith('听'));
}

/** A2 快答线 (游戏设计: 选择 2 秒、默写约每 3 个字母 1 秒). Only from 31; turn-based stays without a penalty. */
export const QUICK_FROM = 31;
export function quickLineMs(q: Question): number {
  if (q.options?.length) return 2000;
  return Math.max(1, Math.ceil((q.answer ?? '').replace(/\s+/g, '').length / 3)) * 1000;
}
export function isQuick(s: GameState, q: Question): boolean {
  // From 81 the quick bonus lives in 即时战: turn-based and slow mode don't get it.
  if (s.level >= REALTIME.from && (s.settings.realtime === false || s.settings.realtimeSlow)) return false;
  return s.level >= QUICK_FROM && q.ms !== undefined && q.ms <= quickLineMs(q) + (q.earMs ?? 0);
}

/** 速答暴击 (2026-11-25): right inside the first half of the quick line is a sure crit; 抢答 widens it to 60% / 70%.
 *  Boss dialogue has no speed crit (审查修订). */
export function speedCrit(s: GameState, q: Question): boolean {
  if (!isQuick(s, q) || q.ms === undefined) return false;
  const share = 0.5 + 0.1 * rank(s, 'qiangda');
  return q.ms <= (quickLineMs(q) + (q.earMs ?? 0)) * share;
}

/** Crit multiplier with 笔力 (typed) and 快刃 (quick), capped at ×3. */
function critMultFor(s: GameState, q: Question, typedLike: boolean): number {
  const m = CONFIG.player.critMult + (typedLike ? 0.1 * rank(s, 'bili') : 0) + (isQuick(s, q) && rank(s, 'kuairen') ? 0.2 : 0);
  return Math.min(CONFIG.player.critMultCap, m);
}

/** Pool skill cooldown after talents (墨渍, 稳步, 拆解, 封印熟练, 连发; 墨水充盈 halves a full storm). */
export function poolCdFor(s: GameState, id: PoolId, stormAll = false): number {
  const cut: Partial<Record<PoolId, number>> = { storm: rank(s, 'mozi'), steady: rank(s, 'wenbu'), split: rank(s, 'chaijie'), seal: rank(s, 'fengyin'), dictate: rank(s, 'lianfa') };
  let cd = Math.max(1, POOL[id].cd - (cut[id] ?? 0));
  if (id === 'storm' && stormAll && rank(s, 'mochong')) cd = Math.max(1, Math.ceil(cd / 2));
  return cd;
}

/** 语法星位 this question belongs to (lit ones only), for +10% and the halved combo loss. */
export function starOf(s: GameState, q: Question): string | null {
  const lit = litStars(s);
  if (!lit.length) return null;
  const sys = q.gram?.sys;
  const key =
    sys === 'praet' || sys === 'praetSein' || sys === 'praetModal' ? 'praet'
    : sys === 'ablaut' ? 'irregular'
    : sys === 'modal' ? 'modal'
    : sys === 'sep' ? 'separable'
    : sys === 'adj' ? 'adjEnd'
    : q.gram?.pb?.blank && q.gram.pb.kase === 'D' && q.gram.pb.cat !== 'two' ? 'dat'
    : q.gram?.pb?.blank && q.gram.pb.kase === 'A' && q.gram.pb.cat !== 'two' ? 'acc'
    : sys === 'prepDat' ? 'dat'
    : sys === 'twoway' ? 'twoway'
    : sys === 'prepAcc' ? 'acc'
    : sys === 'prep' || sys === 'timePrep' ? 'twoway'
    : sys === 'datPron' ? 'dat'
    : sys === 'kein' || sys === 'mein' || sys === 'article' ? 'article'
    : q.type === 'plural' ? 'plural'
    : q.type === 'conj' ? 'present'
    : q.type === 'article' ? 'article'
    : null;
  return key && lit.includes(key) ? key : null;
}

function heal(s: GameState, pct: number, why: string, log: LogLine[]): void {
  const max = maxHp(s);
  const d = Math.min(max - s.hp, Math.round(max * pct));
  if (d <= 0) return;
  s.hp += d;
  log.push({ text: `${why}：回 ${d} 点生命。`, tone: 'good' });
}

/** Extra 言灵 on a right answer: 接话 (接句怪), 定神 (while 稳住 covers you), 条理 (hard question). */
function talentRes(s: GameState, b: Battle, q: Question): number {
  let n = 0;
  if (q.type === 'saying' && rank(s, 'jiehua')) n += 1;
  if ((b.cfx.guard ?? 0) > 0 && rank(s, 'dingshen') && q.type !== 'steady') n += 1;
  if (qTier(q) === 2 && rank(s, 'tiaoli')) n += 1;
  return n;
}

/** Right answer, before the hit: heals (改过, 温故), combo (乘胜), 声盾, and the 心流 count. */
function talentOnRight(s: GameState, b: Battle, q: Question, log: LogLine[], afterWrong: boolean): void {
  const tf = (b.cfx.tf ??= {});
  if (afterWrong && rank(s, 'gaiguo')) heal(s, 0.03 * rank(s, 'gaiguo'), '改过', log);
  if (q.review && rank(s, 'wengu2')) heal(s, 0.02 * rank(s, 'wengu2'), '温故', log);
  if (isFinisher(q) && rank(s, 'chengsheng')) {
    s.combo += 3;
    log.push({ text: '乘胜：连击 +3。', tone: 'good' });
  }
  if (q.spoken && rank(s, 'shengdun')) tf.voiceShield = true;
  if ((listenQ(q) || q.spoken) && rank(s, 'jingting')) tf.earNext = true;
  if (rank(s, 'xinliu')) {
    tf.quickRun = isQuick(s, q) ? (tf.quickRun ?? 0) + 1 : 0;
    if (tf.quickRun >= 5 && !(tf.flow ?? 0)) {
      tf.flow = 4; // ticks down at the end of this turn → 3 turns
      tf.quickRun = 0;
      log.push({ text: '心流：连续 5 题快答，接下来 3 回合每次答对追加一击。', tone: 'good' });
    }
  }
}

/** Damage multiplier from talents and lit stars for a right answer (the 6× cap is applied after). */
function talentDamage(s: GameState, b: Battle, q: Question, c: { typedLike: boolean; clozeTyped: boolean; tier: 0 | 1 | 2; phaseRight: boolean; broken: boolean; log: LogLine[] }): number {
  const tf = (b.cfx.tf ??= {});
  const r = (id: string) => rank(s, id);
  let add = 0;
  const writing = c.typedLike || q.type === 'sentence';
  // 笔锋 (落笔 is applied with the storm above)
  if (formQ(q)) add += 0.08 * r('xingbi');
  if (writing && b.word.art && (q.withArticle || (c.clozeTyped && q.clozeMode === 'form' && ARTICLE_RE.test(q.answer ?? '')))) add += 0.05 * r('guanbi');
  if (q.dict || isFinisher(q)) add += 0.04 * r('changju');
  if (writing && b.stage === 2) add += 0.15 * r('dingming');
  if (c.typedLike && !tf.whispered && r('wutishi')) add += 0.1;
  if (writing && (b.wrongs ?? 0) > 0) add += 0.15 * r('biji');
  // 守势
  if (s.hp < maxHp(s) * 0.3) add += 0.2 * r('gangyi');
  // 言辞
  if (isFinisher(q)) add += 0.05 * r('chengju');
  if (q.write === 'link') add += 0.08 * r('lianci');
  if (q.spoken) add += 0.15 * r('kaikou');
  if (c.typedLike && (tf.glow ?? 0) > 0) add += 0.05 * r('yuyun');
  if (c.tier === 2 && engraved(s, 'denn')) add += 0.05 * r('yuqi');
  if (q.chorus && engraved(s, 'auch')) add += 0.05 * r('yuqi');
  if (q.ult) add += 0.1 * r('juxing');
  if (q.pool === 'colloc') add += 0.1 * r('cikuai') / (MULT.colloc ?? 1.6); // ×1.6 → ×1.7/×1.8
  // 秩序
  const cq = caseQ(b, q) || conjQ(b, q);
  if (cq) add += 0.05 * r('gelv');
  if (c.phaseRight) add += 0.1 * r('shiruo');
  if (c.broken) add += 0.05 * r('pozhan');
  if (orderQ(q)) add += 0.06 * r('cixu');
  if (irregularQ(b, q) && writing) add += 0.04 * r('guizheng');
  if (cq && b.elite) add += 0.08 * r('kegou'); // 结构魔 (B1 红名) not in the game yet
  if (q.gram?.lock) add += 0.08 * r('shuangsuo'); // 锁链怪 (介词秘境)
  if ((b.sealed ?? 0) > 0) add += 0.1 * r('zhenya');
  // 迅捷
  const quick = isQuick(s, q);
  if (quick) add += 0.05 * r('kuaibi');
  if (listenQ(q)) add += 0.06 * r('tingyin');
  if (quick && s.combo >= 10) add += 0.1 * r('lianzhu');
  if (c.typedLike && q.ms !== undefined && q.ms <= 5000) add += 0.04 * r('suji');
  if (q.pool === 'dictate' || q.gram?.sys === 'blind') add += 0.06 * r('erchong');
  if (tf.preempt) {
    add += 0.08 * r('qiangxian');
    tf.preempt = false;
  }
  // 语法星位
  if (starOf(s, q)) add += STAR_BONUS;
  return 1 + add;
}

/** End of turn: interrupts (坚守, 乘隙, 抢先), and the per-turn counters. */
function talentEndTurn(s: GameState, b: Battle, _q: Question, ok: boolean, interrupted: boolean, log: LogLine[]): void {
  const tf = (b.cfx.tf ??= {});
  if (interrupted && ok) {
    if (b.intent.kind === 'charge') {
      if (rank(s, 'jianshou')) {
        tf.ward = (tf.ward ?? 0) + Math.round(maxHp(s) * 0.05 * rank(s, 'jianshou'));
        log.push({ text: `坚守：得到 ${tf.ward} 点护盾。`, tone: 'good' });
      }
      if (rank(s, 'chengxi')) {
        b.armorDownT = 2;
        log.push({ text: '乘隙：它的护甲降一档，2 回合。', tone: 'good' });
      }
    }
    if (rank(s, 'qiangxian')) tf.preempt = true;
  }
  if ((tf.glow ?? 0) > 0) tf.glow! -= 1;
  if ((tf.flow ?? 0) > 0) tf.flow! -= 1;
}

/** 一气呵成: every answer this fight right within 8 s → XP +3% per point. */
export function quickFightXp(s: GameState, b: Battle): number {
  return b.cfx.tf && !b.cfx.tf.slow ? 1 + 0.04 * rank(s, 'yiqi') : 1;
}

// ---- 格位连锁 (秩序 大天赋) ---------------------------------------------------------------------------

const DEF_ART: Record<'m' | 'f' | 'n', Record<Case, string>> = {
  m: { nom: 'der', acc: 'den', dat: 'dem' },
  f: { nom: 'die', acc: 'die', dat: 'der' },
  n: { nom: 'das', acc: 'das', dat: 'dem' },
};
const CASE_ZH: Record<Case, string> = { nom: '第一格', acc: '第四格', dat: '第三格' };

/** The noun with the definite article in each case, or null when the noun declines in ways this can't ask
 *  safely (n-declension masculines like der Kollege, der Student). */
export function chainForms(w: Word): Record<Case, string> | null {
  const g = genderOf(w);
  if (!w.art || !g || g === 'pl' || w.de.includes(' ')) return null;
  if (g === 'm' && /(e|ent|ant|ist|oge|at)$/.test(w.de)) return null;
  const t = DEF_ART[g as 'm' | 'f' | 'n'];
  return { nom: `${t.nom} ${w.de}`, acc: `${t.acc} ${w.de}`, dat: `${t.dat} ${w.de}` };
}

function chainQ(s: GameState, b: Battle, rng: Rng): Question | null {
  const f = chainForms(b.word);
  if (!f) return null;
  const from = phaseCase(b);
  const open = casesOpen(s.level).filter((c) => c !== from && f[c] !== f[from]);
  if (!open.length) return null;
  const to = open[Math.floor(rng() * open.length)];
  return { type: 'typed', chain: true, prompt: `格位连锁：${f[from]} 换成${CASE_ZH[to]}（定冠词 + 名词）。答对再打一次 ×1.5`, focus: `${f[from]}（${CASE_ZH[from]}）→ ${CASE_ZH[to]}`, answer: f[to] };
}

function chainTurn(s: GameState, b: Battle, q: Question, input: string, rng: Rng): TurnReport {
  b.chainOffer = false;
  const ok = gramKey(input) === gramKey(q.answer ?? '');
  const verdict: Verdict = { ok, correct: q.answer!, notes: ok ? [] : [`正确答案：${q.answer}`] };
  const log: LogLine[] = [];
  let dmg = 0;
  if (ok) {
    const mult = Math.min(CONFIG.damage.maxMultiplierOfBase, 1.5 * between(rng, CONFIG.damage.roll[0], CONFIG.damage.roll[1]) * comboMult(s.combo));
    // Never the 归名 blow: it leaves the monster at 1 HP at least.
    dmg = Math.max(1, Math.min(b.monster.hp - 1, Math.round(attack(s) * mult * (1 - effArmor(s, b, 1)))));
    if (b.monster.hp <= 1) dmg = 0;
    b.monster.hp -= dmg;
    log.push({ text: `格位连锁：${q.answer}，再打 ${dmg}。`, tone: 'good' });
  } else log.push({ text: `格位连锁没接上：${q.answer}。`, tone: 'info' });
  return finish(s, b, { correct: ok, verdict, playerDamage: dmg, crit: false, newSpell: false, monsterDamage: 0, parried: false, element: null, log, outcome: b.outcome, readRight: false, kills: [], killer: null });
}

// ---- 即时战 (B1, 81 级; 游戏设计「六、战斗」) ---------------------------------------------------------
// Time no longer stops: each monster acts when its cast bar runs out (about 6 s, a charge twice as long, longer lines
// take longer), you answer whenever you like with a 1 s global cooldown, a wrong choice answer staggers you 2 s.
// A right answer in the cast's last second is a parry (no hit, a counter that counts as a crit); a right answer during
// a charge / heal / flee breaks it. Slow mode: casts ×1.5. Turn-based stays available as a setting.

export const REALTIME = {
  from: 81,
  /** Seconds: base cast, per character of the monster's line, and the bounds. */
  castBase: 4,
  castPerChar: 0.06,
  castMin: 4,
  castMax: 9,
  chargeMult: 2,
  slowMult: 1.5,
  gcd: 1,
  stagger: 2,
  parryWindow: 1,
  spokenMult: 1.2,
};

/** Is this fight played in real time? From 81, unless the player picked turn-based; never in tutorials or trials. */
export function realtimeOn(s: GameState, b: Battle): boolean {
  return s.level >= REALTIME.from && s.settings.realtime !== false && !b.tutorial && !b.trial && !b.phrase;
}

/** Cast length (ms) of the monster's current move. */
export function castMs(s: GameState, b: Battle): number {
  const line = b.intent.line ?? '';
  let sec = Math.min(REALTIME.castMax, Math.max(REALTIME.castMin, REALTIME.castBase + REALTIME.castPerChar * line.length));
  if (b.intent.kind === 'charge') sec *= REALTIME.chargeMult;
  if (s.settings.realtimeSlow) sec *= REALTIME.slowMult;
  return Math.round(sec * 1000);
}

/** Global cooldown after an answer (疾行 −0.2 s per point), and the stagger after a wrong choice answer. */
export function gcdMs(s: GameState, q: Question, ok: boolean): number {
  if (!ok && q.options?.length) return REALTIME.stagger * 1000;
  return Math.round((REALTIME.gcd - 0.3 * rank(s, 'jixing')) * 1000);
}

/** The parry window at the end of an attack's cast (弹反 talent: 1.5 s). */
export function parryWindowMs(s: GameState): number {
  return (rank(s, 'tanfan') ? 1.5 : REALTIME.parryWindow) * 1000;
}

// ---- 开口作答 (游戏设计「开口说的路线」) ---------------------------------------------------------------
// 34 级起 any typed answer may be said instead (optional); judged on whether it is understood, not on accent.
// A said answer is 认得: no 会写, no 斩杀 check, never the 归名 blow.

export const VOICE = { from: 34, required: 83 };

export function voiceOpen(s: GameState, b: Battle, q: Question): boolean {
  if (s.level < VOICE.from || b.curse === 'silence' || s.settings.quiet) return false;
  return !q.options && !q.boxes?.length && !q.ult && !q.echo && !q.mates?.length && !q.directName;
}

/** The recogniser's alternatives: one that matches the answer (ignoring case and punctuation) wins, else the first. */
export function bestHeard(heard: string[], answer: string): string {
  const k = (x: string) => x.toLowerCase().replace(/[.,!?;:„“"']/g, '').replace(/\s+/g, ' ').trim();
  return heard.find((x) => k(x) === k(answer)) ?? heard[0];
}

// ---- 完美言灵 (B1 起; 游戏设计「暴击」) ---------------------------------------------------------------
// A written sentence with no mistake that uses a subordinate clause or a modifier: a sure crit at ×2.5 (修饰 ×2.8).
// It is one of the sure crits (they never stack); the 6× single-hit cap still holds.

export const PERFECT = { from: 81, mult: 2.5 };
const CLAUSE_RE = /(^|,\s*)(weil|dass|wenn|ob|obwohl|als|damit|bevor|nachdem|während|seit|bis|sodass|falls)\b|,\s*(der|die|das|den|dem|deren|dessen|denen|wo|was)\s/i;
const MODIFIER_RE = /\b(ein|eine|einen|einem|einer|der|die|das|den|dem|des|mein|meine|meinen|meinem|dein|deine|sein|seine|ihr|ihre|kein|keine|keinen)\s+[a-zäöüß]+(e|en|er|es|em)\s+[A-ZÄÖÜ][a-zäöüß]+/;

export function hasClauseOrModifier(text: string): boolean {
  return CLAUSE_RE.test(text) || MODIFIER_RE.test(text);
}

function perfectSpell(s: GameState, q: Question, input: string, ok: boolean): boolean {
  if (s.level < PERFECT.from || !ok || q.whispered || q.voiced) return false;
  const sentence = q.write === 'compose' || q.write === 'link' || q.type === 'sentence';
  return sentence && input.trim().split(/\s+/).length >= 4 && hasClauseOrModifier(input);
}

// ---- 结构魔 (B1 红名怪; 游戏设计「怪物图谱」连词和从句) ------------------------------------------------
// The weil worm: the word's own main-clause examples turned into a weil clause, the conjugated verb at the end
// (Ich muss heute arbeiten. → …, weil ich heute arbeiten muss.; Ich stehe um sieben auf. → …, weil ich um sieben
// aufstehe.). Only simple sentences that start with a pronoun subject and the verb are used.

export const STRUCT = { from: 81, chance: 0.2, otherMult: 0.5 };
const SUBJ = ['Ich', 'Du', 'Er', 'Sie', 'Es', 'Wir', 'Ihr', 'Man'];
const PARTICLES = ['ab', 'an', 'auf', 'aus', 'ein', 'mit', 'nach', 'vor', 'zu', 'zurück', 'weg', 'los', 'fest', 'fern', 'her', 'hin', 'um', 'bei', 'vorbei', 'weiter', 'zusammen'];

/** The weil clause of a simple main clause, or null. */
export function weilClause(de: string): string | null {
  const m = /^([A-ZÄÖÜ][a-zäöüß]*) ([a-zäöüß]+)( [^,;:?!]+)?\.$/.exec(de.trim());
  if (!m || !SUBJ.includes(m[1])) return null;
  const subj = m[1] === 'Sie' || m[1] === 'Ihr' || m[1] === 'Man' || m[1] === 'Es' ? (m[1] === 'Sie' ? 'sie' : m[1].toLowerCase()) : m[1].toLowerCase();
  const verb = m[2];
  const rest = (m[3] ?? '').trim().split(' ').filter(Boolean);
  const last = rest[rest.length - 1];
  if (last && PARTICLES.includes(last)) return `weil ${[subj, ...rest.slice(0, -1)].join(' ')} ${last}${verb}`;
  return `weil ${[subj, ...rest].join(' ')} ${verb}`;
}

export function structTasks(w: Word): GramTask[] {
  const out: GramTask[] = [];
  for (const line of EXAMPLES[w.id] ?? []) {
    const p = parse(line);
    if (!p) continue;
    const de = `${p.before}${p.blank}${p.after}`.replace(/\s+/g, ' ').trim();
    const c = weilClause(de);
    if (!c) continue;
    out.push({ sys: 'struct', prompt: '结构魔：把这句改成 weil 从句（动词放句尾），只写 weil 开头的那半句', focus: `Ich bleibe hier, … \n${de}（${p.zh}）`, answer: c, alts: [`${c}.`, `, ${c}`, `Ich bleibe hier, ${c}`, `Ich bleibe hier, ${c}.`], tier: 2, rule: '从句里变位动词放句末：weil ich heute arbeiten muss；可分动词在句末合起来：weil ich um sieben aufstehe。', full: `Ich bleibe hier, ${c}.`, zh: p.zh, wordId: w.id });
  }
  return out;
}

/** 审查 C1 / C2 / C5 (2026-11-26): does the monster's shown line give this question's answer away (a grammar blank in the
 *  same sentence, a perfect participle read out, the word twice in one example)? Then it only mumbles while answering. */
export function lineLeaks(line: string | undefined, q: Question | null | undefined): boolean {
  if (!line || !q) return false;
  const norm = (x: string) => ` ${x.toLowerCase().replace(/[^a-zäöüß\s]/g, ' ').replace(/\s+/g, ' ').trim()} `;
  const l = norm(line.replace(/…\s*mmh\s*…/g, ' '));
  const answers = [q.answer, ...(q.alts ?? []), ...(q.gram?.alts ?? [])].filter((a): a is string => !!a);
  return answers.some((a) => {
    const n = norm(a).trim();
    return n.length >= 2 && l.includes(` ${n} `);
  });
}
