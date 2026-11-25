import { describe, expect, it } from 'vitest';
import { newGame } from '../src/core/state';
import { makeRng } from '../src/core/rng';
import { WORDS } from '../src/data/words';
import { drawPractice, gradeCompose, practiceWords } from '../src/core/aiPractice';
import { duelTurns, DUEL } from '../src/data/grammar/duels';
import { AI_TUTOR } from '../src/net/aiTutor';

// AI 练习 (游戏设计 rev 459).
const DAY = 86400000;
const nouns = WORDS.filter((w) => w.pos === 'n' && w.art && !w.de.includes(' ')).slice(0, 12);

describe('AI practice words', () => {
  it('takes 半名 and due words, never retired or new ones; due first', () => {
    const s = newGame('T', 'student');
    const t = Date.now();
    const p = (stage: 1 | 2 | 3, due: number, retired = false) => ({ stage, due, firstSeen: 0, lastSeen: t - DAY, relapse: 0, correct: 1, wrong: 0, read: 1, ...(retired ? { retired: t } : {}) });
    s.words[nouns[0].id] = p(2, t + DAY); // 半名, not due
    s.words[nouns[1].id] = p(3, t - 10 * DAY); // 归名, review due
    s.words[nouns[2].id] = p(3, t + 5 * DAY, true); // retired
    s.words[nouns[3].id] = p(1, t + DAY); // 裂形, not due
    const ids = practiceWords(s, t).map((w) => w.id);
    expect(ids).toContain(nouns[0].id);
    expect(ids).toContain(nouns[1].id);
    expect(ids).not.toContain(nouns[2].id);
    expect(ids).not.toContain(nouns[3].id);
    expect(ids).not.toContain(nouns[4].id);
    expect(ids[0]).toBe(nouns[1].id);
    expect(drawPractice(s, 5, makeRng(1), t)).toHaveLength(2);
  });

  it('造句 by rule: must use the word, 3+ words, no sure article mistake', () => {
    const w = nouns.find((x) => x.art === 'der')!;
    expect(gradeCompose(`Ich sehe den ${w.de}.`, w).ok).toBe(true);
    expect(gradeCompose('Ich bin müde.', w).ok).toBe(false);
    expect(gradeCompose(w.de, w).ok).toBe(false);
    expect(gradeCompose(`Ich sehe das ${w.de}.`, w).ok).toBe(false);
  });

  it('opens at 10 (essay 20); duels are 3–4 turns below 20, 6–8 from 20', () => {
    expect(AI_TUTOR.grade).toBe(10);
    expect(AI_TUTOR.essay).toBe(20);
    expect(DUEL.from).toBe(10);
    const rng = makeRng(4);
    for (let i = 0; i < 30; i++) {
      const a = duelTurns(15, rng);
      const b = duelTurns(25, rng);
      expect(a >= 3 && a <= 4).toBe(true);
      expect(b >= 6 && b <= 8).toBe(true);
    }
  });
});
