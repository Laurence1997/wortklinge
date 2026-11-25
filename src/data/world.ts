// 0.5 大地图 + 小世界 (游戏设计 › 0.3 之后的改版方向 › 一、地图). Data only: adding an area means adding rows here.
// Each scene sits on a tile of the old 0.4 map (`at`), so saved positions, echoes, packs (same scene = within
// CONFIG.pack.radiusTiles) and the online presence all keep working with tile coordinates.
// Fields keep the 0.4 word pools (zone); a 0.4 field of 10 monsters became 4 scenes × CONFIG.map.slots.
import type { ErodeSeg, ZoneId } from '../core/types';
import type { NpcId, RegionId } from '../game/map';
import { ERODE_DEFS, REGION_DEF, REGION_DEFS, fieldScenes, nextMapRegion, prevMapRegion, regionLevels, type RegionDef } from './zones';
import { ERODED_SCENE_WORDS, ERODED_SEG, SCENE_WORDS, WORD_BY_ID } from './words';
import { LEX_FIELDS, LEX_SCENES } from './lexicon';

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
  /** Drawn only once this save flag is set (the rail bridge after 吞秤者). */
  openFlag?: string;
  signs?: string[];
  /** Hidden route: drawn only once this sign's word can be read (归名 stage ≥ 3). */
  hiddenBy?: string;
  /** Hidden scenes: chance multiplier for 残句 (region 1) or rare monsters (region 2). */
  lucky?: number;
  /** 0.6 场景记忆法: the fixed word group (word ids) this field scene's monsters come from. */
  words?: string[];
  /** 0.7/0.8 蚀变: the scene's advanced word group (segment `erodeSeg`), on top of its own words. */
  eroded?: string[];
  erodeSeg?: ErodeSeg;
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
  { region: 3, zh: '铁轨镇', de: 'Gleisdorf', levels: 'Lv 21–30', hub: 'r3-platz' },
  // 0.7 + 0.8 (src/data/zones.ts).
  ...REGION_DEFS.map((d) => ({ region: d.region, zh: d.zh, de: d.de, levels: `Lv ${regionLevels(d.region).join('–')}`, hub: `r${d.region}-hub` })),
];

/** Areas not built yet, shown greyed out on the big map (游戏设计 四, regions 13–20). */
export const AREAS_LATER = ['议会堡 · B2', '铸币场 · B2', '观星台 · B2', '面具剧场 · B2', '档案深处 · C1', '天平庭 · C1', '荒原 · C1', '沉默之心 · C1'];

// ---- Field scenes of every region, generated from the 6000-word scene groups (src/data/lexicon.ts) -------------
// 6000 词导入: regions 1–3 have five fields, regions 4–12 three; each field scene owns one word group. Scenes stand on a
// grid 6 tiles apart east of the town (7 columns, 3 rows north and 3 south of the main road), walked as a snake column
// by column; fields follow each other along the snake. The town, the boss door, the hidden path and the road on keep
// fixed tiles. Region 1–3 street maps are hand-drawn; a scene's own tile is cleared to road (src/game/map.ts).

const COLS = [27, 33, 39, 45, 51, 57, 63];
const ROWS = [5, 11, 17, 31, 37, 43];
/** Grid slots in snake order: down the first column, up the second … */
const SLOTS: Array<{ x: number; y: number }> = COLS.flatMap((x, i) => (i % 2 ? [...ROWS].reverse() : ROWS).map((y) => ({ x, y })));
const DOOR_AT = { x: 68, y: 24 };
const HIDE_AT = { x: 69, y: 4 };
const ONWARD_AT = { x: 69, y: 44 };

/** Field names of a region: regions 1–3 from the lexicon, 4–12 from zones.ts. */
function fieldNames(region: number): Array<{ zone: ZoneId; zh: string }> {
  const d = REGION_DEF[region];
  return (LEX_FIELDS[region] ?? []).map(([zone, zh], i) => ({ zone: zone as ZoneId, zh: d ? d.fields[i]?.zh ?? zh : zh }));
}

const LEX_NAME = new Map(LEX_SCENES.map(([id, , , name]) => [id, name]));

/** The field scenes of a region, in route order, with their grid tiles. */
function fieldSceneDefs(region: number, firstNo: number): SceneDef[] {
  const names = fieldNames(region);
  const out: SceneDef[] = [];
  let k = 0;
  fieldScenes(region).forEach((ids, fi) => {
    ids.forEach((id, si) => {
      const end = si === 0 ? '口' : si === ids.length - 1 ? '尽头' : '';
      out.push({ id, region: region as RegionId, no: firstNo + k, zh: `${names[fi].zh}${end} · ${LEX_NAME.get(id) ?? ''}`, type: 'field', zone: names[fi].zone, at: SLOTS[k % SLOTS.length], words: SCENE_WORDS[id] ?? [] });
      k++;
    });
  });
  return out;
}

