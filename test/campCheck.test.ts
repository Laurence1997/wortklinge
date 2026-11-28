import { describe, expect, it } from 'vitest';
import { newGame } from '../src/core/state';
import { makeRng } from '../src/core/rng';
import { formHint, makeQuestion, startBattle } from '../src/core/combat';
import { answerCamp, campBadge, CAMP, startCamp } from '../src/core/campCheck';
import { bandOf, isPlaced, PLACE, placeWords } from '../src/core/placement';
import { EXAMPLES } from '../src/core/cloze';
import { WORDS, WORD_BY_ID } from '../src/data/words';

const T0 = Date.now();

describe('篝火抽查和复习 (1.0.13)', () => {
  it('the hint names word class, form and first letter, not the dictionary form', () => {
    const w = WORDS.find((x) => x.de === 'beisteuern');
    if (w) {
      const h = formHint(w, 'steuerte');
      expect(h).toContain('过去式');
      expect(h).toContain('首字母 s');
      expect(h).not.toContain('beisteuern');
    }
    const n = WORDS.find((x) => x.art && x.de === 'Tisch')!;
    expect(formHint(n, 'den Tisch')).toContain('名词');
    const geh = WORDS.find((x) => x.de === 'gehen')!;
    expect(formHint(geh, 'geht')).toContain('现在时');
    expect(formHint(geh, 'gegangen')).toContain('Partizip');
  });

  it('fights never ask another word; due reviews and 推定会 wait at the bonfire, due first', () => {
    const s = newGame('T', 'student', T0);
    s.level = 30;
    s.hp = 999;
    const due = WORDS.filter((x) => x.art && EXAMPLES[x.id]?.length).slice(0, 3);
    for (const d of due) s.words[d.id] = { stage: 3, due: T0 - 1000, ivl: 86400000, ctx: 0, firstSeen: 0, lastSeen: 0, relapse: 0, correct: 3, wrong: 0, read: 1, write: 2 } as never;
    const placed = placeWords().filter((x) => x.lvl <= 6 && !due.includes(x)).slice(0, 30);
    for (const p of placed) s.words[p.id] = { stage: 3, due: 9e15, firstSeen: 0, lastSeen: 0, relapse: 0, correct: 0, wrong: 0, read: 0, placed: true } as never;
    const other = WORDS.find((x) => x.art && !s.words[x.id])!;
    const b = startBattle(s, other, makeRng(1));
    b.turn = 3;
    for (let i = 0; i < 8; i++) expect(makeQuestion(s, b, 'attack', makeRng(i)).review).toBeUndefined();
    expect(campBadge(s)).toBe(3 + CAMP.round);
    const run = startCamp(s, makeRng(1))!;
    expect(run.ids.length).toBe(CAMP.round);
    expect(run.ids.slice(0, 3).sort()).toEqual(due.map((d) => d.id).sort());
    const xp0 = s.xp;
    answerCamp(s, run, run.q!.answer!, makeRng(2));
    expect(run.last!.ok).toBe(true);
    expect(s.xp).toBeGreaterThan(xp0);
    answerCamp(s, run, 'xyz', makeRng(3));
    expect(run.last!.ok).toBe(false);
    expect(run.at).toBe(2);
  });

  it('a band sampled enough with few mistakes is confirmed as a whole', () => {
    const s = newGame('T', 'student', T0);
    s.level = 40;
    const band = placeWords().filter((x) => bandOf(x) === 0 && EXAMPLES[x.id]?.length);
    for (const p of band) s.words[p.id] = { stage: 3, due: 9e15, firstSeen: 0, lastSeen: 0, relapse: 0, correct: 0, wrong: 0, read: 0, placed: true } as never;
    let guard = 0;
    while (band.some((x) => isPlaced(s.words[x.id])) && guard++ < 40) {
      const run = startCamp(s, makeRng(guard))!;
      while (run.q) answerCamp(s, run, run.q.answer!, makeRng(guard));
    }
    expect(band.every((x) => !isPlaced(s.words[x.id]) && s.words[x.id].retired && s.words[x.id].sure)).toBe(true);
    expect(s.placement!.checks['0'].n).toBeLessThanOrEqual(PLACE.confirmAfter + CAMP.round);
    void WORD_BY_ID;
  });
});
