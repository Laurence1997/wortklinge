// 斩杀 (0.6.x) and 主城全量筛选: 游戏设计「0.6.x 小修：斩杀」「主城全量筛选」「斩杀全流程」.
import { describe, expect, it } from 'vitest';
import { migrate, newGame, type GameState } from '../src/core/state';
import { makeRng } from '../src/core/rng';
import { availableMoves, makeQuestion, resolveTurn, startBattle, type Battle, type Question } from '../src/core/combat';
import { typoOk } from '../src/core/cut';
import { cutStatus, kindOf, needsVerify, stageOf, verifyOf } from '../src/core/srs';
import { fieldCleared, pickSpawns, zoneWords } from '../src/core/spawn';
import { dueCount } from '../src/core/dailies';
import { answerScreen, claimScene, homeScene, pendingXp, sameMeaning, startScreen } from '../src/core/screen';
import { CONFIG, DAY, xpToNext } from '../src/core/config';
import { dropPages } from '../src/core/diary';
import { fullForm, WORD_BY_ID, WORDS } from '../src/data/words';

const T0 = new Date('2026-11-22T12:00:00').getTime();

function game(level = 6): GameState {
  const s = newGame('T', 'student', T0);
  s.timeOffset = T0 - Date.now();
  s.level = level;
  return s;
}

/** A word met before (one kill ago), now a 影子 / review. */
function met(s: GameState, id: string, stage: 1 | 2 | 3 = 1) {
  const t = T0 - 2 * DAY;
  s.words[id] = { stage, due: T0 + 5 * DAY, firstSeen: t, lastSeen: t, relapse: 0, correct: 1, wrong: 0, read: 1, write: 0 };
}

const typedQ = (id: string): Question => {
  const w = WORD_BY_ID[id];
  return { type: 'typed', prompt: '默写', focus: w.zh, withArticle: !!w.art, answer: fullForm(w) };
};

function fight(s: GameState, id: string): Battle {
  const b = startBattle(s, WORD_BY_ID[id], makeRng(3));
  b.phase = b.phase ?? undefined;
  return b;
}

describe('笔误 (one letter off)', () => {
  it('counts Hallo → Hello and a middle letter of a long noun; not short words, umlauts, endings, wrong articles or other words', () => {
    expect(typoOk('Hello', WORD_BY_ID['hallo'], false)).toBe(true);
    expect(typoOk('die Lempe', WORD_BY_ID['lampe'], true)).toBe(true);
    expect(typoOk('der Tea', WORD_BY_ID['tee'], true)).toBe(false); // 4 letters or fewer
    expect(typoOk('der Äpfel', WORD_BY_ID['apfel'], true)).toBe(false); // umlaut
    expect(typoOk('die Lampa', WORD_BY_ID['lampe'], true)).toBe(false); // ending
    expect(typoOk('der Lempe', WORD_BY_ID['lampe'], true)).toBe(false); // article
    expect(typoOk('Hallo', WORD_BY_ID['hallo'], false)).toBe(false); // exact is not a typo
  });
});