/** The first noun of a field's second scene (a hidden path's sign when the region's own word is gone). */
function signWord(region: number, field: number, want: string): string {
  if (WORD_BY_ID[want]) return want;
  const ids = fieldScenes(region)[field]?.[1] ?? fieldScenes(region)[field]?.[0] ?? '';
  const ws = (SCENE_WORDS[ids] ?? []).map((id) => WORD_BY_ID[id]);
  return (ws.find((w) => w?.pos === 'n') ?? ws[0])?.id ?? want;
}

const near = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);

/** Links of the field scenes: the snake (each scene to the next), rungs between grid neighbours, the
 *  crossroads to the first scene, the door from the two nearest scenes of the last field, the hidden path from the
 *  nearest scene of its field and the road on from the nearest scene of the last field. */
function fieldLinks(fields: SceneDef[], cross: string, door: SceneDef, hide: SceneDef, onward?: SceneDef): Array<[string, string]> {
  const L: Array<[string, string]> = [[cross, fields[0].id]];
  for (let i = 0; i < fields.length; i++)
    for (let j = i + 1; j < fields.length; j++) {
      if (j === i + 1 || near(fields[i].at, fields[j].at) <= 6.5) L.push([fields[i].id, fields[j].id]);
    }
  const lastZone = fields[fields.length - 1].zone;
  const last = fields.filter((f) => f.zone === lastZone);
  const by = (p: { x: number; y: number }, pool: SceneDef[]) => [...pool].sort((a, b) => near(a.at, p) - near(b.at, p));
  for (const f of by(door.at, last).slice(0, 2)) L.push([f.id, door.id]);
  const hidePool = fields.filter((f) => f.zone === hide.zone);
  L.push([by(hide.at, hidePool.length ? hidePool : fields)[0].id, hide.id]);
  if (onward) L.push([by(onward.at, last)[0].id, onward.id]);
  return L;
}

interface RegionLayout {
  scenes: SceneDef[];
  links: Array<[string, string]>;
}

/** Regions 1–3: the hand-made town scenes stay, the fields are generated. */
function earlyRegion(region: 1 | 2 | 3): RegionLayout {
  const hubs: Record<1 | 2 | 3, SceneDef[]> = {
    1: [
      { id: 'r1-camp', region: 1, no: 1, zh: '余烬营地', type: 'camp', at: { x: 13, y: 26 }, npcs: ['hilde', 'examiner', 'mira'], bonfire: true, signs: ['feuer'] },
      { id: 'r1-x', region: 1, no: 2, zh: '十字路口', type: 'road', at: { x: 22, y: 24 }, signs: ['strasse', 'name', 'familie'] },
    ],
    2: [
      { id: 'r2-feuer', region: 2, no: 1, zh: '集市篝火', type: 'camp', at: { x: 13, y: 24 }, npcs: ['hilde', 'examiner'], bonfire: true, gate: 1 },
      { id: 'r2-stand', region: 2, no: 2, zh: '集市摊位', type: 'camp', at: { x: 13, y: 17 }, npcs: ['mira', 'greta'] },
      { id: 'r2-baeck', region: 2, no: 3, zh: '康拉德面包房', type: 'camp', at: { x: 6, y: 28 }, npcs: ['konrad'], signs: ['baeckerei'] },
      { id: 'r2-x', region: 2, no: 4, zh: '集市口', type: 'road', at: { x: 22, y: 24 }, signs: ['markt', 'preis', 'korn'] },
    ],
    3: [
      { id: 'r3-platz', region: 3, no: 1, zh: '铁轨镇广场', type: 'camp', at: { x: 13, y: 24 }, npcs: ['hilde', 'examiner', 'weber'], bonfire: true, gate: 2 },
      { id: 'r3-buero', region: 3, no: 2, zh: '站长室', type: 'camp', at: { x: 8, y: 19 }, npcs: ['brandt'] },
      { id: 'r3-stand', region: 3, no: 3, zh: '广场摊位', type: 'camp', at: { x: 15, y: 30 }, npcs: ['mira', 'greta'] },
      { id: 'r3-x', region: 3, no: 4, zh: '站前路口', type: 'road', at: { x: 22, y: 24 }, signs: ['bahnhof', 'altstadt', 'fahrplan'] },
    ],
  };
  const town = hubs[region];
  const cross = town[town.length - 1];
  const fields = fieldSceneDefs(region, town.length + 1);
  let no = town.length + fields.length + 1;
  const zoneOf = (fi: number) => fieldNames(region)[fi].zone;
  const special: Record<1 | 2 | 3, { door: string; hide: string; hideField: number; hideBy: string; onward?: SceneDef }> = {
    1: { door: '邻居家门', hide: '灯下暗巷', hideField: 0, hideBy: 'strasse' },
    2: { door: '秤房', hide: '粮仓阁楼', hideField: 2, hideBy: 'korn', onward: { id: 'r2-bridge', region: 2, no: 0, zh: '铁路桥', type: 'road', at: { x: 67, y: 44 }, gate: 3, openFlag: 'boss2Kills' } },
    3: { door: '末班站台', hide: '零号站台', hideField: 2, hideBy: 'fahrkarte', onward: { id: 'r3-onward', region: 3, no: 0, zh: '出城的末班车道', type: 'road', at: ONWARD_AT, gate: 4, openFlag: 'boss3Kills' } },
  };
  const sp = special[region];
  const door: SceneDef = { id: `r${region}-door`, region, no: no++, zh: sp.door, type: 'door', at: DOOR_AT, door: true };
  const hide: SceneDef = { id: `r${region}-hide`, region, no: no++, zh: sp.hide, type: 'hidden', zone: zoneOf(sp.hideField), slots: 2, at: HIDE_AT, hiddenBy: signWord(region, sp.hideField, sp.hideBy), lucky: 3 };
  const onward = sp.onward ? { ...sp.onward, no: no++ } : undefined;
  const links: Array<[string, string]> = town.slice(0, -1).map((t) => [town[0].id, t.id] as [string, string]).filter(([a, b]) => a !== b);
  links.push([town[0].id, cross.id]);
  links.push(...fieldLinks(fields, cross.id, door, hide, onward));
  return { scenes: [...town, ...fields, door, hide, ...(onward ? [onward] : [])], links };
}

