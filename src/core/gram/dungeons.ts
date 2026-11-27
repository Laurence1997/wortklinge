// 语法秘境 (游戏设计 四「语法秘境」+ 十六「语法线」): structures that belong to no single word get dungeons, entered from
// the 「语法秘境」 button of a region's camp. They run on the 零号站台 frame: a floor is a few fights, every monster at
// your level, every attack question the floor's grammar on the monster's own word; a clear pays like a 零号站台 run
// (at most 1.2× the field's XP per hour).
//   变音秘境 24: one floor per ablaut family (e,i-a · a-u · a,ei-ie · ü,ie-o · 特殊). Present vowel change, then the
//     Partizip (21/24/27 rules), from 81 the Präteritum floor. A cleared family starts asking its forms in the field.
//   介词秘境 31: one floor per preposition. 锁链怪: lock 1 the preposition, lock 2 the case.
//   词族秘境 37: family members of the word (die Fahrt, der Fahrer, abfahren) and the 构词 floor (suffix → gender).

import { pick, shuffle, type Rng } from '../rng';
import type { GameState } from '../state';
import type { Word } from '../types';
import { WORDS } from '../../data/words';
import { CONJ, PERSON_LABEL, type Person } from '../../data/verbs';
import { STRONG_VERBS } from '../../data/grammar/strongVerbs';
import { PREP_VERBS, type PrepVerb } from '../../data/grammar/prepVerbs';
import { SUFFIX_GENDER, WORD_FAMILIES } from '../../data/grammar/wordFamilies';
import { CONFIG } from '../config';
import { LEX_REL } from '../../data/lexicon';
import { WORD_BY_ID } from '../../data/words';
import { EXAMPLES, parse } from '../cloze';
import type { GramTask } from './task';
import { normalize } from '../grading';
import { praetFull, strongOf } from './praet';

export type DungeonKind = 'ablaut' | 'prep' | 'wordfam';

export const GRAM_DUNGEON = {
  from: { ablaut: 24, prep: 31, wordfam: 37 } as Record<DungeonKind, number>,
  /** Präteritum floor of 变音秘境 (0.8). */
  praetFrom: 81,
  /** Fights per floor (fewer when the floor has fewer words). */
  fights: 4,
  name: { ablaut: '变音秘境', prep: '介词秘境', wordfam: '词族秘境' } as Record<DungeonKind, string>,
  /** Clear reward, as a share of the XP to the next level (零号站台 pays 0.025 for 5 fights + boss). */
  clearXp: 0.02,
};

export interface Floor {
  id: string;
  /** Shown on the floor button. */
  label: string;
  /** Monster word ids, in order. */
  words: string[];
}

const VERBS = () => new Map(WORDS.filter((w) => w.pos === 'v').map((w) => [w.de, w]));

const ABLAUT_ZH: Record<string, string> = {
  'e,i-a': 'e → i（nehmen → nimmt）',
  'a-u': 'a → ä（fahren → fährt）',
  'a,ei-ie': 'ei / a → ie（schreiben → schrieb）',
  'ü,ie-o': 'ie → o（fliegen → geflogen）',
  特殊: '特殊变化（gehen → ging）',
};

/** The floors of a dungeon that have at least two monsters in the word list now. */
export function floorsOf(kind: DungeonKind, s: GameState): Floor[] {
  const vs = VERBS();
  if (kind === 'ablaut') {
    const g = new Map<string, Word[]>();
    for (const v of STRONG_VERBS) {
      const w = vs.get(v.inf);
      if (w && v.inf !== 'sein' && v.inf !== 'haben') g.set(v.group, [...(g.get(v.group) ?? []), w]);
    }
    const out = [...g.entries()].filter(([, ws]) => ws.length >= 2).map(([id, ws]) => ({ id, label: `${id} 族 · ${ABLAUT_ZH[id] ?? id}`, words: ws.map((w) => w.id) }));
    if (s.level >= GRAM_DUNGEON.praetFrom) out.push({ id: 'praet', label: '过去式层 · 所有强变化动词', words: [...g.values()].flat().map((w) => w.id) });
    return out;
  }
  if (kind === 'prep') {
    const g = new Map<string, Set<string>>();
    for (const r of usablePrep()) {
      const w = vs.get(prepVerb(r));
      if (w) g.set(r.prep, (g.get(r.prep) ?? new Set()).add(w.id));
    }
    return [...g.entries()].filter(([, ids]) => ids.size >= 2).map(([p, ids]) => ({ id: p, label: `${p} 层`, words: [...ids] }));
  }
  const fam = WORDS.filter((w) => WORD_FAMILIES[w.de]);
  const out = relFloors(s);
  if (fam.length >= 2) out.push({ id: 'suffix', label: '构词层 · 看词尾定性别', words: fam.filter((w) => WORD_FAMILIES[w.de].some((m) => m.art)).map((w) => w.id) });
  return out;
}

