// 0.7 + 0.8 · region bosses 4–12 (游戏设计 四 table; 六「首领：限时对话」).
// Same rules as regions 1–3: a timed conversation, one hit per right sentence, level and gear do not count. The
// pattern of each talk is fixed (the first questions come in order), the wording is drawn at random every time, and
// answers are tested on normalized text (lowercase, ae/oe/ue/ss, no punctuation). Questions with a picture or a
// clause on screen (`visual`) are made fresh each fight, so they can't be learned by heart.
//
// Written by Claude; needs a native-speaker check (they go through the same proofreading as the other data).
// Grammar per region follows 游戏设计 十六「语法线」: wo/wohin (4), comparatives (5), Konjunktiv II (6), contract
// reading + passive (7), als/wenn (8), relative clauses (9), listening (10), reasons with weil (11), reflexive +
// preposition (12).

import type { BossQuestion } from './boss';
import { numDe } from './boss2';
import { normalize } from '../core/grading';
import { pick, shuffle, type Rng } from '../core/rng';
import type { LaterRegionNo } from '../core/types';
import { xpToNext } from '../core/config';

export interface LaterBoss {
  region: LaterRegionNo;
  name: string;
  de: string;
  /** Can be challenged from this level (region N: 10N − 2, like 8 / 18 / 28). */
  level: number;
  hp: number;
  title: string;
  intro: string[];
  outro: string[];
  healLine: string;
  healZh: string;
  /** A fresh question queue: the fixed opening first, then the rest shuffled. */
  questions: (rng: Rng) => BossQuestion[];
}

/** A number as digits or as a word (normalized): 3 / drei, 1 / eins / ein / einen / eine. */
export function numRe(n: number): string {
  const w = normalize(numDe(n));
  return n === 1 ? '(?:1|eins|ein|einen|eine|einem|einer)' : `(?:${n}|${w})`;
}

const S = '[a-z]+';
/** Answer patterns may start with ja / nein / also and a filler. */
const lead = '^(?:(?:ja|nein|also|naja|hm|aeh|gut|okay|ok) )*';

function q(id: string, ask: string[], zh: string, accept: Array<RegExp | string>, model: string, extra: Partial<BossQuestion> = {}): BossQuestion {
  return { id, ask, zh, accept: accept.map((a) => (typeof a === 'string' ? new RegExp(a) : a)), model, ...extra };
}

function talk(rng: Rng, first: BossQuestion[], rest: BossQuestion[]): BossQuestion[] {
  return [...first, ...shuffle(rng, rest)];
}

// ---- 4 · 租屋城 · 登记魔像 (Anmeldung; wo / wohin with furniture) -------------------------------------------------

const ROOMS: Array<{ thing: string; art: 'der' | 'die' | 'das'; zh: string; room: string; dat: string; acc: string; roomZh: string }> = [
  { thing: 'Bett', art: 'das', zh: '床', room: 'Schlafzimmer', dat: 'im', acc: 'ins', roomZh: '卧室' },
  { thing: 'Sofa', art: 'das', zh: '沙发', room: 'Wohnzimmer', dat: 'im', acc: 'ins', roomZh: '客厅' },
  { thing: 'Tisch', art: 'der', zh: '桌子', room: 'Küche', dat: 'in der', acc: 'in die', roomZh: '厨房' },
  { thing: 'Lampe', art: 'die', zh: '灯', room: 'Flur', dat: 'im', acc: 'in den', roomZh: '走廊' },
  { thing: 'Schrank', art: 'der', zh: '柜子', room: 'Schlafzimmer', dat: 'im', acc: 'ins', roomZh: '卧室' },
  { thing: 'Spiegel', art: 'der', zh: '镜子', room: 'Bad', dat: 'im', acc: 'ins', roomZh: '浴室' },
  { thing: 'Regal', art: 'das', zh: '书架', room: 'Arbeitszimmer', dat: 'im', acc: 'ins', roomZh: '书房' },
];

function roomQuestion(rng: Rng): BossQuestion {
  const r = pick(rng, ROOMS);
  const room = normalize(r.room);
  const nom = { der: 'der', die: 'die', das: 'das' }[r.art];
  const acc = { der: 'den', die: 'die', das: 'das' }[r.art];
  const stand = r.thing === 'Lampe' || r.thing === 'Spiegel' ? 'hängt' : r.thing === 'Bett' || r.thing === 'Sofa' ? 'steht' : 'steht';
  if (rng() < 0.5)
    return q(
      'room-wo',
      [`Wo steht ${nom} ${r.thing}?`, `Und wo ist ${nom} ${r.thing}?`],
      `问${r.zh}在哪里（看平面图，答：在哪个房间，用第三格）`,
      [`(?:steht|haengt|ist|liegt) ${normalize(r.dat)} ${room}`, `^${normalize(r.dat)} ${room}$`],
      `${nom[0].toUpperCase() + nom.slice(1)} ${r.thing} ${stand} ${r.dat} ${r.room}.`,
      {
        visual: `${r.zh} ${r.thing} → ${r.roomZh} ${r.room}`,
        traps: [[new RegExp(`${normalize(r.acc)} ${room}`), 'wo（在哪）用第三格：im / in der，不用 ins / in die。']],
      },
    );
  return q(
    'room-wohin',
    [`Wohin stellen Sie ${acc} ${r.thing}?`, `Wohin kommt ${nom} ${r.thing}?`],
    `问你把${r.zh}放到哪里（看平面图，答：放进哪个房间，用第四格）`,
    [`${normalize(r.acc)} ${room}`],
    `Ich stelle ${acc} ${r.thing} ${r.acc} ${r.room}.`,
    {
      visual: `${r.zh} ${r.thing} → ${r.roomZh} ${r.room}`,
      traps: [[new RegExp(`${normalize(r.dat)} ${room}`), 'wohin（放到哪）用第四格：ins / in die / in den。']],
    },
  );
}

function rentQuestion(rng: Rng): BossQuestion {
  const rent = pick(rng, [350, 420, 480, 550, 600, 750]);
  const h = Math.floor(rent / 100);
  const rest = rent % 100;
  const word = `${h === 1 ? 'ein' : numDe(h)}hundert${rest ? numDe(rest) : ''}`;
  return q(
    'rent',
    ['Wie hoch ist die Miete?', 'Wie viel Miete zahlen Sie?', 'Was kostet die Wohnung im Monat?'],
    '问房租多少（看租约上的数字）',
    [`(?:${rent}|${normalize(word)}|${normalize(numDe(h))} ?hundert ?(?:und )?${rest ? normalize(numDe(rest)) : ''}) ?euro`],
    `Die Miete ist ${rent} Euro im Monat.`,
    { visual: `Miete: ${rent} € / Monat` },
  );
}

