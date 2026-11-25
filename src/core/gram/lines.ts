// A2 / B1 语法线 (游戏设计 十六「语法线」, 32–111 级): each rule is asked on the word monster in front of you, from that
// word's own example sentences (语法教学统一框架: the sentence was seen before as 初印象, now the rule is tested in it).
// A rule whose sentence form the word's examples don't show simply doesn't come up on that word.
//
// One builder for all of them: find the rule in the sentence, blank the part that carries it, and either ask for it
// typed (tier 1) or offer the contrast the rule is about (tier 0: stellen / stehen, als / wenn, noch nicht / nicht
// mehr …). Answers are always the sentence's own words, so a right answer is never graded wrong.

import { EXAMPLES, parse } from '../cloze';
import { shuffle, type Rng } from '../rng';
import type { Word } from '../types';
import type { GramSys, GramTask } from './task';
import { WORDS } from '../../data/words';

interface Line {
  de: string;
  zh: string;
}

const tidy = (s: string) => s.replace(/\s+/g, ' ').replace(/\s+([.,!?])/g, '$1').trim();

function lines(w: Word): Line[] {
  const out: Line[] = [];
  for (const l of EXAMPLES[w.id] ?? []) {
    const p = parse(l);
    if (p) out.push({ de: tidy(`${p.before}${p.blank}${p.after}`), zh: p.zh });
  }
  return out;
}

const cap = (x: string) => x.charAt(0).toUpperCase() + x.slice(1);

interface Spec {
  sys: GramSys;
  re: RegExp;
  /** Capture group that is blanked. */
  group: number;
  prompt: string;
  rule: string;
  /** Skip a match (false positives the regex can't rule out). */
  skip?: (m: RegExpExecArray, de: string) => boolean;
  /** Choice options for this answer (must contain it); none = typed. */
  options?: (ans: string, m: RegExpExecArray) => string[] | null;
  /** A hint after the prompt, e.g. the infinitive. Null = this match can't be hinted, skip it. */
  hint?: (ans: string, m: RegExpExecArray) => string | null | undefined;
  alts?: (ans: string) => string[];
}

/** Every task this spec can make on this word. */
function build(w: Word, sp: Spec): GramTask[] {
  const out: GramTask[] = [];
  for (const { de, zh } of lines(w)) {
    const re = new RegExp(sp.re.source, sp.re.flags.replace('g', ''));
    const m = re.exec(de);
    if (!m || !m[sp.group]) continue;
    if (sp.skip?.(m, de)) continue;
    const ans = m[sp.group];
    const at = m.index + m[0].indexOf(ans);
    const hint = sp.hint ? sp.hint(ans, m) : undefined;
    if (hint === null) continue;
    let options = sp.options?.(ans, m) ?? undefined;
    if (sp.options && !options) continue;
    if (options) {
      // Keep the sentence's capital on every option when the blank opens the sentence.
      const first = at === 0;
      options = [...new Set(options.map((o) => (first ? cap(o) : o)))];
      if (!options.includes(ans)) continue;
    }
    out.push({
      sys: sp.sys,
      prompt: `${sp.prompt}${hint ? `（${hint}）` : ''} · ${zh}`,
      focus: `${de.slice(0, at)}___${de.slice(at + ans.length)}`,
      answer: ans,
      alts: sp.alts?.(ans),
      options,
      tier: options ? 0 : 1,
      rule: sp.rule,
      full: de,
      zh,
      wordId: w.id,
    });
  }
  return out;
}

/** Whole-sentence choice: the sentence as written against one with the rule broken (word order rules). */
function orderTask(w: Word, sys: GramSys, prompt: string, rule: string, wrongOf: (de: string) => string | null): GramTask[] {
  const out: GramTask[] = [];
  for (const { de, zh } of lines(w)) {
    const wrong = wrongOf(de);
    if (!wrong || wrong === de) continue;
    out.push({ sys, prompt, focus: zh, answer: de, options: [de, wrong], tier: 0, rule, full: de, zh, wordId: w.id });
  }
  return out;
}

const pickOne = (rng: Rng, xs: GramTask[]): GramTask | null => {
  if (!xs.length) return null;
  const t = xs[Math.floor(rng() * xs.length)];
  return t.options ? { ...t, options: shuffle(rng, [...t.options]) } : t;
};

// ---- 32 双向介词 wo / wohin, woher, 位置动词 -----------------------------------------------------------------

