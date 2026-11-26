// 文章群怪 (游戏设计 四「121–200 级」, 六「文章群怪」): from 121 new words come only in articles. Each article carries
// 5–8 new words of its segment; its words stand in one scene (scripts/build_lexicon.py), and meeting one of them
// brings the others of that scene as a pack. Texts from German Wikinews / Wikipedia (adapted) or written new
// (标「原创」), by the proofreading thread. Loaded on its own chunk once the player is near 121.

export interface ArticleQ {
  /** German question and its Chinese. */
  q: string;
  qZh: string;
  answer: string;
  wrong: [string, string];
}

export interface ArticleB2 {
  id: string;
  /** Region or 蚀变 segment (13–16). */
  seg: number;
  title: string;
  /** Paragraphs. */
  de: string[];
  zh: string[];
  /** The new words (lemmas as in the word list). */
  lemmas: string[];
  /** Words outside the list, explained in the game (not monsters). */
  gloss: Array<{ w: string; de: string; zh: string }>;
  qs: ArticleQ[];
  src: string;
  url: string;
  lic: string;
  original: boolean;
}

export const ARTICLES_B2: ArticleB2[] = [];

let loading: Promise<void> | null = null;
export function loadArticlesB2(): Promise<void> {
  loading ??= import('./articlesB2-gen').then((m) => { if (!ARTICLES_B2.length) ARTICLES_B2.push(...m.ARTICLE_ROWS); }).catch(() => { loading = null; });
  return loading;
}
