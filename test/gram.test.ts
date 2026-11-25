// 语法线 (0.7–0.8): grammar tasks hang on word monsters, boards teach the first one, 言灵反噬 costs 1 resource.
import { describe, expect, it } from 'vitest';
import { newGame } from '../src/core/state';
import { makeRng } from '../src/core/rng';
import { makeQuestion, phaseRight, resolveTurn, stancesFor, startBattle } from '../src/core/combat';
import { gradeGram } from '../src/core/gram/task';
import { datPronTask, nichtTask, timePrepTask } from '../src/core/gram/a1b';
import { adjEnding, adjTask } from '../src/core/gram/adj';
import { keinTask, meinTask } from '../src/core/gram/a1';
import { praetFull, praetModalTask } from '../src/core/gram/praet';
import { gramFor } from '../src/core/gram/hook';
import { BOARDS, boardDue } from '../src/core/gram/boards';
import { WORDS } from '../src/data/words';
import { EXAMPLES } from '../src/core/cloze';

const byDe = (de: string) => WORDS.find((w) => w.de === de)!;
const T0 = new Date('2026-11-22T12:00:00').getTime();

describe('A1 grammar tasks', () => {
  it('时间介词: am Montag, um … Uhr, in der Nacht', () => {
    const t = timePrepTask(byDe('Montag'), makeRng(1))!;
    expect(t.answer.toLowerCase()).toBe('am');
    expect(gradeGram(t, 'am').ok).toBe(true);
    expect(timePrepTask(byDe('Nacht'), makeRng(1))!.answer.toLowerCase()).toBe('in der');
    expect(timePrepTask(byDe('Tisch') ?? byDe('Brot'), makeRng(1))).toBeNull();
  });
  it('与格代词 with helfen names the person in Chinese', () => {
    const t = datPronTask(byDe('helfen'), makeRng(2))!;
    expect(['mir', 'dir', 'ihm']).toContain(t.answer);
    expect(gradeGram(t, t.answer).ok).toBe(true);
    expect(gradeGram(t, 'mich').ok).toBe(false);
  });
  it('kein / mein / nicht / adjective endings build from the noun’s own sentences', () => {
    let kein = 0, mein = 0, nicht = 0, adj = 0;
    for (const w of WORDS.filter((x) => x.art && EXAMPLES[x.id])) {
      const r = makeRng(w.id.length);
      const k = keinTask(w, r, true);
      if (k) (kein++, expect(k.answer.toLowerCase()).toMatch(/^kein(e|en|em|er)?$/));
      const m = meinTask(w, r, true);
      if (m) (mein++, expect(m.answer.toLowerCase()).toMatch(/^(mein|dein)(e|en|em|er)?$/));
      const n = nichtTask(w, r);
      if (n) (nicht++, expect(n.options).toContain(n.answer));
      const a = adjTask(w, r, 41);
      if (a) (adj++, expect(a.answer).toMatch(/(e|en|er|es)$/));
    }
    expect(kein).toBeGreaterThan(10);
    expect(mein).toBeGreaterThan(10);
    expect(nicht).toBeGreaterThan(5);
    expect(adj).toBeGreaterThan(10);
    expect(adjEnding(true, 'nom', 'm')).toBe('er');
    expect(adjEnding(true, 'acc', 'n')).toBe('es');
    expect(adjEnding(false, 'acc', 'm')).toBe('en');
    expect(adjEnding(false, 'nom', 'f')).toBe('e');
  });
  it('Präteritum forms', () => {
    expect(praetFull('machen', 'er')).toBe('machte');
    expect(praetFull('arbeiten', 'wir')).toBe('arbeiteten');
    expect(praetFull('kommen', 'du')).toBe('kamst');
    expect(praetModalTask(byDe('kaufen'), makeRng(1))?.answer ?? 'musste').toMatch(/te$/);
  });
});

describe('grammar on word monsters', () => {
  it('the first question of a new system comes with its board, once', () => {
    const s = newGame('T', 'student', T0);
    s.level = 10;
    const w = byDe('Montag');
    s.words[w.id] = { stage: 1, due: 9e15, firstSeen: 0, lastSeen: 0, relapse: 0, correct: 1, wrong: 0, read: 1, write: 1 };
    const g = gramFor(s, w, makeRng(3))!;
    expect(g.board).not.toBeNull();
    const b = startBattle(s, w, makeRng(3));
    b.kind = 'shadow';
    b.step = 1;
    const q = makeQuestion(s, b, 'attack', makeRng(3));
    expect(q.type).toBe('grammar');
    expect(q.board).toBeTruthy();
    resolveTurn(s, b, 'attack', q, q.answer!, makeRng(3));
    expect(boardDue(s, q.gram!.sys)).toBeNull();
    expect(s.gram?.boards).toContain(q.gram!.sys);
  });
  it('nothing before the unlock level, and a wrong answer costs 1 resource (言灵反噬)', () => {
    const s = newGame('T', 'student', T0);
    s.level = 4;
    expect(gramFor(s, byDe('Montag'), makeRng(1))).toBeNull();
    s.level = 15;
    s.hp = 999;
    const w = byDe('helfen');
    s.words[w.id] = { stage: 1, due: 9e15, firstSeen: 0, lastSeen: 0, relapse: 0, correct: 1, wrong: 0, read: 1, write: 1 };
    s.gram = { boards: Object.keys(BOARDS).filter((k) => k !== 'datPron') };
    const b = startBattle(s, w, makeRng(4));
    b.kind = 'shadow';
    b.step = 1;
    b.cfx.res = 3;
    const q = makeQuestion(s, b, 'attack', makeRng(4));
    expect(q.gram?.sys).toBe('datPron');
    const r = resolveTurn(s, b, 'attack', q, 'zzz', makeRng(4));
    expect(b.cfx.res).toBe(2);
    expect(r.log.some((l) => l.text.includes('言灵反噬'))).toBe(true);
  });
});

describe('kein stance', () => {
  it('a line that needs keinen swaps the ein buttons for kein ones (same keys), and only keinen lands', () => {
    const s = newGame('T', 'student', T0);
    s.level = 8;
    const w = WORDS.find((x) => x.id === 'ausweis')!;
    const b = startBattle(s, w, makeRng(1));
    b.pluralMon = false;
    b.intent = { ...b.intent, caseArt: 'keinen' };
    const st = stancesFor(s.level, b);
    expect(st).toEqual(['der', 'die', 'das', 'den', 'kein', 'keine', 'keinen']);
    expect(phaseRight(b, 'keinen')).toBe(true);
    expect(phaseRight(b, 'den')).toBe(false);
    b.intent = { ...b.intent, caseArt: 'den' };
    expect(stancesFor(s.level, b)).toContain('einen');
  });
});