describe('斩杀 · 野外', () => {
  it('typing a met word right before its spelling showed → 会写 1/2 (待验证), gone for the day', () => {
    const s = game();
    met(s, 'lampe');
    const b = fight(s, 'lampe');
    const r = resolveTurn(s, b, 'attack', typedQ('lampe'), 'die Lampe', makeRng(1));
    expect(r.cut).toBe('pend');
    expect(r.verdict.notes.some((n) => n.includes('会写 1/2'))).toBe(true);
    expect(s.words.lampe.pend).toBeTruthy();
    expect(cutStatus(s.words.lampe, T0)).toContain('会写 1/2');
    const picks = pickSpawns(s, 'echogasse', 30, new Set(), makeRng(2));
    expect(picks.some((p) => p.word.id === 'lampe')).toBe(false);
  });

  it('a 笔误 counts toward 斩杀 but is still a miss', () => {
    const s = game();
    met(s, 'lampe');
    const b = fight(s, 'lampe');
    const hp = b.monster.hp;
    const r = resolveTurn(s, b, 'attack', typedQ('lampe'), 'die Lempe', makeRng(1));
    expect(r.correct).toBe(false);
    expect(r.cut).toBe('pend');
    expect(r.cutTypo).toBe(true);
    expect(b.monster.hp).toBe(hp);
  });

  it('does not count in the first fight of a new word, after the spelling showed, or with 低语', () => {
    const s = game();
    const b0 = fight(s, 'lampe');
    expect(b0.kind).toBe('new');
    expect(resolveTurn(s, b0, 'attack', typedQ('lampe'), 'die Lampe', makeRng(1)).cut).toBeUndefined();

    met(s, 'tisch');
    const b1 = fight(s, 'tisch');
    resolveTurn(s, b1, 'attack', { type: 'pickZh', prompt: '', focus: 'der Tisch', options: ['桌子', 'a', 'b'], answer: '桌子' }, '桌子', makeRng(1));
    expect(resolveTurn(s, b1, 'attack', typedQ('tisch'), 'der Tisch', makeRng(1)).cut).toBeUndefined();

    met(s, 'stuhl');
    const b2 = fight(s, 'stuhl');
    expect(resolveTurn(s, b2, 'whisper', { ...typedQ('stuhl'), whispered: true, whisper: 'der S…' }, 'der Stuhl', makeRng(1)).cut).toBeUndefined();
    expect(s.words.tisch.pend).toBeUndefined();
    expect(s.words.stuhl.pend).toBeUndefined();
  });
});

describe('斩杀 · 打字完形填空', () => {
  it('counts only the dictionary form with the word not on screen', () => {
    const s = game();
    met(s, 'lampe');
    const cz = (focus: string, answer: string): Question => ({ type: 'cloze', clozeMode: 'base', prompt: '完形填空', focus, answer });
    const b = fight(s, 'lampe');
    expect(resolveTurn(s, b, 'attack', cz('Wo ist ___? (灯在哪儿？)', 'die Lampe'), 'die Lampe', makeRng(1)).cut).toBe('pend');
    met(s, 'tisch');
    const b2 = fight(s, 'tisch');
    expect(resolveTurn(s, b2, 'attack', cz('Ich suche ___.', 'den Tisch'), 'den Tisch', makeRng(1)).cut).toBeUndefined();
    met(s, 'stuhl');
    const b3 = fight(s, 'stuhl');
    expect(resolveTurn(s, b3, 'attack', cz('Wo ist ___ (Stuhl)?', 'der Stuhl'), 'der Stuhl', makeRng(1)).cut).toBeUndefined();
  });
  it('a verb being verified is asked its infinitive from the Chinese', () => {
    const s = game(8);
    const v = WORDS.find((w) => w.pos === 'v' && w.region === 1)!;
    met(s, v.id);
    s.words[v.id].pend = T0 - DAY;
    const b = startBattle(s, v, makeRng(2));
    const q = makeQuestion(s, b, 'attack', makeRng(1));
    // 练中学 (rev 425): the verification is a 句中默写 when the verb has an example, else 看中文写 its infinitive.
    expect(q.type === 'typed' || q.dict).toBe(true);
    if (q.type === 'typed') expect(q.answer).toBe(v.de);
    expect(q.focus).not.toContain(q.answer!);
  });
});

