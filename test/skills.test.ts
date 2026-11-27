import { describe, expect, it } from 'vitest';
import { newGame } from '../src/core/state';
import { makeRng } from '../src/core/rng';
import { WORDS } from '../src/data/words';
import { availableMoves, makeQuestion, phaseOf, poolReady, resolveTurn, startBattle } from '../src/core/combat';

// 技能池 in battle (游戏设计 十).
describe('pool skills in battle', () => {
  const noun = WORDS.find((w) => w.de === 'Apfel')!;
  it('skills show from level 10; a skill that can not target the word is not ready', () => {
    const s = newGame('T', 'student');
    s.level = 9;
    expect(availableMoves(s, startBattle(s, noun, makeRng(1)))).not.toContain('skill');
    s.level = 15;
    s.loadout = ['split', 'steady'];
    const b = startBattle(s, noun, makeRng(1));
    expect(availableMoves(s, b)).toContain('skill');
    expect(poolReady(s, b, 'split')).toBe(false); // Apfel doesn't split
    expect(poolReady(s, b, 'steady')).toBe(true);
  });

  it('格之封印: ×1.4 and breaks the armor for 3 hits', () => {
    const s = newGame('T', 'student');
    s.level = 61;
    s.hp = 99999;
    s.loadout = ['seal'];
    const b = startBattle(s, noun, makeRng(1));
    b.monster.hp = b.monster.maxHp = 99999;
    b.phase = phaseOf(b) ?? undefined;
    const q = makeQuestion(s, b, 'skill', makeRng(2), 'seal');
    expect(q.pool).toBe('seal');
    const r = resolveTurn(s, b, 'skill', q, q.answer!, makeRng(3));
    expect(r.correct).toBe(true);
    expect(b.monster.broken).toBeGreaterThan(0);
    expect(r.log.some((l) => l.text.includes('×1.4'))).toBe(true);
  });

  it('听写 asks the example without Chinese and reads it aloud', () => {
    const s = newGame('T', 'student');
    s.level = 81;
    s.loadout = ['dictate'];
    const b = startBattle(s, noun, makeRng(1));
    const q = makeQuestion(s, b, 'skill', makeRng(2), 'dictate');
    expect(q.listen).toBeTruthy();
    expect(q.prompt).not.toMatch(/[苹果]/);
  });
});
