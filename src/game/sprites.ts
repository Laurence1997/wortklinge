import { HAIR_COLORS, type Look } from '../core/look';
// Sprites are drawn in code; since 0.6.x the map ground and buildings use Kenney Tiny Town tiles (see renderMapCanvas).

import { makeRng } from '../core/rng';
import { MAP_H, MAP_W, TILE, T, type MapData, idx } from './map';

export const PAL = {
  void: '#07040a',
  ground: '#0f090b',
  groundDot: '#2a1115',
  ash: '#151012',
  ashDot: '#3b2c2e',
  road: '#140d10',
  roadLine: '#25171b',
  brick: '#4b1519',
  brickHi: '#7a2429',
  mortar: '#1b0a0c',
  roof: '#22090c',
  roofHi: '#3a1015',
  rubble: '#3a1316',
  rubbleHi: '#5e1d22',
  tree: '#4a1a1d',
  fog: '#231b1e',
  fogHi: '#3a2d31',
  lampPost: '#3d3940',
  lampLight: '#ff4a4a',
  tent: '#3a1517',
  tentHi: '#7a2b2e',
  crate: '#2e1a14',
  crateHi: '#57301f',
  door: '#000000',
  sigil: '#ff2f45',
  bone: '#e8dccf',
  ember: '#ff7a2a',
  gold: '#ffcf4a',
};

/** Keyed by article and by gender (m/f/n/pl), so either lookup works. */
export const ARTICLE_COLOR: Record<string, string> = {
  der: '#4f93ff',
  die: '#ff5566',
  das: '#3fd27a',
  pl: '#ffd23f',
  m: '#4f93ff',
  f: '#ff5566',
  n: '#3fd27a',
};

type Ctx = CanvasRenderingContext2D;

function px(c: Ctx, x: number, y: number, color: string, w = 1, h = 1) {
  c.fillStyle = color;
  c.fillRect(x, y, w, h);
}

