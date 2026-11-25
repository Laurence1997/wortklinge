// 日记残页 (0.6 block 3): one page of the nameless neighbour's diary per scene word group.
// When every word of a scene's group is at least 半名, its page drops. The player fills each blank (the group's words),
// may read it aloud, and the page is restored. Regions 1–2: present tense; region 3: Perfekt.
// Blanks: {wordId} uses the word's own form; {wordId:Form} is an inflected form (the UI shows the base form above).
// Each group word is blanked at most once per page. German not yet proofread (统一校对 at release).

import { SCENE_WORDS, WORD_BY_ID, sceneByWords } from './words';

export interface DiaryPage {
  /** Scene whose word group drops this page. */
  scene: string;
  lines: string[];
}

export const DIARY_WRITER = 'Jonas Keller';

/** One page per scene of regions 1–3, written for the 2026-11-25 scene sheet. Keys are the scene ids of that sheet;
 *  DIARY below moves each page to the scene that now holds most of its words, so a re-sorted sheet needs no rewrite. */
const WRITTEN: DiaryPage[] = [
  // ---- Region 1 · Echogasse: notes against forgetting, ending at „Wie heiße ich?“ ----
  { scene: 'r1-a1', lines: [
    "Heute {ziehen:ziehst} du in die Echogasse 7. Dein {zimmer} ist leer.",
    "Es {fehlen:fehlt} ein {tisch}, es fehlt ein {stuhl}. Das ist ein {problem}.",
    "Ich gebe dir meinen alten Tisch. Wir {bauen} ihn in deiner {kueche} auf.",
    "Abends {sitzen:sitzt} du still am Fenster. Es ist sehr {ruhig} im Haus.",
  ] },
  { scene: 'r1-a2', lines: [
    "Ich {wohnen:wohne} im dritten {stock}, du im zweiten.",
    "Deine {wohnung} hat nur einen {raum} und ein kleines {bad}.",
    "Die {miete} ist niedrig. Die Frau vor dir wollte schnell {ausziehen}. Niemand weiß, warum.",
    "In der Nacht brennt bei dir {licht}. Ich sehe es durch mein {fenster}.",
  ] },
  { scene: 'r1-a3', lines: [
    "Unser {haus} ist alt. Hinten liegt ein kleiner {garten}.",
    "Ich bin jetzt dein {nachbar}. Die {tuer} zum {keller} steht immer {offen}.",
    "Im Keller steht ein {schrank}. Er {gehoeren:gehört} niemandem. Was ist {drin}?",
    "In deiner Küche ist der {herd} kaputt, und der {kuehlschrank} ist {laut}.",
  ] },
  { scene: 'r1-a4', lines: [
    "Du trägst eine {schwarz:schwarze} Jacke und ein {weiss:weißes} Hemd.",
    "Deine Tasche ist {schwer}. Ich trage sie {mal} kurz für dich.",
    "Du steckst mir eine {karte} in die Hand. Darauf steht dein Name.",
    "Ich {legen:lege} sie auf meinen Tisch. Das muss reichen, denke ich.",
  ] },
  { scene: 'r1-a5', lines: [
    "Heute Nacht ist etwas passiert. Ich weiß nicht, was.",
    "Am Morgen liegt ein roter Mantel im Müll.",
    "Vor der Haustür steht nur ein {schuh}. Wer {verlieren:verliert} einen Schuh?",
    "Ich {schliessen:schließe} meine Tür ab. Ich will nichts mitnehmen, ich will nicht raus.",
    "Auf dem {bild} im Flur ist ein Gesicht. Kein Name steht drauf.",
  ] },
  { scene: 'r1-a6', lines: [
    "Ich {holen:hole} ein leeres {buch} aus dem Schrank.",
    "Ich mache eine Liste von allen Dingen im Haus. Die erste Seite ist schnell {voll}.",
    "Plötzlich fällt ein Stück Putz von der Decke.",
    "Ich öffne die Tür. Draußen ist niemand.",
    "Ich {tragen:trage} das Buch jetzt immer bei mir.",
  ] },
  { scene: 'r1-a7', lines: [
    "Was ist in dieser Nacht {geschehen}? Niemand sagt die {wahrheit}.",
    "Für die Leute im Haus ist alles {normal}. Für mich nicht.",
    "Vielleicht ist es ein {fehler} in meinem Kopf.",
    "Ich muss mich {entscheiden}: vergessen oder aufschreiben.",
    "Die {entscheidung} ist leicht. Für die {zukunft} schreibe ich.",
  ] },
  { scene: 'r1-b1', lines: [
    "Du klingelst und sagst: „{hallo}! Wie {heissen:heißen} Sie?“",
    "Ich gebe keine Antwort. Mein Name ist weg, einfach {so}.",
    "Du sagst: „{entschuldigung}“ und lächelst. Du lernst unsere Sprache an der {uni}.",
    "Unten wohnt eine {frau} mit einem Baby. Ich grüße sie. Sie sagt: „Noch einmal, bitte.“",
  ] },
  { scene: 'r1-b2', lines: [
    "Du stellst dich vor. Du bist Student und {studieren:studierst} Medizin.",
    "Deine {eltern} sind weit weg. Dein {vater} war {lehrer}.",
    "Ich sage: „Verzeihung, ich habe deinen Namen vergessen.“ Du sagst: „Kein Problem.“",
    "Du {nennen:nennst} ihn noch einmal. Ich schreibe ihn {ganz} langsam auf.",
  ] },
  { scene: 'r1-b3', lines: [
    "Du zeigst mir Fotos von deiner {familie}: deine {mutter}, dein {bruder}, deine {schwester}.",
    "Deine Schwester ist {verheiratet} und hat eine kleine {tochter}.",
    "Ich habe auch eine Familie, glaube ich. Aber ich weiß keinen {name:Namen}.",
    "Du sagst: „Schreib sie auf.“ Ich sage: „Alles klar.. {danke}.“",
    "Das ist jetzt meine Hausaufgabe, jeden Tag.",
  ] },
  { scene: 'r1-b4', lines: [
    "Ich gehe zur Polizei. Ich habe eine {frage}: Wer bin ich?",
    "Der Beamte will meinen {ausweis}. Das Foto ist da, der Name nicht.",
    "Er gibt mir ein {formular}. Ich soll unterschreiben, aber mit welchem Namen?",
    "„Das ist kein {fall} für uns“, sagt er. „Gehen Sie zur Behörde.“",
    "Bei der Post liegt ein Paket für mich. Ohne Namen.",
  ] },
  { scene: 'r1-b5', lines: [
    "Im {amt} ist es still. Ich schreibe einen Antrag: „Ich brauche meinen Namen zurück.“",
    "Die Frau am Schalter fragt nach dem {grund}.",
    "„Ist das {moeglich}?“, frage ich. Sie sagt nur: „Wir {melden} uns.“",
    "Eine Woche später erhalte ich einen Brief. Die {unterschrift} ist leer, die Adresse auch.",
  ] },
  { scene: 'r1-b6', lines: [
    "Du kommst mit Kuchen zu mir. Ich sage: „Freut mich.“",
    "Du bist sehr {nett}. Dein Deutsch ist nicht {perfekt}, aber {ziemlich} gut.",
    "Du fragst: „Wie heißt du eigentlich?“ Ich sage: „Ich weiß nicht.“",
    "Du lachst nicht. „Das tut mir {leid}“, sagst du. „{na}, dann suchen wir ihn.“",
    "Ich bin {voellig:völlig} still. Dann sage ich: „{okay}.“",
  ] },
  { scene: 'r1-c1', lines: [
    "Ich lade dich zum Essen ein. Wir kochen {zusammen}.",
    "Du erzählst von deiner {freundin} in der Heimat. Du liebst sie sehr.",
    "Ich kenne dich erst eine Woche, {aber} du bist schon mein Freund.",
    "In der Nacht höre ich eine Stimme. Sie {rufen:ruft} einen Namen. Ist es meiner?",
  ] },
  { scene: 'r1-c2', lines: [
    "Ich treffe dich jeden Morgen im Treppenhaus.",
    "Du kümmerst dich um mich. Ich {moegen:mag} das.",
    "ehrlich gesagt habe ich {angst}.",
    "Du lachst und sagst: „Das {stimmen:stimmt} nicht. Du bist mutig.“",
    "Ich {glauben:glaube} dir nicht. Aber ich fühle mich besser.",
  ] },
  { scene: 'r1-c3', lines: [
    "Die {leute} im Haus reden nicht mehr miteinander.",
    "Ich besuche die Frau mit dem Baby. Sie {lachen:lacht} nicht mehr. Die Sache ist {ernst}.",
    "Sie sagt: „Ich {hassen:hasse} diese Stille. Wie heißt mein Mann?“",
    "Du {kuemmern:kümmerst} dich um sie. Du sagst: „Wir finden die Namen. Ich {versprechen:verspreche} es.“",
    "Ich {fuehlen:fühle}: Du meinst es {echt} so.",
  ] },
  { scene: 'r1-c4', lines: [
    "Ich {kennen:kenne} dich erst eine Woche. Trotzdem bist du mir {bekannt}, wie ein alter Freund.",
    "Du {lieben:liebst} deine Freundin in der Heimat. Du nennst sie „mein {schatz}“.",
    "In der Nacht höre ich eine {stimme}. Sie ist nicht {boese}, nur traurig.",
    "Ich {hoffen:hoffe}, das alles ist nicht {wahr}. Aber Stimmen {luegen:lügen} nicht.",
  ] },
  { scene: 'r1-c5', lines: [
    "Ich {zaehlen:zähle} die Wörter in meinem Buch. Es sind schon {hundert-num}.",
    "Mein Ziel sind {tausend-num}, bevor alles weg ist.",
    "Im Haus wohnen noch {sieben-num} Leute. Ein {paar} sehe ich nie.",
    "Du sagst: „In dieser Stadt wohnt eine {million} Menschen. Wo sind sie?“",
    "Wir gehen {zwei-num} Stunden durch die Straßen und sehen nur {vier-num}.",
  ] },
  { scene: 'r1-c6', lines: [
    "Am {zweite-num:zweiten} Tag zähle ich die Türen im Haus. Es sind {neun-num}.",
    "Auf {drei-num} Türen fehlt der Name, auf {fuenf-num} steht noch einer.",
    "Deine Tür hat nur noch eine {nummer}.",
    "Ich zähle: {eins-num}, zwei, drei. Bei {sechs-num} höre ich auf.",
    "Du fragst: „{wie-viel} Zeit haben wir noch?“",
  ] },
  { scene: 'r1-c7', lines: [
    "Ich hoffe, das alles ist nicht wahr.",
    "Du sagst: „Es ist nicht so {schlimm}.“ Aber du bist auch {ueberrascht}.",
    "Die Leute im Haus sagen: „Das ist uns egal.“ Ich finde das {dumm}.",
    "Ich {freuen:freue} mich nur über eine Sache: Du bist da.",
    "Hast du {ueberhaupt} Angst? Ich glaube nicht.",
  ] },
  { scene: 'r1-d1', lines: [
    "Heute verschwinden die kleinen Wörter. Ich {wissen:weiß} nicht, {warum}.",
    "Ich frage dich, {ob} du „{wo}“ noch sagen kannst.",
    "Du {zeigen:zeigst} auf den Boden: „{hier}.“ Gut.",
    "Wir {setzen} uns und reden {lang} darüber.",
    "Du {halten:hältst} meine Hand. Es geht mir {fast} {gut}.",
  ] },
  { scene: 'r1-d2', lines: [
    "Ich {haben:habe} {viel} Papier, aber {wenig} Zeit.",
    "Jedes Ding im Zimmer bekommt einen Zettel. Ich {machen:mache} das {selbst}.",
    "Du {fragen:fragst}: „wieso zuerst der Stuhl?“ Ich sage: „Der Stuhl vergisst {halt} schnell.“",
    "Du lachst. Ich {versuchen:versuche} auch zu lachen.",
  ] },
  { scene: 'r1-d3', lines: [
    "Ein Fremder {stehen:steht} im Flur. Er {suchen:sucht} seine Wohnung.",
    "Ich frage: „woher kommen Sie?“ Er weiß es {nicht}.",
    "Er {wollen:will} {zurueck}, aber er weiß nicht, wohin.",
    "Ich {stellen:stelle} ihm einen Stuhl hin. Er {brauchen:braucht} nur Ruhe.",
    "Am Morgen ist er weg. Er ist {einfach} weg.",
  ] },
  { scene: 'r1-d4', lines: [
    "Die Stille {werden:wird} jeden Tag größer.",
    "Ich {muessen:muss} {schnell} schreiben. Ich {lassen:lasse} kein Wort {weg}.",
    "Du {bekommen:bekommst} ein {neu:neues} Heft von mir.",
    "Du {verstehen:verstehst} {sofort}: Du sollst auch schreiben.",
    "Jetzt haben wir zwei Bücher. Das ist besser als eins.",
  ] },
  { scene: 'r1-d5', lines: [
    "Wir {gehen} zusammen raus. Die Stadt ist {gross:groß} und leer.",
    "Wir {sehen} keinen {mensch:Menschen}.",
    "Auf der Straße {liegen:liegt} ein Schild. Die Buchstaben sind weg.",
    "Wir gehen {weit}, bis zum {ander:anderen} Ende der Stadt.",
    "Ich {koennen:kann} nicht mehr. Wir {bleiben} eine Stunde dort und schweigen.",
  ] },
  { scene: 'r1-d6', lines: [
    "Eine {alt:alte} Frau {warten:wartet} an der Haltestelle.",
    "Ich frage: „wann {kommen:kommt} der Bus?“ Sie {sprechen:spricht} nicht.",
    "Ich {geben:gebe} ihr meinen Schal. Sie {nehmen:nimmt} ihn.",
    "Ich will ihr {helfen}, aber {wie}?",
    "Sie wartet weiter. Ich glaube, sie wartet darauf, dass jemand ihren Namen sagt.",
  ] },
  { scene: 'r1-d7', lines: [
    "Ich will meine Schwester anrufen. Das {telefon} {klingen:klingt} komisch, dann kommt nichts.",
    "Das Internet geht noch. Meine {suche} nach meinem Namen bringt keine {information}.",
    "Ich schreibe eine E-Mail an mich selbst. Jeder Satz beginnt mit „Ich“.",
    "Am Ende {erkennen:erkenne} ich kein Wort mehr.",
  ] },
  { scene: 'r1-d8', lines: [
    "Mein Handy {funktionieren:funktioniert} noch. Ich {schicken:schicke} dir eine Nachricht.",
    "Du antwortest mit einem {foto}: ein leeres Zimmer.",
    "Die {zeitung} von heute hat keine Wörter, nur eine weiße Seite nach der anderen.",
    "Auf meinem Computer verschwinden die Namen.",
    "Ich habe keine Ahnung, was hier passiert.",
  ] },
  { scene: 'r1-e1', lines: [
    "Mein {hobby} ist {musik}. Ich {hoeren:höre} jeden Abend Radio.",
    "Heute spielt das Radio nur Rauschen. {auch} das {kino} ist zu.",
    "Du sagst: „Das {semester} beginnt bald.“ Ich glaube nicht daran.",
    "{wenn} ich nicht {schlafen} kann, schreibe ich.",
    "Du feierst trotzdem deinen Geburtstag. Wir sind nur zu zweit.",
  ] },
  { scene: 'r1-e2', lines: [
    "In meiner {freizeit} {lernen:lerne} ich alte Wörter {wieder}.",
    "Wir {spielen} Karten. Du {gewinnen:gewinnst} immer.",
    "Dann {lesen:lese} ich dir {leise} aus meinem Buch vor.",
    "Wir lernen {gemeinsam}. Das ist besser als jeder {film}.",
    "Es ist spät, aber wir sind nicht müde.",
  ] },
  { scene: 'r1-e3', lines: [
    "Ich {laufen:laufe} jeden Morgen um das Haus, {damit} ich wach bleibe.",
    "Ich schreibe, {weil} ich {nie} wieder {vergessen} will.",
    "Du gehst zu deiner {vorlesung}. Sie ist auf englisch. Der Saal ist leer.",
    "Am {feierabend} {erinnern:erinnere} ich dich an deinen Namen, und du mich an meinen, so gut es geht.",
  ] },
  { scene: 'r1-e4', lines: [
    "Ich gehe zur {arbeit}. Im {buero} sitzt niemand.",
    "Mein {chef} ist weg, mein {kollege} auch.",
    "Ich bin trotzdem {beschaeftigt}. Ich schreibe Wörter auf.",
    "Du schreibst eine {bewerbung} an die {universitaet}. Wer liest sie?",
    "Wir sind jetzt ein {team}. Das {schaffen} wir.",
  ] },
  { scene: 'r1-e5', lines: [
    "Ich {arbeiten:arbeite} nicht mehr. Mein {job} ist weg und mein {gehalt} auch.",
    "Du hast eine {idee}: Wir machen einen {kurs} für die Leute im Haus.",
    "Unsere {gruppe} hat fünf Leute. Ich {uebernehmen:übernehme} die Wörter.",
    "Das ist jetzt mein {beruf}. Ich {verdienen:verdiene} nichts, aber ich bin nicht allein.",
  ] },
  { scene: 'r1-e6', lines: [
    "Ich schreibe {weiter}, {sonst} vergesse ich alles.",
    "Du fragst {oft}: „Ist das {richtig}?“ Ich weiß es nicht.",
    "{bevor} ich schlafe, lese ich die Liste noch {einmal}.",
    "Du hilfst mir {gerne}. {deshalb} bist du jeden Abend {dabei}.",
    "Aber heute bist du müde. Was ist {los}?",
  ] },
  { scene: 'r1-e8', lines: [
    "Ich habe einen {plan}. Ich schreibe jeden Tag, das ist mein {ziel}.",
    "Es ist nicht {leicht}. Manche Wörter haben keinen {sinn} mehr.",
    "Ein {beispiel}: Ich lese „Tisch“ und weiß nicht, was es {bedeuten:bedeutet}.",
    "Ich muss schnell {handeln}. Jeder Tag ohne Liste ist eine verlorene {chance}.",
  ] },
  { scene: 'r1-e7', lines: [
    "{zuerst} vergesse ich die Namen, {danach} die Gesichter.",
    "{manchmal} erkenne ich dich {kaum}. Ich weiß {zwar}, du bist mein Freund, aber nicht mehr, warum.",
    "Ich kann nichts {beweisen}. Ich kann nichts {erklaeren}.",
    "Dieses Buch ist für dich, {falls} ich {niemals} zurückkomme.",
    "Wenn du das liest: Wie heiße ich?",
  ] },
  // ---- Region 2 · the shopping book: Konrad's bread, his daughter Lina ----
  { scene: 'r2-a1', lines: [
    "Ein neues Heft: mein Einkaufsbuch. Hier schreibe ich nur auf, was ich esse.",
    "Ich habe {hunger}. Im {topf} liegen zwei alte {kartoffel:Kartoffeln}.",
    "Im Laden an der Ecke {backen:backt} ein Mann Brötchen. Er heißt Konrad.",
    "Er sagt: „Nimm, {bitte}.“ Ich esse, bis ich {satt} bin.",
  ] },
  { scene: 'r2-a2', lines: [
    "Konrad schneidet {kaese} mit einem großen {messer}.",
    "Er backt auch {kuchen} mit {quark}. Der {schmecken:schmeckt} wie früher.",
    "Am Abend {trinken:trinkt} er ein {bier}. Ich esse eine Suppe.",
    "Seine Tochter Lina kommt herein. Sie isst nur vegetarisch, sagt er.",
  ] },
  { scene: 'r2-a3', lines: [
    "Lina {ruehren:rührt} {mehl} und Wasser. Sie spricht nicht.",
    "Ich {probieren:probiere} ihr Brot. Es ist etwas sauer.",
    "Konrad brät Eier in {oel}. Das ganze Haus riecht danach.",
    "Ich trinke einen {kaffee} und gebe ihm zwei Euro. „Stimmt so.“, sage ich.",
  ] },
  { scene: 'r2-a4', lines: [
    "Konrad {bedienen:bedient} jeden, auch ohne Geld.",
    "Zum {mittagessen} gibt es {fisch} und {brot}.",
    "Lina trinkt eine Tasse {tee}. Er ist bitter, sagt sie.",
    "Ich habe {durst} und trinke meinen {saft} in einem Schluck.",
    "Konrad lacht und sagt: „Iss, solange es Brot gibt.“",
  ] },
  { scene: 'r2-a5', lines: [
    "Die {baeckerei} ist der einzige warme Ort in der Straße.",
    "Die {kneipe} daneben ist leer. Der {wein} steht noch auf den Tischen.",
    "Lina {kochen:kocht} heute. Es gibt Salat mit Pilzen und {frisch:frischem} {obst}.",
    "Konrad nimmt Honig in den Tee und sagt leise: „Sie war früher anders.“",
  ] },
  { scene: 'r2-a6', lines: [
    "Zum {abendessen} {mischen:mischt} Konrad {tomate:Tomaten} und {zwiebel:Zwiebeln}.",
    "Plötzlich riecht es nach Rauch. Das {fleisch} verbrennt.",
    "Lina steht am Fenster. Sie merkt den Geruch nicht. Sie sieht zum Bahnhof.",
    "Konrad sagt nichts. Er gibt mir einen {apfel} und etwas {butter} für morgen.",
  ] },
  { scene: 'r2-b1', lines: [
    "Zum {fruehstueck} gibt es {joghurt} mit Erdbeeren.",
    "Lina nimmt viel {zucker}. Sie mag es süß, sagt Konrad.",
    "Ihr {teller} bleibt halb voll. Den {rest} isst die Katze.",
    "Auf dem Tisch steht ein Becher {voller} Fahrkarten. Alle sind alt.",
  ] },
  { scene: 'r2-b2', lines: [
    "In der {metzgerei} frage ich: „Haben Sie Brot?“ Der Metzger sagt: „{nein}.“",
    "Im Kleiderladen zeigt Lina auf ein {kleid}: „Was kostet das?“",
    "Sie geht in die Umkleidekabine und bleibt lange.",
    "Lina will {nur} das Kleid. Sie {kaufen:kauft} nichts {mehr}.",
  ] },
  { scene: 'r2-b3', lines: [
    "Am Markt sage ich: „Ich hätte gern ein Kilo Äpfel.“",
    "Die Frau legt {ungefaehr} zehn Äpfel in meinen Korb.",
    "Ich habe kein {bargeld}. Wir {tauschen} Äpfel gegen Brot.",
    "In der {drogerie} {vergleichen:vergleicht} Lina zwei Seifen. „Ich nehme das.“, sagt sie.",
  ] },
  { scene: 'r2-b4', lines: [
    "Auf dem Flohmarkt verkauft Lina alte Sachen. Konrad weiß es nicht.",
    "Ein {verkaeufer} {wiegen:wiegt} ihren Ring. „{gold}“, sagt er.",
    "Sie fragt: „Wo ist die Kasse?“ Er zahlt ihr {lediglich} zehn Euro.",
    "Lina nimmt das {geld}. Wofür braucht sie es?",
    "Am {kiosk} kauft sie eine Zeitung. Darin ist nur ein Fahrplan.",
  ] },
  { scene: 'r2-b5', lines: [
    "Ich gehe für Konrad {einkaufen}. An der {kasse} frage ich: „Kann ich mit Karte zahlen?“",
    "Die Frau sagt: „Nur bar.“ Ich {zahlen:zahle} mit Münzen.",
    "Mein Einkauf ist klein: Mehl, Salz, Hefe. Trotzdem {ausgeben:gebe} ich zehn {euro} aus.",
    "Ich frage: „Geht das billiger?“ Sie lacht nicht.",
  ] },
  { scene: 'r2-b6', lines: [
    "Ich soll für Lina eine Fahrkarte {besorgen}. Sie sagt, sie ist für einen Freund.",
    "Am Schalter frage ich: „Gibt es einen Rabatt?“ Der Mann sagt: „Keine Ermäßigung.“",
    "„Das macht fünf Euro.“ Ich {bezahlen:bezahle} mit der EC-Karte und bekomme eine {quittung}.",
    "Auf der Fahrkarte fehlt das Ziel. Der Schalter ist nur nachts {geoeffnet}.",
  ] },
  { scene: 'r2-c1', lines: [
    "Das {restaurant} am Markt hat zu. Die Mensa auch.",
    "Ich kaufe {reis}, eine {wurst} und eine {flasche} Wasser.",
    "Für Lina kaufe ich Schokolade. Sie sagt: „{lecker}.“ Fast ein Lächeln.",
    "Konrad spült das Geschirr. Er trinkt keinen Alkohol mehr.",
  ] },
  { scene: 'r2-c2', lines: [
    "Im {supermarkt} sind die Öffnungszeiten kurz. Das Brot ist {knapp}.",
    "Bei der {kleidung} fragt eine Stimme: „Noch etwas?“ Ich sage: „Ich schaue mich nur um.“",
    "Ich kaufe Lina warme {handschuh:Handschuhe}. Der {preis} ist {relativ} hoch.",
    "Der {kassierer} zählt jede {muenze} zweimal.",
  ] },
  { scene: 'r2-c3', lines: [
    "Lina geht jeden Abend {alleine} zum Bahnhof.",
    "Ich frage: „{wohin} willst du?“ Sie sagt: „{dahin}, wo mein Name ist.“",
    "„Und wozu?“ Sie zuckt mit den Schultern. Sie weiß es {selber} nicht.",
    "mitten in der Nacht kommt sie zurück. {wenigstens} kommt sie zurück.",
  ] },
  { scene: 'r2-c4', lines: [
    "{ueberall} in der Stadt hängen jetzt Zettel. Ich lese, was {darin} steht: „Letzter Zug.“",
    "Lina geht die Treppe {runter} und {hinaus} auf die Straße.",
    "Sie läuft durch die Stadt, immer im Kreis {herum} um den Bahnhof.",
    "Ich laufe ihr hinterher und frage: „wofür das alles?“ Sie antwortet nicht.",
  ] },
  { scene: 'r2-c5', lines: [
    "Lina trägt einen {blau:blauen} {pullover}. Darunter {verstecken:versteckt} sie etwas.",
    "Ich sehe ein Stück {papier}, {gruen:grün} wie eine alte Fahrkarte.",
    "Sie {druecken:drückt} es an die Brust. „Das {behalten:behalte} ich“, sagt sie.",
    "Konrad will danach {greifen}. Ich halte ihn fest.",
  ] },
  { scene: 'r2-c6', lines: [
    "Mein {vermieter} schreibt mir. Er will meine {kaution} nicht zurückgeben. Er weiß meinen Namen auch nicht.",
    "Die {heizung} im {schlafzimmer} ist kalt.",
    "Ich {putzen:putze} den {boden}, damit ich nicht denke.",
    "Mein Handy will nicht {starten}. Das {system} hat alle {daten} gelöscht.",
  ] },
  { scene: 'r2-d1', lines: [
    "Im Café {bestellen:bestelle} ich eine {pizza}. Es gibt keinen Koch mehr.",
    "Der Kellner bringt nur Leitungswasser.",
    "Ich sage: „Zahlen, bitte!“ Er fragt: „Wofür?“",
    "Zu Hause schreibe ich Konrads {rezept} für Suppe mit {gemuese} auf.",
    "Von gestern ist nur eine {banane} {uebrig}.",
  ] },
  { scene: 'r2-d2', lines: [
    "Auf dem {markt} gibt es nur noch wenige Stände. Ich bin der einzige {kunde}.",
    "Ich kaufe ein {pfund} Mehl für Konrad. „Das ist alles.“, sage ich.",
    "Kurz vor Ladenschluss steht ein leerer {einkaufswagen} vor dem Bahnhof.",
    "Darin liegt Linas Schal. Sie hat {genuegend:genügend} Brot für eine Reise gekauft.",
  ] },
  { scene: 'r2-d3', lines: [
    "Konrad erzählt von seiner {ehe}. Seine Frau ist vor fünf Jahren gestorben.",
    "Seitdem ist Lina {fremd} im eigenen Haus.",
    "Ich bringe ihr ein {geschenk}: ein neues Heft. Ich will sie {ueberraschen}.",
    "Ich {raten:rate} ihr: „Schreib alles auf.“ Sie sagt: „Ich habe keine {hoffnung}.“",
    "Konrad ist {dagegen}. „Sie braucht kein Heft. Sie braucht ihre Mutter.“",
  ] },
  { scene: 'r2-d4', lines: [
    "Konrad ist {stolz} auf Lina, aber sie {leiden:leidet}.",
    "Sie wollte {heiraten}. Ihr {partner} ist in der Nacht der Stille verschwunden.",
    "Sie hat nur eine {erinnerung}: ein Bahnhof, ein Zug, ein Name.",
    "Ich will nicht {stoeren}. Aber der Gedanke lässt mich nicht los.",
  ] },
  { scene: 'r2-d5', lines: [
    "Heute bin ich {gast} bei Konrad. Lina {aussehen:sieht} {total} müde aus.",
    "Sie sagt: „Meine {mama} hat {aehnlich} ausgesehen, bevor sie ging.“",
    "Die {haelfte} ihrer Fotos ist leer. Auf {zwoelf-num} von vierundzwanzig fehlt ein Gesicht.",
    "Konrad will sich {entschuldigen}. Wofür, weiß er nicht.",
  ] },
  { scene: 'r2-d6', lines: [
    "Am Bahnhof steht ein Schild: „{willkommen}“. Der Name der Stadt fehlt.",
    "Lina {bitten:bittet} mich: „Komm morgen mit. {unbedingt}.“",
    "Ich sage: „Das ist keine {wunderbar:wunderbare} Idee.“",
    "Sie lächelt: „{uebrigens}, Konrad weiß es schon.“ Er weiß es nicht.",
    "Ich sage es ihm. Er schweigt. Ich schweige {ebenfalls}.",
  ] },
  { scene: 'r2-e1', lines: [
    "Konrad ist ein guter Bäcker. Er {verkaufen:verkauft} sein Brot zum halben Preis.",
    "Er sagt: „Brot darf nicht viel {kosten}.“",
    "Ich frage: „Bar oder mit Karte?“ Er lacht: „Wie du willst.“",
    "Lina steht am Automaten vor dem Bahnhof. Er nimmt keine {kohle}, nur Namen, sagt sie.",
    "Konrad packt ihr eine {tuete} Brot ein. Er {beschweren:beschwert} sich nicht.",
  ] },
  { scene: 'r2-e2', lines: [
    "Konrad {planen:plant} eine {party} für Lina, ihre letzte hier.",
    "Wir singen ein {lied} und {tanzen}. Es ist fast lustig.",
    "Lina {merken:merkt}, was er tut. Sie umarmt ihn lange.",
    "In der Nacht {aufwachen:wache} ich auf. Ihre Tür steht offen.",
  ] },
  { scene: 'r2-e3', lines: [
    "Lina {verbringen:verbringt} den Tag im alten {theater}.",
    "Dort singt sie, ganz allein. Ich höre zu.",
    "Sie macht eine {runde} über die Bühne, jeden {schritt} ganz langsam.",
    "Sie sagt: „Ich will nicht {aufhoeren}. deswegen gehe ich.“",
  ] },
  { scene: 'r2-e4', lines: [
    "Konrad geht zur {bank}. Er will sein {konto} für Lina leeren.",
    "Er {besitzen:besitzt} nicht viel. Er war nie {reich}.",
    "Am Schalter heißt es: „Ohne Namen keine {ueberweisung}.“",
    "Konrad legt seine {kreditkarte} auf den Tisch. Sie hat keinen {wert} mehr.",
  ] },
  { scene: 'r2-e6', lines: [
    "Lina ist heute {komisch}. Erst lacht sie, dann ist sie {traurig}.",
    "Sie trägt ein {huebsch:hübsches} Kleid und ist {aufgeregt}.",
    "Konrad sagt: „Das ist {verrueckt}.“ Ich sage {weder} ja noch nein.",
    "{jedenfalls} schreibe ich alles auf. Es ist unglaublich, wie schnell sie sich verändert.",
  ] },
  { scene: 'r2-e5', lines: [
    "Konrad bleibt in der Bäckerei. Er backt {staendig}, er schläft {selten}.",
    "{ploetzlich} kommt ein Licht über die Brücke.",
    "Lina packt ihre Tasche. Sie sagt: „Ich gehe nicht weg. Ich gehe {naemlich} nach Hause.“",
    "{zumindest} sagt sie das.",
    "Lina geht zum Bahnhof. Ich gehe auch.",
  ] },
  // ---- Region 3 · Perfekt: the station, the whispering timetable, Lina's ticket ----
  { scene: 'r3-a1', lines: [
    "Wir sind zum Bahnhof gegangen. Auf dem {gleis} hat ein {zug} gestanden.",
    "Er hatte keinen {fahrer} und keinen {motor}. Er war wie aus Papier.",
    "Auf dem {fahrplan} stand nur: „{abfahrt} jetzt“.",
    "Wir haben ihn nicht {verpassen:verpasst}. Lina ist eingestiegen, und ich auch.",
  ] },
  { scene: 'r3-a2', lines: [
    "Die {bahn} ist sehr {langsam} {fahren:gefahren}.",
    "Nach einer Stunde hat sie {stoppen:gestoppt}. Wir sind {ankommen:angekommen}, aber wo?",
    "Kein Schild, kein {anschluss}.",
    "Ein {busfahrer} hat gesagt: „Hier fährt nichts mehr. Gehen Sie {zu-fuss}.“",
    "Wir wollten {zurueckgehen}, aber der Zug war schon weg.",
  ] },
  { scene: 'r3-a3', lines: [
    "Der {bahnhof} war leer. Am {bahnsteig} lag Schnee.",
    "Ich habe am Automaten eine {fahrkarte} {loesen:gelöst}.",
    "Der Automat hat den Namen der {station} gefressen. Auf meiner Karte stand nur ein Strich.",
    "Der letzte {bus} ist {ausfallen:ausgefallen}. Es gab auch kein {taxi}.",
  ] },
  { scene: 'r3-a4', lines: [
    "Wir sind zu Fuß gegangen. {unterwegs} haben wir ein {auto} gesehen.",
    "Es hat die {strecke} {blockieren:blockiert}. Niemand saß darin.",
    "Dann ist eine {strassenbahn} gekommen. Sie hat nicht {anhalten:angehalten}.",
    "Lina ist hinterhergelaufen und {einsteigen:eingestiegen}. Ich auch.",
    "So haben wir die Stadt {erreichen:erreicht}.",
  ] },
  { scene: 'r3-a5', lines: [
    "An der Endstation sind wir in die {s-bahn} {umsteigen:umgestiegen}.",
    "Eine Stimme hat gerufen: „{achtung}! {schwarzfahren} kostet den Namen.“",
    "Ich habe mein {ticket} gezeigt. Mein Name ist trotzdem nicht zurückgekommen.",
    "Die S-Bahn ist zum {flughafen} gefahren. Kein Flugzeug ist dort {fliegen:geflogen}.",
  ] },
  { scene: 'r3-a6', lines: [
    "Am {hauptbahnhof} sind wir {aussteigen:ausgestiegen}.",
    "Die {u-bahn} hatte {verspaetung}. Im {tunnel} war es dunkel.",
    "Ein Kontrolleur hat uns {erwischen:erwischt}. Er wollte meine {monatskarte} sehen.",
    "Ich habe ihm meine Fahrkarte gegeben: „{hin-und-zurueck}“. Er hat gelacht: „Zurück? {vorsicht}.“",
  ] },
  { scene: 'r3-a7', lines: [
    "Im Kiosk lag altes {zeug}: ein {schal}, eine {socke}, ein {ring}.",
    "Lina hat den Ring genommen. Er hat ihrer Mutter gehört.",
    "An der Wand hing eine {maschine} für Fahrkarten. Ihre {farbe} war grau wie Asche.",
    "Lina hat eine {briefmarke} aus ihrem {sack} geholt und auf ihr Ticket geklebt.",
  ] },
  { scene: 'r3-a8', lines: [
    "Lina hat mir {gratulieren:gratuliert}: „Du hast es bis hierher geschafft.“",
    "Ich habe mich {bedanken:bedankt}. Mir ging es nicht {bestens}, aber gut genug.",
    "Sie hat nicht {allzu} viel gesagt. Sie hat nur auf die Gleise geschaut.",
    "Es war {unheimlich}, wie ruhig sie war. Später habe ich es {bedauern:bedauert}, dass ich nichts gefragt habe.",
  ] },
  { scene: 'r3-b1', lines: [
    "Die {stadt} hinter dem Bahnhof war still. Nur die Glocke der {kirche} hat geschlagen.",
    "An jeder {ecke} war ein {zeichen} an der Wand: ein Zug ohne Ziel.",
    "Auf einem {schild} stand {hamburg}. Unser Ort hat gefehlt.",
    "Lina hat gesagt: „Meine Mutter ist {irgendwo} hier.“ Wir sind {naeher} gegangen. Die Buchstaben sind zerfallen.",
  ] },
  { scene: 'r3-b2', lines: [
    "In der {innenstadt} war ein {museum}, ganz {zentral}, in einem alten {gebaeude}.",
    "{dort} hingen Bilder von der Stadt. Kein {einwohner} hatte ein Gesicht.",
    "Ein Bild hat {berlin} gezeigt, vor hundert Jahren. Darunter stand kein Name.",
    "Wir haben uns im Museum {verlaufen}. Den {ausgang} haben wir erst am Abend gefunden.",
  ] },
  { scene: 'r3-b3', lines: [
    "Wir haben uns in der {altstadt} {verloren} gefühlt.",
    "Wir sind im {kreis} gegangen. Die Schilder haben nach {muenchen} und {frankfurt} gezeigt, nie nach Hause.",
    "Lina hat gesagt: „Meine Mutter hat in der {hauptstadt} gearbeitet. Sie ist weit {entfernt}.“",
    "{oben} auf einem Turm hat ein Licht gebrannt. Wir haben {abstand} gehalten.",
  ] },
  { scene: 'r3-b4', lines: [
    "{vorne} an einem Haus war ein {eingang}, {hinten} ein Garten.",
    "Lina ist hineingegangen. Ich bin draußen bei einer leeren {kita} geblieben. Auf dem {spielplatz} hat eine Schaukel geschwungen.",
    "Nach einer Stunde ist sie {rauskommen:rausgekommen}. Sie hat geweint.",
    "Wir sind ohne ein Wort {weitergehen:weitergegangen}.",
  ] },
  { scene: 'r3-b5', lines: [
    "Wir haben uns in der {fussgaengerzone} verlaufen.",
    "Wir sind im Kreis gegangen, immer am selben {turm} vorbei.",
    "Im Fundbüro hat eine Frau gesessen. Sie hat gefragt: „Was haben Sie verloren?“",
    "Lina hat gesagt: „Meinen Namen.“ Die Frau hat in eine {richtung} gezeigt: zum {hafen}.",
  ] },
  { scene: 'r3-b6', lines: [
    "Vom {rathaus} sind wir zur {bruecke} gegangen.",
    "{unten} am Wasser hat eine Uhr getickt. Lina wollte sofort {hingehen}.",
    "Ich habe gesagt: „Diese {gegend} ist nicht gut. Dieser {ort} auch nicht.“",
    "Wir sind trotzdem gegangen. Unter der Brücke war eine Tür. Lina ist {eintreten:eingetreten}, und ich auch.",
  ] },
  { scene: 'r3-b7', lines: [
    "Die Stadt hinter dem Bahnhof war still.",
    "In der Mitte war ein {platz} mit einem {park}. {links} lag ein {friedhof}.",
    "Vor einem {kindergarten} standen kleine Schuhe. Wir haben das Haus nicht {betreten}.",
    "Lina hat gesagt: „Ich war schon einmal hier. Ich weiß nur nicht mehr, wie ich {herkommen:hergekommen} bin.“",
  ] },
  { scene: 'r3-c1', lines: [
    "Im Tunnel war eine Halle voller Uhren. Jede hat eine andere Zeit gezeigt.",
    "Auf einer stand {freitag}, auf einer {montag}, auf einer {maerz}.",
    "Wir haben die ganze {nacht} {abwarten:abgewartet}.",
    "Am {morgen} waren die Uhren {noch} da, und wir waren {schon} sehr müde.",
  ] },
  { scene: 'r3-c2', lines: [
    "Ein alter Fahrplan hat geflüstert: „Der letzte Zug fährt {morgen-2} um {mitternacht}.“",
    "Lina hat gesagt: „letztes Jahr an {weihnachten} war meine Mutter noch da.“",
    "Ich habe nicht auf die {zeit} geachtet. {erst} war es Abend, {dann} war es schon Nacht.",
    "{jetzt} weiß ich: Das war der {anfang} vom Ende.",
  ] },
  { scene: 'r3-c3', lines: [
    "Am nächsten {tag} war {feiertag}. Kein Mensch war auf der Straße.",
    "Lina hat das {datum} auf ihrer Fahrkarte gelesen: „{samstag}, Juni“. Welches Jahr?",
    "Ich habe gesagt: „{vielleicht} fährt der Zug noch nicht.“",
    "Sie hat {gerade} gelächelt. „Er kommt {jederzeit}.“",
  ] },
  { scene: 'r3-c4', lines: [
    "Eine {woche} ist {vergehen:vergangen}. Oder ein Tag? Ich weiß es nicht.",
    "Lina hat die Abfahrt immer wieder {verschieben:verschoben}.",
    "Jeden Abend um {halb} zwölf ist sie zum Gleis gegangen.",
    "Der Zug ist nie {puenktlich} gekommen. Er ist gar nicht gekommen.",
    "Nach einer {weile} hat sie gesagt: „{heute} nicht.“",
  ] },
  { scene: 'r3-c5', lines: [
    "{nachts} haben wir in der Bahnhofshalle geschlafen.",
    "Lina hatte {geburtstag}. Ich habe ihr ein Stück Brot geschenkt.",
    "Sie hat gesagt: „In der {vergangenheit} habe ich an meinem Geburtstag immer getanzt.“",
    "Für einen {moment} war alles {vorbei}: die Stille, die Angst.",
    "Dann hat die Uhr wieder getickt. „{bald}“, hat Lina gesagt.",
  ] },
  { scene: 'r3-c6', lines: [
    "{gestern} hat die große {uhr} wieder geschlagen.",
    "Sie hat keine {uhrzeit} gezeigt, nur einen {monat}: {november}.",
    "Lina hat gesagt: „{frueher} hat die Fahrt nach Hause nur eine Stunde {dauern:gedauert}.“",
    "Es war schon {spaet}. Wir haben lieber geschwiegen.",
  ] },
  { scene: 'r3-c7', lines: [
    "Ein Schaffner ist vorbeigegangen. Lina hat gefragt: „{wie-spaet-ist-es}“",
    "Er hat nur gesagt: „Zu spät, schon {laengst}.“",
    "Ich habe gefragt: „{um-wie-viel-uhr}“ Er hat nicht geantwortet.",
    "{damals} habe ich {irgendwie} gewusst: Lina geht {irgendwann}, {sobald} sie kann.",
  ] },
  { scene: 'r3-c8', lines: [
    "letzte Woche war ich noch bei Konrad. Es fühlt sich an wie ein Jahr.",
    "{vorhin} hat Lina gesagt: „{diesmal} gehe ich {definitiv}.“",
    "Ich habe gefragt, ob sie {jemals} zurückkommt. Sie hat nicht geantwortet.",
    "{vermutlich} hat sie es selbst nicht gewusst.",
  ] },
  { scene: 'r3-d1', lines: [
    "draußen ist Regen gefallen, dann {schnee}. Es waren null {grad}.",
    "Wir haben in einem leeren Hotel geschlafen. Lina hat ein {feuer} gemacht.",
    "Eine Katze ist zu uns gekommen. Das Tier hat sich auf mein Gepäck gelegt.",
    "{obwohl} es kalt war, habe ich gut geschlafen.",
  ] },
  { scene: 'r3-d2', lines: [
    "Am Morgen hat es geregnet. Der {himmel} war grau.",
    "Lina hat aus dem Fenster gesehen. Ihr Blick war weit weg.",
    "Sie hat gesagt: „Meine Mutter wollte immer eine Reise machen, durch die ganze {welt}, bis nach {china}.“",
    "Unten hat ein {hund} unter einem Baum gesessen. Er hat nicht gebellt.",
  ] },
  { scene: 'r3-d3', lines: [
    "Dann ist das Wetter plötzlich warm geworden. Die {sonne} hat geschienen, mitten im Winter.",
    "Die Luft hat nach Sommer gerochen, wie im Urlaub.",
    "Wir sind zum {fluss} gegangen. Das Wasser war {tief} und still.",
    "Ich wollte {aufgeben}. Lina hat meine Hand genommen.",
  ] },
  { scene: 'r3-d4', lines: [
    "In der Nacht habe ich starke {schmerz:Schmerzen} im Kopf gehabt.",
    "Lina hat in einer leeren {apotheke} ein {medikament} gesucht.",
    "Mein {gesicht} war heiß. Ich war sehr {muede}.",
    "Lina hat gesagt: „Du brauchst {hilfe}.“ Ich hatte keine {kraft} mehr zu antworten.",
  ] },
  { scene: 'r3-d5', lines: [
    "Ein {krankenwagen} ist gekommen, ohne Fahrer. Lina hat mich hineingesetzt.",
    "Im Krankenhaus hat ein {arzt} meine {hand} gehalten. Ich hatte hohes {fieber}.",
    "Er hat mir ins {auge} geschaut und gesagt: „Sie sind nicht {verletzt}. Sie vergessen nur.“",
    "Dann hat er gesagt: „{gute-besserung}“ Seine Stimme hat wie Konrads geklungen.",
  ] },
  { scene: 'r3-d6', lines: [
    "Ich habe drei Tage im {krankenhaus} gelegen.",
    "Ich war nicht {krank}. Nur in meinem {kopf} war es leer.",
    "Ich habe eine {tablette} bekommen. Mein {herz} hat ruhiger geschlagen.",
    "Ich konnte mich kaum {bewegen}. Lina hat mich nicht besucht.",
  ] },
  { scene: 'r3-d7', lines: [
    "Auf dem Tisch lag ein {bericht} der {regierung}: „Die Stille hat keine {opfer}.“",
    "Ich habe gelacht. Wer hat das geschrieben?",
    "Eine alte Frau im Bett neben mir hat zu {gott} gebetet. Ihr {glaube} war stark.",
    "Sie hat mir eine {geschichte} erzählt: Ein {koenig} hat seinen Namen verkauft, für einen Zug nach Hause.",
  ] },
  { scene: 'r3-e1', lines: [
    "Ich bin aus dem Krankenhaus gegangen. Am Bahnhof habe ich Lina gefunden.",
    "Sie hat von ihrer {kindheit} erzählt. Sie ist hier {geboren} und {aufwachsen:aufgewachsen}.",
    "Sie hatte keine {geschwister}. Ihr {wohnort} war die Bäckerei, ihr Spielplatz der Bahnhof.",
    "„Jetzt bin ich {erwachsen}“, hat sie gesagt. „Das ist kein Abschied, nur ein Auf {wiedersehen}.“",
  ] },
  { scene: 'r3-e2', lines: [
    "Lina war früher {studentin}. Ihren {abschluss} hat sie nie gemacht.",
    "Ihr {grossvater} war Schaffner. Die Familie {stammen:stammt} aus dem Norden, glaubt sie.",
    "Auf ihrer Fahrkarte standen ihr {geburtsdatum} und ein halber {nachname}.",
    "Sie hat sich nicht verabschiedet, nicht einmal von Konrad. Das war mir {vollkommen} klar.",
  ] },
  { scene: 'r3-e3', lines: [
    "Lina hat von ihrem {papa} erzählt. Konrad hat sie jeden Morgen mit warmem Brot {empfangen}.",
    "Ihre {grossmutter} war Französin. Ein {cousin} wohnt noch im Süden.",
    "Wir sind nicht {verwandt}, aber sie hat gesagt: „Du bist wie Familie.“",
    "Ihr {geburtsort} ist ein leeres Feld auf der Karte. Jetzt war sie eine {erwachsene} ohne Heimat.",
  ] },
  { scene: 'r3-e4', lines: [
    "Der Fahrplan hat wieder geflüstert: „Noch {exakt} ein Zug. {dreimal} hat er nicht gehalten.“",
    "Lina hat gerechnet: Die Stadt ist zu neunzig {prozent} leer.",
    "Bis nach Hause waren es zwölf {kilometer}. Ich habe es auf meine Hand geschrieben.",
    "Sie hat mir ihre {telefonnummer} gegeben. Die {vierte-num} Zahl war schon weg.",
  ] },
  { scene: 'r3-e5', lines: [
    "Ich habe die Tage {zweimal} gezählt. Es waren {zwanzig-num}.",
    "Lina hatte nur noch {fuenfzig-num} Cent und ein {kilo} Brot von Konrad.",
    "Sie hat {rechnen:gerechnet}: „Die Fahrt hat früher drei Euro {betragen}.“",
    "Ich habe gesagt: „Ich zahle {doppelt}, wenn du bleibst.“ Sie hat gelächelt.",
  ] },
  { scene: 'r3-e6', lines: [
    "In der {dritte-num:dritten} Nacht hat Lina die Zeit bis Mitternacht {ausrechnen:ausgerechnet}.",
    "Es waren {fuenfzehn-num} Minuten. Dann {elf-num}. Dann keine.",
    "Ich habe ihr einen {liter} Tee gemacht. Sie hat {maximal} einen Schluck genommen.",
    "Am Gleis haben {dreissig-num} Schatten gewartet. Vielleicht ein {dutzend} mehr.",
  ] },
  { scene: 'r3-e7', lines: [
    "Lina hat auf die andere Seite gezeigt. drüben hat ein Licht gebrannt.",
    "Wir sind rüber gegangen. Der Kiosk dort war offen, und alles war {gratis}.",
    "Ich habe gefragt: „{wonach} suchst du eigentlich?“",
    "Sie hat gesagt: „{worum} es geht? Um einen Namen. Er ist {woanders}.“",
  ] },
  { scene: 'r3-e8', lines: [
    "Ich bin auf der Bank eingeschlafen. {drueben} am Gleis hat ein Licht gebrannt.",
    "Am Morgen war Lina weg. Ich weiß nicht, {woran} ich es gemerkt habe. Die Stille war anders.",
    "Ich bin {rueber} zum Gleis gelaufen. Unter der Bank lag ihre Fahrkarte. Ich lese nur: „Miet…“.",
    "Ich bin nicht {vorwaerts} gegangen.",
    "Ich bin nach Hause gegangen. Ich habe ihre Fahrkarte noch.",
  ] },
];

/** 6000 词导入: each page goes to the new scene holding most of its blank words (sceneByWords); blanks of words that
 *  are not in that scene's group become plain text. Pages left with too few blanks are kept back until they are
 *  rewritten for the new scenes (fewer than 2 blanks). Story order (page numbers) stays the written order. */
export const DIARY: DiaryPage[] = (() => {
  const ids = (p: DiaryPage) => p.lines.flatMap((l) => [...l.matchAll(/\{([a-z0-9-]+)(?::[^}]+)?\}/g)].map((m) => m[1]));
  const to = sceneByWords(WRITTEN.map((p) => ({ key: p.scene, ids: ids(p) })));
  const out: DiaryPage[] = [];
  for (const p of WRITTEN) {
    const scene = to.get(p.scene);
    if (!scene) continue;
    const group = new Set(SCENE_WORDS[scene] ?? []);
    const lines = p.lines.map((l) => l.replace(/\{([a-z0-9-]+)(?::([^}]+))?\}/g, (m, id: string, form?: string) => (group.has(id) ? m : form ?? WORD_BY_ID[id]?.de ?? id)));
    const page = { scene, lines };
    if (ids(page).length >= 2) out.push(page);
  }
  return out;
})();

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