const TWOWAY: Spec = {
  sys: 'twoway',
  re: /\b(in|an|auf|über|unter|vor|hinter|neben|zwischen) (dem|den|der|die|das|einem|einen|einer|eine|ein)\b (?=[A-ZÄÖÜ])/,
  group: 2,
  prompt: '双向介词：填冠词（Wo? 第三格 / Wohin? 第四格）',
  rule: '双向介词（in, an, auf, über, unter, vor, hinter, neben, zwischen）：在哪里（Wo?）用第三格，去哪里、放到哪里（Wohin?）用第四格。',
  // vor + time (vor einem Jahr) and fixed phrases are not places.
  skip: (m, de) => m[1] === 'vor' && /\b(Jahr|Jahren|Monat|Monaten|Woche|Wochen|Tag|Tagen|Stunde|Stunden|Minute|Minuten)\b/.test(de.slice(m.index)),
};

const PLACES = 'Arzt|Ärztin|Zahnarzt|Bäcker|Metzger|Friseur|Amt|Bahnhof|Supermarkt|Markt|Post|Bank|Apotheke|Flughafen|Rathaus|Kino|Training|Arbeit|Schule|Uni|Universität|Haltestelle|Kiosk|Hausarzt|Notarzt|Notaufnahme|Bürgeramt|Jobcenter|Ausländerbehörde|Konsulat|Fitnessstudio|Schwimmbad|Strand|Sport|Kurs|Unterricht|Kindergarten|Kita|Krankenhaus|Termin';
const WOHER: Spec = {
  sys: 'woher',
  re: new RegExp(`\\b(zum|zur|beim|vom) (${PLACES})\\b`),
  group: 1,
  prompt: '去哪 / 在哪 / 从哪：选介词',
  rule: '去哪里：zum / zur（zum Arzt）；在哪里：beim / bei der（beim Arzt）；从哪里来：vom / von der（vom Arzt）。',
  options: (a) => (a.toLowerCase() === 'zur' ? ['zur', 'bei der', 'von der'] : ['zum', 'beim', 'vom']),
};

const POS_PAIR: Record<string, string> = { stelle: 'stehe', stellst: 'stehst', stellt: 'steht', stellen: 'stehen', lege: 'liege', legst: 'liegst', legt: 'liegt', legen: 'liegen' };
for (const [a, b] of Object.entries(POS_PAIR)) POS_PAIR[b] = a;
const POS_VERB: Spec = {
  sys: 'posVerb',
  re: /\b(stelle|stellst|stellt|stellen|stehe|stehst|steht|stehen|lege|legst|legt|legen|liege|liegst|liegt|liegen)\b/,
  group: 1,
  prompt: '放还是在：stellen / legen 是放（Wohin?），stehen / liegen 是在（Wo?）',
  rule: 'stellen / legen：把东西放到某处（动作，Wohin? + 第四格）；stehen / liegen：东西在某处（状态，Wo? + 第三格）。',
  // Separable or fixed uses (aufstehen, vorstellen, es liegt an …) are not the place pair.
  skip: (m, de) => /\b(auf|an|vor|fest|her|aus|zu|ein|ab|um|still|bereit|hin|fern|zurück|dar|weg)[.!?,]/.test(de.slice(m.index)) || /\bsich\b|\b(mich|dich|uns|euch)\b/.test(de) || !/\b(?:(?:auf|in|an|unter|über|neben|hinter|vor|zwischen) (?:dem|den|der|die|das|einem|einen|einer|eine|ein|meinem|meinen|meiner|meine|mein|deinem|deinen|deiner|deine|dein|seinem|seinen|seiner|seine|sein|ihrem|ihren|ihrer|ihre|unserem|unseren|unserer|unsere)|im|am|ins|aufs)\b/.test(de),
  options: (a) => {
    const k = a.toLowerCase();
    return POS_PAIR[k] ? [k, POS_PAIR[k]] : null;
  },
};

// ---- 35 双宾语顺序 -----------------------------------------------------------------------------------------

const DAT_PRON = '(mir|dir|ihm|Ihnen)';
/** Swap the two objects: (dative pronoun)(article noun) → (article noun)(dative pronoun); es/ihn + dative the other way. */
function dblObjWrong(de: string): string | null {
  if (/\b(lass|lasst|lassen|Lass|Lasst|Lassen)\b/.test(de)) return null;
  let m = new RegExp(`\\b${DAT_PRON} ((?:den|die|das|einen|eine|ein|meinen|meine|mein|deinen|deine|dein) [A-ZÄÖÜ][a-zäöüß]+)\\b`).exec(de);
  if (m && !/ (Woche|Wochen|Jahr|Jahre|Stunde|Stunden|Tag|Tage|Monat|Minute|Minuten|Weile|Zeit)$/.test(m[2])) return de.slice(0, m.index) + `${m[2]} ${m[1]}` + de.slice(m.index + m[0].length);
  m = new RegExp(`\\b(ihn) ${DAT_PRON}\\b`).exec(de);
  if (m) return de.slice(0, m.index) + `${m[2]} ${m[1]}` + de.slice(m.index + m[0].length);
  return null;
}

