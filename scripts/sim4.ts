// 0.4 combat check against the real rules (combat.ts), mirroring the docs thread's sim05.py.
// Three players (accuracy by question tier, typing speed), per level: answers per kill, HP lost per kill,
// kills per minute; then how much of the kill-speed spread comes from German vs level/gear.
// Run: npx vite-node scripts/sim4.ts      Knobs: DMG=<monster dmgPct>, N=<fights per cell>
import { makeRng } from '../src/core/rng';
import { CONFIG } from '../src/core/config';
import { newGame, maxHp, type GameState } from '../src/core/state';
import { startBattle, makeQuestion, monsterStats, moveReady, needsPhase, phaseOf, qTier, resolveTurn, type Question } from '../src/core/combat';
import type { Article } from '../src/core/types';
import { makeItem } from '../src/core/loot';
import { WORDS } from '../src/data/words';
import { generateMap, isBlocked, walkableTilesIn, zonesOf, MAP_W, MAP_H, TILE, type RegionId } from '../src/game/map';
import { postFightHeal } from '../src/core/outcomes';
import { SCENES, routeTo, neighbours, SCENE_BY_ID } from '../src/data/world';
import type { Move } from '../src/core/types';

if (process.env.DMG) { const k = +process.env.DMG; const f = CONFIG.monster.dmgPct; CONFIG.monster.dmgPct = (l: number) => f(l) * k; }
const N = +(process.env.N ?? 300);
// More knobs: COMBO=<× combo bonus>, INS=<铭刻 ×>, GEAR=<dmg per tier>, ARM=<armor base>
if (process.env.COMBO) for (const c of CONFIG.combo) c.dmg *= +process.env.COMBO;
if (process.env.INS) CONFIG.tech.inscribeMult = +process.env.INS;
if (process.env.GEAR) CONFIG.gear.dmg = +process.env.GEAR;
if (process.env.ARM) CONFIG.armor.base = +process.env.ARM;
if (process.env.AFFRES) CONFIG.gear.affinityRes = +process.env.AFFRES;
let rng = makeRng(11);

type T = 'grind' | 'balance' | 'learn';
// pa = chance the first stance on a monster is right (词性三相, 0.5). PHASE=0: no stance picked (counts as wrong).
const TYPES: Record<T, { acc: [number, number, number]; tm: [number, number, number]; inscribe: boolean; whisper: boolean; pa: number }> = {
  grind: { acc: [0.9, 0.65, 0.4], tm: [1, 1.3, 1.3], inscribe: false, whisper: true, pa: 0.6 },
  balance: { acc: [0.95, 0.8, 0.65], tm: [1, 1, 1], inscribe: true, whisper: false, pa: +(process.env.PA ?? 0.85) },
  learn: { acc: [0.98, 0.93, 0.88], tm: [1, 0.85, 0.85], inscribe: true, whisper: false, pa: 0.97 },
};
const PHASE = process.env.PHASE !== '0';
const PHASE_SEC = 1.2; // picking a stance once per monster
const QT = [3, 6, 10];
const RESULT_DELAY = 1;
const WALK = 8;
const DEATH = 60;

let CLS: Record<T, 'writer' | 'guardian' | null> = { grind: null, balance: null, learn: null };
if (process.env.CLASSES) CLS = { grind: 'guardian', balance: 'writer', learn: 'writer' };
let cur: T = 'balance';
// 0.6 相亲和: AFF=der|die|das sets the amulet's affinity; GENDER=der|die|das keeps the field to one gender.
let AFF: string | undefined = process.env.AFF;
let GENDER: string | undefined = process.env.GENDER;
function player(L: number, G: number): GameState {
  const s = newGame('S', 'student', Date.now());
  s.level = L;
  if (L > 10) s.cls = CLS[cur];
  s.region = L > 10 ? 2 : 1;
  s.gearKills = { [String(s.region)]: CONFIG.gear.shardsPerTierSq * G * G };
  if (AFF) s.flags.affinity = AFF;
  s.equipped.dict = makeItem(rng, L, 'green', 'dict'); // 1 hint a fight (低语 without a class)
  for (const w of WORDS.filter((x) => x.lvl <= L)) s.words[w.id] = { stage: 1, due: 9e15, firstSeen: 0, lastSeen: 0, relapse: 0, correct: 1, wrong: 0 };
  return s;
}

