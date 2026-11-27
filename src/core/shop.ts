// Mira's shop (Lv7). Buying and selling is a click; saying it in German is optional and pays (src/core/shopTalk.ts).
// Prices are counted in 「一小时金币」 (60 kills' worth of gold at your level).

import { hourGold } from './classes';
import type { Verdict } from './grading';
import { makeItem } from './loot';
import type { Rng } from './rng';
import { gradeShopBuy, gradeShopSell, saidPrice, saidSellPrice, type ShopNoun } from './shopTalk';
import type { GameState } from './state';
import type { AffixKey, Item, Quality, Slot } from './types';

export const SHOP_SLOTS = 8;
export const PRICE: Record<Quality, number> = { white: 0.04, green: 0.1, purple: 0.5, orange: 0, red: 0 };
const STOCK_WEIGHTS: Array<[Quality, number]> = [['white', 60], ['green', 32], ['purple', 8]];
export const REFRESH_BASE = 0.05;
export const SELL_SHARE = 0.2;

/** The slot noun you name when buying, in the accusative. */
export const SLOT_NOUN: Record<Slot, { nom: string; acc: string; zh: string; noun: ShopNoun }> = {
  pen: { nom: 'der Stift', acc: 'den Stift', zh: '笔', noun: { de: 'Stift', g: 'm', model: 'def' } },
  coat: { nom: 'der Mantel', acc: 'den Mantel', zh: '外套', noun: { de: 'Mantel', g: 'm', model: 'def' } },
  amulet: { nom: 'das Amulett', acc: 'das Amulett', zh: '护符', noun: { de: 'Amulett', g: 'n', model: 'def' } },
  dict: { nom: 'das Wörterbuch', acc: 'das Wörterbuch', zh: '词典', noun: { de: 'Wörterbuch', g: 'n', model: 'def' } },
  glasses: { nom: 'die Brille', acc: 'die Brille', zh: '眼镜', noun: { de: 'Brille', g: 'f', model: 'def' } },
  phones: { nom: 'der Kopfhörer', acc: 'den Kopfhörer', zh: '耳机', noun: { de: 'Kopfhörer', g: 'm', model: 'def' } },
};

export interface ShopState {
  items: Item[];
  /** Hour key the refresh counter belongs to. */
  hour: string;
  refreshes: number;
  wish: { slot?: Slot; affix?: AffixKey };
}

export function hourKey(t: number): string {
  const d = new Date(t);
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}-${d.getHours()}`;
}

function rollStockQuality(rng: Rng): Quality {
  const total = STOCK_WEIGHTS.reduce((a, [, w]) => a + w, 0);
  let r = rng() * total;
  for (const [q, w] of STOCK_WEIGHTS) {
    if ((r -= w) < 0) return q;
  }
  return 'white';
}

function matchesWish(it: Item, wish: ShopState['wish']): boolean {
  if (wish.slot && it.slot !== wish.slot) return false;
  if (wish.affix && !it.affixes.some((a) => a.key === wish.affix)) return false;
  return !!(wish.slot || wish.affix);
}

/** One shelf item. A wishlist roughly triples the chance of a match (up to 3 tries). */
export function stockItem(s: GameState, rng: Rng, wish: ShopState['wish']): Item {
  let it = makeItem(rng, s.level, rollStockQuality(rng));
  for (let i = 0; i < 2 && (wish.slot || wish.affix) && !matchesWish(it, wish); i++) it = makeItem(rng, s.level, rollStockQuality(rng));
  return it;
}

export function restock(s: GameState, rng: Rng): void {
  const shop = ensureShop(s);
  shop.items = Array.from({ length: SHOP_SLOTS }, () => stockItem(s, rng, shop.wish));
}

export function ensureShop(s: GameState): ShopState {
  s.shop ??= { items: [], hour: '', refreshes: 0, wish: {} };
  return s.shop;
}

/** Open the shop: first visit stocks it; the refresh counter resets on the hour. */
export function openShop(s: GameState, rng: Rng, t: number): ShopState {
  const shop = ensureShop(s);
  const hk = hourKey(t);
  if (shop.hour !== hk) {
    shop.hour = hk;
    shop.refreshes = 0;
  }
  if (!shop.items.length) restock(s, rng);
  return shop;
}

export function price(s: GameState, it: Item): number {
  return Math.max(1, Math.round(hourGold(s) * PRICE[it.quality]));
}

export function sellPrice(s: GameState, it: Item): number {
  return Math.max(1, Math.round(price(s, it) * SELL_SHARE));
}

/** First refresh each hour is free, then 0.05 hour-gold, doubling each time. */
export function refreshCost(s: GameState): number {
  const n = ensureShop(s).refreshes;
  return n === 0 ? 0 : Math.round(hourGold(s) * REFRESH_BASE * 2 ** (n - 1));
}

export function refresh(s: GameState, rng: Rng): boolean {
  const cost = refreshCost(s);
  if (s.gold < cost) return false;
  s.gold -= cost;
  ensureShop(s).refreshes += 1;
  restock(s, rng);
  return true;
}

/** The German buying sentence for this slot at this level (shopTalk). */
export function gradeBuy(input: string, slot: Slot, level: number): Verdict {
  return gradeShopBuy(input, level, SLOT_NOUN[slot].noun);
}

export interface BuyResult {
  ok: boolean;
  /** Only when a sentence was given. */
  verdict?: Verdict;
  paid: number;
  said: boolean;
  reason?: 'gold' | 'bag' | 'sentence';
}

/** A plain buy when `sentence` is null; with a sentence it must be right, and then it is 10% off. */
export function buy(s: GameState, index: number, sentence: string | null, bagSize: number): BuyResult {
  const shop = ensureShop(s);
  const it = shop.items[index];
  const full = price(s, it);
  if (sentence !== null) {
    const verdict = gradeBuy(sentence, it.slot, s.level);
    if (!verdict.ok) return { ok: false, verdict, paid: saidPrice(full), said: true, reason: 'sentence' };
    return finish(s, index, saidPrice(full), true, bagSize, verdict);
  }
  return finish(s, index, full, false, bagSize);
}

function finish(s: GameState, index: number, paid: number, said: boolean, bagSize: number, verdict?: Verdict): BuyResult {
  const shop = ensureShop(s);
  if (s.gold < paid) return { ok: false, verdict, paid, said, reason: 'gold' };
  if (s.bag.length >= bagSize) return { ok: false, verdict, paid, said, reason: 'bag' };
  s.gold -= paid;
  s.bag.push(shop.items[index]);
  shop.items.splice(index, 1);
  return { ok: true, verdict, paid, said };
}

export interface SellResult {
  ok: boolean;
  gold: number;
  verdict?: Verdict;
}

/** A plain sell when `sentence` is omitted; 「Ich möchte den Stift verkaufen.」 said right gets 10% more. */
export function sell(s: GameState, itemId: string, sentence?: string): SellResult {
  const i = s.bag.findIndex((x) => x.id === itemId);
  if (i < 0) return { ok: false, gold: 0 };
  const full = sellPrice(s, s.bag[i]);
  let g = full;
  let verdict: Verdict | undefined;
  if (sentence !== undefined) {
    verdict = gradeShopSell(sentence, SLOT_NOUN[s.bag[i].slot].noun);
    if (!verdict.ok) return { ok: false, gold: 0, verdict };
    g = saidSellPrice(full);
  }
  s.bag.splice(i, 1);
  s.gold += g;
  return { ok: true, gold: g, verdict };
}
