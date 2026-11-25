// A1 语法补全 (0.6.x, 游戏设计 十六「语法线」): kein 5 · mein/dein 6 · 情态动词 + 句尾不定式 8 · 可分动词现在时 12 ·
// 命令式 Geben Sie mir … 14. All of them hang on the word monster in front of you (语法教学统一框架: about eight in ten
// grammar questions change the word's own question type after the unlock): nouns get kein / mein / the imperative,
// verbs get the modal sentence end and the separable split. Every task is built from the word's own sentences.

import { EXAMPLES, caseOf, parse } from '../cloze';
import { chunks } from '../writing';
import { expectedSentence, PATTERNS, sentenceTags } from '../sentence';
import { pick, shuffle, type Rng } from '../rng';
import { genderOf } from '../../data/words';
import { CONJ, PERSONS, type Person } from '../../data/verbs';
import { MODAL_BUILD, MODAL_INF, SEP_EX } from '../../data/grammar/a1';
import type { Word } from '../types';
import type { GramTask } from './task';

type G = 'm' | 'f' | 'n' | 'pl';
type C = 'nom' | 'acc' | 'dat';

/** ein-type endings (kein, mein, dein …): same table for all of them. */
export const EIN_END: Record<C, Record<G, string>> = {
  nom: { m: '', f: 'e', n: '', pl: 'e' },
  acc: { m: 'en', f: 'e', n: '', pl: 'e' },
  dat: { m: 'em', f: 'er', n: 'em', pl: 'en' },
};
const EIN_FORMS = new Set(['ein', 'eine', 'einen', 'einem', 'einer']);
const DEF_FORMS = new Set(['der', 'die', 'das', 'den', 'dem']);

export interface NounSlot {
  before: string;
  art: string;
  after: string;
  zh: string;
  g: G;
  c: C;
  /** The article was ein-type (ein, eine …), not der/die/das. */
  indef: boolean;
}

/** Example slots of this noun that are exactly article + the noun ({einen Tee}, {dem Tisch}), with case and gender
 *  read off the 格位姿态 table. A der that could be nom (m) or dat (f) follows the noun's gender. */
export function nounSlots(w: Word, datOpen = true): NounSlot[] {
  if (!w.art) return [];
  const g = genderOf(w) as G | null;
  if (!g) return [];
  const out: NounSlot[] = [];
  for (const line of EXAMPLES[w.id] ?? []) {
    const p = parse(line);
    if (!p) continue;
    const toks = p.blank.split(' ');
    if (toks.length !== 2 || toks[1] !== w.de) continue;
    const art = toks[0].toLowerCase();
    if (!EIN_FORMS.has(art) && !DEF_FORMS.has(art)) continue;
    let c = caseOf(g, art) as C | null;
    if (!c && EIN_FORMS.has(art)) c = art === 'einen' ? 'acc' : art === 'einem' || art === 'einer' ? 'dat' : 'nom';
    if (!c) continue;
    if (c === 'dat' && !datOpen) continue;
    // Capitalised article at the start of the sentence: keep the capital on the answer.
    out.push({ before: p.before, art: toks[0], after: p.after, zh: p.zh, g, c, indef: EIN_FORMS.has(art) });
  }
  return out;
}

const cap = (s: string, like: string) => (like[0] && like[0] === like[0].toUpperCase() && like[0] !== like[0].toLowerCase() ? s[0].toUpperCase() + s.slice(1) : s);
const tidy = (s: string) => s.replace(/\s+/g, ' ').replace(/\s+([.,!?])/g, '$1').trim();

/** Particles that change what a negation means (noch → nicht mehr, nur, auch → auch nicht): such sentences are skipped. */
export const FOCUS_PARTICLE = /\b(noch|nur|auch|schon|immer|mal|gerade|wieder|sogar|jetzt)\b/i;

