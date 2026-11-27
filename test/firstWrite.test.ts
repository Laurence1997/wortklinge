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

  it('no HP lock: a choice answer can kill it; its next fight asks the writing once', () => {
    const s = newGame('T', 'student');
    s.level = 4;
    const w = WORDS.find((x) => x.region === 1 && x.pos === 'v' && !x.tutorial)!;
    const b = startBattle(s, w, makeRng(7));
    b.directOffer = false;
    b.monster.hp = 1;
    const q0 = makeQuestion(s, b, 'attack', makeRng(8));
    expect(q0.options).toBeTruthy();
    resolveTurn(s, b, 'attack', q0, q0.answer!, makeRng(9));
    expect(b.outcome).toBe('win');
    // Recorded as met, never written: the next fight's first question is the writing.
    s.words[w.id] = { stage: 1, due: 0, firstSeen: 1, lastSeen: 1, relapse: 0, correct: 1, wrong: 0, read: 1 } as never;
    s.hp = 999;
    const b2 = startBattle(s, w, makeRng(10));
    b2.directOffer = false;
    const q1 = makeQuestion(s, b2, 'attack', makeRng(11));
    expect(q1.firstWrite).toBe(true);
    expect(q1.prompt).toContain('这场先写一次');
    // One try only in that fight: a miss is not a lock.
    resolveTurn(s, b2, 'attack', q1, 'zzz', makeRng(12));
    expect(makeQuestion(s, b2, 'attack', makeRng(13)).firstWrite).toBeUndefined();
    // Written once (write > 0): later fights are not forced.
    s.words[w.id].write = 1;
    const b3 = startBattle(s, w, makeRng(14));
    b3.directOffer = false;
    expect(makeQuestion(s, b3, 'attack', makeRng(15)).firstWrite).toBeUndefined();
  });

  it('a word met and written before is not gated', () => {
    const s = newGame('T', 'student');
    s.level = 4;
    const w = WORD_BY_ID['tee'];
    s.words[w.id] = { stage: 1, due: 0, firstSeen: 1, lastSeen: 1, relapse: 0, correct: 1, wrong: 0, read: 1, write: 1 } as never;
    const b = startBattle(s, w, makeRng(1));
    expect(b.kind).not.toBe('new');
    b.monster.hp = 1;
    b.phase = w.art as never;
    const q = makeQuestion(s, b, 'attack', makeRng(2));
    expect(q.firstWrite).toBeUndefined();
  });
});

describe('会的词不再 30 天回响抽查 (Lucas 2026-11-27)', () => {
  it('直接叫名 / 入学测试 / 筛选 retire as 永久; a normal 斩杀 still gets its check', async () => {
    const { retire, recheckDue } = await import('../src/core/srs');
    const s = newGame('T', 'student');
    const a = WORD_BY_ID['tee'];
    const b = WORDS.find((w) => w.region === 1 && w.id !== 'tee' && !w.tutorial)!;
    s.words[a.id] = { stage: 1, due: 0, firstSeen: 1, lastSeen: 1, relapse: 0, correct: 1, wrong: 0, read: 1 } as never;
    s.words[b.id] = { stage: 1, due: 0, firstSeen: 1, lastSeen: 1, relapse: 0, correct: 1, wrong: 0, read: 1 } as never;
    retire(s, a, 1000, true);
    retire(s, b, 1000);
    const later = 1000 + 31 * 864e5;
    expect(s.words[a.id].retired).toBe(1000);
    expect(recheckDue(s.words[a.id], later)).toBe(false);
    expect(recheckDue(s.words[b.id], later)).toBe(true);
  });

  it('old saves: a word retired the moment it was met becomes 永久, nothing is cleared', async () => {
    const { migrate } = await import('../src/core/state');
    const s = newGame('T', 'student');
    s.words['tee'] = { stage: 3, due: 0, firstSeen: 5000, lastSeen: 5000, relapse: 0, correct: 1, wrong: 0, read: 0, write: 1, retired: 5000 } as never;
    s.words['brot'] = { stage: 3, due: 0, firstSeen: 1000, lastSeen: 1000, relapse: 0, correct: 3, wrong: 0, read: 0, write: 2, retired: 1000 + 2 * 864e5 } as never;
    const m = migrate(JSON.parse(JSON.stringify(s)))!;
    expect(m.words['tee'].sure).toBe(true);
    expect(m.words['brot'].sure).toBeFalsy();
    expect(Object.keys(m.words).length).toBe(Object.keys(s.words).length);
  });
});

describe('写对的词 2 / 7 / 30 天 (Lucas 2026-11-27 选 1)', () => {
  it('old saves: a clean 归名 waiting for its old one-time check joins the ladder; due date kept', async () => {
    const { migrate } = await import('../src/core/state');
    const { CONFIG } = await import('../src/core/config');
    const s = newGame('T', 'student');
    s.words['tee'] = { stage: 3, due: 7777, ivl: 2.5 * 864e5, ctx: CONFIG.srs.context.length - 1, firstSeen: 1, lastSeen: 1, relapse: 0, correct: 3, wrong: 0, read: 1, write: 1 } as never;
    const m = migrate(JSON.parse(JSON.stringify(s)))!;
    expect(m.words['tee'].fix).toBe(0);
    expect(m.words['tee'].due).toBe(7777);
  });
});
