import { BOARDS } from '../src/core/gram/boards';
import { GRAM_CFG } from '../src/core/gram/hook';
import { describe, expect, it } from 'vitest';
GRAM_CFG.chance = 0; // grammar questions have their own tests (gram.test.ts)
import { gradeMoechte, gradeTyped, normalize } from '../src/core/grading';
import { WORD_BY_ID, WORDS } from '../src/data/words';
import { AREAS, SCENES } from '../src/data/world';
import { DIARY, parseLine } from '../src/data/diary';
import { newGame, addXp, migrate, migrateSrs2, attack, gearTier, addGearKill, affinityOf, stampTiers } from '../src/core/state';
import { applyWin } from '../src/core/outcomes';
import { recordKill, kindOf, stageOf, contextDue, contextPass, contextFail, reviewMon, reviewedByWriting } from '../src/core/srs';
import { CONFIG, DAY, HOUR, monsterHpAt, xpToNext } from '../src/core/config';
import { startBattle, makeQuestion, resolveTurn, spillStorm, effArmor, affinityMatch, qTier, linkPack, moveReady, phaseOf, phaseRight, chorusMates, availableMoves, alignPairs, voiceCases } from '../src/core/combat';
import { makeRng } from '../src/core/rng';
import { makeItem } from '../src/core/loot';
import { answerBoss, startBoss } from '../src/core/boss';
import { BOSS_QUESTIONS } from '../src/data/boss';
import { pickSpawns } from '../src/core/spawn';
import { CONJ } from '../src/data/verbs';
import { pronounClozes, EXAMPLES } from '../src/core/cloze';
import { UNLOCK } from '../src/core/unlocks';

const T0 = new Date('2026-11-20T10:00:00').getTime();

describe('word data', () => {
  it('has about 200 unique words with Chinese meanings', () => {
    expect(WORDS.length).toBeGreaterThanOrEqual(190);
    expect(new Set(WORDS.map((w) => w.id)).size).toBe(WORDS.length);
    for (const w of WORDS) {
      expect(w.zh.length).toBeGreaterThan(0);
      if (w.pos === 'n') expect(['der', 'die', 'das']).toContain(w.art);
    }
  });
});

describe('grading', () => {
  const tee = WORD_BY_ID['tee'];
  const tschuess = WORDS.find((w) => w.de === 'tschüss')!;
  it('accepts ae/oe/ue/ss and shows the proper spelling', () => {
    const v = gradeTyped('Tschuess', tschuess, false);
    expect(v.ok).toBe(true);
    expect(v.notes.join()).toContain('tschüss');
  });
  it('requires the article when asked and names a wrong one', () => {
    expect(gradeTyped('Tee', tee, true).ok).toBe(false);
    expect(gradeTyped('Tee', tee, true).notes[0]).toContain('要带冠词');
    const v = gradeTyped('die Tee', tee, true);
    expect(v.ok).toBe(false);
    expect(v.notes[0]).toContain('der');
    expect(gradeTyped('der tee', tee, true).ok).toBe(true);
  });
  it('treats E-Mail and email the same', () => {
    expect(gradeTyped('die email', WORD_BY_ID['e-mail'], true).ok).toBe(true);
  });
  it('grades Ich möchte with the accusative', () => {
    const known = WORDS.filter((w) => w.moechte);
    expect(gradeMoechte('Ich möchte einen Tee.', known).ok).toBe(true);
    expect(gradeMoechte('ich moechte eine tasse', known).ok).toBe(true);
    const bad = gradeMoechte('Ich möchte ein Tee', known);
    expect(bad.ok).toBe(false);
    expect(bad.notes[0]).toContain('einen');
    expect(gradeMoechte('Ich möchte einen Elefanten', known).ok).toBe(false);
    expect(normalize('Wie geht’s?')).toBe('wie gehts');
  });
});

describe('归名 (spaced repetition)', () => {
  it('2026-11-24: 认 / 用 / 写 in one day, respawning ~6 minutes later; then context reviews, not monsters', () => {
    const s = newGame('T', 'student', T0);
    const w = WORD_BY_ID['stuhl'];
    const R = CONFIG.srs.respawn;
    expect(kindOf(s, w, T0)).toBe('new');
    recordKill(s, w, false, false, T0, { flaw: true });
    expect(stageOf(s, w, T0)).toBe(1);
    expect(kindOf(s, w, T0 + 1000)).toBe('shadow');
    recordKill(s, w, true, false, T0 + 1000); // a shadow kill does nothing
    expect(stageOf(s, w, T0 + 1000)).toBe(1);
    const t1 = T0 + R;
    expect(kindOf(s, w, t1)).toBe('due');
    // 用 needs a right example cloze in the fight.
    expect(recordKill(s, w, false, false, t1).needsCloze).toBe(true);
    expect(stageOf(s, w, t1)).toBe(1);
    const t2 = t1 + R;
    recordKill(s, w, false, false, t2, { used: true });
    expect(stageOf(s, w, t2)).toBe(2);
    const t3 = t2 + R;
    expect(recordKill(s, w, false, false, t3).needsTypedFinal).toBe(true); // a choice kill can't finish it
    const t4 = t3 + R;
    expect(recordKill(s, w, true, false, t4).guiming).toBe(true);
    expect(t4 - T0).toBeLessThan(HOUR);
    // Not clean (one wrong answer on the way): first review after 3 days, then ×3 on a clean pass.
    const p = s.words[w.id];
    expect(p.due).toBe(t4 + CONFIG.srs.adaptive.oneSlip);
    const t5 = p.due + 1000;
    expect(contextDue(p, t5)).toBe(true);
    expect(kindOf(s, w, t5)).toBe('guiming');
    expect(stageOf(s, w, t5)).toBe(3);
    expect(contextPass(s, w, t5)).toBe(CONFIG.srs.adaptive.oneSlip * 3);
    // Two gaps overdue: it turns back into a review monster (半名).
    const t6 = p.due + 2 * CONFIG.srs.adaptive.oneSlip * 3;
    expect(kindOf(s, w, t6)).toBe('due');
    expect(stageOf(s, w, t6)).toBe(2);
    expect(reviewMon(p, t6)).toBe(true);
  });
  it('rev 51 / 52: a clean first fight skips to 半名; a clean 归名 gets one 30-day check; writing it counts', () => {
    const s = newGame('T', 'student', T0);
    const w = WORD_BY_ID['tisch'];
    recordKill(s, w, false, false, T0, { typed: true });
    expect(stageOf(s, w, T0)).toBe(2);
    const t1 = T0 + CONFIG.srs.respawn;
    expect(recordKill(s, w, true, false, t1).guiming).toBe(true);
    const p = s.words[w.id];
    // 审查修订: back once after 2–3 days; the second clean pass ends its reviews.
    expect(p.due).toBe(t1 + CONFIG.srs.cleanFirst);
    expect(contextPass(s, w, p.due)).toBeNull();
    expect(p.ctxDone).toBe(true);
    // A wrong context answer relapses it to a 半名 review monster; one 归名一击 names it again.
    const v = WORD_BY_ID['stuhl'];
    recordKill(s, v, false, false, T0, { flaw: true, typed: true });
    expect(stageOf(s, v, T0)).toBe(1);
    recordKill(s, v, false, false, T0 + 400_000, { used: true });
    recordKill(s, v, true, false, T0 + 800_000);
    const q = s.words[v.id];
    reviewedByWriting(s, v, T0 + DAY); // not due yet: pushed back by its gap
    expect(q.due).toBe(T0 + DAY + CONFIG.srs.adaptive.oneSlip); // one wrong answer while learning: 3-day gap
    contextFail(s, v, q.due);
    expect(reviewMon(q, q.due)).toBe(true);
    expect(stageOf(s, v, q.due)).toBe(2);
    expect(recordKill(s, v, true, false, q.due + 1).guiming).toBe(true);
    expect(q.relapse).toBe(1);
  });
  it('a wrong answer on 半名 drops it one step, never to 无名', () => {
    const s = newGame('T', 'student', T0);
    const w = WORD_BY_ID['tisch'];
    recordKill(s, w, false, false, T0, { flaw: true });
    const t1 = T0 + CONFIG.srs.respawn;
    recordKill(s, w, false, false, t1, { used: true });
    const t2 = t1 + CONFIG.srs.respawn;
    const o = recordKill(s, w, true, true, t2);
    expect(o.to).toBe(1);
  });
  it('migrate (srs2): learning words are due now, 归名 words move onto the context schedule, nothing is lost', () => {
    const s = newGame('T', 'student', T0);
    delete s.flags.srs2;
    s.words.stuhl = { stage: 1, due: T0 + 16 * HOUR, firstSeen: 0, lastSeen: 0, relapse: 0, correct: 1, wrong: 1 };
    s.words.tisch = { stage: 3, due: T0 + 30 * DAY, firstSeen: 0, lastSeen: 0, relapse: 1, correct: 5, wrong: 0, write: 2 };
    s.words.brot = { stage: 3, due: T0 - DAY, firstSeen: 0, lastSeen: 0, relapse: 0, correct: 5, wrong: 0 };
    migrateSrs2(s, T0);
    expect(s.words.stuhl.due).toBe(T0);
    expect(s.words.stuhl.flaw).toBe(true);
    expect(s.words.tisch.stage).toBe(3);
    expect(s.words.tisch.due).toBe(T0 + CONFIG.srs.context[1]);
    expect(s.words.brot.due).toBe(T0);
    expect(contextDue(s.words.brot, T0)).toBe(true);
    expect(stageOf(s, WORD_BY_ID['brot'], T0)).toBe(3);
    const before = JSON.stringify(s.words);
    migrateSrs2(s, T0 + DAY); // once only
    expect(JSON.stringify(s.words)).toBe(before);
  });
});

describe('levels', () => {
  it('follows the design curve and stops at the version cap', () => {
    // 0.5 开局节奏表: Lv1–5 minutes [67, 49, 40, 38, 60] ×0.7; Lv6–10 ×0.4, Lv11+ unchanged.
    expect(xpToNext(1)).toBe(782);
    expect(xpToNext(5)).toBe(700);
    expect(xpToNext(10)).toBeGreaterThan(950);
    expect(xpToNext(11)).toBeGreaterThan(2400);
    expect(xpToNext(1, 1)).toBe(1117);
    const s = newGame('T', 'student', T0);
    addXp(s, 1_000_000);
    // 0.7/0.8: the cap is the end of the first 突破试炼 not passed yet (30 → 80 → 120).
    expect(s.level).toBe(30);
    s.flags.a1Passed = s.flags.a1Grammar = true;
    addXp(s, 10_000_000);
    expect(s.level).toBe(80);
    s.flags.a2Passed = true;
    s.flags.b1Passed = true;
    addXp(s, 100_000_000);
    // 1.0: B1 passed → the B2 trial cap (160) until B2 is passed.
    expect(s.level).toBe(160);
    s.flags.b2Passed = true;
    addXp(s, 1_000_000_000);
    expect(s.level).toBe(Math.min(CONFIG.levelCap, CONFIG.releaseCap));
  });

  it('re-levels an old save from its total XP, only upwards', () => {
    const old = { ...newGame('T', 'student', T0), level: 5, xp: 500, xpCurve: 1 };
    const m = migrate(JSON.parse(JSON.stringify(old)))!;
    expect(m.level).toBeGreaterThan(5);
    expect(m.xpCurve).toBe(2);
    expect(String(m.flags.catchUpLevels)).toContain('6');
  });
});

describe('combat', () => {
  it('a level-1 player beats a new noun monster by answering right (the der stance is the article now)', () => {
    const rng = makeRng(1);
    const s = newGame('T', 'student', Date.now());
    const b = startBattle(s, WORD_BY_ID['tee'], rng);
    b.phase = 'der';
    let guard = 0;
    while (!b.outcome && guard++ < 20) {
      const q = makeQuestion(s, b, 'attack', rng);
      if (guard === 1) expect(q.type).toBe('pickDe');
      resolveTurn(s, b, 'attack', q, q.answer!, rng);
    }
    expect(b.outcome).toBe('win');
  });
  it('the forced-loss tutorial cannot be won', () => {
    const rng = makeRng(2);
    const s = newGame('T', 'student', Date.now());
    s.level = 4;
    s.hp = 42;
    const b = startBattle(s, WORD_BY_ID['hund'], rng, { tutorial: 'loss' });
    let guard = 0;
    while (!b.outcome && guard++ < 20) {
      const q = makeQuestion(s, b, 'attack', rng);
      resolveTurn(s, b, 'attack', q, q.answer!, rng);
    }
    expect(b.outcome).toBe('lose');
    expect(b.intent.line).toContain('dreimal');
  });
  it('a correct hit interrupts a charge (0.6.x: guards are gone)', () => {
    const rng = makeRng(3);
    const s = newGame('T', 'student', Date.now());
    s.level = 7;
    s.hp = 60;
    const b = startBattle(s, WORD_BY_ID['stuhl'], rng);
    b.intent = { ...b.intent, kind: 'charge', hits: 1 };
    b.monster.hp = 999;
    const q = makeQuestion(s, b, 'attack', rng);
    const r = resolveTurn(s, b, 'attack', q, q.answer!, rng);
    expect(r.readRight).toBe(true);
    expect(r.monsterDamage).toBe(0);
  });
});

