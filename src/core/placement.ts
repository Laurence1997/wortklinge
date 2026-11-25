// 入学测试 / 分级考核 (2026-11-25, 方案 /mnt/project-files/wortklinge-placement/入学测试-方案.md).
// Players who already know some German test out of the words they know instead of fighting up from das Brot.
// Words are grouped into bands of 3 monster levels (1–3, 4–6 … 28–30; later: frequency-rank bands). The player
// picks a starting band from sample words (or starts at band 1). Each band asks 5 words, typed from Chinese
// (nouns with the article, like 全量筛选):
//   ≥4 right → passed, next band · 5/5 → the next band is skipped (passed, verified if the one after it fails)
//   ≤2 → stop · 3 → 3 more, 5 of 8 passes.
// Failing the starting band steps down one band until one passes (or band 1 fails).
// Result: right → retired (斩杀, no XP stored); right word but wrong/missing article or one letter off → 半名
// review monster; wrong/skipped in a passed band → 裂形 review monster (follows you, your level, full pay);
// untested words of passed bands → 推定会 (counts as 归名, never spawns, spot-checked one per fight).
// Entry level = top level of the highest passed band + 1 (at most the level cap). Only ever raises the level.

import { CONFIG } from './config';
import { gradeTyped, levenshtein, normalize, type Verdict } from './grading';
import { shuffle, type Rng } from './rng';
import { retire, stageOf } from './srs';
import { maxHp, now, type GameState } from './state';
import type { Word, WordProgress } from './types';
import { hasArticleQuestion, WORDS } from '../data/words';
import { sameMeaning } from './screen';

export const PLACE = {
  /** Monster levels per band. */
  band: 3,
  /** Words asked per band, and the extra ones when it is borderline. */
  per: 5,
  extra: 3,
  /** Right (or 半对) answers needed: of 5, of 8. 5/5 skips the next band. ≤ stop ends the climb. */
  pass: 4,
  passExtended: 5,
  stop: 2,
  /** Sample words shown per band on the self-pick screen. */
  samples: 5,
  /** 推定会 spot checks: this many wrong in one band and over this share → the band's rest turns into review monsters. */
  revertFails: 3,
  revertShare: 0.4,
  /** 分级考核 again after this many more words 归名 or 斩杀 since the last test (Lucas 2026-11-25, replaces once a day). */
  retakeAfter: 30,
};

export type PlaceRes = 'ok' | 'half' | 'wrong' | 'skip';

export interface PlaceSave {
  /** When the last test was applied and the level it gave. */
  at: number;
  level: number;
  /** Bands passed (0-based, all bands ≤ top). */
  top: number;
  /** 推定会 spot checks per band: answered / wrong. */
  checks: Record<string, { n: number; wrong: number }>;
}

/** Words the test can ask: no phrases, tutorial or chest words, nothing above the level cap. */
export function placeWords(): Word[] {
  return WORDS.filter((w) => !w.tutorial && w.family !== 'truhe' && w.pos !== 'phr' && w.lvl <= CONFIG.levelCap);
}

export function bandOf(w: Pick<Word, 'lvl'>): number {
  return Math.floor((w.lvl - 1) / PLACE.band);
}

export function bandCount(): number {
  return Math.max(0, ...placeWords().map(bandOf)) + 1;
}

export function bandRange(i: number): [number, number] {
  return [i * PLACE.band + 1, Math.min(CONFIG.levelCap, (i + 1) * PLACE.band)];
}

/** Entry level when bands 0..top are passed (top = -1: none). */
export function levelFor(top: number): number {
  return top < 0 ? 1 : Math.min(CONFIG.levelCap, bandRange(top)[1] + 1);
}

/** Region you start in at that level (region 2 from 11, region 3 from 21). */
export function regionFor(level: number): 1 | 2 | 3 {
  return level >= 21 ? 3 : level >= 11 ? 2 : 1;
}

/** 推定会 words are 归名 on trust: they count as known but have not been written yet. */
export function isPlaced(p: WordProgress | undefined): boolean {
  return !!p?.placed && !p.retired;
}

/** Already known (asked again would waste the player's time): retired, or 归名 and not 推定会. */
function known(s: GameState, w: Word): boolean {
  return stageOf(s, w) === 3 && !isPlaced(s.words[w.id]);
}

