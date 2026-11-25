// B2–C1 新怪种 (游戏设计 四「121–200 级」各区「新怪种或新题型」): rule-graded ones, built only on what 0.8 already has
// (grammar tasks on a word monster, the passage box, choice and typed answers).
//   转述怪 121 · 数字怪 131 · 改写题 141 · 时间线怪 161 · 三语域怪 181 · 回顾怪 191
// Like 结构魔: the monster is still a word monster; every other attack question is its own kind, other moves only
// graze it. Chances and the share of questions are 暂定 (not in the doc).
//
// Not here: 开口表达观点 (AI), 说谎的怪 (rules pending), 说服段 (AI).

import { shuffle, type Rng } from './rng';
import type { GameState } from './state';
import type { Word } from './types';
import type { GramTask } from './gram/task';
import { exampleLines, LINE_GENS } from './gram/lines';
import { gramOpen } from './gram/hook';
import { WORDS } from '../data/words';

export type B2Mon = 'report' | 'numbers' | 'rewrite' | 'timeline' | 'register' | 'review';

export const B2_MON: Record<B2Mon, { from: number; zh: string; log: string }> = {
  report: { from: 121, zh: '转述怪', log: '转述怪：它只肯被「转述」。把它说的话用第一虚拟式转述出来（Er sagt, er sei …）。' },
  numbers: { from: 131, zh: '数字怪', log: '数字怪：它身上挂着一张图表。读懂数字，说清涨了多少、涨到多少（um / auf）。' },
  rewrite: { from: 141, zh: '改写怪', log: '改写怪：它说的是 A2 的大白话。改成书面的名词式（weil es regnet → wegen des Regens）才伤得了它。' },
  timeline: { from: 161, zh: '时间线怪', log: '时间线怪：它把一段记载撕碎打乱了。按先后排好。' },
  register: { from: 181, zh: '三语域怪', log: '三语域怪：同一件事它说三遍——口语、正式、书面。分清哪句是哪种。' },
  review: { from: 191, zh: '回顾怪', log: '回顾怪：它从你走过的路上捡回了旧词和旧句式。' },
};
/** 暂定: chance that a word monster comes as one of the B2 kinds open to you; damage of other moves on it. */
export const B2_CFG = { chance: 0.2, otherMult: 0.5 };

const special = (t: Omit<GramTask, 'special'>): GramTask => ({ ...t, special: true });

// ---- 转述怪 (121): ich + 现在时 → er + 第一虚拟式 --------------------------------------------------------------
// For almost every verb the ich form of the present (ich gehe) is the K1 er form (er gehe); sein, the modals and
// wissen are the exceptions. Lines with other first- or second-person words are left out (their pronouns would change too).
const K1_OF: Record<string, string> = { bin: 'sei', kann: 'könne', muss: 'müsse', will: 'wolle', darf: 'dürfe', soll: 'solle', mag: 'möge', weiß: 'wisse', möchte: 'möchte' };

export function reportTasks(w: Word): GramTask[] {
  const out: GramTask[] = [];
  for (const { de, zh } of exampleLines(w)) {
    const m = /^Ich ([a-zäöüß]+)\b(.*?)([.!])?$/.exec(de);
    if (!m || /[?,;:]/.test(de)) continue;
    const verb = m[1];
    const k1 = K1_OF[verb] ?? (verb.endsWith('e') ? verb : null);
    if (!k1) continue;
    if (/\b(ich|mich|mir|mein\w*|wir|uns|unser\w*|du|dich|dir|dein\w*|ihr|euch|euer\w*)\b/i.test(m[2])) continue;
    const rest = m[2].trim();
    const answer = `Er sagt, er ${k1}${rest ? ` ${rest}` : ''}.`;
    out.push(
      special({
        sys: 'report',
        prompt: `转述怪：用第一虚拟式转述它的话（Er sagt, er …） · ${zh}`,
        focus: `„${de}“`,
        answer,
        alts: [`Sie sagt, sie ${k1}${rest ? ` ${rest}` : ''}`, `er ${k1}${rest ? ` ${rest}` : ''}`, `sie ${k1}${rest ? ` ${rest}` : ''}`],
        tier: 2,
        rule: `转述别人的话用第一虚拟式：ich → er，动词换成第一虚拟式（${verb} → ${k1}）。规则动词的 er 形式 = 词干 + e（er gehe, er habe）；sein → er sei，情态动词 kann → könne、muss → müsse。`,
        full: answer,
        zh,
        wordId: w.id,
      }),
    );
  }
  return out;
}

