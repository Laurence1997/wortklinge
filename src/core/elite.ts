// 野外精英 · 场景精英 (游戏设计「野外精英：场景精英」, Lucas 2026-11-23).
// An elite is a three-part quiz on one field scene: it carries three of the scene's words and asks
// ① recognise (stance / meaning) → ② use (cloze; conjugation for verbs; typing when there is no example)
// → ③ write (typing; conjugation for verbs). Each part is one same-level monster's HP of that word.
// First elite: half of the scene's group at 半名 (归名 and retired count). Review elite: 3+ group words due.

import { CONFIG } from './config';
import { isRetired, needsVerify, pendingToday, reviewMon } from './srs';
import { now, type GameState } from './state';
import type { Word } from './types';
import { has } from './unlocks';
import { eligible } from './spawn';
import type { SceneDef } from '../data/world';
import { WORD_BY_ID } from '../data/words';

export interface ElitePick {
  scene: string;
  /** Word ids, in fighting order (one per part). */
  words: string[];
  /** A review elite (it came back because its words are due). */
  review: boolean;
}

/** How many times this scene's elite has been beaten (a save flag, no format change). */
export function eliteWins(s: GameState, sceneId: string): number {
  return Number(s.flags[`eliteWin_${sceneId}`] ?? 0);
}

export function noteEliteWin(s: GameState, sceneId: string): void {
  s.flags[`eliteWin_${sceneId}`] = eliteWins(s, sceneId) + 1;
}

const halfOrBetter = (s: GameState, id: string) => isRetired(s.words[id]) || (s.words[id]?.stage ?? 0) >= 2;

/** The elite this scene would send now, or null. `taken` = word ids already standing on the map. */
export function elitePick(s: GameState, sc: SceneDef, taken: Set<string> = new Set(), t = now(s)): ElitePick | null {
  if (!has(s.level, 'elite') || sc.type !== 'field' || !sc.words?.length) return null;
  const group = sc.words.map((id) => WORD_BY_ID[id]).filter((w): w is Word => !!w);
  if (!group.length) return null;
  // Words that can stand in a fight now: eligible, not retired, not waiting for verification, not on the map.
  const ok = (w: Word) => eligible(s, w) && !isRetired(s.words[w.id]) && !pendingToday(s.words[w.id], t) && !needsVerify(s, w, t) && !taken.has(w.id);
  const usable = group.filter(ok);
  if (usable.length < CONFIG.elite.segs) return null;
  const beaten = eliteWins(s, sc.id) > 0;
  if (!beaten) {
    const half = group.filter((w) => halfOrBetter(s, w.id)).length;
    if (half < Math.ceil(group.length * CONFIG.elite.half)) return null;
    // Not written yet first, then the lowest stage; list order breaks ties (stable sort).
    const rank = (w: Word) => ((s.words[w.id]?.write ?? 0) > 0 ? 10 : 0) + (s.words[w.id]?.stage ?? 0);
    const words = [...usable].sort((a, b) => rank(a) - rank(b)).slice(0, CONFIG.elite.segs);
    return { scene: sc.id, words: words.map((w) => w.id), review: false };
  }
  // 复习精英 (游戏设计 六, 2026-11-24): only words that relapsed into review monsters count, not learning respawns.
  const due = usable.filter((w) => reviewMon(s.words[w.id], t)).sort((a, b) => (s.words[a.id]?.due ?? 0) - (s.words[b.id]?.due ?? 0));
  if (due.length < CONFIG.elite.due) return null;
  return { scene: sc.id, words: due.slice(0, CONFIG.elite.segs).map((w) => w.id), review: true };
}