/** Sample words per band for the self-pick screen (most useful first: list order). */
export function bandSamples(): Word[][] {
  const out: Word[][] = Array.from({ length: bandCount() }, () => []);
  for (const w of placeWords()) {
    const b = out[bandOf(w)];
    if (b.length < PLACE.samples && (w.pos === 'n' || w.pos === 'v' || w.pos === 'adj')) b.push(w);
  }
  return out;
}

/** Words the player really knows: retired or 归名, not 推定会. */
export function learnedCount(s: GameState): number {
  let n = 0;
  for (const p of Object.values(s.words)) if ((p.retired || p.stage === 3) && !isPlaced(p)) n++;
  return n;
}

/** How many more words to 归名 / 斩杀 before 分级考核 can be taken again (0 = now). Old saves that took it before this
 *  rule (no count stored) may take it again at once. */
export function placeAgainIn(s: GameState): number {
  const at = s.flags.placeKnown;
  if (typeof at !== 'number') return 0;
  return Math.max(0, at + PLACE.retakeAfter - learnedCount(s));
}

export function canPlaceAgain(s: GameState): boolean {
  return placeAgainIn(s) === 0;
}

export interface PlaceRun {
  /** Band being asked. */
  band: number;
  /** The band the player picked (stepping down while it fails). */
  start: number;
  /** Still stepping down from the picked band (no band passed yet). */
  descending: boolean;
  queue: Word[];
  asked: number;
  right: number;
  extended: boolean;
  /** Bands passed so far. */
  passed: Set<number>;
  /** A band skipped after a 5/5 and not verified yet. */
  skipped: number | null;
  /** Bands asked and failed. */
  failed: Set<number>;
  results: Array<{ word: Word; res: PlaceRes; input: string; band: number }>;
  current: Word | null;
  last?: { word: Word; res: PlaceRes; input: string; verdict: Verdict };
  over: boolean;
  /** Checking a skipped band after the next one failed: pass or fail, the test ends there. */
  verifying?: boolean;
  /** Set by applyPlacement. */
  outcome?: PlaceOutcome;
}

function bandQueue(s: GameState, band: number, rng: Rng, exclude: Set<string>): Word[] {
  return shuffle(rng, placeWords().filter((w) => bandOf(w) === band && !known(s, w) && !exclude.has(w.id)));
}

function askedIds(run: PlaceRun): Set<string> {
  return new Set(run.results.map((r) => r.word.id));
}

/** Open a band. A band with nothing left to ask (all known) passes on the spot. */
function openBand(s: GameState, run: PlaceRun, band: number, rng: Rng): void {
  run.band = band;
  run.asked = 0;
  run.right = 0;
  run.extended = false;
  run.queue = bandQueue(s, band, rng, askedIds(run)).slice(0, PLACE.per + PLACE.extra);
  if (!run.queue.length) return bandDone(s, run, true, false, rng);
  run.current = run.queue.shift()!;
}

/** Highest band with every band below it passed. */
export function topPassed(run: Pick<PlaceRun, 'passed'>): number {
  let top = -1;
  while (run.passed.has(top + 1)) top++;
  return top;
}

function finish(run: PlaceRun): void {
  run.current = null;
  run.over = true;
}

function bandDone(s: GameState, run: PlaceRun, ok: boolean, perfect: boolean, rng: Rng): void {
  const n = bandCount();
  const b = run.band;
  if (ok) {
    run.passed.add(b);
    if (run.descending) {
      // Stepping down: the first band that passes ends the test; everything below counts as passed.
      for (let i = 0; i < b; i++) run.passed.add(i);
      run.descending = false;
      if (b < run.start) return finish(run);
    }
    // Everything below the starting band is taken on trust once the starting band passes.
    for (let i = 0; i < b; i++) run.passed.add(i);
    if (run.skipped !== null && run.skipped < b) run.skipped = null; // the band after the skip passed: the skip holds
    let next = b + 1;
    if (perfect && !run.verifying && next + 1 < n) {
      run.passed.add(next);
      run.skipped = next;
      next += 1;
    }
    if (next >= n) return finish(run);
    return openBand(s, run, next, rng);
  }
  run.failed.add(b);
  if (run.descending) {
    if (b === 0) return finish(run);
    return openBand(s, run, b - 1, rng);
  }
  // Failed right after a skipped band: go back and check the skipped one (no more skipping).
  if (run.skipped !== null && run.skipped === b - 1) {
    const sk = run.skipped;
    run.skipped = null;
    run.passed.delete(sk);
    run.start = sk; // a fail there ends the climb at the band below it
    run.descending = false;
    run.verifying = true;
    return openBand(s, run, sk, rng);
  }
  return finish(run);
}

