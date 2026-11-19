// Quests for 0.3 (press J): main chapter 2 and Konrad's side quest. Pure state; the controller
// fires events and shows the dialogs.

import type { GameState } from './state';

export type QuestId = 'main2' | 'konrad';
export type QuestEvent = 'enterMarket' | 'metMira' | 'boss2' | 'krumeKill' | 'taughtKonrad' | 'heardKonrad';

export interface QuestStep {
  zh: string;
  event: QuestEvent;
  /** How many events finish the step (default 1). */
  count?: number;
}

export interface QuestDef {
  id: QuestId;
  zh: string;
  giver: string;
  steps: QuestStep[];
}

export const QUESTS: Record<QuestId, QuestDef> = {
  main2: {
    id: 'main2',
    zh: '第 2 章 · 面包集市',
    giver: '主线',
    steps: [
      { zh: '穿过邻居家的门，走进面包集市', event: 'enterMarket' },
      { zh: '在集市广场找到商人 Mira', event: 'metMira' },
      { zh: '粮仓深处有个吞掉秤的东西。18 级后打败吞秤者', event: 'boss2' },
    ],
  },
  konrad: {
    id: 'konrad',
    zh: '面包师傅的名字',
    giver: 'Konrad',
    steps: [
      { zh: '帮 Konrad 找回面粉：在菜摊街打倒 5 只碎屑兽', event: 'krumeKill', count: 5 },
      { zh: '回到面包店，教 Konrad 说 5 个面包店的词', event: 'taughtKonrad' },
      { zh: '听 Konrad 把话说完', event: 'heardKonrad' },
    ],
  },
};

/** Konrad's favour: one tier per finished step. At 朋友 he gives his apron and bread heals you. */
export const FAVOUR = ['陌生', '认识', '熟人', '朋友'];

export interface QuestProgress {
  step: number;
  count: number;
  done: boolean;
}

export function questState(s: GameState, id: QuestId): QuestProgress | undefined {
  return s.quests?.[id];
}

export function startQuest(s: GameState, id: QuestId): boolean {
  s.quests ??= {};
  if (s.quests[id]) return false;
  s.quests[id] = { step: 0, count: 0, done: false };
  return true;
}

export interface QuestAdvance {
  id: QuestId;
  /** Index of the step just finished. */
  finished: number;
  done: boolean;
}

/** Feed an event to every active quest; returns the steps it finished. */
export function questEvent(s: GameState, ev: QuestEvent): QuestAdvance[] {
  const out: QuestAdvance[] = [];
  for (const [id, p] of Object.entries(s.quests ?? {}) as Array<[QuestId, QuestProgress]>) {
    if (p.done) continue;
    const steps = QUESTS[id].steps;
    // A later one-off step can happen first (beat the boss before visiting Mira): skip ahead.
    let at = p.step;
    if (steps[at].event !== ev) {
      const later = steps.findIndex((st, i) => i > at && st.event === ev && !st.count);
      if (later < 0) continue;
      at = later;
      p.step = later;
      p.count = 0;
    }
    const step = steps[at];
    p.count += 1;
    if (p.count < (step.count ?? 1)) continue;
    const finished = p.step;
    p.step += 1;
    p.count = 0;
    p.done = p.step >= QUESTS[id].steps.length;
    out.push({ id, finished, done: p.done });
  }
  return out;
}

export function favour(s: GameState): number {
  const p = questState(s, 'konrad');
  if (!p) return 0;
  return p.done ? 3 : p.step;
}

export const KONRAD_WORDS = ['brot', 'broetchen', 'kuchen', 'mehl', 'baeckerei'];
