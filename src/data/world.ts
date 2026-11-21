// 0.5 大地图 + 小世界 (游戏设计 › 0.3 之后的改版方向 › 一、地图). Data only: adding an area means adding rows here.
// Each scene sits on a tile of the old 0.4 map (`at`), so saved positions, echoes, packs (same scene = within
// CONFIG.pack.radiusTiles) and the online presence all keep working with tile coordinates.
// Fields keep the 0.4 word pools (zone); a 0.4 field of 10 monsters became 4 scenes × CONFIG.map.slots.
import type { ZoneId } from '../core/types';
import type { NpcId, RegionId } from '../game/map';

export type SceneType = 'camp' | 'field' | 'road' | 'door' | 'hidden';

export interface SceneDef {
  id: string;
  region: RegionId;
  /** Scene number on the route map (1 → 2 → 3 …). */
  no: number;
  zh: string;
  type: SceneType;
  /** Tile on the 0.4 map this scene stands on. */
  at: { x: number; y: number };
  /** Word pool for monsters (fields and hidden scenes). */
  zone?: ZoneId;
  /** Monster slots; defaults to CONFIG.map.slots for fields. */
  slots?: number;
  npcs?: NpcId[];
  bonfire?: boolean;
  door?: boolean;
  gate?: RegionId;
  signs?: string[];
  /** Hidden route: drawn only once this sign's word can be read (归名 stage ≥ 3). */
  hiddenBy?: string;
  /** Hidden scenes: chance multiplier for 残句 (region 1) or rare monsters (region 2). */
  lucky?: number;
}

export interface AreaDef {
  region: RegionId;
  zh: string;
  de: string;
  levels: string;
  hub: string;
}

/** 大地图: five big regions and twenty areas are planned; 0.5 moves the two existing ones over. */
export const AREAS: AreaDef[] = [
  { region: 1, zh: '最后的营地', de: 'Glutheim', levels: 'Lv 1–10', hub: 'r1-camp' },
  { region: 2, zh: '面包集市', de: 'Brotmarkt', levels: 'Lv 11–20', hub: 'r2-feuer' },
];

/** Areas not built yet, shown greyed out on the big map. */
export const AREAS_LATER = ['旧城区 · A2', '河港 · A2', '车站 · A2', '图书馆 · B1'];

