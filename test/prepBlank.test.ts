import { describe, expect, it } from 'vitest';
import { newGame } from '../src/core/state';
import { WORD_BY_ID, WORDS } from '../src/data/words';
import { makeRng } from '../src/core/rng';
import { makeQuestion, startBattle } from '../src/core/combat';
import { gradeGram } from '../src/core/gram/task';
import { gradePrep, otherCaseDet, prepParts } from '../src/core/gram/prepGrade';
import { notePrep, openSlots, prepBlankTask, prepOptions, prepSlots, prepTaskOf, PREP_CFG } from '../src/core/gram/prepBlank';

const slot = (id: string, pred: (shown: string) => boolean) => {
  const x = prepSlots(WORD_BY_ID[id]).find((s) => pred(s.full));
  if (!x) throw new Error(`no slot for ${id}`);
  return x;
};

describe('介词空 · finding the slots', () => {
  it('noun: two-way with the dative (auf dem Tisch)', () => {
    const x = slot('tisch', (f) => f.startsWith('Das Essen steht auf dem Tisch'));
    expect(x.answer).toBe('auf dem');
    expect(x.shown).toBe('Das Essen steht ___ Tisch.');
    expect(x.info).toMatchObject({ prep: 'auf', cat: 'two', kase: 'D', g: 'm' });
  });
  it('noun: contraction (zum Bahnhof) is a dative-only preposition', () => {
    const x = slot('bahnhof', (f) => f.includes('zum Bahnhof'));
    expect(x.answer).toBe('zum');
    expect(x.info).toMatchObject({ prep: 'zu', cat: 'dat', kase: 'D' });
  });
  it('noun: time phrase (Am Montag) opens at 10', () => {
    const x = slot('montag', (f) => f.startsWith('Am Montag habe'));
    expect(x.info.cat).toBe('time');
    expect(x.shown.startsWith('___ Montag')).toBe(true);
  });
  it('noun: a verb pairing in the sentence makes it 动介搭配 (warte auf den Bus)', () => {
    const x = slot('bus', (f) => f.startsWith('Ich warte auf den Bus'));
    expect(x.info).toMatchObject({ cat: 'verb', kase: 'A', verb: 'warten' });
    expect(x.answer).toBe('auf den');
  });
  it('verb: only 动介搭配 verbs, the preposition after the verb (denke an meine Familie)', () => {
    const x = slot('denken', (f) => f.includes('an meine Familie'));
    expect(x.answer).toBe('an meine');
    expect(x.shown).toBe('Ich denke oft ___ Familie.');
    expect(prepSlots(WORD_BY_ID.denken).some((s) => s.full.includes('dass es'))).toBe(false);
  });
  it('was für and um … zu are not prepositions here', () => {
    for (const w of WORDS) for (const s of prepSlots(w)) {
      expect(/\bwas ___/i.test(s.shown) && s.info.prep === 'fuer').toBe(false);
      if (s.info.prep === 'um') expect(/(^|\s)[a-zäöüß]{2,}zu[a-zäöüß]+en[.!?]?$/.test(s.shown)).toBe(false);
    }
  });
  it('there are enough slots in every band', () => {
    const n = WORDS.filter((w) => prepSlots(w).length).length;
    expect(n).toBeGreaterThan(1200);
    const verbs = WORDS.filter((w) => w.pos === 'v' && prepSlots(w).length).length;
    expect(verbs).toBeGreaterThan(150);
  });
});

describe('介词空 · grading', () => {
  const tisch = () => slot('tisch', (f) => f.startsWith('Das Essen steht auf dem Tisch'));
  it('contractions and written-out forms both count', () => {
    const m = slot('montag', (f) => f.startsWith('Am Montag habe'));
    expect(gradePrep('am', m.answer, m.info).ok).toBe(true);
    expect(gradePrep('an dem', m.answer, m.info).ok).toBe(true);
    const z = slot('bahnhof', (f) => f.includes('zum Bahnhof'));
    expect(gradePrep('zu dem', z.answer, z.info).ok).toBe(true);
    expect(prepParts('Übers')).toEqual(['ueber', 'das']);
  });
  it('right preposition, wrong case → wrong, with the wo/wohin reason', () => {
    const v = gradePrep('auf den', tisch().answer, tisch().info);
    expect(v.ok).toBe(false);
    expect(v.why).toContain('wo');
    expect(v.why).toContain('dem');
  });
  it('dative-only explanation names the noun gender (mit dem Bus)', () => {
    const v = gradePrep('mit den', 'mit dem', { prep: 'mit', cat: 'dat', kase: 'D', det: 'dem', g: 'm', noun: 'der Bus', blank: true });
    expect(v.ok).toBe(false);
    expect(v.why).toBe('mit 永远接第三格：Bus 是 der 词，这里要 dem');
  });
  it('verb pairing: warten auf + Akk., and für gets its own hint', () => {
    const x = slot('bus', (f) => f.startsWith('Ich warte auf den Bus'));
    expect(gradePrep('auf dem', x.answer, x.info).why).toContain('warten 搭 auf + 第四格');
    expect(gradePrep('für den', x.answer, x.info).why).toContain('für');
  });
  it('after a pairing verb a wrong preposition gets the pairing, not the place hint (fragen nach)', () => {
    const x = prepSlots(WORD_BY_ID.name).find((s) => s.full.startsWith('Frag ihn nach'));
    if (!x) return;
    const why = gradePrep('in seinem', x.answer, x.info).why ?? '';
    expect(why).not.toContain('城市');
    expect(why).toContain('fragen nach');
  });
  it('another article of the same case counts when the Chinese does not say which', () => {
    expect(gradePrep('auf einen', 'auf den', { prep: 'auf', cat: 'two', kase: 'A', det: 'den', g: 'm', dets: ['einen'], blank: true }).ok).toBe(true);
    expect(gradePrep('auf einen', 'auf den', { prep: 'auf', cat: 'two', kase: 'A', det: 'den', g: 'm', blank: true }).ok).toBe(false);
  });
  it('gradeGram uses the rule-based grader for 介词空', () => {
    const s = newGame('T', 'student');
    s.level = 40;
    const t = prepTaskOf(s, WORD_BY_ID.tisch, tisch(), makeRng(1));
    expect(gradeGram(t, 'auf dem').ok).toBe(true);
    const bad = gradeGram(t, 'auf den');
    expect(bad.ok).toBe(false);
    expect(bad.notes.join(' ')).toContain('在哪里');
  });
  it('other case of a determiner', () => {
    expect(otherCaseDet('dem', 'm', 'D')).toBe('den');
    expect(otherCaseDet('einer', 'f', 'D')).toBe('eine');
    expect(otherCaseDet('meinem', 'n', 'D')).toBe('mein');
  });
});

