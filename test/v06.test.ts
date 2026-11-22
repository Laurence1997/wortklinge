import { describe, expect, it } from 'vitest';
import { newGame } from '../src/core/state';
import { makeRng } from '../src/core/rng';
import { WORD_BY_ID, WORDS } from '../src/data/words';
import { startBattle, makeQuestion, resolveTurn } from '../src/core/combat';
import { a1Complete, answerExam, BREAK, examPassed, grammarQs, startExam, startGrammarExam, type ExamQ } from '../src/core/breakthrough';
import { usesDu, weberQuestions } from '../src/data/weber';
import { PARTICLE_SENTENCES } from '../src/data/particles';
import { RULES } from '../src/data/dungeon';
import { dailyBoard } from '../src/core/dailies';
import { blindBoxes } from '../src/core/blindbox';
import { UNLOCK, UNLOCK_TEXT } from '../src/core/unlocks';

const T0 = new Date('2026-11-22T10:00:00').getTime();
const met = { stage: 3 as const, due: 9e15, firstSeen: 0, lastSeen: 0, relapse: 0, correct: 1, wrong: 0 };

describe('0.6 Lv21–30 systems', () => {
  it('A1 突破试炼: 4 parts × 8, passes only with 5 per part; grammar is 2 acc, 2 dat, 2 conj, 2 Perfekt', () => {
    const s = newGame('T', 'student', T0);
    s.level = 30;
    for (const w of WORDS.filter((x) => (x.region ?? 1) <= 3)) s.words[w.id] = { ...met };
    const right = (q: ExamQ) => (q.blanks ? q.blanks.join('|') : q.part === 'write' ? `${q.word.art ? q.word.art + ' ' : ''}${q.word.de}` : q.answer);
    const e = startExam(s, makeRng(3));
    expect(e.qs.length).toBe(4 * BREAK.perPart);
    for (const q of e.qs) answerExam(e, right(q));
    expect(e.over).toBe(true);
    expect(examPassed(e)).toBe(true);
    const f = startExam(s, makeRng(4));
    f.qs.forEach((q, i) => answerExam(f, q.part === 'read' && i % 8 < 4 ? 'xxx' : right(q)));
    expect(f.right.read).toBe(4);
    expect(examPassed(f)).toBe(false);
    // Grammar: the fixed mix, typed answers with ae/oe/ue accepted, both Perfekt blanks needed.
    for (let seed = 1; seed <= 20; seed++) {
      const g = grammarQs(s, makeRng(seed));
      expect(g.length).toBe(8);
      expect(new Set(g.map((q) => q.word.id)).size).toBe(8);
      expect(g.filter((q) => q.blanks!.length === 2).length).toBe(2);
      // 宾格: at least one masculine noun with den / einen (f/n accusative looks like the nominative).
      expect(g.slice(0, 2).some((q) => q.word.art === 'der' && ['den', 'einen', 'keinen'].includes(q.answer))).toBe(true);
      for (const q of g) {
        expect(q.prompt).toContain('___');
        expect(q.hint).toBeTruthy();
      }
    }
    const g = startGrammarExam(s, makeRng(5));
    expect(g.grammarOnly).toBe(true);
    const h = startGrammarExam(s, makeRng(5));
    for (const q of h.qs) answerExam(h, q.blanks!.length === 2 ? `${q.blanks![0]}|falsch` : q.blanks![0].replace(/ü/g, 'ue').replace(/ä/g, 'ae').replace(/ö/g, 'oe'));
    expect(h.right.grammar).toBe(6);
    expect(examPassed(h)).toBe(true);
    expect(a1Complete({ a1Passed: true })).toBe(false);
    expect(a1Complete({ a1Passed: true, a1Grammar: true })).toBe(true);
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
