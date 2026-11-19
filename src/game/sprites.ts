import { HAIR_COLORS, type Look } from '../core/look';
// All art is drawn in code: 1-bit-style pixel tiles in red and black, no downloaded assets.

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

/** The whole static map as one canvas (cheap to render, crisp when scaled). */
export function renderMapCanvas(m: MapData): HTMLCanvasElement {
  const cv = document.createElement('canvas');
  cv.width = MAP_W * TILE;
  cv.height = MAP_H * TILE;
  const c = cv.getContext('2d')!;
  c.imageSmoothingEnabled = false;
  for (let y = 0; y < MAP_H; y++)
    for (let x = 0; x < MAP_W; x++) drawTile(c, m.tiles[idx(x, y)], x * TILE, y * TILE, x * 7349 + y * 1931);
  return cv;
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
