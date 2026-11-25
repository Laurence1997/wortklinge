// 复习按表现 (游戏设计 七, Lucas 2026-11-25).
import { describe, expect, it } from 'vitest';
import { newGame } from '../src/core/state';
import { contextFail, contextPass, recordKill } from '../src/core/srs';
import { CONFIG, DAY } from '../src/core/config';
import { WORD_BY_ID } from '../src/data/words';

const T0 = new Date('2026-11-22T12:00:00').getTime();
const R = CONFIG.srs.respawn;

describe('adaptive review', () => {
  it('two slips while learning → 1 day; clean passes ×3; a clean pass over 90 days ends it; a relapse restarts at 1 day', () => {
    const s = newGame('T', 'student', T0);
    const w = WORD_BY_ID['tisch'];
    recordKill(s, w, false, false, T0, { flaw: true, wrongs: 2 });
    recordKill(s, w, false, false, T0 + R, { used: true });
    recordKill(s, w, true, false, T0 + 2 * R);
    const p = s.words[w.id];
    expect(p.ivl).toBe(DAY);
    let t = p.due;
    const gaps: number[] = [];
    for (let i = 0; i < 6; i++) {
      const g = contextPass(s, w, t);
      if (g === null) break;
      gaps.push(g);
      t += g;
    }
    expect(gaps.slice(0, 3)).toEqual([3 * DAY, 9 * DAY, 27 * DAY]);
    expect(p.ctxDone).toBe(true);
    // Shaky pass ×1.5.
    const v = WORD_BY_ID['stuhl'];
    recordKill(s, v, false, false, T0, { flaw: true, wrongs: 1 });
    recordKill(s, v, false, false, T0 + R, { used: true });
    recordKill(s, v, true, false, T0 + 2 * R);
    expect(s.words[v.id].ivl).toBe(3 * DAY);
    expect(contextPass(s, v, s.words[v.id].due, 'shaky')).toBe(4.5 * DAY);
    // Relapse → re-归名 → 1 day.
    contextFail(s, v, T0 + 10 * DAY);
    recordKill(s, v, true, false, T0 + 10 * DAY + 1);
    expect(s.words[v.id].ivl).toBe(DAY);
  });
});
