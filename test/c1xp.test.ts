// C1 pay rules (Lucas 2026-11-28「按推荐」, options 1 + 3): C1 field monsters at your level, the C1 article bonus,
// 161–200 ×0.8 and boss replays far below you paying the level-gap share.
import { beforeAll, describe, expect, it } from 'vitest';
import { newGame, type GameState } from '../src/core/state';
import { makeRng } from '../src/core/rng';
import { makeQuestion, monsterStats, resolveTurn, startBattle } from '../src/core/combat';
import { applyWin } from '../src/core/outcomes';
import { CONFIG, xpToNext } from '../src/core/config';
import { C1_ZONES, c1Field } from '../src/core/c1';
import { CHALLENGE_CFG } from '../src/core/challenge';
import { bossPay, BOSS_REPLAY_SHARE } from '../src/core/boss';
import { laterBossXp, LATER_BOSS } from '../src/data/bossesLater';
import { WORDS } from '../src/data/words';
import { SCENES } from '../src/data/world';
import { ARTICLES_B2, loadArticlesC1 } from '../src/data/articlesB2';
import { noticeById } from '../src/core/gram/notice';
import type { Word } from '../src/core/types';

const T0 = new Date('2026-11-28T12:00:00').getTime();

function game(level = 170): GameState {
  const s = newGame('T', 'student', T0);
  s.timeOffset = T0 - Date.now();
  s.level = level;
  return s;
}

/** A plain region-1 noun (no strong-verb bonus), learned to 半名 and written once: a shadow, not due. */
const noun = WORDS.find((w) => (w.region ?? 1) === 1 && !w.tutorial && w.pos === 'n' && !!w.art && w.family !== 'truhe')!;
function shadowOf(s: GameState, w: Word) {
  s.words[w.id] = { stage: 2, due: T0 + 30 * 86400e3, firstSeen: T0 - 86400e3, lastSeen: T0 - 86400e3, relapse: 0, correct: 3, wrong: 0, read: 2, write: 1 };
}

describe('C1 fields (1a)', () => {
  it('are the word-less zones of regions 17, 18, 20 and the open 蚀变④ scenes, from 161 on', () => {
    expect([...C1_ZONES].sort()).toEqual(['r17a', 'r17b', 'r17c', 'r18a', 'r18b', 'r18c', 'r20a', 'r20b', 'r20c']);
    expect(c1Field(game(161), 'r17a')).toBe(true);
    expect(c1Field(game(160), 'r17a')).toBe(false);
    const s = game(185);
    const ero = SCENES.find((sc) => sc.erodeSeg === 19)!;
    expect(c1Field(s, ero.zone, ero.id)).toBe(false); // 蚀变④ not open yet (天平庭's boss stands)
    s.flags.boss18Kills = 1;
    expect(c1Field(s, ero.zone, ero.id)).toBe(true);
    const plain = SCENES.find((sc) => !!sc.zone && sc.region >= 9 && sc.region <= 12 && sc.erodeSeg !== 19)!;
    expect(c1Field(s, plain.zone, plain.id)).toBe(false);
    expect(c1Field(s, ero.zone)).toBe(false); // no scene → only the zone rule
  });
  it('leaves regions 1–16 alone, even at 200', () => {
    const s = game(200);
    s.flags.boss18Kills = 1;
    for (const sc of SCENES.filter((x) => x.zone && x.region <= 16 && x.erodeSeg !== 19)) expect(c1Field(s, sc.zone, sc.id)).toBe(false);
  });
  it('a known word there stands at your level and a shadow pays the due rate; the ladder does not move', () => {
    const s = game(170);
    shadowOf(s, noun);
    const b = startBattle(s, noun, makeRng(1), { c1: true });
    expect(b.kind).toBe('shadow');
    expect(b.c1).toBe(true);
    expect(b.monster.lvl).toBe(170);
    // HP and damage are those of any Lv170 shadow of that stage.
    const st = monsterStats(170, b.stage, 'shadow', b.overdue);
    if (!b.pluralMon) expect(b.monster.maxHp).toBe(st.hp);
    expect(b.monster.dmg).toBe(st.dmg);
    b.outcome = 'win';
    const before = { ...s.words[noun.id] };
    const win = applyWin(s, b, makeRng(5));
    expect(win.xp).toBe(CONFIG.xp.dueMonster);
    expect(s.words[noun.id].stage).toBe(before.stage);
    // Without the C1 rule the same kill keeps the word's level and the gap cuts it to 1.
    const s2 = game(170);
    shadowOf(s2, noun);
    const b2 = startBattle(s2, noun, makeRng(1));
    expect(b2.monster.lvl).toBe(noun.lvl);
    b2.outcome = 'win';
    expect(applyWin(s2, b2, makeRng(5)).xp).toBe(1);
    expect(s2.words[noun.id].stage).toBe(s.words[noun.id].stage);
    expect(s2.words[noun.id].due).toBe(s.words[noun.id].due);
  });
  it('a typed kill pays ×1.5 as usual; echo and trial fights ignore it', () => {
    const s = game(170);
    shadowOf(s, noun);
    const b = startBattle(s, noun, makeRng(1), { c1: true });
    b.outcome = 'win';
    b.lastKillTyped = true;
    expect(applyWin(s, b, makeRng(5)).xp).toBe(CONFIG.xp.dueMonster * CONFIG.xp.typedKillMult);
    expect(startBattle(s, noun, makeRng(1), { c1: true, isEcho: true }).c1).toBeUndefined();
    expect(startBattle(s, noun, makeRng(1), { c1: true, trial: 'x' }).c1).toBeUndefined();
  });
});

