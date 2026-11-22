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
    // 言灵过载 removed (Lucas 2026-11-20): no mechanic may pay less because you learn more. New words have no
    // daily cap; the ones you meet today come back as review monsters on schedule, and those pay extra (xp.dueBonus).
  },

  xp: {
    newMonster: 30,
    dueMonster: 20,
    shadowMonster: 8,
    boss: 300,
    typedKillMult: 1.5,
    /** A review monster beaten when it is due: ×1.5 XP and one extra gear shard. */
    dueBonus: 1.5,
    dueShards: 1,
    strongVerbMult: 1.3,
  },

  /** Minutes for Lv1→2 … Lv5→6 (新手加速), then t(L) = 1.25 × L^0.3 hours. ~1000 XP per active hour. */
  // 0.5 开局节奏表 (block 6): Lv2 ≈ 17, Lv3 ≈ 30, Lv4 ≈ 43, Lv5 ≈ 57 active minutes for a real player. Tuned with the
  // opening bot (sim answer speed) assuming people take about 1.7× its time; the timed playtest has the last word.
  levelMinutes: [67, 49, 40, 38, 60],
  /** 0.3 提速 (curve 2): Lv1–5 need ×0.7 (was 0.25: sim put Lv5 at ~5 min), Lv6–10 ×0.4 of the base curve; Lv11+ unchanged. */
  earlyXpMult: (level: number) => (level <= 5 ? 0.7 : level <= 10 ? 0.4 : 1),
  xpPerHour: 1000,
  /** 0.3 ships regions 1–2; the level cap keeps players inside released content. */
  levelCap: 30,
  /** 终极技能 (30 级, 句型填空版): both blanks right / one right. */
  ultimate: { both: 3, one: 1.5 },
  /** 现在完成时 (0.6 第 5 块): haben/sein stance from 21 (wrong picks free until 22), 填分词 by kind 21/24/27,
   *  region-1/2 verb reviews in the Perfekt one time in three. */
  /** 21 级: big attacks announce when they come (jetzt / gleich / in zwei Runden). */
  timeWords: { from: 21 },
  perfekt: { from: 21, softUntil: 22, irregularFrom: 24, prefixFrom: 27, reviewChance: 1 / 3 },
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
    /** 0.4: HP at Lv1, growing ×1.08 per level (sim05). */
    hp1: 20,
    hpGrow: 1.08,
    /** 0.6.x: knob for monsters from Lv7 (defend turns are gone). 1 = unchanged: the 4/3/2-hit anchors and the 示例战斗 test fix HP; a sim4 MAP run with 1.12 kept
     *  each level within about ±10% of before, but breaks those anchors (docs to decide). */
    hpLate: { from: 7, mult: 1 },
    /** One monster action takes this share of a same-level player's HP. The doc's 15% assumes an action bar of
     *  10–15 s; here the monster acts once per answer (3–10 s), so per action it is lower: about what 0.3 had. */
    dmgPct: (level: number) => (level <= 5 ? 0.06 : 0.12),
    chargeMult: 2, // 0.4 示例战斗: the big one hits ×2
    /** Field monsters are at most this many levels above you (their word may be higher); none above you at Lv1–5. */
    maxAbove: (level: number) => (level <= 5 ? 0 : 1),
    /** HP multiplier by stage: 新怪(无名) / 裂形 / 半名 / shadow. 牙越少，血越薄。 */
    stageHp: { new: 1.0, cracked: 0.85, half: 0.65, shadow: 0.7 },
    overdueHpStep: 0.15,
    /** Each interval overdue also adds this much XP and gold (up to 4 steps → +60%). */
    overdueRewardStep: 0.15,
  },

  damage: {
    roll: [0.85, 1.15] as [number, number],
    vsDefend: 0.3,
    maxMultiplierOfBase: 6,
  },

  /** 0.4 战斗修正版: the answer decides hit or miss, level and gear decide damage; question types
   *  differ through armor. Choice questions hit the armor, typed ones ignore half of it, hard ones
   *  (form cloze, whole sentence) break it: that hit and the next two ignore it. */
  armor: {
    /** Armor A = 2^(monster level − your level) × (1 − 0.04 × gear tier); damage taken = 1 / (1 + A),
     *  so a same-level monster halves a choice hit and the reduction never reaches 100%. */
    base: 2,
    /** Typed questions halve A; hard ones (form cloze, whole sentence) set it to 0 for this hit and the next two. */
    typedFactor: 0.5,
    breakHits: 3,
    /** Hard cap on the reduction A / (1 + A). */
    maxReduction: 0.9,
    /** Each level the monster is above you, it also hits 8% harder. */
    monsterDmgPerLevelBelow: 0.08,
  },

  /** 0.4 伤害: D = same-level monster HP × 0.5 × (1 + 0.18 × gear tier): a same-level monster takes 4 choice hits,
   *  3 typed, 2 hard. */
  playerDmgShare: 0.5,

  /** 0.4 装备档位: 8 tiers per region; tier n needs 40 × n² shards, 1 shard per kill, and a small chance to drop
   *  the next tier whole. */
  gear: { tiers: 8, shardsPerTierSq: 40, wholeChance: 0.02, dmg: 0.18, hp: 0.08, pen: 0.04, affinityRes: 2 },

  /** 0.4 技能改的是下一题: 铭刻 raises the next question one step (×1.5 on a hit), 低语 gives the first letter
   *  (×0.5, costs class resource or a dictionary hint), 齐鸣 lets one answer hit the whole pack. Cooldowns in turns
   *  (铭刻: none since 2026-11-20, a miss costs 1 resource instead). */
  tech: { inscribeCd: 0, inscribeMissCost: 1, inscribeMult: 1.5, chorusCd: 4 },

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
  /** 词性三相 (0.5): right stance = this hit meets armor one tier lower and +1 resource; wrong (Lv6+) = armor ×2, breaks cleared. */
  /** 大地图 + 小世界 (0.5 block 5). nodes: point-and-click scenes instead of walking (?oldmap = the 0.4 map).
   *  slots: monsters per field scene; hopSec: one step between neighbouring scenes. Baseline: 游戏设计 第 5 块验收. */
  map: { nodes: true, slots: 2, hopSec: 1.2, luckyChance: 0.3, veil: 0.35, homeScenes: true, zoneSlots: 12 },
  /** 跟读 (0.5, Lv5+, optional): read the line the monster just said back; sounding right pays XP once per fight, never costs anything. */
  shadow: { xp: 10, match: 0.7 },
  phase: { wrongArmor: 2, rightRes: 1, softUntil: 5, accFrom: 7, datFrom: 15, pronounChance: 0.3, pluralChance: 0.2, pluralHp: 1.5 },
  pack: { hpMult: 0.6, dmgMult: [0.2, 0.12] as [number, number], strayMult: 0.5, max: 3, max3From: 13, radiusTiles: 4, fromLevel: 11 },

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
  /** 晚点之王 (0.6 第 5 块, Lv28): HP 8; rewards as 吞秤者, XP scaled by the level curve. */
  /** 幽灵检票员 Lina (0.6 第 5 块): Lv25+, after Konrad's quest; 30 s a question, HP 5. */
  lina: { hp: 5, seconds: 30, fromLevel: 25 },
  /** 锈名 (0.6 第 6 块, 27 级). */
  rusty: { from: 27, overdue: 3, hpMult: 1.3, rewardMult: 2, shards: 1 },
  /** 刻字孔 (0.6 第 6 块, 25 级). */
  engrave: { from: 25, bonus: 0.2 },
  /** 怪物诅咒 (0.6, 25 级): share of monsters, reward. */
  curse: { from: 25, chance: 0.1, xpMult: 1.3, shards: 1 },
  boss3: { hp: 8, firstTimeSeconds: 45, laterSeconds: 30, xp: 1000, gold: 350 },
};

/** 0.4: a fresh monster's HP at this level (before stage and overdue). */
export function monsterHpAt(level: number): number {
  const late = level >= CONFIG.monster.hpLate.from ? CONFIG.monster.hpLate.mult : 1;
  return CONFIG.monster.hp1 * Math.pow(CONFIG.monster.hpGrow, level - 1) * late;
}

/** A player's HP at this level without gear (monster damage is a share of it). */
export function playerBaseHp(level: number): number {
  return CONFIG.player.baseHp + CONFIG.player.hpPerLevel * (level - 1);
}

export function levelHours(level: number): number {
  if (level <= 5) return CONFIG.levelMinutes[level - 1] / 60;
  return 1.25 * Math.pow(level, 0.3);
}

/** XP needed to go from `level` to `level + 1`. */
export const XP_CURVE = 2;
export function xpToNext(level: number, curve = XP_CURVE): number {
  return Math.round(levelHours(level) * CONFIG.xpPerHour * (curve >= 2 ? CONFIG.earlyXpMult(level) : 1));
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
