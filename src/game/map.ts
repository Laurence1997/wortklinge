// Maps. Region 1: 最后的营地 — a fog-locked block of a ruined German town.
// Region 2: 面包集市 — the market behind the neighbour's door.
// Region 3: 铁轨镇 — the rail town over the bridge east of the granary (0.6).
// Generated from fixed seeds so every player walks the same streets. Both maps are 74×48.

import { makeRng } from '../core/rng';
import { LINKS, SCENES } from '../data/world';
import { REGION_DEF, REGION_DEFS, fieldLevels, type RegionDef } from '../data/zones';
import { LEX_FIELDS } from '../data/lexicon';
import type { RegionNo, ZoneId } from '../core/types';

export const TILE = 16;
export const MAP_W = 74;
export const MAP_H = 48;

export const enum T {
  Ground = 0,
  Road = 1,
  Wall = 2,
  Rubble = 3,
  Tree = 4,
  Fog = 5,
  Ash = 6,
  Lamp = 7,
  Door = 8,
  Tent = 9,
  Crate = 10,
  Roof = 11,
  /** Ponds, canals and the sea (各区布局). */
  Water = 12,
  /** Vegetable beds (Tiny Farm). */
  Crop = 13,
  /** Railway track (walkable). */
  Rail = 14,
  /** Castle walls and theatre seats. */
  Keep = 15,
}

const BLOCKING = new Set<number>([T.Wall, T.Rubble, T.Tree, T.Fog, T.Lamp, T.Tent, T.Crate, T.Roof, T.Door, T.Water, T.Crop, T.Keep]);

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export type RegionId = RegionNo;
export type NpcId = 'hilde' | 'greta' | 'mira' | 'konrad' | 'examiner' | 'brandt' | 'lina' | 'weber';

export interface ZoneDef {
  id: ZoneId;
  region: RegionId;
  zh: string;
  de: string;
  rect: Rect;
  levels: string;
  monsters: number;
}

export const ZONES: ZoneDef[] = [
  { id: 'camp', region: 1, zh: '余烬营地', de: 'Glutheim', rect: { x: 4, y: 17, w: 15, h: 15 }, levels: '安全区', monsters: 0 },
  { id: 'markt', region: 2, zh: '面包集市', de: 'Brotmarkt', rect: { x: 4, y: 13, w: 18, h: 23 }, levels: '主城', monsters: 0 },
  { id: 'gleisdorf', region: 3, zh: '铁轨镇广场', de: 'Gleisdorf', rect: { x: 4, y: 13, w: 18, h: 23 }, levels: '主城', monsters: 0 },
  ...REGION_DEFS.map((d): ZoneDef => ({ id: `r${d.region}hub` as ZoneId, region: d.region, zh: d.hubZh, de: d.de, rect: { x: 4, y: 13, w: 18, h: 23 }, levels: '主城', monsters: 0 })),
  // Fields of every region (6000 词导入): names from the lexicon / zones.ts, the rect round the field's scenes.
  ...([1, 2, 3, ...REGION_DEFS.map((d) => d.region)] as RegionId[]).flatMap(fieldZones),
];

function fieldZones(region: RegionId): ZoneDef[] {
  const d = REGION_DEF[region];
  return (LEX_FIELDS[region] ?? []).map(([id, zh, de], i) => {
    const at = SCENES.filter((sc) => sc.region === region && sc.type === 'field' && sc.zone === id).map((sc) => sc.at);
    const x0 = Math.max(2, Math.min(...at.map((p) => p.x)) - 3);
    const y0 = Math.max(2, Math.min(...at.map((p) => p.y)) - 3);
    const x1 = Math.min(MAP_W - 3, Math.max(...at.map((p) => p.x)) + 3);
    const y1 = Math.min(MAP_H - 3, Math.max(...at.map((p) => p.y)) + 3);
    const [lo, hi] = fieldLevels(region, i);
    return { id: id as ZoneId, region, zh: d?.fields[i]?.zh ?? zh, de: d?.fields[i]?.de ?? de, rect: { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 }, levels: `Lv ${lo}–${hi}`, monsters: 10 };
  });
}

export function zonesOf(region: RegionId): ZoneDef[] {
  return ZONES.filter((z) => z.region === region);
}

export interface MapData {
  region: RegionId;
  tiles: Uint8Array;
  bonfire: { x: number; y: number };
  npcs: Array<{ id: NpcId; x: number; y: number }>;
  /** Walk onto a gate tile and press E to travel to the other region. */
  gates: Array<{ x: number; y: number; to: RegionId }>;
  sign: { x: number; y: number };
  door: { x: number; y: number };
  start: { x: number; y: number };
  lamps: Array<{ x: number; y: number }>;
  signs: Array<{ x: number; y: number; wordId: string }>;
}

export function idx(x: number, y: number): number {
  return y * MAP_W + x;
}

export function generateMap(region: RegionId = 1): MapData {
  const later = REGION_DEF[region];
  const m = later ? generateLater(later) : region === 3 ? generateRegion3() : region === 2 ? generateRegion2() : generateRegion1();
  // Every scene stands on open road whatever the street style drew there (the route map sits on these tiles).
  for (const sc of SCENES) if (sc.region === region) m.tiles[idx(sc.at.x, sc.at.y)] = T.Road;
  return m;
}

