// 1.0.10: fixes from the 1.0.9 审核 (Lucas 2026-11-27「按推荐，但是全部修理」).
import tsvB1 from '../data/wortschatz/artikel-b1.tsv?raw';
import tsvB2 from '../data/wortschatz/artikel-b2.tsv?raw';
import tsvB2o from '../data/wortschatz/artikel-b2-original.tsv?raw';
import tsvC1 from '../data/wortschatz/artikel-c1.tsv?raw';
import { describe, expect, it } from 'vitest';
import { ARTICLE_ROWS as B1 } from '../src/data/articlesB1-gen';
import { ARTICLE_ROWS as B2 } from '../src/data/articlesB2-gen';
import { ARTICLE_ROWS as C1 } from '../src/data/articlesC1-gen';
import { PASSAGE_ROWS } from '../src/data/passages-gen';
import { LEX_PAT } from '../src/data/lexicon';
import { WORDS } from '../src/data/words';
import { newGame } from '../src/core/state';
import { screenPool } from '../src/core/screen';
import { gradePatSentence, isPattern } from '../src/core/satzmuster';

const CJK = /[一-鿿]/;
const ALL = [...B1, ...B2, ...C1];

describe('1.0.10 content checks', () => {
  it('every article row of the TSVs is in the generated chunks (1.0.9 shipped 21 B2 articles without rebuilding)', () => {
    const ids = new Set<string>();
    for (const f of [tsvB1, tsvB2, tsvB2o, tsvC1]) {
      const lines = f.split('\n').slice(1).filter(Boolean);
      for (const l of lines) ids.add(l.split('\t')[0]);
    }
    const gen = new Set(ALL.map((a) => a.id));
    expect([...ids].filter((x) => !gen.has(x))).toEqual([]);
  });

  it('no Chinese inside German article text or questions (H1)', () => {
    for (const a of ALL) {
      for (const p of a.de) expect(CJK.test(p), `${a.id}: ${p.slice(0, 60)}`).toBe(false);
      for (const q of a.qs) expect(CJK.test([q.q, q.answer, ...q.wrong].join(' ')), `${a.id}: ${q.q}`).toBe(false);
    }
  });

  it('no Chinese inside German listening passages (L1)', () => {
    for (const p of PASSAGE_ROWS) expect(CJK.test([...p.lines, p.q, p.answer, ...p.wrong].join(' ')), p.id).toBe(false);
  });

  it('articles do not repeat their title as the first paragraph, and German and Chinese paragraphs line up (L2)', () => {
    for (const a of ALL) {
      expect(a.de[0]?.trim() === a.title.trim(), a.id).toBe(false);
      expect(a.zh.length, a.id).toBe(a.de.length);
    }
  });

  it('the right answer is not given away by its length (M1)', () => {
    for (const [name, rows] of [['B1', B1], ['B2', B2], ['C1', C1]] as const) {
      let n = 0;
      let longest = 0;
      let shortest = 0;
      for (const a of rows)
        for (const q of a.qs) {
          n++;
          if (q.answer.length > Math.max(...q.wrong.map((w) => w.length))) longest++;
          if (q.answer.length < Math.min(...q.wrong.map((w) => w.length))) shortest++;
        }
      // Length gives nothing away in either direction (random would be about 1/3 each).
      expect(longest / n, `${name} longest: ${longest}/${n}`).toBeLessThanOrEqual(0.45);
      expect(shortest / n, `${name} shortest: ${shortest}/${n}`).toBeLessThanOrEqual(0.45);
    }
  });

  it('pattern examples are German only, apart from the one asking for a Chinese word', () => {
    for (const [id, ls] of Object.entries(LEX_PAT))
      for (const l of ls) {
        const de = l.split('|')[0];
        if (!de.startsWith('{Wie sagt man}')) expect(CJK.test(de), `${id}: ${de}`).toBe(false);
      }
  });
});

describe('1.0.10 句型怪 fixes', () => {
  it('全量筛选 never asks a pattern (H2)', () => {
    const s = newGame('T', 'student');
    expect(screenPool(s, 'all').some(isPattern)).toBe(false);
  });

  it('a pattern shows a meaning, not its category (H2)', () => {
    for (const w of WORDS.filter(isPattern)) expect(w.zh, w.id).toBe(LEX_PAT[w.id][0].split('|')[1]);
  });

  it('whole-sentence pattern answers: key words all there in order (M2)', () => {
    const keys = ['Ich hätte gern'];
    const full = 'Ich hätte gern ein Brötchen mit Käse.';
    expect(gradePatSentence(full, keys, full)).toEqual({ ok: true, exact: true });
    expect(gradePatSentence('Ich hätte gern ein Käsebrötchen.', keys, full).ok).toBe(true);
    expect(gradePatSentence('ich haette gern zwei Brötchen mit Käse', keys, full).ok).toBe(true);
    expect(gradePatSentence('Ich hätte gern', keys, full).ok).toBe(false); // only the key words
    expect(gradePatSentence('Ich möchte ein Brötchen mit Käse.', keys, full).ok).toBe(false);
    const two = ['Wäre es möglich', 'zu'];
    const f2 = 'Wäre es möglich, heute etwas früher zu gehen?';
    expect(gradePatSentence('Wäre es möglich, morgen früher zu kommen?', two, f2).ok).toBe(true);
    expect(gradePatSentence('Zu Hause, wäre es möglich früher?', two, f2).ok).toBe(false); // wrong order
  });
});

