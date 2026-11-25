// 怪物美术 (游戏设计十二「美术·怪物」, Lucas 2026-11-25): monsters look like what their word is: six kinds (食物、物品、
// 动物、人物、地点、抽象), a few Kenney CC0 variants each, picked by word id. Everyday regions show them in their own
// colours; 蚀变 maps and bosses recolour them to the dark ramp. Things without a face (food, objects, places) get a pair
// of eyes so they read as creatures. Words without a 类别 yet use the 抽象 kind.

export type SheetId = 'd' | 't' | 'f' | 'b';
export type MonKind = 'food' | 'item' | 'animal' | 'person' | 'place' | 'abstract';
export interface MonArt {
  sheet: SheetId;
  n: number;
  eyes?: boolean;
}

export const SHEET_URL: Record<SheetId, string> = {
  d: './art/kenney-tiny-dungeon.png',
  t: './art/kenney-tiny-town.png',
  f: './art/kenney-tiny-farm.png',
  b: './art/kenney-tiny-battle.png',
};
const COLS: Record<SheetId, number> = { d: 12, t: 12, f: 12, b: 18 };

const a = (sheet: SheetId, n: number, eyes = false): MonArt => ({ sheet, n, eyes });
/** Variants per kind (people avoid the tiles the NPCs use). */
export const KIND_POOL: Record<MonKind, MonArt[]> = {
  food: [a('f', 125, true), a('f', 8, true), a('f', 44, true), a('f', 32, true), a('f', 56, true), a('f', 123, true)],
  item: [a('t', 117, true), a('d', 117, true), a('f', 124, true), a('d', 113, true), a('f', 85, true), a('d', 89, true)],
  animal: [a('f', 120), a('f', 121), a('f', 122), a('d', 120), a('d', 122), a('d', 123)],
  person: [a('d', 87), a('d', 97), a('d', 98), a('d', 112)],
  place: [a('b', 27, true), a('b', 45, true), a('b', 63, true), a('b', 81, true), a('b', 133, true), a('b', 139, true)],
  abstract: [a('d', 108), a('d', 121), a('d', 109), a('d', 110), a('d', 124)],
};

const ZH_KIND: Record<string, MonKind> = { 食物: 'food', 物品: 'item', 动物: 'animal', 人物: 'person', 地点: 'place', 抽象: 'abstract' };
/** The word's kind from its 类别 (Chinese or English value); anything else counts as 抽象. */
export function monKind(cat: string | undefined): MonKind {
  if (!cat) return 'abstract';
  if (cat in KIND_POOL) return cat as MonKind;
  return ZH_KIND[cat] ?? 'abstract';
}

/** 专属造型 (waiting for Lucas, 2026-11-25): words whose very thing is in the art packs use that tile. */
export const OWN_LOOKS = false;
const EYES_ON: Record<string, boolean> = { food: true, item: true, place: true };

export function wordArt(w: { id: string; cat?: string; look?: string }): MonArt {
  const own = OWN_LOOKS && w.look ? /^([dtfb])(\d+)$/.exec(w.look) : null;
  if (own) return { sheet: own[1] as SheetId, n: +own[2], eyes: !!EYES_ON[monKind(w.cat)] };
  const pool = KIND_POOL[monKind(w.cat)];
  let h = 0;
  for (const ch of w.id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return pool[h % pool.length];
}

export const artKey = (art: MonArt) => `${art.sheet}${art.n}${art.eyes ? 'e' : ''}`;

const lum = (r: number, g: number, b: number) => (0.299 * r + 0.587 * g + 0.114 * b) / 255;
const rgb = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));

/** The monster as a 16×16 canvas: own colours (ramp = null) or recoloured by brightness onto a dark ramp. */
export function monsterCanvas(sheet: CanvasImageSource, art: MonArt, ramp: readonly string[] | null): HTMLCanvasElement {
  const cv = document.createElement('canvas');
  cv.width = cv.height = 16;
  const ctx = cv.getContext('2d', { willReadFrequently: true })!;
  const cols = COLS[art.sheet];
  ctx.drawImage(sheet, (art.n % cols) * 16, Math.floor(art.n / cols) * 16, 16, 16, 0, 0, 16, 16);
  const img = ctx.getImageData(0, 0, 16, 16);
  const d = img.data;
  if (art.eyes) {
    // two eyes in the upper middle, on the body only
    for (const ex of [5, 9]) {
      for (const [dx, dy, white] of [[0, 0, 1], [1, 0, 1], [0, 1, 1], [1, 1, 0]] as const) {
        const i = ((6 + dy) * 16 + ex + dx) * 4;
        if (d[i + 3] < 8) continue;
        d[i] = d[i + 1] = d[i + 2] = white ? 255 : 30;
        d[i + 3] = 255;
      }
    }
  }
  if (ramp) {
    const steps = ramp.map(rgb);
    for (let i = 0; i < d.length; i += 4) {
      if (d[i + 3] < 8) continue;
      const c = steps[Math.min(steps.length - 1, Math.floor(lum(d[i], d[i + 1], d[i + 2]) * steps.length))];
      d[i] = c[0];
      d[i + 1] = c[1];
      d[i + 2] = c[2];
    }
  }
  ctx.putImageData(img, 0, 0);
  return cv;
}
