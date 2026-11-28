// 1.0.12 g3-onboarding: 入学测试 progress survives a reload (#37), synonyms get one retry (#43), the 入学礼 is on the
// outcome (#94), new saves never see the 0.6 note (#42/#49/#60/#69/#87), a 推定会 word fled from stays 推定会 (#92).
import { describe, expect, it } from 'vitest';
import { newGame, type GameState } from '../src/core/state';
import { makeRng } from '../src/core/rng';
import { answerPlacement, applyPlacement, isPlaced, loadPlaceRun, otherWord, savePlaceRun, startPlacement, type PlaceRun } from '../src/core/placement';
import { restorePresumed, startBattle } from '../src/core/combat';
import { fullForm, WORD_BY_ID, WORDS } from '../src/data/words';

const T0 = new Date('2026-11-28T12:00:00').getTime();

function game(level = 1): GameState {
  const s = newGame('T', 'student', T0);
  s.timeOffset = T0 - Date.now();
  s.level = level;
  return s;
}

function play(s: GameState, run: PlaceRun, knows: number, rng = makeRng(9), stopAfter = 999) {
  let guard = 0;
  while (!run.over && run.current && guard++ < stopAfter) {
    const w = run.current;
    answerPlacement(s, run, w.lvl <= knows ? fullForm(w) : '', rng, w.lvl > knows);
  }
}

describe('1.0.12 onboarding', () => {
  it('new saves are marked as having seen the 0.6 note', () => {
    expect(newGame('T', 'student', T0).flags.seen06).toBe(true);
  });

  it('a placement run survives JSON round trip and finishes the same', () => {
    const rng = makeRng(3);
    const a = game();
    const run = startPlacement(a, rng, 0);
    play(a, run, 40, rng, 7);
    expect(run.results.length).toBe(7);
    const saved = JSON.parse(JSON.stringify(savePlaceRun(run, false)));
    const back = loadPlaceRun(saved)!;
    expect(back.results.map((r) => r.word.id)).toEqual(run.results.map((r) => r.word.id));
    expect(back.current?.id).toBe(run.current?.id);
    expect([...back.passed]).toEqual([...run.passed]);
    expect(back.band).toBe(run.band);
    play(a, back, 40, rng);
    const o = applyPlacement(a, back);
    expect(o.level).toBeGreaterThan(30);
    expect(o.retired).toBeGreaterThan(7);
  });

  it('loadPlaceRun gives null for nothing saved', () => {
    expect(loadPlaceRun(undefined)).toBeNull();
  });

  it('another real word gets one retry instead of a wrong mark', () => {
    const s = game();
    const run = startPlacement(s, makeRng(5), 0);
    const w = run.current!;
    const other = WORDS.find((x) => x.id !== w.id && !x.tutorial && x.family !== 'truhe' && x.pos === 'adj' && x.de !== w.de)!;
    expect(otherWord(other.de, w)?.id).toBeDefined();
    answerPlacement(s, run, other.de, makeRng(1));
    expect(run.results.length).toBe(0);
    expect(run.current).toBe(w);
    expect(run.last?.other).toBeDefined();
    // The second time it is graded as usual.
    answerPlacement(s, run, other.de, makeRng(1));
    expect(run.results.length).toBe(1);
    expect(run.results[0].res).toBe('wrong');
  });

  it('the outcome carries the 入学礼 when the jump leaves region 1', () => {
    const rng = makeRng(4);
    const s = game();
    const run = startPlacement(s, rng, 0);
    play(s, run, 30, rng);
    const o = applyPlacement(s, run);
    expect(o.region).toBeGreaterThan(1);
    expect(o.kit?.gold).toBeGreaterThan(0);
  });

  it('a 推定会 word whose fight ended unanswered stays 推定会', () => {
    const rng = makeRng(2);
    const s = game();
    const run = startPlacement(s, rng, 0);
    play(s, run, 30, rng);
    applyPlacement(s, run);
    const id = Object.keys(s.words).find((k) => isPlaced(s.words[k]))!;
    const b = startBattle(s, WORD_BY_ID[id], rng);
    expect(b.presumed).toBe(true);
    expect(s.words[id]).toBeUndefined();
    expect(restorePresumed(s, b)).toBe(true);
    expect(isPlaced(s.words[id])).toBe(true);
  });
});