/** One fight against a monster of level m. Returns answers, seconds, HP share lost, won. */
function fight(t: T, s: GameState, m: number, keepHp = false) {
  const P = TYPES[t];
  if (!keepHp) s.hp = maxHp(s);
  s.combo = 0;
  const pool = WORDS.filter((w) => Math.abs(w.lvl - m) <= 2 && w.family !== 'truhe' && w.pos !== 'phr' && (!GENDER || w.art === GENDER));
  const w = pool[Math.floor(rng() * pool.length)];
  // Half the field is new words, half words you have met.
  const known = rng() < 0.5;
  const saved = s.words[w.id];
  if (!known) delete s.words[w.id];
  const b = startBattle(s, w, rng);
  const st = monsterStats(m, b.stage, b.kind, 0);
  b.monster.lvl = m;
  b.monster.hp = b.monster.maxHp = st.hp;
  b.monster.dmg = st.dmg;
  let qs = 0;
  let sec = WALK;
  b.pluralMon = false; // the sim's monster stats are set by hand above
  const tried: Article[] = [];
  const pickPhase = () => {
    const right = phaseOf(b)!;
    const left = (['der', 'die', 'das'] as Article[]).filter((p) => !tried.includes(p));
    const p = tried.length === 0 ? (rng() < P.pa ? right : left.filter((x) => x !== right)[Math.floor(rng() * 2)]) : left.includes(right) && rng() < 1 / Math.max(1, left.length) ? right : left[Math.floor(rng() * left.length)];
    b.phase = p;
    tried.push(p);
  };
  if (PHASE && needsPhase(b)) {
    pickPhase();
    sec += PHASE_SEC;
  }
  while (!b.outcome && qs < 60) {
    // 格位姿态: a line in another case cleared the stance — pick again (fresh, by the player's accuracy).
    if (PHASE && needsPhase(b) && !b.phase) {
      tried.length = 0;
      pickPhase();
      sec += PHASE_SEC;
    }
    let move: Move = 'attack';
    let q: Question = makeQuestion(s, b, 'attack', rng);
    if (moveReady(s, b, 'sentence')) {
      move = 'sentence';
      q = makeQuestion(s, b, move, rng);
    } else if (P.inscribe && s.level >= 6 && moveReady(s, b, 'inscribe') && qTier(q) < 2) {
      move = 'inscribe';
      q = makeQuestion(s, b, move, rng);
    } else if (P.whisper && qTier(q) > 0 && moveReady(s, b, 'whisper')) {
      move = 'whisper';
      q = makeQuestion(s, b, move, rng);
    }
    const tier = qTier(q);
    const acc = Math.min(0.99, P.acc[tier] + (q.whispered ? 0.25 : 0));
    const right = rng() < acc;
    const ans = right ? (q.answer ?? '') : 'zzz';
    // The result screen waits about 1 s after a clean hit and 2.6 s when there is a correction to read (battle.ts).
    sec += QT[tier] * P.tm[tier] + (right ? RESULT_DELAY : 2.6);
    const r = resolveTurn(s, b, move, q, ans, rng);
    qs++;
    if (r.phase === 'soft') b.phase = phaseOf(b)!; // Lv1–5: told the right one
    else if (r.phase === 'wrong') {
      pickPhase();
      sec += PHASE_SEC;
    }
  }
  if (saved) s.words[w.id] = saved;
  const won = b.outcome === 'win';
  return { qs, sec: sec + (won ? 0 : DEATH), lost: Math.min(1, (maxHp(s) - Math.max(0, s.hp)) / maxHp(s)), won };
}