function generateRegion1(): MapData {
  const rng = makeRng(20261119);
  const tiles = new Uint8Array(MAP_W * MAP_H).fill(T.Ground);
  const set = (x: number, y: number, t: T) => {
    if (x >= 0 && y >= 0 && x < MAP_W && y < MAP_H) tiles[idx(x, y)] = t;
  };
  const get = (x: number, y: number) => tiles[idx(x, y)];

  // Fog border: the camp is sealed in (浓雾散开 at Lv10, region 2).
  for (let y = 0; y < MAP_H; y++)
    for (let x = 0; x < MAP_W; x++) {
      const edge = Math.min(x, y, MAP_W - 1 - x, MAP_H - 1 - y);
      if (edge < 2 || (edge < 3 && rng() < 0.5)) set(x, y, T.Fog);
    }

  // Main road from the camp to the neighbour's door, and the two side streets.
  for (let x = 12; x < 70; x++) for (let dy = 0; dy < 2; dy++) set(x, 24 + dy, T.Road);
  for (let y = 5; y < 44; y++) for (let dx = 0; dx < 2; dx++) set(39 + dx, y, T.Road);

  // City blocks in each field: streets every 7 tiles, ruined houses between them.
  const blocks = (r: Rect) => {
    for (let y = r.y; y < r.y + r.h; y++)
      for (let x = r.x; x < r.x + r.w; x++) {
        const lx = x - r.x;
        const ly = y - r.y;
        if (get(x, y) === T.Fog) continue;
        const street = lx % 7 === 0 || ly % 7 === 0;
        if (street) {
          if (get(x, y) !== T.Road) set(x, y, T.Road);
          continue;
        }
        const bx = lx % 7;
        const by = ly % 7;
        const inner = bx >= 2 && bx <= 5 && by >= 2 && by <= 5;
        if (inner) {
          // Ruined houses: walls with gaps, roofs inside, some blocks collapsed to rubble.
          const blockSeed = Math.floor(lx / 7) * 31 + Math.floor(ly / 7) * 17 + r.x;
          const collapsed = (blockSeed * 7919) % 5 === 0;
          if (collapsed) {
            if (rng() < 0.45) set(x, y, T.Rubble);
          } else if (bx === 2 || bx === 5 || by === 2 || by === 5) {
            set(x, y, rng() < 0.12 ? T.Rubble : T.Wall);
          } else set(x, y, T.Roof);
        } else if (rng() < 0.035) set(x, y, T.Tree);
        else if (rng() < 0.025) set(x, y, T.Crate);
      }
  };
  for (const z of zonesOf(1)) if (z.id !== 'camp') blocks(z.rect);

  // The camp: an ash clearing around the bonfire.
  const bonfire = { x: 11, y: 24 };
  for (let y = bonfire.y - 7; y <= bonfire.y + 7; y++)
    for (let x = bonfire.x - 7; x <= bonfire.x + 8; x++) {
      const d = Math.hypot(x - bonfire.x, (y - bonfire.y) * 1.1);
      if (d < 6.5 && get(x, y) !== T.Fog) set(x, y, T.Ash);
      else if (d < 7.5 && get(x, y) !== T.Fog && get(x, y) !== T.Road && rng() < 0.55) set(x, y, T.Rubble);
    }
  for (let x = bonfire.x + 2; x < 20; x++) for (let dy = 0; dy < 2; dy++) set(x, 24 + dy, T.Road);
  set(bonfire.x - 3, bonfire.y - 3, T.Tent);
  set(bonfire.x + 3, bonfire.y - 3, T.Tent);
  set(bonfire.x - 3, bonfire.y + 3, T.Tent);
  set(bonfire.x - 4, bonfire.y + 1, T.Crate);
  set(bonfire.x + 4, bonfire.y + 3, T.Crate);

  // The neighbour's door at the east end, in a wall that closes the street.
  const door = { x: 70, y: 24 };
  for (let y = 18; y < 31; y++) {
    set(71, y, T.Wall);
    if (y !== 24 && y !== 25) set(70, y, T.Wall);
  }
  set(door.x, 24, T.Door);
  set(door.x, 25, T.Door);

  const lamps = [
    { x: 19, y: 23 },
    { x: 30, y: 26 },
    { x: 38, y: 23 },
    { x: 49, y: 26 },
    { x: 60, y: 23 },
    { x: 68, y: 26 },
    { x: 41, y: 12 },
    { x: 41, y: 36 },
  ];
  for (const l of lamps) set(l.x, l.y, T.Lamp);

  const signs = [
    { x: 21, y: 23, wordId: 'strasse' },
    { x: 42, y: 22, wordId: 'name' },
    { x: 42, y: 27, wordId: 'familie' },
    { x: 15, y: 27, wordId: 'feuer' },
  ];
  for (const sg of signs) if (BLOCKING.has(get(sg.x, sg.y))) set(sg.x, sg.y, T.Ground);
  set(bonfire.x - 2, bonfire.y + 1, T.Ground); // 考官
  set(bonfire.x, bonfire.y + 3, T.Ground); // Mira's camp stall (0.5: the shop opens at Lv7, before region 2)

  return {
    region: 1,
    tiles,
    bonfire,
    npcs: [{ id: 'hilde', x: bonfire.x + 2, y: bonfire.y + 1 }, { id: 'examiner', x: bonfire.x - 2, y: bonfire.y + 1 }, { id: 'mira', x: bonfire.x, y: bonfire.y + 3 }],
    gates: [],
    sign: { x: bonfire.x, y: bonfire.y - 5 },
    door,
    start: { x: bonfire.x + 1, y: bonfire.y + 2 },
    lamps,
    signs,
  };
}

