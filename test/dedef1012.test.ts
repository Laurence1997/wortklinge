import { describe, expect, it } from 'vitest';
import { newGame, migrate } from '../src/core/state';
import { WORDS, WORD_BY_ID, fullForm, zhWithPos } from '../src/data/words';
import { LEX_DEF_DE, LEX_REL } from '../src/data/lexicon';
import { dedefQ, makeQuestion, startBattle, type Question } from '../src/core/combat';
import { defDe, defTier, letterCount, letterHint, defHintLine, synonymHit, synonymsOf, SYN_NOTE } from '../src/core/dedef';
import { makeRng } from '../src/core/rng';

// 德语释义界面规则 (1.0.12): 自动 / 中文优先 / 德语优先, the letter hint, and the 近义 tolerance.

const withDef = (lo: number, hi: number) => WORDS.find((w) => w.lvl >= lo && w.lvl <= hi && LEX_DEF_DE[w.id] && !w.digit && w.pos !== 'phr')!;
const low = WORDS.find((w) => w.lvl <= 80 && !LEX_DEF_DE[w.id])!;
const mid = withDef(81, 120);
const high = withDef(121, 999);

describe('德语释义 tiers', () => {
  it('自动 goes by the word level: ≤80 Chinese, 81–120 Chinese + German, 121+ German', () => {
    const auto = {};
    expect(defTier(low, auto)).toBe('zh');
    expect(defTier(mid, auto)).toBe('zhDe');
    expect(defTier(high, auto)).toBe('de');
    expect(defTier(high, { defLang: 'auto' })).toBe('de');
  });

  it('中文优先 keeps Chinese first for every word; 德语优先 shows every defined word in German', () => {
    expect(defTier(high, { defLang: 'zh' })).toBe('zhDe');
    expect(defTier(mid, { defLang: 'zh' })).toBe('zhDe');
    expect(defTier(mid, { defLang: 'de' })).toBe('de');
    // A word without a definition stays Chinese in every setting.
    for (const defLang of ['auto', 'zh', 'de'] as const) expect(defTier(low, { defLang })).toBe('zh');
  });

  it('the setting is an optional save field: old saves load as 自动', () => {
    const s = newGame('T', 'student');
    expect(s.settings.defLang).toBeUndefined();
    const raw = JSON.parse(JSON.stringify(s));
    delete raw.settings.defLang;
    const back = migrate(raw)!;
    expect(back).toBeTruthy();
    expect(back.settings.defLang).toBeUndefined();
    expect(defTier(high, back.settings)).toBe('de');
    // A save that picked 德语优先 keeps it.
    const de = migrate({ ...JSON.parse(JSON.stringify(s)), settings: { ...s.settings, defLang: 'de' } })!;
    expect(de.settings.defLang).toBe('de');
    expect(defTier(mid, de.settings)).toBe('de');
  });
});

