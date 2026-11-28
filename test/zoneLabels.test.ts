import { describe, expect, it } from 'vitest';
import { generateMap, MAP_H, MAP_W, TILE, zonesOf, type RegionId } from '../src/game/map';
import { SCENES } from '../src/data/world';
import { labelObstacles, placeZoneLabel, type Box } from '../src/game/zoneLabels';

// 1.0.12 试玩 (Lucas 11-28): zone names on the scene map stand on plates, off the scene circles and each other.
describe('zone name plates on the scene map', () => {
  const regions = [...new Set(SCENES.map((s) => s.region))] as RegionId[];
  it.each(regions)('region %i: plates stay in bounds, clear of scene circles and of each other', (region) => {
    const map = generateMap(region);
    const obs = labelObstacles(map, region, true);
    const bounds = { x0: 50, x1: MAP_W * TILE - 50, y0: 50, y1: MAP_H * TILE - 50 };
    const placed: Box[] = [];
    let fieldNo = 0;
    for (const z of zonesOf(region)) {
      if (z.id === 'camp' || z.id === 'markt') continue;
      const at = SCENES.filter((x) => x.region === region && x.type === 'field' && x.zone === z.id).map((x) => x.at);
      const pref = at.length ? { x: (at.reduce((a, p) => a + p.x, 0) / at.length) * TILE + 8, y: (fieldNo++ % 2 ? 27.6 : 20.4) * TILE } : { x: (z.rect.x + z.rect.w * 0.75) * TILE, y: (z.rect.y + 1.2) * TILE };
      const w = 96;
      const h = 22;
      const c = placeZoneLabel({ tiles: map.tiles, pref, w, h, obs, placed, bounds });
      const b = { x0: c.x - w / 2, x1: c.x + w / 2, y0: c.y - h / 2, y1: c.y + h / 2 };
      expect(b.x0).toBeGreaterThanOrEqual(bounds.x0);
      expect(b.x1).toBeLessThanOrEqual(bounds.x1);
      for (const n of obs.nodes) expect(n.x + 9 < b.x0 || n.x - 9 > b.x1 || n.y + 9 < b.y0 || n.y - 9 > b.y1, `${z.id} on a circle`).toBe(true);
      for (const p of placed) expect(b.x1 <= p.x0 || b.x0 >= p.x1 || b.y1 <= p.y0 || b.y0 >= p.y1, `${z.id} on another plate`).toBe(true);
      placed.push(b);
    }
  });
});
