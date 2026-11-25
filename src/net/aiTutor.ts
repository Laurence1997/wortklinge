// AI 批改造句 + 决斗场 (40 级): client side of the `ai-tutor` edge function (supabase/functions/ai-tutor).
// Logged-in players only; the function holds the model keys and the daily cap. Offline or over the cap → null,
// and the game keeps its own rule-based grading.

import { sb } from './cloud';
import { CONJ, PERSONS } from '../data/verbs';
import type { Word } from '../core/types';

export const AI_TUTOR = { from: 40 };

export interface AiGrade {
  ok: boolean;
  step: 'rule' | 'ai';
  errors: Array<{ bad: string; fix: string; why: string }>;
  better: string;
}

export interface DuelLine {
  de: string;
  zh: string;
  note: string;
  done: boolean;
}

/** The forms of a word a sentence may use (Tee, Tees; trinken, trinke, trinkst …). */
export function wordForms(w: Word): string[] {
  const out = new Set<string>([w.de]);
  if (w.pl && w.pl !== '-') out.add(w.pl);
  const c = CONJ[w.de];
  if (c) for (const p of PERSONS) out.add(c.forms[p]);
  return [...out];
}

async function call<T>(body: Record<string, unknown>): Promise<T | { error: string }> {
  try {
    const { data, error } = await sb.functions.invoke('ai-tutor', { body });
    if (error) {
      const status = (error as { context?: { status?: number } }).context?.status;
      return { error: status === 429 ? 'quota' : status === 401 ? 'login' : 'net' };
    }
    return data as T;
  } catch {
    return { error: 'net' };
  }
}

export function aiGrade(sentence: string, w: Word, task: string, level: number) {
  return call<AiGrade>({ mode: 'grade', sentence, forms: wordForms(w), task, level });
}

export function duelTurn(scene: string, history: Array<{ who: 'npc' | 'me'; de: string }>, reply: string, level: number) {
  return call<DuelLine>({ mode: 'duel', scene, history, reply, level });
}

/** Several words at once (篝火日记): the text must use at least one of them. */
export function aiGradeText(text: string, words: Word[], task: string, level: number) {
  return call<AiGrade>({ mode: 'grade', sentence: text, forms: words.flatMap(wordForms), task, level });
}