describe('首字母 + 字母数', () => {
  it('formats the first letter and one gap per letter', () => {
    expect(letterHint('bewerben')).toBe('b _ _ _ _ _ _ _');
    expect(letterCount('bewerben')).toBe(8);
    expect(letterHint('Bahnhof')).toBe('B _ _ _ _ _ _');
    expect(letterHint('zu Hause')).toBe('z _   _ _ _ _ _');
    expect(letterHint('E-Mail')).toBe('E - _ _ _ _');
    expect(letterCount('Straße')).toBe(6);
    // No article in the hint (the gender is not given away).
    const n = WORDS.find((w) => w.art && LEX_DEF_DE[w.id])!;
    expect(defHintLine(n).startsWith(n.de[0])).toBe(true);
    expect(defHintLine(n)).toContain(`${letterCount(n.de)} 个字母`);
  });

  it('a de-tier write prompt shows the definition, the hint and hides the Chinese', () => {
    const s = newGame('T', 'student');
    const q: Question = { type: 'typed', prompt: '默写这个词', focus: zhWithPos(high), withArticle: !!high.art, answer: fullForm(high) };
    const d = dedefQ(s, high, q);
    expect(d.focus).toBe(defDe(high));
    expect(d.defHint).toBe(defHintLine(high));
    expect(d.zhHidden).toBe(zhWithPos(high));
    expect(d.focus).not.toContain(high.zh);
    // 中文优先: untouched.
    s.settings.defLang = 'zh';
    expect(dedefQ(s, high, q)).toBe(q);
  });

  it('a cloze swaps the sentence Chinese for the definition (shown after answering)', () => {
    const s = newGame('T', 'student');
    const q: Question = { type: 'cloze', clozeMode: 'base', dict: true, prompt: '句中默写：看整句中文，打出空里的词 · 这是一句中文。', focus: 'Das ___ hier.', answer: high.de, clozeZh: '这是一句中文。' };
    const d = dedefQ(s, high, q);
    expect(d.prompt).not.toContain('这是一句中文');
    expect(d.prompt).toContain(defDe(high)!);
    expect(d.zhHidden).toBe('这是一句中文。');
    expect(d.defHint).toContain(letterHint(high.de));
  });

  it('never leaks a meaning-choice answer: pickZh is left alone; teaching hides the Chinese in the de tier', () => {
    const s = newGame('T', 'student');
    const pz: Question = { type: 'pickZh', prompt: '选出意思', focus: fullForm(high), options: [high.zh, 'x', 'y'], answer: high.zh };
    const d = dedefQ(s, high, pz);
    expect(d.defDe).toBeUndefined();
    expect(d.focus).toBe(fullForm(high));
    const t = dedefQ(s, high, { ...pz, teach: { de: fullForm(high), zh: high.zh } });
    expect(t.teach).toMatchObject({ def: defDe(high), hideZh: true });
    const tm = dedefQ(s, mid, { ...pz, teach: { de: fullForm(mid), zh: mid.zh } });
    expect(tm.teach).toMatchObject({ def: defDe(mid), hideZh: false });
  });

  it('makeQuestion: a 121+ word written without an example gets the definition prompt', () => {
    const s = newGame('T', 'student');
    s.level = 130;
    let seen = 0;
    for (const w of WORDS.filter((x) => x.lvl >= 121 && LEX_DEF_DE[x.id] && !x.digit).slice(0, 80)) {
      const b = startBattle(s, w, makeRng(3));
      b.directOffer = false;
      b.step = 1;
      const q = makeQuestion(s, b, 'attack', makeRng(4));
      if (q.type === 'typed' && q.defDe) {
        expect(q.focus).toBe(defDe(w));
        expect(q.defHint).toBe(defHintLine(w));
        seen++;
      }
      if (q.type === 'cloze' && q.clozeZh && q.defDe) {
        expect(q.prompt).not.toContain(q.clozeZh);
        seen++;
      }
    }
    expect(seen).toBeGreaterThan(0);
  });
});

describe('近义容错', () => {
  const target = WORDS.find((w) => synonymsOf(w).some((x) => !x.art) && !w.art && !w.refl)!;
  const syn = synonymsOf(target).find((x) => !x.art)!;

  it('a 近义 word typed for the target is found (compared like a normal answer)', () => {
    expect(LEX_REL[target.id][1]).toContain(syn.id);
    const q: Question = { type: 'typed', prompt: '默写这个词', focus: zhWithPos(target), answer: fullForm(target) };
    expect(synonymHit(q, target, syn.de)?.id).toBe(syn.id);
    expect(synonymHit(q, target, ` ${syn.de.toUpperCase()} `)?.id).toBe(syn.id);
    // The right answer and an unrelated word are not synonyms.
    expect(synonymHit(q, target, target.de)).toBeNull();
    expect(synonymHit(q, target, 'xyzzy')).toBeNull();
    // Choice questions never retry.
    expect(synonymHit({ ...q, options: [target.de, syn.de] }, target, syn.de)).toBeNull();
    expect(SYN_NOTE).toBe('意思对，但不是这个词，再想想');
  });

  it('a noun synonym needs the article where the question wants one; a cloze slot keeps its article', () => {
    const n = WORDS.find((w) => w.art && synonymsOf(w).some((x) => x.art))!;
    const ns = synonymsOf(n).find((x) => x.art)!;
    const q: Question = { type: 'typed', prompt: '默写：带上冠词', focus: zhWithPos(n), withArticle: true, answer: fullForm(n) };
    expect(synonymHit(q, n, fullForm(ns))?.id).toBe(ns.id);
    const c: Question = { type: 'cloze', clozeMode: 'form', dict: true, prompt: 'x', focus: 'Ich sehe ___.', answer: `einen ${n.de}` };
    expect(synonymHit(c, n, `einen ${ns.de}`)?.id).toBe(ns.id);
    expect(synonymHit(c, n, `einen ${n.de}`)).toBeNull();
  });

  it('every 近义 id resolves to a word the game knows', () => {
    const ids = Object.values(LEX_REL).flatMap((r) => r[1]);
    expect(ids.length).toBeGreaterThan(0);
    expect(ids.filter((id) => WORD_BY_ID[id]).length / ids.length).toBeGreaterThan(0.9);
  });
});
