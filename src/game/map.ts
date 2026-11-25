// Maps. Region 1: 最后的营地 — a fog-locked block of a ruined German town.
// Region 2: 面包集市 — the market behind the neighbour's door.
// Region 3: 铁轨镇 — the rail town over the bridge east of the granary (0.6).
// Generated from fixed seeds so every player walks the same streets. Both maps are 74×48.

import { makeRng } from '../core/rng';
import { FIELD_KEYS, REGION_DEF, REGION_DEFS, fieldLevels, type FieldStyle, type RegionDef } from '../data/zones';
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
}

const BLOCKING = new Set<number>([T.Wall, T.Rubble, T.Tree, T.Fog, T.Lamp, T.Tent, T.Crate, T.Roof, T.Door]);

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
  { id: 'echogasse', region: 1, zh: '回声巷', de: 'Echogasse', rect: { x: 20, y: 10, w: 19, h: 28 }, levels: 'Lv 1–3', monsters: 9 },
  { id: 'schilderstrasse', region: 1, zh: '名牌街', de: 'Schilderstraße', rect: { x: 41, y: 3, w: 26, h: 18 }, levels: 'Lv 3–7', monsters: 10 },
  { id: 'aschehof', region: 1, zh: '灰烬公寓', de: 'Aschehof', rect: { x: 41, y: 27, w: 26, h: 18 }, levels: 'Lv 6–9', monsters: 10 },
  { id: 'markt', region: 2, zh: '面包集市', de: 'Brotmarkt', rect: { x: 4, y: 13, w: 18, h: 23 }, levels: '主城', monsters: 0 },
  { id: 'gemuesegasse', region: 2, zh: '菜摊街', de: 'Gemüsegasse', rect: { x: 24, y: 3, w: 26, h: 19 }, levels: 'Lv 11–14', monsters: 10 },
  { id: 'waagegasse', region: 2, zh: '秤巷', de: 'Waagegasse', rect: { x: 24, y: 27, w: 26, h: 18 }, levels: 'Lv 14–17', monsters: 10 },
  { id: 'kornspeicher', region: 2, zh: '粮仓', de: 'Kornspeicher', rect: { x: 52, y: 6, w: 17, h: 36 }, levels: 'Lv 17–20', monsters: 10 },
  { id: 'gleisdorf', region: 3, zh: '铁轨镇广场', de: 'Gleisdorf', rect: { x: 4, y: 13, w: 18, h: 23 }, levels: '主城', monsters: 0 },
  { id: 'bahnhofstrasse', region: 3, zh: '站前街', de: 'Bahnhofstraße', rect: { x: 24, y: 3, w: 26, h: 19 }, levels: 'Lv 21–24', monsters: 10 },
  { id: 'altstadt', region: 3, zh: '老城路口', de: 'Altstadt', rect: { x: 24, y: 27, w: 26, h: 18 }, levels: 'Lv 24–27', monsters: 10 },
  { id: 'fahrplanhalle', region: 3, zh: '时刻表大厅', de: 'Fahrplanhalle', rect: { x: 52, y: 6, w: 17, h: 36 }, levels: 'Lv 27–30', monsters: 10 },
  // 0.7 + 0.8: regions 4–12 on the region-3 plan (src/data/zones.ts).
  ...REGION_DEFS.flatMap(laterZones),
];

