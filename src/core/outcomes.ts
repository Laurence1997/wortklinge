import { CHALLENGE_CFG, noteFirstTry } from './challenge';
import { quickFightXp, type Battle } from './combat';
import { CONFIG, levelGapMult } from './config';
import { makeItem, rollQuality } from './loot';
import { markUnidentified } from './identify';
import type { Rng } from './rng';
import { flushSkill, recordKill, type KillOutcome } from './srs';
import { addGearKill, addXp, affixTotal, maxHp, now, rollDay, todayLog, type GameState, type LevelUpResult } from './state';
import type { Item } from './types';
import { has } from './unlocks';
import { rollItemDrops, type Consumable } from './items';
import { CONJ } from '../data/verbs';
import { CHEST_RATE, type ChestKind } from './chest';

export interface WinResult {
  xp: number;
  gold: number;
  kill: KillOutcome;
  levelUp: LevelUpResult;
  drop: Item | null;
  /** 物品栏 drops (纸条 / 药片), already added to the counts. */
  items: Consumable[];
  chest: ChestKind | null;
  bagFull: boolean;
  echoRecovered: { gold: number; xp: number } | null;
  /** A due review monster: paid ×1.5 XP and an extra shard. */
  review: boolean;
  /** 0.4: the gear tier this kill reached, when it went up. */
  gearUp: number | null;
  /** 残句 (0.5): the short-saying card it dropped (first = new in the collection). */
  card?: { id: string; first: boolean };
}

