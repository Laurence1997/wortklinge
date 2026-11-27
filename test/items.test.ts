import { describe, expect, it } from 'vitest';
import { maxHp, newGame } from '../src/core/state';
import { makeRng } from '../src/core/rng';
import { WORDS } from '../src/data/words';
import { availableMoves, canHint, hintOf, ITEM_TURN, makeQuestion, resolveTurn, startBattle } from '../src/core/combat';
import { addItem, bonfireRefill, buyConsumable, cap, count, grantStarter, itemPrice, rollItemDrops } from '../src/core/items';
import { CONFIG } from '../src/core/config';

const noun = () => WORDS.find((x) => x.art && x.pos === 'n' && !x.tutorial && !x.plOnly)!;

describe('2026-11-22 精简出手按钮：低语是答题时的提示', () => {
  it('低语 is not on the move bar any more; the finisher still is', () => {
    const s = newGame('T', 'student');
    s.level = 12;
    const b = startBattle(s, noun(), makeRng(1));
    const moves = availableMoves(s, b);
    expect(moves).not.toContain('whisper');
    expect(moves).toContain('attack');
    expect(moves).toContain('sentence');
  });

  it('a hint is the same question, hinted, and needs a 纸条', () => {
    const s = newGame('T', 'student');
    s.level = 12;
    grantStarter(s);
    const b = startBattle(s, noun(), makeRng(1));
    const q = makeQuestion(s, b, 'attack', makeRng(2));
    expect(canHint(s, b, 'attack', q)).toBe(true);
    const hq = hintOf(b, q);
    expect(hq.whispered).toBe(true);
    expect(hq.focus).toBe(q.focus);
    expect(canHint(s, b, 'attack', hq)).toBe(false); // once per question
    expect(canHint(s, b, 'inscribe', q)).toBe(false); // not on a 铭刻 question
    s.flags.invHint = 0;
    expect(canHint(s, b, 'attack', q)).toBe(false);
  });

  it('a hinted answer keeps its costs: no resource, the word is flagged', () => {
    const s = newGame('T', 'student');
    s.level = 12;
    grantStarter(s);
    const w = noun();
    const b = startBattle(s, w, makeRng(1));
    b.phase = w.art as never;
    const res0 = b.cfx.res;
    const q = hintOf(b, makeQuestion(s, b, 'attack', makeRng(2)));
    resolveTurn(s, b, 'whisper', q, q.answer ?? '', makeRng(3));
    expect(b.cfx.res).toBeLessThanOrEqual(res0 + 2); // only a right stance can add (affinity), never the question
    expect(b.hinted).toBe(true);
  });
});

describe('2026-11-22 物品栏：低语纸条和药片', () => {
  it('starter stack once at Lv4, caps, bonfire tops 纸条 up to 3 only', () => {
    const s = newGame('T', 'student');
    s.level = 3;
    expect(grantStarter(s)).toBe(false);
    s.level = 4;
    expect(grantStarter(s)).toBe(true);
    expect(grantStarter(s)).toBe(false);
    expect(count(s, 'hint')).toBe(CONFIG.items.hintStart);
    expect(count(s, 'tablet')).toBe(CONFIG.items.tabletStart);
    s.flags.invHint = 1;
    expect(bonfireRefill(s)).toBe(2);
    expect(count(s, 'hint')).toBe(3);
    addItem(s, 'hint', 10);
    expect(count(s, 'hint')).toBe(cap(s, 'hint'));
    expect(bonfireRefill(s)).toBe(0);
    expect(count(s, 'hint')).toBe(5);
    addItem(s, 'tablet', 10);
    expect(count(s, 'tablet')).toBe(3);
  });

  it('drops only once the bar is open', () => {
    const s = newGame('T', 'student');
    s.level = 2;
    expect(rollItemDrops(s, () => 0)).toEqual([]);
    s.level = 6;
    expect(rollItemDrops(s, () => 0)).toEqual(['hint', 'tablet']);
    expect(rollItemDrops(s, () => 0.99)).toEqual([]);
  });

  it('buying is a click; the German sentence is optional and 10% off (1.0.10)', () => {
    const s = newGame('T', 'student');
    s.level = 8;
    s.gold = 0;
    expect(buyConsumable(s, 'tablet')).toMatchObject({ ok: false, reason: 'gold' });
    s.gold = 10_000;
    expect(buyConsumable(s, 'tablet')).toMatchObject({ ok: true, said: false, paid: itemPrice(s, 'tablet') });
    expect(s.gold).toBe(10_000 - itemPrice(s, 'tablet'));
    expect(buyConsumable(s, 'hint', 'Ich nehme ein Zettel')).toMatchObject({ ok: false, reason: 'sentence' });
    const g = s.gold;
    const r = buyConsumable(s, 'tablet', 'ich nehme eine tablette');
    expect(r).toMatchObject({ ok: true, said: true });
    expect(g - s.gold).toBe(Math.max(1, Math.round(itemPrice(s, 'tablet') * 0.9)));
    expect(count(s, 'tablet')).toBe(2);
  });

  it('a 药片 turn asks nothing: the monster acts, combo and the word are untouched', () => {
    const s = newGame('T', 'student');
    s.level = 10;
    const w = noun();
    const b = startBattle(s, w, makeRng(1));
    b.intent = { ...b.intent, kind: 'attack', hits: 1 };
    s.combo = 7;
    s.hp = maxHp(s);
    const hp0 = b.monster.hp;
    const step0 = b.step;
    const r = resolveTurn(s, b, 'item', ITEM_TURN, '', makeRng(4));
    expect(r.playerDamage).toBe(0);
    expect(b.monster.hp).toBe(hp0);
    expect(r.monsterDamage).toBeGreaterThan(0);
    expect(s.hp).toBeLessThan(maxHp(s));
    expect(s.combo).toBe(7);
    expect(b.step).toBe(step0);
    expect(r.readRight).toBe(false);
  });
});
