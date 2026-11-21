// Turn-based combat as a reading game: the monster says its next move in German,
// you pick a counter, then answer a question. You act first.

import { CONFIG, DAY, HOUR, monsterHpAt, playerBaseHp } from './config';
import { gradeTyped, normalize, type Verdict } from './grading';
import { ELEMENT_ZH, generateIntent, INTENT_ZH } from './intents';
import { between, pick, shuffle, type Rng } from './rng';
import { kindOf, stageOf, overdueSteps, type Kind, type Stage } from './srs';
import { affixTotal, attack, critChance, gearPen, hintsPerFight, maxHp, now, type GameState } from './state';
import type { Element, Intent, Move, Word } from './types';
import { has } from './unlocks';
import { fullForm, genderOf, hasArticleQuestion, WORD_BY_ID, WORDS, zhWithPos } from '../data/words';
import { SKILLS, skillLine, skillLinesOpen } from '../data/skills';
import { SAYING_CFG, SAYINGS } from '../data/sayings';
import { expectedSentence, gradeSentence, nextPattern, PATTERNS, type Pattern } from './sentence';
import { EXAMPLES, clozeModeFor, clozeOptions, exampleSplits, gradeCloze, hasExamples, makeCloze, voiceLine, wholeSentence, type ClozeMode } from './cloze';
import { CONJ, PERSON_LABEL, type Person } from '../data/verbs';
import { QTYPES, type QKey } from '../data/questionTypes';
import { CLASSES, critRunNeeded, rank, resMax, shieldReflect, wrongHitShare, type ClassId } from './classes';

/** callout = 点名 in packs (shout the target's article); conj = write a verb form (Lv12+); plural = write the plural (Lv11+). */
/** storm = 书写者「墨水风暴」(type a long word you know); steady = 守护者「稳住」(no question). */
export type QuestionType = 'article' | 'pickDe' | 'pickZh' | 'typed' | 'sentence' | 'skill' | 'callout' | 'conj' | 'plural' | 'storm' | 'steady' | 'saying' | 'cloze';

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
  /** conj questions: other accepted forms. */
  alts?: string[];
  /** storm questions: the long word to write. */
  word?: Word;
  /** conj questions: which person to conjugate for. */
  person?: import('../data/verbs').Person;
  /** saying questions (接句怪): what it shouts and what you finish. */
  say?: SayLine;
  /** sentence questions: which pattern (Ich brauche …, Wo ist …). */
  pattern?: Pattern;
  /** cloze questions: pick / type the dictionary form / type the form the sentence needs. */
  clozeMode?: ClozeMode;
  /** cloze questions: the whole sentence, read aloud after answering. */
  full?: string;
  /** 铭刻: one step harder than usual, ×2 on a hit. */
  inscribed?: boolean;
  /** 低语: the first letter (typed) shown as a hint; ×0.5 on a hit. */
  whisper?: string;
  whispered?: boolean;
  /** 齐鸣: a correct answer hits every monster in the pack. */
  chorus?: boolean;
}

/** Row of the 题型奖励表 (src/data/questionTypes.ts) this question belongs to. */
export function qKey(q: Question): QKey {
  if (q.type === 'cloze') return q.clozeMode === 'form' ? 'clozeForm' : q.clozeMode === 'base' ? 'clozeBase' : 'clozePick';
  if (q.type === 'saying') return q.options ? 'sayingPick' : 'sayingTyped';
  return q.type;
}

/** 0.4 题型档位: 0 = choice (full armor), 1 = typed (half armor), 2 = hard (breaks armor). */
export function qTier(q: Question): 0 | 1 | 2 {
  return QTYPES[qKey(q)].tier;
}

/** Name of the resource: the class's, or 言灵 before you pick one. */
export function resName(s: GameState): string {
  return s.cls ? CLASSES[s.cls].res : '言灵';
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
}

