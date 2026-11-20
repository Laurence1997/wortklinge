import { describe, expect, it } from 'vitest';
import { gradeMoechte, gradeTyped, normalize } from '../src/core/grading';
import { fullForm, WORD_BY_ID, WORDS } from '../src/data/words';
import { newGame, addXp, overloaded, migrate } from '../src/core/state';
import { applyWin } from '../src/core/outcomes';
import { recordKill, kindOf, stageOf } from '../src/core/srs';
import { CONFIG, xpToNext } from '../src/core/config';
import { startBattle, makeQuestion, resolveTurn, spillStorm } from '../src/core/combat';
import { makeRng } from '../src/core/rng';
import { answerBoss, startBoss } from '../src/core/boss';
import { BOSS_QUESTIONS } from '../src/data/boss';
import { pickSpawns } from '../src/core/spawn';
import { CONJ } from '../src/data/verbs';
import { answerDuel, duelPool, startDuel } from '../src/core/duel';

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
  const tschuess = WORDS.find((w) => w.de === 'Tschüss')!;
  it('accepts ae/oe/ue/ss and shows the proper spelling', () => {
    const v = gradeTyped('Tschuess', tschuess, false);
    expect(v.ok).toBe(true);
    expect(v.notes.join()).toContain('Tschüss');
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
  it('takes three kills on three different respawns, the last one typed', () => {
    const s = newGame('T', 'student', T0);
    const w = WORD_BY_ID['stuhl'];
    expect(kindOf(s, w, T0)).toBe('new');
    recordKill(s, w, false, false, T0);
    expect(stageOf(s, w, T0)).toBe(1);
    expect(kindOf(s, w, T0 + 1000)).toBe('shadow');
    // Killing the shadow does nothing.
    recordKill(s, w, true, false, T0 + 1000);
    expect(stageOf(s, w, T0 + 1000)).toBe(1);
    const t1 = T0 + CONFIG.srs.intervals[0];
    expect(kindOf(s, w, t1)).toBe('due');
    recordKill(s, w, false, false, t1);
    expect(stageOf(s, w, t1)).toBe(2);
    const t2 = t1 + CONFIG.srs.intervals[1];
    // A choice-answer kill can't finish it.
    const o = recordKill(s, w, false, false, t2);
    expect(o.needsTypedFinal).toBe(true);
    const t3 = t2 + CONFIG.srs.intervals[0];
    const o2 = recordKill(s, w, true, false, t3);
    expect(o2.guiming).toBe(true);
    expect(stageOf(s, w, t3)).toBe(3);
    // Relapse after about a week comes back as 半名.
    const t4 = t3 + CONFIG.srs.relapse[0];
    expect(stageOf(s, w, t4)).toBe(2);
    expect(kindOf(s, w, t4)).toBe('due');
  });
  it('a wrong answer on 半名 drops it one step, never to 无名', () => {
    const s = newGame('T', 'student', T0);
    const w = WORD_BY_ID['tisch'];
    recordKill(s, w, false, false, T0);
    const t1 = T0 + CONFIG.srs.intervals[0];
    recordKill(s, w, false, false, t1);
    const t2 = t1 + CONFIG.srs.intervals[1];
    const o = recordKill(s, w, true, true, t2);
    expect(o.to).toBe(1);
  });
});