/** Regions 4–12 on one street plan (town west, fields east, door, hidden path and road on far east). */
function laterRegion(d: RegionDef): RegionLayout {
  const r = d.region;
  const p = `r${r}`;
  const next = nextMapRegion(r);
  const town: SceneDef[] = [
    { id: `${p}-hub`, region: r, no: 1, zh: d.hubZh, type: 'camp', at: { x: 13, y: 24 }, npcs: ['hilde', 'examiner'], bonfire: true, gate: prevMapRegion(r) as RegionId },
    { id: `${p}-stand`, region: r, no: 2, zh: d.standZh, type: 'camp', at: { x: 15, y: 30 }, npcs: ['mira', 'greta'] },
    { id: `${p}-x`, region: r, no: 3, zh: d.crossZh, type: 'road', at: { x: 22, y: 24 } },
  ];
  const fields = fieldSceneDefs(r, 4);
  let no = 4 + fields.length;
  const door: SceneDef = { id: `${p}-door`, region: r, no: no++, zh: d.doorZh, type: 'door', at: DOOR_AT, door: true };
  const hide: SceneDef = { id: `${p}-hide`, region: r, no: no++, zh: d.hiddenZh, type: 'hidden', zone: `${p}c` as ZoneId, slots: 2, at: HIDE_AT, hiddenBy: signWord(r, 2, d.hiddenSign ?? ''), lucky: 3 };
  // The road on: opens with this region's boss, or with the 蚀变 boss that stands between (7 → 蚀变① → 9).
  const onward: SceneDef | undefined = next ? { id: `${p}-onward`, region: r, no: no++, zh: d.onwardZh, type: 'road', at: ONWARD_AT, gate: next as RegionId, openFlag: `boss${next - 1}Kills` } : undefined;
  const links: Array<[string, string]> = [[`${p}-hub`, `${p}-stand`], [`${p}-hub`, `${p}-x`], ...fieldLinks(fields, `${p}-x`, door, hide, onward)];
  const extra: SceneDef[] = [];
  // 蚀变 bosses with a scene of their own (枯林之母 deep in 林底): drawn once the segment opens, off the last field.
  for (const e of ERODE_DEFS) {
    if (e.bossRegion !== r || !e.scene) continue;
    const at = { x: 69, y: 12 };
    const last = fields.filter((f) => f.zone === `${p}c`);
    const from = [...last].sort((a, b) => Math.hypot(a.at.x - at.x, a.at.y - at.y) - Math.hypot(b.at.x - at.x, b.at.y - at.y))[0];
    extra.push({ id: e.scene, region: r, no: no++, zh: e.doorZh.replace(/深处$/, ''), type: 'hidden', zone: `${p}c` as ZoneId, slots: 2, at, door: true, openFlag: `boss${e.after}Kills`, lucky: 3 });
    links.push([from.id, e.scene], [hide.id, e.scene]);
  }
  return { scenes: [...town, ...fields, door, hide, ...(onward ? [onward] : []), ...extra], links };
}

const LAYOUTS: RegionLayout[] = [earlyRegion(1), earlyRegion(2), earlyRegion(3), ...REGION_DEFS.map(laterRegion)];

export const SCENES: SceneDef[] = LAYOUTS.flatMap((l) => l.scenes);

/** Paths between scenes (both ways). */
export const LINKS: Array<[string, string]> = LAYOUTS.flatMap((l) => l.links);

export const SCENE_BY_ID: Record<string, SceneDef> = Object.fromEntries(SCENES.map((s) => [s.id, s]));

// 蚀变 (游戏设计 rev 341): old scenes carry a second word group, segment 8 or 11 (from the lexicon).
for (const [id, ids] of Object.entries(ERODED_SCENE_WORDS)) {
  const sc = SCENE_BY_ID[id];
  if (sc) Object.assign(sc, { eroded: ids, erodeSeg: ERODED_SEG[id] });
}

/** Each word's home scene: its own group, or the 蚀变 group of an old scene. */
export const HOME_SCENE: Record<string, SceneDef> = Object.fromEntries(
  SCENES.flatMap((sc) => [...(sc.words ?? []), ...(sc.eroded ?? [])].map((w) => [w, sc] as const)),
);

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
