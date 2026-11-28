// 1.0.12 试玩修复 g5 (panels / texts): 74 对错计数, 44 推定会筛选, 82 委托文字, 97 新能力列表括号, 62 / 54 文案.
import { describe, expect, it } from 'vitest';
import { newGame, type GameState } from '../src/core/state';
import { countAnswer, flushSkill, recordKill } from '../src/core/srs';
import { screenPool } from '../src/core/screen';
import { dailyText } from '../src/core/dailies';
import { unlockHead, UNLOCK_TEXT } from '../src/core/unlocks';
import { CONFIG } from '../src/core/config';
import { WORDS } from '../src/data/words';

const T0 = new Date('2026-11-28T12:00:00').getTime();

function game(level = 5): GameState {
  const s = newGame('T', 'student', T0);
  s.timeOffset = T0 - Date.now();
  s.level = level;
  return s;
}

describe('1.0.12 g5', () => {
  it('74: answers on a new word in its first fight reach the wordbook once it joins', () => {
    const s = game();
    const w = WORDS.find((x) => !x.tutorial && x.pos === 'n')!;
    const b: { rightN?: number; wrongN?: number; readOk?: number; writeOk?: number } = {};
    countAnswer(s, w, true, b);
    countAnswer(s, w, true, b);
    countAnswer(s, w, false, b);
    expect(s.words[w.id]).toBeUndefined();
    recordKill(s, w, false, false);
    flushSkill(s, w, b);
    expect([s.words[w.id].correct, s.words[w.id].wrong]).toEqual([2, 1]);
    countAnswer(s, w, true, b); // in the wordbook now: counted straight away
    expect(s.words[w.id].correct).toBe(3);
    expect(b.rightN).toBe(0);
  });

  it('44: 「只筛推定会」 asks only 推定会 words', () => {
    const s = game(40);
    const [a, c] = WORDS.filter((x) => !x.tutorial && x.pos === 'n' && x.family !== 'truhe').slice(0, 2);
    s.words[a.id] = { stage: 3, due: T0 + 1e9, firstSeen: T0, lastSeen: T0, relapse: 0, correct: 0, wrong: 0, placed: T0 };
    const pool = screenPool(s, 'placed');
    expect(pool.map((x) => x.id)).toContain(a.id);
    expect(pool.map((x) => x.id)).not.toContain(c.id);
  });

  it('82: the 半名 daily lists German names, not glued Chinese glosses', () => {
    const w = WORDS.find((x) => x.pos === 'n' && !x.tutorial)!;
    const t = dailyText({ kind: 'half', scene: undefined, words: [w.id], need: 1, have: 0, done: false } as never);
    expect(t).toContain(w.de);
    expect(t).not.toContain(w.zh);
  });

  it('97: the new-ability head keeps brackets whole', () => {
    expect(unlockHead('小作文（AI 批改，要登录）：篝火边写')).toBe('小作文（AI 批改，要登录）');
    expect(unlockHead('篝火：休息回满血')).toBe('篝火');
    for (const lines of Object.values(UNLOCK_TEXT)) {
      const head = unlockHead(lines[0]);
      expect((head.match(/（/g) ?? []).length).toBe((head.match(/）/g) ?? []).length);
    }
  });

  it('62 / 54: unlock texts match the rules', () => {
    expect(UNLOCK_TEXT[21].join('')).toContain(`${CONFIG.perfekt.softUntil + 1} 级前选错不罚`);
    expect(UNLOCK_TEXT[9].join('')).not.toContain('墨水或沉着');
  });
});
