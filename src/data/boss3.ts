// Region 3 boss: 晚点之王 · Der König der Verspätung, on the last platform (Lv28).
// A timed conversation with a departure board and a small station map on screen. Three kinds of questions take
// turns: when a train leaves (read the board), how to get to a platform (read the map), and why you are late (Perfekt).
// At half HP the board shifts by ten minutes; time questions after that are answered from the new board.
// Written by Claude; needs a native-speaker check.

import type { BossQuestion } from './boss';
import { pick, shuffle, type Rng } from '../core/rng';
import { normalize } from '../core/grading';
import { numDe } from './boss2';
import { PERFEKT } from './perfekt';

export const BOSS3 = {
  name: '晚点之王',
  de: 'Der König der Verspätung',
  intro: [
    '末班站台。钟停在 23:59，时刻牌上的字一行一行往下掉。一个穿着站长制服的影子坐在长椅上，怀里抱着一只大钟。',
    '「Wann fährt der Zug? Wann? WANN?」它问完自己，又把时刻牌上的时间拨乱。',
    '系统：看时刻牌回答发车时间，看小地图回答怎么走，用完成时回答它的问题。数字要写成单词。',
  ],
  healLine: 'Ich warte noch.',
  healZh: '我还在等。（它要回血！下一题答对才能抢在它回血前打倒它）',
  delayLine: 'Der Zug hat zehn Minuten Verspätung.',
  delayZh: '火车晚点十分钟。（时刻牌上的时间全部往后推了十分钟，之后按新牌子回答）',
  outro: [
    '大钟从它怀里滑下来，指针终于走了一格：零点。',
    '「… pünktlich.」它说完这个词，就散成了一张旧时刻表。',
    '系统：铁轨镇的钟又开始走了。末班车没有来，但下一班会来。',
  ],
};

/** The departure board of one fight: three trains, quarter-hour times between 6:00 and 11:45. */
export interface Board {
  rows: Array<{ dest: string; h: number; m: number }>;
  delay: number;
}

const DESTS = ['Brotmarkt', 'Glutheim', 'Kornspeicher', 'Altstadt'];

export function makeBoard(rng: Rng): Board {
  const dests = shuffle(rng, DESTS).slice(0, 3);
  // One full hour, one half past, one quarter (all three readings come up).
  const ms = shuffle(rng, [0, 30, pick(rng, [15, 45])]);
  const hours = shuffle(rng, [6, 7, 8, 9, 10, 11]).slice(0, 3);
  return { rows: dests.map((dest, i) => ({ dest, h: hours[i], m: ms[i] })), delay: 0 };
}

const at = (r: { h: number; m: number }, delay: number) => {
  const t = r.h * 60 + r.m + delay;
  return { h: Math.floor(t / 60), m: t % 60 };
};

export function boardText(b: Board): string {
  return b.rows.map((r) => {
    const t = at(r, b.delay);
    return `${r.dest.padEnd(13)} ${String(t.h).padStart(2, '0')}:${String(t.m).padStart(2, '0')}`;
  }).join('\n') + (b.delay ? `\n（+${b.delay} Min. Verspätung）` : '');
}

const hourWord = (h: number) => (h === 1 || h === 13 ? 'eins' : numDe(h > 12 ? h - 12 : h));

/** Accepted ways to say a time (normalized): «acht Uhr dreißig», «halb neun», «Viertel nach acht», «zwanzig vor neun». */
export function timeRe(h: number, m: number): string {
  const n = (x: number) => normalize(numDe(x));
  const hw = (x: number) => normalize(hourWord(x));
  const out = [m ? `${n(h)} uhr ${n(m)}` : `${n(h)} uhr`];
  if (m === 0) out.push(hw(h));
  else if (m === 30) out.push(`halb ${hw(h + 1)}`);
  else if (m === 15) out.push(`viertel nach ${hw(h)}`);
  else if (m === 45) out.push(`viertel vor ${hw(h + 1)}`, `dreiviertel ${hw(h + 1)}`);
  else if (m < 30) out.push(`${n(m)} nach ${hw(h)}`);
  else out.push(`${n(60 - m)} vor ${hw(h + 1)}`);
  return `(${out.join('|')})`;
}

