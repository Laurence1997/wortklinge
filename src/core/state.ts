import type { Look } from './look';
import { CONFIG, monsterHpAt, playerBaseHp, XP_CURVE, xpToNext } from './config';
import { hpBonus, type ClassId } from './classes';
import type { Item, RegionNo, Slot, WordProgress } from './types';
import type { RiftRun } from './rift';
import { convertLegacyAffixes } from './loot';
import { UNLOCK } from './unlocks';
import { levelCapFor } from './stages';
import { masteryAffix } from './mastery';

export interface DayLog {
  minutes: number;
  kills: number;
  correct: number;
  wrong: number;
  newWords: number;
  guiming: number;
}

export interface Echo {
  wordId: string;
  gold: number;
  xp: number;
  x: number;
  y: number;
}

export interface Settings {
  tts: boolean;
  music: number;
  sfx: number;
  /** Show the Chinese meaning of monster lines without clicking. */
  autoZh: boolean;
  /** 开箱动画 (0.6.x): chests open with a short animation (any key skips). */
  chestAnim: boolean;
  /** 发音训练 (2026-11-23): read 回音怪 pairs aloud with the in-browser phoneme model (opt-in, ~635 MB). */
  pron?: boolean;
  /** 即时战 (81): false = keep turn-based (no quick-answer bonus); slow = casts ×1.5. */
  realtime?: boolean;
  realtimeSlow?: boolean;
  /** 排行榜隐身: off the boards and out of the online count. */
  hideBoard?: boolean;
  /** 安静模式: no speaking asked; spoken-only tasks wait as 口语委托. */
  quiet?: boolean;
}

export interface GameState {
  version: 3;
  /** 6000 词导入 (0.7+0.8): 1 = the save was started on the 6000-word list. Older saves are reset once (see migrate). */
  lexicon?: number;
  createdAt: number;
  /** Real time of the last local save (ms); the newer of local and cloud wins. */
  savedAt?: number;
  /** Account id this save belongs to (set when logged in). */
  owner?: string;
  /** XP curve the level was computed with (2 = 0.3 提速). Older saves are re-levelled from total XP. */
  xpCurve?: number;
  name: string;
  origin: string;
  /** Dev time skip, added to Date.now(). */
  timeOffset: number;
  level: number;
  xp: number;
  gold: number;
  hp: number;
  combo: number;
  bestCombo: number;
  words: Record<string, WordProgress>;
  daily: { day: string; newCount: number; dueSpawned: number };
  equipped: Partial<Record<Slot, Item>>;
  bag: Item[];
  echo: Echo | null;
  flags: Record<string, number | boolean | string>;
  skills: string[];
  skillUses: Record<string, number>;
  /** 接句怪: short-saying cards collected (id → times). */
  sayings?: Record<string, number>;
  /** 秘术栏 (3 级; 2 slots from 81): equipped short-card / slang ids. */
  charms?: string[];
  /** 俚语秘术 (50 级): owned slang lines. */
  slang?: Record<string, number>;
  /** 言石 (62 级): gems not set in an item. */
  gems?: import('./gems').Gem[];
  /** 言石 刻满: grammars a gem was filled on (no longer offered for the free re-carve). */
  gemFull?: import('./gram/task').GramSys[];
  /** 主城全量筛选 (0.6.x): XP waiting in scenes (待领) and the cursor per scope. */
  screen?: import('./screen').ScreenSave;
  /** 词表导入 (2026-11-22): word ids marked 优先 and lemmas the game doesn't have yet (待收录). Optional: absent = none. */
  wordImport?: { ids: string[]; pending: string[] };
  /** 入学测试 / 分级考核 (2026-11-25): last result and 推定会 spot-check counts. Optional: absent = never taken. */
  placement?: import('./placement').PlaceSave;
  /** 挑战怪 (rev 342): first-try record of the last field monsters. Optional: absent = none yet. */
  challenge?: import('./challenge').ChallengeSave;
  /** 语法线 (0.7–0.8): boards seen, dungeon floors cleared, review partner. Optional: absent = nothing yet. */
  gram?: import('./gram/boards').GramSave;
  /** 失语者的遗书 (1.0): letter id → time first read. */
  letters?: Record<string, number>;
  /** 排行榜 counters (optional; refreshed before each save). */
  board?: import('./board').BoardSave;
  /** Recent timed answers (冒险者 PK: the rival's accuracy and pace follow these). */
  recentAns?: import('./adventurers').AnsRec[];
  /** 红装 / 橙装保底 counters and 套装 materials (optional, old saves have none). */
  forge?: import('./forge').ForgeSave;
  /** 篝火日记 (2026-11-22): entries written at bonfires (newest last). Optional: absent = none yet. */
  journal?: import('./journal').JournalEntry[];
  /** 回音怪 (2026-11-23): right / wrong per minimal-pair category, for the weak-spot record. */
  pron?: Partial<Record<import('../data/pairs').PronCat, { ok: number; miss: number }>>;
  /** 0.4 装备档位: kills per region ("1", "2"); the tier follows from them. */
  gearKills?: Record<string, number>;
  /** 碎片 余额 per region (九, 2026-11-25 暂定): what trades spend; gearKills is the 累计 that unlocks tiers. */
  shardBal?: Record<string, number>;
  recentNouns: string[];
  /** Which map you stand on (1 = 余烬营地, 2 = 面包集市). */
  region: RegionNo;
  /** Old class fields (classes were cancelled, 游戏设计 十): always null / empty now; kept so old saves load. */
  cls: ClassId | null;
  classes: ClassId[];
  /** 天赋树（共用一棵）: ranks under `shared` (old per-class keys are ignored). */
  talents: Record<string, Record<string, number>>;
  /** 裂隙 run in progress (0.8, 91 级): gear counts for nothing while it is set. */
  rift?: RiftRun;
  /** 技能池: skills given beyond the level schedule (optional) and the skills taken into battle (optional). */
  pool?: import('./skillPool').PoolId[];
  loadout?: import('./skillPool').PoolId[];
  /** 墨水 / 沉着 and the writer's typed streak, kept between fights until the bonfire. */
  cfx?: import('./combat').ClassFx;
  /** Mira's shelf (region 2). */
  shop?: import('./shop').ShopState;
  quests?: Partial<Record<import('./quests').QuestId, import('./quests').QuestProgress>>;
  pos: { x: number; y: number };
  /** 联机外观; old characters pick one the next time they log in. */
  look?: Look;
  log: Record<string, DayLog>;
  settings: Settings;
  stats: { kills: number; deaths: number; crits: number; maxHit: number };
}

