// Boss fight: a timed conversation. Each answer in a full sentence lands a hit.

import { BOSS_QUESTIONS, type BossQuestion } from '../data/boss';
import { boss2Questions } from '../data/boss2';
import { CONFIG } from './config';
import { normalize } from './grading';
import { pick, shuffle, type Rng } from './rng';
import { maxHp, type GameState } from './state';

export interface BossFight {
  /** 1 = 无名的邻居, 2 = 吞秤者. */
  which: 1 | 2;
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

export function startBoss(s: GameState, rng: Rng, which: 1 | 2 = 1): BossFight {
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
  const ok = !timedOut && q.accept.some((re) => re.test(n));
  let note: string | null = null;
  if (!ok && !timedOut) for (const [re, msg] of q.traps ?? []) if (re.test(n)) note = msg;
  if (timedOut) note = '时间到了。';
  const model = q.model.replace('{name}', s.name || 'Lucas');
  let damageTaken = 0;
  let healed = false;
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
    if (!f.queue.length) f.queue = f.which === 2 ? boss2Questions(rng, false) : shuffle(rng, BOSS_QUESTIONS.filter((x) => x.id !== 'greet'));
    f.current = f.queue.shift()!;
    f.asked = pick(rng, f.current.ask);
    f.turn += 1;
  }
  return { ok, note, model, damageTaken, healed };
}
