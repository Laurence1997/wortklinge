// 语法题 (0.6.x–0.8 语法线, 游戏设计 十六「语法线」+ 语法教学统一框架 Lucas 2026-11-25): one shape for every grammar
// question, so the battle UI and the grader need only one new case. About eight in ten grammar questions hang on the
// word monsters (verbs get the sentence end, nouns the case / kein / mein / adjective ending); structures that
// belong to no word get their own monsters or dungeons (变音秘境, 介词秘境, 镜像怪, 词族秘境, 告示怪, 文章群怪).
//
// Answers are listed, never guessed: the grader compares against `answer` + `alts` after normalizing (case,
// punctuation, ae/oe/ue/ss), so a rule check never calls a right answer wrong.

import { normalize } from '../grading';

/** Which grammar system asked. Also the key of the 规则怪谈看板 that teaches it (boards.ts). */
export type GramSys =
  | 'kein'
  | 'nicht'
  | 'timePrep'
  | 'datPron'
  | 'mein'
  | 'modal'
  | 'sep'
  | 'imp'
  | 'praetSein'
  | 'praetModal'
  | 'praet'
  | 'ablaut'
  | 'prep'
  | 'mirror'
  | 'wordfam'
  | 'wordform'
  | 'adj'
  | 'notice'
  | 'article'
  | 'struct';

export interface GramTask {
  sys: GramSys;
  /** Task line in Chinese (what to do). */
  prompt: string;
  /** Big text: the sentence with ___, or the word. */
  focus: string;
  /** The answer shown when wrong. */
  answer: string;
  /** Other accepted answers. */
  alts?: string[];
  /** Choice question when set (the answer is one of them). */
  options?: string[];
  /** 0 choice, 1 typed, 2 hard (破甲), as in the 题型奖励表. */
  tier: 0 | 1 | 2;
  /** One-line rule shown after a wrong answer (in Chinese). */
  rule: string;
  /** The whole sentence, read aloud after answering. */
  full?: string;
  /** The sentence's Chinese. */
  zh?: string;
  /** A passage shown above the question (告示怪, 信件怪, 文章群怪). */
  passage?: string;
  /** Multi-step monsters (介词秘境 锁链怪): which lock this is, 0-based, and how many. */
  lock?: { i: number; of: number };
  /** The word this task is about, when it is a real word in the word list. */
  wordId?: string;
}

const strip = (s: string) =>
  normalize(s)
    .replace(/\s*(…|\.\.\.|___)\s*/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

/** Two-part answers (stehe … auf) also accept the parts joined by anything (stehe auf, stehe ... auf). */
export function gramKey(s: string): string {
  return strip(s);
}

export interface GramVerdict {
  ok: boolean;
  notes: string[];
  correct: string;
}

/** Grade a grammar task. Choice: exact option. Typed: the answer or an alt, normalized; a trailing bitte or
 *  punctuation never matters. */
export function gradeGram(t: GramTask, input: string): GramVerdict {
  const accepted = [t.answer, ...(t.alts ?? [])];
  let ok: boolean;
  if (t.options) ok = input === t.answer || (t.alts ?? []).includes(input);
  else {
    const k = gramKey(input).replace(/\bbitte\b/g, '').replace(/\s+/g, ' ').trim();
    ok = accepted.some((a) => gramKey(a).replace(/\bbitte\b/g, '').replace(/\s+/g, ' ').trim() === k);
  }
  const notes = ok ? (t.full ? [t.full] : []) : [`正确答案：${t.answer}`, ...(t.full ? [t.full] : []), t.rule];
  return { ok, notes, correct: t.answer };
}