// ---- 数字怪 (131): 读图表，um（差多少）还是 auf（到多少） --------------------------------------------------------
interface Stat {
  de: string;
  label: string;
  unit: string;
  lo: number;
  hi: number;
  step: number;
}
const STATS: Stat[] = [
  { de: 'Die Miete', label: 'Miete', unit: 'Euro', lo: 500, hi: 1500, step: 50 },
  { de: 'Der Brotpreis', label: 'Brotpreis', unit: 'Cent', lo: 250, hi: 450, step: 10 },
  { de: 'Die Zahl der Einwohner', label: 'Einwohner', unit: '', lo: 10000, hi: 90000, step: 1000 },
  { de: 'Die Zahl der Fahrgäste', label: 'Fahrgäste pro Tag', unit: '', lo: 2000, hi: 20000, step: 500 },
  { de: 'Der Stromverbrauch', label: 'Stromverbrauch', unit: 'Kilowattstunden', lo: 2000, hi: 5000, step: 100 },
  { de: 'Die Temperatur', label: 'Temperatur', unit: 'Grad', lo: 5, hi: 30, step: 1 },
];
const num = (n: number) => n.toLocaleString('de-DE');
const withUnit = (n: number, u: string) => (u ? `${num(n)} ${u}` : num(n));

export function numbersTask(rng: Rng): GramTask {
  const st = STATS[Math.floor(rng() * STATS.length)];
  const steps = Math.floor((st.hi - st.lo) / st.step);
  const pick = () => st.lo + Math.floor(rng() * (steps + 1)) * st.step;
  const a = pick();
  let b = pick();
  // The difference must differ from both values, or "um" and "auf" would both be right.
  while (b === a || Math.abs(b - a) === b || Math.abs(b - a) === a) b = pick();
  const up = b > a;
  const d = Math.abs(b - a);
  const verb = up ? 'gestiegen' : 'gesunken';
  const other = up ? 'gesunken' : 'gestiegen';
  const year = 2018 + Math.floor(rng() * 6);
  const askUm = rng() < 0.5;
  const answer = askUm ? `${st.de} ist um ${withUnit(d, st.unit)} ${verb}.` : `${st.de} ist von ${withUnit(a, st.unit)} auf ${withUnit(b, st.unit)} ${verb}.`;
  const options = askUm
    ? [answer, `${st.de} ist auf ${withUnit(d, st.unit)} ${verb}.`, `${st.de} ist um ${withUnit(d, st.unit)} ${other}.`]
    : [answer, `${st.de} ist von ${withUnit(a, st.unit)} um ${withUnit(b, st.unit)} ${verb}.`, `${st.de} ist von ${withUnit(a, st.unit)} auf ${withUnit(b, st.unit)} ${other}.`];
  return special({
    sys: 'numbers',
    prompt: '数字怪：读图表，选说对了的一句',
    focus: st.label,
    passage: `${st.label}\n${year}: ${withUnit(a, st.unit)}\n${year + 1}: ${withUnit(b, st.unit)}`,
    answer,
    options,
    tier: 0,
    rule: 'steigen / sinken um + 差值（涨了多少）；steigen / sinken auf + 新值（涨到多少）；von + 旧值。现在完成时用 sein：ist gestiegen, ist gesunken。',
    full: answer,
  });
}

