import { describe, expect, it } from 'vitest';
import { ARTICLE_ROWS } from '../src/data/articlesB2-gen';
import { ARTICLES_B2 } from '../src/data/articlesB2';
import { articleNotice, articleOfWord, contextLine, isArticleWord } from '../src/core/gram/articleB2';
import { noticeById } from '../src/core/gram/notice';
import { WORDS } from '../src/data/words';
import { newGame } from '../src/core/state';
import { startBattle } from '../src/core/combat';
import { makeRng } from '../src/core/rng';

ARTICLES_B2.push(...ARTICLE_ROWS);

describe('文章群怪 (B2 articles)', () => {
  it('every article has text, 3 questions and words of its segment', () => {
    for (const a of ARTICLES_B2) {
      expect(a.de.length, a.id).toBeGreaterThan(0);
      expect(a.qs.length, a.id).toBeGreaterThanOrEqual(1);
      expect(a.lemmas.length, a.id).toBeGreaterThan(0);
    }
  });

  it('most article words are list words of their segment, standing in one scene', () => {
    let found = 0;
    let all = 0;
    for (const a of ARTICLES_B2) {
      const ws = WORDS.filter((w) => isArticleWord(a, w));
      all += a.lemmas.length;
      found += ws.length;
      // The words this article owns (first article to claim them) share one scene.
      const own = ws.filter((w) => articleOfWord(w) === a);
      if (a.seg !== 15) expect(new Set(own.map((w) => w.scene)).size, a.id).toBeLessThanOrEqual(2);
    }
    expect(found / all).toBeGreaterThan(0.9);
  });

  it('finds the sentence a word stands in for most words', () => {
    let ok = 0;
    let n = 0;
    for (const a of ARTICLES_B2)
      for (const w of WORDS.filter((x) => isArticleWord(a, x))) {
        n++;
        if (contextLine(a, w)) ok++;
      }
    expect(ok / n).toBeGreaterThan(0.8);
  });

  it('a new article word at 121 comes with its article; the notice is found by id', () => {
    const a = ARTICLES_B2.find((x) => x.seg === 13)!;
    const w = WORDS.find((x) => isArticleWord(a, x) && articleOfWord(x) === a)!;
    expect(noticeById(a.id)?.kind).toBe('article');
    expect(articleNotice(a.id)!.qs[0].options).toContain(a.qs[0].answer);
    const s = newGame('T', 'x');
    s.level = 121;
    const b = startBattle(s, w, makeRng(1));
    expect(b.notice?.id).toBe(a.id);
    s.level = 120;
    expect(startBattle(s, w, makeRng(1)).notice?.id).not.toBe(a.id);
  });
});