function laterZones(d: RegionDef): ZoneDef[] {
  const rects = [{ x: 24, y: 3, w: 26, h: 19 }, { x: 24, y: 27, w: 26, h: 18 }, { x: 52, y: 6, w: 17, h: 36 }];
  return [
    { id: `r${d.region}hub` as ZoneId, region: d.region, zh: d.hubZh, de: d.de, rect: { x: 4, y: 13, w: 18, h: 23 }, levels: '主城', monsters: 0 },
    ...d.fields.map((f, i) => ({
      id: `r${d.region}${FIELD_KEYS[i]}` as ZoneId,
      region: d.region,
      zh: f.zh,
      de: f.de,
      rect: rects[i],
      levels: `Lv ${fieldLevels(d.region, i as 0 | 1 | 2).join('–')}`,
      monsters: 10,
    })),
  ];
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
  if (later) return generateLater(later);
  return region === 3 ? generateRegion3() : region === 2 ? generateRegion2() : generateRegion1();
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

  // Market street from the west gate to the granary's scale room, plus two cross streets.
  for (let x = 2; x < 70; x++) for (let dy = 0; dy < 2; dy++) set(x, 24 + dy, T.Road);
  for (let y = 4; y < 45; y++) for (let dx = 0; dx < 2; dx++) set(22 + dx, y, T.Road);
  for (let y = 4; y < 45; y++) for (let dx = 0; dx < 2; dx++) set(50 + dx, y, T.Road);

  // Field blocks: market stalls (crates) in the vegetable lane, shop rows in the scale lane, sheds in the granary.
  const blocks = (r: Rect, style: 'stalls' | 'shops' | 'sheds') => {
    const step = style === 'sheds' ? 8 : 7;
    for (let y = r.y; y < r.y + r.h; y++)
      for (let x = r.x; x < r.x + r.w; x++) {
        if (get(x, y) === T.Fog) continue;
        const lx = x - r.x;
        const ly = y - r.y;
        if (lx % step === 0 || ly % step === 0) {
          set(x, y, T.Road);
          continue;
        }
        const bx = lx % step;
        const by = ly % step;
        const inner = bx >= 2 && bx <= step - 2 && by >= 2 && by <= step - 2;
        if (!inner) {
          if (rng() < 0.03) set(x, y, T.Tree);
          else if (rng() < 0.03) set(x, y, T.Crate);
          continue;
        }
        if (style === 'stalls') {
          // Open stalls: a row of crates with a gap, ground behind.
          if (by === 2 && bx !== 4) set(x, y, T.Crate);
          else if (by === 5 && rng() < 0.3) set(x, y, T.Rubble);
        } else if (style === 'shops') {
          const edgeB = bx === 2 || bx === step - 2 || by === 2 || by === step - 2;
          if (edgeB) set(x, y, rng() < 0.1 ? T.Rubble : T.Wall);
          else set(x, y, T.Roof);
        } else {
          const edgeB = bx === 2 || bx === step - 2 || by === 2 || by === step - 2;
          if (edgeB) set(x, y, by === step - 2 && bx === 4 ? T.Ground : T.Wall);
          else if (rng() < 0.35) set(x, y, T.Crate);
        }
      }
  };
  blocks(zonesOf(2)[1].rect, 'stalls');
  blocks(zonesOf(2)[2].rect, 'shops');
  blocks(zonesOf(2)[3].rect, 'sheds');

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

  // The railway runs west to east through the town; two streets cross it.
  for (let x = 2; x < 70; x++) for (let dy = 0; dy < 2; dy++) set(x, 24 + dy, T.Road);
  for (let y = 4; y < 45; y++) for (let dx = 0; dx < 2; dx++) set(22 + dx, y, T.Road);
  for (let y = 4; y < 45; y++) for (let dx = 0; dx < 2; dx++) set(50 + dx, y, T.Road);

  // Station street: shop rows; old town: houses with yards; timetable hall: long platforms (walls with gaps).
  const blocks = (r: Rect, style: 'shops' | 'houses' | 'platforms') => {
    const step = style === 'platforms' ? 6 : 7;
    for (let y = r.y; y < r.y + r.h; y++)
      for (let x = r.x; x < r.x + r.w; x++) {
        if (get(x, y) === T.Fog) continue;
        const lx = x - r.x;
        const ly = y - r.y;
        if (lx % step === 0 || ly % step === 0) {
          set(x, y, T.Road);
          continue;
        }
        const bx = lx % step;
        const by = ly % step;
        const inner = bx >= 2 && bx <= step - 2 && by >= 2 && by <= step - 2;
        if (!inner) {
          if (rng() < 0.03) set(x, y, style === 'houses' ? T.Tree : T.Lamp);
          else if (rng() < 0.03) set(x, y, T.Crate);
          continue;
        }
        if (style === 'platforms') {
          if (by === 2 && bx !== 3) set(x, y, T.Wall);
          else if (rng() < 0.15) set(x, y, T.Crate);
        } else {
          const edgeB = bx === 2 || bx === step - 2 || by === 2 || by === step - 2;
          if (edgeB) set(x, y, rng() < (style === 'houses' ? 0.2 : 0.1) ? T.Rubble : T.Wall);
          else set(x, y, T.Roof);
        }
      }
  };
  blocks(zonesOf(3)[1].rect, 'shops');
  blocks(zonesOf(3)[2].rect, 'houses');
  blocks(zonesOf(3)[3].rect, 'platforms');

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
  for (let x = 2; x < 70; x++) for (let dy = 0; dy < 2; dy++) set(x, 24 + dy, T.Road);
  for (let y = 4; y < 45; y++) for (let dx = 0; dx < 2; dx++) set(22 + dx, y, T.Road);
  for (let y = 4; y < 45; y++) for (let dx = 0; dx < 2; dx++) set(50 + dx, y, T.Road);

  const blocks = (r: Rect, style: FieldStyle) => {
    const step = style === 'platforms' || style === 'docks' ? 6 : style === 'sheds' ? 8 : 7;
    for (let y = r.y; y < r.y + r.h; y++)
      for (let x = r.x; x < r.x + r.w; x++) {
        if (get(x, y) === T.Fog) continue;
        const lx = x - r.x;
        const ly = y - r.y;
        if (lx % step === 0 || ly % step === 0) {
          set(x, y, T.Road);
          continue;
        }
        const bx = lx % step;
        const by = ly % step;
        const inner = bx >= 2 && bx <= step - 2 && by >= 2 && by <= step - 2;
        const edgeB = bx === 2 || bx === step - 2 || by === 2 || by === step - 2;
        if (!inner) {
          if (rng() < (style === 'grove' ? 0.18 : 0.03)) set(x, y, T.Tree);
          else if (rng() < 0.03) set(x, y, style === 'platforms' ? T.Lamp : T.Crate);
          continue;
        }
        if (style === 'grove') {
          if (rng() < 0.55) set(x, y, T.Tree);
          else if (rng() < 0.1) set(x, y, T.Rubble);
        } else if (style === 'stalls') {
          if (by === 2 && bx !== 4) set(x, y, T.Crate);
          else if (by === 5 && rng() < 0.3) set(x, y, T.Rubble);
        } else if (style === 'docks') {
          // Piers: water (fog) between wooden walkways, crates stacked on the quay.
          if (by === 3 || by === 4) set(x, y, bx === 3 ? T.Ground : T.Fog);
          else if (rng() < 0.3) set(x, y, T.Crate);
        } else if (style === 'platforms') {
          if (by === 2 && bx !== 3) set(x, y, T.Wall);
          else if (rng() < 0.15) set(x, y, T.Crate);
        } else if (style === 'yard') {
          // Office blocks round a paved yard: walls with a gate, an open middle.
          if (edgeB) set(x, y, by === step - 2 && bx === 4 ? T.Ground : T.Wall);
          else if (rng() < 0.08) set(x, y, T.Crate);
        } else if (style === 'sheds') {
          if (edgeB) set(x, y, by === step - 2 && bx === 4 ? T.Ground : T.Wall);
          else if (rng() < 0.35) set(x, y, T.Crate);
        } else {
          if (edgeB) set(x, y, rng() < (style === 'houses' ? 0.2 : 0.1) ? T.Rubble : T.Wall);
          else set(x, y, T.Roof);
        }
      }
  };
  const fieldZones = zonesOf(d.region).filter((z) => z.monsters);
  d.fields.forEach((f, i) => blocks(fieldZones[i].rect, f.style));

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
  for (const l of lamps) set(l.x, l.y, T.Lamp);

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
    lamps,
    signs: [],
  };
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
