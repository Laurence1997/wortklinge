import { describe, expect, it } from 'vitest';
import { lineLeaks } from '../src/core/combat';
import type { Question } from '../src/core/combat';

const q = (answer: string, alts?: string[]) => ({ answer, alts } as unknown as Question);

describe('lineLeaks (审查 C1/C2)', () => {
  it('catches a grammar answer spoken in the line', () => {
    expect(lineLeaks('Wo ist der Bahnhof?', q('der'))).toBe(true);
    expect(lineLeaks('Ich habe gegessen …mmh…', q('x', ['gegessen']))).toBe(true);
  });
  it('ignores substrings, Chinese answers and empty lines', () => {
    expect(lineLeaks('Wo ist der Bahnhof?', q('Bahn'))).toBe(false);
    expect(lineLeaks('Wo ist der Bahnhof?', q('火车站'))).toBe(false);
    expect(lineLeaks(undefined, q('der'))).toBe(false);
  });
});
