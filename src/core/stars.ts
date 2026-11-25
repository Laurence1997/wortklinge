// 语法星位试炼 (游戏设计 十「外圈：语法星位」, rev 488): from 141, each star is one grammar. The mentor's trial is
// 8 questions on words you have met, 6 right passes; no hits, no penalty, retake any time. Passing lets you spend one
// talent point to light it (classes.ts lightStar).

import { EXAMPLES, parse } from './cloze';
import { keinTask, meinTask, modalTask, sepTask } from './gram/a1';
import { datPronTask } from './gram/a1b';
import { adjTask } from './gram/adj';
import { praetModalTask, praetSeinTask, praetTask } from './gram/praet';
import { gradeGram, type GramTask } from './gram/task';
import type { Rng } from './rng';
import type { GameState } from './state';
import type { Word } from './types';
import { STARS, passStar } from './classes';
import { CONJ, type Person } from '../data/verbs';
import { PERFEKT, perfektFull, perfektParts } from '../data/perfekt';
import { REFLEXIVE_ACC, REFLEXIVE_DAT } from '../data/grammar/reflexive';
import { WORD_BY_ID } from '../data/words';

export const STAR_TRIAL = { n: 8, pass: 6 };

const PERSON_ZH: Record<Person, string> = { ich: 'ich', du: 'du', er: 'er/sie/es', wir: 'wir', ihr: 'ihr', sie: 'sie/Sie' };
const pick = <T,>(rng: Rng, xs: T[]): T => xs[Math.floor(rng() * xs.length)];

/** Sentences of met words that match a rule, with the matched group blanked (题从你见过的词出). */
function regexTasks(s: GameState, re: RegExp, group: number, rule: string, prompt: string, sys: GramTask['sys'] = 'wordform'): GramTask[] {
  const out: GramTask[] = [];
  for (const id of Object.keys(s.words)) {
    for (const line of EXAMPLES[id] ?? []) {
      const p = parse(line);
      if (!p) continue;
      const de = `${p.before}${p.blank}${p.after}`.replace(/\s+/g, ' ').trim();
      const m = re.exec(de);
      if (!m || !m[group]) continue;
      const at = m.index + m[0].indexOf(m[group]);
      const focus = `${de.slice(0, at)}___${de.slice(at + m[group].length)}`;
      if (out.some((t) => t.full === de)) continue;
      out.push({ sys, prompt, focus: `${focus}\n（${p.zh}）`, answer: m[group], tier: 1, rule, full: de, zh: p.zh, wordId: id });
    }
  }
  return out;
}

const met = (s: GameState): Word[] => Object.keys(s.words).map((id) => WORD_BY_ID[id]).filter((w): w is Word => !!w);

function fromWords(s: GameState, rng: Rng, gen: (w: Word) => GramTask | null): GramTask[] {
  const out: GramTask[] = [];
  for (const w of met(s)) {
    const t = gen(w);
    if (t) out.push(t);
  }
  void rng;
  return out;
}

function conjTask(w: Word, rng: Rng, strong: boolean): GramTask | null {
  const c = CONJ[w.de];
  if (!c || !!c.strong !== strong) return null;
  const person: Person = strong ? pick(rng, ['du', 'er'] as Person[]) : pick(rng, ['ich', 'du', 'er', 'wir', 'ihr'] as Person[]);
  return { sys: strong ? 'ablaut' : 'wordform', prompt: `写出变位：${PERSON_ZH[person]} ___（${w.de}）`, focus: `${person} … (${w.de} · ${w.zh})`, answer: c.forms[person], tier: 1, rule: strong ? '不规则动词在 du 和 er/sie/es 换元音（fahren → fährst, fährt）。' : '现在时：ich -e, du -st, er -t, wir -en, ihr -t。', wordId: w.id };
}