describe('1.0.10 NPC talk corrections show once', () => {
  it('drops a correction that is about an earlier line', async () => {
    const { freshNote } = await import('../src/core/npcNotes');
    const run = {};
    const note = '„einen Problem“ 应为 „ein Problem“（Problem 是中性名词）。';
    expect(freshNote(run, note, 'Ich habe einen Problem mit dem Termin.')).toBe(note);
    expect(freshNote(run, note, 'Morgen um zehn Uhr.')).toBe('');
    expect(freshNote(run, note, 'Das ist einen Problem für mich.')).toBe(note); // made again: shown again
    expect(freshNote(run, '动词要放第二位。', 'Morgen ich komme.')).toBe('动词要放第二位。');
    expect(freshNote(run, '动词要放第二位。', 'Ja.')).toBe('');
    expect(freshNote(run, '', 'Ja.')).toBe('');
  });
});

describe('1.0.10 商店说德语 (optional, by level, no AI)', () => {
  it('the buying sentence follows the level and the accusative', async () => {
    const { gradeShopBuy, gradeShopSell, buyModel, saidPrice, saidSellPrice } = await import('../src/core/shopTalk');
    const stift = { de: 'Stift', g: 'm', model: 'def' } as const;
    const brille = { de: 'Brille', g: 'f', model: 'def' } as const;
    const buch = { de: 'Wörterbuch', g: 'n', model: 'def' } as const;
    const zettel = { de: 'Zettel', g: 'm', model: 'indef' } as const;
    // A1
    expect(gradeShopBuy('Ich nehme den Stift.', 10, stift).ok).toBe(true);
    expect(gradeShopBuy('ich nehme einen stift', 10, stift).ok).toBe(true);
    expect(gradeShopBuy('Ich nehme der Stift.', 10, stift).ok).toBe(false);
    expect(gradeShopBuy('Ich nehme ein Stift.', 10, stift).ok).toBe(false);
    expect(gradeShopBuy('Ich nehme das Woerterbuch', 10, buch).ok).toBe(true); // ae = ä
    expect(gradeShopBuy('Ich hätte gern die Brille.', 10, brille).ok).toBe(true); // a higher level sentence is fine
    // A2
    expect(buyModel(50, stift)).toBe('Ich hätte gern den Stift.');
    expect(gradeShopBuy('Ich haette gerne den Stift', 50, stift).ok).toBe(true);
    expect(gradeShopBuy('Ich hätte gern bitte die Brille!', 50, brille).ok).toBe(true);
    const low = gradeShopBuy('Ich nehme den Stift.', 50, stift);
    expect(low.ok).toBe(false);
    expect(low.notes[0]).toContain('Ich hätte gern');
    expect(gradeShopBuy('Ich hatte gern den Stift.', 50, stift).ok).toBe(false); // hatte ≠ hätte
    // B1 and B2
    expect(buyModel(100, zettel)).toBe('Könnten Sie mir einen Zettel geben?');
    expect(gradeShopBuy('Könnten Sie mir bitte einen Zettel geben?', 100, zettel).ok).toBe(true);
    expect(gradeShopBuy('koennten sie mir den zettel geben', 150, zettel).ok).toBe(true);
    expect(gradeShopBuy('Könnten Sie mir der Zettel geben?', 150, zettel).ok).toBe(false);
    expect(gradeShopBuy('Könnten Sie mir einen Zettel?', 150, zettel).ok).toBe(false);
    expect(gradeShopBuy('Ich hätte gern einen Zettel.', 100, zettel).ok).toBe(false);
    // selling, every level
    expect(gradeShopSell('Ich möchte den Stift verkaufen.', stift).ok).toBe(true);
    expect(gradeShopSell('Ich moechte das Woerterbuch verkaufen', buch).ok).toBe(true);
    expect(gradeShopSell('Ich möchte der Stift verkaufen.', stift).ok).toBe(false);
    expect(gradeShopSell('Ich verkaufe den Stift.', stift).ok).toBe(false);
    expect(saidPrice(100)).toBe(90);
    expect(saidPrice(1)).toBe(1);
    expect(saidSellPrice(100)).toBe(110);
    expect(saidSellPrice(3)).toBe(4);
  });
});
