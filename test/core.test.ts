import { describe, expect, it } from 'vitest';
import { gradeMoechte, gradeTyped, normalize } from '../src/core/grading';
import { WORD_BY_ID, WORDS } from '../src/data/words';
import { newGame, addXp, overloaded } from '../src/core/state';
import { applyWin } from '../src/core/outcomes';
import { recordKill, kindOf, stageOf } from '../src/core/srs';
import { CONFIG, xpToNext } from '../src/core/config';
import { startBattle, makeQuestion, resolveTurn } from '../src/core/combat';
import { makeRng } from '../src/core/rng';
import { answerBoss, startBoss } from '../src/core/boss';
import { BOSS_QUESTIONS } from '../src/data/boss';
import { pickSpawns } from '../src/core/spawn';

const T0 = new Date('2026-11-20T10:00:00').getTime();

describe('word data', () => {
  it('has about 200 unique words with Chinese meanings', () => {
    expect(WORDS.length).toBeGreaterThanOrEqual(190);
    expect(new Set(WORDS.map((w) => w.id)).size).toBe(WORDS.length);
    for (const w of WORDS) {
      expect(w.zh.length).toBeGreaterThan(0);
      if (w.pos === 'n') expect(['der', 'die', 'das']).toContain(w.art);
    }
  });
});

describe('grading', () => {
  const tee = WORD_BY_ID['tee'];
  const tschuess = WORDS.find((w) => w.de === 'Tschüss')!;
  it('accepts ae/oe/ue/ss and shows the proper spelling', () => {
    const v = gradeTyped('Tschuess', tschuess, false);
    expect(v.ok).toBe(true);
    expect(v.notes.join()).toContain('Tschüss');
  });
  it('requires the article when asked and names a wrong one', () => {
    expect(gradeTyped('Tee', tee, true).ok).toBe(false);
    expect(gradeTyped('Tee', tee, true).notes[0]).toContain('要带冠词');
    const v = gradeTyped('die Tee', tee, true);
    expect(v.ok).toBe(false);
    expect(v.notes[0]).toContain('der');
    expect(gradeTyped('der tee', tee, true).ok).toBe(true);
  });
  it('treats E-Mail and email the same', () => {
    expect(gradeTyped('die email', WORD_BY_ID['e-mail'], true).ok).toBe(true);
  });
  it('grades Ich möchte with the accusative', () => {
    const known = WORDS.filter((w) => w.moechte);
    expect(gradeMoechte('Ich möchte einen Tee.', known).ok).toBe(true);
    expect(gradeMoechte('ich moechte eine tasse', known).ok).toBe(true);
    const bad = gradeMoechte('Ich möchte ein Tee', known);
    expect(bad.ok).toBe(false);
    expect(bad.notes[0]).toContain('einen');
    expect(gradeMoechte('Ich möchte einen Elefanten', known).ok).toBe(false);
    expect(normalize('Wie geht’s?')).toBe('wie gehts');
  });
});

describe('归名 (spaced repetition)', () => {
  it('takes three kills on three different respawns, the last one typed', () => {
    const s = newGame('T', 'student', T0);
    const w = WORD_BY_ID['stuhl'];
    expect(kindOf(s, w, T0)).toBe('new');
    recordKill(s, w, false, false, T0);
    expect(stageOf(s, w, T0)).toBe(1);
    expect(kindOf(s, w, T0 + 1000)).toBe('shadow');
    // Killing the shadow does nothing.
    recordKill(s, w, true, false, T0 + 1000);
    expect(stageOf(s, w, T0 + 1000)).toBe(1);
    const t1 = T0 + CONFIG.srs.intervals[0];
    expect(kindOf(s, w, t1)).toBe('due');
    recordKill(s, w, false, false, t1);
    expect(stageOf(s, w, t1)).toBe(2);
    const t2 = t1 + CONFIG.srs.intervals[1];
    // A choice-answer kill can't finish it.
    const o = recordKill(s, w, false, false, t2);
    expect(o.needsTypedFinal).toBe(true);
    const t3 = t2 + CONFIG.srs.intervals[0];
    const o2 = recordKill(s, w, true, false, t3);
    expect(o2.guiming).toBe(true);
    expect(stageOf(s, w, t3)).toBe(3);
    // Relapse after about a week comes back as 半名.
    const t4 = t3 + CONFIG.srs.relapse[0];
    expect(stageOf(s, w, t4)).toBe(2);
    expect(kindOf(s, w, t4)).toBe('due');
  });
  it('a wrong answer on 半名 drops it one step, never to 无名', () => {
    const s = newGame('T', 'student', T0);
    const w = WORD_BY_ID['tisch'];
    recordKill(s, w, false, false, T0);
    const t1 = T0 + CONFIG.srs.intervals[0];
    recordKill(s, w, false, false, t1);
    const t2 = t1 + CONFIG.srs.intervals[1];
    const o = recordKill(s, w, true, true, t2);
    expect(o.to).toBe(1);
  });
});

