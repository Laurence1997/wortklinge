import { describe, expect, it } from 'vitest';
import { WORDS } from '../src/data/words';
import { gradeCompose } from '../src/core/aiPractice';
import { gradeCloze } from '../src/core/cloze';
import { genderHint } from '../src/core/genderRules';
import { BOSS_QUESTIONS } from '../src/data/boss';
import { normalize } from '../src/core/grading';

const w = (de: string) => WORDS.find((x) => x.de === de)!;

describe('1.0.12 prerelease new', () => {
  it('造句 accepts participles, Präteritum and split separable verbs', () => {
    expect(gradeCompose('Ich bin gestern ausgezogen.', w('ausziehen')).ok).toBe(true);
    expect(gradeCompose('Zieh bitte deine Jacke aus.', w('ausziehen')).ok).toBe(true);
    expect(gradeCompose('Ich rufe dich morgen an.', w('anrufen')).ok).toBe(true);
    expect(gradeCompose('Ich stehe um sieben Uhr auf.', w('aufstehen')).ok).toBe(true);
    expect(gradeCompose('Ich habe in Berlin gewohnt.', w('wohnen')).ok).toBe(true);
    expect(gradeCompose('Ich ging nach Hause.', w('gehen')).ok).toBe(true);
    expect(gradeCompose('Ich rufe dich morgen.', w('anrufen')).ok).toBe(false);
  });

  it('region-1 boss tips are not traps', () => {
    const origin = BOSS_QUESTIONS.find((q) => q.id === 'origin')!;
    expect(origin.tips?.some(([re]) => re.test(normalize('Ich bin aus China.')))).toBe(true);
    expect(origin.traps?.some(([re]) => re.test(normalize('Ich bin aus China.')))).toBeFalsy();
  });

  it('这是 does not fix the article', () => {
    expect(gradeCloze('ein Nachbar', 'der Nachbar', w('Nachbar'), '这是邻居。')).toBe(true);
    expect(gradeCloze('ein Nachbar', 'der Nachbar', w('Nachbar'), '这个邻居很好。')).toBe(false);
  });

  it('gender rules leave native words alone', () => {
    for (const de of ['Frage', 'Lage', 'Zeichen', 'Bett', 'Bahnsteig', 'Zucker']) {
      const g = genderHint(WORDS.find((x) => x.de === de && x.art)!);
      expect(g?.rule?.id ?? '', de).not.toMatch(/^(ade|chen|ett|ig|agent)$/);
    }
    expect(genderHint(WORDS.find((x) => x.de === 'Datum' && x.art)!)?.rule?.id).toBe('um');
  });
});

import { boss2Questions } from '../src/data/boss2';
describe('region-2 boss counts', () => {
  it('accepts möchte gerne / bitte', () => {
    let rs = 1;
    const rng = () => ((rs = (rs * 16807) % 2147483647) / 2147483647);
    const q = boss2Questions(rng, false).find((x) => x.id.startsWith('count-'))!;
    const m = /^Ich möchte (.+)\.$/.exec(q.model)![1];
    for (const v of [`Ich möchte gerne ${m}.`, `Ich möchte bitte ${m}.`, `Ich hätte gern ${m}.`, `${m} bitte`]) expect(q.accept.some((re) => re.test(normalize(v))), v).toBe(true);
    expect(q.visual).not.toContain('灯泡');
  });
});
