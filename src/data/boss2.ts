// Region 2 boss: 吞秤者 · Der Waagenfresser, deep in the granary (Lv18).
// A timed conversation about prices and quantities. Each question shows a price tag or a count;
// the numbers are random, so you answer by reading them, not by memorising.
// Written by Claude; needs a native-speaker check.

import type { BossQuestion } from './boss';
import { BOSS_QUESTIONS } from './boss';
import { pick, type Rng } from '../core/rng';
import { normalize } from '../core/grading';
import { WORDS } from './words';
import type { Word } from '../core/types';

export const BOSS2 = {
  name: '吞秤者',
  de: 'Der Waagenfresser',
  intro: [
    '粮仓最深处，一杆秤歪在地上，秤盘里坐着一团东西。它把秤砣一个一个吞下去，又吐出来数。',
    '「Was kostet das? Was kostet DAS?」它不停地问，问完就咬。',
    '系统：看清价签和数量，用完整的德语句子回答价格和数目。数字要写成单词。',
  ],
  healLine: 'Ich zähle nach.',
  healZh: '我再数一遍。（它要回血！下一题答对才能抢在它回血前打倒它）',
  outro: [
    '秤砣滚了一地。那团东西缩成了一杆普普通通的秤。',
    '「… Stimmt so.」它的声音最后一次响起，像是找给你的零钱。',
    '系统：集市的秤，又能称出真东西了。',
  ],
};

const UNITS = ['', 'eins', 'zwei', 'drei', 'vier', 'fünf', 'sechs', 'sieben', 'acht', 'neun'];
const TEENS = ['zehn', 'elf', 'zwölf', 'dreizehn', 'vierzehn', 'fünfzehn', 'sechzehn', 'siebzehn', 'achtzehn', 'neunzehn'];
const TENS = ['', '', 'zwanzig', 'dreißig', 'vierzig', 'fünfzig', 'sechzig', 'siebzig', 'achtzig', 'neunzig'];

/** German number words 1–99 (eins → ein- inside compounds: einundzwanzig). */
export function numDe(n: number): string {
  if (n < 10) return UNITS[n];
  if (n < 20) return TEENS[n - 10];
  const t = Math.floor(n / 10);
  const u = n % 10;
  return u ? `${u === 1 ? 'ein' : UNITS[u]}und${TENS[t]}` : TENS[t];
}

/** 250 cents → "zwei Euro fünfzig"; 100 → "ein Euro"; 50 → "fünfzig Cent". */
export function priceDe(cents: number): string {
  const e = Math.floor(cents / 100);
  const c = cents % 100;
  if (!e) return `${numDe(c)} Cent`;
  const eu = e === 1 ? 'ein Euro' : `${numDe(e)} Euro`;
  return c ? `${eu} ${numDe(c)}` : eu;
}

export function priceTag(cents: number): string {
  return `${Math.floor(cents / 100)},${String(cents % 100).padStart(2, '0')} €`;
}

/** Regex (on normalized text) for a spoken price, forgiving einen/ein, "und", "Cent". */
function priceRe(cents: number): string {
  const e = Math.floor(cents / 100);
  const c = cents % 100;
  const n = (x: number) => normalize(numDe(x));
  if (!e) return `${n(c)} cent`;
  const eu = e === 1 ? '(ein|einen|eins) euro' : `${n(e)} euro`;
  return c ? `${eu} (und )?${n(c)}( cent)?` : `${eu}`;
}

const cap = (s: string) => s[0].toUpperCase() + s.slice(1);

function foods(): Word[] {
  return WORDS.filter((w) => w.region === 2 && w.pos === 'n' && w.family === 'krume');
}

function priceQuestion(rng: Rng): BossQuestion {
  const w = pick(rng, foods());
  const cents = (1 + Math.floor(rng() * 9)) * 100 + pick(rng, [0, 0, 20, 50, 50, 80, 90]);
  const nounRe = normalize(`${w.art} ${w.de}`);
  return {
    id: `price-${w.id}`,
    ask: [`Was kostet ${w.art} ${w.de}?`, `Wie viel kostet ${w.art} ${w.de}?`],
    zh: `问${w.zh}多少钱`,
    visual: `${w.art} ${w.de} · ${priceTag(cents)}`,
    accept: [new RegExp(`^((${nounRe}|es|das|er|sie) )?(kostet )?${priceRe(cents)}$`)],
    model: `${cap(w.art!)} ${w.de} kostet ${priceDe(cents)}.`,
    traps: [[/\d/, '数字要写成单词：zwei Euro fünfzig'], [/kosten /, '单数用 kostet：Das Brot kostet …']],
  };
}

function countQuestion(rng: Rng): BossQuestion {
  const w = pick(rng, foods().filter((x) => x.pl && x.pl !== '-' && x.pl !== x.de));
  const n = 2 + Math.floor(rng() * 8);
  const pl = normalize(w.pl!);
  return {
    id: `count-${w.id}`,
    ask: [`Wie viele ${w.pl} möchtest du?`, `Wie viele ${w.pl} nimmst du?`],
    zh: `问你要几个${w.zh}`,
    visual: `${w.zh} × ${n}`,
    accept: [new RegExp(`^(ich (moechte|nehme|haette gern|haette gerne|kaufe) )?${normalize(numDe(n))} ${pl}( bitte)?$`)],
    model: `Ich möchte ${numDe(n)} ${w.pl}.`,
    traps: [[new RegExp(` ${normalize(w.de)}$`), `数字后面要用复数：${w.pl}`], [/\d/, '数字要写成单词']],
  };
}

function totalQuestion(rng: Rng): BossQuestion {
  const a = pick(rng, foods());
  const b = pick(rng, foods().filter((x) => x !== a));
  const pa = (1 + Math.floor(rng() * 5)) * 100 + pick(rng, [0, 50]);
  const pb = (1 + Math.floor(rng() * 5)) * 100 + pick(rng, [0, 50]);
  const sum = pa + pb;
  return {
    id: `total-${a.id}-${b.id}`,
    ask: ['Was kostet das zusammen?', 'Wie viel macht das zusammen?'],
    zh: '问一共多少钱',
    visual: `${a.de} ${priceTag(pa)}  +  ${b.de} ${priceTag(pb)}`,
    accept: [new RegExp(`^((das|es) )?((kostet|macht) )?(zusammen )?${priceRe(sum)}( zusammen)?$`)],
    model: `Das macht zusammen ${priceDe(sum)}.`,
    traps: [[/\d/, '数字要写成单词']],
  };
}

/** One round: a warm-up from region 1, then prices, counts and totals mixed. */
export function boss2Questions(rng: Rng, warmup: boolean): BossQuestion[] {
  const out: BossQuestion[] = [];
  if (warmup) out.push(BOSS_QUESTIONS.find((q) => q.id === 'name')!);
  const makers = [priceQuestion, countQuestion, priceQuestion, totalQuestion, countQuestion, priceQuestion, totalQuestion, countQuestion];
  for (const m of makers) out.push(m(rng));
  return out;
}