function cell(t: T, L: number, G: number, m = L) {
  cur = t;
  let q = 0, sec = 0, lost = 0, wins = 0;
  let s = player(L, G);
  for (let i = 0; i < N; i++) {
    // A session of 20 fights: combo and the 铭刻 cooldown carry over, like real play between bonfires.
    if (i % 20 === 0) s = player(L, G);
    const r = fight(t, s, m);
    q += r.qs; sec += r.sec; lost += r.lost; wins += r.won ? 1 : 0;
  }
  return { q: q / N, lost: lost / N, win: wins / N, kpm: (wins / sec) * 60 };
}

// Gear per level roughly as in sim05's balance column (tier resets in region 2).
const gearAt = (L: number) => (L <= 1 ? 0 : L <= 7 ? 1 + Math.floor((L - 2) / 3) : L <= 10 ? 3 : L <= 12 ? L - 10 : L <= 14 ? 3 : L <= 18 ? 4 + (L >= 18 ? 1 : 0) : 5);

// MAP=1 (0.5 block 5 baseline): an hour of play on the real 0.4 map. The player walks the shortest tile path
// (SPEED 72 px/s) to the nearest monster in the field for their level; a dead slot refills 9–15 s later at a
// tile at least 90 px away; after each kill +15% HP (postFightHeal); below REST of max HP they walk to the
// bonfire, rest 3 s and walk back; a death costs DEATH s and wakes them at the bonfire.
// Counts: encounters per hour, monster level − player level, fights between bonfire visits, walk share.
if (process.env.MAP) {
  const SPEED = 72, REST = +(process.env.REST ?? 0.35), HOUR = +(process.env.HOURS ?? 1) * 3600;
  const range = (lv: string) => { const m = /(\d+)–(\d+)/.exec(lv); return m ? [+m[1], +m[2]] : null; };
  const run = (t: T, L: number) => {
    cur = t;
    const region: RegionId = L > 10 ? 2 : 1;
    const map = generateMap(region);
    const fields = zonesOf(region).filter((z) => z.monsters && range(z.levels));
    const z = fields.filter((f) => range(f.levels)![0] <= L && L <= range(f.levels)![1]).sort((a, b) => range(b.levels)![0] - range(a.levels)![0])[0] ?? fields[0];
    const tiles = walkableTilesIn(map, z.rect);
    const words = WORDS.filter((w) => w.zone === z.id && w.family !== 'truhe');
    const cap = L + CONFIG.monster.maxAbove(L);
    const bfs = (sx: number, sy: number) => {
      const d = new Int32Array(MAP_W * MAP_H).fill(-1);
      const q = [sx + sy * MAP_W]; d[q[0]] = 0;
      for (let i = 0; i < q.length; i++) {
        const c = q[i], x = c % MAP_W, y = (c / MAP_W) | 0;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nx = x + dx, ny = y + dy, n = nx + ny * MAP_W;
          if (!isBlocked(map, nx, ny) && d[n] < 0) { d[n] = d[c] + 1; q.push(n); }
        }
      }
      return d;
    };
    const bon = (() => { for (const [dx, dy] of [[0, 1], [1, 0], [0, -1], [-1, 0]]) if (!isBlocked(map, map.bonfire.x + dx, map.bonfire.y + dy)) return { x: map.bonfire.x + dx, y: map.bonfire.y + dy }; return map.bonfire; })();
    const dBon = bfs(bon.x, bon.y);
    const pick = () => { const w = words[Math.floor(rng() * words.length)]; return Math.min(w.lvl, cap); };
    const place = (px: number, py: number) => { for (let k = 0; k < 20; k++) { const c = tiles[Math.floor(rng() * tiles.length)]; if (Math.hypot(c.x - px, c.y - py) * TILE > 90 && dBon[c.x + c.y * MAP_W] >= 0) return c; } return tiles[0]; };
    let me = { ...bon };
    const mons: Array<{ x: number; y: number; m: number; at: number }> = [];
    for (let i = 0; i < z.monsters; i++) { const c = place(me.x, me.y); mons.push({ ...c, m: pick(), at: 0 }); }
    const s = player(L, gearAt(L));
    s.hp = maxHp(s);
    let clock = 0, walk = 0, fights = 0, rests = 0, sinceRest = 0, deaths = 0;
    const gaps: number[] = [], runs: number[] = [];
    while (clock < HOUR) {
      const d = bfs(me.x, me.y);
      const ready = mons.filter((o) => o.at <= clock && d[o.x + o.y * MAP_W] >= 0);
      if (!ready.length) { const next = Math.min(...mons.map((o) => o.at)); clock = Math.max(clock + 0.5, next); continue; }
      ready.sort((a, b) => d[a.x + a.y * MAP_W] - d[b.x + b.y * MAP_W]);
      const o = ready[0];
      const wsec = Math.max(0, d[o.x + o.y * MAP_W] * TILE - 11) / SPEED;
      clock += wsec; walk += wsec;
      const r = fight(t, s, o.m, true);
      clock += r.sec - WALK;
      fights++; sinceRest++;
      gaps.push(o.m - L);
      const c = place(o.x, o.y);
      Object.assign(o, c, { m: pick(), at: clock + 9 + rng() * 6 });
      me = { x: o.x, y: o.y };
      if (!r.won) { deaths++; s.hp = maxHp(s); runs.push(sinceRest); sinceRest = 0; me = { ...bon }; continue; }
      postFightHeal(s);
      if (s.hp < REST * maxHp(s)) {
        const back = (dBon[me.x + me.y * MAP_W] * TILE) / SPEED;
        clock += 2 * back + 3; walk += 2 * back; rests++;
        s.hp = maxHp(s); runs.push(sinceRest); sinceRest = 0;
      }
    }
    if (sinceRest) runs.push(sinceRest);
    const hist: Record<string, number> = {};
    for (const g of gaps) hist[g] = (hist[g] ?? 0) + 1;
    const share = Object.entries(hist).sort((a, b) => +a[0] - +b[0]).map(([k, v]) => `${+k >= 0 ? '+' : ''}${k}:${Math.round((100 * v) / gaps.length)}%`).join(' ');
    const perBonfire = rests ? (fights / (rests + deaths)).toFixed(0) : `>${fights}`;
    return `${t.padEnd(7)} L${String(L).padStart(2)} ${z.id.padEnd(15)} ${(fights / (HOUR / 3600)).toFixed(0).padStart(3)} fights/h · walk ${((100 * walk) / clock).toFixed(0)}% (${(walk / fights).toFixed(1)} s/fight) · per bonfire ${perBonfire} · deaths ${deaths} · lvl ${share}`;
  };
  // NODES=1: the same hour on the 0.5 scene map. Clear the scene you stand in (one click ≈ CLICK s per fight),
  // then step (CONFIG.map.hopSec) to the neighbouring scene of the field with most monsters; refills never land
  // in the scene you stand in; the bonfire is a route of hops to the hub.
  const runNodes = (t: T, L: number) => {
    cur = t;
    const CLICK = +(process.env.CLICK ?? 0.5), HOP = CONFIG.map.hopSec;
    const region: RegionId = L > 10 ? 2 : 1;
    const fields = zonesOf(region).filter((z) => z.monsters && range(z.levels));
    const z = fields.filter((f) => range(f.levels)![0] <= L && L <= range(f.levels)![1]).sort((a, b) => range(b.levels)![0] - range(a.levels)![0])[0] ?? fields[0];
    const words = WORDS.filter((w) => w.zone === z.id && w.family !== 'truhe');
    const cap = L + CONFIG.monster.maxAbove(L);
    const pick = () => { const w = words[Math.floor(rng() * words.length)]; return Math.min(w.lvl, cap); };
    const scenes = SCENES.filter((x) => x.region === region && x.zone === z.id && !x.hiddenBy);
    const hub = SCENES.find((x) => x.region === region && x.bonfire)!;
    type Slot = { m: number; at: number; sc: string };
    const slots: Slot[] = scenes.flatMap((sc) => Array.from({ length: sc.slots ?? CONFIG.map.slots }, () => ({ m: pick(), at: 0, sc: sc.id })));
    let here = scenes[0].id;
    const s = player(L, gearAt(L));
    s.hp = maxHp(s);
    let clock = 0, walk = 0, fights = 0, rests = 0, sinceRest = 0, deaths = 0;
    const gaps: number[] = [];
    const hops = (a: string, b: string) => routeTo(a, b)!.length;
    clock += hops(hub.id, here) * HOP; walk += hops(hub.id, here) * HOP;
    while (clock < HOUR) {
      const ready = slots.filter((o) => o.sc === here && o.at <= clock);
      if (!ready.length) {
        // Move to the field scene (adjacent first) with the most monsters standing.
        const score = (sc: string) => slots.filter((o) => o.sc === sc && o.at <= clock + hops(here, sc) * HOP).length - 0.01 * hops(here, sc);
        const best = scenes.map((x) => x.id).filter((x) => x !== here).sort((a, b) => score(b) - score(a))[0];
        if (score(best) < 1) { clock += 1; continue; }
        const d = hops(here, best) * HOP;
        clock += d; walk += d; here = best;
        continue;
      }
      const o = ready[0];
      clock += CLICK; walk += CLICK;
      const r = fight(t, s, o.m, true);
      clock += r.sec - WALK;
      fights++; sinceRest++;
      gaps.push(o.m - L);
      // Refill: 9–15 s later into a field scene you are not standing in (re-rolled on arrival if needed).
      const others = scenes.filter((x) => x.id !== here).map((x) => x.id);
      // 0.6 场景记忆法: a word only refills into its own scene (not the one you stand in, not a full one).
      let sc = others[Math.floor(rng() * others.length)];
      if (CONFIG.map.homeScenes) {
        const cap = (id: string) => (SCENES.find((x) => x.id === id)!.slots ?? CONFIG.map.slots);
        const room = others.filter((id) => slots.filter((q) => q !== o && q.sc === id).length < cap(id));
        const homes = words.map((w) => scenes.find((x) => x.words?.includes(w.id))?.id).filter((id): id is string => !!id && room.includes(id));
        if (homes.length) sc = homes[Math.floor(rng() * homes.length)];
        else if (room.length) sc = room[0];
      }
      Object.assign(o, { m: pick(), at: clock + 9 + rng() * 6, sc });
      if (!r.won) { deaths++; s.hp = maxHp(s); sinceRest = 0; const d = hops(hub.id, here) * HOP; clock += d; walk += d; continue; }
      postFightHeal(s);
      if (s.hp < REST * maxHp(s)) {
        const d = 2 * hops(here, hub.id) * HOP;
        clock += d + 3; walk += d; rests++;
        s.hp = maxHp(s); sinceRest = 0;
      }
    }
    const hist: Record<string, number> = {};
    for (const g of gaps) hist[g] = (hist[g] ?? 0) + 1;
    const share = Object.entries(hist).sort((a, b) => +a[0] - +b[0]).map(([k, v]) => `${+k >= 0 ? '+' : ''}${k}:${Math.round((100 * v) / gaps.length)}%`).join(' ');
    const perBonfire = rests ? (fights / (rests + deaths)).toFixed(0) : `>${fights}`;
    return `${t.padEnd(7)} L${String(L).padStart(2)} ${z.id.padEnd(15)} ${(fights / (HOUR / 3600)).toFixed(0).padStart(3)} fights/h · move ${((100 * walk) / clock).toFixed(0)}% (${(walk / fights).toFixed(1)} s/fight) · per bonfire ${perBonfire} · deaths ${deaths} · lvl ${share}`;
  };
  const nodes = !!process.env.NODES;
  console.log(`${nodes ? '0.5 scene map' : '0.4 map baseline'} (REST ${REST * 100}% HP, ${HOUR / 3600} h per row)`);
  const LVS = process.env.LVS ? process.env.LVS.split(',').map(Number) : [2, 4, 6, 8, 12, 15, 18];
  for (const L of LVS) for (const t of ['grind', 'balance', 'learn'] as T[]) console.log(nodes ? runNodes(t, L) : run(t, L));
  process.exit(0);
}

