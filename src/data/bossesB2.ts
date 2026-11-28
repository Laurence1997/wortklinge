// 121–200 级 · region bosses 13–20 (游戏设计 四「121–200 级」, rev 488; Lucas 2026-11-25 agreed the bosses).
// Same engine as the bosses of regions 4–12 (src/data/bossesLater.ts): a timed conversation, one hit per right
// sentence; answers are tested on normalized text (lowercase, ae/oe/ue/ss, no punctuation). Where the doc wants an
// AI judge (debate, trial, free speech: 0.8 「AI 判定」/「演讲引擎」), these patterns are the typing fallback the doc
// keeps (「留打字退路」): they check the structure (opinion + reason, concession + objection, Konjunktiv I …), not
// whether the content convinces. The systems thread can put the AI grader in front of them.
//
// Written by Claude; needs a native-speaker check (same proofreading pipeline as the other data).

import type { BossQuestion } from './boss';
import type { LaterBoss } from './bossesLater';
import { normalize } from '../core/grading';
import { pick, shuffle, type Rng } from '../core/rng';

const S = '[a-z]+';

function q(id: string, ask: string[], zh: string, accept: Array<RegExp | string>, model: string, extra: Partial<BossQuestion> = {}): BossQuestion {
  return { id, ask, zh, accept: accept.map((a) => (typeof a === 'string' ? new RegExp(a) : a)), model, ...extra };
}

/** A grader that needs every part (each with the note shown when it is missing). */
function needs(parts: Array<[RegExp, string]>): BossQuestion['grade'] {
  return (input: string) => {
    const n = normalize(input);
    for (const [re, note] of parts) if (!re.test(n)) return { ok: false, note };
    return { ok: true, note: null };
  };
}

const OPINION = /(?:ich bin der (?:ansicht|meinung|auffassung|ueberzeugung)|meiner (?:meinung|ansicht|auffassung) nach|ich halte|ich finde|ich denke|ich glaube|aus meiner sicht|meines erachtens|ich bin (?:dafuer|dagegen)|ich bin ueberzeugt)/;
const REASON = /(?:weil|denn|da |deshalb|daher|deswegen|aus diesem grund|der grund ist)/;
const CONCEDE = /(?:zwar|wenngleich|obwohl|obgleich|auch wenn|es stimmt dass|es ist richtig dass|einerseits|zugegeben)/;
const OBJECT = /(?:aber|jedoch|doch|andererseits|trotzdem|dennoch|allerdings)/;
/** Concession + objection: wenngleich / obwohl carry it alone, zwar / einerseits need their aber / andererseits. */
const concedeGrade: BossQuestion['grade'] = (input: string) => {
  const n = normalize(input);
  if (!CONCEDE.test(n)) return { ok: false, note: '先承认一部分：Zwar …, aber … / Wenngleich …, …' };
  if (/(?:zwar|einerseits|es stimmt dass|es ist richtig dass|zugegeben)/.test(n) && !OBJECT.test(n)) return { ok: false, note: '承认之后要转折：aber / andererseits / trotzdem。' };
  return { ok: true, note: null };
};

// ---- 13 · 议会堡 · 空话议员 (debate: opinion + reason + example; Konjunktiv I; 功能动词结构) ---------------------------

// 1.0.12 试玩 33: each topic has its own model answers (they used to talk about the Nahverkehr whatever was asked).
const TOPICS: Array<{ ask: string; opinion: string; example: string }> = [
  { ask: 'Sollte der Nahverkehr kostenlos sein?', opinion: 'Ich bin der Ansicht, dass der Nahverkehr kostenlos sein sollte, weil dann weniger Menschen Auto fahren.', example: 'Zum Beispiel ist der Bus in Luxemburg schon kostenlos.' },
  { ask: 'Brauchen wir ein Tempolimit auf der Autobahn?', opinion: 'Ich bin der Ansicht, dass wir ein Tempolimit brauchen, weil es dann weniger schwere Unfälle gibt.', example: 'Zum Beispiel gibt es in fast allen Ländern Europas schon ein Tempolimit.' },
  { ask: 'Sollte die Schule später anfangen?', opinion: 'Meiner Meinung nach sollte die Schule später anfangen, weil viele Jugendliche morgens sehr müde sind.', example: 'Meine Schwester ist zum Beispiel 15 und schläft nie vor Mitternacht ein.' },
  { ask: 'Sollte man ab 16 wählen dürfen?', opinion: 'Ich bin der Ansicht, dass man ab 16 wählen dürfen sollte, weil es auch um die Zukunft der Jugendlichen geht.', example: 'In Österreich dürfen Jugendliche zum Beispiel schon seit 2007 ab 16 wählen.' },
  { ask: 'Sollten Städte Autos aus der Innenstadt verbannen?', opinion: 'Ich bin dafür, dass Städte Autos aus der Innenstadt verbannen, weil die Luft dann sauberer wird.', example: 'In Kopenhagen fahren zum Beispiel die meisten Menschen mit dem Fahrrad in die Innenstadt.' },
];

const COUNTERS: Array<{ ask: string; model: string }> = [
  { ask: 'Ohne Autos gibt es keine Arbeitsplätze. Was sagen Sie dazu?', model: 'Das sehe ich anders, denn Busse und Bahnen schaffen auch Arbeitsplätze.' },
  { ask: 'Alle Experten sind meiner Meinung. Stimmen Sie zu?', model: 'Nein, da widerspreche ich, denn viele Experten sehen das ganz anders.' },
  { ask: 'Das kostet zu viel. Dafür haben wir kein Geld.', model: 'Das sehe ich anders, denn wenn wir nichts tun, wird es später noch teurer.' },
];

/** 1.0.12 试玩 33: a concrete example counts with or without a marker word: a full sentence with a detail in it
 *  (a number, a possessive, a time or a place; a bare «ich finde das auch gut» is no example). */
const EXAMPLE_MARK = new RegExp(`(?:zum beispiel|beispielsweise|etwa|ein beispiel|in ${S} (?:gibt|hat|haben|ist|sind|fahren)|als ich|letztes jahr|in meiner stadt|seit)`);
const DETAIL = /(?:\d|\b(?:mein|meine|meinem|meinen|meiner|unser|unsere|unserem|unseren|unserer|gestern|letzte|letzten|letztes|jeden|jede|in [a-z]+|bei [a-z]+|eins|zwei|drei|vier|fuenf|sechs|sieben|acht|neun|zehn|zwoelf|zwanzig|hundert)\b)/;
const exampleGrade: BossQuestion['grade'] = (input: string) => {
  const n = normalize(input);
  if (EXAMPLE_MARK.test(n)) return { ok: true, note: null };
  if (n.split(' ').filter(Boolean).length >= 6 && DETAIL.test(n)) return { ok: true, note: null };
  return { ok: false, note: '说一个具体的例子：谁、在哪里、什么时候（Zum Beispiel … / In meiner Stadt …）。' };
};

