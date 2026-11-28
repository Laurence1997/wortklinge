// 1.0.12 试玩 (g6 world map / scene panel / HUD / spawn).
import { describe, expect, it } from 'vitest';
import { newGame } from '../src/core/state';
import { makeRng } from '../src/core/rng';
import { eligible, pickSpawns, zoneWords } from '../src/core/spawn';
import { isPlaced } from '../src/core/placement';
import { DRAWN } from '../src/data/drawnArt';

describe('#34 推定会 words do not crowd out real new words', () => {
  it('words still to learn get new slots even when they come last in the list', () => {
    const t = Date.now();
    const s = newGame('T', 'student', t);
    s.level = 30;
    const ws = zoneWords('echogasse').filter((w) => eligible(s, w));
    expect(ws.length).toBeGreaterThan(8);
    for (const w of ws.slice(0, -3)) s.words[w.id] = { stage: 3, due: t + 1e10, firstSeen: t, lastSeen: t, relapse: 0, correct: 0, wrong: 0, read: 0, write: 0, placed: t };
    expect(isPlaced(s.words[ws[0].id])).toBe(true);
    // (marking words known can open the field's later batch: every unmarked eligible word now counts as still to learn)
    const real = zoneWords('echogasse').filter((w) => eligible(s, w) && !s.words[w.id]);
    expect(real.length).toBeGreaterThanOrEqual(3);
    for (let seed = 0; seed < 5; seed++) {
      const picks = pickSpawns(s, 'echogasse', 6, new Set(), makeRng(seed)).filter((p) => p.kind === 'new' && !p.challenge);
      const ids = picks.map((p) => p.word.id);
      expect(ids.filter((id) => real.some((w) => w.id === id)).length).toBeGreaterThanOrEqual(Math.min(2, Math.floor(picks.length / 2)));
      expect(ids.some((id) => isPlaced(s.words[id]))).toBe(true);
    }
  });
});

describe('#78 glasses and headphones have drawn icons', () => {
  it('the drawn art used for the slots exists', () => {
    expect(DRAWN.brille).toBeTruthy();
    expect(DRAWN.kopfhoerer).toBeTruthy();
  });
});
