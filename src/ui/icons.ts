// 头像和图标 (0.6 第 7 块): Kenney Tiny Dungeon tiles (CC0, public/art/kenney-tiny-dungeon.png), recoloured to a
// five-step red ramp by brightness so they sit in the red-on-black look. Monsters by kind, gear by slot, people by
// name. Jonas and Lina stay shadows until restored (boss 1 beaten / Lina freed). Gear icons: border = quality.

import type { Battle } from '../core/combat';
import type { Slot } from '../core/types';
import { dungeonTile, heroTile, heroTinyCanvas, CHAR_RAMP, CHARM_W, CHARM_X, heroCharm } from '../game/sprites';
import type { Look } from '../core/look';
import { NPC_ART } from '../data/npcArt';
import { DRAWN, DRAWN_PAL } from '../data/drawnArt';
import { artKey, monsterCanvas, SHEET_URL, wordArt as kindArt, type MonArt, type SheetId } from '../game/monsterArt';

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

/** 1.0.12 试玩 #78: Tiny Dungeon has no glasses or headphones; these negative tile ids draw the code-drawn word art. */
const DRAWN_TILE: Record<number, string> = { [-1]: 'brille', [-2]: 'kopfhoerer' };

function drawnTile(id: string): HTMLCanvasElement {
  const cv = document.createElement('canvas');
  cv.width = cv.height = T;
  const ctx = cv.getContext('2d')!;
  (DRAWN[id] ?? '').split('/').forEach((row, y) =>
    [...row].forEach((ch, x) => {
      if (ch === '.' || !DRAWN_PAL[ch]) return;
      ctx.fillStyle = DRAWN_PAL[ch];
      ctx.fillRect(x, y, 1, 1);
    }),
  );
  return cv;
}

