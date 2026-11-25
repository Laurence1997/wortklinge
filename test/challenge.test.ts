// 挑战怪 / 挑战池 (游戏设计 rev 342 四「词怎么分层、蚀变和挑战怪」).
import { describe, expect, it } from 'vitest';
import { newGame, type GameState } from '../src/core/state';
import { makeRng } from '../src/core/rng';
import { makeQuestion, resolveTurn, startBattle } from '../src/core/combat';
import { applyWin } from '../src/core/outcomes';
import { CHALLENGE_CFG, challengePool, challengeShare, noteFirstTry, pickChallenge } from '../src/core/challenge';
import { pickSpawns, zoneWords } from '../src/core/spawn';
import { fullForm, WORDS } from '../src/data/words';

const T0 = new Date('2026-11-22T12:00:00').getTime();

function game(level = 6): GameState {
  const s = newGame('T', 'student', T0);
  s.timeOffset = T0 - Date.now();
  s.level = level;
  return s;
}

const zone1 = WORDS.find((w) => (w.region ?? 1) === 1 && !w.tutorial)!.zone;

describe('挑战怪 share', () => {
  it('10% until 20 monsters are recorded, then by first-try rate', () => {
    const s = game();
    expect(challengeShare(s)).toBe(CHALLENGE_CFG.base);
    for (let i = 0; i < 20; i++) noteFirstTry(s, i < 17 ? 'ok' : 'bad');
    expect(challengeShare(s)).toBe(CHALLENGE_CFG.mid.share); // 85%
    for (let i = 0; i < 20; i++) noteFirstTry(s, i < 19 ? 'dict' : 'bad');
    expect(challengeShare(s)).toBe(CHALLENGE_CFG.high.share); // 95%, mostly dictation
    for (let i = 0; i < 20; i++) noteFirstTry(s, i < 19 ? 'ok' : 'bad');
    expect(challengeShare(s)).toBe(CHALLENGE_CFG.mid.share); // 95% but not by dictation
    expect(s.challenge!.recent.length).toBe(CHALLENGE_CFG.window);
  });
  it('a strong 分级考核 result starts at 25%', () => {
    const s = game();
    s.placement = { at: T0, level: 20, top: 1, checks: {} };
    expect(challengeShare(s)).toBe(CHALLENGE_CFG.mid.share);
  });
});

describe('挑战池', () => {
  it('takes new words of the next region, never this zone or ones on the map', () => {
    const s = game();
    const pool = challengePool(s, zone1, new Set());
    expect(pool.length).toBeGreaterThan(0);
    expect(pool.every((w) => w.zone !== zone1 && (w.region ?? 1) === 2)).toBe(true);
    const alive = new Set([pool[0].id]);
    expect(challengePool(s, zone1, alive).some((w) => w.id === pool[0].id)).toBe(false);
  });
  it('keeps related words of unwritten local words out', () => {
    const s = game();
    const pool = challengePool(s, zone1, new Set());
    const local = zoneWords(zone1)[0] as (typeof WORDS)[number] & { rel?: string[] };
    local.rel = [pool[0].id];
    try {
      expect(challengePool(s, zone1, new Set()).some((w) => w.id === pool[0].id)).toBe(false);
    } finally {
      delete local.rel;
    }
  });
  it('pickSpawns marks challenge picks (at 40%, a 5-monster field gets at least one)', () => {
    const s = game(6);
    s.challenge = { recent: Array(20).fill(2) };
    let seen = 0;
    for (let i = 0; i < 20; i++) seen += pickSpawns(s, zone1, 5, new Set(), makeRng(i)).filter((p) => p.challenge).length;
    expect(seen).toBeGreaterThan(0);
    expect(pickChallenge(s, zone1, 2, new Set(), makeRng(1)).length).toBe(2);
  });
});

describe('挑战怪 fight', () => {
  it('stands at your level + 2, opens with a dictation, and a right answer goes 待验证 on the kill with ×1.75 XP', () => {
    const s = game(6);
    const w = challengePool(s, zone1, new Set()).find((x) => !!x.art)!;
    const b = startBattle(s, w, makeRng(2), { challenge: true });
    expect(b.challenge).toBe(true);
    expect(b.monster.lvl).toBe(s.level + CHALLENGE_CFG.levelAbove);
    const q = makeQuestion(s, b, 'attack', makeRng(2));
    expect(q.type).toBe('typed');
    expect(q.prompt).toContain('挑战怪');
    const r = resolveTurn(s, b, 'attack', q, fullForm(w), makeRng(2));
    expect(r.cut).toBe('pend');
    expect(b.firstTry).toBe('dict');
    b.monster.hp = 0;
    b.outcome = 'win';
    const plain = startBattle(game(6), w, makeRng(2));
    plain.monster.lvl = b.monster.lvl;
    const xpPlain = applyWin(game(6), plain, makeRng(5)).xp;
    const win = applyWin(s, b, makeRng(5));
    expect(win.xp).toBeGreaterThan(xpPlain);
    expect(s.words[w.id]?.pend).toBeTruthy();
    expect(s.challenge?.recent.slice(-1)[0]).toBe(2);
  });
  it('a wrong opener shows the spelling and gives no quick cut', () => {
    const s = game(6);
    const w = challengePool(s, zone1, new Set()).find((x) => !!x.art)!;
    const b = startBattle(s, w, makeRng(2), { challenge: true });
    const q = makeQuestion(s, b, 'attack', makeRng(2));
    resolveTurn(s, b, 'attack', q, 'der Quatsch', makeRng(2));
    expect(b.firstTry).toBe('bad');
    expect(b.pendOnWin).toBeFalsy();
  });
});