const GEN: Record<string, (s: GameState, rng: Rng) => GramTask[]> = {
  article: (s) =>
    met(s)
      .filter((w) => w.art && w.pos === 'n')
      .map((w) => ({ sys: 'article' as const, prompt: '选冠词', focus: `${w.de}（${w.zh}）`, options: ['der', 'die', 'das'], answer: w.art!, tier: 0 as const, rule: `${w.art} ${w.de}`, wordId: w.id })),
  plural: (s) =>
    met(s)
      .filter((w) => w.pl && w.art)
      .map((w) => ({ sys: 'wordform' as const, prompt: '写出复数（可带 die）', focus: `${w.art} ${w.de} → die …`, answer: w.pl!, alts: [`die ${w.pl}`], tier: 1 as const, rule: `复数：die ${w.pl}`, wordId: w.id })),
  present: (s, rng) => fromWords(s, rng, (w) => conjTask(w, rng, false)),
  irregular: (s, rng) => fromWords(s, rng, (w) => conjTask(w, rng, true)),
  separable: (s, rng) => fromWords(s, rng, (w) => sepTask(w, rng)),
  modal: (s, rng) => fromWords(s, rng, (w) => modalTask(w, rng)),
  perfekt: (s) =>
    met(s)
      .filter((w) => PERFEKT[w.de])
      .map((w) => {
        const e = PERFEKT[w.de];
        const x = perfektParts(e);
        return { sys: 'wordform' as const, prompt: `完成式：填助动词和分词（${w.de}）`, focus: `${x.before}___${x.mid}___${x.after}\n（${x.zh}）`, answer: `${x.aux} ${x.pp}`, tier: 1 as const, rule: `${w.de} → ${e.aux === 'sein' ? 'ist' : 'hat'} ${e.pp}`, full: perfektFull(e), wordId: w.id };
      }),
  acc: (s, rng) => fromWords(s, rng, (w) => keinTask(w, rng, false) ?? meinTask(w, rng, false)),
  dat: (s, rng) => [...fromWords(s, rng, (w) => datPronTask(w, rng)), ...regexTasks(s, /\b(mit|bei|nach|von|zu|aus|seit) (dem|der|einem|einer|meinem|meiner|deinem|deiner)\b/, 2, 'mit / bei / nach / von / zu / aus / seit 后面跟第三格。', '填冠词（第三格）')],
  twoway: (s) => regexTasks(s, /\b(in|an|auf|über|unter|vor|hinter|neben|zwischen) (dem|den|der|die|das|einem|einen|einer|eine|ein)\b/, 2, '双向介词：在哪里（Wo?）用第三格，去哪里（Wohin?）用第四格。', '填冠词（Wo? 第三格 / Wohin? 第四格）'),
  adjEnd: (s, rng) => fromWords(s, rng, (w) => adjTask(w, rng, s.level)),
  compare: (s) => regexTasks(s, /\b([a-zäöüß]+er) als\b/, 1, '比较级：形容词 + er + als（größer als）。', '填比较级'),
  reflexive: (s) => {
    const out: GramTask[] = [];
    for (const w of met(s)) {
      const key = w.de.replace(/^sich /, '');
      for (const [de, ans, zh] of [...(REFLEXIVE_ACC[key] ?? []), ...(REFLEXIVE_DAT[key] ?? [])]) out.push({ sys: 'wordform', prompt: '填反身代词', focus: `${de}\n（${zh}）`, answer: ans, tier: 1, rule: '反身代词：mich / dich / sich / uns / euch / sich（第三格 mir / dir）。', full: de.replace('___', ans), wordId: w.id });
    }
    return out;
  },
  subOrder: (s) => regexTasks(s, /\b(?:weil|dass|wenn|ob|obwohl|als|damit|bevor|nachdem)\b[^,.!?]* ([a-zäöüß]+)[,.!?]/, 1, '从句里变位动词放句末（…, weil ich müde bin.）。', '填从句句末的动词'),
  relative: (s) => regexTasks(s, /, (der|die|das|den|dem|deren|dessen|denen) /, 1, '关系代词跟先行词的性和数，格看它在从句里的作用。', '填关系代词'),
  k2: (s) => regexTasks(s, /\b(würde|würdest|würden|hätte|hättest|hätten|wäre|wärst|wären|könnte|könntest|könnten)\b/, 1, '第二虚拟式：würde + 不定式，或 hätte / wäre / könnte。', '填第二虚拟式'),
  passive: (s) => regexTasks(s, /\b(wird|werden|wurde|wurden)\b[^.!?]*\bge[a-zäöüß]+(?:t|en)\b/, 1, '被动：werden + 第二分词（Das Haus wird gebaut.）。', '填被动的助动词'),
  praet: (s, rng) => fromWords(s, rng, (w) => praetSeinTask(w, rng) ?? praetModalTask(w, rng) ?? praetTask(w, rng)),
  genitive: (s) => regexTasks(s, /\b(des|eines|meines|deines|seines|ihres|unseres) [A-ZÄÖÜ][a-zäöüß]*e?s\b/, 1, '属格：阳性和中性 des …(e)s，阴性和复数 der。', '填属格冠词'),
  nDecl: (s) => regexTasks(s, /\b(?:den|dem|des|einen|einem|eines) ((?:Mensch|Student|Kolleg|Jung|Nam|Herr|Kund|Nachbar|Praktikant|Polizist|Expert|Patient|Kunde)e?n)\b/, 1, 'n 变化名词：除了第一格单数都加 -(e)n（den Kollegen, dem Herrn）。', '填名词（n 变化）'),
};

/** Questions available for this star now (more than 8 → a random 8). Null when there are too few met sentences. */
export function starTrial(s: GameState, id: string, rng: Rng): GramTask[] | null {
  const gen = GEN[id];
  if (!gen) return null;
  const all = gen(s, rng);
  if (all.length < STAR_TRIAL.n) return null;
  const pool = [...all];
  const out: GramTask[] = [];
  while (out.length < STAR_TRIAL.n && pool.length) out.push(pool.splice(Math.floor(rng() * pool.length), 1)[0]);
  return out;
}

export function starTrialReady(s: GameState, id: string, rng: Rng): boolean {
  return !!starTrial(s, id, rng);
}

/** Grade a finished trial: answers in order. Passing marks the star (it can then be lit with a point). */
export function finishStarTrial(s: GameState, id: string, tasks: GramTask[], answers: string[]): { right: number; passed: boolean } {
  const right = tasks.filter((t, i) => gradeGram(t, answers[i] ?? '').ok).length;
  const passed = right >= STAR_TRIAL.pass;
  if (passed) passStar(s, id);
  return { right, passed };
}

export const STAR_IDS = STARS.map((x) => x.id);
