// 1.0.12 试玩 (Lucas 11-28「修改」): zone names on the scene map («回声巷 · Lv 1–3 / Echogasse») sat faintly right on
// the rooftops. Each one now stands on its own small plate, in the freest spot near where it used to be: off the
// scene circles and the route, off the monster spots around each scene, off NPCs and signs, and over as little
// roof and wall as the street plan allows. Pure (no Phaser), so the choice can be tested.

import { LINKS, SCENES } from '../data/world';
import { MAP_H, MAP_W, T, TILE, type MapData, type RegionId } from './map';

export interface Box {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

/** Where the zone name plates lie: above the map and its lamp glows, below every y-sorted figure (monsters, NPCs and
 *  their name plates, signs) and the route (3000). */
export const ZONE_LABEL_DEPTH = 1;

/** Scene circles are drawn with radius 9 (nodes.ts); a little air around them. */
const NODE_R = 12;
/** Monsters stand at these offsets from their scene's circle (nodes.ts OFFSETS) with their plates above them: the
 *  whole patch counts as busy. */
const MONSTER_PATCH = { x0: -44, x1: 44, y0: -66, y1: 30 };
/** Visual weight of a tile under a plate: houses and walls worst, small props a little, open ground nothing. */
const TILE_COST: Partial<Record<number, number>> = {
  [T.Roof]: 3,
  [T.Wall]: 3,
  [T.Door]: 3,
  [T.Keep]: 3,
  [T.Tree]: 2,
  [T.Lamp]: 2,
  [T.Tent]: 2,
  [T.Crate]: 2,
  [T.Rubble]: 1,
  [T.Crop]: 1,
};

export interface LabelObstacles {
  nodes: Array<{ x: number; y: number }>;
  segs: Array<[number, number, number, number]>;
  boxes: Box[];
}

/** Everything on the map a zone name should keep clear of. `nodes` false: the old walking map (no route). */
export function labelObstacles(map: MapData, region: RegionId, nodes: boolean): LabelObstacles {
  const at = (x: number, y: number) => ({ x: x * TILE + 8, y: y * TILE + 8 });
  const scenes = nodes ? SCENES.filter((s) => s.region === region) : [];
  const ids = new Set(scenes.map((s) => s.id));
  const pos = new Map(scenes.map((s) => [s.id, at(s.at.x, s.at.y)]));
  const segs: Array<[number, number, number, number]> = [];
  for (const [a, b] of LINKS) {
    if (!ids.has(a) || !ids.has(b)) continue;
    const pa = pos.get(a)!;
    const pb = pos.get(b)!;
    segs.push([pa.x, pa.y, pb.x, pb.y]);
  }
  const boxes: Box[] = [];
  for (const s of scenes) if (s.type === 'field' || s.type === 'hidden') {
    const p = pos.get(s.id)!;
    boxes.push({ x0: p.x + MONSTER_PATCH.x0, x1: p.x + MONSTER_PATCH.x1, y0: p.y + MONSTER_PATCH.y0, y1: p.y + MONSTER_PATCH.y1 });
  }
  // NPCs (with their name above), signs, the bonfire and the gates.
  for (const n of map.npcs) boxes.push({ x0: n.x * TILE - 16, x1: n.x * TILE + 32, y0: n.y * TILE - 16, y1: n.y * TILE + 16 });
  for (const p of [...map.signs, ...map.gates, map.bonfire]) boxes.push({ x0: p.x * TILE - 4, x1: p.x * TILE + 20, y0: p.y * TILE - 8, y1: p.y * TILE + 18 });
  return { nodes: scenes.map((s) => pos.get(s.id)!), segs, boxes };
}

const overlap = (a: Box, b: Box) => Math.max(0, Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0)) * Math.max(0, Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0));

