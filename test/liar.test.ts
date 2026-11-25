import { describe, expect, it } from 'vitest';
import { newGame } from '../src/core/state';
import { WORDS } from '../src/data/words';
import { ITEM_TURN, resolveTurn, startBattle } from '../src/core/combat';
import { makeRng } from '../src/core/rng';
import { announces, insightOptions, LIAR_LINES, TELL_ZH, TRUTH_ZH } from '../src/core/liar';

// 会说谎的怪 (游戏设计 四, 暂定).
describe('会说谎的怪', () => {
  it('every lie has a tell, every truth none; lies are about half the library', () => {
    const lies = LIAR_LINES.filter((l) => l.tell);
    expect(lies.length).toBeGreaterThan(LIAR_LINES.length / 3);
    for (const l of lies) {
      if (l.tell === 'k2') expect(/\b(würde|hätte|wäre)\b/.test(l.de)).toBe(true);
      if (l.tell === 'angeblich') expect(/angeblich|soll ja|sagen sie/i.test(l.de)).toBe(true);
      if (l.tell === 'contra') expect(l.de.split('. ').length).toBeGreaterThan(1);
    }
    for (const l of LIAR_LINES.filter((x) => !x.tell)) expect(/\b(würde|hätte|wäre|angeblich)\b/.test(l.de)).toBe(false);
  });

  it('洞察 offers 3 readings including the right one (and the truth when it lies)', () => {
    const rng = makeRng(3);
    for (const l of LIAR_LINES) {
      const o = insightOptions(l, rng);
      expect(o.options).toHaveLength(3);
      expect(new Set(o.options).size).toBe(3);
      expect(o.options).toContain(o.answer);
      expect(o.answer).toBe(l.tell ? TELL_ZH[l.tell] : TRUTH_ZH);
      if (l.tell) expect(o.options).toContain(TRUTH_ZH);
    }
  });

  it('announces on turns 3, 6, …; a seen-through move misses', () => {
    expect([1, 2, 3, 4, 6].map(announces)).toEqual([false, false, true, false, true]);
    const s = newGame('T', 'student');
    s.level = 151;
    const w = WORDS.find((x) => x.pos === 'n' && x.art)!;
    s.words[w.id] = { stage: 2, due: Date.now() + 9e9, firstSeen: 1, lastSeen: 1, relapse: 0, correct: 2, wrong: 0, read: 1 } as never;
    let b = startBattle(s, w, makeRng(1));
    for (let seed = 2; !b.liar && seed < 200; seed++) b = startBattle(s, w, makeRng(seed));
    expect(b.liar).toBeTruthy();
    b.intent = { ...b.intent, kind: 'attack', hits: 1 };
    b.liar!.dodge = true;
    const hp = s.hp;
    const r = resolveTurn(s, b, 'item', ITEM_TURN, '', makeRng(1));
    expect(r.monsterDamage).toBe(0);
    expect(s.hp).toBe(hp);
  });
});