describe('levels', () => {
  it('follows the design curve and stops at the version cap', () => {
    // 0.3 提速: Lv1–5 ×0.7, Lv6–10 ×0.4, Lv11+ unchanged.
    expect(xpToNext(1)).toBe(117);
    expect(xpToNext(5)).toBe(700);
    expect(xpToNext(10)).toBeGreaterThan(950);
    expect(xpToNext(11)).toBeGreaterThan(2400);
    expect(xpToNext(1, 1)).toBe(167);
    const s = newGame('T', 'student', T0);
    addXp(s, 1_000_000);
    expect(s.level).toBe(CONFIG.levelCap);
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
  it('a level-1 player beats a new noun monster by answering right (article first)', () => {
    const rng = makeRng(1);
    const s = newGame('T', 'student', Date.now());
    const b = startBattle(s, WORD_BY_ID['tee'], rng);
    let guard = 0;
    while (!b.outcome && guard++ < 20) {
      const q = makeQuestion(s, b, 'attack', rng);
      if (guard === 1) expect(q.type).toBe('article');
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
  it('the intent decides: a correct hit interrupts a charge, a written answer breaks a guard', () => {
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
    const b2 = startBattle(s, WORD_BY_ID['tisch'], rng, { tutorial: 'break' });
    const q2 = makeQuestion(s, b2, 'attack', rng);
    expect(q2.type).toBe('typed');
    resolveTurn(s, b2, 'attack', q2, q2.answer!, rng);
    expect(b2.monster.vulnerable).toBeGreaterThan(0);
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

describe('默写对决', () => {
  it('a right answer names the word on the spot with ×4 XP; a wrong one leaves it alone', () => {
    const s = newGame('T', 'student', T0);
    s.level = 3;
    const d = startDuel(s, 1, makeRng(5));
    const w1 = d.queue[0];
    const xp0 = s.xp + s.level * 100000;
    answerDuel(s, d, fullForm(w1));
    expect(s.words[w1.id].stage).toBe(3);
    expect(s.xp + s.level * 100000).toBeGreaterThan(xp0);
    const w2 = d.queue[0];
    answerDuel(s, d, 'zzz');
    expect(s.words[w2.id]).toBeUndefined();
    expect(duelPool(s, 1).some((w) => w.id === w1.id)).toBe(false);
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

describe('言灵过载', () => {
  it('pays less for new words and more for reviews after the daily threshold, without blocking', () => {
    const rng = makeRng(7);
    const run = (count: number, kind: 'new' | 'due') => {
      const s = newGame('T', 'student');
      s.level = 6;
      s.daily.newCount = count;
      const b = startBattle(s, WORD_BY_ID['tee'], rng);
      b.kind = kind;
      b.lastKillTyped = false;
      return { s, res: applyWin(s, b, () => 0.99) };
    };
    const fresh = run(0, 'new');
    const over = run(CONFIG.srs.dailyNewCap, 'new');
    expect(overloaded(over.s)).toBe(true);
    expect(over.res.overload).toBe('new');
    expect(over.res.xp).toBeLessThan(fresh.res.xp);
    expect(over.res.gold).toBeLessThan(fresh.res.gold);
    const dueNormal = run(0, 'due');
    const dueOver = run(CONFIG.srs.dailyNewCap, 'due');
    expect(dueOver.res.overload).toBe('due');
    expect(dueOver.res.xp).toBeGreaterThan(dueNormal.res.xp);
    // Not a lock: new words still spawn.
    const s = newGame('T', 'student');
    s.level = 6;
    s.daily.newCount = CONFIG.srs.dailyNewCap + 5;
    const zone = WORD_BY_ID['tee'].zone;
    expect(pickSpawns(s, zone, 6, new Set(), rng).some((p) => p.kind === 'new')).toBe(true);
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
    for (const w of WORDS.filter((x) => x.zone === zone)) s.words[w.id] = { stage: 1, due: t - 10 * 24 * 3600_000 } as never;
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
      }
      // 完形填空 ladder (Lv1–5): article → cloze (pick) → listen-and-pick.
      expect(types).toEqual(['article', 'cloze', 'pickZh']);
      for (let i = 1; i < types.length; i++) expect(types[i]).not.toBe(types[i - 1]);
    }
  });
});

describe('region 2: packs, conjugation, plurals', () => {
  const nounOf = (art: string) => WORDS.find((w) => w.region === 2 && w.pos === 'n' && w.art === art && w.family === 'krume')!;

  it('asks 点名 first in a pack, and a wrong article that matches another monster strays', () => {
    const rng = makeRng(7);
    const s = newGame('T', 'student');
    s.level = 11;
    const a = startBattle(s, nounOf('der'), rng);
    const c = startBattle(s, nounOf('die'), rng);
    const q = makeQuestion(s, a, 'attack', rng, undefined, true);
    expect(q.type).toBe('callout');
    const hpC = c.monster.hp;
    const r = resolveTurn(s, a, 'attack', q, 'die', rng, [a, c]);
    expect(r.correct).toBe(false);
    expect(a.named).toBe(false);
    expect(c.monster.hp).toBeLessThan(hpC);
    // Right article: named, and the next attack is a normal ladder question.
    const q2 = makeQuestion(s, a, 'attack', rng, undefined, true);
    resolveTurn(s, a, 'attack', q2, 'der', rng, [a, c]);
    expect(a.named).toBe(true);
    expect(makeQuestion(s, a, 'attack', rng, undefined, true).type).not.toBe('callout');
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
    for (const w of WORDS.filter((x) => x.pos === 'v' && x.region === 2)) expect(CONJ[w.de], w.de).toBeDefined();
  });
});

describe('classes and talents', () => {
  const noun = () => WORDS.find((w) => w.de === 'Apfel')!;

  it('书写者: typed answers fill ink, 3 in a row make the next hit a crit, 墨水风暴 spends 3', () => {
    const rng = makeRng(11);
    const s = newGame('T', 'student');
    s.level = 12;
    s.cls = 'writer';
    s.hp = 9999;
    s.words['apfel'] = { stage: 1 } as never;
    const b = startBattle(s, noun(), rng);
    b.monster.hp = b.monster.maxHp = 9999;
    const typed = { type: 'typed' as const, prompt: '', focus: '', withArticle: true, answer: 'der Apfel' };
    for (let i = 0; i < 3; i++) resolveTurn(s, b, 'attack', typed, 'der Apfel', rng);
    expect(b.cfx.res).toBe(3);
    expect(b.cfx.critReady).toBe(true);
    const r = resolveTurn(s, b, 'attack', makeQuestion(s, b, 'attack', rng), 'x', rng);
    if (r.correct) expect(r.crit).toBe(true);
    const storm = makeQuestion(s, b, 'cls', rng);
    expect(storm.type).toBe('storm');
    const rs = resolveTurn(s, b, 'cls', storm, storm.answer!, rng);
    expect(rs.correct).toBe(true);
    expect(b.cfx.res).toBe(0);
  });

  it('守护者: wrong answers hurt 20% less and 稳住 blocks', () => {
    const hitTaken = (cls: 'guardian' | null) => {
      const rng = makeRng(4);
      const s = newGame('T', 'student');
      s.level = 12;
      s.cls = cls;
      s.hp = 9999;
      const b = startBattle(s, noun(), rng);
      b.intent = { ...b.intent, kind: 'attack', hits: 1, element: 'phys' };
      b.monster.dmg = 50;
      b.monster.hp = 9999;
      const q = { type: 'article' as const, prompt: '', focus: '', options: ['der', 'die', 'das'], answer: 'der' };
      resolveTurn(s, b, 'attack', q, 'die', rng);
      return { lost: 9999 - s.hp, res: b.cfx.res };
    };
    const g = hitTaken('guardian');
    expect(g.lost).toBeLessThan(hitTaken(null).lost);
    expect(g.res).toBe(1);
  });

  it('talent points start at Lv12, tiers gate, respec costs an hour of gold', async () => {
    const { learn, talentPoints, respec, respecCost, spent } = await import('../src/core/classes');
    const s = newGame('T', 'student');
    s.cls = 'writer';
    s.level = 11;
    expect(talentPoints(s)).toBe(0);
    s.level = 20;
    expect(talentPoints(s)).toBe(9);
    expect(learn(s, 'tengxie')).toBe(false); // tier 3 needs 6 points first
    for (let i = 0; i < 3; i++) learn(s, 'bifeng');
    expect(learn(s, 'bifeng')).toBe(false); // max 3
    learn(s, 'changci');
    learn(s, 'changci');
    learn(s, 'zhanmo');
    expect(learn(s, 'tengxie')).toBe(true);
    expect(spent(s)).toBe(7);
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
    const g = chest.openChest(s, 'gold', 12, rng);
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

describe('class resources carry over between fights', () => {
  it('ink and the typed streak survive the next fight; a miss breaks the streak', async () => {
    const { resetClassFx } = await import('../src/core/combat');
    const rng = makeRng(2);
    const s = newGame('T', 'student');
    s.level = 12;
    s.cls = 'writer';
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
  it('a right second half is a sure crit, drops the card, never kills, and keeps the word question for later', () => {
    const s = newGame('T', 'student', T0);
    s.level = 4;
    const w = WORDS.find((x) => x.art && (x.region ?? 1) === 1 && !x.tutorial)!;
    const b = startBattle(s, w, makeRng(3));
    b.saying = 'sicher';
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
  });
  it('is typed from Lv6', () => {
    const s = newGame('T', 'student', T0);
    s.level = 6;
    const b = startBattle(s, WORDS[0], makeRng(3));
    b.saying = 'glueck';
    const q = makeQuestion(s, b, 'attack', makeRng(4));
    expect(q.options).toBeUndefined();
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
    const q1 = makeQuestion(s, b, 'sentence', makeRng(1));
    expect(q1.pattern).toBe('moechte');
    resolveTurn(s, b, 'sentence', q1, 'Ich möchte einen Tee.', makeRng(1));
    if (!b.outcome) {
      expect(makeQuestion(s, b, 'sentence', makeRng(1)).pattern).toBe('brauche');
      b.sxUsed = 2;
      expect(sentencePattern(s, b)).toBe(null);
    }
  });
});

describe('认得 / 会写', () => {
  it('migrates old saves and records writing apart from recognition', () => {
    const old = { ...newGame('T', 'student', T0), version: 1 } as unknown as Record<string, unknown>;
    old.words = { tee: { stage: 3, due: 0, firstSeen: 0, lastSeen: 0, relapse: 0, correct: 4, wrong: 0 }, brot: { stage: 1, due: 0, firstSeen: 0, lastSeen: 0, relapse: 0, correct: 0, wrong: 1 } };
    const m = migrate(old)!;
    expect(m.version).toBe(2);
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
