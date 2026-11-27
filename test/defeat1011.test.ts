// 1.0.11 试玩修复 G2 — 战败和回响: the Lv4 scripted loss costs nothing, entry-test players skip it and keep the bread,
// a lost which-7 boss revives you at the bonfire, a 挑战怪 says so in the side panel and its echo stands where you died.
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { maxHp, newGame, type GameState } from '../src/core/state';
import { makeRng } from '../src/core/rng';
import { startBattle } from '../src/core/combat';
import { applyLoss, lossTutorialDue } from '../src/core/outcomes';
import { challengeLevel } from '../src/core/challenge';
import { WORD_BY_ID, WORDS } from '../src/data/words';

// The controller, the world scene and the side panel run in a browser; stub what they touch at import.
const said: Array<Array<{ who: string; text: string }>> = [];
vi.mock('phaser', () => ({ default: { Scene: class {} }, Scene: class {} }));
vi.mock('../src/ui/loading', () => ({ hideLoading: () => {}, setTip: () => {} }));
vi.mock('../src/ui/feedback', () => ({
  advance: () => {},
  banner: () => {},
  dialogHasChoices: () => false,
  dialogOpen: () => false,
  say: (lines: Array<{ who: string; text: string }>) => said.push(lines),
  setPrompt: () => {},
  toast: () => {},
}));
vi.mock('../src/game/audio', () => {
  const sfx = new Proxy({}, { get: () => () => {} });
  return { initAudio: () => {}, setBattleMusic: () => {}, setVolumes: () => {}, sfx, speak: () => {}, speechAvailable: () => false, hasGermanVoice: () => false };
});

const T0 = new Date('2026-11-27T12:00:00').getTime();
function game(level: number): GameState {
  const s = newGame('T', 'student', T0);
  s.timeOffset = T0 - Date.now();
  s.level = level;
  s.hp = maxHp(s);
  return s;
}

type Any = any; // eslint-disable-line @typescript-eslint/no-explicit-any
let Controller: Any;
let WorldScene: Any;
let monsterTag: (s: GameState, m: Any) => string;

beforeAll(async () => {
  const g = globalThis as Any;
  g.window ??= g;
  g.document ??= { getElementById: () => null, createElement: () => ({ style: {}, getContext: () => null }), addEventListener: () => {}, querySelector: () => null, body: {} };
  g.localStorage ??= { getItem: () => null, setItem: () => {}, removeItem: () => {} };
  g.addEventListener ??= () => {};
  Controller = (await import('../src/game/controller')).Controller;
  WorldScene = (await import('../src/game/WorldScene')).WorldScene;
  monsterTag = (await import('../src/game/nodes')).monsterTag;
});

/** A controller with no scene or UI behind it: just enough for finishBattle / finishBoss / onLevelUp. */
function ctrl(s: GameState): Any {
  const c = Object.create(Controller.prototype);
  c.state = s;
  c.rng = makeRng(7);
  c.pack = [];
  c.packEntities = [];
  c.chestQueue = [];
  // Anything not listed is a no-op.
  const loose = (o: Any): Any => new Proxy(o, { get: (t, k) => (k in t ? t[k] : () => {}) });
  c.battleUI = loose({});
  c.bossUI = loose({});
  c.scene = loose({ teleported: 0, teleportToBonfire() { this.teleported++; }, time: { delayedCall() {} } });
  c.refresh = () => {};
  c.persist = () => {};
  c.nextChest = () => {};
  c.milestone = () => {};
  return c;
}

const ent = (word = WORD_BY_ID['hund'], extra: Any = {}): Any => ({ word, x: 100, y: 120, zone: word.zone, kind: 'new', ...extra });

describe('(4)(12) the scripted Lv4 loss costs nothing', () => {
  it('applyLoss keeps gold and XP and leaves no echo for tutorial loss', () => {
    const s = game(4);
    s.gold = 77559;
    s.xp = 30;
    const b = startBattle(s, WORD_BY_ID['hund'], makeRng(1), { tutorial: 'loss' });
    const r = applyLoss(s, b, { x: 10, y: 10 });
    expect(r.newEcho).toBeNull();
    expect(s.echo).toBeNull();
    expect(s.gold).toBe(77559);
    expect(s.xp).toBe(30);
    expect(s.hp).toBe(maxHp(s));
  });

  it('an older echo survives the tutorial loss', () => {
    const s = game(5);
    s.echo = { wordId: 'tee', gold: 40, xp: 5, x: 1, y: 1, region: 1 };
    applyLoss(s, startBattle(s, WORD_BY_ID['hund'], makeRng(1), { tutorial: 'loss' }), { x: 10, y: 10 });
    expect(s.echo?.wordId).toBe('tee');
  });

  it('finishBattle after the scripted loss: gold kept, flag cleared, no 「0 金币留在」 line', () => {
    const s = game(4);
    s.flags.pendingLoss = true;
    s.flags.brotDone = true;
    s.gold = 300;
    const c = ctrl(s);
    const b = startBattle(s, WORD_BY_ID['hund'], c.rng, { tutorial: 'loss' });
    b.outcome = 'lose';
    c.battle = b;
    c.entity = ent(WORDS.find((w) => (w.region ?? 1) === 1 && !w.tutorial)!);
    c.pack = [b];
    c.packEntities = [c.entity];
    said.length = 0;
    c.finishBattle();
    expect(s.gold).toBe(300);
    expect(s.echo).toBeNull();
    expect(s.flags.pendingLoss).toBe(false);
    const text = said.flat().map((l) => l.text).join('\n');
    expect(text).toContain('什么都没丢');
    expect(text).not.toContain('0 金币和');
  });

  it('winning the loss fight clears the flag too', () => {
    const s = game(4);
    s.flags.pendingLoss = true;
    s.flags.brotDone = true;
    const c = ctrl(s);
    const b = startBattle(s, WORD_BY_ID['hund'], c.rng, { tutorial: 'loss' });
    b.outcome = 'win';
    c.battle = b;
    c.entity = ent();
    c.pack = [b];
    c.packEntities = [c.entity];
    c.settleKill = () => {};
    c.finishBattle();
    expect(s.flags.pendingLoss).toBe(false);
  });
});

