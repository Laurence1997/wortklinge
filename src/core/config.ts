// All tunable numbers live here. They are first drafts from the design doc;
// change them after playtesting, not inside the rules code.

export const HOUR = 3600_000;
export const MINUTE = 60_000;
export const DAY = 24 * HOUR;

export const CONFIG = {
  /** A new in-game day starts at 04:00 local time (players up past midnight keep their day). */
  dayStartHour: 4,

  srs: {
    /** Respawn interval after the 1st defeat (无名 → 裂形) and the 2nd (裂形 → 半名).
     *  Design: 当天、隔天、再过两三天 → 归名 at the earliest on day 3. */
    intervals: [16 * HOUR, 40 * HOUR],
    /** Tutorial words respawn quickly so the Lv3 bonfire lesson works. */
    tutorialInterval: 3 * MINUTE,
    /** After 归名 the word relapses after these gaps (about 1 week, 1 month, 3 months, then 6 months). */
    relapse: [7 * DAY, 30 * DAY, 90 * DAY, 180 * DAY],
    /** 言灵过载 starts after this many new words in one day. Not a lock: the player keeps
     *  playing, new monsters just pay less and reviews pay more (see `overload`). */
    dailyNewCap: 30,
  },

  /** 言灵过载: a learning limit expressed as a game rule, never a hard lock. */
  overload: {
    newXp: 0.5,
    newGold: 0.5,
    newDrop: 0.5,
    dueXp: 1.5,
    dueGold: 1.5,
    dueDrop: 1, // due monsters already have the review drop bonus (×1.5)
  },

  xp: {
    newMonster: 30,
    dueMonster: 20,
    shadowMonster: 8,
    boss: 300,
    typedKillMult: 1.5,
    strongVerbMult: 1.3,
  },

  /** Minutes for Lv1→2 … Lv5→6 (新手加速), then t(L) = 1.25 × L^0.3 hours. ~1000 XP per active hour. */
  levelMinutes: [10, 20, 30, 45, 60],
  xpPerHour: 1000,
  /** 0.3 ships regions 1–2; the level cap keeps players inside released content. */
  levelCap: 20,
  /** The neighbour's door opens onto region 2 (面包集市) at this level, after the region-1 boss. */
  region2Level: 10,

  player: {
    baseHp: 30,
    hpPerLevel: 4,
    baseAtk: 5,
    atkPerLevel: 1,
    baseCrit: 0.05,
    critMult: 1.5,
    postFightHealPct: 0.15,
  },

  monster: {
    hpBase: 8,
    hpPerLevel: 2.2,
    dmgBase: 1.5,
    dmgPerLevel: 0.85,
    chargeMult: 2.5,
    /** HP multiplier by stage: 新怪(无名) / 裂形 / 半名 / shadow. 牙越少，血越薄。 */
    stageHp: { new: 1.0, cracked: 0.85, half: 0.65, shadow: 0.7 },
    overdueHpStep: 0.15,
    /** Each interval overdue also adds this much XP and gold (up to 4 steps → +60%). */
    overdueRewardStep: 0.15,
  },

  damage: {
    roll: [0.85, 1.15] as [number, number],
    choice: 1.0,
    typed: 1.4,
    sentence: 1.6,
    breakMult: 0.5,
    vsDefend: 0.3,
    vulnerable: 1.5,
    /** Same noun reused in recent sentence attacks: 100% / 70% / 50% / 30%. */
    freshness: [1, 0.7, 0.5, 0.3],
    maxMultiplierOfBase: 6,
  },

  combo: [
    { at: 50, name: '言灵附体 Wortgewalt', dmg: 0.5 },
    { at: 20, name: '雄辩 Redegewandt', dmg: 0.35 },
    { at: 10, name: '熟练 Geübt', dmg: 0.2 },
    { at: 5, name: '流畅 Flüssig', dmg: 0.1 },
  ],

  status: {
    burnTurns: 2,
    burnPctOfAtk: 0.35,
    poisonMaxStacks: 5,
    poisonPerStackPctOfAtk: 0.12,
    iceDamageMult: 0.7,
    vulnerableTurns: 2,
  },

  loot: {
    smallDropRate: 0.2,
    qualityWeights: { white: 70, green: 24, purple: 5, orange: 1 },
    bagSize: 30,
  },

  gold: { perKill: (lvl: number) => Math.round(5 * (1 + lvl / 10)) },

  /**
   * 群怪 (region 2): per-monster damage ×0.5 with 2, ×0.35 with 3 (doc said 0.6 / 0.45; sim 2026-11-19 at
   * 75% accuracy gave 13–23% deaths per pack fight). Packs of 3 only from Lv13. 点名 on the wrong one deals half.
   */
  pack: { dmgMult: [0.5, 0.35] as [number, number], strayMult: 0.5, max: 3, max3From: 13, radiusTiles: 4, fromLevel: 11 },

  boss: {
    /** Share of region words that must be at least 半名 before the boss appears. */
    halfNameShare: 0.4,
    minLevel: 8,
    hp: 6,
    firstTimeSeconds: 60,
    laterSeconds: 35,
    healAt: 2,
  },

  /** 吞秤者 (region 2, Lv18): prices and quantities. */
  boss2: { hp: 7, firstTimeSeconds: 45, laterSeconds: 30, xp: 900, gold: 300 },
};

export function levelHours(level: number): number {
  if (level <= 5) return CONFIG.levelMinutes[level - 1] / 60;
  return 1.25 * Math.pow(level, 0.3);
}

/** XP needed to go from `level` to `level + 1`. */
export function xpToNext(level: number): number {
  return Math.round(levelHours(level) * CONFIG.xpPerHour);
}

/** Level-gap decay: monsters far below you give almost nothing. */
export function levelGapMult(playerLevel: number, monsterLevel: number): number {
  const d = playerLevel - monsterLevel;
  if (d < 0) return Math.min(1.5, 1 + 0.05 * -d);
  if (d <= 5) return 1;
  if (d <= 10) return 0.5;
  if (d <= 20) return 0.2;
  return 0; // grey: 1 XP flat, handled by caller
}
