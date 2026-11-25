import { describe, expect, it } from 'vitest';
import { newGame, maxHp, type GameState } from '../src/core/state';
import { makeRng } from '../src/core/rng';
import { WORDS } from '../src/data/words';
import { isQuick, makeQuestion, poolCdFor, quickLineMs, resolveTurn, startBattle } from '../src/core/combat';
import { gradeStorm, stormForms } from '../src/core/storm';
import { canLight, learn, lightStar, litStars, passStar, spent, talentPoints } from '../src/core/classes';
import { finishStarTrial, starTrial } from '../src/core/stars';

// 天赋节点表 (游戏设计 十, rev 488).
const give = (s: GameState, ranks: Record<string, number>) => Object.assign(((s.talents as Record<string, Record<string, number>>).shared ??= {}), ranks);
const noun = WORDS.find((w) => w.de === 'Apfel')!;

describe('talent nodes', () => {
  it('cooldown nodes: 墨渍 / 稳步 / 封印熟练, and 墨水充盈 halves a full storm', () => {
    const s = newGame('T', 'student');
    s.level = 61;
    expect(poolCdFor(s, 'storm')).toBe(4);
    give(s, { mozi: 1, wenbu: 2, fengyin: 2, mochong: 1 });
    expect(poolCdFor(s, 'storm')).toBe(3);
    expect(poolCdFor(s, 'storm', true)).toBe(2);
    expect(poolCdFor(s, 'steady')).toBe(3);
    expect(poolCdFor(s, 'seal')).toBe(4);
  });

  it('续写: a missed storm form is skipped, the chain goes on, and it is not all right', () => {
    const forms = stormForms(20, noun, false);
    expect(forms.length).toBeGreaterThan(1);
    const input = ['xxx', ...forms.slice(1).map((f) => (f.dict ? `${noun.art} ${noun.de}` : f.answer))].join('|');
    expect(gradeStorm(noun, forms, input).n).toBe(0);
    const g = gradeStorm(noun, forms, input, true);
    expect(g.n).toBe(forms.length - 1);
    expect(g.all).toBe(false);
  });

  it('稳固: 稳住 becomes this monster’s typed question and covers 3 misses', () => {
    const s = newGame('T', 'student');
    s.level = 30;
    s.hp = 99999;
    s.loadout = ['steady'];
    give(s, { wengu: 1 });
    const b = startBattle(s, noun, makeRng(1));
    b.monster.hp = b.monster.maxHp = 99999;
    const q = makeQuestion(s, b, 'skill', makeRng(2), 'steady');
    expect(q.type).toBe('steady');
    expect(q.options).toBeUndefined();
    const r = resolveTurn(s, b, 'skill', q, q.answer!, makeRng(3));
    expect(r.correct).toBe(true);
    expect(b.cfx.guard).toBe(3);
  });

  it('不慌: a wrong answer halves the combo instead of clearing it', () => {
    const s = newGame('T', 'student');
    s.level = 30;
    s.hp = 99999;
    give(s, { buhuang: 1 });
    const b = startBattle(s, noun, makeRng(1));
    b.monster.hp = b.monster.maxHp = 99999;
    s.combo = 9;
    const q = makeQuestion(s, b, 'attack', makeRng(2));
    resolveTurn(s, b, 'attack', q, 'völlig falsch', makeRng(3));
    expect(s.combo).toBe(4);
  });

  it('改过: the right answer after a wrong one heals 3% per point', () => {
    const s = newGame('T', 'student');
    s.level = 30;
    give(s, { gaiguo: 2 });
    const b = startBattle(s, noun, makeRng(1));
    b.monster.hp = b.monster.maxHp = 99999;
    b.wrongStreak = 1;
    b.intent = { ...b.intent, kind: 'defend' };
    s.hp = Math.round(maxHp(s) / 2);
    const before = s.hp;
    const q = makeQuestion(s, b, 'attack', makeRng(2));
    resolveTurn(s, b, 'attack', q, q.answer!, makeRng(3));
    expect(s.hp - before).toBe(Math.round(maxHp(s) * 0.06));
  });

  it('A2 快答线: choice 2 s, typed about 1 s per 3 letters, only from 31', () => {
    const s = newGame('T', 'student');
    expect(quickLineMs({ type: 'article', prompt: '', focus: '', options: ['der', 'die', 'das'], answer: 'der' })).toBe(2000);
    const q = { type: 'typed' as const, prompt: '', focus: '', answer: 'der Apfel', ms: 2500 };
    expect(quickLineMs(q)).toBe(3000);
    s.level = 30;
    expect(isQuick(s, q)).toBe(false);
    s.level = 31;
    expect(isQuick(s, q)).toBe(true);
  });
});

describe('语法星位', () => {
  it('trial from met words: 8 questions, 6 right passes; then a point lights it', () => {
    const s = newGame('T', 'student');
    s.level = 141;
    for (const w of WORDS.filter((x) => x.art && x.pos === 'n').slice(0, 30)) s.words[w.id] = { stage: 1, due: 0, interval: 0, seen: 1, right: 0, wrong: 0 } as never;
    const tasks = starTrial(s, 'article', makeRng(1))!;
    expect(tasks).toHaveLength(8);
    const answers = tasks.map((t, i) => (i < 6 ? t.answer : 'xx'));
    expect(finishStarTrial(s, 'article', tasks, answers).passed).toBe(true);
    expect(canLight(s, 'article')).toBe(true);
    const before = spent(s);
    expect(lightStar(s, 'article')).toBe(true);
    expect(litStars(s)).toEqual(['article']);
    expect(spent(s)).toBe(before + 1);
    expect(talentPoints(s)).toBeGreaterThan(spent(s));
  });

  it('can not light before 141 or without the trial', () => {
    const s = newGame('T', 'student');
    s.level = 140;
    passStar(s, 'plural');
    expect(canLight(s, 'plural')).toBe(false);
    s.level = 141;
    expect(canLight(s, 'k2')).toBe(false);
    expect(canLight(s, 'plural')).toBe(true);
    expect(learn(s, 'bifeng')).toBe(true);
  });
});

describe('格位连锁', () => {
  it('chainForms: der Tisch → den / dem; n-declension masculines are skipped', async () => {
    const { chainForms } = await import('../src/core/combat');
    const tisch = WORDS.find((w) => w.de === 'Tisch' && w.art === 'der')!;
    expect(chainForms(tisch)).toEqual({ nom: 'der Tisch', acc: 'den Tisch', dat: 'dem Tisch' });
    const kollege = WORDS.find((w) => w.de === 'Kollege');
    if (kollege) expect(chainForms(kollege)).toBeNull();
  });

  it('the follow-up hits ×1.5, the monster does not act, and it never finishes the monster', () => {
    const s = newGame('T', 'student');
    s.level = 40;
    const tisch = WORDS.find((w) => w.de === 'Tisch' && w.art === 'der')!;
    const b = startBattle(s, tisch, makeRng(1));
    b.chainOffer = true;
    const q = makeQuestion(s, b, 'attack', makeRng(2));
    expect(q.chain).toBe(true);
    const hp0 = s.hp;
    b.monster.hp = 5;
    const r = resolveTurn(s, b, 'attack', q, q.answer!, makeRng(3));
    expect(r.correct).toBe(true);
    expect(r.monsterDamage).toBe(0);
    expect(s.hp).toBe(hp0);
    expect(b.monster.hp).toBeGreaterThanOrEqual(1);
    expect(b.chainOffer).toBe(false);
  });
});