describe('(11)(16) entry-test players skip the forced loss and keep the bread', () => {
  it('a quiet Lv4 (入学测试 jump to 101) does not arm the loss; a walked Lv4 does', () => {
    const s = game(101);
    ctrl(s).onLevelUp(4, true);
    expect(s.flags.pendingLoss).toBeFalsy();
    const w = game(4);
    ctrl(w).onLevelUp(4);
    expect(w.flags.pendingLoss).toBe(true);
  });

  it('the opening bread is never replaced, an echo neither', () => {
    const s = game(4);
    s.flags.pendingLoss = true;
    expect(lossTutorialDue(s, 'brot')).toBe(false);
    expect(lossTutorialDue(s, 'tee', true)).toBe(false);
    expect(lossTutorialDue(s, 'tee')).toBe(true);
    s.flags.brotDone = true;
    expect(lossTutorialDue(s, 'brot')).toBe(true);
  });

  it('a flag left from 1.0.10 on a player placed past Lv4 is dropped, not fought', () => {
    const s = game(101);
    s.flags.pendingLoss = true;
    s.placement = { at: T0, level: 101, top: 20, checks: {} };
    expect(lossTutorialDue(s, 'zimmer')).toBe(false);
    expect(s.flags.pendingLoss).toBeUndefined();
  });

  it('encounter with the bread starts the bread fight, not the dog', () => {
    const s = game(4);
    s.flags.pendingLoss = true;
    const c = ctrl(s);
    c.gatherPack = () => {};
    c.encounter(ent(WORD_BY_ID['brot'], { kind: 'shadow' }));
    expect(c.battle.word.id).toBe('brot');
    expect(c.battle.tutorial).toBeFalsy();
  });
});

describe('(8) a lost region 4–12 / 蚀变 boss (which 7)', () => {
  it('revives at the bonfire with full HP and a line', () => {
    const s = game(88);
    s.hp = 0;
    const c = ctrl(s);
    c.boss = { which: 7, region: 9, outcome: 'lose', misses: [{ asked: 'Wie heißen Sie?', answer: '', model: 'Ich heiße …' }] };
    said.length = 0;
    c.finishBoss();
    expect(s.hp).toBe(maxHp(s));
    expect(c.scene.teleported).toBe(1);
    expect(said.flat().some((l) => l.text.includes('火边醒来'))).toBe(true);
  });
});

describe('(3) 挑战怪: side-panel tag and the echo where you died', () => {
  it('the side panel says 挑战 with the level the fight uses, not 新', () => {
    const s = game(11);
    const w = WORDS.find((x) => (x.region ?? 1) === 3 && x.art)!;
    const b = startBattle(s, w, makeRng(3), { challenge: true });
    expect(monsterTag(s, ent(w, { challenge: true }))).toBe(`▲ 挑战 Lv ${challengeLevel(11)}`);
    expect(b.monster.lvl).toBe(challengeLevel(11));
    expect(monsterTag(s, ent(w))).toBe('新');
  });

  it('dying to a word from another region records the region you died in', () => {
    const s = game(11);
    s.gold = 50;
    const w = WORD_BY_ID['hund'];
    applyLoss(s, startBattle(s, w, makeRng(3), { challenge: true }), { x: 200, y: 220 });
    expect(s.echo).toMatchObject({ wordId: 'hund', gold: 50, x: 200, y: 220, region: 1 });
  });

  it('placeEcho spawns it in the region of death, at the spot; an old echo still goes by its word', () => {
    const s = game(11);
    const w = WORD_BY_ID['hund'];
    expect(w.region).toBe(3);
    const added: Any[] = [];
    const scene = (region: number): Any => ({ ctrl: { state: s, wordById: (id: string) => WORD_BY_ID[id] }, monsters: [], map: { region }, addMonster: (...a: Any[]) => added.push(a) });
    s.echo = { wordId: 'hund', gold: 50, xp: 0, x: 200, y: 220, region: 1 };
    WorldScene.prototype.placeEcho.call(scene(1));
    expect(added).toHaveLength(1);
    expect(added[0].slice(3)).toEqual([200, 220, { isEcho: true }]);
    WorldScene.prototype.placeEcho.call(scene(3));
    expect(added).toHaveLength(1);
    s.echo = { wordId: 'hund', gold: 50, xp: 0, x: 200, y: 220 }; // a 1.0.10 save
    WorldScene.prototype.placeEcho.call(scene(3));
    expect(added).toHaveLength(2);
  });
});