const REG = (rng: Rng): BossQuestion[] => {
  const first = [
    q('greet', ['Guten Tag! Sie wünschen?', 'Der Nächste, bitte!', 'Guten Tag. Was kann ich für Sie tun?'], '打招呼，说你来做什么（登记住址）',
      [`(?:guten (?:tag|morgen)|hallo)`, `(?:anmelden|anmeldung|ummelden|wohnung|wohnsitz|registrieren)`], 'Guten Tag, ich möchte mich anmelden.'),
    q('name', ['Wie ist Ihr Name?', 'Ihr Vor- und Nachname, bitte.', 'Wie heißen Sie?'], '问你的姓名',
      [`^(?:ich heisse|mein name ist|ich bin|mein vorname ist) ${S}`], 'Mein Name ist {name}.', { traps: [[new RegExp(`^${S}$`), '用完整的句子回答：Mein Name ist …']] }),
    q('address', ['Wo wohnen Sie jetzt?', 'Wie ist Ihre neue Adresse?', 'Und Ihre Adresse?'], '问你现在的地址',
      [`(?:ich wohne|meine (?:neue )?adresse ist|adresse ist) .*(?:strasse|weg|platz|allee|gasse|ring|in|im|am)`, `${S}(?:strasse|weg|platz|allee|gasse) ${'\\d+|' + S}`],
      'Ich wohne in der Bahnhofstraße 12.'),
  ];
  const rest = [
    q('since', ['Seit wann wohnen Sie dort?', 'Wann sind Sie eingezogen?'], '问你从什么时候开始住那里',
      [`^(?:ich wohne (?:dort |da |hier )?)?seit `, `(?:bin|sind) .*(?:eingezogen|umgezogen)`, `^(?:am|im|letzte|letzten|vor) `], 'Ich wohne seit zwei Wochen dort.',
      { traps: [[/^(?:fuer|vor) \w+ wochen? wohne/, '「住了多久」用 seit：Ich wohne seit …']] }),
    q('rooms', ['Wie viele Zimmer hat die Wohnung?', 'Wie groß ist die Wohnung?'], '问房子几个房间、多大',
      [`${numRe(1)} zimmer|${'(?:\\d+|zwei|drei|vier|fuenf)'} zimmer`, `\\d+ quadratmeter|${S} quadratmeter`], 'Die Wohnung hat zwei Zimmer.'),
    q('alone', ['Wohnen Sie allein?', 'Wer wohnt noch in der Wohnung?'], '问你是不是一个人住',
      [`${lead}ich wohne (?:allein|alleine|mit|zusammen)`, `^(?:mit meine[mrn]? |mit ${S} )`, `${lead}(?:niemand|mein |meine )`], 'Nein, ich wohne mit meiner Freundin zusammen.'),
    q('landlord', ['Wer ist Ihr Vermieter?', 'Wie heißt Ihr Vermieter?'], '问房东是谁',
      [`(?:mein vermieter|meine vermieterin|der vermieter|die vermieterin) (?:heisst|ist)`, `^(?:herr|frau) ${S}`], 'Mein Vermieter heißt Herr Schmidt.'),
    q('paper', ['Haben Sie die Wohnungsgeberbestätigung dabei?', 'Haben Sie den Mietvertrag dabei?'], '问你带没带房东确认书 / 租房合同',
      [`${lead}(?:ich habe|hier ist|hier bitte|ich habe ihn|ich habe sie|ich habe es|leider nicht|ich habe (?:ihn |sie )?nicht)`], 'Ja, hier ist sie.'),
    roomQuestion(rng),
    roomQuestion(rng),
    rentQuestion(rng),
  ];
  return talk(rng, first, rest);
};

// ---- 5 · 泉疗镇 · 无痛医生 (symptoms; comparatives) --------------------------------------------------------------

const BODY: Array<{ de: string; art: 'der' | 'die' | 'das'; zh: string; pain?: string }> = [
  { de: 'Kopf', art: 'der', zh: '头', pain: 'Kopfschmerzen' },
  { de: 'Bauch', art: 'der', zh: '肚子', pain: 'Bauchschmerzen' },
  { de: 'Hals', art: 'der', zh: '嗓子', pain: 'Halsschmerzen' },
  { de: 'Rücken', art: 'der', zh: '背', pain: 'Rückenschmerzen' },
  { de: 'Zahn', art: 'der', zh: '牙', pain: 'Zahnschmerzen' },
  { de: 'Bein', art: 'das', zh: '腿' },
  { de: 'Knie', art: 'das', zh: '膝盖' },
  { de: 'Ohr', art: 'das', zh: '耳朵', pain: 'Ohrenschmerzen' },
  { de: 'Hand', art: 'die', zh: '手' },
];

function painQuestion(rng: Rng): BossQuestion {
  const b = pick(rng, BODY);
  const d = normalize(b.de);
  const acc = [`mir tut ${b.art} ${d} weh`, `${b.art === 'die' ? 'meine' : 'mein'} ${d} tut (?:mir )?weh`, `${b.art} ${d} tut (?:mir )?weh`];
  if (b.pain) acc.push(`ich habe ${normalize(b.pain)}`);
  return q('pain', ['Was fehlt Ihnen?', 'Was tut Ihnen weh?', 'Wo haben Sie Schmerzen?'], `问你哪里不舒服（图上指着${b.zh}）`, acc,
    b.pain ? `Ich habe ${b.pain}. / Mir tut ${b.art} ${b.de} weh.` : `Mir tut ${b.art} ${b.de} weh.`, {
      visual: `✚ ${b.zh} ${b.de}`,
      traps: [[new RegExp(`ich tue ${d}|ich habe ${d} weh`), '说哪里疼：Mir tut der Kopf weh.（mir 是第三格）']],
    });
}

