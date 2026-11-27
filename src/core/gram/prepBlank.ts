// 介词空 (游戏设计 六「介词空」, rev 707): a field question that takes over some cloze slots. It only uses the
// monster's own example sentences. Noun monster: the preposition + article before the noun (Ich fahre ___ Bus. →
// mit dem). Verb monster: only verbs of the 动介搭配 list; the preposition (+ article) after it (warte ___ Bus →
// auf den, denke ___ dich → an). Answers are typed; contractions and written-out forms both count (prepGrade.ts).

import { EXAMPLES, parse } from '../cloze';
import { genderOf } from '../../data/words';
import { PREP_VERBS, type PrepVerb } from '../../data/grammar/prepVerbs';
import { normalize } from '../grading';
import type { GameState } from '../state';
import type { Word } from '../types';
import { CONTRACT, caseOfDet, defOf, otherCaseDet, rule, type Gender, type Kase, type PrepCat, type PrepInfo } from './prepGrade';
import type { GramSys, GramTask } from './task';

/** Unlock levels per kind (游戏设计 六 介词空 分档). */
export const PREP_LV: Record<PrepCat, number> = { time: 10, dat: 15, acc: 15, two: 32, verb: 41, gen: 91 };

export interface PrepSlot {
  /** The sentence with ___ where the answer goes. */
  shown: string;
  full: string;
  zh: string;
  /** As written in the sentence (Am, zum, mit dem, auf). */
  answer: string;
  info: PrepInfo;
}

const DAT_ONLY = ['mit', 'bei', 'von', 'zu', 'aus', 'nach', 'seit', 'ab', 'gegenueber'];
const ACC_ONLY = ['fuer', 'ohne', 'gegen', 'durch', 'um', 'bis'];
const TWO_WAY = ['in', 'an', 'auf', 'ueber', 'unter', 'vor', 'hinter', 'neben', 'zwischen'];
const GEN = ['wegen', 'trotz', 'waehrend', 'statt', 'anstatt', 'innerhalb', 'ausserhalb'];
const ALL = [...DAT_ONLY, ...ACC_ONLY, ...TWO_WAY, ...GEN];
/** Time phrases (10 级): am / um / im, von … bis, vor / nach with a time noun. */
const TIME_PREPS = ['an', 'um', 'in', 'vor', 'nach', 'von', 'bis'];
const TIME_NOUNS = new Set(
  'montag dienstag mittwoch donnerstag freitag samstag sonntag wochenende januar februar maerz april mai juni juli august september oktober november dezember fruehling fruehjahr sommer herbst winter morgen vormittag mittag nachmittag abend nacht uhr tag woche monat jahr jahrhundert jahrzehnt anfang ende feiertag weihnachten silvester neujahr ostern augenblick moment stunde minute sekunde zeit mittagspause pause urlaub ferien wochentag'.split(' '),
);

const DET = /^(der|die|das|den|dem|des|(?:k?ein|mein|dein|sein|ihr|unser|eur|euer)(?:e|en|em|er|es)?|(?:dies|jed|welch)(?:er|e|es|en|em))$/i;
const WORD = /[A-Za-zÄÖÜäöüß]+/g;

const n = (v: string) => normalize(v);

/** 'denken an + Akk.' → 'denken'; 'sich erinnern an' → 'erinnern'; 'jdn./etw. erkennen an' → 'erkennen'. */
function verbOf(r: PrepVerb): string {
  const head = r.combo.split(` ${r.prep} `)[0].trim().split(/\s+/);
  return head[head.length - 1];
}

const FIXED = PREP_VERBS.filter((r) => r.fixed && (r.kasus === 'A' || r.kasus === 'D'));
const COMBOS_BY_VERB = new Map<string, PrepVerb[]>();
for (const r of FIXED) {
  const v = n(verbOf(r));
  COMBOS_BY_VERB.set(v, [...(COMBOS_BY_VERB.get(v) ?? []), r]);
}