describe('斩杀 · 第二天验证', () => {
  function pendYesterday(id: string) {
    const s = game();
    met(s, id);
    s.words[id].pend = T0 - DAY;
    return s;
  }

  it('glitched, typing first, no 低语; right → 可斩杀 and retired, never spawns again (until the 回响 check)', () => {
    const s = pendYesterday('lampe');
    expect(verifyOf(s.words.lampe, T0)).toBe('pend');
    const sp = pickSpawns(s, 'echogasse', 3, new Set(), makeRng(1));
    expect(sp.some((p) => p.word.id === 'lampe')).toBe(true);
    const b = fight(s, 'lampe');
    expect(b.verify).toBe('pend');
    expect(b.pluralMon).toBeFalsy();
    expect(availableMoves(s, b, 1)).toEqual(['attack']);
    const q = makeQuestion(s, b, 'attack', makeRng(1));
    expect(q.dict || q.type === 'typed').toBe(true); // 句中默写 (rev 425)
    expect(q.whispered).toBeFalsy();
    const r = resolveTurn(s, b, 'attack', q, q.answer!, makeRng(1));
    expect(r.cut).toBe('ready');
    expect(b.cutReady).toBe(true);
    expect(s.words.lampe.retired).toBeTruthy();
    expect(stageOf(s, WORD_BY_ID['lampe'], T0 + 200 * DAY)).toBe(3);
    expect(kindOf(s, WORD_BY_ID['lampe'])).toBe('guiming');
    expect(pickSpawns(s, 'echogasse', 30, new Set(), makeRng(2)).some((p) => p.word.id === 'lampe')).toBe(false);
    expect(cutStatus(s.words.lampe, T0)).toBe('已斩杀');
  });

  it('wrong → back to normal reviews, no other penalty', () => {
    const s = pendYesterday('lampe');
    const b = fight(s, 'lampe');
    const r = resolveTurn(s, b, 'attack', makeQuestion(s, b, 'attack', makeRng(1)), 'die Lampo', makeRng(1));
    expect(r.cut).toBe('fail');
    expect(s.words.lampe.pend).toBeUndefined();
    expect(s.words.lampe.retired).toBeUndefined();
    expect(s.words.lampe.stage).toBe(1);
  });

  it('30 days later the 回响 check: right → retired for good, wrong → normal review', () => {
    const s = game();
    met(s, 'lampe');
    s.words.lampe.retired = T0 - 31 * DAY;
    s.words.lampe.stage = 3;
    expect(needsVerify(s, WORD_BY_ID['lampe'])).toBe(true);
    expect(cutStatus(s.words.lampe, T0)).toBe('回响抽查中');
    const b = fight(s, 'lampe');
    expect(b.verify).toBe('recheck');
    const rq = makeQuestion(s, b, 'attack', makeRng(1));
    resolveTurn(s, b, 'attack', rq, rq.answer!, makeRng(1));
    expect(s.words.lampe.sure).toBe(true);
    expect(needsVerify(s, WORD_BY_ID['lampe'], T0 + 100 * DAY)).toBe(false);

    met(s, 'tisch');
    s.words.tisch.retired = T0 - 31 * DAY;
    const b2 = fight(s, 'tisch');
    resolveTurn(s, b2, 'attack', makeQuestion(s, b2, 'attack', makeRng(1)), 'die Tisch', makeRng(1));
    expect(s.words.tisch.retired).toBeUndefined();
    expect(kindOf(s, WORD_BY_ID['tisch'])).toBe('due');
  });

  it('retired words leave the review count', () => {
    const s = game();
    met(s, 'lampe', 3);
    s.words.lampe.due = T0 - DAY; // a context review due (2026-11-24: dueCount counts those)
    expect(dueCount(s)).toBe(1);
    s.words.lampe.retired = T0;
    expect(dueCount(s)).toBe(0);
  });
});

describe('场景刷空', () => {
  it('a field whose words are all retired still fills (next-region monsters) and says 去下一区', () => {
    const s = game(9);
    for (const w of zoneWords('echogasse')) {
      met(s, w.id, 3);
      s.words[w.id].retired = T0;
    }
    expect(fieldCleared(s, 'echogasse')).toBe(true);
    const picks = pickSpawns(s, 'echogasse', 6, new Set(), makeRng(1));
    expect(picks.length).toBeGreaterThan(0);
    expect(picks.every((p) => p.word.zone !== 'echogasse')).toBe(true);
    expect(picks.some((p) => (p.word.region ?? 1) === 2)).toBe(true);
  });
});

describe('复数怪不跟着退役', () => {
  it('a retired noun comes back only as its plural crowd (Lv11+)', () => {
    const s = game(12);
    met(s, 'lampe', 3);
    s.words.lampe.retired = T0;
    const b = startBattle(s, WORD_BY_ID['lampe'], makeRng(9));
    expect(b.pluralMon).toBe(true);
    for (const w of zoneWords('echogasse')) {
      met(s, w.id, 3);
      s.words[w.id].retired = T0;
    }
    const picks = pickSpawns(s, 'echogasse', 6, new Set(), makeRng(1));
    expect(picks.some((p) => p.word.zone === 'echogasse')).toBe(true);
  });
});

