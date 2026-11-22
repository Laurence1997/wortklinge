import { describe, expect, it } from 'vitest';
import { newGame } from '../src/core/state';
import { makeRng } from '../src/core/rng';
import { WORDS } from '../src/data/words';
import { startBattle, readShown, teachPhase } from '../src/core/combat';
import { articleSlip, shadowOk } from '../src/core/shadow';

describe('0.6.x 读音攻击不漏冠词', () => {
  it('heard article wrong or missing is told apart from a bad noun', () => {
    expect(shadowOk('der Euro', ['das Euro'])).toBe(false);
    expect(articleSlip('der Euro', ['das Euro'])).toBe('das');
    expect(articleSlip('der Euro', ['Euro'])).toBe('');
    expect(articleSlip('der Euro', ['der Ofen'])).toBe(null);
    expect(articleSlip('Hallo', ['hallo'])).toBe(null);
  });

  it('the button shows the bare noun except on the taught turn', () => {
    const s = newGame('T', 'student');
    s.level = 10;
    const w = WORDS.find((x) => x.art && x.pos === 'n' && !x.tutorial && !x.plOnly)!;
    const b = startBattle(s, w, makeRng(1));
    const full = `${w.art} ${w.de}`;
    b.phase = undefined;
    b.phaseTaught = undefined;
    expect(readShown(b, full)).toBe(w.de);
    if (teachPhase(b)) expect(readShown(b, full)).toBe(full);
    b.turn += 1;
    teachPhase(b);
    expect(readShown(b, full)).toBe(w.de);
  });
});