/** Verb stems of fixed pairings per preposition, to see that a noun's 「auf den」 belongs to warten (→ 动介搭配). */
const STEMS_BY_PREP = new Map<string, Array<{ stem: string; r: PrepVerb }>>();
/** Irregular forms the stem test would miss (dachte an, sprach über, bat um). */
const IRREG: Record<string, string[]> = {
  denken: ['dacht', 'gedacht'], sprechen: ['sprach', 'sprich', 'gesproch'], bitten: ['bat', 'gebet'], halten: ['hielt', 'haelt'],
  nehmen: ['nahm', 'nimm', 'genomm'], leiden: ['litt', 'gelitt'], schreiben: ['schrieb'], fahren: ['fuhr', 'faehr'], helfen: ['half', 'hilf', 'geholf'],
  sterben: ['starb', 'stirb', 'gestorb'], erkennen: ['erkannt'], kommen: ['kam'], gehen: ['ging', 'gegang'], wissen: ['weiss', 'wusst'],
  riechen: ['roch', 'geroch'], schmecken: [], fangen: ['fing', 'faengt'], bringen: ['bracht'], streiten: ['stritt'], verlieren: ['verlor'],
};
for (const r of FIXED) {
  const v = n(verbOf(r));
  const p = n(r.prep);
  const stems = [v.replace(/e?n$/, ''), ...(IRREG[v] ?? [])];
  for (const stem of stems) if (stem.length >= 3) STEMS_BY_PREP.set(p, [...(STEMS_BY_PREP.get(p) ?? []), { stem, r }]);
}

function comboInSentence(prep: string, sentence: string): PrepVerb | null {
  const toks = (sentence.match(WORD) ?? []).filter((t, i) => i === 0 || t[0] === t[0].toLowerCase()).map(n);
  for (const { stem, r } of STEMS_BY_PREP.get(prep) ?? []) {
    if (toks.some((t) => (t.startsWith(stem) && t.length <= stem.length + 3) || (t.startsWith(`ge${stem}`) && t.length <= stem.length + 4))) return r;
  }
  return null;
}

function kaseOfContraction(c: string): Kase {
  return CONTRACT[c][1] === 'das' ? 'A' : 'D';
}

function catOf(prep: string, noun: string | null, contraction: string | null): PrepCat | null {
  if (GEN.includes(prep)) return 'gen';
  if (noun && TIME_NOUNS.has(n(noun)) && TIME_PREPS.includes(prep) && !(prep === 'in' && contraction === 'ins')) return 'time';
  if (DAT_ONLY.includes(prep)) return 'dat';
  if (ACC_ONLY.includes(prep)) return 'acc';
  if (TWO_WAY.includes(prep)) return 'two';
  return null;
}

/** Accepted determiners of the same case and gender (den / einen / keinen) when the Chinese doesn't name one. */
const ZH_DET = /[一两][个位只张本件杯块条把台辆间双份种家盒瓶袋根片口所部盏碗套首封]|这|那|[我你他她它您]们?的|没有/;
const SAME: Record<Kase, Record<Gender, string[]>> = {
  A: { m: ['den', 'einen'], f: ['die', 'eine'], n: ['das', 'ein'], pl: ['die'] },
  D: { m: ['dem', 'einem'], f: ['der', 'einer'], n: ['dem', 'einem'], pl: ['den'] },
  G: { m: ['des', 'eines'], f: ['der', 'einer'], n: ['des', 'eines'], pl: ['der'] },
};

const cache = new Map<string, PrepSlot[]>();

/** Every 介词空 this word's own sentences allow (cached). */
export function prepSlots(w: Word): PrepSlot[] {
  const hit = cache.get(w.id);
  if (hit) return hit;
  const out = w.pos === 'n' ? nounSlots(w) : w.pos === 'v' ? verbSlots(w) : [];
  cache.set(w.id, out);
  return out;
}