function generateRegion2(): MapData {
  const rng = makeRng(20261120);
  const tiles = new Uint8Array(MAP_W * MAP_H).fill(T.Ground);
  const set = (x: number, y: number, t: T) => {
    if (x >= 0 && y >= 0 && x < MAP_W && y < MAP_H) tiles[idx(x, y)] = t;
  };
  const get = (x: number, y: number) => tiles[idx(x, y)];

  for (let y = 0; y < MAP_H; y++)
    for (let x = 0; x < MAP_W; x++) {
      const edge = Math.min(x, y, MAP_W - 1 - x, MAP_H - 1 - y);
      if (edge < 2 || (edge < 3 && rng() < 0.5)) set(x, y, T.Fog);
    }

  // 各区布局 (Lucas 2026-11-25): the market street, a fountain square, wheat fields and granary barns.
  layoutFields(2, set, get, rng);

  // The market square: ash and cobbles around the bonfire, the bakery and two tents.
  const bonfire = { x: 12, y: 24 };
  for (let y = 14; y < 35; y++)
    for (let x = 4; x < 22; x++) {
      if (get(x, y) === T.Fog) continue;
      const d = Math.hypot(x - bonfire.x, (y - bonfire.y) * 0.9);
      if (d < 4) set(x, y, T.Ash);
      else if (get(x, y) !== T.Road) set(x, y, T.Ground);
    }
  // Konrad's bakery: a small house south-west of the fire, door facing north.
  for (let y = 29; y <= 33; y++)
    for (let x = 5; x <= 11; x++) {
      const edgeB = x === 5 || x === 11 || y === 29 || y === 33;
      set(x, y, edgeB ? (y === 29 && x === 8 ? T.Ground : T.Wall) : T.Roof);
    }
  // Mira's stall and Greta's tent.
  for (let x = 14; x <= 19; x++) set(x, 17, T.Crate);
  set(7, 17, T.Tent);
  set(6, 19, T.Crate);
  set(18, 31, T.Tent);
  for (let x = 4; x < 22; x++) for (let dy = 0; dy < 2; dy++) set(x, 24 + dy, T.Road);

  // The scale room at the east end of the granary: the region boss waits behind it.
  const door = { x: 70, y: 24 };
  for (let y = 18; y < 31; y++) {
    set(71, y, T.Wall);
    if (y !== 24 && y !== 25) set(70, y, T.Wall);
  }
  set(door.x, 24, T.Door);
  set(door.x, 25, T.Door);

  // West gate back to the camp (the neighbour's door, seen from the other side).
  const gate = { x: 2, y: 24 };
  set(1, 24, T.Door);
  set(1, 25, T.Door);
  set(2, 24, T.Road);
  set(2, 25, T.Road);

  const lamps = [
    { x: 21, y: 23 },
    { x: 30, y: 26 },
    { x: 44, y: 23 },
    { x: 49, y: 26 },
    { x: 60, y: 23 },
    { x: 68, y: 26 },
    { x: 24, y: 12 },
    { x: 24, y: 36 },
    { x: 4, y: 23 },
  ];
  for (const l of lamps) set(l.x, l.y, T.Lamp);

  const signs = [
    { x: 23, y: 21, wordId: 'markt' },
    { x: 25, y: 26, wordId: 'preis' },
    { x: 52, y: 22, wordId: 'korn' },
    { x: 11, y: 31, wordId: 'baeckerei' },
  ];
  for (const sg of signs) if (BLOCKING.has(get(sg.x, sg.y))) set(sg.x, sg.y, T.Ground);

  const npcs: MapData['npcs'] = [
    { id: 'hilde', x: 14, y: 26 },
    { id: 'greta', x: 8, y: 18 },
    { id: 'mira', x: 16, y: 18 },
    { id: 'konrad', x: 8, y: 28 },
    { id: 'examiner', x: 12, y: 22 },
  ];
  for (const n of npcs) set(n.x, n.y, T.Ground);
  // 0.6: the rail bridge east of the granary (opens after 吞秤者) leads to region 3. No rng calls, so the rest of
  // the market stays exactly as it was.
  for (let x = 60; x < 72; x++) set(x, 44, T.Road);
  for (let y = 40; y < 45; y++) set(61, y, T.Road);

  return {
    region: 2,
    tiles,
    bonfire,
    npcs,
    gates: [{ x: gate.x, y: gate.y, to: 1 }, { x: gate.x, y: gate.y + 1, to: 1 }],
    sign: { x: bonfire.x, y: bonfire.y - 5 },
    door,
    start: { x: 4, y: 24 },
    lamps,
    signs,
  };
}

function generateRegion3(): MapData {
  const rng = makeRng(20261121);
  const tiles = new Uint8Array(MAP_W * MAP_H).fill(T.Ground);
  const set = (x: number, y: number, t: T) => {
    if (x >= 0 && y >= 0 && x < MAP_W && y < MAP_H) tiles[idx(x, y)] = t;
  };
  const get = (x: number, y: number) => tiles[idx(x, y)];

  for (let y = 0; y < MAP_H; y++)
    for (let x = 0; x < MAP_W; x++) {
      const edge = Math.min(x, y, MAP_W - 1 - x, MAP_H - 1 - y);
      if (edge < 2 || (edge < 3 && rng() < 0.5)) set(x, y, T.Fog);
    }

  // 各区布局 (Lucas 2026-11-25): tracks through the station, the old town north, a freight yard south.
  layoutFields(3, set, get, rng);

  // The town square: ash around the bonfire, the stationmaster's office north, the stalls south.
  const bonfire = { x: 12, y: 24 };
  for (let y = 14; y < 35; y++)
    for (let x = 4; x < 22; x++) {
      if (get(x, y) === T.Fog) continue;
      const d = Math.hypot(x - bonfire.x, (y - bonfire.y) * 0.9);
      if (d < 4) set(x, y, T.Ash);
      else if (get(x, y) !== T.Road) set(x, y, T.Ground);
    }
  for (let y = 14; y <= 18; y++)
    for (let x = 5; x <= 11; x++) {
      const edgeB = x === 5 || x === 11 || y === 14 || y === 18;
      set(x, y, edgeB ? (y === 18 && x === 8 ? T.Ground : T.Wall) : T.Roof);
    }
  for (let x = 14; x <= 19; x++) set(x, 31, T.Crate);
  set(18, 17, T.Tent);
  for (let x = 4; x < 22; x++) for (let dy = 0; dy < 2; dy++) set(x, 24 + dy, T.Road);

  // The last platform at the east end: 晚点之王 waits behind it.
  const door = { x: 70, y: 24 };
  for (let y = 18; y < 31; y++) {
    set(71, y, T.Wall);
    if (y !== 24 && y !== 25) set(70, y, T.Wall);
  }
  set(door.x, 24, T.Door);
  set(door.x, 25, T.Door);

  // West end: the bridge back to the market.
  const gate = { x: 2, y: 24 };
  set(1, 24, T.Door);
  set(1, 25, T.Door);
  set(2, 24, T.Road);
  set(2, 25, T.Road);

  const lamps = [
    { x: 21, y: 23 },
    { x: 30, y: 26 },
    { x: 44, y: 23 },
    { x: 49, y: 26 },
    { x: 60, y: 23 },
    { x: 68, y: 26 },
    { x: 4, y: 23 },
  ];
  for (const l of lamps) set(l.x, l.y, T.Lamp);

  const signs = [
    { x: 23, y: 21, wordId: 'bahnhof' },
    { x: 25, y: 26, wordId: 'altstadt' },
    { x: 52, y: 22, wordId: 'fahrplan' },
  ];
  for (const sg of signs) set(sg.x, sg.y, T.Ground);

  const npcs: MapData['npcs'] = [
    { id: 'hilde', x: 14, y: 26 },
    { id: 'examiner', x: 12, y: 22 },
    { id: 'brandt', x: 8, y: 19 },
    { id: 'weber', x: 10, y: 27 },
    { id: 'mira', x: 16, y: 30 },
    { id: 'greta', x: 18, y: 18 },
  ];
  for (const n of npcs) set(n.x, n.y, T.Ground);
  // 0.7: the road on to region 4 (south-east, opens after 晚点之王). No rng calls, so the town stays as it was.
  for (let x = 60; x < 72; x++) set(x, 44, T.Road);
  for (let y = 40; y < 45; y++) set(61, y, T.Road);

  return {
    region: 3,
    tiles,
    bonfire,
    npcs,
    gates: [{ x: gate.x, y: gate.y, to: 2 }, { x: gate.x, y: gate.y + 1, to: 2 }],
    sign: { x: bonfire.x, y: bonfire.y - 5 },
    door,
    start: { x: 4, y: 24 },
    lamps,
    signs,
  };
}

