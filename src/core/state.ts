import type { Look } from './look';
import { CONFIG, xpToNext } from './config';
import { hpBonus, type ClassId } from './classes';
import type { Item, Slot, WordProgress } from './types';

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
}

export interface GameState {
  version: 1;
  createdAt: number;
  /** Real time of the last local save (ms); the newer of local and cloud wins. */
  savedAt?: number;
  /** Account id this save belongs to (set when logged in). */
  owner?: string;
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
  recentNouns: string[];
  /** Which map you stand on (1 = 余烬营地, 2 = 面包集市). */
  region: 1 | 2;
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
    version: 1,
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
    flags: {},
    skills: [],
    skillUses: {},
    recentNouns: [],
    region: 1,
    cls: null,
    classes: [],
    talents: {},
    pos: { x: 0, y: 0 },
    log: {},
    settings: { tts: true, music: 0.5, sfx: 0.7, autoZh: false },
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
  return Math.round((CONFIG.player.baseHp + CONFIG.player.hpPerLevel * (s.level - 1) + coat) * (1 + hpBonus(s)));
}

export function attack(s: GameState): number {
  const pen = s.equipped.pen?.main ?? 0;
  return CONFIG.player.baseAtk + CONFIG.player.atkPerLevel * s.level + pen;
}

export function critChance(s: GameState): number {
  return CONFIG.player.baseCrit + (s.equipped.amulet?.main ?? 0);
}

export function hintsPerFight(s: GameState): number {
  return s.equipped.dict?.main ?? 0;
}

export function affixTotal(s: GameState, key: string): number {
  let t = 0;
  for (const it of Object.values(s.equipped)) for (const a of it?.affixes ?? []) if (a.key === key) t += a.value;
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
  if (s.version !== 1 || typeof s.level !== 'number' || typeof s.words !== 'object') return null;
  const base = newGame(s.name ?? '旅人', s.origin ?? 'student', s.createdAt);
  return { ...base, ...s, settings: { ...base.settings, ...s.settings }, stats: { ...base.stats, ...s.stats } };
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

/** 言灵过载: today's new words have reached the daily threshold. */
export function overloaded(s: GameState): boolean {
  return s.daily.newCount >= CONFIG.srs.dailyNewCap;
}
