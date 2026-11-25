// 挑战怪 (游戏设计 四「词怎么分层、蚀变和挑战怪」, Lucas 2026-11-25): every field scene mixes in words from a
// challenge pool, so a strong player meets harder words early (能力到了就不卡时间).
//   Pool, in order: the same 情境's next layer, the layer after → the same 功能线's higher-layer words → earlier
//   regions' words never met (审查修订 B6) → the next region's words. Never a 近义词 / 同根词 / 形近词 of a word of this scene not yet written right.
//   Share: from the last 20 monsters' 「第一次就写对」 rate: 10%; 80%+ → 25%; 90%+ and mostly by dictation → 40%;
//   a player who wrote many words right in 分级考核 / 全量筛选 starts at 25%.
//   Stats: level = your level + 2 (your level until Lv5, 审查修订 B2; armor by that), XP ×1.75 for the hard word plus the usual level-gap bonus.
//   Written right once (no spelling seen) → the field's quick 斩杀 (verified tomorrow, then retired).
// The 6000-word list brings 情境 / 层 / 功能线 / related words (optional Word fields below); until then only the
// next region's words are in the pool.

import { shuffle, type Rng } from './rng';
import { isRetired, kindOf, pendingToday, verifyOf } from './srs';
import { now, type GameState } from './state';
import type { Word, ZoneId } from './types';
import { WORDS } from '../data/words';

export const CHALLENGE_CFG = {
  window: 20,
  base: 0.1,
  mid: { rate: 0.8, share: 0.25 },
  high: { rate: 0.9, share: 0.4, dictation: 0.5 },
  /** 分级考核 / 全量筛选: this many words written right there count as «lots». */
  boostWords: 30,
  levelAbove: 2,
  xpMult: 1.75,
};

/** Optional data the 6000-word list adds to a word (数据整理「常用词表 6000」). */
export interface WordLayers {
  /** 情境 (about 40 life situations). */
  situ?: string;
  /** 层: A1 / A2 / B1. */
  layer?: 'A1' | 'A2' | 'B1';
  /** 功能线 (only for expression words). */
  fline?: string;
  /** 近义词 / 同根词 / 形近词 (word ids). */
  rel?: string[];
}
type LWord = Word & WordLayers;

export type FirstTry = 'ok' | 'dict' | 'bad';

export interface ChallengeSave {
  /** Last monsters: 0 = not written right first time, 1 = right first time, 2 = right first time by dictation. */
  recent: number[];
}

/** One finished field monster: was the first written answer right, and was it a dictation? */
export function noteFirstTry(s: GameState, firstTyped: FirstTry | undefined): void {
  if (!firstTyped) return;
  s.challenge ??= { recent: [] };
  s.challenge.recent = [...s.challenge.recent, firstTyped === 'dict' ? 2 : firstTyped === 'ok' ? 1 : 0].slice(-CHALLENGE_CFG.window);
}

/** Words the player wrote right in 分级考核 or 全量筛选 (retired there). */
function boosted(s: GameState): boolean {
  const n = Object.values(s.words).filter((p) => p.retired && !p.lastSeen).length;
  return n >= CHALLENGE_CFG.boostWords || (s.placement?.top ?? -1) >= 1;
}

/** Share of a scene's new slots that become challenge monsters. */
export function challengeShare(s: GameState): number {
  const r = s.challenge?.recent ?? [];
  if (r.length < CHALLENGE_CFG.window) return boosted(s) ? CHALLENGE_CFG.mid.share : CHALLENGE_CFG.base;
  const right = r.filter((x) => x > 0).length / r.length;
  const dict = r.filter((x) => x === 2).length / r.length;
  if (right >= CHALLENGE_CFG.high.rate && dict >= CHALLENGE_CFG.high.dictation) return CHALLENGE_CFG.high.share;
  if (right >= CHALLENGE_CFG.mid.rate) return CHALLENGE_CFG.mid.share;
  return CHALLENGE_CFG.base;
}

const LAYERS = ['A1', 'A2', 'B1'] as const;

/** The challenge pool of a field, best first. */
export function challengePool(s: GameState, zone: ZoneId, alive: Set<string>): Word[] {
  const t = now(s);
  const local = WORDS.filter((w) => w.zone === zone) as LWord[];
  if (!local.length) return [];
  const region = local[0].region ?? 1;
  const open = (w: Word) =>
    !alive.has(w.id) &&
    w.zone !== zone &&
    w.family !== 'truhe' &&
    w.pos !== 'phr' &&
    !w.tutorial &&
    !pendingToday(s.words[w.id], t) &&
    !(isRetired(s.words[w.id]) && !verifyOf(s.words[w.id], t)) &&
    kindOf(s, w, t) === 'new';
  // Related words of local words not yet written right stay out (场景分组防干扰).
  const blocked = new Set<string>();
  for (const w of local) if (!(s.words[w.id]?.write ?? 0)) for (const r of w.rel ?? []) blocked.add(r);
  const ok = (w: Word) => open(w) && !blocked.has(w.id);
  const out: Word[] = [];
  const seen = new Set<string>();
  const push = (ws: Word[]) => {
    for (const w of ws) if (!seen.has(w.id) && ok(w)) (seen.add(w.id), out.push(w));
  };
  const all = WORDS as LWord[];
  // 1. Same 情境, next layers.
  const situs = new Set(local.map((w) => w.situ).filter(Boolean));
  const top = Math.max(...local.map((w) => (w.layer ? LAYERS.indexOf(w.layer) : 0)));
  for (let k = top + 1; k < LAYERS.length; k++) push(all.filter((w) => w.situ && situs.has(w.situ) && w.layer === LAYERS[k]));
  // 2. Same 功能线, higher layers.
  const flines = new Set(local.map((w) => w.fline).filter(Boolean));
  push(all.filter((w) => w.fline && flines.has(w.fline) && w.layer && LAYERS.indexOf(w.layer) > top));
  // 3. 审查修订 B6: earlier regions' words never met yet, most useful first (so unlearned words follow you).
  push(all.filter((w) => (w.region ?? 1) < region && !s.words[w.id]).sort((a, b) => a.lvl - b.lvl));
  // 4. The next region's words, easiest first.
  push(all.filter((w) => (w.region ?? 1) === region + 1).sort((a, b) => a.lvl - b.lvl));
  return out;
}

/** How many of `slots` new slots go to the pool this time (rounded at random, so 10% still shows up). */
export function challengeSlots(s: GameState, slots: number, rng: Rng): number {
  const x = slots * challengeShare(s);
  return Math.floor(x) + (rng() < x - Math.floor(x) ? 1 : 0);
}

/** Pick challenge words for a scene: a few from the head of the pool, shuffled so it doesn't feel scripted. */
export function pickChallenge(s: GameState, zone: ZoneId, n: number, alive: Set<string>, rng: Rng): Word[] {
  if (n <= 0) return [];
  const pool = challengePool(s, zone, alive);
  return shuffle(rng, pool.slice(0, Math.max(n * 3, 6))).slice(0, n);
}
