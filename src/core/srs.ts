// 归名: a word is a monster. It needs 3 kills on 3 different respawns to turn back
// into the thing it names; the last one must be typed with its article (归名一击).

import { CONFIG, DAY } from './config';
import { EXAMPLES } from './cloze';
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
  if (reviewMon(p, t)) return '复发中';
  if (p.stage === 3) {
    if (p.ctxDone) return '归名（不用再复习）';
    const d = Math.ceil((p.due - t) / DAY);
    return d <= 0 ? '归名（语境复习到期）' : `归名（下次语境复习 ${d} 天后）`;
  }
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
    p.lapsed = true;
    p.due = t;
  }
}

// ---- 归名 in one day + 语境复习 (2026-11-24, 游戏设计 七 rev 49–51) ------------------------------
// Before 归名: 3 defeats (认 / 用 / 写), the word respawning in its own scene ~6 minutes after each.
// After 归名 it never spawns on a schedule: a context question (its example sentence, typed) is put into
// whatever fight you are in after 2 days, 1 week, 1 month, 3 months. A clean 归名 (no wrong answer, no 低语)
// gets one 30-day spot check only. Wrong → 复发 (半名 review monster); 2 gaps overdue → review monster too.

const FAR = 9e15;

/** The gap behind a 归名 word's due date (old saves without one: the first context gap). */
function gapOf(p: WordProgress): number {
  return p.ivl ?? CONFIG.srs.context[0];
}

/** A 归名 word whose context review is 2 gaps overdue: it is back in the field as a review monster. */
export function overdueMon(p: WordProgress | undefined, t: number): boolean {
  return !!p && p.stage === 3 && !p.retired && !p.ctxDone && t >= p.due + CONFIG.srs.overdueToMonster * gapOf(p);
}

/** Its context question is due now (and it has not gone overdue into a monster). */
export function contextDue(p: WordProgress | undefined, t: number): boolean {
  return !!p && p.stage === 3 && !p.retired && !p.ctxDone && t >= p.due && !overdueMon(p, t);
}

/** 复发中: a review monster that follows you anywhere (a failed context review, or one left 2 gaps overdue). */
export function reviewMon(p: WordProgress | undefined, t: number): boolean {
  return !!p && !p.retired && ((p.lapsed && p.stage < 3) || overdueMon(p, t));
}

/** Put a word at 归名 with its context schedule (clean = only the 30-day spot check). */
export function setGuiming(p: WordProgress, t: number, clean: boolean): void {
  p.stage = 3;
  delete p.lapsed;
  delete p.flaw;
  delete p.ctxDone;
  const c = CONFIG.srs.context;
  p.ctx = clean ? c.length - 1 : 0;
  p.ivl = clean ? CONFIG.srs.spot : c[0];
  p.due = t + p.ivl;
}

/** 「下次 1 周后」 */
export function gapZh(ms: number): string {
  const d = Math.round(ms / DAY);
  if (d >= 85) return '3 个月后';
  if (d >= 28) return '1 个月后';
  if (d >= 6) return '1 周后';
  return `${Math.max(1, d)} 天后`;
}

/** A context review answered right: the next, longer gap (or done). Returns the next gap, null when done. */
export function contextPass(s: GameState, w: Word, t = now(s)): number | null {
  const p = s.words[w.id];
  if (!p || p.stage !== 3) return null;
  const c = CONFIG.srs.context;
  p.ctx = (p.ctx ?? 0) + 1;
  p.lastSeen = t;
  if (p.ctx >= c.length) {
    p.ctxDone = true;
    p.due = FAR;
    return null;
  }
  p.ivl = c[p.ctx];
  p.due = t + p.ivl;
  return p.ivl;
}

/** A context review answered wrong: the word relapses to a 半名 review monster (遗忘之物), due now. */
export function contextFail(s: GameState, w: Word, t = now(s)): void {
  const p = s.words[w.id];
  if (!p || p.retired) return;
  p.stage = 2;
  p.lapsed = true;
  p.due = t;
  p.lastSeen = t;
}

/** Written right somewhere else (finisher, cloze, 排句, 槽位, 残句, diary, 篝火日记, 试炼): a due review counts as
 *  passed; a 归名 word not yet due has its due date pushed back by its current gap (rev 51). */
export function reviewedByWriting(s: GameState, w: Word, t = now(s)): void {
  const p = s.words[w.id];
  if (!p || p.retired || p.stage !== 3 || p.ctxDone) return;
  if (t >= p.due) contextPass(s, w, t);
  else p.due = Math.max(p.due, t + gapOf(p));
}

/** Words whose context question is due, most overdue first. */
export function contextDueWords(s: GameState, t = now(s)): string[] {
  return Object.entries(s.words)
    .filter(([, p]) => contextDue(p, t))
    .sort((a, b) => a[1].due - b[1].due)
    .map(([id]) => id);
}

