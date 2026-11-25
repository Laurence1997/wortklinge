// A1 突破试炼 (0.6 第 6 块, 30 级, 考官): four parts of 8 questions on words you have met in regions 1–3
// (语法 added in 0.6.x, see grammarQs).
// 听: hear a sentence (or the word), pick what it means. 读: a sentence with a blank, pick the word.
// 写: Chinese to German, nouns with the article. Each part needs 5 of 8. No damage, no penalty, retry any time.
// Passing all four sets flags.a1Passed + flags.a1Grammar and the title 「A1 突破者」. In 0.6 the cap stays at 30 (A2 opens in 0.7);
// the XP over the cap is kept up to one level, as before.

import { EXAMPLES, caseClozes, clozeOptions, makeCloze, pronounClozes } from './cloze';
import { gradeTyped, normalize } from './grading';
import { CONJ, PERSON_LABEL, type Person } from '../data/verbs';
import { PERFEKT, perfektParts } from '../data/perfekt';
import { shuffle, type Rng } from './rng';
import type { GameState } from './state';
import type { Word } from './types';
import { hasArticleQuestion, WORDS } from '../data/words';
import { STAGE_DEF, type Stage } from './stages';
import { LINE_GENS } from './gram/lines';
import { adjTask } from './gram/adj';
import { mirrorTask } from './gram/mirror';
import { praetModalTask, praetTask } from './gram/praet';
import type { GramTask } from './gram/task';

export const BREAK = { from: 30, perPart: 8, pass: 5 };

export type ExamPart = 'listen' | 'read' | 'write' | 'grammar';
export const PART_ZH: Record<ExamPart, string> = { listen: '听', read: '读', write: '写', grammar: '语法' };
export const PARTS: ExamPart[] = ['listen', 'read', 'write', 'grammar'];

export interface ExamQ {
  part: ExamPart;
  word: Word;
  /** Read aloud (listen part). */
  say?: string;
  /** What is shown: nothing for listen, the gapped sentence for read, the Chinese for write. */
  prompt: string;
  options?: string[];
  answer: string;
  /** 语法: the accepted answers for one or two blanks (two: Perfekt aux + participle, typed as "a|b"). */
  blanks?: string[];
  /** 语法 case questions: every article of the right case for this gender counts (den or einen, dem or einem). */
  alts?: string[];
  /** 语法: the whole sentence and a one-line Chinese rule, shown after a wrong answer. */
  full?: string;
  hint?: string;
  zh?: string;
}

export interface Exam {
  qs: ExamQ[];
  at: number;
  right: Record<ExamPart, number>;
  /** 补考语法: only the grammar part (saves that passed the three parts before 0.6.x). */
  grammarOnly?: boolean;
  /** 0.7/0.8: which trial (A1 at 30, A2 at 80, B1 at 120). Missing = A1 (older code paths). */
  stage?: Stage;
  last?: { ok: boolean; q: ExamQ; input: string };
  over: boolean;
}

/** Only words you met; taken early (提前考, Lucas 2026-11-25) or with under 40 met, the whole stage's list. */
function pool(s: GameState, stage: Stage = 'A1'): Word[] {
  const [lo, hi] = STAGE_DEF[stage].regions;
  const ok = (w: Word) => (w.region ?? 1) >= lo && (w.region ?? 1) <= hi && w.pos !== 'phr' && !w.digit && !w.tutorial;
  const met = WORDS.filter((w) => ok(w) && s.words[w.id]);
  return met.length >= 40 && s.level >= STAGE_DEF[stage].cap ? met : WORDS.filter(ok);
}

/** 突破试炼可以提前考 (Lucas 2026-11-25): open at the examiner from the level 全量筛选 opens; passing early opens the
 *  cap at 30 with no second test. */
export const BREAK_EARLY = true;

function sentenceOf(w: Word): { de: string; zh: string } | null {
  for (const line of EXAMPLES[w.id] ?? []) {
    const [de, zh] = line.split('|');
    if (zh) return { de: de.replace(/[{}]/g, ''), zh };
  }
  return null;
}

