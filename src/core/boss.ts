// Boss fight: a timed conversation. Each answer in a full sentence lands a hit.

import { BOSS_QUESTIONS, type BossQuestion } from '../data/boss';
import { boss2Questions } from '../data/boss2';
import { LINA_NAME_Q, linaQuestions } from '../data/lina';
import { usesDu, weberQuestions } from '../data/weber';
import { identifyQuestion } from './identify';
import { boss3Questions, makeBoard, refreshTimeQuestion, type Board } from '../data/boss3';
import { CONFIG, levelGapMult } from './config';
import { LATER_BOSS } from '../data/bossesLater';
import { normalize } from './grading';
import { pick, shuffle, type Rng } from './rng';
import { maxHp, type GameState } from './state';

export interface BossFight {
  /** 1 = 无名的邻居, 2 = 吞秤者, 3 = 晚点之王, 4 = 幽灵检票员 Lina (elite: a miss is a fine, not damage), 5 = 秩序会登记表 (untimed, no damage), 6 = Mira 的紫装鉴定 (one untimed cloze). */
  /** 7 = a region 4–12 boss (0.7/0.8, `region` says which; data in src/data/bossesLater.ts). */
  which: 1 | 2 | 3 | 4 | 5 | 6 | 7;
  region?: number;
  /** Lina: her HP is out and she asks «Wie heiße ich?». */
  finalAsked?: boolean;
  /** 晚点之王: the departure board (shifts by ten minutes at half HP). */
  board?: Board;
  /** 晚点之王: the delay was just announced (shown with the next question). */
  delayNow?: boolean;
  hp: number;
  maxHp: number;
  queue: BossQuestion[];
  current: BossQuestion;
  asked: string;
  seconds: number;
  healing: boolean;
  healUsed: boolean;
  turn: number;
  outcome: null | 'win' | 'lose';
  misses: Array<{ asked: string; answer: string; model: string }>;
  /** 驳回书: Frau Weber's help (ready = the next right answer counts twice). */
  assist?: 'ready' | 'used';
}

/** 驳回书: du towards an office, or slang. */
const RUDE = /\b(?:du|dich|dir|dein|deine|deinen|deinem|deiner|hey|hi|ey|krass|bock|alter|digga|nee|noe|quatsch)\b/;

/** First-time and later time limits of the region 4–12 bosses (as 吞秤者 and 晚点之王). */
export const LATER_BOSS_SECONDS = { first: 45, later: 30 };

export function startBoss(s: GameState, rng: Rng, which: 1 | 2 | 3 | 4 | 5 | 6 | 7 = 1, single?: BossQuestion, region?: number): BossFight {
  if (which === 7) {
    const b = LATER_BOSS[region ?? 0];
    if (!b) throw new Error(`no boss for region ${region}`);
    const queue = b.questions(rng);
    const current = queue.shift()!;
    return {
      which, region: b.region, hp: b.hp, maxHp: b.hp, queue, current, asked: pick(rng, current.ask),
      seconds: s.flags[`boss${b.region}Kills`] ? LATER_BOSS_SECONDS.later : LATER_BOSS_SECONDS.first,
      healing: false, healUsed: false, turn: 1, outcome: null, misses: [],
    };
  }
  if (which === 6) {
    const current = single ?? identifyQuestion(s, rng);
    return { which, hp: 1, maxHp: 1, queue: [], current, asked: current.ask[0], seconds: 0, healing: false, healUsed: true, turn: 1, outcome: null, misses: [] };
  }
  if (which === 5) {
    const queue = weberQuestions(rng);
    const current = queue.shift()!;
    return { which, hp: 5, maxHp: 5, queue, current, asked: pick(rng, current.ask), seconds: 0, healing: false, healUsed: true, turn: 1, outcome: null, misses: [] };
  }
  if (which === 4) {
    const queue = linaQuestions(rng);
    const current = queue.shift()!;
    const L = CONFIG.lina;
    return { which, hp: L.hp, maxHp: L.hp, queue, current, asked: pick(rng, current.ask), seconds: L.seconds, healing: false, healUsed: true, turn: 1, outcome: null, misses: [] };
  }
  if (which === 3) {
    const board = makeBoard(rng);
    const queue = boss3Questions(rng, board);
    const current = queue.shift()!;
    const B = CONFIG.boss3;
    return {
      which, board, hp: B.hp, maxHp: B.hp, queue, current, asked: pick(rng, current.ask),
      seconds: s.flags.boss3Kills ? B.laterSeconds : B.firstTimeSeconds,
      healing: false, healUsed: false, turn: 1, outcome: null, misses: [],
    };
  }
  if (which === 2) {
    const queue = boss2Questions(rng, true);
    const current = queue.shift()!;
    const B = CONFIG.boss2;
    return {
      which, hp: B.hp, maxHp: B.hp, queue, current, asked: pick(rng, current.ask),
      seconds: s.flags.boss2Kills ? B.laterSeconds : B.firstTimeSeconds,
      healing: false, healUsed: false, turn: 1, outcome: null, misses: [],
    };
  }
  const first = ['greet', 'name', 'origin'].map((id) => BOSS_QUESTIONS.find((q) => q.id === id)!);
  const rest = shuffle(
    rng,
    BOSS_QUESTIONS.filter((q) => !['greet', 'name', 'origin'].includes(q.id)),
  );
  const queue = [...first, ...rest];
  const current = queue.shift()!;
  return {
    which,
    hp: CONFIG.boss.hp,
    maxHp: CONFIG.boss.hp,
    queue,
    current,
    asked: pick(rng, current.ask),
    seconds: s.flags.bossKills ? CONFIG.boss.laterSeconds : CONFIG.boss.firstTimeSeconds,
    healing: false,
    healUsed: false,
    turn: 1,
    outcome: null,
    misses: [],
  };
}

