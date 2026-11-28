// 区内路网 (Lucas 2026-11-28 方案 3): every region's field scenes stand on ONE route of its own shape, drawn along
// the region's landscape (a coast, a ring road, a maze, rail tracks …). The scenes follow it in number order; there
// are no side paths between field scenes any more, so walking the numbers visits every scene and none is missed.
// The route enters from the crossroads (22,24) in the west and ends near the boss door (68,24) in the east; the
// hidden path (69,4), the road on (69,44) and a 蚀变 boss scene (69,12) hang off it. src/game/map.ts carves the
// route into the street map, so houses, water and hedges make way for it.

export type Pt = { x: number; y: number };

/** Where the boss door stands when the route ends somewhere else than the east gate (default (68,24)). */
export const DOOR_AT_REGION: Record<number, Pt> = { 10: { x: 48, y: 24 }, 13: { x: 48, y: 24 }, 18: { x: 58, y: 24 } };

/** Waypoints of each region's route (tiles). Scenes are spaced evenly along the polyline. */
export const ROUTE: Record<number, Array<[number, number]>> = {
  // 回声巷 (废墟街区): a comb up and down the ruined blocks north of the main road, back west along the main road,
  // a comb through the south blocks, up to the neighbour's door.
  1: [[27, 24], [27, 7], [34, 7], [34, 19], [41, 19], [41, 7], [48, 7], [48, 19], [55, 19], [55, 7], [62, 7], [62, 24], [32, 24], [32, 30], [32, 41], [39, 41], [39, 30], [46, 30], [46, 41], [53, 41], [53, 30], [60, 30], [60, 41], [65, 41], [65, 30]],
  // 面包集市: down through the gardens, past the barns, round the market square, through the wheat fields, to the scales.
  2: [[27, 24], [27, 31], [33, 33], [33, 38], [27, 41], [34, 43], [41, 39], [41, 34], [56, 34], [58, 41], [65, 40], [64, 33], [58, 29], [57, 16], [41, 15], [36, 9], [43, 5], [56, 5], [64, 9], [64, 21]],
  // 铁轨镇: back and forth along the tracks: the old town, the platforms, the freight yard.
  3: [[27, 24], [27, 8], [64, 8], [64, 15], [33, 15], [33, 21], [58, 21], [58, 28], [33, 28], [33, 35], [64, 35], [64, 28]],
  // 租屋城: a Z through the terraced streets: along the north end, down the stairs of blocks, along the south end.
  4: [[27, 24], [27, 6], [60, 6], [60, 12], [55, 12], [55, 18], [50, 18], [50, 24], [45, 24], [45, 30], [40, 30], [40, 36], [35, 36], [35, 42], [64, 42], [64, 28]],
  // 泉疗镇: over the north-west spring, round the north-east one, round the south-east one.
  5: spa(),
  // 雾港: through the old town on the hill, down to the quay, out to the end of every pier and back, to the harbour gate.
  6: [[27, 24], [28, 10], [40, 6], [52, 10], [62, 8], [62, 17], [50, 18], [38, 18], [32, 24], [30, 32], [30, 41], [35, 33], [41, 41], [46, 33], [52, 41], [57, 33], [63, 41], [64, 32]],
  // 印章城: a procession weaving across the boulevard, through the north and south squares.
  7: wave(27, 64, 5, 17),
  // 工坊城: along the workshop yards row by row, over the canal bridges.
  9: [[27, 24], [27, 8], [61, 8], [61, 17], [33, 17], [33, 31], [61, 31], [61, 41], [66, 36], [66, 27]],
  // 电波塔: a spiral round the tower, ring after ring, to the boss at the top of the tower (the middle, see DOOR_AT).
  10: spiral(47, 24, 21, 19, 4, 3.5, 3),
  // 心巷: a winding lane between cottages, wandering north and south like a hand-drawn path.
  12: [[27, 24], [30, 15], [27, 7], [36, 5], [40, 13], [36, 21], [39, 30], [32, 35], [30, 42], [39, 43], [46, 36], [53, 41], [61, 41], [61, 32], [53, 28], [52, 19], [48, 10], [53, 5], [61, 7], [59, 16], [63, 23]],
  // 议会堡: round the moat outside (west, north, east, south), over the south bridge, round the keep to its boss.
  13: citadel(),
  // 铸币场: up and down the canal banks, crossing a bridge at each end.
  14: [[27, 24], [28, 6], [37, 6], [37, 42], [47, 42], [47, 6], [56, 6], [56, 42], [64, 42], [64, 28]],
  // 面具剧场: through the flower gardens north, then along the top row of seats round the stage.
  16: theatre(),
  // 档案深处: a labyrinth: in along one arm of a double spiral to the ruined court, out along the other.
  17: labyrinth(),
  // 天平庭: round the four corner gardens clockwise, then along the axis between the pools to the scales (DOOR_AT).
  18: [[27, 24], [27, 14], [31, 6], [39, 5], [47, 9], [55, 5], [63, 6], [65, 14], [65, 21], [65, 34], [64, 41], [57, 43], [47, 39], [39, 43], [30, 42], [27, 34], [33, 29], [40, 25], [52, 24]],
  // 沉默之心: island to island across the still lake, a long meander.
  20: [[27, 24], [29, 14], [27, 6], [36, 8], [38, 17], [34, 30], [28, 36], [32, 43], [41, 40], [44, 31], [46, 20], [44, 9], [52, 5], [58, 11], [55, 20], [56, 31], [52, 41], [60, 43], [64, 35], [63, 27]],
};