const QUOTES: Array<{ who: string; said: string; acc: string; model: string }> = [
  { who: 'Der Bürgermeister', said: 'Die Stadt hat kein Geld.', acc: 'die stadt habe kein geld', model: 'Er sagte, die Stadt habe kein Geld.' },
  { who: 'Die Ministerin', said: 'Ich kenne das Problem.', acc: 'sie kenne das problem', model: 'Sie sagte, sie kenne das Problem.' },
  { who: 'Der Sprecher', said: 'Das Projekt kostet zu viel.', acc: 'das projekt koste zu viel', model: 'Er sagte, das Projekt koste zu viel.' },
  { who: 'Die Abgeordnete', said: 'Ich bin für mehr Radwege.', acc: 'sie sei fuer mehr radwege', model: 'Sie sagte, sie sei für mehr Radwege.' },
  { who: 'Der Kanzler', said: 'Die Steuern werden nicht steigen.', acc: 'die steuern (?:wuerden|werden) nicht steigen', model: 'Er sagte, die Steuern würden nicht steigen.' },
];

const FVG: Array<{ verb: string; acc: string; model: string }> = [
  { verb: 'entscheiden', acc: 'eine entscheidung treffen', model: 'Wir müssen eine Entscheidung treffen.' },
  { verb: 'das kritisieren', acc: 'kritik (?:ueben|aeussern)', model: 'Wir müssen Kritik üben.' },
  { verb: 'das beantragen', acc: 'einen antrag stellen', model: 'Wir müssen einen Antrag stellen.' },
  { verb: 'etwas vorschlagen', acc: 'einen vorschlag (?:machen|unterbreiten)', model: 'Wir müssen einen Vorschlag machen.' },
  { verb: 'diskutieren', acc: '(?:eine diskussion fuehren|zur diskussion stellen)', model: 'Wir müssen eine Diskussion führen.' },
  { verb: 'das beeinflussen', acc: 'einfluss (?:nehmen|ausueben)', model: 'Wir müssen Einfluss nehmen.' },
  { verb: 'das berücksichtigen', acc: '(?:in betracht ziehen|beruecksichtigung finden|ruecksicht nehmen)', model: 'Wir müssen das in Betracht ziehen.' },
];

const DEBATE = (rng: Rng): BossQuestion[] => {
  const t = pick(rng, TOPICS);
  // 1.0.12 试玩 33: HP 12 needs more than 8 questions; two quotes, two 功能动词 and the counter vary between draws.
  const [qt, qt2] = shuffle(rng, QUOTES);
  const [f, f2] = shuffle(rng, FVG);
  const c = pick(rng, COUNTERS);
  const report = (id: string, x: typeof qt) =>
    q(id, [`${x.who} hat gesagt: „${x.said}“ Was hat er oder sie gesagt?`], '用 Konjunktiv I 转述（er sagte, …habe / sei …）',
      [`(?:sagte|sagt|behauptete|behauptet|meinte|erklaerte)(?: dass)? ${x.acc}`, `^${x.acc}`], x.model, {
        visual: `${x.who}: „${x.said}“`,
        traps: [[/(?:sagte|sagt|meinte)(?: dass)? (?:\w+ )+(?:hat|ist|kennt|kostet|bin)(?: |$)/, '转述用 Konjunktiv I：habe / sei / kenne / koste。']],
      });
  const fvg = (id: string, x: typeof f) => q(id, [`Sagen Sie es förmlicher, mit Nomen und Verb: „Wir müssen ${x.verb}.“`], '功能动词结构：把动词换成「名词 + 动词」', [x.acc], x.model, { visual: `${x.verb} → ? + Verb` });
  const first = [
    q('opinion', [t.ask], '用观点句式回答，并给出理由（Ich bin der Ansicht, dass … weil …）', [], t.opinion, {
      grade: needs([[OPINION, '先亮明观点：Ich bin der Ansicht / Meiner Meinung nach …'], [REASON, '空话伤不了它：说出理由（weil / denn …）。']]),
    }),
    q('example', ['Schöne Worte. Haben Sie ein Beispiel?', 'Woher wissen Sie das? Ein Beispiel, bitte.'], '举一个具体的例子',
      [], t.example, { grade: exampleGrade }),
    report('report', qt),
  ];
  const rest = [
    q('counter', [c.ask], '反驳它，并给出理由',
      [], c.model, {
        grade: needs([[/(?:das stimmt (?:so )?nicht|ich bin anderer meinung|da widerspreche ich|nicht unbedingt|im gegenteil|das sehe ich anders|ich stimme nicht zu|nein|zwar|einerseits|das ist falsch)/, '先表明你不同意：Das sehe ich anders / Da widerspreche ich …'], [REASON, '反驳要带理由：denn / weil …']]),
      }),
    fvg('fvg', f),
    fvg('fvg2', f2),
    report('report2', qt2),
    q('concrete', ['Wir müssen die Zukunft gemeinsam gestalten. Sie verstehen sicher.', 'Es gibt viel zu tun. Packen wir es an.'], '它在说空话。追问或说出具体要做什么',
      [`(?:die stadt (?:soll|sollte|muss|muesste)|man (?:sollte|muss|koennte)|wir (?:sollten|muessen|koennten)|was genau|wie genau|konkret|mehr ${S}|weniger ${S}|bauen|investieren|senken|erhoehen)`], 'Was genau? Die Stadt sollte mehr Radwege bauen.',
      { traps: [[/^(?:ja|genau|richtig|stimmt|klar)$/, '跟着说「对」等于没说。问它「Was genau?」或者说出具体做法。']] }),
    q('procon', ['Nennen Sie einen Vorteil und einen Nachteil.', 'Was spricht dafür, was dagegen?'], '各说一个好处和坏处', [], 'Ein Vorteil ist, dass es billiger wird. Ein Nachteil ist, dass es mehr Steuern kostet.', {
      grade: needs([[/(?:vorteil|dafuer spricht|positiv|gut ist|der nutzen)/, '先说好处：Ein Vorteil ist …'], [/(?:nachteil|dagegen spricht|negativ|problem|aber|allerdings|jedoch)/, '再说坏处：Ein Nachteil ist …']]),
    }),
    q('fazit', ['Und Ihr Fazit?', 'Fassen Sie zusammen.'], '总结（Zusammenfassend … / Alles in allem …）',
      [`(?:zusammenfassend|insgesamt|alles in allem|abschliessend|mein fazit|im grossen und ganzen|kurz gesagt|deshalb|daher)`], 'Alles in allem überwiegen für mich die Vorteile.'),
  ];
  return [...first, ...shuffle(rng, rest)];
};

// ---- 14 · 铸币场 · 贪婪 Gier (persuade: wenn … dann / zwar … aber; charts; sein + zu, -bar; genitive prepositions) --------

