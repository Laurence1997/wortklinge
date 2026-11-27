// 技能与天赋面板的画面 (Lucas 2026-11-27「这个 UI 太丑了也不直观」, 选方案 1)：
// 技能池 = 出战栏 + 带图标的卡片网格；天赋 = 一块夜空里的 5 个星座（每支 8 颗星，自下而上一排排点亮）。
// 只改界面：规则和数值都还在 core/skillPool.ts 和 core/classes.ts。

import { loadout, owned, POOL, POOL_FROM, POOL_ORDER, SHOUT_IDS, slotCount, SLOTS, toggleLoadout, type PoolId } from '../core/skillPool';
import { BRANCHES, canLearn, learn, learned, ROW_GATE, spent, spentIn, talentPoints, TALENT_FROM_LEVEL, TALENT_TREE, type Branch, type TalentDef } from '../core/classes';
import type { GameState } from '../core/state';
import { h } from './dom';

const SVG = 'http://www.w3.org/2000/svg';
function s<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string | number> = {}, ...kids: Array<Node | string>): SVGElementTagNameMap[K] {
  const el = document.createElementNS(SVG, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, String(v));
  for (const c of kids) el.append(c);
  return el;
}

// ---- 技能卡片 ---------------------------------------------------------------------------------------

/** Line icons (24×24 viewBox, stroke = currentColor). */
const SKILL_ICON: Record<PoolId, string> = {
  storm: 'M4 15c2-6 7-9 12-8M6 19c3-3 7-4 11-3M12 4c1 3 0 5-2 6M17 10l3-3M19 14l2 1M9 21l-1 1M14 21l1 1',
  steady: 'M12 3l7 3v5c0 5-3 8-7 10-4-2-7-5-7-10V6z M9 12l2 2 4-4',
  split: 'M4 12h6M14 12h6M10 7l2 5-2 5M14 7l-2 5 2 5',
  colloc: 'M9 15l-2 2a3 3 0 0 1-4-4l3-3a3 3 0 0 1 4 0M15 9l2-2a3 3 0 0 1 4 4l-3 3a3 3 0 0 1-4 0M9 15l6-6',
  seal: 'M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18M12 7a5 5 0 1 0 0 10a5 5 0 1 0 0-10M12 10v4M10 12h4',
  dictate: 'M6 10a6 6 0 0 1 12 0c0 4-4 4-4 8a3 3 0 0 1-6 0M9 10a3 3 0 0 1 6 0M20 6l2-1M21 11h2M20 16l2 1',
  saying: 'M4 5h16v10H10l-5 4v-4H4zM8 9h8M8 12h5',
  slang: 'M4 5h16v10H10l-5 4v-4H4zM13 7l-3 4h3l-2 3',
};

