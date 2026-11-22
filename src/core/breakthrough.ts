// A1 突破试炼 (0.6 第 6 块, 30 级, 考官): three parts of 8 questions on words you have met in regions 1–3.
// 听: hear a sentence (or the word), pick what it means. 读: a sentence with a blank, pick the word.
// 写: Chinese to German, nouns with the article. Each part needs 5 of 8. No damage, no penalty, retry any time.
// Passing sets flags.a1Passed and the title 「A1 突破者」. In 0.6 the cap stays at 30 (A2 opens in 0.7);
// the XP over the cap is kept up to one level, as before.

import { EXAMPLES, clozeOptions, makeCloze } from './cloze';
import { gradeTyped } from './grading';
import { shuffle, type Rng } from './rng';
import type { GameState } from './state';
import type { Word } from './types';
import { hasArticleQuestion, WORDS } from '../data/words';

export const BREAK = { from: 30, perPart: 8, pass: 5 };

export type ExamPart = 'listen' | 'read' | 'write';
export const PART_ZH: Record<ExamPart, string> = { listen: '听', read: '读', write: '写' };

export interface ExamQ {
  part: ExamPart;
  word: Word;
  /** Read aloud (listen part). */
  say?: string;
  /** What is shown: nothing for listen, the gapped sentence for read, the Chinese for write. */
  prompt: string;
  options?: string[];
  answer: string;
}

export interface Exam {
  qs: ExamQ[];
  at: number;
  right: Record<ExamPart, number>;
  last?: { ok: boolean; q: ExamQ; input: string };
  over: boolean;
}

function pool(s: GameState): Word[] {
  const ok = (w: Word) => (w.region ?? 1) <= 3 && w.pos !== 'phr' && !w.digit && !w.tutorial;
  const met = WORDS.filter((w) => ok(w) && s.words[w.id]);
  return met.length >= 40 ? met : WORDS.filter(ok);
}

function sentenceOf(w: Word): { de: string; zh: string } | null {
  for (const line of EXAMPLES[w.id] ?? []) {
    const [de, zh] = line.split('|');
    if (zh) return { de: de.replace(/[{}]/g, ''), zh };
  }
  return null;
}

export function startExam(s: GameState, rng: Rng): Exam {
  const words = shuffle(rng, pool(s));
  const used = new Set<string>();
  const take = (fits: (w: Word) => boolean) => {
    const w = words.find((x) => !used.has(x.id) && fits(x));
    if (w) used.add(w.id);
    return w;
  };
  const qs: ExamQ[] = [];
  // 听: a whole sentence when the word has one, else the word; pick the Chinese from four.
  for (let i = 0; i < BREAK.perPart; i++) {
    const w = take((x) => !!sentenceOf(x)) ?? take(() => true);
    if (!w) break;
    const sen = sentenceOf(w);
    const answer = sen ? sen.zh : w.zh;
    const others = shuffle(rng, words.filter((x) => x.id !== w.id))
      .map((x) => (sen ? sentenceOf(x)?.zh : x.zh))
      .filter((z): z is string => !!z && z !== answer)
      .slice(0, 3);
    qs.push({ part: 'listen', word: w, say: sen ? sen.de : w.de, prompt: '', options: shuffle(rng, [answer, ...others]), answer });
  }
  // 读: a sentence with the word blanked out, pick the word.
  for (let i = 0; i < BREAK.perPart; i++) {
    let made: ExamQ | null = null;
    while (!made) {
      const w = take(() => true);
      if (!w) break;
      const c = makeCloze(w, 'base', rng);
      if (c) made = { part: 'read', word: w, prompt: c.shown, options: clozeOptions(w, c.answer, rng), answer: c.answer };
    }
    if (made) qs.push(made);
  }
  // 写: Chinese to German.
  for (let i = 0; i < BREAK.perPart; i++) {
    const w = take(() => true);
    if (!w) break;
    qs.push({ part: 'write', word: w, prompt: w.zh, answer: w.de });
  }
  return { qs, at: 0, right: { listen: 0, read: 0, write: 0 }, over: false };
}

export function answerExam(e: Exam, input: string): void {
  const q = e.qs[e.at];
  if (!q || e.over) return;
  const ok = q.part === 'write' ? gradeTyped(input, q.word, hasArticleQuestion(q.word)).ok : input === q.answer;
  if (ok) e.right[q.part] += 1;
  e.last = { ok, q, input };
  e.at += 1;
  if (e.at >= e.qs.length) e.over = true;
}

export function examPassed(e: Exam): boolean {
  return (['listen', 'read', 'write'] as ExamPart[]).every((p) => e.right[p] >= BREAK.pass);
}
