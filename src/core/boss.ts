// Boss fight: a timed conversation. Each answer in a full sentence lands a hit.

import { BOSS_QUESTIONS, type BossQuestion } from '../data/boss';
import { boss2Questions } from '../data/boss2';
import { LINA_NAME_Q, linaQuestions } from '../data/lina';
import { usesDu, weberQuestions } from '../data/weber';
import { identifyQuestion } from './identify';
import { boss3Questions, makeBoard, refreshTimeQuestion, type Board } from '../data/boss3';
import { CONFIG } from './config';
import { normalize } from './grading';
import { pick, shuffle, type Rng } from './rng';
import { maxHp, type GameState } from './state';

export interface BossFight {
  /** 1 = 无名的邻居, 2 = 吞秤者, 3 = 晚点之王, 4 = 幽灵检票员 Lina (elite: a miss is a fine, not damage), 5 = 秩序会登记表 (untimed, no damage), 6 = Mira 的紫装鉴定 (one untimed cloze). */
  which: 1 | 2 | 3 | 4 | 5 | 6;
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
}

export function startBoss(s: GameState, rng: Rng, which: 1 | 2 | 3 | 4 | 5 | 6 = 1): BossFight {
  if (which === 6) {
    const current = identifyQuestion(s, rng);
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
  const ok = !timedOut && (graded ? graded.ok : q.accept.some((re) => re.test(n)));
  let note: string | null = graded?.note ?? null;
  if (!ok && !timedOut) for (const [re, msg] of q.traps ?? []) if (re.test(n)) note = msg;
  if (timedOut) note = '时间到了。';
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
      if (!f.queue.length) f.queue = linaQuestions(rng).slice(1);
      f.current = f.queue.shift()!;
    }
    f.asked = pick(rng, f.current.ask);
    f.turn += 1;
    return { ok, note, model, damageTaken: 0, healed: false };
  }
  if (ok) {
    f.hp -= 1;
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
    // 晚点之王 at half HP: «Der Zug hat zehn Minuten Verspätung.» Every time on the board moves ten minutes on.
    if (f.board && !f.board.delay && f.hp <= f.maxHp / 2) {
      f.board.delay = 10;
      f.delayNow = true;
      f.queue = f.queue.map((x) => refreshTimeQuestion(rng, x, f.board!));
    }
    if (!f.queue.length) f.queue = f.which === 3 ? boss3Questions(rng, f.board!) : f.which === 2 ? boss2Questions(rng, false) : shuffle(rng, BOSS_QUESTIONS.filter((x) => x.id !== 'greet'));
    f.current = f.queue.shift()!;
    f.asked = pick(rng, f.current.ask);
    f.turn += 1;
  }
  return { ok, note, model, damageTaken, healed };
}