/** The time as a model answer says it. */
export function timeDe(h: number, m: number): string {
  if (m === 0) return `${hourWord(h)} Uhr`.replace(/^eins Uhr/, 'ein Uhr');
  if (m === 30) return `halb ${hourWord(h + 1)}`;
  if (m === 15) return `Viertel nach ${hourWord(h)}`;
  if (m === 45) return `Viertel vor ${hourWord(h + 1)}`;
  return `${numDe(h)} Uhr ${numDe(m)}`;
}

function timeQuestion(rng: Rng, board: Board): BossQuestion {
  const r = pick(rng, board.rows);
  const t = at(r, board.delay);
  const verb = pick(rng, ['fährt', 'geht']);
  return {
    id: `time-${r.dest}`,
    ask: [`Wann ${verb} der Zug nach ${r.dest}?`, `Um wie viel Uhr fährt der Zug nach ${r.dest}?`],
    zh: `问去 ${r.dest} 的火车几点开（看时刻牌）`,
    visual: boardText(board),
    accept: [new RegExp(`^((der zug|er|es) )?((faehrt|geht|kommt) )?(um )?${timeRe(t.h, t.m)}( uhr)?( ab)?$`)],
    model: `Der Zug fährt um ${timeDe(t.h, t.m)}.`,
    traps: [[/\d/, '数字要写成单词：um halb neun'], [/^(der zug )?(faehrt|geht) (halb|viertel|\w+ uhr)/, '时间前面要加 um：Der Zug fährt um …']],
  };
}

/** A small station map: you (▲) at the bottom, the platform at the end of a two-leg route. */
function directionsQuestion(rng: Rng): BossQuestion {
  const gleis = 1 + Math.floor(rng() * 9);
  const side = pick(rng, ['links', 'rechts'] as const);
  const firstStraight = rng() < 0.6;
  const g = `[Gleis ${gleis}]`;
  let map: string;
  if (firstStraight) {
    map = side === 'links' ? `${g}←┐\n${' '.repeat(g.length + 1)}│\n${' '.repeat(g.length + 1)}▲ Sie` : `┌→${g}\n│\n▲ Sie`;
  } else {
    map = side === 'links' ? `${g}\n   ↑\n   └──┐\n      ▲ Sie` : `      ${g}\n         ↑\n   ┌─────┘\n   ▲ Sie`;
  }
  const how = firstStraight ? `geradeaus( und)?( dann)? (nach )?${side}` : `(nach )?${side}( und)?( dann)? geradeaus`;
  return {
    id: `way-${gleis}`,
    ask: [`Wie komme ich zu Gleis ${gleis}?`, `Wo ist Gleis ${gleis}?`, `Entschuldigung, wie komme ich zum Gleis ${gleis}?`],
    zh: `问怎么去 ${gleis} 号站台（看小地图）`,
    visual: map,
    accept: [new RegExp(`^((gehen sie|geh|sie gehen|du gehst|fahren sie) )?(immer |zuerst |erst )?${how}( gehen)?( bitte)?$`)],
    model: firstStraight ? `Gehen Sie geradeaus und dann ${side}.` : `Gehen Sie ${side} und dann geradeaus.`,
    traps: [[new RegExp(side === 'links' ? 'rechts' : 'links'), '再看一眼小地图：左边是 links，右边是 rechts']],
  };
}

const AUX_FORMS: Record<'haben' | 'sein', string[]> = {
  haben: ['habe', 'hast', 'hat', 'haben', 'habt'],
  sein: ['bin', 'bist', 'ist', 'sind', 'seid'],
};
const PP_AUX: Record<string, 'haben' | 'sein'> = Object.fromEntries(Object.values(PERFEKT).map((e) => [normalize(e.pp), e.aux]));

