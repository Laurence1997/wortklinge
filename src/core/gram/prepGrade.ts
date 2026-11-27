// 介词空 (游戏设计 六「介词空」, rev 707): rule-based grading, no AI. Kept free of data imports so task.ts can use it.
// Contractions and the written-out form both count (im = in dem); a right preposition with the wrong case is wrong
// and says why; common miscollocations of Chinese speakers get their own hint.

import { normalize } from '../grading';

export type PrepCat = 'time' | 'dat' | 'acc' | 'two' | 'verb' | 'gen';
export type Kase = 'A' | 'D' | 'G';
export type Gender = 'm' | 'f' | 'n' | 'pl';

export interface PrepInfo {
  /** The preposition as written out (zum → zu). */
  prep: string;
  cat: PrepCat;
  /** Case after it, when the sentence shows it. */
  kase?: Kase | null;
  /** The determiner in the answer (dem, einen, meiner …), null for a bare preposition. */
  det?: string | null;
  /** Gender / number of the noun after it (noun monsters). */
  g?: Gender | null;
  /** The noun with its article (der Bus) for the explanation. */
  noun?: string;
  /** 动介搭配: e.g. 'warten auf + Akk.' and the verb (warten). */
  combo?: string;
  verb?: string;
  /** Other determiners that count (the Chinese doesn't say 这 / 一个 / 我的). */
  dets?: string[];
  /** Set on 介词空 questions (the 介词秘境 only records the preposition for the error weights). */
  blank?: boolean;
}

export const CONTRACT: Record<string, [string, string]> = {
  im: ['in', 'dem'],
  ins: ['in', 'das'],
  am: ['an', 'dem'],
  ans: ['an', 'das'],
  zum: ['zu', 'dem'],
  zur: ['zu', 'der'],
  beim: ['bei', 'dem'],
  vom: ['von', 'dem'],
  aufs: ['auf', 'das'],
  ums: ['um', 'das'],
  fuers: ['fuer', 'das'],
  uebers: ['ueber', 'das'],
  durchs: ['durch', 'das'],
};

/** "Im" / "in dem" → ['in', 'dem']; "mit" → ['mit']. Normalized (ü → ue). */
export function prepParts(v: string): string[] {
  const t = normalize(v).split(' ').filter(Boolean);
  if (!t.length) return [];
  const c = CONTRACT[t[0]];
  return c ? [...c, ...t.slice(1)] : t;
}

const KASE_ZH: Record<Kase, string> = { A: '第四格', D: '第三格', G: '第二格' };

/** Definite-article equivalent of a determiner (einem → dem, meine → die), or null. */
export function defOf(det: string): string | null {
  const d = normalize(det);
  if (/^(der|die|das|den|dem|des)$/.test(d)) return d;
  const dies = /^(dies|jed|welch)(er|e|es|en|em)$/.exec(d);
  if (dies) return { er: 'der', e: 'die', es: 'das', en: 'den', em: 'dem' }[dies[2]]!;
  const m = /^(k?ein|mein|dein|sein|ihr|unser|eur|euer)(e|en|em|er|es)?$/.exec(d);
  if (!m) return null;
  return { '': 'ein', e: 'die', en: 'den', em: 'dem', er: 'der', es: 'des' }[m[2] ?? '']!;
}

const CASE_TABLE: Record<Gender, Partial<Record<string, Kase | 'N'>>> = {
  m: { der: 'N', den: 'A', dem: 'D', des: 'G', ein: 'N' },
  f: { die: 'A', der: 'D' },
  n: { das: 'A', dem: 'D', des: 'G', ein: 'A' },
  pl: { die: 'A', den: 'D', der: 'G' },
};

/** The case a determiner shows on a noun of this gender (after a preposition: die / das = Akk.). */
export function caseOfDet(det: string, g: Gender): Kase | null {
  const d = defOf(det);
  const c = d ? CASE_TABLE[g][d] : undefined;
  return c && c !== 'N' ? c : null;
}

/** The same determiner in the other case (dem ↔ den for der-words), for the 3-choice fallback. */
export function otherCaseDet(det: string, g: Gender, kase: Kase): string | null {
  const want: Kase = kase === 'D' ? 'A' : 'D';
  const def = Object.entries(CASE_TABLE[g]).find(([, c]) => c === want)?.[0];
  if (!def) return null;
  const d = normalize(det);
  const from = defOf(d);
  if (!from) return null;
  if (/^(der|die|das|den|dem|des)$/.test(d)) return def;
  const stem = /^(dies|jed|welch|k?ein|mein|dein|sein|ihr|unser|eur|euer)/.exec(d)?.[1] ?? '';
  const end = { der: 'er', die: 'e', das: stem.match(/^(dies|jed|welch)$/) ? 'es' : '', den: 'en', dem: 'em', des: 'es' }[def] ?? '';
  return (stem === 'euer' && end ? 'eur' : stem) + end;
}