// ---- 词族秘境 relation layers (游戏设计 四, 2026-11-25; data: relations.tsv from the word-list thread) ----------
// 同根层 (anmachen / ausmachen / aufmachen / zumachen), 近义层 (billig / günstig), 形近层 (liegen / legen). A layer opens
// once 2 or more of its words are 归名 (审查修订: ≥2, not all). Only words of the same part of speech share a layer,
// and only those with an example sentence fight in it (the question is always a two-sentence contrast).

export type RelKind = 'root' | 'syn' | 'look';
export const REL_ZH: Record<RelKind, string> = { root: '同根层', syn: '近义层', look: '形近层' };

const known = (s: GameState, id: string) => {
  const p = s.words[id];
  return !!p && (p.stage === 3 || !!p.retired);
};

/** Every relation group of the word list (members of the same part of speech, 2+), deduplicated. */
let groupsCache: Array<{ kind: RelKind; base: string; ids: string[] }> | null = null;
export function relGroups(): Array<{ kind: RelKind; base: string; ids: string[] }> {
  if (groupsCache) return groupsCache;
  const seen = new Set<string>();
  const out: Array<{ kind: RelKind; base: string; ids: string[] }> = [];
  const kinds: RelKind[] = ['root', 'syn', 'look'];
  for (const [id, cols] of Object.entries(LEX_REL)) {
    const w = WORD_BY_ID[id];
    if (!w) continue;
    kinds.forEach((k, i) => {
      let ids = [id, ...cols[i].filter((o) => WORD_BY_ID[o] && WORD_BY_ID[o].pos === w.pos)];
      // 同根层 by its root word (machen → anmachen / ausmachen …): only members that contain the base itself.
      if (k === 'root') ids = ids.filter((o) => o === id || WORD_BY_ID[o].de.toLowerCase().includes(w.de.toLowerCase()));
      if (ids.length < 2) return;
      const key = `${k}:${[...ids].sort().join(',')}`;
      if (seen.has(key)) return;
      seen.add(key);
      out.push({ kind: k, base: id, ids });
    });
  }
  return (groupsCache = out);
}

/** The relation layers open to this player: 2+ members 归名 with an example sentence. Uncleared first, at most 15. */
export function relFloors(s: GameState): Floor[] {
  const done = new Set(cleared(s, 'wordfam'));
  const out: Floor[] = [];
  for (const g of relGroups()) {
    const ids = g.ids.filter((id) => known(s, id) && EXAMPLES_OF(WORD_BY_ID[id]).length);
    if (ids.length < 2) continue;
    const id = `${g.kind}:${g.base}`;
    const names = ids.slice(0, 4).map((x) => WORD_BY_ID[x].de).join(' / ');
    out.push({ id, label: `${REL_ZH[g.kind]} · ${g.kind === 'root' ? `${WORD_BY_ID[g.base].de} 家：` : ''}${names}${ids.length > 4 ? ' …' : ''}`, words: ids });
  }
  out.sort((a, b) => Number(done.has(a.id)) - Number(done.has(b.id)));
  return out.slice(0, 15);
}

/** 「这句该用哪个」: two sentences that differ only in this word — which form goes where. */
export function contrastTask(s: GameState, w: Word, floor: string, rng: Rng): GramTask | null {
  const [kind, base] = floor.split(':') as [RelKind, string];
  const g = relGroups().find((x) => x.kind === kind && x.base === base);
  if (!g) return null;
  const others = g.ids.filter((id) => id !== w.id && known(s, id) && EXAMPLES_OF(WORD_BY_ID[id]).length);
  const mine = (EXAMPLES_OF(w));
  if (!others.length || !mine.length) return null;
  const o = WORD_BY_ID[pick(rng, others)];
  const theirs = EXAMPLES_OF(o);
  const a = pick(rng, mine);
  const b = pick(rng, theirs);
  if (!a || !b || a.blank.toLowerCase() === b.blank.toLowerCase()) return null;
  const answer = `① ${a.blank} · ② ${b.blank}`;
  return {
    sys: 'wordfam',
    prompt: `${REL_ZH[kind]}：这两句该用哪个？（${w.de} / ${o.de}）`,
    focus: `① ${a.before}___${a.after}\n② ${b.before}___${b.after}`,
    answer,
    options: shuffle(rng, [answer, `① ${b.blank} · ② ${a.blank}`]),
    tier: 0,
    rule: `${w.art ? `${w.art} ` : ''}${w.de}：${w.zh}；${o.art ? `${o.art} ` : ''}${o.de}：${o.zh}。① ${a.zh} ② ${b.zh}`,
    full: `${a.before}${a.blank}${a.after}`,
    zh: a.zh,
    wordId: w.id,
    mix: o.id,
  };
}