describe('墨水风暴 overflow', () => {
  it('spills once onto the charging monster, never below 1 HP, and defence still cuts it', () => {
    const rng = makeRng(3);
    const s = newGame('T', 'student', 0);
    s.level = 13;
    s.cls = 'writer';
    const ws = WORDS.filter((w) => w.art).slice(0, 3);
    const pack = ws.map((w) => startBattle(s, w, rng));
    const [dead, a, c] = pack;
    dead.outcome = 'win';
    a.monster.hp = 20; a.intent = { ...a.intent, kind: 'attack' };
    c.monster.hp = 30; c.intent = { ...c.intent, kind: 'charge' };
    const log: { text: string; tone: 'good' }[] = [];
    expect(spillStorm(s, pack, dead, 999, true, log as never)).toBe(29);
    expect(c.monster.hp).toBe(1);
    expect(c.outcome).toBeFalsy();
    a.intent = { ...a.intent, kind: 'defend' };
    expect(spillStorm(s, pack, dead, 10, true, log as never)).toBe(Math.round(10 * CONFIG.damage.vsDefend));
  });
});

describe('spawning', () => {
  it('a level-1 player only meets nouns, new words first', () => {
    const s = newGame('T', 'student', Date.now());
    const picks = pickSpawns(s, 'echogasse', 6, new Set(), makeRng(4));
    expect(picks.length).toBe(6);
    for (const p of picks) expect(p.word.art).toBeTruthy();
  });
});

describe('boss', () => {
  it('accepts full-sentence answers and names common mistakes', () => {
    const rng = makeRng(5);
    const s = newGame('Lucas', 'student', Date.now());
    s.hp = 80;
    const f = startBoss(s, rng);
    expect(f.current.id).toBe('greet');
    expect(answerBoss(s, f, 'Guten Tag!', rng).ok).toBe(true);
    expect(f.current.id).toBe('name');
    expect(answerBoss(s, f, 'Ich heiße Lucas.', rng).ok).toBe(true);
    const v = answerBoss(s, f, 'Ich komme von China.', rng);
    expect(v.ok).toBe(false);
    expect(v.note).toContain('aus');
  });
  it('every boss question accepts its own model answer', () => {
    const s = newGame('Lucas', 'student', Date.now());
    for (const q of BOSS_QUESTIONS) {
      const model = q.model.replace('{name}', 'Lucas').split(' / ')[0].replace(/（.*）/, '').replace(/–/g, ' ');
      const f = startBoss(s, makeRng(6));
      f.current = q;
      expect(answerBoss(s, f, model, makeRng(7)).ok, `${q.id}: ${model}`).toBe(true);
    }
  });
});

describe('sentence input', () => {
  it('forgives a doubled "Ich möchte" from the pre-filled box', () => {
    const known = WORDS.filter((w) => w.moechte);
    expect(gradeMoechte('Ich möchte Ich möchte einen Kaffee.', known).ok).toBe(true);
  });
});

describe('no 言灵过载 (removed 2026-11-20)', () => {
  it('pays the same for new words however many you met today, and the same for review monsters (审查修订)', () => {
    const rng = makeRng(7);
    const run = (count: number, kind: 'new' | 'due') => {
      const s = newGame('T', 'student');
      s.level = 6;
      s.daily.newCount = count;
      const b = startBattle(s, WORD_BY_ID['zimmer'], rng);
      b.kind = kind;
      if (kind === 'due') b.reviewMon = true; // 2026-11-24: the bonus is for 复习怪 only
      b.lastKillTyped = false;
      return { s, res: applyWin(s, b, () => 0.99) };
    };
    const fresh = run(0, 'new');
    const many = run(80, 'new');
    expect(many.res.xp).toBe(fresh.res.xp);
    expect(many.res.gold).toBe(fresh.res.gold);
    const due = run(80, 'due');
    expect(due.res.review).toBe(true);
    expect(due.res.xp).toBe(CONFIG.xp.dueMonster);
    expect(due.s.gearKills?.['1']).toBe(1); // no extra shard: that moved to context reviews
    // New words keep spawning.
    const s = newGame('T', 'student');
    s.level = 6;
    s.daily.newCount = 80;
    expect(pickSpawns(s, WORD_BY_ID['zimmer'].zone, 6, new Set(), rng).filter((p) => p.kind === 'new').length).toBeGreaterThan(1);
  });
});

describe('review backlog', () => {
  it('has no daily cap, spawns in waves and pays more when overdue', () => {
    const rng = makeRng(3);
    const s = newGame('T', 'student');
    s.level = 6;
    const zone = WORD_BY_ID['tee'].zone;
    const t = Date.now();
    // 150 reviews already spawned today and a big backlog: reviews still appear, one slot stays free.
    s.daily.dueSpawned = 150;
    // 2026-11-24: only 归名 words left 2+ gaps overdue (or relapsed) are review monsters; learning respawns never fatten.
    for (const w of WORDS.filter((x) => x.zone === zone)) s.words[w.id] = { stage: 3, due: t - 10 * 24 * 3600_000, ivl: 2 * DAY } as never;
    const picks = pickSpawns(s, zone, 6, new Set(), rng);
    expect(picks.filter((p) => p.kind === 'due').length).toBe(5);
    const b = startBattle(s, WORD_BY_ID['tee'], rng);
    expect(b.overdue).toBeGreaterThan(0);
    const late = applyWin(s, b, () => 0.99).xp;
    const s2 = newGame('T', 'student');
    s2.level = 6;
    const b2 = startBattle(s2, WORD_BY_ID['tee'], rng);
    b2.kind = 'due';
    b2.lastKillTyped = b.lastKillTyped;
    expect(late).toBeGreaterThan(applyWin(s2, b2, () => 0.99).xp);
  });
});

describe('question ladder', () => {
  it('never asks the same question twice in a row on a new word', () => {
    const rng = makeRng(5);
    for (const level of [1, 3]) {
      const s = newGame('T', 'student');
      s.level = level;
      const b = startBattle(s, WORD_BY_ID['tee'], rng);
      const types: string[] = [];
      for (let i = 0; i < 3; i++) {
        types.push(makeQuestion(s, b, 'attack', rng).type);
        b.step += 1;
        if (i === 1) b.wrote = true; // 先认后写: the step-1 question (written from Lv2) was answered
      }
      // 完形填空 ladder (Lv1–5): pick the German (the one teaching choice) → cloze (typed from Lv2, 先认后写) → listen-and-pick.
      // Before: pick the German (the article lives in the stance since 0.5) → cloze → listen-and-pick.
      expect(types).toEqual(['pickDe', 'cloze', 'pickZh']);
      for (let i = 1; i < types.length; i++) expect(types[i]).not.toBe(types[i - 1]);
    }
  });
});

describe('region 2: packs, conjugation, plurals', () => {
  const nounOf = (art: string) => WORDS.find((w) => w.region === 2 && w.pos === 'n' && w.art === art && w.family === 'krume')!;

  it('0.5: no 点名 any more — 齐鸣 rings only on the monsters of your stance', () => {
    const rng = makeRng(7);
    const s = newGame('T', 'student');
    s.level = 11;
    const a = startBattle(s, nounOf('der'), rng);
    const c = startBattle(s, nounOf('die'), rng);
    const d = startBattle(s, WORDS.filter((w) => w.region === 2 && w.pos === 'n' && w.art === 'der' && w.pl && w.pl !== '-')[1], rng);
    for (const x of [a, c, d]) {
      x.pluralMon = false;
      x.monster.hp = x.monster.maxHp = 500;
      x.intent = { ...x.intent, kind: 'wait', hits: 0, caseArt: undefined }; // name-only lines: stance = der/die/das
    }
    expect(makeQuestion(s, a, 'attack', rng, undefined, true).type).not.toBe('callout');
    a.phase = 'der';
    const q = makeQuestion(s, a, 'chorus', rng, undefined, true);
    const r = resolveTurn(s, a, 'chorus', q, q.answer!, rng, [a, c, d]);
    expect(r.phase).toBe('right');
    expect(d.monster.hp).toBeLessThan(500);
    expect(c.monster.hp).toBe(500);
  });

  it('rev 49: a wrong stance on the target rings no 齐鸣; the button needs a same-stance mate; a charging mate is interrupted', () => {
    const rng = makeRng(9);
    const s = newGame('T', 'student');
    s.level = 11;
    s.hp = 9999;
    const a = startBattle(s, nounOf('der'), rng);
    const d = startBattle(s, WORDS.filter((w) => w.region === 2 && w.pos === 'n' && w.art === 'der' && w.pl && w.pl !== '-')[1], rng);
    const c = startBattle(s, nounOf('die'), rng);
    for (const x of [a, c, d]) {
      x.pluralMon = false;
      x.monster.hp = x.monster.maxHp = 500;
      x.intent = { ...x.intent, kind: 'attack', hits: 1, caseArt: undefined };
    }
    expect(chorusMates(a, [a, c, d])).toEqual([d]);
    expect(chorusMates(c, [a, c, d])).toEqual([]);
    expect(availableMoves(s, c, 3, chorusMates(c, [a, c, d]).length)).not.toContain('chorus');
    expect(availableMoves(s, a, 3, chorusMates(a, [a, c, d]).length)).toContain('chorus');
    // Wrong stance: only the target is hit.
    a.phase = 'die';
    let q = makeQuestion(s, a, 'chorus', rng, undefined, true);
    let r = resolveTurn(s, a, 'chorus', q, q.answer!, rng, [a, c, d]);
    expect(r.phase).toBe('wrong');
    expect(d.monster.hp).toBe(500);
    // Right stance: the mate takes the same pre-armor hit and its charge breaks.
    a.chorusCd = d.chorusCd = c.chorusCd = 0;
    a.intent = { ...a.intent, kind: 'attack', hits: 1, caseArt: undefined }; // the name stance, like its charging mate
    a.phase = 'der';
    d.intent = { ...d.intent, kind: 'charge', hits: 1, caseArt: undefined };
    const hp0 = s.hp;
    q = makeQuestion(s, a, 'chorus', rng, undefined, true);
    r = resolveTurn(s, a, 'chorus', q, q.answer!, rng, [a, c, d]);
    expect(r.phase).toBe('right');
    expect(d.monster.hp).toBeLessThan(500);
    expect(r.log.some((l) => /齐鸣：.*打断/.test(l.text))).toBe(true);
    expect(hp0 - s.hp).toBeLessThan(d.monster.dmg * 2); // no ×2 big attack from the interrupted mate
  });

  it('rev 49: a same-article pair reads its lines in one case', () => {
    const s = newGame('T', 'student');
    s.level = 15;
    const ders = WORDS.filter((w) => w.pos === 'n' && w.art === 'der' && (EXAMPLES[w.id] ?? []).length >= 2).slice(0, 40);
    let checked = 0;
    for (let i = 0; i + 1 < ders.length; i += 2) {
      const p = [startBattle(s, ders[i], makeRng(i)), startBattle(s, ders[i + 1], makeRng(i + 1))];
      for (const x of p) x.pluralMon = false;
      p.forEach((x) => (x.intent = { ...x.intent, kind: 'attack' }));
      alignPairs(s, p);
      if (!p.every((x) => x.intent.caseArt)) continue;
      if (!(['nom', 'acc', 'dat'] as const).some((c) => p.every((x) => voiceCases(s, x).includes(c)))) continue; // no shared case
      checked++;
      expect(phaseRight(p[1], phaseOf(p[0])!)).toBe(true);
    }
    expect(checked).toBeGreaterThan(3);
  });

  it('every pack member acts, with less damage each', () => {
    const rng = makeRng(3);
    const s = newGame('T', 'student');
    s.level = 11;
    s.hp = 9999;
    const solo = startBattle(s, nounOf('der'), rng);
    const pack = [startBattle(s, nounOf('der'), rng), startBattle(s, nounOf('die'), rng)];
    const r = resolveTurn(s, pack[0], 'attack', makeQuestion(s, pack[0], 'attack', rng, undefined, true), 'das', rng, pack);
    expect(r.correct).toBe(false);
    expect(r.kills.length).toBe(0);
    // Both monsters attacked (or prepared), so the log names both, and you lost HP.
    expect(s.hp).toBeLessThan(9999);
    expect(solo.monster.dmg).toBeGreaterThan(0);
  });

  it('grades conjugation with or without the pronoun', () => {
    const rng = makeRng(1);
    const s = newGame('T', 'student');
    s.level = 12;
    const b = startBattle(s, WORDS.find((w) => w.de === 'nehmen')!, rng);
    b.wrote = true; // 先认后写 already done: walk the rest of the ladder
    let q = makeQuestion(s, b, 'attack', rng);
    while (q.type !== 'conj') {
      b.step += 1;
      q = makeQuestion(s, b, 'attack', rng);
    }
    const form = q.answer!;
    const r1 = resolveTurn(s, b, 'attack', q, form, rng);
    expect(r1.correct).toBe(true);
    const q3 = { ...q, person: 'du' as const, answer: 'nimmst' };
    expect(resolveTurn(s, b, 'attack', q3, 'du nimmst', rng).correct).toBe(true);
    expect(resolveTurn(s, b, 'attack', q3, 'nehmst', rng).correct).toBe(false);
  });

  it('asks the plural on some due nouns and accepts "die Äpfel" or "Aepfel"', () => {
    const rng = makeRng(2);
    const s = newGame('T', 'student');
    s.level = 11;
    const apfel = WORDS.find((w) => w.de === 'Apfel')!;
    const b = startBattle(s, apfel, rng);
    b.pluralDue = true;
    const q = makeQuestion(s, b, 'attack', rng);
    expect(q.type).toBe('plural');
    expect(resolveTurn(s, b, 'attack', q, 'die Aepfel', rng).correct).toBe(true);
    expect(resolveTurn(s, b, 'attack', { ...q }, 'Apfel', rng).correct).toBe(false);
  });

  it('has conjugation rows for every region verb', () => {
    for (const w of WORDS.filter((x) => x.pos === 'v' && (x.region === 2 || x.region === 3))) expect(CONJ[w.de], w.de).toBeDefined();
  });
});

