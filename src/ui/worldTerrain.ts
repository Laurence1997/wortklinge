// 大地图的地形 (Lucas 2026-11-27「做成游戏地图，有分界有特色」): one continent drawn once on a canvas.
// Each city owns a territory (a noise-warped Voronoi cell around its spot). Borders between two stages are drawn as
// landforms: A1|A2 a river, A2|B1 a mountain ridge, B1|B2 an old wall, B2|C1 a dark rift; borders inside a stage are
// thin dashed lines. Land takes its stage's biome, tinted with the region's colour; locked territories sit under
// fog; 蚀变 hosts get dark-red veins (faint once purified). Cached per state key, so reopening the map costs nothing.

export const TW = 1200;
export const TH = 660;

export type Stage = 'A1' | 'A2' | 'B1' | 'B2' | 'C1';

export interface TerrainCity {
  region: number;
  x: number;
  y: number;
  stage: Stage;
  accent: string;
  open: boolean;
  /** 0 none, 1 蚀变中, 2 已净化 */
  erode: 0 | 1 | 2;
}

// ---- noise -------------------------------------------------------------------------------------------------------
function hash(x: number, y: number, seed: number): number {
  let h = (x * 374761393 + y * 668265263 + seed * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}
function vnoise(x: number, y: number, seed: number): number {
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash(xi, yi, seed), b = hash(xi + 1, yi, seed), c = hash(xi, yi + 1, seed), d = hash(xi + 1, yi + 1, seed);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
export function fbm(x: number, y: number, seed: number, oct = 4): number {
  let sum = 0, amp = 0.5, f = 1;
  for (let i = 0; i < oct; i++) {
    sum += amp * vnoise(x * f, y * f, seed + i * 17);
    amp *= 0.5;
    f *= 2;
  }
  return sum; // ~0..1
}
/** Deterministic random for decor. */
export function rng(seed: number): () => number {
  let t = seed >>> 0;
  return () => {
    t = (t + 0x6d2b79f5) >>> 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function hex(c: string): [number, number, number] {
  const n = parseInt(c.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
const mix = (a: number, b: number, t: number) => a + (b - a) * t;

// ---- shape -------------------------------------------------------------------------------------------------------
/** Signed land value: > 0 land. A rounded continent with a ragged coast, a bay in the south for 雾港. */
function landValue(x: number, y: number): number {
  const mx = 34, my = 40, r = 120;
  const dx = Math.max(mx + r - x, 0, x - (TW - mx - r));
  const dy = Math.max(my + r - y, 0, y - (TH - my - r));
  const inner = Math.min(Math.min(x - mx, TW - mx - x), Math.min(y - my, TH - my - y));
  const sd = dx > 0 && dy > 0 ? r - Math.hypot(dx, dy) : Math.min(inner, r);
  let v = sd + (fbm(x / 90, y / 90, 3) - 0.5) * 120 + (fbm(x / 26, y / 26, 9, 2) - 0.5) * 22;
  // the bay of 雾港 and a cove in the north
  v -= Math.max(0, 90 - Math.hypot((x - 500) * 0.9, (y - 668) * 1.15)) * 1.6;
  v -= Math.max(0, 60 - Math.hypot(x - 830, y - 28)) * 1.4;
  return v;
}

const BIOME: Record<Stage, [number, number, number]> = {
  A1: hex('#bfe58a'), // meadow
  A2: hex('#d8ec98'), // farmland
  B1: hex('#b8dcae'), // hills
  B2: hex('#f2dca0'), // stone and sand
  C1: hex('#e4ded2'), // ash
};
const BORDER: Record<string, 'river' | 'ridge' | 'wall' | 'rift'> = { 'A1|A2': 'river', 'A2|B1': 'ridge', 'B1|B2': 'wall', 'B2|C1': 'rift' };
const ORDER: Stage[] = ['A1', 'A2', 'B1', 'B2', 'C1'];
function borderKind(a: Stage, b: Stage): 'river' | 'ridge' | 'wall' | 'rift' | 'plain' {
  const [p, q] = ORDER.indexOf(a) < ORDER.indexOf(b) ? [a, b] : [b, a];
  return BORDER[`${p}|${q}`] ?? (p === q ? 'plain' : 'ridge');
}

const cache = new Map<string, HTMLCanvasElement>();
/** Pixel size: the map is computed and drawn at TW/PX × TH/PX and shown with crisp, square pixels. */
export const PX = 2.5;
export const LW = Math.round(TW / PX);
export const LH = Math.round(TH / PX);

export function terrain(cities: TerrainCity[], overlay?: string): HTMLCanvasElement {
  const key = cities.map((c) => `${c.region}${c.open ? 'o' : 'l'}${c.erode}`).join(',');
  const hit = cache.get(key);
  if (hit) return hit;
  const cv = document.createElement('canvas');
  cv.width = LW;
  cv.height = LH;
  const ctx = cv.getContext('2d')!;
  const img = ctx.createImageData(LW, LH);
  const px = img.data;
  const own = new Int8Array(LW * LH).fill(-1);
  const land = new Float32Array(LW * LH);

  for (let ly = 0; ly < LH; ly++)
    for (let lx = 0; lx < LW; lx++) {
      const x = (lx + 0.5) * PX, y = (ly + 0.5) * PX;
      const i = ly * LW + lx;
      const lv = landValue(x, y);
      land[i] = lv;
      if (lv <= 0) continue;
      const wx = x + (fbm(x / 70, y / 70, 21) - 0.5) * 90;
      const wy = y + (fbm(x / 70, y / 70, 33) - 0.5) * 90;
      let best = 0, bd = Infinity;
      for (let k = 0; k < cities.length; k++) {
        const d = (wx - cities[k].x) ** 2 + (wy - cities[k].y) ** 2;
        if (d < bd) {
          bd = d;
          best = k;
        }
      }
      own[i] = best;
    }

  const fog = hex('#e6e2da');
  const sea = hex('#4fb3d9'), deep = hex('#2f86b8'), shallow = hex('#9fe0ee');
  const red = hex('#7a1020');
  for (let ly = 0; ly < LH; ly++)
    for (let lx = 0; lx < LW; lx++) {
      const x = (lx + 0.5) * PX, y = (ly + 0.5) * PX;
      const i = ly * LW + lx;
      const o = i * 4;
      const k = own[i];
      let r: number, g: number, b: number;
      if (k < 0) {
        const depth = Math.min(1, -land[i] / 80);
        const d3 = Math.min(1, depth * 2.5);
        r = mix(shallow[0], mix(sea[0], deep[0], depth), d3);
        g = mix(shallow[1], mix(sea[1], deep[1], depth), d3);
        b = mix(shallow[2], mix(sea[2], deep[2], depth), d3);
        // dithered depth bands and wave flecks
        if (depth > 0.5 && (lx + ly) % 2 === 0) (r -= 8), (g -= 8), (b -= 6);
        const n = fbm(x / 40, y / 40, 51, 3);
        if (depth > 0.3 && Math.abs(Math.sin((y + n * 40) / 9)) > 0.97 && hash(lx >> 2, ly, 5) > 0.6) (r = 225), (g = 245), (b = 250);
        if (-land[i] < 5) (r = 236), (g = 250), (b = 252); // surf
      } else {
        const c = cities[k];
        const base = BIOME[c.stage];
        const acc = hex(c.accent);
        const relief = fbm(x / 55, y / 55, 77) - 0.5;
        const t = 0.62;
        r = mix(base[0], acc[0], t);
        g = mix(base[1], acc[1], t);
        b = mix(base[2], acc[2], t);
        // banded relief, 3 steps, like a palette
        const step = relief > 0.12 ? 1.12 : relief < -0.12 ? 0.9 : 1;
        r *= step;
        g *= step;
        b *= step;
        if (land[i] < 7) (r = 236), (g = 218), (b = 170); // sand
        if (c.erode) {
          const vein = Math.abs(fbm(x / 34, y / 34, 140) - 0.5);
          const a = c.erode === 1 ? 1 : 0.35;
          r = mix(r, 120, 0.12 * a);
          g = mix(g, 40, 0.12 * a);
          b = mix(b, 50, 0.12 * a);
          if (vein < 0.011 && fbm(x / 120, y / 120, 141) > 0.45) (r = mix(r, red[0], 0.9 * a)), (g = mix(g, red[1], 0.9 * a)), (b = mix(b, red[2], 0.9 * a));
        }
        if (!c.open) {
          const cloud = fbm(x / 60, y / 60, 199);
          const f = Math.min(1, 0.8 + cloud * 0.3);
          r = mix(r, fog[0], f);
          g = mix(g, fog[1], f);
          b = mix(b, fog[2], f);
          if (cloud > 0.62 && (lx + ly) % 2 === 0) (r = 250), (g = 249), (b = 246);
        }
      }
      px[o] = Math.max(0, Math.min(255, r));
      px[o + 1] = Math.max(0, Math.min(255, g));
      px[o + 2] = Math.max(0, Math.min(255, b));
      px[o + 3] = 255;
    }

  // coast outline (land pixel next to sea) and borders
  const marks: Array<{ x: number; y: number; kind: string }> = [];
  const paint = (lx: number, ly: number, c: [number, number, number], a: number) => {
    if (lx < 0 || ly < 0 || lx >= LW || ly >= LH || own[ly * LW + lx] < 0) return;
    const o = (ly * LW + lx) * 4;
    px[o] = mix(px[o], c[0], a);
    px[o + 1] = mix(px[o + 1], c[1], a);
    px[o + 2] = mix(px[o + 2], c[2], a);
  };
  for (let ly = 1; ly < LH - 1; ly++)
    for (let lx = 1; lx < LW - 1; lx++) {
      const i = ly * LW + lx;
      const k = own[i];
      if (k < 0) continue;
      if (own[i - 1] < 0 || own[i + 1] < 0 || own[i - LW] < 0 || own[i + LW] < 0) {
        paint(lx, ly, [60, 52, 40], 1);
        if (own[i + LW] < 0 && ly + 1 < LH) {
          // cliff shadow under the south coast
          const o = (i + LW) * 4;
          px[o] = 90; px[o + 1] = 120; px[o + 2] = 120;
        }
        continue;
      }
      const kr = own[i + 1], kd = own[i + LW];
      const other = kr >= 0 && kr !== k ? kr : kd >= 0 && kd !== k ? kd : -1;
      if (other < 0) continue;
      const kind = borderKind(cities[k].stage, cities[other].stage);
      const lockedBoth = !cities[k].open && !cities[other].open;
      const fade = lockedBoth ? 0.3 : 1;
      if (kind === 'plain') {
        paint(lx, ly, [70, 52, 36], 0.75 * fade);
      } else if (kind === 'river') {
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) paint(lx + dx, ly + dy, dx === 0 && dy === 0 ? [120, 200, 235] : [50, 130, 190], fade);
      } else if (kind === 'rift') {
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) paint(lx + dx, ly + dy, dx === 0 && dy === 0 ? [30, 14, 24] : [80, 60, 74], 0.95 * fade);
      } else {
        paint(lx, ly, kind === 'wall' ? [100, 92, 86] : [96, 72, 48], 0.9 * fade);
      }
      if ((kind === 'ridge' || kind === 'wall') && hash(lx, ly, 7) < 0.4) marks.push({ x: lx * PX, y: ly * PX, kind: lockedBoth ? kind + '-dim' : kind });
    }
  ctx.putImageData(img, 0, 0);
  ctx.imageSmoothingEnabled = false;
  ctx.setTransform(1 / PX, 0, 0, 1 / PX, 0, 0);

  // ridge peaks and wall towers, spaced out
  const placed: Array<{ x: number; y: number }> = [];
  marks.sort((a, b) => a.y - b.y);
  for (const m of marks) {
    const gap = m.kind.startsWith('ridge') ? 20 : 24;
    if (placed.some((p) => Math.abs(p.x - m.x) < gap && Math.abs(p.y - m.y) < gap)) continue;
    placed.push(m);
    ctx.globalAlpha = m.kind.endsWith('-dim') ? 0.35 : 1;
    if (m.kind.startsWith('ridge')) peak(ctx, m.x, m.y, 12 + hash(m.x | 0, m.y | 0, 3) * 7);
    else tower(ctx, m.x, m.y);
  }
  ctx.globalAlpha = 1;

  // decor: only on open land, away from the cities
  const R = rng(4242);
  for (let n = 0; n < 1500; n++) {
    const x = R() * TW, y = R() * TH;
    const i = Math.floor(y / PX) * LW + Math.floor(x / PX);
    const k = own[i];
    if (k < 0 || land[i] < 16) continue;
    const c = cities[k];
    if (!c.open) continue;
    if (cities.some((q) => Math.hypot(q.x - x, (q.y - y) * 1.2) < 58)) continue;
    if (fbm(x / 80, y / 80, 300 + c.region) < 0.47) continue;
    drawDecor(ctx, DECOR[c.region] ?? 'tree', x, y, R);
  }
  // whirlpool in the south-east sea
  ctx.strokeStyle = '#1d5f8c';
  ctx.lineWidth = 3;
  for (let k = 0; k < 3; k++) {
    ctx.beginPath();
    ctx.ellipse(1010, 628, 34 - k * 10, 12 - k * 3.5, 0, 0.3, Math.PI * 1.7);
    ctx.stroke();
  }
  ctx.setTransform(1, 0, 0, 1, 0, 0);

  // landmarks: an SVG of all icons rasterised onto the small canvas, so they come out as pixels too
  if (overlay) {
    const im = new Image();
    im.onload = () => {
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(im, 0, 0, LW, LH);
    };
    im.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(overlay);
  }
  cache.set(key, cv);
  return cv;
}

function peak(ctx: CanvasRenderingContext2D, x: number, y: number, sz: number): void {
  ctx.beginPath();
  ctx.moveTo(x - sz, y + sz * 0.55);
  ctx.lineTo(x, y - sz * 0.8);
  ctx.lineTo(x + sz, y + sz * 0.55);
  ctx.closePath();
  ctx.fillStyle = '#a88a62';
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(x, y - sz * 0.8);
  ctx.lineTo(x + sz, y + sz * 0.55);
  ctx.lineTo(x + sz * 0.1, y + sz * 0.55);
  ctx.closePath();
  ctx.fillStyle = '#7a6044';
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(x - sz * 0.32, y - sz * 0.35);
  ctx.lineTo(x, y - sz * 0.8);
  ctx.lineTo(x + sz * 0.32, y - sz * 0.35);
  ctx.closePath();
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  ctx.strokeStyle = '#3e2e1e';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(x - sz, y + sz * 0.55);
  ctx.lineTo(x, y - sz * 0.8);
  ctx.lineTo(x + sz, y + sz * 0.55);
  ctx.stroke();
}

function tower(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  ctx.fillStyle = '#9a928a';
  ctx.strokeStyle = '#3e3a34';
  ctx.lineWidth = 2.5;
  ctx.fillRect(x - 6, y - 10, 12, 15);
  ctx.strokeRect(x - 6, y - 10, 12, 15);
  ctx.fillStyle = '#3e3a34';
  ctx.fillRect(x - 7.5, y - 15, 4, 5);
  ctx.fillRect(x - 2, y - 15, 4, 5);
  ctx.fillRect(x + 3.5, y - 15, 4, 5);
}

type Decor = 'tree' | 'pine' | 'field' | 'hill' | 'rock' | 'house' | 'dead';
const DECOR: Record<number, Decor> = { 1: 'pine', 2: 'field', 3: 'tree', 4: 'house', 5: 'tree', 6: 'rock', 7: 'house', 9: 'house', 10: 'hill', 12: 'tree', 13: 'hill', 14: 'field', 16: 'tree', 17: 'rock', 18: 'hill', 20: 'dead' };

function drawDecor(ctx: CanvasRenderingContext2D, style: Decor, x0: number, y0: number, R: () => number): void {
  ctx.save();
  ctx.translate(x0, y0);
  ctx.scale(1.6, 1.6);
  const x = 0, y = 0;
  ctx.lineWidth = 1.5;
  switch (style) {
    case 'tree':
      ctx.fillStyle = '#5d7d3c';
      ctx.beginPath();
      ctx.arc(x, y, 4.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#7fa255';
      ctx.beginPath();
      ctx.arc(x - 1.2, y - 1.4, 2.4, 0, Math.PI * 2);
      ctx.fill();
      break;
    case 'pine':
      ctx.fillStyle = '#3f6a3a';
      ctx.beginPath();
      ctx.moveTo(x, y - 8);
      ctx.lineTo(x + 4.5, y + 3);
      ctx.lineTo(x - 4.5, y + 3);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#5b3e24';
      ctx.fillRect(x - 0.8, y + 3, 1.6, 2.5);
      break;
    case 'field': {
      ctx.strokeStyle = R() < 0.5 ? '#c8a64a' : '#a7b85a';
      for (let j = 0; j < 4; j++) {
        ctx.beginPath();
        ctx.moveTo(x - 7, y - 4 + j * 2.6);
        ctx.lineTo(x + 7, y - 6 + j * 2.6);
        ctx.stroke();
      }
      break;
    }
    case 'hill':
      ctx.fillStyle = 'rgba(110, 120, 80, .45)';
      ctx.beginPath();
      ctx.ellipse(x, y, 10, 5, 0, Math.PI, 0);
      ctx.fill();
      ctx.strokeStyle = 'rgba(70, 70, 50, .6)';
      ctx.beginPath();
      ctx.ellipse(x, y, 10, 5, 0, Math.PI, 0);
      ctx.stroke();
      break;
    case 'rock':
      ctx.fillStyle = '#9a948a';
      ctx.strokeStyle = '#5e5a52';
      ctx.beginPath();
      ctx.moveTo(x - 4, y + 2);
      ctx.lineTo(x - 2, y - 3);
      ctx.lineTo(x + 3, y - 2);
      ctx.lineTo(x + 4, y + 2);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      break;
    case 'house':
      ctx.fillStyle = '#efe4cf';
      ctx.strokeStyle = '#6a5640';
      ctx.fillRect(x - 3.5, y - 2, 7, 5);
      ctx.strokeRect(x - 3.5, y - 2, 7, 5);
      ctx.fillStyle = '#a2553a';
      ctx.beginPath();
      ctx.moveTo(x - 5, y - 2);
      ctx.lineTo(x, y - 6);
      ctx.lineTo(x + 5, y - 2);
      ctx.closePath();
      ctx.fill();
      break;
    case 'dead':
      ctx.strokeStyle = '#7d766c';
      ctx.beginPath();
      ctx.moveTo(x, y + 4);
      ctx.lineTo(x, y - 5);
      ctx.moveTo(x, y - 2);
      ctx.lineTo(x - 3, y - 5);
      ctx.moveTo(x, y - 1);
      ctx.lineTo(x + 3, y - 4);
      ctx.stroke();
      break;
  }
  ctx.restore();
}
