import { describe, expect, it } from 'vitest';
import { opinionRule } from '../src/core/opinion';

describe('opinion rule (1.0.10 ux)', () => {
  it('accepts z. B. / z.B. as a reason', () => {
    expect(opinionRule('Ich finde das richtig, z. B. kann man im Bus lesen.').ok).toBe(true);
    expect(opinionRule('Ich finde das gut, man liest mehr, z.B. Bücher im Bus.').ok).toBe(true);
  });
  it('accepts pro/contra openers', () => {
    expect(opinionRule('Ich bin dafür, weil man so viel Geld sparen kann.').ok).toBe(true);
    expect(opinionRule('Ich bin dagegen, denn das ist für viele Leute zu teuer.').ok).toBe(true);
    expect(opinionRule('Ich bin gegen Autos in der Stadt, weil sie laut sind.').ok).toBe(true);
    expect(opinionRule('Ich bin fürs Homeoffice, weil man keine Zeit im Bus verliert.').ok).toBe(true);
    expect(opinionRule('Meines Erachtens ist das falsch, weil es niemandem hilft.').ok).toBe(true);
  });
  it('still rejects a non-opener and a missing reason', () => {
    expect(opinionRule('Ich bin fürchterlich müde, weil ich heute viel gearbeitet habe.').ok).toBe(false);
    expect(opinionRule('Ich bin dafür, das ist eine sehr gute Idee für alle.').why).toMatch(/理由/);
    expect(opinionRule('Ich bin der Ansicht, dass Handys stören, weil man nicht lernt.').ok).toBe(true);
  });
});
