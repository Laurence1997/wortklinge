// 默写对决 (考官 NPC in each region's town, region 1 from Lv2): a special fight against an examiner.
// Each question is a word of this region you have never met (a test of what you already know);
// write it (nouns with the article). Words met in the field go through the normal reviews instead.
// Right: ×2 the normal new-monster XP and the word is named on the spot (it relapses as usual later).
// Wrong: nothing happens to the word, it stays a new word out in the field. Each word counts once.
// The examiner hits on a read bar (every 3 answers) and on every wrong answer; when you drop, the duel
// ends. Words you got right are kept and you can start again at once.

import { CONFIG } from './config';
import { gradeTyped, type Verdict } from './grading';
import { shuffle, type Rng } from './rng';
import { addXp, maxHp, now, overloaded, todayLog, type GameState, type LevelUpResult } from './state';
import type { Word } from './types';
import { hasArticleQuestion, WORDS } from '../data/words';

export const DUEL = {
  fromLevel: 2,
  /** Correct answers to beat the examiner. */
  examinerHp: 12,
  xpMult: 2,
  /** The examiner strikes every this many answers, and on every wrong one. */
  readBar: 3,
  hitShare: 0.12,
  wrongHitShare: 0.15,
};

export interface Duel {
  region: number;
  queue: Word[];
  hp: number;
  bar: number;
  over: 'win' | 'lose' | null;
  right: number;
  wrong: number;
  last?: { ok: boolean; verdict: Verdict; word: Word; xp: number; hit: number };
}

/** Words of this region that can be written and that you have never met (Lucas 2026-11-19: no skipping reviews). */
export function duelPool(s: GameState, region: number): Word[] {
  return WORDS.filter((w) => (w.region ?? 1) === region && w.pos !== 'phr' && !w.digit && !w.tutorial && !s.words[w.id]);
}

export function startDuel(s: GameState, region: number, rng: Rng): Duel {
  return { region, queue: shuffle(rng, duelPool(s, region)), hp: DUEL.examinerHp, bar: 0, over: null, right: 0, wrong: 0 };
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
    if (!old) {
      s.daily.newCount += 1;
      log.newWords += 1;
    }
    xp = Math.round(CONFIG.xp.newMonster * DUEL.xpMult * (overloaded(s) ? CONFIG.overload.newXp : 1));
    s.words[w.id] = { stage: 3, due: t + CONFIG.srs.relapse[0], firstSeen: old?.firstSeen ?? t, lastSeen: t, relapse: old?.relapse ?? 0, correct: (old?.correct ?? 0) + 1, wrong: old?.wrong ?? 0, read: old?.read ?? 0, write: (old?.write ?? 0) + 1 };
    log.guiming += 1;
    levelUp = addXp(s, xp);
  } else {
    d.wrong += 1;
    log.wrong += 1;
    if (s.words[w.id]) s.words[w.id].wrong += 1;
    hit += Math.max(1, Math.round(maxHp(s) * DUEL.wrongHitShare));
  }
  d.bar += 1;
  if (d.bar >= DUEL.readBar) {
    d.bar = 0;
    hit += Math.max(1, Math.round(maxHp(s) * DUEL.hitShare));
  }
  s.hp = Math.max(0, s.hp - hit);
  d.last = { ok: verdict.ok, verdict, word: w, xp, hit };
  if (d.hp <= 0) d.over = 'win';
  else if (s.hp <= 0) {
    d.over = 'lose';
    s.hp = 1; // a duel never kills you: you walk away with 1 HP
  } else if (!d.queue.length) d.over = 'win';
  return { levelUp };
}
