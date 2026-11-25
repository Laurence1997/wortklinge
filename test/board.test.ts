import { describe, expect, it } from 'vitest';
import { newGame, todayLog } from '../src/core/state';
import { berlinDay, noteGram, stampBoard } from '../src/core/board';

// 排行榜 counters (Lucas 2026-11-25).
describe('排行榜', () => {
  it('stamps daily, mastered, trials and hidden into the save', () => {
    const s = newGame('T', 'student');
    todayLog(s).correct = 7;
    s.words.a = { stage: 3 } as never;
    s.words.b = { stage: 1, retired: true } as never;
    s.words.c = { stage: 2 } as never;
    s.flags.starsPassed = 'x,y';
    s.flags.a1Passed = true;
    s.flags.a1Grammar = true;
    s.settings.hideBoard = true;
    noteGram(s, true);
    noteGram(s, false);
    const b = stampBoard(s);
    expect(b).toMatchObject({ day: berlinDay(), daily: 7, mastered: 2, trials: 3, gramOk: 1, gramN: 2, hidden: true });
    expect(berlinDay(Date.UTC(2026, 10, 25, 23, 30))).toBe('2026-11-26');
  });
});