/** A refilled queue: the question just asked moves to the back, so the same question never comes twice in a row. */
export function noRepeat(queue: BossQuestion[], lastId: string): BossQuestion[] {
  if (queue.length > 1 && queue[0].id === lastId) queue.push(queue.shift()!);
  return queue;
}

/** 1.0.12 试玩 20: a boss pays its full XP and gold on the first kill and on the first kill of each day; a replay the
 *  same day pays half (about what the same minutes in the field pay), never nothing. `dayN` counts today's kills.
 *  Lucas 2026-11-28「按推荐」: a replay (any kill after the very first) of a boss more than BOSS_REPLAY_GAP levels below
 *  you also takes the field's level-gap share (levelGapMult: ×0.2 at 11–20 below, nothing past 20), XP and gold alike,
 *  still never under 10 — a Lv180 player re-fighting bosses 1–19 each day got ~26k XP in ~2 h. First kills unchanged. */
export const BOSS_REPLAY_SHARE = 0.5;
export const BOSS_REPLAY_GAP = 10;
/** Levels of the region 1–3 bosses (无名的邻居 at CONFIG.boss.minLevel, 吞秤者 Lv18, 晚点之王 Lv28); 4–20 in LATER_BOSS. */
export const EARLY_BOSS_LEVEL = { 1: 8, 2: 18, 3: 28 } as const;
export function bossPay(base: number, first: boolean, dayN: number, playerLevel?: number, bossLevel?: number): number {
  const share = first || dayN <= 1 ? 1 : BOSS_REPLAY_SHARE;
  const far = !first && playerLevel !== undefined && bossLevel !== undefined && playerLevel - bossLevel > BOSS_REPLAY_GAP;
  const gap = far ? levelGapMult(playerLevel, bossLevel) : 1;
  if (share === 1 && gap === 1) return base;
  return Math.max(10, Math.round((base * share * gap) / 10) * 10);
}

export interface BossVerdict {
  ok: boolean;
  note: string | null;
  model: string;
  damageTaken: number;
  healed: boolean;
}

