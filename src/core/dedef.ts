// 德语释义界面规则 (1.0.12, Lucas 2026-11-28; 游戏设计 七「前期中文、后期德德」): which words show their German
// definition (LEX_DEF_DE), where it goes beside or instead of the Chinese, the first-letter hint of a write prompt
// that shows a definition, and the 近义 tolerance (a synonym from LEX_REL is not wrong, only "再想想").

import { LEX_DEF_DE, LEX_REL } from '../data/lexicon';
import { fullForm, hasArticleQuestion, WORD_BY_ID } from '../data/words';
import { gradeTyped, normalize } from './grading';
import type { Settings } from './state';
import type { Word } from './types';

/** 释义语言 setting: 自动 (by the word's level) / 中文优先 / 德语优先. Absent = auto. */
export type DefLang = 'auto' | 'zh' | 'de';

export const DEF_LANG_ZH: Record<DefLang, string> = { auto: '自动', zh: '中文优先', de: '德语优先' };

/** How a word's meaning shows: zh = Chinese only; zhDe = Chinese with one German line under it;
 *  de = the German definition instead of the Chinese (the Chinese one tap away, or after a miss). */
export type DefTier = 'zh' | 'zhDe' | 'de';

/** Word levels of the automatic tiers: up to 80 Chinese only, 81–120 Chinese + German, 121+ German. */
export const DEF_ZHDE_FROM = 81;
export const DEF_DE_FROM = 121;

/** The word's German definition, or null. The word itself is written as 「…」 in it. */
export function defDe(w: Pick<Word, 'id'> & { defDe?: string }): string | null {
  return LEX_DEF_DE[w.id] ?? w.defDe ?? null;
}

export function defLangOf(settings: Pick<Settings, 'defLang'> | undefined): DefLang {
  const v = settings?.defLang;
  return v === 'zh' || v === 'de' ? v : 'auto';
}

/** The tier this word shows in. Words without a definition always show Chinese. */
export function defTier(w: Pick<Word, 'id' | 'lvl'> & { defDe?: string }, settings: Pick<Settings, 'defLang'> | undefined): DefTier {
  if (!defDe(w)) return 'zh';
  const lang = defLangOf(settings);
  if (lang === 'de') return 'de';
  if (lang === 'zh') return 'zhDe';
  return w.lvl >= DEF_DE_FROM ? 'de' : w.lvl >= DEF_ZHDE_FROM ? 'zhDe' : 'zh';
}

/** 首字母 + 字母数: 「b _ _ _ _ _ _ _ _」; words of a phrase are kept apart by a wider gap. Letters only are
 *  counted; a hyphen or apostrophe stays as it is. */
export function letterHint(de: string): string {
  let first = true;
  return de
    .trim()
    .split(/\s+/)
    .map((word) =>
      Array.from(word)
        .map((ch) => {
          if (!/\p{L}/u.test(ch)) return ch;
          if (first) {
            first = false;
            return ch;
          }
          return '_';
        })
        .join(' '),
    )
    .join('   ');
}

/** How many letters the hint stands for. */
export function letterCount(de: string): number {
  return Array.from(de).filter((ch) => /\p{L}/u.test(ch)).length;
}

/** The hint line under a German definition: always the word's dictionary form (no article, so the gender is not given away). */
export function defHintLine(w: Word): string {
  return `${letterHint(w.de)}（${letterCount(w.de)} 个字母）`;
}

/** 近义 words of the target (relations.tsv), as words the game knows. */
export function synonymsOf(w: Pick<Word, 'id'>): Word[] {
  return (LEX_REL[w.id]?.[1] ?? []).map((id) => WORD_BY_ID[id]).filter((x): x is Word => !!x && x.id !== w.id);
}

/** Questions that ask the target word written out (not a choice, not a sentence, not several boxes). */
export interface SynQuestion {
  type: string;
  answer?: string;
  options?: string[];
  withArticle?: boolean;
  clozeMode?: string;
  dict?: boolean;
  pat?: boolean;
  write?: string;
  mates?: string[];
  pool?: string;
  gram?: unknown;
  echo?: unknown;
  say?: unknown;
}

export const SYN_NOTE = '意思对，但不是这个词，再想想';

/**
 * 近义容错: the typed answer is a 近义 word of the target, compared like a normal answer (umlaut spellings, the
 * article where the question wants one; in a sentence slot the slot's article / adjective words in front of it, or
 * the bare word). Returns that synonym, or null — also when the answer is simply right.
 */
export function synonymHit(q: SynQuestion, w: Word, input: string): Word | null {
  if (!input.trim() || q.options?.length || q.mates?.length || q.pat || q.write || q.gram || q.echo || q.say || q.pool) return null;
  const syns = synonymsOf(w);
  if (!syns.length) return null;
  if (q.type === 'typed') {
    const art = !!q.withArticle;
    if (q.answer !== fullForm(w) && q.answer !== w.de) return null;
    if (gradeTyped(input, w, art && hasArticleQuestion(w)).ok) return null;
    return syns.find((x) => gradeTyped(input, x, art && hasArticleQuestion(x)).ok || (!hasArticleQuestion(x) && gradeTyped(input, x, false).ok)) ?? null;
  }
  if (q.type === 'cloze' && q.answer && (q.dict || q.clozeMode === 'base' || q.clozeMode === 'form')) {
    const nIn = normalize(input);
    if (nIn === normalize(q.answer)) return null;
    // The slot's words in front of the target (einen / einen großen) stay; the synonym takes the last word's place.
    const lead = normalize(q.answer).split(' ').slice(0, -1).join(' ');
    return (
      syns.find((x) => {
        const forms = [x.de, fullForm(x), ...(x.pl && x.pl !== '-' ? [x.pl] : [])].map(normalize);
        return forms.some((f) => nIn === f || (lead && nIn === `${lead} ${f}`));
      }) ?? null
    );
  }
  return null;
}
