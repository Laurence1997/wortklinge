import { describe, expect, it } from 'vitest';
import { BOSS_ART, BOSS_PAL } from '../src/data/bossArt';
import { LATER_BOSS } from '../src/data/bossesLater';

describe('boss figures (方案 B)', () => {
  it('every boss has a 32×32 figure in the boss palette', () => {
    const keys = ['1', '2', '3', 'lina', ...Object.keys(LATER_BOSS)];
    for (const k of keys) {
      const rows = BOSS_ART[k];
      expect(rows, k).toBeTruthy();
      expect(rows!.length, k).toBe(32);
      for (const r of rows!) {
        expect(r.length, k).toBe(32);
        for (const ch of r) expect(ch === '.' || ch in BOSS_PAL, `${k} ${ch}`).toBe(true);
      }
    }
  });
});
