// 入学测试 / 分级考核 (2026-11-25): 游戏设计 七「分级考核（入学测试）」, 五「跳级入场」.
import { describe, expect, it } from 'vitest';
import { newGame, migrate, type GameState } from '../src/core/state';
import { makeRng } from '../src/core/rng';
import { answerPlacement, applyPlacement, bandCount, bandOf, bandRange, bandSamples, canPlaceAgain, placeAgainIn, PLACE, gradePlace, isPlaced, levelFor, placedCheck, placedPick, placeWords, regionFor, startPlacement, stopPlacement, topPassed, type PlaceRun } from '../src/core/placement';
import { answerScreen, screenPool, startScreen } from '../src/core/screen';
import { makeQuestion, startBattle } from '../src/core/combat';
import { startCamp } from '../src/core/campCheck';
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
  it('bands cover levels 1–30 in steps of 3, then 31–160 in steps of 5 (1.0: B2 words), with sample words', () => {
    expect(bandCount()).toBe(36);
    expect(bandRange(35)).toEqual([156, 160]);
    expect(bandRange(10)).toEqual([31, 35]);
    expect(bandRange(27)).toEqual([116, 120]);
    expect(levelFor(27)).toBe(121);
    expect(regionFor(65)).toBe(7);
    expect(levelFor(-1)).toBe(1);
    expect(levelFor(0)).toBe(4);
    expect(levelFor(6)).toBe(22);
    expect(levelFor(9)).toBe(31);
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
    expect(canPlaceAgain(s)).toBe(false);
    // Again after 30 more words 归名 or 斩杀 (Lucas 2026-11-25).
    const fresh = placeWords().filter((w) => !s.words[w.id]).slice(0, PLACE.retakeAfter);
    for (const w of fresh.slice(0, -1)) s.words[w.id] = { stage: 3, due: T0 + 9e9, firstSeen: T0, lastSeen: T0, relapse: 0, correct: 1, wrong: 0, read: 1 };
    expect(placeAgainIn(s)).toBe(1);
    s.words[fresh.slice(-1)[0].id] = { stage: 2, due: T0, firstSeen: T0, lastSeen: T0, relapse: 0, correct: 1, wrong: 0, read: 1, retired: T0 };
    expect(canPlaceAgain(s)).toBe(true);
  });

  it('推定会 spot checks: right retires, wrong turns into a review monster, a bad band reverts', () => {
    const s = game();
    const run = startPlacement(s, makeRng(7));
    play(s, run, 21);
    applyPlacement(s, run);
    // the bonfire round asks 推定会 words when no review is due (1.0.13: nothing slipped into fights)
    const target = placeWords().find((w) => w.lvl === 22 && !s.words[w.id])!;
    const b = startBattle(s, target, makeRng(1));
    b.turn = 2;
    for (let i = 0; i < 6; i++) expect(makeQuestion(s, b, 'attack', makeRng(i)).review).toBeUndefined();
    const q = startCamp(s, makeRng(1))?.q;
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

  it('placing past a stage stands in for its trial; A1 still owes the grammar part', async () => {
    const { stagePassed, levelCapFor } = await import('../src/core/stages');
    const s = newGame('T', 'student');
    const run = startPlacement(s, makeRng(1), 0);
    for (let i = 0; i <= 19; i++) run.passed.add(i); // 1–80
    stopPlacement(run);
    applyPlacement(s, run);
    expect(s.level).toBe(81);
    expect(stagePassed(s.flags, 'A1')).toBe(true);
    expect(stagePassed(s.flags, 'A2')).toBe(true);
    expect(s.flags.a1Grammar).toBeFalsy();
    expect(levelCapFor(s.flags)).toBe(120);
  });
});

describe('点词 board (Lucas 11-26)', () => {
  it('shows whole words per band plus invented ones, none of which exist', async () => {
    const { pickBoard, FAKE_WORDS } = await import('../src/core/placement');
    const { WORDS } = await import('../src/data/words');
    const lower = new Set(WORDS.map((w) => (w.art ? `${w.art} ${w.de}` : w.de).toLowerCase()));
    for (const f of FAKE_WORDS) expect(lower.has(f.toLowerCase())).toBe(false);
    const b = pickBoard(newGame('T', 'student'), makeRng(1));
    expect(b.items.filter((i) => !i.fake).length).toBe(bandCount() * PLACE.pickPer);
    expect(b.items.filter((i) => i.fake).length).toBe(8);
  });

  it('estimates the cut-off from the clicks and pulls it down for invented words', async () => {
    const { pickBoard, estimatePicks, startFromPicks } = await import('../src/core/placement');
    const s = newGame('T', 'student');
    const b = pickBoard(s, makeRng(2));
    const upTo = (t: number, fakes = 0) => {
      const set = new Set(b.items.filter((i) => !i.fake && i.band <= t).map((i) => i.key));
      b.items.filter((i) => i.fake).slice(0, fakes).forEach((i) => set.add(i.key));
      return set;
    };
    expect(estimatePicks(b, new Set()).top).toBe(-1);
    expect(estimatePicks(b, upTo(15)).top).toBe(15);
    const one = estimatePicks(b, upTo(15, 1));
    expect(one.top).toBe(15 - PLACE.fakePenalty);
    expect(one.fakes.length).toBe(1);
    const run = startFromPicks(s, makeRng(3), estimatePicks(b, upTo(15)));
    expect(run.band).toBe(15);
    expect(run.claim?.unpicked.every((w) => bandOf(w) > 15)).toBe(true);
  });

  it('unclicked words in a band the typing check passed follow you as review monsters', async () => {
    const { pickBoard, estimatePicks, startFromPicks } = await import('../src/core/placement');
    const s = newGame('T', 'student');
    const b = pickBoard(s, makeRng(4));
    const picked = new Set(b.items.filter((i) => !i.fake && i.band <= 5).map((i) => i.key));
    const miss = b.items.find((i) => !i.fake && i.band === 2)!;
    picked.delete(miss.key);
    const run = startFromPicks(s, makeRng(5), estimatePicks(b, picked));
    while (!run.over) answerPlacement(s, run, run.band <= 5 ? fullForm(run.current!) : '', makeRng(6), run.band > 5);
    applyPlacement(s, run);
    expect(topPassed(run)).toBeGreaterThanOrEqual(5);
    const p = s.words[miss.word!.id];
    if (!run.results.some((r) => r.word.id === miss.word!.id)) expect(p.lapsed && !p.placed).toBe(true);
  });
});
