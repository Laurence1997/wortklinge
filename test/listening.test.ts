import { describe, expect, it } from 'vitest';
import { newGame } from '../src/core/state';
import { WORDS } from '../src/data/words';
import { makeQuestion, resolveTurn, startBattle } from '../src/core/combat';
import { makeRng } from '../src/core/rng';
import { blindLine, LISTEN, passageTask, rollListen } from '../src/core/listening';
import { PASSAGES } from '../src/data/passages';
import { slotsAt } from '../src/core/loot';

// 听段题 (34) / 盲听 (91) and 耳机.
describe('听力', () => {
  const w = WORDS.find((x) => x.pos === 'n' && x.art && blindLine(x, makeRng(1)))!;
  it('耳机 drops from 34', () => {
    expect(slotsAt(33)).not.toContain('phones');
    expect(slotsAt(34)).toContain('phones');
  });
  it('blind listening only from 91 (no passage data yet)', () => {
    const always = () => 0;
    expect(rollListen(90, w, always)).toBeNull();
    expect(rollListen(91, w, always)).toBe('blind');
  });
  it('a passage question: 3 choices, never finishes the monster, no ladder step', () => {
    const p = { id: 't', wordId: w.id, lines: ['Achtung.', `Der Zug fährt heute um neun.`], zh: '注意。', q: 'Wann fährt der Zug?', qZh: '火车几点开？', answer: 'Um neun.', wrong: ['Um acht.', 'Um zehn.'] as [string, string] };
    PASSAGES.push(p);
    const t = passageTask(p, makeRng(1));
    expect(t.options).toHaveLength(3);
    const s = newGame('T', 'student');
    s.level = 34;
    s.words[w.id] = { stage: 2, due: Date.now() + 9e9, firstSeen: 1, lastSeen: 1, relapse: 0, correct: 2, wrong: 0, read: 1 } as never;
    const b = startBattle(s, w, makeRng(1));
    b.listenMon = 'passage';
    b.monster.hp = 1;
    const q = makeQuestion(s, b, 'attack', makeRng(2));
    expect(q.gram?.sys).toBe('listen');
    expect(q.listen).toContain('Zug');
    expect(b.replays).toBe(LISTEN.replays);
    const step = b.step;
    resolveTurn(s, b, 'attack', q, 'Um neun.', makeRng(3));
    expect(b.monster.hp).toBe(1);
    expect(b.step).toBe(step);
    expect(b.listenDone).toBe(true);
    PASSAGES.pop();
  });
});
