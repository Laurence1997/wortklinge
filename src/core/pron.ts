// 回音怪 (游戏设计 › 回音怪规则, 2026-11-23): a monster whose word has a minimal-pair partner can ask the pair
// instead of its usual question. Sayable categories are read aloud when the player has the phoneme model on;
// otherwise (and always for length pairs) the game reads one of the two and the player picks which.
// A misread never costs a turn: the UI turns the question into the listening one (see ui/battle).

import { pick, shuffle, type Rng } from './rng';
import type { GameState } from './state';
import type { Word } from './types';
import { PRON_PAIRS, SAYABLE, type PronCat, type PronPair } from '../data/pairs';

/** Chance an attack on a pair word asks the pair (once per fight), before the weak-spot bonus. */
export const ECHO_CHANCE = 0.35;
/** Extra chance when the category is often missed (× miss rate). */
export const ECHO_WEAK_BONUS = 0.3;
/** CTC log-likelihood gap (nats) under which the model is not sure: "没听清", read again. */
export const ECHO_SURE = 1;
/** Re-reads allowed after "没听清" before the question becomes the listening one. */
export const ECHO_RETRIES = 2;

export interface EchoTask {
  pair: PronPair;
  cat: PronCat;
  target: string;
  partner: string;
  ipaT: string;
  ipaP: string;
  zhT: string;
  zhP: string;
  /** The category can be judged when read aloud. */
  sayable: boolean;
  /** Set by the UI: read aloud (true) or listen and pick (false). */
  say?: boolean;
}

const bare = (de: string) => de.replace(/^(der|die|das) /, '');

/** Pairs this word belongs to (its singular or its plural is one side). */
export function pairsFor(w: Word): Array<{ p: PronPair; side: 'a' | 'b' }> {
  const forms = [bare(w.de), w.pl && w.pl !== '-' ? w.pl : ''].filter(Boolean);
  const out: Array<{ p: PronPair; side: 'a' | 'b' }> = [];
  for (const p of PRON_PAIRS) {
    if (forms.includes(p.a)) out.push({ p, side: 'a' });
    else if (forms.includes(p.b)) out.push({ p, side: 'b' });
  }
  return out;
}

export function missRate(s: GameState, cat: PronCat): number {
  const r = s.pron?.[cat];
  if (!r || r.ok + r.miss < 3) return 0;
  return r.miss / (r.ok + r.miss);
}

/** The pair task for this word, or null (no pair, or the roll said no). */
export function echoTask(s: GameState, w: Word, rng: Rng, force?: PronCat[]): EchoTask | null {
  const found = pairsFor(w).filter((x) => !force || force.includes(x.p.cat));
  if (!found.length) return null;
  const { p, side } = pick(rng, found);
  if (!force && rng() >= ECHO_CHANCE + ECHO_WEAK_BONUS * missRate(s, p.cat)) return null;
  const sayable = SAYABLE.includes(p.cat);
  // Read aloud: the monster's own word. Listening: either side, so knowing the monster doesn't give it away.
  const t: 'a' | 'b' = sayable ? side : rng() < 0.5 ? 'a' : 'b';
  const o = t === 'a' ? 'b' : 'a';
  return { pair: p, cat: p.cat, target: p[t], partner: p[o], ipaT: p[t === 'a' ? 'ipaA' : 'ipaB'], ipaP: p[o === 'a' ? 'ipaA' : 'ipaB'], zhT: p[t === 'a' ? 'zhA' : 'zhB'], zhP: p[o === 'a' ? 'zhA' : 'zhB'], sayable };
}

/** 审查修订 A7: when a read-aloud pair turns into listening, half the time the game reads the other word,
 *  so knowing which monster it is doesn't give the answer away. */
export function listenSide(t: EchoTask, rng: Rng): EchoTask {
  if (!t.sayable || rng() >= 0.5) return t;
  return { ...t, target: t.partner, partner: t.target, ipaT: t.ipaP, ipaP: t.ipaT, zhT: t.zhP, zhP: t.zhT };
}

export function echoOptions(t: EchoTask, rng: Rng): string[] {
  return shuffle(rng, [t.target, t.partner]);
}

/** 发音怪 (83, 游戏设计 八): the required B1 version of 回音怪, on the sounds Chinese speakers find hardest (小舌音 r
 *  against l, ü and ö, ich against sch). Every attack question is the pair; other moves only graze it. Without the
 *  phoneme model (or with the mic off) it is the listening version, with no reward lost (八「模型自愿下载」). */
export const PRON_MON = { from: 83, cats: ['iü', 'uü', 'oö', 'eö', 'chsch', 'rl'] as PronCat[], chance: 0.5, otherMult: 0.5 };

export function pronMonOk(w: Word): boolean {
  return pairsFor(w).some((x) => PRON_MON.cats.includes(x.p.cat));
}

/** Model verdict from the two CTC scores: more like the target, like the partner, or not sure. */
export function echoVerdict(scoreTarget: number, scorePartner: number): 'ref' | 'partner' | 'tie' {
  const d = scoreTarget - scorePartner;
  if (!Number.isFinite(d)) return 'tie';
  return d > ECHO_SURE ? 'ref' : d < -ECHO_SURE ? 'partner' : 'tie';
}

/** Count a pair answer for the weak-spot record (单词本 › 发音). */
export function notePron(s: GameState, cat: PronCat, ok: boolean): void {
  s.pron ??= {};
  const r = (s.pron[cat] ??= { ok: 0, miss: 0 });
  if (ok) r.ok += 1;
  else r.miss += 1;
}
