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

/** The pages as written for the 640-word scenes (old scene ids); DIARY below moves them to the 6000-word scenes. */
const WRITTEN: DiaryPage[] = [
  // ---- Region 1 · 最后的营地: notes against forgetting, ending at „Wie heiße ich?“ ----
  { scene: 'r1-e1', lines: [
    'Seit dieser Nacht ist die Stadt still. Ich schreibe alles auf, sonst vergesse ich es.',
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
    'Im Hof übe ich Wörter mit dem neuen Nachbarn. Er kommt von weit her.',
    'Am Morgen sage ich: „Guten Morgen!“',
    'Am Mittag sage ich „Guten Tag“, am Abend „Guten Abend“.',
    'Die Kinder rufen nur „{hallo}“ und „{tschuess}“.',
    'Zu der alten Frau unten sage ich „Auf Wiedersehen“.',
    'Und vor dem Bett sage ich zu mir: „Gute Nacht.“',
  ] },
  { scene: 'r1-e6', lines: [
    'Im Flur treffe ich einen Mann.',
    '„{entschuldigung}, wohnen Sie hier?“, frage ich.',
    'Er sagt: „Ja. Freut mich!“',
    'Ich trage seinen Koffer. Er sagt: „Vielen Dank!“',
    '„{gern}“, sage ich, „Kein Problem.“',
    '„{danke}“, sagt er noch einmal. Seinen Namen sagt er nicht.',
  ] },
  { scene: 'r1-e7', lines: [
    'Auf dem Dach ist es ruhig.',
    'Eine Stimme fragt: „Wie geht’s?“',
    'Ich sage: „Ich weiß nicht.“',
    '„Wie bitte?“, frage ich. Die Stimme sagt nichts.',
    '„Noch einmal, bitte!“, rufe ich.',
    'Dann höre ich: „{ja}. {nein}. Alles klar.“ Das ist nur mein Echo.',
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
    'wer {sein:bin} ich? {woher} {kommen:komme} ich?',
    '{wo} ist meine Familie?',
    '{wie} {heissen:heißt} der Mann im Flur?',
    'was {haben:habe} ich in der Tasche? Und wie viel Zeit?',
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
    'Ich weiß es nicht mehr. Ich weiß nur eins: Ich mag Briefe.',
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
    'Ich {fragen:frage} den Schreiber: „Können Sie das buchstabieren?“',
    'Er {antworten:antwortet} nicht.',
    'Ich {hoeren:höre} nur mein Herz. Es {sagen:sagt} einen Buchstaben: J. Dann nichts.',
  ] },
  { scene: 'r1-a1', lines: [
    'Das Haus hat {zwanzig-num} Briefkästen.',
    'Ich gehe sie alle durch: dreizehn, vierzehn, {fuenfzehn-num} …',
    'Nummer sechzehn ist leer. Nummer siebzehn auch.',
    'Auf Nummer achtzehn steht ein Name, aber er ist schwarz.',
    'Ich bin nicht neunzehn und nicht einundzwanzig. Ich bin älter.',
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
    'Ich bin vielleicht {dreissig-num}, vielleicht vierzig.',
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
    'Aber {morgen}? Wenn du das liest: Wie heiße ich?',
  ] },

  // ---- Region 2 · 面包集市: his shopping book; bread at Konrad's, his daughter Lina, the night she runs for the last train ----
  { scene: 'r2-g1', lines: [
    'Jeden Morgen kaufe ich bei Konrad Brot. Heute gehe ich mit seiner Tochter Lina auf den Markt.',
    'Lina kauft {obst}: einen {apfel}, eine {birne} und eine {banane}.',
    'Konrad nimmt eine {zitrone} und eine {orange}.',
    'Die {erdbeere:Erdbeeren} sind rot, die Kirschen auch.',
    'Lina isst eine Traube und lacht.',
  ] },
  { scene: 'r2-g5', lines: [
    'Konrad ist Bäcker. Er braucht {mehl}, {butter} und {milch}.',
    'Im Laden kauft er zehn {ei:Eier}.',
    'Lina möchte einen {joghurt} und ein Stück {kaese}.',
    'Am Sonntag backt Konrad einen {kuchen} mit {sahne}.',
    'Für mich hat er immer ein {broetchen} oder eine Brezel.',
  ] },
  { scene: 'r2-g2', lines: [
    'Am nächsten Stand gibt es {gemuese}.',
    'Lina will {kartoffel:Kartoffeln} und {tomate:Tomaten}.',
    'Konrad kauft eine {gurke}, eine {zwiebel} und Knoblauch.',
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
    'Ich nehme ein Mineralwasser. {wein} ist zu teuer.',
    'Lina möchte noch ein {eis} mit {schokolade}.',
    'Am Abend trinkt sie einen Kakao und schläft schnell ein.',
  ] },
  { scene: 'r2-g7', lines: [
    'Konrad braucht {zucker}, {salz} und {oel}.',
    'Lina probiert den {pfeffer}. Er ist sehr {scharf}.',
    'Zum Frühstück isst sie Müsli mit {honig}.',
    'Ich mag Marmelade. Sie ist {suess}.',
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
    'Im Portemonnaie sind zwanzig {euro} und fünfzig {cent}.',
    'Lina sucht Kleingeld für den Zug.',
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
    'Im Laden steht eine alte Waage.',
    'Konrad kauft ein {kilo} Mehl und ein {pfund} Butter.',
    'Lina nimmt einen {liter} Milch und einen {becher} Joghurt.',
    'Für die Reise kauft Lina eine {packung} Kekse und eine {dose} Cola.',
    'Ich trage alles in einer {tuete}. Nachts, sagt Lina, frisst die Waage Wörter.',
  ] },
  { scene: 'r2-w6', lines: [
    'Lina rechnet laut.',
    'Das Mehl kostet neunundneunzig Cent, die Milch fünfundvierzig Cent.',
    'Eine Fahrkarte kostet fünfundzwanzig Euro.',
    'Sie hat sechzig Euro, Konrad gibt ihr noch zweiunddreißig.',
    'Sie braucht nur eine Fahrkarte. „Das geht“, sagt sie.',
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
    'Die Verkäuferin gibt ihm ein {paket}.',
    'Der {verkaeufer} fragt Lina nach ihrer {groesse}. Sie braucht eine Jacke für die Reise.',
    'Nach dem {einkauf} gehen wir nach Hause.',
  ] },
  { scene: 'r2-w8', lines: [
    'Lina zeigt auf einen Koffer: „Was kostet das?“',
    'Der Mann sagt: „Vierzig Euro.“ Konrad sagt: „Das ist zu teuer.“',
    '„Geht das billiger?“, fragt Lina.',
    '„Für dich dreißig. Noch etwas?“ – „Nein, Das ist alles.“',
    'Konrad sagt: „Ich nehme das.“ Der Mann fragt: „Bar oder mit Karte?“',
  ] },
  { scene: 'r2-w4', lines: [
    'Vor dem Markt gibt es einen kleinen Laden.',
    'Konrad fragt: „Haben Sie Brot?“ Dann lacht er, denn er ist selbst Bäcker.',
    'Lina sagt: „Ich hätte gern ein Kilo Äpfel.“',
    '„Wo ist die Kasse?“, frage ich. „Kann ich mit Karte zahlen?“',
    '„Gibt es einen Rabatt?“, fragt Konrad. Die Frau lacht nur. Dann ruft er: „Zahlen, bitte!“',
    'Die Frau sagt: „Nur bar.“ Konrad gibt ihr zehn Euro: „Stimmt so.“',
  ] },
  { scene: 'r2-k1', lines: [
    'Lina {brauchen:braucht} Essen für ihre Reise.',
    'Sie {kaufen:kauft} Brot bei ihrem Vater. Es {kosten:kostet} nichts.',
    'Dann {nehmen:nimmt} sie zwei Äpfel und {bezahlen:bezahlt}.',
    'Am Abend {essen} wir zusammen Brot und {trinken} Tee.',
    'Konrad {geben:gibt} mir sein letztes Brötchen. „Für dich“, sagt er.',
  ] },
  { scene: 'r2-k5', lines: [
    'In Konrads Küche steht viel {geschirr}.',
    'Lina packt einen {teller}, eine {gabel} und ein {messer} ein.',
    'Sie nimmt auch ihren {loeffel} und eine kleine {schuessel}.',
    'Die alte Kanne bleibt hier.',
    'Eine Serviette liegt auf dem Tisch. Darauf steht: „Bis bald.“',
  ] },
  { scene: 'r2-k2', lines: [
    'Unter der Mühle essen wir {fruehstueck}.',
    'Konrad trägt einen {sack} mit {korn}.',
    'Zum {mittagessen} gibt es nur Brot.',
    'Lina hat {hunger} und {durst}, aber sie sagt nichts.',
    'Das {abendessen} esse ich bald im Zug, sagt Lina.',
  ] },
  { scene: 'r2-k3', lines: [
    'In der Mühle {suchen:suche} ich meinen Namen.',
    'Ich {finden:finde} nur Mehl.',
    'Konrad {kochen:kocht} Tee. Er {schmecken:schmeckt} gut.',
    'Lina {helfen:hilft} ihm. Sie {moegen:mag} ihren Vater sehr.',
    'Ich {sehen:sehe} die zwei und weiß: Lina geht bald weg.',
  ] },
  { scene: 'r2-k6', lines: [
    'Die {kueche} in der Bäckerei ist kalt.',
    'Der {ofen} ist aus. Auf dem {herd} steht ein leerer {topf}.',
    'Der {kuehlschrank} ist leer, die {pfanne} auch.',
    'Konrad schreibt Lina sein {rezept} für Brot auf.',
    '„Für die Reise“, sagt er. Lina lacht nicht.',
  ] },
  { scene: 'r2-k7', lines: [
    'Am letzten Abend gehen wir in ein {restaurant}.',
    'Die Kellnerin bringt die {speisekarte}.',
    'Als Vorspeise essen wir Suppe, als Hauptgericht eine {pizza}.',
    'Lina möchte einen Nachtisch. Konrad bestellt ein {getraenk}.',
    'Der {kellner} fragt Lina: „Wohin fahren Sie?“ Sie sagt: „Weit weg.“',
  ] },
  { scene: 'r2-k4', lines: [
    'In dieser Nacht {wiegen:wiegt} Konrad noch Mehl und {backen:backt} Brot.',
    'Dann ist alles still. Ich {zaehlen:zähle} die Wörter, ich weiß nur noch wenige.',
    'Lina {tragen:trägt} ihren Koffer. „{vergessen:Vergiss} mich nicht, Papa“, sagt sie.',
    'Konrad {waschen:wäscht} weiter die Teller. Er sieht sie nicht mehr.',
    'Lina geht zum Bahnhof. Ich gehe auch.',
  ] },
  // ---- Region 3 · 铁轨镇: the night he followed Lina to the rails (Perfekt), ending with her ticket ----
  { scene: 'r3-b1', lines: [
    'Montag, sehr spät. Ich bin Lina über die Brücke nach Gleisdorf gefolgt.',
    'Am {schalter} war niemand. Auch die {auskunft} war dunkel.',
    'Ich habe am {automat:Automaten} eine {fahrkarte} gekauft: {einfach}, nicht hin und zurück, zweite {klasse}.',
    'Aber der Automat hat den Namen der Station gefressen. Auf meinem {ticket} steht nur: ▒▒▒.',
    'Wohin geht diese Fahrt?',
  ] },
  { scene: 'r3-b2', lines: [
    'An der {haltestelle} habe ich lange {warten:gewartet}.',
    'Dann ist ein {bus} gekommen, die {linie} ohne Nummer.',
    'Der {fahrer} hat kein Wort gesagt. Eine Fahrerin war auch da, aber sie hatte kein Gesicht.',
    'Der Bus hat nicht {halten:gehalten}. Er ist in die falsche {richtung} gefahren, bis zur Endstation.',
    'Ich bin an der nächsten Ecke ausgestiegen.',
  ] },
  { scene: 'r3-b3', lines: [
    'Ich bin zum {bahnhof} gelaufen.',
    'Die {strassenbahn} ist leer vorbeigefahren, sehr {langsam}. Kein Mensch war im {wagen}.',
    'Unten hat die {u-bahn} geschrien. Die {s-bahn} ist nicht gekommen.',
    'An jeder {station} habe ich gefragt: Wann fährt der letzte {zug}?',
    'Lina war {schnell}. Sie war schon bei der {bahn}.',
  ] },
  { scene: 'r3-b4', lines: [
    'Vor dem Bahnhof ist ein {parkplatz}. Dort stehen ein {auto}, ein {taxi} und ein {motorrad}.',
    'Niemand hat dort {parken:geparkt}. Die Autos sind einfach stehen geblieben.',
    'Ich habe keinen {fuehrerschein}. Mein altes {fahrrad} ist kaputt.',
    'An der {tankstelle} brennt noch Licht.',
    'Also bin ich zu Fuß gegangen.',
  ] },
  { scene: 'r3-b5', lines: [
    'Am {eingang} habe ich Linas Koffer gefunden. Er war {schwer}, ich habe ihn kaum getragen.',
    'Ihr {rucksack} war {leicht}. Ich habe beides zum Schließfach {bringen:gebracht}.',
    'Alle Fächer waren {voll}, nur Nummer 13 war leer.',
    'Ich will das {gepaeck} morgen {abholen}.',
    'Am {ausgang} hat jemand meinen Namen gerufen. Ich habe ihn nicht verstanden.',
  ] },
  { scene: 'r3-b6', lines: [
    'Auf dem Platz steht ein {hotel}. Ein {tourist} und eine Touristin haben auf der Treppe gesessen.',
    'Sie haben von einer {reise} ins {ausland} erzählt, vom {urlaub} am Meer.',
    'Sie wollten zum {flughafen} und mit dem {flugzeug} {fliegen}.',
    'Aber kein Bus ist gekommen. Wer will jetzt noch {reisen}?',
  ] },
  { scene: 'r3-b7', lines: [
    'Im Tunnel unter den Gleisen hängen zwei Tafeln: {abfahrt} und {ankunft}.',
    'Ich bin die Treppe hinunter {fahren:gefahren}, dann wieder hinauf.',
    'Hier muss man {umsteigen}, steht da. Hier {einsteigen}, dort {aussteigen}.',
    'Die Züge sind nie {abfahren:abgefahren} und nie {ankommen:angekommen}.',
    'Ich habe nur Linas Schal {mitnehmen:mitgenommen}. Er lag auf der Treppe.',
  ] },
  { scene: 'r3-b8', lines: [
    'Am {gleis} 3 steht ein {schild}: „{achtung}! Betreten verboten!“',
    '„{vorsicht}, {gefaehrlich}!“ Aber auf dem {bahnsteig} war niemand.',
    'Dann ist es {laut} geworden, wie ein Zug. Aber kein Zug ist gekommen.',
    'Danach war alles {leise}. Unter der {bruecke} hat etwas gewartet.',
  ] },
  { scene: 'r3-a1', lines: [
    'Ich habe den Weg zur Altstadt gesucht und eine Frau gefragt.',
    '„Gehen Sie {geradeaus} bis zur {ampel}, dann {links}. An der {kreuzung} {rechts}.“',
    'Ich bin an der {ecke} abgebogen. Aber dann war ich wieder am Anfang.',
    'Auf jeder {seite} der Straße stehen die gleichen Häuser.',
    'Ich bin {zurueck} zum Bahnhof gegangen.',
  ] },
  { scene: 'r3-a2', lines: [
    'Am Brückenkopf hat ein Kiosk gegenüber dem Turm gestanden.',
    'Die Zeitung lag auf dem Tisch, die Katze unter dem Tisch.',
    'Eine Lampe hat über der Tür gehangen, ein Bild an der Wand.',
    'Ich habe vor dem Kiosk gewartet, dann hinter dem Kiosk.',
    'Lina war nicht neben mir, nicht zwischen den Leuten, nicht in der Stadt.',
  ] },
  { scene: 'r3-a3', lines: [
    'Die {altstadt} ist sehr alt. In der {mitte} steht eine {kirche} mit einem hohen {turm}.',
    'Am {platz} sind ein {museum}, ein {theater} und ein {kino}.',
    'Früher haben Touristen hier alles besichtigt.',
    'Jetzt ist das {zentrum} leer. Die Uhr am Turm hat um 23:59 gestoppt.',
  ] },
  { scene: 'r3-a4', lines: [
    'Im {rathaus} habe ich gefragt: Wo ist das {amt} für Namen?',
    'Das {buero} ist im dritten {stock}, hat der Mann im {erdgeschoss} gesagt.',
    'Der {aufzug} ist nicht gefahren. Ich bin nach {oben} gelaufen.',
    'Oben war nur ein Zettel: „{termin} morgen.“ Ich bin wieder nach {unten} gegangen.',
    'Die {polizei} war auch nicht da.',
  ] },
  { scene: 'r3-a5', lines: [
    'In der Straße sind eine {apotheke} und eine {drogerie}.',
    'Ich habe eine {tablette} gegen Kopfweh gekauft. Das {medikament} hat nicht geholfen.',
    'Im {cafe} war der Kaffee noch warm, aber niemand war da.',
    'Beim {friseur}, im Kaufhaus, in der Buchhandlung: überall leere Stühle.',
    'Die Leute sind nicht weggegangen. Sie haben nur ihre Namen verloren.',
  ] },
  { scene: 'r3-a6', lines: [
    'An der Kreuzung ist ein {unfall} passiert. Ich habe um {hilfe} gerufen.',
    'Ich habe den {notruf} gewählt, aber das {telefon} hat nur gerauscht.',
    'Im {krankenhaus} war es still. Die {praxis} daneben hatte keine {sprechstunde}.',
    'Mein Knie hat {wehtun:wehgetan}. Niemand hat mich {anrufen:angerufen}.',
    'Ich sage mir selbst: Gute Besserung, Jonas.',
  ] },
  { scene: 'r3-a7', lines: [
    'Ich bin durch den {park} spazieren gegangen, um ruhig zu werden.',
    'Am {see} habe ich auf einer Bank {sitzen:gesessen}.',
    'Jede {blume} und jeder {baum} war grau. Der {fluss} war schwarz.',
    'Auf dem {spielplatz} und im {garten} haben keine Kinder gespielt.',
    'Ein Kinderschuh hat im Sand {liegen:gelegen}.',
  ] },
  { scene: 'r3-a8', lines: [
    'Die {post} ist {nah} am Bahnhof, die {bank} daneben.',
    'Ich habe Konrad einen {brief} geschrieben und eine {postkarte}.',
    'Ich habe eine {briefmarke} gekauft und alles {schicken:geschickt}.',
    'Der {geldautomat} hat mein Geld behalten.',
    'Der {weg} nach Hause ist {weit}. Ich gehe noch nicht.',
  ] },
  { scene: 'r3-f1', lines: [
    'In der großen Halle hängt eine Uhr. Ich habe gefragt: „Wie spät ist es??“',
    'Die Uhr hat geantwortet: „{halb} zwölf. Nein, {viertel} vor zwölf. Nein …“',
    'Jede {minute} war eine {stunde}. Jede {sekunde} hat {lange} gedauert.',
    '„Um wie viel Uhr? fährt der letzte Zug?“ Die {uhrzeit} hat sich nie bewegt.',
    'Nur einmal, ganz {kurz}, hat der Zeiger gezittert.',
  ] },
  { scene: 'r3-f2', lines: [
    'Am {fahrplan} an der Wand flüstern die Zeilen.',
    '„{jetzt}“, sagt die erste. „{gleich}“, sagt die zweite. „{bald}“, sagt die dritte.',
    'Kein Zug ist {puenktlich}. Jeder Zug hat {verspaetung}.',
    'Ich bin {frueh} gekommen, jetzt ist es {spaet}. Ich habe keine {zeit} mehr.',
    'Komm {sofort}, Lina!',
  ] },
  { scene: 'r3-f3', lines: [
    'Im Wartesaal hängen Bilder von einem ganzen Tag.',
    'Am Morgen kommt die Sonne, am {vormittag} die Arbeit, am {mittag} die Suppe.',
    'Am {nachmittag} Kaffee, am {abend} Brot, in der {nacht} der Schlaf.',
    'morgens, mittags, abends, {nachts}: ich habe auf dieser Bank gewartet.',
    'Die Bilder haben sich nicht bewegt.',
  ] },
  { scene: 'r3-f4', lines: [
    'Am Gleis 1 steht auf jedem Schild ein anderer Tag.',
    '{montag}, {dienstag}, {mittwoch}, {donnerstag}, {freitag}.',
    'Am {samstag} hat Konrad immer Kuchen gebacken. Am {sonntag} war die Bäckerei zu.',
    'Am {wochenende} haben wir zusammen gefrühstückt, Konrad, Lina und ich.',
    'Welcher Tag ist heute? Das weiß hier niemand mehr.',
  ] },
  { scene: 'r3-f5', lines: [
    'vorgestern war alles normal. {gestern} ist es {passieren:passiert}.',
    'letzte Woche hat Lina noch gelacht. letztes Jahr hat sie die Bäckerei gestrichen.',
    '{frueher} war sie nie zu spät. Ich habe sie {vorhin} auf Gleis 2 gesehen.',
    'Hat sie den Zug {verpassen:verpasst}? Ist sie {schon} weg? Ich weiß es noch nicht.',
  ] },
  { scene: 'r3-f6', lines: [
    'Im Speisewagen habe ich eine Kontrolleurin {treffen:getroffen}.',
    'Sie hat Linas Schürze getragen, mit Mehl auf der Tasche.',
    'Ich habe ihr {erzaehlen:erzählt}: Wir haben zusammen {feiern:gefeiert}, {spielen:gespielt} und {lachen:gelacht}.',
    'Du hast mich {besuchen:besucht}. Du hast mich zum Kaffee {einladen:eingeladen}.',
    'Sie hat mich nur angesehen. Wir haben uns nie {kennenlernen:kennengelernt}, sagt ihr Gesicht. Sie weiß ihren Namen nicht.',
  ] },
  { scene: 'r3-f7', lines: [
    'Das {fundbuero} hat um Mitternacht {oeffnen:geöffnet}.',
    'Dort liegen viele {regenschirm:Regenschirme} und eine kleine {sache} mit Mehl darauf.',
    'Der Mann hat mir eine Tasche {zeigen:gezeigt}. „Hat sie Ihnen {gehoeren:gehört}?“',
    '„Nein“, habe ich gesagt, „Lina hat sie {verlieren:verloren}.“ Ich habe sie trotzdem {holen:geholt}.',
    'Dann hat er das Fenster {schliessen:geschlossen}.',
  ] },
  { scene: 'r3-f8', lines: [
    'Ich bin zum letzten Gleis {laufen:gelaufen}, dann {rennen:gerannt}. Der Zug ist nicht gekommen.',
    'Ich bin auf der Bank {einschlafen:eingeschlafen} und später {aufwachen:aufgewacht}. Lina war {weggehen:weggegangen}. Sie ist nicht {zurueckkommen:zurückgekommen}.',
    'Unter der Bank lag ihre Fahrkarte. Das Ziel ist halb gefressen, ich lese nur: „Miet…“.',
    'Danach habe ich nicht mehr {schlafen:geschlafen}. Ich bin {aufstehen:aufgestanden} und nicht {bleiben:geblieben}.',
    'Ich bin nach Hause gegangen. Ich habe ihre Fahrkarte noch.',
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