function EXAMPLES_OF(w: Word) {
  return (EXAMPLES[w.id] ?? []).map(parse).filter((x): x is NonNullable<typeof x> => !!x && !!x.blank.trim());
}

/** The monsters of one run of this floor (shuffled, at most GRAM_DUNGEON.fights). */
export function floorRun(f: Floor, rng: Rng): string[] {
  return shuffle(rng, f.words).slice(0, GRAM_DUNGEON.fights);
}

export function cleared(s: GameState, kind: DungeonKind): string[] {
  return s.gram?.[kind] ?? [];
}

export function markCleared(s: GameState, kind: DungeonKind, floor: string): boolean {
  s.gram ??= {};
  const list = (s.gram[kind] ??= []);
  if (list.includes(floor)) return false;
  list.push(floor);
  return true;
}

// ---- 变音秘境 ------------------------------------------------------------------------------------

/** Present-tense vowel change (du / er), the Partizip once its rule is open, the Präteritum on its floor. */
export function ablautTask(s: GameState, w: Word, floor: string, rng: Rng, step: number): GramTask | null {
  const st = strongOf(w.de);
  const c = CONJ[w.de];
  if (!st || !c) return null;
  const v = st.v;
  const rule = `${w.de} 属于 ${v.group} 族：er ${v.er} · 过去式 ${v.praet} · 完成时 ${v.aux === 'sein' ? 'ist' : 'hat'} ${v.pp}`;
  if (floor === 'praet') {
    const p = pick(rng, ['ich', 'er', 'wir', 'du'] as Person[]);
    const ans = praetFull(w.de, p);
    if (!ans) return null;
    return { sys: 'ablaut', prompt: `变音秘境 · 过去式：写出 ${PERSON_LABEL[p]} 的过去式（${w.zh}）`, focus: `${p} ___ (${w.de})`, answer: ans, tier: 1, rule, wordId: w.id };
  }
  const ppOpen = s.level >= CONFIG.perfekt.irregularFrom;
  const kinds = ['er', 'du', ...(ppOpen ? ['pp'] : [])];
  const k = kinds[step % kinds.length];
  if (k === 'pp') {
    const aux = v.aux === 'sein' ? 'ist' : 'hat';
    return { sys: 'ablaut', prompt: `变音秘境 · 完成时：er ___（hat / ist + 分词）· ${w.zh}`, focus: `er ___ (${w.de})`, answer: `${aux} ${v.pp}`, alts: v.aux === 'haben/sein' ? [`hat ${v.pp}`, `ist ${v.pp}`] : undefined, tier: 2, rule, wordId: w.id };
  }
  const p = k as Person;
  return { sys: 'ablaut', prompt: `变音秘境：写出 ${PERSON_LABEL[p]} 的现在时（${w.zh}）`, focus: `${p} ___ (${w.de})`, answer: c.forms[p], tier: 1, rule, wordId: w.id };
}

/** After a family's floor is cleared, its verbs in the field ask the vowel change (du / er form). */
export function ablautFieldTask(s: GameState, w: Word, rng: Rng): GramTask | null {
  const st = w.pos === 'v' ? strongOf(w.de) : null;
  if (!st || !cleared(s, 'ablaut').includes(st.v.group) || !CONJ[w.de]) return null;
  const t = ablautTask(s, w, st.v.group, rng, Math.floor(rng() * 3));
  return t && { ...t, prompt: t.prompt.replace('变音秘境', `${st.v.group} 族（已打通）`) };
}

// ---- 介词秘境 ------------------------------------------------------------------------------------

export function prepVerb(r: PrepVerb): string {
  return r.combo.replace(/^sich /, '').split(' ')[0];
}

function usablePrep(): PrepVerb[] {
  return PREP_VERBS.filter((r) => r.fixed && (r.kasus === 'A' || r.kasus === 'D') && r.ex.includes(` ${r.prep} `));
}

const ALL_PREPS = ['an', 'auf', 'über', 'mit', 'bei', 'von', 'für', 'nach', 'um', 'zu', 'aus', 'unter', 'vor', 'gegen', 'in'];
const KASUS_ZH = { A: '第四格（Akk.）', D: '第三格（Dat.）' } as const;