// ---- 37 冠词后缀规律 ---------------------------------------------------------------------------------------

const SUFFIX: Array<[RegExp, 'der' | 'die' | 'das', string]> = [
  [/ung$/, 'die', '-ung'],
  [/heit$/, 'die', '-heit'],
  [/keit$/, 'die', '-keit'],
  [/schaft$/, 'die', '-schaft'],
  [/tion$/, 'die', '-tion'],
  [/sion$/, 'die', '-sion'],
  [/tät$/, 'die', '-tät'],
  [/ei$/, 'die', '-ei'],
  [/ik$/, 'die', '-ik'],
  [/chen$/, 'das', '-chen'],
  [/lein$/, 'das', '-lein'],
  [/ment$/, 'das', '-ment'],
  [/ium$/, 'das', '-ium'],
  [/ling$/, 'der', '-ling'],
  [/ismus$/, 'der', '-ismus'],
];

export function suffixTask(w: Word, rng: Rng): GramTask | null {
  if (w.pos !== 'n' || !w.art || w.de.length < 5 || /\s/.test(w.de)) return null;
  const hit = SUFFIX.find(([re]) => re.test(w.de));
  // Only words that keep the rule; exceptions are not taught as the rule.
  if (!hit || hit[1] !== w.art) return null;
  return {
    sys: 'artSuffix',
    prompt: `看词尾选冠词：${hit[2]} 结尾的名词`,
    focus: `___ ${w.de}（${w.zh}）`,
    answer: w.art,
    options: shuffle(rng, ['der', 'die', 'das']),
    tier: 0,
    rule: '-ung / -heit / -keit / -schaft / -tion / -tät / -ei / -ik 是阴性 die；-chen / -lein / -ment / -ium 是中性 das；-ling / -ismus 是阳性 der。',
    full: `${w.art} ${w.de}`,
    wordId: w.id,
  };
}

// ---- 41 比较级、最高级、als / wie ----------------------------------------------------------------------------

const ADJ = new Set(WORDS.filter((x) => x.pos === 'adj').map((x) => x.de.toLowerCase()));
const IRREG_COMP: Record<string, string> = { besser: 'gut', lieber: 'gern', mehr: 'viel', höher: 'hoch', näher: 'nah', teurer: 'teuer', dunkler: 'dunkel', größer: 'groß', besten: 'gut', liebsten: 'gern', meisten: 'viel', höchsten: 'hoch', nächsten: 'nah', größten: 'groß' };
const deUml = (x: string) => x.replace(/ä/g, 'a').replace(/ö/g, 'o').replace(/ü/g, 'u');
/** The base adjective of a comparative / superlative, when it is a known word (else the task is skipped). */
function baseAdj(form: string, end: RegExp): string | null {
  const f = form.toLowerCase();
  if (IRREG_COMP[f]) return IRREG_COMP[f];
  const stem = f.replace(end, '');
  for (const c of [stem, deUml(stem)]) if (ADJ.has(c)) return c;
  return null;
}
const COMP: Spec = {
  sys: 'compare',
  re: /\b([a-zäöüß]{3,}er) als\b/,
  group: 1,
  prompt: '填比较级',
  rule: '比较级：形容词 + er，再加 als（älter als, frischer als）；单音节的 a / o / u 常变音，gut → besser，gern → lieber，viel → mehr。',
  hint: (a) => baseAdj(a, /er$/),
};
const SUP: Spec = {
  sys: 'compare',
  re: /\bam ([a-zäöüß]{3,}(?:e)?sten)\b/,
  group: 1,
  prompt: '填最高级（am …sten）',
  rule: '最高级：am + 形容词 + (e)sten（am schnellsten, am besten, am liebsten）。',
  hint: (a) => baseAdj(a, /e?sten$/),
};
const ALS_WIE: Spec = {
  sys: 'compare',
  re: /\b(?:so [a-zäöüß]+ (wie)|[a-zäöüß]{3,}er (als))\b/,
  group: 0,
  prompt: '比较：als 还是 wie',
  rule: '不一样用比较级 + als（größer als）；一样用 so … wie（so groß wie）。',
};
function alsWieTask(w: Word): GramTask[] {
  const out: GramTask[] = [];
  for (const { de, zh } of lines(w)) {
    const m = /\b(?:so [a-zäöüß]+ (wie)|([a-zäöüß]{3,}er) (als))\b/.exec(de);
    if (!m) continue;
    const ans = m[1] ?? m[3];
    if (m[2] && !baseAdj(m[2], /er$/)) continue;
    const at = m.index + m[0].lastIndexOf(ans);
    out.push({ sys: 'compare', prompt: `${ALS_WIE.prompt} · ${zh}`, focus: `${de.slice(0, at)}___${de.slice(at + ans.length)}`, answer: ans, options: ['als', 'wie'], tier: 0, rule: ALS_WIE.rule, full: de, zh, wordId: w.id });
  }
  return out;
}

