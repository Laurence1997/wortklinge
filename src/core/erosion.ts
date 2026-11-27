// 0.7 + 0.8 · 蚀变 and two-batch scenes (游戏设计 四「每个区域」「词怎么分层、蚀变和挑战怪」, rev 341).
// - A 蚀变 word spawns once its segment is open (the boss before it has fallen) and the word it is the advanced form
//   of was written right once, is 推定会 or 斩杀. Its monsters stand at the segment's level (the word's `lvl`).
// - Scenes of regions 4–12 and 蚀变 groups open rows 1–8 first; the rest once half the group is 半名 (斩杀 counts).
// - 已净化: every 蚀变 word of a scene is retired (or 待验证), e.g. beaten early as a challenge monster.

import type { GameState } from './state';
import type { Word, WordProgress } from './types';
import { WORDS, WORD_BY_ID } from '../data/words';
import { ERODE_DEF } from '../data/zones';

/** 斩杀, 推定会 or at least 半名. */
const halfOrBetter = (p: WordProgress | undefined) => !!p && (!!p.retired || !!p.placed || p.stage >= 2);

/** The segment's boss door is behind the last new region (8 after 7, 11 after 10). */
export function erodeOpen(s: GameState, seg: number): boolean {
  const e = ERODE_DEF[seg];
  return !!e && !!s.flags[`boss${e.after}Kills`];
}

/** Written right once, 推定会 or 斩杀 (6000 词分组方案 §12: no need to wait for 归名). */
export function baseTouched(s: GameState, id: string | undefined): boolean {
  if (!id || !WORD_BY_ID[id]) return true;
  const p = s.words[id];
  return !!p && ((p.write ?? 0) > 0 || !!p.placed || !!p.retired);
}

const GROUPS = new Map<string, Word[]>();
for (const w of WORDS) {
  if (!w.scene) continue;
  const key = `${w.scene}@${w.erode ?? 0}`;
  GROUPS.set(key, [...(GROUPS.get(key) ?? []), w]);
}

/** The word group (own or 蚀变) a word belongs to. */
export function groupOf(w: Word): Word[] {
  return w.scene ? GROUPS.get(`${w.scene}@${w.erode ?? 0}`) ?? [w] : [w];
}

export function secondBatchOpen(s: GameState, w: Word): boolean {
  const g = groupOf(w);
  return g.filter((x) => halfOrBetter(s.words[x.id])).length * 2 >= g.length;
}

/** Can this word be met at all right now (on top of the usual eligibility)? */
export function laterReady(s: GameState, w: Word): boolean {
  if (w.erode && (!erodeOpen(s, w.erode) || !baseTouched(s, w.after))) return false;
  if (w.batch === 2 && !secondBatchOpen(s, w)) return false;
  return true;
}

/** 已净化: an open 蚀变 scene whose advanced words are all retired or waiting for tomorrow's check. */
export function purified(s: GameState, ids: string[] | undefined, seg: number | undefined): boolean {
  if (!ids?.length || !seg || !erodeOpen(s, seg)) return false;
  return ids.every((id) => !!s.words[id]?.retired || !!s.words[id]?.pend);
}
