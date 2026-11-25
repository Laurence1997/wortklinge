import { describe, expect, it } from 'vitest';
import { newGame } from '../src/core/state';
import { makeRng } from '../src/core/rng';
import { resetOldTree, talentPoints, TALENT_TREE } from '../src/core/classes';
import { carriesShout, combatSkills, loadout, owned, toggleLoadout } from '../src/core/skillPool';
import { equippedCharms, grantSlang } from '../src/core/charms';
import { bossRed, rollSetDrop, FORGE } from '../src/core/forge';
import { speedCrit } from '../src/core/combat';

// 系统瘦身 (Lucas 2026-11-25).
describe('系统瘦身', () => {
  it('40 nodes, 15 to fill a branch; old trees get their points back once', () => {
    expect(TALENT_TREE).toHaveLength(40);
    for (const br of ['bifeng', 'shoushi', 'yanci', 'zhixu', 'xunjie']) expect(TALENT_TREE.filter((t) => t.branch === br).reduce((a, t) => a + t.max, 0)).toBe(15);
    const s = newGame('T', 'student');
    s.level = 120;
    expect(talentPoints(s)).toBe(40);
    (s.talents as Record<string, Record<string, number>>).shared = { bifeng: 3, mochong: 1 };
    expect(resetOldTree(s)).toBe(true);
    expect((s.talents as Record<string, Record<string, number>>).shared).toEqual({});
    (s.talents as Record<string, Record<string, number>>).shared = { bifeng: 1 };
    expect(resetOldTree(s)).toBe(false);
  });

  it('短句 / 俚语 are pool skills: free before 10, then they take a slot; not in the skill move', () => {
    const s = newGame('T', 'student');
    s.level = 5;
    s.sayings = { sicher: 1 };
    expect(carriesShout(s).saying).toBe(true);
    expect(equippedCharms(s, carriesShout(s)).map((c) => c.id)).toEqual(['sicher']);
    s.level = 50;
    grantSlang(s, 'bock');
    expect(owned(s)).toContain('saying');
    expect(owned(s)).toContain('slang');
    s.loadout = ['storm', 'slang'];
    expect(loadout(s)).toEqual(['storm', 'slang']);
    expect(combatSkills(s)).toEqual(['storm']);
    expect(equippedCharms(s, carriesShout(s)).map((c) => c.id)).toEqual(['bock']);
    expect(toggleLoadout(s, 'saying')).toBe(true);
    expect(carriesShout(s)).toEqual({ saying: true, slang: true });
  });

  it('set pieces drop from 101; the top tier (old red) is a set piece of the region', () => {
    const s = newGame('T', 'student');
    s.level = 100;
    expect(rollSetDrop(s, 1, () => 0)).toBeNull();
    s.level = 101;
    expect(rollSetDrop(s, 1, () => 0)?.set).toBe(1);
    expect(rollSetDrop(s, 1, () => FORGE.setKill + 0.001)).toBeNull();
    s.level = 111;
    const r = bossRed(s, makeRng(1), {});
    s.forge = { redPity: FORGE.redPity - 1 };
    const top = bossRed(s, () => 0.99);
    expect(top?.quality).toBe('red');
    expect(top?.set).toBe(s.region ?? 1);
    expect(r === null || r.set !== undefined).toBe(true);
  });

  it('速答暴击: inside the first half of the quick line; 抢答 widens it', () => {
    const s = newGame('T', 'student');
    s.level = 40;
    const q = { type: 'pickDe', prompt: '', focus: '', options: ['a', 'b'], answer: 'a', ms: 1100 } as never;
    expect(speedCrit(s, q)).toBe(false);
    (s.talents as Record<string, Record<string, number>>).shared = { qiangda: 1 };
    expect(speedCrit(s, q)).toBe(true);
    expect(speedCrit(s, { ...(q as object), ms: 900 } as never)).toBe(true);
  });
});