// ---- 45 第一位连接副词（倒装）、否定进阶 ----------------------------------------------------------------------

/** deshalb / trotzdem / dann / sonst … at the start of a clause: the verb comes right after it. Wrong = subject first. */
function connWrong(de: string): string | null {
  const m = /(^|, (?:und )?|\bund )(Deshalb|deshalb|Deswegen|deswegen|Trotzdem|trotzdem|Dann|dann|Sonst|sonst|Darum|darum|Danach|danach) ([a-zäöüß]+) ([a-zäöüßA-ZÄÖÜ]+)\b/.exec(de);
  if (!m) return null;
  const [, lead, adv, verb, subj] = m;
  // The subject must be a pronoun or a name-like word, and the verb a finite verb (not an infinitive at the end).
  if (!/^(ich|du|er|sie|es|wir|ihr|man|Sie)$/.test(subj)) return null;
  if (/^(ich|du|er|sie|es|wir|ihr|man|nicht|noch|auch|schon|immer)$/.test(verb)) return null;
  const start = m.index + lead.length;
  const end = m.index + m[0].length;
  return de.slice(0, start) + `${adv} ${subj} ${verb}` + de.slice(end);
}

const NEG_ADV: Spec = {
  sys: 'negAdv',
  re: /\b(noch nicht|nicht mehr)\b(?! als)/,
  group: 1,
  prompt: '还没 / 不再：选 noch nicht 还是 nicht mehr',
  rule: 'noch nicht = 还没有（以后会）；nicht mehr = 不再（以前是）。名词前：noch kein … / kein … mehr。',
  skip: (_m, de) => /\bimmer noch nicht\b/.test(de) && false,
  options: () => ['noch nicht', 'nicht mehr'],
};

// ---- 55 第二虚拟式 ------------------------------------------------------------------------------------------

const K2_BASE: Record<string, string> = { würde: 'werden', würdest: 'werden', würden: 'werden', würdet: 'werden', hätte: 'haben', hättest: 'haben', hätten: 'haben', hättet: 'haben', wäre: 'sein', wärst: 'sein', wären: 'sein', wäret: 'sein', könnte: 'können', könntest: 'können', könnten: 'können', könntet: 'können' };
const K2: Spec = {
  sys: 'k2',
  re: /\b(würde|würdest|würden|würdet|hätte|hättest|hätten|hättet|wäre|wärst|wären|wäret|könnte|könntest|könnten|könntet)\b/,
  group: 1,
  prompt: '第二虚拟式：填变位',
  rule: '第二虚拟式（客气、愿望、假设）：hätte gern、wäre、könnte，其他动词多用 würde + 不定式。',
  hint: (a) => K2_BASE[a.toLowerCase()],
};

// ---- 61 将来时 werden -------------------------------------------------------------------------------------

const WERDEN_P = '(werde|wirst|wird|werden|werdet)';
const FUTURE: Spec = {
  sys: 'future',
  re: new RegExp(`\\b${WERDEN_P}\\b([^.!?,]* )([a-zäöüß]+en)[.!?]`),
  group: 1,
  prompt: '将来时：填 werden 的变位',
  rule: '将来时和推测：werden 变位放第二位，动词原形放句末（Ich werde morgen anrufen. Er wird krank sein.）。',
  // A participle at the end is the passive, and werden as a full verb ("Ärztin werden") is not the future.
  skip: (m) => /\bge[a-zäöüß]+(t|en)$/.test(m[3]) || m[3] === 'werden' || m[1] === 'werden' && m.index === 0,
  hint: () => 'werden',
};

// ---- 63 关系从句 ------------------------------------------------------------------------------------------