/** Class resource for one fight (shared by a whole pack, like PlayerFx). */
export interface ClassFx {
  res: number;
  /** Typed answers right in a row (书写者 passive). */
  run: number;
  critReady: boolean;
  /** Talent 冷静: the first typed miss this fight keeps your combo. */
  calmUsed: boolean;
  /** Talent 以守为攻: after 稳住, the next correct answer adds a plain hit. */
  yishou?: boolean;
  /** 铭刻 cooldown in turns: carries across fights (the doc's 30 s), cleared at the bonfire. */
  inscribeCd?: number;
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
  /** Greta's class trial this fight belongs to. */
  trial: ClassId | null;
  intent: Intent;
  /** 「Wie viel kostet das?」: next turn's intent, already decided. */
  queued?: Intent;
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
  hintsLeft: number;
  /** 低语 used on this word and not yet answered right without a hint. */
  hinted?: boolean;
  firstCorrectDone: boolean;
  lastKillTyped: boolean;
  skillCooldown: number;
  /** 齐鸣 cooldown in turns (shared by a pack). 铭刻's lives on cfx and carries across fights. */
  chorusCd: number;
  /** Orange 冠词审判: the next hit after a correct article answer deals double. */
  judgement: boolean;
  /** 接句怪: the half sentence it shouts; its first attack question asks for the rest. */
  saying?: SayLine;
  sayingDone?: boolean;
  /** Sentence attacks used on this monster this fight (each pattern once, in tag order). */
  sxUsed?: number;
  /** 认得 / 会写 earned on this word this fight, not yet written to the wordbook (new words join it on the kill). */
  readOk?: number;
  writeOk?: number;
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
  opts: { isEcho?: boolean; tutorial?: Tutorial; trial?: ClassId; rare?: boolean } = {},
): Battle {
  const t = now(s);
  const kind = kindOf(s, word, t);
  const stage = stageOf(s, word, t);
  // The word holding your echo waits at your level, so you can win it back.
  // 0.4: armor doubles per level above you, and a zone mixes words of several levels (schilderstrasse 3–7,
  // kornspeicher 12–20), so a field monster stands at most one level above you.
  // A field you chose to enter above your level (越区引导) keeps its monsters' full level.
  // Review monsters (2026-11-21) stand at your level wherever they turn up: old word, current-region monster, full pay.
  const lvl = opts.isEcho ? Math.min(word.lvl, s.level) : kind === 'due' ? Math.max(word.lvl, s.level) : s.flags[`zoneOk_${word.zone}`] ? word.lvl : Math.min(word.lvl, s.level + CONFIG.monster.maxAbove(s.level));
  const overdue = overdueSteps(s, word, t);
  const st = monsterStats(lvl, stage, kind, overdue);
  const monster: MonsterState = { lvl, hp: st.hp, maxHp: st.hp, dmg: st.dmg, vulnerable: 0, burn: 0, poison: 0, chilled: false, broken: 0 };
  const tutorial = opts.tutorial ?? null;
  if (tutorial === 'loss') {
    monster.lvl = s.level + 6;
    monster.hp = monster.maxHp = 999;
    monster.dmg = Math.ceil(maxHp(s) / 2.5);
  }
  const b: Battle = {
    word,
    kind,
    overdue,
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
    chorusCd: 0,
    judgement: false,
    outcome: null,
    log: [],
    recap: [],
  };
  b.pluralDue = kind === 'due' && !!word.art && !!word.pl && word.pl !== '-' && !word.plOnly && has(s.level, 'plural') && rng() < 1 / 3;
  b.intent = nextIntent(s, b, rng);
  return b;
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
  } else if (tut === 'break' && b.turn <= 2) {
    intent = generateIntent(rng, { ...ctx, force: { kind: 'defend', line: 'Ich verteidige mich.', zh: '我要防守。' } });
  } else if (tut === 'negation' && b.turn === 1) {
    intent = generateIntent(rng, {
      ...ctx,
      force: { kind: 'wait', shown: 'attack', hits: 0, line: 'Ich greife jetzt nicht an.', zh: '我现在不进攻。（这回合不攻击）', layers: ['negation'] },
    });
  } else if (b.flees && b.turn >= 2 && (ctx.hpRatio < 0.5 || b.turn >= 3)) {
    intent = generateIntent(rng, { ...ctx, force: { kind: 'flee', line: 'Ich muss los!', zh: '我得走了！（这回合打不死它，它就跑了）' } });
  } else if (tut === 'packCharge' && b.turn === 1) {
    intent = generateIntent(rng, { ...ctx, force: { kind: 'charge', line: 'Moment!', zh: '等一下！（在蓄力）' } });
  } else if (tut === 'heal' && ctx.hpRatio <= 0.5 && !b.trapUsed) {
    intent = generateIntent(rng, { ...ctx, force: { kind: 'heal', line: 'Ich mache eine Pause.', zh: '我休息一下。（要回血）' } });
  } else if (b.monster.chilled && b.intent?.kind === 'charge') {
    // Ice pushed the charge back: it is still charging.
    intent = { ...b.intent, line: 'Moment … noch nicht …', zh: '等等……还没好……（冰把蓄力往后推了）' };
  } else {
    intent = generateIntent(rng, ctx);
  }
  if (intent.layers.includes('negation') || (intent.layers.includes('object') && intent.kind === 'wait') || (tut === 'heal' && intent.kind === 'heal')) b.trapUsed = true;
  if (intent.kind === 'charge') b.turnsSinceCharge = 0;
  else b.turnsSinceCharge += 1;
  // 怪的台词 (2026-11-21): outside tutorials it mumbles one of its own example sentences with its name swallowed
  // (a listening clue that never says the answer). Only the big attack keeps the shouted stock lines as a warning.
  if (!tut && intent.kind !== 'charge' && intent.kind !== 'flee' && b.saying && !b.sayingDone) {
    // 接句怪: until you finish its line, the line is its half sentence (no mumbled example giving the rest away).
    intent = { ...intent, ...shoutLine(b.saying) };
  } else if (!tut && intent.kind !== 'charge' && intent.kind !== 'flee') {
    const v = voiceLine(b.word, b.turn);
    if (v) intent = { ...intent, line: v.line, zh: v.zh, full: v.full, fullZh: v.fullZh };
  }
  return intent;
}

/** What a 接句怪 shouts while its line is open. */
export function shoutLine(say: SayLine): { line: string; zh: string; full: undefined; fullZh: undefined } {
  return { line: `${say.a} …`, zh: '（它喊出半句，等你接上。）', full: undefined, fullZh: undefined };
}

// ---- Questions -------------------------------------------------------------

function distractors(rng: Rng, w: Word, field: 'de' | 'zh', n: number): string[] {
  const samePos = WORDS.filter((x) => x.id !== w.id && x.pos === w.pos && x[field] !== w[field]);
  const pool = samePos.length >= n ? samePos : WORDS.filter((x) => x.id !== w.id);
  const out: string[] = [];
  for (const x of shuffle(rng, pool)) {
    const v = field === 'de' ? x.de : x.zh;
    if (!out.includes(v) && v !== (field === 'de' ? w.de : w.zh)) out.push(v);
    if (out.length >= n) break;
  }
  return out;
}