export function applyWin(s: GameState, b: Battle, rng: Rng, opts: { heal?: boolean } = {}): WinResult {
  rollDay(s);
  const t = now(s);
  const log = todayLog(s);
  const w = b.word;
  const wasNew = b.kind === 'new';
  // 残句: a sentence is not a word — nothing goes into the wordbook; its card drops instead.
  const kill: KillOutcome = b.phrase ? { kind: 'new', from: 0, to: 0, guiming: false, needsTypedFinal: false } : recordKill(s, w, b.lastKillTyped, b.slipped, t, { used: b.usedOk, flaw: b.flawed || b.hinted, typed: (b.writeOk ?? 0) > 0, wrongs: b.wrongs });
  let card: WinResult['card'];
  if (b.phrase?.cardId) {
    s.sayings ??= {};
    card = { id: b.phrase.cardId, first: !s.sayings[b.phrase.cardId] };
    s.sayings[b.phrase.cardId] = (s.sayings[b.phrase.cardId] ?? 0) + 1;
  } else {
    flushSkill(s, w, b);
    if (b.hinted && s.words[w.id]) s.words[w.id].hinted = true;
    // 挑战怪: written right unseen → 待验证 from tomorrow, now that the kill made its entry.
    if (b.pendOnWin && s.words[w.id] && !s.words[w.id].pend && !s.words[w.id].retired) s.words[w.id].pend = t;
  }
  if (!b.tutorial && !b.trial && !b.phrase && !b.isEcho) noteFirstTry(s, b.firstTry);

  let xp = b.kind === 'new' ? CONFIG.xp.newMonster : b.kind === 'due' ? CONFIG.xp.dueMonster : CONFIG.xp.shadowMonster;
  // 2026-11-24: only 复习怪 pay the review bonus; a learning respawn (认 → 用 → 写, minutes later) pays as due.
  const rv = b.kind === 'due' && !!b.reviewMon;
  if (rv) xp *= CONFIG.xp.dueBonus;
  const overdueMult = 1 + CONFIG.monster.overdueRewardStep * b.overdue;
  xp *= overdueMult;
  if (b.lastKillTyped) xp *= CONFIG.xp.typedKillMult;
  // Strong verbs (nehmen → nimmt) are harder to conjugate: ×1.3 once conjugation is unlocked.
  if (w.pos === 'v' && CONJ[w.de]?.strong && has(s.level, 'conjugation')) xp *= CONFIG.xp.strongVerbMult;
  const gap = levelGapMult(s.level, b.monster.lvl);
  xp = gap === 0 ? 1 : xp * gap;
  xp *= 1 + Math.min(0.3, affixTotal(s, 'xp'));
  if (b.cursed) xp *= CONFIG.curse.xpMult;
  if (b.rusty) xp *= CONFIG.rusty.rewardMult;
  // 场景精英: each part pays what its word pays as a normal monster, ×1.2.
  if (b.elite) xp *= CONFIG.elite.rewardMult;
  if (b.challenge) xp *= CHALLENGE_CFG.xpMult;
  xp *= quickFightXp(s, b); // 天赋「一气呵成」
  if (b.tutorial === 'loss') xp = 0;
  xp = Math.round(xp);

  let gold = CONFIG.gold.perKill(b.monster.lvl);
  gold = Math.round(gold * overdueMult * (b.rusty ? CONFIG.rusty.rewardMult : 1) * (b.elite ? CONFIG.elite.rewardMult : 1));
  if (b.fx.stimmt) gold *= 2;
  if (b.fx.nextHalt) s.flags.nextHalt = true;
  let echoRecovered: WinResult['echoRecovered'] = null;
  if (s.echo && s.echo.wordId === w.id) {
    echoRecovered = { gold: s.echo.gold, xp: s.echo.xp };
    gold += s.echo.gold;
    xp += s.echo.xp;
    s.echo = null;
  }
  s.gold += gold;
  const levelUp = addXp(s, xp);

  if (wasNew && !b.phrase) {
    s.daily.newCount += 1;
    log.newWords += 1;
  }
  if (b.kind === 'due') s.daily.dueSpawned += 1;
  if (kill.guiming) log.guiming += 1;
  log.kills += 1;
  s.stats.kills += 1;
  // 碎片 count from Lv1, but a tier-up is only announced once gear opens (Lv3, 节奏表).
  const gearUpRaw = b.tutorial === 'loss' ? null : addGearKill(s, b.phrase ? s.region ?? 1 : w.region ?? 1, rng(), (rv ? 1 + CONFIG.xp.dueShards : 1) + (b.cursed ? CONFIG.curse.shards : 0) + (b.rusty ? CONFIG.rusty.shards : 0));
  const gearUp = has(s.level, 'gear') ? gearUpRaw : null;

  // Drops: 20% from small monsters once gear is unlocked; the first one is a guaranteed green (Lv5 lesson).
  let drop: Item | null = null;
  let bagFull = false;
  if (has(s.level, 'gear') && b.tutorial !== 'loss') {
    const firstGreen = !s.flags.firstGreen;
    let rate = CONFIG.loot.smallDropRate * (1 + Math.min(1, affixTotal(s, 'dropRate')));
    if (rv) rate *= 1.5;
    if (firstGreen || rng() < rate) {
      const maxQ = has(s.level, 'purple') ? 'orange' : 'green';
      // 学习加成: typed kills and due words raise purple/orange odds.
      let q = rollQuality(rng, maxQ, firstGreen ? 'green' : undefined);
      if (q === 'white' && (b.lastKillTyped || rv) && rng() < 0.15) q = 'green';
      drop = makeItem(rng, b.monster.lvl, q, firstGreen ? 'pen' : undefined);
      markUnidentified(s, drop);
      if (firstGreen) s.flags.firstGreen = true;
      if (s.bag.length >= CONFIG.loot.bagSize) {
        bagFull = true;
        drop = null;
      } else s.bag.push(drop);
    }
  }

  // Chests (Lv11+): rare monsters always carry an iron chest; due kills 5% forgotten chest; others 3% wood.
  // 场景精英 (9 级): its last part brings an iron chest (always the first time, else 30%), even before Lv11.
  let chest: ChestKind | null = null;
  if (b.elite && b.elite.seg === b.elite.words.length - 1 && b.tutorial !== 'loss') {
    if (!b.elite.review || rng() < CONFIG.elite.repeatChest) chest = 'iron';
  } else if (has(s.level, 'chests') && b.tutorial !== 'loss' && !b.trial) {
    if (b.elite) chest = null; // 场景精英: no wood chest per part; the elite's iron chest comes with the last part
    else if (b.flees) chest = 'iron';
    else if (rv && rng() < CHEST_RATE.forgotten) chest = 'forgotten';
    else if (rng() < CHEST_RATE.wood) chest = 'wood';
  }

  // 战后喘口气 (packs heal once, after the whole fight)
  if (opts.heal !== false) postFightHeal(s);
  // 物品栏 (2026-11-22): rolled last, so the earlier rolls keep their order.
  const items = b.tutorial === 'loss' ? [] : rollItemDrops(s, rng);
  return { xp, gold, kill, levelUp, drop, items, bagFull, echoRecovered, review: rv, chest, gearUp, card };
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
  if (has(s.level, 'echo') && !b.phrase) {
    if (s.echo) lostEcho = { gold: s.echo.gold, xp: s.echo.xp };
    newEcho = { gold: s.gold, xp: s.xp };
    s.echo = { wordId: b.word.id, gold: s.gold, xp: s.xp, x: at.x, y: at.y };
    s.gold = 0;
    s.xp = 0;
  }
  s.hp = maxHp(s);
  return { lostEcho, newEcho };
}

export function postFightHeal(s: GameState): void {
  s.hp = Math.min(maxHp(s), s.hp + Math.round(maxHp(s) * CONFIG.player.postFightHealPct));
}
