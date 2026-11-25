// 红名怪 (游戏设计 六「后期战斗」, B1 起 81 级): white-name monsters leave you alone until you touch them; red-name ones
// rush you on sight. From B1 the fields have born red-name monsters (结构魔: a verb you have met, wrapped in a weil
// worm). Caught by one, you first get a quick question (先手检定): right cancels its first strike, wrong lets it land.
// A player away for more than 3 days finds every red-name asleep on the first day back. Whole families never turn red
// (the most diligent player should not be ambushed the most).

import { structTasks } from './combat';
import type { GameState } from './state';
import type { Word } from './types';

export const RED = {
  from: 81,
  /** 暂定: share of eligible field spawns (met verbs with a weil sentence) that come red. */
  chance: 0.25,
  /** 暂定: how near (px) it notices you, and how fast it runs (px/s; you walk 72). */
  sight: 56,
  speed: 40,
  /** Away this long (days) → the first day back they all sleep. */
  awayDays: 3,
  sleepHours: 24,
};

/** May this field spawn come red? */
export function redEligible(s: GameState, w: Word): boolean {
  return s.level >= RED.from && w.pos === 'v' && !!s.words[w.id] && structTasks(w).length > 0;
}

/** Call once per session start: a long absence puts every red-name to sleep for a day. */
export function noteVisit(s: GameState, t = Date.now()): void {
  const last = (s.flags.lastVisit as number) ?? 0;
  if (last && t - last > RED.awayDays * 86400000) s.flags.redSleepUntil = t + RED.sleepHours * 3600000;
  s.flags.lastVisit = t;
}

export function redAsleep(s: GameState, t = Date.now()): boolean {
  return ((s.flags.redSleepUntil as number) ?? 0) > t;
}
