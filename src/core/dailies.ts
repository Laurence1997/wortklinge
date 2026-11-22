// 每日委托 (0.6 第 6 块 细则一): the task board in 铁轨镇广场 (a copy at every bonfire) posts 3 tasks each game day
// (dayKey): defeat 8–12 monsters in a field, beat N due review monsters (only when that many are due), or bring 3
// words of one scene to 半名. Each pays 8% of this level's XP, 5 kills' gold and 2 shards; all three add an iron
// chest. No streaks, no make-up, nothing lost for skipping. Stored as JSON in flags.daily (save stays v3).

import { CONFIG, xpToNext } from './config';
import { addGearKill, addXp, dayKey, now, type GameState, type LevelUpResult } from './state';
import { stageOf } from './srs';
import type { Rng } from './rng';
import type { ZoneId } from './types';
import { WORD_BY_ID } from '../data/words';
import { SCENES } from '../data/world';
import { ZONES } from '../game/map';

export type DailyKind = 'kill' | 'review' | 'half';
export interface Daily {
  kind: DailyKind;
  zone?: ZoneId;
  scene?: string;
  words?: string[];
  need: number;
  have: number;
  done: boolean;
}
export interface DailyBoard {
  day: string;
  list: Daily[];
  bonus: boolean;
}

const range = (lv: string) => {
  const m = /(\d+)–(\d+)/.exec(lv);
  return m ? [+m[1], +m[2]] : null;
};

/** Due review words right now (what the 复习 task counts against). */
export function dueCount(s: GameState): number {
  const t = now(s);
  return Object.values(s.words).filter((p) => p.due <= t && !p.retired).length;
}

function fieldFor(s: GameState): ZoneId {
  const fields = ZONES.filter((z) => z.monsters && range(z.levels) && z.region <= (s.region ?? 1));
  const fit = fields.filter((z) => range(z.levels)![0] <= s.level && s.level <= range(z.levels)![1]);
  const pool = fit.length ? fit : fields.sort((a, b) => range(b.levels)![0] - range(a.levels)![0]).slice(0, 1);
  return pool[pool.length - 1].id;
}

function halfTask(s: GameState, rng: Rng): Daily | null {
  const region = s.region ?? 1;
  const cands = SCENES.filter((sc) => sc.region === region && sc.words)
    .map((sc) => ({ sc, ws: sc.words!.filter((id) => WORD_BY_ID[id] && WORD_BY_ID[id].lvl <= s.level + 1 && stageOf(s, WORD_BY_ID[id]) < 2) }))
    .filter((x) => x.ws.length >= 3);
  if (!cands.length) return null;
  const x = cands[Math.floor(rng() * cands.length)];
  const words = [...x.ws].sort(() => rng() - 0.5).slice(0, 3);
  return { kind: 'half', scene: x.sc.id, words, need: 3, have: 0, done: false };
}

function makeBoard(s: GameState, rng: Rng, day: string): DailyBoard {
  const list: Daily[] = [{ kind: 'kill', zone: fieldFor(s), need: 8 + Math.floor(rng() * 5), have: 0, done: false }];
  const due = dueCount(s);
  if (due >= 5) list.push({ kind: 'review', need: Math.min(10, due), have: 0, done: false });
  const half = halfTask(s, rng);
  if (half) list.push(half);
  // Fill up to three with another field (a different one when there is one).
  while (list.length < 3) {
    const z = ZONES.filter((x) => x.monsters && x.region === (s.region ?? 1) && !list.some((d) => d.zone === x.id));
    const zone = z.length ? z[Math.floor(rng() * z.length)].id : fieldFor(s);
    list.push({ kind: 'kill', zone, need: 8 + Math.floor(rng() * 5), have: 0, done: false });
  }
  return { day, list, bonus: false };
}

/** Today's board (a new one when the game day changed). */
export function dailyBoard(s: GameState, rng: Rng): DailyBoard {
  const day = dayKey(now(s));
  let b: DailyBoard | null = null;
  try {
    b = s.flags.daily ? (JSON.parse(String(s.flags.daily)) as DailyBoard) : null;
  } catch {
    b = null;
  }
  if (!b || b.day !== day) {
    b = makeBoard(s, rng, day);
    s.flags.daily = JSON.stringify(b);
  }
  return b;
}

export function dailyText(d: Daily): string {
  const z = d.zone ? ZONES.find((x) => x.id === d.zone) : null;
  const sc = d.scene ? SCENES.find((x) => x.id === d.scene) : null;
  if (d.kind === 'kill') return `在${z?.zh ?? '野外'}打倒 ${d.need} 只怪`;
  if (d.kind === 'review') return `打倒 ${d.need} 只到期的复习怪`;
  return `把「${sc?.zh ?? '某个场景'}」的 ${(d.words ?? []).map((id) => WORD_BY_ID[id]?.zh ?? id).join('、')} 推进到半名`;
}

export interface DailyPay {
  task: Daily;
  xp: number;
  gold: number;
  levelUp: LevelUpResult;
}

function pay(s: GameState, d: Daily): DailyPay {
  const xp = Math.round(xpToNext(s.level) * 0.08);
  const gold = 5 * CONFIG.gold.perKill(s.level);
  const levelUp = addXp(s, xp);
  s.gold += gold;
  addGearKill(s, s.region ?? 1, 1, 2);
  return { task: d, xp, gold, levelUp };
}

/**
 * After a kill: count it toward today's tasks. Returns the tasks finished by it (already paid) and whether the
 * three-task iron chest is due. Only from Lv21 (unlock 'dailies').
 */
export function dailyKill(s: GameState, rng: Rng, zone: ZoneId | undefined, wasDue: boolean): { paid: DailyPay[]; chest: boolean } {
  const b = dailyBoard(s, rng);
  const paid: DailyPay[] = [];
  for (const d of b.list) {
    if (d.done) continue;
    if (d.kind === 'kill' && zone && d.zone === zone) d.have++;
    else if (d.kind === 'review' && wasDue) d.have++;
    else if (d.kind === 'half') d.have = (d.words ?? []).filter((id) => WORD_BY_ID[id] && stageOf(s, WORD_BY_ID[id]) >= 2).length;
    if (d.have >= d.need) {
      d.have = d.need;
      d.done = true;
      paid.push(pay(s, d));
    }
  }
  let chest = false;
  if (!b.bonus && b.list.every((d) => d.done)) {
    b.bonus = true;
    chest = true;
  }
  s.flags.daily = JSON.stringify(b);
  return { paid, chest };
}
