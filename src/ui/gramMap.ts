// 语法秘境的画面 (Lucas 2026-11-27「秘境要不要也做个 UI 图形界面」, 方案 1)：三座塔（变音、介词、词族）并排，
// 选中一座，下面是它的层：一条蜿蜒的小路上一个个节点（✓ 已打通 · 可以打），点节点看这层考什么、几场、奖励，再「进入」。
// 只改界面：层、场数、奖励都还在 core/gram/dungeons.ts 和 controller 的 gramRun。

import { xpToNext } from '../core/config';
import { cleared, floorsOf, GRAM_DUNGEON, REL_ZH, type DungeonKind, type Floor, type RelKind } from '../core/gram/dungeons';
import type { GameState } from '../core/state';
import { WORD_BY_ID } from '../data/words';
import { clear, h } from './dom';

const SVG = 'http://www.w3.org/2000/svg';
function s<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string | number> = {}, ...kids: Array<Node | string>): SVGElementTagNameMap[K] {
  const el = document.createElementNS(SVG, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, String(v));
  for (const c of kids) el.append(c);
  return el;
}

const KINDS: DungeonKind[] = ['ablaut', 'prep', 'wordfam'];
const COLOR: Record<DungeonKind, string> = { ablaut: '#d9822b', prep: '#3f8fd2', wordfam: '#5aa55a' };
const WHAT: Record<DungeonKind, string> = {
  ablaut: '强变化动词的元音变化：现在时 du / er 的形式和完成时，81 级起加过去式层。打通一族后，野外也会考这一族的变音。',
  prep: '动词搭哪个介词、介词后面用第几格。锁链怪两道锁：先打介词，再打格。',
  wordfam: '同根、近义、形近的词放在一起练：两句只差这个词，选哪句用哪个。同组有 2 个词归名就开一层；答混只标「易混」，不退进度。',
};

/** Tower outline (24×24, stroke = currentColor). */
const TOWER = 'M7 21V9l-2-2V4h2v2h2V4h2v2h2V4h2v2h2V4h2v3l-2 2v12z M10 21v-4a2 2 0 0 1 4 0v4 M10 11h4';

let pickedKind: DungeonKind | null = null;
let pickedFloor: string | null = null;

function floorShort(kind: DungeonKind, f: Floor): string {
  if (kind === 'ablaut') return f.id === 'praet' ? '过去式' : f.id;
  if (kind === 'prep') return f.id;
  if (f.id === 'suffix') return '构词';
  const [k, base] = f.id.split(':') as [RelKind, string];
  return `${REL_ZH[k]?.replace('层', '') ?? k}·${WORD_BY_ID[base]?.de ?? base}`;
}

function floorRule(kind: DungeonKind, f: Floor): string {
  if (kind === 'ablaut') return f.id === 'praet' ? '所有强变化动词的过去式（ging、nahm、schrieb）。' : `这一族的变音：${f.label.split('·').slice(1).join('·').trim()}。`;
  if (kind === 'prep') return `搭 ${f.id} 的动词：先选介词 ${f.id}，再选后面的格。`;
  if (f.id === 'suffix') return '看词尾定性别：-ung / -heit / -keit 是 die，-chen / -lein 是 das……';
  return f.label;
}

