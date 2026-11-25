// 入学测试 / 分级考核 (2026-11-25): 游戏设计 七「分级考核（入学测试）」, 五「跳级入场」.
import { describe, expect, it } from 'vitest';
import { newGame, migrate, type GameState } from '../src/core/state';
import { makeRng } from '../src/core/rng';
import { answerPlacement, applyPlacement, bandCount, bandOf, bandSamples, canPlaceToday, gradePlace, isPlaced, levelFor, placedCheck, placedPick, placeWords, regionFor, startPlacement, stopPlacement, topPassed, type PlaceRun } from '../src/core/placement';
import { answerScreen, screenPool, startScreen } from '../src/core/screen';
import { contextQuestion, startBattle } from '../src/core/combat';
import { kindOf, reviewMon, stageOf } from '../src/core/srs';
import { pickSpawns } from '../src/core/spawn';
import { fullForm, WORD_BY_ID } from '../src/data/words';
import type { Word } from '../src/core/types';

const T0 = new Date('2026-11-25T12:00:00').getTime();

function game(level = 1): GameState {
  const s = newGame('T', 'student', T0);
  s.timeOffset = T0 - Date.now();
  s.level = level;
  return s;
}

/** Answer like a player who knows every word up to monster level `knows`. */
function play(s: GameState, run: PlaceRun, knows: number, rng = makeRng(9)) {
  let guard = 0;
  while (!run.over && run.current && guard++ < 200) {
    const w = run.current;
    answerPlacement(s, run, w.lvl <= knows ? fullForm(w) : '', rng, w.lvl > knows);
  }
}