const CHART_ITEMS = ['Der Brotpreis', 'Die Miete', 'Der Umsatz', 'Der Strompreis'];
/** Realistic sizes for the chart (1.0.12 试玩: a rent of 5 € read oddly): the small step numbers times a scale. */
const CHART_SCALE: Record<string, { k: number; per: string }> = {
  'Der Brotpreis': { k: 1, per: '' },
  'Die Miete': { k: 100, per: ' / Monat' },
  'Der Umsatz': { k: 100, per: ' / Tag' },
  'Der Strompreis': { k: 10, per: ' / Monat' },
};
const ZU: Array<{ pass: string; acc: string; model: string }> = [
  { pass: 'Das Formular muss ausgefüllt werden.', acc: 'das formular ist (?:noch |sofort |bis \\w+ )?auszufuellen', model: 'Das Formular ist auszufüllen.' },
  { pass: 'Die Rechnung muss bezahlt werden.', acc: 'die rechnung ist (?:noch |sofort |bis \\w+ )?zu bezahlen', model: 'Die Rechnung ist zu bezahlen.' },
  { pass: 'Der Müll muss getrennt werden.', acc: 'der muell ist (?:noch |immer )?zu trennen', model: 'Der Müll ist zu trennen.' },
  { pass: 'Die Frist muss eingehalten werden.', acc: 'die frist ist (?:unbedingt )?einzuhalten', model: 'Die Frist ist einzuhalten.' },
];
/** `acc`: the object of «Kann man … ?» (1.0.12 试玩 32: Kann man den Pilz essen?); «Lässt sich …» keeps `thing`. */
const BAR: Array<{ thing: string; acc: string; inf: string; adj: string }> = [
  { thing: 'die Flasche', acc: 'die Flasche', inf: 'recyceln', adj: 'recycelbar' },
  { thing: 'das Handy', acc: 'das Handy', inf: 'reparieren', adj: 'reparierbar' },
  { thing: 'der Pilz', acc: 'den Pilz', inf: 'essen', adj: 'essbar' },
  { thing: 'die Jacke', acc: 'die Jacke', inf: 'waschen', adj: 'waschbar' },
  { thing: 'die Schrift', acc: 'die Schrift', inf: 'lesen', adj: 'lesbar' },
];
const GEN: Array<{ prep: string; noun: string; acc: string; model: string; ask: string }> = [
  { prep: 'aufgrund', noun: 'der Streik', acc: 'aufgrund (?:des|eines) streiks?', model: 'Aufgrund des Streiks ist der Laden geschlossen.', ask: 'Warum ist der Laden geschlossen?' },
  { prep: 'trotz', noun: 'der Regen', acc: 'trotz (?:des|eines) regens', model: 'Trotz des Regens kaufen alle ein.', ask: 'Kaufen die Leute auch bei Regen ein?' },
  { prep: 'innerhalb', noun: 'eine Woche', acc: 'innerhalb (?:einer|der) woche', model: 'Innerhalb einer Woche kommt das Geld zurück.', ask: 'Wann bekomme ich mein Geld zurück?' },
  { prep: 'wegen', noun: 'die Krise', acc: 'wegen der krise', model: 'Wegen der Krise sind die Preise gestiegen.', ask: 'Warum sind die Preise so hoch?' },
];

const GREED = (rng: Rng): BossQuestion[] => {
  const item = pick(rng, CHART_ITEMS);
  const sc = CHART_SCALE[item] ?? { k: 1, per: '' };
  const a0 = pick(rng, [2, 3, 4, 5]);
  const d0 = pick(rng, [1, 2, 3]);
  const up = rng() < 0.6;
  const a = a0 * sc.k;
  const b = (up ? a0 + d0 : Math.max(1, a0 - d0)) * sc.k;
  const diff = Math.abs(b - a);
  const num = (n: number) => `(?:${n}|${normalize(['null', 'eins', 'zwei', 'drei', 'vier', 'fuenf', 'sechs', 'sieben', 'acht'][n] ?? String(n))}|${normalize(['', 'einen', 'zwei', 'drei'][n] ?? String(n))}${n === 100 ? '|hundert|einhundert' : ''})`;
  const verb = up ? '(?:gestiegen|steigt|stieg|erhoeht|zugenommen|gewachsen|wuchs)' : '(?:gesunken|sinkt|sank|gefallen|faellt|fiel|abgenommen|zurueckgegangen)';
  const zu = pick(rng, ZU);
  const bar = pick(rng, BAR);
  const g = pick(rng, GEN);
  const first = [
    q('chart', [`Sieh dir die Zahlen an. Wie hat sich ${item.replace(/^Der |^Die /, (m) => m.toLowerCase())} entwickelt?`], `看图表说变化（${up ? 'steigen' : 'sinken'} um = 变了多少，auf = 变到多少）`,
      [`${verb}.*(?:um ${num(diff)}|auf ${num(b)})`, `(?:um ${num(diff)}|auf ${num(b)}) (?:euro )?${verb}`], `${item} ist um ${diff} Euro auf ${b} Euro ${up ? 'gestiegen' : 'gesunken'}.`, {
        visual: `${item}: 2020 → ${a} €${sc.per} · 2025 → ${b} €${sc.per}`,
        traps: [[new RegExp(`um ${num(b)}(?: |$)`), `um 是变了多少（${diff}），auf 是变到多少（${b}）。`]],
      }),
    q('wenn', ['Ich nehme alles. Warum sollte ich dir etwas lassen?', 'Alles gehört mir. Gib mir einen Grund, loszulassen.'], '用条件句说服它（Wenn …, dann …）',
      [`^wenn .+ (?:dann )?(?:hast|bist|wirst|kannst|bleibt|gibt|ist|wird|verlierst|bleibst|musst|haettest|waerst|waerest|wuerdest|hat|sind|haben|werden)(?: |$)`], 'Wenn du alles nimmst, hast du am Ende niemanden mehr.',
      { traps: [[/^(?:weil|denn) /, '这里要条件句：Wenn …, (dann) …']] }),
    q('zwar', ['Geld ist alles. Oder etwa nicht?', 'Mehr ist immer besser. Stimmt doch?'], '让步再反驳（Zwar …, aber …）', [], 'Zwar ist Geld wichtig, aber es macht nicht glücklich.', { grade: concedeGrade }),
  ];
  const rest = [
    q('zu', [`Sag es mit sein + zu: „${zu.pass}“`], '被动的替代形式：sein + zu + 不定式', [zu.acc], zu.model, { visual: zu.pass }),
    q('bar', [`Kann man ${bar.acc} ${bar.inf}?`, `Lässt sich ${bar.thing} ${bar.inf}?`], `用 -bar 或 sich lassen 回答（${bar.adj} / lässt sich ${bar.inf}）`,
      [`(?:ist|sind) (?:nicht |gut |leicht |kaum )?${bar.adj}`, `(?:laesst|lassen) sich (?:nicht |gut |leicht |kaum )?${bar.inf}`], `Ja, ${bar.thing} ist ${bar.adj}.`),
    q('gen', [`${g.ask} Sag es mit „${g.prep}“: ${g.noun}.`], `属格介词：${g.prep} + 第二格`, [g.acc], g.model, {
      visual: `${g.prep} + ${g.noun}`,
      traps: [[new RegExp(`${g.prep} (?:dem|den|der|einem) (?!woche|krise)`), `${g.prep} 要第二格：des / der / eines / einer。`]],
    }),
    q('letgo', ['Ich gebe nichts zurück. Überzeug mich!', 'Warum sollte ich teilen?'], '再劝它一次（wenn / zwar … aber / obwohl 都行）',
      [`^wenn `, `zwar .+ (?:aber|doch|trotzdem)`, `(?:obwohl|obgleich|auch wenn|wenngleich) `], 'Auch wenn du alles hast, bist du allein.'),
    q('need', ['Was brauchst du wirklich?', 'Was ist dir mehr wert als Geld?'], '说出你真正需要 / 看重的东西',
      [`^(?:ich brauche|was ich (?:wirklich )?brauche|mir (?:ist|sind) .+ (?:wichtig|wert)|mehr wert (?:ist|sind)|meine )`], 'Ich brauche nicht viel, nur Zeit mit meiner Familie.'),
  ];
  return [...first, ...shuffle(rng, rest)];
};

// ---- 15 · 蚀变③ 林底 · 枯林之母 (she speaks A2; rewrite into B2 written style; hin/her; subjective modals) ------------

