// Which words become monsters in a field right now.
// Order: due words (遗忘之物, most overdue first) → new words → shadows of learned words.
// No daily review cap: a returning player meets the backlog in waves, because each field only
// holds `count` monsters and at least one slot stays for something else.

import { shuffle, type Rng } from './rng';
import { kindOf } from './srs';
import { now, type GameState } from './state';
import type { Word, ZoneId } from './types';
import { has } from './unlocks';
import { WORDS } from '../data/words';

export interface SpawnPick {
  word: Word;
  kind: 'new' | 'due' | 'shadow';
}

export function zoneWords(zone: ZoneId): Word[] {
  return WORDS.filter((w) => w.zone === zone);
}

/** The lowest monster level of a field (its easiest word). */
export function zoneMinLevel(zone: ZoneId): number {
  const ws = zoneWords(zone).filter((w) => w.family !== 'truhe');
  return ws.length ? Math.min(...ws.map((w) => w.lvl)) : 1;
}

/** Words a player can meet at their level: Lv1 fights only nouns (冠词攻击). */
function eligible(s: GameState, w: Word): boolean {
  if (w.family === 'truhe') return false; // 宝箱怪 only appears as a rare spawn
  if (!has(s.level, 'typing') && !w.art) return false;
  return true;
}

export function pickSpawns(s: GameState, zone: ZoneId, count: number, alive: Set<string>, rng: Rng): SpawnPick[] {
  const t = now(s);
  const words = zoneWords(zone).filter((w) => !alive.has(w.id) && eligible(s, w));
  const due: Word[] = [];
  const fresh: Word[] = [];
  const shadows: Word[] = [];
  for (const w of words) {
    const k = kindOf(s, w, t);
    if (k === 'due') due.push(w);
    else if (k === 'new') fresh.push(w);
    else if (k === 'shadow') shadows.push(w);
  }
  // Reviews (2026-11-21) come to wherever you are: due words of every field of your region and the ones before it.
  for (const w of WORDS) {
    if (w.zone === zone || alive.has(w.id) || (w.region ?? 1) > (s.region ?? 1) || !eligible(s, w)) continue;
    if (kindOf(s, w, t) === 'due') due.push(w);
  }
  const out: SpawnPick[] = [];
  // Most overdue first. Leave room for one non-review monster so a big backlog never fills the field.
  due.sort((a, b) => s.words[a.id].due - s.words[b.id].due);
  const dueSlots = count > 1 ? count - 1 : count;
  for (const w of due.slice(0, dueSlots)) out.push({ word: w, kind: 'due' });

  // New words in list order (easiest first). No daily cap (言灵过载 removed 2026-11-20).
  const newSlots = Math.min(count - out.length, Math.max(1, Math.ceil(count * 0.6)));
  for (const w of fresh.slice(0, newSlots)) out.push({ word: w, kind: 'new' });

  // 越区引导 (2026-11-21): between reviews, practise what you can't write yet: not recognised first, then
  // recognised but not written. Words you can already write stay away until they are due, so a region you
  // have learned empties out and only its reviews come back (no XP is taken away).
  const unwritten = shuffle(rng, shadows.filter((w) => !(s.words[w.id]?.write ?? 0)));
  unwritten.sort((a, b) => Number((s.words[a.id]?.read ?? 0) > 0) - Number((s.words[b.id]?.read ?? 0) > 0));
  for (const w of unwritten) {
    if (out.length >= count) break;
    out.push({ word: w, kind: 'shadow' });
  }
  // A brand-new player has few learned words: top up with new ones.
  for (const w of fresh.slice(newSlots)) {
    if (out.length >= count) break;
    out.push({ word: w, kind: 'new' });
  }
  return out;
}

