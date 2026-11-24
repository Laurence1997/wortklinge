// 跳区考核 (越区引导, 2026-11-21) at the examiner: 20 words of the next region, 16 right to pass.
// The old 默写对决 (examiner fight, ×2 XP) was replaced by 主城全量筛选 in 0.6.x (src/core/screen.ts).
// Right answers on never-met words name them on the spot (×2 new-monster XP); retired words can be asked too
// (筛选 may have retired most of the next region) and change nothing.

import { CONFIG } from './config';
import { gradeTyped, type Verdict } from './grading';
import { shuffle, type Rng } from './rng';
import { isRetired, setGuiming } from './srs';
import { addXp, maxHp, now, todayLog, type GameState, type LevelUpResult } from './state';
import type { Word } from './types';
import { hasArticleQuestion, WORDS } from '../data/words';

export const DUEL = {
  xpMult: 2,
  hitShare: 0.12,
  wrongHitShare: 0.15,
  readBar: 3,
};

/** 跳区考核 (越区引导, 2026-11-21): 20 random words of the next region, 16 right to pass. No damage, no penalty. */
export const JUMP = { words: 20, pass: 16, toLevel: 11 };

export interface Duel {
  region: number;
  queue: Word[];
  hp: number;
  bar: number;
  over: 'win' | 'lose' | null;
  right: number;
  wrong: number;
  /** 跳区考核 instead of a normal duel. */
  exam?: boolean;
  last?: { ok: boolean; verdict: Verdict; word: Word; xp: number; hit: number; input: string };
}

/** Words of this region the jump exam can ask: never met (Lucas 2026-11-19: no skipping reviews) or retired. */
export function duelPool(s: GameState, region: number): Word[] {
  return WORDS.filter((w) => (w.region ?? 1) === region && w.pos !== 'phr' && !w.digit && !w.tutorial && (!s.words[w.id] || isRetired(s.words[w.id])));
}

export function startJumpExam(s: GameState, rng: Rng): Duel {
  const queue = shuffle(rng, duelPool(s, 2)).slice(0, JUMP.words);
  return { region: 2, queue, hp: JUMP.pass, bar: 0, over: null, right: 0, wrong: 0, exam: true };
}

export function answerDuel(s: GameState, d: Duel, input: string): { levelUp: LevelUpResult | null } {
  const w = d.queue.shift();
  if (!w || d.over) return { levelUp: null };
  const verdict = gradeTyped(input, w, hasArticleQuestion(w));
  const log = todayLog(s);
  let xp = 0;
  let hit = 0;
  let levelUp: LevelUpResult | null = null;
  if (verdict.ok) {
    d.right += 1;
    d.hp -= 1;
    log.correct += 1;
    const t = now(s);
    const old = s.words[w.id];
    if (isRetired(old)) {
      d.last = { ok: true, verdict, word: w, xp: 0, hit: 0, input: input.trim() };
      if (d.right >= JUMP.pass) d.over = 'win';
      return { levelUp: null };
    }
    if (!old) {
      s.daily.newCount += 1;
      log.newWords += 1;
    }
    xp = Math.round(CONFIG.xp.newMonster * DUEL.xpMult);
    s.words[w.id] = { stage: 3, due: t, firstSeen: old?.firstSeen ?? t, lastSeen: t, relapse: old?.relapse ?? 0, correct: (old?.correct ?? 0) + 1, wrong: old?.wrong ?? 0, read: old?.read ?? 0, write: (old?.write ?? 0) + 1 };
    setGuiming(s.words[w.id], t, true); // written right with no hint: one 30-day spot check (rev 51)
    log.guiming += 1;
    levelUp = addXp(s, xp);
  } else {
    d.wrong += 1;
    log.wrong += 1;
    if (s.words[w.id]) s.words[w.id].wrong += 1;
    hit += Math.max(1, Math.round(maxHp(s) * DUEL.wrongHitShare));
  }
  if (d.exam) {
    d.last = { ok: verdict.ok, verdict, word: w, xp, hit: 0, input: input.trim() };
    if (d.right >= JUMP.pass) d.over = 'win';
    else if (d.right + d.queue.length < JUMP.pass) d.over = 'lose'; // can't reach 16 any more
    return { levelUp };
  }
  d.bar += 1;
  if (d.bar >= DUEL.readBar) {
    d.bar = 0;
    hit += Math.max(1, Math.round(maxHp(s) * DUEL.hitShare));
  }
  s.hp = Math.max(0, s.hp - hit);
  d.last = { ok: verdict.ok, verdict, word: w, xp, hit, input: input.trim() };
  if (d.hp <= 0) d.over = 'win';
  else if (s.hp <= 0) {
    d.over = 'lose';
    s.hp = 1; // a duel never kills you: you walk away with 1 HP
  } else if (!d.queue.length) d.over = 'win';
  return { levelUp };
}
