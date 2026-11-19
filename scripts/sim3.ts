// Leveling-time check for curve 2 (first day, region 1): how long to Lv5 and Lv10?
// Run: npx vite-node scripts/sim3.ts
// Model: real fights (combat code), real XP (applyWin). Time per fight = answers × seconds per
// answer + walking. First day: no reviews are due yet, so after 30 new words (言灵过载) the field is
// mostly shadows (8 XP) with 1 in 4 new monsters at half XP.
import { makeRng } from '../src/core/rng';
import { newGame, maxHp } from '../src/core/state';
import { startBattle, makeQuestion, resolveTurn, availableMoves } from '../src/core/combat';
import { applyWin } from '../src/core/outcomes';
import { COUNTER } from '../src/core/intents';
import { WORDS } from '../src/data/words';
import type { ZoneId } from '../src/core/types';

const ZONE_BY_LEVEL: Array<[number, ZoneId]> = [[1, 'echogasse'], [4, 'schilderstrasse'], [7, 'aschehof']];
const zoneFor = (lvl: number) => [...ZONE_BY_LEVEL].reverse().find(([l]) => lvl >= l)![1];

function run(acc: number, secChoice: number, secTyped: number, walk: number, seed: number) {
  const rng = makeRng(seed);
  const s = newGame('S', 'student', Date.UTC(2026, 10, 19, 8));
  let t = 0;
  const reached: Record<number, number> = {};
  while (s.level < 10 && t < 8 * 3600) {
    const zone = zoneFor(s.level);
    const pool = WORDS.filter((w) => w.zone === zone && w.family !== 'truhe' && (s.level >= 2 || w.art));
    const fresh = pool.filter((w) => !s.words[w.id]);
    const capped = s.daily.newCount >= 30;
    const wantNew = fresh.length && (!capped || rng() < 0.25);
    const known = pool.filter((w) => s.words[w.id]);
    const w = wantNew || !known.length ? (fresh[0] ?? pool[0]) : known[Math.floor(rng() * known.length)];
    s.hp = Math.max(s.hp, Math.round(maxHp(s) * 0.7));
    const b = startBattle(s, w, rng);
    let g = 0;
    while (!b.outcome && g++ < 40) {
      const moves = availableMoves(s, b);
      let mv = COUNTER[b.intent.kind] as never;
      if (!moves.includes(mv)) mv = 'attack' as never;
      const q = makeQuestion(s, b, mv, rng);
      let ans = q.answer ?? 'Ich möchte einen Tee.';
      if (q.type === 'sentence') s.words['tee'] ??= { stage: 1, due: 9e15, firstSeen: 0, lastSeen: 0, relapse: 0, correct: 0, wrong: 0 };
      if (rng() > acc) ans = 'zzz';
      resolveTurn(s, b, mv, q, ans, rng);
      t += q.options ? secChoice : secTyped;
    }
    t += walk;
    if (b.outcome === 'win') applyWin(s, b, rng);
    else s.hp = maxHp(s); // died: back at the bonfire
    for (const L of [5, 10]) if (s.level >= L && reached[L] === undefined) reached[L] = t / 60;
  }
  return reached;
}

for (const [label, acc, sc, st, walk] of [
  ['beginner (75%, slow)', 0.75, 6, 12, 15],
  ['average (85%)', 0.85, 5, 9, 12],
  ['fluent (95%, fast)', 0.95, 3, 6, 10],
] as const) {
  const r5: number[] = [];
  const r10: number[] = [];
  for (let i = 0; i < 20; i++) {
    const r = run(acc, sc, st, walk, 100 + i);
    r5.push(r[5] ?? NaN);
    r10.push(r[10] ?? NaN);
  }
  const avg = (a: number[]) => (a.reduce((x, y) => x + y, 0) / a.length).toFixed(0);
  console.log(`${label}: Lv5 at ${avg(r5)} min, Lv10 at ${avg(r10)} min (field only, no duel/boss/quests)`);
}
