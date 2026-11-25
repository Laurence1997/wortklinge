// A1 写作第一层 (游戏设计 › 词表导入和 A1 写作, 2026-11-22): sentence tasks whose right answers can all be listed,
// so a rule check never calls a right sentence wrong.
//   排句  — the word's example sentence cut into chunks and shuffled; type it whole. The first chunk keeps its
//           capital letter, so only one order is right (it trains the verb in second place).
//   槽位造句 — the monster asks (Was brauchst du?); answer with the frame and ANY noun from your wordbook that fits
//           the frame, article and case right. Answers = frame × your nouns of that kind: listable, but you choose.
//   连句  — two short sentences and a joining word (und / oder / aber / denn; later weil / dass / wenn) → one sentence.

import { normalize } from './grading';
import { parse, EXAMPLES } from './cloze';
import { pick, shuffle, type Rng } from './rng';
import { expectedSentence, gradeSentence, PATTERNS, sentenceTags, type Pattern } from './sentence';
import type { Word } from './types';
import { LINKS, SUB_LINKS, type LinkRow } from '../data/links';
import { WORDS } from '../data/words';

/** Share of cloze slots that become 排句 / 槽位造句 once open (the rest stay normal cloze). */
export const WRITE_CHANCE = { order: 0.25, slot: 0.3, link: 0.35 };
/** 槽位造句: nouns you answered with lately can't be used again until this many others came in between. */
export const SLOT_RECENT = 5;

const key = (v: string) => normalize(v).replace(/\s+/g, ' ').trim();

// Words that lean on the next word: kept in one chunk with it (am Abend, einen Tee, mit Butter, sehr kalt).
const LEAN = new Set(
  'der die das den dem des ein eine einen einem einer eines kein keine keinen keinem mein meine meinen meinem dein deine deinen sein seine seinen ihr ihre ihren unser unsere zum zur am im ins vom beim in an auf mit für zu von bei nach aus um über unter vor hinter neben zwischen sehr so zu noch nicht gern ganz zwei drei vier fünf'.split(' '),
);

/** Cut a sentence into 3–6 chunks: each chunk ends on a word that doesn't lean on the next. */
export function chunks(sentence: string): string[] {
  const words = sentence.replace(/\s+/g, ' ').trim().replace(/[.!?]$/, '').split(' ');
  const out: string[] = [];
  let cur: string[] = [];
  for (const w of words) {
    cur.push(w);
    const bare = w.toLowerCase().replace(/[,;:]/g, '');
    if (!LEAN.has(bare) || /[,;:]$/.test(w)) {
      out.push(cur.join(' '));
      cur = [];
    }
  }
  if (cur.length) out.push(cur.join(' '));
  return out;
}

export interface OrderTask {
  /** Chunks in shuffled order (never the right order). */
  shown: string[];
  answer: string;
  zh: string;
}

