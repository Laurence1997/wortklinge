// 装备掉落规则 (游戏设计 九): 红装 (111 级: 首领 1%、满级后裂隙第 10 层以上首领 3%, 连续 60 个首领没红下一个必红),
// 橙装保底 150 件, 主题套装 (101 级, 2 件和 4 件各有奖励).
// 铁匠打造和拓印 were cut (Lucas 2026-11-25, 「按推荐」): 碎片换装备 at the bonfire instead (九「碎片换装备」): reaching
// 40 × n² shards in a region lets you pick a slot and take that slot's tier-n piece of the region, quality and
// affixes rolled as a drop; unwanted gear can be broken back into about 3 shards of the region you are in.
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

/** 暂定 (九 says 「一件约 3 片」). One trade per tier reached (暂定: the doc doesn't say whether a tier trades again). */
export const SHARD = { salvage: 3 };

const tradedKey = (region: number) => `shardTrade_${region}`;
export function tradedTier(s: GameState, region: number): number {
  return (s.flags[tradedKey(region)] as number) ?? 0;
}
/** Tiers reached in this region that have not been traded yet. */
export function tradesOpen(s: GameState, region: number): number {
  return Math.max(0, regionTier(s, region) - tradedTier(s, region));
}

/** Item level of a region's tier n: the region's first level + n (九「换装节奏和物品等级」). */
export function tierIlvl(region: number, tier: number): number {
  const start = region <= 3 ? (region - 1) * 10 + 1 : regionLevels(region)[0];
  return start + tier;
}

/** Trade the next untraded tier of this region for a piece in the chosen slot. */
export function tradeShards(s: GameState, region: number, slot: Slot, rng: Rng, bagSize = CONFIG.loot.bagSize): ForgeResult & { item?: Item } {
  if (!tradesOpen(s, region)) return { ok: false, why: '这一区还没攒够下一档的碎片。' };
  if (s.bag.length >= bagSize) return { ok: false, why: '背包满了，先卖掉或分解一些。' };
  const tier = tradedTier(s, region) + 1;
  const maxQ: Quality = has(s.level, 'purple') ? 'orange' : 'green';
  const q = pityOrange(s, rollQuality(rng, maxQ), maxQ);
  const it = makeItem(rng, tierIlvl(region, tier), q, slot);
  s.flags[tradedKey(region)] = tier;
  s.bag.push(it);
  return { ok: true, item: it };
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