function drawTile(c: Ctx, t: number, ox: number, oy: number, seed: number) {
  const r = makeRng(seed);
  const fill = (color: string) => px(c, ox, oy, color, TILE, TILE);
  switch (t) {
    case T.Ground:
      fill(PAL.ground);
      for (let i = 0; i < 3; i++) if (r() < 0.6) px(c, ox + Math.floor(r() * 16), oy + Math.floor(r() * 16), PAL.groundDot);
      break;
    case T.Ash:
      fill(PAL.ash);
      for (let i = 0; i < 5; i++) if (r() < 0.7) px(c, ox + Math.floor(r() * 16), oy + Math.floor(r() * 16), PAL.ashDot);
      break;
    case T.Road:
      fill(PAL.road);
      for (let y = 0; y < 16; y += 4) {
        const off = (y / 4) % 2 ? 4 : 0;
        for (let x = off; x < 16; x += 8) px(c, ox + x, oy + y, PAL.roadLine, 7, 1);
      }
      if (r() < 0.3) px(c, ox + Math.floor(r() * 14), oy + Math.floor(r() * 14), PAL.groundDot, 2, 1);
      break;
    case T.Wall:
      fill(PAL.mortar);
      for (let y = 0; y < 16; y += 4) {
        const off = (y / 4) % 2 ? 4 : 0;
        for (let x = -4 + off; x < 16; x += 8) {
          const bx = Math.max(0, x);
          const bw = Math.min(7, 16 - bx, x + 7 - bx);
          if (bw > 0) {
            px(c, ox + bx, oy + y, PAL.brick, bw, 3);
            px(c, ox + bx, oy + y, PAL.brickHi, bw, 1);
          }
        }
      }
      if (r() < 0.25) px(c, ox + 3 + Math.floor(r() * 8), oy + 6, PAL.void, 3, 4); // a broken window
      break;
    case T.Roof:
      fill(PAL.roof);
      for (let y = 1; y < 16; y += 3) px(c, ox, oy + y, PAL.roofHi, 16, 1);
      break;
    case T.Rubble:
      fill(PAL.ground);
      for (let i = 0; i < 4; i++) {
        const x = Math.floor(r() * 12);
        const y = Math.floor(r() * 12);
        const w = 2 + Math.floor(r() * 4);
        px(c, ox + x, oy + y, PAL.rubble, w, 2 + Math.floor(r() * 3));
        px(c, ox + x, oy + y, PAL.rubbleHi, w, 1);
      }
      break;
    case T.Tree: {
      fill(PAL.ground);
      const col = PAL.tree;
      px(c, ox + 7, oy + 5, col, 2, 11);
      px(c, ox + 4, oy + 3, col, 1, 4);
      px(c, ox + 5, oy + 6, col, 2, 1);
      px(c, ox + 9, oy + 4, col, 3, 1);
      px(c, ox + 11, oy + 1, col, 1, 4);
      px(c, ox + 6, oy + 1, col, 1, 3);
      px(c, ox + 3, oy + 15, col, 10, 1);
      break;
    }
    case T.Fog:
      fill(PAL.fog);
      for (let i = 0; i < 10; i++) px(c, ox + Math.floor(r() * 16), oy + Math.floor(r() * 16), PAL.fogHi, 2, 1);
      break;
    case T.Lamp:
      fill(PAL.road);
      px(c, ox + 7, oy + 4, PAL.lampPost, 2, 12);
      px(c, ox + 5, oy + 1, PAL.lampPost, 6, 2);
      px(c, ox + 6, oy + 3, PAL.lampLight, 4, 2);
      break;
    case T.Tent:
      fill(PAL.ash);
      for (let y = 0; y < 13; y++) {
        const w = Math.round((y + 1) * 1.15);
        px(c, ox + 8 - Math.floor(w / 2), oy + 2 + y, PAL.tent, w, 1);
        px(c, ox + 8 - Math.floor(w / 2), oy + 2 + y, PAL.tentHi, 1, 1);
        px(c, ox + 8 + Math.ceil(w / 2) - 1, oy + 2 + y, PAL.tentHi, 1, 1);
      }
      px(c, ox + 7, oy + 9, PAL.void, 2, 6);
      break;
    case T.Crate:
      fill(PAL.ground);
      px(c, ox + 3, oy + 4, PAL.crate, 10, 10);
      px(c, ox + 3, oy + 4, PAL.crateHi, 10, 1);
      px(c, ox + 3, oy + 8, PAL.crateHi, 10, 1);
      px(c, ox + 7, oy + 4, PAL.crateHi, 1, 10);
      break;
    case T.Door:
      fill(PAL.mortar);
      px(c, ox + 2, oy, PAL.door, 12, 16);
      px(c, ox + 7, oy + 6, PAL.sigil, 2, 4);
      px(c, ox + 5, oy + 7, PAL.sigil, 6, 1);
      break;
  }
}

// 地块 (0.6.x 小修): Kenney Tiny Town tiles (CC0, public/art/kenney-tiny-town.png) recoloured by brightness.
// Docs: only dark reds, walkable ground one step brighter than walls and houses, hidden side paths only the two
// darkest steps; fog, lamps, tents and the boss door stay code-drawn (they are markers). ?oldmap is untouched.
const MAP_SHADES = ['#0b0506', '#1d0a0c', '#341214', '#4e191c'];
const RAMP_WALL = [0, 1, 2];
const RAMP_FLOOR = [1, 2, 3];
const RAMP_HIDDEN = [0, 1, 1];
const TOWN_COLS = 12;
/** Town tile indices per map tile type and region (several = picked by position). */
const TOWN: Record<1 | 2 | 3, Partial<Record<number, number[]>>> = {
  1: { [T.Ground]: [0, 0, 0, 0, 0, 0, 0, 1], [T.Ash]: [25, 25, 37], [T.Road]: [25, 24, 26], [T.Wall]: [72, 73, 75, 72, 84], [T.Roof]: [64, 65, 66], [T.Rubble]: [43], [T.Tree]: [4, 16, 28, 5], [T.Crate]: [130, 106] },
  2: { [T.Ground]: [0, 0, 0, 0, 0, 0, 0, 1], [T.Ash]: [25, 37], [T.Road]: [126], [T.Wall]: [76, 77, 79, 76, 88], [T.Roof]: [52, 53, 54], [T.Rubble]: [43], [T.Tree]: [3, 15, 27, 5], [T.Crate]: [130, 106, 57] },
  3: { [T.Ground]: [0, 0, 0, 0, 0, 0, 0, 1], [T.Ash]: [109, 108], [T.Road]: [126], [T.Wall]: [76, 77, 79, 88, 77], [T.Roof]: [48, 49, 50], [T.Rubble]: [43], [T.Tree]: [16, 28, 4], [T.Crate]: [130, 131] },
};
const OVERLAY = new Set<number>([T.Tree, T.Crate]);
const FLOORISH = new Set<number>([T.Ground, T.Ash, T.Road, T.Rubble]);

