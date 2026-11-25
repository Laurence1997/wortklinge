import type { Look } from './look';
import { CONFIG, monsterHpAt, playerBaseHp, XP_CURVE, xpToNext } from './config';
import { hpBonus, type ClassId } from './classes';
import type { Item, Slot, WordProgress } from './types';
import { convertLegacyAffixes } from './loot';
import { UNLOCK } from './unlocks';

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
}

export interface GameState {
  version: 3;
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
  /** 篝火日记 (2026-11-22): entries written at bonfires (newest last). Optional: absent = none yet. */
  journal?: import('./journal').JournalEntry[];
  /** 回音怪 (2026-11-23): right / wrong per minimal-pair category, for the weak-spot record. */
  pron?: Partial<Record<import('../data/pairs').PronCat, { ok: number; miss: number }>>;
  /** 0.4 装备档位: kills per region ("1", "2"); the tier follows from them. */
  gearKills?: Record<string, number>;
  recentNouns: string[];
  /** Which map you stand on (1 = 余烬营地, 2 = 面包集市). */
  region: 1 | 2 | 3;
  /** Class picked at Greta (Lv10+, region 2), the classes whose trial you passed, talents per class. */
  cls: ClassId | null;
  classes: ClassId[];
  talents: Partial<Record<ClassId, Record<string, number>>>;
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
    gearKills: {},
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

export function maxHp(s: GameState): number {
  const coat = s.equipped.coat?.main ?? 0;
  // 0.4: the coat's HP counts as a percentage (+0.5% per point); the gear tier does the heavy lifting.
  return Math.round(playerBaseHp(s.level) * (1 + coat * 0.005) * (1 + hpBonus(s)) * (1 + CONFIG.gear.hp * gearTier(s)) * (1 + affixTotal(s, 'hp')));
}

/** 0.4 伤害: half a same-level monster's HP, × (1 + 0.18 × gear tier); the pen adds +1% per attack point. */
export function attack(s: GameState): number {
  const pen = s.equipped.pen?.main ?? 0;
  return CONFIG.playerDmgShare * monsterHpAt(s.level) * (1 + CONFIG.gear.dmg * gearTier(s)) * (1 + pen * 0.01) * (1 + affixTotal(s, 'dmg'));
}

/** Tier reached in one region: tier n after 40 × n² shards there (1 per kill), at most 8. */
export function regionTier(s: Pick<GameState, 'gearKills'>, region: number): number {
  const k = s.gearKills?.[String(region)] ?? 0;
  return Math.min(CONFIG.gear.tiers, Math.floor(Math.sqrt(k / CONFIG.gear.shardsPerTierSq) + 1e-9));
}

/** The tier that counts now: this region's, or half the previous region's while you still wear that gear. */
export function gearTier(s: Pick<GameState, 'gearKills' | 'region'>): number {
  const r = s.region ?? 1;
  return Math.max(regionTier(s, r), r > 1 ? Math.floor(regionTier(s, r - 1) / 2) : 0);
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

/** Armor penetration from gear: 4% per tier (an attuned amulet keeps it; 相亲和 only adds its resource). */
export function gearPen(s: Pick<GameState, 'gearKills' | 'region'>): number {
  return CONFIG.gear.pen * gearTier(s);
}

/** A kill drops gear shards (1, or 2 for a due review) for the monster's region, and rarely the next tier whole. Returns the new tier when it went up. */
export function addGearKill(s: GameState, region: number, roll = 1, shards = 1): number | null {
  s.gearKills ??= {};
  const before = regionTier(s, region);
  const key = String(region);
  s.gearKills[key] = (s.gearKills[key] ?? 0) + shards;
  if (roll < CONFIG.gear.wholeChance && before < CONFIG.gear.tiers) s.gearKills[key] = Math.max(s.gearKills[key], CONFIG.gear.shardsPerTierSq * (before + 1) ** 2);
  const after = regionTier(s, region);
  return after > before ? after : null;
}

export function critChance(s: GameState): number {
  return CONFIG.player.baseCrit + (s.equipped.amulet?.main ?? 0);
}

export function hintsPerFight(s: GameState): number {
  return s.equipped.dict?.main ?? 0;
}

/** 刻字 (0.6, 25 级): how many worn items carry this particle. */
export function engraved(s: GameState, word: 'auch' | 'denn'): number {
  return Object.values(s.equipped).filter((it) => it && !it.unidentified && it.socket === word).length;
}

export function affixTotal(s: GameState, key: string): number {
  let t = 0;
  for (const it of Object.values(s.equipped)) if (!it?.unidentified) for (const a of it?.affixes ?? []) if (a.key === key) t += a.value;
  return t;
}

export interface LevelUpResult {
  levels: number[];
  capped: boolean;
}

export function addXp(s: GameState, amount: number): LevelUpResult {
  const levels: number[] = [];
  s.xp += Math.max(0, Math.round(amount));
  let capped = false;
  while (s.xp >= xpToNext(s.level)) {
    if (s.level >= CONFIG.levelCap) {
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
  return { levels, capped };
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

export function save(s: GameState): void {
  s.savedAt = Date.now();
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* private mode or full storage: the game still runs, export still works */
  }
  afterSave?.(s);
}

export function load(): GameState | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    return migrate(JSON.parse(raw));
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

export function migrate(raw: unknown): GameState | null {
  if (!raw || typeof raw !== 'object') return null;
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
  // 提速 (curve 2): recompute the level from total XP; only ever up, never down.
  if ((s.xpCurve ?? 1) < XP_CURVE) {
    let total = s.xp;
    for (let l = 1; l < s.level; l++) total += xpToNext(l, s.xpCurve ?? 1);
    let lvl = 1;
    while (lvl < CONFIG.levelCap && total >= xpToNext(lvl)) total -= xpToNext(lvl++);
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

