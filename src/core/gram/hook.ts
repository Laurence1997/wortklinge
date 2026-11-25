// 语法题挂在单词怪上 (语法教学统一框架, Lucas 2026-11-25): after a system unlocks, the word monster in front of you
// sometimes asks that system on its own word instead of the usual question. The first question of a new system
// always comes (with its 规则怪谈看板); after that about one attack question in four, at most two per fight.

import { CONFIG } from '../config';
import { pick, type Rng } from '../rng';
import type { GameState } from '../state';
import type { Word } from '../types';
import type { GramSys, GramTask } from './task';
import { impTask, keinTask, meinTask, modalTask, sepTask } from './a1';
import { datPronTask, nichtTask, timePrepTask } from './a1b';
import { praetModalTask, praetSeinTask, praetTask } from './praet';
import { adjTask } from './adj';
import { ablautFieldTask } from './dungeons';
import { boardDue, type ShownBoard } from './boards';

/** Unlock levels (游戏设计 十六「语法线」). */
export const GRAM_LV: Partial<Record<GramSys, number>> = {
  kein: 5,
  nicht: 5,
  mein: 6,
  modal: 8,
  timePrep: 10,
  sep: 12,
  imp: 14,
  datPron: 15,
  praetSein: 21,
  praetModal: 33,
  adj: 41,
  praet: 81,
  /** 变音秘境: only verbs whose family floor is cleared. */
  ablaut: 24,
};

export const GRAM_CFG = { chance: 0.25, perFight: 2 };

type Gen = (s: GameState, w: Word, rng: Rng) => GramTask | null;

const datOpen = (s: GameState) => s.level >= CONFIG.phase.datFrom;

const GENS: Partial<Record<GramSys, Gen>> = {
  kein: (s, w, rng) => keinTask(w, rng, datOpen(s)),
  nicht: (_s, w, rng) => nichtTask(w, rng),
  mein: (s, w, rng) => meinTask(w, rng, datOpen(s)),
  modal: (_s, w, rng) => modalTask(w, rng),
  timePrep: (_s, w, rng) => timePrepTask(w, rng),
  sep: (_s, w, rng) => sepTask(w, rng),
  imp: (_s, w) => impTask(w),
  datPron: (_s, w, rng) => datPronTask(w, rng),
  praetSein: (_s, w, rng) => praetSeinTask(w, rng),
  praetModal: (_s, w, rng) => praetModalTask(w, rng),
  adj: (s, w, rng) => adjTask(w, rng, s.level),
  praet: (_s, w, rng) => praetTask(w, rng),
  ablaut: (s, w, rng) => ablautFieldTask(s, w, rng),
};

export function gramOpen(s: GameState, sys: GramSys): boolean {
  const lv = GRAM_LV[sys];
  return lv !== undefined && s.level >= lv;
}

/** A grammar task on this word right now, or null (then the usual question). `asked` = grammar questions this fight. */
export function gramFor(s: GameState, w: Word, rng: Rng, asked = 0): { task: GramTask; board: ShownBoard | null } | null {
  if (asked >= GRAM_CFG.perFight) return null;
  const tasks: GramTask[] = [];
  for (const sys of Object.keys(GENS) as GramSys[]) {
    if (!gramOpen(s, sys)) continue;
    const t = GENS[sys]!(s, w, rng);
    if (t) tasks.push(t);
  }
  if (!tasks.length) return null;
  // A system whose board hasn't been shown comes first and always.
  const fresh = tasks.find((t) => boardDue(s, t.sys));
  if (fresh) return { task: fresh, board: boardDue(s, fresh.sys) };
  if (rng() >= GRAM_CFG.chance) return null;
  return { task: pick(rng, tasks), board: null };
}
