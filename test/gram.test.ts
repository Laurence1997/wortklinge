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

describe('语法秘境', () => {
  it('变音秘境 floors per ablaut family, tasks on the monster’s own verb, a cleared family asks its forms in the field', async () => {
    const { floorsOf, dungeonTask, markCleared, ablautFieldTask } = await import('../src/core/gram/dungeons');
    const s = newGame('T', 'student', T0);
    s.level = 24;
    const fl = floorsOf('ablaut', s);
    expect(fl.map((f) => f.id)).toContain('e,i-a');
    const nehmen = byDe('nehmen');
    const t0 = dungeonTask(s, 'ablaut', 'e,i-a', nehmen, makeRng(1), 0)!;
    expect(t0.answer).toBe('nimmt');
    expect(dungeonTask(s, 'ablaut', 'e,i-a', nehmen, makeRng(1), 1)!.answer).toBe('nimmst');
    expect(dungeonTask(s, 'ablaut', 'e,i-a', nehmen, makeRng(1), 2)!.answer).toBe('hat genommen');
    expect(ablautFieldTask(s, nehmen, makeRng(1))).toBeNull();
    markCleared(s, 'ablaut', 'e,i-a');
    expect(ablautFieldTask(s, nehmen, makeRng(1))).not.toBeNull();
    expect(floorsOf('ablaut', s).some((f) => f.id === 'praet')).toBe(false);
    s.level = 81;
    expect(floorsOf('ablaut', s).some((f) => f.id === 'praet')).toBe(true);
  });
  it('介词秘境 chain: lock 1 the preposition, lock 2 the case', async () => {
    const { floorsOf, prepTask } = await import('../src/core/gram/dungeons');
    const s = newGame('T', 'student', T0);
    s.level = 31;
    const auf = floorsOf('prep', s).find((f) => f.id === 'auf')!;
    expect(auf.words.length).toBeGreaterThanOrEqual(2);
    const warten = byDe('warten');
    const l1 = prepTask(warten, 'auf', 0, makeRng(2))!;
    expect(l1.answer).toBe('auf');
    expect(l1.options).toContain('auf');
    const l2 = prepTask(warten, 'auf', 1, makeRng(2))!;
    expect(l2.answer).toContain('Akk');
  });
  it('词族秘境: family members and suffix genders', async () => {
    const { floorsOf, wordfamTask } = await import('../src/core/gram/dungeons');
    const s = newGame('T', 'student', T0);
    s.level = 37;
    expect(floorsOf('wordfam', s).map((f) => f.id)).toEqual(['suffix']);
    const t = wordfamTask(s, byDe('wohnen'), 'suffix', makeRng(1))!;
    expect(['der', 'die', 'das']).toContain(t.answer);
    const f = wordfamTask(s, byDe('wohnen'), '', makeRng(1))!;
    expect(gradeGram(f, f.answer).ok).toBe(true);
  });
  it('词族秘境 relation layers: open at 2 归名, ask a two-sentence contrast', async () => {
    const { floorsOf, wordfamTask } = await import('../src/core/gram/dungeons');
    const s = newGame('T', 'student', T0);
    s.level = 37;
    const g = (de: string) => (s.words[byDe(de).id] = { stage: 3, due: T0 + 9e9, firstSeen: 1, lastSeen: 1, relapse: 0, correct: 3, wrong: 0, read: 1 } as never);
    g('liegen');
    expect(floorsOf('wordfam', s).some((f) => f.id.startsWith('look:'))).toBe(false);
    g('legen');
    const fl = floorsOf('wordfam', s).find((f) => f.id.startsWith('look:') && f.words.includes(byDe('legen').id))!;
    expect(fl).toBeTruthy();
    const q = wordfamTask(s, byDe('liegen'), fl.id, makeRng(2))!;
    expect(q.options).toHaveLength(2);
    expect(q.options).toContain(q.answer);
    expect(q.focus).toContain('①');
    expect(q.mix).toBe(byDe('legen').id);
  });
  it('a dungeon battle asks only the floor’s grammar', () => {
    const s = newGame('T', 'student', T0);
    s.level = 24;
    s.gram = { boards: Object.keys(BOARDS) };
    const b = startBattle(s, byDe('nehmen'), makeRng(1));
    b.gramDungeon = { kind: 'ablaut', floor: 'e,i-a' };
    for (let i = 0; i < 3; i++) {
      b.step = i;
      expect(makeQuestion(s, b, 'attack', makeRng(i)).gram?.sys).toBe('ablaut');
    }
  });
});