if (process.env.AFFCMP) {
  // Same field, questions per kill: plain amulet vs each affinity (mixed field), then one-gender fields matched vs not.
  for (const L of [9, 12, 15, 18]) {
    const G = gearAt(L);
    const m = L + 1;
    const K = process.env.AFFCMP === 'kpm';
    const q = (aff?: string, g?: string) => { AFF = aff; GENDER = g; rng = makeRng(7); const c = cell('balance', L, G, m); return K ? 60 / c.kpm : c.q; };
    const plain = q();
    const mixed = ['der', 'die', 'das'].map((a) => `${a} ${(q(a) - plain).toFixed(2)}`).join(' ');
    const one = ['der', 'die', 'das'].map((g) => { const p = q(undefined, g); const r = q(g, g); const w = q(g === 'der' ? 'das' : 'der', g); return `${g}: plain ${p.toFixed(2)} right ${(r - p).toFixed(2)} wrong ${(w - p).toFixed(2)}`; }).join(' | ');
    console.log(`L${L} G${G} vs Lv${m} plain ${plain.toFixed(2)} ${K ? 's' : 'q'}/kill · mixed field Δ ${mixed}\n    ${one}`);
  }
  process.exit(0);
}

if (process.env.CMP) {
  for (const L of [8, 13, 18]) {
    const G = gearAt(L);
    const row = (['grind', 'balance', 'learn'] as T[]).map((t) => { const c = cell(t, L, G); return `${t} ${(60 / c.kpm).toFixed(1)}s`; });
    console.log(`L${L} sec/kill: ${row.join(' · ')}`);
  }
  process.exit(0);
}
console.log(`monster dmgPct Lv1 ${CONFIG.monster.dmgPct(1)} / Lv10 ${CONFIG.monster.dmgPct(10)}, N=${N}`);
console.log(' L  G | grind q/kill hp% win | balance q/kill hp% win | learn q/kill hp% win');
for (const L of [1, 3, 5, 6, 8, 10, 11, 13, 15, 18, 20]) {
  const G = gearAt(L);
  const row = (['grind', 'balance', 'learn'] as T[]).map((t) => {
    const c = cell(t, L, G);
    return `${c.q.toFixed(1).padStart(4)} ${(c.lost * 100).toFixed(0).padStart(3)}% ${(c.win * 100).toFixed(0).padStart(3)}%`;
  });
  console.log(`${String(L).padStart(2)} ${String(G).padStart(2)} | ${row.join('        | ')}`);
}