describe('levels', () => {
  it('follows the design curve and stops at the version cap', () => {
    expect(xpToNext(1)).toBe(167);
    expect(xpToNext(5)).toBe(1000);
    expect(xpToNext(10)).toBeGreaterThan(2400);
    const s = newGame('T', 'student', T0);
    addXp(s, 1_000_000);
    expect(s.level).toBe(CONFIG.levelCap);
  });
});

describe('combat', () => {
  it('a level-1 player beats a new noun monster by answering articles', () => {
    const rng = makeRng(1);
    const s = newGame('T', 'student', Date.now());
    const b = startBattle(s, WORD_BY_ID['tee'], rng);
    let guard = 0;
    while (!b.outcome && guard++ < 20) {
      const q = makeQuestion(s, b, 'attack', rng);
      expect(q.type).toBe('article');
      resolveTurn(s, b, 'attack', q, q.answer!, rng);
    }
    expect(b.outcome).toBe('win');
  });
  it('the forced-loss tutorial cannot be won', () => {
    const rng = makeRng(2);
    const s = newGame('T', 'student', Date.now());
    s.level = 4;
    s.hp = 42;
    const b = startBattle(s, WORD_BY_ID['hund'], rng, { tutorial: 'loss' });
    let guard = 0;
    while (!b.outcome && guard++ < 20) {
      const q = makeQuestion(s, b, 'attack', rng);
      resolveTurn(s, b, 'attack', q, q.answer!, rng);
    }
    expect(b.outcome).toBe('lose');
    expect(b.intent.line).toContain('dreimal');
  });
  it('blocking an attack parries; breaking a defence makes it vulnerable', () => {
    const rng = makeRng(3);
    const s = newGame('T', 'student', Date.now());
    s.level = 7;
    s.hp = 60;
    const b = startBattle(s, WORD_BY_ID['stuhl'], rng, { tutorial: 'block' });
    const q = makeQuestion(s, b, 'block', rng);
    const r = resolveTurn(s, b, 'block', q, q.answer!, rng);
    expect(r.parried).toBe(true);
    const b2 = startBattle(s, WORD_BY_ID['tisch'], rng, { tutorial: 'break' });
    const q2 = makeQuestion(s, b2, 'break', rng);
    resolveTurn(s, b2, 'break', q2, q2.answer!, rng);
    expect(b2.monster.vulnerable).toBeGreaterThan(0);
  });
});

describe('spawning', () => {
  it('a level-1 player only meets nouns, new words first', () => {
    const s = newGame('T', 'student', Date.now());
    const picks = pickSpawns(s, 'echogasse', 6, new Set(), makeRng(4));
    expect(picks.length).toBe(6);
    for (const p of picks) expect(p.word.art).toBeTruthy();
  });
});

describe('boss', () => {
  it('accepts full-sentence answers and names common mistakes', () => {
    const rng = makeRng(5);
    const s = newGame('Lucas', 'student', Date.now());
    s.hp = 80;
    const f = startBoss(s, rng);
    expect(f.current.id).toBe('greet');
    expect(answerBoss(s, f, 'Guten Tag!', rng).ok).toBe(true);
    expect(f.current.id).toBe('name');
    expect(answerBoss(s, f, 'Ich heiße Lucas.', rng).ok).toBe(true);
    const v = answerBoss(s, f, 'Ich komme von China.', rng);
    expect(v.ok).toBe(false);
    expect(v.note).toContain('aus');
  });
  it('every boss question accepts its own model answer', () => {
    const s = newGame('Lucas', 'student', Date.now());
    for (const q of BOSS_QUESTIONS) {
      const model = q.model.replace('{name}', 'Lucas').split(' / ')[0].replace(/（.*）/, '').replace(/–/g, ' ');
      const f = startBoss(s, makeRng(6));
      f.current = q;
      expect(answerBoss(s, f, model, makeRng(7)).ok, `${q.id}: ${model}`).toBe(true);
    }
  });
});

