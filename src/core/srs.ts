// 归名: a word is a monster. It needs 3 kills on 3 different respawns to turn back
// into the thing it names; the last one must be typed with its article (归名一击).

import { CONFIG } from './config';
import { now, type GameState } from './state';
import type { Word } from './types';

export type Kind = 'new' | 'due' | 'shadow' | 'guiming';

/** 0 无名 · 1 裂形 · 2 半名 · 3 归名 */
export type Stage = 0 | 1 | 2 | 3;

export const STAGE_ZH = ['无名', '裂形', '半名', '归名'] as const;

export function kindOf(s: GameState, w: Word, t = now(s)): Kind {
  const p = s.words[w.id];
  if (!p) return 'new';
  if (t >= p.due) return 'due';
  return p.stage === 3 ? 'guiming' : 'shadow';
}

/** The stage the monster shows. A relapsed 归名 word comes back as 半名. */
export function stageOf(s: GameState, w: Word, t = now(s)): Stage {
  const p = s.words[w.id];
  if (!p) return 0;
  if (p.stage === 3 && t >= p.due) return 2;
  return p.stage;
}

/** How many intervals overdue (0 if not due). Overdue monsters get tougher, never lose stage. */
export function overdueSteps(s: GameState, w: Word, t = now(s)): number {
  const p = s.words[w.id];
  if (!p || t < p.due) return 0;
  const interval = p.stage === 1 ? CONFIG.srs.intervals[0] : CONFIG.srs.intervals[1];
  return Math.min(4, Math.floor((t - p.due) / interval));
}

export interface KillOutcome {
  kind: Kind;
  from: Stage;
  to: Stage;
  guiming: boolean;
  /** Choice answers can only bring a word to 半名; tells the UI to explain 归名一击. */
  needsTypedFinal: boolean;
}

/**
 * Record a kill.
 * @param typedFinal the killing blow was typed (默写 / 句子) with the article
 * @param slipped the player answered wrong on this 半名 monster during the fight (长回一颗牙)
 */
export function recordKill(s: GameState, w: Word, typedFinal: boolean, slipped: boolean, t = now(s)): KillOutcome {
  const kind = kindOf(s, w, t);
  const from = stageOf(s, w, t);
  const p = s.words[w.id];
  const interval = (i: 0 | 1) => (w.tutorial ? CONFIG.srs.tutorialInterval : CONFIG.srs.intervals[i]);

  if (kind === 'new' || !p) {
    s.words[w.id] = { stage: 1, due: t + interval(0), firstSeen: t, lastSeen: t, relapse: 0, correct: 0, wrong: 0 };
    return { kind, from: 0, to: 1, guiming: false, needsTypedFinal: false };
  }
  p.lastSeen = t;
  if (kind !== 'due') {
    // Shadows (普通怪) give gold and XP but don't move 归名 forward.
    return { kind, from, to: from, guiming: false, needsTypedFinal: false };
  }
  if (from === 1) {
    p.stage = 2;
    p.due = t + interval(1);
    return { kind, from, to: 2, guiming: false, needsTypedFinal: false };
  }
  // from === 2 (fresh 半名 or a relapsed 归名)
  if (slipped) {
    p.stage = 1;
    p.due = t + interval(0);
    return { kind, from, to: 1, guiming: false, needsTypedFinal: false };
  }
  if (!typedFinal) {
    // Stays 半名 and comes back soon for the 归名一击.
    p.stage = 2;
    p.due = t + interval(0);
    return { kind, from, to: 2, guiming: false, needsTypedFinal: true };
  }
  const wasRelapse = p.stage === 3;
  if (wasRelapse) p.relapse += 1;
  p.stage = 3;
  const r = CONFIG.srs.relapse;
  p.due = t + r[Math.min(p.relapse, r.length - 1)];
  return { kind, from, to: 3, guiming: true, needsTypedFinal: false };
}

export function recordAnswer(s: GameState, w: Word, ok: boolean): void {
  const p = s.words[w.id];
  if (!p) return;
  if (ok) p.correct += 1;
  else p.wrong += 1;
}

/** Tutorial special: the very first bread is named on the spot (系统借给你的). */
export function instantGuiming(s: GameState, w: Word, t = now(s)): void {
  s.words[w.id] = {
    stage: 3,
    due: t + CONFIG.srs.relapse[0],
    firstSeen: t,
    lastSeen: t,
    relapse: 0,
    correct: 1,
    wrong: 0,
  };
}

export function progressSummary(s: GameState, words: Word[], t = now(s)) {
  const c = { new: 0, cracked: 0, half: 0, guiming: 0, due: 0 };
  for (const w of words) {
    const st = stageOf(s, w, t);
    if (st === 0) c.new++;
    else if (st === 1) c.cracked++;
    else if (st === 2) c.half++;
    else c.guiming++;
    if (kindOf(s, w, t) === 'due') c.due++;
  }
  return c;
}

export function atLeastHalfShare(s: GameState, words: Word[]): number {
  let n = 0;
  for (const w of words) if ((s.words[w.id]?.stage ?? 0) >= 2) n++;
  return words.length ? n / words.length : 0;
}