/** Moves on the bar. 0.4: no sentence button (the whole sentence is the finisher); 铭刻 / 低语 / 齐鸣 change the next question. */
export function availableMoves(s: GameState, b: Battle, alive = 1): Move[] {
  if (b.tutorial === 'loss') return ['attack'];
  const moves: Move[] = ['attack'];
  if (has(s.level, 'inscribe')) moves.push('inscribe');
  if (has(s.level, 'whisper')) moves.push('whisper');
  if (has(s.level, 'chorus') && alive > 1) moves.push('chorus');
  if (has(s.level, 'sentence')) moves.push('sentence');
  if (has(s.level, 'skills') && s.skills.length) moves.push('skill');
  if (s.cls) moves.push('cls');
  return moves;
}

/** Whether a move can be used right now (cooldown, resource). */
export function moveReady(s: GameState, b: Battle, move: Move): boolean {
  if (move === 'skill') return b.skillCooldown === 0;
  if (move === 'cls') return !!s.cls && b.cfx.res >= CLASSES[s.cls].skillCost;
  if (move === 'inscribe') return !b.cfx.inscribeCd;
  // 低语 is free, but a word you were hinted on is asked again without it first.
  if (move === 'whisper') return !b.hinted && !s.words[b.word.id]?.hinted;
  if (move === 'sentence') return resMax(s) > 0 && b.cfx.res >= resMax(s);
  if (move === 'chorus') return b.chorusCd === 0;
  return true;
}

/** Share of a hit this monster's armor stops, for the given question tier (0.4 战斗修正版):
 *  A = 2^(monster level − your level) × (1 − gear penetration), halved for typed questions, 0 for hard ones
 *  or while broken; the hit is divided by (1 + A), i.e. A / (1 + A) is stopped (at most 90%). */