describe('C1 articles (1b)', () => {
  beforeAll(async () => {
    await loadArticlesC1();
  });
  const art = () => ARTICLES_B2.find((a) => a.seg === 17 && !a.lemmas.length)!;

  function articleFight(s: GameState) {
    shadowOf(s, noun);
    const b = startBattle(s, noun, makeRng(1), { c1: true });
    b.notice = { id: art().id, i: 0 };
    b.perfekt = false;
    b.mirror = b.structMon = b.pronMon = undefined;
    b.b2Mon = undefined;
    return b;
  }

  it('all questions right on an unread article: new-word ×1.75, once per article', () => {
    const s = game(170);
    const b = articleFight(s);
    b.notice!.right = art().qs.map((_, i) => i);
    b.outcome = 'win';
    const win = applyWin(s, b, makeRng(5));
    expect(CHALLENGE_CFG.xpMult).toBe(1.75);
    expect(win.xp).toBe(Math.round(CONFIG.xp.newMonster * CHALLENGE_CFG.xpMult));
    expect(b.c1Article).toBe(true);
    expect(s.articlesDone?.[art().id]).toBeTruthy();
    expect(s.words[noun.id].stage).toBe(2); // still a shadow kill on the ladder
    // The same article again: normal C1 pay.
    const b2 = articleFight(s);
    b2.notice!.right = art().qs.map((_, i) => i);
    b2.outcome = 'win';
    expect(applyWin(s, b2, makeRng(5)).xp).toBe(CONFIG.xp.dueMonster);
  });
  it('partly right, or a miss: normal pay and the article stays open', () => {
    const s = game(170);
    const b = articleFight(s);
    b.notice!.right = [0, 1];
    b.outcome = 'win';
    expect(applyWin(s, b, makeRng(5)).xp).toBe(CONFIG.xp.dueMonster);
    const b2 = articleFight(s);
    b2.notice!.right = art().qs.map((_, i) => i);
    b2.notice!.miss = true;
    b2.outcome = 'win';
    expect(applyWin(s, b2, makeRng(5)).xp).toBe(CONFIG.xp.dueMonster);
    expect(s.articlesDone?.[art().id]).toBeUndefined();
  });
  it('in the fight: right answers are recorded and it holds at 1 HP until every question was asked', () => {
    const s = game(170);
    const b = articleFight(s);
    const n = noticeById(art().id)!;
    for (let k = 0; k < n.qs.length; k++) {
      b.monster.hp = 1; // every content hit would finish it
      const q = makeQuestion(s, b, 'attack', makeRng(k + 3));
      expect(q.gram?.sys).toBe('notice');
      resolveTurn(s, b, 'attack', q, q.answer!, makeRng(k + 3));
      expect(b.monster.hp).toBe(1);
      expect(!!b.finishOwn).toBe(k === n.qs.length - 1);
    }
    expect(b.notice!.right!.length).toBe(n.qs.length);
    expect(b.notice!.miss).toBeUndefined();
  });
  it('a wrong answer ends the bonus and the usual 1-HP finish comes back', () => {
    const s = game(170);
    const b = articleFight(s);
    const q = makeQuestion(s, b, 'attack', makeRng(3));
    resolveTurn(s, b, 'attack', q, 'falsch', makeRng(3));
    expect(b.notice!.miss).toBe(true);
    b.monster.hp = 1;
    const q2 = makeQuestion(s, b, 'attack', makeRng(4));
    resolveTurn(s, b, 'attack', q2, q2.answer!, makeRng(4));
    expect(b.finishOwn).toBe(true);
  });
});

