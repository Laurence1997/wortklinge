// 完形填空 (游戏设计 › 招式): the monster shouts a whole sentence with its own word blanked out.
// Lv1–5 pick from three, Lv6–10 type the dictionary form, Lv11+ type the form the sentence needs
// (den Tee, zwei Äpfel, nimmst). Only the blank is graded.

import { normalize } from './grading';
import { pick, shuffle, type Rng } from './rng';
import type { Word } from './types';
import { EX1 } from '../data/examples1';
import { EX2 } from '../data/examples2';
import { WORDS } from '../data/words';

export type ClozeMode = 'pick' | 'base' | 'form';

export const EXAMPLES: Record<string, string[]> = { ...EX1, ...EX2 };

export interface Cloze {
  /** Sentence with ___ where the answer goes. */
  shown: string;
  /** The full sentence, read aloud after the answer. */
  full: string;
  zh: string;
  answer: string;
}

const key = (v: string) => normalize(v).replace(/\s+/g, ' ').trim();

function parse(line: string): { before: string; blank: string; after: string; zh: string } | null {
  const [de, zh = ''] = line.split('|');
  const m = /^(.*)\{([^}]+)\}(.*)$/.exec(de);
  return m ? { before: m[1], blank: m[2], after: m[3], zh } : null;
}

/** Example sentences split just before the word: a = the head, b = the word and the rest (接句怪). */
export function exampleSplits(w: Word): Array<{ a: string; b: string; zh: string }> {
  return (EXAMPLES[w.id] ?? [])
    .map(parse)
    .filter((x): x is NonNullable<typeof x> => !!x && !!x.before.trim())
    .map((p) => ({ a: p.before.trim(), b: (p.blank + p.after).replace(/\s+/g, ' ').trim(), zh: p.zh }));
}

export function hasExamples(w: Word): boolean {
  return !!EXAMPLES[w.id]?.length;
}

export function clozeModeFor(level: number): ClozeMode {
  return level >= 11 ? 'form' : level >= 6 ? 'base' : 'pick';
}

/** Builds a cloze for this word, or null when it has no fitting sentence. */
export function makeCloze(w: Word, mode: ClozeMode, rng: Rng): Cloze | null {
  const parsed = (EXAMPLES[w.id] ?? []).map(parse).filter((x): x is NonNullable<typeof x> => !!x);
  if (!parsed.length) return null;
  const base = key(w.de);
  const tail = (b: string) => key(b).split(' ').slice(-base.split(' ').length).join(' ');
  if (mode === 'form') {
    // Prefer a sentence where the form differs from the dictionary form (that is the point of this step).
    const changed = parsed.filter((p) => key(p.blank) !== base);
    const p = pick(rng, changed.length ? changed : parsed);
    return { shown: `${p.before}___${p.after}`, full: p.before + p.blank + p.after, zh: p.zh, answer: p.blank };
  }
  // pick / base: only the dictionary form is blanked; the rest of the braces stays in the sentence.
  const fits = parsed.filter((p) => tail(p.blank) === base);
  if (!fits.length) return null;
  const p = pick(rng, fits);
  const words = p.blank.split(' ');
  const n = w.de.split(' ').length;
  const keep = words.slice(0, words.length - n).join(' ');
  const answer = words.slice(words.length - n).join(' ');
  return { shown: `${p.before}${keep ? keep + ' ' : ''}___${p.after}`, full: p.before + p.blank + p.after, zh: p.zh, answer };
}

/** Two wrong options of the same kind of word, from the same region. */
export function clozeOptions(w: Word, answer: string, rng: Rng): string[] {
  const pool = WORDS.filter((x) => x.id !== w.id && x.pos === w.pos && (x.region ?? 1) === (w.region ?? 1) && key(x.de) !== key(answer));
  const wrong = shuffle(rng, pool).slice(0, 2).map((x) => x.de);
  return shuffle(rng, [answer, ...wrong]);
}

export function gradeCloze(input: string, answer: string): boolean {
  return key(input) === key(answer);
}