export const SCENES: SceneDef[] = [
  // ---- Region 1 · 最后的营地 ----
  { id: 'r1-camp', region: 1, no: 1, zh: '余烬营地', type: 'camp', at: { x: 13, y: 26 }, npcs: ['hilde', 'examiner', 'mira'], bonfire: true, signs: ['feuer'] },
  { id: 'r1-e1', region: 1, no: 2, zh: '回声巷口', type: 'field', zone: 'echogasse', at: { x: 23, y: 24 }, signs: ['strasse'] },
  { id: 'r1-e2', region: 1, no: 3, zh: '回声巷 · 北', type: 'field', zone: 'echogasse', at: { x: 25, y: 16 } },
  { id: 'r1-e3', region: 1, no: 4, zh: '回声巷 · 南', type: 'field', zone: 'echogasse', at: { x: 26, y: 33 } },
  { id: 'r1-e4', region: 1, no: 5, zh: '回声巷尽头', type: 'field', zone: 'echogasse', at: { x: 34, y: 24 } },
  { id: 'r1-x', region: 1, no: 6, zh: '十字路口', type: 'road', at: { x: 41, y: 24 }, signs: ['name', 'familie'] },
  { id: 'r1-s1', region: 1, no: 7, zh: '名牌街口', type: 'field', zone: 'schilderstrasse', at: { x: 46, y: 17 } },
  { id: 'r1-s2', region: 1, no: 8, zh: '名牌街 · 钟楼下', type: 'field', zone: 'schilderstrasse', at: { x: 50, y: 10 } },
  { id: 'r1-s3', region: 1, no: 9, zh: '名牌街 · 旧邮局', type: 'field', zone: 'schilderstrasse', at: { x: 58, y: 16 } },
  { id: 'r1-s4', region: 1, no: 10, zh: '名牌街尽头', type: 'field', zone: 'schilderstrasse', at: { x: 64, y: 9 } },
  { id: 'r1-a1', region: 1, no: 11, zh: '灰烬公寓 · 门厅', type: 'field', zone: 'aschehof', at: { x: 46, y: 33 } },
  { id: 'r1-a2', region: 1, no: 12, zh: '灰烬公寓 · 楼梯间', type: 'field', zone: 'aschehof', at: { x: 50, y: 40 } },
  { id: 'r1-a3', region: 1, no: 13, zh: '灰烬公寓 · 天井', type: 'field', zone: 'aschehof', at: { x: 58, y: 34 } },
  { id: 'r1-a4', region: 1, no: 14, zh: '灰烬公寓 · 顶楼', type: 'field', zone: 'aschehof', at: { x: 64, y: 41 } },
  { id: 'r1-door', region: 1, no: 15, zh: '邻居家门', type: 'door', at: { x: 68, y: 24 }, door: true },
  { id: 'r1-hide', region: 1, no: 16, zh: '灯下暗巷', type: 'hidden', zone: 'echogasse', slots: 2, at: { x: 22, y: 40 }, hiddenBy: 'strasse', lucky: 3 },

  // ---- Region 2 · 面包集市 ----
  { id: 'r2-feuer', region: 2, no: 1, zh: '集市篝火', type: 'camp', at: { x: 13, y: 24 }, npcs: ['hilde', 'examiner'], bonfire: true, gate: 1 },
  { id: 'r2-stand', region: 2, no: 2, zh: '集市摊位', type: 'camp', at: { x: 13, y: 17 }, npcs: ['mira', 'greta'] },
  { id: 'r2-baeck', region: 2, no: 3, zh: '康拉德面包房', type: 'camp', at: { x: 6, y: 28 }, npcs: ['konrad'], signs: ['baeckerei'] },
  { id: 'r2-x', region: 2, no: 4, zh: '集市口', type: 'road', at: { x: 22, y: 24 }, signs: ['markt', 'preis'] },
  { id: 'r2-g1', region: 2, no: 5, zh: '菜摊街口', type: 'field', zone: 'gemuesegasse', at: { x: 28, y: 16 } },
  { id: 'r2-g2', region: 2, no: 6, zh: '菜摊街 · 萝卜摊', type: 'field', zone: 'gemuesegasse', at: { x: 34, y: 7 } },
  { id: 'r2-g3', region: 2, no: 7, zh: '菜摊街 · 水井', type: 'field', zone: 'gemuesegasse', at: { x: 42, y: 14 } },
  { id: 'r2-g4', region: 2, no: 8, zh: '菜摊街尽头', type: 'field', zone: 'gemuesegasse', at: { x: 47, y: 4 } },
  { id: 'r2-w1', region: 2, no: 9, zh: '秤巷口', type: 'field', zone: 'waagegasse', at: { x: 28, y: 33 } },
  { id: 'r2-w2', region: 2, no: 10, zh: '秤巷 · 砝码铺', type: 'field', zone: 'waagegasse', at: { x: 34, y: 41 } },
  { id: 'r2-w3', region: 2, no: 11, zh: '秤巷 · 账房', type: 'field', zone: 'waagegasse', at: { x: 42, y: 34 } },
  { id: 'r2-w4', region: 2, no: 12, zh: '秤巷尽头', type: 'field', zone: 'waagegasse', at: { x: 47, y: 42 } },
  { id: 'r2-kx', region: 2, no: 13, zh: '粮仓口', type: 'road', at: { x: 51, y: 22 }, signs: ['korn'] },
  { id: 'r2-k1', region: 2, no: 14, zh: '粮仓 · 麻袋堆', type: 'field', zone: 'kornspeicher', at: { x: 56, y: 14 } },
  { id: 'r2-k2', region: 2, no: 15, zh: '粮仓 · 风车下', type: 'field', zone: 'kornspeicher', at: { x: 61, y: 7 } },
  { id: 'r2-k3', region: 2, no: 16, zh: '粮仓 · 磨坊', type: 'field', zone: 'kornspeicher', at: { x: 56, y: 31 } },
  { id: 'r2-k4', region: 2, no: 17, zh: '粮仓 · 地窖口', type: 'field', zone: 'kornspeicher', at: { x: 61, y: 40 } },
  { id: 'r2-door', region: 2, no: 18, zh: '秤房', type: 'door', at: { x: 68, y: 24 }, door: true },
  { id: 'r2-hide', region: 2, no: 19, zh: '粮仓阁楼', type: 'hidden', zone: 'kornspeicher', slots: 2, at: { x: 69, y: 4 }, hiddenBy: 'korn', lucky: 3 },
];