function nounSlots(w: Word): PrepSlot[] {
  const out: PrepSlot[] = [];
  const g0 = genderOf(w);
  for (const line of EXAMPLES[w.id] ?? []) {
    const p = parse(line);
    if (!p) continue;
    const full = (p.before + p.blank + p.after).replace(/\s+/g, ' ').trim();
    const m = /(^|[\s„"(])([A-Za-zÄÖÜäöüß]+)\s+$/.exec(p.before);
    if (!m) continue;
    const word = m[2];
    const lw = n(word);
    const contraction = CONTRACT[lw] ? lw : null;
    const prep = contraction ? CONTRACT[lw][0] : lw;
    if (!ALL.includes(prep)) continue;
    // Not a preposition here: was für ein …, um / ohne / statt … zu + Infinitiv.
    if (prep === 'fuer' && /(^|[^a-zäöüß])was\b/i.test(p.before)) continue;
    if (['um', 'ohne', 'statt', 'anstatt'].includes(prep) && /(^|\s)zu\s+[a-zäöüß]+(en|ern|eln)\s*([.,!?;:]|$)|(^|\s)[a-zäöüß]{2,}zu[a-zäöüß]+en\s*([.,!?;:]|$)/.test(p.after)) continue;
    const blank = p.blank.trim().split(/\s+/);
    const hasDet = DET.test(blank[0]);
    if (contraction && hasDet) continue;
    const det = contraction ? null : hasDet ? blank[0] : null;
    const rest = hasDet ? blank.slice(1) : blank;
    if (!rest.length) continue;
    const head = rest[rest.length - 1];
    const plural = !!w.pl && w.pl !== '-' && (n(head) === n(w.pl) || n(head) === n(`${w.pl}n`)) && n(head) !== n(w.de);
    const g: Gender | null = plural ? 'pl' : g0;
    let cat = catOf(prep, w.de, contraction);
    if (!cat) continue;
    let kase: Kase | null = contraction ? kaseOfContraction(contraction) : det && g ? caseOfDet(det, g) : null;
    // Two-way preposition after a verb that pairs with it (warte auf den Bus): 动介搭配, not wo/wohin. A fixed-case
    // preposition keeps its own kind (its case rule is right either way, and the verb test can misfire).
    let combo: PrepVerb | null = null;
    if (cat === 'two') {
      combo = comboInSentence(prep, full);
      if (combo && kase && kase !== combo.kasus) combo = null;
      if (combo) cat = 'verb';
    } else if (cat === 'dat' || cat === 'acc') {
      // Kept as its fixed-case kind, but a wrong preposition is explained by the pairing (fragen nach), not by places.
      combo = comboInSentence(prep, full);
      if (combo && kase && kase !== combo.kasus) combo = null;
    }
    if (cat === 'dat' && kase === 'A') continue; // not what it looks like (e.g. bis + Akk. inside a longer phrase)
    if (cat === 'acc' && kase === 'D') continue;
    if (cat === 'gen' && kase && kase !== 'G') continue;
    const answer = det ? `${word} ${det}` : word;
    const at = p.before.length - m[0].length + m[1].length;
    const shown = `${p.before.slice(0, at)}___ ${rest.join(' ')}${p.after}`.replace(/\s+/g, ' ').trim();
    const dets = det && g && kase && !ZH_DET.test(p.zh) && /^(der|die|das|den|dem|des|ein|eine|einen|einem|einer|eines)$/i.test(det) ? SAME[kase][g].filter((d) => d !== n(det)) : undefined;
    out.push({
      shown,
      full,
      zh: p.zh,
      answer,
      info: {
        prep,
        cat,
        kase,
        det: det ?? (contraction ? CONTRACT[contraction][1] : null),
        g,
        noun: w.art && !plural ? `${w.art} ${w.de}` : plural ? `die ${w.pl}` : w.de,
        ...(combo ? { combo: combo.combo, verb: verbOf(combo) } : {}),
        ...(dets?.length ? { dets } : {}),
        blank: true,
      },
    });
  }
  return out;
}

function verbSlots(w: Word): PrepSlot[] {
  const combos = COMBOS_BY_VERB.get(n(w.de.replace(/^sich /, ''))) ?? [];
  if (!combos.length) return [];
  const out: PrepSlot[] = [];
  for (const line of EXAMPLES[w.id] ?? []) {
    const p = parse(line);
    if (!p) continue;
    const full = (p.before + p.blank + p.after).replace(/\s+/g, ' ').trim();
    // The preposition sits outside the braces (the verb form is inside). Find every candidate token.
    const outside = `${p.before}\u0000${p.blank}\u0000${p.after}`;
    const tokens: Array<{ word: string; idx: number; prep: string; contraction: string | null }> = [];
    let inBlank = false;
    for (let i = 0, cur = ''; i <= outside.length; i++) {
      const ch = outside[i] ?? ' ';
      if (/[A-Za-zÄÖÜäöüß]/.test(ch)) {
        cur += ch;
        continue;
      }
      if (cur && !inBlank) {
        const lw = n(cur);
        const contraction = CONTRACT[lw] ? lw : null;
        const prep = contraction ? CONTRACT[lw][0] : lw;
        if (combos.some((r) => n(r.prep) === prep)) tokens.push({ word: cur, idx: i - cur.length, prep, contraction });
      }
      cur = '';
      if (ch === '\u0000') inBlank = !inBlank;
    }
    if (tokens.length !== 1) continue; // none, or ambiguous (auf … auf)
    const t = tokens[0];
    const after = outside.slice(t.idx + t.word.length).replace(/\u0000/g, '');
    // A separable particle at the end of the clause is not the preposition (Ich rufe dich an.).
    const next = /^\s+([A-Za-zÄÖÜäöüß]+)/.exec(after);
    if (!next) continue;
    const r = combos.find((x) => n(x.prep) === t.prep)!;
    const isDet = !t.contraction && DET.test(next[1]);
    const det = isDet ? next[1] : null;
    // The determiner has to fit the pairing's case (auf dem Bahnsteig with warten auf + Akk. is a place, not it).
    const d = det ? defOf(det) : null;
    const k = r.kasus as Kase;
    if (d && ((k === 'A' && (d === 'dem' || d === 'der' || d === 'des')) || (k === 'D' && (d === 'die' || d === 'das' || d === 'ein' || d === 'des')))) continue;
    if (t.contraction && kaseOfContraction(t.contraction) !== k) continue;
    const answer = det ? `${t.word} ${det}` : t.word;
    const shownRaw = outside.slice(0, t.idx) + '___' + outside.slice(t.idx + answer.length);
    const shown = shownRaw.replace(/\u0000/g, '').replace(/\s+/g, ' ').trim();
    if (shown.replace('___', answer) !== full) continue;
    out.push({ shown, full, zh: p.zh, answer, info: { prep: t.prep, cat: 'verb', kase: k, det: det ?? (t.contraction ? CONTRACT[t.contraction][1] : null), combo: r.combo, verb: verbOf(r), blank: true } });
  }
  return out;
}

/** 3-choice fallback: the same preposition in the other case, or a preposition of its confusion group. */
const GROUPS = [['auf', 'an', 'in'], ['zu', 'nach', 'in'], ['fuer', 'auf'], ['seit', 'vor']];
const PRETTY: Record<string, string> = { fuer: 'für', ueber: 'über', gegenueber: 'gegenüber', waehrend: 'während', ausserhalb: 'außerhalb' };
const CONTRACT_OF: Record<string, string> = Object.fromEntries(Object.entries(CONTRACT).map(([c, [p, d]]) => [`${p} ${d}`, c]));

function spell(prep: string, det: string | null): string {
  const p = PRETTY[prep] ?? prep;
  if (!det) return p;
  const c = CONTRACT_OF[`${prep} ${n(det)}`];
  return c ? PRETTY[c] ?? c.replace('fuers', 'fürs').replace('uebers', 'übers') : `${p} ${det}`;
}

export function prepOptions(slot: PrepSlot, rng: () => number): string[] {
  const x = slot.info;
  const right = slot.answer;
  const wrong: string[] = [];
  const lower = (v: string) => v.toLowerCase();
  // Same preposition, other case.
  if (x.det && x.kase && x.kase !== 'G' && x.g) {
    const o = otherCaseDet(x.det, x.g, x.kase);
    if (o) wrong.push(spell(x.prep, o));
  }
  // Confusion group, same determiner.
  const group = GROUPS.filter((gr) => gr.includes(x.prep)).flat().filter((p) => p !== x.prep);
  for (const p of group) {
    if (wrong.length >= 2) break;
    const v = spell(p, x.det ?? null);
    if (lower(v) !== lower(right) && !wrong.some((y) => lower(y) === lower(v))) wrong.push(v);
  }
  // Fill up with the other case of a group member.
  for (const p of group) {
    if (wrong.length >= 2) break;
    if (!x.det || !x.g || !x.kase || x.kase === 'G') break;
    const o = otherCaseDet(x.det, x.g, x.kase);
    const v = o ? spell(p, o) : null;
    if (v && lower(v) !== lower(right) && !wrong.some((y) => lower(y) === lower(v))) wrong.push(v);
  }
  const startCap = /^[A-ZÄÖÜ]/.test(right);
  const fix = (v: string) => (startCap ? v[0].toUpperCase() + v.slice(1) : v);
  const opts = [right, ...wrong.slice(0, 2).map(fix)];
  for (let i = opts.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [opts[i], opts[j]] = [opts[j], opts[i]];
  }
  return opts;
}

// ---- the question ---------------------------------------------------------------------------------

/** 暂定 (游戏设计 六): share of cloze slots it takes; 3-choice below this accuracy; wo?/wohin? tag for the first N. */
export const PREP_CFG = { shareLow: 0.2, shareHigh: 0.25, highFrom: 31, pickBelow: 0.6, pickMinN: 5, tagFirst: 20 };

/** Which grammar (言石 / 星位 / 看板) each kind counts as: two-way and 动介搭配 reuse the existing ones. */
export const PREP_SYS: Record<PrepCat, GramSys> = { time: 'timePrep', dat: 'prepDat', acc: 'prepAcc', two: 'twoway', verb: 'prep', gen: 'genPrep' };

type Stat = Record<string, [number, number]>;
const statOf = (s: GameState): Stat => ((s.gram ??= {}).prepStat ??= {});

/** Right / asked on this preposition (p:auf) or kind (c:two), from 介词空 and the 介词秘境. */
export function prepAcc(s: GameState, key: string): { ok: number; n: number } {
  const v = s.gram?.prepStat?.[key];
  return { ok: v?.[0] ?? 0, n: v?.[1] ?? 0 };
}

export function notePrep(s: GameState, x: Pick<PrepInfo, 'prep' | 'cat'>, ok: boolean): void {
  const st = statOf(s);
  for (const k of [`p:${x.prep}`, `c:${x.cat}`]) {
    const v = (st[k] ??= [0, 0]);
    v[1] += 1;
    if (ok) v[0] += 1;
  }
}

const errRate = (s: GameState, key: string) => {
  const a = prepAcc(s, key);
  return a.n ? 1 - a.ok / a.n : 0;
};

export function prepOpen(level: number, cat: PrepCat): boolean {
  return level >= PREP_LV[cat];
}

/** Slots open at this level and not on a sentence this fight already showed. */
export function openSlots(s: GameState, w: Word, seen: (full: string) => boolean = () => false): PrepSlot[] {
  if (s.level < PREP_LV.time) return [];
  return prepSlots(w).filter((x) => prepOpen(s.level, x.info.cat) && !seen(x.full));
}

/** The 介词空 for this word, weighted toward the prepositions and kinds the player gets wrong; null if none fits. */
export function prepBlankTask(s: GameState, w: Word, rng: () => number, seen?: (full: string) => boolean): GramTask | null {
  const slots = openSlots(s, w, seen);
  if (!slots.length) return null;
  const weights = slots.map((x) => 1 + 3 * errRate(s, `p:${x.info.prep}`) + 2 * errRate(s, `c:${x.info.cat}`));
  let r = rng() * weights.reduce((a, b) => a + b, 0);
  let slot = slots[slots.length - 1];
  for (let i = 0; i < slots.length; i++) {
    r -= weights[i];
    if (r < 0) {
      slot = slots[i];
      break;
    }
  }
  return prepTaskOf(s, w, slot, rng);
}

export function prepTaskOf(s: GameState, w: Word, slot: PrepSlot, rng: () => number): GramTask {
  const x = slot.info;
  const acc = prepAcc(s, `c:${x.cat}`);
  // Distractors only from the other case or the confusion groups: no 3-choice when they don't give two.
  const opts = acc.n >= PREP_CFG.pickMinN && acc.ok / acc.n < PREP_CFG.pickBelow ? prepOptions(slot, rng) : null;
  const pick = !!opts && opts.length === 3;
  const tag = x.cat === 'two' && x.kase && prepAcc(s, 'c:two').n < PREP_CFG.tagFirst ? (x.kase === 'A' ? '（wohin? 去哪里 → 第四格）' : '（wo? 在哪里 → 第三格）') : '';
  const what = pick ? '选出空里的介词（和冠词）' : '填介词，后面有冠词就一起填（可以缩写，如 im / zum）';
  return {
    sys: PREP_SYS[x.cat],
    prompt: `介词空：${what}${tag} · ${slot.zh}`,
    focus: slot.shown,
    answer: slot.answer,
    ...(pick ? { options: opts! } : {}),
    tier: pick ? 0 : 1,
    rule: rule(x, slot.answer),
    full: slot.full,
    zh: slot.zh,
    wordId: w.id,
    pb: x,
  };
}
