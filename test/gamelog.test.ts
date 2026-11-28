import { describe, expect, it } from 'vitest';
import { gameLog, logLine } from '../src/ui/gamelog';

describe('记录 box lines (1.0.12 panel)', () => {
  it('skips a bare 「……」 thinking note and keeps real lines', () => {
    const n = gameLog.length;
    logLine('……');
    logLine('...');
    logLine('');
    expect(gameLog.length).toBe(n);
    logLine('击败 der Tisch（桌子）', 'good');
    logLine('✓ 1', 'good');
    expect(gameLog.slice(n).map((l) => l.text)).toEqual(['击败 der Tisch（桌子）', '✓ 1']);
  });
});
