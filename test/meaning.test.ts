import { describe, expect, it } from 'vitest';
import { newGame } from '../src/core/state';
import { WORDS } from '../src/data/words';
import { makeQuestion, startBattle } from '../src/core/combat';
import { makeRng } from '../src/core/rng';

// 审查 C3: the name plate shows the meaning, so a word met before is never asked 「选中文意思」.
describe('C3 选中文意思只留给初见', () => {
  it('a word seen before gets no pickZh question', () => {
    const words = WORDS.filter((x) => x.region === 1).slice(0, 40);
    let asked = 0;
    for (const w of words) {
      for (let seed = 1; seed < 6; seed++) {
        const s = newGame('T', 'student');
        s.level = 4;
        s.words[w.id] = { stage: 1, due: Date.now() + 9e9, firstSeen: 1, lastSeen: 1, relapse: 0, correct: 1, wrong: 0, read: 1 } as never;
        const b = startBattle(s, w, makeRng(seed));
        if (b.kind === 'new') continue;
        for (let step = 0; step < 4; step++) {
          b.step = step;
          const q = makeQuestion(s, b, 'attack', makeRng(seed * 10 + step));
          asked++;
          expect(q.type).not.toBe('pickZh');
        }
      }
    }
    expect(asked).toBeGreaterThan(50);
  });
});
