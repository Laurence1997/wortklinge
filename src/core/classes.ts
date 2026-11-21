// Classes (Lv10+, chosen at Greta in the market) and their talent trees (points from Lv12).
// Design: 游戏设计页「第 2 区 · 职业试炼 / 天赋」. Pure rules; the UI lives in panels and the controller.

import { CONFIG } from './config';
import type { GameState } from './state';

export type ClassId = 'writer' | 'guardian';

export interface ClassDef {
  id: ClassId;
  zh: string;
  res: string; // resource name
  resMax: number;
  skillZh: string;
  skillCost: number;
  blurb: string[];
  trialZh: string;
}

export const CLASSES: Record<ClassId, ClassDef> = {
  writer: {
    id: 'writer',
    zh: '书写者',
    res: '墨水',
    resMax: 5,
    skillZh: '墨水风暴',
    skillCost: 3,
    trialZh: '3 场战斗，每一题都要默写',
    blurb: [
      '打字题答对墨水 +1，填变形 +2（最多 5）。墨水攒满可放终结技。',
      '被动：连续默写答对 3 题，下一击必定暴击。',
      '职业技能「墨水风暴」（3 墨水）：默写一个你学过的长词，字母越多伤害越高。',
    ],
  },
  guardian: {
    id: 'guardian',
    zh: '守护者',
    res: '沉着',
    resMax: 5,
    skillZh: '稳住',
    skillCost: 3,
    trialZh: '3 场战斗，对手都是拖久了变凶的复习怪',
    blurb: [
      '答错时受到的伤害 −20%。',
      '每答一题（对错都算），沉着 +1（最多 5）。沉着攒满可放终结技。',
      '职业技能「稳住」（3 沉着，不用答题）：挡下这回合的第一击。',
      '「Ich habe keine Ahnung.」的反弹从 20% 升到 30%。',
    ],
  },
};

export interface TalentDef {
  id: string;
  zh: string;
  max: number;
  tier: 1 | 2 | 3;
  desc: (rank: number) => string;
}

export const TALENTS: Record<ClassId, TalentDef[]> = {
  writer: [
    { id: 'bifeng', zh: '笔锋', max: 3, tier: 1, desc: (r) => `默写伤害 +${5 * r}%（每点 5%）` },
    { id: 'changci', zh: '长词', max: 2, tier: 1, desc: (r) => `墨水风暴每个字母再 +${3 * r}%` },
    { id: 'zhanmo', zh: '蘸墨', max: 1, tier: 2, desc: () => '墨水上限 +1' },
    { id: 'yiqi', zh: '一气呵成', max: 1, tier: 2, desc: () => '必暴击只要连对 2 题默写' },
    { id: 'lengjing', zh: '冷静', max: 1, tier: 2, desc: () => '每场第一次默写答错不断连击' },
    { id: 'tengxie', zh: '誊写', max: 1, tier: 3, desc: () => '默写破防后，易伤延长到 3 回合' },
  ],
  guardian: [
    { id: 'houpi', zh: '厚皮', max: 3, tier: 1, desc: (r) => `生命 +${5 * r}%（每点 5%）` },
    { id: 'chenzhuo', zh: '沉着', max: 1, tier: 1, desc: () => '答错时沉着多 +1' },
    { id: 'fanji', zh: '反击', max: 2, tier: 2, desc: (r) => `弹反伤害 +${20 * r}%` },
    { id: 'wen', zh: '稳', max: 2, tier: 2, desc: (r) => `答错受伤再 −${5 * r}%` },
    { id: 'yishou', zh: '以守为攻', max: 1, tier: 3, desc: () => '「稳住」之后，下一题答对多打一次普通攻击' },
  ],
};

/** Points needed in the tree before tier 2 / tier 3 nodes open. */
export const TIER_GATE: Record<1 | 2 | 3, number> = { 1: 0, 2: 3, 3: 6 };
export const TALENT_FROM_LEVEL = 12;

export function talentPoints(s: GameState): number {
  return Math.max(0, s.level - TALENT_FROM_LEVEL + 1);
}

export function tree(s: GameState, c: ClassId = s.cls!): Record<string, number> {
  return (s.talents[c] ??= {});
}

export function spent(s: GameState, c: ClassId = s.cls!): number {
  return Object.values(tree(s, c)).reduce((a, b) => a + b, 0);
}

export function rank(s: GameState, id: string): number {
  if (!s.cls) return 0;
  return s.talents[s.cls]?.[id] ?? 0;
}

export function canLearn(s: GameState, t: TalentDef): boolean {
  if (!s.cls) return false;
  return spent(s) < talentPoints(s) && rank(s, t.id) < t.max && spent(s) >= TIER_GATE[t.tier];
}

export function learn(s: GameState, id: string): boolean {
  const t = s.cls && TALENTS[s.cls].find((x) => x.id === id);
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
  if (!s.cls || s.gold < cost || spent(s) === 0) return false;
  s.gold -= cost;
  s.talents[s.cls] = {};
  return true;
}

export function resMax(s: GameState): number {
  // Before a class: 言灵, 5 at most, from Lv5 (终结技 spends it).
  if (!s.cls) return s.level >= 5 ? 5 : 0;
  return CLASSES[s.cls].resMax + (s.cls === 'writer' ? rank(s, 'zhanmo') : 0);
}

/** Share of a wrong-answer hit you still take (guardian −20%, talent 稳 −5% per point). */
export function wrongHitShare(s: GameState): number {
  if (s.cls !== 'guardian') return 1;
  return 1 - 0.2 - 0.05 * rank(s, 'wen');
}

/** 「Ich habe keine Ahnung.」 reflects 20%, guardians 30%. */
export function shieldReflect(s: GameState): number {
  return s.cls === 'guardian' ? 0.3 : 0.2;
}

/** Typed hits in a row before the writer's guaranteed crit. */
export function critRunNeeded(s: GameState): number {
  return rank(s, 'yiqi') ? 2 : 3;
}

export function hpBonus(s: GameState): number {
  return s.cls === 'guardian' ? 0.05 * rank(s, 'houpi') : 0;
}
