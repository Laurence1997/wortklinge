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
import type { Move } from '../src/core/types';

if (process.env.DMG) { const k = +process.env.DMG; const f = CONFIG.monster.dmgPct; CONFIG.monster.dmgPct = (l: number) => f(l) * k; }
const N = +(process.env.N ?? 300);
// More knobs: COMBO=<× combo bonus>, INS=<铭刻 ×>, GEAR=<dmg per tier>, ARM=<armor base>
if (process.env.COMBO) for (const c of CONFIG.combo) c.dmg *= +process.env.COMBO;
if (process.env.INS) CONFIG.tech.inscribeMult = +process.env.INS;
if (process.env.GEAR) CONFIG.gear.dmg = +process.env.GEAR;
if (process.env.ARM) CONFIG.armor.base = +process.env.ARM;
const rng = makeRng(11);

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
function player(L: number, G: number): GameState {
  const s = newGame('S', 'student', Date.now());
  s.level = L;
  if (L > 10) s.cls = CLS[cur];
  s.region = L > 10 ? 2 : 1;
  s.gearKills = { [String(s.region)]: CONFIG.gear.shardsPerTierSq * G * G };
  s.equipped.dict = makeItem(rng, L, 'green', 'dict'); // 1 hint a fight (低语 without a class)
  for (const w of WORDS.filter((x) => x.lvl <= L)) s.words[w.id] = { stage: 1, due: 9e15, firstSeen: 0, lastSeen: 0, relapse: 0, correct: 1, wrong: 0 };
  return s;
}

/** One fight against a monster of level m. Returns answers, seconds, HP share lost, won. */
function fight(t: T, s: GameState, m: number) {
  const P = TYPES[t];
  s.hp = maxHp(s);
  s.combo = 0;
  const pool = WORDS.filter((w) => Math.abs(w.lvl - m) <= 2 && w.family !== 'truhe' && w.pos !== 'phr');
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
