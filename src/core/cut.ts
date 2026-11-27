// 斩杀 (0.6.x) · 笔误 rule: in the field, the noun itself off by one letter still counts as 会写 (not as a hit).
// Not a 笔误: words of 4 letters or fewer, a wrong article, a difference in an umlaut or in the ending
// (Apfel/Äpfel, den/dem), or a typed form that is another word of the list.

import { levenshtein, normalize, stripRefl } from './grading';
import type { Word } from './types';
import { WORDS } from '../data/words';

let FORMS: Set<string> | null = null;
/** Every spelling of the word list (singular and plural), normalized. */
function forms(): Set<string> {
  if (!FORMS) {
    FORMS = new Set();
    for (const w of WORDS) {
      FORMS.add(normalize(w.de).replace(/ /g, ''));
      if (w.pl && w.pl !== '-') FORMS.add(normalize(w.pl).replace(/ /g, ''));
    }
  }
  return FORMS;
}

const fold = (x: string) => x.replace(/ae/g, 'a').replace(/oe/g, 'o').replace(/ue/g, 'u');

/** Typed answer `input` for `w` is a 笔误 (wrong by one letter, counted as 会写). Call only for a wrong answer. */
export function typoOk(input: string, w: Word, withArticle: boolean): boolean {
  const nIn = stripRefl(normalize(input), w);
  let rest = nIn;
  if (withArticle && w.art) {
    const [a0, ...ar] = nIn.split(' ');
    if (a0 !== w.art) return false;
    rest = ar.join(' ');
  }
  const typed = rest.replace(/ /g, '');
  const want = normalize(w.de).replace(/ /g, '');
  if ([...w.de.replace(/[\s-]/g, '')].length <= 4) return false;
  if (!typed || typed === want || levenshtein(typed, want) !== 1) return false;
  if (fold(typed) === fold(want)) return false; // umlaut only
  let pre = 0;
  while (pre < typed.length && pre < want.length && typed[pre] === want[pre]) pre++;
  if (pre >= Math.min(typed.length, want.length) - 1) return false; // the ending
  if (forms().has(typed)) return false; // another word (or a plural) of the list
  return true;
}
