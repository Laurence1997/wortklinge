// 技能池 (游戏设计 十, Lucas 2026-11-25): one shared pool, no classes, no sentence skills. Every skill asks a layer of
// the target monster's own word that the plain attack doesn't. Skills cost nothing and run on cooldowns (turns).
// Slots: 2 at 10, 3 at 30, 4 at 61. At 10 Greta gives 墨水风暴 and 稳住; later skills come with the level
// (each zone's mentor hands them over).

import type { GameState } from './state';
import type { Word } from './types';
import { CONJ } from '../data/verbs';
import { PREP_VERBS } from '../data/grammar/prepVerbs';
import { WORDS } from '../data/words';

export type PoolId = 'storm' | 'steady' | 'split' | 'colloc' | 'seal' | 'dictate' | 'saying' | 'slang';
/** 短句 / 俚语 (瘦身 2026-11-25): shouted in the charm row, no cooldown, once a fight; they only take a slot. */
export const SHOUT_IDS: PoolId[] = ['saying', 'slang'];

export interface PoolSkill {
  id: PoolId;
  zh: string;
  /** Level it is handed over. */
  lv: number;
  cd: number;
  /** What it asks (Chinese, short). */
  asks: string;
  effect: string;
}

export const POOL: Record<PoolId, PoolSkill> = {
  storm: { id: 'storm', zh: '墨水风暴', lv: 10, cd: 4, asks: '连写这个词的 2–3 种变形', effect: '每写对一种 +50% 伤害；全对算会写，能当归名一击' },
  steady: { id: 'steady', zh: '稳住', lv: 10, cd: 5, asks: '一道简单题：选意思或选冠词', effect: '答对：接下来 2 次答错不扣血、不断连击；答错只保 1 次。不造成伤害' },
  split: { id: 'split', zh: '拆词', lv: 15, cd: 5, asks: '复合词写出两部分、可分动词拆开写进短句、派生词写出基础词', effect: '破甲 3 下（同难题）。拆不开的词不能放' },
  colloc: { id: 'colloc', zh: '搭配', lv: 41, cd: 4, asks: '这个词的固定搭配（warten auf）', effect: '伤害 ×1.6，写对算「会用」。没有搭配的词不能放' },
  seal: { id: 'seal', zh: '格之封印', lv: 61, cd: 6, asks: '把这个词放进要变格或变位的短句', effect: '伤害 ×1.4，写对破甲 3 下（同难题）；对精英和首领怪也有效' },
  dictate: { id: 'dictate', zh: '听写', lv: 81, cd: 4, asks: '听它喊出例句，打出被挖掉的词，不给中文', effect: '伤害 ×1.3' },
  saying: { id: 'saying', zh: '短句', lv: 3, cd: 0, asks: '打出带上的那张短句卡的整句', effect: '每场喊一次，效果看卡（单词本里选卡）；33 级起不占回合' },
  slang: { id: 'slang', zh: '俚语', lv: 50, cd: 0, asks: '在对的场合打出带上的那条俚语', effect: '每场喊一次，场合对才生效，用错有反噬（单词本里选）；不占回合' },
};

export const POOL_ORDER: PoolId[] = ['storm', 'steady', 'split', 'colloc', 'seal', 'dictate', 'saying', 'slang'];
export const SLOTS: Array<[number, number]> = [[61, 4], [30, 3], [10, 2]];
export const POOL_FROM = 10;
export const SPLIT_BREAK = true;
export const MULT: Partial<Record<PoolId, number>> = { colloc: 1.6, dictate: 1.3, seal: 1.4 };

export function slotCount(level: number): number {
  for (const [lv, n] of SLOTS) if (level >= lv) return n;
  return 0;
}

/** Skills you own: everything handed over by your level (the pool opens at 10, after the region-1 boss). */
export function owned(s: Pick<GameState, 'level' | 'pool'> & Partial<Pick<GameState, 'sayings' | 'slang'>>): PoolId[] {
  if (s.level < POOL_FROM) return [];
  return POOL_ORDER.filter((id) => {
    if (id === 'saying') return s.level >= POOL.saying.lv && Object.values(s.sayings ?? {}).some(Boolean);
    if (id === 'slang') return s.level >= POOL.slang.lv && Object.values(s.slang ?? {}).some(Boolean);
    return s.level >= POOL[id].lv || s.pool?.includes(id);
  });
}

/** Cooldown skills carried (the 「技能」 move); 短句 / 俚语 are shouted from their own row. */
export function combatSkills(s: Pick<GameState, 'level' | 'pool' | 'loadout'> & Partial<Pick<GameState, 'sayings' | 'slang'>>): PoolId[] {
  return loadout(s).filter((id) => !SHOUT_IDS.includes(id));
}

/** Is 「短句」 / 「俚语」 carried? Before the slots open (10), 「短句」 comes free. */
export function carriesShout(s: Pick<GameState, 'level' | 'pool' | 'loadout'> & Partial<Pick<GameState, 'sayings' | 'slang'>>): { saying: boolean; slang: boolean } {
  if (s.level < POOL_FROM) return { saying: s.level >= POOL.saying.lv, slang: false };
  const lo = loadout(s);
  return { saying: lo.includes('saying'), slang: lo.includes('slang') };
}