export function effArmor(s: GameState, b: Battle, tier: 0 | 1 | 2): number {
  const C = CONFIG.armor;
  if (tier === 2 || b.monster.broken > 0) return 0;
  let a = Math.pow(C.base, b.monster.lvl - s.level) * Math.max(0, 1 - gearPen(s));
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

export function makeQuestion(s: GameState, b: Battle, move: Move, rng: Rng, skillId?: string, inPack = false): Question {
  const w = b.word;
  const isNoun = hasArticleQuestion(w);
  const canType = has(s.level, 'typing');
  const promptZh = w.digit ? w.digit : w.zh;

  if (move === 'cls') {
    if (s.cls === 'guardian') return { type: 'steady', prompt: '稳住：花 3 沉着，挡下这回合的第一击', focus: '稳住', options: ['稳住！'], answer: '稳住！' };
    const lw = stormWord(s, rng, w);
    return { type: 'storm', prompt: '墨水风暴：默写这个词（名词带冠词），字母越多伤害越高', focus: zhWithPos(lw), withArticle: hasArticleQuestion(lw), answer: fullForm(lw), word: lw };
  }
  if (move === 'skill') {
    const sk = SKILLS[skillId ?? s.skills[0]];
    const uses = s.skillUses[sk.id] ?? 0;
    const line = skillLine(sk, uses);
    const open = skillLinesOpen(sk, uses);
    return { type: 'skill', prompt: `释放「${sk.zh}」：写对整句${sk.lines.length > 1 ? `（已解锁 ${open} / ${sk.lines.length} 句）` : ''}`, focus: line.zh, answer: line.de, skillId: sk.id };
  }
  const article = (): Question => ({
    type: 'article',
    prompt: '选对冠词',
    focus: w.de,
    options: ['der', 'die', 'das'],
    answer: w.art!,
  });
  const pickDe = (): Question => {
    const opts = shuffle(rng, [w.de, ...distractors(rng, w, 'de', 2)]);
    return { type: 'pickDe', prompt: '选出对应的德语', focus: promptZh, options: opts, answer: w.de };
  };
  const pickZh = (): Question => {
    const opts = shuffle(rng, [w.zh, ...distractors(rng, w, 'zh', 2)]);
    return { type: 'pickZh', prompt: '它在说什么？选出意思', focus: fullForm(w), options: opts, answer: w.zh };
  };
  const typed = (): Question => ({
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
  const canConj = w.pos === 'v' && has(s.level, 'conjugation') && !!CONJ[w.de];
  /** One step harder than q, or null when nothing harder fits. */
  const harder = (q: Question): Question | null => {
    const t = qTier(q);
    if (t === 2 || !canType) return null;
    if (t === 0) {
      if (q.type === 'cloze') return clozeQ(s, w, rng, s.level >= 11 ? 'form' : 'base') ?? typed();
      return canConj ? conj() : typed();
    }
    const form = s.level >= 11 && hasExamples(w) ? clozeQ(s, w, rng, 'form') : null;
    return (form && form.clozeMode === 'form' ? form : null) ?? sentenceQ();
  };
  const fresh = b.kind === 'new' && b.stage === 0 && b.step < 2;
  const am: Move = move === 'inscribe' || move === 'whisper' || move === 'chorus' ? 'attack' : move;

  // 终结技 (0.4): spends a full resource bar on the whole sentence. Every monster has one: its sentence pattern
  // when the word is in your wordbook, otherwise one of its example sentences (or a template).
  if (move === 'sentence') {
    const fin = sentenceQ();
    if (fin) return fin;
    const ws = wholeSentence(w, rng);
    return { type: 'sentence', prompt: '终结技：看中文，写整句', focus: ws.zh, answer: ws.answer };
  }
  let q = ladderQ();
  // 难题就是预告 (0.4): a charging monster asks the hardest question (Lv11+ form cloze, before that typing);
  // a multi-hit one asks one step harder. A word you have never answered keeps its usual question.
  if (am === 'attack' && q.type !== 'saying' && q.type !== 'callout' && !b.tutorial && !fresh && canType) {
    if (b.intent.kind === 'charge') {
      const form = s.level >= 11 && hasExamples(w) ? clozeQ(s, w, rng, 'form') : null;
      const hard = form?.clozeMode === 'form' ? form : qTier(q) === 0 ? (canConj ? conj() : typed()) : q;
      if (qTier(hard) > qTier(q)) q = hard;
    } else if (b.intent.kind === 'attack' && b.intent.hits > 1) q = harder(q) ?? q;
  }
  if (move === 'inscribe') q = { ...(harder(q) ?? q), inscribed: true };
  if (move === 'whisper') q = whisperOf(q, w);
  if (move === 'chorus') q = { ...q, chorus: true };
  return q;

  function ladderQ(): Question {
  if (am === 'attack' && b.saying && !b.sayingDone && !inPack) return sayingQuestion(s, b.saying, rng);
  if (am === 'attack' && inPack && isNoun && !b.named && b.stage === 0) return callout();
  // 防御 (Lv7+): a written answer breaks the guard. A word not yet at the typing step gets its usual choice question (×0.3).
  if (am === 'attack' && b.intent.kind === 'defend' && canType && (b.tutorial === 'break' || !(b.kind === 'new' && b.stage === 0 && b.step < 2))) {
    if (!isNoun && CONJ[w.de] && has(s.level, 'conjugation')) return conj();
    return typed();
  }

  // Normal attack.
  // 书写者试炼: everything is typed.
  if (b.trial === 'writer' && canType && am === 'attack') return typed();
  if (b.tutorial === 'loss') return isNoun ? article() : pickZh();
  // 半名 and due: the killing blow must be typed, so offer typing.
  if (b.stage === 2 && b.kind === 'due' && canType) return typed();
  // Question ladder: each correct hit asks about another side of the word, never the same
  // question twice in a row (Lucas, playtest 2026-11-19: three der clicks in a row is boring).
  // New words: article → hear it and pick the meaning → type it (once typing is unlocked).
  // 完形填空: words with example sentences get the cloze into the ladder (Lucas 2026-11-20).
  const cl = hasExamples(w) ? () => clozeQ(s, w, rng) ?? (isNoun ? article() : pickZh()) : null;
  if (canConj) {
    const verbLadder = b.stage === 0 ? [pickZh, cl ?? conj, conj, pickDe] : [conj, cl ?? pickDe, conj, pickZh];
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
          ? lv6 ? [article, cl, typed, cl] : [article, cl, pickZh, cl]
          : lv6 ? [pickZh, cl, typed, cl] : [pickZh, cl, pickDe, cl]
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
        ? [article, pickZh, ...(canType ? [typed] : []), pickDe]
        : [pickZh, pickDe, ...(canType ? [typed] : [])]
      : isNoun
        ? canType
          ? [article, typed, pickDe]
          : [article, pickDe, pickZh]
        : canType
          ? [pickDe, typed, pickZh]
          : [pickDe, pickZh];
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
  if (q.type === 'sentence' && q.pattern) hint = `${PATTERNS[q.pattern].lead} …`;
  else if (q.withArticle && w.art) hint = `${w.art} ${w.de[0]}…`;
  else if (q.type === 'cloze' && a.includes(' ')) hint = `${a.split(' ')[0]} ${a.split(' ')[1][0]}…`;
  return { ...q, whisper: hint, whispered: true };
}

/** 完形填空 for this word at the player's level, or null when no sentence fits. */
export function clozeQ(s: GameState, w: Word, rng: Rng, mode: ClozeMode = clozeModeFor(s.level)): Question | null {
  const c = makeCloze(w, mode, rng) ?? (mode === 'base' ? makeCloze(w, 'form', rng) : null);
  if (!c) return null;
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
    return st.due <= t + 12 * HOUR || (st.wrong > 0 && t - st.lastSeen <= 3 * DAY);
  });
  let pool = byLength(urgent).slice(0, 12);
  if (pool.length < 4) pool = [...pool, ...byLength(known.filter((x) => !pool.includes(x))).slice(0, 12 - pool.length)];
  return pool.length ? pick(rng, pool) : fallback;
}

export function letters(w: Word): number {
  return w.de.replace(/[^A-Za-zÄÖÜäöüß]/g, '').length;
}

/** Region 2 (Lv11+): the sentence attack is 「Ich nehme …」, with plurals. */
export function nehmeRegion(s: GameState): boolean {
  return s.region === 2 && has(s.level, 'plural');
}

/** The class resource object kept on the save; 冷静 (calmUsed) is per fight. */
export function classFx(s: GameState): ClassFx {
  s.cfx ??= { res: 0, run: 0, critReady: false, calmUsed: false };
  s.cfx.calmUsed = false;
  return s.cfx;
}

export function resetClassFx(s: GameState): void {
  s.cfx = { res: 0, run: 0, critReady: false, calmUsed: false };
}

export function knownMoechteNouns(s: GameState): Word[] {
  return WORDS.filter((w) => w.moechte && s.words[w.id]);
}

export function gradeQuestion(_s: GameState, b: Battle, q: Question, input: string): Verdict & { word?: Word } {
  switch (q.type) {
    case 'article':
    case 'callout':
    case 'pickDe':
    case 'pickZh': {
      const ok = input === q.answer;
      return { ok, notes: ok ? [] : [`正确答案：${q.type === 'article' ? fullForm(b.word) : q.answer}`], correct: q.answer! };
    }
    case 'typed':
      return gradeTyped(input, b.word, !!q.withArticle);
    case 'storm':
      return gradeTyped(input, q.word!, !!q.withArticle);
    case 'steady':
      return { ok: true, notes: [], correct: q.answer! };
    case 'cloze': {
      const ok = gradeCloze(input, q.answer!);
      return { ok, notes: ok ? [q.full!] : [`正确答案：${q.answer}`, q.full!], correct: q.answer! };
    }
    case 'saying': {
      const x = q.say!;
      // The second half alone, or the whole sentence typed out, both count.
      const ok = sayKey(input) === sayKey(x.b) || sayKey(input) === sayKey(`${x.a} ${x.b}`);
      return { ok, notes: ok ? [`${x.a} ${x.b} —— ${x.zh}`] : [`正确答案：${x.a} ${x.b}（${x.zh}）`], correct: x.b };
    }
    case 'sentence': {
      if (q.pattern) return gradeSentence(input, b.word, q.pattern);
      const ok = sayKey(input) === sayKey(q.answer!);
      return { ok, notes: ok ? [] : [`正确答案：${q.answer}`], correct: q.answer!, word: ok ? b.word : undefined };
    }
    case 'skill': {
      const sk = SKILLS[q.skillId!];
      const fake: Word = { id: sk.id, de: q.answer ?? sk.de, zh: sk.zh, pos: 'phr', family: 'echo', lvl: 1, zone: 'camp' };
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
  const ignoreDefend = s.cls === 'writer' && typedLike && rank(s, 'tengxie') > 0;
  let d = overkill;
  if (next.intent.kind === 'defend' && !ignoreDefend) d *= CONFIG.damage.vsDefend;
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
function syncShared(from: Battle, pack: Battle[]) {
  for (const o of pack) {
    if (o === from) continue;
    o.skillCooldown = from.skillCooldown;
    o.chorusCd = from.chorusCd;
    o.hintsLeft = from.hintsLeft;
    o.judgement = from.judgement;
    o.fx = from.fx;
    o.cfx = from.cfx;
  }
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
): TurnReport {
  const log: LogLine[] = [];
  const multi = pack.length > 1;
  const tagOf = (x: Battle) => (multi ? `${x.named || x.stage > 0 ? fullForm(x.word) : '它'} ` : '它');
  const alive0 = pack.filter((x) => !x.outcome);
  const dmgMult = packDamageMult(alive0.length);
  const verdict = gradeQuestion(s, b, q, input);
  const m = b.monster;
  const intent = b.intent;
  const ok = verdict.ok;
  // 点名 that names another monster in the pack hits that one for half damage (and counts as wrong).
  const stray = q.type === 'callout' && !ok ? alive0.find((x) => x !== b && x.word.art === input) ?? null : null;
  const clozeTyped = q.type === 'cloze' && q.clozeMode !== 'pick';
  const typedQ = q.type === 'typed' || q.type === 'sentence' || q.type === 'conj' || q.type === 'plural' || clozeTyped;
  const kills: Battle[] = [];
  let lastHitter: Battle | null = null;
  let playerDamage = 0;
  let crit = false;
  let newSpell = false;
  let element: Element | null = null;
  // 读对意图: a correct hit that interrupts (蓄力/回血/逃跑) or a written answer that breaks a guard.
  const writtenQ = q.type === 'typed' || q.type === 'conj' || q.type === 'plural' || q.type === 'storm' || clozeTyped || (q.type === 'callout' && !!q.withArticle);
  const readRight = ok && move !== 'cls' && (['charge', 'heal', 'flee'].includes(intent.kind) || (intent.kind === 'defend' && writtenQ));
  let blocking = false;
  let interrupted = false;
  b.qIndex += 1;
  if (q.type === 'sentence') b.sxUsed = (b.sxUsed ?? 0) + 1;
  // 低语 (2026-11-21): a hinted answer is not 会写/认得, earns no resource and cannot be the 归名 blow.
  // The word is marked so its next appearance asks it again without the hint.
  if (q.whispered) {
    b.hinted = true;
    if (s.words[b.word.id]) s.words[b.word.id].hinted = true;
  } else if (ok && b.hinted) {
    b.hinted = false;
    if (s.words[b.word.id]) delete s.words[b.word.id].hinted;
  }
  if (ok && !q.whispered) {
    if (q.type === 'typed' || q.type === 'conj' || q.type === 'plural' || q.type === 'sentence' || (q.type === 'cloze' && q.clozeMode !== 'pick')) b.writeOk = (b.writeOk ?? 0) + 1;
    else if (q.type === 'article' || q.type === 'pickDe' || q.type === 'pickZh' || q.type === 'callout' || q.type === 'cloze') b.readOk = (b.readOk ?? 0) + 1;
  }
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

  // Class resources: 书写者 earns 墨水 for typed answers, 守护者 earns 沉着 for every answer.
  const cfx = b.cfx;
  const critWasReady = cfx.critReady; // earned this turn = the *next* hit crits
  const typedLike = q.type === 'typed' || q.type === 'conj' || q.type === 'plural' || q.type === 'storm' || clozeTyped;
  if (move === 'cls' && s.cls) cfx.res = Math.max(0, cfx.res - CLASSES[s.cls].skillCost);
  // 0.4 techniques: 低语 is free (its price: no 会写, no resource, no 归名); 铭刻 / 齐鸣 cooldowns.
  if (move === 'sentence') cfx.res = 0;
  // 铭刻 has no cooldown (Lucas 2026-11-20: encourage it); a miss on an inscribed question costs 1 resource.
  if (q.inscribed && !ok) cfx.res = Math.max(0, cfx.res - CONFIG.tech.inscribeMissCost);
  if (move === 'inscribe') cfx.inscribeCd = CONFIG.tech.inscribeCd;
  if (move === 'chorus') b.chorusCd = CONFIG.tech.chorusCd;
  // 题型奖励表: a correct answer earns its row's resource (guardians: +1 for every answer instead, their passive).
  if (ok && s.cls !== 'guardian' && move !== 'cls' && !q.whispered) cfx.res += QTYPES[qKey(q)].res;
  if (s.cls === 'writer' && typedLike && q.type !== 'storm') {
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
  if (s.cls === 'writer' && !ok) cfx.run = 0;
  if (s.cls === 'guardian' && move !== 'cls' && !q.whispered) cfx.res += 1 + (!ok && rank(s, 'chenzhuo') ? 1 : 0);
  cfx.res = Math.min(cfx.res, resMax(s));

  // --- 1. You act first.
  if (ok) {
    b.wrongStreak = 0;
    if (q.type === 'callout') b.named = true;
    if (q.type !== 'saying') b.step += 1;
    s.combo += 1;
    if (readRight && move !== 'skill') s.combo += 1; // 读对意图并出对克制招式，连击额外 +1
    s.bestCombo = Math.max(s.bestCombo, s.combo);

    if (move === 'skill') {
      const sk = SKILLS[q.skillId!];
      b.skillCooldown = sk.cooldown;
      const said = q.answer ?? sk.de;
      const before = skillLinesOpen(sk, s.skillUses[sk.id] ?? 0);
      s.skillUses[sk.id] = (s.skillUses[sk.id] ?? 0) + 1;
      if (skillLinesOpen(sk, s.skillUses[sk.id]) > before) log.push({ text: `「${sk.zh}」解锁了新的说法，下次放它时会考。`, tone: 'sys' });
      if (sk.id === 'keineAhnung') {
        b.fx.shield = true;
        log.push({ text: `「${said}」——字在你身前立成一面墙。`, tone: 'good' });
      } else if (sk.id === 'wieBitte') {
        interrupted = true;
        log.push({ text: `「${said}」——它愣住了。`, tone: 'good' });
      } else if (sk.id === 'zuTeuer') {
        b.fx.cheap = true;
        log.push({ text: `「${said}」——它们下手轻了一半。`, tone: 'good' });
      } else if (sk.id === 'wieViel') {
        b.fx.peek = 2;
        log.push({ text: `「${said}」——你看见了它们下一步。`, tone: 'good' });
      } else if (sk.id === 'stimmtSo') {
        b.fx.stimmt = true;
        log.push({ text: `「${said}」——这一场，金币翻倍。`, tone: 'good' });
      } else if (sk.id === 'freutMich') {
        const heal = Math.round(maxHp(s) * 0.3);
        s.hp = Math.min(maxHp(s), s.hp + heal);
        log.push({ text: `「${said}」——生命 +${heal}。`, tone: 'good' });
      }
    } else if (move === 'cls' && q.type === 'steady') {
      blocking = true;
      if (rank(s, 'yishou')) cfx.yishou = true;
      log.push({ text: '「稳住」——你沉下身子。第一下，挡得住。', tone: 'good' });
    } else {
      const atk = attack(s);
      // 低语: the hinted question hits like one tier easier (typed → choice armor, hard → typed, no armor break).
      const tier = (q.whispered ? Math.max(0, qTier(q) - 1) : qTier(q)) as 0 | 1 | 2;
      let mult = between(rng, CONFIG.damage.roll[0], CONFIG.damage.roll[1]);
      const pen = s.cls === 'writer' ? 0.05 * rank(s, 'bifeng') : 0;
      // 0.4: the question type no longer multiplies damage (armor does that, below). Gear affixes stay.
      if (q.type === 'storm') {
        const n = letters(q.word!);
        mult *= ((1 + (0.15 + 0.03 * rank(s, 'changci')) * n) / 1.4) * (1 + pen); // same ratio to typing as before
        log.push({ text: `墨水风暴：${fullForm(q.word!)}，${n} 个字母。`, tone: 'good' });
      } else if (typedLike) mult *= 1 + affixTotal(s, 'typedDmg') + pen;
      if (q.type === 'sentence') {
        mult *= 1 + affixTotal(s, 'sentenceDmg');
        if (has(s.level, 'layerElement')) element = ELEMENT_BY_GENDER[genderOf(b.word) ?? 'n'];
      }
      if (q.inscribed) mult *= CONFIG.tech.inscribeMult;

      const breaking = intent.kind === 'defend' && writtenQ;
      const g = genderOf(b.word);
      if (g === 'm') mult *= 1 + affixTotal(s, 'vsMasc');
      if (g === 'f') mult *= 1 + affixTotal(s, 'vsFem');
      if (g === 'n') mult *= 1 + affixTotal(s, 'vsNeut');
      mult *= comboMult(s.combo);

      // Crits: forced ones first (接句怪, 初识暴击), then the random roll.
      if (q.type === 'saying') {
        crit = true;
      } else if (b.stage === 0 && b.kind === 'new' && !b.firstCorrectDone) {
        crit = true;
        newSpell = true;
      } else if ((s.flags.wortgewalt as number) > 0) {
        crit = true;
      } else if (critWasReady) {
        crit = true;
        cfx.critReady = false;
      } else {
        const chance = critChance(s) + (q.type === 'article' || q.type === 'pickDe' || q.type === 'pickZh' ? affixTotal(s, 'choiceCrit') : 0);
        crit = rng() < chance;
      }
      if (q.type !== 'saying') b.firstCorrectDone = true;
      if (crit) mult *= CONFIG.player.critMult;
      // 护甲和破甲: a hard question (or writing through a guard) breaks the armor for this hit and the next two.
      const wasBroken = m.broken > 0;
      if ((tier === 2 || breaking) && !wasBroken) {
        m.broken = CONFIG.armor.breakHits + (breaking && s.cls === 'writer' && rank(s, 'tengxie') ? 1 : 0);
        log.push({ text: breaking ? `写对了。壳裂开了：这一下和之后 ${m.broken - 1} 下无视护甲。` : `难题破甲：这一下和之后 ${m.broken - 1} 下无视护甲。`, tone: 'good' });
      }
      const armor = effArmor(s, b, tier);
      if (m.broken > 0) m.broken -= 1;
      mult *= 1 - armor;
      const judged = b.judgement;
      if (judged) {
        mult *= 2;
        b.judgement = false;
      }
      if (q.type === 'article' && Object.values(s.equipped).some((it) => it?.legendary === 'articleJudgement')) b.judgement = true;

      const charging = intent.kind === 'charge';
      if (intent.kind === 'defend' && !breaking && !wasBroken) mult *= CONFIG.damage.vsDefend;
      mult = Math.min(mult, CONFIG.damage.maxMultiplierOfBase);
      playerDamage = Math.max(1, Math.round(atk * mult));
      if (b.tutorial === 'loss') playerDamage = Math.min(playerDamage, 3);
      // The saying alone never finishes it: the word itself still has to be answered.
      if (q.type === 'saying') playerDamage = Math.max(1, Math.min(playerDamage, m.hp - 1));

      m.hp -= playerDamage;
      s.stats.maxHit = Math.max(s.stats.maxHit, playerDamage);
      if (crit) s.stats.crits += 1;
      if (charging || intent.kind === 'heal' || intent.kind === 'flee') interrupted = true;
      if (cfx.yishou && move !== 'cls') {
        cfx.yishou = false;
        const d = Math.max(1, Math.round(attack(s) * (1 - effArmor(s, b, 0)) * between(rng, CONFIG.damage.roll[0], CONFIG.damage.roll[1])));
        m.hp -= d;
        playerDamage += d;
        log.push({ text: `以守为攻：顺势再一下，${d}。`, tone: 'good' });
      }
      if (element === 'ice') m.chilled = true;
      if (element === 'fire') m.burn = CONFIG.status.burnTurns;
      if (element === 'poison') m.poison = Math.min(CONFIG.status.poisonMaxStacks, m.poison + 1);

      // 齐鸣: the same answer lands on every other monster still standing (each against its own armor).
      if (q.chorus && multi) {
        const hitOthers: string[] = [];
        for (const o of pack) {
          if (o === b || o.outcome) continue;
          const d = Math.max(1, Math.round(atk * comboMult(s.combo) * between(rng, CONFIG.damage.roll[0], CONFIG.damage.roll[1]) * (1 - effArmor(s, o, tier))));
          o.monster.hp = Math.max(0, o.monster.hp - d);
          if (o.monster.broken > 0) o.monster.broken -= 1;
          hitOthers.push(`${o.named || o.stage > 0 ? fullForm(o.word) : '另一只'} ${d}`);
        }
        if (hitOthers.length) log.push({ text: `齐鸣：${hitOthers.join('，')}。`, tone: 'good' });
      }

      const tag = (judged ? '冠词审判！' : '') + (crit ? (newSpell ? '新言灵！暴击 ' : '暴击 ') : '');
      const el = element ? `（${ELEMENT_ZH[element]}）` : '';
      log.push({ text: `${tag}你造成 ${playerDamage} 点伤害${el}。`, tone: crit ? 'crit' : 'good' });
      if (intent.kind === 'defend' && !breaking && !wasBroken) log.push({ text: '它缩着。选择题只刮三成，默写才撬得开。', tone: 'info' });
    }

    if (m.hp <= 0) {
      const overkill = -m.hp;
      m.hp = 0;
      b.outcome = 'win';
      if (q.type === 'storm' && multi && overkill > 0) spillStorm(s, pack, b, overkill, typedLike, log);
      b.lastKillTyped = typedQ && !q.whispered && (q.type === 'sentence' ? verdict.word?.id === b.word.id : true);
      if (q.type === 'typed' && !q.withArticle && hasArticleQuestion(b.word)) b.lastKillTyped = false;
      // A noun's 归名 blow must write the article: only a form cloze that includes one (den Tee) counts.
      if (q.type === 'cloze' && hasArticleQuestion(b.word) && !(q.clozeMode === 'form' && ARTICLE_RE.test(q.answer ?? ''))) b.lastKillTyped = false;
      log.push({ text: `${tagOf(b)}散了。`, tone: 'sys' });
      kills.push(b);
    }
  } else {
    if (s.cls === 'writer' && typedLike && rank(s, 'lengjing') && !cfx.calmUsed) {
      cfx.calmUsed = true;
      log.push({ text: '冷静：写错了，连击还在。', tone: 'info' });
    } else s.combo = 0;
    b.wrongStreak += 1;
    if (b.stage === 2 && !b.slipped && b.kind === 'due') {
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
    return finish(s, b, { correct: ok, verdict, playerDamage, crit, newSpell, monsterDamage: 0, parried: false, element, log, outcome: 'win', readRight, kills, killer: null });
  }

  // --- 2. Every monster still standing acts.
  let monsterDamage = 0;
  let parried = false;
  const target = b;
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
  const chillMult = (m.chilled ? CONFIG.status.iceDamageMult : 1) * (1 + CONFIG.armor.monsterDmgPerLevelBelow * Math.max(0, m.lvl - s.level));

  const hitPlayer = (raw: number) => {
    let d = Math.max(1, Math.round(raw * (1 - wrongReduce) * (ok ? 1 : wrongHitShare(s)) * (b.fx.cheap ? 0.5 : 1)));
    if (b.fx.shield) {
      b.fx.shield = false;
      const back = Math.max(1, Math.round(d * shieldReflect(s)));
      m.hp = Math.max(0, m.hp - back);
      say({ text: `墙挡住了，反弹 ${back}。`, tone: 'good' });
      d = 0;
    }
    monsterDamage += d;
    s.hp -= d;
    if (d > 0) lastHitter = b;
  };

  if (interrupted && intent.kind === 'charge' && b === target) {
    say({ text: '打断了！它憋的那口气散了。', tone: 'good' });
  } else if (interrupted && b === target) {
    /* 「Wie bitte?」cancelled the intent */
  } else {
    switch (intent.kind) {
      case 'attack': {
        let per = m.dmg * dmgMult * chillMult * (monsterCrit ? 1.5 : 1);
        // 多段: a correct answer on this monster stops it after the first hit.
        const hitsN = ok && b === target && intent.hits > 1 ? 1 : intent.hits;
        if (hitsN < intent.hits) say({ text: '它只咬到一口。', tone: 'good' });
        for (let i = 0; i < hitsN; i++) {
          if (i === 0 && blocking) {
            parried = true;
            const counter = Math.max(1, Math.round(attack(s) * CONFIG.player.critMult * (1 + (s.cls === 'guardian' ? 0.2 * rank(s, 'fanji') : 0))));
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
        const heavy = m.dmg * dmgMult * chillMult * CONFIG.monster.chargeMult * (monsterCrit ? 1.5 : 1);
        if (blocking) {
          hitPlayer(heavy / 2);
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
  for (const x of pack) if (!x.outcome) tickMonster(x);
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
  if ((b.cfx.inscribeCd ?? 0) > 0) b.cfx.inscribeCd! -= 1;
  if (b.chorusCd > 0) b.chorusCd -= 1;
  b.fx.cheap = false;
  if ((s.flags.wortgewalt as number) > 0) s.flags.wortgewalt = (s.flags.wortgewalt as number) - 1;
  if (s.combo >= 50 && !s.flags.wortgewaltUsedAt50) {
    s.flags.wortgewalt = 3;
    s.flags.wortgewaltUsedAt50 = true;
  }
  if (s.combo < 50) s.flags.wortgewaltUsedAt50 = false;

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
  } else {
    for (const x of pack) {
      if (x.outcome) continue;
      x.turn += 1;
      x.intent = x.queued ?? nextIntent(s, x, rng);
      x.queued = (b.fx.peek ?? 0) > 0 ? nextIntent(s, x, rng) : undefined;
    }
    if ((b.fx.peek ?? 0) > 0) b.fx.peek! -= 1;
  }
  syncShared(b, pack);
  const outcome: Battle['outcome'] = pack.every((x) => x.outcome === 'win') ? 'win' : s.hp <= 0 ? 'lose' : b.outcome;
  return finish(s, b, { correct: ok, verdict, playerDamage, crit, newSpell, monsterDamage, parried, element, log, outcome, readRight, kills, killer });
}

function finish(_s: GameState, b: Battle, r: TurnReport): TurnReport {
  b.log.push(...r.log);
  return r;
}

export function intentLabel(i: Intent): string {
  return INTENT_ZH[i.shown];
}

export function pickHint(b: Battle, q: Question): string | null {
  if (!q.answer || b.hintsLeft <= 0) return null;
  b.hintsLeft -= 1;
  const a = q.answer;
  if (q.withArticle && b.word.art) return `${b.word.art} ${b.word.de[0]}…`;
  return `${a[0]}…`;
}

export function randomFrom<T>(rng: Rng, arr: T[]): T {
  return pick(rng, arr);
}