function skillIcon(id: PoolId, size = 36): SVGSVGElement {
  return s('svg', { viewBox: '0 0 24 24', width: size, height: size, fill: 'none', stroke: 'currentColor', 'stroke-width': 1.7, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', class: 'sk-ic' }, s('path', { d: SKILL_ICON[id] }));
}

const KEYS = ['R', 'G', 'T', 'Y'];

export function skillCards(st: GameState, save: () => void): HTMLElement {
  const wrap = h('div.skills');
  const n = slotCount(st.level);
  const lo = loadout(st);
  const own = owned(st);
  const maxSlots = SLOTS[0][1];

  // 出战栏: the carried skills, then empty slots, then the slots still to come (30 / 61 级).
  const bar = h('div.sk-bar');
  const keyOf = (id: PoolId) => {
    if (SHOUT_IDS.includes(id)) return '喊';
    const i = lo.filter((x) => !SHOUT_IDS.includes(x)).indexOf(id);
    return KEYS[i] ?? '';
  };
  for (let i = 0; i < maxSlots; i++) {
    const id = lo[i];
    if (id) {
      bar.append(
        h('button.sk-slot.on', { title: '点一下拿出', onclick: () => { toggleLoadout(st, id); save(); } },
          h('kbd', keyOf(id)), skillIcon(id, 26), h('span.nm', POOL[id].zh), h('span.x', '×')),
      );
    } else if (i < n) bar.append(h('div.sk-slot.empty', h('span', '空格'), h('small', '点下面的技能带上')));
    else {
      const lv = [...SLOTS].reverse().find(([, c]) => c > i)?.[0] ?? 0;
      bar.append(h('div.sk-slot.locked', h('span', '🔒'), h('small', `${lv} 级开`)));
    }
  }
  wrap.append(
    h('div.sk-head', h('h3', '出战栏'), h('span.sk-count', `${lo.length} / ${n || 2} 格`),
      h('span.small.muted', st.level < POOL_FROM ? `${POOL_FROM} 级打完第 1 区首领后，导师 Greta 送你墨水风暴和稳住。` : '战斗里按 R / G / T / Y 放；短句和俚语在喊话栏，不占按键。')),
    bar,
  );

  // 卡片网格.
  const grid = h('div.sk-grid');
  for (const id of POOL_ORDER) {
    const sk = POOL[id];
    const have = own.includes(id);
    const on = lo.includes(id);
    const full = !on && lo.length >= n;
    let foot: string;
    let cls = '';
    if (on) { foot = '出战中 · 点一下拿出'; cls = '.on'; }
    else if (have) { foot = full ? '出战栏满了，先拿出一个' : '点一下带上'; cls = full ? '.full' : '.can'; }
    else if (st.level >= sk.lv && st.level >= POOL_FROM && (id === 'saying' || id === 'slang')) { foot = id === 'saying' ? '先去单词本选一张短句卡' : '先去单词本选一条俚语'; cls = '.locked'; }
    else { foot = `🔒 ${Math.max(sk.lv, POOL_FROM)} 级开放`; cls = '.locked'; }
    const click = have && (on || !full) ? () => { toggleLoadout(st, id); save(); } : undefined;
    grid.append(
      h(`div.sk-card${cls}`, { onclick: click, title: `${sk.zh}：${sk.asks}。${sk.effect}` },
        h('div.sk-top', h('div.sk-icbox', skillIcon(id)), h('div.sk-t', h('b', sk.zh), h('span.sk-cd', sk.cd ? `冷却 ${sk.cd} 回合` : '每场一次 · 喊出'))),
        h('div.sk-ask', sk.asks),
        h('div.sk-eff', sk.effect),
        h('div.sk-foot', foot),
      ),
    );
  }
  wrap.append(grid);
  return wrap;
}

// ---- 天赋星图 ---------------------------------------------------------------------------------------

/** Each branch's colour and its constellation's shape (8 stars: row 1 ×2, row 2 ×2, row 3 ×2, row 4, 大天赋). */
const SKY: Record<Branch, { color: string; sign: string; pos: Array<[number, number]>; extra?: Array<[number, number]> }> = {
  // 笔锋: a slanted quill.
  bifeng: { color: '#ffd36b', sign: '✒', pos: [[40, 435], [130, 425], [35, 348], [140, 335], [55, 258], [155, 245], [125, 170], [160, 92]] },
  // 守势: a shield.
  shoushi: { color: '#7cc8ff', sign: '⛨', pos: [[48, 430], [152, 430], [30, 345], [170, 345], [52, 258], [148, 258], [100, 180], [100, 92]], extra: [[0, 1]] },
  // 言辞: a speech curl.
  yanci: { color: '#ff9fd2', sign: '❝', pos: [[60, 438], [150, 415], [30, 350], [165, 330], [45, 262], [160, 245], [115, 175], [55, 96]] },
  // 秩序: a square frame.
  zhixu: { color: '#b9a2ff', sign: '▦', pos: [[45, 430], [155, 430], [45, 345], [155, 345], [45, 260], [155, 260], [100, 180], [100, 92]], extra: [[0, 1], [4, 5]] },
  // 迅捷: a lightning bolt.
  xunjie: { color: '#79f0b0', sign: 'ϟ', pos: [[30, 435], [115, 428], [80, 352], [165, 342], [30, 265], [115, 255], [155, 180], [85, 92]] },
};
const EDGES: Array<[number, number]> = [[0, 2], [1, 3], [2, 4], [3, 5], [4, 6], [5, 6], [6, 7]];
const COL_W = 200;
const SKY_H = 500;

/** Which star the detail card shows; survives re-renders of the panel. */
let picked: string | null = null;

type StarState = 'full' | 'lit' | 'open' | 'idle' | 'locked';

function starState(st: GameState, t: TalentDef): StarState {
  const k = learned(st, t.id);
  if (k >= t.max) return 'full';
  if (k > 0) return 'lit';
  if (spentIn(st, t.branch) < ROW_GATE[t.row]) return 'locked';
  return canLearn(st, t) ? 'open' : 'idle';
}

function starPath(cx: number, cy: number, r: number, points = 4): string {
  const pts: string[] = [];
  for (let i = 0; i < points * 2; i++) {
    const a = (Math.PI / points) * i - Math.PI / 2;
    const rr = i % 2 ? r * 0.38 : r;
    pts.push(`${(cx + Math.cos(a) * rr).toFixed(1)},${(cy + Math.sin(a) * rr).toFixed(1)}`);
  }
  return `M${pts.join('L')}Z`;
}

function detail(st: GameState, t: TalentDef, save: () => void): HTMLElement {
  const k = learned(st, t.id);
  const br = BRANCHES[t.branch];
  const color = SKY[t.branch].color;
  const inBr = spentIn(st, t.branch);
  const gate = ROW_GATE[t.row];
  const free = talentPoints(st) - spent(st);
  const grey = t.pending ? `${t.pending}，点了暂不生效。` : t.from && st.level < t.from ? `${t.from} 级起生效，现在点了先存着。` : '';
  const pips = h('span.ts-pips');
  for (let i = 0; i < t.max; i++) pips.append(h(`i${i < k ? '.on' : ''}`, { style: `--c:${color}` }));
  let why = '';
  if (k >= t.max) why = '已点满。';
  else if (inBr < gate) why = `${t.row === 5 ? '大天赋' : `第 ${t.row} 排`}：「${br.zh}」这一支要先点满 ${gate} 点（现在 ${inBr} 点，还差 ${gate - inBr}）。`;
  else if (st.level < TALENT_FROM_LEVEL) why = `${TALENT_FROM_LEVEL} 级起才有天赋点。`;
  else if (free <= 0) why = '没有空余的天赋点了，升级再来。';
  const now = k ? t.desc(k) : '';
  const next = k < t.max ? t.desc(k + 1) : '';
  return h('div.ts-detail', { style: `--c:${color}` },
    h('div.ts-dh', h('span.ts-sign', SKY[t.branch].sign), h('b', `${t.big ? '★ ' : ''}${t.zh}`), pips, h('span.small.muted', `${br.zh} · ${t.big ? '大天赋' : `第 ${t.row} 排`}`)),
    now ? h('div.ts-now', h('span.small.muted', '现在：'), now) : '',
    next ? h('div.ts-next', h('span.small.muted', k ? '再点一级：' : '点亮后：'), next) : '',
    grey ? h('div.small.muted', grey) : '',
    h('div.ts-act',
      h('button.btn.primary', { disabled: !canLearn(st, t), onclick: () => { learn(st, t.id); save(); } }, k >= t.max ? '已点满' : k ? '再点一级' : '点亮'),
      h('span.small.muted', why || `点了用掉 1 点，还剩 ${free} 点。`),
    ),
  );
}

export function talentSky(st: GameState, save: () => void): HTMLElement {
  const wrap = h('div.tsky-wrap');
  const branches = Object.keys(BRANCHES) as Branch[];
  if (!picked || !TALENT_TREE.some((t) => t.id === picked)) picked = (TALENT_TREE.find((t) => canLearn(st, t)) ?? TALENT_TREE[0]).id;

  const svg = s('svg', { viewBox: `0 0 ${COL_W * branches.length} ${SKY_H}`, class: 'tsky', role: 'img' });
  const defs = s('defs');
  defs.append(
    s('filter', { id: 'tsGlow', x: '-100%', y: '-100%', width: '300%', height: '300%' },
      s('feGaussianBlur', { stdDeviation: 4, result: 'b' }),
      s('feMerge', {}, s('feMergeNode', { in: 'b' }), s('feMergeNode', { in: 'SourceGraphic' }))),
  );
  svg.append(defs);
  // Faint background stars (fixed seed, same every time).
  let seed = 7;
  const rnd = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);
  for (let i = 0; i < 140; i++) svg.append(s('circle', { cx: (rnd() * COL_W * branches.length).toFixed(1), cy: (rnd() * SKY_H).toFixed(1), r: (rnd() * 1.1 + 0.3).toFixed(2), fill: '#fff', opacity: (rnd() * 0.35 + 0.1).toFixed(2) }));

  const card = h('div.ts-card');
  const showCard = (t: TalentDef) => card.replaceChildren(detail(st, t, save));

  branches.forEach((br, bi) => {
    const conf = SKY[br];
    const nodes = TALENT_TREE.filter((t) => t.branch === br).sort((a, b) => a.row - b.row);
    const ox = bi * COL_W;
    const g = s('g');
    if (bi) g.append(s('line', { x1: ox, y1: 18, x2: ox, y2: SKY_H - 10, stroke: '#ffffff', 'stroke-opacity': 0.06 }));
    // Header: the branch, its sign and points spent.
    const inBr = spentIn(st, br);
    g.append(
      s('text', { x: ox + COL_W / 2, y: 22, 'text-anchor': 'middle', class: 'ts-bname', fill: conf.color }, `${conf.sign} ${BRANCHES[br].zh}`),
      s('text', { x: ox + COL_W / 2, y: 40, 'text-anchor': 'middle', class: 'ts-bsub' }, `已点 ${inBr} · ${BRANCHES[br].about}`),
    );
    const P = (i: number) => [ox + conf.pos[i][0], conf.pos[i][1]] as const;
    const stOf = nodes.map((t) => starState(st, t));
    for (const [a, b] of [...EDGES, ...(conf.extra ?? [])]) {
      const [x1, y1] = P(a);
      const [x2, y2] = P(b);
      const lit = learned(st, nodes[a].id) > 0 && learned(st, nodes[b].id) > 0;
      const open = stOf[b] !== 'locked';
      g.append(s('line', { x1, y1, x2, y2, stroke: lit ? conf.color : open ? conf.color : '#8a8fb0', 'stroke-opacity': lit ? 0.9 : open ? 0.35 : 0.18, 'stroke-width': lit ? 2.2 : 1.3, 'stroke-dasharray': open || lit ? '' : '3 5' }));
    }
    nodes.forEach((t, i) => {
      const [cx, cy] = P(i);
      const state = stOf[i];
      const k = learned(st, t.id);
      const r = t.big ? 15 : 9;
      const node = s('g', { class: `ts-star ${state}${picked === t.id ? ' picked' : ''}`, tabindex: 0 });
      node.append(s('circle', { cx, cy, r: r + 14, fill: 'transparent' })); // hit area
      if (picked === t.id) node.append(s('circle', { cx, cy, r: r + 8, fill: 'none', stroke: '#fff', 'stroke-opacity': 0.75, 'stroke-width': 1.2, 'stroke-dasharray': '3 3' }));
      if (state === 'open') node.append(s('circle', { cx, cy, r: r + 4, fill: 'none', stroke: conf.color, 'stroke-width': 1.5, class: 'ts-pulse' }));
      const shape = t.big ? s('path', { d: starPath(cx, cy, r + 4, 4) }) : s('circle', { cx, cy, r: state === 'locked' ? r - 4 : r });
      const fill = state === 'full' || state === 'lit' ? conf.color : state === 'locked' ? '#4a4e6a' : '#1a1e3a';
      shape.setAttribute('fill', fill);
      shape.setAttribute('stroke', state === 'locked' ? '#6a6f90' : conf.color);
      shape.setAttribute('stroke-width', state === 'lit' ? '1' : '1.6');
      if (state === 'full' || state === 'lit') shape.setAttribute('filter', 'url(#tsGlow)');
      if (state === 'lit') shape.setAttribute('fill-opacity', '0.7');
      if ((t.pending || (t.from && st.level < t.from)) && state !== 'locked') shape.setAttribute('stroke-dasharray', '2 2');
      node.append(shape);
      // Rank pips under the star, then the name.
      const pw = 7;
      for (let p = 0; p < t.max; p++) node.append(s('circle', { cx: cx - ((t.max - 1) * pw) / 2 + p * pw, cy: cy + r + 9, r: 2.2, fill: p < k ? conf.color : 'none', stroke: state === 'locked' ? '#5a5f80' : conf.color, 'stroke-width': 1 }));
      node.append(s('text', { x: cx, y: cy + r + 27, 'text-anchor': 'middle', class: 'ts-name' }, t.zh));
      node.append(s('title', {}, `${t.zh} ${k}/${t.max}：${t.desc(Math.max(1, k))}`));
      node.addEventListener('mouseenter', () => showCard(t));
      node.addEventListener('mouseleave', () => showCard(TALENT_TREE.find((x) => x.id === picked) ?? t));
      node.addEventListener('click', () => { picked = t.id; showCard(t); svg.querySelectorAll('.ts-star.picked').forEach((e) => e.classList.remove('picked')); save(); });
      g.append(node);
    });
    svg.append(g);
  });

  const pts = talentPoints(st);
  const used = spent(st);
  wrap.append(
    h('div.sk-head', h('h3', '天赋星图'), h('span.sk-count', `剩 ${Math.max(0, pts - used)} 点`), h('span.small.muted', `已用 ${used} / ${pts}。每支从最下面点起，点满 3 / 6 / 9 / 12 点依次开上一排，最上面的大星是大天赋。`)),
    h('div.tsky-box', svg),
    card,
  );
  showCard(TALENT_TREE.find((t) => t.id === picked)!);
  return wrap;
}