/** 排句 for this word: one of its example sentences with 3–6 chunks, or null. */
export function orderTask(w: Word, rng: Rng): OrderTask | null {
  const cands = (EXAMPLES[w.id] ?? [])
    .map(parse)
    .filter((p): p is NonNullable<typeof p> => !!p && !!p.zh)
    .map((p) => ({ full: (p.before + p.blank + p.after).replace(/\s+/g, ' ').trim(), zh: p.zh }))
    .filter((x) => !/["„“]/.test(x.full))
    .map((x) => ({ ...x, cs: chunks(x.full) }))
    .filter((x) => x.cs.length >= 3 && x.cs.length <= 6);
  if (!cands.length) return null;
  const c = pick(rng, cands);
  let shown = shuffle(rng, c.cs);
  for (let i = 0; i < 5 && shown.join(' ') === c.cs.join(' '); i++) shown = shuffle(rng, c.cs);
  if (shown.join(' ') === c.cs.join(' ')) shown = [...shown.slice(1), shown[0]];
  return { shown, answer: c.full, zh: c.zh };
}

/** 排句 is right when the words are the sentence's, in its order (punctuation and case don't matter). */
export function gradeOrder(input: string, answer: string): boolean {
  return key(input) === key(answer);
}

/** 槽位造句 questions per frame: what the monster asks. woist and the plural frames are left out (no question fits). */
export const SLOT_ASK: Partial<Record<Pattern, { de: string; zh: string }>> = {
  moechte: { de: 'Was möchtest du?', zh: '你想要什么？' },
  brauche: { de: 'Was brauchst du?', zh: '你需要什么？' },
  suche: { de: 'Was suchst du?', zh: '你在找什么？' },
  habe: { de: 'Was hast du?', zh: '你有什么？' },
  nehme: { de: 'Was nimmst du?', zh: '你要（买）什么？' },
  moechte0: { de: 'Was möchtest du?', zh: '你想要什么？' },
  brauche0: { de: 'Was brauchst du?', zh: '你需要什么？' },
};

export interface SlotTask {
  pattern: Pattern;
  ask: string;
  askZh: string;
  /** The frame with ___ (Ich brauche ___.). */
  frame: string;
  /** The monster's own noun in that frame, shown when the answer is wrong. */
  answer: string;
}

/** 槽位造句 for this monster: a frame its noun carries that has a question. */
export function slotTask(w: Word, rng: Rng): SlotTask | null {
  if (!w.art) return null;
  const pats = sentenceTags(w).filter((p) => SLOT_ASK[p]);
  if (!pats.length) return null;
  const p = pick(rng, pats);
  const ask = SLOT_ASK[p]!;
  return { pattern: p, ask: ask.de, askZh: ask.zh, frame: `${PATTERNS[p].lead} ___.`, answer: expectedSentence(w, p) };
}

/** Nouns that fit a frame: the monster's own word, and words from your wordbook carrying the same frame. */
export function slotNouns(pattern: Pattern, known: (w: Word) => boolean, own: Word): Word[] {
  return WORDS.filter((x) => (x.id === own.id || known(x)) && !!x.art && sentenceTags(x).includes(pattern));
}

export interface SlotVerdict {
  ok: boolean;
  /** The noun the player used (when one was recognised). */
  used?: Word;
  /** Used a noun that is still on the 'used lately' list. */
  repeated?: boolean;
  notes: string[];
}

/** Grade 槽位造句: right when the sentence is the frame with one of the fitting nouns, article and case right. */
export function gradeSlot(input: string, t: SlotTask, nouns: Word[], recent: string[] = [], ownId = ''): SlotVerdict {
  const n = key(input);
  // Which noun did they mean? The one whose bare form appears in the answer (longest first: Kleingeld before Geld).
  const byLen = [...nouns].sort((a, b) => b.de.length - a.de.length);
  const used = byLen.find((x) => ` ${n} `.includes(` ${key(x.de)} `) || ` ${n} `.includes(` ${key(x.pl ?? '#')} `));
  // 2026-11-25 (Lucas, 游戏设计 rev 219): the sentence must use this monster's own word (plural and case forms
  // count); another noun, however right, does not hit.
  const own = nouns.find((x) => x.id === ownId);
  if (own && used?.id !== own.id) return { ok: false, used, notes: [`这只怪是 ${own.art} ${own.de}，句子里要用上它：${t.answer}`] };
  if (!used) return { ok: false, notes: [`空里要填能放进「${t.frame}」的名词，比如：${t.answer}`] };
  if (recent.includes(used.id) && used.id !== ownId) {
    return { ok: false, used, repeated: true, notes: [`${used.de} 最近刚用过，换一个词试试（最近用过的 ${SLOT_RECENT} 个先不算）`] };
  }
  const v = gradeSentence(input, used, t.pattern);
  return { ok: v.ok, used, notes: v.ok ? [] : v.notes.length ? v.notes : [`正确写法：${expectedSentence(used, t.pattern)}`] };
}

/** 连句: a pair for this word (one that mentions it, else any), with only the joining words open at this level. */
export function linkTask(w: Word, rng: Rng, subOpen: boolean): LinkRow | null {
  const open = LINKS.filter((r) => subOpen || !SUB_LINKS.includes(r.conj));
  if (!open.length) return null;
  const bare = key(w.de);
  const mine = open.filter((r) => ` ${key(r.a)} ${key(r.b)} `.includes(` ${bare} `));
  return pick(rng, mine.length ? mine : open);
}

export function gradeLink(input: string, r: LinkRow): boolean {
  return key(input) === key(r.answer);
}
