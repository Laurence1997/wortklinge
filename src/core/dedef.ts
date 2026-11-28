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

// ---- 1.0.12 sweep: one helper set for every place outside the battle card that shows a word's meaning ----

/** How a word's meaning reads in a card-like place: `main` is the line shown; `sub` the German line under the
 *  Chinese (zhDe); `hiddenZh` the Chinese a tap away (de). */
export interface MeaningLine {
  tier: DefTier;
  main: string;
  sub: string | null;
  hiddenZh: string | null;
}

export function meaningLine(w: Word, settings: Pick<Settings, 'defLang'> | undefined): MeaningLine {
  const tier = w.digit ? 'zh' : defTier(w, settings);
  const def = defDe(w);
  if (tier === 'de' && def) return { tier, main: def, sub: null, hiddenZh: w.zh };
  if (tier === 'zhDe' && def) return { tier, main: w.zh, sub: def, hiddenZh: null };
  return { tier: 'zh', main: w.zh, sub: null, hiddenZh: null };
}

/** True when this word's Chinese is hidden behind its German definition. */
export function hidesZh(w: Word, settings: Pick<Settings, 'defLang'> | undefined): boolean {
  return meaningLine(w, settings).tier === 'de';
}

/** A definition clipped for a small label. */
export function clipDef(def: string, max = 22): string {
  return def.length > max ? `${def.slice(0, max - 1).trimEnd()}…` : def;
}

/** 名牌 (Lucas 2026-11-25): the meaning in Chinese, short (first sense, no brackets), never the German letters. */
export function plateZh(w: Word): string {
  const z = w.zh.replace(/（[^）]*）|\([^)]*\)/g, '').split(/[；;，,／/]/)[0].trim() || w.zh;
  return z.length > 8 ? `${z.slice(0, 8)}…` : z;
}

/** A name plate outside battle (map label, scene list, pack log): a clipped definition while the Chinese is hidden. */
export function plateMeaning(w: Word, settings: Pick<Settings, 'defLang'> | undefined, max = 18): string {
  const m = meaningLine(w, settings);
  return m.tier === 'de' ? clipDef(m.main, max) : plateZh(w);
}

/** A definition on at most `lines` lines of about `per` characters, broken between words, the last line clipped.
 *  One clipped line kept only the filler many definitions open with ('so, dass man es…' stood on 23 plates,
 *  review 1.0.12); two lines tell almost every Lv121+ monster apart (1978 plates for 2000 words). */
export function wrapDef(def: string, per = 16, lines = 2): string {
  const out: string[] = [];
  let rest = def.trim();
  while (rest && out.length < lines - 1 && rest.length > per) {
    const cut = rest.lastIndexOf(' ', per);
    // One word longer than the line: break it with a hyphen.
    if (cut <= 0) {
      out.push(`${rest.slice(0, per - 1)}-`);
      rest = rest.slice(per - 1);
      continue;
    }
    out.push(rest.slice(0, cut).trimEnd());
    rest = rest.slice(cut).trimStart();
  }
  if (rest) out.push(clipDef(rest, per));
  return out.join('\n');
}

/** The world-map name plate: the Chinese, or the definition on two short lines while the Chinese is hidden. */
export function mapPlate(w: Word, settings: Pick<Settings, 'defLang'> | undefined, per = 16): string {
  const m = meaningLine(w, settings);
  return m.tier === 'de' ? wrapDef(m.main, per, 2) : plateZh(w);
}

/** The meaning in one short line (tags, toasts, feedback): a clipped definition while the Chinese is hidden. */
export function meaningShort(w: Word, settings: Pick<Settings, 'defLang'> | undefined, max = 28): string {
  const m = meaningLine(w, settings);
  return m.tier === 'de' ? clipDef(m.main, max) : w.zh;
}

/** A word given by its meaning in a write prompt (日记, 小作文, 对话, 造句): 「中文」, or 〔definition〕 with its first
 *  letter and letter count (德语释义界面规则 2). The German letters beyond the first are never shown. */
export function wordCue(w: Word, settings: Pick<Settings, 'defLang'> | undefined): string {
  const m = meaningLine(w, settings);
  return m.tier === 'de' ? `〔${m.main}〕 ${letterHint(w.de)} ` : `「${w.zh}」`;
}

/** The word's slot in a Chinese sentence prompt (终结技 看中文写整句): its Chinese, or 〔definition〕. */
export function slotMeaning(w: Word, settings: Pick<Settings, 'defLang'> | undefined): string {
  const m = meaningLine(w, settings);
  return m.tier === 'de' ? `〔${m.main}〕` : (w.digit ?? w.zh);
}

/** The hint line of a write prompt that names one or more words by definition: 「原形 b _ _ _（4 个字母）」 per
 *  de-tier word (numbered when there are two or more), or null when none hides its Chinese. */
export function defHintsFor(words: Word[], settings: Pick<Settings, 'defLang'> | undefined): string | null {
  const de = words.filter((x) => hidesZh(x, settings));
  if (!de.length) return null;
  const marks = ['①', '②', '③', '④'];
  return de.map((x, i) => `${de.length > 1 ? `${marks[i] ?? i + 1} ` : ''}原形 ${defHintLine(x)}`).join('   ');
}
