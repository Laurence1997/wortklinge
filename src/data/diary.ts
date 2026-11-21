// 日记残页 (0.6 block 3): one page of the nameless neighbour's diary per scene word group.
// When every word of a scene's group is at least 半名, its page drops. The player fills each blank (the group's words),
// may read it aloud, and the page is restored. Regions 1–2: present tense; region 3: Perfekt.
// Blanks: {wordId} uses the word's own form; {wordId:Form} is an inflected form (the UI shows the base form above).
// Each group word is blanked at most once per page. German not yet proofread (统一校对 at release).

export interface DiaryPage {
  /** Scene whose word group drops this page. */
  scene: string;
  lines: string[];
}

export const DIARY_WRITER = 'Jonas Keller';

export const DIARY: DiaryPage[] = [
  // ---- Region 1 · 最后的营地: notes against forgetting, ending at „Wie heiße ich?“ ----
  { scene: 'r1-e1', lines: [
    'Ich schreibe alles auf, sonst vergesse ich es.',
    'Auf dem {tisch} stehen eine {tasse} und ein {glas}.',
    'Morgens trinke ich {tee}, abends {kaffee}.',
    'Das {brot} ist alt, aber ich esse es.',
    'Die {flasche} ist leer, ich brauche {wasser}.',
    'Der zweite {stuhl} ist leer. Wer sitzt da?',
  ] },
  { scene: 'r1-e2', lines: [
    'Mein Zimmer ist klein und kalt.',
    'Neben dem {bett} steht eine {lampe}.',
    'Die {uhr} an der Wand ist still.',
    'Ich mache das {fenster} zu und nehme eine {decke}.',
    'Draußen brennt ein {feuer}.',
    'Den {schluessel} lege ich auf den Boden vor der {tuer}.',
  ] },
  { scene: 'r1-e3', lines: [
    'Meine {jacke} hängt an der Wand.',
    'In der {tasche} sind ein {buch}, ein {stift} und viel {papier}.',
    'Mein {handy} geht nicht mehr. Es ist still.',
    'Ohne {brille} sehe ich nichts.',
    'Ein {schuh} fehlt. Wo ist er?',
  ] },
  { scene: 'r1-e5', lines: [
    'Im Hof übe ich Wörter.',
    'Am Morgen sage ich: „{guten-morgen}!“',
    'Am Mittag sage ich „{guten-tag}“, am Abend „{guten-abend}“.',
    'Die Kinder rufen nur „{hallo}“ und „{tschuess}“.',
    'Zu der alten Frau unten sage ich „{auf-wiedersehen}“.',
    'Und vor dem Bett sage ich zu mir: „{gute-nacht}.“',
  ] },
  { scene: 'r1-e6', lines: [
    'Im Flur treffe ich einen Mann.',
    '„{entschuldigung}, wohnen Sie hier?“, frage ich.',
    'Er sagt: „Ja. {freut-mich}!“',
    'Ich trage seinen Koffer. Er sagt: „{vielen-dank}!“',
    '„{gern}“, sage ich, „{kein-problem}.“',
    '„{danke}“, sagt er noch einmal. Seinen Namen sagt er nicht.',
  ] },
  { scene: 'r1-e7', lines: [
    'Auf dem Dach ist es ruhig.',
    'Eine Stimme fragt: „{wie-geht-s}“',
    'Ich sage: „{ich-weiss-nicht}.“',
    '„{wie-bitte}“, frage ich. Die Stimme sagt nichts.',
    '„{noch-einmal-bitte}!“, rufe ich.',
    'Dann höre ich: „{ja}. {nein}. {alles-klar}.“ Das ist nur mein Echo.',
  ] },
  { scene: 'r1-e4', lines: [
    'Im {zimmer} am Ende steht ein {koffer}.',
    'Darin liegen eine {zeitung}, eine {karte} und ein {foto}.',
    'Es zeigt ein {haus} an einer langen {strasse}.',
    'Ist das meine alte {wohnung}?',
    'Der {computer} auf dem Tisch ist kaputt.',
  ] },
  { scene: 'r1-s1', lines: [
    'Am Schalter bekomme ich ein {formular}.',
    'Meine {adresse} weiß ich: Echogasse 7.',
    'Meine {telefonnummer} und meine {e-mail} weiß ich auch.',
    'Mein {alter}? Ich glaube, dreißig.',
    'Aber bei {vorname} und {familienname} ist das Papier leer.',
    'Mein {ausweis} ist weiß, mein {pass} auch. Kein {name}.',
  ] },
  { scene: 'r1-s2', lines: [
    'Unter der Uhr stelle ich mir jeden Abend dieselben Fragen.',
    '{wer} {sein:bin} ich? {woher} {kommen:komme} ich?',
    '{wo} ist meine Familie?',
    '{wie} {heissen:heißt} der Mann im Flur?',
    '{was} {haben:habe} ich in der Tasche? Und {wie-viel} Zeit?',
  ] },
  { scene: 'r1-s5', lines: [
    'An der Wand stehen Zahlen.',
    'Meine Tür hat die Nummer {sieben-num}.',
    'Im Haus wohnen {zwoelf-num} Leute, aber nur {elf-num} Namen stehen an der Wand.',
    'Ich zähle: {eins-num}, {zwei-num}, {drei-num}, {vier-num} …',
    'Ein Name fehlt. Es ist meiner. Für mich steht da nur: {null-num}.',
  ] },
  { scene: 'r1-s3', lines: [
    'Im alten Postamt liegen viele Briefe.',
    'Ein Brief kommt aus {china}, einer aus {japan}.',
    'Andere kommen aus {italien}, {spanien} und {frankreich}.',
    'Ein Paket aus der {tuerkei} ist ganz nass.',
    'Ich lebe in {deutschland}, in dieser {stadt}. Aber aus welchem {land} komme ich?',
  ] },
  { scene: 'r1-s6', lines: [
    'Am Abend gehe ich in die {schule}. Es gibt einen {kurs} für {deutsch}.',
    'Die Lehrerin spricht auch {englisch}.',
    'Neben mir sitzt eine Frau. Sie spricht {chinesisch}.',
    'Jedes {wort} ist schwer, aber jeder {satz} hilft.',
    'Ich habe eine {frage}. Die {antwort}: Eine {sprache} ist ein Haus für Namen.',
  ] },
  { scene: 'r1-s7', lines: [
    'Im Büro fragt man mich: „Was ist Ihr {beruf}?“',
    'Bin ich {lehrer}? Bin ich {arzt}? Bin ich {koch}?',
    'Neben mir sitzt eine {studentin}. Sie sucht {arbeit}.',
    'Der Mann am Fenster ist {ingenieur}, seine Frau ist {aerztin}.',
    'Ich weiß es nicht mehr. Ich weiß nur: Ich schreibe gern.',
  ] },
  { scene: 'r1-s8', lines: [
    'Ich klingle an jeder Tür.',
    'Eine {frau} macht auf. Hinter ihr steht ein {kind}.',
    '„Ich bin Ihr {nachbar}“, sage ich. Sie sagt: „Nein, da wohnt meine {nachbarin}.“',
    'Ein alter {mann} kommt die Treppe hoch. „Guten Tag, {herr} …?“, sagt er. Dann ist er still.',
    'Habe ich einen {freund}? Eine {freundin}? Ich weiß es nicht.',
  ] },
  { scene: 'r1-s9', lines: [
    'An der Wand hängt mein Zettel: „Wer kennt mich?“',
    'Ich {wohnen:wohne} in der Echogasse.',
    'Ich {arbeiten:arbeite} nicht. Ich {gehen:gehe} jeden Tag durch die Straßen.',
    'Die Leute {sprechen} schnell. Ich {verstehen:verstehe} nur wenig.',
    'Also {lernen:lerne} ich jeden Tag zehn Wörter. Was {machen:mache} ich sonst?',
  ] },
  { scene: 'r1-s4', lines: [
    'Ich {schreiben:schreibe} meinen Namen auf, aber die Buchstaben laufen weg.',
    'Ich {lesen:lese} ihn noch einmal, aber das Papier ist leer.',
    'Ich {fragen:frage} den Schreiber: „Können Sie das {buchstabieren}?“',
    'Er {antworten:antwortet} nicht.',
    'Ich {hoeren:höre} nur mein Herz. Es {sagen:sagt} einen Buchstaben: J. Dann nichts.',
  ] },
  { scene: 'r1-a1', lines: [
    'Das Haus hat {zwanzig-num} Briefkästen.',
    'Ich gehe sie alle durch: {dreizehn-num}, {vierzehn-num}, {fuenfzehn-num} …',
    'Nummer {sechzehn-num} ist leer. Nummer {siebzehn-num} auch.',
    'Auf Nummer {achtzehn-num} steht ein Name, aber er ist schwarz.',
    'Ich bin nicht {neunzehn-num} und nicht {einundzwanzig-num}. Ich bin älter.',
  ] },
  { scene: 'r1-a2', lines: [
    'Im Treppenhaus hängt ein Bild von einer {familie}.',
    'Ein {vater}, eine {mutter} und zwei Kinder.',
    'Der {sohn} lacht, die {tochter} hat einen Ball.',
    'Sind das meine {eltern}? Habe ich einen {bruder} oder eine {schwester}?',
    'Ich glaube, ich habe keine {geschwister}. Aber ich weiß es nicht sicher.',
  ] },
  { scene: 'r1-a5', lines: [
    'Im {klein:kleinen} Briefkasten liegt ein Brief für mich.',
    'Das Papier ist {alt}, aber die Schrift ist {schoen}.',
    'Eine {jung:junge} Frau schreibt:',
    '„Bist du noch {ledig} oder schon {verheiratet}?“',
    'Unten ist ein {gross:großes} Herz. Wer ist sie?',
  ] },
  { scene: 'r1-a6', lines: [
    'Im zweiten Stock wohnen viele {leute}.',
    'Ein {opa} und eine {oma} sitzen vor der Tür.',
    'Ein {junge} und ein {maedchen} spielen auf der Treppe.',
    'Ein {baby} weint. Die {tante} singt ein Lied.',
    'Der {onkel} sagt: „Mein {grossvater} kennt alle Namen hier.“ Aber er wohnt nicht mehr hier.',
  ] },
  { scene: 'r1-a3', lines: [
    'Im Hof zähle ich die Zeit.',
    'Ein {tag}, eine {woche}, ein {monat}. Wie lange bin ich schon hier?',
    'Die Uhr am Haus ist {hundert-num} {jahr:Jahre} alt.',
    'Ich bin vielleicht {dreissig-num}, vielleicht {vierzig-num}.',
    'Der Mann im Flur ist über {fuenfzig-num}. Er weiß sein Alter, aber nicht seinen Namen. Wie ich.',
  ] },
  { scene: 'r1-a7', lines: [
    'Heute bin ich {krank} und {sehr} {muede}.',
    'Die Frau von nebenan ist {nett}. Sie bringt mir Tee.',
    'Ihr Mann ist {auch} da.',
    '„Das ist {toll}“, sage ich, „danke.“',
    'Sie fragt nach meinem Namen. Ich weiß ihn {nicht}.',
  ] },
  { scene: 'r1-a4', lines: [
    'Ganz oben im Haus ist mein Zimmer.',
    'Eine {katze} schläft auf dem Bett, ein {hund} liegt vor der Tür.',
    '{heute} ist mein {geburtstag}, glaube ich.',
    'Ich bin {hier}, das weiß ich.',
    'Aber {morgen}? Wer bin ich dann? Wie heiße ich?',
  ] },

  // ---- Region 2 · 面包集市: with Konrad and his daughter Lina, until they leave for the station ----
  { scene: 'r2-g1', lines: [
    'Heute gehe ich mit Konrad und seiner Tochter Lina auf den Markt.',
    'Lina kauft {obst}: einen {apfel}, eine {birne} und eine {banane}.',
    'Konrad nimmt eine {zitrone} und eine {orange}.',
    'Die {erdbeere:Erdbeeren} sind rot, die {kirsche:Kirschen} auch.',
    'Lina isst eine {traube} und lacht.',
  ] },
  { scene: 'r2-g5', lines: [
    'Konrad ist Bäcker. Er braucht {mehl}, {butter} und {milch}.',
    'Im Laden kauft er zehn {ei:Eier}.',
    'Lina möchte einen {joghurt} und ein Stück {kaese}.',
    'Am Sonntag backt Konrad einen {kuchen} mit {sahne}.',
    'Für mich hat er immer ein {broetchen} oder eine {brezel}.',
  ] },
  { scene: 'r2-g2', lines: [
    'Am nächsten Stand gibt es {gemuese}.',
    'Lina will {kartoffel:Kartoffeln} und {tomate:Tomaten}.',
    'Konrad kauft eine {gurke}, eine {zwiebel} und {knoblauch}.',
    'Für den {salat} nehmen sie noch eine rote {paprika} und eine {karotte}.',
    'Ich finde einen kleinen {pilz} unter dem Tisch.',
  ] },
  { scene: 'r2-g6', lines: [
    'Am Abend kocht Konrad eine {suppe}.',
    'Lina isst kein {fleisch}. Sie mag {fisch} mit {reis}.',
    'Konrad mag {wurst} und {schinken}.',
    'Ich esse gern {nudel:Nudeln} mit {haehnchen}.',
    'Ein {steak} ist zu teuer für uns. Aber wir sind zusammen, und das ist gut.',
  ] },
  { scene: 'r2-g3', lines: [
    'Am Brunnen ist es heiß.',
    'Lina trinkt einen {saft}, Konrad trinkt ein {bier}.',
    'Ich nehme ein {mineralwasser}. {wein} ist zu teuer.',
    'Lina möchte noch ein {eis} mit {schokolade}.',
    'Am Abend trinkt sie einen {kakao} und schläft schnell ein.',
  ] },
  { scene: 'r2-g7', lines: [
    'Konrad braucht {zucker}, {salz} und {oel}.',
    'Lina probiert den {pfeffer}. Er ist sehr {scharf}.',
    'Zum Frühstück isst sie {muesli} mit {honig}.',
    'Ich mag {marmelade}. Sie ist {suess}.',
    'Die Zitrone ist {sauer}, der Kaffee ist {bitter}.',
  ] },
  { scene: 'r2-g4', lines: [
    'Am Probiertisch ist Lina {hungrig} und {durstig}.',
    'Das Brot ist {frisch} und noch {warm}.',
    'Die Suppe ist zu {heiss}, das Wasser ist {kalt}.',
    'Die Äpfel sind {reif} und {gesund}.',
    '„{lecker}!“, sagt Lina. Dann ist sie {satt}.',
  ] },
  { scene: 'r2-w1', lines: [
    'Konrad zählt sein {geld}. Viel ist es nicht.',
    'Im {portemonnaie} sind zwanzig {euro} und fünfzig {cent}.',
    'Lina sucht {kleingeld} für den Zug.',
    'Eine alte {muenze} ist aus Gold.',
    'An der {kasse} zahlt Konrad bar. Er hat keine {kreditkarte}.',
    'Die {rechnung} legt er in die Tasche.',
  ] },
  { scene: 'r2-w5', lines: [
    'Konrad sieht den {preis} und sagt: „Das ist zu {teuer}.“',
    'Heute gibt es ein {sonderangebot}: zwei Brote {zusammen} für drei Euro.',
    '„Das ist {billig}“, sagt Lina. „Das ist ein gutes {angebot}.“',
    'Wir haben {wenig} Geld, aber es ist {genug}.',
    'Nur das Wasser am Brunnen ist {kostenlos}.',
  ] },
  { scene: 'r2-w2', lines: [
    'Im Laden steht eine alte {waage}.',
    'Konrad kauft ein {kilo} Mehl und ein {pfund} Butter.',
    'Lina nimmt einen {liter} Milch und einen {becher} Joghurt.',
    'Für den Zug kaufen wir eine {packung} Kekse und eine {dose} Cola.',
    'Ich trage alles in einer {tuete}.',
  ] },
  { scene: 'r2-w6', lines: [
    'Konrad rechnet laut.',
    'Das Mehl kostet {neunundneunzig-num} Cent, die Milch {fuenfundvierzig-num} Cent.',
    'Eine Fahrkarte kostet {fuenfundzwanzig-num} Euro.',
    'Er hat nur {sechzig-num} Euro, Lina hat {zweiunddreissig-num}.',
    'Sie brauchen zwei Fahrkarten. „Das geht“, sagt Lina.',
    'Konrad lacht: „In {tausend-num} Jahren sind wir reich.“',
  ] },
  { scene: 'r2-w3', lines: [
    'Konrads {baeckerei} ist heute {geschlossen}.',
    'Die {metzgerei} nebenan ist {geoeffnet}.',
    'Der {supermarkt} ist groß, aber der {markt} ist schöner.',
    'Am {kiosk} kauft Lina eine Zeitung und liest laut die Zeiten der Züge vor.',
    'Jedes {geschaeft} hat eine andere {oeffnungszeit}.',
  ] },
  { scene: 'r2-w7', lines: [
    'Im Laden ist Konrad der erste {kunde}.',
    'Er hat eine {liste} und einen {korb}.',
    'Die {verkaeuferin} gibt ihm ein {paket}.',
    'Der {verkaeufer} fragt Lina nach ihrer {groesse}. Sie braucht eine Jacke für die Reise.',
    'Nach dem {einkauf} gehen wir nach Hause.',
  ] },
  { scene: 'r2-w8', lines: [
    'Lina zeigt auf einen Koffer: „{was-kostet-das}“',
    'Der Mann sagt: „Vierzig Euro.“ Konrad sagt: „{das-ist-zu-teuer}“',
    '„{geht-das-billiger}“, fragt Lina.',
    '„Für dich dreißig. {noch-etwas}“ – „Nein, {das-ist-alles}“',
    'Konrad sagt: „{ich-nehme-das}“ Der Mann fragt: „{bar-oder-mit-karte}“',
  ] },
  { scene: 'r2-w4', lines: [
    'Am Bahnhof gibt es einen kleinen Laden.',
    'Konrad fragt: „{haben-sie-brot}“ Dann lacht er, denn er ist selbst Bäcker.',
    'Lina sagt: „{ich-haette-gern-ein-kilo-aepfel}“',
    '„{wo-ist-die-kasse}“, frage ich. „{kann-ich-mit-karte-zahlen}“',
    '„{gibt-es-einen-rabatt}“, fragt Konrad. Die Frau lacht nur. Dann ruft er: „{zahlen-bitte}“',
    'Die Frau sagt: „Nur bar.“ Konrad gibt ihr zehn Euro: „{stimmt-so}“',
  ] },
  { scene: 'r2-k1', lines: [
    'Wir {brauchen} Essen für die Reise.',
    'Konrad {kaufen:kauft} Brot. Es {kosten:kostet} nicht viel.',
    'Lina {nehmen:nimmt} zwei Äpfel und {bezahlen:bezahlt}.',
    'Auf dem Weg {essen} wir Brot und {trinken} Wasser.',
    'Konrad {geben:gibt} mir sein letztes Brötchen. „Für dich“, sagt er.',
  ] },
  { scene: 'r2-k5', lines: [
    'In Konrads Küche steht viel {geschirr}.',
    'Er packt einen {teller}, eine {gabel} und ein {messer} ein.',
    'Lina nimmt ihren {loeffel} und eine kleine {schuessel}.',
    'Die alte {kanne} bleibt hier.',
    'Eine {serviette} liegt auf dem Tisch. Darauf steht: „Bis bald.“',
  ] },
  { scene: 'r2-k2', lines: [
    'Unter der Mühle essen wir {fruehstueck}.',
    'Konrad trägt einen {sack} mit {korn}.',
    'Zum {mittagessen} gibt es nur Brot.',
    'Lina hat {hunger} und {durst}, aber sie sagt nichts.',
    'Das {abendessen} essen wir schon im Zug, sagt Konrad.',
  ] },
  { scene: 'r2-k3', lines: [
    'In der Mühle {suchen:suche} ich meinen Namen.',
    'Ich {finden:finde} nur Mehl.',
    'Konrad {kochen:kocht} Tee. Er {schmecken:schmeckt} gut.',
    'Lina {helfen:hilft} ihm. Sie {moegen:mag} ihren Vater sehr.',
    'Ich {sehen:sehe} die zwei und weiß: Sie gehen bald weg.',
  ] },
  { scene: 'r2-k6', lines: [
    'Die {kueche} in der Bäckerei ist kalt.',
    'Der {ofen} ist aus. Auf dem {herd} steht ein leerer {topf}.',
    'Der {kuehlschrank} ist leer, die {pfanne} auch.',
    'Konrad gibt mir sein {rezept} für Brot.',
    '„Du backst jetzt für uns alle“, sagt er.',
  ] },
  { scene: 'r2-k7', lines: [
    'Am letzten Abend gehen wir in ein {restaurant}.',
    'Die {kellnerin} bringt die {speisekarte}.',
    'Als {vorspeise} essen wir Suppe, als {hauptgericht} eine {pizza}.',
    'Lina möchte einen {nachtisch}. Konrad bestellt ein {getraenk}.',
    'Der {kellner} fragt: „Wohin fahren Sie?“ Konrad sagt: „Zum Bahnhof.“',
  ] },
  { scene: 'r2-k4', lines: [
    'Am Morgen {backen:backt} Konrad ein letztes Brot.',
    'Lina {waschen:wäscht} die Teller. Ich {tragen:trage} die Koffer.',
    'Konrad {schneiden:schneidet} das Brot, und wir {fruehstuecken:frühstücken} zusammen.',
    'Dann {zaehlen:zählt} Lina die Fahrkarten: zwei.',
    'Sie gehen zum Bahnhof. „{vergessen:Vergiss} uns nicht“, sagt Lina.',
  ] },
];

export interface DiaryBlank {
  id: string;
  /** What goes in the gap. */
  form: string;
  /** The base form shown above when the form differs from it. */
  base?: string;
}
export type DiaryPart = string | DiaryBlank;

/** Splits a line into text and blanks; base forms come from the caller (the word list). */
export function parseLine(line: string, baseOf: (id: string) => string): DiaryPart[] {
  const out: DiaryPart[] = [];
  let last = 0;
  for (const m of line.matchAll(/\{([a-z0-9-]+)(?::([^}]+))?\}/g)) {
    if (m.index! > last) out.push(line.slice(last, m.index));
    const base = baseOf(m[1]);
    // A blank that starts a sentence is written with a capital.
    const cap = /(^|[.?!„–]\s*)$/.test(line.slice(0, m.index));
    const form = m[2] ?? base;
    out.push({ id: m[1], form: cap ? form[0].toUpperCase() + form.slice(1) : form, ...(m[2] ? { base } : {}) });
    last = m.index! + m[0].length;
  }
  if (last < line.length) out.push(line.slice(last));
  return out;
}
