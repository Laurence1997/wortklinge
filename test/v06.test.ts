import { describe, expect, it } from 'vitest';
import { newGame } from '../src/core/state';
import { makeRng } from '../src/core/rng';
import { WORD_BY_ID, WORDS } from '../src/data/words';
import { startBattle, makeQuestion, resolveTurn } from '../src/core/combat';
import { answerExam, BREAK, examPassed, startExam } from '../src/core/breakthrough';
import { usesDu, weberQuestions } from '../src/data/weber';
import { PARTICLE_SENTENCES } from '../src/data/particles';
import { RULES } from '../src/data/dungeon';
import { dailyBoard } from '../src/core/dailies';
import { blindBoxes } from '../src/core/blindbox';
import { UNLOCK, UNLOCK_TEXT } from '../src/core/unlocks';

const T0 = new Date('2026-11-22T10:00:00').getTime();
const met = { stage: 3 as const, due: 9e15, firstSeen: 0, lastSeen: 0, relapse: 0, correct: 1, wrong: 0 };

describe('0.6 Lv21–30 systems', () => {
  it('A1 突破试炼: 3 parts × 8, passes only with 5 per part', () => {
    const s = newGame('T', 'student', T0);
    s.level = 30;
    for (const w of WORDS.filter((x) => (x.region ?? 1) <= 3)) s.words[w.id] = { ...met };
    const e = startExam(s, makeRng(3));
    expect(e.qs.length).toBe(3 * BREAK.perPart);
    expect(new Set(e.qs.map((q) => q.word.id)).size).toBe(e.qs.length);
    for (const q of e.qs) answerExam(e, q.part === 'write' ? q.word.de.replace(/^/, q.word.art ? `${q.word.art} ` : '') : q.answer);
    expect(e.over).toBe(true);
    expect(examPassed(e)).toBe(true);
    const f = startExam(s, makeRng(4));
    f.qs.forEach((q, i) => answerExam(f, q.part === 'read' && i % 8 < 4 ? 'xxx' : q.part === 'write' ? `${q.word.art ? q.word.art + ' ' : ''}${q.word.de}` : q.answer));
    expect(f.right.read).toBe(4);
    expect(examPassed(f)).toBe(false);
  });

  it('终极技能: first finisher at 30 is a two-blank frame; both right ×3, one right still hits', () => {
    const s = newGame('T', 'student', T0);
    s.level = 30;
    s.words['tee'] = { ...met };
    s.words['tasse'] = { ...met };
    const fight = () => {
      const b = startBattle(s, WORD_BY_ID['tee'], makeRng(1));
      b.intent = { ...b.intent, kind: 'wait', hits: 0 };
      b.monster.hp = b.monster.maxHp = 99999;
      b.monster.lvl = s.level;
      b.phase = 'der';
      b.cfx.res = 5;
      return b;
    };
    const b = fight();
    const q = makeQuestion(s, b, 'sentence', makeRng(1));
    expect(q.ult?.length).toBe(2);
    expect(q.frame).toContain('___ und ___');
    const r2 = resolveTurn(s, b, 'sentence', q, q.ult!.join('|'), makeRng(2));
    expect(r2.correct).toBe(true);
    const dmgBoth = b.monster.maxHp - b.monster.hp;
    // Used once per fight: the next finisher is the normal one.
    b.cfx.res = 5;
    expect(makeQuestion(s, b, 'sentence', makeRng(1)).ult).toBeUndefined();
    const c = fight();
    const q1 = makeQuestion(s, c, 'sentence', makeRng(1));
    const r1 = resolveTurn(s, c, 'sentence', q1, `${q1.ult![0]}|falsch`, makeRng(2));
    expect(r1.correct).toBe(true);
    const dmgOne = c.monster.maxHp - c.monster.hp;
    expect(dmgBoth).toBeGreaterThan(dmgOne * 1.5);
    // Below 30 the finisher stays the whole sentence.
    s.level = 29;
    expect(makeQuestion(s, fight(), 'sentence', makeRng(1)).ult).toBeUndefined();
  });

  it('终极技能 also works for region-3 words from their example sentences', () => {
    const s = newGame('T', 'student', T0);
    s.level = 30;
    for (const w of WORDS) s.words[w.id] = { ...met };
    let got = 0;
    const r3 = WORDS.filter((w) => w.region === 3);
    for (const w of r3) {
      const b = startBattle(s, w, makeRng(1));
      b.cfx.res = 5;
      const q = makeQuestion(s, b, 'sentence', makeRng(2));
      if (!q.ult) continue;
      got++;
      expect(q.frame!.split('___').length).toBe(3);
      // Filling the two blanks gives back the whole sentence.
      const parts = q.frame!.split('___');
      expect(parts[0] + q.ult[0] + parts[1] + q.ult[1] + parts[2]).toBe(q.answer);
    }
    expect(got / r3.length).toBeGreaterThan(0.8);
  });

  it('Frau Weber: name first, 5 questions, du detected', () => {
    const qs = weberQuestions(makeRng(5));
    expect(qs.length).toBe(5);
    expect(qs[0].id).toBe('name');
    expect(usesDu('Ich wohne in deiner Stadt')).toBe(true);
    expect(usesDu('Ich wohne in Gleisdorf')).toBe(false);
  });

  it('data: particle sentences blank their word; dungeon rules; unlocks have text', () => {
    for (const [k, list] of Object.entries(PARTICLE_SENTENCES)) for (const l of list) expect(l).toContain(`{${k}}`);
    expect(RULES.length).toBeGreaterThanOrEqual(4);
    for (const lv of [21, 23, 25, 26, 27, 28, 30]) expect(UNLOCK_TEXT[lv]?.length).toBeGreaterThan(0);
    expect(UNLOCK.ultimate).toBe(30);
  });

  it('dailies and blind boxes are stable within one day', () => {
    const s = newGame('T', 'student', T0);
    s.level = 26;
    s.region = 3;
    const a = dailyBoard(s, makeRng(1));
    const b = dailyBoard(s, makeRng(2));
    expect(JSON.stringify(b)).toBe(JSON.stringify(a));
    expect(a.list.length).toBe(3);
    const x = blindBoxes(s, makeRng(1));
    expect(blindBoxes(s, makeRng(9))).toEqual(x);
    expect(x.length).toBe(3);
  });
});
