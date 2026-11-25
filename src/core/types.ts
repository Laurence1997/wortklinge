export type Article = 'der' | 'die' | 'das';
export type Gender = 'm' | 'f' | 'n' | 'pl';
export type Pos = 'n' | 'phr' | 'v' | 'adj' | 'num' | 'name' | 'q';
export type Element = 'phys' | 'ice' | 'fire' | 'poison' | 'lightning';

export interface Word {
  id: string;
  /** German without article, e.g. "Tee", "Guten Morgen", "sieben". */
  de: string;
  /** Article for nouns; undefined for everything else. */
  art?: Article;
  /** Plural form without article ("Tassen"); '-' if the noun has none. */
  pl?: string;
  /** Plural-only noun (die Eltern). */
  plOnly?: boolean;
  zh: string;
  pos: Pos;
  family: FamilyId;
  /** Monster level = recommended level of the field it lives in. */
  lvl: number;
  zone: ZoneId;
  /** Usable in the "Ich möchte …" sentence attack. */
  moechte?: boolean;
  /** For numbers: the digit prompt. */
  digit?: string;
  /** Tutorial words respawn fast. */
  tutorial?: boolean;
  /** Region the word belongs to (1 = 余烬营地, 2 = 面包集市 … 12 = 心巷). */
  region?: RegionNo;
  /** 0.7/0.8 placeholder (src/data/zoneWords.ts): the region 1–3 word this stand-in copies (examples are shared). */
  base?: string;
  /** 0.7/0.8 (游戏设计 rev 341): the field scene whose word group this word belongs to (regions 4–12 and 蚀变 words). */
  scene?: string;
  /** 0.7/0.8: second batch of its scene (row 9+), opens once half the scene's words are 半名 (游戏设计 四「每个区域」). */
  batch?: 2;
  /** 0.7/0.8 蚀变 word of segment 8, 11 or 15: lives in an old scene, `region` is the segment (level band, gear, trials). */
  erode?: ErodeSeg;
  /** 蚀变: the word this is the advanced form of; spawns once that one was written right once, 推定会 or 斩杀. */
  after?: string;
  /** Short example sentence shown in the 图鉴 card once 归名. */
  ex?: string;
}

export type FamilyId = 'zahnding' | 'echo' | 'zahlwurm' | 'sippe' | 'schild' | 'krume' | 'muenzling' | 'kram' | 'gier' | 'truhe' | 'fahrzeug' | 'nachhall' | 'wegweiser' | 'uhrwerk';
/** Region 1: camp, echogasse, schilderstrasse, aschehof. Region 2 (面包集市): markt (city), gemuesegasse, waagegasse, kornspeicher. */
export type ZoneId = 'camp' | 'echogasse' | 'schilderstrasse' | 'aschehof' | 'markt' | 'gemuesegasse' | 'waagegasse' | 'kornspeicher' | 'gleisdorf' | 'bahnhofstrasse' | 'altstadt' | 'fahrplanhalle' | LaterZoneId;
/** 0.7/0.8 regions 4–12 (src/data/zones.ts): r4hub is the town, r4a / r4b / r4c its three fields. */
export type LaterZoneId = `r${MapRegionNo}${'hub' | 'a' | 'b' | 'c'}` | `r${1 | 2 | 3}${'d' | 'e'}`;
/** Segments 4–20 (游戏设计 rev 341 / 488: 8, 11, 15 and 19 are 蚀变 on old maps, the rest are new regions with their own map). */
export type LaterRegionNo = 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15 | 16 | 17 | 18 | 19 | 20;
/** Later segments that have a map of their own. */
export type MapRegionNo = 4 | 5 | 6 | 7 | 9 | 10 | 12 | 13 | 14 | 16 | 17 | 18 | 20;
/** 蚀变 segments (the second-to-last segment of each stage). */
export type ErodeSeg = 8 | 11 | 15 | 19;
export type RegionNo = 1 | 2 | 3 | LaterRegionNo;

/** flee = 宝箱怪 / rare monster shouting 「Ich muss los!」: kill it this turn or it runs. */
export type IntentKind = 'attack' | 'defend' | 'charge' | 'heal' | 'wait' | 'flee';
/** cls = the class skill (书写者 墨水风暴 / 守护者 稳住). */
/** 0.4: inscribe = 铭刻, whisper = 低语, chorus = 齐鸣 (techniques that change the next question). */
/** item = a 药片 turn (物品栏, 2026-11-22): no question, the monsters act. */
export type Move = 'attack' | 'block' | 'break' | 'sentence' | 'skill' | 'cls' | 'inscribe' | 'whisper' | 'chorus' | 'item';

