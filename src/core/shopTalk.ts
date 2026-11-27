// 商店说德语 (Lucas 2026-11-27, 1.0.10): buying and selling is a plain click; saying it in German is optional and pays
// (buy 10% off, sell 10% more). The buying sentence grows with the player's level:
//   A1 (1–30)   Ich nehme den Stift.
//   A2 (31–80)  Ich hätte gern den Stift.
//   B1+ (81–)   Könnten Sie mir den Stift geben?
// Selling at every level: Ich möchte den Stift verkaufen.
// Graded by fixed patterns, no AI. The noun must carry a correct accusative article (definite, indefinite or dies-);
// ae/oe/ue/ss count the same as ä/ö/ü/ß, punctuation and capitals do not matter, 「bitte」 may go anywhere.
// A sentence of a higher level than yours also counts; one of a lower level does not (it is the practice).

import { normalize, type Verdict } from './grading';

export type Gender = 'm' | 'f' | 'n';
export interface ShopNoun {
  /** Noun without article, as written (Stift, Brille, Wörterbuch). */
  de: string;
  g: Gender;
  /** Article used in the model sentence: the shelf item is a definite one, a consumable an indefinite one. */
  model: 'def' | 'indef';
}

export const SAY_DISCOUNT = 0.1;
export const SAY_SELL_BONUS = 0.1;

const ACC: Record<Gender, { def: string; indef: string; dies: string }> = {
  m: { def: 'den', indef: 'einen', dies: 'diesen' },
  f: { def: 'die', indef: 'eine', dies: 'diese' },
  n: { def: 'das', indef: 'ein', dies: 'dieses' },
};
const NOM: Record<Gender, string> = { m: 'der', f: 'die', n: 'das' };
const GENDER_ZH: Record<Gender, string> = { m: '阳性', f: '阴性', n: '中性' };

export interface BuyPattern {
  tier: 1 | 2 | 3;
  cefr: string;
  /** Shown to the player. */
  show: string;
  zh: string;
  /** Normalized lead words and tail words around the noun phrase; alternatives allowed. */
  leads: string[];
  tail: string;
  build: (np: string) => string;
}

export const BUY_PATTERNS: BuyPattern[] = [
  { tier: 1, cefr: 'A1', show: 'Ich nehme + 第四格', zh: '我要……', leads: ['ich nehme'], tail: '', build: (np) => `Ich nehme ${np}.` },
  { tier: 2, cefr: 'A2', show: 'Ich hätte gern + 第四格', zh: '我想要……（客气）', leads: ['ich haette gern', 'ich haette gerne'], tail: '', build: (np) => `Ich hätte gern ${np}.` },
  {
    tier: 3,
    cefr: 'B1',
    show: 'Könnten Sie mir + 第四格 + geben?',
    zh: '您能给我……吗？（更客气）',
    leads: ['koennten sie mir', 'koennen sie mir'],
    tail: 'geben',
    build: (np) => `Könnten Sie mir ${np} geben?`,
  },
];

export const SELL_PATTERN = { show: 'Ich möchte + 第四格 + verkaufen', leads: ['ich moechte'], tail: 'verkaufen', build: (np: string) => `Ich möchte ${np} verkaufen.` };

/** A1 up to Lv30, A2 up to Lv80, B1 from Lv81 on (B2 keeps the B1 sentence). */
export function buyTier(level: number): 1 | 2 | 3 {
  return level <= 30 ? 1 : level <= 80 ? 2 : 3;
}

export function buyPattern(level: number): BuyPattern {
  return BUY_PATTERNS[buyTier(level) - 1];
}

function modelNp(n: ShopNoun): string {
  return `${ACC[n.g][n.model]} ${n.de}`;
}

export function buyModel(level: number, n: ShopNoun): string {
  return buyPattern(level).build(modelNp(n));
}

export function sellModel(n: ShopNoun): string {
  return SELL_PATTERN.build(modelNp(n));
}

/** Normalized, with every standalone 「bitte」 dropped. */
function clean(s: string): string {
  return normalize(s)
    .split(' ')
    .filter((w) => w && w !== 'bitte')
    .join(' ');
}

/** What sits between lead and tail, or null when the frame does not fit. */
function middle(got: string, leads: string[], tail: string): string | null {
  for (const lead of leads) {
    if (got !== lead && !got.startsWith(`${lead} `)) continue;
    let rest = got.slice(lead.length).trim();
    if (tail) {
      if (rest !== tail && !rest.endsWith(` ${tail}`)) continue;
      rest = rest.slice(0, rest.length - tail.length).trim();
    }
    return rest;
  }
  return null;
}

function npNotes(np: string, n: ShopNoun): string[] {
  const noun = normalize(n.de);
  const words = np.split(' ').filter(Boolean);
  const ok = Object.values(ACC[n.g]);
  if (words.length === 2 && words[1] === noun && ok.includes(words[0])) return [];
  if (!words.includes(noun)) return [`要说出东西的名字：${NOM[n.g]} ${n.de}（第四格 ${modelNp(n)}）`];
  const art = words[words.indexOf(noun) - 1];
  if (!art) return [`${n.de} 前面要带冠词：${modelNp(n)}`];
  if (n.g === 'm') return [`${n.de} 是阳性（der ${n.de}），做宾语要变第四格：den / einen ${n.de}`];
  return [`${n.de} 是${GENDER_ZH[n.g]}（${NOM[n.g]} ${n.de}），第四格不变：${ACC[n.g].def} / ${ACC[n.g].indef} ${n.de}`];
}

/** Buying sentence for this level (or a higher one). */
export function gradeShopBuy(input: string, level: number, n: ShopNoun): Verdict {
  const got = clean(input);
  const tier = buyTier(level);
  const correct = buyModel(level, n);
  for (const p of BUY_PATTERNS) {
    const np = middle(got, p.leads, p.tail);
    if (np === null) continue;
    if (p.tier < tier) return { ok: false, notes: [`${p.cefr} 的说法这一级不算了，换成：${buyPattern(level).show}`], correct };
    const notes = npNotes(np, n);
    return { ok: notes.length === 0, notes, correct };
  }
  return { ok: false, notes: [`句型是：${buyPattern(level).show}`], correct };
}

export function gradeShopSell(input: string, n: ShopNoun): Verdict {
  const got = clean(input);
  const correct = sellModel(n);
  const np = middle(got, SELL_PATTERN.leads, SELL_PATTERN.tail);
  if (np === null) return { ok: false, notes: [`句型是：${SELL_PATTERN.show}`], correct };
  const notes = npNotes(np, n);
  return { ok: notes.length === 0, notes, correct };
}

export function saidPrice(full: number): number {
  return Math.max(1, Math.round(full * (1 - SAY_DISCOUNT)));
}

export function saidSellPrice(full: number): number {
  return Math.max(full + 1, Math.round(full * (1 + SAY_SELL_BONUS)));
}
