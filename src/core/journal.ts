// 篝火日记 (游戏设计 › 词表导入和 A1 写作, 第二层 B, 2026-11-22): at a bonfire (Lv16+), write two or three sentences
// with 3 words you fought today. There is no right or wrong: the check only points at mistakes a rule is sure of
//   · a given word that isn't in the text,
//   · an article that can't go with a noun from your wordbook in any case (das Tee, ein Tasse),
//   · ich / du / er + a verb form of another person (ich wohnst, du wohnt).
// Anything it can't judge it leaves alone. Saving the entry gives a little XP once per day.

import { normalize } from './grading';
import type { Word } from './types';
import type { Settings } from './state';
import { wordCue } from './dedef';
import { CONJ, PERSONS, type Person } from '../data/verbs';
import { WORDS } from '../data/words';
import { PERFEKT } from '../data/perfekt';
import { STRONG_VERBS } from '../data/grammar/strongVerbs';

/** XP for the first entry of the day, as a share of the XP to the next level. */
export const JOURNAL_XP_SHARE = 0.04;
/** Entries kept in the save (oldest go first). */
export const JOURNAL_KEEP = 60;
export const JOURNAL_WORDS = 3;

export interface JournalEntry {
  day: string;
  words: string[];
  text: string;
}

export interface JournalHint {
  kind: 'missing' | 'article' | 'verb' | 'short';
  text: string;
}

