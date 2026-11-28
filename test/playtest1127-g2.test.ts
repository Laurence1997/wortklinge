// 1.0.12 · 从头试玩 2026-11-27, group 2 (bosses): items 19, 20, 32, 33, 55, 96.
import { describe, expect, it } from 'vitest';
import { answerBoss, bossPay, noRepeat, startBoss } from '../src/core/boss';
import { BOSS_QUESTIONS, type BossQuestion } from '../src/data/boss';
import { LATER_BOSS } from '../src/data/bossesLater';
import { normalize } from '../src/core/grading';
import { makeRng } from '../src/core/rng';
import { newGame } from '../src/core/state';

const accepts = (q: BossQuestion, input: string) => (q.grade ? q.grade(input).ok : q.accept.some((re) => re.test(normalize(input))));

describe('1.0.12 g2 bosses', () => {
  it('19: natural answers about phone and siblings count', () => {
    const phone = BOSS_QUESTIONS.find((q) => q.id === 'phone')!;
    const sib = BOSS_QUESTIONS.find((q) => q.id === 'siblings')!;
    expect(accepts(phone, 'Meine Handynummer ist 0176 1234567.')).toBe(true);
    expect(accepts(sib, 'Ich bin Einzelkind.')).toBe(true);
    expect(accepts(sib, 'Ich habe zwei Geschwister.')).toBe(true);
  });

  it('20: a replay the same day pays half, the first kill (and each day\'s first) pays in full', () => {
    expect(bossPay(300, true, 1)).toBe(300);
    expect(bossPay(300, false, 1)).toBe(300);
    expect(bossPay(300, false, 2)).toBe(150);
    expect(bossPay(120, false, 5)).toBe(60);
    expect(bossPay(10, false, 2)).toBeGreaterThan(0);
  });

  it('32: «Kann man … essen?» puts der Pilz in the accusative', () => {
    let seen = false;
    for (let seed = 1; seed < 400 && !seen; seed++) {
      const qs = LATER_BOSS[14]!.questions(makeRng(seed));
      const bar = qs.find((q) => q.id === 'bar')!;
      expect(bar.ask.join(' ')).not.toMatch(/Kann man der /);
      if (bar.ask[0].includes('Pilz')) {
        expect(bar.ask[0]).toBe('Kann man den Pilz essen?');
        expect(bar.ask[1]).toBe('Lässt sich der Pilz essen?');
        seen = true;
      }
    }
    expect(seen).toBe(true);
  });

  it('33: a concrete example without a marker word counts; models follow the topic; FVG asks have an object', () => {
    const topics = new Set<string>();
    for (let seed = 1; seed < 60; seed++) {
      const qs = LATER_BOSS[13]!.questions(makeRng(seed));
      const ex = qs.find((q) => q.id === 'example')!;
      expect(accepts(ex, 'Meine Schwester ist 15 und schläft nie vor Mitternacht ein.')).toBe(true);
      expect(accepts(ex, 'Ja, genau.')).toBe(false);
      const op = qs.find((q) => q.id === 'opinion')!;
      expect(op.ask).toHaveLength(1);
      topics.add(op.ask[0]);
      if (!/Nahverkehr/.test(op.ask[0])) expect(op.model + ex.model).not.toMatch(/Nahverkehr|Bus in Luxemburg/);
      expect(qs.find((q) => q.id === 'fazit')!.model).not.toMatch(/Nahverkehr/);
      for (const q of qs.filter((x) => x.id.startsWith('fvg'))) expect(q.ask[0]).not.toMatch(/„Wir müssen (?:berücksichtigen|vorschlagen|beantragen)\./);
      expect(new Set(qs.map((q) => q.id)).size).toBe(qs.length);
      expect(qs.length).toBeGreaterThanOrEqual(10);
    }
    expect(topics.size).toBeGreaterThan(2);
  });

  it('96: a refilled queue never repeats the question just asked', () => {
    const a = { id: 'a' } as BossQuestion;
    const b = { id: 'b' } as BossQuestion;
    expect(noRepeat([a, b], 'a').map((q) => q.id)).toEqual(['b', 'a']);
    expect(noRepeat([a], 'a').map((q) => q.id)).toEqual(['a']);
    const s = newGame('Lucas', 'student', Date.now());
    s.level = 90;
    s.hp = 10_000;
    for (let seed = 1; seed < 30; seed++) {
      const rng = makeRng(seed);
      const f = startBoss(s, rng, 7, undefined, 9);
      f.hp = 99;
      f.maxHp = 99;
      let last = f.current.id;
      for (let i = 0; i < 25; i++) {
        answerBoss(s, f, f.current.model.split(' / ')[0], rng);
        expect(f.current.id).not.toBe(last);
        last = f.current.id;
      }
    }
  });

  it('55: a timeout is not reported twice', () => {
    const s = newGame('Lucas', 'student', Date.now());
    s.hp = 80;
    const rng = makeRng(3);
    const f = startBoss(s, rng);
    const v = answerBoss(s, f, '', rng, true);
    expect(v.ok).toBe(false);
    expect(v.note).toBeNull();
  });
});