// ---- 改写怪 (141): A2 动词式 → B2 名词式 ---------------------------------------------------------------------
// The rule checks the key words (doc: 「规则查关键词」); each key is a list of accepted spellings, normalized.
export const REWRITES: Array<{ a2: string; b2: string; keys: string[][]; zh: string }> = [
  { a2: 'Weil es stark regnet, fällt das Konzert aus.', b2: 'Wegen des starken Regens fällt das Konzert aus.', keys: [['wegen', 'aufgrund'], ['regens']], zh: '因为下大雨，音乐会取消了。' },
  { a2: 'Nachdem er angekommen war, rief er sofort an.', b2: 'Nach seiner Ankunft rief er sofort an.', keys: [['nach'], ['ankunft']], zh: '他一到就打了电话。' },
  { a2: 'Bevor wir abfahren, packen wir die Koffer.', b2: 'Vor der Abfahrt packen wir die Koffer.', keys: [['vor'], ['abfahrt']], zh: '出发前我们收拾行李。' },
  { a2: 'Während wir essen, sprechen wir nicht.', b2: 'Während des Essens sprechen wir nicht.', keys: [['waehrend des', 'beim'], ['essens', 'essen']], zh: '吃饭的时候我们不说话。' },
  { a2: 'Obwohl er krank war, ging er zur Arbeit.', b2: 'Trotz seiner Krankheit ging er zur Arbeit.', keys: [['trotz'], ['krankheit']], zh: '他虽然病了，还是去上班了。' },
  { a2: 'Wenn man das Gerät benutzt, muss man vorsichtig sein.', b2: 'Bei der Benutzung des Geräts muss man vorsichtig sein.', keys: [['bei'], ['benutzung']], zh: '使用这台机器时要小心。' },
  { a2: 'Als sie geboren wurde, wohnten ihre Eltern in Köln.', b2: 'Bei ihrer Geburt wohnten ihre Eltern in Köln.', keys: [['bei', 'zur zeit', 'zum zeitpunkt'], ['geburt']], zh: '她出生时父母住在科隆。' },
  { a2: 'Seit sie umgezogen ist, fährt sie mit dem Rad zur Arbeit.', b2: 'Seit ihrem Umzug fährt sie mit dem Rad zur Arbeit.', keys: [['seit'], ['umzug']], zh: '搬家以后她骑车上班。' },
  { a2: 'Weil die Preise steigen, sparen viele Familien.', b2: 'Wegen der steigenden Preise sparen viele Familien.', keys: [['wegen', 'aufgrund', 'infolge'], ['preise', 'preisanstieg', 'preissteigerung']], zh: '因为物价上涨，很多家庭在省钱。' },
  { a2: 'Damit die Luft sauberer wird, fahren mehr Busse.', b2: 'Zur Verbesserung der Luft fahren mehr Busse.', keys: [['zur', 'fuer die'], ['verbesserung']], zh: '为了让空气更干净，增加了公交车。' },
  { a2: 'Bis das Haus renoviert ist, wohnen wir bei Freunden.', b2: 'Bis zur Renovierung des Hauses wohnen wir bei Freunden.', keys: [['bis zur', 'bis zum ende der', 'waehrend der'], ['renovierung']], zh: '房子装修好之前，我们住在朋友家。' },
  { a2: 'Wenn du dich anmeldest, bekommst du einen Ausweis.', b2: 'Nach der Anmeldung bekommst du einen Ausweis.', keys: [['nach', 'bei', 'mit'], ['anmeldung']], zh: '登记以后你会拿到证件。' },
  { a2: 'Als der Film begann, wurde es still.', b2: 'Bei Beginn des Films wurde es still.', keys: [['bei', 'mit', 'zu'], ['beginn']], zh: '电影开始时，四周安静下来。' },
  { a2: 'Nachdem sie die Prüfung bestanden hatte, feierte sie.', b2: 'Nach dem Bestehen der Prüfung feierte sie.', keys: [['nach'], ['bestehen']], zh: '她通过考试以后庆祝了一番。' },
  { a2: 'Weil er sich verspätet hat, haben wir den Zug verpasst.', b2: 'Wegen seiner Verspätung haben wir den Zug verpasst.', keys: [['wegen', 'aufgrund', 'durch'], ['verspaetung']], zh: '因为他迟到，我们没赶上火车。' },
  { a2: 'Wenn es einen Notfall gibt, rufen Sie 112 an.', b2: 'Im Notfall rufen Sie 112 an.', keys: [['im notfall', 'bei einem notfall', 'in einem notfall']], zh: '紧急情况请打 112。' },
  { a2: 'Obwohl es kalt war, gingen wir schwimmen.', b2: 'Trotz der Kälte gingen wir schwimmen.', keys: [['trotz'], ['kaelte']], zh: '虽然很冷，我们还是去游泳了。' },
  { a2: 'Weil sie uns geholfen hat, sind wir fertig geworden.', b2: 'Dank ihrer Hilfe sind wir fertig geworden.', keys: [['dank', 'mit', 'durch'], ['hilfe']], zh: '多亏她帮忙，我们做完了。' },
  { a2: 'Wenn man regelmäßig Sport treibt, bleibt man gesund.', b2: 'Durch regelmäßigen Sport bleibt man gesund.', keys: [['durch', 'mit', 'dank'], ['sport']], zh: '经常运动能保持健康。' },
  { a2: 'Als der Krieg zu Ende war, kehrte er zurück.', b2: 'Nach dem Ende des Krieges kehrte er zurück.', keys: [['nach'], ['ende', 'kriegsende']], zh: '战争结束后他回来了。' },
];

