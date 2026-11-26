import { describe, expect, it } from 'vitest';
import { mapRamp } from '../src/game/palette';
import { ERODE_DEF, REGION_DEF } from '../src/data/zones';

describe('颜色 = 找回的语言', () => {
  it('an open 蚀变 darkens its old regions; beating its boss gives the colours back', () => {
    const own = REGION_DEF[4]!.palette;
    const flags: Record<string, unknown> = { [`boss${ERODE_DEF[11]!.after}Kills`]: 1 };
    expect(mapRamp(4, flags)).not.toEqual(own);
    flags.boss11Kills = 1;
    expect(mapRamp(4, flags)).toEqual(own);
  });
  it('after the last boss every map has its colours', () => {
    const flags: Record<string, unknown> = { [`boss${ERODE_DEF[19]!.after}Kills`]: 1, boss20Kills: 1 };
    expect(mapRamp(10, flags)).toEqual(REGION_DEF[10]!.palette);
  });
});