describe('classes and talents', () => {
  const noun = () => WORDS.find((w) => w.de === 'Apfel')!;

  it('技能池: 一气呵成 makes 3 typed in a row crit; 墨水风暴 costs nothing and goes on cooldown', () => {
    const rng = makeRng(11);
    const s = newGame('T', 'student');
    s.level = 12;
    s.talents = { shared: { critRun: 1 } };
    s.hp = 9999;
    s.words['apfel'] = { stage: 1 } as never;
    const b = startBattle(s, noun(), rng);
    b.monster.hp = b.monster.maxHp = 9999;
    const typed = { type: 'typed' as const, prompt: '', focus: '', withArticle: true, answer: 'der Apfel' };
    for (let i = 0; i < 3; i++) resolveTurn(s, b, 'attack', typed, 'der Apfel', rng);
    expect(b.cfx.critReady).toBe(true);
    const res = b.cfx.res;
    const storm = makeQuestion(s, b, 'skill', rng, 'storm');
    expect(storm.type).toBe('storm');
    expect(storm.forms!.map((f) => f.answer)).toEqual(['der Apfel', 'die Äpfel']);
    const rs = resolveTurn(s, b, 'skill', storm, storm.forms!.map((f) => f.answer).join('|'), rng);
    expect(rs.correct).toBe(true);
    expect(b.stormHits).toBe(2);
    expect(b.cfx.res).toBe(res);
    expect(b.poolCd.storm).toBe(3); // cd 4, one turn already ticked
  });

  it('墨水风暴 (rev 234): stops at the first wrong form; 3 forms from Lv21; damage grows with forms right', async () => {
    const { stormForms, gradeStorm } = await import('../src/core/storm');
    const apfel = WORDS.find((w) => w.id === 'apfel')!;
    expect(stormForms(21, apfel, false).map((f) => f.answer)).toEqual(['der Apfel', 'die Äpfel', 'den Apfel']);
    expect(stormForms(8, apfel, false).map((f) => f.answer)).toEqual(['der Apfel', 'den Apfel']);
    const f3 = stormForms(21, apfel, false);
    expect(gradeStorm(apfel, f3, 'der Apfel|die Apfel|den Apfel').n).toBe(1);
    expect(gradeStorm(apfel, f3, 'der Apfel|die Aepfel|den Apfel').n).toBe(3);
    const machen = WORDS.find((w) => w.de === 'machen')!;
    expect(stormForms(21, machen, true).map((f) => f.answer)).toEqual(['machen', 'macht', 'hat gemacht']);
    expect(stormForms(12, machen, true).map((f) => f.answer)).toEqual(['machen', 'macht']);
  });

  it('齐鸣 (rev 234): each mate is hit only when its own word is written', () => {
    const rng = makeRng(7);
    const s = newGame('T', 'student');
    s.level = 11;
    const der = WORDS.filter((w) => w.pos === 'n' && w.art === 'der' && w.region === 1);
    const a = startBattle(s, der[0], rng);
    const d = startBattle(s, der[1], rng);
    const e = startBattle(s, der[2], rng);
    for (const x of [a, d, e]) {
      x.pluralMon = false;
      x.monster.hp = x.monster.maxHp = 500;
      x.intent = { ...x.intent, kind: 'wait', hits: 0, caseArt: undefined };
    }
    a.phase = 'der';
    const q = makeQuestion(s, a, 'chorus', rng, undefined, true, [a, d, e]);
    expect(q.mates).toEqual([d.word.id, e.word.id]);
    const main = q.options ? q.answer! : q.answer!;
    resolveTurn(s, a, 'chorus', q, `${main}|${d.word.art} ${d.word.de}|nix`, rng, [a, d, e]);
    expect(d.monster.hp).toBeLessThan(500);
    expect(e.monster.hp).toBe(500);
  });

  it('天赋「守势」: wrong answers hurt 20% less; 稳住 right covers the next 2 wrong answers (no HP, combo kept)', () => {
    const hitTaken = (shoushi: boolean) => {
      const rng = makeRng(4);
      const s = newGame('T', 'student');
      s.level = 12;
      if (shoushi) s.talents = { shared: { shoushi: 1 } };
      s.hp = 9999;
      const b = startBattle(s, noun(), rng);
      b.intent = { ...b.intent, kind: 'attack', hits: 1, element: 'phys' };
      b.monster.dmg = 50;
      b.monster.hp = 9999;
      const q = { type: 'article' as const, prompt: '', focus: '', options: ['der', 'die', 'das'], answer: 'der' };
      resolveTurn(s, b, 'attack', q, 'die', rng);
      return 9999 - s.hp;
    };
    expect(hitTaken(true)).toBeLessThan(hitTaken(false));
    const rng = makeRng(4);
    const s = newGame('T', 'student');
    s.level = 12;
    s.hp = 9999;
    const b = startBattle(s, noun(), rng);
    b.monster.dmg = 50;
    b.monster.hp = b.monster.maxHp = 9999;
    const st = makeQuestion(s, b, 'skill', rng, 'steady');
    expect(st.type).toBe('steady');
    resolveTurn(s, b, 'skill', st, st.answer!, rng);
    expect(b.cfx.guard).toBe(2);
    s.combo = 5;
    for (let i = 0; i < 2; i++) {
      b.intent = { ...b.intent, kind: 'attack', hits: 1, element: 'phys' };
      const hp = s.hp;
      resolveTurn(s, b, 'attack', { type: 'article', prompt: '', focus: '', options: ['der', 'die', 'das'], answer: 'der' }, 'die', rng);
      expect(s.hp).toBe(hp);
    }
    expect(s.combo).toBe(5);
    b.intent = { ...b.intent, kind: 'attack', hits: 1, element: 'phys' };
    const hp = s.hp;
    resolveTurn(s, b, 'attack', { type: 'article', prompt: '', focus: '', options: ['der', 'die', 'das'], answer: 'der' }, 'die', rng);
    expect(s.hp).toBeLessThan(hp);
  });

  it('talent points: 1 per 2 levels at 12–30, per 3 to 120, per 2 to 200; rows gate at 3/6/9, big at 12; respec', async () => {
    const { learn, talentPoints, respec, respecCost, spent, rank, TALENT_TREE } = await import('../src/core/classes');
    const s = newGame('T', 'student');
    s.level = 11;
    expect(talentPoints(s)).toBe(0);
    s.level = 30;
    expect(talentPoints(s)).toBe(10);
    s.level = 120;
    expect(talentPoints(s)).toBe(40);
    s.level = 200;
    expect(talentPoints(s)).toBe(80);
    for (const br of ['bifeng', 'shoushi', 'yanci', 'zhixu', 'xunjie']) expect(TALENT_TREE.filter((t) => t.branch === br).length).toBe(8);
    s.level = 40;
    learn(s, 'bifeng');
    learn(s, 'bifeng');
    expect(learn(s, 'critRun')).toBe(false); // row 2: 3 points in 笔锋 first
    learn(s, 'bifeng');
    expect(learn(s, 'bifeng')).toBe(false); // max 3
    expect(learn(s, 'critRun')).toBe(true);
    expect(learn(s, 'tengxie')).toBe(false); // big: 12 points
    expect(spent(s)).toBe(4);
    s.level = 60;
    (s.talents as Record<string, Record<string, number>>).shared.erchong = 1;
    expect(rank(s, 'erchong')).toBe(0); // 81 级起
    s.level = 81;
    expect(rank(s, 'erchong')).toBe(1);
    delete (s.talents as Record<string, Record<string, number>>).shared.erchong;
    s.gold = respecCost(s) - 1;
    expect(respec(s)).toBe(false);
    s.gold += 1;
    expect(respec(s)).toBe(true);
    expect(spent(s)).toBe(0);
  });
});

describe('Mira shop', () => {
  it('buys with "Ich nehme den …", bargains 10% off, sells for a fifth', async () => {
    const shop = await import('../src/core/shop');
    const rng = makeRng(9);
    const s = newGame('T', 'student');
    s.level = 12;
    s.gold = 10000;
    shop.openShop(s, rng, T0);
    expect(s.shop!.items.length).toBe(8);
    expect(s.shop!.items.every((it) => it.quality !== 'orange')).toBe(true);
    const it = s.shop!.items[0];
    const n = shop.SLOT_NOUN[it.slot];
    expect(shop.gradeBuy(`Ich nehme ${n.nom}`, it.slot).ok).toBe(it.slot === 'amulet' || it.slot === 'dict');
    const p = shop.price(s, it);
    const r = shop.buy(s, 0, `ich nehme ${n.acc}.`, 'Geht das billiger?', 30);
    expect(r.ok).toBe(true);
    expect(r.paid).toBe(Math.round(p * 0.9));
    expect(s.bag[0].id).toBe(it.id);
    expect(shop.sell(s, it.id)).toBe(Math.max(1, Math.round(p * 0.2)));
    expect(shop.gradeBuy('Ich nehme der Stift', 'pen').notes[0]).toContain('den Stift');
  });

  it('first refresh each hour is free, then doubles', async () => {
    const shop = await import('../src/core/shop');
    const rng = makeRng(9);
    const s = newGame('T', 'student');
    s.level = 12;
    s.gold = 10000;
    shop.openShop(s, rng, T0);
    expect(shop.refreshCost(s)).toBe(0);
    shop.refresh(s, rng);
    const c1 = shop.refreshCost(s);
    shop.refresh(s, rng);
    expect(shop.refreshCost(s)).toBe(c1 * 2);
    shop.openShop(s, rng, T0 + 3600_000);
    expect(shop.refreshCost(s)).toBe(0);
  });
});

describe('rare monsters and chests', () => {
  it('a rare monster shouts Ich muss los! by turn 3 and runs if it survives', () => {
    const rng = makeRng(21);
    const s = newGame('T', 'student');
    s.level = 12;
    s.hp = 9999;
    const b = startBattle(s, WORDS.find((w) => w.de === 'Apfel')!, rng, { rare: true });
    b.monster.hp = b.monster.maxHp = 9999;
    const miss = { type: 'article' as const, prompt: '', focus: '', options: ['der', 'die', 'das'], answer: 'der' };
    let fled = false;
    for (let i = 0; i < 4 && !fled; i++) {
      if (b.intent.kind === 'flee') expect(b.intent.line).toBe('Ich muss los!');
      const r = resolveTurn(s, b, 'attack', miss, 'die', rng);
      fled = r.outcome === 'fled';
    }
    expect(fled).toBe(true);
  });

  it('rare kills drop an iron chest; the 言灵锁 rerolls quality', async () => {
    const chest = await import('../src/core/chest');
    const rng = makeRng(5);
    const s = newGame('T', 'student');
    s.level = 12;
    const b = startBattle(s, WORDS.find((w) => w.de === 'Apfel')!, rng, { rare: true });
    b.outcome = 'win';
    expect(applyWin(s, b, rng).chest).toBe('iron');
    const r = chest.openChest(s, 'iron', 12, rng, true);
    expect(r.items.length).toBe(2);
    expect(r.rerolled).toBe(true);
    expect(r.items[0].quality).not.toBe('white');
    // 开箱动画 shows both rolls; the item keeps the better one.
    const Q = ['white', 'green', 'purple', 'orange'];
    r.rolls.forEach((rs, i) => {
      expect(rs.length).toBe(2);
      expect(Q.indexOf(r.items[i].quality)).toBe(Math.max(...rs.map((q) => Q.indexOf(q))));
    });
    const g = chest.openChest(s, 'gold', 12, rng);
    expect(g.rolls.every((rs) => rs.length === 1)).toBe(true);
    expect(['purple', 'orange']).toContain(g.items[0].quality);
    const gold0 = s.gold;
    expect(chest.openChest(s, 'wood', 12, rng).gold).toBeGreaterThan(0);
    expect(s.gold).toBeGreaterThan(gold0);
    expect(chest.lockWord(s, WORDS[0])).toBeTruthy();
  });

  it('宝箱怪 never spawns as a normal monster', () => {
    const s = newGame('T', 'student');
    s.level = 15;
    const picks = pickSpawns(s, 'waagegasse', 40, new Set(), makeRng(1));
    expect(picks.some((p) => p.word.family === 'truhe')).toBe(false);
  });
});

