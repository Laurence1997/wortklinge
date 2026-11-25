// 主城全量筛选 (0.6.x, replaces 默写对决; 游戏设计「主城全量筛选」). At the examiner, from Lv2: pick region 1 / 2 /
// 3 / all, never-met and not-yet-open words included. One word at a time, Chinese and its part-of-speech tag only
// (numbers as digits), no letters, no sound. Nouns with the article; must be exactly right (no 笔误); words with the
// same Chinese all count and the one written retires. Right → retired (斩杀). Wrong or skipped → nothing changes.
// No damage, no timer, progress saved (a cursor per scope).
// XP is stored, not paid: each retired word goes into its home scene's 待领 and is paid the first time you walk
// into that scene (one normal kill each at the scene's level, level gap applied, at most one level's worth).

import { CONFIG, levelGapMult, xpToNext } from './config';
import { gradeTyped, type Verdict } from './grading';
import { isRetired, retire, stageOf } from './srs';
import { addXp, now, type GameState, type LevelUpResult } from './state';
import type { Word } from './types';
import { hasArticleQuestion, posTag, WORDS } from '../data/words';
import { HOME_SCENE, SCENE_BY_ID, type SceneDef } from '../data/world';

export type ScreenScope = '1' | '2' | '3' | 'all';
export const SCREEN = { fromLevel: 2 };

const HOME = HOME_SCENE; // own groups + 蚀变 groups (src/data/world.ts)
export function homeScene(wordId: string): SceneDef | undefined {
  return HOME[wordId];
}

export interface ScreenSave {
  /** 待领: scene id → word ids retired in town whose XP waits there. */
  pending: Record<string, string[]>;
  /** Last word answered per scope (the next one follows it in word-list order). */
  cursor: Partial<Record<ScreenScope, string>>;
}

export function screenSave(s: GameState): ScreenSave {
  s.screen ??= { pending: {}, cursor: {} };
  s.screen.pending ??= {};
  s.screen.cursor ??= {};
  return s.screen;
}

const inScope = (w: Word, scope: ScreenScope) => scope === 'all' || String(w.region ?? 1) === scope;

/** 2026-11-23 Lucas: a learned word is one the HUD counts as 归名 (retired, or 归名 and not due), so the summary
 *  line and the HUD agree and the examiner never asks a word you already know. A 归名 word that comes due counts
 *  as 半名 in both places and can be asked again. */
const learned = (s: GameState, w: Word) => stageOf(s, w) === 3 && !s.words[w.id]?.placed;

/** Words this scope can still ask: everything but learned, tutorial and chest words. */
export function screenPool(s: GameState, scope: ScreenScope): Word[] {
  return WORDS.filter((w) => inScope(w, scope) && !w.tutorial && w.family !== 'truhe' && !learned(s, w));
}

/** Words of a region still to learn (not 归名), for the summary line. */
export function regionLeft(s: GameState, region: number): { left: number; total: number; learned: number } {
  const ws = WORDS.filter((w) => (w.region ?? 1) === region && !w.tutorial && w.family !== 'truhe');
  const n = ws.filter((w) => learned(s, w)).length;
  return { left: ws.length - n, total: ws.length, learned: n };
}

export interface ScreenRun {
  scope: ScreenScope;
  current: Word | null;
  /** Retired this session. */
  cut: Word[];
  skipped: number;
  wrong: number;
  /** Asked this session (a round ends after one pass through the pool). */
  asked: Set<string>;
  last?: { ok: boolean; skipped: boolean; word: Word; wrote?: Word; verdict?: Verdict; input: string; scene?: SceneDef; placed?: boolean };
  over: boolean;
}

function nextWord(s: GameState, run: ScreenRun): Word | null {
  const pool = screenPool(s, run.scope).filter((w) => !run.asked.has(w.id));
  if (!pool.length) return null;
  const cur = screenSave(s).cursor[run.scope];
  const at = cur ? WORDS.findIndex((w) => w.id === cur) : -1;
  return pool.find((w) => WORDS.indexOf(w) > at) ?? pool[0];
}

export function startScreen(s: GameState, scope: ScreenScope): ScreenRun {
  const run: ScreenRun = { scope, current: null, cut: [], skipped: 0, wrong: 0, asked: new Set(), over: false };
  run.current = nextWord(s, run);
  run.over = !run.current;
  return run;
}

