// Which words become monsters in a field right now.
// Order: due words (遗忘之物, most overdue first) → new words → shadows of learned words.
// No daily review cap: a returning player meets the backlog in waves, because each field only
// holds `count` monsters and at least one slot stays for something else.

import { CONFIG } from './config';
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
  const out: SpawnPick[] = [];
  // Most overdue first. Leave room for one non-review monster so a big backlog never fills the field.
  due.sort((a, b) => s.words[a.id].due - s.words[b.id].due);
  const dueSlots = count > 1 ? count - 1 : count;
  for (const w of due.slice(0, dueSlots)) out.push({ word: w, kind: 'due' });

  // New words in list order (easiest first). After the daily cap only 1 in 4 slots stays new.
  const newLeft = CONFIG.srs.dailyNewCap - s.daily.newCount - countAliveNew(s, alive);
  let newSlots = count - out.length;
  if (newLeft <= 0) newSlots = Math.min(newSlots, Math.floor(count / 4));
  else newSlots = Math.min(newSlots, Math.max(1, Math.ceil(count * 0.6)), newLeft);
  for (const w of fresh.slice(0, newSlots)) out.push({ word: w, kind: 'new' });

  for (const w of shuffle(rng, shadows)) {
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

function countAliveNew(s: GameState, alive: Set<string>): number {
  let n = 0;
  for (const id of alive) if (!s.words[id]) n++;
  return n;
}
