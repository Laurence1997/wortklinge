import { describe, expect, it } from 'vitest';
import { newGame } from '../src/core/state';
import { makeRng } from '../src/core/rng';
import { craftGem, fillGems, GEM, gemSum, gemValue, recarve, recarveChoices, setGem, unsetGem } from '../src/core/gems';
import { makeItem } from '../src/core/loot';
import { openChest } from '../src/core/chest';

// 言石 (游戏设计 九, 62 级, 暂定).
describe('言石', () => {
  const setup = () => {
    const s = newGame('T', 'student');
    s.level = 62;
    s.gram = { boards: ['kein'] };
    s.shardBal = { '1': 100 };
    return s;
  };
  it('crafting needs 62, a taught grammar and shards; it fires only on its grammar when worn', () => {
    const s = setup();
    expect(craftGem(s, 'mein', true, makeRng(1)).ok).toBe(false);
    const r = craftGem(s, 'kein', true, makeRng(1));
    expect(r.ok).toBe(true);
    expect(s.shardBal!['1']).toBe(100 - GEM.craftCost);
    const it = makeItem(makeRng(2), 62, 'purple', 'pen');
    s.equipped.pen = it;
    expect(setGem(s, r.gem!.id, it.id)).toBe(true);
    expect(s.gems).toHaveLength(0);
    expect(gemSum(s, 'kein', r.gem!.kind)).toBeGreaterThan(0);
    expect(gemSum(s, 'mein', r.gem!.kind)).toBe(0);
    expect(unsetGem(s, it.id).ok).toBe(true);
    expect(s.shardBal!['1']).toBe(100 - GEM.craftCost - GEM.moveCost);
    expect(s.gems).toHaveLength(1);
  });
  it('the forgotten chest holds one from 62', () => {
    const s = setup();
    expect(openChest(s, 'forgotten', 62, makeRng(3)).gem).toBeTruthy();
    s.level = 61;
    expect(openChest(s, 'forgotten', 61, makeRng(3)).gem).toBeUndefined();
  });

  it('刻满: N right answers fill it, one step stronger, free re-carve only to a grammar never filled', () => {
    const s = setup();
    s.gram = { boards: ['kein', 'mein'] };
    const g = craftGem(s, 'kein', false, makeRng(1)).gem!;
    const it = makeItem(makeRng(2), 62, 'purple', 'pen');
    s.equipped.pen = it;
    setGem(s, g.id, it.id);
    const v0 = gemValue(g);
    for (let i = 0; i < GEM.fillN - 1; i++) expect(fillGems(s, 'kein')).toHaveLength(0);
    expect(fillGems(s, 'kein')).toHaveLength(1);
    expect(gemValue(g)).toBeGreaterThan(v0);
    expect(recarveChoices(s)).toEqual(['mein']);
    expect(recarve(s, g.id, 'kein')).toBe(false);
    expect(recarve(s, g.id, 'mein')).toBe(true);
    expect(g.sys).toBe('mein');
  });
});