const REWRITE: Array<{ a2: string; acc: string; model: string }> = [
  { a2: 'Weil es regnet, fällt das Fest aus.', acc: '(?:wegen|aufgrund) des regens', model: 'Wegen des Regens fällt das Fest aus.' },
  { a2: 'Nachdem wir gegessen hatten, gingen wir spazieren.', acc: 'nach dem essen', model: 'Nach dem Essen gingen wir spazieren.' },
  { a2: 'Wenn man den Müll trennt, schützt man die Umwelt.', acc: '(?:durch|mit) (?:die |der )?muelltrennung', model: 'Durch Mülltrennung schützt man die Umwelt.' },
  { a2: 'Bevor Sie abreisen, zahlen Sie bitte.', acc: 'vor (?:der|ihrer) abreise', model: 'Vor der Abreise zahlen Sie bitte.' },
  { a2: 'Obwohl es kalt war, schwammen wir im See.', acc: 'trotz der kaelte', model: 'Trotz der Kälte schwammen wir im See.' },
  { a2: 'Während wir fuhren, schliefen die Kinder.', acc: 'waehrend der fahrt', model: 'Während der Fahrt schliefen die Kinder.' },
  { a2: 'Weil die Miete steigt, ziehen viele weg.', acc: '(?:wegen|aufgrund) (?:der (?:steigenden miete|mietsteigerung|mieterhoehung)|des mietanstiegs|steigender mieten)', model: 'Wegen der steigenden Miete ziehen viele weg.' },
  { a2: 'Als er ankam, regnete es.', acc: 'bei seiner ankunft', model: 'Bei seiner Ankunft regnete es.' },
  { a2: 'Wenn Sie Fragen haben, rufen Sie an.', acc: 'bei (?:fragen|rueckfragen)', model: 'Bei Fragen rufen Sie an.' },
];
const SUBJ: Array<{ said: string; acc: string; model: string; zh: string }> = [
  { said: 'Man sagt: Er hat das Geld gestohlen.', acc: 'er soll das geld gestohlen haben', model: 'Er soll das Geld gestohlen haben.', zh: '用 soll 说「据说」' },
  { said: 'Sie behauptet: Ich habe den Wald gerettet.', acc: 'sie will den wald gerettet haben', model: 'Sie will den Wald gerettet haben.', zh: '用 will 说「她自称」' },
  { said: 'Ich bin fast sicher: Er hat den Zug verpasst.', acc: 'er muss den zug verpasst haben', model: 'Er muss den Zug verpasst haben.', zh: '用 muss 说「肯定是」' },
  { said: 'Man sagt: Die Bäume sind krank gewesen.', acc: 'die baeume sollen krank gewesen sein', model: 'Die Bäume sollen krank gewesen sein.', zh: '用 sollen 说「据说」' },
];
const HINHER: Array<{ ask: string; acc: string; model: string; wrong: string; note: string }> = [
  { ask: 'Du stehst oben am Fenster. Dein Freund unten soll zu dir hochkommen. Was rufst du?', acc: '(?:komm|kommen sie) (?:doch |mal |bitte )*(?:herauf|rauf|hoch|nach oben)', model: 'Komm herauf!', wrong: 'hinauf', note: '朝说话人这边用 her：Komm herauf!' },
  { ask: 'Du stehst unten. Dein Freund oben soll zu dir herunterkommen. Was rufst du?', acc: '(?:komm|kommen sie) (?:doch |mal |bitte )*(?:herunter|runter|nach unten)', model: 'Komm herunter!', wrong: 'hinunter', note: '朝说话人这边用 her：Komm herunter!' },
  { ask: 'Du bist im Haus. Dein Gast steht draußen vor der Tür. Was sagst du?', acc: '(?:komm|kommen sie) (?:doch |mal |bitte )*(?:herein|rein)', model: 'Kommen Sie herein!', wrong: 'hinein', note: '进到说话人这边用 herein。' },
  { ask: 'Du stehst unten an der Treppe und schickst dein Kind nach oben ins Bett. Was sagst du?', acc: '(?:geh|gehen sie) (?:doch |jetzt |bitte )*(?:hinauf|rauf|hoch|nach oben)', model: 'Geh hinauf ins Bett!', wrong: 'herauf', note: '离开说话人用 hin：Geh hinauf!' },
];

const ROOTS = (rng: Rng): BossQuestion[] => {
  const rw = shuffle(rng, REWRITE);
  const sj = pick(rng, SUBJ);
  const hh = pick(rng, HINHER);
  const rewrite = (r: (typeof REWRITE)[number], i: number) =>
    q(`rewrite${i}`, [`„${r.a2}“ So reden die Kinder. Sag es so, wie es in der Zeitung steht.`, `„${r.a2}“ Das ist mir zu einfach. Schreib es mit einem Nomen.`], '把 A2 说法改写成 B2 书面说法（从句 → 介词 + 名词）',
      [r.acc], r.model, { visual: r.a2, traps: [[/^(?:weil|nachdem|wenn|bevor|obwohl|waehrend|als) /, '别再用从句：换成介词 + 名词（wegen des …, nach dem …）。']] });
  const first = [rewrite(rw[0], 0), rewrite(rw[1], 1), q('subj', [`${sj.said} Sag es mit einem Modalverb.`], `情态动词的主观用法：${sj.zh}`, [sj.acc], sj.model, { visual: sj.said })];
  const rest = [
    rewrite(rw[2], 2),
    rewrite(rw[3], 3),
    q('hinher', [hh.ask], '方位副词 hin / her（朝说话人 her，离开说话人 hin）', [hh.acc], hh.model, { traps: [[new RegExp(hh.wrong), hh.note]] }),
    q('green', ['Warum sollte ich wieder grün werden?', 'Niemand braucht diesen Wald. Oder?'], '用 B2 说法说出森林的意义（名词式更好）',
      [`(?:der wald|die baeume|der schutz|die erhaltung|ohne (?:den )?wald|fuer (?:die|das|den) ${S}|weil|da )`], 'Der Schutz des Waldes ist für unser Klima entscheidend.'),
  ];
  return [...first, ...shuffle(rng, rest)];
};

// ---- 16 · 面具剧场 · 伪装 Schein (truth and lies: contradictions, Konjunktiv I; extended participles; nominal style) -----