const DOC = (rng: Rng): BossQuestion[] => {
  const first = [
    q('greet', ['Guten Tag. Nehmen Sie Platz.', 'Der Nächste! Kommen Sie rein.', 'Guten Tag, was kann ich für Sie tun?'], '打招呼，说你来看病',
      [`(?:guten (?:tag|morgen)|hallo)`, `(?:termin|krank|schmerzen|weh|geht mir nicht gut|fuehle mich)`], 'Guten Tag, ich fühle mich nicht gut.'),
    painQuestion(rng),
    q('since', ['Seit wann haben Sie das?', 'Seit wann tut es weh?'], '问从什么时候开始',
      [`^(?:ich habe das |das habe ich |es tut )?(?:seit|schon seit) `, `^seit `, `(?:seit gestern|seit heute|seit ${S} (?:tagen|wochen|stunden))`], 'Seit zwei Tagen.',
      { traps: [[/^(?:vor|fuer) \w+ (?:tagen?|wochen?)/, '问 seit wann 就用 seit 回答：Seit zwei Tagen.']] }),
  ];
  const rest = [
    painQuestion(rng),
    q('fever', ['Haben Sie Fieber?', 'Haben Sie auch Fieber?'], '问你有没有发烧',
      [`${lead}ich habe (?:kein |leichtes |hohes |ein bisschen )?fieber`, `${lead}(?:kein fieber|ich habe keins)`], 'Nein, ich habe kein Fieber.',
      { traps: [[/ich habe nicht fieber/, '否定名词用 kein：Ich habe kein Fieber.']] }),
    q('meds', ['Nehmen Sie Medikamente?', 'Nehmen Sie schon etwas?'], '问你在不在吃药',
      [`${lead}ich nehme (?:keine|kein|nichts|tabletten|medikamente|${S})`], 'Nein, ich nehme keine Medikamente.'),
    q('smoke', ['Rauchen Sie?', 'Trinken Sie Alkohol?'], '问你抽不抽烟 / 喝不喝酒',
      [`${lead}ich (?:rauche|trinke) (?:nicht|nie|kaum|selten|manchmal|wenig|ein bisschen|keinen)`, `${lead}ich (?:rauche|trinke)$`], 'Nein, ich rauche nicht.'),
    q('better', ['Ist es heute besser oder schlechter als gestern?', 'Geht es Ihnen besser als gestern?'], '问比昨天好些还是差些（比较级）',
      [`(?:es ist|es geht|mir geht es|heute ist es|es geht mir) .*(?:besser|schlechter|schlimmer)`, `^(?:besser|schlechter|schlimmer)(?: als gestern)?$`, `^(?:viel|etwas|ein bisschen) (?:besser|schlechter|schlimmer)`], 'Es ist besser als gestern.',
      { traps: [[/mehr gut|gueter|mehr schlecht/, 'gut 的比较级是 besser：Es geht mir besser.']] }),
    q('sleep', ['Wie schlafen Sie?', 'Schlafen Sie gut?'], '问你睡得怎么样',
      [`${lead}ich schlafe (?:gut|schlecht|nicht gut|wenig|kaum|zu wenig|sehr)`], 'Ich schlafe schlecht.'),
    q('allergy', ['Haben Sie Allergien?', 'Sind Sie allergisch gegen etwas?'], '问你有没有过敏',
      [`${lead}ich habe (?:keine )?allergie`, `${lead}ich bin (?:nicht )?allergisch`, `${lead}keine`], 'Nein, ich habe keine Allergien.'),
  ];
  return talk(rng, first, rest);
};

// ---- 6 · 雾港 · 雾中之船 (travel and weather; Konjunktiv II) -----------------------------------------------------

const WEATHER: Array<{ zh: string; mark: string; acc: string[]; model: string }> = [
  { zh: '晴天', mark: '☀', acc: ['es ist sonnig', 'die sonne scheint', 'es ist schoen'], model: 'Die Sonne scheint.' },
  { zh: '下雨', mark: '☂', acc: ['es regnet', 'es gibt regen'], model: 'Es regnet.' },
  { zh: '下雪', mark: '❄', acc: ['es schneit', 'es gibt schnee'], model: 'Es schneit.' },
  { zh: '有风', mark: '≋', acc: ['es ist windig', 'es gibt wind', 'der wind'], model: 'Es ist windig.' },
  { zh: '多云', mark: '☁', acc: ['es ist (?:bewoelkt|wolkig)', 'es gibt wolken'], model: 'Es ist bewölkt.' },
  { zh: '有雾', mark: '▒', acc: ['es ist neblig', 'es gibt nebel', 'nebel'], model: 'Es ist neblig.' },
];

function weatherQuestion(rng: Rng): BossQuestion {
  const w = pick(rng, WEATHER);
  return q('weather', ['Wie ist das Wetter heute?', 'Und das Wetter? Wie ist es draußen?', 'Wie wird das Wetter morgen?'], `问天气（看天气牌：${w.zh}）`, w.acc, w.model, { visual: `${w.mark} ${w.zh}` });
}

const SHIP = (rng: Rng): BossQuestion[] => {
  const first = [
    q('where', ['Wohin wollen Sie reisen?', 'Wohin fahren Sie?', 'Wohin soll die Reise gehen?'], '问你要去哪里',
      [`(?:ich (?:moechte|will|fahre|reise|fliege|wuerde gern)|wir (?:fahren|reisen|fliegen)) .*(?:nach|in die|in den|ans|an die|zu)`, `^(?:nach|in die|ans|an die) ${S}`], 'Ich möchte nach Hamburg fahren.',
      { traps: [[/^ich (?:moechte|fahre) zu (?:deutschland|china|hamburg|berlin)/, '去城市和国家用 nach：nach Hamburg。']] }),
    q('how', ['Womit fahren Sie?', 'Wie reisen Sie?', 'Fahren Sie mit dem Zug?'], '问你坐什么去',
      [`mit (?:dem|der) ${S}`, `${lead}ich (?:fliege|fahre|gehe|laufe)`, `zu fuss`], 'Ich fahre mit dem Schiff.',
      { traps: [[/mit (?:zug|auto|schiff|bus|flugzeug)/, '交通工具前用 mit dem / mit der：mit dem Zug。']] }),
    weatherQuestion(rng),
  ];
  const rest = [
    weatherQuestion(rng),
    q('long', ['Wie lange bleiben Sie?', 'Wie lange dauert Ihr Urlaub?'], '问你待多久',
      [`(?:${numRe(1)}|\\d+|zwei|drei|vier|fuenf|sechs|sieben|zehn|vierzehn) (?:tage?|tagen|wochen?|monate?|monaten|naechte?|nacht)`, `(?:ein|eine|einen) (?:woche|monat|tag|wochenende)`, `^(?:bis|nur|etwa|ungefaehr) `], 'Ich bleibe eine Woche.'),
    q('hotel', ['Haben Sie schon ein Zimmer reserviert?', 'Wo übernachten Sie?'], '问你订没订房 / 住哪里',
      [`(?:habe|haben) .*(?:reserviert|gebucht)`, `${lead}(?:noch nicht|ich uebernachte|ich schlafe|im hotel|in einem|in der|bei )`], 'Ja, ich habe ein Zimmer im Hotel reserviert.'),
    q('wish', ['Was hätten Sie gern?', 'Was möchten Sie trinken?', 'Was darf es sein?'], '点东西（客气地说：hätte gern / möchte）',
      [`^ich (?:haette gern|haette gerne|moechte|nehme|wuerde gern)`], 'Ich hätte gern einen Tee.',
      { traps: [[/^ich will /, '客气一点：Ich hätte gern … / Ich möchte …']] }),
    q('if', ['Was würden Sie machen, wenn Sie mehr Zeit hätten?', 'Was würden Sie tun, wenn das Schiff nicht kommt?'], '用 würde 说你会做什么（第二虚拟式）',
      [`(?:ich wuerde|wuerde ich) ${S}`, `(?:ich koennte|koennte ich|ich haette|ich waere) ${S}`], 'Ich würde ans Meer fahren.',
      { traps: [[/^ich (?:werde|mache|fahre) /, '这是假设，用 würde：Ich würde …']] }),
    q('like', ['Was machen Sie gern im Urlaub?', 'Was gefällt Ihnen hier?'], '问你度假喜欢做什么',
      [`^(?:im urlaub )?(?:ich ${S} gern|${S} ich gern)`, `(?:mir gefaellt|mir gefallen|gefaellt mir)`], 'Im Urlaub schwimme ich gern.'),
    q('ticket', ['Haben Sie Ihre Fahrkarte?', 'Ihr Ticket, bitte.'], '要你的票',
      [`${lead}(?:hier ist|hier bitte|bitte schoen|ich habe|einen moment|moment)`], 'Ja, hier ist meine Fahrkarte.'),
  ];
  return talk(rng, first, rest);
};