const tinted = new Map<string, HTMLCanvasElement>();
function townTile(sheet: CanvasImageSource, tile: number, ramp: number[]): HTMLCanvasElement {
  const key = `${tile}:${ramp.join('')}`;
  const hit = tinted.get(key);
  if (hit) return hit;
  const cv = document.createElement('canvas');
  cv.width = cv.height = 16;
  const ctx = cv.getContext('2d', { willReadFrequently: true })!;
  ctx.drawImage(sheet, (tile % TOWN_COLS) * 16, Math.floor(tile / TOWN_COLS) * 16, 16, 16, 0, 0, 16, 16);
  const img = ctx.getImageData(0, 0, 16, 16);
  const d = img.data;
  const shades = ramp.map((i) => MAP_SHADES[i]).map((h) => [1, 3, 5].map((k) => parseInt(h.slice(k, k + 2), 16)));
  // Stretch each tile's own brightness range over the ramp, so pale tiles (stone, walls) keep their detail.
  const lums: number[] = [];
  for (let i = 0; i < d.length; i += 4) lums.push(d[i + 3] < 8 ? -1 : (0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]) / 255);
  const seen = lums.filter((v) => v >= 0);
  const lo = Math.min(...seen);
  const span = Math.max(0.25, Math.max(...seen) - lo);
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] < 8) continue;
    const lum = (lums[i / 4] - lo) / span;
    const c = shades[Math.min(shades.length - 1, Math.floor(lum * shades.length))];
    d[i] = c[0];
    d[i + 1] = c[1];
    d[i + 2] = c[2];
    d[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  tinted.set(key, cv);
  return cv;
}

/** The whole static map as one canvas (cheap to render, crisp when scaled). With the Town sheet loaded the ground,
 *  walls, roofs, rubble, trees and crates use Kenney tiles; `hidden` are tile spots of hidden side paths. */
export function renderMapCanvas(m: MapData, sheet?: CanvasImageSource | null, hidden: Array<{ x: number; y: number }> = []): HTMLCanvasElement {
  const cv = document.createElement('canvas');
  cv.width = MAP_W * TILE;
  cv.height = MAP_H * TILE;
  const c = cv.getContext('2d')!;
  c.imageSmoothingEnabled = false;
  const set = TOWN[(m.region ?? 1) as 1 | 2 | 3] ?? TOWN[1];
  for (let y = 0; y < MAP_H; y++)
    for (let x = 0; x < MAP_W; x++) {
      const t = m.tiles[idx(x, y)];
      const seed = x * 7349 + y * 1931;
      const list = sheet ? set[t] : undefined;
      if (!list) {
        drawTile(c, t, x * TILE, y * TILE, seed);
        continue;
      }
      const dark = hidden.some((h) => Math.abs(h.x - x) <= 4 && Math.abs(h.y - y) <= 4);
      const ramp = dark ? RAMP_HIDDEN : FLOORISH.has(t) ? RAMP_FLOOR : RAMP_WALL;
      const pickOf = (xs: number[]) => xs[(seed >>> 3) % xs.length];
      if (OVERLAY.has(t)) c.drawImage(townTile(sheet!, pickOf(set[T.Ground]!), dark ? RAMP_HIDDEN : RAMP_FLOOR), x * TILE, y * TILE);
      c.drawImage(townTile(sheet!, pickOf(list), OVERLAY.has(t) && !dark ? RAMP_WALL : ramp), x * TILE, y * TILE);
    }
  return cv;
}