const LIES: Array<{ before: string; now: string }> = [
  { before: 'Ich war nie in Wien.', now: 'In Wien habe ich drei Jahre Theater gespielt.' },
  { before: 'Ich kann nicht singen.', now: 'Gestern habe ich in der Oper gesungen.' },
  { before: 'Ich habe keine Geschwister.', now: 'Mein Bruder ist auch Schauspieler.' },
  { before: 'Ich lese nie Bücher.', now: 'Dieses Buch habe ich schon fünfmal gelesen.' },
];
const KI: Array<{ said: string; acc: string; model: string }> = [
  { said: 'Ich bin Ärztin.', acc: 'sie (?:sei|waere) (?:eine )?aerztin', model: 'Sie sagt, sie sei Ärztin.' },
  { said: 'Ich habe ein Schloss.', acc: 'sie habe ein schloss', model: 'Sie sagt, sie habe ein Schloss.' },
  { said: 'Ich kann fliegen.', acc: 'sie koenne fliegen', model: 'Sie sagt, sie könne fliegen.' },
  { said: 'Ich weiß alles.', acc: 'sie wisse alles', model: 'Sie sagt, sie wisse alles.' },
];
const PART: Array<{ rel: string; acc: string; model: string }> = [
  { rel: 'der Brief, den er geschrieben hat', acc: 'der von ihm geschriebene brief', model: 'der von ihm geschriebene Brief' },
  { rel: 'das Buch, das viel gelesen wird', acc: 'das viel gelesene buch', model: 'das viel gelesene Buch' },
  { rel: 'die Stadt, die vom Krieg zerstört wurde', acc: 'die (?:im|vom) krieg zerstoerte stadt', model: 'die im Krieg zerstörte Stadt' },
  { rel: 'der Zug, der gerade ankommt', acc: 'der gerade ankommende zug', model: 'der gerade ankommende Zug' },
  { rel: 'die Preise, die ständig steigen', acc: 'die staendig steigenden preise', model: 'die ständig steigenden Preise' },
];
const NOMINAL: Array<{ verbal: string; acc: string; model: string }> = [
  { verbal: 'Die Preise steigen.', acc: '(?:der anstieg der preise|die preissteigerung|das steigen der preise|der preisanstieg)', model: 'der Anstieg der Preise' },
  { verbal: 'Das Museum wird eröffnet.', acc: 'die eroeffnung des museums', model: 'die Eröffnung des Museums' },
  { verbal: 'Die Firma wird gegründet.', acc: 'die gruendung der firma', model: 'die Gründung der Firma' },
  { verbal: 'Die Regeln werden geändert.', acc: 'die (?:aenderung|abaenderung) der regeln', model: 'die Änderung der Regeln' },
];

const MASK = (rng: Rng): BossQuestion[] => {
  const l = pick(rng, LIES);
  const k = pick(rng, KI);
  const p = pick(rng, PART);
  const n = pick(rng, NOMINAL);
  const first = [
    q('liar', [`„${l.now}“`, `Übrigens: „${l.now}“`], '它前后矛盾。指出来（Vorhin hast du gesagt, … / Das ist ein Widerspruch）',
      [`(?:vorhin|vorher|zuerst|eben|gerade) (?:hast du|haben sie|hat|sagtest|sagten|sagte)`, `(?:widerspruch|widersprichst|luegst|gelogen|das stimmt nicht|das passt nicht)`, `(?:du hast|sie haben) (?:doch )?(?:gesagt|behauptet)`], `Vorhin hast du gesagt, ${l.before.replace(/\.$/, '').replace(/^Ich/, 'du').toLowerCase()}. Das ist ein Widerspruch.`, {
        visual: `vorhin: „${l.before}“`,
      }),
    q('ki', [`Die Maske links sagt: „${k.said}“ Gib wieder, was sie sagt.`], '用 Konjunktiv I 转述（sie sagt, sie sei / habe / könne …）',
      [`(?:sagt|sagte|behauptet|behauptete|meint)(?: dass)? ${k.acc}`, `^${k.acc}`], k.model, { traps: [[/(?:sagt|sagte|behauptet)(?: dass)? sie (?:ist|hat|kann|weiss)(?: |$)/, '转述用 Konjunktiv I：sei / habe / könne / wisse。']] }),
    q('part', [`Sag es kürzer, mit einem Partizip vor dem Nomen: „${p.rel}“`], '扩展分词定语（der von ihm geschriebene Brief）', [p.acc], p.model, { visual: p.rel }),
  ];
  const rest = [
    q('nominal', [`Sag es im Nominalstil: „${n.verbal}“`], '名词化文体（动词 → 名词 + 第二格）', [n.acc], n.model, { visual: n.verbal }),
    q('review', ['Wie hat dir das Stück gefallen? Begründe.', 'Ist das ein gutes Buch? Warum?'], '像写书评 / 影评一样：评价 + 理由', [], 'Das Stück hat mir gefallen, weil die Schauspieler sehr überzeugend waren.', {
      grade: needs([[/(?:gefallen|gefiel|gut|schlecht|langweilig|spannend|ueberzeugend|beeindruckend|enttaeuschend|gelungen|misslungen|empfehle|empfehlenswert)/, '先评价：hat mir (nicht) gefallen / spannend / enttäuschend …'], [REASON, '再说理由：weil / denn …']]),
    }),
    q('truth', ['Ich habe nie gelogen. Glaubst du mir?', 'Alles, was ich sage, ist wahr.'], '不信它，说明为什么',
      [`(?:nein|ich glaube (?:dir|ihnen) nicht|das stimmt nicht|du luegst|gelogen|widerspruch|vorhin)`], 'Nein, ich glaube dir nicht. Vorhin hast du etwas anderes gesagt.'),
    q('face', ['Wer bin ich wirklich?', 'Was ist hinter der Maske?'], '说出面具后面是什么',
      [`^(?:du bist|sie sind|hinter der maske (?:ist|bist)|da ist|nur) `], 'Du bist nur Schein. Hinter der Maske ist niemand.'),
  ];
  return [...first, ...shuffle(rng, rest)];
};

// ---- 17 · 档案深处 · 被抹去的历史 (timeline; Konjunktiv II past and als ob; sofern / indem / wohingegen) ------------------

const HISTORY = [
  'Im Archiv begann das Projekt „Das vollkommene Wörterbuch“.',
  'Jedes Wort durfte nur noch eine Bedeutung haben.',
  'Ein Riss öffnete sich im Archiv.',
  'Durch den Riss kam die Stille.',
  'Die Reste des Projekts gründeten den Orden.',
];