// ---- 7 · 印章城 · 小字条款 Das Kleingedruckte (read the contract; passive) ---------------------------------------

interface Contract {
  kind: string;
  zh: string;
  months: number;
  notice: number;
  price: number;
  start: string;
  pay: string;
  payZh: string;
}

function makeContract(rng: Rng): Contract {
  const kind = pick(rng, [
    { kind: 'Handyvertrag', zh: '手机合同' },
    { kind: 'Mietvertrag', zh: '租房合同' },
    { kind: 'Versicherung', zh: '保险合同' },
    { kind: 'Fitnessstudio', zh: '健身房合同' },
  ]);
  const pay = pick(rng, [
    { pay: 'am Monatsanfang', payZh: '每月月初' },
    { pay: 'am Monatsende', payZh: '每月月底' },
    { pay: 'am ersten Montag im Monat', payZh: '每月第一个周一' },
  ]);
  return {
    ...kind,
    months: pick(rng, [6, 12, 24]),
    notice: pick(rng, [1, 2, 3]),
    price: pick(rng, [15, 20, 25, 30, 40]),
    start: pick(rng, ['März', 'April', 'Mai', 'Oktober']),
    ...pay,
  };
}

function clause(c: Contract): string {
  return `§ ${c.kind}\nLaufzeit: ${c.months} Monate · ab 1. ${c.start}\nPreis: ${c.price} € pro Monat\nKündigungsfrist: ${c.notice} ${c.notice === 1 ? 'Monat' : 'Monate'}\nDie Rechnung wird ${c.pay} bezahlt.`;
}

const SMALLPRINT = (rng: Rng): BossQuestion[] => {
  const c = makeContract(rng);
  const v = clause(c);
  const first = [
    q('long', ['Wie lange läuft der Vertrag?', 'Wie lange ist die Laufzeit?'], '问合同期多长（读条款）',
      [`${numRe(c.months)} monat`], `Der Vertrag läuft ${numDe(c.months)} Monate.`, { visual: v }),
    q('price', ['Wie viel kostet das im Monat?', 'Was zahlen Sie pro Monat?'], '问每月多少钱（读条款）',
      [`${numRe(c.price)} euro`], `Es kostet ${numDe(c.price)} Euro im Monat.`, { visual: v }),
    q('notice', ['Wie lange ist die Kündigungsfrist?', 'Wann müssen Sie kündigen?'], '问解约要提前多久（读条款）',
      [`${numRe(c.notice)} monat`], `Die Kündigungsfrist ist ${c.notice === 1 ? 'ein Monat' : `${numDe(c.notice)} Monate`}.`, { visual: v }),
  ];
  const rest = [
    q('start', ['Ab wann gilt der Vertrag?', 'Wann beginnt der Vertrag?'], '问合同从什么时候开始（读条款）',
      [`${normalize(c.start)}`], `Ab dem ersten ${c.start}.`, { visual: v }),
    q('pay', ['Wann wird die Rechnung bezahlt?', 'Wann wird das Geld abgebucht?'], '问账单什么时候付（被动语态：wird … bezahlt）',
      [normalize(c.pay).replace('am ', '(?:am |)'), c.pay.includes('Montag') ? 'montag' : c.pay.includes('anfang') ? 'anfang' : 'ende'],
      `Die Rechnung wird ${c.pay} bezahlt.`, { visual: v }),
    q('understood', ['Haben Sie alles verstanden?', 'Alles klar? Dann unterschreiben Sie hier.', 'Noch Fragen? Nein? Gut.'], '它想让你直接签字（先问清楚！）',
      [`(?:frage|fragen|erklaeren|nicht verstanden|verstehe .*nicht|noch einmal|was bedeutet|was heisst|moment|langsam)`], 'Nein, ich habe noch eine Frage. Was bedeutet „Kündigungsfrist“?',
      { traps: [[/^(?:ja|alles klar|klar|ok|okay)$/, '小字条款最怕你问。先别说懂了：Ich habe noch eine Frage.']] }),
    q('sign', ['Möchten Sie jetzt unterschreiben?', 'Unterschreiben Sie gleich hier?'], '它催你签字（先读再签）',
      [`(?:^nein|erst|zuerst|noch nicht|morgen|zu hause|lesen|durchlesen|ueberlegen|spaeter|kopie)`], 'Nein, ich möchte den Vertrag zuerst lesen.',
      { traps: [[/^ja/, '先别签：Ich möchte den Vertrag zuerst lesen.']] }),
    q('cancel', ['Wie kann man kündigen?', 'Wie kündigt man den Vertrag?'], '问怎么解约',
      [`(?:schriftlich|per brief|mit einem brief|per e ?mail|online|per post|einen brief|kuendigung schreiben|im laden)`], 'Man kann schriftlich kündigen.'),
    q('cost', ['Gibt es noch andere Kosten?', 'Kostet das noch etwas extra?'], '问还有没有别的费用',
      [`${lead}(?:es gibt|gibt es|keine|kein|ich weiss|ich glaube|ich (?:muss|moechte) (?:noch )?fragen|steht|nein|ja)`], 'Ich weiß nicht. Das möchte ich noch fragen.'),
  ];
  return talk(rng, first, rest);
};

// ---- 8 · 钟楼城 · 停摆的钟 (als / wenn, Perfekt and Präteritum mixed) ------------------------------------------

const VERB2 = '(?:war|hatte|habe|bin|konnte|musste|wollte|ging|kam|wohnte|spielte|lernte|las|fuhr|machte|sah|traf|ass|trank|blieb|lebte|kochte|arbeitete|schlief|lief|hat|ist|wurde)';