/** Paths between scenes (both ways). */
export const LINKS: Array<[string, string]> = [
  ['r1-camp', 'r1-e1'], ['r1-e1', 'r1-e2'], ['r1-e1', 'r1-e3'], ['r1-e2', 'r1-e4'], ['r1-e3', 'r1-e4'], ['r1-e4', 'r1-x'],
  ['r1-x', 'r1-s1'], ['r1-s1', 'r1-s2'], ['r1-s2', 'r1-s3'], ['r1-s1', 'r1-s3'], ['r1-s3', 'r1-s4'],
  ['r1-x', 'r1-a1'], ['r1-a1', 'r1-a2'], ['r1-a2', 'r1-a3'], ['r1-a1', 'r1-a3'], ['r1-a3', 'r1-a4'],
  ['r1-x', 'r1-door'], ['r1-e3', 'r1-hide'],
  ['r2-feuer', 'r2-stand'], ['r2-feuer', 'r2-baeck'], ['r2-feuer', 'r2-x'],
  ['r2-x', 'r2-g1'], ['r2-g1', 'r2-g2'], ['r2-g1', 'r2-g3'], ['r2-g2', 'r2-g4'], ['r2-g3', 'r2-g4'],
  ['r2-x', 'r2-w1'], ['r2-w1', 'r2-w2'], ['r2-w1', 'r2-w3'], ['r2-w2', 'r2-w4'], ['r2-w3', 'r2-w4'],
  ['r2-x', 'r2-kx'], ['r2-kx', 'r2-k1'], ['r2-k1', 'r2-k2'], ['r2-kx', 'r2-k3'], ['r2-k3', 'r2-k4'],
  ['r2-k2', 'r2-door'], ['r2-k4', 'r2-door'], ['r2-k2', 'r2-hide'],
];

export const SCENE_BY_ID: Record<string, SceneDef> = Object.fromEntries(SCENES.map((s) => [s.id, s]));

export function scenesOf(region: RegionId): SceneDef[] {
  return SCENES.filter((s) => s.region === region);
}

export function neighbours(id: string): string[] {
  return LINKS.flatMap(([a, b]) => (a === id ? [b] : b === id ? [a] : []));
}

/** The scene closest to a pixel position (old saves, echoes, arrivals through doors). */
export function nearestScene(region: RegionId, px: number, py: number, ok: (s: SceneDef) => boolean = () => true): SceneDef {
  let best = scenesOf(region)[0];
  let bd = Infinity;
  for (const s of scenesOf(region)) {
    if (!ok(s)) continue;
    const d = Math.hypot(s.at.x * 16 + 8 - px, s.at.y * 16 + 8 - py);
    if (d < bd) (bd = d), (best = s);
  }
  return best;
}

/** Shortest path (scene ids, start excluded) over the scenes `ok` allows. */
export function routeTo(from: string, to: string, ok: (s: SceneDef) => boolean = () => true): string[] | null {
  if (from === to) return [];
  const prev = new Map<string, string>([[from, '']]);
  const q = [from];
  for (let i = 0; i < q.length; i++) {
    for (const n of neighbours(q[i])) {
      if (prev.has(n) || !ok(SCENE_BY_ID[n])) continue;
      prev.set(n, q[i]);
      if (n === to) {
        const path = [n];
        for (let c = q[i]; c !== from; c = prev.get(c)!) path.unshift(c);
        return path;
      }
      q.push(n);
    }
  }
  return null;
}