// 画风统一 (原型): people and monsters are Kenney Tiny Dungeon tiles recoloured by brightness, like the map tiles.
// Figures use the same 5-step ramp as the dialog portraits (brighter than the ground, so they read); map monsters
// use only the three darkest steps, so the glowing garbled name stays the thing you look at.
export const CHAR_RAMP = ['#1e0606', '#4e1616', '#8f1f24', '#d8333a', '#ffb4a8'];
export const SHADE_RAMP = ['#14050a', '#5a1419', '#a0242b'];
const dcache = new Map<string, HTMLCanvasElement>();
export function dungeonTile(sheet: CanvasImageSource, tile: number, ramp: string[] = CHAR_RAMP, outline?: string): HTMLCanvasElement {
  const key = `${tile}:${ramp.join('')}:${outline ?? ''}`;
  const hit = dcache.get(key);
  if (hit) return hit;
  const cv = document.createElement('canvas');
  cv.width = cv.height = 16;
  const ctx = cv.getContext('2d', { willReadFrequently: true })!;
  ctx.drawImage(sheet, (tile % 12) * 16, Math.floor(tile / 12) * 16, 16, 16, 0, 0, 16, 16);
  const img = ctx.getImageData(0, 0, 16, 16);
  const d = img.data;
  const shades = ramp.map((h) => [1, 3, 5].map((k) => parseInt(h.slice(k, k + 2), 16)));
  const solid = (i: number) => d[i + 3] >= 8;
  const was = new Uint8Array(256);
  // Stretch the tile's own brightness range over the ramp (as the map tiles do), so faces and eyes keep their detail.
  const lums: number[] = [];
  for (let i = 0; i < d.length; i += 4) lums.push(solid(i) ? (0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]) / 255 : -1);
  const seen = lums.filter((v) => v >= 0);
  const lo = Math.min(...seen);
  const span = Math.max(0.25, Math.max(...seen) - lo);
  for (let i = 0; i < d.length; i += 4) {
    if (!solid(i)) continue;
    was[i / 4] = 1;
    const lum = Math.min(0.999, (lums[i / 4] - lo) / span);
    const c = shades[Math.min(shades.length - 1, Math.floor(lum * shades.length))];
    d[i] = c[0];
    d[i + 1] = c[1];
    d[i + 2] = c[2];
    d[i + 3] = 255;
  }
  if (outline) {
    // Kenney figures already carry a dark outline; recolour that ring's outermost pixels to the accent colour.
    const o = [1, 3, 5].map((k) => parseInt(outline.slice(k, k + 2), 16));
    for (let p = 0; p < 256; p++) {
      if (!was[p]) continue;
      const x = p % 16, y = Math.floor(p / 16);
      const edge = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => { const nx = x + dx, ny = y + dy; return nx < 0 || ny < 0 || nx > 15 || ny > 15 || !was[ny * 16 + nx]; });
      if (edge) (d[p * 4] = o[0], d[p * 4 + 1] = o[1], d[p * 4 + 2] = o[2]);
    }
  }
  ctx.putImageData(img, 0, 0);
  dcache.set(key, cv);
  return cv;
}

/** Look → Kenney figure: gender and hair pick the figure, the hair colour becomes the outline accent. */
export function heroTile(look: Look): number {
  return look.gender ? [99, 88, 100, 99][look.hair] : [98, 87, 85, 98][look.hair];
}
export function heroFramesKenney(look: Look, sheet: CanvasImageSource): HTMLCanvasElement[] {
  const base = dungeonTile(sheet, heroTile(look), CHAR_RAMP, look.color ? HAIR_COLORS[look.color] : '#e8dccf');
  return [0, 1].map((bob) => {
    const cv = document.createElement('canvas');
    cv.width = cv.height = 16;
    cv.getContext('2d')!.drawImage(base, 0, -bob);
    return cv;
  });
}

