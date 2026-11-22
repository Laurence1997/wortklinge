import { describe, expect, it } from 'vitest';
import { checkJournal, journalWords, usesWord } from '../src/core/journal';
import { WORD_BY_ID } from '../src/data/words';

const W = (...ids: string[]) => ids.map((id) => WORD_BY_ID[id]);

describe('篝火日记', () => {
  it('a fine entry gets no hints', () => {
    expect(checkJournal('Heute trinke ich einen Tee. Der Tee ist heiß. Ich wohne in Berlin.', W('tee', 'wohnen'))).toEqual([]);
  });
  it('points at a missing word, a wrong article and a wrong verb form, nothing else', () => {
    const h = checkJournal('Ich wohnst hier. Das Tee ist gut.', W('tee', 'brot'));
    expect(h.map((x) => x.kind).sort()).toEqual(['article', 'missing', 'verb']);
    expect(h.find((x) => x.kind === 'verb')!.text).toContain('wohne');
  });
  it('leaves alone what the rules cannot judge (dative der before a feminine noun, plural die, inverted order)', () => {
    expect(checkJournal('Ich sitze mit der Tasse am Tisch. Heute wohne ich hier.', W('tasse', 'tisch'))).toEqual([]);
  });
  it('finds words in other forms', () => {
    expect(usesWord('Er wohnt hier.', WORD_BY_ID['wohnen'])).toBe(true);
    expect(usesWord('Ich esse zwei Brote.', WORD_BY_ID['brot'])).toBe(true);
  });
  it('picks today\'s nouns and verbs first', () => {
    const t = 1_000_000;
    const ws = journalWords({ tee: { lastSeen: t + 5 }, wohnen: { lastSeen: t + 3 }, hallo: { lastSeen: t + 9 }, brot: { lastSeen: t - 9 } }, t);
    expect(ws.map((w) => w.id)).toEqual(['tee', 'wohnen']);
  });
});