/** Skills taken into battle: the player's pick (only owned ones, up to the slots), else the first owned ones. */
export function loadout(s: Pick<GameState, 'level' | 'pool' | 'loadout'> & Partial<Pick<GameState, 'sayings' | 'slang'>>): PoolId[] {
  const own = owned(s);
  const n = slotCount(s.level);
  const pick = (s.loadout ?? []).filter((id): id is PoolId => own.includes(id as PoolId));
  const out = [...new Set(pick)].slice(0, n);
  for (const id of own) if (out.length < n && !out.includes(id) && !(s.loadout && s.loadout.length)) out.push(id);
  return out;
}

/** Put a skill in or out of the bar. False when it is not owned or the bar is full. */
export function toggleLoadout(s: GameState, id: PoolId): boolean {
  const cur = loadout(s);
  if (cur.includes(id)) {
    s.loadout = cur.filter((x) => x !== id);
    return true;
  }
  if (!owned(s).includes(id) || cur.length >= slotCount(s.level)) return false;
  s.loadout = [...cur, id];
  return true;
}

/** Skills that become owned exactly at this level (for the level-up banner). */
export function newAt(level: number): PoolId[] {
  return POOL_ORDER.filter((id) => POOL[id].lv === level);
}

// ---- 拆词 ------------------------------------------------------------------------------------------

const SEP = ['zurück', 'zusammen', 'weiter', 'vorbei', 'heraus', 'herein', 'hinaus', 'fern', 'fest', 'fort', 'statt', 'teil', 'nach', 'mit', 'auf', 'aus', 'ein', 'vor', 'weg', 'zu', 'ab', 'an', 'los', 'her', 'hin', 'um', 'bei', 'kennen', 'spazieren'];
const bare = (w: Word) => w.de.replace(/^(der|die|das|sich) /i, '');
let NOUNS: Map<string, Word> | null = null;
function nounTails(): Map<string, Word> {
  if (!NOUNS) {
    NOUNS = new Map();
    for (const w of WORDS) if (w.art && !w.de.includes(' ') && bare(w).length >= 3) NOUNS.set(bare(w).toLowerCase(), w);
  }
  return NOUNS;
}

export interface SplitTask {
  kind: 'compound' | 'separable';
  /** What the player types: "Haupt + Bahnhof", or the short sentence with the verb split. */
  answer: string;
  /** Accepted parts (compound) — both must appear. */
  parts?: string[];
  prompt: string;
}

/** How this word splits, or null (拆词 can't target it). Compounds: the longest known noun at the end with 3+ letters
 *  left in front; separable verbs: a known prefix with a conjugated stem; derived words wait for the 词族 column. */
export function splitOf(w: Word): SplitTask | null {
  const b = bare(w);
  if (w.pos === 'v' && !b.includes(' ')) {
    const pre = SEP.find((p) => b.startsWith(p) && b.length > p.length + 3);
    if (pre) {
      const stem = b.slice(pre.length);
      const c = CONJ[stem] ?? CONJ[b];
      const ich = c?.forms.ich ?? (stem.endsWith('en') ? `${stem.slice(0, -2)}e` : null);
      if (ich) return { kind: 'separable', answer: `Ich ${ich} ${pre}`, prompt: `拆词：用 ich 说「${w.zh}」，把 ${b} 拆开（Ich … ${pre}）` };
    }
  }
  if (w.art && !b.includes(' ')) {
    const low = b.toLowerCase();
    const tails = nounTails();
    for (let i = 3; i <= low.length - 3; i++) {
      const tail = tails.get(low.slice(i));
      if (tail && tail.id !== w.id) {
        const head = b.slice(0, i).replace(/s$/, '');
        const front = head.charAt(0).toUpperCase() + head.slice(1);
        return { kind: 'compound', parts: [front, bare(tail)], answer: `${front} + ${bare(tail)}`, prompt: `拆词：${w.art} ${b} 由哪两部分组成？写成「前 + 后」` };
      }
    }
  }
  return null;
}

export function gradeSplit(t: SplitTask, input: string): boolean {
  const k = (x: string) => x.toLowerCase().replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss').replace(/[.!?]/g, '').replace(/\s+/g, ' ').trim();
  if (t.kind === 'compound') {
    const parts = k(input).split(/\s*[+\-\s]\s*/).filter(Boolean);
    return t.parts!.every((p) => parts.includes(k(p).replace(/s$/, '')) || parts.includes(k(p)));
  }
  return k(input) === k(t.answer) || k(input).startsWith(k(t.answer).split(' ').slice(0, 2).join(' ')) && k(input).endsWith(k(t.answer).split(' ').slice(-1)[0]);
}

// ---- 搭配 ------------------------------------------------------------------------------------------

/** A fixed pairing of this word: verb + preposition from the 动介 table. Null when there is none. */
export function collocOf(w: Word): { prep: string; zh: string; caseZh: string; combo: string; ex: string; exZh: string } | null {
  const b = bare(w);
  const row = PREP_VERBS.find((x) => x.fixed && x.combo.replace(/^sich /, '').split(' ')[0] === b);
  if (!row) return null;
  return { prep: row.prep, zh: row.zh, caseZh: row.kasus === 'A' ? '第四格' : row.kasus === 'D' ? '第三格' : '', combo: row.combo, ex: row.ex, exZh: row.exZh };
}

/** Can this skill target this word at all? */
export function canTarget(id: PoolId, w: Word): boolean {
  if (id === 'split') return !!splitOf(w);
  if (id === 'colloc') return !!collocOf(w);
  return true;
}
