import { BOSS_ART, BOSS_PAL } from '../data/bossArt';

/** Boss figures (方案 B, Lucas 2026-11-26). Each boss has its own 32×32 figure; it starts as a dark silhouette and
 *  shows more of itself the more of the name is spelled back (share = lost pips / all pips). About 15% shows at
 *  the start so the shape reads; everything shows once the boss is down. */
export function bossFigureKey(which: number, region?: number): string | null {
  if (which === 7) return region != null && BOSS_ART[String(region)] ? String(region) : null;
  if (which === 4) return 'lina';
  if (which >= 1 && which <= 3) return String(which);
  return null;
}

const SHADOW = '#2a0d10';
const SHADOW_HI = '#3a1216';

/** Stable per-pixel order of appearance (0–1): mostly from the middle outwards, with some noise so the edge of the
 *  lit part looks eaten rather than round. The same boss always fills in the same way. */
function order(x: number, y: number, key: string, n: number): number {
  let h = 2166136261;
  const s = `${key}:${x}:${y}`;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  const noise = ((h >>> 0) % 10000) / 10000;
  const c = (n - 1) / 2;
  const dist = Math.min(1, Math.hypot(x - c, (y - c) * 0.9) / (c * 1.05));
  return 0.72 * dist + 0.28 * noise;
}

export function bossFigure(key: string, share: number, scale = 5): HTMLCanvasElement {
  const rows = BOSS_ART[key]!;
  const n = rows.length;
  const c = document.createElement('canvas');
  c.width = c.height = n * scale;
  c.className = 'boss-figure';
  const g = c.getContext('2d')!;
  const shown = 0.15 + 0.85 * Math.max(0, Math.min(1, share));
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const ch = rows[y]![x]!;
      if (ch === '.') continue;
      const o = order(x, y, key, n);
      const col = ch === 'x' || o < shown ? BOSS_PAL[ch]! : o < shown + 0.06 ? SHADOW_HI : SHADOW;
      g.fillStyle = col;
      g.fillRect(x * scale, y * scale, scale, scale);
    }
  }
  return c;
}
