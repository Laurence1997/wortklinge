import { describe, expect, it } from 'vitest';
import { newGame, maxHp, attack, itemTier } from '../src/core/state';
import { backfillPlacementKit, placementKit, PLACE_KIT_TIER } from '../src/core/placement';
import { count } from '../src/core/items';

describe('定级补偿 (1.0.10)', () => {
  it('a placed Lv25 player gets tier-3 gear, shards, gold and tablets once', () => {
    const s = newGame('T', 'student');
    s.level = 25; s.region = 3;
    const hp0 = maxHp(s), atk0 = attack(s);
    const k = placementKit(s, 3, 1, 25)!;
    expect(k.tier).toBe(PLACE_KIT_TIER);
    expect(s.gearKills!['3']).toBeGreaterThanOrEqual(360);
    expect(itemTier(s.equipped.pen, 3)).toBe(3);
    expect(itemTier(s.equipped.coat, 3)).toBe(3);
    expect(attack(s)).toBeGreaterThan(atk0 * 1.5);
    expect(maxHp(s)).toBeGreaterThan(hp0 * 1.2);
    expect(s.gold).toBeGreaterThan(3000);
    expect(count(s, 'tablet')).toBe(3);
    expect(placementKit(s, 3, 1, 25)).toBeNull();
  });
  it('keeps better pieces and more shards', () => {
    const s = newGame('T', 'student');
    s.level = 25; s.region = 3; s.gearKills = { '3': 2000 };
    s.equipped.pen = { ...(s.equipped.pen ?? ({} as never)), slot: 'pen', tier: 6, region: 3 } as never;
    placementKit(s, 3, 1, 25);
    expect(s.gearKills['3']).toBe(2000);
    expect(itemTier(s.equipped.pen, 3)).toBe(6);
  });
  it('backfills old placed saves once, not unplaced ones', () => {
    const s = newGame('T', 'student');
    expect(backfillPlacementKit(s)).toBeNull();
    s.level = 25; s.placement = { at: 0, level: 25, top: 2, checks: {} };
    expect(backfillPlacementKit(s)?.tier).toBe(3);
    expect(backfillPlacementKit(s)).toBeNull();
  });
});
