import { describe, expect, it } from 'vitest';
import { WORDS } from '../src/data/words';
import { GENDER_RULES, genderHint, headOf, ruleStats } from '../src/core/genderRules';
import { GENDER_PAGES } from '../src/ui/rulesBoard';

const byDe = (de: string) => WORDS.find((w) => w.de === de && w.art)!;

describe('词性规律 (2026-11-28)', () => {
  it('a hint that says the noun follows a rule never names another article', () => {
    for (const w of WORDS) {
      const g = genderHint(w);
      if (!g) continue;
      if (g.follows) expect(g.rule!.art === w.art || g.rule!.id === 'compound', `${w.art} ${w.de}`).toBe(true);
      else expect(g.text, `${w.art} ${w.de}`).toContain('例外');
    }
  });

  it('sure rules hold for at least 95% of the word list, soft ones for at least 80%', () => {
    for (const r of GENDER_RULES) {
      const st = ruleStats(r);
      if (!st.n) continue;
      // Exceptions the rule explains itself (der Kuchen: its -chen is no diminutive) do not count against it.
      const noted = WORDS.filter((w) => w.art && w.art !== r.art && !w.plOnly && !w.de.includes(' ') && r.test(w) && r.why?.[w.de]).length;
      expect((st.ok + noted) / st.n, `${r.id} ${st.ok}+${noted}/${st.n}`).toBeGreaterThanOrEqual(r.sure ? 0.95 : 0.8);
    }
  });

  it('compound heads are the right gender for every compound found', () => {
    for (const w of WORDS) {
      if (!w.art || w.plOnly || w.de.includes(' ')) continue;
      const hd = headOf(w);
      if (hd) expect(hd.art, `${w.art} ${w.de} ← ${hd.de}`).toBe(w.art);
    }
  });

  it('says the expected rule for typical words', () => {
    expect(genderHint(byDe('Zeitung'))!.text).toContain('-ung');
    expect(genderHint(byDe('Mädchen'))!.text).toContain('-chen');
    expect(genderHint(byDe('Bier'))!.follows).toBe(false);
    expect(genderHint(byDe('Hauptstadt'))!.text).toContain('die Stadt');
    expect(genderHint(byDe('Kunde'))!.text).toContain('der Kunde');
    // A soft rule broken without a note of its own says nothing.
    expect(genderHint(byDe('Käse'))).toBeNull();
  });

  it('every rule the board cites exists', () => {
    for (const p of GENDER_PAGES) for (const it of p.items) if (it.rule) expect(GENDER_RULES.some((r) => r.id === it.rule), it.rule).toBe(true);
  });
});
