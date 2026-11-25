import { describe, expect, it } from 'vitest';
import { newGame } from '../src/core/state';
import { bossRed, FORGE, pityOrange } from '../src/core/forge';

// 红装和橙装保底 (游戏设计 九).
describe('drop pity', () => {
  it('150 drops without an orange: the next one is orange', () => {
    const s = newGame('T', 'student');
    for (let i = 0; i < FORGE.orangePity - 1; i++) expect(pityOrange(s, 'white', 'orange')).toBe('white');
    expect(pityOrange(s, 'white', 'orange')).toBe('orange');
    expect(pityOrange(s, 'green', 'green')).toBe('green');
  });

  it('red: none before 111, the 60th boss without one always', () => {
    const s = newGame('T', 'student');
    s.level = 110;
    expect(bossRed(s, () => 0)).toBeNull();
    s.level = 111;
    let got = null;
    for (let i = 0; i < FORGE.redPity && !got; i++) got = bossRed(s, () => 0.99);
    expect(got?.quality).toBe('red');
    expect(got?.affixes).toHaveLength(4);
  });
});