/** 0.7/0.8: A2 and B1 use the same four parts on their own regions' words (游戏设计 七), the grammar part asks the
 *  stage's own items (stageGrammarQs). Still to come: B1's short article in 读 and one AI-graded free sentence in 写. */
export function startExam(s: GameState, rng: Rng, stage: Stage = 'A1'): Exam {
  const words = shuffle(rng, pool(s, stage));
  const used = new Set<string>();
  const take = (fits: (w: Word) => boolean) => {
    const w = words.find((x) => !used.has(x.id) && fits(x));
    if (w) used.add(w.id);
    return w;
  };
  const qs: ExamQ[] = [];
  // 听: a whole sentence when the word has one, else the word; pick the Chinese from four.
  for (let i = 0; i < BREAK.perPart; i++) {
    const w = take((x) => !!sentenceOf(x)) ?? take(() => true);
    if (!w) break;
    const sen = sentenceOf(w);
    const answer = sen ? sen.zh : w.zh;
    const others = shuffle(rng, words.filter((x) => x.id !== w.id))
      .map((x) => (sen ? sentenceOf(x)?.zh : x.zh))
      .filter((z): z is string => !!z && z !== answer)
      .slice(0, 3);
    qs.push({ part: 'listen', word: w, say: sen ? sen.de : w.de, prompt: '', options: shuffle(rng, [answer, ...others]), answer });
  }
  // 读: a sentence with the word blanked out, pick the word.
  for (let i = 0; i < BREAK.perPart; i++) {
    let made: ExamQ | null = null;
    while (!made) {
      const w = take(() => true);
      if (!w) break;
      const c = makeCloze(w, 'base', rng);
      if (c) made = { part: 'read', word: w, prompt: c.shown, options: clozeOptions(w, c.answer, rng), answer: c.answer };
    }
    if (made) qs.push(made);
  }
  // 写: Chinese to German.
  for (let i = 0; i < BREAK.perPart; i++) {
    const w = take(() => true);
    if (!w) break;
    qs.push({ part: 'write', word: w, prompt: w.zh, answer: w.de });
  }
  qs.push(...(stage === 'A1' ? grammarQs(s, rng, STAGE_DEF[stage].regions[1]) : stageGrammarQs(s, rng, stage, words)));
  return { qs, at: 0, right: { listen: 0, read: 0, write: 0, grammar: 0 }, over: false, stage };
}

/** 补考语法: the grammar part alone. */
export function startGrammarExam(s: GameState, rng: Rng): Exam {
  return { qs: grammarQs(s, rng), at: 0, right: { listen: 0, read: 0, write: 0, grammar: 0 }, over: false, grammarOnly: true };
}

/** Articles of this case for the noun's gender: the blank tests the case, not definite vs indefinite. */
function caseArticles(w: Word, c: 'acc' | 'dat'): string[] {
  const g = w.plOnly ? 'pl' : w.art === 'der' ? 'm' : w.art === 'die' ? 'f' : 'n';
  const T: Record<'acc' | 'dat', Record<string, string[]>> = {
    acc: { m: ['den', 'einen', 'keinen'], f: ['die', 'eine', 'keine'], n: ['das', 'ein', 'kein'], pl: ['die', 'keine'] },
    dat: { m: ['dem', 'einem', 'keinem'], f: ['der', 'einer', 'keiner'], n: ['dem', 'einem', 'keinem'], pl: ['den', 'keinen'] },
  };
  return T[c][g];
}

const ACC_HINT = '这里是动词的直接宾语，用第四格（宾格）：阳性 der → den，ein → einen；阴性、中性不变。';
const datHint = (prep: string | null) => (prep ? `${prep} 后面用第三格（与格）：dem / der / dem，复数 den。` : '这里要用第三格（与格）：阳性、中性 dem，阴性 der。');

/** 语法 (0.6.x): 宾格 2, 与格 2, 变位 2 (one regular, one strong), 完成时 2 (one haben, one sein), all typed into a
 *  sentence, only with words you have met, reusing the battle's case and Perfekt frames. */