describe('161–200 pace (1c)', () => {
  it('×0.8 of the base curve up to 200', () => {
    for (const L of [161, 180, 199, 200]) expect(xpToNext(L)).toBe(Math.round(1.25 * Math.pow(L, 0.3) * 1000 * 0.8));
  });
});

describe('boss replays (3)', () => {
  it('first kills and replays within 10 levels pay as before', () => {
    expect(bossPay(1000, true, 1, 180, 28)).toBe(1000);
    expect(bossPay(1000, false, 1, 38, 28)).toBe(1000);
    expect(bossPay(1000, false, 2, 38, 28)).toBe(Math.round((1000 * BOSS_REPLAY_SHARE) / 10) * 10);
    expect(bossPay(1000, false, 1)).toBe(1000); // no levels given: old rule
  });
  it('a replay more than 10 levels below you takes the level-gap share, never under 10', () => {
    expect(bossPay(1000, false, 1, 39, 28)).toBe(200); // 11 below: ×0.2
    expect(bossPay(1000, false, 2, 45, 28)).toBe(100); // same-day replay: ×0.5 × 0.2
    expect(bossPay(1000, false, 1, 49, 28)).toBe(10); // 21 below: nothing but the floor
    expect(bossPay(300, false, 1, 180, 8)).toBe(10);
    const b17 = LATER_BOSS[17]!;
    expect(bossPay(laterBossXp(b17.level), false, 1, 178, b17.level)).toBe(laterBossXp(b17.level));
    expect(bossPay(laterBossXp(b17.level), false, 1, 180, b17.level)).toBe(Math.round((laterBossXp(b17.level) * 0.2) / 10) * 10);
  });
  it('a Lv180 player re-fighting bosses 1–19 once a day gets far less than before', () => {
    const levels: Array<[number, number]> = [
      [CONFIG.xp.boss, 8],
      [CONFIG.boss2.xp, 18],
      [CONFIG.boss3.xp, 28],
      ...Object.values(LATER_BOSS)
        .filter((b) => b!.level < 180)
        .map((b) => [laterBossXp(b!.level), b!.level] as [number, number]),
    ];
    const before = levels.reduce((a, [x]) => a + bossPay(x, false, 1), 0);
    const after = levels.reduce((a, [x, l]) => a + bossPay(x, false, 1, 180, l), 0);
    expect(before).toBeGreaterThan(20000);
    expect(after).toBeLessThan(before * 0.2);
  });
});
