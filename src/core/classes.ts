// 天赋树（共用一棵）(游戏设计 十, Lucas 2026-11-25): the combat classes are gone. Everyone shares one tree with five
// branches; each branch ends in a big talent that changes how you play. Points: 1 per level at 12–30, 1 per 2 levels
// at 31–120 (誓约 quests add permanent points later). Respec at the mentor for about an hour's gold.
//
// Only the nodes the doc names are in yet (from the old class trees). 言辞 / 秩序 / 迅捷 and the rest of 笔锋 / 守势
// (about 15 nodes per branch) wait for the docs thread to write them ("其余节点 0.7 开工前写全").

import { CONFIG } from './config';
import type { GameState } from './state';

/** Kept only so old saves and the leaderboard type-check; nobody has a class any more. */
export type ClassId = 'writer' | 'guardian';

export type Branch = 'bifeng' | 'shoushi' | 'yanci' | 'zhixu' | 'xunjie';

export const BRANCHES: Record<Branch, { zh: string; about: string }> = {
  bifeng: { zh: '笔锋', about: '默写、变形、墨水风暴' },
  shoushi: { zh: '守势', about: '答错减伤、稳住' },
  yanci: { zh: '言辞', about: '终结技、连句、搭配' },
  zhixu: { zh: '秩序', about: '格和变位、封印、破甲' },
  xunjie: { zh: '迅捷', about: '速答、即时战、听写' },
};

export interface TalentDef {
  id: string;
  zh: string;
  branch: Branch;
  max: number;
  /** The branch's last node: needs BIG_GATE points in its branch first. */
  big?: boolean;
  desc: (rank: number) => string;
}

export const TALENT_TREE: TalentDef[] = [
  { id: 'bifeng', zh: '笔锋', branch: 'bifeng', max: 3, desc: (r) => `默写伤害 +${5 * r}%（每点 5%）` },
  { id: 'changci', zh: '连写', branch: 'bifeng', max: 2, desc: (r) => `墨水风暴每写对一个形式再 +${10 * r}%` },
  { id: 'critRun', zh: '一气呵成', branch: 'bifeng', max: 1, desc: () => '连对 3 题默写，下一击必暴击' },
  { id: 'tengxie', zh: '誊写', branch: 'bifeng', max: 1, big: true, desc: () => '难题破甲后，无视护甲从 3 下延长到 4 下' },
  { id: 'houpi', zh: '厚皮', branch: 'shoushi', max: 3, desc: (r) => `生命 +${5 * r}%（每点 5%）` },
  { id: 'shoushi', zh: '守势', branch: 'shoushi', max: 1, desc: () => '答错时受到的伤害 −20%' },
  { id: 'yishou', zh: '以守为攻', branch: 'shoushi', max: 1, big: true, desc: () => '稳住生效时答对，同时打出一次普通攻击' },
];

/** Points spent in a branch before its big talent opens (provisional until the docs thread writes the full tree). */
export const BIG_GATE = 4;
export const TALENT_FROM_LEVEL = 12;
/** One per level up to here, then one per two levels up to 120. */
export const TALENT_EVERY_LEVEL_UNTIL = 30;
export const TALENT_UNTIL = 120;

export function talentPoints(s: Pick<GameState, 'level'>): number {
  const l = Math.min(s.level, TALENT_UNTIL);
  if (l < TALENT_FROM_LEVEL) return 0;
  const early = Math.min(l, TALENT_EVERY_LEVEL_UNTIL) - TALENT_FROM_LEVEL + 1;
  const late = l > TALENT_EVERY_LEVEL_UNTIL ? Math.floor((l - TALENT_EVERY_LEVEL_UNTIL) / 2) : 0;
  return early + late;
}

export function tree(s: GameState): Record<string, number> {
  return ((s.talents as Record<string, Record<string, number>>).shared ??= {});
}

export function spent(s: GameState): number {
  return Object.values(tree(s)).reduce((a, b) => a + b, 0);
}

export function spentIn(s: GameState, br: Branch): number {
  const t = tree(s);
  return TALENT_TREE.filter((x) => x.branch === br).reduce((a, x) => a + (t[x.id] ?? 0), 0);
}

export function rank(s: GameState, id: string): number {
  return (s.talents as Record<string, Record<string, number>>).shared?.[id] ?? 0;
}

export function canLearn(s: GameState, t: TalentDef): boolean {
  return spent(s) < talentPoints(s) && rank(s, t.id) < t.max && (!t.big || spentIn(s, t.branch) >= BIG_GATE);
}

export function learn(s: GameState, id: string): boolean {
  const t = TALENT_TREE.find((x) => x.id === id);
  if (!t || !canLearn(s, t)) return false;
  tree(s)[id] = rank(s, id) + 1;
  return true;
}

/** 「一小时金币」: 60 kills' worth of gold at your level. Prices and respec are counted in it. */
export function hourGold(s: GameState): number {
  return 60 * CONFIG.gold.perKill(s.level);
}

export function respecCost(s: GameState): number {
  return hourGold(s);
}

export function respec(s: GameState): boolean {
  const cost = respecCost(s);
  if (s.gold < cost || spent(s) === 0) return false;
  s.gold -= cost;
  (s.talents as Record<string, Record<string, number>>).shared = {};
  return true;
}

/** 言灵 is the only resource: 5 at most, from Lv4 (铭刻 misses cost it; 终结技 spends it from Lv5). */
export function resMax(s: GameState): number {
  return s.level >= 4 ? 5 : 0;
}

/** Share of a wrong-answer hit you still take (talent 守势 −20%). */
export function wrongHitShare(s: GameState): number {
  return 1 - 0.2 * rank(s, 'shoushi');
}

/** Typed hits in a row before the guaranteed crit (talent 一气呵成), or 0 when not learned. */
export function critRunNeeded(s: GameState): number {
  return rank(s, 'critRun') ? 3 : 0;
}

export function hpBonus(s: GameState): number {
  return 0.05 * rank(s, 'houpi');
}