/** Bitmaps: '.' transparent, other chars map to colours. */
function bitmap(rows: string[], colors: Record<string, string>, scale = 1): HTMLCanvasElement {
  const h = rows.length;
  const w = rows[0].length;
  const cv = document.createElement('canvas');
  cv.width = w * scale;
  cv.height = h * scale;
  const c = cv.getContext('2d')!;
  rows.forEach((row, y) =>
    [...row].forEach((ch, x) => {
      if (ch !== '.' && colors[ch]) px(c, x * scale, y * scale, colors[ch], scale, scale);
    }),
  );
  return cv;
}

const HERO_A = [
  '....hhhh....',
  '...hhhhhh...',
  '...hssssh...',
  '...seses....',
  '...ssssss...',
  '....ssss....',
  '..rrrrrrrr..',
  '.ccrrrrrrcc.',
  '.cccccccccc.',
  '.sccccccccs.',
  '..cccccccc..',
  '..cccccccc..',
  '...pp..pp...',
  '...pp..pp...',
  '...pp...pp..',
  '..bb....bb..',
];
const HERO_B = [
  '....hhhh....',
  '...hhhhhh...',
  '...hssssh...',
  '...seses....',
  '...ssssss...',
  '....ssss....',
  '..rrrrrrrr..',
  '.ccrrrrrrcc.',
  '.cccccccccc.',
  '.sccccccccs.',
  '..cccccccc..',
  '..cccccccc..',
  '...pp..pp...',
  '...pp..pp...',
  '..pp...pp...',
  '..bb....bb..',
];
const HERO_COLORS = { h: '#2a1a1a', s: '#e8d6c4', e: '#120808', r: '#c8242f', c: '#3a3036', p: '#1f1a20', b: '#0c0809' };

const HILDE = [
  '....gggg....',
  '...gggggg...',
  '..gggsssgg..',
  '..ggseseg...',
  '..gggssggg..',
  '..gggggggg..',
  '.gggggggggg.',
  '.gggggggggg.',
  '.ggggoogggg.',
  '.gggooooggg.',
  '.gggggggggg.',
  '.gggggggggg.',
  '..gggggggg..',
  '..gggggggg..',
  '..gggggggg..',
  '...bb..bb...',
];

const EMBER_FRAMES = [
  [
    '......o.......',
    '.....ooo......',
    '....ooyoo.....',
    '...ooyyyoo....',
    '...oyyyyyo..o.',
    '..ooyyyyyoo...',
    '..oyyywyyyo...',
    '...oyywwyo....',
    '.wwwwwwwwwwww.',
    'ww.ww.ww.ww.ww',
  ],
  [
    '.......o......',
    '......ooo.....',
    '.....ooyoo....',
    '....ooyyyo....',
    '.o..oyyyyyo...',
    '...ooyyyyyoo..',
    '...oyyywyyyo..',
    '....oyywwyo...',
    '.wwwwwwwwwwww.',
    'ww.ww.ww.ww.ww',
  ],
];
const EMBER_COLORS = { o: '#c42a1e', y: '#ff8a2a', w: '#3a2a26' };

const SIGN = [
  '.wwwwwwwwwwwwww.',
  'wbbbbbbbbbbbbbbw',
  'wbbbbbbbbbbbbbbw',
  'wbbbbbbbbbbbbbbw',
  '.wwwwwwwwwwwwww.',
  '.......pp.......',
  '.......pp.......',
  '.......pp.......',
];
const SIGN_COLORS = { w: '#5a3a2a', b: '#1d1210', p: '#3a2a20' };

