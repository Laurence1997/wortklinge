import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import type { Question } from '../src/core/combat';

// 1.0.11 试玩修复 G4 (2026-11-27 playtest, high findings 9, 13, 15): real-time cast bar and panels.
// The UI classes are loaded with a tiny stand-in for window/document (no DOM in these tests).

type El = { hidden: boolean };
const els: Record<string, El> = {};
const doc = { visibilityState: 'visible' as 'visible' | 'hidden', activeElement: null as unknown, getElementById: (id: string) => els[id] ?? null };

let BattleUI: typeof import('../src/ui/battle').BattleUI;
let battleMod: typeof import('../src/ui/battle');
let Panels: typeof import('../src/ui/panels').Panels;

beforeAll(async () => {
  vi.stubGlobal('window', { addEventListener() {}, removeEventListener() {}, setTimeout: () => 0, clearTimeout() {}, setInterval: () => 0, clearInterval() {} });
  vi.stubGlobal('document', doc);
  battleMod = await import('../src/ui/battle');
  BattleUI = battleMod.BattleUI;
  Panels = (await import('../src/ui/panels')).Panels;
});

afterEach(() => {
  vi.restoreAllMocks();
  doc.visibilityState = 'visible';
  for (const k of Object.keys(els)) delete els[k];
});

const article: Question = { type: 'gram', prompt: '读文章，选答案', focus: 'Worum geht es?', options: ['a', 'b', 'c'], gram: { sys: 'article', prompt: '', focus: '', answer: 'a', tier: 1, rule: '', passage: 'Ein langer Text. '.repeat(150) } } as unknown as Question;
const listen: Question = { type: 'gram', prompt: '听段', focus: '？', options: ['a', 'b'], listen: 'Hallo, hier ist Anna.', gram: { sys: 'listen', prompt: '', focus: '', answer: 'a', tier: 1, rule: '' } } as unknown as Question;
const plain: Question = { type: 'typed', prompt: '写出德语', focus: '面包', answer: 'das Brot' } as Question;

/** A BattleUI in a running real-time fight whose next cast lands in 5 s; `now` drives performance.now(). */
function rtFight() {
  const tick = vi.fn(() => null);
  const ctrl = { battle: { log: [] }, fightOver: () => false, tick, state: {}, pack: [] };
  const ui = new BattleUI(ctrl as never);
  const clock = { now: 0 };
  vi.spyOn(performance, 'now').mockImplementation(() => clock.now);
  const u = ui as unknown as { rtOn: boolean; castStart: number; castLen: number; rtLast: number; rtStep(): void; castLeft(): number };
  u.rtOn = true;
  u.castStart = 0;
  u.castLen = 5000;
  u.rtLast = 0;
  /** Runs the 100 ms loop for `ms`. */
  const run = (ms: number) => {
    for (let t = 0; t < ms; t += 100) {
      clock.now += 100;
      u.rtStep();
    }
  };
  return { ui, u, tick, clock, run };
}

describe('试玩 15: the real-time cast waits while you read a passage, a panel is open, or you look away', () => {
  it('longRead: articles, notices and listening passages; not a plain question', () => {
    expect(battleMod.longRead(article)).toBe(true);
    expect(battleMod.longRead(listen)).toBe(true);
    expect(battleMod.longRead(plain)).toBe(false);
    expect(battleMod.longRead(null)).toBe(false);
  });

  it('a plain question: the monster still hits when the cast ends', () => {
    const f = rtFight();
    f.ui.phase = 'answer';
    f.ui.question = plain;
    f.run(5200);
    expect(f.tick).toHaveBeenCalled();
  });

  it('reading an article for 45 s: no hit, the cast keeps its time; it runs again after the answer', () => {
    const f = rtFight();
    f.ui.phase = 'answer';
    f.ui.question = article;
    f.run(2000);
    f.run(45_000);
    expect(f.tick).not.toHaveBeenCalled();
    expect(f.u.castLeft()).toBeGreaterThan(4000);
    f.ui.phase = 'choose';
    f.ui.question = null;
    f.run(2500);
    expect(f.tick).not.toHaveBeenCalled();
    f.run(2700);
    expect(f.tick).toHaveBeenCalled();
  });

  it('a listening passage holds the cast', () => {
    const f = rtFight();
    f.ui.phase = 'answer';
    f.ui.question = listen;
    f.run(20_000);
    expect(f.tick).not.toHaveBeenCalled();
  });

  it('the feedback after an answer (global cooldown / stagger) is not held: that time is the cost', () => {
    const f = rtFight();
    f.ui.phase = 'result';
    f.ui.question = article;
    f.run(5200);
    expect(f.tick).toHaveBeenCalled();
  });

  it('an open panel or a hidden tab holds the cast', () => {
    const f = rtFight();
    f.ui.phase = 'choose';
    els.modal = { hidden: false };
    f.run(20_000);
    els.modal.hidden = true;
    doc.visibilityState = 'hidden';
    f.run(20_000);
    expect(f.tick).not.toHaveBeenCalled();
    doc.visibilityState = 'visible';
    f.run(5200);
    expect(f.tick).toHaveBeenCalled();
  });

  it('a throttled background tab (one step after a minute) does not land the hit', () => {
    const f = rtFight();
    f.ui.phase = 'choose';
    f.run(1000);
    f.clock.now += 60_000;
    f.u.rtStep();
    expect(f.tick).not.toHaveBeenCalled();
    expect(f.u.castLeft()).toBeGreaterThan(3000);
  });
});