const RELATIVE: Spec = {
  sys: 'relative',
  re: /[A-ZÄÖÜ][a-zäöüß]+, (der|die|das|den|dem|deren|dessen|denen) ([^,.!?]*) ([a-zäöüß]+)[,.!?]/,
  group: 1,
  skip: (m) => (!/^(dessen|deren)$/.test(m[1]) && /^[A-ZÄÖÜ]/.test(m[2])) || /\bzu$|\bzu [a-zäöüß]+$/.test(m[2]) || /^[a-zäöüß]+zu[a-zäöüß]+en$/.test(m[3]) || m.index === 0,
  prompt: '填关系代词',
  rule: '关系代词跟前面名词的性和数一样，格看它在从句里做什么（Der Mann, der hier wohnt / den ich kenne / dem ich helfe）；变位动词放从句末尾。',
};

// ---- 65 被动、81 被动过去式 ---------------------------------------------------------------------------------

const PASSIVE: Spec = {
  sys: 'passive',
  re: /\b(wird|werden)\b[^.!?,]* (ge[a-zäöüß]+(?:t|en)|[a-zäöüß]+(?:iert))[.!?,]/,
  group: 1,
  prompt: '被动：填 werden 的变位',
  rule: '被动：werden + 第二分词放句末（Das Haus wird gebaut. Die Möbel werden geliefert.）。',
  hint: () => 'werden',
};
const PASS_PAST: Spec = {
  sys: 'passPast',
  re: /\b(wurde|wurden)\b[^.!?,]* (ge[a-zäöüß]+(?:t|en)|[a-zäöüß]+(?:iert))[.!?,]/,
  group: 1,
  prompt: '被动过去式：填 werden 的过去式',
  rule: '被动过去式：wurde / wurden + 第二分词（Das Haus wurde 1900 gebaut.）。',
  hint: () => 'werden，过去',
};

// ---- 67 zu + 不定式、um … zu / damit、obwohl ------------------------------------------------------------------

const ZU_INF: Spec = {
  sys: 'zuInf',
  re: /, [^,.!?]*\b(zu [a-zäöüß]{3,}en)[,.!?]/,
  group: 1,
  prompt: '填 zu + 不定式',
  rule: 'Es ist wichtig / Ich habe vor / Er rät mir … 后面的动作用 zu + 不定式，放句末；可分动词 zu 夹在中间（anzurufen）。',
  hint: (a) => a.slice(3),
  skip: (m) => /^zu (sehen|haben|tun)$/.test(m[1]) && false,
};
const CONNECTOR: Spec = {
  sys: 'zuInf',
  re: /(?:^|, )(um|damit|obwohl|weil)\b/i,
  group: 1,
  prompt: '选连接词：为了 um … zu / 为了 damit / 虽然 obwohl / 因为 weil',
  rule: '目的：主语相同用 um … zu + 不定式，不同用 damit + 从句；让步「虽然」用 obwohl；原因用 weil。',
  // um must really be um … zu here (not "um acht Uhr").
  skip: (m, de) => m[1].toLowerCase() === 'um' && !/\bzu [a-zäöüß]+en\b/.test(de.slice(m.index)),
  options: () => ['um', 'damit', 'obwohl', 'weil'],
};

// ---- 71 als / wenn、过去完成时、nachdem / bevor -----------------------------------------------------------------

const SUBJ = '(?:ich|du|er|sie|es|wir|ihr|man|Sie|mein[a-z]*|dein[a-z]*|der|die|das|unser[a-z]*)';
const ALS_WENN: Spec = {
  sys: 'alsWenn',
  re: new RegExp(`(?:^|, )(Als|als|Wenn|wenn) ${SUBJ} [^,.!?]*[a-zäöüß][,.!?]`),
  group: 1,
  prompt: '时间从句：als 还是 wenn',
  rule: '过去发生过一次（或一段时期）用 als；反复发生、现在或将来用 wenn。',
  options: () => ['als', 'wenn'],
  // A clause at the very start needs its comma; "…er, als ich dachte" is a comparison.
  skip: (m, de) => (m.index === 0 && !de.includes(',')) || /[a-zäöüß]{2,}er, $/.test(de.slice(0, m.index + 2)),
};
const PLQ: Spec = {
  sys: 'plq',
  re: /\b(hatte|hatten|hattest|war|waren|warst)\b((?:(?! und | aber | oder )[^.!?,])*) ([a-zäöüß]*(?:ge[a-zäöüß]+(?:t|en)|iert))[,.!?]/,
  group: 1,
  // war + participle is mostly a state (war geschlossen); only verbs that take sein in the perfect count.
  skip: (m) => /^war/.test(m[1].toLowerCase()) && !/(gegangen|gefahren|gekommen|geflogen|gelaufen|geblieben|gewesen|geworden|passiert|gestorben|gestanden|geschwommen|gereist|gefallen|eingeschlafen|aufgewacht|umgezogen|angekommen|abgefahren|ausgestiegen|eingestiegen|zurückgekommen|losgegangen|aufgestanden)$/.test(m[3]),
  prompt: '过去完成时：填 hatte / war 的变位',
  rule: '过去完成时（比过去更早的事）：hatte / war + 第二分词（Nachdem ich gegessen hatte, …）。位移和状态变化用 war。',
  hint: (a) => (/^h/.test(a.toLowerCase()) ? 'haben，过去' : 'sein，过去'),
};
const NACHDEM: Spec = {
  sys: 'nachdem',
  re: /(?:^|, )(Nachdem|nachdem|Bevor|bevor)\b/,
  group: 1,
  prompt: '选连接词：nachdem（在……之后）还是 bevor（在……之前）',
  rule: 'nachdem = 在……之后（从句常用过去完成时）；bevor = 在……之前；两个都是从句，动词放末尾。',
  options: () => ['nachdem', 'bevor'],
};

