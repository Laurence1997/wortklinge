// 篝火「抽查和复习」(1.0.13, Lucas 2026-11-28: 打怪时插题太影响体验). Nothing is slipped into fights any more: due
// 语境复习 words and 推定会 spot checks wait at the bonfire, where the 守火人 shows a 「!」 with how many. The player
// chooses when: a round of CAMP.round questions (due reviews first, then spot checks), no damage, no timer, leave
// any time; every answer counts as soon as it is given. Not doing them costs nothing: a due word left 2 gaps
// overdue comes back as a review monster (as before), a 推定会 word simply stays 推定会.

import { answerReview, gradeQuestion, reviewQuestion, type Battle, type Question, type TurnReport } from './combat';
import { xpToNext } from './config';
import { placedPick, isPlaced } from './placement';
import type { Rng } from './rng';
import { contextDueWords } from './srs';
import { addXp, type GameState } from './state';
import { WORD_BY_ID } from '../data/words';

export const CAMP = {
  /** Questions per round: about 3 minutes at ~15–20 s a typed sentence; 「再来一组」 for more. */
  round: 10,
  /** XP per right answer, as a share of the current level (the hit it used to deal in a fight). */
  xpShare: 0.01,
  /** The 「!」 count shows at most this (「99+」 above). */
  badgeMax: 99,
};

export interface CampRun {
  ids: string[];
  at: number;
  q: Question | null;
  right: number;
  wrong: number;
  xp: number;
  confirmed: number;
  last?: { ok: boolean; input: string; answer: string; full?: string; notes: string[]; review: NonNullable<TurnReport['review']>; levels: number[] };
}

/** How many are waiting: due 语境复习 words plus 推定会 words. */
export function campPending(s: GameState): { due: number; placed: number } {
  const due = contextDueWords(s).filter((id) => WORD_BY_ID[id]).length;
  const placed = Object.values(s.words).filter(isPlaced).length;
  return { due, placed };
}

/** The badge over the 守火人: due reviews always count; 推定会 words only while there are some (never more than a round). */
export function campBadge(s: GameState): number {
  const p = campPending(s);
  return p.due + Math.min(p.placed, CAMP.round);
}

/** A round: due words first (most overdue first), the rest spot checks spread over the bands. */
export function startCamp(s: GameState, rng: Rng): CampRun | null {
  const ids = contextDueWords(s).filter((id) => WORD_BY_ID[id]).slice(0, CAMP.round);
  const taken = new Set(ids);
  while (ids.length < CAMP.round) {
    const id = placedPick(s, rng, taken);
    if (!id) break;
    ids.push(id);
    taken.add(id);
  }
  if (!ids.length) return null;
  const run: CampRun = { ids, at: 0, q: null, right: 0, wrong: 0, xp: 0, confirmed: 0 };
  nextQ(s, run, rng);
  return run;
}

function nextQ(s: GameState, run: CampRun, rng: Rng): void {
  run.q = null;
  while (run.at < run.ids.length && !run.q) {
    run.q = reviewQuestion(s, run.ids[run.at], rng);
    if (!run.q) run.at++;
  }
}

/** Grade one answer and move on. A word confirmed for a whole band (placedConfirm) may empty later questions of
 *  the round; those are skipped. */
export function answerCamp(s: GameState, run: CampRun, input: string, rng: Rng): void {
  const q = run.q;
  if (!q) return;
  // A review question never looks at the fight's monster (typed / cloze grade the reviewed word itself).
  const v = gradeQuestion(s, null as unknown as Battle, q, input);
  const ok = v.ok;
  const review = answerReview(s, q, ok);
  let levels: number[] = [];
  if (ok) {
    run.right++;
    const xp = Math.max(1, Math.round(xpToNext(s.level) * CAMP.xpShare));
    run.xp += xp;
    levels = addXp(s, xp).levels;
  } else run.wrong++;
  run.confirmed += review?.confirmed ?? 0;
  if (review) run.last = { ok, input, answer: q.answer ?? '', full: q.full, notes: v.notes, review, levels };
  run.at++;
  // Skip words that stopped being due / 推定会 meanwhile (a band confirmed as a whole).
  while (run.at < run.ids.length) {
    const p = s.words[run.ids[run.at]];
    if (isPlaced(p) || contextDueWords(s).includes(run.ids[run.at])) break;
    run.at++;
  }
  nextQ(s, run, rng);
}
