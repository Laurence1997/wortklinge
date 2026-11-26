import { describe, expect, it } from 'vitest';
import { WEBER18 } from '../src/data/weber18';

describe('18 区 Frau Weber 的选择', () => {
  it('is 6–8 lines, her lines in German with Chinese', () => {
    expect(WEBER18.length).toBeGreaterThanOrEqual(6);
    expect(WEBER18.length).toBeLessThanOrEqual(8);
    for (const l of WEBER18) if (l.who === 'weber') expect(l.de && l.text).toBeTruthy();
  });
  it('uses region 18 concession', () => {
    expect(WEBER18.some((l) => /Zwar .+ aber/.test(l.de ?? ''))).toBe(true);
  });
});
