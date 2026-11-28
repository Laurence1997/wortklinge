// 完形填空 (游戏设计 › 招式): the monster shouts a whole sentence with its own word blanked out.
// Lv1–5 pick from three, Lv6–10 type the dictionary form, Lv11+ type the form the sentence needs
// (den Tee, zwei Äpfel, nimmst). Only the blank is graded.

import { levenshtein, normalize } from './grading';
import { pick, shuffle, type Rng } from './rng';
import type { Word } from './types';
import { EX1 } from '../data/examples1';
import { EX2 } from '../data/examples2';
import { EX3 } from '../data/examples3';
import { EX4 } from '../data/examples4';
import { LEX_EX } from '../data/lexicon';
import { genderOf, WORDS } from '../data/words';

export type ClozeMode = 'pick' | 'base' | 'form';

/** Hand-written sentences of the old 640 words first (where the id is still in the 6000-word list), then the list's
 *  own example sentences with their blank marked by scripts/build_lexicon.py. */
export const EXAMPLES: Record<string, string[]> = { ...EX1, ...EX2, ...EX3, ...EX4 };
for (const [id, lines] of Object.entries(LEX_EX)) EXAMPLES[id] = [...(EXAMPLES[id] ?? []), ...lines.filter((l) => !EXAMPLES[id]?.includes(l))];
// Hand-written sentences of old words that are not in the 6000-word list are dropped.
{
  const ids = new Set(WORDS.map((w) => w.id));
  for (const id of Object.keys(EXAMPLES)) if (!ids.has(id)) delete EXAMPLES[id];
}

export interface Cloze {
  /** Sentence with ___ where the answer goes. */
  shown: string;
  /** The full sentence, read aloud after the answer. */
  full: string;
  zh: string;
  answer: string;
}

const key = (v: string) => normalize(v).replace(/\s+/g, ' ').trim();

