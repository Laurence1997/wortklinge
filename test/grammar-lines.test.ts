import { describe, expect, it } from 'vitest';
import { WORDS } from '../src/data/words';
import { allLineTasks, LINE_GENS, LINE_LV } from '../src/core/gram/lines';
import { BOARDS } from '../src/core/gram/boards';
import { GRAM_LV, gramOpen } from '../src/core/gram/hook';
import { gradeGram, type GramSys } from '../src/core/gram/task';
import { newGame } from '../src/core/state';
import { makeRng } from '../src/core/rng';
import { startExam } from '../src/core/breakthrough';

// A2 / B1 语法线 (游戏设计 十六, 32–111).
describe('语法线 A2 / B1', () => {
  const systems = Object.keys(LINE_LV) as GramSys[];

  it('every rule has a generator, a level and a board', () => {
    expect(Object.keys(LINE_GENS).sort()).toEqual([...systems].sort());
    for (const sys of systems) {
      expect(GRAM_LV[sys]).toBe(LINE_LV[sys]);
      expect(BOARDS[sys], sys).toBeTruthy();
    }
  });

  it('each rule finds sentences, and every task is its own sentence with the answer put back', () => {
    for (const sys of systems) {
      const ts = WORDS.flatMap((w) => allLineTasks(w, sys));
      // B2 (121+) rules: the corpus is still B1, so a few sentences each until the B2 article lines come in.
      expect(ts.length, sys).toBeGreaterThan((LINE_LV[sys] ?? 0) > 120 ? 2 : 4);
      for (const t of ts) {
        if (t.focus.includes('___') && sys !== 'artSuffix') expect(t.focus.replace('___', t.answer), sys).toBe(t.full);
        if (t.options) expect(t.options, sys).toContain(t.answer);
        expect(gradeGram(t, t.answer).ok, sys).toBe(true);
      }
    }
  });

  it('two-way prepositions open at 32, je … desto at 111', () => {
    const s = newGame('T', 'student');
    s.level = 31;
    expect(gramOpen(s, 'twoway')).toBe(false);
    s.level = 32;
    expect(gramOpen(s, 'twoway')).toBe(true);
    expect(gramOpen(s, 'dblConj')).toBe(false);
    s.level = 111;
    expect(gramOpen(s, 'dblConj')).toBe(true);
  });

  it('known sentences come out right', () => {
    const find = (de: string) => WORDS.find((w) => w.de === de)!;
    const rel = WORDS.flatMap((w) => allLineTasks(w, 'relative'));
    // A comma before an article (zu-infinitive) is not a relative clause.
    expect(rel.some((t) => /Vergiss nicht, ___ Herd/.test(t.focus))).toBe(false);
    const suffix = allLineTasks(find('Ordnung'), 'artSuffix');
    expect(suffix[0].answer).toBe('die');
    const plq = WORDS.flatMap((w) => allLineTasks(w, 'plq'));
    expect(plq.some((t) => /geschlossen/.test(t.full ?? ''))).toBe(false);
  });

  it('A2 and B1 trials ask their own grammar: eight questions', () => {
    for (const stage of ['A2', 'B1'] as const) {
      const s = newGame('T', 'student');
      s.level = stage === 'A2' ? 80 : 120;
      const e = startExam(s, makeRng(5), stage);
      const g = e.qs.filter((q) => q.part === 'grammar');
      expect(g.length, stage).toBe(8);
    }
  });
});