/** 终结技 fallback for words without a sentence pattern: one of the word's example sentences, or a template
 *  for phrases, names, question words and numbers. Every word gets one. */
export function wholeSentence(w: Word, rng: Rng): { zh: string; answer: string } {
  const parsed = (EXAMPLES[w.id] ?? []).map(parse).filter((x): x is NonNullable<typeof x> => !!x && !!x.zh);
  if (parsed.length) {
    const p = pick(rng, parsed);
    return { zh: p.zh, answer: (p.before + p.blank + p.after).trim() };
  }
  if (w.pos === 'phr') return { zh: w.zh, answer: w.de };
  if (w.pos === 'num') return { zh: `我数到 ${w.digit ?? w.zh}。`, answer: `Ich zähle bis ${w.de}.` };
  if (w.pos === 'q') return Q_TEMPLATES[w.id] ?? { zh: w.zh, answer: w.de };
  if (w.pos === 'name') return LANGS.includes(w.id) ? { zh: `我说${w.zh}。`, answer: `Ich spreche ${w.de}.` } : { zh: `我来自${w.zh}。`, answer: `Ich komme aus ${w.de}.` };
  return { zh: w.zh, answer: w.de };
}

const LANGS = ['deutsch', 'chinesisch', 'englisch'];
const Q_TEMPLATES: Record<string, { zh: string; answer: string }> = {
  wer: { zh: '这是谁？', answer: 'Wer ist das?' },
  was: { zh: '这是什么？', answer: 'Was ist das?' },
  wo: { zh: '你在哪儿？', answer: 'Wo bist du?' },
  woher: { zh: '你从哪里来？', answer: 'Woher kommst du?' },
  wie: { zh: '你叫什么名字？', answer: 'Wie heißt du?' },
  'wie-viel': { zh: '这个多少钱？', answer: 'Wie viel kostet das?' },
};

export type Case = 'nom' | 'acc' | 'dat';
/** 格位姿态: the stances (articles) that can be picked, in key order 1–9, 0. */
export const STANCES = ['der', 'die', 'das', 'den', 'ein', 'eine', 'einen', 'dem', 'einem', 'einer'] as const;
export type Stance = (typeof STANCES)[number];
const CASE_OF: Record<'m' | 'f' | 'n' | 'pl', Partial<Record<Stance, Case>>> = {
  m: { der: 'nom', ein: 'nom', den: 'acc', einen: 'acc', dem: 'dat', einem: 'dat' },
  f: { die: 'nom', eine: 'nom', der: 'dat', einer: 'dat' },
  n: { das: 'nom', ein: 'nom', dem: 'dat', einem: 'dat' },
  pl: { die: 'nom', den: 'dat' },
};

/** Which case an article shows for a noun of this gender (die Tasse = nom/acc → nom), or null when it doesn't fit. */
export function caseOf(g: 'm' | 'f' | 'n' | 'pl' | null, art: string | null): Case | null {
  if (!g || !art) return null;
  return CASE_OF[g][art.toLowerCase() as Stance] ?? null;
}

/** The article at the start of an example's slot ({einen Tee} → einen), or null (meine, zwei, no article). */
export function slotArticle(w: Word, n: number): string | null {
  const parsed = (EXAMPLES[w.id] ?? []).map(parse).filter((x): x is NonNullable<typeof x> => !!x);
  if (!parsed.length) return null;
  const first = parsed[n % parsed.length].blank.split(' ')[0].toLowerCase();
  return (STANCES as readonly string[]).includes(first) ? first : null;
}

const PREPS = new Set(['in', 'an', 'auf', 'mit', 'zu', 'von', 'bei', 'aus', 'nach', 'für', 'durch', 'um', 'ohne', 'gegen', 'neben', 'über', 'unter', 'vor', 'hinter', 'zwischen', 'im', 'am', 'zum', 'zur', 'vom', 'beim']);