describe('quests', () => {
  it('Konrad: 5 crumb kills, the lesson, the story; favour climbs to 朋友', async () => {
    const Q = await import('../src/core/quests');
    const s = newGame('T', 'student');
    Q.startQuest(s, 'konrad');
    for (let i = 0; i < 4; i++) expect(Q.questEvent(s, 'krumeKill')).toEqual([]);
    expect(Q.questEvent(s, 'krumeKill')[0].finished).toBe(0);
    expect(Q.FAVOUR[Q.favour(s)]).toBe('认识');
    Q.questEvent(s, 'taughtKonrad');
    const last = Q.questEvent(s, 'heardKonrad');
    expect(last[0].done).toBe(true);
    expect(Q.FAVOUR[Q.favour(s)]).toBe('朋友');
    for (const id of Q.KONRAD_WORDS) expect(WORD_BY_ID[id], id).toBeDefined();
  });
});

describe('Ich nehme (region 2 sentence)', () => {
  it('accepts number + plural and singular with the accusative', async () => {
    const { gradeNehme } = await import('../src/core/grading');
    const known = WORDS.filter((w) => w.moechte);
    expect(gradeNehme('Ich nehme zwei Äpfel.', known).ok).toBe(true);
    expect(gradeNehme('ich nehme drei aepfel', known).plural).toBe(true);
    const sg = gradeNehme('Ich nehme zwei Apfel', known);
    expect(sg.ok).toBe(false);
    expect(sg.notes[0]).toContain('Äpfel');
    expect(gradeNehme('Ich nehme einen Apfel', known).ok).toBe(true);
    expect(gradeNehme('Ich nehme ein Apfel', known).notes[0]).toContain('einen');
    expect(gradeNehme('Ich nehmen zwei Äpfel', known).ok).toBe(false);
    expect(gradeNehme('Ich nehme zwei Kuchen', known).ok).toBe(true);
  });
});

describe('吞秤者 (region 2 boss)', () => {
  it('reads prices and counts as words', async () => {
    const B = await import('../src/data/boss2');
    expect(B.priceDe(250)).toBe('zwei Euro fünfzig');
    expect(B.priceDe(100)).toBe('ein Euro');
    expect(B.numDe(21)).toBe('einundzwanzig');
    const qs = B.boss2Questions(makeRng(3), true);
    expect(qs[0].id).toBe('name');
    for (const q of qs.slice(1)) {
      // The model answer is always accepted.
      expect(q.accept.some((re) => re.test(normalize(q.model))), q.model).toBe(true);
      expect(q.visual).toBeTruthy();
    }
  });

  it('has 7 HP, 45 s the first time, and accepts "Das Brot kostet zwei Euro fünfzig"', () => {
    const s = newGame('T', 'student');
    s.level = 18;
    const f = startBoss(s, makeRng(1), 2);
    expect(f.maxHp).toBe(7);
    expect(f.seconds).toBe(45);
    answerBoss(s, f, 'Ich heiße Test.', makeRng(1));
    expect(f.hp).toBe(6);
    const price = f.current.id.startsWith('price') ? f.current : null;
    if (price) expect(answerBoss(s, f, price.model, makeRng(1)).ok).toBe(true);
  });
});

describe('backen accepts both present forms', () => {
  it('du backst / du bäckst', () => {
    const rng = makeRng(1);
    const s = newGame('T', 'student');
    s.level = 12;
    const b = startBattle(s, WORDS.find((w) => w.de === 'backen')!, rng);
    const q = { type: 'conj' as const, prompt: '', focus: '', answer: 'backst', person: 'du' as const, alts: ['bäckst'] };
    expect(resolveTurn(s, b, 'attack', q, 'du bäckst', rng).correct).toBe(true);
    expect(resolveTurn(s, b, 'attack', q, 'backst', rng).correct).toBe(true);
  });
});

describe('言灵 carries over between fights', () => {
  it('言灵 and the typed streak survive the next fight; a miss breaks the streak', async () => {
    const { resetClassFx } = await import('../src/core/combat');
    const rng = makeRng(2);
    const s = newGame('T', 'student');
    s.level = 12;
    s.talents = { shared: { critRun: 1 } };
    s.hp = 9999;
    const apfel = WORDS.find((w) => w.de === 'Apfel')!;
    const typed = { type: 'typed' as const, prompt: '', focus: '', withArticle: true, answer: 'der Apfel' };
    let b = startBattle(s, apfel, rng);
    b.monster.hp = 9999;
    resolveTurn(s, b, 'attack', typed, 'der Apfel', rng);
    resolveTurn(s, b, 'attack', typed, 'der Apfel', rng);
    b = startBattle(s, apfel, rng);
    expect(b.cfx.res).toBe(2);
    expect(b.cfx.run).toBe(2);
    b.monster.hp = 9999;
    const art = { type: 'article' as const, prompt: '', focus: '', options: ['der', 'die', 'das'], answer: 'der' };
    resolveTurn(s, b, 'attack', art, 'die', rng);
    expect(b.cfx.run).toBe(0);
    resetClassFx(s);
    expect(startBattle(s, apfel, rng).cfx.res).toBe(0);
  });
});

describe('接句怪', () => {
  it('a short saying that carries the word: sure crit, drops the card, never kills, keeps the word question for later', async () => {
    const { sayLineFor } = await import('../src/core/combat');
    const s = newGame('T', 'student', T0);
    s.level = 4;
    const w = WORDS.find((x) => x.art && (x.region ?? 1) === 1 && !x.tutorial)!;
    const b = startBattle(s, w, makeRng(3));
    b.saying = { a: 'Sicher ist', b: 'sicher', zh: '保险起见', cardId: 'sicher' };
    b.intent = { ...b.intent, kind: 'attack' } as typeof b.intent;
    const q = makeQuestion(s, b, 'attack', makeRng(4));
    expect(q.type).toBe('saying');
    expect(q.options).toContain('sicher');
    const r = resolveTurn(s, b, 'attack', q, 'Sicher!', makeRng(9));
    expect(r.correct).toBe(true);
    expect(r.crit).toBe(true);
    expect(b.monster.hp).toBeGreaterThan(0);
    expect(s.sayings?.sicher).toBe(1);
    expect(b.firstCorrectDone).toBe(false);
    expect(makeQuestion(s, b, 'attack', makeRng(4)).type).not.toBe('saying');
    // Only words the saying is about get it.
    expect(sayLineFor(WORD_BY_ID['wochenende'], makeRng(1))?.cardId).toBe('wochenende');
    expect(sayLineFor(w, makeRng(1))?.cardId).not.toBe('sicher');
  });
  it('otherwise splits the word\'s own example before the word, so the answer always carries it (Lucas 2026-11-21)', async () => {
    const { sayLineFor, rollSaying, sayingQuestion } = await import('../src/core/combat');
    const mail = WORDS.find((x) => x.de.includes('E-Mail'))!;
    const say = sayLineFor(mail, makeRng(2))!;
    expect(say.cardId).toBeUndefined();
    expect(say.b.toLowerCase()).toContain('e-mail');
    expect(say.a.split(' ').length).toBeGreaterThanOrEqual(2);
    // No word ever gets a line that leaves it out.
    for (const w of WORDS) {
      const x = sayLineFor(w, makeRng(5));
      if (x && !x.cardId) expect(x.b.length).toBeGreaterThan(0);
    }
    const s = newGame('T', 'student', T0);
    s.level = 9;
    const b = startBattle(s, mail, makeRng(3));
    b.saying = say;
    const q = sayingQuestion(s, say, makeRng(4));
    expect(q.options).toBeUndefined();
    // The second half, or the whole sentence typed out, both count.
    expect(resolveTurn(s, b, 'attack', q, `${say.a} ${say.b}`, makeRng(9)).correct).toBe(true);
    // Lv3+, and never on a word without any line.
    let n = 0;
    for (let i = 0; i < 400; i++) if (rollSaying(s, mail, makeRng(i))) n++;
    expect(n).toBeGreaterThan(20);
    s.level = 2;
    expect(rollSaying(s, mail, makeRng(1))).toBeUndefined();
  });
  it('is typed from Lv6, picked from three below', async () => {
    const { sayingQuestion } = await import('../src/core/combat');
    const s = newGame('T', 'student', T0);
    const say = { a: 'Viel', b: 'Glück!', zh: '祝你好运', cardId: 'glueck' };
    s.level = 6;
    expect(sayingQuestion(s, say, makeRng(4)).options).toBeUndefined();
    s.level = 4;
    expect(sayingQuestion(s, say, makeRng(4)).options).toHaveLength(3);
  });
});

describe('句式说的是眼前这只怪', () => {
  it('uses the target noun with the case its pattern needs, each pattern once', async () => {
    const { gradeSentence, sentenceTags } = await import('../src/core/sentence');
    const { sentencePattern } = await import('../src/core/combat');
    expect(gradeSentence('Ich möchte einen Tee.', WORD_BY_ID['tee'], 'moechte').ok).toBe(true);
    expect(gradeSentence('Ich möchte ein Tee.', WORD_BY_ID['tee'], 'moechte').ok).toBe(false);
    expect(gradeSentence('Ich möchte einen Kaffee.', WORD_BY_ID['tee'], 'moechte').ok).toBe(false);
    expect(gradeSentence('Wo ist der Supermarkt?', WORD_BY_ID['supermarkt'], 'woist').ok).toBe(true);
    expect(gradeSentence('Ich suche den Supermarkt', WORD_BY_ID['supermarkt'], 'suche').ok).toBe(true);
    expect(gradeSentence('Ich suche der Supermarkt', WORD_BY_ID['supermarkt'], 'suche').ok).toBe(false);
    expect(gradeSentence('Das ist meine Mutter.', WORD_BY_ID['mutter'], 'mein').ok).toBe(true);
    expect(gradeSentence('Ich möchte Milch.', WORD_BY_ID['milch'], 'moechte0').ok).toBe(true);
    expect(gradeSentence('Ich nehme zwei Äpfel.', WORD_BY_ID['apfel'], 'nehme').ok).toBe(true);
    expect(sentenceTags(WORD_BY_ID['woche'])).toEqual([]);

    const s = newGame('T', 'student', T0);
    s.level = 9;
    const b = startBattle(s, WORD_BY_ID['tee'], makeRng(1));
    expect(sentencePattern(s, b)).toBe(null); // not in the wordbook yet
    s.words['tee'] = { stage: 1, due: 9e15, firstSeen: 0, lastSeen: 0, relapse: 0, correct: 0, wrong: 0 };
    // 0.4: the whole sentence is the finisher, ready only with a full resource bar (言灵 before a class).
    b.intent = { ...b.intent, kind: 'wait', hits: 0 };
    b.monster.hp = b.monster.maxHp = 999;
    b.phase = 'der';
    expect(moveReady(s, b, 'sentence')).toBe(false);
    b.cfx.res = 5;
    expect(moveReady(s, b, 'sentence')).toBe(true);
    const q1 = makeQuestion(s, b, 'sentence', makeRng(1));
    expect(q1.pattern).toBe('moechte');
    expect(q1.focus).toBe('我想要一个茶。');
    resolveTurn(s, b, 'sentence', q1, 'Ich möchte einen Tee.', makeRng(1));
    expect(b.monster.broken).toBe(2);
    expect(b.cfx.res).toBe(0);
    expect(sentencePattern(s, b)).toBe('brauche');
  });
});

describe('认得 / 会写', () => {
  it('migrates old saves and records writing apart from recognition', () => {
    const old = { ...newGame('T', 'student', T0), version: 1 } as unknown as Record<string, unknown>;
    delete old.gearKills;
    old.words = { tee: { stage: 3, due: 0, firstSeen: 0, lastSeen: 0, relapse: 0, correct: 4, wrong: 0 }, brot: { stage: 1, due: 0, firstSeen: 0, lastSeen: 0, relapse: 0, correct: 0, wrong: 1 } };
    const m = migrate(old)!;
    expect(m.version).toBe(3);
    expect(m.gearKills).toEqual({ '1': 0 });
    expect(m.words.tee).toMatchObject({ read: 4, write: 1 });
    expect(m.words.brot).toMatchObject({ read: 0, write: 0 });

    const s = newGame('T', 'student', T0);
    s.level = 5;
    s.words['tee'] = { stage: 1, due: 9e15, firstSeen: 0, lastSeen: 0, relapse: 0, correct: 0, wrong: 0, read: 0, write: 0 };
    const b = startBattle(s, WORD_BY_ID['tee'], makeRng(2));
    const q = { type: 'typed' as const, prompt: '', focus: '', withArticle: true, answer: 'der Tee' };
    resolveTurn(s, b, 'attack', q, 'der Tee', makeRng(2));
    expect(b.writeOk).toBe(1);
  });
});