const tokens = (text: string) => text.replace(/[.,!?;:"„“()]/g, ' ').split(/\s+/).filter(Boolean);
const k = (v: string) => normalize(v);

// Articles that can stand before a singular noun of each gender in some case.
const OK_ART: Record<'m' | 'f' | 'n', string[]> = {
  m: ['der', 'den', 'dem', 'des', 'ein', 'einen', 'einem', 'eines', 'kein', 'keinen', 'keinem', 'keines', 'mein', 'meinen', 'meinem', 'meines', 'dein', 'deinen', 'deinem', 'sein', 'seinen', 'seinem', 'unser', 'unseren', 'unserem'],
  f: ['die', 'der', 'eine', 'einer', 'keine', 'keiner', 'meine', 'meiner', 'deine', 'deiner', 'seine', 'seiner', 'unsere', 'unserer'],
  n: ['das', 'dem', 'des', 'ein', 'einem', 'eines', 'kein', 'keinem', 'keines', 'mein', 'meinem', 'meines', 'dein', 'deinem', 'sein', 'seinem', 'unser', 'unserem'],
};
const ALL_ART = new Set(Object.values(OK_ART).flat());
const ART_ZH: Record<'m' | 'f' | 'n', string> = { m: '阳性（der）', f: '阴性（die）', n: '中性（das）' };

function nounIndex(): Map<string, Word> {
  const m = new Map<string, Word>();
  for (const w of WORDS) if (w.art && !w.plOnly && !w.de.includes(' ')) m.set(k(w.de), w);
  return m;
}
let NOUNS: Map<string, Word> | null = null;

/** Every conjugated form → the persons it is right for. */
function formIndex(): Map<string, Set<Person>> {
  const m = new Map<string, Set<Person>>();
  for (const c of Object.values(CONJ)) {
    for (const p of PERSONS) {
      for (const f of [c.forms[p], ...(c.alt?.[p] ?? [])]) {
        const key = k(f);
        if (!key || key.includes(' ')) continue;
        if (!m.has(key)) m.set(key, new Set());
        m.get(key)!.add(p);
      }
    }
  }
  return m;
}
let FORMS: Map<string, Set<Person>> | null = null;

const PRON: Record<string, Person[]> = { ich: ['ich'], du: ['du'], er: ['er'], es: ['er'], wir: ['wir', 'sie'], ihr: ['ihr'], sie: ['er', 'sie'] };

/** Does the text use this word (any form we know: plural, conjugated, declined adjective)? */
export function usesWord(text: string, w: Word): boolean {
  const ts = tokens(text).map(k);
  const inf = w.de.replace(/^(der|die|das|sich) /i, '');
  const bare = k(inf);
  const c = CONJ[w.de] ?? CONJ[inf];
  if (c && usesVerb(ts, inf, c)) return true;
  if (bare.includes(' ')) return ` ${ts.join(' ')} `.includes(` ${bare} `);
  if (ts.includes(bare)) return true;
  if (w.pl && w.pl !== '-' && ts.includes(k(w.pl))) return true;
  if (w.pos === 'adj') return ts.some((t) => t.startsWith(bare) && t.length <= bare.length + 3);
  return false;
}

const INSEP = /^(be|ver|er|ent|zer|emp|miss|ge|hinter|ueber|unter|wider)/;
/** One or more verb prefixes in front of a strong verb (vor+be+reiten is still caught by its weak Perfekt). */
const STRONG_PREFIX = /^(be|ver|er|ent|zer|emp|miss|ge|hinter|ueber|unter|wider|ab|an|auf|aus|bei|dar|durch|ein|empor|entgegen|fern|fest|fort|frei|her|heraus|herein|herum|hin|hinaus|hinein|los|mit|nach|nieder|um|vor|voran|vorbei|weg|weiter|wieder|zu|zurueck|zusammen|raus|rein|rum|statt|teil|kennen|spazieren|kaputt|sicher|fertig|offen|bereit|hoch|nahe?)+$/;

/** A verb in any form a learner writes: present (split or joined: rufe … an, anrufe), imperative, zu-infinitive,
 *  Partizip II and Präteritum (also split: zog … aus). Loose on purpose: it only checks that the word is there. */
function usesVerb(ts: string[], inf: string, c: (typeof CONJ)[string]): boolean {
  const word = k(inf);
  const parts = c.forms.er.split(' ');
  const particle = parts.length > 1 ? k(parts.slice(1).join(' ')) : '';
  const base = particle && word.replace(/\s+/g, '').startsWith(particle.replace(/\s+/g, '')) ? word.replace(/\s+/g, '').slice(particle.replace(/\s+/g, '').length) : word;
  const stem = base.replace(/e?n$/, '');
  // Stem forms that stand alone in a main clause (the particle follows later).
  const stems = new Set<string>([base, stem, `${stem}e`]);
  for (const p of PERSONS) for (const f of [c.forms[p], ...(c.alt?.[p] ?? [])]) stems.add(k(f.split(' ')[0]));
  const du = k(c.forms.du.split(' ')[0]);
  // Imperative of e → i verbs (nimm, gib, lies, iss); the others use the stem (zieh, kauf). Not from any du form:
  // werden → wir, wissen → weiß would make unrelated words count. sein / werden: sei / werde are stem forms already.
  if (/e/.test(stem) && /i/.test(du) && base !== 'sein' && base !== 'werden')
    for (const f of [du.replace(/st$/, ''), du.replace(/t$/, '')]) if (f !== du && f.length > 2) stems.add(f);
  // Präteritum.
  // A strong verb only through a real prefix (verstehen ← stehen), and not when the word's own Perfekt says it is
  // weak (bereiten is not reiten, beantragen not tragen, schalten not halten, handhaben not haben).
  const knownPp = PERFEKT[inf]?.pp;
  const sv = STRONG_VERBS.filter((v) => {
    const kv = k(v.inf);
    if (!base.endsWith(kv)) return false;
    if (base === kv) return true;
    if (!STRONG_PREFIX.test(base.slice(0, base.length - kv.length))) return false;
    // The word list marks strong compounds (verstehen, bekommen); a mixed verb (verbringen, nachdenken) may be unmarked.
    if (!c.strong && !c.pastStrong && !(/te$/.test(v.praet) && v.inf !== 'haben')) return false;
    return !knownPp || /t$/.test(knownPp) === /t$/.test(v.pp);
  }).sort((a, b) => b.inf.length - a.inf.length)[0];
  const pre = sv ? base.slice(0, base.length - k(sv.inf).length) : '';
  let praet = '';
  if (sv) praet = pre + k(sv.praet);
  else if (!c.strong && !c.pastStrong) praet = /[td]$/.test(stem) ? `${stem}ete` : `${stem}te`;
  const past = praet ? [praet, `${praet}st`, `${praet}n`, `${praet}en`, `${praet}t`, `${praet}est`, `${praet}et`] : [];
  for (const f of past) stems.add(f);
  // Partizip II.
  const pps = new Set<string>();
  const known = knownPp;
  if (known) pps.add(k(known).replace(/\s+/g, ''));
  if (sv) pps.add(pre && !INSEP.test(pre) ? pre + k(sv.pp) : pre ? pre + k(sv.pp).replace(/^ge/, '') : k(sv.pp));
  else if (!c.strong && !c.pastStrong) pps.add(INSEP.test(base) || base.endsWith('ieren') ? `${stem}t` : `ge${stem}${/[td]$/.test(stem) ? 'et' : 't'}`);
  const glue = particle.replace(/\s+/g, '');
  const joined = (f: string) => (glue ? glue + f : f);
  const singles = new Set<string>([word.replace(/\s+/g, ''), `${glue}zu${base}`]);
  for (const f of stems) singles.add(joined(f));
  for (const f of pps) singles.add(glue && !f.startsWith(glue) ? glue + f : f);
  if (!particle) {
    for (const f of [...stems, ...pps]) singles.add(f);
    return ts.some((t) => singles.has(t));
  }
  if (ts.some((t) => singles.has(t))) return true;
  // Particle written apart: a stem form, then the particle later (ich rufe dich morgen an), or a multi-word verb.
  const pw = particle.split(' ');
  const ppBare = [...pps].map((f) => (f.startsWith(glue) ? f.slice(glue.length) : f));
  for (let i = 0; i < ts.length; i++) {
    if (!stems.has(ts[i]) && !ppBare.includes(ts[i])) continue;
    for (let j = 0; j + pw.length <= ts.length; j++) {
      if (j === i) continue;
      if (pw.every((x, n) => ts[j + n] === x) && (stems.has(ts[i]) ? j > i : true)) return true;
    }
  }
  return false;
}

/** Hints for an entry. Empty = nothing the rules are sure about. */
export function checkJournal(text: string, given: Word[], settings?: Pick<Settings, 'defLang'>): JournalHint[] {
  NOUNS ??= nounIndex();
  FORMS ??= formIndex();
  const out: JournalHint[] = [];
  const sentences = text.split(/[.!?]+/).map((x) => x.trim()).filter((x) => tokens(x).length >= 2);
  if (sentences.length < 2) out.push({ kind: 'short', text: '写两三句（每句以句号结尾）' });
  for (const w of given) if (!usesWord(text, w)) out.push({ kind: 'missing', text: `还没用到${wordCue(w, settings)}` }); // 审查修订: no German here, the word must be recalled (德语释义 1.0.12: a de-tier word as given, by definition + first letter)
  const raw = tokens(text);
  for (let i = 0; i + 1 < raw.length; i++) {
    const a = k(raw[i]);
    const next = raw[i + 1];
    // Article + noun from the wordbook (singular form only; the plural would take die).
    if (ALL_ART.has(a)) {
      const n = NOUNS.get(k(next));
      if (n && /^[A-ZÄÖÜ]/.test(next)) {
        const g = (n.art === 'der' ? 'm' : n.art === 'die' ? 'f' : 'n') as 'm' | 'f' | 'n';
        const samePl = n.pl && (n.pl === '-' ? false : k(n.pl) === k(n.de));
        if (!OK_ART[g].includes(a) && !samePl) out.push({ kind: 'article', text: `${raw[i]} ${next}：${n.de} 是${ART_ZH[g]}，前面不能用 ${raw[i]}` });
      }
    }
    // Pronoun + verb form of another person.
    const pr = PRON[a];
    if (pr && i + 1 < raw.length) {
      const persons = FORMS.get(k(next));
      if (persons && !pr.some((p) => persons.has(p))) {
        const verb = Object.entries(CONJ).find(([, c]) => PERSONS.some((p) => k(c.forms[p]) === k(next)));
        const right = verb ? verb[1].forms[pr[0]] : '';
        out.push({ kind: 'verb', text: `${raw[i]} ${next}：${raw[i].toLowerCase()} 后面是 ${right || '另一个形式'}` });
      }
    }
  }
  return out;
}

/** The 3 words for today's entry: words answered today, nouns and verbs first, never phrases or numbers. */
export function journalWords(words: Record<string, { lastSeen?: number }>, dayStart: number, pool: Word[] = WORDS): Word[] {
  const today = pool.filter((w) => (words[w.id]?.lastSeen ?? 0) >= dayStart && w.pos !== 'phr' && w.pos !== 'num' && !w.digit && w.family !== 'truhe');
  const rank = (w: Word) => (w.pos === 'n' ? 0 : w.pos === 'v' ? 1 : 2);
  return [...today].sort((a, b) => rank(a) - rank(b) || (words[b.id]?.lastSeen ?? 0) - (words[a.id]?.lastSeen ?? 0)).slice(0, JOURNAL_WORDS);
}