export function parse(line: string): { before: string; blank: string; after: string; zh: string } | null {
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

/** 终极技能 (30 级, 句型填空版) for words without a noun pattern: one of the word's example sentences with two
 *  blanks, the word's own form and another word of the sentence (preferring words you know). */
export function twoBlank(w: Word, rng: Rng, known: (x: Word) => boolean): { frame: string; zh: string; blanks: [string, string]; full: string } | null {
  const bare = (de: string) => de.replace(/^(der|die|das|sich) /i, '');
  const cands = WORDS.filter((x) => x.id !== w.id && x.pos !== 'phr' && !x.digit && bare(x.de).length >= 3 && !bare(x.de).includes(' '));
  const options: Array<{ frame: string; zh: string; blanks: [string, string]; full: string; k: boolean }> = [];
  for (const line of EXAMPLES[w.id] ?? []) {
    const p = parse(line);
    if (!p || !p.zh) continue;
    for (const side of ['before', 'after'] as const) {
      for (const x of cands) {
        const re = new RegExp(`(^|[^A-Za-zÄÖÜäöüß])(${bare(x.de)})(?=$|[^A-Za-zÄÖÜäöüß])`, 'i');
        const m = re.exec(p[side]);
        if (!m) continue;
        const cut = p[side].slice(0, m.index + m[1].length) + '___' + p[side].slice(m.index + m[0].length);
        const frame = side === 'before' ? `${cut}___${p.after}` : `${p.before}___${cut}`;
        const blanks: [string, string] = side === 'before' ? [m[2], p.blank] : [p.blank, m[2]];
        options.push({ frame, zh: p.zh, blanks, full: p.before + p.blank + p.after, k: known(x) });
      }
    }
  }
  if (!options.length) return null;
  const good = options.filter((o) => o.k);
  const o = pick(rng, good.length ? good : options);
  return { frame: o.frame, zh: o.zh, blanks: o.blanks, full: o.full };
}

/** Two wrong options of the same kind of word, from the same region. */
export function clozeOptions(w: Word, answer: string, rng: Rng): string[] {
  const pool = WORDS.filter((x) => x.id !== w.id && x.pos === w.pos && (x.region ?? 1) === (w.region ?? 1) && key(x.de) !== key(answer));
  const wrong = shuffle(rng, pool).slice(0, 2).map((x) => x.de);
  return shuffle(rng, [answer, ...wrong]);
}

export function gradeCloze(input: string, answer: string, w?: Word, zh?: string): boolean {
  if (key(input) === key(answer)) return true;
  // 0.6.x: when the Chinese does not say which determiner (一个 / 这 / 我的 / 没有), any article of the right case
  // and gender counts, as in the A1 exam (den or einen, dem or einem).
  if (!w || zh === undefined || ZH_DET.test(zh.replace(ZH_NOT_DET, ''))) return false;
  const alts = sameCaseArticles(answer, w);
  const [idet, ...irest] = input.trim().split(/\s+/);
  const rest = answer.trim().split(/\s+/).slice(1);
  // A negated answer (kein Nachbar) is only matched by another kein form, never by der / ein.
  if (/^kein/i.test(answer.trim()) && !/^kein/i.test(idet ?? '')) return false;
  return !!alts && !!idet && key(irest.join(' ')) === key(rest.join(' ')) && alts.includes(idet.toLowerCase());
}

/** 这 / 那 that do not stand on a noun: 这是 (das ist), 这里, 那么, 这样. */
const ZH_NOT_DET = /[这那](?:就|也|可|真|才|都)?是|[这那](?:里|儿|么|样)/g; // not 这不是: that one asks for kein
/** Chinese that names the determiner: 一个/一杯…, 这/那, 我的…, 没有. */
const ZH_DET = /[一两][个位只张本件杯块条把台辆间双份种家盒瓶袋根片口所部盏碗套首封]|喝杯|这|那|[我你他她它您]们?的|没有/;

const CASE_ARTS: Record<Case, Record<'m' | 'f' | 'n' | 'pl', string[]>> = {
  nom: { m: ['der', 'ein', 'kein'], f: ['die', 'eine', 'keine'], n: ['das', 'ein', 'kein'], pl: ['die', 'keine'] },
  acc: { m: ['den', 'einen', 'keinen'], f: ['die', 'eine', 'keine'], n: ['das', 'ein', 'kein'], pl: ['die', 'keine'] },
  dat: { m: ['dem', 'einem', 'keinem'], f: ['der', 'einer', 'keiner'], n: ['dem', 'einem', 'keinem'], pl: ['den', 'keinen'] },
};

/** The articles of the answer's case for this noun's gender, or null when the answer is not article + noun. */
function sameCaseArticles(answer: string, w: Word): string[] | null {
  const [det, ...rest] = answer.trim().split(/\s+/);
  const noun = key(rest.join(' '));
  // Singular dictionary form, or the plural (with the dative -n): plural only takes die / keine, den / keinen.
  const g = noun === key(w.de) ? genderOf(w) : w.pl && (noun === key(w.pl) || noun === key(w.pl + 'n')) ? 'pl' : null;
  if (w.pos !== 'n' || !g || !rest.length || !det) return null;
  const d = det.toLowerCase();
  if (!/^(d(er|ie|as|en|em)|k?ein(e|en|em|er)?)$/.test(d)) return null;
  const c = caseOf(g, g === 'pl' ? ({ keine: 'die', keinen: 'den' } as Record<string, string>)[d] ?? d : d.replace(/^k/, ''));
  if (!c) return null;
  const list = CASE_ARTS[c][g];
  return list.includes(d) ? list : null;
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

/** Words a whole sentence keeps its meaning without (intensifiers, ja, bitte). gern stays a key word; gerne = gern. */
const OPTIONAL = new Set(['sehr', 'wirklich', 'echt', 'ganz', 'ziemlich', 'total', 'ja', 'bitte']);
let sameZh: Map<string, string[]> | null = null;
/** Every example sentence with this Chinese (the data sometimes words one Chinese line two ways). */
function sentencesWithZh(zh: string): string[] {
  if (!sameZh) {
    sameZh = new Map();
    for (const lines of Object.values(EXAMPLES))
      for (const l of lines) {
        const p = parse(l);
        if (!p || !p.zh) continue;
        const list = sameZh.get(p.zh) ?? [];
        list.push((p.before + p.blank + p.after).trim());
        sameZh.set(p.zh, list);
      }
  }
  return sameZh.get(zh) ?? [];
}

/**
 * 终结技「看中文，写整句」(1.0.11 试玩): the key words of the sentence, in order, with nothing else but optional words
 * (sehr, wirklich, bitte …) added or left out; gerne counts as gern. The monster's own word is never optional. Another example
 * sentence with the very same Chinese also counts if it keeps the monster's word (水很凉。 = Das Wasser ist kalt.).
 */
export function gradeWholeSentence(input: string, answer: string, w: Word, zh?: string): { ok: boolean; exact: boolean } {
  if (key(input) === key(answer)) return { ok: true, exact: true };
  const toks = (v: string) => key(v).split(' ').filter(Boolean).map((t) => (t === 'gerne' ? 'gern' : t));
  const own = new Set(toks(w.art ? w.de.replace(/^(der|die|das)\s+/i, '') : w.de));
  const core = (v: string) => toks(v).filter((t) => own.has(t) || !OPTIONAL.has(t)).join(' ');
  const mine = core(input);
  if (!mine) return { ok: false, exact: false };
  // Another sentence with the same Chinese counts only if it keeps the monster's word as the stored sentence has it
  // (Brieftasche: "Ich kann mein Portemonnaie nicht finden." is a fine translation but does not use the word).
  const kept = toks(answer).filter((t) => own.has(t));
  const alts = (zh ? sentencesWithZh(zh) : []).filter((a) => { const at = toks(a); return kept.every((t) => at.includes(t)); });
  const ok = [answer, ...alts].some((a) => core(a) === mine);
  return { ok, exact: false };
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
/** haben / sein (0.6, region 3 Lv21+): the Perfekt stance of verb monsters. */
/** kein stance (语法线 5, Lucas 2026-11-25): on a line whose slot needs kein, these replace the ein buttons. */
export const KEIN_STANCES = ['kein', 'keine', 'keinen', 'keinem', 'keiner'] as const;
export type Stance = (typeof STANCES)[number] | (typeof KEIN_STANCES)[number] | 'haben' | 'sein';
const CASE_OF: Record<'m' | 'f' | 'n' | 'pl', Partial<Record<Stance, Case>>> = {
  m: { der: 'nom', ein: 'nom', den: 'acc', einen: 'acc', dem: 'dat', einem: 'dat', kein: 'nom', keinen: 'acc', keinem: 'dat' },
  f: { die: 'nom', eine: 'nom', der: 'dat', einer: 'dat', keine: 'nom', keiner: 'dat' },
  n: { das: 'nom', ein: 'nom', dem: 'dat', einem: 'dat', kein: 'nom', keinem: 'dat' },
  pl: { die: 'nom', den: 'dat', keine: 'nom', keinen: 'dat' },
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
  return (STANCES as readonly string[]).includes(first) || (KEIN_STANCES as readonly string[]).includes(first) ? first : null;
}

const PREPS = new Set(['in', 'an', 'auf', 'mit', 'zu', 'von', 'bei', 'aus', 'nach', 'für', 'durch', 'um', 'ohne', 'gegen', 'neben', 'über', 'unter', 'vor', 'hinter', 'zwischen', 'im', 'am', 'zum', 'zur', 'vom', 'beim']);

/** 突破试炼 · 语法 (0.6.x): example sentences of this noun whose slot is article + noun in the accusative or dative
 *  (by the 格位姿态 table), with only the article blanked: Ich fahre mit ___ Bus. (dem)
 *  The table only marks den / einen as accusative, so accusative clozes are always masculine nouns (docs 0.6.x:
 *  feminine and neuter accusatives look like the nominative and test nothing). */
export function caseClozes(w: Word, want: 'acc' | 'dat'): Array<{ shown: string; full: string; zh: string; answer: string; prep: string | null }> {
  if (!w.art) return [];
  const g = (w.plOnly ? 'pl' : w.art === 'der' ? 'm' : w.art === 'die' ? 'f' : 'n') as 'm' | 'f' | 'n' | 'pl';
  const out: Array<{ shown: string; full: string; zh: string; answer: string; prep: string | null }> = [];
  for (const line of EXAMPLES[w.id] ?? []) {
    const p = parse(line);
    if (!p) continue;
    const toks = p.blank.split(' ');
    if (toks.length !== 2 || toks[1] !== w.de) continue;
    if (caseOf(g, toks[0]) !== want) continue;
    const prev = p.before.trim().split(/\s+/).pop()?.toLowerCase() ?? '';
    out.push({ shown: `${p.before}___ ${toks[1]}${p.after}`.replace(/\s+/g, ' ').trim(), full: (p.before + p.blank + p.after).trim(), zh: p.zh, answer: toks[0], prep: PREPS.has(prev) ? prev : null });
  }
  return out;
}

/** ihn / sie / es (0.5, Lv7+): example sentences whose slot is den/die/das + the noun as an object
 *  (not at the start, not after a preposition), turned into a pronoun cloze: Ich trinke den Tee. → Ich trinke ___. (ihn) */
const COPULA = new Set(['bin', 'bist', 'ist', 'sind', 'seid', 'war', 'warst', 'waren', 'wart', 'sei', 'heiße', 'heißt', 'heißen', 'hieß', 'werde', 'wirst', 'wird', 'werden', 'werdet', 'wurde', 'bleibe', 'bleibst', 'bleibt', 'bleiben']);
const MIDFIELD = new Set(['bitte', 'hier', 'da', 'dort', 'mal', 'jetzt', 'heute', 'morgen', 'gern', 'gerne', 'auch', 'noch', 'schon', 'immer', 'oft', 'mir', 'dir', 'ihm', 'uns', 'euch', 'ihnen']);

/** A comma (relative clauses always have one) or a subordinating conjunction: a clause the pronoun swap can't handle. */
const SUBCLAUSE = /,|\b(weil|dass|wenn|ob|obwohl|damit|bevor|nachdem|während|falls|sodass|seitdem)\b/i;

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
    // 从句和关系从句 (6000-word examples have them): the slot's position rules differ there, so skip any sentence
    // with a comma or a subordinating word / relative pronoun after a comma.
    if (SUBCLAUSE.test(`${p.before} ${p.after}`)) continue;
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
  // 0.6.x: a sentence that shows the word again outside the blank (plural, compound) is never a line.
  const clean = parsed.map((_, i) => i).filter((i) => !showsWord(w, parsed[i].before + ' ' + parsed[i].after));
  const base = clean.length ? clean : parsed.map((_, i) => i);
  const idxs = base.filter((i) => !ok || ok(i));
  const pool = idxs.length ? idxs : base;
  const idx = pool[n % pool.length];
  const p = parsed[idx];
  const line = `${p.before}… mmh …${p.after}`.replace(/\s+/g, ' ').trim();
  return { line, zh: maskZh(p.zh, w), full: (p.before + p.blank + p.after).trim(), fullZh: p.zh, idx };
}

/** Whether German text shows this word (or its plural / a compound with it) outside the blank. */
export function showsWord(w: Word, text: string): boolean {
  const forms = [w.de, w.pl].filter((x): x is string => !!x).map((x) => key(x)).filter((x) => !x.includes(' '));
  return key(text)
    .split(/[^a-z]+/)
    .some((t) => forms.some((f) => (f.length >= 4 ? t.includes(f) : t === f)));
}

/** 0.6.x: every sense of the word is blanked in the Chinese, every time it appears; nothing to blank → a mumble. */
export function maskZh(zh: string, w: Word): string {
  // Brackets hold hints (「姓（正式说法）」), not senses: only the senses get blanked.
  const senses = w.zh.replace(/（[^）]*）|\([^)]*\)/g, '').split(/[；;，,、/]/).map((x) => x.trim()).filter((x) => x.length > 0).sort((a, b) => b.length - a.length);
  let out = zh;
  for (const z of senses) out = out.split(z).join('……');
  return out === zh ? '（它含糊地念着什么，听不清。）' : out.replace(/(……)+/g, '……');
}

const GENDER_ZH = { m: '阳性', f: '阴性', n: '中性', pl: '复数' } as const;
const DET = /^(d(?:er|ie|as|en|em|es)|(?:k|m|d|s)?ein|ihr|unser|eu(?:e)?r)(e|en|em|er|es)?$/;

/** The ein-family ending a determiner shows (meinen → einen, keiner → einer), or the word itself for der/die/das. */
function detBase(d: string): string | null {
  const m = DET.exec(d);
  if (!m) return null;
  return m[1].startsWith('d') && !m[2] ? m[1] : `ein${m[2] ?? ''}`;
}

/** 完形填空答错讲清原因 (0.6.x): for an article + noun answer, one line of the case rule and one line on the input
 *  (wrong ending, or a right ending on another determiner). Empty when the answer is not article + noun. */
export function clozeWhy(answer: string, w: Word, input: string): string[] {
  const g = genderOf(w);
  const [det, ...rest] = answer.trim().split(/\s+/);
  const base = det ? detBase(det.toLowerCase()) : null;
  if (w.pos !== 'n' || !g || !rest.length || !base || key(rest.join(' ')) !== key(w.de)) return [];
  const c = caseOf(g, base);
  if (!c) return []; // e.g. a plural form (die Äpfel) of a masculine noun: no gender rule to give
  // 试玩 #46: the right article and the noun only a letter or two off is a spelling slip, not a case mistake.
  const [idet0, ...irest0] = input.trim().split(/\s+/);
  const inoun = irest0.join(' ');
  if (idet0 && inoun && key(idet0) === key(det) && key(inoun) !== key(w.de) && levenshtein(key(inoun), key(w.de)) <= (w.de.length >= 6 ? 2 : 1)) {
    return [`冠词和格都对，只是拼写错了：${w.de}（你写的是 ${inoun}）。`];
  }
  const rule =
    c === 'acc'
      ? '这里是动词的直接宾语，用第四格：阳性 der → den，ein → einen；阴性、中性不变。'
      : c === 'dat'
        ? '这里用第三格：阳性和中性 dem / einem，阴性 der / einer，复数 den。'
        : g === 'm'
          ? '这里是主语，用第一格：阳性 der / ein。'
          : '阴性、中性和复数的第一格和第四格同形：die / eine，das / ein，复数 die。';
  const out = [rule];
  const [idet, ...irest] = input.trim().split(/\s+/);
  if (idet && irest.length && key(irest.join(' ')) === key(rest.join(' ')) && key(idet) !== key(det)) {
    const ib = detBase(idet.toLowerCase());
    out.push(ib === base && base.startsWith('ein') ? `格是对的，但这里要用 ${det}（看中文）。` : `冠词词尾不对：${rest.join(' ')} 是${GENDER_ZH[g]}，这里要 ${det}。`);
  }
  return out;
}
