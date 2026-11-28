import { describe, expect, it } from 'vitest';
import { WORD_BY_ID, WORDS } from '../src/data/words';
import { dictQ, dictSlotOpen, needsPhase, startBattle } from '../src/core/combat';
import { clozeWhy } from '../src/core/cloze';
import { stormForms } from '../src/core/storm';
import { rollB2Mon, reportTasks } from '../src/core/b2mons';
import { allLineTasks } from '../src/core/gram/lines';
import { boss2Questions } from '../src/data/boss2';
import { newGame } from '../src/core/state';
import { makeRng } from '../src/core/rng';

describe('1.0.12 g1 试玩修复: questions', () => {
  it('#16 句中默写 only blanks forms the level has opened', () => {
    const hose = WORD_BY_ID['hose'];
    const tee = WORD_BY_ID['tee'];
    expect(dictSlotOpen(hose, 'Die Hose', 2)).toBe(true);
    expect(dictSlotOpen(hose, 'eine schwarze Hose', 2)).toBe(false); // adjective ending before Lv11
    expect(dictSlotOpen(hose, 'eine schwarze Hose', 11)).toBe(true);
    expect(dictSlotOpen(tee, 'einen Tee', 2)).toBe(false); // accusative from Lv7
    expect(dictSlotOpen(tee, 'einen Tee', 7)).toBe(true);
    expect(dictSlotOpen(tee, 'einem Tee', 11)).toBe(false); // dative from Lv15
    expect(dictSlotOpen(tee, 'einem Tee', 15)).toBe(true);
    expect(dictSlotOpen(tee, 'meinen Tee', 7)).toBe(false); // possessives with 填变形 (Lv11)
    const tasche = WORD_BY_ID['tasche'];
    if (tasche?.pl === 'Taschen') {
      expect(dictSlotOpen(tasche, 'den Taschen', 11)).toBe(false); // dative plural from Lv15
      expect(dictSlotOpen(tasche, 'den Taschen', 15)).toBe(true);
    }
    expect(dictSlotOpen(WORD_BY_ID['monat'], 'des Monats', 20)).toBe(false); // genitive from Lv81
    expect(dictSlotOpen(WORD_BY_ID['problem'], 'Kein Problem', 2)).toBe(false); // kein from Lv5
    expect(dictSlotOpen(WORD_BY_ID['problem'], 'Kein Problem', 5)).toBe(true);
    for (let i = 0; i < 20; i++) {
      const q = dictQ(hose, makeRng(i), 2);
      if (q) expect(q.answer).not.toMatch(/schwarze/);
    }
    const q = [...Array(20)].map((_, i) => dictQ(hose, makeRng(i), 20)).find((x) => x?.answer?.includes('schwarze'));
    expect(q?.prompt).toContain('带冠词和形容词');
  });

  it('#46 a one-letter slip on the right article is called a spelling slip, not a case rule', () => {
    const hose = WORD_BY_ID['hose'];
    const notes = clozeWhy('Die Hose', hose, 'die Hoze');
    expect(notes.length).toBe(1);
    expect(notes[0]).toContain('拼写');
    expect(clozeWhy('Die Hose', hose, 'der Hose')[0]).toContain('第一格');
  });

  it('#57 墨水风暴 asks 2 forms of das Wasser at Lv10', () => {
    const f = stormForms(10, WORD_BY_ID['wasser'], false);
    expect(f.length).toBe(2);
    expect(new Set(f.map((x) => x.answer.toLowerCase())).size).toBe(2);
  });

  it('#24 吞秤者 only sells food', () => {
    for (let seed = 1; seed < 30; seed++) {
      for (const q of boss2Questions(makeRng(seed), true)) expect(q.visual ?? '').not.toMatch(/Bäckerei|Teller|Geschirr|Schüssel|Hunger|Kellner/);
    }
  });

  it('#89 a B2 kind that just opened comes on the next fitting monster', () => {
    const s = newGame('T', 'student');
    s.level = 121;
    const verb = WORDS.find((w) => w.pos === 'v' && reportTasks(w).length)!;
    expect(rollB2Mon(s, verb, () => 0.99)).toBe('report');
    expect(rollB2Mon(s, verb, () => 0.99)).toBe(null);
    void startBattle;
  });

  it('#64/#71 直接叫名 shows no stance', () => {
    const s = newGame('T', 'student');
    s.level = 12;
    const b = startBattle(s, WORD_BY_ID['tee'], makeRng(1));
    expect(needsPhase(b)).toBe(true);
    b.direct = true;
    expect(needsPhase(b)).toBe(false);
  });

  it('#90 双向介词 skips verbs with a fixed preposition', () => {
    const all = WORDS.flatMap((w) => allLineTasks(w, 'twoway').map((t) => t.full ?? ''));
    expect(all.some((x) => /halte dich an die Regeln/.test(x))).toBe(false);
    expect(all.some((x) => /^Ich warte auf den Bus\.$/.test(x))).toBe(false);
    expect(all.some((x) => /^Pass auf die Straße auf!$/.test(x))).toBe(false);
    expect(all.some((x) => /an der Demonstration teilgenommen/.test(x))).toBe(false);
    expect(all.some((x) => /^Dieser Verschluss passt nicht auf die Flasche\.$/.test(x))).toBe(true);
    expect(all.length).toBeGreaterThan(1000);
  });
});
