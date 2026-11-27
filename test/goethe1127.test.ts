import { describe, expect, it } from 'vitest';
import { WORD_BY_ID } from '../src/data/words';
import { fitsGoethe, pickBoard } from '../src/core/placement';
import { newGame } from '../src/core/state';
import { makeRng } from '../src/core/rng';

// Lucas 2026-11-27: 入学测试 asks only words whose Goethe list matches their level; clearly early A1 words move to B1.
describe('Goethe levels', () => {
  it('tags words and moves the early ones', () => {
    expect(WORD_BY_ID['gewoehnen'].goethe).toBe('B1');
    expect(WORD_BY_ID['ewigkeit'].lvl).toBeGreaterThan(80);
    expect(WORD_BY_ID['seele'].lvl).toBeGreaterThan(80);
    // Diary blank words stay with their page.
    expect(WORD_BY_ID['friedhof'].lvl).toBe(25);
  });
  it('keeps Friedhof out of the test', () => {
    expect(fitsGoethe(WORD_BY_ID['friedhof'])).toBe(false);
    for (let seed = 1; seed <= 20; seed++) {
      const board = pickBoard(newGame('t', 'none'), makeRng(seed));
      for (const it of board.items) if (it.word && it.word.lvl <= 120) expect(fitsGoethe(it.word)).toBe(true);
    }
  });
});
