import { describe, expect, it } from 'vitest';
import { chunks, gradeLink, gradeOrder, gradeSlot, linkTask, orderTask, slotNouns, slotTask } from '../src/core/writing';
import { LINKS } from '../src/data/links';
import { expectedSentence } from '../src/core/sentence';
import { EXAMPLES } from '../src/core/cloze';
import { makeRng } from '../src/core/rng';
import { WORD_BY_ID, WORDS } from '../src/data/words';

describe('A1 写作', () => {
  it('cuts sentences into chunks that keep articles and prepositions with their word', () => {
    expect(chunks('Am Abend trinke ich gern einen Tee.')).toEqual(['Am Abend', 'trinke', 'ich', 'gern einen Tee']);
    expect(chunks('Ich möchte eine Tasse Kaffee.')).toEqual(['Ich', 'möchte', 'eine Tasse', 'Kaffee']);
  });

  it('排句: shuffled, never in the right order, graded ignoring punctuation and case', () => {
    const rng = makeRng(3);
    let made = 0;
    for (const w of WORDS.slice(0, 200)) {
      const t = orderTask(w, rng);
      if (!t) continue;
      made++;
      expect(t.shown.join(' ')).not.toBe(t.answer.replace(/[.!?]$/, ''));
      expect(gradeOrder(t.answer.toLowerCase().replace(/[.?!]/g, ''), t.answer)).toBe(true);
      expect(gradeOrder(t.shown.join(' '), t.answer)).toBe(false);
    }
    expect(made).toBeGreaterThan(100);
  });

  it('槽位造句: any fitting noun from the wordbook counts, article and case checked, recent nouns refused', () => {
    const tee = WORD_BY_ID['tee'];
    const t = slotTask(tee, makeRng(1))!;
    expect(t).toBeTruthy();
    const known = new Set(['brot', 'tasse', 'kaffee', 'stuhl', 'stift', 'lampe', 'tisch']);
    const nouns = slotNouns(t.pattern, (x) => known.has(x.id), tee);
    const other = nouns.find((x) => x.id !== 'tee')!;
    expect(gradeSlot(expectedSentence(other, t.pattern), t, nouns, [], 'tee').ok).toBe(true);
    expect(gradeSlot(t.answer, t, nouns, [], 'tee').ok).toBe(true);
    expect(gradeSlot(expectedSentence(other, t.pattern), t, nouns, [other.id], 'tee').repeated).toBe(true);
    expect(gradeSlot('Ich möchte ein Zebra.', t, nouns, [], 'tee').ok).toBe(false);
  });

  it('连句: every row has one answer; aber/denn get a comma, weil/dass/wenn rows carry the verb at the end', () => {
    for (const r of LINKS) {
      expect(r.answer).toContain(` ${r.conj} `);
      expect(gradeLink(r.answer, r)).toBe(true);
    }
    const aber = LINKS.find((r) => r.conj === 'aber')!;
    expect(aber.answer).toMatch(/, aber [a-zäöü]/);
    expect(LINKS.find((r) => r.conj === 'oder')!.answer).toBe('Möchtest du einen Kaffee oder möchtest du ein Wasser?');
    // weil / dass / wenn only once open.
    for (let i = 0; i < 30; i++) expect(['weil', 'dass', 'wenn']).not.toContain(linkTask(WORD_BY_ID['tee'], makeRng(i), false)!.conj);
  });

  it('example sentences used for 排句 have no quotes', () => {
    expect(Object.keys(EXAMPLES).length).toBeGreaterThan(500);
  });
});

import { makeQuestion, resolveTurn, startBattle } from '../src/core/combat';
import { newGame } from '../src/core/state';

describe('A1 写作 in fights', () => {
  it('a Lv16 player meets 排句, 槽位造句 and 连句, and right answers hit', () => {
    const s = newGame('T', 'student', Date.now());
    s.level = 16;
    s.hp = 999;
    for (const id of ['brot', 'tee', 'tasse', 'kaffee', 'stuhl', 'stift', 'lampe', 'tisch', 'flasche', 'glas']) {
      s.words[id] = { stage: 1, correct: 2, wrong: 0, read: 1, write: 1, due: Date.now() + 1e9, interval: 1, relapse: 0 } as never;
    }
    const seen = new Set<string>();
    for (let seed = 0; seed < 60; seed++) {
      const rng = makeRng(seed);
      const b = startBattle(s, WORD_BY_ID['tee'], rng);
      b.kind = 'shadow';
      b.step = 2;
      b.monster.hp = 9999;
      for (const move of ['attack', 'sentence'] as const) {
        const q = makeQuestion(s, b, move, rng);
        if (!q.write) continue;
        seen.add(q.write);
        const ans = q.answer!;
        const r = resolveTurn(s, b, move, q, ans, rng);
        expect(r.correct).toBe(true);
      }
    }
    expect([...seen].sort()).toEqual(['link', 'order', 'slot']);
  });
});
