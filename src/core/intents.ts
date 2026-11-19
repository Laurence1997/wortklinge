// Monster intents: tendency table → layers → sentence template (游戏设计 › 意图分层).

import { FAMILIES, PHRASES, THROWABLES } from '../data/families';
import { pick, weighted, type Rng } from './rng';
import type { Element, FamilyId, Intent, IntentKind } from './types';
import { has } from './unlocks';

export interface IntentContext {
  level: number;
  family: FamilyId;
  hpRatio: number;
  turnsSinceCharge: number;
  trapUsed: boolean;
  /** Force a specific intent (tutorial fights). */
  force?: Partial<Intent> & { kind: IntentKind };
}

const COUNT_DE = ['', '', 'zweimal', 'dreimal'];
const COUNT_ZH = ['', '', '两下', '三下'];
const ELEMENT_OF: Record<'m' | 'f' | 'n', Element> = { m: 'ice', f: 'fire', n: 'poison' };
export const ELEMENT_ZH: Record<Element, string> = {
  phys: '物理',
  ice: '冰',
  fire: '火',
  poison: '毒',
  lightning: '电',
};

export function generateIntent(rng: Rng, ctx: IntentContext): Intent {
  const fam = FAMILIES[ctx.family];
  if (ctx.force) return buildForced(ctx, fam.verb);

  const weights: Partial<Record<IntentKind, number>> = { ...fam.tendency };
  if (!has(ctx.level, 'heal') || ctx.hpRatio > 0.6) delete weights.heal;
  // Two charges at least 3 turns apart; never open a fight with a charge.
  if (ctx.turnsSinceCharge < 3) delete weights.charge;
  delete weights.wait;
  const kind = weighted(rng, weights) as Exclude<IntentKind, 'wait'>;

  if (kind === 'attack') return attackIntent(rng, ctx, fam.verb);
  const [line, zh] = pick(rng, PHRASES[kind]);
  return { kind, shown: kind, hits: 1, element: 'phys', line, zh, layers: [] };
}

function attackIntent(rng: Rng, ctx: IntentContext, verb: { ich: string; zh: string }): Intent {
  // Negation trap: at most one per fight in A1 (读漏一层只会吃亏，不会直接输).
  if (has(ctx.level, 'layerNegation') && !ctx.trapUsed && rng() < 0.18) {
    const variants: Array<[string, string]> = [
      [`Ich ${verb.ich} jetzt nicht.`, `我现在不${verb.zh}。（这回合不攻击）`],
      ['Ich greife jetzt nicht an.', '我现在不进攻。（这回合不攻击）'],
      [`Heute ${verb.ich} ich nicht.`, `今天我不${verb.zh}。（这回合不攻击）`],
    ];
    const [line, zh] = pick(rng, variants);
    return { kind: 'wait', shown: 'attack', hits: 0, element: 'phys', line, zh, layers: ['negation'] };
  }

  let hits = 1;
  if (has(ctx.level, 'layerCount') && rng() < 0.35) hits = rng() < 0.6 ? 2 : 3;
  const useElement = has(ctx.level, 'layerElement') && rng() < 0.4;

  if (useElement) {
    const t = pick(rng, THROWABLES);
    const element = ELEMENT_OF[t.g];
    const count = hits > 1 ? ` ${COUNT_DE[hits]}` : '';
    const line = `Ich werfe ${t.akk} ${t.de}${count}!`;
    const zh = `我扔${t.zh}${hits > 1 ? COUNT_ZH[hits] : ''}！（${t.akk} → ${ELEMENT_ZH[element]}）`;
    const layers: Intent['layers'] = hits > 1 ? ['element', 'count'] : ['element'];
    return { kind: 'attack', shown: 'attack', hits, element, line, zh, layers };
  }
  if (hits > 1) {
    return {
      kind: 'attack',
      shown: 'attack',
      hits,
      element: 'phys',
      line: `Ich ${verb.ich} ${COUNT_DE[hits]}!`,
      zh: `我${verb.zh}${COUNT_ZH[hits]}！`,
      layers: ['count'],
    };
  }
  if (rng() < 0.55) {
    const [line, zh] = pick(rng, PHRASES.attack);
    return { kind: 'attack', shown: 'attack', hits: 1, element: 'phys', line, zh, layers: [] };
  }
  return {
    kind: 'attack',
    shown: 'attack',
    hits: 1,
    element: 'phys',
    line: `Ich ${verb.ich}!`,
    zh: `我${verb.zh}！`,
    layers: [],
  };
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

/** The move that counters each intent (读对意图并出对克制招式，连击额外 +1). */
export const COUNTER: Record<IntentKind, 'attack' | 'block' | 'break'> = {
  attack: 'block',
  defend: 'break',
  charge: 'attack',
  heal: 'attack',
  wait: 'attack',
};

export const INTENT_ZH: Record<IntentKind, string> = {
  attack: '攻击',
  defend: '防御',
  charge: '蓄力',
  heal: '治疗',
  wait: '不行动',
};
