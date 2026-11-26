import { describe, expect, it, beforeEach } from 'vitest';
import { checkImport, markSaved, newGame, save, setSaveHook } from '../src/core/state';

// 审查 A1 / A4 (2026-11-26).
describe('存档安全', () => {
  beforeEach(() => {
    const m = new Map<string, string>();
    (globalThis as unknown as { localStorage: Storage }).localStorage = { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k), clear: () => m.clear(), key: () => null, length: 0 } as Storage;
  });

  it('an unchanged state is not saved again and keeps its timestamp', () => {
    let pushes = 0;
    setSaveHook(() => (pushes += 1));
    const s = newGame('T', 'student');
    s.savedAt = 1000;
    markSaved(s);
    save(s);
    expect(s.savedAt).toBe(1000);
    expect(pushes).toBe(0);
    s.gold += 5;
    save(s);
    expect(s.savedAt).toBeGreaterThan(1000);
    expect(pushes).toBe(1);
    const t = s.savedAt;
    save(s);
    expect(s.savedAt).toBe(t);
    save(s, true);
    expect(pushes).toBe(2);
    setSaveHook(() => {});
  });

  it('refuses old-format files instead of wiping to level 1', () => {
    const old = JSON.stringify({ name: 'Alt', level: 40, words: {}, flags: {} });
    const r = checkImport(old);
    expect(r.ok).toBe(false);
    const s = newGame('Neu', 'student');
    s.level = 12;
    const r2 = checkImport(JSON.stringify(s));
    expect(r2.ok).toBe(true);
    if (r2.ok) expect(r2.s.level).toBe(12);
    expect(checkImport('not json').ok).toBe(false);
  });
});
