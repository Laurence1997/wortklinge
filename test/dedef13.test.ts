import { describe, expect, it } from 'vitest';
import { newGame } from '../src/core/state';
import { WORDS, fullForm, zhWithPos } from '../src/data/words';
import { LEX_DEF_DE } from '../src/data/lexicon';
import { dedefQ, makeQuestion, plateZh, startBattle, type Question } from '../src/core/combat';
import {
  clipDef,
  defDe,
  defHintLine,
  defHintsFor,
  hidesZh,
  letterHint,
  meaningLine,
  meaningShort,
  plateMeaning,
  slotMeaning,
  wordCue,
} from '../src/core/dedef';
import { checkJournal } from '../src/core/journal';
import { identifyQuestion } from '../src/core/identify';
import { pkQuestion } from '../src/core/adventurers';
import { makeRng } from '../src/core/rng';

// 1.0.12 sweep: every place outside the battle card that shows a word's meaning follows 德语释义界面规则 — the
// shared helpers, the finisher / 造句 prompts, 稳住 / 拆词, 日记 hints, 言灵锁 and the adventurer PK.

const withDef = (lo: number, hi: number, extra: (w: (typeof WORDS)[number]) => boolean = () => true) =>
  WORDS.find((w) => w.lvl >= lo && w.lvl <= hi && LEX_DEF_DE[w.id] && !w.digit && w.pos !== 'phr' && extra(w))!;
const low = WORDS.find((w) => w.lvl <= 80 && !LEX_DEF_DE[w.id] && !w.digit)!;
const mid = withDef(81, 120);
const high = withDef(121, 999);
const auto = {};
const progress = { stage: 3 as const, due: 0, firstSeen: 0, lastSeen: 0, relapse: 0, correct: 1, wrong: 0, read: 1, write: 1 };

describe('meaningLine and the short forms', () => {
  it('follows the three tiers: Chinese / Chinese + German line / German with the Chinese hidden', () => {
    expect(meaningLine(low, auto)).toEqual({ tier: 'zh', main: low.zh, sub: null, hiddenZh: null });
    expect(meaningLine(mid, auto)).toEqual({ tier: 'zhDe', main: mid.zh, sub: defDe(mid), hiddenZh: null });
    expect(meaningLine(high, auto)).toEqual({ tier: 'de', main: defDe(high), sub: null, hiddenZh: high.zh });
    expect(meaningLine(high, { defLang: 'zh' }).tier).toBe('zhDe');
    expect(meaningLine(mid, { defLang: 'de' }).tier).toBe('de');
    expect(hidesZh(high, auto)).toBe(true);
    expect(hidesZh(mid, auto)).toBe(false);
  });

  it('plates, tags and cues never show the Chinese of a de-tier word, and never its German letters past the first', () => {
    const def = defDe(high)!;
    expect(plateMeaning(high, auto)).toBe(clipDef(def, 18));
    expect(plateMeaning(high, auto)).not.toContain(high.zh);
    expect(plateMeaning(mid, auto)).toBe(plateZh(mid));
    expect(meaningShort(high, auto)).toBe(clipDef(def, 28));
    expect(meaningShort(mid, auto)).toBe(mid.zh);
    expect(wordCue(high, auto)).toBe(`〔${def}〕 ${letterHint(high.de)} `);
    expect(wordCue(high, auto)).not.toContain(high.zh);
    expect(wordCue(mid, auto)).toBe(`「${mid.zh}」`);
    expect(slotMeaning(high, auto)).toBe(`〔${def}〕`);
    expect(slotMeaning(low, auto)).toBe(low.zh);
    expect(clipDef('kurz')).toBe('kurz');
    expect(clipDef('x'.repeat(40), 10)).toHaveLength(10);
  });

  it('defHintsFor gives one 原形 hint per de-tier word, numbered when there are two', () => {
    expect(defHintsFor([mid, low], auto)).toBeNull();
    expect(defHintsFor([high], auto)).toBe(`原形 ${defHintLine(high)}`);
    const other = withDef(121, 999, (w) => w.id !== high.id);
    expect(defHintsFor([high, low, other], auto)).toBe(`① 原形 ${defHintLine(high)}   ② 原形 ${defHintLine(other)}`);
  });
});

