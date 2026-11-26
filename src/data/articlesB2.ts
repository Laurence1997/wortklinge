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
  /** Region or 蚀变 segment (13–16 B2 with new words; 17–20 C1 articles carry none). */
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
let loadingC1: Promise<void> | null = null;
const seen = new Set<string>();
function add(rows: ArticleB2[]): void {
  for (const r of rows) if (!seen.has(r.id)) (seen.add(r.id), ARTICLES_B2.push(r));
}
/** B2 articles (13–16): from level 115. */
export function loadArticlesB2(): Promise<void> {
  loading ??= import('./articlesB2-gen').then((m) => add(m.ARTICLE_ROWS)).catch(() => { loading = null; });
  return loading;
}
/** C1 articles (17–20): from level 155. */
export function loadArticlesC1(): Promise<void> {
  loadingC1 ??= import('./articlesC1-gen').then((m) => add(m.ARTICLE_ROWS)).catch(() => { loadingC1 = null; });
  return loadingC1;
}
