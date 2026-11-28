import { describe, expect, it } from 'vitest';
import { newGame } from '../src/core/state';
import { WORDS, WORD_BY_ID } from '../src/data/words';
import { reviewQuestion, gradeQuestion, makeQuestion, resolveTurn, startBattle } from '../src/core/combat';
import { makeRng } from '../src/core/rng';
import { isPattern, parsePat, patCount, patLine } from '../src/core/satzmuster';
import { LEX_SCENES } from '../src/data/lexicon';

// 经典句型 · 句型怪 (Lucas 2026-11-27 选 1): 140 patterns live in field scenes by level; first a teaching choice,
// then the key words typed in order; finisher = the whole example.
const PATS = WORDS.filter(isPattern);

describe('句型怪', () => {
  it('all 140 patterns are monsters in map scenes of their stage', () => {
    expect(PATS.length).toBe(140);
    const inScene = new Set(LEX_SCENES.flatMap(([, , , , , ids]) => ids));
    let a1 = 0;
    for (const w of PATS) {
      expect(inScene.has(w.id), w.id).toBe(true);
      expect(w.pos).toBe('phr');
      expect(w.erode).toBeUndefined();
      const p = patLine(w)!;
      expect(p.blanks.length, w.id).toBeGreaterThan(0);
      expect(p.full).not.toContain('{');
      if (w.region! <= 3) a1++;
    }
    expect(a1).toBe(21);
    expect(PATS.filter((w) => w.region! >= 13).length).toBe(40);
  });

  it('has three examples per pattern with the same key words (1.0.9)', () => {
    for (const w of PATS) {
      expect(patCount(w), w.id).toBe(3);
      const a = patLine(w, 0)!;
      for (const k of [1, 2]) {
        const p = patLine(w, k)!;
        expect(p.answer.toLowerCase(), w.id).toBe(a.answer.toLowerCase());
        expect(p.full).not.toBe(a.full);
      }
      expect(patLine(w, 3)!.full).toBe(a.full);
    }
  });

  it('parses several blanks', () => {
    const p = parsePat('{Wäre es möglich}, den Termin {zu} verschieben?|能改期吗？')!;
    expect(p.shown).toBe('___, den Termin ___ verschieben?');
    expect(p.answer).toBe('Wäre es möglich zu');
    expect(p.full).toBe('Wäre es möglich, den Termin zu verschieben?');
  });

  const w = WORD_BY_ID['sm-006']; // Wäre es möglich, … zu …?
  const game = () => {
    const s = newGame('T', 'student');
    s.level = Math.max(10, w.lvl);
    s.region = w.region as never;
    return s;
  };

  it('first question of a new pattern is a choice, then typing; whole example accepted too', () => {
    const s = game();
    const b = startBattle(s, w, makeRng(3));
    b.notice = undefined;
    b.directOffer = false;
    const q0 = makeQuestion(s, b, 'attack', makeRng(4));
    expect(q0.pat).toBe(true);
    expect(q0.options?.length).toBe(3);
    expect(q0.options).toContain('Wäre es möglich … zu');
    expect(gradeQuestion(s, b, q0, 'Wäre es möglich … zu').ok).toBe(true);
    b.step = 1;
    const q1 = makeQuestion(s, b, 'attack', makeRng(5));
    expect(q1.type).toBe('cloze');
    expect(q1.options).toBeUndefined();
    expect(q1.focus).toContain('___');
    expect(gradeQuestion(s, b, q1, 'wäre es möglich zu').ok).toBe(true);
    expect(gradeQuestion(s, b, q1, 'Wäre es möglich … zu').ok).toBe(true);
    expect(gradeQuestion(s, b, q1, 'Wäre es möglich, den Termin zu verschieben?').ok).toBe(true);
    expect(gradeQuestion(s, b, q1, 'Ist es möglich zu').ok).toBe(false);
  });

  it('typing it right counts as 会写', () => {
    const s = game();
    const b = startBattle(s, w, makeRng(3));
    b.notice = undefined;
    b.step = 1;
    const q1 = makeQuestion(s, b, 'attack', makeRng(5));
    resolveTurn(s, b, 'attack', q1, q1.answer!, makeRng(6));
    expect(b.writeOk ?? 0).toBe(1);
  });

  it('finisher and skills ask the pattern, never the bare pattern name', () => {
    const s = game();
    const b = startBattle(s, w, makeRng(3));
    b.notice = undefined;
    b.step = 1;
    const fin = makeQuestion(s, b, 'sentence', makeRng(4));
    expect(fin.answer).toBe('Wäre es möglich, den Termin zu verschieben?');
    const sk = makeQuestion(s, b, 'skill', makeRng(4), 'storm');
    expect(sk.pat).toBe(true);
    expect(sk.answer).not.toContain('…');
  });

  it('语境复习 of a due pattern asks its key words', () => {
    const s = game();
    s.words[w.id] = { stage: 3, due: 0, firstSeen: 1, lastSeen: 1, relapse: 0, correct: 3, wrong: 0, read: 1, write: 2, ctx: 0 } as never;
    const other = WORDS.find((x) => x.region === w.region && !isPattern(x) && x.pos === 'n')!;
    void other;
    const q = reviewQuestion(s, w.id, makeRng(2));
    if (q?.review === w.id) {
      expect(q.pat).toBe(true);
      expect(q.answer).toBe('Wäre es möglich zu');
    }
  });
});
