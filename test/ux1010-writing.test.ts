import { describe, expect, it } from 'vitest';
import { gradeLines } from '../src/core/aiVerdict';
import { newGame } from '../src/core/state';
import { recordKill, reviewedByWriting, writingCounts } from '../src/core/srs';
import { WORD_BY_ID } from '../src/data/words';
import type { AiGrade } from '../src/net/aiTutor';

const g = (x: Partial<AiGrade>): AiGrade => ({ ok: false, step: 'ai', errors: [], better: '', ...x });

describe('ux 1.0.10 writing: AI verdict lines', () => {
  it('never returns an empty list or a line without text', () => {
    for (const r of [g({}), g({ errors: [{ bad: '', fix: '', why: '' }] }), g({ errors: [null as never, { bad: '' } as never] })]) {
      const lines = gradeLines(r, 'Ich gehe.');
      expect(lines.length).toBeGreaterThan(0);
      for (const l of lines) expect(typeof l.text).toBe('string');
    }
    expect(gradeLines(g({ errors: [{ bad: 'gehe', why: '' } as never] }))[0].text).toBe('「gehe」');
  });

  it('drops a rewrite that only echoes the player', () => {
    expect(gradeLines(g({ ok: true, better: 'Ich gehe nach Hause' }), 'Ich gehe nach Hause.')[0].text).toBe('写得对。');
    expect(gradeLines(g({ ok: true, better: 'Ich gehe nach Hause.' }), 'ich gehe nach hause')[0].text).toBe('写得对。更自然的说法：Ich gehe nach Hause.');
    expect(gradeLines(g({ ok: true, better: 'Ich gehe heim.' }), 'Ich gehe nach Hause.')[0].text).toBe('写得对。更自然的说法：Ich gehe heim.');
  });

  it('marks errors on an ok verdict as minor, and takes another ok word', () => {
    const lines = gradeLines(g({ ok: true, errors: [{ bad: 'a', fix: 'b', why: 'c' }], better: 'X.' }), 'Y.');
    expect(lines.map((l) => l.text)).toEqual(['小问题：「a」→「b」：c', '更好的写法：X.']);
    expect(gradeLines(g({ ok: false, errors: [{ bad: 'a', fix: 'b', why: 'c' }], better: 'X.' }), 'Y.').map((l) => l.text)).toEqual(['「a」→「b」：c', '改好的：X.']);
    expect(gradeLines(g({ ok: true }), '', '语法没问题')[0].text).toBe('语法没问题。');
  });
});

describe('ux 1.0.10 writing: reviewedByWriting reports credit', () => {
  it('a 半名 word gets no credit, a 归名 word does', () => {
    const s = newGame('t', 'x');
    const w = WORD_BY_ID['tee'];
    expect(reviewedByWriting(s, w)).toBe(false); // never seen
    recordKill(s, w, false, false, Date.now());
    s.words[w.id].stage = 2;
    expect(writingCounts(s, w)).toBe(false);
    expect(reviewedByWriting(s, w)).toBe(false);
    s.words[w.id].stage = 3;
    delete s.words[w.id].ctxDone;
    expect(writingCounts(s, w)).toBe(true);
    expect(reviewedByWriting(s, w)).toBe(true);
  });
});
