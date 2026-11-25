// 听段题 texts (游戏设计 「听力」, 34 级): 2–4 sentences of a talk or announcement using the monster's word, one content
// question in German with three answers. Written per region by the proofreading thread (AI + auto-check) and pasted
// here; empty until that batch arrives (盲听 needs no data).

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

export const PASSAGES: Passage[] = [];
