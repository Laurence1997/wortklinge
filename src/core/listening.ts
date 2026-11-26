// 听段题 (游戏设计 「听力」, Lucas 2026-11-25, 34 级) and 盲听 (91 级).
// 听段: about 1 field monster in 8 opens with a 2–4 sentence talk or announcement (station, doctor's call, landlord's
// message …) read at normal speed, no text shown; one 3-choice content question, one free replay; after answering the
// text and its Chinese are shown. It must use this monster's word. A right answer hits like a choice question; it
// doesn't move the word's question ladder and is neither 认得 nor 会写; like a notice question it never finishes the
// monster (额外伤害).
// 91+: faster speech and colloquial contractions (hab', gibt's, 'n — only what the voice reads well), and 盲听: one
// sentence at normal speed, no text, type the missing word (this monster's word); breaks armor like a hard question;
// one free replay. 耳机 and the 听音 / 静听 talents count for both.
// The passage texts come from the proofreading thread (AI-written per region, auto-checked); until they land the
// table is empty and only 盲听 (built from the word's example sentences) appears.

import { pick, shuffle, type Rng } from './rng';
import type { Word } from './types';
import type { GramTask } from './gram/task';
import { EXAMPLES, parse } from './cloze';
import { PASSAGES, type Passage } from '../data/passages';

export const LISTEN = {
  from: 34,
  /** 约每 8 只怪 1 只. */
  chance: 1 / 8,
  fastFrom: 91,
  /** Speech rate: normal from 34, faster from 91 (the default voice rate elsewhere is 0.9). */
  rate: 1.0,
  fastRate: 1.15,
  /** Free replays per question. */
  replays: 1,
};

export type ListenKind = 'passage' | 'blind';

let byWord: Map<string, Passage> | null = null;
let indexed = 0;
export function passageFor(w: Word): Passage | null {
  if (!byWord || indexed !== PASSAGES.length) {
    indexed = PASSAGES.length;
    byWord = new Map();
    for (const p of PASSAGES) if (!byWord.has(p.wordId)) byWord.set(p.wordId, p);
  }
  return byWord.get(w.id) ?? null;
}

/** A sentence for 盲听: one of the word's examples with its form blanked (none starting with the blank). */
export function blindLine(w: Word, rng: Rng): { full: string; answer: string; zh: string } | null {
  const ps = (EXAMPLES[w.id] ?? []).map(parse).filter((x): x is NonNullable<typeof x> => !!x && !!x.blank.trim() && !!x.before.trim());
  if (!ps.length) return null;
  const p = pick(rng, ps);
  return { full: `${p.before}${p.blank}${p.after}`.replace(/\s+/g, ' ').trim(), answer: p.blank.trim(), zh: p.zh };
}

/** Which listening kind this monster carries (null = none). */
export function rollListen(level: number, w: Word, rng: Rng): ListenKind | null {
  if (level < LISTEN.from || rng() >= LISTEN.chance) return null;
  const hasP = !!passageFor(w);
  const hasB = level >= LISTEN.fastFrom && !!(EXAMPLES[w.id] ?? []).length;
  if (hasP && hasB) return rng() < 0.5 ? 'blind' : 'passage';
  return hasP ? 'passage' : hasB ? 'blind' : null;
}

export function listenRate(level: number): number {
  return level >= LISTEN.fastFrom ? LISTEN.fastRate : LISTEN.rate;
}

export function passageTask(p: Passage, rng: Rng): GramTask {
  return {
    sys: 'listen',
    prompt: `听段题：听这段话，回答 · ${p.qZh}`,
    focus: `🎧 ${p.q}`,
    answer: p.answer,
    options: shuffle(rng, [p.answer, ...p.wrong]),
    tier: 0,
    rule: `原文：${p.lines.join(' ')}`,
    full: p.lines.join(' '),
    zh: p.zh,
  };
}

export function blindTask(w: Word, line: { full: string; answer: string; zh: string }): GramTask {
  return {
    sys: 'blind',
    prompt: '盲听：听这句话，打出缺的那个词（它自己的词，照句子里的形式）',
    focus: '🎧 ……',
    answer: line.answer,
    tier: 2,
    rule: `原句：${line.full}`,
    full: line.full,
    zh: line.zh,
    wordId: w.id,
  };
}