export function now(s: Pick<GameState, 'timeOffset'>): number {
  return Date.now() + s.timeOffset;
}

/** In-game day key: a day starts at 04:00 local time. */
export function dayKey(t: number): string {
  const d = new Date(t - CONFIG.dayStartHour * 3600_000);
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${dd}`;
}

export function newGame(name: string, origin: string, t = Date.now()): GameState {
  return {
    version: 3,
    lexicon: LEXICON,
    gearKills: {},
    shardBal: {},
    createdAt: t,
    name,
    origin,
    timeOffset: 0,
    level: 1,
    xp: 0,
    gold: 0,
    hp: CONFIG.player.baseHp,
    combo: 0,
    bestCombo: 0,
    words: {},
    daily: { day: dayKey(t), newCount: 0, dueSpawned: 0 },
    equipped: {},
    bag: [],
    echo: null,
    flags: { seen05: true, srs2: true },
    screen: { pending: {}, cursor: {} },
    xpCurve: XP_CURVE,
    skills: [],
    skillUses: {},
    recentNouns: [],
    region: 1,
    cls: null,
    classes: [],
    talents: {},
    pos: { x: 0, y: 0 },
    log: {},
    settings: { tts: true, music: 0.5, sfx: 0.7, autoZh: false, chestAnim: true },
    stats: { kills: 0, deaths: 0, crits: 0, maxHit: 0 },
  };
}

/** Roll the daily counters over when a new in-game day starts. */
export function rollDay(s: GameState): boolean {
  const k = dayKey(now(s));
  if (s.daily.day === k) return false;
  s.daily = { day: k, newCount: 0, dueSpawned: 0 };
  return true;
}

export function todayLog(s: GameState): DayLog {
  const k = dayKey(now(s));
  return (s.log[k] ??= { minutes: 0, kills: 0, correct: 0, wrong: 0, newWords: 0, guiming: 0 });
}

// ---- Derived player stats -------------------------------------------------

/** 裂隙 白板进入: no gear inside the rift. */
export const gear = (s: Pick<GameState, 'equipped' | 'rift'>) => (s.rift ? {} : s.equipped) as GameState['equipped'];
/** Rift blessings picked; past max level they grow with depth (局内祈福按层数变强: ×(1 + 2% a floor), 暂定). */
const blessed = (s: Pick<GameState, 'rift' | 'level'>, id: string) =>
  (s.rift?.bless.filter((x) => x === id).length ?? 0) * (s.rift && s.level >= CONFIG.levelCap ? 1 + 0.02 * s.rift.floor : 1);

/** 碎片换档 (九, 2026-11-25): strength comes from the worn piece's own tier, no longer from shards directly.
 *  A piece counts in full in its region, half (rounded down) in the next one, nothing further on. 暂定: which slot
 *  carries which part of the old tier bonus — pen → damage, coat → HP, amulet → armor penetration. */
export function itemTier(it: Item | undefined, region: number): number {
  if (!it?.tier) return 0;
  const r = it.region ?? region;
  return r === region ? it.tier : r === region - 1 ? Math.floor(it.tier / 2) : 0;
}
const slotTier = (s: Pick<GameState, 'equipped' | 'rift' | 'region'>, slot: 'pen' | 'coat' | 'amulet') => itemTier(gear(s)[slot], s.region ?? 1);

export function maxHp(s: GameState): number {
  const coat = gear(s).coat?.main ?? 0;
  // 0.4: the coat's HP counts as a percentage (+0.5% per point); the coat's tier does the heavy lifting.
  return Math.round(playerBaseHp(s.level) * (1 + coat * 0.005) * (1 + hpBonus(s)) * (1 + CONFIG.gear.hp * slotTier(s, 'coat')) * (1 + affixTotal(s, 'hp')) * (1 + 0.2 * blessed(s, 'hp')));
}

/** 0.4 伤害: half a same-level monster's HP, × (1 + 0.18 × the pen's tier); the pen adds +1% per attack point. */
export function attack(s: GameState): number {
  const pen = gear(s).pen?.main ?? 0;
  return CONFIG.playerDmgShare * monsterHpAt(s.level) * (1 + CONFIG.gear.dmg * slotTier(s, 'pen')) * (1 + pen * 0.01) * (1 + affixTotal(s, 'dmg')) * (1 + 0.15 * blessed(s, 'atk'));
}

/** Tier reached in one region: tier n after 40 × n² shards there (1 per kill), at most 8. */
export function regionTier(s: Pick<GameState, 'gearKills'>, region: number): number {
  const k = s.gearKills?.[String(region)] ?? 0;
  return Math.min(CONFIG.gear.tiers, Math.floor(Math.sqrt(k / CONFIG.gear.shardsPerTierSq) + 1e-9));
}

/** The tier unlocked in the region you are in (what a trade or a drop there carries). */
export function gearTier(s: Pick<GameState, 'gearKills' | 'region'> & { rift?: RiftRun }): number {
  if (s.rift) return 0;
  return regionTier(s, s.region ?? 1);
}

/** New pieces (drops, chests, bosses, shop) take the tier unlocked in the region you are in when they reach you. */
export function stampTiers(s: GameState): void {
  if (s.rift) return;
  const r = s.region ?? 1;
  const t = regionTier(s, r);
  for (const it of [...Object.values(s.equipped ?? {}), ...(s.bag ?? [])]) if (it && it.tier === undefined) (it.tier = t), (it.region = r);
}

/** Kills needed in this region for the next tier (null at the top). */
export function nextTierKills(s: Pick<GameState, 'gearKills' | 'region'>): number | null {
  const t = regionTier(s, s.region ?? 1);
  return t >= CONFIG.gear.tiers ? null : CONFIG.gear.shardsPerTierSq * (t + 1) ** 2;
}

export type Affinity = 'der' | 'die' | 'das';

/** 相亲和 (0.6, Lv9): the amulet's affinity, switched freely at a bonfire; none = a plain amulet. */
export function affinityOf(s: Pick<GameState, 'flags' | 'level'>): Affinity | null {
  const a = s.flags?.affinity;
  return s.level >= UNLOCK.affinity && (a === 'der' || a === 'die' || a === 'das') ? a : null;
}

/** Armor penetration from gear: 4% per tier of the amulet (an attuned amulet keeps it; 相亲和 only adds its resource). */
export function gearPen(s: Pick<GameState, 'equipped' | 'rift' | 'region'>): number {
  return CONFIG.gear.pen * slotTier(s, 'amulet');
}

/** A kill drops gear shards (1, or 2 for a due review) for the monster's region, and rarely the next tier whole. Returns the new tier when it went up. */
export function addGearKill(s: GameState, region: number, roll = 1, shards = 1): number | null {
  s.gearKills ??= {};
  s.shardBal ??= {};
  const before = regionTier(s, region);
  const key = String(region);
  s.gearKills[key] = (s.gearKills[key] ?? 0) + shards;
  s.shardBal[key] = (s.shardBal[key] ?? 0) + shards;
  if (roll < CONFIG.gear.wholeChance && before < CONFIG.gear.tiers) s.gearKills[key] = Math.max(s.gearKills[key], CONFIG.gear.shardsPerTierSq * (before + 1) ** 2);
  const after = regionTier(s, region);
  return after > before ? after : null;
}

export function critChance(s: GameState): number {
  return CONFIG.player.baseCrit + (gear(s).amulet?.main ?? 0) + 0.08 * blessed(s, 'crit');
}

/** 词典 no longer raises the note cap (系统审查 2026-11-26: its main stat is now typed damage). */
export function hintsPerFight(_s: GameState): number {
  return 0;
}

/** 刻字 (0.6, 25 级): how many worn items carry this particle. */
export function engraved(s: GameState, word: 'auch' | 'denn' | 'mal' | 'doch'): number {
  return Object.values(gear(s)).filter((it) => it && !it.unidentified && it.socket === word).length;
}

export function affixTotal(s: GameState, key: string): number {
  let t = 0;
  for (const it of Object.values(gear(s))) if (!it?.unidentified) for (const a of it?.affixes ?? []) if (a.key === key) t += a.value;
  return t + masteryAffix(s.flags, key);
}

export interface LevelUpResult {
  levels: number[];
  capped: boolean;
  /** 言灵精通 points gained (at max level, each level's worth of experience). */
  mastery?: number;
}

export function addXp(s: GameState, amount: number): LevelUpResult {
  const levels: number[] = [];
  s.xp += Math.max(0, Math.round(amount));
  let capped = false;
  let mastery = 0;
  while (s.xp >= xpToNext(s.level)) {
    // 言灵精通: at max level a level's worth of experience becomes one point.
    if (s.level >= CONFIG.levelCap) {
      s.xp -= xpToNext(s.level);
      s.flags.masteryPts = ((s.flags.masteryPts as number) ?? 0) + 1;
      mastery += 1;
      continue;
    }
    if (s.level >= levelCapFor(s.flags)) {
      // At the cap keep at most one level's worth, like a breakthrough trial.
      s.xp = Math.min(s.xp, xpToNext(s.level));
      capped = true;
      break;
    }
    s.xp -= xpToNext(s.level);
    s.level += 1;
    levels.push(s.level);
  }
  if (levels.length) s.hp = maxHp(s);
  return { levels, capped, ...(mastery ? { mastery } : {}) };
}

// ---- Save / load ----------------------------------------------------------

const KEY = 'wortklinge.save.v1';

/** Stores a save without restamping savedAt (used when adopting the cloud copy). */
export function saveRaw(s: GameState): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* ignore */
  }
}

let afterSave: ((s: GameState) => void) | null = null;
/** Lets the cloud layer hear about saves without core depending on it. */
export function setSaveHook(fn: (s: GameState) => void): void {
  afterSave = fn;
}

let lastBody = '';
/** Saves only when something changed (审查 A1): an idle tab no longer restamps savedAt and so can't win the cloud
 *  sync with old progress. `force` writes anyway (import, new game). */
export function save(s: GameState, force = false): void {
  const at = s.savedAt;
  s.savedAt = 0;
  const body = JSON.stringify(s);
  s.savedAt = at;
  if (!force && body === lastBody) return;
  lastBody = body;
  s.savedAt = Date.now();
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* private mode or full storage: the game still runs, export still works */
  }
  afterSave?.(s);
}

/** The state as loaded counts as saved (no restamp until it changes). */
export function markSaved(s: GameState): void {
  const at = s.savedAt;
  s.savedAt = 0;
  lastBody = JSON.stringify(s);
  s.savedAt = at;
}

export function load(): GameState | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    // 6000 词导入: keep a copy of the pre-reset save in this browser (never read by the game, only for support).
    if (parsed && (parsed.lexicon ?? 0) < LEXICON && !localStorage.getItem(`${KEY}.before6000`)) localStorage.setItem(`${KEY}.before6000`, raw);
    return migrate(parsed);
  } catch {
    return null;
  }
}

export function clearSave(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}

/** Word-list generation of new saves (6000 词导入 = 1). */
export const LEXICON = 1;

/** The one and only save reset (Lucas 2026-11-25, 6000 词导入, announced in the game before release): a save from
 *  before the 6000-word list starts over as a new game with the same name, origin and account. `flags.reset6000`
 *  shows the note once. Everything else about the old save is dropped (its word ids no longer exist). */
function resetForLexicon(old: GameState): GameState {
  const s = newGame(old.name ?? '', old.origin ?? 'student');
  if (old.owner) s.owner = old.owner;
  s.savedAt = old.savedAt;
  s.flags.reset6000 = true;
  return s;
}

export function migrate(raw: unknown): GameState | null {
  if (!raw || typeof raw !== 'object') return null;
  if (typeof (raw as GameState).level === 'number' && ((raw as GameState).lexicon ?? 0) < LEXICON) return resetForLexicon(raw as GameState);
  const s = raw as GameState;
  // Saves are never thrown away for a version mismatch: older versions are converted step by step here
  // (add `if (s.version === N) { ...convert...; s.version = N + 1 }` blocks when the format changes).
  if (typeof s.level !== 'number' || typeof s.words !== 'object') return null;
  const v = (s as { version?: number }).version ?? 1;
  // v1 → v2: words get 认得 / 会写 counts. Old saves only knew right/wrong totals: right answers count
  // as 认得, and a 归名 word must have been written once (the 归名 blow is typed).
  if (v < 2) {
    for (const p of Object.values(s.words)) {
      p.read ??= p.correct > 0 ? p.correct : p.stage >= 2 ? 1 : 0;
      p.write ??= p.stage === 3 ? 1 : 0;
    }
  }
  // v2 → v3 (0.4): gear tiers come from kills per region. Old saves only kept the total, so it is split:
  // everything to region 1 below Lv11, otherwise half to region 1 and half to region 2.
  if (v < 3 && !s.gearKills) {
    const k = s.stats?.kills ?? 0;
    s.gearKills = s.level <= 10 ? { '1': k } : { '1': Math.round(k / 2), '2': k - Math.round(k / 2) };
  }
  (s as { version: number }).version = 3;
  // 碎片换档 (2026-11-25): a 余额 next to the 累计 (nothing was spent before), and worn / bagged pieces take the tier
  // the old global bonus gave, so nobody gets weaker on the update.
  if (!s.shardBal) {
    s.shardBal = { ...(s.gearKills ?? {}) };
    const r = s.region ?? 1;
    const old = Math.max(regionTier(s, r), r > 1 ? Math.floor(regionTier(s, r - 1) / 2) : 0);
    for (const it of [...Object.values(s.equipped ?? {}), ...(s.bag ?? [])]) if (it && it.tier === undefined && old) (it.tier = old), (it.region = r);
  }
  // 提速 (curve 2): recompute the level from total XP; only ever up, never down.
  if ((s.xpCurve ?? 1) < XP_CURVE) {
    let total = s.xp;
    for (let l = 1; l < s.level; l++) total += xpToNext(l, s.xpCurve ?? 1);
    let lvl = 1;
    while (lvl < levelCapFor(s.flags) && total >= xpToNext(lvl)) total -= xpToNext(lvl++);
    if (lvl > s.level) {
      const gained: number[] = [];
      for (let l = s.level + 1; l <= lvl; l++) gained.push(l);
      s.flags = { ...(s.flags ?? {}), catchUpLevels: gained.join(',') };
      s.level = lvl;
      s.xp = Math.min(total, xpToNext(lvl) - 1);
    }
    s.xpCurve = XP_CURVE;
  }
  const base = newGame(s.name ?? '旅人', s.origin ?? 'student', s.createdAt);
  // 0.6.x 斩杀: WordProgress.pend / retired / sure are optional (absent = not pending, not retired); the town
  // screening's 待领 and cursors start empty.
  s.screen = { pending: { ...(s.screen?.pending ?? {}) }, cursor: { ...(s.screen?.cursor ?? {}) } };
  migrateSrs2(s);
  // 会的词不再回响抽查 (Lucas 2026-11-27): a word retired the moment it was first met (入学测试, 主城筛选, 直接叫名) has
  // firstSeen within an hour of retired; a normal 斩杀 takes two days. Those become 永久 now; nothing else changes.
  for (const p of Object.values(s.words ?? {})) if (p?.retired && !p.sure && p.retired - (p.firstSeen ?? 0) < 60 * 60 * 1000) p.sure = true;
  // 副词缀白名单 (2026-11-24): old 默写伤害 / 选择题暴击率 / 句式攻击伤害 become 伤害 +%; no item is removed.
  for (const it of [...Object.values(s.equipped ?? {}), ...(s.bag ?? [])]) convertLegacyAffixes(it);
  const shop = (s as { shop?: { items?: Item[]; wish?: { affix?: string } } }).shop;
  for (const it of shop?.items ?? []) convertLegacyAffixes(it);
  if (shop?.wish?.affix && ['typedDmg', 'choiceCrit', 'sentenceDmg'].includes(shop.wish.affix)) shop.wish.affix = 'dmg';
  return { ...base, ...s, settings: { ...base.settings, ...s.settings }, stats: { ...base.stats, ...s.stats } };
}

/** 归名 in one day + 语境复习 (2026-11-24, save stays v3, flag srs2): nothing is cleared. Words still learning
 *  (裂形 / 半名) are due now instead of in 16h / 40h; a 归名 word keeps its 归名 and moves onto the context-review
 *  schedule at the step its old relapse count reached (its due date only moves earlier); one already overdue is
 *  a context question now instead of a 半名 monster. A word with wrong answers is not a clean 归名 later. */
export function migrateSrs2(s: GameState, t = now(s)): void {
  s.flags ??= {};
  if (s.flags.srs2) return;
  const c = CONFIG.srs.context;
  for (const p of Object.values(s.words ?? {})) {
    if (!p || p.retired) continue;
    if (p.stage === 3) {
      const k = Math.min(p.relapse ?? 0, c.length - 1);
      p.ctx = k;
      p.ivl = c[k];
      p.due = Math.min(Math.max(p.due, t), t + c[k]);
    } else {
      p.due = Math.min(p.due, t);
      if (p.wrong > 0) p.flaw = true;
    }
  }
  s.flags.srs2 = true;
}

export function exportJson(s: GameState): string {
  return JSON.stringify({ game: 'wortklinge', exportedAt: new Date().toISOString(), save: s }, null, 1);
}

export function importJson(text: string): GameState | null {
  try {
    const parsed = JSON.parse(text);
    return migrate(parsed?.save ?? parsed);
  } catch {
    return null;
  }
}

/** 审查 A4: what an import would do, before it replaces anything. 'old' = a save from before the 6000-word list
 *  (migrate would wipe it to level 1), so it is refused. */
export function checkImport(text: string): { ok: true; s: GameState } | { ok: false; why: string } {
  let raw: { lexicon?: number; level?: unknown } | null = null;
  try {
    const parsed = JSON.parse(text);
    raw = parsed?.save ?? parsed;
  } catch {
    return { ok: false, why: '这个文件不是失语纪元的存档' };
  }
  if (raw && typeof raw.level === 'number' && (raw.lexicon ?? 0) < LEXICON) return { ok: false, why: '这是换 6000 词表之前的存档，新版用不了（导入会变成 1 级）。' };
  const s = importJson(text);
  return s ? { ok: true, s } : { ok: false, why: '这个文件不是失语纪元的存档' };
}

/** The confirm line for replacing `cur` with `next`. */
export function importPrompt(next: GameState, cur: GameState | null): string {
  const day = (t?: number) => (t ? new Date(t).toLocaleDateString('zh-CN') : '?');
  return `将用 ${next.name}（Lv ${next.level}，${day(next.savedAt)}）替换${cur ? `当前的 ${cur.name}（Lv ${cur.level}）` : '当前存档'}。确定吗？`;
}

/** Is a legendary effect of this kind worn (any slot)? */
export function wearsLegend(s: GameState, k: import('./types').Legendary): boolean {
  return Object.values(gear(s)).some((it) => it?.legendary === k);
}
