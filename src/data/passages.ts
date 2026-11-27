// 听段题 texts (游戏设计 「听力」, 34 级): 2–4 sentences of a talk or announcement using the monster's word, one content
// question in German with three answers. Written per region by the proofreading thread (AI + auto-check) and pasted
// generated from data/wortschatz/hoeren-6000.tsv (盲听 needs no data).

export interface Passage {
  id: string;
  /** The monster word it must use. */
  wordId: string;
  /** The text, sentence by sentence (read aloud, never shown before answering). */
  lines: string[];
  /** Chinese of the whole text (shown after answering). */
  zh: string;
  /** The question (German) and its Chinese. */
  q: string;
  qZh: string;
  answer: string;
  /** The two wrong answers. */
  wrong: [string, string];
}

/** 约 4400 段 from data/wortschatz/hoeren-6000.tsv (scripts/build_lexicon.py → passages-gen.ts).
 *  Loaded on its own chunk after boot (~0.8 MB gzip, only needed from level 34): empty until loadPassages() resolves. */
export const PASSAGES: Passage[] = [];

let loading: Promise<void> | null = null;
export function loadPassages(): Promise<void> {
  loading ??= import('./passages-gen').then((m) => { PASSAGES.push(...m.PASSAGE_ROWS); }).catch(() => { loading = null; });
  return loading;
}
