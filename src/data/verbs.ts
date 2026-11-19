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
}

function row(s: string, strong = false): Conj {
  const [ich, du, er, wir, ihr, sie] = s.split(/\s+/);
  return { forms: { ich, du, er, wir, ihr, sie }, strong: strong || undefined };
}

export const CONJ: Record<string, Conj> = {
  // Region 1
  sein: row('bin bist ist sind seid sind', true),
  haben: row('habe hast hat haben habt haben', true),
  heißen: row('heiße heißt heißt heißen heißt heißen'),
  kommen: row('komme kommst kommt kommen kommt kommen'),
  wohnen: row('wohne wohnst wohnt wohnen wohnt wohnen'),
  sprechen: row('spreche sprichst spricht sprechen sprecht sprechen', true),
  lernen: row('lerne lernst lernt lernen lernt lernen'),
  arbeiten: row('arbeite arbeitest arbeitet arbeiten arbeitet arbeiten'),
  machen: row('mache machst macht machen macht machen'),
  gehen: row('gehe gehst geht gehen geht gehen'),
  verstehen: row('verstehe verstehst versteht verstehen versteht verstehen'),
  buchstabieren: row('buchstabiere buchstabierst buchstabiert buchstabieren buchstabiert buchstabieren'),
  fragen: row('frage fragst fragt fragen fragt fragen'),
  antworten: row('antworte antwortest antwortet antworten antwortet antworten'),
  schreiben: row('schreibe schreibst schreibt schreiben schreibt schreiben'),
  lesen: row('lese liest liest lesen lest lesen', true),
  hören: row('höre hörst hört hören hört hören'),
  sagen: row('sage sagst sagt sagen sagt sagen'),
  // Region 2
  essen: row('esse isst isst essen esst essen', true),
  trinken: row('trinke trinkst trinkt trinken trinkt trinken'),
  nehmen: row('nehme nimmst nimmt nehmen nehmt nehmen', true),
  kaufen: row('kaufe kaufst kauft kaufen kauft kaufen'),
  kosten: row('koste kostest kostet kosten kostet kosten'),
  brauchen: row('brauche brauchst braucht brauchen braucht brauchen'),
  geben: row('gebe gibst gibt geben gebt geben', true),
  bezahlen: row('bezahle bezahlst bezahlt bezahlen bezahlt bezahlen'),
  kochen: row('koche kochst kocht kochen kocht kochen'),
  sehen: row('sehe siehst sieht sehen seht sehen', true),
  suchen: row('suche suchst sucht suchen sucht suchen'),
  finden: row('finde findest findet finden findet finden'),
  helfen: row('helfe hilfst hilft helfen helft helfen', true),
  schneiden: row('schneide schneidest schneidet schneiden schneidet schneiden'),
  bestellen: row('bestelle bestellst bestellt bestellen bestellt bestellen'),
  schmecken: row('schmecke schmeckst schmeckt schmecken schmeckt schmecken'),
  waschen: row('wasche wäschst wäscht waschen wascht waschen', true),
  tragen: row('trage trägst trägt tragen tragt tragen', true),
  vergessen: row('vergesse vergisst vergisst vergessen vergesst vergessen', true),
  backen: row('backe backst backt backen backt backen'),
  probieren: row('probiere probierst probiert probieren probiert probieren'),
  zählen: row('zähle zählst zählt zählen zählt zählen'),
};
