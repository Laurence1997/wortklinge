// 大地图 (Lucas 2026-11-27「做成游戏地图，有分界有特色」「像素画风，小字加等级」, 游戏设计 四「两层地图」):
// one pixel-art continent (src/ui/worldTerrain.ts): every city owns a coloured territory with its landmark; the
// borders between stages are landforms (river, ridge, wall, rift), locked land sits under fog. On top, crisp
// name plates with the level range, the road, 「你在这里」, 蚀变 marks and 零号站台. Click a city → card + travel.
import { h } from './dom';
import { accentOf } from './theme';
import { AREAS, SCENE_BY_ID } from '../data/world';
import { ERODE_DEFS, REGION_DEF } from '../data/zones';
import { terrain, TW, TH, type Stage, type TerrainCity } from './worldTerrain';
import { landmark } from './worldIcons';

export interface WorldMapCtx {
  current: number;
  level: number;
  open(region: number): boolean;
  visited(region: number): boolean;
  /** Has this boss fallen (flag `boss${n}Kills`)? */
  killed(flag: string): boolean;
  zeroSeen: boolean;
  go(region: number): void;
}

const W = TW;
const H = TH;
/** Hand-placed city spots (map units): west to east through the five stages, 雾港 on the southern bay. */
const SPOT: Record<number, [number, number]> = {
  1: [120, 395], 2: [205, 205], 3: [285, 455],
  4: [385, 250], 5: [420, 440], 6: [505, 560], 7: [575, 215],
  9: [680, 390], 10: [728, 170], 12: [805, 455],
  13: [870, 215], 14: [905, 460], 16: [985, 320],
  17: [1060, 505], 18: [1085, 160], 20: [1115, 345],
};
const STAGES: Array<{ id: Stage; zh: string; regions: number[]; x: number }> = [
  { id: 'A1', zh: '入门', regions: [1, 2, 3], x: 190 },
  { id: 'A2', zh: '基础', regions: [4, 5, 6, 7], x: 470 },
  { id: 'B1', zh: '进阶', regions: [9, 10, 12], x: 735 },
  { id: 'B2', zh: '高阶', regions: [13, 14, 16], x: 912 },
  { id: 'C1', zh: '精通', regions: [17, 18, 20], x: 1078 },
];
const stageOfRegion = (r: number): Stage => STAGES.find((st) => st.regions.includes(r))?.id ?? 'A1';
const ERODE_RED = '#8a1424';
const SEG_LEVELS: Record<number, string> = { 8: '71–80', 11: '101–110', 15: '141–150', 19: '181–190' };
/** 1.0.12 试玩 #77: where the 蚀变 band plates stand (near the road between the two cities each sits between). */
const SEG_SPOT: Record<number, [number, number]> = { 8: [612, 312], 11: [782, 305], 15: [1000, 420], 19: [1120, 268] };

const NS = 'http://www.w3.org/2000/svg';
function s(tag: string, attrs: Record<string, string | number> = {}, ...kids: Array<SVGElement | string>): SVGElement {
  const el = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, String(v));
  for (const k of kids) el.append(typeof k === 'string' ? document.createTextNode(k) : k);
  return el;
}

/** First level of an area ("Lv 21–30" → 21). */
export function firstLevel(levels: string): number {
  return Number(/(\d+)/.exec(levels)?.[1] ?? 1);
}

function stageLevels(id: string, regions: number[]): string {
  const ls = AREAS.filter((a) => regions.includes(a.region)).flatMap((a) => (a.levels.match(/\d+/g) ?? []).map(Number));
  for (const e of ERODE_DEFS) if (e.stage === id) ls.push(...(SEG_LEVELS[e.seg] ?? '').split('–').filter(Boolean).map(Number));
  return ls.length ? `${Math.min(...ls)}–${Math.max(...ls)} 级` : '';
}

interface SegState {
  seg: number;
  zh: string;
  hosts: number[];
  bossRegion: number;
  state: 'hidden' | 'open' | 'done';
}