describe('combat prompts', () => {
  it('稳住·选冠词 of a de-tier word shows the definition, Chinese a tap away', () => {
    const s = newGame('T', 'student');
    const noun = withDef(121, 999, (w) => !!w.art);
    const steady: Question = { type: 'steady', pool: 'steady', prompt: '稳住', focus: zhWithPos(noun), options: ['der', 'die', 'das'], answer: noun.art! };
    const q = dedefQ(s, noun, steady);
    expect(q.focus).toBe(defDe(noun));
    expect(q.zhHidden).toBe(zhWithPos(noun));
    // 选意思 (Chinese options) stays as it is: the definition would not give the answer, but the rule keeps it untouched.
    const meaning: Question = { type: 'steady', pool: 'steady', prompt: '稳住', focus: fullForm(noun), options: [noun.zh, 'a', 'b'], answer: noun.zh };
    expect(dedefQ(s, noun, meaning)).toBe(meaning);
    // 拆词 keeps its Chinese (its prompt spells the German word out): see dedef1012.test.ts.
  });

  it('终结技 of a de-tier word puts its definition where its Chinese was, with the first letter', () => {
    const s = newGame('T', 'student');
    s.level = 130;
    let whole = 0;
    for (const w of WORDS.filter((x) => x.lvl >= 121 && LEX_DEF_DE[x.id] && !x.digit && x.pos !== 'phr').slice(0, 60)) {
      s.words[w.id] = { ...progress };
      const b = startBattle(s, w, makeRng(1));
      b.ultUsed = true;
      b.directOffer = false;
      const q = makeQuestion(s, b, 'sentence', makeRng(5));
      if (q.type !== 'sentence' || q.write || !q.defDe) continue;
      // Lv121+ words have no 句型, so this is the example-sentence finisher with the gloss masked.
      expect(q.focus).toContain(`〔${defDe(w)}〕`);
      expect(q.defHint).toBe(`原形 ${defHintLine(w)}`);
      expect(q.zhHidden).toBeTruthy();
      expect(q.focus).not.toBe(q.zhHidden);
      whole++;
    }
    expect(whole).toBeGreaterThan(10);
  });

  it('终结技 句型 (看中文写整句 with a pattern) under 德语优先 puts the definition in the slot', () => {
    const s = newGame('T', 'student');
    s.level = 130;
    s.settings.defLang = 'de';
    let seen = 0;
    for (const w of WORDS.filter((x) => LEX_DEF_DE[x.id] && !!x.art && !x.digit)) {
      s.words[w.id] = { ...progress };
      const b = startBattle(s, w, makeRng(1));
      b.ultUsed = true;
      b.directOffer = false;
      const q = makeQuestion(s, b, 'sentence', makeRng(5));
      if (q.type !== 'sentence' || !q.pattern || q.write) continue;
      expect(q.focus).toContain(`〔${defDe(w)}〕`);
      expect(q.focus).not.toContain(w.zh);
      expect(q.defHint).toBe(`原形 ${defHintLine(w)}`);
      expect(q.zhHidden).toContain(w.zh);
      if (++seen > 20) break;
    }
    expect(seen).toBeGreaterThan(0);
  });

  it('终结技 stays Chinese for words of the Chinese tiers', () => {
    const s = newGame('T', 'student');
    s.level = 130;
    let seen = 0;
    for (const w of WORDS.filter((x) => x.lvl <= 120 && x.lvl >= 40 && !!x.art && !x.digit).slice(0, 60)) {
      s.words[w.id] = { ...progress };
      const b = startBattle(s, w, makeRng(2));
      b.ultUsed = true;
      b.directOffer = false;
      const q = makeQuestion(s, b, 'sentence', makeRng(12));
      if (q.type !== 'sentence' || !q.pattern || q.write) continue;
      expect(q.focus).toContain(w.zh);
      expect(q.zhHidden).toBeUndefined();
      seen++;
    }
    expect(seen).toBeGreaterThan(0);
  });
});

describe('outside battle', () => {
  it('篝火日记: a missing de-tier word is named as it was given (definition + first letter), never in Chinese', () => {
    const hints = checkJournal('Heute ist gut. Ich bin hier.', [high, low], auto);
    const miss = hints.filter((x) => x.kind === 'missing').map((x) => x.text);
    expect(miss).toContain(`还没用到${wordCue(high, auto)}`);
    expect(miss.join('')).not.toContain(high.zh);
    expect(miss).toContain(`还没用到「${low.zh}」`);
    // Without settings (old callers) it reads as 自动.
    expect(checkJournal('Heute ist gut. Ich bin hier.', [high]).some((x) => x.text.includes(defDe(high)!))).toBe(true);
  });

  it('言灵锁: a de-tier word gives its definition and first letter, not the Chinese', () => {
    const s = newGame('T', 'student');
    const w = WORDS.find((x) => x.lvl >= 121 && LEX_DEF_DE[x.id] && !x.digit && x.pos !== 'phr' && identifyQuestion({ ...s, words: { [x.id]: { ...progress } } } as never, makeRng(1)).id === `identify-${x.id}`)!;
    s.words = { [w.id]: { ...progress } } as never;
    const q = identifyQuestion(s, makeRng(1));
    expect(q.zh).toContain(defDe(w)!);
    expect(q.zh).toContain(letterHint(w.de));
    expect(q.zh).not.toContain(w.zh);
    s.settings.defLang = 'zh';
    expect(identifyQuestion(s, makeRng(1)).zh).toContain(w.zh);
  });

  it('冒险者 PK: 选德语 / 写出德语 of a de-tier word show the definition; 选意思 keeps its Chinese options', () => {
    const s = newGame('T', 'student');
    s.level = 140;
    s.settings.defLang = 'de';
    const region = WORDS.find((w) => LEX_DEF_DE[w.id] && w.pos !== 'phr')!.region ?? 1;
    for (const w of WORDS.filter((x) => (x.region ?? 1) === region && x.pos !== 'phr')) s.words[w.id] = { ...progress };
    let de = 0;
    for (let seed = 1; seed < 400 && de < 3; seed++) {
      const q = pkQuestion(s, region, makeRng(seed));
      if (!q || q.kind === 'gram' || !hidesZh(q.word, s.settings)) continue;
      if (q.prompt === '选意思') {
        expect(q.options).toContain(q.word.zh);
        continue;
      }
      expect(q.focus).toBe(defDe(q.word));
      expect(q.zhHidden).toBe(q.word.zh);
      if (q.kind === 'typed') expect(q.defHint).toBe(defHintLine(q.word));
      de++;
    }
    expect(de).toBeGreaterThan(0);
  });
});
