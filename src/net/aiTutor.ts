// AI 批改造句 + 决斗场 (10 级) + 小作文 (20 级) (游戏设计 rev 459): client side of the `ai-tutor` edge function (supabase/functions/ai-tutor).
// Logged-in players only; the function holds the model keys and the daily cap. Offline or over the cap → null,
// and the game keeps its own rule-based grading.

import { sb } from './cloud';
import { CONJ, PERSONS } from '../data/verbs';
import type { Word } from '../core/types';
import type { GameState } from '../core/state';
import { WORD_BY_ID } from '../data/words';

/** Open levels (rev 459). Daily caps live in the database (public.ai_settings, NULL = unlimited) and per account
 *  (public.ai_user_caps); this side only knows the levels. */
export const AI_TUTOR = { from: 10, grade: 10, duel: 10, essay: 20, elite: 10 };

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
  /** Target word ids this reply used right. */
  used?: string[];
  /** 防泄露: targets the model kept saying first (regenerated once); they leave this talk. */
  dropped?: string[];
  /** 冒险者: grammar points of this talk the player's last line used right (shown, no reward). */
  gramOk?: string[];
}

/** 冒险者 in the world chat: one line (null when the AI is out). */
export async function worldLine(p: { name: string; origin: string; manner: string; topic: string; level: number; mention?: { nick: string; text: string }; recent: string[] }): Promise<string | null> {
  const r = await call<{ de: string }>({ mode: 'world', ...p });
  return 'error' in r || !r.de ? null : r.de;
}

/** The forms of a word a sentence may use (Tee, Tees; trinken, trinke, trinkst …). */
export function wordForms(w: Word): string[] {
  const out = new Set<string>([w.de]);
  if (w.pl && w.pl !== '-') out.add(w.pl);
  const c = CONJ[w.de];
  if (c) for (const p of PERSONS) out.add(c.forms[p]);
  return [...out];
}

/** The player's learned words (seen at least once), newest first, for the model to stay inside. */
export function knownWords(s: GameState, max = 500): string[] {
  return Object.entries(s.words)
    .sort((a, b) => (b[1].lastSeen ?? 0) - (a[1].lastSeen ?? 0))
    .map(([id]) => WORD_BY_ID[id]?.de)
    .filter((x): x is string => !!x)
    .slice(0, max);
}

async function call<T>(body: Record<string, unknown>): Promise<T | { error: string }> {
  try {
    const { data, error } = await sb.functions.invoke('ai-tutor', { body });
    if (error) {
      const status = (error as { context?: { status?: number } }).context?.status;
      // 502 = the model is unavailable (out of credit or down): the game says so and goes on without AI.
      return { error: status === 429 ? 'quota' : status === 401 ? 'login' : status === 502 ? 'model' : 'net' };
    }
    return data as T;
  } catch {
    return { error: 'net' };
  }
}

export function aiGrade(sentence: string, w: Word, task: string, level: number, known: string[] = []) {
  return call<AiGrade>({ mode: 'grade', sentence, forms: wordForms(w), task, level, known });
}

/** `round` / `rounds`: which player line this is and how many the talk allows, so the NPC can wrap up in time. */
export function duelTurn(scene: string, history: Array<{ who: 'npc' | 'me'; de: string }>, reply: string, level: number, targets: Word[] = [], known: string[] = [], grammar: string[] = [], round = 0, rounds = 0) {
  return call<DuelLine>({ mode: 'duel', scene, history, reply, level, known, grammar, round, rounds, targets: targets.map((w) => ({ id: w.id, de: w.de, forms: wordForms(w) })) });
}

/** 小作文 (20 级): 3–5 sentences with the given words. `missing` = given words the text did not use. */
export function aiEssay(text: string, words: Word[], task: string, level: number, known: string[] = []) {
  return call<AiGrade & { missing?: string[] }>({ mode: 'essay', text, words: words.map(wordForms), task, level, known });
}

/** Several words at once (篝火日记): the text must use at least one of them. */
export function aiGradeText(text: string, words: Word[], task: string, level: number, known: string[] = []) {
  return call<AiGrade>({ mode: 'grade', sentence: text, forms: words.flatMap(wordForms), task, level, known });
}

export interface AiOpinion {
  ok: boolean;
  note: string;
  errors: Array<{ bad: string; fix: string; why: string }>;
  better: string;
}

/** 开口表达观点 (121): does the reply take a position on the claim with a reason that holds? */
export function aiOpinion(claim: string, reply: string, level: number, known: string[] = []) {
  return call<AiOpinion>({ mode: 'opinion', claim, reply, level, known });
}

export interface PersuadeLine {
  de: string;
  zh: string;
  note: string;
  convinced: boolean;
  registerWrong: boolean;
}

/** 说服段: one round with the NPC (the duel engine). */
export function persuadeTurn(p: { scene: string; cares: string; formal: boolean; argue: boolean }, attempt: number, history: Array<{ who: 'npc' | 'me'; de: string }>, reply: string, level: number, known: string[] = []) {
  return call<PersuadeLine>({ mode: 'persuade', ...p, attempt, history, reply, level, known });
}