const CLOCK = (rng: Rng): BossQuestion[] => {
  const first = [
    q('child', ['Wie war es, als Sie ein Kind waren?', 'Erzählen Sie: Als Sie klein waren …'], '讲你小时候（als ich … war, + 主句动词在前）',
      [`^als ich (?:ein kind|klein|jung|${S}) war ${VERB2} \\w+`], 'Als ich ein Kind war, wohnte ich in Shanghai.',
      { traps: [[/^wenn ich (?:ein kind|klein) war/, '小时候是一段过去的时间，只这一次：用 als。'], [/^als ich (?:ein kind|klein) war ich /, 'als 从句后面主句动词在前：Als ich klein war, wohnte ich …']] }),
    q('arrive', ['Was war, als Sie in Deutschland angekommen sind?', 'Und als Sie hier ankamen?'], '讲你刚到德国那次（一次性的过去：als）',
      [`^als ich (?:in deutschland |hier |nach deutschland )?(?:angekommen bin|ankam|gekommen bin|kam) ${VERB2} \\w+`], 'Als ich in Deutschland angekommen bin, war alles neu.',
      { traps: [[/^wenn ich /, '只发生过一次的过去事用 als，不用 wenn。']] }),
    q('always', ['Was haben Sie immer gemacht, wenn Sie Zeit hatten?', 'Und wenn Sie frei hatten?'], '讲每次有空时你做什么（每次都这样：wenn）',
      [`^(?:immer )?wenn ich (?:zeit|frei|ferien|urlaub) hatte ${VERB2} \\w+`], 'Wenn ich Zeit hatte, habe ich gelesen.',
      { traps: [[/^als ich (?:zeit|frei)/, '每次都这样的过去习惯用 wenn。']] }),
  ];
  const rest = [
    q('rain', ['Und wenn es regnete?', 'Was haben Sie gemacht, wenn es geregnet hat?'], '每次下雨时你做什么（wenn）',
      [`^wenn es (?:regnete|geregnet hat) ${VERB2} \\w+`], 'Wenn es regnete, blieb ich zu Hause.',
      { traps: [[/^als es regnete/, '每次下雨都这样：用 wenn。']] }),
    q('yesterday', ['Was haben Sie gestern Abend gemacht?', 'Was haben Sie am Wochenende gemacht?'], '讲昨天晚上 / 周末做了什么（完成时）',
      [`^(?:gestern(?: abend)? |am wochenende )?(?:habe ich|bin ich|ich habe|ich bin) .+`], 'Gestern Abend habe ich gekocht.'),
    q('before', ['Was konnten Sie früher nicht?', 'Was mussten Sie früher oft machen?'], '讲以前不会 / 必须做的事（情态动词过去式）',
      [`^(?:frueher )?(?:konnte ich|ich konnte|musste ich|ich musste|wollte ich|ich wollte) `], 'Früher konnte ich nicht schwimmen.',
      { traps: [[/^(?:frueher )?(?:kann ich|ich kann|muss ich|ich muss) /, '说过去用 konnte / musste。']] }),
    q('first', ['Wann haben Sie angefangen, Deutsch zu lernen?', 'Wann haben Sie Ihre erste Wohnung gefunden?'], '问你什么时候开始的（时间 + 完成时，或 als 从句）',
      [`^(?:vor |im |am |letztes |letzten |als ich )`, `(?:habe|bin) .*(?:angefangen|gefunden|begonnen)`], 'Vor zwei Jahren habe ich angefangen.'),
    q('hobby', ['Was machen Sie in Ihrer Freizeit?', 'Haben Sie ein Hobby?'], '问你的爱好',
      [`(?:mein hobby ist|meine hobbys sind|ich ${S} gern|in meiner freizeit|${S} ich gern)`], 'In meiner Freizeit spiele ich Fußball.'),
    q('day', ['Wann stehen Sie normalerweise auf?', 'Wann gehen Sie ins Bett?'], '问你几点起床 / 睡觉（作息）',
      [`^(?:ich stehe .*auf|ich gehe .*bett|um )`, `(?:um \\d+|um ${S}) (?:uhr)?`], 'Ich stehe um sieben Uhr auf.'),
  ];
  return talk(rng, first, rest);
};

// ---- 9 · 工坊城 · 面试官 (job interview; relative clauses) ---------------------------------------------------------

const INTERVIEW = (rng: Rng): BossQuestion[] => {
  const first = [
    q('intro', ['Stellen Sie sich bitte kurz vor.', 'Erzählen Sie etwas über sich.'], '自我介绍',
      [`^(?:ich heisse|mein name ist|ich bin) ${S}`], 'Ich heiße {name}, ich komme aus China und wohne seit zwei Jahren in Deutschland.'),
    q('why', ['Warum möchten Sie bei uns arbeiten?', 'Warum interessieren Sie sich für diese Stelle?'], '问你为什么想来这里工作（weil 从句，动词在句尾）',
      [`^(?:weil|da) .+ (?:ist|sind|habe|hat|moechte|kann|will|finde|interessiert|gefaellt|passt|macht)$`, `^ich (?:moechte|will|interessiere mich)`], 'Weil mich die Arbeit interessiert.',
      { traps: [[/^weil (?:ich moechte|ich habe|ich kann|es ist)/, 'weil 从句里动词放最后：weil ich … möchte。']] }),
    q('strength', ['Was sind Ihre Stärken?', 'Was können Sie besonders gut?'], '问你的长处',
      [`^(?:meine staerke|meine staerken|ich bin|ich kann|ich arbeite)`], 'Ich bin zuverlässig und arbeite gern im Team.'),
  ];
  const rest = [
    q('exp', ['Haben Sie Berufserfahrung?', 'Wo haben Sie vorher gearbeitet?'], '问你的工作经验（完成时）',
      [`${lead}ich habe (?:schon |noch keine |keine )?(?:bei|in|als|erfahrung|${numRe(1)}|zwei|drei)`, `(?:habe|bin) .*gearbeitet`, `${lead}noch nicht`], 'Ich habe zwei Jahre als Kellner gearbeitet.'),
    q('start', ['Wann können Sie anfangen?', 'Ab wann wären Sie verfügbar?'], '问你什么时候能开始',
      [`^(?:ich kann |)(?:ab |am |im |sofort|naechste|naechsten|morgen|in ${S} (?:wochen|tagen))`], 'Ich kann ab nächstem Monat anfangen.'),
    q('lang', ['Welche Sprachen sprechen Sie?', 'Wie gut ist Ihr Deutsch?'], '问你会什么语言',
      [`^ich spreche `, `^mein deutsch ist`, `(?:chinesisch|deutsch|englisch) (?:und|sehr|gut|ein bisschen)`], 'Ich spreche Chinesisch, Englisch und ein bisschen Deutsch.'),
    q('job', ['Was für eine Stelle suchen Sie?', 'Was für eine Arbeit wünschen Sie sich?'], '说你找什么样的工作（关系从句：eine Stelle, die / in der …）',
      [`(?:stelle|arbeit|job|firma) (?:die|in der|bei der|wo|bei dem|in dem|der|das) `], 'Ich suche eine Stelle, die mir Spaß macht.',
      { traps: [[/^(?:eine )?(?:gute|interessante) (?:stelle|arbeit)$/, '用一个关系从句说清楚：eine Stelle, die …']] }),
    q('weak', ['Was ist Ihre größte Schwäche?', 'Was möchten Sie noch verbessern?'], '问你的短处',
      [`^(?:meine (?:groesste )?schwaeche|ich bin manchmal|manchmal bin ich|ich moechte .*verbessern|ich (?:muss|will) noch|mein deutsch)`], 'Manchmal bin ich zu ungeduldig.'),
    q('ask', ['Haben Sie noch Fragen an uns?', 'Möchten Sie noch etwas wissen?'], '面试最后问问题',
      [`(?:wie (?:viele|lange|hoch|ist)|wann|was|gibt es|kann ich|wie viel|wer)`], 'Wie viele Stunden pro Woche arbeitet man?'),
  ];
  return talk(rng, first, rest);
};