function ellipse(cx: number, cy: number, rx: number, ry: number, a0: number, a1: number, steps = 24): Array<[number, number]> {
  const out: Array<[number, number]> = [];
  for (let i = 0; i <= steps; i++) {
    const a = a0 + ((a1 - a0) * i) / steps;
    out.push([cx + Math.cos(a) * rx, cy + Math.sin(a) * ry]);
  }
  return out;
}

/** 泉疗镇: three springs: over the north-west one, round the north-east one, round the south-east one. */
function spa(): Array<[number, number]> {
  const a = ellipse(37, 14, 9, 7.5, Math.PI, Math.PI * 2, 12);
  const c = ellipse(58, 13, 8, 6.5, Math.PI, Math.PI * 2.5, 18);
  const b = ellipse(51, 34, 11, 7.5, Math.PI * 1.5, Math.PI * -0.1, 20);
  return [[27, 24], ...a, ...c, ...b];
}

/** 印章城: lobes of a wave across the boulevard (north first), x0 → x1, `amp` tiles up and down from y 24. */
function wave(x0: number, x1: number, lobes: number, amp: number): Array<[number, number]> {
  const out: Array<[number, number]> = [];
  for (let i = 0; i <= lobes * 16; i++) {
    const t = i / (lobes * 16);
    out.push([x0 + (x1 - x0) * t, 24 - amp * Math.sin(Math.PI * lobes * t)]);
  }
  return out;
}

/** 电波塔: an inward spiral (clockwise from the west), turns rings apart. */
function spiral(cx: number, cy: number, rx0: number, ry0: number, rx1: number, ry1: number, turns: number): Array<[number, number]> {
  const out: Array<[number, number]> = [[27, 24]];
  const steps = Math.round(turns * 48);
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const a = Math.PI + t * turns * Math.PI * 2;
    out.push([cx + Math.cos(a) * (rx0 + (rx1 - rx0) * t), cy + Math.sin(a) * (ry0 + (ry1 - ry0) * t)]);
  }
  return out;
}

/** 议会堡: outside the moat from the west round the north, east and south, in over the south bridge, once round
 *  the keep's courtyard to the boss in the keep (the boss door stands in the middle, see DOOR_AT). */
function citadel(): Array<[number, number]> {
  const outer = ellipse(47, 24, 21, 18.5, Math.PI, Math.PI * 2.5, 30);
  const keep = ellipse(47, 24, 7.5, 5.5, Math.PI * 0.5, Math.PI * -1.2, 24);
  return [[27, 24], ...outer, [47, 35], ...keep];
}

/** 面具剧场: the flower gardens in rows (north), then the seat rows round the stage (south), outer then inner. */
function theatre(): Array<[number, number]> {
  const seats = ellipse(47, 42, 18, 14, Math.PI * 1.15, Math.PI * 1.85, 20);
  return [[27, 24], [27, 7], [64, 7], [64, 14], [33, 14], [31, 21], ...seats, [64, 27]];
}

