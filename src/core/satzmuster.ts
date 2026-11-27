// 经典句型 · 句型怪 (Lucas 2026-11-27 选 1, 游戏设计「句式块」): each of the 140 classic patterns is a monster living in
// a field scene (scripts/build_lexicon.py, satzmuster-v1.tsv). Its example has the key words in {} (one or more blanks).
// First meeting: one teaching choice (the right key words or those of two other patterns of the same stage). After that:
// type the key words in order, the whole Chinese given. Finisher: write the whole example from the Chinese.

import { LEX_PAT } from '../data/lexicon';
import { WORDS } from '../data/words';
import { normalize } from './grading';
import { shuffle, type Rng } from './rng';
import type { Word } from './types';

export interface PatLine {
  /** Example with ___ for each blank. */
  shown: string;
  full: string;
  zh: string;
  blanks: string[];
  /** The blanks as one answer: typed in order, separated by spaces (punctuation and … don't count). */
  answer: string;
}

export function isPattern(w: Word): boolean {
  return !!LEX_PAT[w.id];
}

export function parsePat(line: string): PatLine | null {
  const [de, zh = ''] = line.split('|');
  const blanks: string[] = [];
  const shown = de.replace(/\{([^}]+)\}/g, (_, x: string) => {
    blanks.push(x);
    return '___';
  });
  if (!blanks.length) return null;
  return { shown, full: de.replace(/[{}]/g, ''), zh, blanks, answer: blanks.join(' ') };
}

export function patLine(w: Word): PatLine | null {
  const l = LEX_PAT[w.id];
  return l ? parsePat(l) : null;
}

/** Stage of a region (A1 1–3, A2 4–8, B1 9–12, B2 13+): wrong options come from patterns of the same stage. */
const stage = (r: number) => (r <= 3 ? 0 : r <= 8 ? 1 : r <= 12 ? 2 : 3);
const key = (v: string) => normalize(v);

/** How a choice option shows several blanks: «Wäre es möglich … zu». */
export const optionText = (p: PatLine) => p.blanks.join(' … ');

/** Two wrong options (key words of other patterns of the same stage) and the right one, shuffled. */
export function patOptions(w: Word, p: PatLine, rng: Rng): string[] {
  const right = optionText(p);
  const pool = WORDS.filter((x) => x.id !== w.id && isPattern(x) && stage(x.region ?? 1) === stage(w.region ?? 1))
    .map((x) => patLine(x))
    .filter((x): x is PatLine => !!x && key(x.answer) !== key(p.answer))
    .map(optionText);
  const wrong = shuffle(rng, [...new Set(pool)]).slice(0, 2);
  return shuffle(rng, [right, ...wrong]);
}

/** Right when the key words are typed in order, or the whole example is typed out. */
export function gradePat(input: string, answer: string, full: string): boolean {
  return key(input) === key(answer) || key(input) === key(full);
}