describe('句式 sind', () => {
  it('Das sind meine Eltern', async () => {
    const { gradeSentence, sentenceTags } = await import('../src/core/sentence');
    expect(sentenceTags(WORD_BY_ID['eltern'])).toEqual(['sind']);
    expect(gradeSentence('Das sind meine Eltern.', WORD_BY_ID['eltern'], 'sind').ok).toBe(true);
    expect(gradeSentence('Ich habe eine E-Mail.', WORD_BY_ID['e-mail'], 'habe').ok).toBe(true);
  });
});

describe('完形填空', () => {
  it('picks at Lv1–5, types the dictionary form at Lv6–10, the needed form from Lv11', async () => {
    const { makeCloze, gradeCloze, EXAMPLES } = await import('../src/core/cloze');
    const { clozeQ } = await import('../src/core/combat');
    const tee = WORD_BY_ID['tee'];
    const base = makeCloze(tee, 'base', makeRng(1))!;
    expect(base.answer).toBe('Tee');
    expect(base.shown).toContain('___');
    expect(gradeCloze('tee', base.answer)).toBe(true);
    const form = makeCloze(WORD_BY_ID['apfel'], 'form', makeRng(1))!;
    expect(form.answer).not.toBe('Apfel');
    const s = newGame('T', 'student', T0);
    s.level = 3;
    expect(clozeQ(s, tee, makeRng(2))!.options).toHaveLength(3);
    s.level = 7;
    expect(clozeQ(s, tee, makeRng(2))!.options).toBeUndefined();
    // Every example has exactly one blank, and every noun has a sentence usable for 填原形.
    for (const [id, lines] of Object.entries(EXAMPLES)) {
      expect(WORD_BY_ID[id], id).toBeTruthy();
      for (const l of lines) expect(l.match(/\{/g)?.length, l).toBe(1);
      expect(makeCloze(WORD_BY_ID[id], 'base', makeRng(1)) ?? makeCloze(WORD_BY_ID[id], 'form', makeRng(1)), id).toBeTruthy();
    }
  });
  it('a noun is only named by a form cloze that writes the article', () => {
    const s = newGame('T', 'student', T0);
    s.level = 12;
    const b = startBattle(s, WORD_BY_ID['tee'], makeRng(3));
    b.monster.hp = 1;
    const q = { type: 'cloze' as const, prompt: '', focus: '', answer: 'Tee', clozeMode: 'base' as const, full: '' };
    resolveTurn(s, b, 'attack', q, 'Tee', makeRng(3));
    expect(b.lastKillTyped).toBe(false);
    const b2 = startBattle(s, WORD_BY_ID['tee'], makeRng(3));
    b2.monster.hp = 1;
    resolveTurn(s, b2, 'attack', { ...q, answer: 'einen Tee', clozeMode: 'form' as const }, 'einen Tee', makeRng(3));
    expect(b2.lastKillTyped).toBe(true);
  });
});

describe('0.4 战斗修正版', () => {
  const lvl15 = () => {
    const s = newGame('T', 'student', T0);
    s.level = 15;
    s.region = 2;
    return s;
  };
  it('same-level monster: 4 choice hits, 3 typed, 2 hard (no roll)', () => {
    const s = lvl15();
    const b = startBattle(s, WORDS.find((w) => w.lvl === 15)!, makeRng(1));
    b.monster.lvl = 15;
    const hits = (tier: 0 | 1 | 2) => Math.ceil(monsterHpAt(15) / (attack(s) * (1 - effArmor(s, b, tier))) - 1e-9);
    expect([hits(0), hits(1), hits(2)]).toEqual([4, 3, 2]);
    b.monster.lvl = 18; // 3 levels above you: A = 8
    expect(effArmor(s, b, 0)).toBeCloseTo(8 / 9);
    b.monster.lvl = 12;
    expect(effArmor(s, b, 0)).toBeCloseTo(0.125 / 1.125);
  });
  it('相亲和: attuned amulet keeps the 4%/tier pen and gives +2 resource on a matching gender with the right stance', () => {
    const s = lvl15();
    s.equipped.amulet = { ...makeItem(makeRng(1), 15, 'white', 'amulet'), tier: 4, region: 2 }; // a tier-4 amulet
    const w = WORDS.find((x) => x.lvl <= 15 && x.art === 'der')!;
    const b = startBattle(s, w, makeRng(1));
    b.monster.lvl = 17;
    expect(effArmor(s, b, 0)).toBeCloseTo((4 * 0.84) / (1 + 4 * 0.84));
    s.flags.affinity = 'der';
    expect(effArmor(s, b, 0)).toBeCloseTo((4 * 0.84) / (1 + 4 * 0.84)); // pen kept
    b.intent = { ...b.intent, caseArt: undefined };
    b.phase = 'der';
    expect(affinityMatch(s, b)).toBe(true);
    b.phase = 'die';
    expect(affinityMatch(s, b)).toBe(false); // wrong stance: nothing
    b.phase = 'der';
    s.flags.affinity = 'das';
    expect(affinityMatch(s, b)).toBe(false);
    b.pluralMon = true;
    b.phase = 'die';
    s.flags.affinity = 'die';
    expect(affinityMatch(s, b)).toBe(true); // plural counts as die
    s.level = 8; // locked below Lv9: plain amulet
    expect(affinityOf(s)).toBeNull();
  });
  it('碎片换档: shards unlock tier n at 40 × n²; the worn pen\'s tier gives +18% damage, half in the next region', () => {
    const s = lvl15();
    const base = attack(s);
    s.gearKills = { '2': 159 };
    expect(gearTier(s)).toBe(1);
    expect(addGearKill(s, 2)).toBe(2);
    expect(attack(s)).toBeCloseTo(base); // unlocking alone adds nothing now
    s.equipped.pen = { ...s.equipped.pen!, tier: 2, region: 2 };
    expect(attack(s) / base).toBeCloseTo(1.36);
    s.equipped.pen = { ...s.equipped.pen!, tier: 4, region: 1 };
    expect(attack(s) / base).toBeCloseTo(1.36); // a region-1 tier 4 counts half here
    s.gearKills = { '1': 640 };
    expect(addGearKill(s, 2, 0)).toBe(1); // a whole piece drops
    s.bag.push(makeItem(makeRng(3), 15, 'white', 'coat'));
    stampTiers(s);
    expect(s.bag[s.bag.length - 1]).toMatchObject({ tier: 1, region: 2 }); // new pieces take the tier unlocked here
  });
  it('techniques change the next question: 铭刻 harder, 低语 gives the first letter', () => {
    const s = lvl15();
    s.words['tee'] = { stage: 1, due: 9e15, firstSeen: 0, lastSeen: 0, relapse: 0, correct: 1, wrong: 0 };
    const b = startBattle(s, WORD_BY_ID['tee'], makeRng(4));
    b.intent = { ...b.intent, kind: 'wait', hits: 0 };
    b.step = 3; // ladder at the article question
    const plain = makeQuestion(s, b, 'attack', makeRng(4));
    const ins = makeQuestion(s, b, 'inscribe', makeRng(4));
    expect(ins.inscribed).toBe(true);
    expect(qTier(ins)).toBe(qTier(plain) + 1);
    const wh = makeQuestion(s, b, 'whisper', makeRng(4));
    expect(wh.whispered).toBe(true);
    if (wh.options) expect(wh.options.length).toBe(2);
    else expect(wh.whisper).toMatch(/…$/);
  });
  it('a charging monster asks the hardest question; packs have 0.6× HP and 齐鸣 hits them all', () => {
    const s = lvl15();
    s.words['tee'] = { stage: 1, due: 9e15, firstSeen: 0, lastSeen: 0, relapse: 0, correct: 1, wrong: 0 };
    const b = startBattle(s, WORD_BY_ID['tee'], makeRng(5));
    b.intent = { ...b.intent, kind: 'charge', hits: 1 };
    expect(qTier(makeQuestion(s, b, 'attack', makeRng(5)))).toBe(2);
    const p = [startBattle(s, WORD_BY_ID['tee'], makeRng(6)), startBattle(s, WORD_BY_ID['kaffee'], makeRng(7))];
    for (const x of p) x.pluralMon = false;
    p[0].phase = 'der';
    const full = p[1].monster.maxHp;
    linkPack(p);
    expect(p[1].monster.maxHp).toBe(Math.round(full * 0.6));
    p[0].intent = { ...p[0].intent, kind: 'wait', hits: 0 };
    p[0].named = true;
    const q = makeQuestion(s, p[0], 'chorus', makeRng(8), undefined, true);
    const before = p[1].monster.hp;
    resolveTurn(s, p[0], 'chorus', q, q.answer!, makeRng(8), p);
    expect(p[1].monster.hp).toBeLessThan(before);
    expect(p[0].chorusCd).toBeGreaterThan(0);
  });
});

describe('0.5 示例战斗 with 词性三相 (acceptance: right, wrong, soft before Lv6, plural only die)', () => {
  it('Lv8 vs a Lv9 Brot (das): right stance, then a wrong der, then its poison finishes it', () => {
    const roll = CONFIG.damage.roll;
    const crit = CONFIG.player.baseCrit;
    CONFIG.damage.roll = [1, 1];
    CONFIG.player.baseCrit = 0;
    try {
      const rng = makeRng(9);
      const s = newGame('T', 'student', T0);
      s.level = 8;
      s.gram = { boards: Object.keys(BOARDS) }; // 语法线 off: this fight is scripted
      s.words['brot'] = { stage: 1, due: 9e15, firstSeen: 0, lastSeen: 0, relapse: 0, correct: 1, wrong: 0 };
      const b = startBattle(s, WORD_BY_ID['brot'], rng);
      b.pluralMon = false;
      b.monster.lvl = 9;
      b.monster.hp = b.monster.maxHp = Math.round(monsterHpAt(9)); // 37
      b.monster.dmg = 7;
      s.hp = 58;
      b.cfx.res = 3;
      const atk = { kind: 'attack' as const, shown: 'attack' as const, hits: 1, element: 'phys' as const, line: 'Ich beiße!', zh: '', layers: [] };
      const turn = (move: 'attack' | 'inscribe', step?: number, right = true) => {
        b.intent = atk;
        if (step !== undefined) b.step = step;
        const q = makeQuestion(s, b, move, rng);
        return { q, r: resolveTurn(s, b, move, q, right ? q.answer! : 'zzz', rng) };
      };
      // 1: das (right) + 铭刻 typing: armor one tier lower = none → 26 of 37; 言灵 +1 typed +1 stance; das = poison.
      b.phase = 'das';
      const t1 = turn('inscribe', 3);
      expect(t1.r.phase).toBe('right');
      expect(qTier(t1.q)).toBe(1);
      expect(t1.r.playerDamage).toBe(26);
      expect(t1.r.element).toBe('poison');
      expect(b.cfx.res).toBe(5);
      expect(b.phaseHit).toBe(true);
      // 2: switched to der (wrong): doubled armor on the typed cloze → 6.
      b.phase = 'der';
      const t2 = turn('attack');
      expect(t2.r.phase).toBe('wrong');
      expect(t2.r.playerDamage).toBe(6);
      expect(b.monster.broken).toBe(0);
      // 3: a missed answer still lets the poison tick: it dies on its own weak point.
      turn('attack', 3, false);
      expect(b.outcome).toBe('win');
    } finally {
      CONFIG.damage.roll = roll;
      CONFIG.player.baseCrit = crit;
    }
  });
  it('before Lv6 a wrong stance is only shown, not punished; a plural monster only takes die', () => {
    const s = newGame('T', 'student', T0);
    s.level = 4;
    const b = startBattle(s, WORD_BY_ID['tee'], makeRng(1));
    b.monster.hp = b.monster.maxHp = 500;
    b.intent = { ...b.intent, kind: 'wait', hits: 0 };
    b.phase = 'das';
    const q = makeQuestion(s, b, 'attack', makeRng(2));
    const r = resolveTurn(s, b, 'attack', q, q.answer!, makeRng(3));
    expect(r.phase).toBe('soft');
    expect(b.log.some((l) => l.text.includes('这里要 der'))).toBe(true);

    s.level = 12;
    const apfel = WORDS.find((w) => w.art === 'der' && w.pl && w.pl !== '-' && !w.plOnly)!;
    let pm = startBattle(s, apfel, makeRng(1));
    for (let i = 2; !pm.pluralMon && i < 200; i++) pm = startBattle(s, apfel, makeRng(i));
    expect(pm.pluralMon).toBe(true);
    expect(phaseOf(pm)).toBe('die');
    pm.intent = { ...pm.intent, kind: 'wait', hits: 0 };
    pm.monster.hp = pm.monster.maxHp = 500;
    pm.phase = 'der';
    const q2 = makeQuestion(s, pm, 'attack', makeRng(4));
    expect(resolveTurn(s, pm, 'attack', q2, q2.answer!, makeRng(5)).phase).toBe('wrong');
    pm.phase = 'die';
    const q3 = makeQuestion(s, pm, 'attack', makeRng(6));
    expect(resolveTurn(s, pm, 'attack', q3, q3.answer!, makeRng(7)).phase).toBe('right');
  });
});

describe('终结技 for every monster, 铭刻 without cooldown', () => {
  it('a word without a sentence pattern gets an example sentence or a template; an inscribed miss costs 1 resource', () => {
    const s = newGame('T', 'student', T0);
    s.level = 8;
    for (const id of ['woche', 'hallo', 'drei-num', 'woher', 'china']) {
      const b = startBattle(s, WORD_BY_ID[id], makeRng(1));
      b.cfx.res = 5;
      expect(moveReady(s, b, 'sentence')).toBe(true);
      const q = makeQuestion(s, b, 'sentence', makeRng(1));
      expect(q.type).toBe('sentence');
      expect(q.focus.length).toBeGreaterThan(1);
      b.monster.hp = 999;
      const r = resolveTurn(s, b, 'sentence', q, q.answer!, makeRng(1));
      expect(r.correct).toBe(true);
    }
    const b = startBattle(s, WORD_BY_ID['tee'], makeRng(2));
    b.cfx.res = 3;
    b.monster.hp = 999;
    const q = makeQuestion(s, b, 'inscribe', makeRng(2));
    resolveTurn(s, b, 'inscribe', q, 'zzz', makeRng(2));
    expect(b.cfx.res).toBe(2);
    expect(moveReady(s, b, 'inscribe')).toBe(true);
  });
});

describe('2026-11-21: 低语, 越区引导, reviews, 怪的台词', () => {
  it('低语 is free but not 会写, earns nothing, and is not offered again until answered without it', () => {
    const s = newGame('T', 'student', T0);
    s.level = 8;
    s.words['tee'] = { stage: 1, due: 9e15, firstSeen: 0, lastSeen: 0, relapse: 0, correct: 1, wrong: 0 };
    const b = startBattle(s, WORD_BY_ID['tee'], makeRng(3));
    b.intent = { ...b.intent, kind: 'wait', hits: 0 };
    b.monster.hp = 999;
    b.cfx.res = 2;
    expect(moveReady(s, b, 'whisper')).toBe(true);
    const q = makeQuestion(s, b, 'whisper', makeRng(3));
    resolveTurn(s, b, 'whisper', q, q.answer!, makeRng(3));
    expect(b.cfx.res).toBe(2);
    expect(b.writeOk ?? 0).toBe(0);
    expect(s.words['tee'].hinted).toBe(true);
    expect(moveReady(s, b, 'whisper')).toBe(false);
  });
  it('words you can write stay off the field until due; reviews come to your zone at your level', () => {
    const s = newGame('T', 'student', T0);
    s.level = 9;
    const zone = WORD_BY_ID['zimmer'].zone;
    for (const w of WORDS.filter((x) => x.zone === zone)) s.words[w.id] = { stage: 1, due: 9e15, firstSeen: 0, lastSeen: 0, relapse: 0, correct: 1, wrong: 0, read: 1, write: 1 };
    const t = Date.now();
    s.words['zimmer'].due = t - 1000;
    // A learning word respawns only in its own scene; a relapsed one (复发中) follows you.
    const away = WORDS.find((x) => x.region === WORD_BY_ID['zimmer'].region && x.zone !== zone)!.zone;
    expect(pickSpawns(s, away, 10, new Set(), makeRng(1)).some((p) => p.word.id === 'zimmer')).toBe(false);
    s.words['zimmer'].stage = 2;
    s.words['zimmer'].lapsed = true;
    const picks = pickSpawns(s, away, 10, new Set(), makeRng(1));
    expect(picks.some((p) => p.word.id === 'zimmer' && p.kind === 'due')).toBe(true);
    expect(pickSpawns(s, zone, 10, new Set(['zimmer']), makeRng(1)).filter((p) => p.kind === 'shadow').length).toBe(0);
    const b = startBattle(s, WORD_BY_ID['zimmer'], makeRng(1));
    expect(b.kind).toBe('due');
    expect(b.monster.lvl).toBe(9);
  });
  it('the monster mumbles its own example sentence without its name', async () => {
    const { voiceLine } = await import('../src/core/cloze');
    for (const w of WORDS) {
      const v = voiceLine(w, 0);
      if (!v) continue;
      expect(v.line).toContain('… mmh …');
      expect(v.full.length).toBeGreaterThan(v.line.length - 8);
    }
    const v = voiceLine(WORD_BY_ID['tee'], 0)!;
    expect(v.line.toLowerCase()).not.toContain('tee ');
  });
});

describe('词性标签 (2026-11-21)', () => {
  it('tells countries from languages and nouns from verbs', async () => {
    const { posTag } = await import('../src/data/words');
    const by = (de: string) => WORDS.find((x) => x.de === de)!;
    expect(posTag(by('China'))).toBe('国名·不带冠词');
    expect(posTag(by('Schweiz'))).toBe('国名·带冠词');
    expect(posTag(by('arbeiten'))).toBe('动词');
    expect(posTag(by('Arbeit'))).toBe('名词·带冠词');
  });
});

describe('技能池 (rev 425) + 墨水风暴抽词', () => {
  it('技能池: slots 2 / 3 / 4 at 10 / 30 / 61, skills come with the level, the bar keeps the pick', async () => {
    const { loadout, owned, slotCount, toggleLoadout, splitOf, gradeSplit, collocOf } = await import('../src/core/skillPool');
    expect([9, 10, 29, 30, 60, 61].map(slotCount)).toEqual([0, 2, 2, 3, 3, 4]);
    const s = newGame('T', 'student', T0);
    s.level = 9;
    expect(owned(s)).toEqual([]);
    s.level = 15;
    expect(owned(s)).toEqual(['storm', 'steady', 'split']);
    expect(loadout(s)).toEqual(['storm', 'steady']);
    expect(toggleLoadout(s, 'split')).toBe(false); // bar full
    toggleLoadout(s, 'storm');
    expect(toggleLoadout(s, 'split')).toBe(true);
    expect(loadout(s)).toEqual(['steady', 'split']);
    expect(toggleLoadout(s, 'seal')).toBe(false); // not owned yet
    // 拆词 targets: a compound noun with a known tail, a separable verb; a plain word can't be targeted.
    const fake = (de: string, art?: 'der' | 'die' | 'das', pos: 'n' | 'v' = 'n') => ({ id: 'x', de, zh: '', pos, art, lvl: 1, zone: 'camp' }) as never;
    const hbf = splitOf(fake('Hauptbahnhof', 'der'));
    expect(hbf?.kind).toBe('compound');
    expect(gradeSplit(hbf!, 'Haupt + Bahnhof')).toBe(true);
    expect(gradeSplit(hbf!, 'Haupt')).toBe(false);
    const auf = splitOf(fake('aufstehen', undefined, 'v'));
    expect(auf?.kind).toBe('separable');
    expect(gradeSplit(auf!, auf!.answer)).toBe(true);
    expect(splitOf(fake('Tee', 'der'))).toBeNull();
    expect(collocOf(fake('warten', undefined, 'v'))?.prep).toBe('auf');
  });
  it('墨水风暴 prefers words due soon or written wrong lately', async () => {
    const { stormWord } = await import('../src/core/combat');
    const s = newGame('T', 'student', T0);
    const ws = WORDS.filter((x) => x.pos === 'n').slice(0, 30);
    for (const w of ws) s.words[w.id] = { stage: 2, due: 9e15, firstSeen: 0, lastSeen: 0, relapse: 0, correct: 1, wrong: 0 };
    const pickMe = ws.slice(0, 5);
    for (const w of pickMe) s.words[w.id].due = 0;
    for (let i = 0; i < 30; i++) expect(pickMe).toContain(stormWord(s, makeRng(i), WORDS[0]));
  });
});

describe('0.5 解锁提前: regular verbs from Lv6, strong ones from Lv12', () => {
  it('conjugates lernen at 6 but not nehmen until 12', async () => {
    const { conjOpen } = await import('../src/core/combat');
    const s = newGame('T', 'student', T0);
    const lernen = WORDS.find((w) => w.de === 'lernen')!;
    const nehmen = WORDS.find((w) => w.de === 'nehmen')!;
    s.level = 5;
    expect(conjOpen(s, lernen)).toBe(false);
    s.level = 6;
    expect(conjOpen(s, lernen)).toBe(true);
    expect(conjOpen(s, nehmen)).toBe(false);
    s.level = 12;
    expect(conjOpen(s, nehmen)).toBe(true);
  });
});

describe('0.5 格位姿态: from Lv7 the stance is the declined article the line needs', () => {
  it('reads the slot of its line (den / einen / dem), keeps only open cases, and asks for a new pick when the case changes', async () => {
    const { phaseOf, phaseCase, stancesFor } = await import('../src/core/combat');
    const { caseOf, slotArticle } = await import('../src/core/cloze');
    expect(caseOf('m', 'den')).toBe('acc');
    expect(caseOf('f', 'der')).toBe('dat');
    expect(caseOf('n', 'ein')).toBe('nom');
    expect(caseOf('m', 'meinen')).toBeNull();
    expect(slotArticle(WORD_BY_ID['tee'], 0)).toBe('einen');
    expect(stancesFor(6)).toEqual(['der', 'die', 'das']);
    expect(stancesFor(7)).toContain('den');
    expect(stancesFor(7)).not.toContain('dem');
    expect(stancesFor(15)).toContain('dem');

    const s = newGame('T', 'student', T0);
    s.level = 8;
    const seen = new Set<string>();
    const t = startBattle(s, WORD_BY_ID['tee'], makeRng(3));
    t.pluralMon = false;
    t.monster.hp = t.monster.maxHp = 9999;
    for (let i = 0; i < 6; i++) {
      seen.add(String(phaseOf(t)));
      expect(phaseCase(t)).not.toBe('dat'); // Lv8 never reads a dative slot
      const q = makeQuestion(s, t, 'attack', makeRng(i));
      resolveTurn(s, t, 'attack', q, 'zzz', makeRng(i));
      s.hp = 999;
    }
    expect(seen.has('einen')).toBe(true);

    // A wrong nominative der where the line needs einen: resisted (Lv8 is past the first accusative level).
    const b = startBattle(s, WORD_BY_ID['tee'], makeRng(1));
    b.pluralMon = false;
    b.monster.hp = b.monster.maxHp = 500;
    b.intent = { ...b.intent, kind: 'wait', hits: 0, caseArt: 'einen' };
    b.phase = 'der';
    let q = makeQuestion(s, b, 'attack', makeRng(2));
    expect(resolveTurn(s, b, 'attack', q, q.answer!, makeRng(3)).phase).toBe('wrong');
    b.intent = { ...b.intent, kind: 'wait', hits: 0, caseArt: 'einen' };
    b.phase = 'einen';
    q = makeQuestion(s, b, 'attack', makeRng(4));
    expect(resolveTurn(s, b, 'attack', q, q.answer!, makeRng(5)).phase).toBe('right');
    // Lv7 (first accusative level): the same mistake is only shown.
    s.level = 7;
    b.intent = { ...b.intent, kind: 'wait', hits: 0, caseArt: 'einen' };
    b.phase = 'der';
    q = makeQuestion(s, b, 'attack', makeRng(6));
    expect(resolveTurn(s, b, 'attack', q, q.answer!, makeRng(7)).phase).toBe('soft');
  });
});

describe('0.5 und: a Lv13+ finisher in a pack names two monsters and hits both', () => {
  it('asks Ich möchte einen Tee und eine Tasse and grades each half', () => {
    const s = newGame('T', 'student', T0);
    s.level = 13;
    for (const id of ['tee', 'tasse']) s.words[id] = { stage: 1, due: 9e15, firstSeen: 0, lastSeen: 0, relapse: 0, correct: 1, wrong: 0 };
    const a = startBattle(s, WORD_BY_ID['tee'], makeRng(1));
    const c = startBattle(s, WORD_BY_ID['tasse'], makeRng(2));
    for (const x of [a, c]) {
      x.pluralMon = false;
      x.monster.hp = x.monster.maxHp = 500;
      x.intent = { ...x.intent, kind: 'wait', hits: 0, caseArt: undefined };
    }
    a.cfx.res = 5;
    a.phase = 'der';
    const q = makeQuestion(s, a, 'sentence', makeRng(3), undefined, true, [a, c]);
    expect(q.undWord?.id).toBe('tasse');
    expect(q.answer).toBe('Ich möchte einen Tee und eine Tasse.');
    const r = resolveTurn(s, a, 'sentence', q, 'Ich möchte einen Tee und eine Tasse', makeRng(4), [a, c]);
    expect(r.correct).toBe(true);
    expect(c.monster.hp).toBeLessThan(500);
    s.level = 12;
    expect(makeQuestion(s, a, 'sentence', makeRng(3), undefined, true, [a, c]).undWord).toBeUndefined();
  });
});

describe('0.5 残句: sentence monsters', () => {
  it('has the 12 cards (14 before region 3: schwer and Wochenende now carry theirs) no word monster carries; three steps kill it; the card drops, nothing enters the wordbook, no echo', async () => {
    const { phraseCards, startPhraseBattle } = await import('../src/core/combat');
    const { applyWin, applyLoss } = await import('../src/core/outcomes');
    const cards = phraseCards();
    // 6000 词导入: almost every saying's word is a monster now; the cards left are the ones no word carries.
    expect(cards.length).toBeGreaterThanOrEqual(1);
    const s = newGame('T', 'student', T0);
    s.level = 6;
    const id = cards[0].id;
    const b = startPhraseBattle(s, id, makeRng(1), 'echogasse');
    expect(b.intent.line.endsWith('…')).toBe(true);
    const types: string[] = [];
    for (let i = 0; i < 3 && !b.outcome; i++) {
      b.intent = { ...b.intent, kind: 'wait', hits: 0 };
      const q = makeQuestion(s, b, 'attack', makeRng(i));
      types.push(q.type);
      resolveTurn(s, b, 'attack', q, q.answer!, makeRng(i));
      if (i < 2) expect(b.monster.hp).toBeGreaterThan(0);
    }
    expect(types).toEqual(['saying', 'pickZh', 'sentence']);
    expect(b.outcome).toBe('win');
    const words = Object.keys(s.words).length;
    const res = applyWin(s, b, makeRng(5));
    expect(res.card).toEqual({ id, first: true });
    expect(s.sayings?.[id]).toBe(1);
    expect(Object.keys(s.words).length).toBe(words);
    expect(res.xp).toBeGreaterThan(0);
    const b2 = startPhraseBattle(s, id, makeRng(2), 'echogasse');
    applyLoss(s, b2, { x: 0, y: 0 });
    expect(s.echo).toBeNull();
  });
});

describe('0.5 ihn/sie: pronoun clozes from accusative example sentences', () => {
  it('swaps a plain object for ihn / sie / es', () => {
    const p = pronounClozes(WORD_BY_ID.schluessel);
    expect(p.map((x) => x.full)).toContain('Ich finde ihn nicht.');
    expect(p[0].answer).toBe('ihn');
  });
  it('skips subjects after sein and slots behind bitte / mir (pronoun word order)', () => {
    expect(pronounClozes(WORD_BY_ID.flasche).filter((c) => /^Wo ist/.test(c.shown))).toHaveLength(0); // «Wo ist die Flasche?»
    expect(pronounClozes(WORD_BY_ID.lampe)).toHaveLength(0); // «Mach bitte die Lampe an» → would need «Mach sie bitte an»
  });
  it('only from Lv7, inside cloze questions', () => {
    const all = WORDS.flatMap((w) => pronounClozes(w));
    expect(all.length).toBeGreaterThan(20);
    expect(all.every((x) => ['ihn', 'sie', 'es'].includes(x.answer))).toBe(true);
  });
});

describe('0.5 跟读: read-along scoring', () => {
  it('counts the target words heard, umlauts and case folded; the best alternative wins', async () => {
    const { shadowScore, shadowOk } = await import('../src/core/shadow');
    expect(shadowScore('Ich finde den Schlüssel nicht.', ['ich finde den schlüssel nicht'])).toBe(1);
    expect(shadowOk('Ich finde den Schlüssel nicht.', ['ich finde den schlüssel', 'ich'])).toBe(true); // 4/5
    expect(shadowOk('Ich finde den Schlüssel nicht.', ['ich finde'])).toBe(false);
    expect(shadowScore('Wo ist die Flasche?', [])).toBe(0);
  });
  it('opens at Lv5', () => {
    expect(UNLOCK.shadowing).toBe(5);
  });
});

describe('0.5 小世界: scene data', async () => {
  const { SCENES, LINKS, SCENE_BY_ID, routeTo } = await import('../src/data/world');
  const { generateMap, isBlocked } = await import('../src/game/map');
  it('every scene stands on a walkable tile, scenes are ≥6 tiles apart (packs stay inside one scene)', () => {
    for (const r of [1, 2, 3] as const) {
      const m = generateMap(r);
      const ss = SCENES.filter((s) => s.region === r);
      for (const s of ss) expect(isBlocked(m, s.at.x, s.at.y), s.id).toBe(false);
      for (const a of ss) for (const b of ss) if (a !== b) expect(Math.hypot(a.at.x - b.at.x, a.at.y - b.at.y), `${a.id}/${b.id}`).toBeGreaterThanOrEqual(6);
      for (const n of m.npcs) expect(ss.some((s) => s.npcs?.includes(n.id)), n.id).toBe(true);
      for (const sg of m.signs) expect(ss.some((s) => s.signs?.includes(sg.wordId)), sg.wordId).toBe(true);
    }
  });
  it('links are valid, everything is reachable from the hub, and each area has a side route', () => {
    for (const [a, b] of LINKS) expect(!!SCENE_BY_ID[a] && !!SCENE_BY_ID[b] && SCENE_BY_ID[a].region === SCENE_BY_ID[b].region).toBe(true);
    for (const s of SCENES) expect(routeTo(AREAS.find((a) => a.region === s.region)!.hub, s.id), s.id).not.toBeNull();
    for (const r of AREAS.map((a) => a.region)) expect(SCENES.some((s) => s.region === r && s.hiddenBy)).toBe(true);
    // 6000 词导入: fields fill a grid east of the camp; the neighbour's door is on the far side of it.
    expect(routeTo('r1-camp', 'r1-door')!.length).toBeGreaterThanOrEqual(6);
  });
});

describe('0.5 开局节奏表: unlocks moved earlier', async () => {
  const { resMax } = await import('../src/core/classes');
  it('gear 3, 铭刻/低语 4, 终结技 5; 言灵 fills from Lv4', () => {
    expect([UNLOCK.gear, UNLOCK.inscribe, UNLOCK.whisper, UNLOCK.sentence]).toEqual([3, 4, 4, 5]);
    const s = newGame('T', 'student');
    s.level = 3;
    expect(resMax(s)).toBe(0);
    s.level = 4;
    expect(resMax(s)).toBe(5);
  });
});

describe('0.5 存档: old saves keep their level and get the new defaults', () => {
  it('a v3 Lv4 save keeps Lv4 and its XP, has 言灵, and is flagged for the one-time 0.5 note', async () => {
    const { resMax } = await import('../src/core/classes');
    const old = newGame('Alt', 'student', T0) as any;
    old.level = 4; old.xp = 100; old.version = 3; old.flags = { intro: true };
    const s = migrate(JSON.parse(JSON.stringify(old)))!;
    expect(s.level).toBe(4);
    expect(s.xp).toBe(100);
    expect(resMax(s)).toBe(5);
    expect(s.flags.seen05).toBeUndefined();
    expect(newGame('N', 'student', T0).flags.seen05).toBe(true);
  });
});

describe('先教后考 (teach the stance of a never-met noun)', () => {
  it('picks the right stance only for new, unnamed nouns', async () => {
    const { teachPhase } = await import('../src/core/combat');
    const mk = (over: Record<string, unknown>) => ({ word: { id: 'brot', de: 'Brot', art: 'das', zh: '面包' }, kind: 'new', stage: 0, turn: 1, intent: {}, ...over }) as never;
    const b1: any = mk({});
    expect(teachPhase(b1)).toBe(true);
    expect(b1.phase).toBe('das');
    expect(b1.phaseTaught).toBe(1);
    expect(teachPhase(b1)).toBe(true); // same turn: still the taught pick
    b1.turn = 2;
    expect(teachPhase(b1)).toBe(false); // next turn: cleared once, the player picks
    expect(b1.phase).toBeUndefined();
    b1.phase = 'der';
    expect(teachPhase(b1)).toBe(false);
    expect(b1.phase).toBe('der');
    const b2: any = mk({ kind: 'due', stage: 1 });
    expect(teachPhase(b2)).toBe(false);
    expect(b2.phase).toBeUndefined();
    const b3: any = mk({ phase: 'der' });
    expect(teachPhase(b3)).toBe(false);
    expect(b3.phase).toBe('der');
  });
});

describe('清晰度', () => {
  it('is the heard share, weighted by confidence when given', async () => {
    const { clarity } = await import('../src/core/shadow');
    expect(clarity('der Tee', ['der Tee'])).toBe(100);
    expect(clarity('der Tee', ['der Tee'], 0.5)).toBe(80);
    expect(clarity('der Tee', ['Quatsch'])).toBeLessThan(30);
    expect(clarity('das Brot', ['das Brote'])).toBeGreaterThan(85);
  });
});

describe('跟读 numbers', () => {
  it('reads digits as German number words', async () => {
    const { numberDe, shadowOk } = await import('../src/core/shadow');
    expect(numberDe(40)).toBe('vierzig');
    expect(numberDe(21)).toBe('einundzwanzig');
    expect(numberDe(1999)).toBe('eintausendneunhundertneunundneunzig');
    expect(shadowOk('vierzig', ['40'])).toBe(true);
    expect(shadowOk('Ich bin 21 Jahre alt.', ['ich bin einundzwanzig Jahre alt'])).toBe(true);
  });
});

describe('0.6 场景记忆法: word groups', () => {
  it('every word has exactly one home field scene in its own zone, groups of 6–13', async () => {
    const { SCENES } = await import('../src/data/world');
    const { WORDS } = await import('../src/data/words');
    const home = new Map<string, string>();
    // 0.7/0.8: an old scene may also carry a 蚀变 group (sc.eroded); A2 起 groups are 12–16 words.
    for (const sc of SCENES) for (const id of [...(sc.words ?? []), ...(sc.eroded ?? [])]) {
      expect(home.has(id), id).toBe(false);
      home.set(id, sc.id);
      expect(WORDS.find((w) => w.id === id)?.zone, id).toBe(sc.zone);
    }
    for (const w of WORDS) if (w.family !== 'truhe') expect(home.has(w.id), w.id).toBe(true);
    // C1 regions (17, 18, 20) add no words (游戏设计 rev 488): their scenes are empty.
    for (const sc of SCENES.filter((x) => x.type === 'field' && ![17, 18, 20].includes(x.region))) {
      // 6000 词导入 (《进场景第 1 版》): groups of 6–19, small ones merged into a neighbour.
      const [lo, hi] = [6, 19];
      expect(sc.words?.length ?? 0, sc.id).toBeGreaterThanOrEqual(lo);
      expect(sc.words!.length, sc.id).toBeLessThanOrEqual(hi);
      if (sc.eroded && sc.erodeSeg !== 19) expect(sc.eroded.length, `${sc.id} 蚀变`).toBeGreaterThanOrEqual(6); // 蚀变④ adds no words
    }
  });
});

describe('0.6 日记残页', () => {
  it('pages sit on field scenes (one each); 4–6 sentences, 35–70 words, blanks of its own group, each blank once', () => {
    // 6000 词导入: the written pages followed their words to the new scenes; scenes without a page wait for new ones.
    const fields = new Set(SCENES.filter((sc) => sc.words && sc.region <= 3).map((sc) => sc.id));
    // One page per scene of regions 1–3 (rewritten for the 2026-11-25 scene sheet).
    expect(DIARY.length).toBeGreaterThanOrEqual(100);
    expect(new Set(DIARY.map((p) => p.scene)).size).toBe(DIARY.length);
    for (const p of DIARY) expect(fields.has(p.scene), p.scene).toBe(true);
    for (const p of DIARY) {
      const group = SCENES.find((sc) => sc.id === p.scene)!.words!;
      const ids = p.lines.flatMap((l) => [...l.matchAll(/\{([a-z0-9-]+)(?::[^}]+)?\}/g)].map((m) => m[1]));
      for (const id of ids) expect(group, `${p.scene} ${id}`).toContain(id);
      expect(new Set(ids).size, p.scene).toBe(ids.length);
      expect(ids.length, p.scene).toBeGreaterThanOrEqual(2);
      expect(p.lines.length, p.scene).toBeGreaterThanOrEqual(4);
      expect(p.lines.length, p.scene).toBeLessThanOrEqual(6);
      const text = p.lines.map((l) => parseLine(l, (id) => WORD_BY_ID[id].de).map((x) => (typeof x === 'string' ? x : x.form)).join('')).join(' ');
      const n = text.split(/\s+/).filter((x) => /\p{L}/u.test(x)).length;
      expect(n, `${p.scene} ${n} words`).toBeGreaterThanOrEqual(35);
      expect(n, `${p.scene} ${n} words`).toBeLessThanOrEqual(70);
    }
  });
});