/** 档案深处: a double spiral: in clockwise along one arm to the court, out along the other arm, ending east. */
function labyrinth(): Array<[number, number]> {
  const cx = 47;
  const cy = 24;
  const arm = (phase: number, inward: boolean) => {
    const pts: Array<[number, number]> = [];
    const n = 60;
    for (let i = 0; i <= n; i++) {
      const t = inward ? i / n : 1 - i / n;
      const r = 1 - t * 0.74;
      const a = phase + t * Math.PI * 2.2;
      pts.push([cx + Math.cos(a) * 20 * r, cy + Math.sin(a) * 18 * r]);
    }
    return pts;
  };
  return [[27, 24], ...arm(Math.PI, true), ...arm(0, false), [62, 24]];
}

const dist = (a: Pt, b: Pt) => Math.hypot(a.x - b.x, a.y - b.y);

/** Corners rounded off (two rounds of Chaikin's corner cutting, at most 2.5 tiles cut from a corner), so scenes
 *  spaced evenly along the route never squeeze together round a bend. The ends stay where they are. */
export function smooth(way: Array<[number, number]>): Pt[] {
  let pts = way.map(([x, y]) => ({ x, y }));
  for (let round = 0; round < 2; round++) {
    const out: Pt[] = [pts[0]];
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i];
      const b = pts[i + 1];
      const len = dist(a, b);
      const k = len ? Math.min(0.25, 2.5 / len) : 0;
      if (i > 0) out.push({ x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k });
      if (i < pts.length - 2) out.push({ x: b.x - (b.x - a.x) * k, y: b.y - (b.y - a.y) * k });
    }
    out.push(pts[pts.length - 1]);
    pts = out;
  }
  return pts;
}

/** Walk the smoothed route, dropping a scene whenever the straight distance from the last one
 *  reaches `step`. */
function drop(d: Pt[], step: number): Pt[] {
  const out = [d[0]];
  for (const p of d) if (dist(p, out[out.length - 1]) >= step) out.push(p);
  return out;
}

/** n scenes along the (smoothed) route, the first on its first waypoint, spaced by straight distance as widely as
 *  n scenes allow (so tight bends never squeeze two together); the last lands within a step of the route's end. */
export function along(way: Array<[number, number]>, n: number): Pt[] {
  const sm = smooth(way);
  const d: Pt[] = [];
  for (let i = 1; i < sm.length; i++) {
    const k = Math.max(1, Math.ceil(dist(sm[i - 1], sm[i]) * 8));
    for (let j = i === 1 ? 0 : 1; j <= k; j++) d.push({ x: sm[i - 1].x + ((sm[i].x - sm[i - 1].x) * j) / k, y: sm[i - 1].y + ((sm[i].y - sm[i - 1].y) * j) / k });
  }
  for (let step = 12; step >= 2; step -= 0.005) {
    const pts = drop(d, step);
    if (pts.length >= n) return toTiles(pts.slice(0, n));
  }
  return toTiles(drop(d, 2).slice(0, n));
}

/** Round to tiles, then nudge a scene by a tile where rounding brought it closer than its spacing to another. */
function toTiles(pts: Pt[]): Pt[] {
  const out = pts.map((p) => ({ x: Math.round(p.x), y: Math.round(p.y) }));
  const closest = (i: number, q: Pt) => {
    let m = Infinity;
    for (let j = 0; j < out.length; j++) if (j !== i) m = Math.min(m, dist(q, out[j]));
    return m;
  };
  for (let pass = 0; pass < 3; pass++)
    for (let i = 1; i < out.length; i++) {
      let best = out[i];
      let bestD = closest(i, best);
      if (bestD >= 4.6) continue;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
        const q = { x: Math.round(pts[i].x) + dx, y: Math.round(pts[i].y) + dy };
        if (dist(q, pts[i]) > 1.5) continue;
        const dd = closest(i, q);
        if (dd > bestD) (bestD = dd), (best = q);
      }
      out[i] = best;
    }
  return out;
}
