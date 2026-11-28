import { describe, expect, it } from 'vitest';
import { PERSUADE_SCENES } from '../src/core/persuade';
import { REGION_PERSUADE, regionPersuade } from '../src/data/persuadeRegions';
import { AREAS } from '../src/data/world';
import { regionGrammar } from '../src/core/adventurers';
import { makeRng } from '../src/core/rng';

// 说服段 · 各区说服对象 (Lucas 2026-11-28).
describe('各区说服对象', () => {
  it('every map region has 2–3, ids unique and apart from the 通用 five', () => {
    const ids = new Set(PERSUADE_SCENES.map((p) => p.id));
    for (const a of AREAS) {
      const list = regionPersuade(a.region);
      expect(list.length, `region ${a.region}`).toBeGreaterThanOrEqual(2);
      expect(list.length).toBeLessThanOrEqual(3);
      for (const p of list) {
        expect(ids.has(p.id), p.id).toBe(false);
        ids.add(p.id);
        expect(p.intro).toContain(p.formal ? '用 Sie' : '用 du');
      }
    }
    expect(Object.keys(REGION_PERSUADE).every((r) => AREAS.some((a) => a.region === Number(r)))).toBe(true);
  });
  it('scene plus the region grammar stays under the cloud clip (400)', () => {
    for (const a of AREAS)
      for (const p of regionPersuade(a.region)) {
        const g = regionGrammar(a.region, 200, makeRng(1));
        expect(`${p.scene}说话时自然用到这些语法（别讲语法）：${g.join('、')}。`.length).toBeLessThan(400);
      }
  });
});