/** Start the test at a band (0 = from the beginning). */
export function startPlacement(s: GameState, rng: Rng, start = 0): PlaceRun {
  const n = bandCount();
  const st = Math.max(0, Math.min(n - 1, start));
  const run: PlaceRun = { band: st, start: st, descending: st > 0, queue: [], asked: 0, right: 0, extended: false, passed: new Set(), skipped: null, failed: new Set(), results: [], current: null, over: false };
  openBand(s, run, st, rng);
  return run;
}

/** Grade one answer: right, 半对 (right word, article wrong or missing, or one letter off), or wrong. */
export function gradePlace(input: string, w: Word): { res: Exclude<PlaceRes, 'skip'>; verdict: Verdict; wrote: Word } {
  const cands = [w, ...placeWords().filter((x) => x.id !== w.id && sameMeaning(x, w))];
  for (const c of cands) {
    const v = gradeTyped(input, c, hasArticleQuestion(c));
    if (v.ok) return { res: 'ok', verdict: v, wrote: c };
  }
  const verdict = gradeTyped(input, w, hasArticleQuestion(w));
  const nIn = normalize(input);
  const nDe = normalize(w.de);
  const bare = w.art ? nIn.replace(/^(der|die|das|den|dem|des) /, '') : nIn;
  const longEnough = nDe.replace(/ /g, '').length >= 4;
  if (bare === nDe || (longEnough && levenshtein(bare, nDe) === 1)) return { res: 'half', verdict, wrote: w };
  return { res: 'wrong', verdict, wrote: w };
}

/** Answer the current word; `skip` = 「不会」. */
export function answerPlacement(s: GameState, run: PlaceRun, input: string, rng: Rng, skip = false): void {
  const w = run.current;
  if (!w || run.over) return;
  let res: PlaceRes = 'skip';
  let verdict: Verdict = { ok: false, notes: [], correct: '' };
  let wrote = w;
  if (!skip && input.trim()) ({ res, verdict, wrote } = gradePlace(input, w));
  else verdict = gradeTyped('', w, hasArticleQuestion(w));
  run.results.push({ word: wrote, res, input: input.trim(), band: run.band });
  run.last = { word: wrote, res, input: input.trim(), verdict };
  run.asked += 1;
  if (res === 'ok' || res === 'half') run.right += 1;

  const need = run.extended ? PLACE.per + PLACE.extra : PLACE.per;
  const left = need - run.asked;
  const ended = left <= 0 || !run.queue.length;
  if (!ended) {
    run.current = run.queue.shift()!;
    return;
  }
  const r = run.right;
  const a = run.asked;
  if (run.extended) return after(s, run, r >= PLACE.passExtended, false, rng);
  if (a < PLACE.per) return after(s, run, r / a >= 0.8, false, rng); // a band with fewer words left than 5
  if (r >= PLACE.per) return after(s, run, true, true, rng);
  if (r >= PLACE.pass) return after(s, run, true, false, rng);
  if (r <= PLACE.stop || !run.queue.length) return after(s, run, false, false, rng);
  run.extended = true;
  run.current = run.queue.shift()!;
}

function after(s: GameState, run: PlaceRun, ok: boolean, perfect: boolean, rng: Rng): void {
  if (run.verifying) {
    run.verifying = false;
    if (ok) run.passed.add(run.band);
    return finish(run);
  }
  bandDone(s, run, ok, perfect, rng);
}

/** 「后面都不会了，结束」. */
export function stopPlacement(run: PlaceRun): void {
  finish(run);
}

export interface PlaceOutcome {
  top: number;
  level: number;
  /** Levels gained (empty when the test did not raise the level). */
  gained: number[];
  region: 1 | 2 | 3;
  retired: number;
  half: number;
  gaps: number;
  placed: number;
}

const FAR = 9e15;

/** Turn the answers into progress, level and open regions. Only ever raises the level; never touches words you
 *  have already started, except that a right answer retires them. */
