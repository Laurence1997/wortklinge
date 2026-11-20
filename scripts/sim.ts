// Balance check: simulate fights at each level with a given accuracy.
// Run: npx vite-node scripts/sim.ts
import { makeRng } from '../src/core/rng';
import { CONFIG } from '../src/core/config';
// Tuning knobs for trying values without editing config: HPM (monster HP ×), DMGM (monster damage ×).
if (process.env.HPM) CONFIG.monster.hp1 *= +process.env.HPM;
if (process.env.DMGM) { const f = CONFIG.monster.dmgPct, k = +process.env.DMGM; CONFIG.monster.dmgPct = (l: number) => f(l) * k; }
import { newGame, maxHp } from '../src/core/state';
import { startBattle, makeQuestion, resolveTurn, availableMoves } from '../src/core/combat';
import { COUNTER } from '../src/core/intents';
import { WORDS } from '../src/data/words';

const rng = makeRng(42);
for (const acc of (process.env.ACC ? [Number(process.env.ACC)] : [0.95, 0.8, 0.75, 0.65])) {
  console.log(`\naccuracy ${acc * 100}%`);
  for (const [lvl, zone] of [[1, 'echogasse'], [3, 'echogasse'], [4, 'schilderstrasse'], [6, 'schilderstrasse'], [7, 'aschehof'], [9, 'aschehof']] as const) {
    const pool = WORDS.filter((w) => w.zone === zone);
    let turns = 0, fights = 0, deaths = 0, hpLost = 0;
    for (let f = 0; f < 400; f++) {
      const s = newGame('S', 'student', Date.now());
      s.level = lvl;
      s.hp = maxHp(s);
      // HP carried over from a few previous fights is approximated by starting at 70%.
      s.hp = Math.round(maxHp(s) * 0.7);
      const w = pool[Math.floor(rng() * pool.length)];
      const b = startBattle(s, w, rng);
      const hp0 = s.hp;
      let g = 0;
      while (!b.outcome && g++ < 40) {
        const moves = availableMoves(s, b);
        let mv = COUNTER[b.intent.kind] as any;
        if (!moves.includes(mv)) mv = 'attack';
        const q = makeQuestion(s, b, mv, rng);
        let ans = q.answer ?? 'Ich möchte einen Tee.';
        if (q.type === 'sentence') { s.words['tee'] = { stage: 1, due: 0, firstSeen: 0, lastSeen: 0, relapse: 0, correct: 0, wrong: 0 }; }
        if (rng() > acc) ans = 'zzz';
        resolveTurn(s, b, mv, q, ans, rng);
        turns++;
      }
      fights++;
      if (b.outcome === 'lose') deaths++;
      hpLost += (hp0 - s.hp) / maxHp(s);
    }
    console.log(`Lv${lvl} ${zone}: ${(turns / fights).toFixed(1)} turns/fight, death ${(100 * deaths / fights).toFixed(1)}%, hp lost/fight ${(100 * hpLost / fights).toFixed(0)}%`);
  }
}