export function rewriteTask(rng: Rng): GramTask {
  const r = REWRITES[Math.floor(rng() * REWRITES.length)];
  return special({
    sys: 'rewrite',
    prompt: `改写怪：把它的话改成书面名词式（从句 → 介词 + 名词） · ${r.zh}`,
    focus: `„${r.a2}“`,
    answer: r.b2,
    keys: r.keys,
    tier: 2,
    rule: '书面语常把从句变成介词 + 名词：weil → wegen + 属格，obwohl → trotz，nachdem → nach，bevor → vor，während → während + 属格，wenn → bei，seit → seit。动词变名词：ankommen → die Ankunft，benutzen → die Benutzung。',
    full: r.b2,
    zh: r.zh,
  });
}

// ---- 时间线怪 (161): 排出先后 ---------------------------------------------------------------------------------
export const TIMELINES: string[][] = [
  ['Lena machte 2015 ihr Abitur.', 'Danach studierte sie drei Jahre in Leipzig.', 'Nach dem Studium fand sie eine Stelle in Hamburg.', 'Heute leitet sie dort ein kleines Team.'],
  ['Zuerst kocht man das Wasser.', 'Dann gibt man die Nudeln hinein.', 'Nach zehn Minuten gießt man das Wasser ab.', 'Zum Schluss kommt die Soße darüber.'],
  ['1961 wurde in Berlin die Mauer gebaut.', '1989 fiel die Mauer.', 'Ein Jahr später wurde Deutschland wiedervereinigt.', 'Seit 1999 arbeitet der Bundestag wieder in Berlin.'],
  ['Am Morgen kam der Brief an.', 'Ilse las ihn erst am Mittag.', 'Am Abend schrieb sie eine Antwort.', 'Am nächsten Tag brachte sie die Antwort zur Post.'],
  ['Die Bibliothek wurde im 18. Jahrhundert gegründet.', 'Im Zweiten Weltkrieg verbrannte ein Teil der Bücher.', 'Nach dem Krieg wurde das Gebäude wieder aufgebaut.', 'Seit 2010 kann man viele Bücher auch digital lesen.'],
  ['Bevor der Zug abfuhr, kaufte Jonas eine Fahrkarte.', 'Kurz nach der Abfahrt kam der Schaffner.', 'Eine Stunde später blieb der Zug plötzlich stehen.', 'Erst am späten Abend kam Jonas in München an.'],
  ['Zuerst meldet man sich beim Bürgeramt an.', 'Mit der Meldebescheinigung eröffnet man ein Bankkonto.', 'Danach kann man einen Handyvertrag abschließen.', 'Zuletzt meldet man sich beim Rundfunkbeitrag an.'],
  ['Im Januar bekam das Archiv einen neuen Leiter.', 'Im März begann das Projekt „Das perfekte Wörterbuch“.', 'Im Sommer zeigten sich die ersten Risse in den Wänden.', 'Im Herbst wurde das Archiv geschlossen.'],
];
const LETTERS = ['A', 'B', 'C', 'D'];