export function applyPlacement(s: GameState, run: PlaceRun, t = now(s), _opts: { daily?: boolean } = {}): PlaceOutcome {
  if (run.outcome) return run.outcome;
  const top = topPassed(run);
  const passed = (b: number) => b <= top;
  let retired = 0;
  let half = 0;
  let gaps = 0;
  let placed = 0;
  const seen = new Set<string>();
  for (const r of run.results) {
    seen.add(r.word.id);
    const p = s.words[r.word.id];
    if (r.res === 'ok') {
      if (!p) s.words[r.word.id] = { stage: 3, due: t + CONFIG.srs.recheck, firstSeen: t, lastSeen: t, relapse: 0, correct: 1, wrong: 0, read: 0, write: 1, retired: t };
      else {
        p.correct += 1;
        p.write = (p.write ?? 0) + 1;
        delete p.placed;
        delete p.ctxDone;
        retire(s, r.word, t);
      }
      retired++;
    } else if (r.res === 'half') {
      if (!p || isPlaced(p)) {
        s.words[r.word.id] = { stage: 2, lapsed: true, due: t, firstSeen: p?.firstSeen ?? t, lastSeen: t, relapse: 0, correct: 1, wrong: 0, read: 1, write: 0 };
        half++;
      }
    } else if (passed(r.band) && (!p || isPlaced(p))) {
      // A gap below your level: it follows you as a review monster (your level, full pay).
      s.words[r.word.id] = { stage: 1, lapsed: true, due: t, firstSeen: p?.firstSeen ?? t, lastSeen: t, relapse: 0, correct: 0, wrong: 1, read: 0, write: 0 };
      gaps++;
    }
  }
  for (const w of placeWords()) {
    if (!passed(bandOf(w)) || seen.has(w.id) || s.words[w.id]) continue;
    s.words[w.id] = { stage: 3, due: FAR, ctxDone: true, placed: t, firstSeen: t, lastSeen: t, relapse: 0, correct: 0, wrong: 0, read: 0, write: 0 };
    placed++;
  }
  const level = Math.max(s.level, levelFor(top));
  const gained: number[] = [];
  for (let l = s.level + 1; l <= level; l++) gained.push(l);
  if (gained.length) {
    s.level = level;
    s.xp = 0;
    s.hp = maxHp(s);
  }
  const region = regionFor(level);
  for (let r = 2; r <= region; r++) s.flags[`seenArea${r}`] = true;
  const prev = s.placement;
  s.placement = { at: t, level: levelFor(top), top: Math.max(top, prev?.top ?? -1), checks: prev?.checks ?? {} };
  s.flags.placeKnown = learnedCount(s);
  s.flags.placeAsked = true;
  run.outcome = { top, level, gained, region, retired, half, gaps, placed };
  return run.outcome;
}

// ---- 推定会 spot checks --------------------------------------------------------------------

/** A 推定会 word to spot-check in this fight (random, so a band's words are sampled evenly). */
export function placedPick(s: GameState, rng: Rng, not?: string): string | null {
  const ids = Object.entries(s.words)
    .filter(([id, p]) => id !== not && isPlaced(p))
    .map(([id]) => id);
  if (!ids.length) return null;
  return ids[Math.floor(rng() * ids.length)];
}

/** Spot check answered. Right → retired. Wrong → 半名 review monster; too many wrong in a band → its remaining
 *  推定会 words all turn into review monsters (the test placed you too high there). Returns the words reverted. */
export function placedCheck(s: GameState, w: Word, ok: boolean, t = now(s)): number {
  const p = s.words[w.id];
  if (!p || !isPlaced(p)) return 0;
  delete p.placed;
  delete p.ctxDone;
  const band = String(bandOf(w));
  const save = (s.placement ??= { at: t, level: s.level, top: -1, checks: {} });
  const c = (save.checks[band] ??= { n: 0, wrong: 0 });
  c.n += 1;
  if (ok) {
    p.correct += 1;
    p.write = (p.write ?? 0) + 1;
    retire(s, w, t);
    return 0;
  }
  c.wrong += 1;
  p.wrong += 1;
  p.stage = 2;
  p.lapsed = true;
  p.due = t;
  p.lastSeen = t;
  if (c.wrong < PLACE.revertFails || c.wrong / c.n <= PLACE.revertShare) return 0;
  let n = 0;
  for (const x of placeWords()) {
    const q = s.words[x.id];
    if (String(bandOf(x)) !== band || !isPlaced(q)) continue;
    delete q!.placed;
    delete q!.ctxDone;
    q!.stage = 1;
    q!.lapsed = true;
    q!.due = t;
    n++;
  }
  return n;
}

/** Words still 推定会 (for the wordbook line). */
export function placedCount(s: GameState): number {
  return Object.values(s.words).filter(isPlaced).length;
}
