// Present-tense conjugation for every verb monster (Lv12+: 动词怪要写出现在时变位).
// Order: ich, du, er/sie/es, wir, ihr, sie/Sie. Strong verbs (vowel change in du/er) are marked.
// Written by Claude; needs a native-speaker check.

export type Person = 'ich' | 'du' | 'er' | 'wir' | 'ihr' | 'sie';
export const PERSONS: Person[] = ['ich', 'du', 'er', 'wir', 'ihr', 'sie'];
export const PERSON_LABEL: Record<Person, string> = { ich: 'ich', du: 'du', er: 'er / sie / es', wir: 'wir', ihr: 'ihr', sie: 'sie / Sie' };

export interface Conj {
  forms: Record<Person, string>;
  /** Stem vowel changes in du / er (nehmen → nimmt), or fully irregular (sein, haben). */
  strong?: boolean;
  /**
   * Strong or mixed in the past (wiegen → wog, gewogen) although the present tense is regular.
   * Region 3's Perfekt must not generate "gewiegt" for these. Verbs marked `strong` are strong in the past too.
   */
  pastStrong?: boolean;
  /** Other accepted forms (backen: du bäckst, er bäckt); the shown answer stays in `forms`. */
  alt?: Partial<Record<Person, string[]>>;
}

function row(s: string, strong = false): Conj {
  const [ich, du, er, wir, ihr, sie] = s.split(/\s+/);
  return { forms: { ich, du, er, wir, ihr, sie }, strong: strong || undefined };
}

/** Separable verbs: the particle goes after every form (steige … ein). */
function sep(s: string, particle: string, strong = false, pastStrong = false): Conj {
  const c = row(s, strong);
  for (const k of PERSONS) c.forms[k] = `${c.forms[k]} ${particle}`;
  if (pastStrong) c.pastStrong = true;
  return c;
}

/** Present tense regular, past strong or mixed. */
function rowPast(s: string): Conj {
  return { ...row(s), pastStrong: true };
}

