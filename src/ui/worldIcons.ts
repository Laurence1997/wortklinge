// 大地图上每座城的地标 (Lucas 2026-11-27「有特色」): a small drawn landmark per region, centred on (0,0), about 48×44,
// standing on y = 12. Plain SVG shapes in the region's colour plus ink outlines, so it reads at map size.

const NS = 'http://www.w3.org/2000/svg';
type A = Record<string, string | number>;
function s(tag: string, a: A = {}, ...kids: SVGElement[]): SVGElement {
  const el = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(a)) el.setAttribute(k, String(v));
  el.append(...kids);
  return el;
}
const INK = '#3a2c1e';
const o = (a: A): A => ({ stroke: INK, 'stroke-width': 1.4, 'stroke-linejoin': 'round', ...a });

function windows(x: number, y: number, cols: number, rows: number, dx: number, dy: number): SVGElement[] {
  const out: SVGElement[] = [];
  for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) out.push(s('rect', { x: x + i * dx, y: y + j * dy, width: 3, height: 3.5, fill: '#ffe6a0' }));
  return out;
}

const ICONS: Record<number, (c: string) => SVGElement[]> = {
  // 最后的营地: two tents and a camp fire
  1: (c) => [
    s('path', o({ d: 'M-22 12 L-10 -10 L2 12 Z', fill: c })),
    s('path', o({ d: 'M-10 -10 L-10 12', fill: 'none' })),
    s('path', o({ d: 'M4 12 L13 -4 L22 12 Z', fill: '#e9d3a8' })),
    s('path', { d: 'M-2 12 Q1 2 4 7 Q6 -1 9 12 Z', fill: '#ff9b2f', stroke: '#b5420e', 'stroke-width': 1 }),
  ],
  // 面包集市: a striped market stall with a loaf
  2: (c) => [
    s('rect', o({ x: -18, y: -2, width: 36, height: 14, fill: '#f1e3c4' })),
    s('path', o({ d: 'M-22 -2 L-18 -14 L18 -14 L22 -2 Z', fill: c })),
    s('path', { d: 'M-12 -14 L-14 -2 M-2 -14 L-2 -2 M8 -14 L10 -2', stroke: '#fff7e0', 'stroke-width': 3 }),
    s('ellipse', o({ cx: 0, cy: 5, rx: 9, ry: 4.5, fill: '#c9863a' })),
    s('path', { d: 'M-4 3 L-2 7 M1 3 L3 7', stroke: '#8a5520', 'stroke-width': 1.2 }),
  ],
  // 铁轨镇: a station house over rails
  3: (c) => [
    s('rect', o({ x: -14, y: -6, width: 28, height: 14, fill: '#efe0c8' })),
    s('path', o({ d: 'M-18 -6 L0 -17 L18 -6 Z', fill: c })),
    s('circle', o({ cx: 0, cy: -9, r: 3, fill: '#fff' })),
    s('rect', o({ x: -4, y: 0, width: 8, height: 8, fill: '#6b4a2e' })),
    s('path', { d: 'M-24 11 L24 11 M-24 15 L24 15', stroke: '#5a4a3a', 'stroke-width': 1.6 }),
    s('path', { d: 'M-20 10 L-20 16 M-12 10 L-12 16 M-4 10 L-4 16 M4 10 L4 16 M12 10 L12 16 M20 10 L20 16', stroke: '#8a6a4a', 'stroke-width': 1.6 }),
  ],
  // 租屋城: two tall rented blocks
  4: (c) => [
    s('rect', o({ x: -18, y: -10, width: 16, height: 22, fill: '#ece2d0' })),
    s('rect', o({ x: 0, y: -16, width: 18, height: 28, fill: '#e3d6bf' })),
    s('path', o({ d: 'M-20 -10 L-10 -17 L0 -10 Z', fill: c })),
    s('path', o({ d: 'M-2 -16 L9 -23 L20 -16 Z', fill: c })),
    ...windows(-15, -6, 2, 3, 6, 6),
    ...windows(3, -12, 3, 4, 5, 6),
  ],
  // 泉疗镇: a fountain
  5: (c) => [
    s('ellipse', o({ cx: 0, cy: 8, rx: 20, ry: 6, fill: '#d9ccb4' })),
    s('ellipse', { cx: 0, cy: 7, rx: 16, ry: 4, fill: '#7cc4e0' }),
    s('rect', o({ x: -2.5, y: -8, width: 5, height: 15, fill: '#d9ccb4' })),
    s('path', { d: 'M0 -10 Q-12 -18 -14 2 M0 -10 Q12 -18 14 2 M0 -10 L0 -16', stroke: '#5ab0d6', 'stroke-width': 2, fill: 'none' }),
    s('circle', { cx: -16, cy: -2, r: 3, fill: c }),
    s('circle', { cx: 17, cy: -4, r: 2.5, fill: c }),
  ],
  // 雾港: a lighthouse and a little boat
  6: (c) => [
    s('path', o({ d: 'M-12 12 L-9 -14 L-1 -14 L2 12 Z', fill: '#f6f1e6' })),
    s('path', { d: 'M-11.3 2 L0.6 2 L1.2 7 L-11.8 7 Z M-10 -8 L-0.3 -8 L0.2 -3 L-10.6 -3 Z', fill: c }),
    s('rect', o({ x: -10, y: -20, width: 10, height: 6, fill: '#ffe08a' })),
    s('path', o({ d: 'M-12 -20 L-5 -26 L2 -20 Z', fill: c })),
    s('path', { d: 'M-2 -18 L22 -24 L22 -12 Z', fill: 'rgba(255,230,140,.55)' }),
    s('path', o({ d: 'M6 8 L24 8 L20 13 L9 13 Z', fill: '#8a5a3a' })),
    s('path', o({ d: 'M14 8 L14 -4 L21 6 Z', fill: '#fff' })),
  ],
  // 印章城: a tower with a big round seal
  7: (c) => [
    s('rect', o({ x: -16, y: -14, width: 14, height: 26, fill: '#e8dcc4' })),
    s('path', o({ d: 'M-18 -14 L-9 -22 L0 -14 Z', fill: '#8a6a3a' })),
    ...windows(-13, -9, 2, 3, 5, 6),
    s('circle', o({ cx: 9, cy: 2, r: 11, fill: c })),
    s('circle', { cx: 9, cy: 2, r: 7.5, fill: 'none', stroke: '#fff3c8', 'stroke-width': 1.3 }),
    s('path', { d: 'M9 -3 L10.5 0.5 L14 1 L11.3 3.3 L12 7 L9 5 L6 7 L6.7 3.3 L4 1 L7.5 0.5 Z', fill: '#fff3c8' }),
  ],
  // 工坊城: a workshop with chimneys and smoke
  9: (c) => [
    s('path', o({ d: 'M-20 12 L-20 -4 L-10 -10 L-10 -4 L0 -10 L0 -4 L10 -10 L10 12 Z', fill: c })),
    s('rect', o({ x: 12, y: -18, width: 6, height: 30, fill: '#9a7a5a' })),
    s('circle', { cx: 16, cy: -22, r: 3.5, fill: '#c9c2b6' }),
    s('circle', { cx: 19, cy: -27, r: 4.5, fill: '#d8d2c8' }),
    s('circle', { cx: 23, cy: -33, r: 5, fill: '#e6e1d8' }),
    ...windows(-16, 2, 4, 1, 7, 0),
  ],
  // 电波塔: a lattice radio tower with waves
  10: (c) => [
    s('path', o({ d: 'M-12 12 L0 -22 L12 12', fill: 'none' })),
    s('path', { d: 'M-8 1 L8 1 M-5 -8 L5 -8 M-10 7 L4 -4 M10 7 L-4 -4', stroke: INK, 'stroke-width': 1.2 }),
    s('circle', o({ cx: 0, cy: -23, r: 3.5, fill: c })),
    s('path', { d: 'M-9 -30 Q-13 -23 -9 -16 M9 -30 Q13 -23 9 -16 M-15 -34 Q-21 -23 -15 -12 M15 -34 Q21 -23 15 -12', stroke: c, 'stroke-width': 2, fill: 'none' }),
  ],
  // 心巷: crooked houses with a heart sign
  12: (c) => [
    s('rect', o({ x: -20, y: -4, width: 14, height: 16, fill: '#f0e2cf' })),
    s('path', o({ d: 'M-22 -4 L-13 -13 L-4 -4 Z', fill: '#a0523a' })),
    s('rect', o({ x: 4, y: -8, width: 16, height: 20, fill: '#efe0d4' })),
    s('path', o({ d: 'M2 -8 L12 -17 L22 -8 Z', fill: '#7a4a6a' })),
    s('path', o({ d: 'M0 2 C-6 -4 -6 -10 0 -7 C6 -10 6 -4 0 2 Z', fill: c, transform: 'translate(-1,-12) scale(1.5)' })),
  ],
  // 议会堡: a castle with flags
  13: (c) => [
    s('path', o({ d: 'M-20 12 L-20 -6 L-16 -6 L-16 -9 L-12 -9 L-12 -6 L-8 -6 L-8 -9 L-4 -9 L-4 -6 L4 -6 L4 -9 L8 -9 L8 -6 L12 -6 L12 -9 L16 -9 L16 -6 L20 -6 L20 12 Z', fill: '#ddd3c2' })),
    s('rect', o({ x: -7, y: -20, width: 14, height: 14, fill: '#ddd3c2' })),
    s('path', o({ d: 'M-9 -20 L0 -28 L9 -20 Z', fill: c })),
    s('path', o({ d: 'M-4 12 L-4 4 Q0 -1 4 4 L4 12 Z', fill: '#5a4030' })),
    s('path', { d: 'M0 -28 L0 -36', stroke: INK, 'stroke-width': 1.3 }),
    s('path', { d: 'M0 -36 L8 -33.5 L0 -31 Z', fill: c }),
  ],
  // 铸币场: a stack of coins and a press
  14: (c) => [
    s('rect', o({ x: -20, y: -12, width: 16, height: 24, fill: '#b9ad9a' })),
    s('rect', o({ x: -23, y: -16, width: 22, height: 5, fill: '#8a7a64' })),
    s('ellipse', o({ cx: 9, cy: 10, rx: 11, ry: 3.5, fill: c })),
    s('ellipse', o({ cx: 9, cy: 5, rx: 11, ry: 3.5, fill: c })),
    s('ellipse', o({ cx: 9, cy: 0, rx: 11, ry: 3.5, fill: c })),
    s('ellipse', o({ cx: 9, cy: -5, rx: 11, ry: 3.5, fill: '#f2cf62' })),
    s('circle', o({ cx: 4, cy: -17, r: 6, fill: '#f2cf62' })),
  ],
  // 面具剧场: a curtain stage with a mask
  16: (c) => [
    s('path', o({ d: 'M-22 12 L-22 -14 Q0 -24 22 -14 L22 12 Z', fill: '#f2e7d6' })),
    s('path', o({ d: 'M-22 -14 Q-14 -2 -16 12 L-22 12 Z M22 -14 Q14 -2 16 12 L22 12 Z', fill: c })),
    s('path', o({ d: 'M-9 -8 Q0 -12 9 -8 Q9 6 0 8 Q-9 6 -9 -8 Z', fill: '#fff' })),
    s('path', { d: 'M-6 -3 Q-4 -5 -2 -3 M2 -3 Q4 -5 6 -3 M-4 3 Q0 6 4 3', stroke: INK, 'stroke-width': 1.4, fill: 'none' }),
  ],
  // 档案深处: an archive door into the ground with books
  17: (c) => [
    s('path', o({ d: 'M-20 12 L-14 -6 L14 -6 L20 12 Z', fill: '#cbbca2' })),
    s('path', o({ d: 'M-7 12 L-7 0 Q0 -7 7 0 L7 12 Z', fill: '#2e241a' })),
    s('rect', o({ x: -22, y: 2, width: 6, height: 10, fill: c })),
    s('rect', o({ x: 16, y: 0, width: 6, height: 12, fill: '#7a5a3a' })),
    s('rect', o({ x: -16, y: 4, width: 5, height: 8, fill: '#a07850' })),
  ],
  // 天平庭: scales over columns
  18: (c) => [
    s('rect', o({ x: -20, y: 8, width: 40, height: 4, fill: '#ddd8cf' })),
    s('rect', o({ x: -16, y: -6, width: 5, height: 14, fill: '#ece8e0' })),
    s('rect', o({ x: 11, y: -6, width: 5, height: 14, fill: '#ece8e0' })),
    s('path', o({ d: 'M-20 -6 L0 -14 L20 -6 Z', fill: c })),
    s('path', { d: 'M0 -14 L0 -28 M-12 -26 L12 -26 M-12 -26 L-16 -19 M-12 -26 L-8 -19 M12 -26 L8 -19 M12 -26 L16 -19', stroke: INK, 'stroke-width': 1.3 }),
    s('path', o({ d: 'M-17 -19 Q-12 -15 -7 -19 Z M7 -19 Q12 -15 17 -19 Z', fill: '#f2cf62' })),
  ],
  // 沉默之心: a pale hollow crystal heart
  20: (c) => [
    s('path', o({ d: 'M0 12 L-16 -6 L-8 -18 L0 -12 L8 -18 L16 -6 Z', fill: '#eef0f2' })),
    s('path', { d: 'M0 12 L0 -12 M-16 -6 L16 -6 M-8 -18 L0 -6 L8 -18', stroke: c, 'stroke-width': 1.2, fill: 'none' }),
    s('circle', { cx: 0, cy: -4, r: 3, fill: '#fff', stroke: c }),
  ],
};

/** A landmark group, or a fog cloud with a question mark for a locked city. */
export function landmark(region: number, colour: string, open: boolean): SVGElement {
  if (!open) {
    return s(
      'g',
      { class: 'wm-fogicon' },
      s('path', { d: 'M-20 8 Q-24 -2 -14 -4 Q-12 -14 -2 -12 Q4 -20 12 -12 Q22 -12 20 -2 Q26 4 18 8 Z', fill: '#f4f1ec', stroke: '#a39c90', 'stroke-width': 1.4 }),
      s('text', { y: 4, 'text-anchor': 'middle', class: 'wm-q' }, document.createTextNode('?') as unknown as SVGElement),
    );
  }
  return s('g', { class: 'wm-landmark' }, ...(ICONS[region]?.(colour) ?? [s('circle', o({ r: 12, fill: colour }))]));
}
