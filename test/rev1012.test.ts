import { describe, expect, it } from 'vitest';
import { WORDS } from '../src/data/words';
import { usesWord } from '../src/core/journal';
import { gradeCloze } from '../src/core/cloze';

const w = (de: string) => WORDS.find((x) => x.de === de)!;

describe('1.0.12 review: 造句 usesWord', () => {
  it('accepts the forms learners write', () => {
    for (const [de, s] of [
      ['essen', 'Iss dein Brot!'], ['lesen', 'Lies das Buch!'], ['vergessen', 'Vergiss es nicht!'], ['helfen', 'Hilf mir bitte!'],
      ['vorbereiten', 'Ich bereitete alles vor.'], ['zubereiten', 'Ich bereitete das Essen zu.'], ['beantragen', 'Ich beantragte ein Visum.'],
      ['schalten', 'Er schaltete das Licht ein.'], ['heiraten', 'Sie heirateten im Mai.'], ['veranlassen', 'Er veranlasste alles.'],
      ['verbringen', 'Wir verbrachten den Sommer dort.'], ['nachdenken', 'Ich dachte lange nach.'], ['erschrecken', 'Er erschrak sehr.'],
      ['anfangen', 'Sie fing sofort an.'], ['einladen', 'Ich habe dich eingeladen.'], ['aufstehen', 'Es ist schwer, früh aufzustehen.'],
    ] as const) expect(usesWord(s, w(de)), `${de}: ${s}`).toBe(true);
  });

  it('does not count unrelated words', () => {
    for (const [de, s] of [
      ['werden', 'Wir gehen nach Hause.'], ['bereiten', 'Sie beritt das Pferd.'], ['verstehen', 'Ich stehe hier.'],
      ['bekommen', 'Ich komme heute.'], ['einkaufen', 'Ich kaufe heute Brot.'], ['anrufen', 'Ich habe gerufen und gewartet.'],
    ] as const) expect(usesWord(s, w(de)), `${de}: ${s}`).toBe(false);
  });
});

describe('1.0.12 review: cloze determiners', () => {
  it('这不是 still asks for kein, and a kein answer is not matched by der / ein', () => {
    expect(gradeCloze('der Nachbar', 'kein Nachbar', w('Nachbar'), '这不是邻居。')).toBe(false);
    expect(gradeCloze('ein Nachbar', 'kein Nachbar', w('Nachbar'), '他不是邻居。')).toBe(false);
    expect(gradeCloze('ein Nachbar', 'der Nachbar', w('Nachbar'), '这是邻居。')).toBe(true);
  });
});
