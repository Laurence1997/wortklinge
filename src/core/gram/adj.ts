// 形容词词尾 (41 级, 游戏设计 十六「语法线」): on noun monsters, the noun's own example slot with an adjective put in.
// der-type → weak endings (-e / -en); ein-type → mixed (ein guter Tee, ein gutes Brot). Dative from 15 is all -en.

import { pick, type Rng } from '../rng';
import type { Word } from '../types';
import type { GramTask } from './task';
import { nounSlots } from './a1';

type G = 'm' | 'f' | 'n' | 'pl';
type C = 'nom' | 'acc' | 'dat';

const WEAK: Record<C, Record<G, string>> = {
  nom: { m: 'e', f: 'e', n: 'e', pl: 'en' },
  acc: { m: 'en', f: 'e', n: 'e', pl: 'en' },
  dat: { m: 'en', f: 'en', n: 'en', pl: 'en' },
};
const MIXED: Record<C, Record<G, string>> = {
  nom: { m: 'er', f: 'e', n: 'es', pl: 'en' },
  acc: { m: 'en', f: 'e', n: 'es', pl: 'en' },
  dat: { m: 'en', f: 'en', n: 'en', pl: 'en' },
};

/** Adjectives that fit almost any thing or person (the drill is the ending, not the meaning). */
const ADJ: Array<[string, string]> = [
  ['gut', '好的'],
  ['neu', '新的'],
  ['groß', '大的'],
  ['klein', '小的'],
  ['schön', '漂亮的'],
];

const tidy = (s: string) => s.replace(/\s+/g, ' ').replace(/\s+([.,!?])/g, '$1').trim();

export function adjEnding(indef: boolean, c: C, g: G): string {
  return (indef ? MIXED : WEAK)[c][g];
}

export function adjTask(w: Word, rng: Rng, level: number): GramTask | null {
  const slots = nounSlots(w, level >= 15).filter((x) => !(x.indef && x.g === 'pl'));
  if (!slots.length) return null;
  const x = pick(rng, slots);
  const [adj, zh] = pick(rng, ADJ);
  const ans = adj + adjEnding(x.indef, x.c, x.g);
  return {
    sys: 'adj',
    prompt: `形容词词尾：把 ${adj}（${zh}）加上正确的词尾填进去 · ${x.zh}`,
    focus: tidy(`${x.before}${x.art} ___ ${w.de}${x.after}`) + `（${adj}）`,
    answer: ans,
    tier: 1,
    rule: x.indef
      ? 'ein 类冠词后：冠词没露出性别时形容词替它露（ein guter, ein gutes），其余 -e / -en，第三格一律 -en'
      : 'der 类冠词后：第一格单数和第四格的 die / das 加 -e，其余（den、dem、复数）加 -en',
    full: tidy(`${x.before}${x.art} ${ans} ${w.de}${x.after}`),
    zh: x.zh,
    wordId: w.id,
  };
}