/** 锁链怪: lock 1 = pick the preposition in its sentence, lock 2 = which case comes after it. */
export function prepTask(w: Word, floor: string, lock: number, rng: Rng): GramTask | null {
  const rows = usablePrep().filter((r) => prepVerb(r) === w.de && (floor === '' || r.prep === floor));
  if (!rows.length) return null;
  const r = pick(rng, rows);
  // 双锁 (镜像怪 × 介词): a reflexive pairing (sich freuen auf) adds the reflexive pronoun as a first lock.
  const refl = r.reflexive ? /\b(mich|dich|sich|uns|euch)\b/.exec(r.ex) : null;
  const of = refl ? 3 : 2;
  const i = lock % of;
  const lockInfo = { i, of };
  const rule = `${r.combo}：${r.zh}`;
  if (refl && i === 0) {
    return {
      sys: 'mirror',
      prompt: `锁链 1/3 · 反身代词：${r.combo.replace(/ \+ .*$/, '')} · ${r.exZh}`,
      focus: r.ex.replace(new RegExp(`\\b${refl[1]}\\b`), '___'),
      answer: refl[1],
      tier: 1,
      rule: '反身代词：mich, dich, sich, uns, euch, sich',
      full: r.ex,
      zh: r.exZh,
      lock: lockInfo,
      wordId: w.id,
    };
  }
  if (i === of - 2) {
    const others = shuffle(rng, ALL_PREPS.filter((p) => p !== r.prep)).slice(0, 3);
    return {
      sys: 'prep',
      prompt: `锁链 ${i + 1}/${of} · 填介词：${w.de} 固定配哪个介词？· ${r.exZh}`,
      focus: r.ex.replace(` ${r.prep} `, ' ___ '),
      answer: r.prep,
      options: shuffle(rng, [r.prep, ...others]),
      tier: 0,
      rule,
      full: r.ex,
      zh: r.exZh,
      lock: lockInfo,
      wordId: w.id,
      pb: { prep: normalize(r.prep), cat: 'verb' },
    };
  }
  const k = r.kasus as 'A' | 'D';
  return {
    sys: 'prep',
    prompt: `锁链 ${of}/${of} · 选格：${r.combo.replace(/ \+ .*$/, '')} 后面用第几格？· ${r.exZh}`,
    focus: r.ex,
    answer: KASUS_ZH[k],
    options: [KASUS_ZH.A, KASUS_ZH.D],
    tier: 0,
    rule,
    full: r.ex,
    zh: r.exZh,
    lock: lockInfo,
    wordId: w.id,
    pb: { prep: normalize(r.prep), cat: 'verb' },
  };
}

// ---- 词族秘境 ------------------------------------------------------------------------------------

/** 词族层: write a family member from its Chinese (nouns with the article). 构词层: its gender from the suffix. */
export function wordfamTask(s: GameState, w: Word, floor: string, rng: Rng): GramTask | null {
  if (floor.includes(':')) return contrastTask(s, w, floor, rng);
  const fam = WORD_FAMILIES[w.de];
  if (!fam?.length) return null;
  if (floor === 'suffix') {
    const nouns = fam.filter((m) => m.art);
    if (!nouns.length) return null;
    const m = pick(rng, nouns);
    const suf = SUFFIX_GENDER.find((x) => m.de.endsWith(x.suf));
    return {
      sys: 'wordform',
      prompt: `构词层：${w.de} 家的这个词是什么性别？· ${m.zh}`,
      focus: m.de,
      answer: m.art!,
      options: ['der', 'die', 'das'],
      tier: 0,
      rule: suf ? suf.rule : m.how,
      full: `${m.art} ${m.de}`,
      wordId: w.id,
    };
  }
  const m = pick(rng, fam);
  const ans = m.art ? `${m.art} ${m.de}` : m.de;
  return {
    sys: 'wordfam',
    prompt: `词族层：从 ${w.de} 长出来的词，看中文写出来${m.art ? '（带冠词）' : ''}`,
    focus: `${m.zh}（${w.de} 家）`,
    answer: ans,
    tier: 1,
    rule: m.how,
    full: ans,
    wordId: w.id,
  };
}

/** The dungeon question for this monster (null → its usual question). */
export function dungeonTask(s: GameState, kind: DungeonKind, floor: string, w: Word, rng: Rng, step: number): GramTask | null {
  if (kind === 'ablaut') return ablautTask(s, w, floor, rng, step);
  if (kind === 'prep') return prepTask(w, floor, step, rng);
  return wordfamTask(s, w, floor, rng);
}
