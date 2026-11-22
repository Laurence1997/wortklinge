import { describe, expect, it } from 'vitest';
import { newGame } from '../src/core/state';
import { makeRng } from '../src/core/rng';
import { WORDS } from '../src/data/words';
import { startBattle, readShown, teachPhase } from '../src/core/combat';
import { articleSlip, shadowOk } from '../src/core/shadow';

describe('0.6.x 读音攻击不漏冠词', () => {
  it('heard article wrong or missing is told apart from a bad noun', () => {
    expect(shadowOk('der Euro', ['das Euro'])).toBe(false);
    expect(articleSlip('der Euro', ['das Euro'])).toBe('das');
    expect(articleSlip('der Euro', ['Euro'])).toBe('');
    expect(articleSlip('der Euro', ['der Ofen'])).toBe(null);
    expect(articleSlip('Hallo', ['hallo'])).toBe(null);
  });

  it('the button shows the bare noun except on the taught turn', () => {
    const s = newGame('T', 'student');
    s.level = 10;
    const w = WORDS.find((x) => x.art && x.pos === 'n' && !x.tutorial && !x.plOnly)!;
    const b = startBattle(s, w, makeRng(1));
    const full = `${w.art} ${w.de}`;
    b.phase = undefined;
    b.phaseTaught = undefined;
    expect(readShown(b, full)).toBe(w.de);
    if (teachPhase(b)) expect(readShown(b, full)).toBe(full);
    b.turn += 1;
    teachPhase(b);
    expect(readShown(b, full)).toBe(w.de);
  });
});

import { phaseWrongWhy } from '../src/core/combat';
describe('0.6.x 格位姿态选错说清形式', () => {
  it('a slot stance names the article and the form; a name stance hides it', () => {
    const s = newGame('T', 'student');
    s.level = 10;
    const w = WORDS.find((x) => x.de === 'Kilo')!;
    const b = startBattle(s, w, makeRng(1));
    b.intent = { ...b.intent, caseArt: 'ein' };
    b.phase = 'das';
    expect(phaseWrongWhy(b)).toBe('没错，Kilo 是 das 词，但这句的空要填 ein（不定冠词）');
    b.intent = { ...b.intent, caseArt: 'dem' };
    expect(phaseWrongWhy(b)).toBe('没错，Kilo 是 das 词，但这句的空要填 dem（定冠词，第三格）');
    b.intent = { ...b.intent, caseArt: 'ein' };
    b.phase = 'der';
    expect(phaseWrongWhy(b)).toMatch(/^Kilo 是 das 词/);
    b.intent = { ...b.intent, caseArt: undefined };
    expect(phaseWrongWhy(b)).toBe('它不是 der 词');
  });
});

import { clozeWhy, gradeCloze } from '../src/core/cloze';
describe('0.6.x 完形填空答错讲清原因', () => {
  const gv = WORDS.find((x) => x.de === 'Großvater')!;
  it('marked Chinese is strict and explains; unmarked Chinese takes any article of the case', () => {
    expect(gradeCloze('einen Grossvater', 'einen Großvater', gv, '我有一位祖父在巴伐利亚。')).toBe(true);
    expect(gradeCloze('meinen Großvater', 'einen Großvater', gv, '我有一位祖父在巴伐利亚。')).toBe(false);
    expect(gradeCloze('den Großvater', 'einen Großvater', gv, '我有一位祖父在巴伐利亚。')).toBe(false);
    expect(gradeCloze('den Großvater', 'einen Großvater', gv, '我去看祖父。')).toBe(true);
    expect(gradeCloze('der Großvater', 'einen Großvater', gv, '我去看祖父。')).toBe(false);
    expect(clozeWhy('einen Großvater', gv, 'meinen Grossvater')).toEqual([expect.stringContaining('第四格'), '格是对的，但这里要用 einen（看中文）。']);
    expect(clozeWhy('einen Großvater', gv, 'meine Grossvater')[1]).toBe('冠词词尾不对：Großvater 是阳性，这里要 einen。');
    const tasse = WORDS.find((x) => x.de === 'Tasse')!;
    expect(gradeCloze('eine Tassen', 'die Tassen', tasse, '我在洗杯子。')).toBe(false);
    expect(clozeWhy('die Tassen', tasse, 'eine Tassen')).toEqual([]);
  });
});