// ---- 10 · 电波塔 · 播报者 (listen to the news, answer the question) ---------------------------------------------

const NEWS: Array<{ text: string; ask: string; acc: string[]; model: string; zh: string }> = [
  { text: 'In Hamburg regnet es morgen den ganzen Tag.', ask: 'Wie wird das Wetter morgen in Hamburg?', acc: ['regn', 'regen'], model: 'Es regnet den ganzen Tag.', zh: '汉堡明天天气' },
  { text: 'Der Zug nach Köln fällt heute wegen eines Streiks aus.', ask: 'Warum fährt der Zug nach Köln nicht?', acc: ['streik'], model: 'Wegen eines Streiks.', zh: '去科隆的车为什么不开' },
  { text: 'Die Stadtbibliothek ist ab Montag wieder geöffnet.', ask: 'Ab wann ist die Bibliothek wieder offen?', acc: ['montag'], model: 'Ab Montag.', zh: '图书馆哪天重开' },
  { text: 'Die Strompreise steigen im Januar um zehn Prozent.', ask: 'Was passiert im Januar mit den Strompreisen?', acc: ['steigen', 'teurer', 'hoeher', 'zehn prozent', '10 prozent'], model: 'Sie steigen um zehn Prozent.', zh: '一月电价怎么了' },
  { text: 'Am Samstag gibt es ein kostenloses Konzert im Stadtpark.', ask: 'Wo ist das Konzert am Samstag?', acc: ['park'], model: 'Im Stadtpark.', zh: '周六的音乐会在哪' },
  { text: 'Wegen eines Unfalls ist die Autobahn A7 bis zum Abend gesperrt.', ask: 'Warum ist die A7 gesperrt?', acc: ['unfall'], model: 'Wegen eines Unfalls.', zh: 'A7 高速为什么封了' },
  { text: 'Die neue App hilft beim Mülltrennen und ist kostenlos.', ask: 'Was kostet die neue App?', acc: ['kostenlos', 'nichts', 'gratis', 'umsonst', 'null'], model: 'Sie ist kostenlos.', zh: '新应用多少钱' },
  { text: 'Ab nächster Woche fahren die Busse in der Nacht alle dreißig Minuten.', ask: 'Wie oft fahren die Busse in der Nacht?', acc: ['dreissig minuten', '30 minuten', 'halbe stunde'], model: 'Alle dreißig Minuten.', zh: '夜班车多久一班' },
  { text: 'Im Rathaus kann man Termine jetzt auch online buchen.', ask: 'Wie kann man jetzt Termine im Rathaus buchen?', acc: ['online', 'im internet', 'internet'], model: 'Man kann sie online buchen.', zh: '市政厅预约有什么新办法' },
];

const BROADCAST = (rng: Rng): BossQuestion[] => {
  const items = shuffle(rng, NEWS);
  const first = [
    q('greet', ['Guten Abend, meine Damen und Herren. Hören Sie gut zu? Sagen Sie Hallo!', 'Hier sind die Nachrichten. Sind Sie bereit?'], '它问你准备好了没有',
      [`(?:hallo|guten abend|ja|bereit|ich hoere|los|gern)`], 'Ja, ich bin bereit.'),
  ];
  const rest = items.map((n) => q(`news-${normalize(n.zh)}`, [`${n.text} – ${n.ask}`], `听新闻，答：${n.zh}`, n.acc, n.model));
  return [...first, ...rest];
};

// ---- 11 · 林底 · 枯林之母 (nature and environment; weil) --------------------------------------------------------

const FOREST = (rng: Rng): BossQuestion[] => {
  const first = [
    q('animals', ['Welche Tiere leben im Wald?', 'Welche Tiere kennst du im Wald?'], '问森林里有哪些动物',
      [`(?:fuchs|fuechse|reh|rehe|hirsch|vogel|voegel|wildschwein|eule|eichhoernchen|baer|wolf|woelfe|hase|hasen|igel|maus|maeuse|specht|ameise|kaefer|schlange)`], 'Im Wald leben Füchse, Rehe und Vögel.'),
    q('why', ['Warum ist der Wald wichtig?', 'Warum sollen wir die Bäume schützen?'], '问森林为什么重要（weil 从句，动词放最后）',
      [`^(?:weil|da) .+ (?:ist|sind|gibt|geben|macht|machen|braucht|brauchen|leben|lebt|produziert|produzieren|schuetzt|schuetzen|reinigt|haben|hat)$`, `^der wald (?:gibt|macht|ist|schuetzt|produziert)`], 'Weil die Bäume uns Luft zum Atmen geben.',
      { traps: [[/^weil (?:der wald ist|die baeume sind|es gibt)/, 'weil 从句里动词放最后：weil der Wald wichtig ist。']] }),
    q('do', ['Was tust du für die Umwelt?', 'Was kann man für die Umwelt tun?'], '问你能为环境做什么',
      [`^(?:ich|man|wir) (?:kann |koennen |sollte |sollten )?(?:trenne|trennen|fahre|fahren|spare|sparen|kaufe|kaufen|benutze|benutzen|esse|essen|nehme|nehmen|recycle|pflanze|pflanzen|schalte|schalten|${S})`], 'Ich trenne meinen Müll und fahre mit dem Fahrrad.'),
  ];
  const rest = [
    q('waste', ['Trennst du deinen Müll?', 'Wohin kommt eine leere Flasche?'], '问你分不分垃圾',
      [`${lead}ich trenne`, `(?:glascontainer|altglas|pfand|gelbe sack|gelben sack|gelbe tonne|in den|in die|zurueck)`], 'Ja, ich trenne meinen Müll. Die Flasche kommt in den Glascontainer.'),
    q('season', ['Wie ist das Wetter im Herbst?', 'Was passiert im Winter im Wald?'], '问秋天 / 冬天的天气和森林',
      [`(?:es ist|es wird|es regnet|es schneit|kalt|windig|neblig|nass|die blaetter|blaetter fallen|schnee)`], 'Im Herbst ist es windig und die Blätter fallen.'),
    q('bike', ['Fährst du lieber mit dem Fahrrad oder mit dem Auto? Warum?', 'Was ist besser für die Umwelt: Bus oder Auto?'], '问你更喜欢哪种出行、为什么',
      [`(?:lieber mit dem|der bus ist besser|das fahrrad ist besser|besser|weil)`], 'Ich fahre lieber mit dem Fahrrad, weil es gesund ist.'),
    q('saving', ['Wie kann man Wasser sparen?', 'Wie spart man Energie zu Hause?'], '问怎么省水 / 省电',
      [`^(?:man kann|man sollte|ich|wir|kurz|weniger|das licht|duschen)`], 'Man kann kürzer duschen.'),
    q('if', ['Was würdest du tun, wenn der Wald stirbt?', 'Was wäre, wenn es keine Bäume mehr gäbe?'], '假设问题（würde / wäre）',
      [`(?:ich wuerde|wuerde ich|es waere|waere es|wir wuerden|man wuerde|dann gaebe)`], 'Ich würde neue Bäume pflanzen.'),
  ];
  return talk(rng, first, rest);
};

