// 言石 (游戏设计 九, 62 级; Lucas 2026-11-25: 符文和语法宝石合一). Minimal version, values 暂定.
// Each gem carries one grammar already taught (a 规则怪谈 board seen). Made at the camp bonfire from shards, behind a
// 言灵锁 (the most overdue word: right → the quality is rolled twice, the better kept). Set into a purple / orange
// item's gem socket (the 语气词孔 stays its own socket); a right answer on that grammar triggers its stat — damage, HP,
// penetration or survival. It moves with the item; moving it to another item costs shards. Stacks with 语法星位.
// 62 级起 the forgotten chest always holds one.

import type { GramSys } from './gram/task';
import { BOARDS } from './gram/boards';
import type { Rng } from './rng';
import type { GameState } from './state';
import type { Item, Quality } from './types';

export type GemQ = Exclude<Quality, 'red'>;
export type GemKind = 'dmg' | 'heal' | 'pen' | 'guard';

export interface Gem {
  id: string;
  sys: GramSys;
  q: GemQ;
  kind: GemKind;
  /** 刻满 progress: right answers on its grammar while worn. */
  fill?: number;
  /** Times it was filled: each adds a small step to its effect. */
  step?: number;
  /** Filled and waiting for its free re-carve. */
  recarve?: boolean;
}

export const GEM = {
  from: 62,
  /** 暂定 shard costs (from the current region's balance). */
  craftCost: 20,
  moveCost: 10,
  /** 暂定 quality weights (white, green, purple, orange). */
  weights: [50, 30, 15, 5] as const,
  /** 暂定 effect per quality step: ×1 / 1.5 / 2.2 / 3. */
  qMult: { white: 1, green: 1.5, purple: 2.2, orange: 3 } as Record<GemQ, number>,
  /** 暂定 base: dmg +6% · heal 2% max HP · pen 4% armor ignored · guard −6% hits taken this turn. */
  base: { dmg: 0.06, heal: 0.02, pen: 0.04, guard: 0.06 } as Record<GemKind, number>,
  /** 刻满 (Lucas 2026-11-25, N 暂定): right answers to fill; then a reward, +20% effect per fill, a free re-carve. */
  fillN: 15,
  stepAdd: 0.2,
  fillShards: 5,
  /** Share of the XP to the next level. */
  fillXp: 0.01,
};

export const GEM_Q: GemQ[] = ['white', 'green', 'purple', 'orange'];
export const GEM_KIND_ZH: Record<GemKind, string> = { dmg: '伤害', heal: '回血', pen: '穿透', guard: '减伤' };

export function gemTitle(sys: GramSys): string {
  return (BOARDS[sys]?.title ?? sys).replace(/^规则怪谈 · /, '');
}

export function gemValue(g: Gem): number {
  return GEM.base[g.kind] * GEM.qMult[g.q] * (1 + GEM.stepAdd * (g.step ?? 0));
}

export function gemText(g: Gem): string {
  const v = Math.round(gemValue(g) * 1000) / 10;
  const what = g.kind === 'dmg' ? `伤害 +${v}%` : g.kind === 'heal' ? `回 ${v}% 生命` : g.kind === 'pen' ? `无视 ${v}% 护甲` : `这回合受到伤害 −${v}%`;
  return `「${gemTitle(g.sys)}」言石：答对这条语法的题时${what}${g.recarve ? '（已刻满，可免费重刻）' : ` · 刻满 ${g.fill ?? 0}/${GEM.fillN}`}`;
}

/** Grammars a gem can carry: the boards this player has seen. */
export function gemGrammars(s: GameState): GramSys[] {
  return ((s.gram?.boards ?? []) as GramSys[]).filter((x) => !!BOARDS[x]);
}

function rollQ(rng: Rng): GemQ {
  const total = GEM.weights.reduce((a, b) => a + b, 0);
  let r = rng() * total;
  for (let i = 0; i < GEM_Q.length; i++) {
    r -= GEM.weights[i];
    if (r < 0) return GEM_Q[i];
  }
  return 'white';
}

export function makeGem(sys: GramSys, rng: Rng, twice = false): Gem {
  let q = rollQ(rng);
  if (twice) {
    const q2 = rollQ(rng);
    if (GEM_Q.indexOf(q2) > GEM_Q.indexOf(q)) q = q2;
  }
  const kinds: GemKind[] = ['dmg', 'heal', 'pen', 'guard'];
  return { id: `gem${Math.floor(rng() * 1e9).toString(36)}`, sys, q, kind: kinds[Math.floor(rng() * kinds.length)] };
}

function balKey(s: GameState): string {
  return String(s.region ?? 1);
}