/** Regions 4–12: the region-3 street plan (rail road west → east, two cross streets, town west, boss door east, gate
 *  back west, road on south-east), each field built in its own style. Seeded per region so everyone walks the same map. */
function generateLater(d: RegionDef): MapData {
  const rng = makeRng(20261200 + d.region);
  const tiles = new Uint8Array(MAP_W * MAP_H).fill(T.Ground);
  const set = (x: number, y: number, t: T) => {
    if (x >= 0 && y >= 0 && x < MAP_W && y < MAP_H) tiles[idx(x, y)] = t;
  };
  const get = (x: number, y: number) => tiles[idx(x, y)];

  for (let y = 0; y < MAP_H; y++)
    for (let x = 0; x < MAP_W; x++) {
      const edge = Math.min(x, y, MAP_W - 1 - x, MAP_H - 1 - y);
      if (edge < 2 || (edge < 3 && rng() < 0.5)) set(x, y, T.Fog);
    }
  // 各区布局 (Lucas 2026-11-25): every region past 3 gets its own street plan east of the town square.
  layoutFields(d.region, set, get, rng);
  // Scenes stand on open ground whatever the field style drew there (the route map sits on these tiles).
  for (const sc of SCENES) if (sc.region === d.region) set(sc.at.x, sc.at.y, T.Road);

  // The town square: ash round the bonfire, a hall north, stalls south.
  const bonfire = { x: 12, y: 24 };
  for (let y = 14; y < 35; y++)
    for (let x = 4; x < 22; x++) {
      if (get(x, y) === T.Fog) continue;
      const dd = Math.hypot(x - bonfire.x, (y - bonfire.y) * 0.9);
      if (dd < 4) set(x, y, T.Ash);
      else if (get(x, y) !== T.Road) set(x, y, T.Ground);
    }
  for (let y = 14; y <= 18; y++)
    for (let x = 5; x <= 11; x++) {
      const edgeB = x === 5 || x === 11 || y === 14 || y === 18;
      set(x, y, edgeB ? (y === 18 && x === 8 ? T.Ground : T.Wall) : T.Roof);
    }
  for (let x = 14; x <= 19; x++) set(x, 31, T.Crate);
  set(18, 17, T.Tent);
  for (let x = 4; x < 22; x++) for (let dy = 0; dy < 2; dy++) set(x, 24 + dy, T.Road);

  const door = { x: 70, y: 24 };
  for (let y = 18; y < 31; y++) {
    set(71, y, T.Wall);
    if (y !== 24 && y !== 25) set(70, y, T.Wall);
  }
  set(door.x, 24, T.Door);
  set(door.x, 25, T.Door);
  const gate = { x: 2, y: 24 };
  set(1, 24, T.Door);
  set(1, 25, T.Door);
  set(2, 24, T.Road);
  set(2, 25, T.Road);
  // The road on to the next region (south-east), like the rail bridge in region 2.
  for (let x = 60; x < 72; x++) set(x, 44, T.Road);
  for (let y = 40; y < 45; y++) set(61, y, T.Road);

  const lamps = [
    { x: 21, y: 23 }, { x: 30, y: 26 }, { x: 44, y: 23 }, { x: 49, y: 26 }, { x: 60, y: 23 }, { x: 68, y: 26 }, { x: 4, y: 23 },
  ];
  // Lamps stand on open ground only (the layouts put water and houses where the old grid had streets).
  const lampsHere = lamps.filter((l) => [T.Ground, T.Road, T.Ash].includes(get(l.x, l.y)));
  for (const l of lampsHere) set(l.x, l.y, T.Lamp);

  const npcs: MapData['npcs'] = [
    { id: 'hilde', x: 14, y: 26 },
    { id: 'examiner', x: 12, y: 22 },
    { id: 'mira', x: 16, y: 30 },
    { id: 'greta', x: 18, y: 18 },
  ];
  for (const n of npcs) set(n.x, n.y, T.Ground);

  return {
    region: d.region,
    tiles,
    bonfire,
    npcs,
    gates: [{ x: gate.x, y: gate.y, to: (d.region - 1) as RegionId }, { x: gate.x, y: gate.y + 1, to: (d.region - 1) as RegionId }],
    sign: { x: bonfire.x, y: bonfire.y - 5 },
    door,
    start: { x: 4, y: 24 },
    lamps: lampsHere,
    signs: [],
  };
}

