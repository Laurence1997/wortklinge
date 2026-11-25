// 裂隙 (游戏设计 六「裂隙：白板进入的 roguelite」, 0.8, 91 级): an optional random dungeon. Each floor draws words
// you have met (mostly 半名 and due ones, a few 归名 spot checks), each floor ends with a pick of one of three
// temporary blessings, and death ends the run. You go in bare (no gear; skills and talents stay); what you find inside
// is gone when you leave, but boss and exit chests and gold come home. 静默蔓延: every action on a floor past its
// budget costs HP. After max level the floors go deeper: item level = 200 + depth (≤ 230), weekly depth ranking,
// a 言灵精通 point for each first arrival at a tenth floor.
//
// Numbers marked 暂定 are not in the doc yet (floor size, budget, blessing list); they live here so the docs thread
// can set them.

import { isRetired, kindOf, stageOf } from './srs';
import { now, type GameState } from './state';
import type { Word } from './types';
import { WORDS } from '../data/words';

export const RIFT = {
  from: 91,
  /** 暂定: monsters on a floor, chests on a floor, actions before the silence starts biting. */
  fights: 3,
  chests: 1,
  budget: 4,
  /** 暂定: share of max HP the silence takes per action past the budget. */
  silence: 0.1,
  /** 暂定: every 5th floor is a boss floor; after it you may leave with the exit chest. */
  bossEvery: 5,
  bossLvl: 2,
  bossHp: 2.5,
  /** Share of 归名 words drawn as spot checks. */
  checkShare: 0.15,
  /** 满级后深层 (rev 480): item level = 200 + depth, at most 230; a 精通 point at each first 10th floor. */
  deepFrom: 200,
  deepCap: 230,
};

export type BlessId = 'atk' | 'hp' | 'crit' | 'mend' | 'pill' | 'ward' | 'calm';

export const BLESSINGS: Record<BlessId, { zh: string; about: string }> = {
  atk: { zh: '锋', about: '伤害 +15%（这一局）' },
  hp: { zh: '韧', about: '生命上限 +20%（这一局）' },
  crit: { zh: '锐', about: '暴击率 +8%（这一局，仍受 50% 上限）' },
  mend: { zh: '泉', about: '每打完一只怪多回 10% 生命（这一局）' },
  pill: { zh: '药', about: '药片 +2（这一局，出去清掉）' },
  ward: { zh: '静', about: '静默蔓延晚 2 步才开始掉血（这一局）' },
  calm: { zh: '定', about: '每层第一次答错不扣血（这一局）' },
};

export interface RiftRun {
  floor: number;
  /** Fights and chests left on this floor, and actions taken here. */
  fightsLeft: number;
  chestsLeft: number;
  actions: number;
  bless: BlessId[];
  /** Blessings offered after this floor, waiting for a pick. */
  offer?: BlessId[];
  /** Run-only pills (药片). */
  pills: number;
  /** 定: this floor's first miss is still free. */
  calmLeft?: boolean;
  /** Gold banked this run (comes home even on death: it is picked up when won). */
  gold: number;
  /** Real time the run started (ms), for the weekly depth ranking. */
  startedAt: number;
}

export function riftOpen(s: GameState): boolean {
  return s.level >= RIFT.from;
}

export function startRift(s: GameState): RiftRun {
  s.rift = { floor: 1, fightsLeft: RIFT.fights, chestsLeft: RIFT.chests, actions: 0, bless: [], pills: 0, gold: 0, startedAt: Date.now(), calmLeft: false };
  return s.rift;
}

export function bossFloor(r: RiftRun): boolean {
  return r.floor % RIFT.bossEvery === 0;
}

export function blessCount(s: GameState, id: BlessId): number {
  return s.rift?.bless.filter((x) => x === id).length ?? 0;
}

/** Actions left before the silence bites (静 adds 2 per pick). */
export function silenceLeft(r: RiftRun): number {
  return RIFT.budget + 2 * r.bless.filter((x) => x === 'ward').length + (bossFloor(r) ? 2 : 0) - r.actions;
}

