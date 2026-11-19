// Rule-based grading. No AI: every verdict is reproducible and explainable.

import type { Word } from './types';

/** Lowercase, umlauts → ae/oe/ue/ss, drop punctuation, collapse spaces. */
export function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .replace(/[’'`´]/g, '')
    .replace(/[.,!?;:…"„“()]/g, ' ')
    .replace(/-/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Same as the expected text apart from punctuation and surrounding spaces. */
function stripPunct(s: string): string {
  return s
    .replace(/[’'`´]/g, '')
    .replace(/[.,!?;:…"„“()]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const d = Array.from({ length: m + 1 }, (_, i) => [i, ...new Array(n).fill(0)]);
  for (let j = 1; j <= n; j++) d[0][j] = j;
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[m][n];
}

/** Equal after normalizing; spaces inside the word don't matter ("E-Mail" = "email"). */
function sameText(a: string, b: string, articleFirst: boolean): boolean {
  if (a === b) return true;
  if (!articleFirst) return a.replace(/ /g, '') === b.replace(/ /g, '');
  const [a0, ...ar] = a.split(' ');
  const [b0, ...br] = b.split(' ');
  return a0 === b0 && ar.join('') === br.join('');
}

export interface Verdict {
  ok: boolean;
  /** Shown under the answer: the correct form, umlaut / capital-letter notes, or why it is wrong. */
  notes: string[];
  /** The fully correct form to display. */
  correct: string;
}

const ARTICLES = ['der', 'die', 'das'];

/**
 * Grade a typed word. For nouns pass `withArticle` to require "der Tee".
 * ae/oe/ue/ss are accepted as correct, but the proper spelling is shown.
 */
export function gradeTyped(input: string, w: Word, withArticle: boolean): Verdict {
  const expected = withArticle && w.art ? `${w.art} ${w.de}` : w.de;
  const nIn = normalize(input);
  const nExp = normalize(expected);
  const notes: string[] = [];
  if (!nIn) return { ok: false, notes: ['没有作答'], correct: expected };

  if (sameText(nIn, nExp, withArticle && !!w.art)) {
    const raw = stripPunct(input);
    const exp = stripPunct(expected);
    if (raw !== exp) {
      if (raw.toLowerCase() !== exp.toLowerCase()) notes.push(`正确拼法：${expected}`);
      else if (w.pos === 'n' || w.pos === 'name') notes.push(`名词首字母大写：${expected}`);
      else notes.push(`正确拼法：${expected}`);
    }
    return { ok: true, notes, correct: expected };
  }

  // Diagnose the common mistakes so the player knows what to fix.
  if (withArticle && w.art) {
    const parts = nIn.split(' ');
    const first = parts[0];
    const restIn = parts.slice(1).join(' ');
    const nDe = normalize(w.de);
    if (nIn === nDe) notes.push(`要带冠词：${expected}`);
    else if (ARTICLES.includes(first) && first !== w.art && restIn === nDe)
      notes.push(`冠词错了：是 ${w.art}，不是 ${first}`);
    else if (ARTICLES.includes(first) && first === w.art && levenshtein(restIn, nDe) === 1)
      notes.push('冠词对了，拼写差一个字母');
  } else if (levenshtein(nIn, nExp) === 1) {
    notes.push('差一个字母');
  }
  notes.push(`正确答案：${expected}`);
  return { ok: false, notes, correct: expected };
}

export interface SentenceVerdict extends Verdict {
  word?: Word;
}

const INDEF: Record<'m' | 'f' | 'n', string> = { m: 'einen', f: 'eine', n: 'ein' };

/**
 * "Ich möchte einen Tee." — fixed pattern + any learned noun in the accusative.
 * `known` are the nouns the player is allowed to use (met at least once, usable with möchte).
 */
export function gradeMoechte(input: string, known: Word[]): SentenceVerdict {
  const n = normalize(input)
    .split(' ')
    .filter((t) => t !== 'bitte' && t !== 'gern' && t !== 'gerne')
    .join(' ')
    // The input starts pre-filled with "Ich möchte"; forgive typing it again.
    .replace(/^(ich (moechte|mochte) )+/, (m) => m.split(' ').slice(0, 2).join(' ') + ' ');
  const m = /^ich (moechte|mochte|moechten) (einen|eine|ein|einem|einer|eines|den|die|das|der) (.+)$/.exec(n);
  if (!m) {
    if (/^ich moechte (.+)$/.exec(n)) {
      return { ok: false, notes: ['少了冠词：Ich möchte einen / eine / ein …'], correct: 'Ich möchte einen Tee.' };
    }
    return { ok: false, notes: ['句型是：Ich möchte + einen / eine / ein + 名词'], correct: 'Ich möchte einen Tee.' };
  }
  const [, verb, art, nounIn] = m;
  const noun = known.find((w) => normalize(w.de) === nounIn);
  if (!noun) {
    const any = nounIn.split(' ')[0];
    return {
      ok: false,
      notes: [`「${any}」还不是你叫得出的言灵：只能用见过的名词`],
      correct: 'Ich möchte einen Tee.',
    };
  }
  const g = noun.art === 'der' ? 'm' : noun.art === 'die' ? 'f' : 'n';
  const want = INDEF[g];
  const correct = `Ich möchte ${want} ${noun.de}.`;
  const notes: string[] = [];
  if (verb === 'mochte') {
    notes.push('möchte 要写 ö（或 oe）：mochte 是另一个词');
    return { ok: false, notes, correct, word: noun };
  }
  if (verb === 'moechten') {
    notes.push('ich 后面是 möchte，不是 möchten');
    return { ok: false, notes, correct, word: noun };
  }
  if (art !== want) {
    if (g === 'm' && art === 'ein') notes.push(`${noun.art} ${noun.de} 是阳性，第四格要说 einen ${noun.de}`);
    else if (['den', 'die', 'das', 'der'].includes(art)) notes.push(`想要「一个」要用不定冠词：${want} ${noun.de}`);
    else notes.push(`${noun.art} ${noun.de} → ${want} ${noun.de}`);
    return { ok: false, notes, correct, word: noun };
  }
  const raw = stripPunct(input);
  if (!raw.includes(noun.de)) notes.push(`正确拼法：${correct}`);
  return { ok: true, notes, correct, word: noun };
}

/** Free-form check for boss answers: any of the regexes on the normalized text. */
export function matchesAny(input: string, patterns: RegExp[]): boolean {
  const n = normalize(input);
  return patterns.some((p) => p.test(n));
}
