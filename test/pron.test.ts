import { describe, expect, it } from 'vitest';
import { PRON_PAIRS, SAYABLE } from '../src/data/pairs';
import { echoTask, echoVerdict, pairsFor } from '../src/core/pron';
import { GSPEC } from '../src/ui/phoneme';
import { makeQuestion, resolveTurn, startBattle } from '../src/core/combat';
import { newGame } from '../src/core/state';
import { makeRng } from '../src/core/rng';
import { WORDS } from '../src/data/words';

describe('回音怪', () => {
  it('every pair has a monster in the word bank and IPA the phoneme model knows', () => {
    const units = new Set([...GSPEC, 'r', 'ɔø']);
    for (const p of PRON_PAIRS) {
      expect(WORDS.some((w) => pairsFor(w).some((x) => x.p === p)), `${p.a}/${p.b}`).toBe(true);
      for (const u of `${p.ipaA} ${p.ipaB}`.split(' ')) expect(units.has(u), `${p.a}/${p.b}: ${u}`).toBe(true);
      expect(p.ipaA).not.toBe(p.ipaB);
    }
  });

  it('length pairs are listen-only; read-aloud pairs ask the monster’s own word', () => {
    const s = newGame('T', 'student', Date.now());
    const tuer = WORDS.find((w) => w.de === 'Tür')!;
    const stadt = WORDS.find((w) => w.de === 'Stadt')!;
    let say = 0;
    let listen = 0;
    for (let i = 0; i < 200; i++) {
      const t = echoTask(s, tuer, makeRng(i));
      if (t) {
        expect(t.sayable).toBe(true);
        expect(t.target).toBe('Tür');
        say++;
      }
      const u = echoTask(s, stadt, makeRng(i + 1000));
      if (u) {
        expect(u.sayable).toBe(false);
        expect(SAYABLE).not.toContain(u.cat);
        listen++;
      }
    }
    expect(say).toBeGreaterThan(30);
    expect(listen).toBeGreaterThan(30);
  });

  it('the model verdict needs a clear gap; otherwise it asks to read again', () => {
    expect(echoVerdict(-10, -14)).toBe('ref');
    expect(echoVerdict(-14, -10)).toBe('partner');
    expect(echoVerdict(-10, -10.5)).toBe('tie');
    expect(echoVerdict(-Infinity, -Infinity)).toBe('tie');
  });

  it('a Lv5 fight on a pair word sometimes asks the pair, once; a right answer hits and is recorded', () => {
    const s = newGame('T', 'student', Date.now());
    s.level = 5;
    s.hp = 999;
    const w = WORDS.find((x) => x.de === 'Tür')!;
    let asked = 0;
    for (let seed = 0; seed < 40; seed++) {
      const rng = makeRng(seed);
      const b = startBattle(s, w, rng);
      b.kind = 'shadow';
      b.step = 2;
      b.monster.hp = 9999;
      let inFight = 0;
      for (let turn = 0; turn < 4; turn++) {
        const q = makeQuestion(s, b, 'attack', rng);
        if (q.echo) {
          inFight++;
          q.echo.say = true;
          const r = resolveTurn(s, b, 'attack', q, q.echo.target, rng);
          expect(r.correct).toBe(true);
        } else resolveTurn(s, b, 'attack', q, q.answer ?? '', rng);
        if (b.outcome) break;
      }
      expect(inFight).toBeLessThanOrEqual(1);
      asked += inFight;
    }
    expect(asked).toBeGreaterThan(5);
    expect(s.pron?.iü?.ok).toBe(asked);
  });
});