export function kindOf(s: GameState, w: Word, t = now(s)): Kind {
  const p = s.words[w.id];
  if (!p) return 'new';
  if (p.retired) return 'guiming';
  if (p.stage === 3) return overdueMon(p, t) ? 'due' : 'guiming';
  return t >= p.due ? 'due' : 'shadow';
}

/** The stage the monster shows. A 归名 word gone 2 gaps overdue comes back as 半名. */
export function stageOf(s: GameState, w: Word, t = now(s)): Stage {
  const p = s.words[w.id];
  if (!p) return 0;
  if (p.retired) return 3;
  if (p.stage === 3 && overdueMon(p, t)) return 2;
  return p.stage;
}

/** How many gaps overdue a review monster is (越久越肥, at most 4). Learning respawns never fatten. */
export function overdueSteps(s: GameState, w: Word, t = now(s)): number {
  const p = s.words[w.id];
  if (!p || p.retired || t < p.due) return 0;
  if (overdueMon(p, t)) return Math.min(4, Math.floor((t - p.due) / gapOf(p)));
  if (p.lapsed) return Math.min(4, Math.floor((t - p.due) / gapOf(p)));
  return 0;
}

export interface KillOutcome {
  kind: Kind;
  from: Stage;
  to: Stage;
  guiming: boolean;
  /** Choice answers can only bring a word to 半名; tells the UI to explain 归名一击. */
  needsTypedFinal: boolean;
  /** 裂形 fight without a right cloze: it stays 裂形 (用 needs one example cloze). */
  needsCloze?: boolean;
}

/** Whether 用 is possible for this word (it has example sentences to cloze). */
export function canUse(w: Word): boolean {
  return (EXAMPLES[w.id] ?? []).length > 0;
}

/**
 * Record a kill.
 * @param typedFinal the killing blow was typed (默写 / 句子) with the article
 * @param slipped the player answered wrong on this 半名 monster during the fight (长回一颗牙)
 * @param opts.used a cloze on this word was answered right in this fight (用)
 * @param opts.flaw a wrong answer or a 低语 on this word in this fight
 * @param opts.typed a typed question on it was answered right (cloze, dictation, conjugation)
 */
export function recordKill(s: GameState, w: Word, typedFinal: boolean, slipped: boolean, t = now(s), opts: { used?: boolean; flaw?: boolean; typed?: boolean } = {}): KillOutcome {
  const kind = kindOf(s, w, t);
  const from = stageOf(s, w, t);
  const p = s.words[w.id];
  const respawn = w.tutorial ? CONFIG.srs.tutorialInterval : CONFIG.srs.respawn;

  if (kind === 'new' || !p) {
    // rev 52: every question on it right, no 低语, at least one typed → straight to 半名 (2 fights in all).
    const skip = !opts.flaw && !!opts.typed && !w.tutorial;
    s.words[w.id] = { stage: skip ? 2 : 1, due: t + respawn, firstSeen: t, lastSeen: t, relapse: 0, correct: 0, wrong: 0, ...(opts.flaw ? { flaw: true } : {}) };
    return { kind, from: 0, to: skip ? 2 : 1, guiming: false, needsTypedFinal: false };
  }
  p.lastSeen = t;
  if (kind !== 'due') {
    // Shadows (普通怪) give gold and XP but don't move 归名 forward.
    return { kind, from, to: from, guiming: false, needsTypedFinal: false };
  }
  if (opts.flaw) p.flaw = true;
  if (from === 1) {
    if (!opts.used && canUse(w)) {
      p.due = t + respawn;
      return { kind, from, to: 1, guiming: false, needsTypedFinal: false, needsCloze: true };
    }
    p.stage = 2;
    p.due = t + respawn;
    return { kind, from, to: 2, guiming: false, needsTypedFinal: false };
  }
  // from === 2 (fresh 半名, a relapsed word, or a 归名 word gone overdue)
  const relapsed = p.stage === 3 || !!p.lapsed;
  if (slipped && !relapsed) {
    p.stage = 1;
    p.due = t + respawn;
    return { kind, from, to: 1, guiming: false, needsTypedFinal: false };
  }
  if (!typedFinal || slipped) {
    // Stays 半名 and comes back soon for the 归名一击.
    if (p.stage === 3) (p.stage = 2), (p.lapsed = true);
    p.due = t + respawn;
    return { kind, from, to: 2, guiming: false, needsTypedFinal: !typedFinal };
  }
  if (relapsed) p.relapse += 1;
  setGuiming(p, t, !relapsed && !p.flaw && !p.hinted);
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
  if (ok && skill === 'write') reviewedByWriting(s, w);
}

/** Tutorial special: the very first bread is named on the spot (系统借给你的). */
export function instantGuiming(s: GameState, w: Word, t = now(s)): void {
  s.words[w.id] = {
    stage: 3,
    due: t + CONFIG.srs.context[0],
    ctx: 0,
    ivl: CONFIG.srs.context[0],
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
