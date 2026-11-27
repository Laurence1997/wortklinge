import { describe, expect, it } from 'vitest';
import { fullForm, fullFormLong, WORD_BY_ID, WORDS } from '../src/data/words';
import { gradeTyped } from '../src/core/grading';
import { typoOk } from '../src/core/cut';

// 反身动词 (Lucas 2026-11-27): shown with sich, typed with or without it.
describe('reflexive verbs', () => {
  it('shows sich and the preposition', () => {
    const w = WORD_BY_ID['gewoehnen'];
    expect(fullForm(w)).toBe('sich gewöhnen');
    expect(fullFormLong(w)).toBe('sich gewöhnen（an + Akk）');
    expect(fullForm(WORD_BY_ID['fuehlen'])).toBe('(sich) fühlen');
    expect(fullFormLong(WORD_BY_ID['merken'])).toContain('第三格');
  });
  it('keeps ids and the bare verb', () => {
    expect(WORD_BY_ID['gewoehnen'].de).toBe('gewöhnen');
    expect(WORDS.filter((w) => w.refl).length).toBeGreaterThan(100);
    expect(WORDS.every((w) => !w.refl || w.pos === 'v')).toBe(true);
  });
  it('accepts with or without sich', () => {
    const w = WORD_BY_ID['gewoehnen'];
    expect(gradeTyped('gewöhnen', w, false).ok).toBe(true);
    expect(gradeTyped('gewöhnen', w, false).notes).toContain('完整说法：sich gewöhnen');
    expect(gradeTyped('sich gewöhnen', w, false)).toEqual({ ok: true, notes: [], correct: 'sich gewöhnen' });
    expect(gradeTyped('sich gewoehnen', w, false).ok).toBe(true);
    expect(gradeTyped('gewohnt', w, false).ok).toBe(false);
    expect(gradeTyped('fühlen', WORD_BY_ID['fuehlen'], false).notes).toEqual([]);
    expect(typoOk('sich gewöhmen', w, false)).toBe(true);
  });
  it('leaves other verbs alone', () => {
    expect(fullForm(WORD_BY_ID['gehen'])).toBe('gehen');
    expect(gradeTyped('sich gehen', WORD_BY_ID['gehen'], false).ok).toBe(false);
  });
});
