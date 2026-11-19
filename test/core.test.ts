import { describe, expect, it } from 'vitest';
import { gradeMoechte, gradeTyped, normalize } from '../src/core/grading';
import { WORD_BY_ID, WORDS } from '../src/data/words';
import { newGame, addXp, overloaded } from '../src/core/state';
import { applyWin } from '../src/core/outcomes';
import { recordKill, kindOf, stageOf } from '../src/core/srs';
import { CONFIG, xpToNext } from '../src/core/config';
import { startBattle, makeQuestion, resolveTurn } from '../src/core/combat';
import { makeRng } from '../src/core/rng';
import { answerBoss, startBoss } from '../src/core/boss';
import { BOSS_QUESTIONS } from '../src/data/boss';
import { pickSpawns } from '../src/core/spawn';
import { CONJ } from '../src/data/verbs';

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
    expect(xpToNext(1)).toBe(167);
    expect(xpToNext(5)).toBe(1000);
    expect(xpToNext(10)).toBeGreaterThan(2400);
    const s = newGame('T', 'student', T0);
    addXp(s, 1_000_000);
    expect(s.level).toBe(CONFIG.levelCap);
  });
});

describe('combat', () => {
  it('a level-1 player beats a new noun monster by answering articles', () => {
    const rng = makeRng(1);
    const s = newGame('T', 'student', Date.now());
    const b = startBattle(s, WORD_BY_ID['tee'], rng);
    let guard = 0;
    while (!b.outcome && guard++ < 20) {
      const q = makeQuestion(s, b, 'attack', rng);
      expect(q.type).toBe('article');
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
  it('blocking an attack parries; breaking a defence makes it vulnerable', () => {
    const rng = makeRng(3);
    const s = newGame('T', 'student', Date.now());
    s.level = 7;
    s.hp = 60;
    const b = startBattle(s, WORD_BY_ID['stuhl'], rng, { tutorial: 'block' });
    const q = makeQuestion(s, b, 'block', rng);
    const r = resolveTurn(s, b, 'block', q, q.answer!, rng);
    expect(r.parried).toBe(true);
    const b2 = startBattle(s, WORD_BY_ID['tisch'], rng, { tutorial: 'break' });
    const q2 = makeQuestion(s, b2, 'break', rng);
    resolveTurn(s, b2, 'break', q2, q2.answer!, rng);
    expect(b2.monster.vulnerable).toBeGreaterThan(0);
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
      expect(types[0]).toBe('article');
      expect(types[1]).toBe('pickZh');
      expect(types[2]).toBe(level >= 3 ? 'typed' : 'pickDe');
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
