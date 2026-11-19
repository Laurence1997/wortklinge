// 句式标签 (数据整理 › 数据格式 › 句式标签): 0–2 sentence patterns per noun, in the order a fight uses them.
// Rules: food, drink, things → moechte, brauche (region 2: food → moechte, nehme; things → brauche, nehme);
// uncountable → moechte0 / brauche0 (no article); places → woist, suche; people and animals → habe, mein;
// professions → mein only; abstract words, time words, non-nouns → none (the move greys out).
// Weak nouns (der Junge, der Student, der Nachbar, der Kunde: einen Jungen …) only get mein (nominative).

export type Pattern = 'moechte' | 'brauche' | 'nehme' | 'moechte0' | 'brauche0' | 'woist' | 'suche' | 'habe' | 'mein' | 'sind';

const groups: Array<[Pattern[], string]> = [
  // ---- Region 1
  [['moechte', 'brauche'], 'brot tee tasse kaffee flasche glas stuhl tisch bett lampe schluessel tasche buch stift uhr handy jacke schuh brille decke koffer karte foto zeitung computer ausweis pass formular kurs'],
  [['moechte', 'brauche0'], 'wasser'],
  [['moechte0', 'brauche0'], 'papier'],
  [['brauche0'], 'feuer arbeit'],
  [['brauche'], 'adresse telefonnummer'],
  [['woist', 'suche'], 'zimmer haus wohnung strasse schule'],
  [['woist'], 'tuer fenster schweiz tuerkei'],
  [['habe'], 'e-mail'],
  [['sind'], 'eltern geschwister'],
  [['habe', 'mein'], 'freund freundin mann frau kind familie vater mutter sohn tochter bruder schwester opa oma grossvater grossmutter baby onkel tante maedchen hund katze'],
  [['mein'], 'student studentin lehrer lehrerin arzt aerztin koch koechin ingenieur nachbar nachbarin junge'],
  // ---- Region 2
  [['moechte', 'nehme'], 'apfel banane ei orange broetchen kartoffel kuchen tomate fisch saft salat wurst haehnchen zwiebel bier birne joghurt gurke wein eis suppe zitrone karotte erdbeere schokolade cola traube paprika kirsche pilz brezel limonade mineralwasser kakao steak pizza vorspeise hauptgericht nachtisch fruehstueck mittagessen abendessen getraenk'],
  [['moechte0', 'brauche0'], 'kaese mehl fleisch milch obst butter gemuese zucker reis salz oel schinken pfeffer knoblauch marmelade honig sahne muesli geld kleingeld'],
  [['brauche0'], 'geschirr'],
  [['brauche', 'nehme'], 'tuete packung dose korb portemonnaie becher liste paket muenze kreditkarte quittung rechnung teller gabel messer loeffel schuessel topf pfanne kuehlschrank herd speisekarte rezept sack kanne serviette gewuerz ofen mikrowelle brett'],
  [['brauche'], 'euro cent'],
  [['nehme'], 'angebot sonderangebot'],
  [['woist', 'suche'], 'kasse markt supermarkt geschaeft baeckerei laden kiosk metzgerei kueche restaurant waage'],
  [['mein'], 'kunde verkaeufer verkaeuferin kellner kellnerin'],
];

export const SENTENCE_TAGS: Record<string, Pattern[]> = {};
for (const [tags, ids] of groups) for (const id of ids.split(/\s+/)) if (id) SENTENCE_TAGS[id] = tags;

// Decided without a pattern (docs thread 2026-11-19): land stadt name herr leute kilo gramm pfund liter stueck nudel korn.