// ---- 73 ob / w- 间接疑问句 -------------------------------------------------------------------------------------

const OB: Spec = {
  sys: 'indirect',
  re: /, (ob|dass)\b/,
  group: 1,
  skip: (m, de) => !ASKS.test(de.slice(0, m.index)),
  prompt: '间接疑问：ob 还是 dass',
  rule: '是不是、会不会（没有疑问词的问题）用 ob；陈述一件事用 dass；从句里变位动词放末尾。',
  options: () => ['ob', 'dass'],
};
/** w-clause: verb last. Wrong = the verb right after the question word, as in a direct question. */
const ASKS = /\b(weiß|weißt|wissen|wisst|frage|fragt|fragen|fragte|sag|sagen|sagt|erklär|erklären|erklärt|zeig|zeigen|zeigt|verstehe|verstehen|versteht|Ahnung|beigebracht|überlegen|überlege|diskutierten|diskutieren|erzähl|erzählen|herausfinden|entscheiden|vergessen|klar|egal|mitteilen|gesagt|gefragt|erfahren|hängt|unklar|wundere|neugierig)\b/;
function indirectWrong(de: string): string | null {
  const m = /, (wo|wann|wie|was|warum|wer|wohin|woher|welche[nrms]?) ([^,.!?]+) ([a-zäöüß]+)([,.!?])/.exec(de);
  if (!m || !ASKS.test(de.slice(0, m.index))) return null;
  const words = m[2].split(' ');
  if (words.length < 1 || /^(viel|spät|lange|oft|alt|weit)$/.test(words[0]) && words.length < 2) return null;
  return de.slice(0, m.index) + `, ${m[1]} ${m[3]} ${m[2]}${m[4]}` + de.slice(m.index + m[0].length);
}

// ---- 75 lassen + 不定式 ---------------------------------------------------------------------------------------

const LASSEN: Spec = {
  sys: 'lassen',
  re: /\b(lasse|lässt|lassen|lasst|ließ|ließen)\b [^.!?,]*\b[a-zäöüß]+en[.!?,]/,
  group: 1,
  prompt: 'lassen：填变位',
  rule: 'lassen + 不定式 = 让别人做 / 让某事发生（Ich lasse mein Auto reparieren.）：lassen 变位放第二位，不定式放末尾。lassen 是强变化：du lässt, er lässt。',
  hint: () => 'lassen',
};

// ---- 81 属格、91 属格介词 ---------------------------------------------------------------------------------------

const GENITIVE: Spec = {
  sys: 'genitive',
  re: /\b(des|eines|meines|deines|seines|ihres|unseres) [A-ZÄÖÜ][a-zäöüß]*e?s\b/,
  group: 1,
  prompt: '填属格冠词',
  rule: '属格（……的）：阳性和中性 des / eines + 名词加 -(e)s（des Monats）；阴性和复数 der。',
};
const GEN_PREP: Spec = {
  sys: 'genPrep',
  re: /\b(Wegen|wegen|Trotz|trotz|Während|während|Innerhalb|innerhalb|Statt|statt) (des|der|eines|einer|meines|meiner|seines|seiner|ihres|ihrer|unseres|unserer)\b/,
  group: 1,
  prompt: '属格介词：wegen（因为）/ trotz（尽管）/ während（在……期间）/ innerhalb（在……之内）',
  rule: 'wegen、trotz、während、innerhalb、statt 后面跟属格（wegen des Regens, während der Arbeit）。',
  options: () => ['wegen', 'trotz', 'während', 'innerhalb'],
};

