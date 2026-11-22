// 归名: a word is a monster. It needs 3 kills on 3 different respawns to turn back
// into the thing it names; the last one must be typed with its article (归名一击).

import { CONFIG } from './config';
import { dayKey, now, type GameState } from './state';
import type { WordProgress } from './types';
import type { Word } from './types';

export type Kind = 'new' | 'due' | 'shadow' | 'guiming';

/** 0 无名 · 1 裂形 · 2 半名 · 3 归名 */
export type Stage = 0 | 1 | 2 | 3;

export const STAGE_ZH = ['无名', '裂形', '半名', '归名'] as const;

// ---- 斩杀 (0.6.x): words you can already write leave the reviews ---------------------------
// First clean 会写 in the field → 待验证 (pend), gone for the rest of that day. On a later day it comes back
// with a glitched name and a fixed first question (typing, no hint): right → 可斩杀 and the word retires.
// A retired word comes back once after 30 days as a 回响 check; right → retired for good.

export function isRetired(p: WordProgress | undefined): boolean {
  return !!p?.retired;
}

/** 待验证 since today: it doesn't spawn again before the day switches (04:00, like the dailies). */
export function pendingToday(p: WordProgress | undefined, t: number): boolean {
  return !!p?.pend && dayKey(p.pend) === dayKey(t);
}

/** The 回响 check of a retired word is due. */
export function recheckDue(p: WordProgress | undefined, t: number): boolean {
  return !!p?.retired && !p.sure && t >= p.retired + CONFIG.srs.recheck;
}

/** Its next fight is a verification: 待验证 from an earlier day, or a due 回响 check. */
export function verifyOf(p: WordProgress | undefined, t: number): 'pend' | 'recheck' | null {
  if (!p) return null;
  if (p.pend && !pendingToday(p, t)) return 'pend';
  if (recheckDue(p, t)) return 'recheck';
  return null;
}

/** 斩杀 status for the wordbook: 学习中 / 会写 1/2 / 待验证 / 已斩杀 / 回响抽查中. */
export function cutStatus(p: WordProgress | undefined, t: number): string {
  if (!p) return '';
  if (p.retired) return recheckDue(p, t) ? '回响抽查中' : p.sure ? '已斩杀（永久）' : '已斩杀';
  if (p.pend) return pendingToday(p, t) ? '会写 1/2（明天验证）' : '待验证';
  return '学习中';
}

export function needsVerify(s: GameState, w: Word, t = now(s)): boolean {
  return !!verifyOf(s.words[w.id], t);
}

/** Retire a word (斩杀): it counts as 归名 everywhere and leaves the reviews. */
export function retire(s: GameState, w: Word, t = now(s)): void {
  const p = s.words[w.id];
  if (!p) return;
  if (p.retired && !p.sure && t >= p.retired + CONFIG.srs.recheck) p.sure = true;
  else p.retired = t;
  delete p.pend;
  delete p.hinted;
  p.stage = 3;
  p.due = Math.max(p.due, t + CONFIG.srs.recheck);
}

/** A failed verification: back to the normal reviews, no other penalty. A failed 回响 check is due again now. */
export function failVerify(s: GameState, w: Word, t = now(s)): void {
  const p = s.words[w.id];
  if (!p) return;
  if (p.pend) delete p.pend;
  else if (p.retired) {
    delete p.retired;
    delete p.sure;
    p.stage = 2;
    p.due = t;
  }
}

export function kindOf(s: GameState, w: Word, t = now(s)): Kind {
  const p = s.words[w.id];
  if (!p) return 'new';
  if (p.retired) return 'guiming';
  if (t >= p.due) return 'due';
  return p.stage === 3 ? 'guiming' : 'shadow';
}

/** The stage the monster shows. A relapsed 归名 word comes back as 半名. */
export function stageOf(s: GameState, w: Word, t = now(s)): Stage {
  const p = s.words[w.id];
  if (!p) return 0;
  if (p.retired) return 3;
  if (p.stage === 3 && t >= p.due) return 2;
  return p.stage;
}

/** How many intervals overdue (0 if not due). Overdue monsters get tougher, never lose stage. */
export function overdueSteps(s: GameState, w: Word, t = now(s)): number {
  const p = s.words[w.id];
  if (!p || p.retired || t < p.due) return 0;
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

/** Moves the fight's 认得 / 会写 counts into the word's progress (once the word is in the wordbook). */
export function flushSkill(s: GameState, w: Word, b: { readOk?: number; writeOk?: number }): void {
  const p = s.words[w.id];
  if (!p || (!b.readOk && !b.writeOk)) return;
  p.read = (p.read ?? 0) + (b.readOk ?? 0);
  p.write = (p.write ?? 0) + (b.writeOk ?? 0);
  b.readOk = 0;
  b.writeOk = 0;
}

export function recordAnswer(s: GameState, w: Word, ok: boolean, skill?: 'read' | 'write'): void {
  const p = s.words[w.id];
  if (!p) return;
  if (ok) p.correct += 1;
  else p.wrong += 1;
  if (ok && skill) p[skill] = (p[skill] ?? 0) + 1;
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
    read: 1,
    write: 0, // lent by the system: the only 归名 without writing, until you write it yourself
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
