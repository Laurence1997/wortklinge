import { describe, expect, it } from 'vitest';
import { revealLines, SYSTEM_TYPOS } from '../src/data/reveal17';
import { REGION_DEF } from '../src/data/zones';
import { SCENE_BY_ID } from '../src/data/world';

describe('17 区揭示 and the system typos', () => {
  it('every typo sits in its region’s system entry line, once', () => {
    expect(SYSTEM_TYPOS.length).toBeGreaterThanOrEqual(6);
    expect(SYSTEM_TYPOS.length).toBeLessThanOrEqual(8);
    for (const t of SYSTEM_TYPOS) {
      const sys = REGION_DEF[t.region]!.enter.find((x) => x.startsWith('系统：'))!;
      expect(sys, `region ${t.region}`).toContain(t.wrong);
      expect(t.region).toBeLessThanOrEqual(16);
    }
  });

  it('the reveal happens at Ilse’s workbench and reads back the typos seen', () => {
    expect(SCENE_BY_ID['r17-hide']).toBeTruthy();
    const lines = revealLines([4, 9]);
    const all = lines.map((l) => l.text).join('');
    expect(all).toContain('住那里');
    expect(all).toContain('不在停下来');
    expect(all).not.toContain('张了多少');
    expect(lines.some((l) => l.who === '林远')).toBe(true);
    // Red line: never "learning more brings the end closer".
    expect(all).toContain('学得越多，它越拿你没办法');
  });
});