export function grammarQs(s: GameState, rng: Rng, maxRegion = 3): ExamQ[] {
  const met = (w: Word) => !!s.words[w.id];
  const nouns = shuffle(rng, WORDS.filter((w) => w.pos === 'n' && (w.region ?? 1) <= maxRegion)).sort((a, b) => Number(met(b)) - Number(met(a)));
  const verbs = shuffle(rng, WORDS.filter((w) => w.pos === 'v' && (w.region ?? 1) <= maxRegion)).sort((a, b) => Number(met(b)) - Number(met(a)));
  const out: ExamQ[] = [];
  const used = new Set<string>();
  // 宾格: article clozes on accusative slots (den / einen), else ihn / sie / es.
  const acc: ExamQ[] = [];
  for (const w of nouns) {
    if (acc.length >= 2) break;
    const c = shuffle(rng, caseClozes(w, 'acc'))[0];
    if (c) {
      acc.push({ part: 'grammar', word: w, prompt: c.shown, answer: c.answer, blanks: [c.answer], alts: caseArticles(w, 'acc'), full: c.full, hint: ACC_HINT, zh: c.zh });
      used.add(w.id);
    }
  }
  for (const w of nouns) {
    if (acc.length >= 2) break;
    if (used.has(w.id)) continue;
    const c = shuffle(rng, pronounClozes(w))[0];
    if (c) {
      acc.push({ part: 'grammar', word: w, prompt: c.shown, answer: c.answer, blanks: [c.answer], full: c.full, hint: '宾语换成代词：阳性 ihn，阴性和复数 sie，中性 es。', zh: c.zh });
      used.add(w.id);
    }
  }
  out.push(...acc);
  // 与格
  let dat = 0;
  for (const w of nouns) {
    if (dat >= 2) break;
    if (used.has(w.id)) continue;
    const c = shuffle(rng, caseClozes(w, 'dat'))[0];
    if (!c) continue;
    out.push({ part: 'grammar', word: w, prompt: c.shown, answer: c.answer, blanks: [c.answer], alts: caseArticles(w, 'dat'), full: c.full, hint: datHint(c.prep), zh: c.zh });
    used.add(w.id);
    dat++;
  }
  // 变位: one regular verb (any person but ich), one strong verb (du or er, where the stem changes).
  const conjQ = (strong: boolean) => {
    const w = verbs.find((x) => !used.has(x.id) && CONJ[x.de] && !!CONJ[x.de].strong === strong && x.de !== 'sein' && x.de !== 'haben');
    if (!w) return;
    used.add(w.id);
    const c = CONJ[w.de];
    const pool: Person[] = strong ? ['du', 'er'] : ['du', 'er', 'wir', 'ihr'];
    const person = pool[Math.floor(rng() * pool.length)];
    const hint = strong
      ? `${w.de} 是变化动词，du 和 er 要变词干：du ${c.forms.du}，er ${c.forms.er}。`
      : `规则动词：去掉 -en，du 加 -st，er 加 -t，wir 用原形，ihr 加 -t（${c.forms.du} / ${c.forms.er}）。`;
    out.push({ part: 'grammar', word: w, prompt: `${PERSON_LABEL[person]} ___（${w.de}）`, answer: c.forms[person], blanks: [c.forms[person]], full: `${person === 'er' ? 'er' : person === 'sie' ? 'sie' : person} ${c.forms[person]}`, hint, zh: w.zh });
  };
  conjQ(false);
  conjQ(true);
  // 完成时: the verb's Perfekt sentence with the auxiliary and the participle blanked.
  for (const aux of ['haben', 'sein'] as const) {
    const w = verbs.find((x) => !used.has(x.id) && PERFEKT[x.de]?.aux === aux);
    if (!w) continue;
    used.add(w.id);
    const x = perfektParts(PERFEKT[w.de]);
    const hint = aux === 'haben' ? `${w.de} 不是位移也不是状态变化，完成时用 haben。` : w.de === 'sein' || w.de === 'bleiben' ? `sein 和 bleiben 的完成时都用 sein。` : `${w.de} 表示位移或状态变化，完成时用 sein。`;
    out.push({ part: 'grammar', word: w, prompt: `${x.before}___${x.mid}___（${w.de}）${x.after}`.replace(/\s+/g, ' ').trim(), answer: `${x.aux} … ${x.pp}`, blanks: [x.aux, x.pp], full: `${x.before}${x.aux}${x.mid}${x.pp}${x.after}`, hint, zh: x.zh });
  }
  return out;
}