function segHitsBox(s: [number, number, number, number], b: Box): boolean {
  // Liang–Barsky clip of the segment against the box.
  const [x0, y0, x1, y1] = s;
  const dx = x1 - x0;
  const dy = y1 - y0;
  let t0 = 0;
  let t1 = 1;
  for (const [p, q] of [[-dx, x0 - b.x0], [dx, b.x1 - x0], [-dy, y0 - b.y0], [dy, b.y1 - y0]] as const) {
    if (p === 0) {
      if (q < 0) return false;
      continue;
    }
    const r = q / p;
    if (p < 0) t0 = Math.max(t0, r);
    else t1 = Math.min(t1, r);
    if (t0 > t1) return false;
  }
  return true;
}

export interface PlaceArgs {
  tiles: Uint8Array;
  /** Where the name used to stand (its centre). */
  pref: { x: number; y: number };
  /** The plate's size in map pixels. */
  w: number;
  h: number;
  obs: LabelObstacles;
  /** Plates already placed (they must not touch). */
  placed: Box[];
  /** The part of the map the camera can show. */
  bounds: Box;
}

/** How bad a plate there would be (0 = open ground right where it used to stand). */
export function plateCost(a: PlaceArgs, cx: number, cy: number): number {
  const b: Box = { x0: cx - a.w / 2, x1: cx + a.w / 2, y0: cy - a.h / 2, y1: cy + a.h / 2 };
  if (b.x0 < a.bounds.x0 || b.x1 > a.bounds.x1 || b.y0 < a.bounds.y0 || b.y1 > a.bounds.y1) return Infinity;
  const area = a.w * a.h;
  let cost = 0;
  for (const p of a.placed) if (overlap(b, { x0: p.x0 - 8, x1: p.x1 + 8, y0: p.y0 - 4, y1: p.y1 + 4 }) > 0) cost += 5000;
  for (const n of a.obs.nodes) if (overlap(b, { x0: n.x - NODE_R, x1: n.x + NODE_R, y0: n.y - NODE_R, y1: n.y + NODE_R }) > 0) cost += 2000;
  for (const s of a.obs.segs) if (segHitsBox(s, { x0: b.x0 - 2, x1: b.x1 + 2, y0: b.y0 - 2, y1: b.y1 + 2 })) cost += 400;
  for (const o of a.obs.boxes) cost += (600 * overlap(b, o)) / area;
  // Tiles under the plate, weighted by how much of each it covers.
  let tiles = 0;
  for (let ty = Math.floor(b.y0 / TILE); ty <= Math.floor((b.y1 - 0.01) / TILE); ty++)
    for (let tx = Math.floor(b.x0 / TILE); tx <= Math.floor((b.x1 - 0.01) / TILE); tx++) {
      if (tx < 0 || ty < 0 || tx >= MAP_W || ty >= MAP_H) continue;
      const k = TILE_COST[a.tiles[ty * MAP_W + tx]];
      if (k) tiles += k * overlap(b, { x0: tx * TILE, x1: tx * TILE + TILE, y0: ty * TILE, y1: ty * TILE + TILE });
    }
  cost += (60 * tiles) / area;
  // Stay near home: a few tiles off is cheap, far off is not.
  cost += Math.hypot(cx - a.pref.x, (cy - a.pref.y) * 1.3) / 4;
  return cost;
}

/** The plate's centre: the cheapest spot within about six tiles across and five up or down of where it used to be. */
export function placeZoneLabel(a: PlaceArgs): { x: number; y: number } {
  let best = { x: a.pref.x, y: a.pref.y };
  let bestCost = Infinity;
  for (let dy = -80; dy <= 80; dy += 4)
    for (let dx = -96; dx <= 96; dx += 4) {
      const x = Math.round(a.pref.x + dx);
      const y = Math.round(a.pref.y + dy);
      const c = plateCost(a, x, y);
      if (c < bestCost) (bestCost = c), (best = { x, y });
    }
  // Nothing fits inside the bounds (a tiny map): clamp to them.
  if (bestCost === Infinity)
    best = {
      x: Math.round(Math.min(Math.max(a.pref.x, a.bounds.x0 + a.w / 2), a.bounds.x1 - a.w / 2)),
      y: Math.round(Math.min(Math.max(a.pref.y, a.bounds.y0 + a.h / 2), a.bounds.y1 - a.h / 2)),
    };
  return best;
}
