// 装备掉落规则 (游戏设计 九): 红装 (111 级: 首领 1%、满级后裂隙第 10 层以上首领 3%, 连续 60 个首领没红下一个必红),
// 橙装保底 150 件, 主题套装 (101 级, 2 件和 4 件各有奖励).
// 铁匠打造和拓印 were cut (Lucas 2026-11-25, 「按推荐」): 碎片换装备 at the bonfire instead (九「碎片换装备」): the
// shard 累计 unlocks tier n at 40 × n², the 余额 pays (first trade of a tier free, then 10 × n); quality and affixes
// rolled as a drop; unwanted gear can be broken back into about 3 shards of the region you are in.
// How set pieces are obtained waits for the docs thread. Numbers marked 暂定 are not in the doc yet.

import { hourGold } from './classes';
import { CONFIG } from './config';
import { has } from './unlocks';
import { addGearKill, regionTier } from './state';
import { regionLevels } from '../data/zones';
import { makeItem, rollQuality } from './loot';
import type { Rng } from './rng';
import type { GameState } from './state';
import type { Affix, AffixKey, Item, Quality, Slot } from './types';
import { WORDS } from '../data/words';
import { AREAS } from '../data/world';

export const FORGE = {
  setFrom: 101,
  redFrom: 111,
  /** 暂定: gold per set piece, in hours of gold. */
  setGold: 0.5,
  /** 暂定: region materials per set piece, and the drop chance per kill in that region. */
  setMats: 12,
  matChance: 0.15,
  /** 红装 and 橙装 drop rules (九). */
  redBoss: 0.01,
  redRiftBoss: 0.03,
  redRiftFloor: 10,
  redPity: 60,
  orangePity: 150,
};

export interface ForgeSave {
  /** Region materials (主题套装), by region number. */
  mats?: Record<string, number>;
  /** Drops since the last orange; bosses since the last red. */
  orangePity?: number;
  redPity?: number;
}

const forge = (s: GameState): ForgeSave => (s.forge ??= {});

export function goldFor(s: GameState, hours: number): number {
  return Math.round(hourGold(s) * hours);
}

export interface ForgeResult {
  ok: boolean;
  why?: string;
}

// ---- 碎片换装备 ----------------------------------------------------------------------------------------------

/** 碎片换档 (九, 2026-11-25 暂定 in the doc): the 累计 (gearKills, only grows) unlocks tier n at 40 × n²; the 余额
 *  (shardBal) pays. The first trade after each new tier is free, so 「4 下变 3 下」 happens at once; after that any slot
 *  again, 10 × n shards each. Opens at level 3 (the first tier comes around then). 分解 gives about 3 shards. */
export const SHARD = { salvage: 3, from: 3, costPerTier: 10 };

const freeKey = (region: number) => `shardTrade_${region}`;
/** Highest tier of this region whose free trade was taken. */
export function tradedTier(s: GameState, region: number): number {
  return (s.flags[freeKey(region)] as number) ?? 0;
}
export function shardBalance(s: GameState, region: number): number {
  return s.shardBal?.[String(region)] ?? 0;
}
/** What a trade in this region gives and costs now. */
export function tradeInfo(s: GameState, region: number): { tier: number; cost: number; can: boolean; free: boolean } {
  const tier = regionTier(s, region);
  const free = tier > tradedTier(s, region);
  const cost = free ? 0 : SHARD.costPerTier * tier;
  return { tier, cost, free, can: s.level >= SHARD.from && tier > 0 && shardBalance(s, region) >= cost };
}
/** Free trades waiting in this region (one per tier unlocked and not yet traded). */
export function tradesOpen(s: GameState, region: number): number {
  return s.level >= SHARD.from ? Math.max(0, regionTier(s, region) - tradedTier(s, region)) : 0;
}

/** Item level of a region's tier n: the region's first level + n (九「换装节奏和物品等级」). */
export function tierIlvl(region: number, tier: number): number {
  const start = region <= 3 ? (region - 1) * 10 + 1 : regionLevels(region)[0];
  return start + tier;
}

/** Trade for a piece of the chosen slot at the tier unlocked in this region. */
export function tradeShards(s: GameState, region: number, slot: Slot, rng: Rng, bagSize = CONFIG.loot.bagSize): ForgeResult & { item?: Item; cost?: number } {
  const i = tradeInfo(s, region);
  if (s.level < SHARD.from) return { ok: false, why: `${SHARD.from} 级开放碎片换档。` };
  if (!i.tier) return { ok: false, why: '这一区还没攒够第 1 档的碎片（40 片）。' };
  if (!i.can) return { ok: false, why: `余额不够：这一档每次 ${i.cost} 片，你有 ${shardBalance(s, region)} 片。` };
  if (s.bag.length >= bagSize) return { ok: false, why: '背包满了，先卖掉或分解一些。' };
  const maxQ: Quality = has(s.level, 'purple') ? 'orange' : 'green';
  const q = pityOrange(s, rollQuality(rng, maxQ), maxQ);
  const it: Item = { ...makeItem(rng, tierIlvl(region, i.tier), q, slot), tier: i.tier, region };
  if (i.free) s.flags[freeKey(region)] = tradedTier(s, region) + 1; // one free trade per tier unlocked
  else (s.shardBal ??= {})[String(region)] = shardBalance(s, region) - i.cost;
  s.bag.push(it);
  return { ok: true, item: it, cost: i.cost };
}

/** Break a bag item into shards of the region you are in. */
export function salvage(s: GameState, itemId: string): ForgeResult & { shards?: number } {
  const i = s.bag.findIndex((x) => x.id === itemId);
  if (i < 0) return { ok: false, why: '背包里没有这件。' };
  s.bag.splice(i, 1);
  addGearKill(s, s.region ?? 1, 1, SHARD.salvage);
  return { ok: true, shards: SHARD.salvage };
}

