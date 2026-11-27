// 排行榜 (Lucas 2026-11-25): 每日榜、总榜、语法榜 — study volume only, anyone can hide. The client writes the counters
// into the save (`board`); the server function `leaderboard(kind)` ranks them (supabase/migrations/0005).
// 每日榜 = today's right answers (the day log); 总榜 = 归名 words; 语法榜 = 语法星位 trials + 阶段突破 passed, with the
// grammar accuracy shown (needs 50 grammar answers to be listed). 暂定: counted on the client, so a tampered save could
// cheat; before strangers join, the daily count moves to the server.

import { starsPassed } from './classes';
import { STAGES, stagePassed } from './stages';
import { todayLog, type GameState } from './state';

export interface BoardSave {
  /** Berlin calendar day of `daily` (YYYY-MM-DD). */
  day: string;
  daily: number;
  mastered: number;
  trials: number;
  gramOk: number;
  gramN: number;
  hidden: boolean;
}

export const BOARD = { gramMin: 50 };
export type BoardKind = 'daily' | 'total' | 'gram';
export const BOARD_ZH: Record<BoardKind, string> = { daily: '每日榜', total: '总榜', gram: '语法榜' };

export function berlinDay(t = Date.now()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Berlin', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(t));
}

/** A grammar question was answered (语法榜 accuracy). */
export function noteGram(s: GameState, ok: boolean): void {
  const b = (s.board ??= emptyBoard());
  b.gramN += 1;
  if (ok) b.gramOk += 1;
}

function emptyBoard(): BoardSave {
  return { day: berlinDay(), daily: 0, mastered: 0, trials: 0, gramOk: 0, gramN: 0, hidden: false };
}

/** Refresh the derived counters before a save goes up. */
export function stampBoard(s: GameState): BoardSave {
  const b = (s.board ??= emptyBoard());
  b.day = berlinDay();
  b.daily = todayLog(s).correct;
  b.mastered = Object.values(s.words).filter((p) => p.stage === 3 || p.retired).length;
  b.trials = starsPassed(s).length + STAGES.filter((x) => stagePassed(s.flags, x.stage)).length;
  b.hidden = !!s.settings.hideBoard;
  return b;
}
