// 1.0.11 试玩修复 G1 判分: fair grading for Perfekt sentences, Lina's ticket, the region-1 boss, and 终结技 sentences.
import { describe, expect, it } from 'vitest';
import { gradePerfekt } from '../src/data/boss3';
import { linaQuestions } from '../src/data/lina';
import { BOSS_QUESTIONS } from '../src/data/boss';
import { gradeWholeSentence } from '../src/core/cloze';
import { normalize } from '../src/core/grading';
import { availableMoves, makeQuestion, moveReady, phraseCards, resolveTurn, startBattle, startPhraseBattle } from '../src/core/combat';
import { newGame } from '../src/core/state';
import { makeRng } from '../src/core/rng';
import { WORD_BY_ID } from '../src/data/words';

const T0 = Date.UTC(2026, 10, 27, 10);
const accepts = (q: { accept: RegExp[] }, input: string) => q.accept.some((re) => re.test(normalize(input)));

describe('[0] gradePerfekt: inverted word order', () => {
  it('accepts the auxiliary second and the subject right after it', () => {
    expect(gradePerfekt('Um acht Uhr bin ich abgefahren.').ok).toBe(true);
    expect(gradePerfekt('In Brotmarkt bin ich eingestiegen.').ok).toBe(true);
    expect(gradePerfekt('Gestern habe ich Deutsch gelernt.').ok).toBe(true);
    expect(gradePerfekt('Um sieben Uhr sind wir angekommen.').ok).toBe(true);
    expect(gradePerfekt('Ich bin um acht Uhr abgefahren.').ok).toBe(true);
  });
  it('still checks the auxiliary, the subject and the participle', () => {
    const wrongAux = gradePerfekt('Um acht Uhr habe ich abgefahren.');
    expect(wrongAux.ok).toBe(false);
    expect(wrongAux.note).toContain('sein');
    expect(gradePerfekt('Um acht Uhr bin ich abfahren.').ok).toBe(false);
    expect(gradePerfekt('Um acht Uhr ist er abgefahren.').ok).toBe(false);
    expect(gradePerfekt('Um acht Uhr ich bin abgefahren.').ok).toBe(false);
  });
});

describe('[1] Lina ticket: natural polite answers', () => {
  const ticket = linaQuestions(makeRng(1))[0];
  it('accepts combined polite answers', () => {
    expect(ticket.id).toBe('ticket');
    for (const a of ['Bitte schön, hier ist meine Fahrkarte.', 'Hier ist meine Fahrkarte, bitte schön.', 'Bitte sehr, hier ist mein Ticket.', 'Ja, hier ist meine Fahrkarte.', 'Hier, bitte schön!', 'Hier ist meine Fahrkarte.'])
      expect(accepts(ticket, a), a).toBe(true);
  });
  it('still rejects no ticket', () => {
    expect(accepts(ticket, 'Ich habe keine Fahrkarte.')).toBe(false);
    expect(accepts(ticket, 'Nein.')).toBe(false);
  });
});

describe('[7] region-1 boss: phone and siblings', () => {
  const q = (id: string) => BOSS_QUESTIONS.find((x) => x.id === id)!;
  it('phone: any number of 3+ digits in the sentence', () => {
    expect(accepts(q('phone'), 'Meine Handynummer ist 0176 1234567.')).toBe(true);
    expect(accepts(q('phone'), 'Meine Nummer ist 0176 123 456.')).toBe(true);
    expect(accepts(q('phone'), 'Ich habe keine.')).toBe(false);
  });
  it('siblings: Einzelkind, ich habe … Geschwister, keine Geschwister', () => {
    for (const a of ['Ich bin Einzelkind.', 'Ich habe zwei Geschwister.', 'Ich habe keine Geschwister.', 'Keine Geschwister.', 'Nein, ich bin Einzelkind.'])
      expect(accepts(q('siblings'), a), a).toBe(true);
    expect(accepts(q('siblings'), 'Ich habe kein Geschwister.')).toBe(false);
  });
});

describe('[2][5] 终结技 whole sentence: key words in order', () => {
  it('gern and gerne are one word; optional sehr may be left out; meaning changes still fail', () => {
    const absolut = WORD_BY_ID.absolut;
    expect(gradeWholeSentence('Das ist absolut kein Problem, ich helfe dir gerne.', 'Das ist absolut kein Problem, ich helfe dir gern.', absolut).ok).toBe(true);
    expect(gradeWholeSentence('Das ist absolut kein Problem, ich helfe dir.', 'Das ist absolut kein Problem, ich helfe dir gern.', absolut).ok).toBe(false);
    const wasser = WORD_BY_ID.wasser;
    expect(gradeWholeSentence('Das Wasser ist kalt.', 'Das Wasser ist sehr kalt.', wasser).ok).toBe(true);
    expect(gradeWholeSentence('Das Wasser ist wirklich sehr kalt!', 'Das Wasser ist sehr kalt.', wasser).ok).toBe(true);
    expect(gradeWholeSentence('Das Wasser ist nicht kalt.', 'Das Wasser ist sehr kalt.', wasser).ok).toBe(false);
    expect(gradeWholeSentence('Das Wasser ist warm.', 'Das Wasser ist sehr kalt.', wasser).ok).toBe(false);
    // The monster's own word is never optional.
    expect(gradeWholeSentence('Das ist gut.', 'Das ist sehr gut.', WORD_BY_ID.sehr).ok).toBe(false);
  });
  it('another example sentence with the same Chinese counts', () => {
    expect(gradeWholeSentence('Das Wasser ist kalt.', 'Kann ich bitte ein Wasser haben?', WORD_BY_ID.wasser, '水很凉。').ok).toBe(true);
  });
  it('a new word (not in the wordbook): Das Wasser ist kalt. hits for 水很凉。', () => {
    let done = false;
    for (let seed = 1; seed < 60 && !done; seed++) {
      const s = newGame('T', 'student', T0);
      s.level = 5;
      const b = startBattle(s, WORD_BY_ID.wasser, makeRng(seed));
      expect(s.words.wasser).toBeUndefined();
      const q = makeQuestion(s, b, 'sentence', makeRng(seed));
      if (q.answer !== 'Das Wasser ist sehr kalt.') continue;
      done = true;
      const r = resolveTurn(s, b, 'sentence', q, 'Das Wasser ist kalt.', makeRng(seed));
      expect(r.correct).toBe(true);
    }
    expect(done).toBe(true);
  });
});

describe('[6] 残句 fights: no 终结技', () => {
  it('F is not offered and not ready, even with a full resource', () => {
    const s = newGame('T', 'student', T0);
    s.level = 6;
    const b = startPhraseBattle(s, phraseCards()[0].id, makeRng(1), 'echogasse');
    b.cfx.res = 99;
    expect(availableMoves(s, b)).not.toContain('sentence');
    expect(moveReady(s, b, 'sentence')).toBe(false);
    const n = startBattle(s, WORD_BY_ID.tee, makeRng(2));
    expect(availableMoves(s, n)).toContain('sentence');
  });
});
