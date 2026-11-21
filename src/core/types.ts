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

/** flee = 宝箱怪 / rare monster shouting 「Ich muss los!」: kill it this turn or it runs. */
export type IntentKind = 'attack' | 'defend' | 'charge' | 'heal' | 'wait' | 'flee';
/** cls = the class skill (书写者 墨水风暴 / 守护者 稳住). */
/** 0.4: inscribe = 铭刻, whisper = 低语, chorus = 齐鸣 (techniques that change the next question). */
export type Move = 'attack' | 'block' | 'break' | 'sentence' | 'skill' | 'cls' | 'inscribe' | 'whisper' | 'chorus';

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
  layers: Array<'count' | 'element' | 'negation' | 'object'>;
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
