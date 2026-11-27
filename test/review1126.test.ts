import { describe, expect, it } from 'vitest';
import { newGame } from '../src/core/state';
import { CARDS, charmPick, rotateCard } from '../src/core/charms';
import { dictMain, LEGENDARY_KEYS, makeItem, mainStatText } from '../src/core/loot';
import { makeRng } from '../src/core/rng';

describe('系统审查 2026-11-26', () => {
  it('短句卡: each fight draws a collected card, not the same one twice in a row', () => {
    const s = newGame('T', 'student');
    s.level = 40;
    s.sayings = Object.fromEntries(CARDS.slice(0, 3).map((c) => [c.id, 1]));
    const rng = makeRng(7);
    let last = '';
    for (let i = 0; i < 20; i++) {
      rotateCard(s, rng);
      const c = charmPick(s, 'card')!;
      expect(s.sayings[c.id]).toBeTruthy();
      expect(c.id).not.toBe(last);
      last = c.id;
    }
  });
  it('词典 is typed damage; an old dictionary (note count) reads by quality', () => {
    const it = makeItem(makeRng(1), 30, 'purple', 'dict');
    expect(it.main).toBeLessThan(1);
    expect(mainStatText(it)).toContain('打字题伤害');
    expect(dictMain({ main: 3, quality: 'orange' })).toBeCloseTo(0.16);
  });
  it('orange items roll one of several legendary effects', () => {
    const rng = makeRng(3);
    const seen = new Set(Array.from({ length: 60 }, () => makeItem(rng, 50, 'orange').legendary));
    expect(seen.size).toBeGreaterThan(2);
    for (const k of seen) expect(LEGENDARY_KEYS).toContain(k);
  });
});