/** One action on the floor (a fight or a chest). Returns the HP the silence took (0 inside the budget). */
export function riftAct(s: GameState, maxHp: number): number {
  const r = s.rift!;
  r.actions += 1;
  if (silenceLeft(r) >= 0) return 0;
  const d = Math.max(1, Math.round(maxHp * RIFT.silence));
  s.hp = Math.max(1, s.hp - d);
  return d;
}

/** Words for one rift fight: 半名 and due words first, a few 归名 ones as spot checks; never phrases or numbers. */
export function riftWord(s: GameState, rng: () => number, t = now(s)): Word | null {
  const ok = (w: Word) => w.pos !== 'phr' && w.pos !== 'num' && !w.digit && w.family !== 'truhe';
  const met = WORDS.filter((w) => s.words[w.id] && ok(w) && !isRetired(s.words[w.id]));
  const review = met.filter((w) => kindOf(s, w, t) === 'due' || stageOf(s, w, t) === 2);
  const named = met.filter((w) => stageOf(s, w, t) === 3);
  const pool = rng() < RIFT.checkShare && named.length ? named : review.length ? review : met;
  return pool.length ? pool[Math.floor(rng() * pool.length)] : null;
}

/** Three different blessings to pick from. */
export function offerBlessings(s: GameState, rng: () => number): BlessId[] {
  const ids = Object.keys(BLESSINGS) as BlessId[];
  const out: BlessId[] = [];
  while (out.length < 3) {
    const id = ids[Math.floor(rng() * ids.length)];
    if (!out.includes(id)) out.push(id);
  }
  s.rift!.offer = out;
  return out;
}

export function takeBlessing(s: GameState, id: BlessId): void {
  const r = s.rift!;
  r.bless.push(id);
  r.offer = undefined;
  if (id === 'pill') r.pills += 2;
}

/** Down one floor: a fresh floor, the silence reset. */
export function descend(s: GameState): void {
  const r = s.rift!;
  r.floor += 1;
  r.fightsLeft = bossFloor(r) ? 1 : RIFT.fights;
  r.chestsLeft = bossFloor(r) ? 0 : RIFT.chests;
  r.actions = 0;
  r.calmLeft = r.bless.includes('calm');
  if (s.level >= RIFT.deepFrom) {
    const best = (s.flags.riftDeepBest as number) ?? 0;
    if (r.floor > best) {
      s.flags.riftDeepBest = r.floor;
      // 每 10 层首到给言灵精通点.
      if (r.floor % 10 === 0) s.flags.masteryPts = ((s.flags.masteryPts as number) ?? 0) + 1;
    }
  }
}

/** The floor can be left downward once one fight is done (a boss floor: once the boss is down). */
export function canDescend(r: RiftRun): boolean {
  return bossFloor(r) ? r.fightsLeft === 0 : r.fightsLeft < RIFT.fights;
}

/** Item level of rift drops: your region's 8 tiers before max level, 200 + depth (≤ 230) after. */
export function riftItemLevel(s: GameState, regionIlvl: number): number {
  if (s.level < RIFT.deepFrom || !s.rift) return regionIlvl;
  return Math.min(RIFT.deepCap, RIFT.deepFrom + s.rift.floor);
}

/** Leaving (alive or dead): the run's blessings, pills and temporary things are gone. Returns the depth reached. */
export function endRift(s: GameState): number {
  const depth = s.rift?.floor ?? 0;
  s.flags.riftBest = Math.max((s.flags.riftBest as number) ?? 0, depth);
  s.rift = undefined;
  return depth;
}

// ---- 白板进入: stats inside the rift ----------------------------------------------------------------

/** Gear counts for nothing in the rift (standard stats); skills and talents stay. */
export function bare(s: Pick<GameState, 'rift'>): boolean {
  return !!s.rift;
}

export function riftAtkMult(s: GameState): number {
  return 1 + 0.15 * blessCount(s, 'atk');
}

export function riftHpMult(s: GameState): number {
  return 1 + 0.2 * blessCount(s, 'hp');
}

export function riftCrit(s: GameState): number {
  return 0.08 * blessCount(s, 'crit');
}
