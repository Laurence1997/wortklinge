// Monster intents: tendency table → layers → sentence template (游戏设计 › 意图分层).

import { FAMILIES, PHRASES } from '../data/families';
import { pick, weighted, type Rng } from './rng';
import type { Element, FamilyId, Intent, IntentKind } from './types';

export interface IntentContext {
  level: number;
  family: FamilyId;
  hpRatio: number;
  turnsSinceCharge: number;
  trapUsed: boolean;
  /** Force a specific intent (tutorial fights). */
  force?: Partial<Intent> & { kind: IntentKind };
}

export const ELEMENT_ZH: Record<Element, string> = {
  phys: '物理',
  ice: '冰',
  fire: '火',
  poison: '毒',
  lightning: '电',
};

/** 0.6.x (逻辑梳理 5): only the two intents with a signal the player can answer are left — 蓄力 and 逃跑 (forced by
 *  combat.ts). Every other turn is a plain physical attack, one hit; its line is replaced by the word's example. */
export function generateIntent(rng: Rng, ctx: IntentContext): Intent {
  const fam = FAMILIES[ctx.family];
  if (ctx.force) return buildForced(ctx, fam.verb);
  // Two charges at least 3 turns apart; never open a fight with a charge.
  // The removed defend turns become attacks, so a charge stays as frequent as before.
  const t = fam.tendency;
  const w = { attack: (t.attack ?? 1) + (t.defend ?? 0), charge: ctx.turnsSinceCharge < 3 ? 0 : t.charge ?? 0 };
  const kind = weighted(rng, w) as 'attack' | 'charge';
  if (kind === 'charge') {
    const [line, zh] = pick(rng, PHRASES.charge);
    return { kind, shown: kind, hits: 1, element: 'phys', line, zh, layers: [] };
  }
  return { kind: 'attack', shown: 'attack', hits: 1, element: 'phys', line: '… mmh …', zh: '（它含糊地念着什么，听不清。）', layers: [] };
}

function buildForced(ctx: IntentContext, verb: { ich: string; zh: string }): Intent {
  const f = ctx.force!;
  const shown = (f.shown ?? (f.kind === 'wait' ? 'attack' : f.kind)) as Intent['shown'];
  const hits = f.hits ?? (f.kind === 'attack' ? 1 : 0);
  return {
    kind: f.kind,
    shown,
    hits,
    element: f.element ?? 'phys',
    line: f.line ?? `Ich ${verb.ich}!`,
    zh: f.zh ?? `我${verb.zh}！`,
    layers: f.layers ?? [],
  };
}

/** Legacy (sims): the move that used to counter each intent. Combat now has one move; the intent decides the question. */
export const COUNTER: Record<IntentKind, 'attack' | 'block' | 'break'> = {
  attack: 'block',
  defend: 'break',
  charge: 'attack',
  heal: 'attack',
  wait: 'attack',
  flee: 'attack',
};

export const INTENT_ZH: Record<IntentKind, string> = {
  attack: '攻击',
  defend: '防御',
  charge: '蓄力',
  heal: '治疗',
  wait: '不行动',
  flee: '逃跑',
};