/** ihn / sie / es (0.5, Lv7+): example sentences whose slot is den/die/das + the noun as an object
 *  (not at the start, not after a preposition), turned into a pronoun cloze: Ich trinke den Tee. → Ich trinke ___. (ihn) */
const COPULA = new Set(['bin', 'bist', 'ist', 'sind', 'seid', 'war', 'warst', 'waren', 'wart', 'sei', 'heiße', 'heißt', 'heißen', 'hieß', 'werde', 'wirst', 'wird', 'werden', 'werdet', 'wurde', 'bleibe', 'bleibst', 'bleibt', 'bleiben']);
const MIDFIELD = new Set(['bitte', 'hier', 'da', 'dort', 'mal', 'jetzt', 'heute', 'morgen', 'gern', 'gerne', 'auch', 'noch', 'schon', 'immer', 'oft', 'mir', 'dir', 'ihm', 'uns', 'euch', 'ihnen']);

export function pronounClozes(w: Word): Array<{ shown: string; full: string; zh: string; answer: string }> {
  if (!w.art) return [];
  const out: Array<{ shown: string; full: string; zh: string; answer: string }> = [];
  for (const line of EXAMPLES[w.id] ?? []) {
    const p = parse(line);
    if (!p || !p.before.trim()) continue;
    const toks = p.blank.split(' ');
    if (toks.length !== 2) continue;
    const [art, noun] = toks;
    if (noun !== w.de && noun !== w.pl) continue;
    const prev = p.before.trim().split(/\s+/).pop()!.toLowerCase();
    if (PREPS.has(prev)) continue;
    // sein/heißen/werden/bleiben take a nominative: «Das ist die Nachbarin» is not an object slot.
    if (p.before.toLowerCase().split(/[^a-zäöüß]+/).some((t) => COPULA.has(t))) continue;
    // A pronoun object jumps ahead of adverbs and dative objects («Mach sie bitte an», «Gib ihn mir»),
    // so a slot behind them can't simply be swapped.
    if (MIDFIELD.has(prev)) continue;
    const plural = noun !== w.de || w.plOnly;
    const pron = art === 'den' && w.art === 'der' && !plural ? 'ihn' : art === 'das' && w.art === 'das' && !plural ? 'es' : art === 'die' && (plural || w.art === 'die') ? 'sie' : null;
    if (!pron) continue;
    const full = (p.before + p.blank + p.after).trim();
    out.push({ shown: `${full} → ${p.before}___${p.after}`.replace(/\s+/g, ' ').trim(), full: (p.before + pron + p.after).trim(), zh: p.zh, answer: pron });
  }
  return out;
}

/** 怪的台词: example sentence n (rotating) with the word swallowed — 「Ich trinke jeden Morgen … mmh …」.
 *  The Chinese is blanked the same way; when the meaning can't be found in it, the Chinese is withheld. */
export function voiceLine(w: Word, n: number, ok?: (i: number) => boolean): { line: string; zh: string; full: string; fullZh: string; idx: number } | null {
  const parsed = (EXAMPLES[w.id] ?? []).map(parse).filter((x): x is NonNullable<typeof x> => !!x);
  if (!parsed.length) return null;
  // 格位姿态: when a filter is given, rotate only through the sentences it allows (all of them if none fits).
  const idxs = parsed.map((_, i) => i).filter((i) => !ok || ok(i));
  const pool = idxs.length ? idxs : parsed.map((_, i) => i);
  const idx = pool[n % pool.length];
  const p = parsed[idx];
  const line = `${p.before}… mmh …${p.after}`.replace(/\s+/g, ' ').trim();
  const zhs = w.zh.split(/[；;，,、/（）()]/).map((x) => x.trim()).filter((x) => x.length > 0).sort((a, b) => b.length - a.length);
  const hit = zhs.find((z) => p.zh.includes(z));
  const zh = hit ? p.zh.replace(hit, '……') : '（它含糊地念着什么，听不清。）';
  return { line, zh, full: (p.before + p.blank + p.after).trim(), fullZh: p.zh, idx };
}
