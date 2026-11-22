// 盲盒摊 (0.6 第 6 块 细则二, 26 级), next to Mira: 3 boxes a game day, each labelled with one A1 German line that
// says the slot, the quality and one feature («Ein warmer Mantel. Sehr selten.»). Read it and you know what is
// inside; price by quality, no limit but gold (a bought box is replaced by a new one). Quality odds as the old
// 盲盒 rule: green 79%, purple 20%, orange 1% (about a third as fast as farming for orange).

import { CONFIG } from './config';
import { markUnidentified } from './identify';
import { makeItem } from './loot';
import type { Rng } from './rng';
import { dayKey, now, type GameState } from './state';
import type { Item, Quality, Slot } from './types';

export const BLIND_FROM = 26;
export interface Box {
  slot: Slot;
  quality: Quality;
}

const NOUN: Record<Slot, string> = {
  pen: 'Ein spitzer Stift.',
  coat: 'Ein warmer Mantel.',
  amulet: 'Ein kleines Amulett.',
  dict: 'Ein dickes Wörterbuch.',
  glasses: 'Eine klare Brille.',
};
const RARE: Partial<Record<Quality, string>> = { green: 'Nicht schlecht.', purple: 'Selten.', orange: 'Sehr selten!' };
const PRICE_KILLS: Partial<Record<Quality, number>> = { green: 20, purple: 80, orange: 400 };

export function boxLabel(b: Box): string {
  return `${NOUN[b.slot]} ${RARE[b.quality]}`;
}

export function boxPrice(s: GameState, b: Box): number {
  return (PRICE_KILLS[b.quality] ?? 20) * CONFIG.gold.perKill(s.level);
}

function newBox(rng: Rng): Box {
  const slots: Slot[] = ['pen', 'coat', 'amulet', 'dict', 'glasses'];
  const r = rng();
  return { slot: slots[Math.floor(rng() * slots.length)], quality: r < 0.01 ? 'orange' : r < 0.21 ? 'purple' : 'green' };
}

export function blindBoxes(s: GameState, rng: Rng): Box[] {
  const day = dayKey(now(s));
  let st: { day: string; boxes: Box[] } | null = null;
  try {
    st = s.flags.blind ? JSON.parse(String(s.flags.blind)) : null;
  } catch {
    st = null;
  }
  if (!st || st.day !== day) {
    st = { day, boxes: [newBox(rng), newBox(rng), newBox(rng)] };
    s.flags.blind = JSON.stringify(st);
  }
  return st.boxes;
}

export function buyBox(s: GameState, i: number, rng: Rng, bagSize: number): { ok: boolean; item?: Item; why?: string } {
  const boxes = blindBoxes(s, rng);
  const b = boxes[i];
  if (!b) return { ok: false, why: '没有这个盒子' };
  const price = boxPrice(s, b);
  if (s.gold < price) return { ok: false, why: '金币不够' };
  if (s.bag.length >= bagSize) return { ok: false, why: '背包满了' };
  s.gold -= price;
  const it = makeItem(rng, s.level, b.quality, b.slot);
  markUnidentified(s, it);
  s.bag.push(it);
  boxes[i] = newBox(rng);
  s.flags.blind = JSON.stringify({ day: dayKey(now(s)), boxes });
  return { ok: true, item: it };
}