// ---- 12 · 心巷 · 冷漠 Gleichgültigkeit (feelings; reflexive verbs with a preposition) --------------------------

const COLD = (rng: Rng): BossQuestion[] => {
  const egal: [RegExp, string] = [/^(?:egal|das ist mir egal|mir egal|ist egal|keine ahnung)$/, '「egal」正是它想听的。说出一种感受。'];
  const first = [
    q('feel', ['Wie fühlst du dich?', 'Wie geht es dir wirklich?'], '问你真实的感受',
      [`^(?:ich fuehle mich|mir geht es|mir gehts|es geht mir|ich bin) ${S}`], 'Ich fühle mich müde, aber auch froh.', { traps: [egal] }),
    q('joy', ['Worüber freust du dich?', 'Worauf freust du dich?'], '问你为什么高兴 / 期待什么（sich freuen über / auf）',
      [`^ich freue mich (?:ueber|auf|darueber|darauf|sehr) `], 'Ich freue mich auf das Wochenende.',
      { traps: [egal, [/^ich freue (?:ueber|auf)/, '反身动词别漏 mich：Ich freue mich auf …']] }),
    q('fear', ['Wovor hast du Angst?', 'Was macht dir Angst?'], '问你害怕什么（Angst haben vor + 第三格）',
      [`^ich habe angst (?:vor|davor|dass)`, `^(?:mir macht|mich macht) `, `angst (?:vor|davor)`], 'Ich habe Angst vor der Einsamkeit.', { traps: [egal] }),
  ];
  const rest = [
    q('miss', ['Wen vermisst du?', 'Wen hast du lange nicht gesehen?'], '问你想念谁',
      [`^ich (?:vermisse|habe) (?:meine|meinen|mein|die|den|das|${S})`], 'Ich vermisse meine Eltern.', { traps: [egal] }),
    q('anger', ['Worüber ärgerst du dich?', 'Was macht dich wütend?'], '问你为什么生气（sich ärgern über）',
      [`^ich aerger(?:e)? mich (?:ueber|darueber|wenn)`, `^(?:mich macht|es macht mich) `], 'Ich ärgere mich über Unpünktlichkeit.',
      { traps: [egal, [/^ich aerger(?:e)? (?:ueber|wenn)/, '反身动词别漏 mich：Ich ärgere mich über …']] }),
    q('important', ['Was ist dir wichtig?', 'Wer ist dir wichtig?'], '问你在乎什么 / 谁',
      [`^(?:mir ist|mir sind|wichtig (?:ist|sind)|meine |mein )`, `(?:ist mir wichtig|sind mir wichtig)`], 'Meine Familie ist mir wichtig.', { traps: [egal] }),
    q('friend', ['Was machst du, wenn ein Freund traurig ist?', 'Wie hilfst du einem Freund?'], '问朋友难过时你怎么做',
      [`^(?:wenn ein freund traurig ist )?(?:ich|dann) (?:rufe|rede|spreche|helfe|besuche|hoere|umarme|koche|bin|frage|${S})`], 'Dann rufe ich ihn an und höre ihm zu.', { traps: [egal] }),
    q('sorry', ['Was sagst du, wenn du einen Fehler gemacht hast?', 'Wie entschuldigst du dich?'], '问你犯错时怎么道歉',
      [`(?:entschuldigung|es tut mir leid|tut mir leid|ich entschuldige mich|verzeih)`], 'Es tut mir leid. Das war mein Fehler.', { traps: [egal] }),
  ];
  return talk(rng, first, rest);
};

// ---------------------------------------------------------------------------------------------------------------

