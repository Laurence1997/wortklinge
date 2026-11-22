// 地下城规则表 (0.6 第 6 块 细则二, 28 级): 零号站台 as a small dungeon, 5 fights and a small boss. Each run draws one
// German rule card; read it, accept or redraw once. Following the rule pays the bonus; breaking it only voids the
// bonus (no red names before B1). The first clear each day adds a gold chest.
// Written by Claude; needs a native-speaker check.

export type RuleId = 'verben' | 'siezen' | 'keineHilfe' | 'schnell';

export interface Rule {
  id: RuleId;
  de: string;
  zh: string;
  /** Bonus on the clear reward when the rule was kept. */
  mult: number;
}

export const RULES: Rule[] = [
  { id: 'verben', de: 'Heute nur Verben.', zh: '今天只有动词怪。', mult: 1.2 },
  { id: 'siezen', de: 'Bitte siezen!', zh: '请用 Sie：每两场之间站台的守夜人会问你一句，用 du 回答这次加成就作废。', mult: 1.3 },
  { id: 'keineHilfe', de: 'Keine Hilfe.', zh: '不能求助：用了低语，这次加成作废。', mult: 1.5 },
  { id: 'schnell', de: 'Schnell!', zh: '快：每题 10 秒内答，超时这次加成作废。', mult: 1.5 },
];

export const DUNGEON = { fights: 5, from: 28, bossHp: 2.5, bossLvl: 2, seconds: 10, clearXp: 0.025, clearGoldKills: 10 };
// clearXp 0.025 (docs 2026-11-22: a run, rule bonus included, at most 1.2× the field's XP per hour, no run limit).
// `HOURS=2 NODES=1 MAP=1 DUNGEON=1 npx vite-node scripts/sim4.ts`, L28–30: balance ×0.96–1.09, learn ×0.99–1.07,
// grind ×0.93–1.13 except L28 ×1.35 (grind players die a lot in the L28 field, the dungeon stands at their level).