const ERASED = (rng: Rng): BossQuestion[] => {
  const start = Math.floor(rng() * (HISTORY.length - 2));
  const three = HISTORY.slice(start, start + 3);
  const order = shuffle(rng, [0, 1, 2]);
  const letters = ['a', 'b', 'c'];
  const shown = order.map((i, j) => `${letters[j].toUpperCase()}) ${three[i]}`).join('  ');
  const firstLetter = letters[order.indexOf(0)];
  const lastLetter = letters[order.indexOf(2)];
  const askFirst = rng() < 0.5;
  const want = askFirst ? firstLetter : lastLetter;
  const first = [
    q('timeline', [askFirst ? 'Die Akten sind durcheinander. Was geschah zuerst?' : 'Die Akten sind durcheinander. Was geschah zuletzt?'], `读打乱的记载，说出哪件事${askFirst ? '最先' : '最后'}发生（写字母）`,
      [`^(?:${want}|${want} (?:war|kam|geschah) (?:zuerst|zuletzt)|(?:zuerst|zuletzt) ${want})$`], want.toUpperCase(), { visual: shown }),
    q('kii', ['Was hättest du getan, wenn du damals im Archiv gewesen wärst?', 'Was wäre passiert, wenn niemand das Wörterbuch gebaut hätte?'], '过去的虚拟（hätte / wäre + 分词）',
      [`(?:ich haette|haette ich|ich waere|waere ich|es waere|waere es|dann haette|dann waere|niemand haette|die stille waere|wir haetten|man haette) .*(?:t|en)$`], 'Ich hätte die anderen gewarnt.',
      { traps: [[/^(?:ich wuerde|dann wuerde)/, '过去的假设用 hätte / wäre + 分词：Ich hätte …']] }),
    q('alsob', ['Wie hat dich der Archivar angesehen?', 'Wie spricht das System mit dir?'], 'als ob + 虚拟式（als ob er alles wüsste）',
      [`als ob .+ (?:waere|haette|wuesste|koennte|wuerde|sei|habe|kennte|gaebe)$`, `^als (?:waere|haette|wuesste|koennte|wuerde) `, ` als (?:waere|haette|wuesste|koennte|wuerde) `], 'Er hat mich angesehen, als ob er mich kennen würde.',
      { traps: [[/als ob .+ (?:ist|hat|weiss|kann|kennt)$/, 'als ob 后面用虚拟式：als ob er alles wüsste。']] }),
  ];
  const rest = [
    q('indem', ['Wie hält man eine Sprache lebendig?', 'Wie kann man die Stille aufhalten?'], '用 indem 说方法', [`indem `, `dadurch dass `], 'Indem man sie jeden Tag spricht, auch mit Fehlern.'),
    q('sofern', ['Darf ich die versiegelten Akten lesen?', 'Darf jeder ins Archiv?'], '有条件地回答（sofern / vorausgesetzt …）', [`(?:sofern|soweit|vorausgesetzt|unter der bedingung|falls) `], 'Ja, sofern du sie danach nicht vernichtest.'),
    q('contrast', ['Was unterscheidet das Wörterbuch von einer lebendigen Sprache?', 'Worin unterscheidet sich der Orden von dir?'], '对比（wohingegen / während / hingegen）',
      [`(?:wohingegen|waehrend|dagegen|hingegen|im gegensatz|im unterschied)`], 'Das Wörterbuch kennt nur eine Bedeutung, wohingegen eine lebendige Sprache viele kennt.'),
    q('ilse', ['Wer war Ilse Lehmann?', 'Was weißt du über die Archivarin?'], '说说档案员 Ilse Lehmann',
      [`(?:archivarin|sie war|ilse lehmann war|sie hat (?:im archiv|briefe|geschrieben)|sie arbeitete|sie hat gearbeitet)`], 'Sie war Archivarin. Sie hat Briefe geschrieben, als sie die Wörter verlor.'),
    q('why', ['Warum wurde die Geschichte gelöscht?', 'Warum wollte jemand, dass wir vergessen?'], '说原因或目的（weil / damit / um … zu）', [`(?:weil|damit|um .+ zu|da |denn)`], 'Damit niemand weiß, woher die Stille kam.'),
  ];
  return [...first, ...shuffle(rng, rest)];
};

// ---- 18 · 天平庭 · 审判者 (a trial: opening, three charges, evidence, closing; concession; idioms) --------------------

const IDIOMS: Array<{ meaning: string; acc: string; model: string }> = [
  { meaning: 'offen sagen, was man denkt', acc: 'kein blatt vor den mund', model: 'kein Blatt vor den Mund nehmen' },
  { meaning: 'genau das Richtige sagen', acc: 'nagel auf den kopf', model: 'den Nagel auf den Kopf treffen' },
  { meaning: 'privat, ohne Zeugen', acc: 'unter vier augen', model: 'unter vier Augen' },
  { meaning: 'sich irren, falsch liegen', acc: 'holzweg', model: 'auf dem Holzweg sein' },
  { meaning: 'etwas Peinliches sagen oder tun', acc: 'fettnaepfchen', model: 'ins Fettnäpfchen treten' },
];

const TRIAL = (rng: Rng): BossQuestion[] => {
  const id = pick(rng, IDIOMS);
  const charge = (n: number, text: string) =>
    q(`charge${n}`, [`Anklagepunkt ${n}: ${text}`], `回应第 ${n} 条指控：先承认一部分，再反驳（Zwar …, aber … / Wenngleich …）`, [], 'Zwar hat sie dem Orden gedient, aber sie hat dabei Menschen geschützt.', { grade: concedeGrade });
  const first = [
    q('open', ['Die Verteidigung hat das Wort. Ihr Eröffnungsplädoyer, bitte.'], '开场陈述：你为谁辩护、你要证明什么',
      [`(?:ich (?:vertrete|verteidige)|mein mandant|meine mandantin|frau weber|ich werde (?:zeigen|beweisen)|ist unschuldig|hat nichts falsch|ich moechte zeigen)`], 'Ich verteidige Frau Weber und werde zeigen, dass sie unschuldig ist.'),
    charge(1, 'Frau Weber hat dem Orden gedient.'),
    charge(2, 'Sie hat Wörter verbieten lassen.'),
  ];
  const middle = [
    charge(3, 'Sie hat geschwiegen, als sie hätte sprechen müssen.'),
    q('evidence', ['Welche Beweise haben Sie?', 'Worauf stützen Sie sich?'], '拿出证据', [`(?:beweis|zeuge|zeugin|dokument|brief|akte|tagebuch|hat gesehen|ich habe hier|wie die akten zeigen)`], 'Ich habe hier einen Brief von Ilse Lehmann.'),
    q('idiom', [`Welche Redewendung passt? „${id.meaning}“`], '选对习语（Redewendung）', [id.acc], id.model, { visual: id.meaning }),
    q('sides', ['Ist sie nun schuldig oder nicht?', 'Wägen Sie ab.'], '两面权衡（einerseits … andererseits）',
      [`einerseits .+ andererseits`, `(?:zwar|wenngleich|obwohl) .+`], 'Einerseits hat sie Fehler gemacht, andererseits hat sie viele gerettet.'),
  ];
  const close = q('close', ['Ihr Schlussplädoyer.', 'Das letzte Wort hat die Verteidigung.'], '结辩：总结并提出请求',
    [`(?:deshalb|daher|aus diesen gruenden|zusammenfassend|ich bitte|ich fordere|freispruch|freisprechen|unschuldig)`], 'Aus diesen Gründen bitte ich um einen Freispruch.');
  return [...first, ...shuffle(rng, middle), close];
};

// ---- 19 · 蚀变④ 回潮 · 虚无 Nichts (it empties words: say it another way; register; complex nominal style) -------------