/** The hero drawn with a look: hair style and colour, body width, a skirt for 女. */
export function heroFrames(look: Look): HTMLCanvasElement[] {
  return [HERO_A, HERO_B].map((base) => {
    const rows = base.map((r) => [...r]);
    const set = (y: number, x: number, ch: string) => {
      if (y >= 0 && y < rows.length && x >= 0 && x < rows[0].length) rows[y][x] = ch;
    };
    // Hair.
    if (look.hair === 1) for (let y = 2; y <= 6; y++) (set(y, 3, 'h'), set(y, 8, 'h'));
    if (look.hair === 2) {
      rows[0] = [...'..h.hh.h....'];
      set(1, 2, 'h'), set(1, 9, 'h');
    }
    if (look.hair === 3) for (let y = 1; y <= 5; y++) set(y, 9 + (y > 2 ? 1 : 0), 'h');
    // Body width: thin drops the outer coat columns, stout widens the coat and legs.
    if (look.body === 0) for (let y = 7; y <= 11; y++) for (const x of [1, 10]) if ('cs'.includes(rows[y][x])) set(y, x, '.');
    if (look.body === 2) for (let y = 7; y <= 11; y++) (set(y, 0, rows[y][1] === '.' ? '.' : 'c'), set(y, 11, rows[y][10] === '.' ? '.' : 'c'), set(y, 1, 'c'), set(y, 10, 'c'));
    // 女: a coat skirt over the upper legs.
    if (look.gender === 1) (rows[12] = [...'..cccccccc..'], (rows[11] = [...'..cccccccc..']));
    return bitmap(rows.map((r) => r.join('')), { ...HERO_COLORS, h: HAIR_COLORS[look.color] });
  });
}

export interface Textures {
  hero: HTMLCanvasElement[];
  hilde: HTMLCanvasElement;
  fire: HTMLCanvasElement[];
  sign: HTMLCanvasElement;
  glow: HTMLCanvasElement;
  dot: HTMLCanvasElement;
}

function radialGlow(size: number, color: string): HTMLCanvasElement {
  const cv = document.createElement('canvas');
  cv.width = cv.height = size;
  const c = cv.getContext('2d')!;
  const g = c.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, color);
  g.addColorStop(1, 'rgba(0,0,0,0)');
  c.fillStyle = g;
  c.fillRect(0, 0, size, size);
  return cv;
}

export function makeTextures(): Textures {
  const dot = document.createElement('canvas');
  dot.width = dot.height = 2;
  px(dot.getContext('2d')!, 0, 0, '#ffffff', 2, 2);
  return {
    hero: [bitmap(HERO_A, HERO_COLORS), bitmap(HERO_B, HERO_COLORS)],
    hilde: bitmap(HILDE, { g: '#4a4048', s: '#d9c6b4', e: '#120808', o: '#ff7a2a', b: '#0c0809' }),
    fire: EMBER_FRAMES.map((f) => bitmap(f, EMBER_COLORS)),
    sign: bitmap(SIGN, SIGN_COLORS),
    glow: radialGlow(128, 'rgba(255,90,50,0.55)'),
    dot,
  };
}

/** Tiny pixel icons for intents and UI, as data URLs (used by the DOM layer). */
const ICONS: Record<string, string[]> = {
  attack: ['.......xx', '......xx.', '.....xx..', 'x...xx...', '.x.xx....', '..xx.....', '.x.x.....', 'x...x....', '.........'],
  defend: ['.xxxxxxx.', 'xx.....xx', 'x..xxx..x', 'x..xxx..x', 'x...x...x', '.x.....x.', '..x...x..', '...x.x...', '....x....'],
  charge: ['..xxxxx..', '.x.....x.', 'x..xxx..x', 'x.x...x.x', 'x.x.x.x.x', 'x.x..x..x', 'x..x....x', '.x..xxxx.', '..x......'],
  heal: ['.........', '.xx...xx.', 'xxxx.xxxx', 'xxxxxxxxx', 'xxxxxxxxx', '.xxxxxxx.', '..xxxxx..', '...xxx...', '....x....'],
  wait: ['.........', '..xxxxx..', '.x.....x.', 'x..x....x', 'x..xxx..x', 'x.......x', '.x.....x.', '..xxxxx..', '.........'],
};

export function iconUrl(name: string, color: string, scale = 3): string {
  const rows = ICONS[name] ?? ICONS.wait;
  return bitmap(rows, { x: color }, scale).toDataURL();
}

export const GLITCH = '▓▒░█▚▞#¥§¤ẞ@%&';
