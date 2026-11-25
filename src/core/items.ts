// 物品栏 (游戏设计 › 0.4 战斗修正版 › 物品栏, 2026-11-22 Lucas): two consumables outside the move bar.
// 低语纸条 (der Zettel): one 低语 hint each. 药片 (die Tablette): heals, takes the turn.
// Counts live in flags (invHint / invTablet), so old saves need no conversion.

import { hourGold } from './classes';
import { CONFIG } from './config';
import { normalize } from './grading';
import type { Rng } from './rng';
import { hintsPerFight, maxHp, type GameState } from './state';
import { has } from './unlocks';

export type Consumable = 'hint' | 'tablet';

const FLAG: Record<Consumable, string> = { hint: 'invHint', tablet: 'invTablet' };

export const CONSUMABLE: Record<Consumable, { zh: string; de: string; acc: string; use: string }> = {
  hint: { zh: '低语纸条', de: 'der Zettel', acc: 'einen Zettel', use: '答题时按 W（打字时按 ?）：给一个提示，这题不算会写' },
  tablet: { zh: '药片', de: 'die Tablette', acc: 'eine Tablette', use: `选招时按 H：回 ${Math.round(CONFIG.items.tabletHeal * 100)}% 生命，占一回合（怪照常出手）` },
};

/** The bar opens with 低语 (Lv4). */
export function itemsOpen(s: GameState): boolean {
  return has(s.level, 'whisper');
}

/** 裂隙 白板进入: only what this run found counts (药片 picked up inside; no 纸条 from outside). */
export function count(s: GameState, k: Consumable): number {
  if (s.rift) return k === 'tablet' ? s.rift.pills : 0;
  return (s.flags[FLAG[k]] as number) || 0;
}

/** 词典's main stat raises the 纸条 cap (it used to be 「每场提示 N 次」, which nothing read). */
export function cap(s: GameState, k: Consumable): number {
  return k === 'hint' ? CONFIG.items.hintCap + hintsPerFight(s) : CONFIG.items.tabletCap;
}

/** Adds up to the cap; returns how many were actually added. */
export function addItem(s: GameState, k: Consumable, n = 1): number {
  if (s.rift) {
    if (k !== 'tablet') return 0;
    s.rift.pills += n;
    return n;
  }
  const have = count(s, k);
  const add = Math.max(0, Math.min(n, cap(s, k) - have));
  s.flags[FLAG[k]] = have + add;
  return add;
}

export function useItem(s: GameState, k: Consumable): boolean {
  const have = count(s, k);
  if (have <= 0) return false;
  if (s.rift) {
    s.rift.pills -= 1;
    return true;
  }
  s.flags[FLAG[k]] = have - 1;
  return true;
}

/** First time the bar is open (Lv4, or an older save already past it): the starter stack, once. */
export function grantStarter(s: GameState): boolean {
  if (!itemsOpen(s) || s.flags.itemsGiven) return false;
  s.flags.itemsGiven = true;
  addItem(s, 'hint', CONFIG.items.hintStart);
  addItem(s, 'tablet', CONFIG.items.tabletStart);
  return true;
}

/** Resting at a bonfire tops 纸条 up to 3 (never takes any away). 药片 are not refilled. */
export function bonfireRefill(s: GameState): number {
  if (!itemsOpen(s)) return 0;
  const want = Math.min(cap(s, 'hint'), CONFIG.items.hintRefill);
  return addItem(s, 'hint', Math.max(0, want - count(s, 'hint')));
}

/** Per kill: 4% a 纸条, 6% a 药片 (nothing once full). */
export function rollItemDrops(s: GameState, rng: Rng): Consumable[] {
  if (!itemsOpen(s)) return [];
  const out: Consumable[] = [];
  if (rng() < CONFIG.items.hintDrop && addItem(s, 'hint')) out.push('hint');
  if (rng() < CONFIG.items.tabletDrop && addItem(s, 'tablet')) out.push('tablet');
  return out;
}

export function tabletHeal(s: GameState): number {
  return Math.max(1, Math.round(maxHp(s) * CONFIG.items.tabletHeal));
}

export function itemPrice(s: GameState, k: Consumable): number {
  return Math.max(1, Math.round(hourGold(s) * (k === 'hint' ? CONFIG.items.hintPrice : CONFIG.items.tabletPrice)));
}

/** Buying is a German sentence too: 「Ich nehme einen Zettel.」/「Ich nehme eine Tablette.」 (also den / die). */
export function buyItemLine(sentence: string, k: Consumable): boolean {
  const n = normalize(sentence).replace(/\s+/g, ' ').trim();
  const noun = k === 'hint' ? 'zettel' : 'tablette';
  const arts = k === 'hint' ? ['einen', 'den'] : ['eine', 'die'];
  return arts.some((a) => n === `ich nehme ${a} ${noun}` || n === `ich moechte ${a} ${noun}`);
}

export type BuyItemResult = { ok: true; paid: number } | { ok: false; reason: 'sentence' | 'gold' | 'full'; paid: number };

export function buyConsumable(s: GameState, k: Consumable, sentence: string): BuyItemResult {
  const paid = itemPrice(s, k);
  if (!buyItemLine(sentence, k)) return { ok: false, reason: 'sentence', paid };
  if (count(s, k) >= cap(s, k)) return { ok: false, reason: 'full', paid };
  if (s.gold < paid) return { ok: false, reason: 'gold', paid };
  s.gold -= paid;
  addItem(s, k);
  return { ok: true, paid };
}