describe('主城全量筛选', () => {
  it('right → retired with its XP stored in the home scene; wrong or skipped → nothing changes', () => {
    const s = game(3);
    const run = startScreen(s, '1');
    const w = run.current!;
    answerScreen(s, run, fullForm(w));
    expect(s.words[w.id].retired).toBeTruthy();
    expect(stageOf(s, w)).toBe(3);
    const xp0 = s.xp;
    expect(s.xp).toBe(xp0);
    const sc = homeScene(w.id);
    if (sc) expect(s.screen!.pending[sc.id]).toContain(w.id);
    const w2 = run.current!;
    answerScreen(s, run, 'zzz');
    expect(s.words[w2.id]).toBeUndefined();
    const w3 = run.current!;
    answerScreen(s, run, '', true);
    expect(s.words[w3.id]).toBeUndefined();
    // Progress is saved: a new session starts after the last word answered.
    expect(startScreen(s, '1').current!.id).not.toBe(w.id);
  });

  it('a typo does not count in town', () => {
    const s = game(3);
    const run = startScreen(s, '1');
    run.current = WORD_BY_ID['hallo'];
    answerScreen(s, run, 'Hello');
    expect(s.words.hallo).toBeUndefined();
  });

  it('the same Chinese (brackets aside) counts and retires the word written', () => {
    expect(sameMeaning(WORD_BY_ID['tschuess'], WORD_BY_ID['auf-wiedersehen'])).toBe(true);
    expect(sameMeaning(WORD_BY_ID['arbeit'], WORD_BY_ID['arbeiten'])).toBe(false);
    const s = game(3);
    const run = startScreen(s, '1');
    run.current = WORD_BY_ID['tschuess'];
    answerScreen(s, run, 'Auf Wiedersehen');
    expect(s.words['auf-wiedersehen'].retired).toBeTruthy();
    expect(s.words.tschuess).toBeUndefined();
  });

  it('walking into the scene pays the stored XP once (level gap applied, at most one level) and drops its diary page only then', () => {
    const s = game(3);
    const sc = homeScene('lampe')!;
    const run = startScreen(s, '1');
    for (const id of sc.words!) {
      run.current = WORD_BY_ID[id];
      answerScreen(s, run, fullForm(WORD_BY_ID[id]));
    }
    expect(dropPages(s).some((p) => p.scene === sc.id)).toBe(false);
    const want = pendingXp(s, sc.id);
    expect(want).toBeGreaterThan(0);
    expect(want).toBeLessThanOrEqual(xpToNext(3));
    const r = claimScene(s, sc.id)!;
    expect(r.words).toBe(sc.words!.length);
    expect(r.xp).toBe(want);
    expect(claimScene(s, sc.id)).toBeNull();
    expect(dropPages(s).some((p) => p.scene === sc.id)).toBe(true);
  });
});

describe('存档', () => {
  it('old saves load with empty screening state; the new word fields survive a round trip', () => {
    const s = game();
    met(s, 'lampe');
    s.words.lampe.pend = T0;
    const raw = JSON.parse(JSON.stringify(s));
    delete raw.screen;
    const m = migrate(raw)!;
    expect(m.screen).toEqual({ pending: {}, cursor: {} });
    expect(m.words.lampe.pend).toBe(T0);
    expect(CONFIG.srs.recheck).toBe(30 * DAY);
    expect(WORDS.length).toBeGreaterThan(0);
  });
});

describe('全量筛选 skips learned words (2026-11-23)', () => {
  it('a 归名 word that is not due is not asked and is not counted as still to learn; once due it is', async () => {
    const { screenPool, regionLeft } = await import('../src/core/screen');
    const s = newGame('T', 'student', Date.now());
    s.level = 5;
    const w = screenPool(s, '1')[0];
    const before = regionLeft(s, 1);
    s.words[w.id] = { stage: 3, due: Date.now() + 10 * DAY } as GameState['words'][string];
    expect(screenPool(s, '1').some((x) => x.id === w.id)).toBe(false);
    const after = regionLeft(s, 1);
    expect(after.left).toBe(before.left - 1);
    expect(after.learned + after.left).toBe(after.total);
    s.words[w.id].due = Date.now() - 1000; // a context review due: still 归名
    expect(screenPool(s, '1').some((x) => x.id === w.id)).toBe(false);
    s.words[w.id].stage = 2; // 复发中 counts as 半名 and can be screened again
    s.words[w.id].lapsed = true;
    expect(screenPool(s, '1').some((x) => x.id === w.id)).toBe(true);
  });
});