const SYN: Array<{ word: string; sent: string; acc: string; model: string; gone: string }> = [
  { word: 'anfangen', sent: 'Der Kurs fängt morgen an.', acc: '(?:beginnt|startet|geht .*los)', model: 'Der Kurs beginnt morgen.', gone: '(?:faengt|anfangen|anfaengt)' },
  { word: 'kaufen', sent: 'Ich kaufe heute Brot.', acc: '(?:besorge|hole|erwerbe|hole mir)', model: 'Ich besorge heute Brot.', gone: 'kauf' },
  { word: 'wichtig', sent: 'Das ist sehr wichtig.', acc: '(?:bedeutend|entscheidend|wesentlich|zentral|von (?:grosser )?bedeutung|bedeutsam|relevant)', model: 'Das ist entscheidend.', gone: 'wichtig' },
  { word: 'helfen', sent: 'Kannst du mir helfen?', acc: '(?:unterstuetzen|zur hand gehen|behilflich)', model: 'Kannst du mich unterstützen?', gone: 'helf|hilf' },
  { word: 'Problem', sent: 'Wir haben ein Problem.', acc: '(?:schwierigkeit|herausforderung|haken)', model: 'Wir haben eine Schwierigkeit.', gone: 'problem' },
  { word: 'vielleicht', sent: 'Vielleicht kommt sie morgen.', acc: '(?:moeglicherweise|eventuell|womoeglich|unter umstaenden|wahrscheinlich|es kann sein)', model: 'Möglicherweise kommt sie morgen.', gone: 'vielleicht' },
  { word: 'benutzen', sent: 'Ich benutze das Wörterbuch.', acc: '(?:verwende|nutze|gebrauche)', model: 'Ich verwende das Wörterbuch.', gone: 'benutz' },
  { word: 'aufhören', sent: 'Wir hören jetzt auf.', acc: '(?:beenden|machen schluss|stoppen|lassen es)', model: 'Wir beenden das jetzt.', gone: '(?:hoeren .*auf|aufhoeren)' },
];
const FORMAL: Array<{ casual: string; acc: string; model: string }> = [
  { casual: 'Hast du Bock auf Kino?', acc: '(?:haetten sie|haben sie) (?:lust|interesse)|moechten sie', model: 'Hätten Sie Lust, ins Kino zu gehen?' },
  { casual: 'Gib mal das Salz!', acc: '(?:koennten|wuerden) sie mir .*(?:salz|reichen)|reichen sie mir bitte', model: 'Könnten Sie mir bitte das Salz reichen?' },
  { casual: 'Keine Ahnung.', acc: '(?:das )?weiss ich (?:leider )?nicht|mir ist (?:das )?(?:leider )?nicht bekannt|ich habe (?:leider )?keine (?:information|kenntnis)', model: 'Das weiß ich leider nicht.' },
  { casual: 'Ich hau ab.', acc: 'ich (?:gehe jetzt|verabschiede mich|muss (?:jetzt |leider )?gehen|mache mich auf den weg)', model: 'Ich verabschiede mich jetzt.' },
];
const CASUAL: Array<{ formal: string; acc: string; model: string }> = [
  { formal: 'Ich bedaure, Ihnen mitteilen zu müssen, dass der Termin entfällt.', acc: '(?:faellt (?:[a-z]+ )?aus|abgesagt|findet nicht statt|klappt nicht)', model: 'Du, der Termin fällt leider aus.' },
  { formal: 'Wir bitten um Ihr Verständnis für die Verzögerung.', acc: '(?:sorry|tut mir leid|entschuldig|dauert (?:noch )?(?:etwas|ein bisschen|laenger)|verspaet)', model: 'Sorry, das dauert noch ein bisschen.' },
  { formal: 'Ihre Anwesenheit wird erbeten.', acc: '(?:komm|kommst du|bitte komm|sei da|du solltest kommen)', model: 'Komm bitte vorbei!' },
];

const NOTHING = (rng: Rng): BossQuestion[] => {
  const syn = shuffle(rng, SYN);
  const fm = pick(rng, FORMAL);
  const cs = pick(rng, CASUAL);
  const takeaway = (s: (typeof SYN)[number], i: number) =>
    q(`syn${i}`, [`Das Nichts nimmt dir das Wort „${s.word}“. Sag ohne dieses Wort: „${s.sent}“`], `同义改写：不能用「${s.word}」`, [s.acc], s.model, {
      visual: `✕ ${s.word}`,
      traps: [[new RegExp(s.gone), '这个词已经被抽空了。换一种说法。']],
    });
  const first = [
    takeaway(syn[0], 0),
    takeaway(syn[1], 1),
    q('formal', [`Dein Kumpel sagt: „${fm.casual}“ Sag dasselbe zu deiner Chefin.`], '语域转换：口语 → 正式（Sie）', [fm.acc], fm.model, {
      visual: fm.casual,
      traps: [[/(?:^| )(?:du|dir|dich|hast du|gib|hau)(?: |$)/, '对上司要用 Sie 和正式说法。']],
    }),
  ];
  const rest = [
    takeaway(syn[2], 2),
    takeaway(syn[3], 3),
    q('casual', [`Im Brief steht: „${cs.formal}“ Sag es einem Freund.`], '语域转换：书面 → 口语', [cs.acc], cs.model, { visual: cs.formal }),
    q('nominal', ['Sag es im Nominalstil: „Weil die Kosten stark gestiegen sind, wird das Projekt gestoppt.“'], '复杂名词化：从句 → 介词 + 名词短语',
      [`(?:aufgrund|wegen) (?:des (?:starken )?(?:anstiegs der kosten|kostenanstiegs)|der (?:stark )?gestiegenen kosten|stark gestiegener kosten)`], 'Aufgrund des starken Anstiegs der Kosten wird das Projekt gestoppt.'),
  ];
  return [...first, ...shuffle(rng, rest)];
};

// ---- 20 · 沉默之心 · 沉默 Die Stille (free speech in parts: opening, thesis, argument, example, objection, question, appeal, last line) --

const STILLNESS = (rng: Rng): BossQuestion[] => {
  const first = [
    q('open', ['Vor dir stehen alle, die ihre Sprache verloren haben. Wie fängst du an?'], '开场：向听众开口',
      [`(?:liebe|meine damen und herren|liebe freunde|hallo|guten (?:abend|tag|morgen)|ich moechte|heute (?:moechte|spreche|will)|stellen sie sich vor|stellt euch vor|hoert mir zu|hoeren sie)`], 'Liebe Freunde, ich möchte euch etwas erzählen.'),
    q('thesis', ['Was willst du ihnen sagen?', 'Worum geht es dir?'], '你的核心主张（活的语言允许错、允许不同的说法）',
      [`(?:sprache|fehler|falsch|anders|sprechen|woerter|wort|reden|sagen|bedeutung)`], 'Eine lebendige Sprache darf Fehler haben und viele Bedeutungen.'),
    q('argument', ['Ein perfektes Wörterbuch wäre doch besser. Ohne Fehler. Ohne Streit.'], '反驳它的主张，给出理由', [], 'Nein, denn ohne Fehler lernt niemand etwas.', {
      grade: needs([[REASON, '给出理由：denn / weil …']]),
    }),
  ];
  const rest = [
    q('example', ['Erzähl ihnen ein Beispiel von deinem Weg.', 'Woher weißt du das?'], '从你一路的经历里举一个例子',
      [`(?:als ich|zum beispiel|am anfang|in (?:der|dem|einem) ${S}|hilde|konrad|greta|mira|jonas|lina|brandt|weber|ilse|ich habe .+ gelernt)`], 'Am Anfang konnte ich nicht einmal meinen Namen sagen. Ich habe es mit Fehlern gelernt.'),
    q('concede', ['Fehler sind Schwäche. Wer schweigt, macht keine Fehler.'], '让步再反驳（Zwar …, aber … / Wenngleich …）', [], 'Zwar macht man beim Sprechen Fehler, aber nur so versteht man sich.', { grade: concedeGrade }),
    q('rhetoric', ['Stell den Zuhörern eine Frage.', 'Frag sie etwas, das sie nicht vergessen.'], '修辞问句',
      [`^(?:wer|was|wie|warum|wann|wo|wozu|wofuer|welche[rsnm]?|kennt|kennen|habt|haben|seid|sind|ist|wollt|wollen|wuerdet|wuerden|waere|muss|koennt|koennen|erinnert|erinnern) .+`], 'Wer von euch hat nie einen Fehler gemacht?'),
    q('appeal', ['Was sollen sie jetzt tun?', 'Und dann?'], '呼吁（lasst uns … / sprecht …）',
      [`(?:lasst uns|lassen sie uns|sprecht|sprechen sie|habt keine angst|hab keine angst|traut euch|redet|sagt|schreibt|wir sollten|wir muessen|ihr solltet|ihr muesst|fangt an|fangen wir)`], 'Lasst uns wieder sprechen, auch wenn es falsch klingt.'),
  ];
  const last = q('last', ['Dein letzter Satz.'], '最后一句话（完整的句子）', [`^[a-z]+(?: [a-z]+){2,}`], 'Die Stille ist vorbei.');
  return [...first, ...shuffle(rng, rest), last];
};

