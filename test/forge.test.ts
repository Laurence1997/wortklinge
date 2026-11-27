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

import { salvage, shardBalance, tierIlvl, tradeInfo, tradeShards, tradesOpen } from '../src/core/forge';
import { addGearKill } from '../src/core/state';
describe('碎片换档', () => {
  it('累计 unlocks tiers, 余额 pays: the first trade of each tier is free, then 10 × n; salvage refills both', () => {
    const s = newGame('T', 'student');
    s.level = 40;
    s.region = 4 as never;
    expect(tradesOpen(s, 4)).toBe(0);
    addGearKill(s, 4, 1, 40 * 4); // tier 2 unlocked, 160 in the balance
    expect(tradesOpen(s, 4)).toBe(2); // one free trade per tier unlocked
    const r = tradeShards(s, 4, 'coat', makeRng(1));
    expect(r.ok).toBe(true);
    expect(r.item).toMatchObject({ slot: 'coat', tier: 2, region: 4, ilvl: tierIlvl(4, 2) });
    expect(r.cost).toBe(0);
    tradeShards(s, 4, 'pen', makeRng(2));
    expect(tradesOpen(s, 4)).toBe(0);
    expect(tradeInfo(s, 4)).toMatchObject({ tier: 2, cost: 20, free: false, can: true });
    expect(tradeShards(s, 4, 'pen', makeRng(3)).cost).toBe(20);
    expect(shardBalance(s, 4)).toBe(140);
    expect(s.gearKills!['4']).toBe(160); // 累计 never goes down
    s.shardBal!['4'] = 5;
    expect(tradeShards(s, 4, 'pen', makeRng(4)).ok).toBe(false);
    expect(salvage(s, s.bag[0].id).ok).toBe(true);
    expect(shardBalance(s, 4)).toBe(8);
    expect(s.gearKills!['4']).toBe(163);
  });
  it('opens at level 3', () => {
    const s = newGame('T', 'student');
    s.level = 2;
    addGearKill(s, 1, 1, 40);
    expect(tradeShards(s, 1, 'pen', makeRng(1)).ok).toBe(false);
    s.level = 3;
    expect(tradeShards(s, 1, 'pen', makeRng(1)).ok).toBe(true);
  });
});
