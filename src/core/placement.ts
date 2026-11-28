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
import { gradeTyped, levenshtein, normalize, stripRefl, type Verdict } from './grading';
import { shuffle, type Rng } from './rng';
import { retire, stageOf } from './srs';
import { itemTier, maxHp, now, type GameState } from './state';
import { addItem, count } from './items';
import type { Word, WordProgress } from './types';
import { fullForm, hasArticleQuestion, WORD_BY_ID, WORDS } from '../data/words';
import { sameMeaning } from './screen';
import { itemScore, makeItem, slotsAt } from './loot';
import { tierIlvl } from './forge';
import { STAGES } from './stages';

export const PLACE = {
  /** Monster levels per band (1–30), and above 30. */
  band: 3,
  bandHigh: 5,
  /** Words asked per band, and the extra ones when it is borderline. */
  per: 5,
  extra: 3,
  /** Right (or 半对) answers needed: of 5, of 8. 5/5 skips the next band. ≤ stop ends the climb. */
  pass: 4,
  passExtended: 5,
  stop: 2,
  /** Sample words shown per band on the self-pick screen. */
  samples: 5,
  /** 点词 board (Lucas 11-26): real words per band, and bands an invented word pulls the estimate down by. */
  pickPer: 2,
  fakePenalty: 2,
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
  return WORDS.filter((w) => !w.tutorial && w.family !== 'truhe' && w.pos !== 'phr' && w.lvl <= PLACE_CAP);
}

/** 入学测试 asks only words whose Goethe list matches the game's own level (Lucas 2026-11-27): A1 words in 1–30,
 *  A2 in 31–80, B1 in 81–120, none of the three above 120. Friedhof at level 25 is on no list up to B1, so a player
 *  who doesn't know it would be placed too low. A band left with too few such words falls back to all its words. */
export function fitsGoethe(w: Pick<Word, 'lvl' | 'goethe'>): boolean {
  const want = w.lvl <= 30 ? 'A1' : w.lvl <= 80 ? 'A2' : w.lvl <= 120 ? 'B1' : undefined;
  return w.goethe === want;
}

/** Of these words, the ones that fit the Goethe level, unless that leaves fewer than `min`. */
function goetheFirst<T extends Pick<Word, 'lvl' | 'goethe'>>(ws: T[], min: number): T[] {
  const fit = ws.filter(fitsGoethe);
  return fit.length >= min ? fit : ws;
}

/** Bands: 3 levels each up to 30 (A1, unchanged so old saves keep their band keys), then 5 levels each (A2, B1; edges on 80 and 120). */
const A1_BANDS = 30 / 3;
export function bandOf(w: Pick<Word, 'lvl'>): number {
  if (w.lvl <= 30) return Math.floor((w.lvl - 1) / PLACE.band);
  return A1_BANDS + Math.floor((w.lvl - 31) / PLACE.bandHigh);
}

export function bandCount(): number {
  return Math.max(0, ...placeWords().map(bandOf)) + 1;
}

export function bandRange(i: number): [number, number] {
  if (i < A1_BANDS) return [i * PLACE.band + 1, Math.min(PLACE_CAP, (i + 1) * PLACE.band)];
  const j = i - A1_BANDS;
  return [31 + j * PLACE.bandHigh, Math.min(PLACE_CAP, 30 + (j + 1) * PLACE.bandHigh)];
}

/** Entry level when bands 0..top are passed (top = -1: none). */
export function levelFor(top: number): number {
  return top < 0 ? 1 : Math.min(PLACE_CAP, bandRange(top)[1] + 1);
}

/** 分级考核 reaches the end of the released content (0.8: 120, regions 1–12; Lucas 11-26). */
export const PLACE_CAP = Math.min(CONFIG.levelCap, CONFIG.releaseCap);