// ---- 101 n 变化名词、形容词名词化 -------------------------------------------------------------------------------

const N_DECL: Spec = {
  sys: 'nDecl',
  re: /\b(?:den|dem|des|einen|einem|eines|meinen|meinem) ((?:Mensch|Student|Kolleg|Jung|Nam|Herr|Kund|Nachbar|Praktikant|Polizist|Expert|Patient|Kunde|Junge|Kollege|Name)e?n)\b/,
  group: 1,
  prompt: '填名词（n 变化）',
  rule: 'n 变化名词（der Kunde, der Kollege, der Herr, der Patient …）：除了第一格单数，都加 -(e)n（den Kunden, dem Herrn）。',
  hint: (a) => a.replace(/e?n$/, (x) => (/^(Herr|Mensch|Student|Praktikant|Polizist|Patient|Nachbar)/.test(a) ? '' : x === 'en' && /(Kolleg|Jung|Nam|Kund|Expert)$/.test(a.replace(/en$/, '')) ? 'e' : '')) || null,
};
const NOM_ADJ: Spec = {
  sys: 'nomAdj',
  re: /\b(?:etwas|nichts|viel|wenig) ([A-ZÄÖÜ][a-zäöüß]+es)\b/,
  group: 1,
  prompt: '形容词变名词：etwas / nichts + 大写形容词 + es',
  rule: '形容词当名词用要大写：etwas Gutes, nichts Neues, viel Schönes（中性，词尾 -es）；der / die Deutsche 按形容词词尾变。',
  hint: (a) => {
    const base = a.toLowerCase().replace(/es$/, '');
    return ADJ.has(base) ? base : IRREG_COMP[base.replace(/(er)$/, '$1')] ? null : ADJ.has(base.replace(/er$/, '')) ? `${base.replace(/er$/, '')} 的比较级` : null;
  },
};

// ---- 111 双连词、je … desto、时间从句 ---------------------------------------------------------------------------

const DBL_PAIR: Record<string, string> = { weder: 'noch', entweder: 'oder', sowohl: 'als auch', 'nicht nur': 'sondern auch', je: 'desto' };
function dblConjTask(w: Word): GramTask[] {
  const out: GramTask[] = [];
  for (const { de, zh } of lines(w)) {
    const m = /\b(Weder|weder|Entweder|entweder|Sowohl|sowohl|Nicht nur|nicht nur|Je|je)\b(.+?)\b(noch|oder|als auch|sondern(?: auch)?|desto|umso)\b/.exec(de);
    if (!m) continue;
    const first = m[1].toLowerCase();
    // je alone (= ever) without desto is not the pair.
    if (first === 'je' && !/^(desto|umso)$/.test(m[3])) continue;
    const ans = m[3];
    const at = m.index + m[0].length - ans.length;
    const opts = [...new Set([ans, ...Object.values(DBL_PAIR).filter((x) => x !== DBL_PAIR[first])].slice(0, 4))];
    out.push({ sys: 'dblConj', prompt: `双连词：${first} … ___ · ${zh}`, focus: `${de.slice(0, at)}___${de.slice(at + ans.length)}`, answer: ans, alts: ans === 'desto' ? ['umso'] : ans === 'umso' ? ['desto'] : undefined, options: opts, tier: 0, rule: 'entweder … oder（要么……要么）、weder … noch（既不……也不）、sowohl … als auch（既……又）、nicht nur … sondern auch（不但……而且）、je + 比较级 … desto + 比较级（越……越）。', full: de, zh, wordId: w.id });
  }
  return out;
}
const TEMP_CLAUSE: Spec = {
  sys: 'tempClause',
  re: new RegExp(`(?:^|, )(Während|während|Seit|seit|Seitdem|seitdem|Bis|bis) ${SUBJ} [^,.!?]*[a-zäöüß][,.!?]`),
  group: 1,
  prompt: '时间从句：während（一边……/在……期间）/ seit（自从）/ bis（直到）',
  rule: 'während = 同时进行；seit(dem) = 从过去某时开始一直到现在；bis = 直到某时为止。都是从句，动词放末尾。',
  skip: (m, de) => m.index === 0 && !de.slice(0, de.search(/[.!?]/)).includes(','),
  options: (a) => [a.toLowerCase().startsWith('seitdem') ? 'seitdem' : 'seit', 'während', 'bis'].map((o) => (o === 'seit' && a.toLowerCase() === 'seitdem' ? 'seitdem' : o)),
};