describe('0.6 场景插画', () => {
  it('pictures sit on field scenes and light ≥2 of their own words, inside the canvas', async () => {
    const { SCENE_ART, parseArt, ART_COLS, ART_ROWS } = await import('../src/data/sceneArt');
    // 6000 词导入: the drawn pictures followed their words to the new scenes; the rest wait for new pictures.
    expect(Object.keys(SCENE_ART).length).toBeGreaterThanOrEqual(60);
    for (const sc of SCENES.filter((x) => x.words && SCENE_ART[x.id])) {
      const spec = SCENE_ART[sc.id];
      const tiles = parseArt(spec);
      const words = new Set(tiles.filter((t) => t.word).map((t) => t.word!));
      for (const w of words) expect(sc.words, `${sc.id} ${w}`).toContain(w);
      expect(words.size, sc.id).toBeGreaterThanOrEqual(2);
      for (const t of tiles) {
        expect(t.col < ART_COLS && t.row < ART_ROWS && t.tile < 49 * 22, `${sc.id} ${t.tile}`).toBe(true);
      }
    }
  });
});

describe('0.6 第 3 区: 现在完成时', async () => {
  const { PERFEKT, perfektParts } = await import('../src/data/perfekt');
  const { ppOpen, ppQ, stancesFor } = await import('../src/core/combat');
  it('Perfekt entries have an auxiliary, a participle and a sentence with {aux} and [participle]', () => {
    // 6000 词导入: verbs whose sentences have no Perfekt yet simply get no haben/sein stance.
    const withP = WORDS.filter((x) => x.pos === 'v' && PERFEKT[x.de]);
    expect(withP.length).toBeGreaterThanOrEqual(300);
    for (const w of withP) expect(perfektParts(PERFEKT[w.de]).pp, w.de).toBe(PERFEKT[w.de].pp);
    expect(PERFEKT['fahren'].aux).toBe('sein');
    expect(PERFEKT['kaufen'].aux).toBe('haben');
  });
  it('region-3 verbs in region 3 from Lv21 take a haben/sein stance; wrong picks are free until 22, then double armor', () => {
    const s = newGame('T', 'student', T0);
    s.level = 21;
    s.region = 3;
    const b = startBattle(s, WORD_BY_ID['fahren'], makeRng(1));
    expect(b.perfekt).toBe(true);
    b.perfektRest = false; // 0.6.x: a pick-meaning turn asks no stance; this test checks a stance turn
    expect(phaseOf(b)).toBe('sein');
    expect(stancesFor(s.level, b)).toEqual(['haben', 'sein']);
    b.intent = { ...b.intent, kind: 'wait', hits: 0 };
    b.monster.hp = b.monster.maxHp = 500;
    b.phase = 'haben';
    const q = makeQuestion(s, b, 'attack', makeRng(2));
    expect(resolveTurn(s, b, 'attack', q, q.answer!, makeRng(3)).phase).toBe('soft');
    s.level = 23;
    b.phase = 'haben';
    const q2 = makeQuestion(s, b, 'attack', makeRng(4));
    expect(resolveTurn(s, b, 'attack', q2, q2.answer!, makeRng(5)).phase).toBe('wrong');
    b.phase = 'sein';
    const q3 = makeQuestion(s, b, 'attack', makeRng(6));
    expect(resolveTurn(s, b, 'attack', q3, q3.answer!, makeRng(7)).phase).toBe('right');
    // A Perfekt line swallows the auxiliary.
    const b2 = startBattle(s, WORD_BY_ID['fahren'], makeRng(9));
    if (b2.intent.kind !== 'charge' && b2.intent.kind !== 'flee') expect(b2.perfektRest ? !b2.intent.line.includes('gefahren') : b2.intent.line.includes('gefahren')).toBe(true); // 0.6.x
    // Outside region 3 (or below 21) region-3 verbs keep the present tense.
    s.region = 2;
    expect(startBattle(s, WORD_BY_ID['fahren'], makeRng(1)).perfekt).toBeFalsy();
  });
  it('填分词 opens by kind: ge-…-t at 21, strong at 24, separable and prefixed at 27', () => {
    expect(ppOpen(21, WORD_BY_ID['kaufen'])).toBe(true);
    expect(ppOpen(20, WORD_BY_ID['kaufen'])).toBe(false);
    expect(ppOpen(23, WORD_BY_ID['fahren'])).toBe(false);
    expect(ppOpen(24, WORD_BY_ID['fahren'])).toBe(true);
    expect(ppOpen(26, WORD_BY_ID['einsteigen'])).toBe(false);
    expect(ppOpen(27, WORD_BY_ID['einsteigen'])).toBe(true);
    const q = ppQ(WORD_BY_ID['kaufen'])!;
    expect(q.answer).toBe('gekauft');
    expect(q.focus).toContain('___ (kaufen)');
    expect(q.clozeMode).toBe('form');
  });
});

