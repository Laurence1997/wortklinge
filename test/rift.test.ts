import { describe, expect, it } from 'vitest';
import { attack, critChance, maxHp, newGame } from '../src/core/state';
import { makeRng } from '../src/core/rng';
import { makeItem } from '../src/core/loot';
import { WORDS } from '../src/data/words';
import { addItem, count, useItem } from '../src/core/items';
import { bossFloor, canDescend, descend, endRift, offerBlessings, RIFT, riftAct, riftItemLevel, riftWord, silenceLeft, startRift, takeBlessing } from '../src/core/rift';

// 裂隙 (游戏设计 六, 0.8).
describe('裂隙', () => {
  it('白板进入: gear counts for nothing inside, blessings add, everything is back after', () => {
    const s = newGame('T', 'student');
    s.level = 95;
    s.gearKills = { '10': 99999 };
    s.region = 10 as never;
    s.equipped.pen = { ...makeItem(makeRng(1), 95, 'white', 'pen'), tier: 8, region: 10 };
    const atk0 = attack(s);
    const hp0 = maxHp(s);
    startRift(s);
    expect(attack(s)).toBeLessThan(atk0);
    const bareAtk = attack(s);
    takeBlessing(s, 'atk');
    expect(attack(s)).toBeCloseTo(bareAtk * 1.15);
    takeBlessing(s, 'crit');
    expect(critChance(s)).toBeCloseTo(0.05 + 0.08);
    endRift(s);
    expect(attack(s)).toBeCloseTo(atk0);
    expect(maxHp(s)).toBe(hp0);
  });

  it('pills: only the run’s own count inside, and they are gone after', () => {
    const s = newGame('T', 'student');
    s.level = 95;
    addItem(s, 'tablet', 2);
    startRift(s);
    expect(count(s, 'tablet')).toBe(0);
    takeBlessing(s, 'pill');
    expect(count(s, 'tablet')).toBe(2);
    expect(useItem(s, 'tablet')).toBe(true);
    expect(count(s, 'hint')).toBe(0);
    endRift(s);
    expect(count(s, 'tablet')).toBe(2);
  });

  it('静默蔓延: free inside the budget, then each action bites', () => {
    const s = newGame('T', 'student');
    s.level = 95;
    s.hp = 1000;
    startRift(s);
    for (let i = 0; i < RIFT.budget; i++) expect(riftAct(s, 1000)).toBe(0);
    expect(riftAct(s, 1000)).toBe(100);
    expect(silenceLeft(s.rift!)).toBe(-1);
  });

  it('floors: descend after one fight, boss every 5th floor, depth record and 精通 points after max level', () => {
    const s = newGame('T', 'student');
    s.level = 200;
    const r = startRift(s);
    expect(canDescend(r)).toBe(false);
    r.fightsLeft -= 1;
    expect(canDescend(r)).toBe(true);
    for (let i = 0; i < 9; i++) descend(s);
    expect(r.floor).toBe(10);
    expect(bossFloor(r)).toBe(true);
    expect(s.flags.masteryPts).toBe(1);
    expect(riftItemLevel(s, 200)).toBe(210);
    r.floor = 60;
    expect(riftItemLevel(s, 200)).toBe(230);
  });

  it('words are ones you have met; blessings offered are three different ones', () => {
    const s = newGame('T', 'student');
    s.level = 95;
    startRift(s);
    expect(riftWord(s, makeRng(1))).toBeNull();
    const w = WORDS.find((x) => x.de === 'Apfel')!;
    s.words[w.id] = { stage: 2, due: 0, firstSeen: 0, lastSeen: 0, relapse: 0, correct: 1, wrong: 0, read: 0 } as never;
    expect(riftWord(s, makeRng(1))?.id).toBe(w.id);
    const o = offerBlessings(s, makeRng(3));
    expect(new Set(o).size).toBe(3);
  });
});