// ---- the generators, one per system -------------------------------------------------------------------------

type Gen = (w: Word, rng: Rng) => GramTask | null;
const one = (...specs: Spec[]): Gen => (w, rng) => pickOne(rng, specs.flatMap((sp) => build(w, sp)));

export const LINE_GENS: Partial<Record<GramSys, Gen>> = {
  twoway: one(TWOWAY),
  woher: one(WOHER),
  posVerb: one(POS_VERB),
  dblObj: (w, rng) => pickOne(rng, orderTask(w, 'dblObj', '双宾语：选语序正确的一句', '两个宾语都是名词：第三格（人）在前，第四格（物）在后；代词在名词前；两个都是代词：第四格在前（Ich gebe es ihm.）。', dblObjWrong)),
  artSuffix: suffixTask,
  compare: (w, rng) => pickOne(rng, [...build(w, COMP), ...build(w, SUP), ...alsWieTask(w)]),
  connAdv: (w, rng) => pickOne(rng, orderTask(w, 'connAdv', 'deshalb / trotzdem / dann 放句首：选语序正确的一句', 'deshalb、trotzdem、dann、sonst、danach 放第一位时，变位动词紧跟在后面（第二位），主语放到动词后面（Deshalb bleibe ich zu Hause.）。', connWrong)),
  negAdv: one(NEG_ADV),
  k2: one(K2),
  future: one(FUTURE),
  relative: one(RELATIVE),
  passive: one(PASSIVE),
  zuInf: one(ZU_INF, CONNECTOR),
  alsWenn: one(ALS_WENN),
  plq: one(PLQ),
  nachdem: one(NACHDEM),
  indirect: (w, rng) => pickOne(rng, [...build(w, OB), ...orderTask(w, 'indirect', '间接疑问：选语序正确的一句', '间接疑问句（Weißt du, wo …? Ich frage, ob …）是从句：疑问词或 ob 之后，变位动词放末尾。', indirectWrong)]),
  lassen: one(LASSEN),
  passPast: one(PASS_PAST),
  genitive: one(GENITIVE),
  genPrep: one(GEN_PREP),
  nDecl: one(N_DECL),
  nomAdj: one(NOM_ADJ),
  dblConj: (w, rng) => pickOne(rng, dblConjTask(w)),
  tempClause: one(TEMP_CLAUSE),
};

/** Opening level of each line rule (十六「语法线」; 十五 wins where they differ). */
export const LINE_LV: Partial<Record<GramSys, number>> = {
  twoway: 32,
  woher: 32,
  posVerb: 32,
  dblObj: 35,
  artSuffix: 37,
  compare: 41,
  connAdv: 45,
  negAdv: 45,
  k2: 55,
  future: 61,
  relative: 63,
  passive: 65,
  zuInf: 67,
  alsWenn: 71,
  plq: 71,
  nachdem: 71,
  indirect: 73,
  lassen: 75,
  passPast: 81,
  genitive: 81,
  genPrep: 91,
  nDecl: 101,
  nomAdj: 101,
  dblConj: 111,
  tempClause: 111,
};

/** For tests and the dev panel: every task one system can make on one word. */
export function allLineTasks(w: Word, sys: GramSys): GramTask[] {
  const specs: Record<string, Spec[]> = { twoway: [TWOWAY], woher: [WOHER], posVerb: [POS_VERB], negAdv: [NEG_ADV], k2: [K2], future: [FUTURE], relative: [RELATIVE], passive: [PASSIVE], zuInf: [ZU_INF, CONNECTOR], alsWenn: [ALS_WENN], plq: [PLQ], nachdem: [NACHDEM], lassen: [LASSEN], passPast: [PASS_PAST], genitive: [GENITIVE], genPrep: [GEN_PREP], nDecl: [N_DECL], nomAdj: [NOM_ADJ], tempClause: [TEMP_CLAUSE], compare: [COMP, SUP], indirect: [OB] };
  const out = (specs[sys] ?? []).flatMap((sp) => build(w, sp));
  if (sys === 'compare') out.push(...alsWieTask(w));
  if (sys === 'dblConj') out.push(...dblConjTask(w));
  if (sys === 'dblObj') out.push(...orderTask(w, 'dblObj', '', '', dblObjWrong));
  if (sys === 'connAdv') out.push(...orderTask(w, 'connAdv', '', '', connWrong));
  if (sys === 'indirect') out.push(...orderTask(w, 'indirect', '', '', indirectWrong));
  if (sys === 'artSuffix') {
    const t = suffixTask(w, () => 0);
    if (t) out.push(t);
  }
  return out;
}