export function timelineTask(rng: Rng): GramTask {
  const tl = TIMELINES[Math.floor(rng() * TIMELINES.length)];
  // Shown order: a shuffle that is not already right.
  let shown = shuffle(rng, tl.map((_, i) => i));
  if (shown.every((v, i) => v === i)) shown = [shown[1], shown[0], ...shown.slice(2)];
  const letterOf = (event: number) => LETTERS[shown.indexOf(event)];
  const order = (seq: number[]) => seq.map(letterOf).join(' → ');
  const answer = order([0, 1, 2, 3]);
  const wrongs = new Set<string>();
  for (const seq of [[1, 0, 2, 3], [0, 2, 1, 3], [0, 1, 3, 2], [3, 2, 1, 0], [2, 0, 1, 3]]) {
    const o = order(seq);
    if (o !== answer) wrongs.add(o);
  }
  const options = [answer, ...shuffle(rng, [...wrongs]).slice(0, 2)];
  return special({
    sys: 'timeline',
    prompt: '时间线怪：按发生的先后排好',
    focus: '先后顺序？',
    passage: shown.map((ev, i) => `${LETTERS[i]}  ${tl[ev]}`).join('\n'),
    answer,
    options,
    tier: 0,
    rule: '看时间词：zuerst / dann / danach / zum Schluss / zuletzt，年份和日期，nach dem …、bevor …、seit …、heute。',
    full: tl.join(' '),
  });
}

// ---- 三语域怪 (181): 口语、正式口头、书面 -----------------------------------------------------------------------
/** [umgangssprachlich, formell gesprochen, schriftlich], same meaning. */
export const REGISTERS: Array<[string, string, string, string]> = [
  ['Hast du mal ’ne Minute?', 'Hätten Sie kurz Zeit für mich?', 'Wir bitten um einen kurzen Gesprächstermin.', '有空聊一下吗'],
  ['Das Essen war echt mega.', 'Das Essen war ausgezeichnet.', 'Die Qualität der Speisen wurde als hervorragend bewertet.', '饭很好吃'],
  ['Ich krieg das nicht hin.', 'Das schaffe ich leider nicht.', 'Die Aufgabe kann nicht fristgerecht erledigt werden.', '我做不完'],
  ['Der Typ hat total Mist gebaut.', 'Der Mann hat einen großen Fehler gemacht.', 'Dem Mitarbeiter unterlief ein schwerwiegender Fehler.', '他犯了大错'],
  ['Die Miete ist voll teuer.', 'Die Miete ist ziemlich hoch.', 'Die Mietkosten liegen deutlich über dem Durchschnitt.', '房租很贵'],
  ['Kein Bock auf Arbeit heute.', 'Ich habe heute keine Lust zu arbeiten.', 'Die Arbeitsmotivation ist heute gering.', '今天不想干活'],
  ['Ruf mich mal an!', 'Rufen Sie mich bitte zurück.', 'Wir bitten um Ihren Rückruf.', '请回电'],
  ['Der Bus kommt mal wieder zu spät.', 'Der Bus hat schon wieder Verspätung.', 'Im Busverkehr kommt es erneut zu Verspätungen.', '公交又晚了'],
  ['Was kostet der Spaß?', 'Wie viel kostet das, bitte?', 'Bitte teilen Sie uns den Preis mit.', '多少钱'],
  ['Ich hau mich jetzt hin.', 'Ich gehe jetzt schlafen.', 'Die Nachtruhe beginnt um 22 Uhr.', '去睡觉'],
];
const REG_ZH = ['口语（umgangssprachlich）', '正式口头（formell gesprochen）', '书面（schriftlich）'];

