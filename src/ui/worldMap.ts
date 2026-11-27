// 大地图画成一张图 (Lucas 2026-11-27, 游戏设计 四「两层地图」): five stage bands left to right (A1 … C1), the 16 cities
// on one road in unlock order, each city's dot in its region's own colour. 蚀变 segments are not cities: once open
// they ring their host cities in dark red and mark the boss's city; beaten, the ring fades to 「已净化」. 零号站台 is a
// small dark-red door next to region 3 once seen. Click a city → an info card with the travel button.
import { h } from './dom';
import { accentOf } from './theme';
import { AREAS, SCENE_BY_ID } from '../data/world';
import { ERODE_DEFS, REGION_DEF } from '../data/zones';

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

const W = 1000;
const H = 430;
/** Hand-placed city spots (viewBox units): a winding road that runs through the five bands. */
const SPOT: Record<number, [number, number]> = {
  1: [62, 320], 2: [112, 180], 3: [180, 300],
  4: [262, 210], 5: [318, 330], 6: [384, 225], 7: [444, 120],
  9: [526, 200], 10: [584, 325], 12: [640, 160],
  13: [712, 290], 14: [762, 150], 16: [816, 300],
  17: [878, 175], 18: [934, 310], 20: [962, 105],
};
const STAGES: Array<{ id: string; zh: string; regions: number[]; x0: number; x1: number; fill: string }> = [
  { id: 'A1', zh: '入门', regions: [1, 2, 3], x0: 0, x1: 222, fill: '#f6e7c8' },
  { id: 'A2', zh: '基础', regions: [4, 5, 6, 7], x0: 222, x1: 482, fill: '#e6eedb' },
  { id: 'B1', zh: '进阶', regions: [9, 10, 12], x0: 482, x1: 678, fill: '#dfe9f1' },
  { id: 'B2', zh: '高阶', regions: [13, 14, 16], x0: 678, x1: 848, fill: '#ece2f0' },
  { id: 'C1', zh: '精通', regions: [17, 18, 20], x0: 848, x1: 1000, fill: '#e9e6e0' },
];
const ERODE_RED = '#8a1424';
const SEG_LEVELS: Record<number, string> = { 8: '71–80', 11: '101–110', 15: '141–150', 19: '181–190' };

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

  // ---- defs: soft paper grain + a glow for "you are here"
  svg.append(
    s('defs', {},
      s('filter', { id: 'wm-glow', x: '-50%', y: '-50%', width: '200%', height: '200%' }, s('feGaussianBlur', { stdDeviation: 5 })),
      s('pattern', { id: 'wm-hatch', width: 6, height: 6, patternUnits: 'userSpaceOnUse', patternTransform: 'rotate(45)' }, s('line', { x1: 0, y1: 0, x2: 0, y2: 6, stroke: '#b9ad97', 'stroke-width': 1.4 })),
    ),
  );

  // ---- stage bands
  for (const st of STAGES) {
    svg.append(s('rect', { x: st.x0, y: 0, width: st.x1 - st.x0, height: H, fill: st.fill }));
    svg.append(s('text', { x: (st.x0 + st.x1) / 2, y: 26, 'text-anchor': 'middle', class: 'wm-stage' }, `${st.id} · ${st.zh}`));
    svg.append(s('text', { x: (st.x0 + st.x1) / 2, y: 44, 'text-anchor': 'middle', class: 'wm-stage-lv' }, stageLevels(st.id, st.regions)));
    if (st.x0 > 0) svg.append(s('line', { x1: st.x0, y1: 54, x2: st.x0, y2: H - 10, stroke: '#a89a80', 'stroke-width': 1, 'stroke-dasharray': '2 5' }));
  }

  // ---- the road, city to city in unlock order
  const order = AREAS.map((a) => a.region).filter((r) => SPOT[r]);
  for (let i = 1; i < order.length; i++) {
    const [ax, ay] = SPOT[order[i - 1]];
    const [bx, by] = SPOT[order[i]];
    const lit = c.open(order[i - 1]) && c.open(order[i]);
    const mx = (ax + bx) / 2 + (by - ay) * 0.18;
    const my = (ay + by) / 2 - (bx - ax) * 0.18;
    svg.append(s('path', { d: `M${ax},${ay} Q${mx},${my} ${bx},${by}`, fill: 'none', stroke: lit ? '#7a6447' : '#bcb2a0', 'stroke-width': lit ? 4 : 3, 'stroke-dasharray': lit ? '' : '6 7', 'stroke-linecap': 'round' }));
  }

  // ---- 蚀变 rings under the cities
  for (const g of segs) {
    if (g.state === 'hidden') continue;
    for (const r of g.hosts) {
      if (!SPOT[r]) continue;
      const [x, y] = SPOT[r];
      svg.append(s('circle', { cx: x, cy: y, r: 30, fill: 'none', stroke: ERODE_RED, 'stroke-width': g.state === 'open' ? 3 : 1.5, 'stroke-dasharray': g.state === 'open' ? '3 4' : '2 6', opacity: g.state === 'open' ? 0.9 : 0.35, class: g.state === 'open' ? 'wm-erode' : '' }));
    }
  }

  // ---- 零号站台
  if (c.zeroSeen && SPOT[3]) {
    const [x, y] = SPOT[3];
    const g = s('g', { transform: `translate(${x + 30},${y + 34})` },
      s('rect', { x: -8, y: -12, width: 16, height: 20, rx: 2, fill: '#2a0a10', stroke: ERODE_RED, 'stroke-width': 1.5 }),
      s('circle', { cx: 4, cy: -1, r: 1.6, fill: '#ff5a6a' }),
      s('text', { x: 12, y: 4, class: 'wm-zero' }, '零号站台'),
    );
    g.append(s('title', {}, '零号站台：铁轨镇时刻表墙后的地下城（28 级起）'));
    svg.append(g);
  }

  // ---- cities
  const cityEls: Record<number, SVGElement> = {};
  for (const a of AREAS) {
    const p = SPOT[a.region];
    if (!p) continue;
    const [x, y] = p;
    const open = c.open(a.region);
    const here = a.region === c.current;
    const danger = open && !here && firstLevel(a.levels) > c.level;
    const col = open ? accentOf(a.region) : '#a39c90';
    const g = s('g', { transform: `translate(${x},${y})`, class: 'wm-city' + (open ? ' open' : ' locked') + (here ? ' here' : ''), tabindex: 0 });
    if (here) g.append(s('circle', { r: 24, fill: col, opacity: 0.55, filter: 'url(#wm-glow)', class: 'wm-pulse' }));
    g.append(s('circle', { r: 19, fill: '#fffaf0', stroke: col, 'stroke-width': 3 }));
    g.append(s('circle', { r: 13, fill: open ? col : 'url(#wm-hatch)', stroke: open ? 'none' : '#a39c90', 'stroke-width': 1 }));
    g.append(s('text', { y: 4.5, 'text-anchor': 'middle', class: 'wm-num' + (open ? '' : ' dim') }, open ? String(a.region) : '?'));
    const next = !open && order.find((r) => !c.open(r)) === a.region;
    if (open || next) g.append(s('text', { y: 36, 'text-anchor': 'middle', class: 'wm-name' + (open ? '' : ' dim') }, open ? a.zh : '下一站 · 以后开放'));
    if (open) g.append(s('text', { y: 50, 'text-anchor': 'middle', class: 'wm-lv' + (danger ? ' danger' : '') }, danger ? `${a.levels} · 危险` : a.levels));
    const boss = segs.find((q) => q.state === 'open' && q.bossRegion === a.region);
    if (boss) {
      g.append(s('g', { transform: 'translate(15,-17)' }, s('circle', { r: 8.5, fill: ERODE_RED, stroke: '#fff', 'stroke-width': 1.5 }), s('text', { y: 3.8, 'text-anchor': 'middle', class: 'wm-boss' }, '☠')));
    }
    if (here) {
      g.append(s('g', { transform: 'translate(0,-36)', class: 'wm-here' }, s('rect', { x: -32, y: -12, width: 64, height: 18, rx: 9, fill: '#2b211a' }), s('text', { y: 1.5, 'text-anchor': 'middle' }, '你在这里')));
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
    h('span', h('i.wm-dot', { style: `background:${accentOf(1)}` }), '开放的区（点一下看详情，双击直接去）'),
    h('span', h('i.wm-dot.locked'), '以后开放'),
    h('span', h('i.wm-ring'), '蚀变中'),
    h('span', '☠ 蚀变首领'),
  );
  const segList = segs.filter((q) => q.state !== 'hidden');
  return h('div.worldmap',
    h('div.wm-wrap', svg, card),
    legend,
    segList.length ? h('div.wm-segs.small', ...segList.map((q) => h('span' + (q.state === 'done' ? '.done' : ''), `${q.zh} ${SEG_LEVELS[q.seg] ?? ''} 级 · 第 ${q.hosts.join('、')} 区${q.state === 'done' ? ' · 已净化' : ''}`))) : '',
  );
}
