import { describe, expect, it } from 'vitest';
import { WORDS } from '../src/data/words';
import { B2_MON, numbersTask, registerTask, reportTasks, rewriteTask, REWRITES, rollB2Mon, timelineTask, reviewTask, b2Task } from '../src/core/b2mons';
import { gradeGram } from '../src/core/gram/task';
import { newGame } from '../src/core/state';
import { makeRng } from '../src/core/rng';
import { startBattle } from '../src/core/combat';

describe('B2 怪种', () => {
  it('转述怪: ich + present → er + K1, from the word’s own sentences', () => {
    const ts = WORDS.filter((w) => w.pos === 'v').flatMap((w) => reportTasks(w));
    expect(ts.length).toBeGreaterThan(20);
    for (const t of ts) {
      expect(t.answer).toMatch(/^Er sagt, er \S+/);
      expect(gradeGram(t, t.answer).ok).toBe(true);
      expect(gradeGram(t, t.answer.replace(/^Er sagt, er/, 'Sie sagt, sie')).ok).toBe(true);
    }
    const bin = ts.find((t) => /„Ich bin /.test(t.focus));
    if (bin) expect(bin.answer).toMatch(/er sei /);
  });

  it('数字怪: um is the difference, auf the new value', () => {
    const rng = makeRng(3);
    for (let i = 0; i < 50; i++) {
      const t = numbersTask(rng);
      expect(t.options).toContain(t.answer);
      expect(new Set(t.options).size).toBe(3);
      const [, a, b] = t.passage!.split('\n').map((l) => l.split(': ')[1]);
      if (/ um /.test(t.answer)) expect(t.answer).not.toContain(` ${b} `);
      else expect(t.answer).toContain(`auf ${b}`);
      expect(t.answer).toMatch(new RegExp(Number(a.replace(/\D/g, '')) < Number(b.replace(/\D/g, '')) ? 'gestiegen' : 'gesunken'));
    }
  });

  it('改写怪: key words decide, the model answer always passes', () => {
    for (const r of REWRITES) {
      const t = rewriteTask(() => REWRITES.indexOf(r) / REWRITES.length + 1e-9);
      expect(t.answer).toBe(r.b2);
      expect(gradeGram(t, r.b2).ok, r.b2).toBe(true);
      expect(gradeGram(t, r.a2).ok, r.a2).toBe(false);
    }
    const t = rewriteTask(() => 0);
    expect(gradeGram(t, 'Aufgrund des starken Regens fällt das Konzert aus.').ok).toBe(true);
    expect(gradeGram(t, 'wegen Regens').ok).toBe(false);
  });

  it('时间线怪 and 三语域怪 are choice questions with one right answer', () => {
    const rng = makeRng(9);
    for (let i = 0; i < 30; i++) {
      const tl = timelineTask(rng);
      expect(new Set(tl.options).size).toBe(tl.options!.length);
      expect(tl.options).toContain(tl.answer);
      const rg = registerTask(rng);
      expect(rg.options).toContain(rg.answer);
    }
  });

  it('open by level, and a battle can come as one', () => {
    const s = newGame('T', 'student');
    const verb = WORDS.find((w) => w.pos === 'v' && reportTasks(w).length)!;
    s.level = 120;
    expect(rollB2Mon(s, verb, () => 0)).toBe(null);
    s.level = 200;
    s.words[verb.id] = { stage: 2, due: Date.now() + 9e9, firstSeen: 1, lastSeen: 1, relapse: 0, correct: 2, wrong: 0, read: 1 } as never;
    expect(rollB2Mon(s, verb, () => 0)).toBeTruthy();
    for (const k of Object.keys(B2_MON) as Array<keyof typeof B2_MON>) {
      const t = b2Task(s, verb, makeRng(2), k);
      if (k === 'review') continue; // needs a met word with an open grammar sentence
      expect(t?.special, k).toBe(true);
    }
    void reviewTask;
    let seen = false;
    for (let seed = 1; seed < 400 && !seen; seed++) {
      const b = startBattle(s, verb, makeRng(seed));
      if (b.b2Mon) seen = true;
    }
    expect(seen).toBe(true);
  });
});

import { addXp } from '../src/core/state';
import { MASTERY, masteryFree, spendMastery } from '../src/core/mastery';
import { affixTotal } from '../src/core/state';
import { xpToNext } from '../src/core/config';

describe('言灵精通', () => {
  it('at max level experience turns into mastery points, spent on small bonuses', () => {
    const s = newGame('T', 'student');
    s.level = 200;
    for (const st of ['A1', 'A2', 'B1', 'B2', 'C1']) s.flags[`stage_${st}`] = true;
    const r = addXp(s, xpToNext(200) * 2 + 5);
    expect(s.level).toBe(200);
    expect(r.mastery).toBe(2);
    expect(masteryFree(s.flags)).toBe(2);
    const before = affixTotal(s, 'dmg');
    expect(spendMastery(s.flags, 'dmg')).toBe(true);
    expect(affixTotal(s, 'dmg')).toBeCloseTo(before + MASTERY.dmg.per);
  });
});

import { opinionRule, CLAIMS } from '../src/core/opinion';
describe('开口表达观点', () => {
  it('needs an opinion opener, a reason and enough words', () => {
    expect(opinionRule('Nein.').ok).toBe(false);
    expect(opinionRule('Ich finde das gut.').ok).toBe(false);
    expect(opinionRule('Das stimmt nicht, weil Kinder lernen müssen.').ok).toBe(false);
    expect(opinionRule('Ich bin der Ansicht, dass Handys nützlich sind, weil man damit schnell etwas nachschlagen kann.').ok).toBe(true);
    expect(opinionRule('Meiner Meinung nach ist das falsch, denn viele Leute brauchen ein Auto.').ok).toBe(true);
    expect(CLAIMS.length).toBeGreaterThanOrEqual(20);
  });
});