/** 否定 kein (5 级): a sentence with ein/eine/einen + this noun, turned into the negative. */
export function keinTask(w: Word, rng: Rng, datOpen = false): GramTask | null {
  const slots = nounSlots(w, datOpen).filter((x) => x.indef && !FOCUS_PARTICLE.test(x.before));
  // Example sentences already written with kein count too ({keinen Ausweis}).
  const direct = (EXAMPLES[w.id] ?? [])
    .map(parse)
    .filter((p): p is NonNullable<typeof p> => !!p && /^kein(e|en|em|er)? /i.test(p.blank) && p.blank.split(' ')[1] === w.de);
  if (!slots.length && !direct.length) return null;
  if (direct.length && (!slots.length || rng() < 0.5)) {
    const p = pick(rng, direct);
    const art = p.blank.split(' ')[0];
    return {
      sys: 'kein',
      prompt: `否定 kein：填 kein 的形式 · ${p.zh}`,
      focus: tidy(`${p.before}___ ${w.de}${p.after}`),
      answer: art,
      tier: 1,
      rule: 'kein 跟 ein 一样变：ein → kein，eine → keine，einen → keinen（复数也用 keine）',
      full: tidy(`${p.before}${p.blank}${p.after}`),
      zh: p.zh,
      wordId: w.id,
    };
  }
  const x = pick(rng, slots);
  const ans = cap('kein' + EIN_END[x.c][x.g], x.art);
  const orig = tidy(`${x.before}${x.art} ${w.de}${x.after}`);
  return {
    sys: 'kein',
    prompt: `否定 kein：把这句改成否定（「没有/不」），填 kein 的形式 · ${x.zh}`,
    focus: `${orig}  →  ${tidy(`${x.before}___ ${w.de}${x.after}`)}`,
    answer: ans,
    tier: 1,
    rule: 'kein 跟 ein 一样变：ein → kein，eine → keine，einen → keinen，einem → keinem',
    full: tidy(`${x.before}${ans} ${w.de}${x.after}`),
    zh: x.zh,
    wordId: w.id,
  };
}

/** 物主冠词 mein / dein (6 级): the noun's slot with 我的 / 你的. Same endings as ein. */
export function meinTask(w: Word, rng: Rng, datOpen = false): GramTask | null {
  const slots = nounSlots(w, datOpen).filter((x) => x.g !== 'pl');
  if (!slots.length) return null;
  const x = pick(rng, slots);
  const [stem, zhp] = rng() < 0.6 ? ['mein', '我的'] : ['dein', '你的'];
  const ans = cap(stem + EIN_END[x.c][x.g], x.art);
  return {
    sys: 'mein',
    prompt: `物主冠词：用「${zhp}」（${stem}）填空，词尾跟 ein 一样变`,
    focus: tidy(`${x.before}___ ${w.de}${x.after}`) + `（${zhp}）`,
    answer: ans,
    tier: 1,
    rule: `${stem} 的词尾和 ein 一样：${stem} / ${stem}e / ${stem}en / ${stem}em / ${stem}er`,
    full: tidy(`${x.before}${ans} ${w.de}${x.after}`),
    zh: x.zh,
    wordId: w.id,
  };
}

const MODAL_TOKENS = new Set(Object.keys(MODAL_INF));

/** Modal sentences for this verb: its examples that already have a modal and the infinitive at the end, and its
 *  ich-sentences rebuilt with muss / möchte / kann / will (Ich trinke Kaffee. → Ich möchte Kaffee trinken.). */