export function answerExam(e: Exam, input: string): void {
  const q = e.qs[e.at];
  if (!q || e.over) return;
  const key = (v: string) => normalize(v).replace(/\s+/g, ' ').trim();
  const parts = input.split('|');
  const ok = q.alts
    ? q.alts.some((a) => key(input) === key(a))
    : q.blanks
    ? q.blanks.every((b, i) => key(parts[i] ?? '') === key(b))
    : q.part === 'write'
      ? gradeTyped(input, q.word, hasArticleQuestion(q.word)).ok
      : input === q.answer;
  if (ok) e.right[q.part] += 1;
  e.last = { ok, q, input };
  e.at += 1;
  if (e.at >= e.qs.length) e.over = true;
}

/** A2 / B1 语法段 (游戏设计 七): this stage's own grammar, one question per item until eight, from the words of the
 *  trial's pool. A2: 形容词词尾、双向介词、反身代词、情态过去式、第二虚拟式、关系从句、被动、过去完成时.
 *  B1: 其余过去式、被动过去式、属格、属格介词、与格反身、n 变化名词 (two items get a second question). */
type ItemGen = (w: Word, rng: Rng) => GramTask | null;
const L = (k: keyof typeof LINE_GENS): ItemGen => (w, rng) => LINE_GENS[k]!(w, rng);
export const STAGE_GRAMMAR: Record<'A2' | 'B1' | 'B2', ItemGen[]> = {
  A2: [(w, rng) => adjTask(w, rng, 80), L('twoway'), (w, rng) => mirrorTask(w, rng, 80), praetModalTask, L('k2'), L('relative'), L('passive'), L('plq')],
  B1: [praetTask, L('passPast'), L('genitive'), L('genPrep'), (w, rng) => (w.pos === 'v' ? mirrorTask(w, rng, 120) : null), L('nDecl'), praetTask, L('genitive')],
  // B2 (160): the 121–141 rules opened by then, plus two from 101–111 while the B2 sentences are few (暂定).
  B2: [L('k1'), L('passAlt'), L('hinHer'), L('fvg'), L('nomPrep'), L('passAlt'), L('k1'), L('dblConj')],
};

export function stageGrammarQs(s: GameState, rng: Rng, stage: 'A2' | 'B1' | 'B2', words: Word[]): ExamQ[] {
  const out: ExamQ[] = [];
  const used = new Set<string>();
  // Items with no fitting sentence among this pool fall back to any word in the list.
  const all = shuffle(rng, WORDS.filter((w) => w.pos !== 'phr' && !w.digit));
  for (const gen of STAGE_GRAMMAR[stage]) {
    let t: GramTask | null = null;
    let w: Word | undefined;
    for (const src of [words, all]) {
      for (const x of src) {
        if (used.has(x.id)) continue;
        t = gen(x, rng);
        if (t) {
          w = x;
          break;
        }
      }
      if (t) break;
    }
    if (!t || !w) continue;
    used.add(w.id);
    out.push({ part: 'grammar', word: w, prompt: t.focus, answer: t.answer, options: t.options, blanks: t.options ? undefined : [t.answer], alts: t.options ? undefined : [t.answer, ...(t.alts ?? [])], full: t.full, hint: t.rule, zh: t.zh ?? t.prompt });
  }
  void s;
  return out;
}

/** Parts this exam asks (all four, or grammar alone for 补考). */
export function examParts(e: Exam): ExamPart[] {
  return e.grammarOnly ? ['grammar'] : PARTS;
}

export function examPassed(e: Exam): boolean {
  return examParts(e).every((p) => e.right[p] >= BREAK.pass);
}

/** A1 done: the three old parts and the grammar part (0.7 needs this to open Lv31). Saves that passed before
 *  0.6.x keep a1Passed and the title but still owe the grammar part (flags.a1Grammar). */
export function a1Complete(flags: Record<string, unknown>): boolean {
  return !!flags.a1Passed && !!flags.a1Grammar;
}
