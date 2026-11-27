// Chests (Lv11+). Wood from small monsters, iron from 宝箱怪 and rare monsters, gold from the
// region boss (first kill each day), the forgotten chest from overdue reviews.
// Iron and gold chests carry a 言灵锁: write the word you most need to review and each item's
// quality is rolled twice, keeping the better one. A wrong answer still opens the chest.

import { GEM, gemGrammars, makeGem, type Gem } from './gems';
import { CONFIG } from './config';
import { makeItem } from './loot';
import { pityOrange } from './forge';
import { markUnidentified } from './identify';
import { weighted, type Rng } from './rng';
import type { GameState } from './state';
import type { Item, Quality } from './types';

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
  wood: { items: 1, weights: { white: 70, green: 24, purple: 5, orange: 1, red: 0 }, first: 'white', locked: false, goldKills: 5 },
  // 0.3 has no grammar stones or letters yet: one item, purple twice as likely.
  forgotten: { items: 1, weights: { white: 70, green: 24, purple: 10, orange: 1, red: 0 }, first: 'white', locked: false },
  iron: { items: 2, weights: { white: 70, green: 24, purple: 10, orange: 1, red: 0 }, first: 'green', locked: true },
  gold: { items: 3, weights: { white: 70, green: 24, purple: 5, orange: 3, red: 0 }, first: 'purple', locked: true },
};

function rollQ(rng: Rng, def: ChestDef, min: Quality): Quality {
  const q = weighted(rng, def.weights) as Quality;
  return ORDER.indexOf(q) < ORDER.indexOf(min) ? min : q;
}

export { lockWord } from './identify';

export interface ChestResult {
  items: Item[];
  gold: number;
  rerolled: boolean;
  bagFull: number;
  /** 开箱动画: the quality rolls per item that went into the bag (two when the 言灵锁 was written right). */
  rolls: Quality[][];
  /** 言石 from a forgotten chest (62+). */
  gem?: Gem;
}

export function openChest(s: GameState, kind: ChestKind, ilvl: number, rng: Rng, lockOk = false): ChestResult {
  const def = CHESTS[kind];
  const items: Item[] = [];
  const rolls: Quality[][] = [];
  let bagFull = 0;
  for (let i = 0; i < def.items; i++) {
    const min = i === 0 ? def.first : 'white';
    let q = rollQ(rng, def, min);
    const seen: Quality[] = [q];
    if (def.locked && lockOk) {
      const q2 = rollQ(rng, def, min);
      seen.push(q2);
      if (ORDER.indexOf(q2) > ORDER.indexOf(q)) q = q2;
    }
    q = pityOrange(s, q, 'orange');
    const it = makeItem(rng, ilvl, q);
    markUnidentified(s, it);
    if (s.bag.length >= CONFIG.loot.bagSize) bagFull += 1;
    else {
      s.bag.push(it);
      items.push(it);
      rolls.push(seen);
    }
  }
  const gold = def.goldKills ? def.goldKills * CONFIG.gold.perKill(ilvl) : 0;
  s.gold += gold;
  // 言石 (62 级): the forgotten chest always holds one, of a grammar you have been taught.
  let gem: Gem | undefined;
  const gs = gemGrammars(s);
  if (kind === 'forgotten' && s.level >= GEM.from && gs.length) {
    gem = makeGem(gs[Math.floor(rng() * gs.length)], rng);
    (s.gems ??= []).push(gem);
  }
  return { items, gold, rerolled: def.locked && lockOk, bagFull, rolls, gem };
}