export const LATER_BOSSES: LaterBoss[] = [
  {
    region: 4, name: '登记魔像', de: 'Der Meldegolem', level: 38, hp: 9, title: '有住址的人',
    intro: ['登记大厅里只有一张桌子。桌后坐着一个用表格和印章堆成的巨人，它的脸是一张空白的登记表。', '「Der Nächste!」它敲了一下印章，整个大厅都在抖。', '系统：用完整的句子回答它的问题；看图回答家具放在哪里（wo 用第三格，wohin 用第四格）。'],
    outro: ['最后一个印章落下，登记表上终于填满了字。', '「… angemeldet.」魔像说完，散成一叠盖好章的纸。', '系统：租屋城的门铃一个接一个亮了。门上都有了名字。'],
    healLine: 'Ich brauche noch einen Stempel.', healZh: '我还需要一个章。（它要回血！下一题答对才能打断）',
    questions: REG,
  },
  {
    region: 5, name: '无痛医生', de: 'Der schmerzlose Arzt', level: 48, hp: 9, title: '说得出疼的人',
    intro: ['诊室里的医生没有脸，只有一个听诊器挂在空空的领口上。', '「Was fehlt Ihnen? Ihnen fehlt nichts. Niemand hat Schmerzen.」它自己回答了自己的问题。', '系统：看图说哪里疼，说清楚从什么时候开始、比昨天好还是差。'],
    outro: ['听诊器掉在地上，响了一声，像心跳。', '「… gute Besserung.」医生说完，变回了一件挂在门后的白大褂。', '系统：泉疗镇的人开始说自己哪里疼了。这是好事。'],
    healLine: 'Mir tut nichts weh.', healZh: '我哪儿都不疼。（它要回血！下一题答对才能打断）',
    questions: DOC,
  },
  {
    region: 6, name: '雾中之船', de: 'Das Schiff im Nebel', level: 58, hp: 10, title: '有方向的人',
    intro: ['泊位上停着一艘没有名字的船。船帆是雾做的，船长是一盏会说话的灯。', '「Wohin? Wohin? Niemand weiß, wohin.」灯光一明一灭。', '系统：说清楚你去哪里、怎么去、天气怎样，想做什么就用 würde / hätte gern。'],
    outro: ['雾一层层退下去，船头露出了名字：Hoffnung。', '「… gute Reise.」灯说完，就只是一盏普通的灯了。', '系统：雾港的船又有了方向。'],
    healLine: 'Der Nebel wird dichter.', healZh: '雾更浓了。（它要回血！下一题答对才能打断）',
    questions: SHIP,
  },
  {
    region: 7, name: '小字条款', de: 'Das Kleingedruckte', level: 68, hp: 10, title: '读到最后一行的人',
    intro: ['条款密室的墙上写满了字，越往下越小，最后一行小得像蚂蚁。那些蚂蚁在爬。', '「Unterschreiben Sie einfach hier. Das ist nur eine Formalität.」一支笔自己伸到你面前。', '系统：读屏幕上的条款回答问题。它催你签字时，先问清楚、先读完。'],
    outro: ['最后一行小字被你读出来以后，所有条款都变大了，变得能看清了。', '「… gekündigt.」它说完，合同上的字一行一行褪色。', '系统：印章城的章不再乱盖了。人们开始先读后签。'],
    healLine: 'Siehe Anhang B.', healZh: '见附件 B。（它要回血！下一题答对才能打断）',
    questions: SMALLPRINT,
  },
  {
    region: 8, name: '停摆的钟', de: 'Die stehende Uhr', level: 78, hp: 11, title: '讲得出往事的人',
    intro: ['钟楼顶上，一只巨大的钟面朝下躺着。指针停在一个不存在的时间。', '「Damals … immer … einmal … Ich weiß nicht mehr, wann.」它把过去的事搅成一团。', '系统：讲往事。只发生一次的用 als，每次都这样的用 wenn；从句后面主句动词在前。'],
    outro: ['指针动了。先是一下，然后一格一格地走起来。', '「… es war einmal.」钟说完，城里所有的钟同时敲响。', '系统：钟楼城的人开始讲昨天的事了。A2 的最后一扇门在考官那里。'],
    healLine: 'Die Zeit bleibt stehen.', healZh: '时间停住了。（它要回血！下一题答对才能打断）',
    questions: CLOCK,
  },
  {
    region: 9, name: '面试官', de: 'Der Personaler', level: 88, hp: 11, title: '被录用的人',
    intro: ['面试室里只有一把椅子和一张很长的桌子。桌子那头坐着一个西装，里面没有人。', '「Setzen Sie sich. Wir haben nicht viel Zeit.」西装翻开你的简历，简历是空白的。', '系统：这是一场面试。用完整的句子介绍自己，说理由用 weil（动词放最后），说想要的工作用关系从句。'],
    outro: ['西装站起来，伸出一只空空的袖子和你握手。', '「… Sie sind eingestellt.」它说完，挂回了衣帽架。', '系统：工坊城的机器旁边，工人们想起了自己的工作。'],
    healLine: 'Wir melden uns.', healZh: '我们会再联系您。（它要回血！下一题答对才能打断）',
    questions: INTERVIEW,
  },
  {
    region: 10, name: '播报者', de: 'Der Sprecher', level: 98, hp: 12, title: '听得懂新闻的人',
    intro: ['播音间的红灯亮着。一个只有嘴的影子坐在麦克风前，不停地念新闻。', '「Und nun die Nachrichten.」它念得很快，一条接一条。', '系统：听它念的新闻，再回答问题。可以点「再听」。'],
    outro: ['红灯灭了。影子最后念了一句：「Das waren die Nachrichten.」', '麦克风前空了。收音机里传来一首老歌。', '系统：电波塔又开始播完整的新闻了。'],
    healLine: 'Wir unterbrechen für eine Eilmeldung.', healZh: '插播一条快讯。（它要回血！下一题答对才能打断）',
    questions: BROADCAST,
  },
  {
    region: 11, name: '枯林之母', de: 'Die Mutter des Totholzes', level: 108, hp: 12, title: '让林子说话的人',
    intro: ['枯林中心有一棵比天还高的树。树皮上是一张疲惫的脸，枝条上挂满了没有名字的动物。', '「Niemand kennt uns mehr. Warum sollte ich grün werden?」', '系统：说自然、动物和环境，说理由用 weil，说假设用 würde。'],
    outro: ['第一片绿叶从枝头冒出来，接着是第二片。', '「… danke.」树闭上眼睛，林子里的鸟开始叫了。', '系统：林底的动物都有了名字。'],
    healLine: 'Die Blätter fallen wieder.', healZh: '叶子又落了。（它要回血！下一题答对才能打断）',
    questions: FOREST,
  },
  {
    region: 12, name: '冷漠', de: 'Die Gleichgültigkeit', level: 118, hp: 12, title: '在乎的人',
    intro: ['最后那扇门后面什么都没有。没有颜色，没有声音，只有一个声音在说：「Das ist mir egal.」', '它不攻击你。它只是等着你也说「egal」。', '系统：第一只神格。说出你的感受、你在乎的人和事。说「egal」只会让它更强。'],
    outro: ['冷漠第一次皱了一下眉，然后，它哭了。', '「… es ist mir nicht egal.」这句话说完，它变成了一个普通的、会难过的人。', '系统：心巷的人开始互相打招呼了。B1 的最后一扇门在考官那里。'],
    healLine: 'Das ist mir egal.', healZh: '我无所谓。（它要回血！下一题答对才能打断）',
    questions: COLD,
  },
];

export const LATER_BOSS: Partial<Record<number, LaterBoss>> = Object.fromEntries(LATER_BOSSES.map((b) => [b.region, b]));

/** First-kill XP ≈ 30% of the boss level's level-up XP (游戏设计 五, same ratio as 晚点之王's 1000 at Lv28). */
export function laterBossXp(level: number): number {
  return Math.round((xpToNext(level) * 0.3) / 10) * 10;
}

/** Gold grows with the level from 晚点之王's 350 at Lv28. */
export function laterBossGold(level: number): number {
  return Math.round((350 * level) / 28 / 10) * 10;
}
