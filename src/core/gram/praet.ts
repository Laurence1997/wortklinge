// 过去式分三段 (游戏设计 十六「语法线」): war / hatte 21 级并进完成时 · 情态动词过去式 konnte/musste/wollte 33 级 ·
// 其余动词过去式 0.8（变音秘境过去式层, 81 级）. Forms come from the strong-verb list; regular verbs add -te.

import { EXAMPLES, parse } from '../cloze';
import { pick, type Rng } from '../rng';
import { CONJ, PERSONS, PERSON_LABEL, type Person } from '../../data/verbs';
import { MODAL_PAST, PRAET_HABEN, PRAET_SEIN } from '../../data/grammar/a1';
import { STRONG_VERBS, type StrongVerb } from '../../data/grammar/strongVerbs';
import type { Word } from '../types';
import type { GramTask } from './task';
import { sepParts } from './a1';

export const STRONG_BY_INF: Record<string, StrongVerb> = Object.fromEntries(STRONG_VERBS.map((v) => [v.inf, v]));

const PREFIXES = ['be', 'ver', 'er', 'ge', 'ent', 'emp', 'zer', 'miss'];

/** The strong-list entry for a verb: itself, or the base under an inseparable prefix (verstehen → stehen). */
export function strongOf(inf: string): { v: StrongVerb; prefix: string } | null {
  if (STRONG_BY_INF[inf]) return { v: STRONG_BY_INF[inf], prefix: '' };
  for (const p of PREFIXES) if (inf.startsWith(p) && STRONG_BY_INF[inf.slice(p.length)]) return { v: STRONG_BY_INF[inf.slice(p.length)], prefix: p };
  return null;
}

/** Präteritum ich/er form (kam, machte, arbeitete), or null when the verb is irregular and not in the list. */
export function praetStem(inf: string): string | null {
  const sp = sepParts(inf);
  const base = sp ? inf.slice(sp.particle.length).replace(/^ /, '') : inf;
  const realBase = sp && inf.includes(' ') ? inf.split(' ')[1] : sp ? inf.slice(sp.particle.length) : base;
  const st = strongOf(realBase);
  if (st) return st.prefix + st.v.praet;
  const c = CONJ[realBase] ?? CONJ[inf];
  // Present regular but strong / mixed in the past and not in the list: no safe form.
  if (c && (c.strong || c.pastStrong)) return null;
  let stem = realBase.replace(/(e?n)$/, '');
  if (realBase.endsWith('eln') || realBase.endsWith('ern')) stem = realBase.slice(0, -1);
  const ete = /[dt]$/.test(stem) || /[^aeiouäöülrh][mn]$/.test(stem);
  return `${stem}${ete ? 'ete' : 'te'}`;
}

const END: Record<Person, string> = { ich: '', du: 'st', er: '', wir: 'en', ihr: 't', sie: 'en' };

/** Person form of a Präteritum stem: kam → kamst / kamen; machte → machtest / machten; las → last (lasest also). */
export function praetForm(stem: string, p: Person): string {
  if (stem.endsWith('e')) return stem + ({ ich: '', du: 'st', er: '', wir: 'n', ihr: 't', sie: 'n' } as const)[p];
  if (p === 'du' && /(s|ß|z)$/.test(stem)) return `${stem}t`;
  if (p === 'ihr' && /(t|d)$/.test(stem)) return `${stem}et`;
  return stem + END[p];
}

/** Whole Präteritum form for a person, with the separable particle (stieg … ein → "stieg ein"). */
export function praetFull(inf: string, p: Person): string | null {
  const stem = praetStem(inf);
  if (!stem) return null;
  const sp = sepParts(inf);
  const f = praetForm(stem, p);
  return sp ? `${f} ${sp.particle}` : f;
}

function blankTask(sys: GramTask['sys'], line: string, verb: string, rule: string, prompt: string, tier: 0 | 1 | 2, wordId?: string): GramTask | null {
  const p = parse(line);
  if (!p) return null;
  return {
    sys,
    prompt: `${prompt} · ${p.zh}`,
    focus: `${p.before}___${p.after}（${verb}）`.replace(/\s+/g, ' ').trim(),
    answer: p.blank,
    tier,
    rule,
    full: `${p.before}${p.blank}${p.after}`.replace(/\s+/g, ' ').trim(),
    zh: p.zh,
    wordId,
  };
}

