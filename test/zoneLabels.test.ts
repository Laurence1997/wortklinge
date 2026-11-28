import { describe, expect, it } from 'vitest';
import { generateMap, MAP_H, MAP_W, TILE, zonesOf, type RegionId } from '../src/game/map';
import { SCENES } from '../src/data/world';
import { HUD_MAP_PX, placeFieldLabel, labelObstacles, placeZoneLabel, ZONE_LABEL_DEPTH_ROUTE, type Box } from '../src/game/zoneLabels';

// 1.0.12 试玩 (Lucas 11-28): zone names on the scene map stand on plates, off the scene circles and each other.
describe('zone name plates on the scene map', () => {
  const regions = [...new Set(SCENES.map((s) => s.region))] as RegionId[];
  it.each(regions)('region %i: plates stay in bounds, clear of scene circles and of each other', (region) => {
    const map = generateMap(region);
    const obs = labelObstacles(map, region, true);
    const bounds = { x0: 50, x1: MAP_W * TILE - 50, y0: 50, y1: MAP_H * TILE - 50 };
    const placed: Box[] = [];
    const covers: number[] = [];
    for (const z of zonesOf(region)) {
      if (z.id === 'camp' || z.id === 'markt') continue;
      const at = SCENES.filter((x) => x.region === region && x.type === 'field' && x.zone === z.id).map((x) => x.at);
      const w = 96;
      const h = 22;
      const town = !at.length;
      const args = { tiles: map.tiles, w, h, obs, placed, above: true, bounds: town ? { ...bounds, x0: 48 + HUD_MAP_PX } : bounds };
      const c = town ? placeZoneLabel({ ...args, pref: { x: (z.rect.x + z.rect.w * 0.75) * TILE, y: (z.rect.y + 1.2) * TILE } }) : placeFieldLabel(args, at);
      const b = { x0: c.x - w / 2, x1: c.x + w / 2, y0: c.y - h / 2, y1: c.y + h / 2 };
      expect(b.x0).toBeGreaterThanOrEqual(town ? 48 + HUD_MAP_PX : bounds.x0);
      // Drawn above the figures: off every monster patch, NPC and sign, at most grazing one.
      let cover = 0;
      for (const o of obs.boxes) cover += Math.max(0, Math.min(b.x1, o.x1) - Math.max(b.x0, o.x0)) * Math.max(0, Math.min(b.y1, o.y1) - Math.max(b.y0, o.y0));
      covers.push(cover / (w * h));
      expect(b.x1).toBeLessThanOrEqual(bounds.x1);
      for (const n of obs.nodes) expect(n.x + 9 < b.x0 || n.x - 9 > b.x1 || n.y + 9 < b.y0 || n.y - 9 > b.y1, `${z.id} on a circle`).toBe(true);
      for (const p of placed) expect(b.x1 <= p.x0 || b.x0 >= p.x1 || b.y1 <= p.y0 || b.y0 >= p.y1, `${z.id} on another plate`).toBe(true);
      placed.push(b);
    }
    // 区内路网 (方案 3): routes fill more of the map than the old grid did, so a plate may graze a patch a little more.
    for (const c of covers) expect(c).toBeLessThan(0.1);
  });

  it('the scene map draws the plates above the route lines and below the scene circles', () => {
    // nodes.ts: route graphics at depth 3000, circles and numbers at 3001.
    expect(ZONE_LABEL_DEPTH_ROUTE).toBeGreaterThan(3000);
    expect(ZONE_LABEL_DEPTH_ROUTE + 0.1).toBeLessThan(3001);
  });
});
