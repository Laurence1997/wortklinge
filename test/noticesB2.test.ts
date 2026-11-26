import { describe, expect, it } from 'vitest';
import { NOTICES_B2 } from '../src/data/grammar/noticesB2-gen';
import { noticeFor, noticeTask } from '../src/core/gram/notice';

describe('B2 告示怪 / 信件怪', () => {
  it('has 3 notices and 3 letters for each of regions 13–16, 3 questions each with the answer among the options', () => {
    for (const r of [13, 14, 15, 16]) for (const k of ['notice', 'letter']) expect(NOTICES_B2.filter((n) => n.region === r && n.kind === k).length).toBe(3);
    for (const n of NOTICES_B2) {
      expect(n.qs.length).toBe(3);
      for (const q of n.qs) expect(q.options).toContain(q.answer), expect(q.qZh).toBeTruthy();
    }
  });
  it('rides any field monster of its region, not others', () => {
    let i = 0;
    const rng = () => ((i = (i + 0.37) % 1), i);
    expect(noticeFor('r13a', rng, 13)?.region).toBe(13);
    expect(noticeFor('r9a', rng, 9)).toBeNull();
    const n = NOTICES_B2[0];
    expect(noticeTask(n, 0, rng).passage).toBe(n.text);
  });
});