/** war / hatte (21 级): on the sein / haben monsters. Germans say «Ich war krank», not «Ich bin krank gewesen». */
export function praetSeinTask(w: Word, rng: Rng): GramTask | null {
  if (w.de !== 'sein' && w.de !== 'haben') return null;
  const rows = w.de === 'sein' ? PRAET_SEIN : PRAET_HABEN;
  return blankTask(
    'praetSein',
    pick(rng, rows),
    `${w.de}，过去式`,
    w.de === 'sein' ? 'sein 的过去式：war, warst, war, waren, wart, waren（说过去的状态多用 war，不用 ist gewesen）' : 'haben 的过去式：hatte, hattest, hatte, hatten, hattet, hatten',
    '过去式：填 war / hatte 的形式',
    1,
    w.id,
  );
}

const MODAL_RE = new RegExp(`(^|\\s)(${Object.keys(MODAL_PAST).join('|')})(?=\\s)`, 'i');

/** 情态动词过去式 (33 级): this verb's modal sentence moved to yesterday (Ich muss Brot kaufen → Ich ___ gestern …). */
export function praetModalTask(w: Word, rng: Rng): GramTask | null {
  if (w.pos !== 'v') return null;
  const cands: Array<{ before: string; modal: string; rest: string; zh: string }> = [];
  for (const line of EXAMPLES[w.id] ?? []) {
    const p = parse(line);
    if (!p || p.blank !== w.de) continue;
    const m = MODAL_RE.exec(p.before);
    if (!m) continue;
    const modal = m[2];
    const head = p.before.slice(0, m.index + m[1].length);
    const rest = p.before.slice(m.index + m[0].length).trim();
    // Question with the modal first: «Möchtest du etwas …» → «___ du gestern etwas …».
    const restToks = rest.split(' ');
    const withTime = head.trim() === '' && restToks.length ? [restToks[0], 'gestern', ...restToks.slice(1)].join(' ') : `gestern ${rest}`;
    cands.push({ before: head, modal, rest: `${withTime} ${p.blank}${p.after}`, zh: p.zh });
  }
  if (!cands.length) return null;
  const c = pick(rng, cands);
  const ans = MODAL_PAST[c.modal.toLowerCase()];
  const cap = (s: string) => (c.before.trim() === '' ? s[0].toUpperCase() + s.slice(1) : s);
  const full = `${c.before}${cap(ans)} ${c.rest}`.replace(/\s+/g, ' ').trim();
  return {
    sys: 'praetModal',
    prompt: `情态动词过去式：这件事发生在昨天（gestern），填过去式 · 昨天：${c.zh}`,
    focus: `${c.before}___ ${c.rest}（${c.modal.toLowerCase()}）`.replace(/\s+/g, ' ').trim(),
    answer: cap(ans),
    tier: 1,
    rule: '情态动词过去式去掉变音、加 -te：können → konnte，müssen → musste，wollen → wollte（möchte 的过去用 wollte）',
    full,
    zh: c.zh,
    wordId: w.id,
  };
}

/** 其余动词过去式 (81 级): write the Präteritum of this verb monster (er kam, wir machten). */
export function praetTask(w: Word, rng: Rng): GramTask | null {
  if (w.pos !== 'v' || w.de === 'sein' || w.de === 'haben') return null;
  const p = pick(rng, ['ich', 'er', 'er', 'wir', 'du', 'sie'] as Person[]);
  const ans = praetFull(w.de, p);
  if (!ans) return null;
  const st = strongOf(w.de.replace(/^.* /, ''));
  return {
    sys: 'praet',
    prompt: `过去式（Präteritum）：写出 ${PERSON_LABEL[p]} 的形式（${w.de}）`,
    focus: `${p} ___ (${w.de}, 过去式)`,
    answer: ans,
    tier: 1,
    rule: st ? `${w.de} 是强变化动词：过去式 ${st.v.praet}（${st.v.group} 组），ich/er 没有词尾` : '规则动词过去式：词干 + te（machte, arbeitete），ich/er 没有词尾',
    wordId: w.id,
  };
}

export { PERSONS };
