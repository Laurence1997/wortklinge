import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import type { Question } from '../src/core/combat';

// 1.0.12 g4 (2026-11-27 playtest 25, 26, 40, 51, 66, 73): battle UI and panel keys.
// The UI classes are loaded with a tiny stand-in for window/document (no DOM in these tests).

type El = { hidden: boolean };
const els: Record<string, El> = {};
class FakeNode {
  children: unknown[] = [];
  className = '';
  id = '';
  append(...c: unknown[]) {
    this.children.push(...c);
  }
  addEventListener() {}
  setAttribute() {}
}
const doc = { visibilityState: 'visible' as 'visible' | 'hidden', activeElement: null as unknown, getElementById: (id: string) => els[id] ?? null, createElement: () => new FakeNode() };

let battleMod: typeof import('../src/ui/battle');
let Panels: typeof import('../src/ui/panels').Panels;
let gamelog: typeof import('../src/ui/gamelog');

beforeAll(async () => {
  vi.stubGlobal('window', { addEventListener() {}, removeEventListener() {}, setTimeout: () => 0, clearTimeout() {}, setInterval: () => 0, clearInterval() {} });
  vi.stubGlobal('document', doc);
  vi.stubGlobal('Node', FakeNode);
  battleMod = await import('../src/ui/battle');
  Panels = (await import('../src/ui/panels')).Panels;
  gamelog = await import('../src/ui/gamelog');
});

afterEach(() => {
  vi.restoreAllMocks();
  doc.activeElement = null;
  for (const k of Object.keys(els)) delete els[k];
});

function rtFight() {
  const tick = vi.fn(() => null);
  const ctrl = { battle: { log: [] }, fightOver: () => false, tick, state: {}, pack: [] };
  const ui = new battleMod.BattleUI(ctrl as never);
  const clock = { now: 0 };
  vi.spyOn(performance, 'now').mockImplementation(() => clock.now);
  const u = ui as unknown as { rtOn: boolean; castStart: number; castLen: number; rtLast: number; rtStep(): void };
  u.rtOn = true;
  u.castStart = 0;
  u.castLen = 5000;
  u.rtLast = 0;
  const run = (ms: number) => {
    for (let t = 0; t < ms; t += 100) {
      clock.now += 100;
      u.rtStep();
    }
  };
  return { ui, tick, run };
}

describe('试玩 40: 直接叫名 and 造句 hold the real-time cast', () => {
  const direct = { type: 'typed', prompt: '直接叫名', focus: '面包', answer: 'das Brot', directName: true } as Question;
  const compose = { type: 'cloze', write: 'compose', prompt: '造句', focus: '面包', answer: 'das Brot' } as Question;
  for (const [name, q] of [['直接叫名', direct], ['造句', compose]] as const) {
    it(`${name}: 20 s of writing, no hit`, () => {
      const f = rtFight();
      f.ui.phase = 'answer';
      f.ui.question = q;
      f.run(20_000);
      expect(f.tick).not.toHaveBeenCalled();
    });
  }
});

describe('试玩 51: a clean hit with the whole sentence stays long enough to read', () => {
  it('longer for a longer sentence, within 1.8–4 s', () => {
    expect(battleMod.resultReadMs('Hund（狗）')).toBe(1800);
    const long = battleMod.resultReadMs('Der Hund schläft jeden Nachmittag unter dem Tisch.（狗每天下午在桌子下睡觉。）');
    expect(long).toBeGreaterThan(3000);
    expect(battleMod.resultReadMs('x'.repeat(500))).toBe(4000);
  });
});

describe('试玩 66: one log line per hit', () => {
  it('the answer log does not add 「它出手」 next to the fight log\'s own 「它打中你」', () => {
    const lines: string[] = [];
    vi.spyOn(gamelog, 'logLine').mockImplementation((t: string) => void lines.push(t));
    const ctrl = { battle: { log: [] }, fightOver: () => false, state: {}, pack: [] };
    const ui = new battleMod.BattleUI(ctrl as never);
    const b = { log: [{ text: '它打中你，共 7 点。', tone: 'bad' }], word: { de: 'Brot', zh: '面包' }, spellSeen: true, verifyDone: false, outcome: null };
    const q = { type: 'typed', prompt: '', focus: '面包', answer: 'das Brot' } as Question;
    const r = { correct: false, verdict: { ok: false, notes: [], correct: 'das Brot' }, monsterDamage: 7, playerDamage: 0 };
    (ui as unknown as { logTurn(...a: unknown[]): void }).logTurn(b, q, 'die Brot', r, 0);
    expect(lines.filter((l) => /7/.test(l))).toEqual(['  它打中你，共 7 点。']);
  });
});

describe('试玩 26: 突破试炼 choices answer with 1–4, nothing is focused for Enter', () => {
  function examPanels() {
    const examAnswer = vi.fn();
    const p = new Panels({ examAnswer, speak() {} } as never);
    vi.spyOn(p, 'render').mockImplementation(() => undefined);
    const exam = { over: false, at: 0, qs: [{ part: 'listen', say: 'Hallo', options: ['你好', '再见', '谢谢', '对不起'], answer: '你好' }], right: { listen: 0, read: 0, write: 0, grammar: 0 } };
    const pp = p as unknown as { open: string; exam: unknown; examBody(): unknown };
    pp.open = 'exam';
    pp.exam = exam;
    return { p, pp, examAnswer, exam };
  }
  const key = (k: string) => ({ key: k, repeat: false, preventDefault() {} }) as unknown as KeyboardEvent;

  it('3 answers the third option; Enter and 5 do nothing', () => {
    const { p, pp, examAnswer, exam } = examPanels();
    pp.examBody();
    expect(p.examKey(key('Enter'))).toBe(false);
    expect(p.examKey(key('5'))).toBe(false);
    expect(p.examKey(key('3'))).toBe(true);
    expect(examAnswer).toHaveBeenCalledWith(exam, '谢谢');
  });

  it('keys are left alone while a text box has the focus or the panel is another one', () => {
    const { p, pp, examAnswer } = examPanels();
    pp.examBody();
    doc.activeElement = { tagName: 'INPUT' };
    expect(p.examKey(key('1'))).toBe(false);
    doc.activeElement = null;
    pp.open = 'hero';
    expect(p.examKey(key('1'))).toBe(false);
    expect(examAnswer).not.toHaveBeenCalled();
  });
});