describe('镜像怪 and 告示怪', () => {
  it('mirror: reflexive pronoun on the verb, dative from 81', async () => {
    const { mirrorTask } = await import('../src/core/gram/mirror');
    const t = mirrorTask(byDe('waschen'), makeRng(1), 35)!;
    expect(['mich', 'sich']).toContain(t.answer);
    let dat = false;
    for (let i = 0; i < 20; i++) if (['mir', 'dir'].includes(mirrorTask(byDe('waschen'), makeRng(i), 81)!.answer)) dat = true;
    expect(dat).toBe(true);
  });
  it('notice: the passage rides on the question and questions cycle', () => {
    const s = newGame('T', 'student', T0);
    s.level = 15;
    s.hp = 999;
    const w = WORDS.find((x) => x.zone === 'fahrplanhalle' && x.art)!;
    s.words[w.id] = { stage: 1, due: 9e15, firstSeen: 0, lastSeen: 0, relapse: 0, correct: 1, wrong: 0, read: 1, write: 1 };
    const b = startBattle(s, w, makeRng(1));
    b.notice = { id: 'fahrplanhalle-verspaetung', i: 0 };
    const q1 = makeQuestion(s, b, 'attack', makeRng(1));
    expect(q1.gram?.passage).toContain('Hamburg');
    expect(q1.options).toContain(q1.answer);
    resolveTurn(s, b, 'attack', q1, q1.answer!, makeRng(1));
    const q2 = makeQuestion(s, b, 'attack', makeRng(2));
    expect(q2.prompt).not.toBe(q1.prompt);
  });
});

describe('复习伙伴', () => {
  it('is the skin of 语境复习: the partner keeps you company at the bonfire round, no question on itself', async () => {
    const { setPartner } = await import('../src/core/gram/partner');
    const { reviewQuestion } = await import('../src/core/combat');
    const s = newGame('T', 'student', T0);
    s.level = 43;
    s.hp = 999;
    s.gram = { boards: Object.keys(BOARDS) };
    const p = WORDS.find((x) => x.art && EXAMPLES[x.id]?.length && x.id !== 'tisch')!;
    s.words[p.id] = { stage: 3, due: 9e15, firstSeen: 0, lastSeen: 0, relapse: 0, correct: 3, wrong: 0, read: 1, write: 2 };
    setPartner(s, p.id);
    const d = WORDS.find((x) => x.art && EXAMPLES[x.id]?.length && x.id !== p.id && x.id !== 'tisch')!;
    s.words[d.id] = { stage: 3, due: T0 - 1000, ivl: 7 * 86400000, ctx: 0, firstSeen: 0, lastSeen: 0, relapse: 0, correct: 3, wrong: 0, read: 1, write: 2 };
    const w = WORDS.find((x) => x.art && x.id !== p.id && x.id !== d.id)!;
    s.words[w.id] = { stage: 1, due: 9e15, firstSeen: 0, lastSeen: 0, relapse: 0, correct: 1, wrong: 0, read: 1, write: 1 };
    const b = startBattle(s, w, makeRng(1));
    b.turn = 2;
    b.qIndex = 1;
    const q = reviewQuestion(s, d.id, makeRng(1))!;
    expect(q.review).toBe(d.id);
    expect(q.prompt).toContain('复习伙伴');
    for (let i = 0; i < 4; i++) expect(makeQuestion(s, b, 'attack', makeRng(i)).partner).toBeUndefined();
  });
});

describe('文章群怪', () => {
  it('an article rides on the question with its own text', async () => {
    const { noticeById, noticeTask } = await import('../src/core/gram/notice');
    const a = noticeById('artikel-fahrrad')!;
    const t = noticeTask(a, 1, makeRng(1));
    expect(t.prompt).toContain('文章群怪');
    expect(t.passage).toContain('Fahrrad');
    expect(t.options).toContain(t.answer);
  });
});
