// Chests (Lv11+). Wood from small monsters, iron from 宝箱怪 and rare monsters, gold from the
// region boss (first kill each day), the forgotten chest from overdue reviews.
// Iron and gold chests carry a 言灵锁: write the word you most need to review and each item's
// quality is rolled twice, keeping the better one. A wrong answer still opens the chest.

import { CONFIG } from './config';
import { makeItem } from './loot';
import { markUnidentified } from './identify';
import { weighted, type Rng } from './rng';
import { now, type GameState } from './state';
import type { Item, Quality, Word } from './types';
import { WORD_BY_ID, WORDS } from '../data/words';

export type ChestKind = 'wood' | 'iron' | 'gold' | 'forgotten';

export const CHEST_ZH: Record<ChestKind, string> = { wood: '木箱', iron: '铁箱', gold: '金箱', forgotten: '遗忘宝箱' };

export const CHEST_RATE = { wood: 0.03, forgotten: 0.05 };

interface ChestDef {
  items: number;
  weights: Record<Quality, number>;
  /** The first item is at least this good. */
  first: Quality;
  locked: boolean;
  /** Wood chests also hold gold: this many kills' worth. */
  goldKills?: number;
}

const ORDER: Quality[] = ['white', 'green', 'purple', 'orange'];

// Base drop weights are white 70 / green 24 / purple 5 / orange 1 (CONFIG.loot.qualityWeights).
// 0.3 item counts take the low end of the doc table: wood 1, iron 2, gold 3.
export const CHESTS: Record<ChestKind, ChestDef> = {
  wood: { items: 1, weights: { white: 70, green: 24, purple: 5, orange: 1 }, first: 'white', locked: false, goldKills: 5 },
  // 0.3 has no grammar stones or letters yet: one item, purple twice as likely.
  forgotten: { items: 1, weights: { white: 70, green: 24, purple: 10, orange: 1 }, first: 'white', locked: false },
  iron: { items: 2, weights: { white: 70, green: 24, purple: 10, orange: 1 }, first: 'green', locked: true },
  gold: { items: 3, weights: { white: 70, green: 24, purple: 5, orange: 3 }, first: 'purple', locked: true },
};

function rollQ(rng: Rng, def: ChestDef, min: Quality): Quality {
  const q = weighted(rng, def.weights) as Quality;
  return ORDER.indexOf(q) < ORDER.indexOf(min) ? min : q;
}

/** The 言灵锁 word: the most overdue word you know, else the one seen longest ago. */
export function lockWord(s: GameState, fallback: Word): Word {
  const t = now(s);
  let best: Word | null = null;
  let bestScore = -Infinity;
  for (const [id, p] of Object.entries(s.words)) {
    const w = WORD_BY_ID[id];
    if (!w || w.pos === 'phr' || w.digit) continue;
    const score = t - p.due; // most overdue first; not-yet-due words score negative
    if (score > bestScore) {
      bestScore = score;
      best = w;
    }
  }
  return best ?? fallback ?? WORDS[0];
}

export interface ChestResult {
  items: Item[];
  gold: number;
  rerolled: boolean;
  bagFull: number;
}

export function openChest(s: GameState, kind: ChestKind, ilvl: number, rng: Rng, lockOk = false): ChestResult {
  const def = CHESTS[kind];
  const items: Item[] = [];
  let bagFull = 0;
  for (let i = 0; i < def.items; i++) {
    const min = i === 0 ? def.first : 'white';
    let q = rollQ(rng, def, min);
    if (def.locked && lockOk) {
      const q2 = rollQ(rng, def, min);
      if (ORDER.indexOf(q2) > ORDER.indexOf(q)) q = q2;
    }
    const it = makeItem(rng, ilvl, q);
    markUnidentified(s, it);
    if (s.bag.length >= CONFIG.loot.bagSize) bagFull += 1;
    else {
      s.bag.push(it);
      items.push(it);
    }
  }
  const gold = def.goldKills ? def.goldKills * CONFIG.gold.perKill(ilvl) : 0;
  s.gold += gold;
  return { items, gold, rerolled: def.locked && lockOk, bagFull };
}
