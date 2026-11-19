// Mira's shop (Lv11, market square). Buying is a German sentence: "Ich nehme den Stift."
// Prices are counted in 「一小时金币」 (60 kills' worth of gold at your level).

import { hourGold } from './classes';
import { normalize, type Verdict } from './grading';
import { makeItem } from './loot';
import { pick, type Rng } from './rng';
import type { GameState } from './state';
import type { AffixKey, Item, Quality, Slot } from './types';

export const SHOP_SLOTS = 8;
export const PRICE: Record<Quality, number> = { white: 0.04, green: 0.1, purple: 0.5, orange: 0 };
const STOCK_WEIGHTS: Array<[Quality, number]> = [['white', 60], ['green', 32], ['purple', 8]];
export const REFRESH_BASE = 0.05;
export const BARGAIN_OFF = 0.1;
export const SELL_SHARE = 0.2;

/** The slot noun you name when buying, in the accusative. */
export const SLOT_NOUN: Record<Slot, { nom: string; acc: string; zh: string }> = {
  pen: { nom: 'der Stift', acc: 'den Stift', zh: '笔' },
  coat: { nom: 'der Mantel', acc: 'den Mantel', zh: '外套' },
  amulet: { nom: 'das Amulett', acc: 'das Amulett', zh: '护符' },
  dict: { nom: 'das Wörterbuch', acc: 'das Wörterbuch', zh: '词典' },
};

export const BARGAIN_LINES = ['Geht das billiger?', 'Das ist zu teuer.', 'Haben Sie einen Rabatt?'];

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

/** "Ich nehme den Stift." — accusative of the slot noun. */
export function gradeBuy(input: string, slot: Slot): Verdict {
  const n = SLOT_NOUN[slot];
  const want = normalize(`Ich nehme ${n.acc}`);
  const got = normalize(input);
  if (got === want) return { ok: true, notes: [], correct: `Ich nehme ${n.acc}.` };
  const notes: string[] = [];
  if (!got.startsWith('ich nehme')) notes.push('买东西要说：Ich nehme + 第四格');
  else if (slot === 'pen' || slot === 'coat') {
    if (got.includes(normalize(n.nom))) notes.push(`${n.nom} 是阳性，在 nehmen 后面要变成第四格：${n.acc}`);
    else if (/\b(die|das|dem|des)\b/.test(got)) notes.push(`${n.nom.split(' ')[1]} 是阳性：${n.acc}`);
  } else if (/\b(den|der|die|dem)\b/.test(got)) notes.push(`${n.nom.split(' ')[1]} 是中性，第四格不变：${n.acc}`);
  return { ok: false, notes, correct: `Ich nehme ${n.acc}.` };
}

export function gradeBargain(input: string): boolean {
  const g = normalize(input);
  return BARGAIN_LINES.some((l) => normalize(l) === g);
}

export interface BuyResult {
  ok: boolean;
  verdict: Verdict;
  paid: number;
  bargained: boolean;
  reason?: 'gold' | 'bag' | 'sentence';
}

export function buy(s: GameState, index: number, sentence: string, bargain: string, bagSize: number): BuyResult {
  const shop = ensureShop(s);
  const it = shop.items[index];
  const verdict = gradeBuy(sentence, it.slot);
  const bargained = bargain.trim() !== '' && gradeBargain(bargain);
  const paid = Math.round(price(s, it) * (bargained ? 1 - BARGAIN_OFF : 1));
  if (!verdict.ok) return { ok: false, verdict, paid, bargained, reason: 'sentence' };
  if (s.gold < paid) return { ok: false, verdict, paid, bargained, reason: 'gold' };
  if (s.bag.length >= bagSize) return { ok: false, verdict, paid, bargained, reason: 'bag' };
  s.gold -= paid;
  s.bag.push(it);
  shop.items.splice(index, 1);
  return { ok: true, verdict, paid, bargained };
}

export function sell(s: GameState, itemId: string): number {
  const i = s.bag.findIndex((x) => x.id === itemId);
  if (i < 0) return 0;
  const g = sellPrice(s, s.bag[i]);
  s.bag.splice(i, 1);
  s.gold += g;
  return g;
}

export function randomBargainHint(rng: Rng): string {
  return pick(rng, BARGAIN_LINES);
}
