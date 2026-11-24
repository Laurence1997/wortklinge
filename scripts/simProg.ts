// Whole-run progression check (2026-11-24, 归名一天内 + 语境复习): a player from Lv1 through region 3 on the real
// state rules — pickSpawns, startBattle, makeQuestion (语境复习 questions included), resolveTurn, applyWin (归名,
// XP, 斩杀). One monster at a time (no packs, rares, elites). Plays HOURS_PER_DAY a day, then the clock jumps to the
// next day. Field: the highest one of the current region the level allows; region 2 from Lv11, region 3 from Lv21.
// Reports per region: hours played, level on leaving, level when every word of the region was 归名 (or retired),
// kills per word, and what the slots held (own new / learning respawns / review monsters / backfill).
// Run: npx vite-node scripts/simProg.ts      Knobs: TYPE=grind|balance|learn (default all), HPD=<hours a day>
import { makeRng } from '../src/core/rng';
import { CONFIG, DAY, HOUR } from '../src/core/config';
import { newGame, maxHp, type GameState } from '../src/core/state';
import { bonfireRefill, count as itemCount, grantStarter, rollItemDrops } from '../src/core/items';
import { canHint, hintOf, ITEM_TURN, makeQuestion, moveReady, needsPhase, phaseOf, qTier, resolveTurn, startBattle, type Question } from '../src/core/combat';
import { applyWin } from '../src/core/outcomes';
import { pickSpawns, zoneWords, type SpawnPick } from '../src/core/spawn';
import { stageOf } from '../src/core/srs';
import { WORDS } from '../src/data/words';
import { zonesOf, type RegionId } from '../src/game/map';
import type { Article, Move, Word } from '../src/core/types';

type T = 'grind' | 'balance' | 'learn';
const TYPES: Record<T, { acc: [number, number, number]; tm: [number, number, number]; inscribe: boolean; whisper: boolean; pa: number }> = {
  grind: { acc: [0.9, 0.65, 0.4], tm: [1, 1.3, 1.3], inscribe: false, whisper: true, pa: 0.6 },
  balance: { acc: [0.95, 0.8, 0.65], tm: [1, 1, 1], inscribe: true, whisper: false, pa: 0.85 },
  learn: { acc: [0.98, 0.93, 0.88], tm: [1, 0.85, 0.85], inscribe: true, whisper: false, pa: 0.97 },
};
const QT = [3, 6, 10];
const WALK = 8; // moving + clicking per fight (scene map)
const DEATH = 60;
const HPD = +(process.env.HPD ?? 4) * HOUR;
const T0 = new Date('2026-12-01T08:00:00').getTime();
const range = (lv: string) => { const m = /(\d+)–(\d+)/.exec(lv); return m ? [+m[1], +m[2]] : null; };

function run(t: T, seed: number) {
  const P = TYPES[t];
  const rng = makeRng(seed);
  const s: GameState = newGame('S', 'student', T0);
  s.flags.brotDone = true;
  grantStarter(s);
  let clock = T0; // game time
  let played = 0; // seconds actually played
  let dayPlayed = 0;
  let idle = 0; // empty field: nothing to fight (not counted as play)
  const setNow = () => (s.timeOffset = clock - Date.now());
  const regionOf = (L: number): RegionId => (L >= 21 ? 3 : L >= 11 ? 2 : 1);
  type Reg = { idle: number; start: number; hours: number; leaveLvl: number; clearLvl: number | null; clearHours: number | null; kills: number; slot: Record<string, number> };
  const reg: Record<number, Reg> = {};
  const slots: Record<string, SpawnPick[]> = {};
  let fights = 0;
  const lvAt: Record<number, number> = {};
  let capAt = 0;
  while (s.level < 30 || !reg[3]?.clearLvl) {
    if (played + idle > 400 * 3600) break;
    const region = regionOf(s.level);
    s.region = region;
    reg[region] ??= { idle: 0, start: played, hours: 0, leaveLvl: 0, clearLvl: null, clearHours: null, kills: 0, slot: {} };
    const R = reg[region];
    const fields = zonesOf(region).filter((z) => z.monsters && range(z.levels));
    const z = fields.filter((f) => range(f.levels)![0] <= s.level).sort((a, b) => range(b.levels)![0] - range(a.levels)![0])[0] ?? fields[0];
    setNow();
    // A field holds z.monsters slots; an empty one is refilled from pickSpawns (respawns are due words).
    const list = (slots[z.id] ??= []);
    if (!list.length) {
      const alive = new Set<string>();
      list.push(...pickSpawns(s, z.id, z.monsters, alive, rng, { phraseOk: false }));
      if (!list.length) { clock += 60_000; idle += 60; dayPlayed += 60; R.idle += 60; continue; }
    }
    const pk = list.shift()!;
    const w = pk.word;
    const own = (w.region ?? 1) === region;
    const cat = !own ? 'backfill: next region' : pk.kind === 'new' ? 'new' : stageOf(s, w) >= 3 || !!s.words[w.id]?.retired ? 'backfill: crowd/verify' : s.words[w.id]?.lapsed || w.zone !== z.id ? 'review monster' : pk.kind === 'due' ? 'learning respawn' : 'shadow';
    R.slot[cat] = (R.slot[cat] ?? 0) + 1;
    const r = fight(s, w, P, rng);
    fights++;
    const sec = r.sec + WALK;
    clock += sec * 1000; played += sec; dayPlayed += sec;
    if (r.won) {
      R.kills++;
      rollItemDrops(s, rng);
    } else { s.hp = maxHp(s); clock += DEATH * 1000; played += DEATH; dayPlayed += DEATH; }
    if (s.hp < maxHp(s) * 0.35) { s.hp = maxHp(s); bonfireRefill(s); clock += 30_000; played += 30; dayPlayed += 30; }
    // The region's words all 归名 (or retired)?
    if (!R.clearLvl) {
      const ws = WORDS.filter((x) => (x.region ?? 1) === region && x.family !== 'truhe' && !x.tutorial && x.pos !== 'phr');
      if (fights % 25 === 0 && ws.every((x) => stageOf(s, x) >= 3)) { R.clearLvl = s.level; R.clearHours = (played - R.start) / 3600; }
    }
    if (!lvAt[s.level]) lvAt[s.level] = played / 3600;
    if (s.level >= 30 && !capAt) capAt = played;
    R.hours = (played - R.start) / 3600;
    R.leaveLvl = s.level;
    if (dayPlayed >= HPD) { clock += DAY - dayPlayed * 1000; dayPlayed = 0; for (const k of Object.keys(slots)) slots[k] = []; }
    if (capAt && played - capAt > 20 * 3600) break;
  }
  const words = (r: number) => WORDS.filter((x) => (x.region ?? 1) === r && x.family !== 'truhe' && !x.tutorial).length;
  const out: string[] = [];
  for (const [k, R] of Object.entries(reg)) {
    const tot = Object.values(R.slot).reduce((a, b) => a + b, 0);
    const mix = Object.entries(R.slot).sort((a, b) => b[1] - a[1]).map(([c, n]) => `${c} ${Math.round((100 * n) / tot)}%`).join(', ');
    const named = WORDS.filter((x) => (x.region ?? 1) === +k && x.family !== 'truhe' && !x.tutorial && stageOf(s, x) >= 3).length;
    out.push(`  region ${k}: ${R.hours.toFixed(1)} h (+${(R.idle / 3600).toFixed(1)} h waiting on an empty field) · Lv on leaving ${R.leaveLvl} · all words 归名 ${R.clearLvl ? `at Lv${R.clearLvl} after ${R.clearHours!.toFixed(1)} h` : `not yet (${named}/${words(+k)} at the end)`} · ${(R.kills / words(+k)).toFixed(1)} kills/word · slots: ${mix}`);
  }
  const lv = [5, 10, 11, 15, 20, 21, 25, 30].map((l) => `Lv${l} ${lvAt[l]?.toFixed(1) ?? '-'}h`).join(' · ');
  return `${t} (${(played / 3600).toFixed(1)} h incl. 20 h after the cap, ${fights} fights)\n  reached: ${lv}\n${out.join('\n')}`;
}

