import { describe, expect, it } from 'vitest';
import { archive, isRead, LETTER_BY_ID, letterScene, lettersIn, letterVisible, readLetter } from '../src/core/letters';
import { LETTERS } from '../src/data/letters';
import { regionLevels } from '../src/data/zones';
import { newGame } from '../src/core/state';

describe('失语者的遗书', () => {
  it('has 85 letters, 5 per region 4–20, all placed in a scene', () => {
    expect(LETTERS.length).toBe(85);
    for (let r = 4; r <= 20; r++) expect(LETTERS.filter((l) => l.region === r).length).toBe(5);
    expect(LETTERS.filter((l) => !letterScene(l.id)).map((l) => l.id)).toEqual([]);
  });

  it('paragraphs line up German and Chinese', () => {
    for (const l of LETTERS) expect(l.zh.length, l.id).toBe(l.de.length);
  });

  it('is hidden until the region is near, then can be read once', () => {
    const s = newGame('T', 'x');
    const l = LETTERS.find((x) => x.region === 4)!;
    s.level = 1;
    expect(letterVisible(s, l)).toBe(false);
    expect(lettersIn(s, letterScene(l.id)!)).not.toContain(l);
    s.level = regionLevels(4)[0];
    expect(lettersIn(s, letterScene(l.id)!)).toContain(l);
    expect(readLetter(s, l.id)).toBe(true);
    expect(readLetter(s, l.id)).toBe(false);
    expect(isRead(s, l.id)).toBe(true);
    expect(archive(s).byRegion[0].letters).toEqual([l]);
    expect(readLetter(s, 'nope')).toBe(false);
    expect(LETTER_BY_ID[l.id]).toBe(l);
  });

  it('old saves without the letters field read fine', () => {
    const s = newGame('T', 'x');
    delete (s as { letters?: unknown }).letters;
    expect(isRead(s, LETTERS[0].id)).toBe(false);
    expect(archive(s).byRegion).toEqual([]);
  });
});