/** A Perfekt sentence about yourself: ich/wir + the right form of haben/sein … a known participle at the end. */
export function gradePerfekt(input: string): { ok: boolean; note: string | null } {
  const n = normalize(input).replace(/\s+/g, ' ').trim().replace(/^(ja|nein|doch) /, '');
  const toks = n.split(' ');
  if (toks.length < 3) return { ok: false, note: '用完成时的整句回答：Ich habe … / Ich bin …' };
  const subj = toks[0];
  const aux = toks[1];
  const last2 = toks.slice(-2).join(' ');
  const pp = PP_AUX[last2] ? last2 : toks[toks.length - 1];
  const need = PP_AUX[pp];
  if (!need) return { ok: false, note: '句子最后要放分词（gemacht、gefahren、verpasst……）' };
  const wantAux = subj === 'wir' ? (need === 'haben' ? 'haben' : 'sind') : subj === 'ich' ? (need === 'haben' ? 'habe' : 'bin') : null;
  if (!wantAux) return { ok: false, note: '用 ich 或 wir 开头回答你自己做了什么' };
  if (aux !== wantAux) {
    const isAux = AUX_FORMS.haben.includes(aux) || AUX_FORMS.sein.includes(aux);
    return { ok: false, note: isAux ? `${pp} 的完成时用 ${need}：${subj} ${wantAux} … ${pp}` : `第二位放 ${wantAux}：${subj} ${wantAux} … ${pp}` };
  }
  return { ok: true, note: null };
}

const PERFEKT_QS: Array<{ id: string; ask: string[]; zh: string; model: string }> = [
  { id: 'late', ask: ['Warum sind Sie zu spät gekommen?', 'Warum kommen Sie so spät?'], zh: '问你为什么迟到（用完成时）', model: 'Ich habe den Zug verpasst.' },
  { id: 'gestern', ask: ['Was haben Sie gestern gemacht?', 'Und gestern? Was haben Sie gemacht?'], zh: '问你昨天做了什么（用完成时）', model: 'Ich habe Deutsch gelernt.' },
  { id: 'wo', ask: ['Wo sind Sie eingestiegen?', 'Wo sind Sie in den Zug gestiegen?'], zh: '问你在哪里上的车（用完成时）', model: 'Ich bin in Brotmarkt eingestiegen.' },
  { id: 'wann', ask: ['Wann sind Sie angekommen?', 'Wann sind Sie heute aufgestanden?'], zh: '问你什么时候到的 / 起床的（用完成时）', model: 'Ich bin um sieben Uhr angekommen.' },
  { id: 'verloren', ask: ['Was haben Sie verloren?', 'Was haben Sie im Zug vergessen?'], zh: '问你丢了什么（用完成时）', model: 'Ich habe meine Fahrkarte verloren.' },
];

function perfektQuestion(rng: Rng): BossQuestion {
  const x = pick(rng, PERFEKT_QS);
  return {
    id: `perfekt-${x.id}`,
    ask: x.ask,
    zh: x.zh,
    accept: [],
    grade: (input: string) => gradePerfekt(input),
    model: x.model,
  };
}

/** One round: time, way, Perfekt in turns (time questions read the board, which may have shifted). */
export function boss3Questions(rng: Rng, board: Board): BossQuestion[] {
  const out: BossQuestion[] = [];
  for (let i = 0; i < 3; i++) out.push(timeQuestion(rng, board), directionsQuestion(rng), perfektQuestion(rng));
  return out;
}

/** After the delay the queued time questions are asked again from the new board. */
export function refreshTimeQuestion(rng: Rng, q: BossQuestion, board: Board): BossQuestion {
  return q.id.startsWith('time-') ? timeQuestion(rng, board) : q;
}