// German share of kill-speed differences (two-way, like sim04/05): L16 G1, L18 G3, L20 G5 against a Lv18 monster.
const powers: Array<[number, number]> = [[16, 1], [18, 3], [20, 5]];
const types: T[] = ['grind', 'balance', 'learn'];
const grid = new Map<string, number>();
for (const t of types) for (const [L, G] of powers) grid.set(`${t}/${L}`, cell(t, L, G, 18).kpm);
const all = [...grid.values()];
const mu = all.reduce((a, b) => a + b, 0) / all.length;
const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
const ssg = 3 * types.reduce((a, t) => a + (mean(powers.map(([L]) => grid.get(`${t}/${L}`)!)) - mu) ** 2, 0);
const ssp = 3 * powers.reduce((a, [L]) => a + (mean(types.map((t) => grid.get(`${t}/${L}`)!)) - mu) ** 2, 0);
console.log('\nkills/min vs Lv18:', Object.fromEntries([...grid].map(([k, v]) => [k, +v.toFixed(2)])));
console.log(`German share ${((100 * ssg) / (ssg + ssp)).toFixed(0)}%`);
const g18 = grid.get('grind/18')!, b18 = grid.get('balance/18')!, l18 = grid.get('learn/18')!;
console.log(`same power (L18 G3): grind ${g18.toFixed(2)} · balance ${b18.toFixed(2)} · learn ${l18.toFixed(2)} kills/min → balance/grind ×${(b18 / g18).toFixed(2)}`);