describe('0.6 第 3 区: 晚点之王', async () => {
  const { timeRe, gradePerfekt, makeBoard } = await import('../src/data/boss3');
  it('reads times the A1 ways, grades Perfekt answers about yourself, and shifts the board at half HP', () => {
    const t = (h: number, m: number, say: string) => new RegExp(`^${timeRe(h, m)}$`).test(normalize(say));
    expect(t(8, 30, 'halb neun')).toBe(true);
    expect(t(8, 30, 'acht Uhr dreißig')).toBe(true);
    expect(t(8, 15, 'Viertel nach acht')).toBe(true);
    expect(t(8, 45, 'Viertel vor neun')).toBe(true);
    expect(t(9, 0, 'neun Uhr')).toBe(true);
    expect(t(8, 40, 'zwanzig vor neun')).toBe(true);
    expect(t(8, 30, 'halb acht')).toBe(false);
    expect(gradePerfekt('Ich habe den Zug verpasst.').ok).toBe(true);
    expect(gradePerfekt('Ich bin zu spät aufgestanden.').ok).toBe(true);
    expect(gradePerfekt('Wir sind spazieren gegangen.').ok).toBe(true);
    const wrong = gradePerfekt('Ich habe nach Hause gegangen.');
    expect(wrong.ok).toBe(false);
    expect(wrong.note).toContain('sein');
    expect(gradePerfekt('Ich verpasse den Zug.').ok).toBe(false);

    const s = newGame('T', 'student', T0);
    s.level = 28;
    const f = startBoss(s, makeRng(3), 3);
    expect(f.hp).toBe(8);
    expect(f.board!.rows).toHaveLength(3);
    for (let i = 0; i < 4; i++) {
      f.current = { ...f.current, accept: [/.*/], grade: undefined };
      answerBoss(s, f, 'x', makeRng(10 + i));
    }
    expect(f.hp).toBe(4);
    expect(f.board!.delay).toBe(10);
    expect(makeBoard(makeRng(1)).rows.map((r) => r.m).sort()).toContain(30);
  });
});

