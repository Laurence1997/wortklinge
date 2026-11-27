import { describe, expect, it } from 'vitest';
import { lemmaKey, matchRows, mergeImport, parseDelimited, prioritise } from '../src/core/wordImport';
import { WORDS } from '../src/data/words';
import { migrate, newGame } from '../src/core/state';

describe('词表导入', () => {
  it('normalises lemmas', () => {
    expect(lemmaKey('der Hund')).toBe('hund');
    expect(lemmaKey('  Straße ')).toBe('strasse');
    expect(lemmaKey('sich freuen')).toBe('freuen');
    expect(lemmaKey('die Karte, -n (2)')).toBe('karte');
  });

  it('parses CSV with quotes and TSV', () => {
    expect(parseDelimited('Word,Translation\n"Brot","面包, 食物"\nTee,茶\n')).toEqual([['Word', 'Translation'], ['Brot', '面包, 食物'], ['Tee', '茶']]);
    expect(parseDelimited('a\tb\nc\td')).toEqual([['a', 'b'], ['c', 'd']]);
  });

  it('matches against the game and keeps the rest as 待收录', () => {
    const r = matchRows(parseDelimited('Lemma,Item type\nBrot,Word\ndas Wasser,Word\nXyzzyquatsch,Word\nBrot,Word\nwie geht es,Phrase\n'), WORDS);
    expect(r.matched).toEqual(['brot', 'wasser']);
    expect(r.missing).toEqual(['Xyzzyquatsch']);
    expect(r.rows).toBe(3);
  });

  it('uses only the first ranked rows when there is a rank column', () => {
    const r = matchRows([['rank', 'word'], ['3', 'Tee'], ['1', 'Brot'], ['2', 'Xyzzy']], WORDS, 2);
    expect(r.matched).toEqual(['brot']);
    expect(r.missing).toEqual(['Xyzzy']);
    expect(r.skipped).toBe(1);
  });

  it('merges imports without duplicates', () => {
    const a = mergeImport(undefined, { matched: ['brot'], missing: ['Wahnsinn'], rows: 2, skipped: 0 });
    const b = mergeImport(a, { matched: ['brot', 'tee'], missing: ['wahnsinn'], rows: 2, skipped: 0 });
    expect(b).toEqual({ ids: ['brot', 'tee'], pending: ['Wahnsinn'] });
  });

  it('puts at most 3 priority words first, the rest keep their order', () => {
    const ws = ['a', 'b', 'c', 'd', 'e', 'f'].map((id) => ({ id }));
    expect(prioritise(ws, new Set(['f', 'e', 'd', 'c'])).map((w) => w.id)).toEqual(['c', 'd', 'e', 'a', 'b', 'f']);
  });

  it('old saves load without the field and keep it once set', () => {
    const s = newGame('t', 'student');
    expect(migrate(JSON.parse(JSON.stringify(s)))?.wordImport).toBeUndefined();
    s.wordImport = { ids: ['brot'], pending: ['x'] };
    expect(migrate(JSON.parse(JSON.stringify(s)))?.wordImport).toEqual({ ids: ['brot'], pending: ['x'] });
  });
});
