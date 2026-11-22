// 头像和图标 (0.6 第 7 块): Kenney Tiny Dungeon tiles (CC0, public/art/kenney-tiny-dungeon.png), recoloured to a
// five-step red ramp by brightness so they sit in the red-on-black look. Monsters by kind, gear by slot, people by
// name. Jonas and Lina stay shadows until restored (boss 1 beaten / Lina freed). Gear icons: border = quality.

import type { Battle } from '../core/combat';
import type { Slot } from '../core/types';

const T = 16;
const COLS = 12;
const RAMP = ['#1e0606', '#4e1616', '#8f1f24', '#d8333a', '#ffb4a8'];

let sheet: HTMLImageElement | null = null;
const waiting: Array<() => void> = [];
const cache = new Map<string, HTMLCanvasElement>();

function loadSheet(): HTMLImageElement {
  if (!sheet) {
    sheet = new Image();
    sheet.onload = () => waiting.splice(0).forEach((f) => f());
    sheet.src = './art/kenney-tiny-dungeon.png';
  }
  return sheet;
}

const rgb = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));

/** One 16×16 tile, recoloured (or as a shadow), cached. */
function tileCanvas(tile: number, shadow: boolean): HTMLCanvasElement {
  const key = `${tile}${shadow ? 's' : ''}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const cv = document.createElement('canvas');
  cv.width = cv.height = T;
  const ctx = cv.getContext('2d', { willReadFrequently: true })!;
  ctx.drawImage(sheet!, (tile % COLS) * T, Math.floor(tile / COLS) * T, T, T, 0, 0, T, T);
  const img = ctx.getImageData(0, 0, T, T);
  const d = img.data;
  const ramp = RAMP.map(rgb);
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] < 8) continue;
    const lum = (0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]) / 255;
    // Shadows use only the two darkest steps (docs 第 7 块): outline darkest, body one step up.
    const c = shadow ? (lum < 0.25 ? ramp[0] : ramp[1]) : ramp[Math.min(4, Math.floor(lum * 5))];
    d[i] = c[0];
    d[i + 1] = c[1];
    d[i + 2] = c[2];
    d[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  cache.set(key, cv);
  return cv;
}

/** A tile drawn at scale×16 px (drawn once the sheet has loaded). */
export function icon(tile: number, scale = 2, shadow = false, cls = 'icon'): HTMLCanvasElement {
  const cv = document.createElement('canvas');
  cv.width = cv.height = T * scale;
  cv.className = cls;
  const draw = () => {
    const ctx = cv.getContext('2d')!;
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, cv.width, cv.height);
    ctx.drawImage(tileCanvas(tile, shadow), 0, 0, cv.width, cv.height);
  };
  const img = loadSheet();
  if (img.complete && img.naturalWidth) draw();
  else waiting.push(draw);
  return cv;
}

/** Monster portrait tile by kind. */
export function monsterTile(b: Battle, boss = false): number {
  if (boss) return 109;
  if (b.word.family === 'truhe' || b.flees) return 92;
  if (b.rusty || b.curse) return 110;
  if (b.phrase) return 124;
  if (b.pluralMon) return 123;
  const p = b.word.pos;
  if (p === 'n') return 108;
  if (p === 'v') return 121;
  if (p === 'adj') return 122;
  return 120;
}

export const SLOT_TILE: Record<Slot, number> = { pen: 130, coat: 102, amulet: 101, dict: 66, glasses: 60 };

/** Speaker → portrait tile; shadow until the person is restored. */
const PEOPLE: Array<[RegExp, number, string?]> = [
  [/Hilde/, 111],
  [/Greta/, 84],
  [/Mira/, 99],
  [/Konrad/, 86],
  [/Brandt/, 85],
  [/考官/, 96],
  [/Weber/, 100],
  [/守夜人/, 97],
  [/Lina|幽灵检票员/, 88, 'lina'],
  [/Jonas|无名的邻居/, 112, 'jonas'],
];

let restored: (who: 'lina' | 'jonas') => boolean = () => false;
export function setRestored(fn: (who: 'lina' | 'jonas') => boolean): void {
  restored = fn;
}

export function portrait(who: string, scale = 3): HTMLCanvasElement | null {
  const hit = PEOPLE.find(([re]) => re.test(who));
  if (!hit) return null;
  const [, tile, id] = hit;
  return icon(tile, scale, !!id && !restored(id as 'lina' | 'jonas'), 'portrait');
}