// ---------------------------------------------------------------------------------------------------------------

export const B2_BOSSES: LaterBoss[] = [
  {
    region: 13, name: '空话议员', de: 'Der Phrasendrescher', level: 128, hp: 12, title: '有理有据的人',
    intro: ['议事厅的讲台上站着一个没有脸的议员。他讲了一个小时，台下的人在鼓掌，可谁也说不出他讲了什么。', '「Wir müssen die Herausforderungen der Zukunft gemeinsam angehen.」', '系统：辩论战。观点 + 理由 + 例子才伤得了它；套话和「对、对」一点用都没有。转述它的话要用 Konjunktiv I。'],
    outro: ['议员张了张嘴，第一次没有话可说。', '「… das ist ein gutes Argument.」他小声说完，变回了一叠没人读过的发言稿。', '系统：议会堡的人开始互相追问「为什么」了。'],
    healLine: 'Wir nehmen das sehr ernst.', healZh: '我们非常重视这件事。（它要回血！下一题答对才能打断）',
    questions: DEBATE,
  },
  {
    region: 14, name: '贪婪', de: 'Die Gier', level: 138, hp: 12, title: '肯放手的人',
    intro: ['金库里堆满了没有数字的硬币。硬币堆成一张脸，一只手伸向你的口袋。', '「Mehr. Immer mehr. Gib mir alles.」', '系统：每一轮它都要拿走你一点东西。用条件句（Wenn …, dann …）和让步句（Zwar …, aber …）说服它放手；看图表时说清楚涨跌多少。'],
    outro: ['硬币一枚一枚滚落，那只手慢慢松开了。', '「… es ist genug.」它说完，金库里只剩下一枚普通的硬币。', '系统：铸币场的硬币上又有了数字。人们开始算一算值不值。'],
    healLine: 'Das gehört alles mir.', healZh: '这些全是我的。（它要回血！下一题答对才能打断）',
    questions: GREED,
  },
  {
    region: 15, name: '枯林之母', de: 'Die Mutter des Totholzes', level: 148, hp: 12, title: '让林子说话的人',
    intro: ['林底深处有一棵比天还高的树。树皮上是一张疲惫的脸，枝条上挂满了褪色的旧招牌：租屋城、泉疗镇、雾港、印章城。', '「Weil es regnet, bleibe ich zu Hause.」她说的都是孩子的句子。', '系统：她用 A2 的说法说话。把她的话改写成 B2 的书面说法（从句换成介词加名词），才伤得了她。'],
    outro: ['第一片绿叶从枝头冒出来，接着是第二片。', '「… aufgrund deiner Worte werde ich wieder grün.」树闭上眼睛，林子里的鸟开始叫了。', '系统：4–7 区的苔藓退了。那些地方的话，现在你会用两种说法讲。'],
    healLine: 'Die Blätter fallen wieder.', healZh: '叶子又落了。（它要回血！下一题答对才能打断）',
    questions: ROOTS,
  },
  {
    region: 16, name: '伪装', de: 'Der Schein', level: 158, hp: 13, title: '看得穿面具的人',
    intro: ['主舞台上，一个戴着面具的人在演独角戏。他每说一句，面具就换一张。', '「Ich bin König. Ich bin Bettler. Ich bin du.」', '系统：它交替说真话和假话。抓住前后矛盾，用 Konjunktiv I 转述它的话，把长句压成分词定语和名词式。'],
    outro: ['最后一张面具掉在地上，下面什么都没有。', '「… es war nur Theater.」舞台的灯一盏一盏熄灭。', '系统：面具剧场散场了。B2 的最后一扇门在考官那里。'],
    healLine: 'Der Vorhang fällt noch nicht.', healZh: '幕还没落。（它要回血！下一题答对才能打断）',
    questions: MASK,
  },
  {
    region: 17, name: '被抹去的历史', de: 'Die gelöschte Geschichte', level: 168, hp: 13, title: '记得的人',
    intro: ['封存的卷宗室里，一本空白的大书自己翻开了。每一页都被涂黑，只有页码还在。', '「Es gab kein Archiv. Es gab kein Projekt. Es gab nie etwas.」', '系统：把打乱的记载排出先后；说「要是当时……」用 hätte / wäre；说「好像……」用 als ob。'],
    outro: ['涂黑的地方一行一行退去，露出一个名字：Ilse Lehmann。', '「… es ist wirklich geschehen.」大书合上了。它不再是空白的。', '系统：你知道沉默从哪里来了：一部不允许错的词典。'],
    healLine: 'Diese Seite wurde nie geschrieben.', healZh: '这一页从来没写过。（它要回血！下一题答对才能打断）',
    questions: ERASED,
  },
  {
    region: 18, name: '审判者', de: 'Der Richter', level: 178, hp: 14, title: '为人辩护的人',
    intro: ['审判庭里只有一架天平和一个看不见脸的法官。被告席上坐着 Frau Weber。', '「Die Verhandlung ist eröffnet. Wer verteidigt die Angeklagte?」', '系统：一场庭审。开场陈述、回应三条指控、拿出证据、结辩。每条指控都先承认一部分，再反驳（Zwar …, aber … / Wenngleich …）。'],
    outro: ['天平停在中间，不再晃了。', '「… im Zweifel für die Angeklagte.」法官放下木槌，消失在光里。', '系统：Frau Weber 站起来，第一次没有拿她的登记表。'],
    healLine: 'Einspruch abgelehnt.', healZh: '反对无效。（它要回血！下一题答对才能打断）',
    questions: TRIAL,
  },
  {
    region: 19, name: '虚无', de: 'Das Nichts', level: 188, hp: 14, title: '换个说法也能说的人',
    intro: ['空白的播音间里没有声音，连红灯都是灰的。一个透明的影子坐在麦克风前，把词一个一个吸走。', '「Ohne Wort kein Gedanke. Ohne Gedanke nichts.」', '系统：它抽走一个词，你就换一种说法说同一个意思；它要你换语域，你就在口语、正式、书面之间换。'],
    outro: ['影子吸不动了。被抽走的词一个个落回原处，带着新的颜色。', '「… es gibt immer noch ein anderes Wort.」影子说完，散成了杂音。', '系统：9–12 区的颜色回来了。最后一区在天平庭后面。'],
    healLine: 'Noch ein Wort weniger.', healZh: '又少了一个词。（它要回血！下一题答对才能打断）',
    questions: NOTHING,
  },
  {
    region: 20, name: '沉默', de: 'Die Stille', level: 198, hp: 15, title: '开口的人',
    intro: ['开场的篝火还在烧，和你醒来的那天一模一样。火边坐着所有失语的人，他们看着你。', '沉默没有形状。它只是让一切都安静下来。', '系统：最后的首领。给所有人讲一次话：开场、主张、理由、例子、反驳、提问、呼吁，最后一句。说错了也没关系，这就是你要说的。'],
    outro: ['第一个人开口了，说错了一个词。旁边的人笑了，接着说了下去。', '「…」沉默什么也没说。它第一次被声音盖过去了。', '系统：你找回了你的名字，也找回了所有人的。'],
    healLine: '…', healZh: '（一片寂静。它要回血！下一题答对才能打断）',
    questions: STILLNESS,
  },
];