export function answerBoss(s: GameState, f: BossFight, input: string, rng: Rng, timedOut = false): BossVerdict {
  const q = f.current;
  const n = normalize(input);
  const graded = q.grade && !timedOut ? q.grade(input) : null;
  const tip = !timedOut && !graded ? q.tips?.find(([re]) => re.test(n)) : undefined;
  const ok = !timedOut && (graded ? graded.ok : q.accept.some((re) => re.test(n)) || !!tip);
  let note: string | null = graded?.note ?? tip?.[1] ?? null;
  if (!ok && !timedOut) for (const [re, msg] of q.traps ?? []) if (re.test(n)) note = msg;
  // 1.0.12 试玩 55: a timeout is said once, in the header (the UI writes 「时间到了」), not again as a note.
  if (timedOut) note = null;
  const model = q.model.replace('{name}', s.name || 'Lucas');
  let damageTaken = 0;
  let healed = false;
  if (f.which === 6) {
    // 鉴定: one try; wrong still reveals the item, just without the better roll.
    if (!ok) f.misses.push({ asked: f.asked, answer: input, model });
    f.hp = 0;
    f.outcome = 'win';
    return { ok, note, model, damageTaken: 0, healed: false };
  }
  if (f.which === 5) {
    // 登记表: untimed and harmless. du towards Frau Weber is not wrong, but has to be said again with Sie;
    // any answer that does not fit is asked again (the form is only handed in complete).
    const du = usesDu(input);
    const fine = ok && !du;
    if (du) note = 'Frau Weber 皱眉：「Wie bitte?」请用 Sie / Ihr 再说一次。';
    if (!fine) {
      if (!du) f.misses.push({ asked: f.asked, answer: input, model });
      f.turn += 1;
      return { ok: false, note, model, damageTaken: 0, healed: false };
    }
    f.hp -= 1;
    if (f.hp <= 0) f.outcome = 'win';
    else {
      f.current = f.queue.shift()!;
      f.asked = pick(rng, f.current.ask);
    }
    f.turn += 1;
    return { ok: true, note, model, damageTaken: 0, healed: false };
  }
  if (f.which === 4) {
    // Lina never hurts you: a miss is a fine and she is gone; her last question is her name.
    if (!ok) {
      s.combo = 0;
      f.misses.push({ asked: f.asked, answer: input, model });
      f.outcome = 'lose';
      return { ok, note, model, damageTaken: 0, healed: false };
    }
    s.combo += 1;
    if (f.finalAsked) {
      f.outcome = 'win';
      return { ok, note, model, damageTaken: 0, healed: false };
    }
    f.hp -= 1;
    if (f.hp <= 0) {
      f.finalAsked = true;
      f.current = LINA_NAME_Q;
    } else {
      if (!f.queue.length) f.queue = noRepeat(linaQuestions(rng).slice(1), q.id);
      f.current = f.queue.shift()!;
    }
    f.asked = pick(rng, f.current.ask);
    f.turn += 1;
    return { ok, note, model, damageTaken: 0, healed: false };
  }
  // 驳回书 (游戏设计 四, row 11): du or slang is stamped 「abgelehnt」 and heals it; a right formal answer cracks the
  // stamp. Frau Weber steps in once at half HP: the next right answer cracks two pieces.
  const formal = f.which === 7 && !!LATER_BOSS[f.region ?? 0]?.formal;
  if (formal && !timedOut && RUDE.test(n)) {
    s.combo = 0;
    f.misses.push({ asked: f.asked, answer: input, model });
    f.hp = Math.min(f.maxHp, f.hp + 1);
    f.turn += 1;
    return { ok: false, note: '「Abgelehnt.」它盖了个章，回了血。对机关要用 Sie 和正式说法。', model, damageTaken: 0, healed: true };
  }
  if (ok) {
    f.hp -= formal && f.assist === 'ready' ? 2 : 1;
    if (formal && f.assist === 'ready') {
      f.assist = 'used';
      note = 'Frau Weber 在旁边点头：「Genau so.」印章裂开了两块。';
    }
    s.combo += 1;
  } else {
    s.combo = 0;
    f.misses.push({ asked: f.asked, answer: input, model });
    damageTaken = Math.max(1, Math.round(maxHp(s) * 0.2));
    s.hp -= damageTaken;
    if (f.healing) {
      f.hp = Math.min(f.maxHp, f.hp + 2);
      healed = true;
    }
  }
  f.healing = false;
  f.delayNow = false;
  if (f.hp <= 0) f.outcome = 'win';
  else if (s.hp <= 0) {
    s.hp = 0;
    f.outcome = 'lose';
  } else {
    // Once per fight, at low HP, it announces a rest (Lv8 lesson: finish it before it heals).
    if (f.hp <= CONFIG.boss.healAt && !f.healUsed) {
      f.healing = true;
      f.healUsed = true;
    }
    if (formal && !f.assist && f.hp <= f.maxHp / 2) {
      f.assist = 'ready';
      note = (note ? note + ' ' : '') + 'Frau Weber 从门口走进来：「Ich helfe Ihnen. Bleiben Sie höflich.」下一句答对，印章裂开两块。';
    }
    // 晚点之王 at half HP: «Der Zug hat zehn Minuten Verspätung.» Every time on the board moves ten minutes on.
    if (f.board && !f.board.delay && f.hp <= f.maxHp / 2) {
      f.board.delay = 10;
      f.delayNow = true;
      f.queue = f.queue.map((x) => refreshTimeQuestion(rng, x, f.board!));
    }
    // Region 4–12 bosses: a fresh draw without the opening questions (no greeting twice).
    // 1.0.12 试玩 96: a fresh draw never starts with the question just answered.
    if (!f.queue.length && f.which === 7) f.queue = noRepeat(LATER_BOSS[f.region!]!.questions(rng).slice(3), q.id);
    if (!f.queue.length) f.queue = noRepeat(f.which === 3 ? boss3Questions(rng, f.board!) : f.which === 2 ? boss2Questions(rng, false) : shuffle(rng, BOSS_QUESTIONS.filter((x) => x.id !== 'greet')), q.id);
    f.current = f.queue.shift()!;
    f.asked = pick(rng, f.current.ask);
    f.turn += 1;
  }
  return { ok, note, model, damageTaken, healed };
}
