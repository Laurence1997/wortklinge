// 现在完成时 (0.6 第 5 块, region 3 from Lv21): auxiliary, Partizip II and one Perfekt sentence for every verb.
// Sentence format: '… {aux} … [participle] …|中文'. The monster line blanks {aux} (haben / sein stance);
// 填分词 blanks [participle] and shows the infinitive.
// kind: 'reg' = ge-…-t (Lv21) · 'irr' = strong or mixed (Lv24) · 'pre' = separable, be-/ver-/er-/ge- and -ieren (Lv27).
// Written by Claude; needs a native-speaker check.

import { LEX_PERFEKT } from './lexicon';

export type Aux = 'haben' | 'sein';
export type PerfektKind = 'reg' | 'irr' | 'pre';

export interface Perfekt {
  aux: Aux;
  pp: string;
  kind: PerfektKind;
  /** '… {habe} … [gekauft] …|中文' */
  ex: string;
}

const p = (aux: Aux, pp: string, kind: PerfektKind, ex: string): Perfekt => ({ aux, pp, kind, ex });

export const PERFEKT: Record<string, Perfekt> = {
  // Region 1
  sein: p('sein', 'gewesen', 'irr', 'Ich {bin} gestern in Berlin [gewesen].|我昨天在柏林。'),
  haben: p('haben', 'gehabt', 'reg', 'Wir {haben} keine Zeit [gehabt].|我们当时没有时间。'),
  heißen: p('haben', 'geheißen', 'irr', 'Die Straße {hat} früher anders [geheißen].|这条街以前叫别的名字。'),
  kommen: p('sein', 'gekommen', 'irr', 'Der Bus {ist} zu spät [gekommen].|公交车来晚了。'),
  wohnen: p('haben', 'gewohnt', 'reg', 'Ich {habe} zwei Jahre in Köln [gewohnt].|我在科隆住过两年。'),
  sprechen: p('haben', 'gesprochen', 'irr', 'Wir {haben} lange [gesprochen].|我们聊了很久。'),
  lernen: p('haben', 'gelernt', 'reg', 'Ich {habe} gestern Deutsch [gelernt].|我昨天学了德语。'),
  arbeiten: p('haben', 'gearbeitet', 'reg', 'Sie {hat} heute viel [gearbeitet].|她今天干了很多活。'),
  machen: p('haben', 'gemacht', 'reg', 'Was {haben} Sie gestern [gemacht]?|您昨天做了什么？'),
  gehen: p('sein', 'gegangen', 'irr', 'Lina {ist} zum Bahnhof [gegangen].|Lina 去火车站了。'),
  verstehen: p('haben', 'verstanden', 'pre', 'Ich {habe} das nicht [verstanden].|我没听懂。'),
  buchstabieren: p('haben', 'buchstabiert', 'pre', 'Er {hat} seinen Namen [buchstabiert].|他把名字拼了一遍。'),
  fragen: p('haben', 'gefragt', 'reg', 'Ich {habe} den Fahrer [gefragt].|我问了司机。'),
  antworten: p('haben', 'geantwortet', 'reg', 'Niemand {hat} [geantwortet].|没有人回答。'),
  schreiben: p('haben', 'geschrieben', 'irr', 'Ich {habe} dir eine Karte [geschrieben].|我给你写了一张明信片。'),
  lesen: p('haben', 'gelesen', 'irr', '{Hast} du den Fahrplan [gelesen]?|你看时刻表了吗？'),
  hören: p('haben', 'gehört', 'reg', 'Ich {habe} einen Zug [gehört].|我听见了一列火车。'),
  sagen: p('haben', 'gesagt', 'reg', 'Was {hat} sie [gesagt]?|她说了什么？'),
  // Region 2
  essen: p('haben', 'gegessen', 'irr', 'Wir {haben} im Zug Brot [gegessen].|我们在火车上吃了面包。'),
  trinken: p('haben', 'getrunken', 'irr', 'Ich {habe} einen Kaffee [getrunken].|我喝了一杯咖啡。'),
  nehmen: p('haben', 'genommen', 'irr', 'Er {hat} den letzten Bus [genommen].|他坐了最后一班公交。'),
  kaufen: p('haben', 'gekauft', 'reg', 'Ich {habe} eine Fahrkarte [gekauft].|我买了一张车票。'),
  kosten: p('haben', 'gekostet', 'reg', 'Das Ticket {hat} zehn Euro [gekostet].|这张票花了十欧元。'),
  brauchen: p('haben', 'gebraucht', 'reg', 'Wir {haben} eine Stunde [gebraucht].|我们用了一个小时。'),
  geben: p('haben', 'gegeben', 'irr', 'Sie {hat} mir ihre Adresse [gegeben].|她给了我她的地址。'),
  bezahlen: p('haben', 'bezahlt', 'pre', 'Ich {habe} schon [bezahlt].|我已经付过钱了。'),
  kochen: p('haben', 'gekocht', 'reg', 'Konrad {hat} Suppe [gekocht].|Konrad 煮了汤。'),
  sehen: p('haben', 'gesehen', 'irr', 'Ich {habe} Lina am Bahnhof [gesehen].|我在火车站看见了 Lina。'),
  suchen: p('haben', 'gesucht', 'reg', 'Wir {haben} dich überall [gesucht].|我们到处找你。'),
  finden: p('haben', 'gefunden', 'irr', 'Ich {habe} meinen Schlüssel [gefunden].|我找到了我的钥匙。'),
  helfen: p('haben', 'geholfen', 'irr', 'Der Fahrer {hat} mir [geholfen].|司机帮了我。'),
  schneiden: p('haben', 'geschnitten', 'irr', 'Ich {habe} das Brot [geschnitten].|我把面包切了。'),
  bestellen: p('haben', 'bestellt', 'pre', 'Wir {haben} ein Taxi [bestellt].|我们叫了一辆出租车。'),
  schmecken: p('haben', 'geschmeckt', 'reg', 'Die Suppe {hat} gut [geschmeckt].|汤很好喝。'),
  waschen: p('haben', 'gewaschen', 'irr', 'Ich {habe} meine Hände [gewaschen].|我洗了手。'),
  tragen: p('haben', 'getragen', 'irr', 'Er {hat} den Koffer [getragen].|他提了行李箱。'),
  vergessen: p('haben', 'vergessen', 'pre', 'Ich {habe} meinen Rucksack [vergessen].|我忘了我的背包。'),
  backen: p('haben', 'gebacken', 'irr', 'Konrad {hat} heute kein Brot [gebacken].|Konrad 今天没有烤面包。'),
  probieren: p('haben', 'probiert', 'pre', 'Ich {habe} den Kuchen [probiert].|我尝了蛋糕。'),
  zählen: p('haben', 'gezählt', 'reg', 'Sie {hat} das Geld [gezählt].|她数了钱。'),
  mögen: p('haben', 'gemocht', 'irr', 'Ich {habe} den Film nicht [gemocht].|我不喜欢那部电影。'),
  braten: p('haben', 'gebraten', 'irr', 'Er {hat} Fisch [gebraten].|他煎了鱼。'),
  wiegen: p('haben', 'gewogen', 'irr', 'Die Frau {hat} die Äpfel [gewogen].|那位女士称了苹果。'),
  frühstücken: p('haben', 'gefrühstückt', 'reg', 'Ich {habe} heute nicht [gefrühstückt].|我今天没吃早饭。'),
  mischen: p('haben', 'gemischt', 'reg', 'Sie {hat} Mehl und Milch [gemischt].|她把面粉和牛奶混在一起。'),
  // Region 3
  reservieren: p('haben', 'reserviert', 'pre', 'Ich {habe} einen Platz [reserviert].|我订了一个座位。'),
  halten: p('haben', 'gehalten', 'irr', 'Der Zug {hat} hier nicht [gehalten].|火车没在这里停。'),
  warten: p('haben', 'gewartet', 'reg', 'Ich {habe} eine Stunde [gewartet].|我等了一个小时。'),
  parken: p('haben', 'geparkt', 'reg', 'Er {hat} vor dem Bahnhof [geparkt].|他把车停在火车站前面。'),
  abholen: p('haben', 'abgeholt', 'pre', 'Mein Bruder {hat} mich [abgeholt].|我哥哥来接我了。'),
  bringen: p('haben', 'gebracht', 'irr', 'Sie {hat} mir einen Tee [gebracht].|她给我端来一杯茶。'),
  fliegen: p('sein', 'geflogen', 'irr', 'Wir {sind} nach Spanien [geflogen].|我们飞去了西班牙。'),
  reisen: p('sein', 'gereist', 'reg', 'Ich {bin} mit dem Zug [gereist].|我坐火车旅行了。'),
  fahren: p('sein', 'gefahren', 'irr', 'Ich {bin} mit dem Bus [gefahren].|我坐公交车去的。'),
  einsteigen: p('sein', 'eingestiegen', 'pre', 'Lina {ist} in den letzten Zug [eingestiegen].|Lina 上了最后一班火车。'),
  aussteigen: p('sein', 'ausgestiegen', 'pre', 'Wir {sind} am Markt [ausgestiegen].|我们在集市下了车。'),
  umsteigen: p('sein', 'umgestiegen', 'pre', 'Ich {bin} zweimal [umgestiegen].|我换了两次车。'),
  abfahren: p('sein', 'abgefahren', 'pre', 'Der Bus {ist} schon [abgefahren].|公交车已经开走了。'),
  ankommen: p('sein', 'angekommen', 'pre', 'Wir {sind} spät [angekommen].|我们到得很晚。'),
  mitnehmen: p('haben', 'mitgenommen', 'pre', 'Ich {habe} einen Regenschirm [mitgenommen].|我带了一把雨伞。'),
  abbiegen: p('sein', 'abgebogen', 'pre', 'Das Taxi {ist} links [abgebogen].|出租车向左拐了。'),
  besichtigen: p('haben', 'besichtigt', 'pre', 'Wir {haben} die Kirche [besichtigt].|我们参观了教堂。'),
  anrufen: p('haben', 'angerufen', 'pre', 'Ich {habe} meine Mutter [angerufen].|我给妈妈打了电话。'),
  wehtun: p('haben', 'wehgetan', 'pre', 'Mein Fuß {hat} [wehgetan].|我的脚疼过。'),
  'spazieren gehen': p('sein', 'spazieren gegangen', 'pre', 'Wir {sind} im Park [spazieren gegangen].|我们在公园散了步。'),
  sitzen: p('haben', 'gesessen', 'irr', 'Ich {habe} lange am Gleis [gesessen].|我在站台边坐了很久。'),
  liegen: p('haben', 'gelegen', 'irr', 'Der Brief {hat} auf dem Tisch [gelegen].|信放在桌子上。'),
  schicken: p('haben', 'geschickt', 'reg', 'Ich {habe} dir eine Postkarte [geschickt].|我给你寄了一张明信片。'),
  passieren: p('sein', 'passiert', 'pre', 'Was {ist} [passiert]?|发生了什么？'),
  verpassen: p('haben', 'verpasst', 'pre', 'Ich {habe} den Zug [verpasst].|我错过了火车。'),
  treffen: p('haben', 'getroffen', 'irr', 'Ich {habe} Lina am Bahnhof [getroffen].|我在火车站碰到了 Lina。'),
  besuchen: p('haben', 'besucht', 'pre', 'Wir {haben} Oma [besucht].|我们看望了奶奶。'),
  erzählen: p('haben', 'erzählt', 'pre', 'Er {hat} uns eine Geschichte [erzählt].|他给我们讲了一个故事。'),
  lachen: p('haben', 'gelacht', 'reg', 'Die Kinder {haben} laut [gelacht].|孩子们大声笑了。'),
  spielen: p('haben', 'gespielt', 'reg', 'Wir {haben} im Zug Karten [gespielt].|我们在火车上打了牌。'),
  feiern: p('haben', 'gefeiert', 'reg', 'Wir {haben} ihren Geburtstag [gefeiert].|我们庆祝了她的生日。'),
  einladen: p('haben', 'eingeladen', 'pre', 'Sie {hat} mich zum Essen [eingeladen].|她请我吃饭。'),
  kennenlernen: p('haben', 'kennengelernt', 'pre', 'Wir {haben} uns im Zug [kennengelernt].|我们是在火车上认识的。'),
  verlieren: p('haben', 'verloren', 'pre', 'Ich {habe} meine Fahrkarte [verloren].|我把车票弄丢了。'),
  gehören: p('haben', 'gehört', 'pre', 'Der Rucksack {hat} meinem Vater [gehört].|这个背包以前是我爸爸的。'),
  zeigen: p('haben', 'gezeigt', 'reg', 'Sie {hat} mir den Weg [gezeigt].|她给我指了路。'),
  holen: p('haben', 'geholt', 'reg', 'Ich {habe} das Gepäck [geholt].|我去取了行李。'),
  öffnen: p('haben', 'geöffnet', 'reg', 'Er {hat} die Tür [geöffnet].|他打开了门。'),
  schließen: p('haben', 'geschlossen', 'irr', 'Der Schalter {hat} um acht [geschlossen].|售票窗口八点关了。'),
  laufen: p('sein', 'gelaufen', 'irr', 'Ich {bin} zum Bahnhof [gelaufen].|我跑到了火车站。'),
  rennen: p('sein', 'gerannt', 'irr', 'Lina {ist} zum Zug [gerannt].|Lina 朝火车跑去。'),
  aufstehen: p('sein', 'aufgestanden', 'pre', 'Ich {bin} um sechs Uhr [aufgestanden].|我六点起的床。'),
  aufwachen: p('sein', 'aufgewacht', 'pre', 'Ich {bin} in der Nacht [aufgewacht].|我夜里醒了。'),
  einschlafen: p('sein', 'eingeschlafen', 'pre', 'Er {ist} im Zug [eingeschlafen].|他在火车上睡着了。'),
  bleiben: p('sein', 'geblieben', 'irr', 'Konrad {ist} in der Bäckerei [geblieben].|Konrad 留在了面包房。'),
  zurückkommen: p('sein', 'zurückgekommen', 'pre', 'Sie {ist} nicht [zurückgekommen].|她没有回来。'),
  weggehen: p('sein', 'weggegangen', 'pre', 'Er {ist} ohne ein Wort [weggegangen].|他一句话没说就走了。'),
  schlafen: p('haben', 'geschlafen', 'irr', 'Ich {habe} schlecht [geschlafen].|我没睡好。'),
};

// 6000 词导入: verbs whose list example (or extra example) is a Perfekt sentence, marked by scripts/build_lexicon.py.
for (const [inf, spec] of Object.entries(LEX_PERFEKT)) {
  if (PERFEKT[inf]) continue;
  const [aux, pp, kind, de, zh] = spec.split('|');
  PERFEKT[inf] = p(aux as Aux, pp, kind as PerfektKind, `${de}|${zh}`);
}

export interface PerfektParts {
  before: string;
  aux: string;
  mid: string;
  pp: string;
  after: string;
  zh: string;
}

/** Splits a Perfekt sentence around its {aux} and [participle]. */
export function perfektParts(e: Perfekt): PerfektParts {
  const [de, zh = ''] = e.ex.split('|');
  const m = /^(.*)\{([^}]+)\}(.*)\[([^\]]+)\](.*)$/.exec(de);
  if (!m) throw new Error(`bad Perfekt sentence ${e.ex}`);
  return { before: m[1], aux: m[2], mid: m[3], pp: m[4], after: m[5], zh };
}

export function perfektFull(e: Perfekt): string {
  const x = perfektParts(e);
  return `${x.before}${x.aux}${x.mid}${x.pp}${x.after}`;
}
