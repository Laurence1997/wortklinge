import { describe, expect, it } from 'vitest';
import { newGame } from '../src/core/state';
import { makeRng } from '../src/core/rng';
import { ADV, adventurerById, adventurersOf, gradePk, notePkPaid, noteAnswer, pkPaidLeft, pkQuestion, pkWords, rivalFor } from '../src/core/adventurers';
import { WORDS } from '../src/data/words';

// 游荡的冒险者 (游戏设计 六, Lucas 2026-11-25).
describe('冒险者', () => {
  it('2–3 per region, fixed between calls, unique ids, found by id', () => {
    for (let r = 1; r <= 20; r++) {
      const a = adventurersOf(r);
      expect(a.length).toBeGreaterThanOrEqual(2);
      expect(a.length).toBeLessThanOrEqual(3);
      expect(adventurersOf(r).map((x) => x.name)).toEqual(a.map((x) => x.name));
      for (const x of a) {
        expect(x.name).toMatch(/^[A-Za-zÄÖÜäöüß]+$/);
        expect(adventurerById(x.id)?.name).toBe(x.name);
      }
    }
    const ids = Array.from({ length: 20 }, (_, i) => adventurersOf(i + 1).map((x) => x.id)).flat();
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('rival accuracy follows the player within 60–90%, time within ×0.9–1.2', () => {
    const s = newGame('T', 'student');
    const rng = makeRng(3);
    for (let i = 0; i < 20; i++) noteAnswer(s, 'pick', true, 2000);
    for (let i = 0; i < 50; i++) {
      const r = rivalFor(s, 'pick', rng);
      expect(r.acc).toBeLessThanOrEqual(ADV.accHi);
      expect(r.acc).toBeGreaterThanOrEqual(ADV.accLo);
      expect(r.ms).toBeGreaterThanOrEqual(1800);
      expect(r.ms).toBeLessThanOrEqual(2400);
    }
    const t = newGame('T', 'student');
    for (let i = 0; i < 20; i++) noteAnswer(t, 'typed', false, 5000);
    expect(rivalFor(t, 'typed', rng).acc).toBe(ADV.accLo);
    expect(rivalFor(t, 'gram', rng).ms).toBeGreaterThan(0);
    noteAnswer(t, 'pick', true, 999_999);
    expect(t.recentAns!.filter((x) => x.k === 'pick')).toHaveLength(0);
  });

  it('PK needs 4 known words of the region; questions grade by rule', () => {
    const s = newGame('T', 'student');
    s.level = 12;
    const rng = makeRng(7);
    expect(pkQuestion(s, 1, rng)).toBeNull();
    for (const w of WORDS.filter((x) => (x.region ?? 1) === 1 && x.pos !== 'phr').slice(0, 30)) s.words[w.id] = { ...(s.words[w.id] ?? {}), stage: 3 } as never;
    expect(pkWords(s, 1).length).toBeGreaterThanOrEqual(4);
    for (let i = 0; i < 40; i++) {
      const q = pkQuestion(s, 1, rng)!;
      expect(q).not.toBeNull();
      if (q.options) expect(q.options).toContain(q.answer);
      expect(gradePk(q, q.answer)).toBe(true);
      expect(gradePk(q, 'zzz')).toBe(false);
    }
  });

  it('5 paid PKs a day', () => {
    const s = newGame('T', 'student');
    expect(pkPaidLeft(s)).toBe(ADV.pkPaid);
    for (let i = 0; i < ADV.pkPaid; i++) expect(notePkPaid(s)).toBe(true);
    expect(notePkPaid(s)).toBe(false);
    expect(pkPaidLeft(s)).toBe(0);
  });
});

// 固定角色 (Lucas 2026-11-26): every adventurer and scene NPC has its own drawn figure; no name is used twice.
describe('冒险者固定角色', async () => {
  const { CAST } = await import('../src/data/cast');
  const { NPC_ART } = await import('../src/data/npcArt');
  it('each cast member has a figure, names are unique and not a named NPC', () => {
    const names = CAST.map((c) => c.name);
    expect(new Set(names).size).toBe(names.length);
    for (const n of names) {
      expect(NPC_ART[n]?.split('/')).toHaveLength(16);
      expect(['Hilde', 'Greta', 'Mira', 'Konrad', 'Brandt', 'Weber', 'Lina', 'Jonas', 'Mia']).not.toContain(n);
    }
    const figs = Object.values(NPC_ART);
    expect(new Set(figs).size).toBeGreaterThanOrEqual(figs.length - 1); // Vermieter = Herr Brandl
  });
  it('蚀变 segments have their own survivors', () => {
    for (const seg of [8, 11, 15, 19]) expect(adventurersOf(seg, true).length).toBeGreaterThanOrEqual(2);
  });
});