export function registerTask(rng: Rng, which?: 0 | 1 | 2): GramTask {
  const r = REGISTERS[Math.floor(rng() * REGISTERS.length)];
  const k = which ?? (Math.floor(rng() * 3) as 0 | 1 | 2);
  return special({
    sys: 'register',
    prompt: `三语域怪：哪一句是${REG_ZH[k]}？ · ${r[3]}`,
    focus: REG_ZH[k],
    answer: r[k],
    options: [r[0], r[1], r[2]],
    tier: 0,
    rule: '口语：缩写、俚语、du（krieg, ’ne, mega, Bock）；正式口头：Sie、完整句子、bitte、第二虚拟式（Hätten Sie …）；书面：名词化、被动、无人称（Die Aufgabe kann nicht erledigt werden.）。',
    full: r[k],
  });
}

// ---- 回顾怪 (191): 从 1–19 区抽学过的词和句式 -------------------------------------------------------------------
export function reviewTask(s: GameState, rng: Rng, not?: string): GramTask | null {
  const met = shuffle(rng, Object.keys(s.words).filter((id) => id !== not));
  const open = shuffle(rng, (Object.keys(LINE_GENS) as Array<keyof typeof LINE_GENS>).filter((k) => gramOpen(s, k)));
  if (!open.length) return null;
  const byId = new Map(WORDS.map((w) => [w.id, w]));
  for (const id of met.slice(0, 40)) {
    const w = byId.get(id);
    if (!w) continue;
    for (const sys of open.slice(0, 6)) {
      const t = LINE_GENS[sys]!(w, rng);
      if (t) return { ...t, special: true, prompt: `回顾怪（${w.de}）：${t.prompt}` };
    }
  }
  return null;
}

// ---- rolls -----------------------------------------------------------------------------------------------------
export function b2MonOk(s: GameState, w: Word, k: B2Mon): boolean {
  if (s.level < B2_MON[k].from) return false;
  if (k === 'report') return w.pos === 'v' && reportTasks(w).length > 0;
  return true;
}

/** Which B2 kind this word monster comes as, if any. */
export function rollB2Mon(s: GameState, w: Word, rng: Rng): B2Mon | null {
  const open = (Object.keys(B2_MON) as B2Mon[]).filter((k) => b2MonOk(s, w, k));
  if (!open.length || rng() >= B2_CFG.chance) return null;
  return open[Math.floor(rng() * open.length)];
}

export function b2Task(s: GameState, w: Word, rng: Rng, k: B2Mon): GramTask | null {
  const t = b2TaskRaw(s, w, rng, k);
  return t?.options ? { ...t, options: shuffle(rng, [...t.options]) } : t;
}

function b2TaskRaw(s: GameState, w: Word, rng: Rng, k: B2Mon): GramTask | null {
  switch (k) {
    case 'report': {
      const ts = reportTasks(w);
      return ts.length ? ts[Math.floor(rng() * ts.length)] : null;
    }
    case 'numbers':
      return numbersTask(rng);
    case 'rewrite':
      return rewriteTask(rng);
    case 'timeline':
      return timelineTask(rng);
    case 'register':
      return registerTask(rng);
    case 'review':
      return reviewTask(s, rng, w.id);
  }
}