/** Craft: pays the shards, adds the gem to the gem bag. `right` = the 言灵锁 was answered right. */
export function craftGem(s: GameState, sys: GramSys, right: boolean, rng: Rng): { ok: boolean; why?: string; gem?: Gem } {
  if (s.level < GEM.from) return { ok: false, why: `${GEM.from} 级才能合成言石。` };
  if (!gemGrammars(s).includes(sys)) return { ok: false, why: '这条语法还没学过。' };
  const k = balKey(s);
  const bal = s.shardBal?.[k] ?? 0;
  if (bal < GEM.craftCost) return { ok: false, why: `碎片不够（要 ${GEM.craftCost} 片，本区余额 ${bal}）。` };
  s.shardBal![k] = bal - GEM.craftCost;
  const gem = makeGem(sys, rng, right);
  (s.gems ??= []).push(gem);
  return { ok: true, gem };
}

/** Items that can hold a gem: purple / orange from 62 (one gem socket each, besides the 语气词孔). */
export function gemItems(s: GameState): Item[] {
  return [...Object.values(s.equipped), ...s.bag].filter((x): x is Item => !!x && (x.quality === 'purple' || x.quality === 'orange'));
}

/** Set a gem from the bag into an item. A gem already there goes back to the bag. */
export function setGem(s: GameState, gemId: string, itemId: string): boolean {
  const i = (s.gems ?? []).findIndex((g) => g.id === gemId);
  const it = gemItems(s).find((x) => x.id === itemId);
  if (i < 0 || !it) return false;
  const [g] = s.gems!.splice(i, 1);
  if (it.gem) s.gems!.push(it.gem);
  it.gem = g;
  return true;
}

/** Take a gem out of an item (to move it on): costs shards. */
export function unsetGem(s: GameState, itemId: string): { ok: boolean; why?: string } {
  const it = gemItems(s).find((x) => x.id === itemId);
  if (!it?.gem) return { ok: false, why: '这件没有言石。' };
  const k = balKey(s);
  const bal = s.shardBal?.[k] ?? 0;
  if (bal < GEM.moveCost) return { ok: false, why: `取下言石要 ${GEM.moveCost} 片碎片（本区余额 ${bal}）。` };
  s.shardBal![k] = bal - GEM.moveCost;
  (s.gems ??= []).push(it.gem);
  delete it.gem;
  return { ok: true };
}

/** Gems worn on equipped items that fire on this grammar. */
export function gemsFor(s: GameState, sys: GramSys | undefined): Gem[] {
  if (!sys) return [];
  return Object.values(s.equipped).flatMap((it) => (it?.gem && it.gem.sys === sys ? [it.gem] : []));
}

/** Sum of a kind over the gems firing on this grammar. */
export function gemSum(s: GameState, sys: GramSys | undefined, kind: GemKind): number {
  return gemsFor(s, sys).filter((g) => g.kind === kind).reduce((a, g) => a + gemValue(g), 0);
}

/** A right answer on `sys`: worn gems of it fill up. Returns the gems that just filled (reward paid by the caller). */
export function fillGems(s: GameState, sys: GramSys | undefined): Gem[] {
  const out: Gem[] = [];
  for (const g of gemsFor(s, sys)) {
    if (g.recarve) continue;
    g.fill = (g.fill ?? 0) + 1;
    if (g.fill >= GEM.fillN) {
      g.fill = 0;
      g.step = (g.step ?? 0) + 1;
      g.recarve = true;
      s.gemFull = [...new Set([...(s.gemFull ?? []), g.sys])];
      const k = String(s.region ?? 1);
      s.shardBal = { ...(s.shardBal ?? {}), [k]: (s.shardBal?.[k] ?? 0) + GEM.fillShards };
      out.push(g);
    }
  }
  return out;
}

/** Grammars a filled gem may be re-carved to for free: taught, never filled before (Lucas 2026-11-25). */
export function recarveChoices(s: GameState): GramSys[] {
  const full = new Set(s.gemFull ?? []);
  return gemGrammars(s).filter((x) => !full.has(x));
}

/** All gems, worn or in the bag. */
export function allGems(s: GameState): Gem[] {
  return [...(s.gems ?? []), ...gemItems(s).flatMap((it) => (it.gem ? [it.gem] : []))];
}

export function recarve(s: GameState, gemId: string, sys: GramSys): boolean {
  const g = allGems(s).find((x) => x.id === gemId);
  if (!g?.recarve || !recarveChoices(s).includes(sys)) return false;
  g.sys = sys;
  g.fill = 0;
  g.recarve = false;
  return true;
}