function fight(s: GameState, w: Word, P: (typeof TYPES)[T], rng: () => number) {
  s.combo = 0;
  const b = startBattle(s, w, rng);
  let sec = 0, qs = 0;
  const tried: string[] = [];
  const pickPhase = () => {
    const right = phaseOf(b)! as string;
    const all = b.perfekt ? ['haben', 'sein'] : ['der', 'die', 'das'];
    const left = all.filter((p) => !tried.includes(p));
    const wrong = left.filter((x) => x !== right);
    const p = tried.length === 0 ? (rng() < P.pa ? right : wrong[Math.floor(rng() * wrong.length)] ?? right) : left.includes(right) && rng() < 1 / Math.max(1, left.length) ? right : left[Math.floor(rng() * left.length)] ?? right;
    b.phase = p as Article;
    tried.push(p);
    sec += 1.2;
  };
  while (!b.outcome && qs < 60) {
    if (needsPhase(b) && !b.phase) { tried.length = 0; pickPhase(); }
    if (s.hp < maxHp(s) * 0.3 && itemCount(s, 'tablet') > 0) {
      s.flags.invTablet = itemCount(s, 'tablet') - 1;
      s.hp = Math.min(maxHp(s), s.hp + Math.round(maxHp(s) * CONFIG.items.tabletHeal));
      resolveTurn(s, b, 'item', ITEM_TURN, '', rng);
      sec += 2;
      continue;
    }
    let move: Move = 'attack';
    let q: Question = makeQuestion(s, b, 'attack', rng);
    if (!q.review && moveReady(s, b, 'sentence')) { move = 'sentence'; q = makeQuestion(s, b, move, rng); }
    else if (!q.review && P.inscribe && s.level >= 6 && moveReady(s, b, 'inscribe') && qTier(q) < 2) { move = 'inscribe'; q = makeQuestion(s, b, move, rng); }
    else if (P.whisper && qTier(q) > 0 && canHint(s, b, 'attack', q)) { move = 'whisper'; q = hintOf(b, q); s.flags.invHint = itemCount(s, 'hint') - 1; }
    const tier = qTier(q);
    const right = rng() < Math.min(0.99, P.acc[tier] + (q.whispered ? 0.25 : 0));
    sec += QT[tier] * P.tm[tier] + (right ? 1 : 2.6);
    const r = resolveTurn(s, b, move, q, right ? q.answer ?? '' : 'zzz', rng);
    qs++;
    if (r.phase === 'soft') b.phase = phaseOf(b)! as Article;
    else if (r.phase === 'wrong') pickPhase();
  }
  const won = b.outcome === 'win';
  if (won) applyWin(s, b, rng);
  return { won, sec: sec + (won ? 0 : DEATH), qs };
}

const types: T[] = process.env.TYPE ? [process.env.TYPE as T] : ['grind', 'balance', 'learn'];
console.log(`progression sim · ${HPD / HOUR} h a day · respawn ${(CONFIG.srs as { respawn?: number }).respawn ? `${(CONFIG.srs as { respawn: number }).respawn / 60000} min` : 'old 16h/40h'}`);
for (const t of types) console.log(run(t, 7));
void zoneWords;
process.exit(0);
