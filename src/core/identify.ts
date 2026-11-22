// 紫装德语鉴定 (0.6 第 6 块 细则二, 23 级): purple drops and chest items come unidentified (slot and main stat
// shown, affixes hidden and inactive, can still be worn). Mira identifies them with one cloze on a word you have
// met: right = every affix is rolled twice and keeps the better value; wrong = revealed as is. Free, no limit.

import type { BossQuestion } from '../data/boss';
import { WORD_BY_ID } from '../data/words';
import { makeCloze } from './cloze';
import { normalize } from './grading';
import { AFFIX_RANGE } from './loot';
import type { Rng } from './rng';
import type { GameState } from './state';
import type { Item } from './types';

export const IDENTIFY_FROM = 23;

export function markUnidentified(s: GameState, it: Item): void {
  if (it.quality === 'purple' && s.level >= IDENTIFY_FROM) it.unidentified = true;
}

export function unidentifiedItems(s: GameState): Item[] {
  return [...Object.values(s.equipped), ...s.bag].filter((x): x is Item => !!x && !!x.unidentified);
}

export function identify(it: Item, right: boolean, rng: Rng): void {
  if (right)
    for (const a of it.affixes) {
      const [lo, hi] = AFFIX_RANGE[a.key].purple;
      const v = Math.round((lo + rng() * (hi - lo)) * 100) / 100;
      if (v > a.value) a.value = v;
    }
  delete it.unidentified;
}

/** Mira's cloze: an example sentence of a word you have already met, the word's form blanked. */
export function identifyQuestion(s: GameState, rng: Rng): BossQuestion {
  const met = Object.keys(s.words).map((id) => WORD_BY_ID[id]).filter((w) => !!w);
  for (let i = 0; i < 40 && met.length; i++) {
    const w = met[Math.floor(rng() * met.length)];
    const c = makeCloze(w, 'form', rng);
    if (!c) continue;
    const ans = normalize(c.answer);
    return {
      id: `identify-${w.id}`,
      ask: [c.shown],
      zh: `${c.zh}（填空：${w.zh}）`,
      accept: [new RegExp(`^${ans.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`)],
      model: c.full,
    };
  }
  return { id: 'identify-x', ask: ['Ich ___ Lina. (heißen)'], zh: '我叫 Lina。', accept: [/^heisse$/], model: 'Ich heiße Lina.' };
}
