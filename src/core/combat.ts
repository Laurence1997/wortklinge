// Turn-based combat as a reading game: the monster says its next move in German,
// you pick a counter, then answer a question. You act first.

import { CONFIG } from './config';
import { gradeMoechte, gradeNehme, gradeTyped, type Verdict } from './grading';
import { COUNTER, ELEMENT_ZH, generateIntent, INTENT_ZH } from './intents';
import { between, pick, shuffle, type Rng } from './rng';
import { kindOf, stageOf, overdueSteps, type Kind, type Stage } from './srs';
import { affixTotal, attack, critChance, hintsPerFight, maxHp, now, type GameState } from './state';
import type { Element, Intent, Move, Word } from './types';
import { has } from './unlocks';
import { fullForm, genderOf, hasArticleQuestion, WORDS } from '../data/words';
import { SKILLS } from '../data/skills';
import { CONJ, PERSON_LABEL, type Person } from '../data/verbs';
import { CLASSES, critRunNeeded, rank, resMax, shieldReflect, wrongHitShare, type ClassId } from './classes';

/** callout = 点名 in packs (shout the target's article); conj = write a verb form (Lv12+); plural = write the plural (Lv11+). */
/** storm = 书写者「墨水风暴」(type a long word you know); steady = 守护者「稳住」(no question). */
export type QuestionType = 'article' | 'pickDe' | 'pickZh' | 'typed' | 'sentence' | 'skill' | 'callout' | 'conj' | 'plural' | 'storm' | 'steady';

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
  /** EXPERIMENT: skips its next action (ink spill). */
  stunned?: boolean;
  /** Lv11+: about 1 in 3 due nouns ask for the plural. */
  pluralDue: boolean;
  /** Rewards already paid (packs settle each kill at once). */
  settled?: boolean;
  hintsLeft: number;
  firstCorrectDone: boolean;
  lastKillTyped: boolean;
  skillCooldown: number;
  /** Orange 冠词审判: the next hit after a correct article answer deals double. */
  judgement: boolean;
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
  const hp = Math.max(4, Math.round((m.hpBase + m.hpPerLevel * level) * stageMult * (1 + m.overdueHpStep * overdue)));
  const dmg = Math.max(1, Math.round(m.dmgBase + m.dmgPerLevel * level));
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
  const lvl = opts.isEcho ? Math.min(word.lvl, s.level) : word.lvl;
  const overdue = overdueSteps(s, word, t);
  const st = monsterStats(lvl, stage, kind, overdue);
  const monster: MonsterState = { lvl, hp: st.hp, maxHp: st.hp, dmg: st.dmg, vulnerable: 0, burn: 0, poison: 0, chilled: false };
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
  } else if (tut === 'block' && b.turn <= 2) {
    intent = generateIntent(rng, { ...ctx, force: { kind: 'attack', line: 'Ich greife an!', zh: '我要进攻！' } });
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
  return intent;
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

export function availableMoves(s: GameState, b: Battle): Move[] {
  const moves: Move[] = ['attack'];
  if (has(s.level, 'blockBreak')) moves.push('block', 'break');
  if (has(s.level, 'sentence')) moves.push('sentence');
  if (has(s.level, 'skills') && s.skills.length) moves.push('skill');
  if (s.cls) moves.push('cls');
  if (b.tutorial === 'loss') return ['attack'];
  return moves;
}

export function makeQuestion(s: GameState, b: Battle, move: Move, rng: Rng, skillId?: string, inPack = false): Question {
  const w = b.word;
  const isNoun = hasArticleQuestion(w);
  const canType = has(s.level, 'typing');
  const promptZh = w.digit ? w.digit : w.zh;

  if (move === 'sentence' && nehmeRegion(s)) {
    return { type: 'sentence', prompt: '句式攻击：Ich nehme + 数字 + 复数（zwei Äpfel），或 einen / eine / ein + 名词。复数句不吃重复递减', focus: 'Ich nehme …' };
  }
  if (move === 'sentence') {
    return { type: 'sentence', prompt: '句式攻击：Ich möchte + einen / eine / ein + 你见过的名词', focus: 'Ich möchte …' };
  }
  if (move === 'cls') {
    if (s.cls === 'guardian') return { type: 'steady', prompt: '稳住：花 3 沉着，挡下这回合的第一击', focus: '稳住', options: ['稳住！'], answer: '稳住！' };
    const lw = stormWord(s, rng, w);
    return { type: 'storm', prompt: '墨水风暴：默写这个词（名词带冠词），字母越多伤害越高', focus: lw.zh, withArticle: hasArticleQuestion(lw), answer: fullForm(lw), word: lw };
  }
  if (move === 'skill') {
    const sk = SKILLS[skillId ?? s.skills[0]];
    return { type: 'skill', prompt: `释放「${sk.zh}」：写对整句`, focus: sk.zhLine, answer: sk.de, skillId: sk.id };
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
    focus: promptZh,
    withArticle: isNoun,
    answer: fullForm(w),
  });

  // 点名 (packs): an attack on a monster whose article you haven't called yet = shout its article.
  const callout = (): Question => EXP.typedCallout && s.cls === 'writer' ? ({
    type: 'callout',
    prompt: '点名：默写你盯住的那只怪的全名（带冠词）',
    focus: w.zh,
    withArticle: true,
    answer: fullForm(w),
  }) : ({
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

  if (move === 'attack' && inPack && isNoun && !b.named && b.stage === 0) return callout();
  if (move === 'break') return canType ? typed() : isNoun ? article() : pickDe();
  if (move === 'block') return isNoun && rng() < 0.5 ? article() : pickDe();

  // Normal attack.
  // 书写者试炼: everything is typed.
  if (b.trial === 'writer' && canType && move === 'attack') return typed();
  if (b.tutorial === 'loss') return isNoun ? article() : pickZh();
  // 半名 and due: the killing blow must be typed, so offer typing.
  if (b.stage === 2 && b.kind === 'due' && canType) return typed();
  // Question ladder: each correct hit asks about another side of the word, never the same
  // question twice in a row (Lucas, playtest 2026-11-19: three der clicks in a row is boring).
  // New words: article → hear it and pick the meaning → type it (once typing is unlocked).
  const canConj = w.pos === 'v' && has(s.level, 'conjugation') && !!CONJ[w.de];
  if (canConj) {
    const verbLadder = b.stage === 0 ? [pickZh, conj, pickDe, conj] : [conj, pickDe, conj, pickZh];
    return verbLadder[b.step % verbLadder.length]();
  }
  if (b.pluralDue && canType) {
    const pl = [plural, typed, article];
    return pl[b.step % pl.length]();
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

/** A long word you have met (longest few of them), for 墨水风暴. Falls back to the target's word. */
export function stormWord(s: GameState, rng: Rng, fallback: Word): Word {
  const known = WORDS.filter((x) => s.words[x.id] && x.pos !== 'phr' && x.pos !== 'num' && !x.digit);
  const pool = known.sort((a, b) => letters(b) - letters(a)).slice(0, 12);
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

export function gradeQuestion(s: GameState, b: Battle, q: Question, input: string): Verdict & { word?: Word } {
  switch (q.type) {
    case 'callout':
      if (q.withArticle) return gradeTyped(input, b.word, true);
      return { ok: input === q.answer, notes: input === q.answer ? [] : [`正确答案：${q.answer}`], correct: q.answer! };
    case 'article':
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
    case 'sentence':
      return nehmeRegion(s) ? gradeNehme(input, knownMoechteNouns(s)) : gradeMoechte(input, knownMoechteNouns(s));
    case 'skill': {
      const sk = SKILLS[q.skillId!];
      const fake: Word = { id: sk.id, de: sk.de, zh: sk.zh, pos: 'phr', family: 'echo', lvl: 1, zone: 'camp' };
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

const ELEMENT_BY_GENDER: Record<'m' | 'f' | 'n' | 'pl', Element> = { m: 'ice', f: 'fire', n: 'poison', pl: 'lightning' };

/**
 * 墨水风暴 overkill in a pack spills once onto the next monster (charging first, then lowest HP),
 * under that monster's own intent (defend still cuts it, 誊写 still ignores it). It never kills:
 * the monster stays at 1 HP at least, so the last hit is still its own word (归名, review, kill count).
 */
export function spillStorm(s: GameState, pack: Battle[], from: Battle, overkill: number, typedLike: boolean, log: LogLine[], kills: Battle[] = []): number {
  const floorOf = (x: Battle) => (EXP.noFloorNew && x.kind === 'new' ? 0 : 1);
  const rest = pack.filter((x) => x !== from && !x.outcome && x.monster.hp > floorOf(x));
  if (EXP.stunAll) for (const x of pack) if (x !== from && !x.outcome) x.stunned = true;
  if (!rest.length) return 0;
  const next = rest.find((x) => x.intent.kind === 'charge') ?? rest.reduce((a, x) => (x.monster.hp < a.monster.hp ? x : a));
  const ignoreDefend = s.cls === 'writer' && typedLike && rank(s, 'tengxie') > 0;
  let d = overkill;
  if (next.intent.kind === 'defend' && !ignoreDefend) d *= CONFIG.damage.vsDefend;
  d = Math.min(Math.round(d), next.monster.hp - floorOf(next));
  if (d <= 0) return 0;
  next.monster.hp -= d;
  if (EXP.spillSkip) next.stunned = true;
  else if (EXP.spillInterrupt && next.intent.kind === 'charge') next.stunned = true;
  if (next.monster.hp <= 0) {
    next.outcome = 'win';
    next.lastKillTyped = false;
    kills.push(next);
  }
  log.push({ text: `墨水溅到${fullForm(next.word)}身上：${d} 点伤害。最后一下还得写它自己的词。`, tone: 'good' });
  return d;
}

/** EXPERIMENT (writer-exp branch only): toggles for sim2 variants. */
export const EXP = { veil: false, stunAll: false, spillSkip: false, spillInterrupt: false, noFloorNew: false, typedCallout: false };

/** Per-monster damage multiplier in a pack, so 2–3 monsters together hit about 1.2–1.35× one monster. */
export function packDamageMult(alive: number): number {
  return alive <= 1 ? 1 : alive === 2 ? CONFIG.pack.dmgMult[0] : CONFIG.pack.dmgMult[1];
}

/** Pack-wide values live on every member; copy them from the one that acted. */
function syncShared(from: Battle, pack: Battle[]) {
  for (const o of pack) {
    if (o === from) continue;
    o.skillCooldown = from.skillCooldown;
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
  const typedQ = q.type === 'typed' || q.type === 'sentence' || q.type === 'conj' || q.type === 'plural';
  const kills: Battle[] = [];
  let lastHitter: Battle | null = null;
  let playerDamage = 0;
  let crit = false;
  let newSpell = false;
  let element: Element | null = null;
  const readRight = ok && COUNTER[intent.kind] === (move === 'sentence' ? 'attack' : move);
  let blocking = false;
  let interrupted = false;
  b.qIndex += 1;

  // Class resources: 书写者 earns 墨水 for typed answers, 守护者 earns 沉着 for every answer.
  const cfx = b.cfx;
  const critWasReady = cfx.critReady; // earned this turn = the *next* hit crits
  const typedLike = q.type === 'typed' || q.type === 'conj' || q.type === 'plural' || q.type === 'storm' || (q.type === 'callout' && !!q.withArticle);
  if (move === 'cls' && s.cls) cfx.res = Math.max(0, cfx.res - CLASSES[s.cls].skillCost);
  if (s.cls === 'writer' && typedLike && q.type !== 'storm') {
    if (ok) {
      cfx.res += 1;
      cfx.run += 1;
      if (cfx.run >= critRunNeeded(s) && !cfx.critReady) {
        cfx.critReady = true;
        cfx.run = 0;
        log.push({ text: `连续默写答对 ${critRunNeeded(s)} 题：下一击必定暴击。`, tone: 'good' });
      }
    }
  }
  const veil = EXP.veil && s.cls === 'writer' && typedLike && q.type !== 'storm' && ok;
  // Any wrong answer breaks the writer's streak (it carries across fights otherwise).
  if (s.cls === 'writer' && !ok) cfx.run = 0;
  if (s.cls === 'guardian' && move !== 'cls') cfx.res += 1 + (!ok && rank(s, 'chenzhuo') ? 1 : 0);
  cfx.res = Math.min(cfx.res, resMax(s));

  // --- 1. You act first.
  if (ok) {
    b.wrongStreak = 0;
    if (q.type === 'callout') b.named = true;
    b.step += 1;
    s.combo += 1;
    if (readRight && move !== 'skill') s.combo += 1; // 读对意图并出对克制招式，连击额外 +1
    s.bestCombo = Math.max(s.bestCombo, s.combo);

    if (move === 'skill') {
      const sk = SKILLS[q.skillId!];
      b.skillCooldown = sk.cooldown;
      s.skillUses[sk.id] = (s.skillUses[sk.id] ?? 0) + 1;
      if (sk.id === 'keineAhnung') {
        b.fx.shield = true;
        log.push({ text: `「${sk.de}」——言灵护盾挡在你身前。`, tone: 'good' });
      } else if (sk.id === 'wieBitte') {
        interrupted = true;
        log.push({ text: `「${sk.de}」——它愣住了，这回合的打算作废。`, tone: 'good' });
      } else if (sk.id === 'zuTeuer') {
        b.fx.cheap = true;
        log.push({ text: `「${sk.de}」——它们被你压了价，这回合下手轻了一半。`, tone: 'good' });
      } else if (sk.id === 'wieViel') {
        b.fx.peek = 2;
        log.push({ text: `「${sk.de}」——你看穿了它们接下来的打算。`, tone: 'good' });
      } else if (sk.id === 'stimmtSo') {
        b.fx.stimmt = true;
        log.push({ text: `「${sk.de}」——这场打死的怪，金币翻倍。`, tone: 'good' });
      } else if (sk.id === 'freutMich') {
        const heal = Math.round(maxHp(s) * 0.3);
        s.hp = Math.min(maxHp(s), s.hp + heal);
        log.push({ text: `「${sk.de}」——你回复了 ${heal} 点生命。`, tone: 'good' });
      }
    } else if (move === 'cls' && q.type === 'steady') {
      blocking = true;
      log.push({ text: '「稳住」——你沉下身子，这回合的第一击会被挡下。', tone: 'good' });
    } else if (move === 'block') {
      blocking = true;
      log.push({ text: '你摆好架势，准备格挡。', tone: 'info' });
      if (s.cls === 'guardian' && rank(s, 'yishou')) {
        const d = Math.max(1, Math.round(attack(s) * CONFIG.damage.choice * between(rng, CONFIG.damage.roll[0], CONFIG.damage.roll[1])));
        m.hp -= d;
        playerDamage = d;
        log.push({ text: `以守为攻：格挡的同时顺手一击，${d} 点。`, tone: 'good' });
      }
    } else {
      const atk = attack(s);
      let mult = between(rng, CONFIG.damage.roll[0], CONFIG.damage.roll[1]);
      const pen = s.cls === 'writer' ? 0.05 * rank(s, 'bifeng') : 0;
      if (q.type === 'typed' || q.type === 'conj' || q.type === 'plural') mult *= CONFIG.damage.typed * (1 + affixTotal(s, 'typedDmg') + pen);
      else if (q.type === 'storm') {
        const n = letters(q.word!);
        mult *= (1 + (0.15 + 0.03 * rank(s, 'changci')) * n) * (1 + pen);
        log.push({ text: `墨水风暴：${fullForm(q.word!)}，${n} 个字母。`, tone: 'good' });
      }
      else if (q.type === 'sentence') {
        const noun = verdict.word!;
        // A plural sentence (Ich nehme zwei Äpfel) is always fresh.
        const recent = (verdict as { plural?: boolean }).plural ? 0 : s.recentNouns.slice(-5).filter((id) => id === noun.id).length;
        mult *= CONFIG.damage.sentence * CONFIG.damage.freshness[Math.min(recent, 3)] * (1 + affixTotal(s, 'sentenceDmg'));
        s.recentNouns.push(noun.id);
        if (s.recentNouns.length > 10) s.recentNouns.shift();
        if (has(s.level, 'layerElement')) element = ELEMENT_BY_GENDER[genderOf(noun) ?? 'n'];
        if (recent > 0) log.push({ text: `${noun.de} 用得太勤，威力只剩 ${Math.round(CONFIG.damage.freshness[Math.min(recent, 3)] * 100)}%。换个名词试试。`, tone: 'info' });
      } else mult *= CONFIG.damage.choice;

      if (move === 'break') mult *= CONFIG.damage.breakMult;
      const g = genderOf(b.word);
      if (g === 'm') mult *= 1 + affixTotal(s, 'vsMasc');
      if (g === 'f') mult *= 1 + affixTotal(s, 'vsFem');
      if (g === 'n') mult *= 1 + affixTotal(s, 'vsNeut');
      mult *= comboMult(s.combo);

      // Crits: forced ones first (初识暴击), then the random roll.
      if (b.stage === 0 && b.kind === 'new' && !b.firstCorrectDone) {
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
      b.firstCorrectDone = true;
      if (crit) mult *= CONFIG.player.critMult;
      if (m.vulnerable > 0) mult *= CONFIG.damage.vulnerable;
      const judged = b.judgement;
      if (judged) {
        mult *= 2;
        b.judgement = false;
      }
      if (q.type === 'article' && Object.values(s.equipped).some((it) => it?.legendary === 'articleJudgement')) b.judgement = true;

      const charging = intent.kind === 'charge';
      const ignoreDefend = s.cls === 'writer' && typedLike && rank(s, 'tengxie') > 0;
      if (intent.kind === 'defend' && (move === 'attack' || move === 'sentence' || move === 'cls') && !ignoreDefend) mult *= CONFIG.damage.vsDefend;
      if (move === 'break' && charging) mult = 0; // 破防对蓄力无效
      mult = Math.min(mult, CONFIG.damage.maxMultiplierOfBase);
      playerDamage = Math.max(move === 'break' && charging ? 0 : 1, Math.round(atk * mult));
      if (b.tutorial === 'loss') playerDamage = Math.min(playerDamage, 3);

      m.hp -= playerDamage;
      s.stats.maxHit = Math.max(s.stats.maxHit, playerDamage);
      if (crit) s.stats.crits += 1;
      if (charging && move !== 'break') interrupted = true;
      if (move === 'break' && intent.kind === 'defend') {
        m.vulnerable = CONFIG.status.vulnerableTurns + 1;
        log.push({ text: '护甲被你撬开了！接下来 2 回合它受到的伤害 +50%。', tone: 'good' });
      }
      if (element === 'ice') m.chilled = true;
      if (element === 'fire') m.burn = CONFIG.status.burnTurns;
      if (element === 'poison') m.poison = Math.min(CONFIG.status.poisonMaxStacks, m.poison + 1);

      const tag = (judged ? '冠词审判！' : '') + (crit ? (newSpell ? '新言灵！暴击 ' : '暴击 ') : '');
      const el = element ? `（${ELEMENT_ZH[element]}）` : '';
      log.push({ text: `${tag}你造成 ${playerDamage} 点伤害${el}。`, tone: crit ? 'crit' : 'good' });
      if (move === 'break' && charging) log.push({ text: '破防对蓄力没用：它根本没在防守。', tone: 'bad' });
      if (intent.kind === 'defend' && (move === 'attack' || move === 'sentence'))
        log.push({ text: '它在防御，伤害只剩三成。读到防御时用破防更好。', tone: 'info' });
    }

    if (m.hp <= 0) {
      const overkill = -m.hp;
      m.hp = 0;
      b.outcome = 'win';
      if (q.type === 'storm' && multi && overkill > 0) spillStorm(s, pack, b, overkill, typedLike, log, kills);
      b.lastKillTyped = typedQ && (q.type === 'sentence' ? verdict.word?.id === b.word.id : true);
      if (q.type === 'typed' && !q.withArticle && hasArticleQuestion(b.word)) b.lastKillTyped = false;
      log.push({ text: `${tagOf(b)}被打散了——你先出手，它的打算作废。`, tone: 'sys' });
      kills.push(b);
    }
  } else {
    if (s.cls === 'writer' && typedLike && rank(s, 'lengjing') && !cfx.calmUsed) {
      cfx.calmUsed = true;
      log.push({ text: '冷静：这次默写错了，连击还在。', tone: 'info' });
    } else s.combo = 0;
    b.wrongStreak += 1;
    if (b.stage === 2 && !b.slipped && b.kind === 'due') {
      b.slipped = true;
      log.push({ text: '答错了，它长回一颗牙（退回裂形）。', tone: 'bad' });
    }
    if (stray) {
      const d = Math.max(1, Math.round(attack(s) * CONFIG.damage.choice * CONFIG.pack.strayMult * between(rng, CONFIG.damage.roll[0], CONFIG.damage.roll[1])));
      stray.monster.hp = Math.max(0, stray.monster.hp - d);
      log.push({ text: `你喊的是 ${input}，打中的却是 ${fullForm(stray.word)}：只有 ${d} 点伤害。`, tone: 'bad' });
      if (stray.monster.hp <= 0) {
        stray.outcome = 'win';
        stray.lastKillTyped = false;
        kills.push(stray);
        log.push({ text: `${fullForm(stray.word)} 被打散了。`, tone: 'sys' });
      }
    } else log.push({ text: q.type === 'callout' ? `群里没有冠词是 ${input} 的怪：落空了。` : '招式失败：这一回合什么都没做成。', tone: 'bad' });
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
  const chillMult = m.chilled ? CONFIG.status.iceDamageMult : 1;

  const hitPlayer = (raw: number) => {
    let d = Math.max(1, Math.round(raw * (1 - wrongReduce) * (ok ? 1 : wrongHitShare(s)) * (b.fx.cheap ? 0.5 : 1) * (veil ? 0.7 : 1)));
    if (b.fx.shield) {
      b.fx.shield = false;
      const back = Math.max(1, Math.round(d * shieldReflect(s)));
      m.hp = Math.max(0, m.hp - back);
      say({ text: `护盾挡下这一击，反弹 ${back} 点伤害。`, tone: 'good' });
      d = 0;
    }
    monsterDamage += d;
    s.hp -= d;
    if (d > 0) lastHitter = b;
  };

  if (b.stunned) {
    b.stunned = false;
    say({ text: '墨水糊住了它，这回合没能出手。', tone: 'good' });
  } else if (interrupted && intent.kind === 'charge' && b === target) {
    say({ text: '你打断了它的蓄力！', tone: 'good' });
  } else if (interrupted && b === target) {
    /* 「Wie bitte?」cancelled the intent */
  } else {
    switch (intent.kind) {
      case 'attack': {
        let per = m.dmg * dmgMult * chillMult * (monsterCrit ? 1.5 : 1);
        for (let i = 0; i < intent.hits; i++) {
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
          const hitsTxt = intent.hits > 1 ? `${intent.hits} 下` : '';
          const el = intent.element !== 'phys' ? `（${ELEMENT_ZH[intent.element]}）` : '';
          say({ text: `${monsterCrit ? '它看准你的破绽，暴击！' : ''}它${hitsTxt}打中你，共 ${monsterDamage} 点${el}。`, tone: 'bad' });
          if (intent.element === 'ice') b.fx.chilled = true;
          if (intent.element === 'fire') b.fx.burn = CONFIG.status.burnTurns;
          if (intent.element === 'poison') b.fx.poison = Math.min(CONFIG.status.poisonMaxStacks, b.fx.poison + 1);
        }
        if (blocking && intent.hits > 1) say({ text: '格挡只挡得住第一下。', tone: 'info' });
        per = 0;
        break;
      }
      case 'defend':
        if (blocking) say({ text: '它在防御，你的格挡白白浪费了一回合。', tone: 'info' });
        else say({ text: '它缩起来防守。', tone: 'info' });
        break;
      case 'charge': {
        if (m.chilled) {
          say({ text: '冰冻拖住了它，大招推迟了。', tone: 'good' });
          break;
        }
        const heavy = m.dmg * dmgMult * CONFIG.monster.chargeMult * (monsterCrit ? 1.5 : 1);
        if (blocking) {
          hitPlayer(heavy / 2);
          say({ text: `你挡下一半大招，受到 ${monsterDamage} 点伤害。`, tone: 'bad' });
        } else {
          hitPlayer(heavy);
          say({ text: `蓄满的大招砸中你：${monsterDamage} 点！`, tone: 'bad' });
        }
        break;
      }
      case 'heal': {
        const heal = Math.round(m.maxHp * 0.35);
        m.hp = Math.min(m.maxHp, m.hp + heal);
        say({ text: `它回复了 ${heal} 点生命。${m.vulnerable > 0 ? '易伤还在。' : ''}`, tone: 'bad' });
        break;
      }
      case 'flee':
        b.outcome = 'fled';
        say({ text: '「Ich muss los!」——它抱着箱子钻进人群，跑了。', tone: 'bad' });
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
  if (ok && move === 'block' && intent.kind === 'wait')
    b.recap.push(`第 ${b.turn} 回合：它说「${intent.line}」，${intent.layers.includes('object') ? '是 mich（它自己）' : '有 nicht'}，其实不打。直接攻击更好。`);
  if (move === 'block' && intent.kind === 'attack' && intent.hits > 1 && ok)
    b.recap.push(`第 ${b.turn} 回合：「${intent.line}」是连击，格挡只挡第一下。`);
  if (move === 'break' && intent.kind === 'charge')
    b.recap.push(`第 ${b.turn} 回合：「${intent.line}」是蓄力，攻击才能打断，破防无效。`);
  if ((move === 'attack' || move === 'sentence') && intent.kind === 'defend' && has(s.level, 'blockBreak'))
    b.recap.push(`第 ${b.turn} 回合：「${intent.line}」是防御，破防更好。`);


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
