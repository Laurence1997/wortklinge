// Region 1 map: 最后的营地 — a fog-locked block of a ruined German town.
// Generated from a fixed seed so every player walks the same streets.

import { makeRng } from '../core/rng';
import type { ZoneId } from '../core/types';

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

export interface ZoneDef {
  id: ZoneId;
  zh: string;
  de: string;
  rect: Rect;
  levels: string;
  monsters: number;
}

export const ZONES: ZoneDef[] = [
  { id: 'camp', zh: '余烬营地', de: 'Glutheim', rect: { x: 4, y: 17, w: 15, h: 15 }, levels: '安全区', monsters: 0 },
  { id: 'echogasse', zh: '回声巷', de: 'Echogasse', rect: { x: 20, y: 10, w: 19, h: 28 }, levels: 'Lv 1–3', monsters: 9 },
  { id: 'schilderstrasse', zh: '名牌街', de: 'Schilderstraße', rect: { x: 41, y: 3, w: 26, h: 18 }, levels: 'Lv 3–7', monsters: 10 },
  { id: 'aschehof', zh: '灰烬公寓', de: 'Aschehof', rect: { x: 41, y: 27, w: 26, h: 18 }, levels: 'Lv 6–9', monsters: 10 },
];

export interface MapData {
  tiles: Uint8Array;
  bonfire: { x: number; y: number };
  npc: { x: number; y: number };
  sign: { x: number; y: number };
  door: { x: number; y: number };
  start: { x: number; y: number };
  lamps: Array<{ x: number; y: number }>;
  signs: Array<{ x: number; y: number; wordId: string }>;
}

export function idx(x: number, y: number): number {
  return y * MAP_W + x;
}

export function generateMap(): MapData {
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
  for (const z of ZONES) if (z.id !== 'camp') blocks(z.rect);

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

  return {
    tiles,
    bonfire,
    npc: { x: bonfire.x + 2, y: bonfire.y + 1 },
    sign: { x: bonfire.x, y: bonfire.y - 5 },
    door,
    start: { x: bonfire.x + 1, y: bonfire.y + 2 },
    lamps,
    signs,
  };
}

export function isBlocked(m: MapData, tx: number, ty: number): boolean {
  if (tx < 0 || ty < 0 || tx >= MAP_W || ty >= MAP_H) return true;
  if (tx === m.bonfire.x && ty === m.bonfire.y) return true;
  return BLOCKING.has(m.tiles[idx(tx, ty)]);
}

export function zoneAt(px: number, py: number): ZoneDef | null {
  const tx = Math.floor(px / TILE);
  const ty = Math.floor(py / TILE);
  for (const z of ZONES) {
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