export const CONJ: Record<string, Conj> = {
  // Region 1
  sein: row('bin bist ist sind seid sind', true),
  haben: row('habe hast hat haben habt haben', true),
  heißen: rowPast('heiße heißt heißt heißen heißt heißen'),
  kommen: rowPast('komme kommst kommt kommen kommt kommen'),
  wohnen: row('wohne wohnst wohnt wohnen wohnt wohnen'),
  sprechen: row('spreche sprichst spricht sprechen sprecht sprechen', true),
  lernen: row('lerne lernst lernt lernen lernt lernen'),
  arbeiten: row('arbeite arbeitest arbeitet arbeiten arbeitet arbeiten'),
  machen: row('mache machst macht machen macht machen'),
  gehen: rowPast('gehe gehst geht gehen geht gehen'),
  verstehen: rowPast('verstehe verstehst versteht verstehen versteht verstehen'),
  buchstabieren: row('buchstabiere buchstabierst buchstabiert buchstabieren buchstabiert buchstabieren'),
  fragen: row('frage fragst fragt fragen fragt fragen'),
  antworten: row('antworte antwortest antwortet antworten antwortet antworten'),
  schreiben: rowPast('schreibe schreibst schreibt schreiben schreibt schreiben'),
  lesen: row('lese liest liest lesen lest lesen', true),
  hören: row('höre hörst hört hören hört hören'),
  sagen: row('sage sagst sagt sagen sagt sagen'),
  // Region 2
  essen: row('esse isst isst essen esst essen', true),
  trinken: rowPast('trinke trinkst trinkt trinken trinkt trinken'),
  nehmen: row('nehme nimmst nimmt nehmen nehmt nehmen', true),
  kaufen: row('kaufe kaufst kauft kaufen kauft kaufen'),
  kosten: row('koste kostest kostet kosten kostet kosten'),
  brauchen: row('brauche brauchst braucht brauchen braucht brauchen'),
  geben: row('gebe gibst gibt geben gebt geben', true),
  bezahlen: row('bezahle bezahlst bezahlt bezahlen bezahlt bezahlen'),
  kochen: row('koche kochst kocht kochen kocht kochen'),
  sehen: row('sehe siehst sieht sehen seht sehen', true),
  suchen: row('suche suchst sucht suchen sucht suchen'),
  finden: rowPast('finde findest findet finden findet finden'),
  helfen: row('helfe hilfst hilft helfen helft helfen', true),
  schneiden: rowPast('schneide schneidest schneidet schneiden schneidet schneiden'),
  bestellen: row('bestelle bestellst bestellt bestellen bestellt bestellen'),
  schmecken: row('schmecke schmeckst schmeckt schmecken schmeckt schmecken'),
  waschen: row('wasche wäschst wäscht waschen wascht waschen', true),
  tragen: row('trage trägst trägt tragen tragt tragen', true),
  vergessen: row('vergesse vergisst vergisst vergessen vergesst vergessen', true),
  backen: { ...rowPast('backe backst backt backen backt backen'), alt: { du: ['bäckst'], er: ['bäckt'] } },
  probieren: row('probiere probierst probiert probieren probiert probieren'),
  zählen: row('zähle zählst zählt zählen zählt zählen'),
  mögen: row('mag magst mag mögen mögt mögen', true),
  braten: row('brate brätst brät braten bratet braten', true),
  wiegen: rowPast('wiege wiegst wiegt wiegen wiegt wiegen'),
  frühstücken: row('frühstücke frühstückst frühstückt frühstücken frühstückt frühstücken'),
  mischen: row('mische mischst mischt mischen mischt mischen'),
  // Region 3
  reservieren: row('reserviere reservierst reserviert reservieren reserviert reservieren'),
  halten: row('halte hältst hält halten haltet halten', true),
  warten: row('warte wartest wartet warten wartet warten'),
  parken: row('parke parkst parkt parken parkt parken'),
  abholen: sep('hole holst holt holen holt holen', 'ab'),
  bringen: rowPast('bringe bringst bringt bringen bringt bringen'),
  fliegen: rowPast('fliege fliegst fliegt fliegen fliegt fliegen'),
  reisen: row('reise reist reist reisen reist reisen'),
  fahren: row('fahre fährst fährt fahren fahrt fahren', true),
  einsteigen: sep('steige steigst steigt steigen steigt steigen', 'ein', false, true),
  aussteigen: sep('steige steigst steigt steigen steigt steigen', 'aus', false, true),
  umsteigen: sep('steige steigst steigt steigen steigt steigen', 'um', false, true),
  abfahren: sep('fahre fährst fährt fahren fahrt fahren', 'ab', true),
  ankommen: sep('komme kommst kommt kommen kommt kommen', 'an', false, true),
  mitnehmen: sep('nehme nimmst nimmt nehmen nehmt nehmen', 'mit', true),
  abbiegen: sep('biege biegst biegt biegen biegt biegen', 'ab', false, true),
  besichtigen: row('besichtige besichtigst besichtigt besichtigen besichtigt besichtigen'),
  anrufen: sep('rufe rufst ruft rufen ruft rufen', 'an', false, true),
  wehtun: sep('tue tust tut tun tut tun', 'weh', false, true),
  'spazieren gehen': sep('gehe gehst geht gehen geht gehen', 'spazieren', false, true),
  sitzen: rowPast('sitze sitzt sitzt sitzen sitzt sitzen'),
  liegen: rowPast('liege liegst liegt liegen liegt liegen'),
  schicken: row('schicke schickst schickt schicken schickt schicken'),
  passieren: row('passiere passierst passiert passieren passiert passieren'),
  verpassen: row('verpasse verpasst verpasst verpassen verpasst verpassen'),
  treffen: row('treffe triffst trifft treffen trefft treffen', true),
  besuchen: row('besuche besuchst besucht besuchen besucht besuchen'),
  erzählen: row('erzähle erzählst erzählt erzählen erzählt erzählen'),
  lachen: row('lache lachst lacht lachen lacht lachen'),
  spielen: row('spiele spielst spielt spielen spielt spielen'),
  feiern: row('feiere feierst feiert feiern feiert feiern'),
  einladen: sep('lade lädst lädt laden ladet laden', 'ein', true),
  kennenlernen: sep('lerne lernst lernt lernen lernt lernen', 'kennen'),
  verlieren: rowPast('verliere verlierst verliert verlieren verliert verlieren'),
  gehören: row('gehöre gehörst gehört gehören gehört gehören'),
  zeigen: row('zeige zeigst zeigt zeigen zeigt zeigen'),
  holen: row('hole holst holt holen holt holen'),
  öffnen: row('öffne öffnest öffnet öffnen öffnet öffnen'),
  schließen: rowPast('schließe schließt schließt schließen schließt schließen'),
  laufen: row('laufe läufst läuft laufen lauft laufen', true),
  rennen: rowPast('renne rennst rennt rennen rennt rennen'),
  aufstehen: sep('stehe stehst steht stehen steht stehen', 'auf', false, true),
  aufwachen: sep('wache wachst wacht wachen wacht wachen', 'auf'),
  einschlafen: sep('schlafe schläfst schläft schlafen schlaft schlafen', 'ein', true),
  bleiben: rowPast('bleibe bleibst bleibt bleiben bleibt bleiben'),
  zurückkommen: sep('komme kommst kommt kommen kommt kommen', 'zurück', false, true),
  weggehen: sep('gehe gehst geht gehen geht gehen', 'weg', false, true),
  schlafen: row('schlafe schläfst schläft schlafen schlaft schlafen', true),
};
