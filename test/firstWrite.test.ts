import { describe, expect, it } from 'vitest';
import { newGame } from '../src/core/state';
import { WORDS, WORD_BY_ID } from '../src/data/words';
import { makeQuestion, resolveTurn, startBattle } from '../src/core/combat';
import { makeRng } from '../src/core/rng';

// 先认后写 (Lucas 2026-11-27): one choice question teaches a new word, the next one writes it, and it cannot die
// in its first fight before it was written once.
const WRITE = new Set(['typed', 'cloze', 'conj', 'plural', 'sentence']);

describe('先认后写', () => {
  const words = WORDS.filter((w) => (w.region ?? 99) <= 3 && !w.tutorial && w.pos !== 'phr').slice(0, 60);

  it('step 0 is one teaching choice (word, meaning, sound); step 1 is written (Lv2+)', () => {
    let n = 0;
    for (const w of words) {
      const s = newGame('T', 'student');
      s.level = 4;
      const b = startBattle(s, w, makeRng(3));
      if (b.kind !== 'new' || b.elite || b.pluralMon || b.phrase || b.saying) continue;
      b.directOffer = false;
      if (b.phase === undefined) b.phase = (w.art as never) ?? undefined;
      const q0 = makeQuestion(s, b, 'attack', makeRng(4));
      if (q0.type === 'saying') continue;
      expect(q0.options?.length, `${w.de} ${q0.type}`).toBeGreaterThan(0);
      expect(q0.teach?.zh).toBeTruthy();
      b.step = 1;
      const q1 = makeQuestion(s, b, 'attack', makeRng(5));
      expect(WRITE.has(q1.type), `${w.de}: ${q1.type}`).toBe(true);
      expect(q1.clozeMode).not.toBe('pick');
      expect(q1.firstWrite).toBe(true);
      n++;
    }
    expect(n).toBeGreaterThan(20);
  });

  it('Lv1 (typing closed) keeps choices and no gate', () => {
    const s = newGame('T', 'student');
    s.level = 1;
    const b = startBattle(s, WORD_BY_ID['tee'], makeRng(1));
    b.step = 1;
    expect(makeQuestion(s, b, 'attack', makeRng(2)).firstWrite).toBeUndefined();
  });

  it('a choice answer that would kill leaves it at 1 HP; the next question is written and finishes it', () => {
    const s = newGame('T', 'student');
    s.level = 4;
    const w = WORDS.find((x) => x.region === 1 && x.pos === 'v' && !x.tutorial)!;
    const b = startBattle(s, w, makeRng(7));
    b.directOffer = false;
    b.monster.hp = 1;
    const q0 = makeQuestion(s, b, 'attack', makeRng(8));
    expect(q0.options).toBeTruthy();
    resolveTurn(s, b, 'attack', q0, q0.answer!, makeRng(9));
    expect(b.outcome).toBeFalsy();
    expect(b.monster.hp).toBe(1);
    expect(b.mustWrite).toBe(true);
    s.hp = 999;
    const q1 = makeQuestion(s, b, 'attack', makeRng(10));
    expect(q1.firstWrite).toBe(true);
    expect(q1.prompt).toContain('只剩一口气');
    // Two misses: first letter, then the whole word to copy.
    resolveTurn(s, b, 'attack', q1, 'zzz', makeRng(11));
    const q2 = makeQuestion(s, b, 'attack', makeRng(12));
    expect(q2.whisper).toBeTruthy();
    resolveTurn(s, b, 'attack', q2, 'zzz', makeRng(13));
    const q3 = makeQuestion(s, b, 'attack', makeRng(14));
    expect(q3.whisper).toBe(q3.answer);
    resolveTurn(s, b, 'attack', q3, q3.answer!, makeRng(15));
    expect(b.outcome).toBe('win');
  });

  it('a word met before is not gated', () => {
    const s = newGame('T', 'student');
    s.level = 4;
    const w = WORD_BY_ID['tee'];
    s.words[w.id] = { stage: 1, due: 0, firstSeen: 1, lastSeen: 1, relapse: 0, correct: 1, wrong: 0, read: 1 } as never;
    const b = startBattle(s, w, makeRng(1));
    expect(b.kind).not.toBe('new');
    b.monster.hp = 1;
    b.phase = w.art as never;
    const q = makeQuestion(s, b, 'attack', makeRng(2));
    expect(q.firstWrite).toBeUndefined();
  });
});
