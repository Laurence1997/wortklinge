import { describe, expect, it } from 'vitest';
import { newGame } from '../src/core/state';
import { WORDS } from '../src/data/words';
import { noteVisit, redAsleep, redEligible } from '../src/core/redname';
import { structTasks, startBattle } from '../src/core/combat';
import { makeRng } from '../src/core/rng';

// 红名怪 (游戏设计 六, 81).
describe('红名怪', () => {
  const verb = WORDS.find((w) => w.pos === 'v' && structTasks(w).length)!;
  it('only met verbs with a weil sentence, only from 81', () => {
    const s = newGame('T', 'student');
    s.level = 81;
    expect(redEligible(s, verb)).toBe(false);
    s.words[verb.id] = { stage: 2, due: 0, firstSeen: 0, lastSeen: 0, relapse: 0, correct: 1, wrong: 0, read: 0 } as never;
    expect(redEligible(s, verb)).toBe(true);
    s.level = 80;
    expect(redEligible(s, verb)).toBe(false);
  });
  it('a red-name fight is a 结构魔', () => {
    const s = newGame('T', 'student');
    s.level = 81;
    s.words[verb.id] = { stage: 2, due: Date.now() + 9e9, firstSeen: 1, lastSeen: 1, relapse: 0, correct: 2, wrong: 0, read: 1 } as never;
    const b = startBattle(s, verb, makeRng(1), { struct: true });
    expect(b.structMon).toBe(true);
  });
  it('back after more than 3 days: asleep for the first day', () => {
    const s = newGame('T', 'student');
    const t = 1_800_000_000_000;
    noteVisit(s, t);
    expect(redAsleep(s, t)).toBe(false);
    noteVisit(s, t + 4 * 86400000);
    expect(redAsleep(s, t + 4 * 86400000 + 3600000)).toBe(true);
    expect(redAsleep(s, t + 6 * 86400000)).toBe(false);
  });
});

describe('发音怪', () => {
  it('from 83, a word on a hard sound pair asks its pair every attack', async () => {
    const { pairsFor, PRON_MON } = await import('../src/core/pron');
    const { makeQuestion } = await import('../src/core/combat');
    const w = WORDS.find((x) => pairsFor(x).some((p) => PRON_MON.cats.includes(p.p.cat)))!;
    const s = newGame('T', 'student');
    s.level = 83;
    s.words[w.id] = { stage: 2, due: Date.now() + 9e9, firstSeen: 1, lastSeen: 1, relapse: 0, correct: 2, wrong: 0, read: 1 } as never;
    let b = startBattle(s, w, makeRng(1));
    for (let i = 2; !b.pronMon && i < 60; i++) b = startBattle(s, w, makeRng(i));
    expect(b.pronMon).toBe(true);
    for (let i = 0; i < 3; i++) expect(makeQuestion(s, b, 'attack', makeRng(10 + i)).echo).toBeTruthy();
  });
});