/** The 语法秘境 panel body. `enter` starts a run of that floor (the panel closes itself). */
export function gramMap(st: GameState, enter: (kind: DungeonKind, f: Floor) => void): HTMLElement {
  const root = h('div.gmap');
  const draw = () => {
    clear(root);
    const open = KINDS.filter((k) => st.level >= GRAM_DUNGEON.from[k]);
    if (!pickedKind || !open.includes(pickedKind)) pickedKind = open[0] ?? 'ablaut';
    // 1. Three towers.
    const towers = h('div.gm-towers');
    for (const k of KINDS) {
      const locked = st.level < GRAM_DUNGEON.from[k];
      const floors = locked ? [] : floorsOf(k, st);
      const done = new Set(cleared(st, k));
      const n = floors.filter((f) => done.has(f.id)).length;
      towers.append(
        h(
          `button.gm-tower${k === pickedKind ? '.on' : ''}${locked ? '.locked' : ''}`,
          { style: `--c:${COLOR[k]}`, disabled: locked, onclick: () => { pickedKind = k; pickedFloor = null; draw(); } },
          s('svg', { viewBox: '0 0 24 24', width: 40, height: 40, fill: 'none', stroke: 'currentColor', 'stroke-width': 1.6, 'stroke-linejoin': 'round', class: 'gm-ic' }, s('path', { d: TOWER })),
          h('div.gm-tn', h('b', GRAM_DUNGEON.name[k]), h('span.small', locked ? `${GRAM_DUNGEON.from[k]} 级开` : floors.length ? `已打通 ${n} / ${floors.length} 层` : '还没有可打的层')),
        ),
      );
    }
    root.append(towers);
    const kind = pickedKind;
    if (st.level < GRAM_DUNGEON.from[kind]) {
      root.append(h('p.muted', `语法秘境 ${GRAM_DUNGEON.from.ablaut} 级开放。`));
      return;
    }
    root.append(h('p.small.muted.gm-what', WHAT[kind]));
    const floors = floorsOf(kind, st);
    if (!floors.length) {
      root.append(h('p.muted', kind === 'wordfam' ? '还没有层：同组里有 2 个词归名，就会开出一层。' : '这里暂时没有可打的层。'));
      return;
    }
    const done = new Set(cleared(st, kind));
    // 2. The floors along a winding path: rows of up to 5, alternating direction, bottom row first (you climb).
    const per = 5;
    const rows = Math.ceil(floors.length / per);
    const W = 640, cellW = W / per, rowH = 92, H = rows * rowH + 10;
    const pos = floors.map((_, i) => {
      const r = Math.floor(i / per);
      const c = r % 2 === 0 ? i % per : per - 1 - (i % per);
      return { x: cellW * c + cellW / 2, y: H - 40 - r * rowH };
    });
    const svg = s('svg', { viewBox: `0 0 ${W} ${H}`, class: 'gm-path', role: 'img', 'aria-label': `${GRAM_DUNGEON.name[kind]}的层` });
    if (pos.length > 1) svg.append(s('polyline', { points: pos.map((p) => `${p.x},${p.y}`).join(' '), fill: 'none', stroke: COLOR[kind], 'stroke-width': 4, 'stroke-dasharray': '2 9', 'stroke-linecap': 'round', opacity: 0.7 }));
    if (!pickedFloor || !floors.some((f) => f.id === pickedFloor)) pickedFloor = (floors.find((f) => !done.has(f.id)) ?? floors[0]).id;
    floors.forEach((f, i) => {
      const p = pos[i];
      const isDone = done.has(f.id);
      const picked = f.id === pickedFloor;
      const g = s('g', { class: `gm-node${isDone ? ' done' : ''}${picked ? ' picked' : ''}`, tabindex: 0, transform: `translate(${p.x},${p.y})` });
      g.append(
        s('circle', { r: picked ? 21 : 18, fill: isDone ? COLOR[kind] : 'var(--panel-2, #fffdf7)', stroke: COLOR[kind], 'stroke-width': picked ? 4 : 2.5 }),
        s('text', { 'text-anchor': 'middle', dy: 5, class: 'gm-num', fill: isDone ? '#fff' : COLOR[kind] }, isDone ? '✓' : String(i + 1)),
        s('text', { 'text-anchor': 'middle', y: 38, class: 'gm-label' }, floorShort(kind, f)),
      );
      const pick = () => { pickedFloor = f.id; draw(); };
      g.addEventListener('click', pick);
      g.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(); } });
      svg.append(g);
    });
    root.append(h('div.gm-box', svg));
    // 3. The picked floor's card.
    const f = floors.find((x) => x.id === pickedFloor)!;
    const n = Math.min(f.words.length, GRAM_DUNGEON.fights);
    const xp = Math.round(xpToNext(st.level) * GRAM_DUNGEON.clearXp * (n / GRAM_DUNGEON.fights));
    const isDone = done.has(f.id);
    const sample = f.words.slice(0, 6).map((id) => WORD_BY_ID[id]?.de).filter(Boolean).join('、');
    root.append(
      h(
        'div.gm-card',
        { style: `--c:${COLOR[kind]}` },
        h('div.gm-ch', h('b', f.label), isDone ? h('span.tag', '已打通 · 可以再刷') : h('span.tag', '还没打通')),
        h('div', floorRule(kind, f)),
        h('div.small.muted', `${n} 场，每只怪都在你的等级（Lv ${st.level}）。会遇到：${sample}${f.words.length > 6 ? ' ……' : ''}`),
        h('div.small', `奖励：${xp} 经验${isDone ? '' : ' · 第一次打通送铁箱'}`),
        h('div.gm-go', h('button.btn.primary', { onclick: () => enter(kind, f) }, isDone ? '再刷一次' : '进入这一层')),
      ),
    );
  };
  draw();
  return root;
}
