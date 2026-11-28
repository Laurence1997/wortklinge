import { describe, expect, it } from 'vitest';
import { newGame } from '../src/core/state';
import { makeRng } from '../src/core/rng';
import { answerExam, type Exam } from '../src/core/breakthrough';
import { recordKill } from '../src/core/srs';
import { startPlacement, stopPlacement } from '../src/core/placement';
import { WORDS } from '../src/data/words';

const by = (de: string) => WORDS.find((w) => w.de === de)!;

describe('1.0.12 placed playtest fixes', () => {
  it('breakthrough write part accepts another word with the same Chinese and word class', () => {
    const w = by('angreifen');
    const twin = WORDS.find((x) => x.id !== w.id && x.zh === w.zh && x.pos === 'v');
    const exam = (): Exam => ({ qs: [{ part: 'write', word: w, prompt: '', answer: w.de }], at: 0, right: { listen: 0, read: 0, write: 0, grammar: 0 }, over: false });
    if (twin) {
      const e = exam();
      answerExam(e, twin.de);
      expect(e.last?.ok).toBe(true);
    }
    const e2 = exam();
    answerExam(e2, 'der Angriff'); // a noun for a verb prompt is still wrong (the prompt now says 〔动词〕)
    expect(e2.last?.ok).toBe(false);
  });

  it('a placement gap word written right is not counted as a relapse', () => {
    const s = newGame('T', 'student');
    const w = by('einfach');
    s.words[w.id] = { stage: 2, lapsed: true, gap: true, due: 0, firstSeen: 0, lastSeen: 0, relapse: 0, correct: 0, wrong: 0, read: 0, write: 0 };
    recordKill(s, w, true, false, 1);
    expect(s.words[w.id].relapse).toBe(0);
    expect(s.words[w.id].gap).toBeUndefined();
    // A real lapse (no gap flag) still counts.
    s.words[w.id] = { stage: 2, lapsed: true, due: 0, firstSeen: 0, lastSeen: 0, relapse: 0, correct: 0, wrong: 0, read: 0, write: 0 };
    recordKill(s, w, true, false, 1);
    expect(s.words[w.id].relapse).toBe(1);
  });

  it('giving up right after a skipped band checks the skipped band first', () => {
    const s = newGame('T', 'student');
    const run = startPlacement(s, makeRng(3), 0);
    run.passed.add(0).add(1);
    run.skipped = 1;
    run.band = 2;
    stopPlacement(run, s, makeRng(4));
    expect(run.over).toBe(false);
    expect(run.verifying).toBe(true);
    expect(run.band).toBe(1);
    expect(run.passed.has(1)).toBe(false);
    // Closing the panel instead drops the unchecked band.
    const r2 = startPlacement(s, makeRng(5), 0);
    r2.passed.add(0).add(1);
    r2.skipped = 1;
    r2.band = 2;
    stopPlacement(r2);
    expect(r2.over).toBe(true);
    expect(r2.passed.has(1)).toBe(false);
  });
});