describe('sentence input', () => {
  it('forgives a doubled "Ich möchte" from the pre-filled box', () => {
    const known = WORDS.filter((w) => w.moechte);
    expect(gradeMoechte('Ich möchte Ich möchte einen Kaffee.', known).ok).toBe(true);
  });
});

describe('言灵过载', () => {
  it('pays less for new words and more for reviews after the daily threshold, without blocking', () => {
    const rng = makeRng(7);
    const run = (count: number, kind: 'new' | 'due') => {
      const s = newGame('T', 'student');
      s.level = 6;
      s.daily.newCount = count;
      const b = startBattle(s, WORD_BY_ID['tee'], rng);
      b.kind = kind;
      b.lastKillTyped = false;
      return { s, res: applyWin(s, b, () => 0.99) };
    };
    const fresh = run(0, 'new');
    const over = run(CONFIG.srs.dailyNewCap, 'new');
    expect(overloaded(over.s)).toBe(true);
    expect(over.res.overload).toBe('new');
    expect(over.res.xp).toBeLessThan(fresh.res.xp);
    expect(over.res.gold).toBeLessThan(fresh.res.gold);
    const dueNormal = run(0, 'due');
    const dueOver = run(CONFIG.srs.dailyNewCap, 'due');
    expect(dueOver.res.overload).toBe('due');
    expect(dueOver.res.xp).toBeGreaterThan(dueNormal.res.xp);
    // Not a lock: new words still spawn.
    const s = newGame('T', 'student');
    s.level = 6;
    s.daily.newCount = CONFIG.srs.dailyNewCap + 5;
    const zone = WORD_BY_ID['tee'].zone;
    expect(pickSpawns(s, zone, 6, new Set(), rng).some((p) => p.kind === 'new')).toBe(true);
  });
});

describe('review backlog', () => {
  it('has no daily cap, spawns in waves and pays more when overdue', () => {
    const rng = makeRng(3);
    const s = newGame('T', 'student');
    s.level = 6;
    const zone = WORD_BY_ID['tee'].zone;
    const t = Date.now();
    // 150 reviews already spawned today and a big backlog: reviews still appear, one slot stays free.
    s.daily.dueSpawned = 150;
    for (const w of WORDS.filter((x) => x.zone === zone)) s.words[w.id] = { stage: 1, due: t - 10 * 24 * 3600_000 } as never;
    const picks = pickSpawns(s, zone, 6, new Set(), rng);
    expect(picks.filter((p) => p.kind === 'due').length).toBe(5);
    const b = startBattle(s, WORD_BY_ID['tee'], rng);
    expect(b.overdue).toBeGreaterThan(0);
    const late = applyWin(s, b, () => 0.99).xp;
    const s2 = newGame('T', 'student');
    s2.level = 6;
    const b2 = startBattle(s2, WORD_BY_ID['tee'], rng);
    b2.kind = 'due';
    b2.lastKillTyped = b.lastKillTyped;
    expect(late).toBeGreaterThan(applyWin(s2, b2, () => 0.99).xp);
  });
});

describe('question ladder', () => {
  it('never asks the same question twice in a row on a new word', () => {
    const rng = makeRng(5);
    for (const level of [1, 3]) {
      const s = newGame('T', 'student');
      s.level = level;
      const b = startBattle(s, WORD_BY_ID['tee'], rng);
      const types: string[] = [];
      for (let i = 0; i < 3; i++) {
        types.push(makeQuestion(s, b, 'attack', rng).type);
        b.step += 1;
      }
      expect(types[0]).toBe('article');
      expect(types[1]).toBe('pickZh');
      expect(types[2]).toBe(level >= 3 ? 'typed' : 'pickDe');
    }
  });
});
