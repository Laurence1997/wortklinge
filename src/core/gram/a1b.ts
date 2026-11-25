// A1 补全第二批 (游戏设计 十六「语法线」): kein 还是 nicht (5 级, 跟 kein 一起) · 时间介词 am / um / im (10 级) ·
// 与格代词 mir / dir + helfen 等 (15 级). Each hangs on the word monster in front of you.

import { pick, shuffle, type Rng } from '../rng';
import { DAT_PRON_ZH, DAT_VERBS, TIME_PREP } from '../../data/grammar/a1b';
import type { Word } from '../types';
import type { GramTask } from './task';
import { EIN_END, FOCUS_PARTICLE, nounSlots } from './a1';

const tidy = (s: string) => s.replace(/\s+/g, ' ').replace(/\s+([.,!?])/g, '$1').trim();
const PREPS = new Set(['in', 'an', 'auf', 'mit', 'zu', 'von', 'bei', 'aus', 'nach', 'für', 'durch', 'um', 'ohne', 'gegen', 'neben', 'über', 'unter', 'vor', 'hinter', 'zwischen']);

/** kein 还是 nicht (5 级): negate this noun's sentence. ein + noun → kein; der/die/das + noun as the last object → … nicht.
 *  Choice between the two negations, so the rule (kein negates an indefinite noun, nicht the rest) is what is tested. */
export function nichtTask(w: Word, rng: Rng): GramTask | null {
  const slots = nounSlots(w, false).filter((x) => x.c === 'acc' && /^[.!?]?$/.test(x.after.trim()) && !PREPS.has(x.before.trim().split(' ').pop()?.toLowerCase() ?? ''));
  const usable = slots.filter((x) => x.before.trim().split(' ').length >= 2 && !/\?$/.test(x.after.trim()) && !FOCUS_PARTICLE.test(x.before) && !/\bgern\b/i.test(x.before));
  if (!usable.length) return null;
  const x = pick(rng, usable);
  const end = /[.!]$/.test(x.after.trim()) ? x.after.trim() : '.';
  const orig = tidy(`${x.before}${x.art} ${w.de}${end}`);
  const kein = tidy(`${x.before}kein${EIN_END.acc[x.g]} ${w.de}${end}`);
  const nicht = tidy(`${x.before}${x.art} ${w.de} nicht${end}`);
  const wrongNicht = tidy(`${x.before}nicht ${x.art} ${w.de}${end}`);
  const answer = x.indef ? kein : nicht;
  const wrong = x.indef ? wrongNicht : kein;
  return {
    sys: 'nicht',
    prompt: `否定：选出这句正确的否定说法 · ${x.zh}`,
    focus: orig,
    answer,
    options: shuffle(rng, [answer, wrong]),
    tier: 0,
    rule: 'ein + 名词（或不带冠词的名词）用 kein 否定；der/die/das + 名词用 nicht，放到句末',
    full: answer,
    wordId: w.id,
  };
}

/** 时间介词 (10 级): am Montag, um acht Uhr, im Mai, in der Nacht — on time-word monsters. */
export function timePrepTask(w: Word, rng: Rng): GramTask | null {
  const row = TIME_PREP[w.de];
  if (!row) return null;
  const [de, zh] = pick(rng, row.frames);
  const first = de.startsWith('___');
  const ans = first ? row.ans[0].toUpperCase() + row.ans.slice(1) : row.ans;
  return {
    sys: 'timePrep',
    prompt: `时间介词：填 am / um / im（夜里是 in der）· ${zh}`,
    focus: de,
    answer: ans,
    alts: [row.ans],
    tier: 1,
    rule: '星期、一天的时段、周末用 am；钟点用 um；月份、季节用 im；夜里说 in der Nacht',
    full: de.replace('___', ans),
    zh,
    wordId: w.id,
  };
}

/** 与格代词 (15 级): helfen, gefallen, schmecken, gehören … take mir / dir / ihm / ihr / uns / Ihnen. */
export function datPronTask(w: Word, rng: Rng): GramTask | null {
  const rows = DAT_VERBS[w.de];
  if (!rows || w.pos !== 'v') return null;
  const [de, ans, zh] = pick(rng, rows);
  return {
    sys: 'datPron',
    prompt: `与格代词：${w.de} 后面的人用第三格（mir / dir / ihm / ihr / uns / Ihnen）· ${zh}`,
    focus: `${de}（${DAT_PRON_ZH[ans] ?? ''}）`,
    answer: ans,
    tier: 1,
    rule: `${w.de} 要第三格：ich → mir，du → dir，er → ihm，sie → ihr，wir → uns，Sie → Ihnen`,
    full: de.replace('___', ans),
    zh,
    wordId: w.id,
  };
}
