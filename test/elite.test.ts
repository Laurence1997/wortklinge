import { describe, expect, it } from 'vitest';
import { newGame, type GameState } from '../src/core/state';
import { makeRng } from '../src/core/rng';
import { WORD_BY_ID } from '../src/data/words';
import { SCENES } from '../src/data/world';
import { makeQuestion, qTier, resolveTurn, startBattle } from '../src/core/combat';
import { applyWin } from '../src/core/outcomes';
import { elitePick, noteEliteWin } from '../src/core/elite';
import { CONFIG } from '../src/core/config';

// 游戏设计「野外精英：场景精英」 (Lucas 2026-11-23).
const scene = SCENES.find((sc) => sc.type === 'field' && sc.region === 1 && (sc.words?.length ?? 0) >= 8 && sc.words!.every((id) => WORD_BY_ID[id]?.art))!;
const DAY = 86400000;

function learned(s: GameState, ids: string[], stage: 1 | 2 | 3, due = Date.now() + DAY) {
  for (const id of ids) s.words[id] = { stage, due, firstSeen: 0, lastSeen: 0, relapse: 0, correct: 1, wrong: 0, read: 1 };
}

describe('场景精英: when it comes', () => {
  it('opens at Lv9 once half of the scene group is 半名', () => {
    const s = newGame('T', 'student');
    s.level = 9;
    const ids = scene.words!;
    const half = Math.ceil(ids.length / 2);
    learned(s, ids.slice(0, half - 1), 2);
    expect(elitePick(s, scene)).toBeNull();
    learned(s, ids.slice(0, half), 2);
    const p = elitePick(s, scene)!;
    expect(p.review).toBe(false);
    expect(p.words).toHaveLength(3);
    // Not-yet-half words come first.
    expect(p.words.every((id) => !s.words[id] || s.words[id].stage < 2)).toBe(true);
    s.level = 8;
    expect(elitePick(s, scene)).toBeNull();
  });

  it('words on the map are not taken; fewer than three free words → none', () => {
    const s = newGame('T', 'student');
    s.level = 9;
    const ids = scene.words!;
    learned(s, ids, 2);
    const taken = new Set(ids.slice(0, ids.length - 2));
    expect(elitePick(s, scene, taken)).toBeNull();
  });

  it('once beaten it returns only when three group words have relapsed into review monsters', () => {
    const s = newGame('T', 'student');
    s.level = 9;
    const ids = scene.words!;
    learned(s, ids, 2);
    noteEliteWin(s, scene.id);
    expect(elitePick(s, scene)).toBeNull();
    learned(s, ids.slice(0, 2), 2, Date.now() - 1000);
    expect(elitePick(s, scene)).toBeNull();
    learned(s, ids.slice(0, 3), 2, Date.now() - 1000);
    expect(elitePick(s, scene)).toBeNull(); // learning respawns (due 半名) don't count: only relapsed words do
    for (const id of ids.slice(0, 3)) s.words[id].lapsed = true;
    const p = elitePick(s, scene)!;
    expect(p.review).toBe(true);
    expect(new Set(p.words)).toEqual(new Set(ids.slice(0, 3)));
  });
});

describe('场景精英: how it fights', () => {
  const parts = (seg: number) => {
    const s = newGame('T', 'student');
    s.level = 9;
    const w = WORD_BY_ID[scene.words![0]];
    learned(s, [w.id], 2);
    const b = startBattle(s, w, makeRng(3), { elite: true });
    b.elite = { scene: scene.id, words: scene.words!.slice(0, 3), seg, review: false };
    b.intent = { ...b.intent, kind: 'attack', hits: 1 };
    const tiers = new Set<number>();
    const types = new Set<string>();
    for (let step = 0; step < 6; step++) {
      b.step = step;
      const q = makeQuestion(s, b, 'attack', makeRng(step + 1));
      tiers.add(qTier(q));
      types.add(q.type);
    }
    return { tiers, types, b };
  };

  it('part 1 asks recognition only, part 3 typing only', () => {
    expect([...parts(0).tiers]).toEqual([0]);
    const p3 = parts(2);
    expect([...p3.types].every((t) => t === 'typed' || t === 'conj' || t === 'cloze')).toBe(true); // 句中默写 is a typed cloze (rev 425)
  });

  it('part 3 asks a sentence of your own every other attack, rule-checked (rev 425/459)', () => {
    const { b } = parts(2);
    const s = newGame('T', 'student');
    s.level = 9;
    b.step = 0;
    const q = makeQuestion(s, b, 'attack', makeRng(1));
    expect(q.write).toBe('compose');
    const w = b.word;
    const ok = resolveTurn(s, b, 'attack', q, `Ich sehe ${w.art === 'der' ? 'den' : w.art} ${w.de}.`, makeRng(1));
    expect(ok.correct).toBe(true);
    b.step = 0;
    const q2 = makeQuestion(s, b, 'attack', makeRng(1));
    expect(resolveTurn(s, b, 'attack', q2, 'Ich bin müde.', makeRng(1)).correct).toBe(false);
  });

  it('part 2 asks cloze (or typing when there is no example)', () => {
    const p2 = parts(1);
    expect([...p2.types].every((t) => t === 'cloze' || t === 'typed' || t === 'conj')).toBe(true);
  });

  it('is never plural or rusty', () => {
    const s = newGame('T', 'student');
    s.level = 29;
    const w = WORD_BY_ID[scene.words![0]];
    learned(s, [w.id], 2, Date.now() - 30 * DAY);
    for (let i = 0; i < 20; i++) {
      const b = startBattle(s, w, makeRng(i), { elite: true });
      expect(b.pluralMon).toBeFalsy();
      expect(b.rusty).toBeFalsy();
    }
  });

  it('each part pays ×1.2; the last part of a first elite brings an iron chest', () => {
    const s = newGame('T', 'student');
    s.level = 9;
    const w = WORD_BY_ID[scene.words![0]];
    learned(s, [w.id], 2);
    const plain = applyWin(structuredClone(s), startBattle(s, w, makeRng(5)), makeRng(5));
    const s2 = structuredClone(s);
    const b = startBattle(s2, w, makeRng(5), { elite: true });
    b.elite = { scene: scene.id, words: scene.words!.slice(0, 3), seg: 0, review: false };
    const part1 = applyWin(s2, b, makeRng(5));
    expect(part1.xp).toBe(Math.round(plain.xp * CONFIG.elite.rewardMult));
    expect(part1.chest).toBeNull();
    const s3 = structuredClone(s);
    const last = startBattle(s3, w, makeRng(5), { elite: true });
    last.elite = { scene: scene.id, words: scene.words!.slice(0, 3), seg: 2, review: false };
    expect(applyWin(s3, last, makeRng(5)).chest).toBe('iron');
  });
});