describe('入学测试', () => {
  it('bands cover levels 1–30 in steps of 3, with sample words', () => {
    expect(bandCount()).toBe(10);
    expect(levelFor(-1)).toBe(1);
    expect(levelFor(0)).toBe(4);
    expect(levelFor(6)).toBe(22);
    expect(levelFor(9)).toBe(30);
    expect(regionFor(10)).toBe(1);
    expect(regionFor(13)).toBe(2);
    expect(regionFor(22)).toBe(3);
    expect(placeWords().every((w) => !w.tutorial && w.pos !== 'phr' && w.family !== 'truhe')).toBe(true);
    expect(bandSamples().every((b) => b.length > 0)).toBe(true);
  });

  it('a beginner is done after one band and nothing changes', () => {
    const s = game();
    const run = startPlacement(s, makeRng(1));
    play(s, run, 0);
    expect(run.over).toBe(true);
    expect(run.results.length).toBe(5);
    const o = applyPlacement(s, run);
    expect(o.level).toBe(1);
    expect(o.gained).toEqual([]);
    expect(Object.keys(s.words).length).toBe(0);
    expect(s.region).toBe(1);
  });

  it('someone who knows up to Lv21 starts at 22 in region 3; tested words retire, the rest is 推定会', () => {
    const s = game();
    const run = startPlacement(s, makeRng(2));
    play(s, run, 21);
    expect(topPassed(run)).toBe(6);
    expect(run.results.length).toBeLessThanOrEqual(45);
    const o = applyPlacement(s, run);
    expect(o.level).toBe(22);
    expect(s.level).toBe(22);
    expect(o.region).toBe(3);
    expect(s.flags.seenArea2).toBe(true);
    expect(s.flags.seenArea3).toBe(true);
    const right = run.results.filter((r) => r.res === 'ok');
    expect(right.every((r) => s.words[r.word.id].retired)).toBe(true);
    // untested words of passed bands are 推定会: count as 归名, never spawn as learning monsters
    const placed = placeWords().filter((w) => isPlaced(s.words[w.id]));
    expect(placed.length).toBe(o.placed);
    expect(placed.every((w) => bandOf(w) <= 6 && stageOf(s, w) === 3 && kindOf(s, w) === 'guiming')).toBe(true);
    // words above stay untouched
    expect(placeWords().filter((w) => w.lvl >= 25).every((w) => !s.words[w.id] || run.results.some((r) => r.word.id === w.id))).toBe(true);
  });

  it('starting from a picked band steps down when it fails', () => {
    const s = game();
    const run = startPlacement(s, makeRng(3), 8); // claims Lv25–27
    play(s, run, 12);
    expect(topPassed(run)).toBe(3);
    expect(applyPlacement(s, run).level).toBe(13);
  });

  it('5/5 skips a band; a fail right after it re-checks the skipped one', () => {
    const s = game();
    const run = startPlacement(s, makeRng(4));
    play(s, run, 3); // band 0 perfect → band 1 skipped, band 2 fails → band 1 checked and fails
    expect(topPassed(run)).toBe(0);
    expect(applyPlacement(s, run).level).toBe(4);
  });

  it('half-right answers (article, one letter) become 半名 review monsters; gaps follow you', () => {
    const tisch = WORD_BY_ID['tisch'];
    expect(gradePlace('die Tisch', tisch).res).toBe('half');
    expect(gradePlace('Tisch', tisch).res).toBe('half');
    expect(gradePlace('der Tsich', tisch).res).toBe('wrong'); // two letters swapped = 2 edits
    expect(gradePlace('der Tish', tisch).res).toBe('half');
    expect(gradePlace('der Tisch', tisch).res).toBe('ok');
    const s = game();
    const run = startPlacement(s, makeRng(5));
    let first = true;
    let guard = 0;
    while (!run.over && run.current && guard++ < 200) {
      const w = run.current;
      if (w.lvl > 12) answerPlacement(s, run, '', makeRng(1), true);
      else if (first && w.art) {
        first = false;
        answerPlacement(s, run, w.de, makeRng(1)); // no article
      } else answerPlacement(s, run, fullForm(w), makeRng(1));
    }
    const o = applyPlacement(s, run);
    const half = run.results.find((r) => r.res === 'half');
    if (half) {
      expect(s.words[half.word.id].stage).toBe(2);
      expect(reviewMon(s.words[half.word.id], T0)).toBe(true);
    }
    expect(o.level).toBeGreaterThanOrEqual(10);
  });

  it('only ever raises the level, once a day at the examiner', () => {
    const s = game(25);
    const run = startPlacement(s, makeRng(6));
    play(s, run, 6);
    const o = applyPlacement(s, run, undefined, { daily: true });
    expect(o.gained).toEqual([]);
    expect(s.level).toBe(25);
    expect(canPlaceToday(s)).toBe(false);
  });

  it('推定会 spot checks: right retires, wrong turns into a review monster, a bad band reverts', () => {
    const s = game();
    const run = startPlacement(s, makeRng(7));
    play(s, run, 21);
    applyPlacement(s, run);
    // the context slot asks a 推定会 word when no review is due
    const target = placeWords().find((w) => w.lvl === 22 && !s.words[w.id])!;
    const b = startBattle(s, target, makeRng(1));
    b.turn = 2;
    const q = contextQuestion(s, b, makeRng(1));
    expect(q?.review).toBeTruthy();
    expect(isPlaced(s.words[q!.review!])).toBe(true);
    expect(q!.prompt).toContain('抽查');

    const band0 = placeWords().filter((w) => bandOf(w) === 1 && isPlaced(s.words[w.id]));
    placedCheck(s, band0[0], true);
    expect(s.words[band0[0].id].retired).toBeTruthy();
    placedCheck(s, band0[1], false);
    expect(reviewMon(s.words[band0[1].id], T0)).toBe(true);
    placedCheck(s, band0[2], false);
    const n = placedCheck(s, band0[3], false); // 3 wrong of 4 → the band's rest reverts
    expect(n).toBeGreaterThan(0);
    expect(band0.slice(4).every((w) => !isPlaced(s.words[w.id]) && reviewMon(s.words[w.id], T0))).toBe(true);
    // reverted words come to wherever you are (region 3)
    s.region = 3;
    const picks = pickSpawns(s, 'gleisdorf', 6, new Set(), makeRng(1));
    expect(picks.some((p) => p.kind === 'due' && band0.some((w) => w.id === p.word.id))).toBe(true);
    expect(placedPick(s, makeRng(1))).toBeTruthy();
  });

  it('全量筛选 still asks 推定会 words; writing one retires it without storing scene XP', () => {
    const s = game();
    const run = startPlacement(s, makeRng(8));
    play(s, run, 9);
    applyPlacement(s, run);
    const pool = screenPool(s, '1');
    const placed = pool.filter((w) => isPlaced(s.words[w.id]));
    expect(placed.length).toBeGreaterThan(0);
    const sr = startScreen(s, '1');
    let guard = 0;
    while (sr.current && !isPlaced(s.words[sr.current.id]) && guard++ < 500) answerScreen(s, sr, '', true);
    const w = sr.current as Word;
    answerScreen(s, sr, fullForm(w));
    expect(s.words[w.id].retired).toBeTruthy();
    expect(sr.last?.placed).toBe(true);
    expect(Object.values(s.screen?.pending ?? {}).flat()).not.toContain(w.id);
    // retired in the test → never asked again
    const retired = run.results.find((r) => r.res === 'ok')!.word;
    expect(screenPool(s, 'all').some((x) => x.id === retired.id)).toBe(false);
  });

  it('closing mid-test keeps what was answered; saves round-trip through migrate', () => {
    const s = game();
    const run = startPlacement(s, makeRng(10));
    for (let i = 0; i < 5; i++) answerPlacement(s, run, fullForm(run.current!), makeRng(1));
    stopPlacement(run);
    const o = applyPlacement(s, run);
    expect(o.retired).toBe(5);
    const back = migrate(JSON.parse(JSON.stringify(s)))!;
    expect(back.placement?.top).toBe(o.top);
    expect(Object.values(back.words).filter((p) => p.placed).length).toBe(o.placed);
  });
});