export interface Intent {
  /** What the monster will actually do. */
  kind: IntentKind;
  /** What the verb says (the icon). Differs from `kind` only for negated lines. */
  shown: Exclude<IntentKind, 'wait'>;
  hits: number;
  element: Element;
  line: string;
  zh: string;
  /** 0.4 怪的台词: the example sentence it mumbles with its own name swallowed; `full` is read out after a right answer. */
  full?: string;
  fullZh?: string;
  /** 格位姿态 (0.5, Lv7+): the article the swallowed slot needs (den, einem…); the stance must match it. */
  caseArt?: string;
  /** Which layers this line uses, for the post-fight recap. */
  layers: Array<'count' | 'element' | 'negation' | 'object' | 'time'>;
}

/** 0 = never met, 1 = 裂形, 2 = 半名, 3 = 归名. 无名 is "met 0 times". */
export interface WordProgress {
  stage: 1 | 2 | 3;
  due: number;
  firstSeen: number;
  lastSeen: number;
  relapse: number;
  correct: number;
  wrong: number;
  /** 认得: right answers on recognition questions (pick the article / meaning / German word). */
  read?: number;
  /** 会写: right answers that wrote it out (默写, 变位, 复数, 句式). 归名 always needs one. */
  write?: number;
  /** 低语 was used on it: its next appearance asks it again without the hint. */
  hinted?: boolean;
  /** 斩杀 (0.6.x): time of the first clean 会写 (待验证). Gone once verified or failed. */
  pend?: number;
  /** 斩杀: time it was retired (退役). Retired words leave the reviews; a 回响 check comes 30 days later. */
  retired?: number;
  /** 审查修订 D3: clean typed kills of its plural crowd; at CONFIG.phase.pluralRetire the crowd stops coming. */
  plOk?: number;
  /** 斩杀: the 30-day 回响 check was passed: retired for good. */
  sure?: boolean;
  /** 语境复习 (2026-11-24): context reviews passed since the last 归名 (index into CONFIG.srs.context). */
  ctx?: number;
  /** 语境复习: the gap that set `due` (for 「过期 2 个间隔」 and 越久越肥). */
  ivl?: number;
  /** 语境复习: every review passed (or the one 30-day spot check of a clean 归名): no more reviews. */
  ctxDone?: boolean;
  /** 入学测试 (2026-11-25): 推定会 since this time: counts as 归名 on trust, spot-checked one per fight. */
  placed?: number;
  /** A context review was answered wrong: back in the field as a 半名 review monster (复发中). */
  lapsed?: boolean;
  /** Before 归名: a wrong answer or a 低语 on it (a clean 归名 skips the review schedule, rev 51). */
  flaw?: boolean;
  /** Before 归名: how many answers on it were wrong (sets the first review gap: 1 → 3 days, 2+ → 1 day). */
  flawN?: number;
}

export type Quality = 'white' | 'green' | 'purple' | 'orange' | 'red';
export type Slot = 'pen' | 'coat' | 'amulet' | 'dict' | 'glasses';

export interface Affix {
  key: AffixKey;
  value: number;
}
/** 副词缀白名单 (游戏设计 九, 2026-11-23/24): damage, HP, armor pen, less damage when wrong, XP, drop rate, and
 *  per-gender damage that counts only on a right stance. Old saves' typedDmg / choiceCrit / sentenceDmg are
 *  converted to dmg in migrate() (LegacyAffixKey). */
export type AffixKey =
  | 'dmg'
  | 'hp'
  | 'pen'
  | 'vsMasc'
  | 'vsFem'
  | 'vsNeut'
  | 'wrongDmgReduce'
  | 'xp'
  | 'dropRate';
export type LegacyAffixKey = 'typedDmg' | 'choiceCrit' | 'sentenceDmg';

export interface Item {
  id: string;
  slot: Slot;
  quality: Quality;
  ilvl: number;
  name: string;
  /** Main stat: atk for pen, hp for coat, crit (fraction) for amulet, hints for dict. */
  main: number;
  affixes: Affix[];
  /** Orange legendary effect key. */
  legendary?: 'articleJudgement';
  /** 紫装德语鉴定 (0.6, 23 级): affixes hidden and inactive until Mira identifies it. */
  unidentified?: boolean;
  /** 刻字孔 (0.6, 25 级): '' = an open socket; auch / denn once engraved. */
  socket?: '' | 'auch' | 'denn';
  /** 主题套装 (101 级): the region whose set this piece belongs to. */
  set?: number;
}
