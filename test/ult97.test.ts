import { describe, expect, it } from 'vitest';
import { newGame } from '../src/core/state';
import { WORDS } from '../src/data/words';
import { makeQuestion, resolveTurn, startBattle, ULT97 } from '../src/core/combat';
import { makeRng } from '../src/core/rng';

// 终极技能最终形态「提示词造句」(97).
describe('提示词造句', () => {
  const setup = (owner: boolean) => {
    const s = newGame('T', 'student');
    s.level = 97;
    if (owner) s.owner = 'u1';
    const ws = WORDS.filter((w) => w.pos === 'n' && w.art).slice(0, 4);
    for (const w of ws) s.words[w.id] = { stage: 3, due: Date.now() + 9e9, firstSeen: 1, lastSeen: 1, relapse: 0, correct: 3, wrong: 0, read: 1, write: 2 } as never;
    return { s, w: ws[0] };
  };
  it('logged in: target + 2 learned hints; not logged in: no 97 form', () => {
    const { s, w } = setup(true);
    const b = startBattle(s, w, makeRng(1));
    const q = makeQuestion(s, b, 'sentence', makeRng(2));
    expect(q.prompt97?.hints).toHaveLength(2);
    expect(q.prompt97!.hints).not.toContain(w.id);
    const o = setup(false);
    const q2 = makeQuestion(o.s, startBattle(o.s, o.w, makeRng(1)), 'sentence', makeRng(2));
    expect(q2.prompt97).toBeUndefined();
  });
  it('full: ×3 and the others in the pack take half, never below 1 HP', () => {
    const { s, w } = setup(true);
    const pack = [startBattle(s, w, makeRng(1)), startBattle(s, WORDS.find((x) => x.id !== w.id && x.pos === 'n')!, makeRng(3))];
    const b = pack[0];
    b.monster.hp = b.monster.maxHp = 100000;
    pack[1].monster.hp = 3;
    const q = makeQuestion(s, b, 'sentence', makeRng(2));
    q.ultGrade = 'full';
    const r = resolveTurn(s, b, 'sentence', q, 'Ich habe einen Satz.', makeRng(4), pack);
    expect(r.correct).toBe(true);
    expect(b.ultUsed).toBe(true);
    expect(pack[1].monster.hp).toBe(1);
    expect(ULT97.full).toBe(3);
  });
});