/** Region you start in at that level (10 levels per region). */
export function regionFor(level: number): number {
  return Math.max(1, Math.min(Math.ceil(PLACE_CAP / 10), Math.ceil(level / 10)));
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
  const ws = placeWords();
  for (const w of [...ws.filter(fitsGoethe), ...ws.filter((x) => !fitsGoethe(x))]) {
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
  last?: { word: Word; res: PlaceRes; input: string; verdict: Verdict; other?: Word };
  /** 1.0.12 (#43): the word whose one 「换一个词再写」 retry is used up (the player wrote another real word). */
  retried?: string;
  over: boolean;
  /** Checking a skipped band after the next one failed: pass or fail, the test ends there. */
  verifying?: boolean;
  /** Set by applyPlacement. */
  outcome?: PlaceOutcome;
  /** From the 点词 board: the estimate it gave, invented words clicked, real words left unclicked. */
  claim?: PickResult;
}

function bandQueue(s: GameState, band: number, rng: Rng, exclude: Set<string>): Word[] {
  return shuffle(rng, goetheFirst(placeWords().filter((w) => bandOf(w) === band && !known(s, w) && !exclude.has(w.id)), PLACE.per + PLACE.extra));
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

// ---- 点词 board (Lucas 2026-11-26) -----------------------------------------------------------
// Instead of picking a band from truncated sample lines, the player sees ~2 whole words per band and clicks the ones
// they know. A few invented German-looking words are mixed in: clicking one pulls the estimate down. The estimate is
// only where the typing check starts; the typing check (unchanged) decides the level.

/** Invented words: look German, do not exist (checked against the word list). */
export const FAKE_WORDS = ['der Flinsel', 'die Brötung', 'das Gemörk', 'verpladern', 'die Nastheit', 'glurbig', 'der Kramsel', 'umtrölen', 'das Pleschtum', 'die Strabe', 'brimsig', 'die Serbung'];
/** Invented words on one board. */
export const FAKES_SHOWN = 8;

export interface PickItem {
  key: string;
  label: string;
  band: number;
  word?: Word;
  fake?: boolean;
}

export interface PickBoard {
  items: PickItem[];
  /** Bands with nothing left to show (all known already): count as known. */
  known: number[];
}

export interface PickResult {
  /** Highest band the clicks point at, after the invented-word penalty (-1 = none). */
  top: number;
  /** Before the penalty. */
  raw: number;
  fakes: string[];
  /** Real words shown but not clicked. */
  unpicked: Word[];
}

/** Build the board: per band a few useful words you do not know yet, plus invented ones spread over the stages. */
export function pickBoard(s: GameState, rng: Rng): PickBoard {
  const n = bandCount();
  const pools: Word[][] = Array.from({ length: n }, () => []);
  for (const w of placeWords()) if ((w.pos === 'n' || w.pos === 'v' || w.pos === 'adj') && !known(s, w)) pools[bandOf(w)].push(w);
  const items: PickItem[] = [];
  const knownBands: number[] = [];
  pools.forEach((pool, b) => {
    if (!pool.length) return knownBands.push(b);
    for (const w of shuffle(rng, goetheFirst(pool, PLACE.pickPer).slice(0, 15)).slice(0, PLACE.pickPer)) items.push({ key: w.id, label: fullForm(w), band: b, word: w });
  });
  const fakes = shuffle(rng, FAKE_WORDS).slice(0, FAKES_SHOWN);
  fakes.forEach((f, i) => items.push({ key: `fake:${f}`, label: f, band: Math.floor(((i + 0.5) / fakes.length) * n), fake: true }));
  return { items: shuffle(rng, items), known: knownBands };
}

/** Estimate from the clicks: the cut-off band that disagrees with the fewest clicks (known below, unknown above),
 *  ties to the higher band (the typing check steps down if it is too high); minus 2 bands per invented word. */
export function estimatePicks(board: PickBoard, picked: Set<string>): PickResult {
  const n = bandCount();
  const real = board.items.filter((i) => !i.fake);
  let best = -1;
  let bestErr = Infinity;
  for (let t = -1; t < n; t++) {
    let err = 0;
    for (const i of real) if ((i.band <= t) !== picked.has(i.key)) err++;
    for (const b of board.known) if (b > t) err += PLACE.pickPer;
    if (err <= bestErr) {
      bestErr = err;
      best = t;
    }
  }
  const fakes = board.items.filter((i) => i.fake && picked.has(i.key)).map((i) => i.label);
  const top = Math.max(-1, best - PLACE.fakePenalty * fakes.length);
  return { top, raw: best, fakes, unpicked: real.filter((i) => !picked.has(i.key)).map((i) => i.word!) };
}

/** Start the typing check from the board: at the estimated band (nothing clicked → from the beginning). */
export function startFromPicks(s: GameState, rng: Rng, claim: PickResult): PlaceRun {
  const run = startPlacement(s, rng, Math.max(0, claim.top));
  run.claim = claim;
  return run;
}

/** Start the test at a band (0 = from the beginning). */
export function startPlacement(s: GameState, rng: Rng, start = 0): PlaceRun {
  const n = bandCount();
  const st = Math.max(0, Math.min(n - 1, start));
  const run: PlaceRun = { band: st, start: st, descending: st > 0, queue: [], asked: 0, right: 0, extended: false, passed: new Set(), skipped: null, failed: new Set(), results: [], current: null, over: false };
  openBand(s, run, st, rng);
  return run;
}

/** Another real word the input spells (a synonym like völlig for 「彻底的」, or just another word), if any. */
export function otherWord(input: string, w: Word): Word | undefined {
  const n = normalize(input).replace(/^(der|die|das) /, '');
  if (!n || n === normalize(w.de)) return undefined;
  return WORDS.find((x) => x.id !== w.id && !x.tutorial && x.family !== 'truhe' && normalize(x.de) === n);
}

/** Grade one answer: right, 半对 (right word, article wrong or missing, or one letter off), or wrong. */
export function gradePlace(input: string, w: Word): { res: Exclude<PlaceRes, 'skip'>; verdict: Verdict; wrote: Word } {
  const cands = [w, ...placeWords().filter((x) => x.id !== w.id && sameMeaning(x, w))];
  for (const c of cands) {
    const v = gradeTyped(input, c, hasArticleQuestion(c));
    if (v.ok) return { res: 'ok', verdict: v, wrote: c };
  }
  const verdict = gradeTyped(input, w, hasArticleQuestion(w));
  const nIn = stripRefl(normalize(input), w);
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
  // 1.0.12 (#43): a real German word that is not the one asked (often a synonym) is not graded the first time:
  // the player is told what it means and writes again (once per word).
  const other = res === 'wrong' && run.retried !== w.id ? otherWord(input, w) : undefined;
  if (other) {
    run.retried = w.id;
    run.last = { word: w, res, input: input.trim(), verdict, other };
    return;
  }
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
  region: number;
  retired: number;
  half: number;
  gaps: number;
  placed: number;
  /** 1.0.12 (#94): the 入学礼 given with the jump (shown on the result page). */
  kit?: { tier: number; gold: number; tablets: number } | null;
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
      if (!p) s.words[r.word.id] = { stage: 3, due: t + CONFIG.srs.recheck, firstSeen: t, lastSeen: t, relapse: 0, correct: 1, wrong: 0, read: 0, write: 1, retired: t, sure: true }; // 会的词不再回响抽查 (Lucas 2026-11-27)
      else {
        p.correct += 1;
        p.write = (p.write ?? 0) + 1;
        delete p.placed;
        delete p.ctxDone;
        retire(s, r.word, t, true);
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
  // 点词: words you said you did not know, in bands the typing check passed, follow you like typed gaps.
  for (const w of run.claim?.unpicked ?? []) {
    if (!passed(bandOf(w)) || seen.has(w.id)) continue;
    seen.add(w.id);
    const p = s.words[w.id];
    if (p && !isPlaced(p)) continue;
    s.words[w.id] = { stage: 1, lapsed: true, due: t, firstSeen: p?.firstSeen ?? t, lastSeen: t, relapse: 0, correct: 0, wrong: 0, read: 0, write: 0 };
    gaps++;
  }
  for (const w of placeWords()) {
    if (!passed(bandOf(w)) || seen.has(w.id) || s.words[w.id]) continue;
    s.words[w.id] = { stage: 3, due: FAR, ctxDone: true, placed: t, firstSeen: t, lastSeen: t, relapse: 0, correct: 0, wrong: 0, read: 0, write: 0 };
    placed++;
  }
  // 0.8.3 (Lucas 11-26「按推荐」): passing every band of a stage stands in for that stage's 突破试炼 words; it no
  // longer caps the level. A1's grammar part is still owed (补考语法 at the 考官), but does not block levelling.
  const topLevel = top < 0 ? 0 : bandRange(top)[1];
  for (const d of STAGES) {
    if (d.cap > topLevel) break;
    if (d.stage === 'A1') s.flags.a1Passed = true;
    s.flags[`place${d.stage}`] = true;
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
  // 审查修订 C4 → 1.0.10 (Lucas 11-27「按推荐」): a jump into a new region brings what a player who walked there would
  // carry — that region's shards credited up to tier 3, a tier-3 set, gold for the skipped levels and a full tablet stock.
  const kit = gained.length && region > 1 ? placementKit(s, region, gained[0] - 1, level) : null;
  const prev = s.placement;
  s.placement = { at: t, level: levelFor(top), top: Math.max(top, prev?.top ?? -1), checks: prev?.checks ?? {} };
  s.flags.placeKnown = learnedCount(s);
  s.flags.placeAsked = true;
  run.outcome = { top, level, gained, region, retired, half, gaps, placed, kit };
  return run.outcome;
}

// ---- 1.0.12 (#37): a test in progress survives a reload ---------------------------------------

/** A PlaceRun as plain JSON (word ids instead of words, arrays instead of sets). */
export interface PlaceRunSave {
  daily: boolean;
  band: number;
  start: number;
  descending: boolean;
  queue: string[];
  asked: number;
  right: number;
  extended: boolean;
  passed: number[];
  skipped: number | null;
  failed: number[];
  results: Array<{ id: string; res: PlaceRes; input: string; band: number }>;
  current: string | null;
  over: boolean;
  verifying?: boolean;
  retried?: string;
  claim?: { top: number; raw: number; fakes: string[]; unpicked: string[] };
}

export function savePlaceRun(run: PlaceRun, daily: boolean): PlaceRunSave {
  const c = run.claim;
  return {
    daily,
    band: run.band,
    start: run.start,
    descending: run.descending,
    queue: run.queue.map((w) => w.id),
    asked: run.asked,
    right: run.right,
    extended: run.extended,
    passed: [...run.passed],
    skipped: run.skipped,
    failed: [...run.failed],
    results: run.results.map((r) => ({ id: r.word.id, res: r.res, input: r.input, band: r.band })),
    current: run.current?.id ?? null,
    over: run.over,
    verifying: run.verifying || undefined,
    retried: run.retried,
    claim: c ? { top: c.top, raw: c.raw, fakes: c.fakes, unpicked: c.unpicked.map((w) => w.id) } : undefined,
  };
}

/** Back from JSON; words no longer on the list are dropped. Null when nothing usable is left. */
export function loadPlaceRun(x: PlaceRunSave | undefined): PlaceRun | null {
  if (!x || !Array.isArray(x.results)) return null;
  const word = (id: string | null | undefined) => (id ? WORD_BY_ID[id] : undefined);
  const ws = (ids: string[] | undefined) => (ids ?? []).map(word).filter((w): w is Word => !!w);
  const results = x.results.flatMap((r) => {
    const w = word(r.id);
    return w ? [{ word: w, res: r.res, input: r.input, band: r.band }] : [];
  });
  const current = word(x.current) ?? null;
  const queue = ws(x.queue);
  const run: PlaceRun = {
    band: x.band,
    start: x.start,
    descending: !!x.descending,
    queue,
    asked: x.asked,
    right: x.right,
    extended: !!x.extended,
    passed: new Set(x.passed ?? []),
    skipped: x.skipped ?? null,
    failed: new Set(x.failed ?? []),
    results,
    current: current ?? (x.over ? null : queue.shift() ?? null),
    over: !!x.over,
    verifying: x.verifying || undefined,
    retried: x.retried,
    claim: x.claim ? { top: x.claim.top, raw: x.claim.raw, fakes: x.claim.fakes ?? [], unpicked: ws(x.claim.unpicked) } : undefined,
  };
  if (!run.current) run.over = true;
  return run;
}

/** Tier a placed player starts on in the entry region (a player who walked there leaves a region at about 2–3). */
export const PLACE_KIT_TIER = 3;
/** Gold for each skipped level: about 25 kills at that level. */
export const placeKitGold = (from: number, to: number): number => {
  let g = 0;
  for (let l = Math.max(1, from) + 1; l <= to; l++) g += 25 * CONFIG.gold.perKill(l);
  return g;
};

/** The entry kit of a placement (once per region, flag kit2_<region>): shards up to PLACE_KIT_TIER, a set of that tier
 *  (better pieces stay on), gold for the levels from `from` to `to`, tablets topped up. Returns what was given. */
export function placementKit(s: GameState, region: number, from: number, to: number): { tier: number; gold: number; tablets: number } | null {
  if (region <= 1 || s.flags[`kit2_${region}`]) return null;
  s.flags[`kit2_${region}`] = true;
  s.flags[`entryKit_${region}`] = true;
  const tier = PLACE_KIT_TIER;
  s.gearKills = { ...(s.gearKills ?? {}) };
  s.gearKills[String(region)] = Math.max(s.gearKills[String(region)] ?? 0, CONFIG.gear.shardsPerTierSq * tier * tier);
  const ilvl = tierIlvl(region, tier);
  for (const slot of slotsAt(ilvl)) {
    const it = { ...makeItem(Math.random, ilvl, 'white', slot), tier, region };
    const cur = s.equipped[slot];
    if (!cur || itemTier(cur, region) < tier || (itemTier(cur, region) === tier && itemScore(cur) < itemScore(it))) s.equipped[slot] = it;
  }
  const gold = placeKitGold(from, to);
  s.gold += gold;
  const before = count(s, 'tablet');
  addItem(s, 'tablet', CONFIG.items.tabletCap);
  s.hp = maxHp(s);
  return { tier, gold, tablets: count(s, 'tablet') - before };
}

/** Saves placed before 1.0.10 got only a white tier-0 set: give the kit once for the region the test put them in. */
export function backfillPlacementKit(s: GameState): ReturnType<typeof placementKit> {
  if (!s.placement || s.flags.kit2Done) return null;
  s.flags.kit2Done = true;
  const region = regionFor(s.placement.level);
  if (region <= 1) return null;
  return placementKit(s, region, 1, s.placement.level);
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