type SetT = (x: number, y: number, t: T) => void;
type GetT = (x: number, y: number) => number;
export type LayoutKind = 'blocks' | 'spa' | 'harbour' | 'boulevard' | 'works' | 'ring' | 'garden' | 'market' | 'rail' | 'citadel' | 'canals' | 'theatre' | 'maze' | 'court' | 'islands';
/** Street plan of each region east of its town square: every region its own (Lucas 2026-11-25: 每个图风格都不同). */
export const LAYOUT: Partial<Record<number, LayoutKind>> = {
  2: 'market', 3: 'rail', 4: 'blocks', 5: 'spa', 6: 'harbour', 7: 'boulevard', 9: 'works', 10: 'ring', 12: 'garden',
  13: 'citadel', 14: 'canals', 16: 'theatre', 17: 'maze', 18: 'court', 20: 'islands',
};

/** The field area (x 24–69): roads, houses, water and greenery for the region's layout. Scenes are set to road
 *  afterwards, the town square and the boss door are drawn over it by the caller. */
function layoutFields(region: number, set: SetT, get: GetT, rng: () => number) {
  const X0 = 24;
  const X1 = 69;
  const Y0 = 3;
  const Y1 = 44;
  const open = (x: number, y: number) => get(x, y) !== T.Fog;
  const put = (x: number, y: number, t: T) => {
    if (x >= X0 - 2 && x <= X1 && y >= Y0 && y <= Y1 && open(x, y)) set(x, y, t);
  };
  const hroad = (y: number, xa: number, xb: number, w = 2) => {
    for (let x = xa; x <= xb; x++) for (let k = 0; k < w; k++) put(x, y + k, T.Road);
  };
  const vroad = (x: number, ya: number, yb: number, w = 2) => {
    for (let y = ya; y <= yb; y++) for (let k = 0; k < w; k++) put(x + k, y, T.Road);
  };
  /** A house seen from the front: roof rows over one row of wall (Tiny Town style). */
  const house = (x: number, y: number, w: number, h: number) => {
    for (let yy = y; yy < y + h; yy++)
      for (let xx = x; xx < x + w; xx++) {
        if (get(xx, yy) === T.Road) continue;
        put(xx, yy, yy === y + h - 1 ? T.Wall : T.Roof);
      }
  };
  const fits = (x: number, y: number, w: number, h: number) => {
    for (let yy = y - 1; yy <= y + h; yy++)
      for (let xx = x - 1; xx <= x + w; xx++) {
        if (xx < X0 - 1 || xx > X1 || yy < Y0 || yy > Y1) return false;
        const inside = xx >= x && xx < x + w && yy >= y && yy < y + h;
        const t = get(xx, yy);
        if (inside ? t !== T.Ground : t !== T.Ground && t !== T.Road) return false;
      }
    return true;
  };
  /** Houses packed into a rectangle (gaps of one tile, a little garden left over). */
  const street = (x: number, y: number, w: number, h: number, hw: [number, number], hh: [number, number]) => {
    for (let yy = y; yy < y + h; ) {
      const rowH = hh[0] + Math.floor(rng() * (hh[1] - hh[0] + 1));
      for (let xx = x; xx < x + w; ) {
        const bw = hw[0] + Math.floor(rng() * (hw[1] - hw[0] + 1));
        if (xx + bw <= x + w && yy + rowH <= y + h && rng() < 0.85 && fits(xx, yy, bw, rowH)) house(xx, yy, bw, rowH);
        else if (rng() < 0.4) put(xx + 1, yy + 1, rng() < 0.5 ? T.Tree : T.Crate);
        xx += bw + 1;
      }
      yy += rowH + 2;
    }
  };
  const scatter = (t: T, p: number, xa = X0, xb = X1, ya = Y0, yb = Y1) => {
    for (let y = ya; y <= yb; y++) for (let x = xa; x <= xb; x++) if (get(x, y) === T.Ground && rng() < p) put(x, y, t);
  };
  const water = (cx: number, cy: number, rx: number, ry: number) => {
    for (let y = cy - ry; y <= cy + ry; y++)
      for (let x = cx - rx; x <= cx + rx; x++) if (((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1 + (rng() - 0.5) * 0.15) put(x, y, T.Water);
  };
  const kind = LAYOUT[region] ?? 'blocks';

  if (kind === 'blocks') {
    // 租屋城: a regular grid of terraced houses, courtyard trees.
    hroad(24, X0 - 2, X1);
    for (const x of [24, 34, 44, 54, 64]) vroad(x, Y0 + 1, Y1 - 1);
    for (const y of [9, 17, 31, 38]) hroad(y, X0, X1 - 2);
    for (const x of [26, 36, 46, 56])
      for (const [y, h] of [[4, 5], [11, 6], [19, 5], [26, 5], [33, 5], [40, 4]] as const) street(x, y, 8, h, [3, 4], [3, 3]);
    scatter(T.Tree, 0.05);
  } else if (kind === 'spa') {
    // 泉疗镇: a big spring pond with a path round it, cottages in flower meadows, a park of bushes.
    hroad(24, X0 - 2, 34);
    water(47, 23, 9, 7);
    for (let a = 0; a < Math.PI * 2; a += 0.02) {
      const x = Math.round(47 + Math.cos(a) * 12);
      const y = Math.round(23 + Math.sin(a) * 10);
      put(x, y, T.Road);
      put(x + 1, y, T.Road);
    }
    hroad(24, 58, X1);
    vroad(46, Y0 + 1, 13);
    vroad(46, 33, Y1 - 1);
    for (const [x, y] of [[26, 4], [33, 6], [27, 30], [34, 36], [58, 4], [63, 9], [57, 34], [63, 38], [26, 15], [62, 28]] as const) if (fits(x, y, 5, 3)) house(x, y, 5, 3);
    scatter(T.Tree, 0.07, X0, X1, Y0, 11);
    scatter(T.Tree, 0.07, X0, X1, 37, Y1);
    scatter(T.Rubble, 0.03);
  } else if (kind === 'harbour') {
    // 雾港: the sea in the south, wooden piers out into it, warehouses on the quay, the old town up north.
    for (let x = X0 - 2; x <= X1; x++) for (let y = 34 + Math.round(Math.sin(x / 4) * 0.8); y <= Y1; y++) put(x, y, T.Water);
    hroad(31, X0 - 2, X1);
    hroad(24, X0 - 2, X1);
    for (const x of [30, 41, 52, 63]) {
      for (let y = 33; y <= 42; y++) put(x, y, T.Road);
      put(x - 1, 42, T.Road);
      put(x + 1, 42, T.Road);
      put(x + 1, 37, T.Crate);
    }
    for (let x = X0; x <= X1 - 6; x += 9) if (fits(x, 27, 7, 3)) house(x, 27, 7, 3);
    for (const x of [27, 45, 60]) vroad(x, Y0 + 1, 23);
    street(X0, 4, 46, 18, [4, 6], [3, 4]);
    scatter(T.Crate, 0.04, X0, X1, 26, 32);
  } else if (kind === 'boulevard') {
    // 印章城: a wide tree-lined boulevard, big formal buildings round two squares.
    hroad(23, X0 - 2, X1, 4);
    for (let x = X0; x <= X1; x += 3) {
      put(x, 22, T.Tree);
      put(x, 27, T.Tree);
    }
    for (const cx of [36, 57]) {
      for (let y = 8; y <= 16; y++) for (let x = cx - 5; x <= cx + 5; x++) put(x, y, T.Ash);
      for (let y = 31; y <= 39; y++) for (let x = cx - 5; x <= cx + 5; x++) put(x, y, T.Ash);
      water(cx, 12, 1, 1);
      water(cx, 35, 1, 1);
      vroad(cx, 17, 22);
      vroad(cx, 27, 30);
      house(cx - 4, 3, 9, 4);
      house(cx - 4, 41, 9, 3);
    }
    for (const x of [26, 44, 64]) {
      if (fits(x, 8, 5, 5)) house(x, 8, 5, 5);
      if (fits(x, 32, 5, 5)) house(x, 32, 5, 5);
    }
    scatter(T.Tree, 0.03);
  } else if (kind === 'works') {
    // 工坊城: long workshop halls, sandy yards stacked with crates, a canal with two bridges.
    for (let y = Y0; y <= Y1; y++) for (let x = 45; x <= 47; x++) put(x, y, T.Water);
    hroad(24, X0 - 2, X1);
    hroad(12, X0, X1);
    hroad(36, X0, X1);
    for (const [x, y] of [[26, 4], [26, 15], [26, 27], [26, 39], [50, 4], [50, 15], [50, 27], [50, 39]] as const) {
      house(x, y, 14, 4);
      for (let xx = x; xx < x + 14; xx++) for (let yy = y + 4; yy < y + 7; yy++) if (get(xx, yy) === T.Ground) put(xx, yy, T.Ash);
    }
    scatter(T.Crate, 0.08, X0, X1, Y0, Y1);
  } else if (kind === 'ring') {
    // 电波塔: a ring road round the tower square, spokes out, houses outside the ring.
    const cx = 47;
    const cy = 24;
    for (let a = 0; a < Math.PI * 2; a += 0.015) {
      for (const r of [11, 12]) put(Math.round(cx + Math.cos(a) * r * 1.3), Math.round(cy + Math.sin(a) * r), T.Road);
    }
    for (let y = cy - 5; y <= cy + 5; y++) for (let x = cx - 7; x <= cx + 7; x++) put(x, y, T.Ash);
    house(cx - 2, cy - 4, 5, 6);
    hroad(24, X0 - 2, cx - 8);
    hroad(24, cx + 8, X1);
    vroad(cx, Y0 + 1, cy - 6);
    vroad(cx, cy + 6, Y1 - 1);
    for (const [x, y] of [[25, 3], [31, 3], [58, 3], [64, 3], [25, 40], [31, 40], [58, 40], [64, 40], [25, 10], [64, 10], [25, 33], [64, 33]] as const) if (fits(x, y, 4, 3)) house(x, y, 4, 3);
    scatter(T.Tree, 0.05);
  } else if (kind === 'market') {
    // 面包集市: stalls along the market street, a square with a fountain, wheat fields and granary barns.
    hroad(24, X0 - 2, X1);
    vroad(40, Y0 + 1, Y1 - 1);
    vroad(54, Y0 + 1, Y1 - 1);
    hroad(12, X0, 39);
    hroad(37, 56, X1);
    for (let y = 18; y <= 31; y++) for (let x = 42; x <= 53; x++) put(x, y, T.Ash);
    water(47, 20, 1, 1);
    for (let x = 42; x <= 53; x += 2) {
      put(x, 18, x % 4 === 0 ? T.Tent : T.Crate);
      put(x, 31, x % 4 === 2 ? T.Tent : T.Crate);
    }
    for (const y of [22, 27])
      for (let x = 26; x <= 68; x++) if ((x < 40 || x > 55) && x % 4 !== 1) put(x, y, x % 6 === 0 ? T.Tent : T.Crate);
    street(26, 4, 13, 7, [4, 5], [3, 3]);
    street(26, 14, 13, 6, [4, 5], [3, 3]);
    for (let y = 5; y <= 19; y++) if (y % 3 !== 1) for (let x = 57; x <= 68; x++) put(x, y, T.Crop);
    for (let y = 30; y <= 43; y += 3) for (let x = 27; x <= 38; x += 3) put(x, y, T.Tree);
    house(57, 30, 11, 4);
    house(57, 39, 11, 4);
    scatter(T.Crate, 0.03, 56, X1, 34, 38);
  } else if (kind === 'rail') {
    // 铁轨镇: two tracks through the station platforms, the station hall, the old town north, a freight yard south.
    hroad(24, X0 - 2, X1);
    for (const y of [20, 29]) for (let x = X0 - 2; x <= X1; x++) put(x, y, T.Rail);
    for (let x = 30; x <= 64; x++) {
      put(x, 21, T.Ash);
      put(x, 28, T.Ash);
      if (x % 5 === 0) {
        put(x, 22, T.Lamp);
        put(x, 27, T.Lamp);
      }
    }
    house(38, 13, 18, 6);
    vroad(46, 19, 19, 2);
    vroad(30, Y0 + 1, 18);
    vroad(62, Y0 + 1, 18);
    street(X0, 4, 6, 14, [4, 5], [3, 3]);
    street(33, 4, 28, 8, [3, 5], [3, 3]);
    street(65, 4, 4, 14, [3, 4], [3, 3]);
    for (const y of [33, 37, 41]) for (let x = 36; x <= 67; x++) put(x, y, T.Rail);
    for (const y of [35, 39]) for (let x = 38; x <= 66; x += 3) put(x, y, T.Crate);
    vroad(32, 30, Y1 - 1);
    house(25, 32, 6, 4);
    house(25, 39, 6, 4);
    scatter(T.Tree, 0.04, X0, X1, Y0, 18);
  } else if (kind === 'citadel') {
    // 议会堡: a walled keep on an island in a moat, bridges on the four axes, villages outside.
    const cx = 47;
    const cy = 24;
    const inEll = (x: number, y: number, rx: number, ry: number) => ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1;
    for (let y = Y0; y <= Y1; y++)
      for (let x = X0; x <= X1; x++) {
        if (inEll(x, y, 16, 13) && !inEll(x, y, 13, 10.5)) put(x, y, T.Water);
        else if (inEll(x, y, 10, 8) && !inEll(x, y, 9, 7)) put(x, y, T.Keep);
        else if (inEll(x, y, 9, 7)) put(x, y, T.Ash);
      }
    hroad(24, X0 - 2, X1);
    vroad(cx, Y0 + 1, cy - 8);
    vroad(cx, cy + 8, Y1 - 1);
    house(cx - 4, cy - 6, 9, 5);
    for (const [x, y] of [[cx - 7, cy - 3], [cx + 7, cy - 3], [cx - 7, cy + 4], [cx + 7, cy + 4]] as const) put(x, y, T.Tree);
    for (const [x, y] of [[25, 4], [31, 6], [25, 38], [31, 40], [62, 4], [64, 10], [62, 37], [64, 41], [26, 12], [63, 31]] as const) if (fits(x, y, 4, 3)) house(x, y, 4, 3);
    scatter(T.Tree, 0.06);
  } else if (kind === 'canals') {
    // 铸币场: a merchant town on canals, bridges where the streets cross, tall houses along the water.
    for (const x of [32, 44, 57]) for (let y = Y0; y <= Y1; y++) for (let k = 0; k < 2; k++) put(x + k, y, T.Water);
    for (const y of [11, 37]) for (let x = X0; x <= X1; x++) for (let k = 0; k < 2; k++) put(x, y + k, T.Water);
    hroad(24, X0 - 2, X1);
    for (const x of [38, 51, 63]) vroad(x, Y0 + 1, Y1 - 1);
    hroad(17, X0, X1);
    hroad(30, X0, X1);
    for (const [x0, x1] of [[25, 31], [34, 37], [40, 43], [46, 50], [53, 56], [59, 62], [65, 68]] as const)
      for (const [y0, h] of [[4, 6], [13, 3], [19, 4], [26, 3], [32, 4], [39, 5]] as const) street(x0, y0, x1 - x0 + 1, h, [3, 4], [3, 3]);
    scatter(T.Crate, 0.03);
  } else if (kind === 'theatre') {
    // 面具剧场: an open-air theatre (rows of seats round a stage), formal flower gardens north.
    const cx = 47;
    const cy = 40;
    hroad(24, X0 - 2, X1);
    for (let y = 26; y <= Y1; y++)
      for (let x = X0; x <= X1; x++) {
        const r = Math.hypot((x - cx) / 1.3, y - cy);
        if (y > cy) continue;
        if (r < 5) put(x, y, T.Ash);
        else if (r < 15 && Math.floor(r) % 2 === 1 && Math.abs(x - cx) % 6 !== 0) put(x, y, T.Keep);
      }
    house(cx - 4, cy + 1, 9, 3);
    for (let y = 4; y <= 21; y++)
      for (let x = 26; x <= 68; x++) {
        if (x % 6 === 2 || y % 6 === 4) put(x, y, T.Road);
        else if ((x + y) % 3 === 0) put(x, y, T.Rubble);
      }
    for (let x = 26; x <= 68; x += 6) put(x, 22, T.Tree);
    scatter(T.Tree, 0.05, X0, X1, 26, Y1);
  } else if (kind === 'maze') {
    // 档案深处: a hedge maze of long archive rows (cells of 3), a ruined court in the middle.
    const CW = 3;
    const nx = Math.floor((X1 - 26) / CW);
    const ny = Math.floor((Y1 - 4) / CW);
    for (let y = 4; y <= 4 + ny * CW; y++) for (let x = 26; x <= 26 + nx * CW; x++) put(x, y, T.Tree);
    const seen = new Uint8Array(nx * ny);
    const stack: Array<[number, number]> = [[0, 0]];
    seen[0] = 1;
    const cell = (i: number, j: number) => {
      for (let y = 0; y < CW - 1; y++) for (let x = 0; x < CW - 1; x++) put(27 + i * CW + x, 5 + j * CW + y, T.Ground);
    };
    cell(0, 0);
    while (stack.length) {
      const [i, j] = stack[stack.length - 1];
      const next = ([[1, 0], [-1, 0], [0, 1], [0, -1]] as const).filter(([di, dj]) => i + di >= 0 && j + dj >= 0 && i + di < nx && j + dj < ny && !seen[(j + dj) * nx + i + di]);
      if (!next.length) {
        stack.pop();
        continue;
      }
      const [di, dj] = next[Math.floor(rng() * next.length)];
      const a = i + di;
      const b = j + dj;
      seen[b * nx + a] = 1;
      cell(a, b);
      // knock out the hedge between the two cells
      for (let k = 0; k < CW - 1; k++)
        if (di) put(27 + Math.min(i, a) * CW + CW - 1, 5 + j * CW + k, T.Ground);
        else put(27 + i * CW + k, 5 + Math.min(j, b) * CW + CW - 1, T.Ground);
      stack.push([a, b]);
    }
    hroad(24, X0 - 2, X1);
    for (let y = 18; y <= 30; y++) for (let x = 41; x <= 53; x++) put(x, y, rng() < 0.08 ? T.Rubble : T.Ash);
    // the hedges thin out here and there, so the maze never walls a monster in
    for (let y = 4; y <= Y1; y++) for (let x = 26; x <= X1; x++) if (get(x, y) === T.Tree && rng() < 0.12) put(x, y, T.Ground);
  } else if (kind === 'court') {
    // 天平庭: a strictly symmetric court: the axis road between two long pools lined with columns, halls north and
    // south, square gardens in the corners.
    hroad(24, X0 - 2, X1);
    for (const y of [20, 21, 28, 29]) for (let x = 30; x <= 64; x++) put(x, y, T.Water);
    for (let x = 30; x <= 64; x += 3) {
      put(x, 19, T.Lamp);
      put(x, 30, T.Lamp);
    }
    for (let y = 22; y <= 27; y++) for (let x = 30; x <= 64; x++) if (get(x, y) !== T.Road) put(x, y, T.Ash);
    house(39, 6, 17, 6);
    house(39, 36, 17, 6);
    vroad(47, 12, 18);
    vroad(47, 31, 35);
    for (const [gx, gy] of [[26, 4], [58, 4], [26, 33], [58, 33]] as const)
      for (let y = gy; y < gy + 10; y++)
        for (let x = gx; x < gx + 10; x++) {
          const edge = x === gx || y === gy || x === gx + 9 || y === gy + 9;
          put(x, y, edge ? T.Road : (x - gx) % 3 === 2 && (y - gy) % 3 === 2 ? T.Tree : T.Ground);
        }
  } else if (kind === 'islands') {
    // 沉默之心: a still lake; every scene stands on its own island, wooden bridges along the routes between them.
    for (let y = Y0; y <= Y1; y++) for (let x = X0 + 2; x <= X1; x++) put(x, y, T.Water);
    const here = SCENES.filter((sc) => sc.region === region);
    for (const sc of here)
      for (let y = sc.at.y - 3; y <= sc.at.y + 3; y++)
        for (let x = sc.at.x - 4; x <= sc.at.x + 4; x++) if (((x - sc.at.x) / 2.6) ** 2 + ((y - sc.at.y) / 1.8) ** 2 <= 1) put(x, y, rng() < 0.1 ? T.Tree : T.Ground);
    const byId = new Map(here.map((sc) => [sc.id, sc.at]));
    for (const [a, b] of LINKS) {
      const p = byId.get(a);
      const q = byId.get(b);
      if (!p || !q) continue;
      const n = Math.max(Math.abs(q.x - p.x), Math.abs(q.y - p.y));
      for (let i = 0; i <= n; i++) {
        const x = Math.round(p.x + ((q.x - p.x) * i) / n);
        const y = Math.round(p.y + ((q.y - p.y) * i) / n);
        if (get(x, y) === T.Water || get(x, y) === T.Tree) put(x, y, T.Road);
      }
    }
    hroad(24, X0 - 2, X0 + 2);
    hroad(24, 66, X1);
  } else {
    // 心巷: lanes that wind between cottages and vegetable gardens.
    let y = 24;
    for (let x = X0 - 2; x <= X1; x++) {
      if (rng() < 0.3) y += rng() < 0.5 ? -1 : 1;
      y = Math.max(20, Math.min(28, y));
      put(x, y, T.Road);
      put(x, y + 1, T.Road);
    }
    for (const sx of [30, 44, 58]) {
      let x = sx;
      for (let yy = Y0 + 1; yy <= Y1 - 1; yy++) {
        if (rng() < 0.3) x += rng() < 0.5 ? -1 : 1;
        put(x, yy, T.Road);
      }
    }
    for (let i = 0; i < 40; i++) {
      const x = X0 + Math.floor(rng() * (X1 - X0 - 5));
      const yy = Y0 + Math.floor(rng() * (Y1 - Y0 - 4));
      if (fits(x, yy, 4, 3)) {
        house(x, yy, 4, 3);
        // a vegetable bed beside the cottage
        for (let k = 0; k < 3; k++) if (get(x + 4 + 1, yy + k) === T.Ground) put(x + 5, yy + k, T.Crop);
      }
    }
    scatter(T.Tree, 0.06);
  }
  // A scene never stands in water or inside a wall: a little jetty of road round it.
  for (const sc of SCENES)
    if (sc.region === region)
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++) {
          const t = get(sc.at.x + dx, sc.at.y + dy);
          if (t === T.Water || t === T.Keep) set(sc.at.x + dx, sc.at.y + dy, T.Road);
        }
}

export function isBlocked(m: MapData, tx: number, ty: number): boolean {
  if (tx < 0 || ty < 0 || tx >= MAP_W || ty >= MAP_H) return true;
  if (tx === m.bonfire.x && ty === m.bonfire.y) return true;
  return BLOCKING.has(m.tiles[idx(tx, ty)]);
}

export function zoneAt(px: number, py: number, region: RegionId = 1): ZoneDef | null {
  const tx = Math.floor(px / TILE);
  const ty = Math.floor(py / TILE);
  for (const z of zonesOf(region)) {
    const r = z.rect;
    if (tx >= r.x && tx < r.x + r.w && ty >= r.y && ty < r.y + r.h) return z;
  }
  return null;
}

export function walkableTilesIn(m: MapData, r: Rect): Array<{ x: number; y: number }> {
  const out: Array<{ x: number; y: number }> = [];
  for (let y = r.y; y < r.y + r.h; y++)
    for (let x = r.x; x < r.x + r.w; x++) if (!isBlocked(m, x, y)) out.push({ x, y });
  return out;
}
