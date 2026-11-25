import { describe, expect, it } from 'vitest';
import { newGame } from '../src/core/state';
import { makeRng } from '../src/core/rng';
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

import { salvage, tierIlvl, tradedTier, tradeShards, tradesOpen } from '../src/core/forge';
describe('碎片换装备', () => {
  it('each tier reached in a region trades once for a piece of the chosen slot; salvage gives shards back', () => {
    const s = newGame('T', 'student');
    s.level = 40;
    s.region = 4 as never;
    expect(tradesOpen(s, 4)).toBe(0);
    s.gearKills = { '4': 40 * 4 }; // tier 2
    expect(tradesOpen(s, 4)).toBe(2);
    const r = tradeShards(s, 4, 'coat', makeRng(1));
    expect(r.ok).toBe(true);
    expect(r.item!.slot).toBe('coat');
    expect(r.item!.ilvl).toBe(tierIlvl(4, 1));
    expect(tradedTier(s, 4)).toBe(1);
    expect(tradesOpen(s, 4)).toBe(1);
    tradeShards(s, 4, 'pen', makeRng(2));
    expect(tradeShards(s, 4, 'pen', makeRng(3)).ok).toBe(false);
    const before = s.gearKills!['4'];
    expect(salvage(s, s.bag[0].id).ok).toBe(true);
    expect(s.gearKills!['4']).toBe(before + 3);
  });
});
