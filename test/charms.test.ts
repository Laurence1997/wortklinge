import { describe, expect, it } from 'vitest';
import { maxHp, newGame } from '../src/core/state';
import { CARDS, charmSlots, equipCharm, equippedCharms, grantSlang, shoutCharm, slangOwed, SLANG, type CharmCtx } from '../src/core/charms';

const ctx: CharmCtx = { struct: false, cursed: false, pack: false, red: false, challenge: false, elite: false, hour: 9 };

// 秘术栏 (游戏设计 九「短句卡和俚语效果表」).
describe('秘术栏', () => {
  it('every card has an effect; 1 slot from 3, 2 from 81', () => {
    expect(CARDS).toHaveLength(20);
    expect(charmSlots(2)).toBe(0);
    expect(charmSlots(3)).toBe(1);
    expect(charmSlots(81)).toBe(2);
  });

  it('only owned cards go in; a full bar swaps out the oldest', () => {
    const s = newGame('T', 'student');
    s.level = 10;
    equipCharm(s, 'sicher');
    expect(equippedCharms(s)).toHaveLength(0);
    s.sayings = { sicher: 1, klar: 1 };
    equipCharm(s, 'sicher');
    equipCharm(s, 'klar');
    expect(equippedCharms(s).map((c) => c.id)).toEqual(['klar']);
  });

  it('typed whole: the effect lands; once per fight; before 33 it takes the turn', () => {
    const s = newGame('T', 'student');
    s.level = 10;
    const fx: { charm?: import('../src/core/charms').CharmFx } = {};
    const r = shoutCharm(s, fx, 'sicher', 'sicher ist sicher', ctx);
    expect(r.ok).toBe(true);
    expect(r.turn).toBe(true);
    expect(fx.charm?.firstWrongHalf).toBe(true);
    expect(shoutCharm(s, fx, 'sicher', 'Sicher ist sicher.', ctx).ok).toBe(false);
    s.level = 33;
    expect(shoutCharm(s, {}, 'uebung', 'Übung macht den Meister', ctx).turn).toBe(false);
  });

  it('a wrong sentence does nothing; Kein Problem heals 15%', () => {
    const s = newGame('T', 'student');
    s.level = 10;
    s.hp = 1;
    expect(shoutCharm(s, {}, 'problem', 'kein problemm', ctx).ok).toBe(false);
    expect(s.hp).toBe(1);
    shoutCharm(s, {}, 'problem', 'Kein Problem', ctx);
    expect(s.hp).toBe(1 + Math.round(maxHp(s) * 0.15));
  });

  it('slang: the right situation works, the wrong one backfires; Schwein gehabt never backfires', () => {
    const s = newGame('T', 'student');
    s.level = 50;
    grantSlang(s, 'bock');
    const fx: { charm?: import('../src/core/charms').CharmFx } = {};
    const bad = shoutCharm(s, fx, 'bock', 'Kein Bock!', ctx);
    expect(bad.backfire).toBe(true);
    expect(fx.charm?.backfire).toBe(true);
    const fx2: { charm?: import('../src/core/charms').CharmFx } = {};
    shoutCharm(s, fx2, 'bock', 'Kein Bock', { ...ctx, pack: true });
    expect(fx2.charm?.dmg).toBeCloseTo(0.3);
    expect(shoutCharm(s, {}, 'schwein', 'Schwein gehabt', ctx).backfire).toBeFalsy();
    expect(s.flags.schweinNext).toBe(true);
    expect(shoutCharm(s, {}, 'wurst', 'Das ist mir Wurst', { ...ctx, cursed: true }).special).toBe('curse');
    expect(SLANG).toHaveLength(8);
  });

  it("Konrad's slang waits for 50 (补发)", () => {
    const s = newGame('T', 'student');
    s.level = 30;
    expect(slangOwed(s, (q) => q === 'konrad')).toEqual([]);
    s.level = 50;
    expect(slangOwed(s, (q) => q === 'konrad')).toEqual(['wurst']);
  });
});
