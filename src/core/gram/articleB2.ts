// 文章群怪 (121+, 游戏设计 四「121–200 级」/ 六「文章群怪」): a new word of a B2 article comes as a pack with the
// article's other new words in its scene. Every member carries the article: its extra-damage questions are the
// article's content questions (German, 3 per article), and its own blow is the word's meaning picked from the
// article sentence it stands in (靠上下文推出意思; no 「打出正确形式」). A kill ends at 半名 (outcomes.ts); 归名 comes
// from a context question written right later.

import { ARTICLES_B2, type ArticleB2 } from '../../data/articlesB2';
import type { Notice } from '../../data/grammar/notices';
import type { Word } from '../types';

export const ARTICLE_B2_CFG = {
  /** New words come only in articles from here (the B2 regions). */
  from: 121,
  /** Article members in one pack, the met word included (CONFIG.pack.max4 elsewhere). */
  packMax: 4,
};

let indexedFor = -1;
const BY_ID = new Map<string, ArticleB2>();
const BY_WORD = new Map<string, ArticleB2>();
const AS_NOTICE = new Map<string, Notice>();

function index(): void {
  if (indexedFor === ARTICLES_B2.length) return;
  indexedFor = ARTICLES_B2.length;
  BY_ID.clear();
  BY_WORD.clear();
  AS_NOTICE.clear();
  for (const a of ARTICLES_B2) {
    BY_ID.set(a.id, a);
    for (const l of a.lemmas) if (!BY_WORD.has(`${a.seg}|${l}`)) BY_WORD.set(`${a.seg}|${l}`, a);
  }
}

export function articleB2ById(id: string): ArticleB2 | undefined {
  index();
  return BY_ID.get(id);
}

/** The article a word of a B2 segment is a new word of (the first one, by id). */
export function articleOfWord(w: Word): ArticleB2 | undefined {
  index();
  return BY_WORD.get(`${w.region ?? 0}|${w.de}`);
}

export function isArticleWord(a: ArticleB2, w: Word): boolean {
  return (w.region ?? 0) === a.seg && a.lemmas.includes(w.de);
}

/** The article as a notice (kind 'article'), for the battle's content questions and the reading pane. */
export function articleNotice(id: string): Notice | undefined {
  const a = articleB2ById(id);
  if (!a) return undefined;
  let n = AS_NOTICE.get(id);
  if (!n) {
    n = {
      id: a.id,
      zone: '*',
      kind: 'article',
      title: a.title,
      text: a.de.join('\n\n') + `\n\n— ${a.original ? '原创' : `${a.src}${a.lic ? ` · ${a.lic}` : ''}`}`,
      qs: a.qs.map((q) => ({ q: q.q, qZh: q.qZh, options: [q.answer, ...q.wrong], answer: q.answer })),
    };
    AS_NOTICE.set(id, n);
  }
  return n;
}

const SENT = /[^.!?…]+[.!?…]+[“”"»«]?|[^.!?…]+$/g;

/** The article sentence the word stands in (a form starting with its stem; separable verbs: the stem after the prefix). */
export function contextLine(a: ArticleB2, w: Word): string | null {
  const de = w.de.replace(/^(sich|der|die|das)\s+/i, '').split(/[\s,/(]/)[0];
  if (!de) return null;
  const low = de.toLowerCase();
  const stems = [low.slice(0, Math.max(4, low.length - 2))];
  // aufgreifen → greif…: a separable verb splits in a main clause.
  const sep = low.match(/^(ab|an|auf|aus|bei|ein|fest|her|hin|los|mit|nach|vor|weg|zu|zurück|zusammen)(.{4,})en$/);
  if (sep) stems.push(sep[2].slice(0, Math.max(4, sep[2].length - 1)));
  for (const para of a.de) {
    for (const s of para.match(SENT) ?? []) {
      const words = s.toLowerCase().split(/[^a-zäöüß]+/);
      if (stems.some((st) => words.some((x) => x.startsWith(st) || (st.length >= 6 && x.includes(st))))) return s.trim();
    }
  }
  return null;
}
