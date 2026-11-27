// 题型跟准确率走 (Lucas 2026-11-25, 游戏设计 七 · 完形填空): the level only sets the floor of the cloze step
// (pick → type the dictionary form → type the form the sentence needs). Over the last 30 cloze answers,
// 90%+ right moves one step up, under 60% one step back, never below the level's floor. Grammar not open yet is
// never asked early: typing needs level 2, sentence forms level 7 (accusative).

import { clozeModeFor, type ClozeMode } from './cloze';
import type { GameState } from './state';

export const ADAPT = { window: 30, up: 0.9, down: 0.6, baseFrom: 2, formFrom: 7 };
const STEPS: ClozeMode[] = ['pick', 'base', 'form'];

function maxStep(level: number): number {
  return level >= ADAPT.formFrom ? 2 : level >= ADAPT.baseFrom ? 1 : 0;
}

/** The cloze step this player gets now. */
export function clozeModeAt(s: GameState): ClozeMode {
  const floor = STEPS.indexOf(clozeModeFor(s.level));
  const shift = Number(s.flags.clozeShift ?? 0);
  return STEPS[Math.max(floor, Math.min(floor + shift, Math.max(floor, maxStep(s.level))))];
}

/** One cloze answered. Every full window of 30 decides a step up or down, then starts over. */
export function noteCloze(s: GameState, ok: boolean): void {
  const hist = `${String(s.flags.clozeHist ?? '')}${ok ? '1' : '0'}`;
  if (hist.length < ADAPT.window) {
    s.flags.clozeHist = hist;
    return;
  }
  const rate = [...hist].filter((c) => c === '1').length / hist.length;
  const floor = STEPS.indexOf(clozeModeFor(s.level));
  const cur = STEPS.indexOf(clozeModeAt(s)) - floor;
  let shift = cur;
  if (rate >= ADAPT.up && floor + cur < maxStep(s.level)) shift = cur + 1;
  else if (rate < ADAPT.down && cur > 0) shift = cur - 1;
  s.flags.clozeShift = shift;
  s.flags.clozeHist = '';
}
