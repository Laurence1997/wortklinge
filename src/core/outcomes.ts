import type { Battle } from './combat';
import { CONFIG, levelGapMult } from './config';
import { makeItem, rollQuality } from './loot';
import type { Rng } from './rng';
import { recordKill, type KillOutcome } from './srs';
import { addXp, affixTotal, maxHp, now, overloaded, rollDay, todayLog, type GameState, type LevelUpResult } from './state';
import type { Item } from './types';
import { has } from './unlocks';

export interface WinResult {
  xp: number;
  gold: number;
  kill: KillOutcome;
  levelUp: LevelUpResult;
  drop: Item | null;
  bagFull: boolean;
  echoRecovered: { gold: number; xp: number } | null;
  /** This kill happened during 言灵过载 (new = paid less, due = paid more). */
  overload: 'new' | 'due' | null;
}

export function applyWin(s: GameState, b: Battle, rng: Rng): WinResult {
  rollDay(s);
  const t = now(s);
  const log = todayLog(s);
  const w = b.word;
  const wasNew = b.kind === 'new';
  const ov = overloaded(s);
  const overload: WinResult['overload'] = ov && wasNew ? 'new' : ov && b.kind === 'due' ? 'due' : null;
  const O = CONFIG.overload;
  const kill = recordKill(s, w, b.lastKillTyped, b.slipped, t);

  let xp = b.kind === 'new' ? CONFIG.xp.newMonster : b.kind === 'due' ? CONFIG.xp.dueMonster : CONFIG.xp.shadowMonster;
  if (overload === 'new') xp *= O.newXp;
  if (overload === 'due') xp *= O.dueXp;
  const overdueMult = 1 + CONFIG.monster.overdueRewardStep * b.overdue;
  xp *= overdueMult;
  if (b.lastKillTyped) xp *= CONFIG.xp.typedKillMult;
  const gap = levelGapMult(s.level, b.monster.lvl);
  xp = gap === 0 ? 1 : xp * gap;
  xp *= 1 + Math.min(0.3, affixTotal(s, 'xp'));
  if (b.tutorial === 'loss') xp = 0;
  xp = Math.round(xp);

  let gold = CONFIG.gold.perKill(b.monster.lvl);
  if (overload === 'new') gold = Math.max(1, Math.round(gold * O.newGold));
  if (overload === 'due') gold = Math.round(gold * O.dueGold);
  gold = Math.round(gold * overdueMult);
  let echoRecovered: WinResult['echoRecovered'] = null;
  if (s.echo && s.echo.wordId === w.id) {
    echoRecovered = { gold: s.echo.gold, xp: s.echo.xp };
    gold += s.echo.gold;
    xp += s.echo.xp;
    s.echo = null;
  }
  s.gold += gold;
  const levelUp = addXp(s, xp);

  if (wasNew) {
    s.daily.newCount += 1;
    log.newWords += 1;
  }
  if (b.kind === 'due') s.daily.dueSpawned += 1;
  if (kill.guiming) log.guiming += 1;
  log.kills += 1;
  s.stats.kills += 1;

  // Drops: 20% from small monsters once gear is unlocked; the first one is a guaranteed green (Lv5 lesson).
  let drop: Item | null = null;
  let bagFull = false;
  if (has(s.level, 'gear') && b.tutorial !== 'loss') {
    const firstGreen = !s.flags.firstGreen;
    let rate = CONFIG.loot.smallDropRate * (1 + Math.min(1, affixTotal(s, 'dropRate')));
    if (b.kind === 'due') rate *= 1.5;
    if (overload === 'new') rate *= O.newDrop;
    if (overload === 'due') rate *= O.dueDrop;
    if (firstGreen || rng() < rate) {
      const maxQ = has(s.level, 'purple') ? 'orange' : 'green';
      // 学习加成: typed kills and due words raise purple/orange odds.
      let q = rollQuality(rng, maxQ, firstGreen ? 'green' : undefined);
      if (q === 'white' && (b.lastKillTyped || b.kind === 'due') && rng() < 0.15) q = 'green';
      drop = makeItem(rng, b.monster.lvl, q, firstGreen ? 'pen' : undefined);
      if (firstGreen) s.flags.firstGreen = true;
      if (s.bag.length >= CONFIG.loot.bagSize) {
        bagFull = true;
        drop = null;
      } else s.bag.push(drop);
    }
  }

  // 战后喘口气
  s.hp = Math.min(maxHp(s), s.hp + Math.round(maxHp(s) * CONFIG.player.postFightHealPct));
  return { xp, gold, kill, levelUp, drop, bagFull, echoRecovered, overload };
}

export interface LossResult {
  lostEcho: { gold: number; xp: number } | null;
  newEcho: { gold: number; xp: number } | null;
}

/** Death: learning progress is never lost; unspent gold and XP stay on the word that killed you. */
export function applyLoss(s: GameState, b: Battle, at: { x: number; y: number }): LossResult {
  s.stats.deaths += 1;
  s.combo = 0;
  let lostEcho: LossResult['lostEcho'] = null;
  let newEcho: LossResult['newEcho'] = null;
  if (has(s.level, 'echo')) {
    if (s.echo) lostEcho = { gold: s.echo.gold, xp: s.echo.xp };
    newEcho = { gold: s.gold, xp: s.xp };
    s.echo = { wordId: b.word.id, gold: s.gold, xp: s.xp, x: at.x, y: at.y };
    s.gold = 0;
    s.xp = 0;
  }
  s.hp = maxHp(s);
  return { lostEcho, newEcho };
}
