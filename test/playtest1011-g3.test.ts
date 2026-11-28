// 1.0.11 试玩修复 G3: 等级上限 80 / 120 / 160 的突破试炼入口（finding 14）, 变音秘境 a → ä 层只放真变音的动词（finding 10）.
import src from '../src/game/controller.ts?raw';
import hud from '../src/ui/hud.ts?raw';
import { describe, expect, it } from 'vitest';
import { newGame } from '../src/core/state';
import { makeRng } from '../src/core/rng';
import { capAdvice, examinerTrial, levelCapFor } from '../src/core/stages';
import { CONJ } from '../src/data/verbs';
import { WORDS } from '../src/data/words';
import { STRONG_VERBS } from '../src/data/grammar/strongVerbs';
import { praetFull, strongOf } from '../src/core/gram/praet';

const T0 = new Date('2026-11-27T12:00:00').getTime();
const A1 = { a1Passed: true, a1Grammar: true };

describe('等级上限的突破试炼入口 (finding 14)', () => {
  it('at 80 / 120 / 160 the examiner offers that stage’s trial, not as 提前考', () => {
    const cases: Array<[number, Record<string, unknown>, string]> = [
      [80, { ...A1 }, 'A2'],
      [120, { ...A1, a2Passed: true }, 'B1'],
      [160, { ...A1, a2Passed: true, b1Passed: true }, 'B2'],
    ];
    for (const [lv, flags, st] of cases) {
      expect(levelCapFor(flags)).toBe(lv);
      expect(examinerTrial(lv, flags)).toEqual({ stage: st, label: `${st} 突破试炼` });
      expect(capAdvice(lv, flags)).toBe(`去主城找考官考 ${st} 突破试炼`);
      // Below the cap: still offered early, and no cap advice.
      expect(examinerTrial(lv - 5, flags)?.label).toBe(`${st} 突破试炼（提前考）`);
      expect(capAdvice(lv - 5, flags)).toBeNull();
    }
  });
  it('A1 keeps its own button; B2 passed has no trial; placement flags count', () => {
    expect(examinerTrial(30, {})).toBeNull();
    expect(capAdvice(30, {})).toBe('去主城找考官考 A1 突破试炼');
    expect(capAdvice(30, { a1Passed: true })).toBe('去主城找考官补考语法');
    expect(examinerTrial(200, { ...A1, a2Passed: true, b1Passed: true, b2Passed: true })).toBeNull();
    expect(capAdvice(200, { ...A1, a2Passed: true, b1Passed: true, b2Passed: true })).toBeNull();
    expect(examinerTrial(120, { a1Passed: true, placeA1: true, placeA2: true })?.stage).toBe('B1');
  });
  it('the examiner’s normal menu (Lv2+) has the trial button too, and the cap message is per cap', () => {
    const body = src.slice(src.indexOf('private talkExaminer()'), src.indexOf('private breakExam()'));
    expect(body.match(/this\.stageExam\(trial\.stage\)/g)?.length).toBe(2);
    expect(src).toContain('`taughtCap${levelCapFor(s.flags)}`');
    expect(hud).toContain('capAdvice(s.level, s.flags)');
  });
});

describe('变音秘境 a → ä 层 (finding 10)', () => {
  it('every verb on the a-u floor changes a → ä in du and er', async () => {
    const { floorsOf } = await import('../src/core/gram/dungeons');
    const s = newGame('T', 'student', T0);
    s.level = 81;
    const floor = floorsOf('ablaut', s).find((f) => f.id === 'a-u')!;
    expect(floor.words.length).toBeGreaterThanOrEqual(2);
    for (const id of floor.words) {
      const w = WORDS.find((x) => x.id === id)!;
      const c = CONJ[w.de];
      expect(c, w.de).toBeTruthy();
      expect(w.de.replace(/en$/, ''), w.de).toMatch(/a/);
      expect(c.forms.du, `${w.de} du`).toMatch(/ä/);
      expect(c.forms.er, `${w.de} er`).toMatch(/ä/);
    }
  });
  it('the strong list’s a-u entries all umlaut in er; schaffen (做成，搞定) is regular', () => {
    for (const v of STRONG_VERBS.filter((x) => x.group === 'a-u')) expect(v.er, v.inf).toMatch(/ä/);
    expect(strongOf('schaffen')).toBeNull();
    expect(strongOf('verschaffen')).toBeNull();
    expect(praetFull('backen', 'er')).toBe('backte');
  });
  it('schaffen never asks hat geschaffen in the dungeon or the field', async () => {
    const { ablautTask } = await import('../src/core/gram/dungeons');
    const s = newGame('T', 'student', T0);
    s.level = 81;
    const w = WORDS.find((x) => x.de === 'schaffen' && x.pos === 'v');
    if (!w) return;
    for (let i = 0; i < 3; i++) expect(ablautTask(s, w, 'a-u', makeRng(i), i)).toBeNull();
  });
});
