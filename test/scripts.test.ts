import { describe, expect, it } from 'vitest';
import { SCRIPTS, scriptPrompt, scriptsFor } from '../src/data/grammar/scripts';

describe('剧本模式', () => {
  it('has unique ids and 4–6 beats each', () => {
    expect(new Set(SCRIPTS.map((s) => s.id)).size).toBe(SCRIPTS.length);
    for (const s of SCRIPTS) expect(s.beats.length).toBeGreaterThanOrEqual(4), expect(s.beats.length).toBeLessThanOrEqual(6);
  });
  it('opens scripts by level, new ones from 151', () => {
    expect(scriptsFor(10).length).toBeGreaterThan(0);
    expect(scriptsFor(150).every((s) => s.from < 151)).toBe(true);
    expect(scriptsFor(200).length).toBe(SCRIPTS.length);
    expect(SCRIPTS.filter((s) => s.from >= 151).length).toBeGreaterThanOrEqual(5);
  });
  it('puts every beat into the prompt', () => {
    for (const s of SCRIPTS) for (const b of s.beats) expect(scriptPrompt(s)).toContain(b);
  });
});
