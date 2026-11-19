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
  /** Region the word belongs to (1 = 余烬营地, 2 = 面包集市). */
  region?: 1 | 2;
  /** Short example sentence shown in the 图鉴 card once 归名. */
  ex?: string;
}

export type FamilyId = 'zahnding' | 'echo' | 'zahlwurm' | 'sippe' | 'schild' | 'krume' | 'muenzling' | 'kram' | 'gier' | 'truhe';
/** Region 1: camp, echogasse, schilderstrasse, aschehof. Region 2 (面包集市): markt (city), gemuesegasse, waagegasse, kornspeicher. */
export type ZoneId = 'camp' | 'echogasse' | 'schilderstrasse' | 'aschehof' | 'markt' | 'gemuesegasse' | 'waagegasse' | 'kornspeicher';

export type IntentKind = 'attack' | 'defend' | 'charge' | 'heal' | 'wait';
export type Move = 'attack' | 'block' | 'break' | 'sentence' | 'skill';

export interface Intent {
  /** What the monster will actually do. */
  kind: IntentKind;
  /** What the verb says (the icon). Differs from `kind` only for negated lines. */
  shown: Exclude<IntentKind, 'wait'>;
  hits: number;
  element: Element;
  line: string;
  zh: string;
  /** Which layers this line uses, for the post-fight recap. */
  layers: Array<'count' | 'element' | 'negation'>;
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
}

export type Quality = 'white' | 'green' | 'purple' | 'orange';
export type Slot = 'pen' | 'coat' | 'amulet' | 'dict';

export interface Affix {
  key: AffixKey;
  value: number;
}
export type AffixKey =
  | 'typedDmg'
  | 'choiceCrit'
  | 'vsMasc'
  | 'vsFem'
  | 'vsNeut'
  | 'wrongDmgReduce'
  | 'xp'
  | 'dropRate'
  | 'sentenceDmg';

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
}