describe('介词空 · asking', () => {
  it('opens by kind and level', () => {
    const s = newGame('T', 'student');
    s.level = 9;
    expect(openSlots(s, WORD_BY_ID.montag)).toHaveLength(0);
    s.level = 12;
    expect(openSlots(s, WORD_BY_ID.montag).length).toBeGreaterThan(0);
    expect(openSlots(s, WORD_BY_ID.tisch).filter((x) => x.info.cat === 'two')).toHaveLength(0);
    s.level = 32;
    expect(openSlots(s, WORD_BY_ID.tisch).some((x) => x.info.cat === 'two')).toBe(true);
    expect(openSlots(s, WORD_BY_ID.denken)).toHaveLength(0);
    s.level = 41;
    expect(openSlots(s, WORD_BY_ID.denken).length).toBeGreaterThan(0);
  });
  it('wo/wohin tag for the first 20 two-way questions, then gone', () => {
    const s = newGame('T', 'student');
    s.level = 40;
    const x = slot('tisch', (f) => f.startsWith('Das Essen steht auf dem Tisch'));
    expect(prepTaskOf(s, WORD_BY_ID.tisch, x, makeRng(1)).prompt).toContain('wo?');
    for (let i = 0; i < PREP_CFG.tagFirst; i++) notePrep(s, { prep: 'auf', cat: 'two' }, true);
    expect(prepTaskOf(s, WORD_BY_ID.tisch, x, makeRng(1)).prompt).not.toContain('wo?');
  });
  it('a kind under 60% right drops to 3-choice (choice tier) with fitting distractors', () => {
    const s = newGame('T', 'student');
    s.level = 40;
    for (let i = 0; i < 6; i++) notePrep(s, { prep: 'auf', cat: 'two' }, i < 2);
    const x = slot('tisch', (f) => f.startsWith('Das Essen steht auf dem Tisch'));
    const t = prepTaskOf(s, WORD_BY_ID.tisch, x, makeRng(3));
    expect(t.tier).toBe(0);
    expect(t.options).toHaveLength(3);
    expect(t.options).toContain('auf dem');
    expect(t.options).toContain('auf den');
    expect(new Set(t.options).size).toBe(3);
  });
  it('options are distinct and include the answer (fewer than 3 → stays typed)', () => {
    let n = 0;
    for (const w of WORDS.slice(0, 3000)) for (const x of prepSlots(w)) {
      const o = prepOptions(x, makeRng(n++));
      expect(o).toContain(x.answer);
      expect(new Set(o.map((v) => v.toLowerCase())).size).toBe(o.length);
      expect(o.length).toBeLessThanOrEqual(3);
    }
  });
  it('weighted toward the prepositions you miss', () => {
    const s = newGame('T', 'student');
    s.level = 40;
    for (let i = 0; i < 10; i++) notePrep(s, { prep: 'in', cat: 'two' }, false);
    const w = WORD_BY_ID.schule;
    let inQ = 0;
    for (let i = 0; i < 200; i++) if (prepBlankTask(s, w, makeRng(i))?.pb?.prep === 'in') inQ++;
    expect(inQ).toBeGreaterThan(120);
  });
  it('shows up in fights in place of some clozes, and a right answer counts as 会用 not 会写', () => {
    const s = newGame('T', 'student');
    s.level = 40;
    const w = WORD_BY_ID.tisch;
    let seen = 0;
    for (let seed = 1; seed < 120 && !seen; seed++) {
      s.words[w.id] = { stage: 1, due: 0, firstSeen: 1, lastSeen: 1, relapse: 0, correct: 1, wrong: 0, read: 1 } as never;
      const b = startBattle(s, w, makeRng(seed));
      for (let step = 0; step < 4; step++) {
        b.step = step;
        const q = makeQuestion(s, b, 'attack', makeRng(seed * 7 + step));
        if (q.gram?.pb?.blank) seen++;
      }
    }
    expect(seen).toBeGreaterThan(0);
  });
});