/** One 16×16 tile, recoloured (or as a shadow), cached. */
function tileCanvas(tile: number, shadow: boolean, bright = false): HTMLCanvasElement {
  const key = `${tile}${shadow ? 's' : ''}${bright ? 'b' : ''}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const own = DRAWN_TILE[tile] ? drawnTile(DRAWN_TILE[tile]) : null;
  if (own && !shadow) {
    cache.set(key, own);
    return own;
  }
  // 美术小修 A (2026-11-26): on bright daily maps gear icons and portraits keep Kenney's own colours (like the map
  // figures), and shadows / empty slots are a light silhouette instead of near-black.
  if (bright && !shadow) {
    const cv = document.createElement('canvas');
    cv.width = cv.height = T;
    cv.getContext('2d')!.drawImage(sheet!, (tile % COLS) * T, Math.floor(tile / COLS) * T, T, T, 0, 0, T, T);
    cache.set(key, cv);
    return cv;
  }
  if (!shadow) {
    const cv = dungeonTile(sheet!, tile, CHAR_RAMP);
    cache.set(key, cv);
    return cv;
  }
  const cv = document.createElement('canvas');
  cv.width = cv.height = T;
  const ctx = cv.getContext('2d', { willReadFrequently: true })!;
  if (own) ctx.drawImage(own, 0, 0);
  else ctx.drawImage(sheet!, (tile % COLS) * T, Math.floor(tile / COLS) * T, T, T, 0, 0, T, T);
  const img = ctx.getImageData(0, 0, T, T);
  const d = img.data;
  const ramp = (bright ? ['#a8957c', '#d6c8b2', '#d6c8b2', '#d6c8b2', '#d6c8b2'] : RAMP).map(rgb);
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
    ctx.drawImage(tileCanvas(tile, shadow, document.body.classList.contains('bright')), 0, 0, cv.width, cv.height);
  };
  const img = loadSheet();
  if (img.complete && img.naturalWidth) draw();
  else waiting.push(draw);
  return cv;
}

/** Your own figure (same as on the map, without the outline), hair in its own colour. On a bright daily map it keeps
 *  its own colours like the map figure (美术小修 A, 2026-11-26); on dark maps it stays in the red ramp. */
export function heroIcon(look: Look, scale = 4, raw = document.body.classList.contains('bright')): HTMLCanvasElement {
  const cv = document.createElement('canvas');
  // 主角专属特征: the floating book makes the icon wider than tall: (T + CHARM_W) × T (figure stays T × T at this scale).
  cv.width = (T + CHARM_W) * scale;
  cv.height = T * scale;
  cv.className = 'mon-icon hero-icon';
  const draw = () => {
    const ctx = cv.getContext('2d')!;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(heroCharm(0), CHARM_X * scale, 0, T * scale, T * scale);
    ctx.drawImage(heroTinyCanvas(heroTile(look), look.color, sheet!, raw), 0, 0, T * scale, T * scale);
  };
  const img = loadSheet();
  if (img.complete && img.naturalWidth) draw();
  else waiting.push(draw);
  return cv;
}

/** The monster's look: special monsters keep their old Tiny Dungeon tiles, everyone else looks like their word. */
export function monsterArt(b: Battle, boss = false): MonArt {
  const d = (n: number): MonArt => ({ sheet: 'd', n });
  if (boss) return d(109);
  if (b.word.family === 'truhe' || b.flees) return d(92);
  if (b.rusty || b.curse) return d(110);
  if (b.phrase) return d(124);
  return wordArt(b.word);
}

/** Map and battle look of a word's monster (宝箱怪 keep the chest). */
export function wordArt(w: { id: string; family?: string; cat?: string }): MonArt {
  if (w.family === 'truhe') return { sheet: 'd', n: 92 };
  return kindArt(w);
}

const sheets: Partial<Record<Exclude<SheetId, 'c'>, HTMLImageElement>> = {};
const DARK = ['#1e0606', '#4e1616', '#8f1f24', '#d8333a', '#ffb4a8'];
const DEAD = ['#1e0606', '#4e1616'];
/** A monster drawn at scale×16 px: own colours on everyday maps (raw), the dark ramp on 蚀变 maps and for bosses. */
export function monsterIcon(art: MonArt, scale = 2, dead = false, cls = 'icon', raw = false): HTMLCanvasElement {
  const cv = document.createElement('canvas');
  cv.width = cv.height = T * scale;
  cv.className = cls;
  let img = art.sheet === 'c' ? null : sheets[art.sheet];
  if (!img && art.sheet !== 'c') {
    img = sheets[art.sheet] = new Image();
    img.src = SHEET_URL[art.sheet];
  }
  const ramp = dead ? DEAD : raw ? null : DARK;
  const key = `mon:${artKey(art)}:${ramp ? ramp.length : 'raw'}`;
  const draw = () => {
    let tile = cache.get(key);
    if (!tile) {
      tile = monsterCanvas(img ?? null, art, ramp);
      cache.set(key, tile);
    }
    const ctx = cv.getContext('2d')!;
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, cv.width, cv.height);
    ctx.drawImage(tile, 0, 0, cv.width, cv.height);
  };
  if (!img || (img.complete && img.naturalWidth)) draw();
  else img.addEventListener('load', draw, { once: true });
  return cv;
}

/** Map figures for NPCs (same tiles as their dialog portraits). */
export const NPC_TILE: Record<string, number> = { hilde: 111, greta: 84, mira: 99, konrad: 86, brandt: 85, examiner: 96, weber: 100, lina: 88 };

export const SLOT_TILE: Record<Slot, number> = { pen: 130, coat: 102, amulet: 101, dict: 66, glasses: -1, phones: -2 };

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

export const isRestored = (who: 'lina' | 'jonas'): boolean => restored(who);

/** The NPC_ART key for a speaker ('Ole（AI）', 'Jonas（室友）', 'Herr Brandl（房东）', '守夜人'), if it has a drawn figure. */
export function npcArtKey(who: string): string | undefined {
  if (NPC_ART[who]) return who;
  const base = who.split(/[（( ·]/)[0];
  if (NPC_ART[base]) return base;
  return Object.keys(NPC_ART).find((k) => who.startsWith(`${k}（`) || who.startsWith(`${k} `));
}

/** A drawn NPC figure at scale×16 px, in its own colours (NPCs of 2026-11-26: the adventurers and scene NPCs). */
export function npcFigure(key: string, scale = 2, cls = 'icon'): HTMLCanvasElement {
  const cv = document.createElement('canvas');
  cv.width = cv.height = T * scale;
  cv.className = cls;
  const ctx = cv.getContext('2d')!;
  (NPC_ART[key] ?? '').split('/').forEach((row, y) =>
    [...row].forEach((ch, x) => {
      if (ch === '.' || !DRAWN_PAL[ch]) return;
      ctx.fillStyle = DRAWN_PAL[ch];
      ctx.fillRect(x * scale, y * scale, scale, scale);
    }),
  );
  return cv;
}

export function portrait(who: string, scale = 3): HTMLCanvasElement | null {
  // Drawn figures first, so the 室友 Jonas does not borrow the shadow of Jonas Keller.
  const own = npcArtKey(who);
  if (own) return npcFigure(own, scale, 'portrait');
  const hit = PEOPLE.find(([re]) => re.test(who));
  if (!hit) return null;
  const [, tile, id] = hit;
  return icon(tile, scale, !!id && !restored(id as 'lina' | 'jonas'), 'portrait');
}
