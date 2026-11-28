// 书写者「墨水风暴」(游戏设计 十 书写者, Lucas 2026-11-25 卡片 A): write 2–3 forms of the target monster's own word,
// one after another; the first wrong one stops the chain. Damage = attack × (1 + 0.5 × forms right), so short words
// don't lose out. All forms right counts as 会写 and can be the 归名 blow. Only forms the player has unlocked:
//   nouns: der Markt → die Märkte → Ich suche den Markt (accusative in a short frame); singular-only or plural-only
//          nouns swap the plural for the dative (mit dem …).
//   verbs: machen → er macht → hat gemacht (21+; before that the du form).
//   adjectives: the word → the phrase it has in its example (comparative from 41 once there is data).
//   anything else (phrases, question words): the word itself → its example phrase.
// Two forms before Lv21, three from Lv21.

import { CONFIG } from './config';
import { gradeTyped, normalize } from './grading';
import { EXAMPLES, parse } from './cloze';
import { CONJ } from '../data/verbs';
import { PERFEKT } from '../data/perfekt';
import { fullForm, genderOf } from '../data/words';
import type { Word } from './types';
import { UNLOCK } from './unlocks';

export interface StormForm {
  /** What to write, in Chinese (the box label). */
  label: string;
  answer: string;
  /** Graded like a dictionary entry with its article (the first noun form). */
  dict?: boolean;
}

const DEF: Record<'acc' | 'dat', Record<'m' | 'f' | 'n' | 'pl', string>> = {
  acc: { m: 'den', f: 'die', n: 'das', pl: 'die' },
  dat: { m: 'dem', f: 'der', n: 'dem', pl: 'den' },
};

/** Dative plural adds -n unless the plural already ends in -n or -s (den Kindern, den Autos). */
export function datPlural(pl: string): string {
  return /[ns]$/.test(pl) ? pl : `${pl}n`;
}

function examplePhrases(w: Word): StormForm[] {
  const out: StormForm[] = [];
  for (const line of EXAMPLES[w.id] ?? []) {
    const p = parse(line);
    if (!p) continue;
    if (normalize(p.blank) === normalize(w.de)) continue;
    out.push({ label: `例句里的说法：${`${p.before}___${p.after}`.replace(/\s+/g, ' ').trim()}`, answer: p.blank });
  }
  return out;
}

const KEIN_ACC: Record<'m' | 'f' | 'n' | 'pl', string> = { m: 'keinen', f: 'keine', n: 'kein', pl: 'keine' };

/** The forms the chain asks, in order, for this player's level (2 before Lv21, 3 from Lv21). */
export function stormForms(level: number, w: Word, conjOpen: boolean): StormForm[] {
  const want = level >= CONFIG.perfekt.from ? 3 : 2;
  const out: StormForm[] = [];
  if (w.art) {
    const g = (genderOf(w) ?? 'n') as 'm' | 'f' | 'n' | 'pl';
    out.push({ label: '原形，带冠词', answer: fullForm(w), dict: true });
    const hasPl = !!w.pl && w.pl !== '-' && !w.plOnly && w.pl !== w.de;
    const plOpen = level >= UNLOCK.plural;
    const datOpen = level >= CONFIG.phase.datFrom;
    const accOpen = level >= CONFIG.phase.accFrom;
    if (hasPl && plOpen) out.push({ label: '复数，带 die', answer: `die ${w.pl}` });
    else if (datOpen) out.push({ label: 'mit ___（第三格）', answer: `${DEF.dat[g]} ${g === 'pl' ? datPlural(w.de) : w.de}` });
    if (accOpen && (g === 'm' || out.length < want)) out.push({ label: 'Ich suche ___（第四格）', answer: `${DEF.acc[g]} ${w.de}` });
  } else if (w.pos === 'v' && CONJ[w.de]) {
    out.push({ label: '原形', answer: w.de });
    if (conjOpen) {
      out.push({ label: 'er ___（现在时）', answer: CONJ[w.de].forms.er });
      const pf = PERFEKT[w.de];
      const ppLv = !pf ? Infinity : pf.kind === 'reg' ? CONFIG.perfekt.from : pf.kind === 'irr' ? CONFIG.perfekt.irregularFrom : CONFIG.perfekt.prefixFrom;
      if (pf && level >= ppLv) out.push({ label: '完成时：er ___（hat / ist + 分词）', answer: `${pf.aux === 'sein' ? 'ist' : 'hat'} ${pf.pp}` });
      else out.push({ label: 'du ___（现在时）', answer: CONJ[w.de].forms.du });
    }
  } else {
    out.push({ label: w.pos === 'adj' ? '原形' : '这个说法', answer: w.de });
  }
  // Drop repeats first (der Kuchen → die Kuchen is fine, but «die Eltern» or «das Wasser» twice is not), then top up
  // (试玩 #57: das Wasser has no plural and its accusative is the dictionary form, so it ended with one box).
  const seen = new Set<string>();
  const res: StormForm[] = [];
  const add = (f: StormForm) => {
    if (res.length < want && !seen.has(normalize(f.answer))) seen.add(normalize(f.answer)), res.push(f);
  };
  out.forEach(add);
  examplePhrases(w).forEach(add);
  // Nouns: the negation with kein (open since Lv5) fits any noun, countable or not.
  if (w.art) add({ label: 'Ich habe ___（否定：没有，用 kein）', answer: `${KEIN_ACC[(genderOf(w) ?? 'n') as 'm' | 'f' | 'n' | 'pl']} ${w.de}` });
  return res;
}

/** How many forms were right before the first wrong one. Input = the boxes joined with |. */
/** Forms right in a row; a miss stops the chain. 天赋「续写」(keepGoing): a miss is skipped and the chain goes on
 *  (the missed form counts for nothing, and `all` is then false). */
export function gradeStorm(w: Word, forms: StormForm[], input: string, keepGoing = false): { n: number; notes: string[]; all: boolean } {
  const parts = input.split('|');
  let n = 0;
  let miss = false;
  const notes: string[] = [];
  for (let i = 0; i < forms.length; i++) {
    const f = forms[i];
    const v = f.dict ? gradeTyped(parts[i] ?? '', w, true) : gradeTyped(parts[i] ?? '', { ...w, de: f.answer, art: undefined, refl: undefined }, false);
    if (!v.ok) {
      miss = true;
      if (!keepGoing) {
        notes.push(`第 ${i + 1} 个写错了，连写到这里停：${f.answer}`);
        break;
      }
      notes.push(`第 ${i + 1} 个写错了（续写：跳过，接着写）：${f.answer}`);
      continue;
    }
    n += 1;
  }
  return { n, notes, all: !miss && n === forms.length };
}
