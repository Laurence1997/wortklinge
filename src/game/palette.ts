// 各区色调 (游戏设计 十三, Lucas 2026-11-25): regions 1–3 stay red-black; from region 4 each region has its own 5-step
// ramp (dark → light, src/data/zones.ts `palette`), and the old maps change once a 蚀变 segment is open: 蚀变① turns
// regions 1–3 to darkened red with rust orange on top, 蚀变② turns regions 1–7 to their own ramp darkened ~30% with
// pale cyan on top. Map tiles, NPCs and map monsters are stretched over the ramp exactly like the red one; the
// hero keeps the red ramp and hair colours (发色例外).

import type { ErodeSeg } from '../core/types';
import { ERODE_DEF, REGION_DEF } from '../data/zones';

export type Ramp5 = readonly [string, string, string, string, string];

/** 1–3 区 (已上线). */
export const RED5: Ramp5 = ['#140404', '#4e1616', '#7a1f1f', '#d8333a', '#ffb4a8'];
const ERODE_TOP: Record<8 | 11, string> = { 8: '#f08a3c', 11: '#c8fff0' };
const grey = (a: string, t: number) => { const c = hex(a); const l = c[0] * 0.3 + c[1] * 0.59 + c[2] * 0.11; return toHex(c.map((v) => v + (l - v) * t)); };

const hex = (h: string) => [1, 3, 5].map((k) => parseInt(h.slice(k, k + 2), 16));
const toHex = (c: number[]) => `#${c.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('')}`;
const mix = (a: string, b: string, t: number) => toHex(hex(a).map((v, i) => v + (hex(b)[i] - v) * t));
const scale = (a: string, f: number) => toHex(hex(a).map((v) => v * f));

/** The ramp of a map right now, or null for the classic red one (regions 1–3 before any 蚀变). */
export function mapRamp(region: number, flags: Record<string, unknown>): Ramp5 | null {
  const own = (REGION_DEF[region]?.palette as Ramp5 | undefined) ?? null;
  const open = (seg: ErodeSeg) => !!ERODE_DEF[seg] && !!flags[`boss${ERODE_DEF[seg]!.after}Kills`];
  // 121–200 级 (rev 488): 蚀变④ 回潮 drains regions 9–12 of colour; 蚀变③ 林底 turns regions 4–7 moss green, darkened,
  // with pale cyan on top. The newest open segment of a map wins.
  if (region >= 9 && region <= 12 && own && open(19)) return own.map((c) => grey(c, 0.8)) as unknown as Ramp5;
  if (region >= 4 && region <= 7 && open(15)) return (ERODE_DEF[15]!.palette as Ramp5 | undefined) ?? own;
  if (region <= 7 && open(11)) {
    const base = own ?? RED5;
    return [scale(base[0], 0.7), scale(base[1], 0.7), scale(base[2], 0.7), scale(base[3], 0.7), ERODE_TOP[11]];
  }
  if (region <= 3 && open(8)) return (ERODE_DEF[8]!.palette as Ramp5 | undefined) ?? null;
  return own;
}

/** Four dark map shades (ground, walls, roofs) from a ramp, matching how the red map sits below the red ramp. */
export function mapShades(p: Ramp5): string[] {
  return [scale(p[0], 0.6), mix(p[0], p[1], 0.25), mix(p[0], p[1], 0.6), p[1]];
}

/** Figures (NPCs): the ramp itself. */
export const charRamp = (p: Ramp5): string[] => [...p];

/** Map monsters: three dark steps, so the glowing garbled name stays what you look at. */
export const shadeRamp = (p: Ramp5): string[] => [p[0], mix(p[1], p[2], 0.3), mix(p[2], p[3], 0.4)];
