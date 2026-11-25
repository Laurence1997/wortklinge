import { describe, expect, it } from 'vitest';
import { sentenceHash } from '../src/core/sentenceId';

describe('sentenceHash (这句有问题 ↔ scripts/proof)', () => {
  it('is stable and ignores extra spaces', () => {
    expect(sentenceHash('Ich kaufe heute zwei Brote.')).toBe(sentenceHash('Ich kaufe  heute zwei Brote. '));
    expect(sentenceHash('Ich kaufe heute zwei Brote.')).toMatch(/^[0-9a-f]{8}$/);
  });
  it('differs for different sentences', () => {
    expect(sentenceHash('Das ist alles.')).not.toBe(sentenceHash('Das ist alles!'));
  });
});
