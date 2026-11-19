// Chests (Lv11+). Wood from small monsters, iron from 宝箱怪 and rare monsters, gold from the
// region boss (first kill each day), the forgotten chest from overdue reviews.
// Iron and gold chests carry a 言灵锁: write the word you most need to review and each item's
// quality is rolled twice, keeping the better one. A wrong answer still opens the chest.

import { CONFIG } from './config';
import { makeItem } from './loot';
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
  min: Quality;
  locked: boolean;
}

const ORDER: Quality[] = ['white', 'green', 'purple', 'orange'];

export const CHESTS: Record<ChestKind, ChestDef> = {
  wood: { items: 1, weights: { white: 60, green: 32, purple: 7, orange: 1 }, min: 'white', locked: false },
  // 0.3 has no grammar stones or letters yet: one item, purple twice as likely.
  forgotten: { items: 1, weights: { white: 55, green: 30, purple: 14, orange: 1 }, min: 'white', locked: false },
  iron: { items: 2, weights: { white: 0, green: 70, purple: 27, orange: 3 }, min: 'green', locked: true },
  gold: { items: 3, weights: { white: 0, green: 40, purple: 50, orange: 10 }, min: 'green', locked: true },
};

function rollQ(rng: Rng, def: ChestDef): Quality {
  const q = weighted(rng, def.weights) as Quality;
  return ORDER.indexOf(q) < ORDER.indexOf(def.min) ? def.min : q;
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
  rerolled: boolean;
  bagFull: number;
}

export function openChest(s: GameState, kind: ChestKind, ilvl: number, rng: Rng, lockOk = false): ChestResult {
  const def = CHESTS[kind];
  const items: Item[] = [];
  let bagFull = 0;
  for (let i = 0; i < def.items; i++) {
    let q = rollQ(rng, def);
    if (def.locked && lockOk) {
      const q2 = rollQ(rng, def);
      if (ORDER.indexOf(q2) > ORDER.indexOf(q)) q = q2;
    }
    const it = makeItem(rng, ilvl, q);
    if (s.bag.length >= CONFIG.loot.bagSize) bagFull += 1;
    else {
      s.bag.push(it);
      items.push(it);
    }
  }
  return { items, rerolled: def.locked && lockOk, bagFull };
}