/** Retire a word found in town (never met → it joins the wordbook as named and retired). */
export function screenRetire(s: GameState, w: Word, t = now(s)): SceneDef | undefined {
  const p = s.words[w.id];
  // 入学测试: a 推定会 word already paid its XP through the entry level; retire it without storing more.
  const wasPlaced = !!p?.placed && !p.retired;
  if (p) {
    delete p.placed;
    if (wasPlaced) delete p.ctxDone;
  }
  if (!p) s.words[w.id] = { stage: 3, due: t + CONFIG.srs.recheck, firstSeen: t, lastSeen: t, relapse: 0, correct: 1, wrong: 0, read: 0, write: 1, retired: t };
  else {
    p.correct += 1;
    p.write = (p.write ?? 0) + 1;
    retire(s, w, t);
  }
  const sc = homeScene(w.id);
  if (wasPlaced) return undefined;
  if (sc) {
    const pend = screenSave(s).pending;
    pend[sc.id] = [...new Set([...(pend[sc.id] ?? []), w.id])];
  }
  return sc;
}

const baseZh = (zh: string) => zh.replace(/（[^）]*）|\([^)]*\)/g, '').trim();
/** 「再见（熟人之间）」 and 「再见（正式）」 both answer 再见; a noun and a verb with the same Chinese don't. */
export function sameMeaning(a: Word, b: Word): boolean {
  return baseZh(a.zh) === baseZh(b.zh) && posTag(a) === posTag(b);
}

/** Answer the current word (`skip` = 「不会，下一个」). */
export function answerScreen(s: GameState, run: ScreenRun, input: string, skip = false): void {
  const w = run.current;
  if (!w || run.over) return;
  run.asked.add(w.id);
  screenSave(s).cursor[run.scope] = w.id;
  if (skip) {
    run.skipped += 1;
    run.last = { ok: false, skipped: true, word: w, input: '' };
  } else {
    // Words with the same Chinese (brackets aside, same part-of-speech tag) all count; the one written retires.
    const cands = [w, ...WORDS.filter((x) => x.id !== w.id && sameMeaning(x, w) && !x.tutorial && x.family !== 'truhe')];
    let hit: Word | null = null;
    let verdict = gradeTyped(input, w, hasArticleQuestion(w));
    for (const c of cands) {
      const v = gradeTyped(input, c, hasArticleQuestion(c));
      if (v.ok) {
        hit = c;
        verdict = v;
        break;
      }
    }
    if (hit) {
      const placed = !!s.words[hit.id]?.placed && !isRetired(s.words[hit.id]);
      const scene = isRetired(s.words[hit.id]) ? undefined : screenRetire(s, hit);
      run.cut.push(hit);
      run.last = { ok: true, skipped: false, word: w, wrote: hit, verdict, input: input.trim(), scene, placed };
    } else {
      run.wrong += 1;
      run.last = { ok: false, skipped: false, word: w, verdict, input: input.trim() };
    }
  }
  run.current = nextWord(s, run);
  if (!run.current) run.over = true;
}

/** 待领 XP of a scene right now: one normal new-monster kill per word at the word's level, level gap applied,
 *  at most one level's worth. */
export function pendingXp(s: GameState, sceneId: string): number {
  const ids = screenSave(s).pending[sceneId] ?? [];
  let xp = 0;
  for (const id of ids) {
    const w = WORDS.find((x) => x.id === id);
    if (!w) continue;
    const gap = levelGapMult(s.level, w.lvl);
    xp += gap === 0 ? 1 : CONFIG.xp.newMonster * gap;
  }
  return Math.min(Math.round(xp), xpToNext(s.level));
}

/** Walking into a scene pays its 待领 (and clears it). */
export function claimScene(s: GameState, sceneId: string): { words: number; xp: number; levelUp: LevelUpResult } | null {
  const pend = screenSave(s).pending;
  const ids = pend[sceneId];
  if (!ids?.length || !SCENE_BY_ID[sceneId]) return null;
  const xp = pendingXp(s, sceneId);
  delete pend[sceneId];
  return { words: ids.length, xp, levelUp: addXp(s, xp) };
}

/** Scenes with XP waiting (for the map's gold dots and the wordbook line). */
export function pendingScenes(s: GameState): SceneDef[] {
  return Object.entries(screenSave(s).pending)
    .filter(([, ids]) => ids.length)
    .map(([id]) => SCENE_BY_ID[id])
    .filter(Boolean);
}
