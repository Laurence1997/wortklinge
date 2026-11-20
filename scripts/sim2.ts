// Region 2 balance check (Lv11–20): single fights and packs (群怪), with and without a class.
// Run: npx vite-node scripts/sim2.ts
// Gear: a white pen and coat of the player's level (what a player who sells and buys at Mira has).
import { makeRng } from '../src/core/rng';
import { CONFIG } from '../src/core/config';
// Tuning knobs for trying values without editing config: HPM (monster HP ×), DMGM (monster damage ×).
if (process.env.HPM) CONFIG.monster.hp1 *= +process.env.HPM;
if (process.env.DMGM) { const f = CONFIG.monster.dmgPct, k = +process.env.DMGM; CONFIG.monster.dmgPct = (l: number) => f(l) * k; }
import { newGame, maxHp, type GameState } from '../src/core/state';
import { startBattle, makeQuestion, resolveTurn, availableMoves, linkPack, type Battle } from '../src/core/combat';
import { COUNTER } from '../src/core/intents';
import { makeItem } from '../src/core/loot';
import type { ClassId } from '../src/core/classes';
import { WORDS } from '../src/data/words';
import type { ZoneId } from '../src/core/types';

const rng = makeRng(7);

function gear(s: GameState) {
  s.equipped.pen = makeItem(rng, s.level, 'white', 'pen');
  s.equipped.coat = makeItem(rng, s.level, 'white', 'coat');
}

function player(lvl: number, cls: ClassId | null): GameState {
  const s = newGame('S', 'student', Date.now());
  s.level = lvl;
  s.cls = cls;
  gear(s);
  // Words met so far (墨水风暴 picks among the longest of them).
  for (const w of WORDS.filter((x) => x.lvl <= lvl && x.pos === 'n')) s.words[w.id] = { stage: 1, due: 9e15, firstSeen: 0, lastSeen: 0, relapse: 0, correct: 0, wrong: 0 };
  return s;
}

// One sample = 6 fights in a row without a bonfire (class resources carry over), HP back to 70% each fight.
function fight(s: GameState, zone: ZoneId, packSize: number, acc: number, cls: ClassId | null) {
  s.hp = Math.round(maxHp(s) * 0.7);
  const nouns = WORDS.filter((w) => w.zone === zone && w.art && w.family !== 'truhe');
  const pack: Battle[] = [];
  const arts = new Set<string>();
  for (let tries = 0; pack.length < packSize && tries < 50; tries++) {
    const w = packSize > 1 ? nouns[Math.floor(rng() * nouns.length)] : WORDS.filter((x) => x.zone === zone && x.family !== 'truhe')[Math.floor(rng() * 30)];
    if (!w || (packSize > 1 && arts.has(w.art!))) continue;
    if (w.art) arts.add(w.art);
    pack.push(startBattle(s, w, rng));
  }
  linkPack(pack);
  const hp0 = s.hp;
  let turns = 0;
  const over = () => pack.every((b) => b.outcome === 'win') || pack.some((b) => b.outcome === 'lose' || b.outcome === 'fled');
  while (!over() && turns < 60) {
    const target = pack.find((b) => !b.outcome && b.intent.kind === 'charge') ?? pack.find((b) => !b.outcome)!;
    const moves = availableMoves(s, target);
    let mv = COUNTER[target.intent.kind] as 'attack' | 'block' | 'break';
    if (!moves.includes(mv)) mv = 'attack';
    const useCls = cls && target.cfx.res >= 3 && (cls === 'writer' || target.intent.kind === 'charge' || target.intent.kind === 'attack');
    const q = makeQuestion(s, target, useCls ? 'cls' : mv, rng, undefined, pack.length > 1);
    let ans = q.answer ?? 'Ich nehme zwei Äpfel.';
    if (q.type === 'sentence') s.words['apfel'] = { stage: 1, due: 0, firstSeen: 0, lastSeen: 0, relapse: 0, correct: 0, wrong: 0 };
    if (rng() > acc && q.type !== 'steady') ans = 'zzz';
    resolveTurn(s, target, useCls ? 'cls' : mv, q, ans, rng, pack);
    turns++;
  }
  return { turns, lost: pack.some((b) => b.outcome === 'lose'), hpLost: (hp0 - s.hp) / maxHp(s) };
}

for (const acc of [0.9, 0.75]) {
  console.log(`\naccuracy ${acc * 100}%`);
  for (const [lvl, zone] of [[11, 'gemuesegasse'], [13, 'gemuesegasse'], [15, 'waagegasse'], [17, 'kornspeicher'], [19, 'kornspeicher']] as const) {
    const row: string[] = [];
    for (const [size, cls] of [[1, null], [2, null], [3, null], [3, 'writer'], [3, 'guardian']] as const) {
      if (size === 3 && lvl < 13) { row.push('3: —'); continue; }
      let t = 0, d = 0, h = 0;
      const N = 300;
      let s = player(lvl, cls);
      for (let i = 0; i < N; i++) {
        if (i % 6 === 0) s = player(lvl, cls);
        const r = fight(s, zone, size, acc, cls);
        t += r.turns;
        d += r.lost ? 1 : 0;
        h += r.hpLost;
      }
      row.push(`${size}${cls ? cls[0] : ''}: ${(t / N).toFixed(1)}t ${(100 * d / N).toFixed(0)}%† ${(100 * h / N).toFixed(0)}%hp`);
    }
    console.log(`Lv${lvl} ${zone.padEnd(12)} ${row.join(' | ')}`);
  }
}