function segStates(c: WorldMapCtx): SegState[] {
  return ERODE_DEFS.map((e) => {
    const hosts = [...new Set(e.scenes.map((x) => SCENE_BY_ID[x.scene]?.region).filter((r): r is NonNullable<typeof r> => !!r))].map(Number);
    if (e.scene && SCENE_BY_ID[e.scene]) hosts.push(SCENE_BY_ID[e.scene].region);
    const state: SegState['state'] = c.killed(`boss${e.seg}Kills`) ? 'done' : c.killed(`boss${e.after}Kills`) ? 'open' : 'hidden';
    return { seg: e.seg, zh: e.zh, hosts: [...new Set(hosts)].sort((a, b) => a - b), bossRegion: e.bossRegion, state };
  });
}

export function worldMap(c: WorldMapCtx): HTMLElement {
  const segs = segStates(c);
  let selected = c.current;
  const card = h('div.wm-card');
  const svg = s('svg', { viewBox: `0 0 ${W} ${H}`, class: 'wm-svg', role: 'img', 'aria-label': '大地图' });
  const order = AREAS.map((a) => a.region).filter((r) => SPOT[r]);
  const segOf = (r: number): 0 | 1 | 2 => (segs.some((q) => q.state === 'open' && q.hosts.includes(r)) ? 1 : segs.some((q) => q.state === 'done' && q.hosts.includes(r)) ? 2 : 0);
  const cities: TerrainCity[] = order.map((r) => ({ region: r, x: SPOT[r][0], y: SPOT[r][1], stage: stageOfRegion(r), accent: accentOf(r), open: c.open(r), erode: segOf(r) }));

  // landmarks of open cities, rasterised into the pixel map
  const icons = s('svg', { xmlns: 'http://www.w3.org/2000/svg', viewBox: `0 0 ${W} ${H}`, width: W, height: H });
  for (const ct of cities) if (ct.open) icons.append(s('g', { transform: `translate(${ct.x},${ct.y - 10}) scale(1.9)` }, landmark(ct.region, ct.accent, true)));
  const canvas = terrain(cities, new XMLSerializer().serializeToString(icons));
  canvas.className = 'wm-canvas';

  svg.append(
    s('defs', {},
      s('filter', { id: 'wm-glow', x: '-50%', y: '-50%', width: '200%', height: '200%' }, s('feGaussianBlur', { stdDeviation: 6 })),
    ),
  );

  // ---- stage banners along the top sea
  for (const st of STAGES) {
    const g = s('g', { transform: `translate(${st.x},22)`, class: 'wm-banner' });
    g.append(s('rect', { x: -78, y: -14, width: 156, height: 26, rx: 3, fill: '#3b2a1c', stroke: '#e8d3a6', 'stroke-width': 2 }));
    g.append(s('text', { y: 4.5, 'text-anchor': 'middle', class: 'wm-stage' }, `${st.id} ${st.zh} · ${stageLevels(st.id, st.regions)}`));
    svg.append(g);
  }

  // ---- the road, city to city in unlock order
  for (let i = 1; i < order.length; i++) {
    const [ax, ay] = SPOT[order[i - 1]];
    const [bx, by] = SPOT[order[i]];
    const lit = c.open(order[i - 1]) && c.open(order[i]);
    const mx = (ax + bx) / 2 + (by - ay) * 0.15;
    const my = (ay + by) / 2 - (bx - ax) * 0.15;
    svg.append(s('path', { d: `M${ax},${ay} Q${mx},${my} ${bx},${by}`, fill: 'none', stroke: lit ? '#fff5d8' : 'rgba(120,112,100,.5)', 'stroke-width': lit ? 4 : 3, 'stroke-dasharray': lit ? '2 9' : '2 10', 'stroke-linecap': 'round', class: 'wm-road' }));
  }

  // ---- 1.0.12 试玩 #77: the 蚀变 level bands (71–80, 101–110, 141–150, 181–190) have no city of their own; a small
  // plate on the road between the two cities they sit between keeps the level plates continuous.
  for (const e of ERODE_DEFS) {
    const i = order.findIndex((r) => r === e.seg + 1);
    if (i < 1 || order[i - 1] !== e.seg - 1) continue;
    const [x, y] = SEG_SPOT[e.seg] ?? SPOT[order[i]];
    const q = segs.find((z) => z.seg === e.seg);
    const st = q?.state ?? 'hidden';
    const name = st === 'hidden' ? '蚀变带' : e.zh.replace(/「.*」/, '');
    const lv = `Lv ${SEG_LEVELS[e.seg] ?? ''}${st === 'hidden' ? ' 未开放' : st === 'done' ? ' 已净化' : ''}`;
    const pw = Math.max(name.length * 13 + 14, lv.length * 7 + 14);
    const g = s('g', { transform: `translate(${x},${y})`, class: 'wm-seg' + (st === 'hidden' ? ' locked' : '') });
    g.append(s('rect', { x: -pw / 2, y: -15, width: pw, height: 30, rx: 2, fill: st === 'hidden' ? '#8f877a' : st === 'done' ? '#3b2a1c' : ERODE_RED, stroke: st === 'hidden' ? '#cfc8bb' : '#e8d3a6', 'stroke-width': 2, 'stroke-dasharray': st === 'hidden' ? '4 3' : '' }));
    g.append(s('text', { y: -2, 'text-anchor': 'middle', class: 'wm-name wm-seg-name' }, name));
    g.append(s('text', { y: 11, 'text-anchor': 'middle', class: 'wm-lv' }, lv));
    const where = q?.hosts.length ? `第 ${q.hosts.join('、')} 区` : '';
    g.append(s('title', {}, st === 'hidden' ? `${SEG_LEVELS[e.seg]} 级是蚀变带：打败第 ${e.after} 区的首领后，${where || '前面'}的旧场景会蚀变` : `${e.zh} · ${SEG_LEVELS[e.seg]} 级${where ? `：在${where}的旧场景里` : ''}${st === 'done' ? '（已净化）' : ''}`));
    svg.append(g);
  }

  // ---- 零号站台
  if (c.zeroSeen && SPOT[3]) {
    const [x, y] = SPOT[3];
    const g = s('g', { transform: `translate(${x + 48},${y + 6})` },
      s('rect', { x: -9, y: -14, width: 18, height: 22, rx: 2, fill: '#2a0a10', stroke: ERODE_RED, 'stroke-width': 2 }),
      s('circle', { cx: 4, cy: -2, r: 1.8, fill: '#ff5a6a' }),
      s('text', { x: 0, y: 22, 'text-anchor': 'middle', class: 'wm-zero' }, '零号站台'),
    );
    g.append(s('title', {}, '零号站台：铁轨镇时刻表墙后的地下城（28 级起）'));
    svg.append(g);
  }

  // ---- cities: hit area, fog cloud, plate with the level range
  const cityEls: Record<number, SVGElement> = {};
  for (const a of AREAS) {
    const p = SPOT[a.region];
    if (!p) continue;
    const [x, y] = p;
    const open = c.open(a.region);
    const here = a.region === c.current;
    const danger = open && !here && firstLevel(a.levels) > c.level;
    const col = accentOf(a.region);
    const g = s('g', { transform: `translate(${x},${y})`, class: 'wm-city' + (open ? ' open' : ' locked') + (here ? ' here' : ''), tabindex: 0 });
    g.append(s('ellipse', { cx: 0, cy: 6, rx: 44, ry: 40, fill: 'transparent', class: 'wm-hit' }));
    if (here) g.append(s('ellipse', { cx: 0, cy: 12, rx: 34, ry: 12, fill: '#fff6c0', filter: 'url(#wm-glow)', class: 'wm-pulse' }));
    if (!open) g.append(landmark(a.region, col, false));
    // plate
    const name = open ? a.zh : '未开放';
    const lvText = open ? (danger ? `${a.levels} 危险` : a.levels) : a.levels;
    const pw = Math.max(name.length * 15 + 18, lvText.length * 7 + 16);
    const py = 34;
    g.append(s('rect', { x: -pw / 2, y: py, width: pw, height: 34, rx: 2, fill: open ? '#3b2a1c' : '#8f877a', stroke: open ? col : '#cfc8bb', 'stroke-width': 2.5, class: 'wm-plate' }));
    g.append(s('text', { y: py + 15, 'text-anchor': 'middle', class: 'wm-name' }, name));
    g.append(s('text', { y: py + 29, 'text-anchor': 'middle', class: 'wm-lv' + (danger ? ' danger' : '') }, lvText));
    const boss = segs.find((q) => q.state === 'open' && q.bossRegion === a.region);
    if (boss) g.append(s('g', { transform: 'translate(30,-26)' }, s('rect', { x: -10, y: -10, width: 20, height: 20, fill: ERODE_RED, stroke: '#fff', 'stroke-width': 2 }), s('text', { y: 5, 'text-anchor': 'middle', class: 'wm-boss' }, '☠')));
    if (here) {
      g.append(s('g', { class: 'wm-here' },
        s('path', { d: 'M0 -30 l-8 -10 h16 z', fill: '#e8402a', stroke: '#fff', 'stroke-width': 2 }),
        s('rect', { x: -36, y: -62, width: 72, height: 22, rx: 2, fill: '#e8402a', stroke: '#fff', 'stroke-width': 2 }),
        s('text', { y: -46, 'text-anchor': 'middle' }, '你在这里'),
      ));
    }
    g.append(s('title', {}, open ? `${a.zh} · ${a.de} · ${a.levels}` : '还没开放'));
    const pick = () => {
      selected = a.region;
      renderCard();
    };
    g.addEventListener('click', pick);
    g.addEventListener('dblclick', () => open && c.go(a.region));
    g.addEventListener('keydown', (e) => {
      if ((e as KeyboardEvent).key === 'Enter') open && selected === a.region ? c.go(a.region) : pick();
    });
    cityEls[a.region] = g;
    svg.append(g);
  }

  function renderCard(): void {
    for (const [r, el] of Object.entries(cityEls)) el.classList.toggle('sel', Number(r) === selected);
    const a = AREAS.find((x) => x.region === selected)!;
    const open = c.open(a.region);
    const here = a.region === c.current;
    const d = REGION_DEF[a.region];
    const mine = segs.filter((q) => q.state !== 'hidden' && q.hosts.includes(a.region));
    const status = here ? '你在这里' : !open ? '还没开放：打败上一区首领后开放' : c.visited(a.region) ? '去过' : '开放了，还没去过';
    const danger = open && !here && firstLevel(a.levels) > c.level;
    card.replaceChildren(
      h('div.wm-card-head', { style: `border-left-color:${open ? accentOf(a.region) : '#a39c90'}` },
        h('b', open ? `${a.zh}` : '？？？'),
        open ? h('span.de', ` ${a.de}`) : '',
        h('div.small', `第 ${a.region} 区 · ${a.levels}${d ? ` · ${d.stage}` : ''}${d?.theme ? ` · ${d.theme}` : ''}`),
      ),
      h('div.small' + (danger ? '.wm-danger' : '.muted'), danger ? `${status}。这里的怪比你高，小心。` : status),
      ...mine.map((q) => h('div.small.wm-erode-line', `${q.zh}（${SEG_LEVELS[q.seg] ?? ''} 级）${q.state === 'done' ? ' · 已净化' : q.bossRegion === a.region ? ' · 首领在这里' : ' · 蚀变中'}`)),
      h('button.btn' + (open ? '.primary' : ''), { disabled: !open, onclick: () => c.go(a.region) }, here ? '回主城' : open ? '传送到主城' : '还没开放'),
    );
  }
  renderCard();

  const legend = h('div.wm-legend.small.muted',
    h('span', '点一座城看详情，双击直接去'),
    h('span', h('i.wm-key.river'), '河：A1 和 A2 的分界'),
    h('span', h('i.wm-key.ridge'), '山脉：A2 和 B1'),
    h('span', h('i.wm-key.wall'), '旧城墙：B1 和 B2'),
    h('span', h('i.wm-key.rift'), '裂谷：B2 和 C1'),
    h('span', h('i.wm-key.erode'), '暗红纹 = 蚀变中，☠ = 蚀变首领'),
  );
  const segList = segs.filter((q) => q.state !== 'hidden');
  return h('div.worldmap',
    h('div.wm-wrap', canvas, svg), card,
    legend,
    segList.length ? h('div.wm-segs.small', ...segList.map((q) => h('span' + (q.state === 'done' ? '.done' : ''), `${q.zh} ${SEG_LEVELS[q.seg] ?? ''} 级 · 第 ${q.hosts.join('、')} 区${q.state === 'done' ? ' · 已净化' : ''}`))) : '',
  );
}
