// 言灵精通 (游戏设计 四「121–200 级」/ 五: 满级后经验转为「言灵精通」点数，用来点小幅加成; 裂隙深层每 10 层首到 +1 点).
// The tracks and their sizes are 暂定 (the doc says only 「小幅加成」); they reuse affix keys so every place that reads
// gear affixes reads them too.

import type { AffixKey } from './types';

export type MasteryTrack = 'dmg' | 'hp' | 'dropRate' | 'wrongDmgReduce';
export const MASTERY: Record<MasteryTrack, { zh: string; per: number; max: number }> = {
  dmg: { zh: '伤害', per: 0.005, max: 40 },
  hp: { zh: '生命', per: 0.005, max: 40 },
  dropRate: { zh: '掉落', per: 0.01, max: 40 },
  wrongDmgReduce: { zh: '答错少挨打', per: 0.005, max: 40 },
};

type Flags = Record<string, unknown>;
export const masteryPts = (f: Flags): number => (f.masteryPts as number) ?? 0;
export const masteryIn = (f: Flags, t: MasteryTrack): number => (f[`mastery_${t}`] as number) ?? 0;
export const masteryFree = (f: Flags): number => masteryPts(f) - (Object.keys(MASTERY) as MasteryTrack[]).reduce((a, t) => a + masteryIn(f, t), 0);

export function spendMastery(f: Flags, t: MasteryTrack): boolean {
  if (masteryFree(f) <= 0 || masteryIn(f, t) >= MASTERY[t].max) return false;
  f[`mastery_${t}`] = masteryIn(f, t) + 1;
  return true;
}

/** Bonus added to the affix total of this key. */
export function masteryAffix(f: Flags | undefined, key: AffixKey | string): number {
  if (!f || !(key in MASTERY)) return 0;
  const t = key as MasteryTrack;
  return masteryIn(f, t) * MASTERY[t].per;
}