describe('试玩 13: a re-render keeps every answer box and the focus', () => {
  type Box = { dataset: { k: string }; value: string; disabled: boolean; selectionStart: number | null; selectionEnd: number | null; focus: ReturnType<typeof vi.fn>; setSelectionRange: ReturnType<typeof vi.fn> };
  const box = (k: string, value = ''): Box => ({ dataset: { k }, value, disabled: false, selectionStart: value.length, selectionEnd: value.length, focus: vi.fn(), setSelectionRange: vi.fn() });
  const root = (boxes: Box[]) => ({ querySelectorAll: () => boxes }) as never;

  it('墨水风暴 boxes, 终结技 a/c and 齐鸣 mates come back with their text; the focused box gets the focus and caret', () => {
    const old = [box('mate0', 'der Tisch'), box('box0', 'gehe'), box('box1', 'gin'), box('ultA', 'weil'), box('ultC', ''), box('main', 'das Br')];
    old[2].selectionStart = old[2].selectionEnd = 2;
    const kept = battleMod.keepInputs(root(old), old[2] as never);
    expect(kept.values).toEqual({ mate0: 'der Tisch', box0: 'gehe', box1: 'gin', ultA: 'weil', ultC: '', main: 'das Br' });
    const fresh = ['mate0', 'box0', 'box1', 'ultA', 'ultC', 'main'].map((k) => box(k));
    const again = battleMod.restoreInputs(root(fresh), kept);
    expect(fresh.map((b) => b.value)).toEqual(['der Tisch', 'gehe', 'gin', 'weil', '', 'das Br']);
    expect(again).not.toBeNull();
    again!();
    expect(fresh[2].focus).toHaveBeenCalled();
    expect(fresh[2].setSelectionRange).toHaveBeenCalledWith(2, 2);
    expect(fresh[0].focus).not.toHaveBeenCalled();
  });

  it('no box had the focus: nothing to give back (the default focus applies)', () => {
    const kept = battleMod.keepInputs(root([box('box0', 'x')]), null);
    expect(battleMod.restoreInputs(root([box('box0')]), kept)).toBeNull();
  });
});

describe('试玩 9: no menu panel on top of a fight', () => {
  function panels(ctrl: Record<string, unknown>) {
    const p = new Panels(ctrl as never);
    const show = vi.spyOn(p, 'show').mockImplementation(() => undefined);
    return { p, show };
  }

  it('toggle does not open a panel during a battle or a boss fight; it does outside', async () => {
    const fb = await import('../src/ui/feedback');
    const toast = vi.spyOn(fb, 'toast').mockImplementation(() => undefined);
    void toast;
    const a = panels({ battle: {}, boss: null });
    expect(() => a.p.toggle('hero')).not.toThrow();
    expect(a.show).not.toHaveBeenCalled();
    const b = panels({ battle: null, boss: {} });
    b.p.toggle('settings');
    expect(b.show).not.toHaveBeenCalled();
    const c = panels({ battle: null, boss: null });
    c.p.toggle('hero');
    expect(c.show).toHaveBeenCalledWith('hero');
  });

  it('with a panel open the battle does not take the keys', () => {
    const ctrl = { battle: { log: [], cutReady: false }, fightOver: () => false, state: {}, pack: [] };
    const ui = new BattleUI(ctrl as never);
    const go = vi.spyOn(ui, 'continue').mockImplementation(() => undefined);
    els.battle = { hidden: false };
    els.modal = { hidden: false };
    ui.phase = 'result';
    const e = { key: 'Enter', preventDefault() {}, repeat: false } as unknown as KeyboardEvent;
    expect(ui.onKey(e)).toBe(false);
    expect(go).not.toHaveBeenCalled();
    els.modal.hidden = true;
    expect(ui.onKey(e)).toBe(true);
    expect(go).toHaveBeenCalled();
  });
});