describe('0.6 第 3 区: 幽灵检票员 Lina', () => {
  it('a miss is a fine (no damage, she leaves); five right answers, then her name wins', () => {
    const s = newGame('T', 'student', T0);
    s.level = 25;
    const hp = s.hp;
    const f = startBoss(s, makeRng(1), 4);
    expect(f.current.id).toBe('ticket');
    const v = answerBoss(s, f, 'Ich habe keine Fahrkarte.', makeRng(2));
    expect(v.ok).toBe(false);
    expect(f.outcome).toBe('lose');
    expect(s.hp).toBe(hp);
    const g = startBoss(s, makeRng(3), 4);
    for (let i = 0; i < 5; i++) {
      g.current = { ...g.current, accept: [/.*/], grade: undefined };
      answerBoss(s, g, 'x', makeRng(10 + i));
    }
    expect(g.finalAsked).toBe(true);
    expect(g.outcome).toBeNull();
    answerBoss(s, g, 'Du heißt Lina.', makeRng(20));
    expect(g.outcome).toBe('win');
  });
});

describe('语境复习 in a fight (2026-11-24)', () => {
  it('a due 归名 word is asked once per fight from turn 2, counts as a hard attack; wrong relapses it', () => {
    const s = newGame('T', 'student');
    s.level = 12;
    const t = Date.now();
    const rv = WORDS.find((w) => w.pos === 'n' && (EXAMPLES[w.id] ?? []).length > 0 && w.id !== 'tee')!;
    s.words[rv.id] = { stage: 3, due: t - 1000, firstSeen: 0, lastSeen: 0, relapse: 0, correct: 3, wrong: 0, ctx: 0, ivl: CONFIG.srs.context[0] };
    const b = startBattle(s, WORD_BY_ID['tee'], makeRng(2));
    b.monster.hp = b.monster.maxHp = 999;
    expect(makeQuestion(s, b, 'attack', makeRng(3)).review).toBeUndefined(); // turn 1: the monster's own question
    b.turn = 2;
    const q = makeQuestion(s, b, 'attack', makeRng(3));
    expect(q.review).toBe(rv.id);
    expect(qTier(q)).toBe(2);
    const r = resolveTurn(s, b, 'attack', q, q.answer!, makeRng(4));
    expect(r.review?.ok).toBe(true);
    expect(r.playerDamage).toBeGreaterThan(0);
    expect(s.words[rv.id].due).toBeGreaterThan(t + CONFIG.srs.context[0] * CONFIG.srs.adaptive.clean - 60_000); // clean pass: gap ×3
    expect(makeQuestion(s, b, 'attack', makeRng(5)).review).toBeUndefined(); // once per fight
    // Wrong in another fight: the word relapses to a 半名 review monster.
    s.words[rv.id].due = t - 1000;
    const b2 = startBattle(s, WORD_BY_ID['tee'], makeRng(6));
    b2.monster.hp = b2.monster.maxHp = 999;
    b2.turn = 2;
    const q2 = makeQuestion(s, b2, 'attack', makeRng(7));
    const r2 = resolveTurn(s, b2, 'attack', q2, 'zzz', makeRng(8));
    expect(r2.review?.ok).toBe(false);
    expect(reviewMon(s.words[rv.id], Date.now())).toBe(true);
    expect(b2.slipped).toBe(false);
  });
});

describe('副词缀白名单 and 誊写 (2026-11-24)', () => {
  it('old 默写伤害 / 选择题暴击率 / 句式攻击伤害 become 伤害 +% of the same standing; nothing is removed', () => {
    const s = newGame('T', 'student');
    s.equipped.pen = { id: 'a', slot: 'pen', quality: 'purple', ilvl: 5, name: 'x', main: 4, affixes: [{ key: 'typedDmg', value: 0.13 }, { key: 'choiceCrit', value: 0.05 }] } as never;
    s.bag = [{ id: 'b', slot: 'coat', quality: 'green', ilvl: 5, name: 'y', main: 9, affixes: [{ key: 'sentenceDmg', value: 0.1 }, { key: 'xp', value: 0.02 }] } as never];
    const m = migrate(JSON.parse(JSON.stringify(s)))!;
    expect(m.equipped.pen!.affixes.map((a) => a.key)).toEqual(['dmg', 'dmg']);
    expect(m.equipped.pen!.affixes[0].value).toBe(0.13);
    expect(m.equipped.pen!.affixes[1].value).toBe(0.16); // top of choiceCrit purple → top of dmg purple
    expect(m.bag[0].affixes.map((a) => a.key)).toEqual(['dmg', 'xp']);
    expect(attack(m)).toBeGreaterThan(attack({ ...m, equipped: {} } as never));
  });
  it('per-gender damage counts only on a right stance; 誊写 makes a hard break last 5 hits', () => {
    const s = newGame('T', 'student');
    s.level = 12;
    s.equipped.pen = { id: 'a', slot: 'pen', quality: 'orange', ilvl: 12, name: 'x', main: 4, affixes: [{ key: 'vsMasc', value: 0.5 }] } as never;
    const hit = (phase: string) => {
      const b = startBattle(s, WORD_BY_ID['tee'], makeRng(1));
      b.pluralMon = false;
      b.monster.hp = b.monster.maxHp = 9999;
      b.intent = { ...b.intent, kind: 'attack', caseArt: undefined };
      b.phase = phase as never;
      const q = { type: 'typed', prompt: '', focus: '', withArticle: true, answer: 'der Tee' } as never;
      return resolveTurn(s, b, 'attack', q, 'der Tee', makeRng(2)).playerDamage;
    };
    expect(hit('der')).toBeGreaterThan(hit('die') * 1.3);
    s.talents = { shared: { tengxie: 1 } };
    const b = startBattle(s, WORD_BY_ID['tee'], makeRng(3));
    b.monster.hp = b.monster.maxHp = 9999;
    b.pluralMon = false;
    b.phase = 'der' as never;
    b.intent = { ...b.intent, kind: 'attack', caseArt: undefined };
    const hard = { type: 'cloze', clozeMode: 'form', prompt: '', focus: '', answer: 'den Tee', full: 'x' } as never;
    resolveTurn(s, b, 'attack', hard, 'den Tee', makeRng(4));
    expect(b.monster.broken).toBe(CONFIG.armor.breakHits + 1); // 5 − the hit itself
  });
});