// ---- 保底: 橙装 150 件, 红装 60 个首领 -------------------------------------------------------------------------

/** Call for every rolled drop quality (monsters, chests): after 150 drops with no orange the next one is orange. */
export function pityOrange(s: GameState, q: Quality, maxQ: Quality): Quality {
  if (maxQ !== 'orange' && maxQ !== 'red') return q;
  const f = forge(s);
  if (q === 'orange' || q === 'red') {
    f.orangePity = 0;
    return q;
  }
  f.orangePity = (f.orangePity ?? 0) + 1;
  if (f.orangePity >= FORGE.orangePity) {
    f.orangePity = 0;
    return 'orange';
  }
  return q;
}

/** A boss went down: maybe a red item (1%; 3% for rift bosses on floor 10+ after max level; the 60th boss without one
 *  always). Null before 111. */
export function bossRed(s: GameState, rng: Rng, opts: { riftFloor?: number } = {}): Item | null {
  if (s.level < FORGE.redFrom) return null;
  const f = forge(s);
  const deep = s.level >= 200 && (opts.riftFloor ?? 0) >= FORGE.redRiftFloor;
  const p = deep ? FORGE.redRiftBoss : FORGE.redBoss;
  f.redPity = (f.redPity ?? 0) + 1;
  if (rng() >= p && f.redPity < FORGE.redPity) return null;
  f.redPity = 0;
  return makeItem(rng, s.level, 'red');
}

// ---- 主题套装 -----------------------------------------------------------------------------------------------

export type SetFour = 'killHeal' | 'firstMissFree' | 'startRes' | 'comboHalf' | 'goldUp' | 'typedCrit';

/** 暂定: the 2-piece bonus is an affix (one of the four allowed kinds), the 4-piece one a German-behaviour effect. */
export const SET_FOUR: Record<SetFour, string> = {
  killHeal: '每打倒一只怪回 8% 生命',
  firstMissFree: '每场第一次答错不扣血',
  startRes: '每场开打时言灵 +1',
  comboHalf: '答错时连击减半，不清零',
  goldUp: '金币 +15%',
  typedCrit: '打字答对暴击率 +10%',
};
const FOUR_CYCLE: SetFour[] = ['comboHalf', 'killHeal', 'typedCrit', 'firstMissFree', 'startRes', 'goldUp'];
const TWO_CYCLE: Array<[AffixKey, number]> = [['dmg', 0.08], ['hp', 0.1], ['pen', 0.04], ['wrongDmgReduce', 0.08]];

export interface SetDef {
  region: number;
  zh: string;
  two: Affix;
  four: SetFour;
}

export function setDef(region: number): SetDef | null {
  const a = AREAS.find((x) => x.region === region);
  if (!a) return null;
  const [key, value] = TWO_CYCLE[(region - 1) % TWO_CYCLE.length];
  return { region, zh: `${a.zh}套`, two: { key, value }, four: FOUR_CYCLE[(region - 1) % FOUR_CYCLE.length] };
}

export function mats(s: GameState, region: number): number {
  return forge(s).mats?.[String(region)] ?? 0;
}

/** A kill in a region may drop one of its materials (from 101). */
export function rollMat(s: GameState, region: number, rng: Rng): boolean {
  if (s.level < FORGE.setFrom || !setDef(region) || rng() >= FORGE.matChance) return false;
  const f = forge(s);
  f.mats ??= {};
  f.mats[String(region)] = (f.mats[String(region)] ?? 0) + 1;
  return true;
}

/** Make one set piece: materials + gold + a met word of that region, spelt (no letters spent: the materials pay). */
export function craftSet(s: GameState, region: number, slot: Slot, input: string, rng: Rng): ForgeResult & { item?: Item } {
  const d = setDef(region);
  if (!d || s.level < FORGE.setFrom) return { ok: false, why: `${FORGE.setFrom} 级开主题套装。` };
  if (mats(s, region) < FORGE.setMats) return { ok: false, why: `素材不够（要 ${FORGE.setMats}，有 ${mats(s, region)}）。` };
  const word = WORDS.find((w) => (w.region ?? 1) === region && s.words[w.id] && w.de === input.trim());
  if (!word) return { ok: false, why: `打出一个你在${d.zh.replace('套', '')}见过的词（大小写要对）。` };
  const g = goldFor(s, FORGE.setGold);
  if (s.gold < g) return { ok: false, why: `金币不够（要 ${g}）。` };
  s.gold -= g;
  forge(s).mats![String(region)] -= FORGE.setMats;
  const it = makeItem(rng, s.level, 'purple', slot);
  it.set = region;
  it.name = `${d.zh}·${it.name}`;
  return { ok: true, item: it };
}

/** Pieces of each set you wear. */
export function setCounts(s: Pick<GameState, 'equipped' | 'rift'>): Record<number, number> {
  const out: Record<number, number> = {};
  if (s.rift) return out;
  for (const it of Object.values(s.equipped)) if (it?.set) out[it.set] = (out[it.set] ?? 0) + 1;
  return out;
}

/** Set affixes worn (2 pieces), added to affixTotal. */
export function setAffix(s: Pick<GameState, 'equipped' | 'rift'>, key: string): number {
  let t = 0;
  for (const [r, n] of Object.entries(setCounts(s))) {
    const d = setDef(Number(r));
    if (d && n >= 2 && d.two.key === key) t += d.two.value;
  }
  return t;
}

/** Is this 4-piece effect on? */
export function setFour(s: Pick<GameState, 'equipped' | 'rift'>, eff: SetFour): boolean {
  return Object.entries(setCounts(s)).some(([r, n]) => n >= 4 && setDef(Number(r))?.four === eff);
}