export function modalSentences(w: Word): Array<{ de: string; zh: string }> {
  if (w.pos !== 'v' || !CONJ[w.de]) return [];
  const out: Array<{ de: string; zh: string }> = [];
  for (const line of EXAMPLES[w.id] ?? []) {
    const p = parse(line);
    if (!p || /["„“]/.test(line)) continue;
    const toks = p.before.toLowerCase().replace(/[,?!.]/g, ' ').split(/\s+/);
    const tail = p.after.trim();
    if (p.blank === w.de && /^[.!?]?$/.test(tail) && toks.some((t) => MODAL_TOKENS.has(t))) {
      out.push({ de: tidy(`${p.before}${p.blank}${p.after}`), zh: p.zh });
      continue;
    }
    // Rebuild: "Ich {trinke} …" with a one-word present form.
    const ich = CONJ[w.de].forms.ich;
    if (p.before.trim() === 'Ich' && p.blank === ich && !ich.includes(' ') && p.zh.startsWith('我')) {
      const end = /[.!?]$/.test(tail) ? tail.slice(-1) : '.';
      const mid = tail.replace(/[.!?]$/, '').trim();
      for (const m of MODAL_BUILD) out.push({ de: tidy(`Ich ${m.de} ${mid} ${w.de}${end}`), zh: `我${m.zh}${p.zh.slice(1)}` });
    }
  }
  return out;
}

/** 情态动词 + 句尾不定式 (8 级, 排句里教): put the chunks in order; the modal is second, the infinitive last. */
export function modalTask(w: Word, rng: Rng): GramTask | null {
  const cands = modalSentences(w)
    .map((x) => ({ ...x, cs: chunks(x.de) }))
    .filter((x) => x.cs.length >= 3 && x.cs.length <= 6);
  if (!cands.length) return null;
  const c = pick(rng, cands);
  let shown = shuffle(rng, c.cs);
  for (let i = 0; i < 5 && shown.join(' ') === c.cs.join(' '); i++) shown = shuffle(rng, c.cs);
  if (shown.join(' ') === c.cs.join(' ')) shown = [...shown.slice(1), shown[0]];
  return {
    sys: 'modal',
    prompt: `排句 · 情态动词：排成一句，打出整句（情态动词放第二位，${w.de} 放句尾）· ${c.zh}`,
    focus: shown.join('  /  '),
    answer: c.de,
    tier: 1,
    rule: '情态动词（muss、kann、möchte…）变位放第二位，另一个动词用原形放到句尾',
    full: c.de,
    zh: c.zh,
    wordId: w.id,
  };
}

/** Separable verbs: the conjugated base and the particle, from CONJ (steige ein → steige, ein). */
export function sepParts(verb: string): { particle: string; forms: Record<Person, string> } | null {
  const c = CONJ[verb];
  if (!c) return null;
  const sp = c.forms.ich.split(' ');
  if (sp.length !== 2) return null;
  const forms = {} as Record<Person, string>;
  for (const p of PERSONS) forms[p] = c.forms[p].split(' ')[0];
  return { particle: sp[1], forms };
}

/** 可分动词现在时 (12 级): Ich ___ um sieben Uhr ___. (aufstehen) → stehe … auf. */
export function sepTask(w: Word, rng: Rng): GramTask | null {
  if (w.pos !== 'v' || !sepParts(w.de)) return null;
  const rows = SEP_EX[w.de] ?? [];
  if (!rows.length) return null;
  const line = pick(rng, rows);
  const [de, zh = ''] = line.split('|');
  const m = /^(.*)\{([^}]+)\}(.*)\[([^\]]+)\](.*)$/.exec(de);
  if (!m) return null;
  const [, a, fin, mid, part, end] = m;
  return {
    sys: 'sep',
    prompt: `可分动词：两个空，变位的部分放第二位，前缀放句尾 · ${zh}`,
    focus: tidy(`${a}___${mid}___${end}`) + `（${w.de}）`,
    answer: `${fin} … ${part}`,
    alts: [`${fin} ${part}`, tidy(`${a}${fin}${mid}${part}${end}`)],
    tier: 2,
    rule: `可分动词现在时拆开：${w.de} → ${fin} … ${part}（前缀放到句尾）`,
    full: tidy(`${a}${fin}${mid}${part}${end}`),
    zh,
    wordId: w.id,
  };
}

/** 命令式 Geben Sie mir … (14 级, 槽位造句里教): ask politely for this monster's thing. */
export function impTask(w: Word): GramTask | null {
  if (!w.art) return null;
  const pat = sentenceTags(w).find((p) => p === 'brauche' || p === 'moechte' || p === 'nehme');
  if (!pat) return null;
  const lead = PATTERNS[pat].lead;
  const obj = expectedSentence(w, pat).slice(lead.length + 1).replace(/[.?]$/, '');
  const full = `Geben Sie mir bitte ${obj}.`;
  return {
    sys: 'imp',
    prompt: `命令式（Sie）：礼貌地请对方把它给你 · 请给我${w.zh.replace(/（.*?）/g, '')}`,
    focus: 'Geben Sie mir bitte ___.',
    answer: obj,
    alts: [full, `Geben Sie mir ${obj}!`],
    tier: 2,
    rule: 'Sie 的命令式：动词原形放句首，后面跟 Sie（Geben Sie mir …），给的东西用第四格',
    full,
    wordId: w.id,
  };
}