/** Common miscollocations (wrong → right): their own hint before the general rule. */
const MIX: Record<string, string> = {
  'fuer>auf': '等、期待、准备某事用 auf，别把中文的「为……」直译成 für',
  'in>nach': '去城市、国家（不带冠词）用 nach，不用 in',
  'nach>zu': '去某人那里、去具体的地方或机构用 zu（zum Arzt, zur Post）；nach 只接地名和 Hause',
  'in>zu': '去某人那里、去机构办事用 zu（zum Arzt, zur Bank）',
  'zu>nach': '城市、国家这类地名和 Hause 用 nach',
  'zu>in': '进到一个空间里面（ins Kino, in die Stadt）用 in',
  'seit>vor': '「……之前」用 vor + 第三格；seit 是「自从……一直到现在」',
  'vor>seit': '从过去一直持续到现在用 seit（seit zwei Jahren）',
  'in>an': '星期、日期、一天的时段用 an（am Montag）；靠在边上、贴着表面也用 an',
  'an>um': '几点钟用 um（um acht Uhr）',
  'in>um': '几点钟用 um（um acht Uhr）',
  'um>am': '星期和一天的时段用 am，um 只接钟点',
  'in>auf': '在公共场所、平面上用 auf（auf dem Markt, auf der Straße, auf dem Tisch）',
  'auf>in': '在一个封闭空间里面用 in（im Zimmer, in der Küche）',
  'auf>an': '贴着、靠着、在边上用 an（an der Wand, am Fenster）',
  'an>auf': '在上面（压在平面上）用 auf；an 是贴在边上',
  'von>aus': '来自某个国家城市、从里面出来用 aus',
  'aus>von': '从某人那里、从某个点离开用 von',
  'bei>mit': '和某人一起用 mit；bei 是在某人那里',
  'mit>bei': '在某人家里、在某个公司用 bei',
  'zu>bei': '已经在那里（在医生那儿）用 bei；去那里才用 zu',
  'bei>zu': '去某人那里用 zu；已经在那里才用 bei',
  'ueber>auf': 'sich freuen auf = 期待还没发生的事；über 是为已经发生的事高兴',
  'auf>ueber': '为已经发生的事高兴、谈论某事用 über',
};

const VERB_MIX = ['fuer>auf', 'ueber>auf', 'auf>ueber'];

export interface PrepVerdict {
  ok: boolean;
  why?: string;
}

const show = (v: string) => v;

/** Grade a 介词空 answer. `answer` is what the sentence had (Am / zum / mit dem / auf). */
export function gradePrep(input: string, answer: string, x: PrepInfo): PrepVerdict {
  const a = prepParts(answer);
  const i = prepParts(input);
  if (!i.length) return { ok: false, why: rule(x, answer) };
  if (i.join(' ') === a.join(' ')) return { ok: true };
  // Another determiner of the same case and gender (den / einen) when the Chinese doesn't say which.
  if (i[0] === a[0] && i.length === 2 && a.length === 2 && x.dets?.some((d) => normalize(d) === i[1])) return { ok: true };
  if (i[0] === a[0]) {
    // Right preposition: the case (or the determiner) is wrong.
    if (a.length === 1) return { ok: false, why: `${a[0]} 后面这里不用冠词，只填介词。${rule(x, answer)}` };
    if (i.length === 1) return { ok: false, why: `介词对了，冠词也要填：这里是 ${answer}。${rule(x, answer)}` };
    const ik = x.g ? caseOfDet(i[1], x.g) : null;
    if (x.kase && ik && ik !== x.kase) return { ok: false, why: caseWhy(x, answer) };
    return { ok: false, why: `格对了，冠词按句子的意思要用 ${a[1]}。` };
  }
  const key = `${i[0]}>${a[0]}`;
  // After a verb that pairs with the preposition, only the pairing hints apply (no 「去城市用 nach」 for fragen nach).
  const mix = x.combo ? (VERB_MIX.includes(key) ? MIX[key] : undefined) : MIX[key];
  const pair = x.combo && x.cat !== 'verb' ? `${x.combo}。` : '';
  return { ok: false, why: `${mix ? `${mix}。` : ''}${pair}${rule(x, answer)}` };
}

/** Why the case is this one: mit → always Dat., wohin → Akk., warten auf + Akk. */
export function caseWhy(x: PrepInfo, answer: string): string {
  const k = x.kase ? KASE_ZH[x.kase] : '';
  const want = answer.includes(' ') ? answer.split(' ').slice(1).join(' ') : x.det ? `${answer}（${x.prep} ${x.det}）` : answer;
  const noun = x.noun ? `：${x.noun.split(' ').slice(-1)[0]} 是 ${nounArt(x)} 词，这里要 ${want}` : `，这里是 ${answer}`;
  if (x.cat === 'verb' && x.combo) return `${x.verb ?? ''} 搭 ${x.prep} + ${k}${noun}`.replace(/^ 搭/, '搭');
  if (x.cat === 'two') return `${x.kase === 'A' ? '去到、放到哪里（wohin）用第四格' : '在哪里（wo）用第三格'}${noun}`;
  if (x.cat === 'gen') return `${x.prep} 接第二格${noun}`;
  if (x.cat === 'time') return `时间里的 ${x.prep} 接${k}${noun}`;
  return `${x.prep} 永远接${k}${noun}`;
}

function nounArt(x: PrepInfo): string {
  return x.g === 'pl' ? '复数' : x.g === 'm' ? 'der' : x.g === 'f' ? 'die' : 'das';
}

/** The one-line rule shown after a wrong answer. */
export function rule(x: PrepInfo, answer: string): string {
  if (x.kase && x.det) return caseWhy(x, answer);
  if (x.cat === 'verb' && x.combo) return `${x.combo}：这里填 ${show(answer)}`;
  if (x.cat === 'two' && x.kase) return caseWhy(x, answer);
  return `这里是 ${show(answer)}`;
}
