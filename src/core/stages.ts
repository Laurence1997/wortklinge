// 0.7 + 0.8 · 突破试炼 gates (游戏设计 五「等级和欧标」, 七): the level cap is the end of the first stage you have
// not passed yet — 30 until A1 (four parts) is passed, 80 until A2, 120 until B1, 160 until B2 — and never above
// CONFIG.levelCap. 200 (C1) is the end: its trial is the last boss 「沉默」 (游戏设计 四「121–200 级」), so no gate there.
import { CONFIG } from './config';

export type Stage = 'A1' | 'A2' | 'B1' | 'B2';

export interface StageDef {
  stage: Stage;
  /** Last level of the stage: the trial opens here and the cap sits here until it is passed. */
  cap: number;
  /** Regions whose words the trial asks. */
  regions: [number, number];
  title: string;
}

export const STAGES: StageDef[] = [
  { stage: 'A1', cap: 30, regions: [1, 3], title: 'A1 突破者' },
  { stage: 'A2', cap: 80, regions: [4, 8], title: 'A2 突破者' },
  { stage: 'B1', cap: 120, regions: [9, 12], title: 'B1 突破者' },
  { stage: 'B2', cap: 160, regions: [13, 16], title: 'B2 突破者' },
];

export const STAGE_DEF: Record<Stage, StageDef> = Object.fromEntries(STAGES.map((d) => [d.stage, d])) as Record<Stage, StageDef>;

/** A1 needs all four parts (saves from before the grammar part keep a1Passed but owe a1Grammar). */
export function stagePassed(flags: Record<string, unknown>, stage: Stage): boolean {
  if (stage === 'A1') return !!flags.a1Passed && !!flags.a1Grammar;
  return !!flags[stagePassFlag(stage)];
}

/** The save flag of a passed stage after A1. */
export function stagePassFlag(stage: Stage): string {
  return stage === 'A2' ? 'a2Passed' : stage === 'B1' ? 'b1Passed' : 'b2Passed';
}

export function levelCapFor(flags: Record<string, unknown> | undefined): number {
  const f = flags ?? {};
  for (const d of STAGES) if (!stagePassed(f, d.stage)) return Math.min(CONFIG.levelCap, d.cap);
  return CONFIG.levelCap;
}

/** The trial a player at this level may take now (the first unpassed stage whose cap they have reached). */
export function trialDue(level: number, flags: Record<string, unknown>): Stage | null {
  for (const d of STAGES) {
    if (stagePassed(flags, d.stage)) continue;
    return level >= d.cap ? d.stage : null;
  }
  return null;
}

/** 突破试炼可以提前考 (Lucas 2026-11-25): the first stage not passed yet, whatever the level. Passing early opens the
 *  cap at that stage's last level with no second test. */
export function nextStage(flags: Record<string, unknown>): Stage | null {
  for (const d of STAGES) if (!stagePassed(flags, d.stage)) return d.stage;
  return null;
}
