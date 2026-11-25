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

/** One page per scene of regions 1–3 (6000-word scenes, 2026-11-25). */
const WRITTEN: DiaryPage[] = [
  // ---- Region 1 · 回声巷: notes against forgetting, ending at „Wie heiße ich?“ ----
  { scene: 'r1-a1', lines: [
    "Heute {umziehen:ziehst} du in die Echogasse 7 um. Dein {zimmer} liegt {gegenueber} von meinem.",
    "Ein Mann {liefern:liefert} dein Bett. Es ist zu groß für die Tür. Das ist ein {problem}.",
    "Bei mir hängt eine alte {uhr}. Sie ist von meinen {eltern}.",
    "Unten wohnt eine Frau mit einem {baby}. Es weint die ganze Nacht.",
  ] },
  { scene: 'r1-a2', lines: [
    "Deine {wohnung} ist {zwar} klein, aber hell. Das Bett {passen:passt} jetzt doch.",
    "Der Mann vom Umzug ist an der Hand {verletzt}. Ich gebe ihm ein Pflaster.",
    "Du {nennen:nennst} mir deinen Namen. Ich vergesse ihn sofort.",
    "Am Abend {schliessen:schließe} ich meine Tür zweimal ab. Ich weiß nicht, warum.",
  ] },
  { scene: 'r1-a3', lines: [
    "{gestern} war ich bei dir. Das Licht im {bad} {funktionieren:funktioniert} nicht.",
    "Ein alter {herr} von oben sagt: „Hier ist alles alt, Kinder.“",
    "Du hast keine {milch} für den Kaffee. Ich bringe dir welche, ich habe {genug}.",
    "Es ist {endlich} ruhig im Haus. Ich {hoffen:hoffe}, das bleibt so.",
  ] },
  { scene: 'r1-a4', lines: [
    "Am {wochenende} lese ich die {zeitung}. In der {mitte} ist ein Rätsel.",
    "Du schreibst mir deine {adresse} auf eine {karte}. Gut, falls ich sie vergesse.",
    "Die Frau unten hat eine {tochter}. Das Mädchen {lachen:lacht} viel.",
    "Sie spielt oft im Flur und will nie {raus}.",
  ] },
  { scene: 'r1-a5', lines: [
    "Ich habe {hunger}. Im Kühlschrank liegt nur ein {ei}.",
    "Im Laden {steigen:steigt} jeder {preis}. Die Tasche ist leicht, aber das Leben ist {schwer}.",
    "Heute {erhalten:erhalte} ich einen Brief vom Amt. Mein {antrag} ist nicht da, sagen sie.",
    "Etwas {fehlen:fehlt}. Ich weiß nur nicht, was.",
  ] },
  { scene: 'r1-a6', lines: [
    "Die {u-bahn} kommt heute nicht. Ich gehe zu Fuß, es ist {ziemlich} weit.",
    "Im Radio {erfahren:erfahre} ich: Kein {flug} geht mehr. {sogar} die Züge stehen.",
    "Das ist nicht {schlimm}, sage ich mir. {fast} glaube ich es.",
    "Am {naechst:nächsten} Tag ist alles wie immer. Oder nicht?",
  ] },
  { scene: 'r1-a7', lines: [
    "Ich gehe in die {bibliothek}. Im großen {raum} sitzt niemand.",
    "Am {telefon} höre ich eine {stimme}, aber sie sagt nichts.",
    "Auf dem {parkplatz} vor dem {amt} steht ein Auto mit offener Tür.",
    "Im {restaurant} {links} liegt eine {wurst} auf dem Teller. Sie ist noch {frisch}.",
    "Wo sind die Leute? Ist das ein {fehler}?",
  ] },
  { scene: 'r1-b1', lines: [
    "Du klingelst bei mir. Du sagst etwas, und ich sage: „{wie-bitte}“",
    "Du {lernen:lernst} Deutsch. Du warst an einer {universitaet} in deinem Land.",
    "Ich sage: „Ich helfe dir.“ Du sagst: „{kein-problem}“ und lachst.",
    "Dein {gesicht} kenne ich {doch}. Oder {leider} nicht?",
    "Seit der {letzt:letzten} Nacht ist nichts mehr {normal}.",
  ] },
  { scene: 'r1-b2', lines: [
    "Heute Nacht ist es {ganz} still. {niemand} ist auf der Straße.",
    "Die {tuer} unten steht {offen}. Ein {mann} in einem schwarzen {mantel} geht vorbei.",
    "Ein {kind} fragt mich: „Wo ist meine Mama?“ Ich sage: „{ich-weiss-nicht}“",
    "Ich habe {angst}, {sehr} sogar.",
  ] },
  { scene: 'r1-b3', lines: [
    "Am {abend} kochst du für uns {nudel:Nudeln} mit {fleisch}.",
    "Du {erzaehlen:erzählst} von deiner {familie}. Ich bin {interessiert}, aber ich verstehe wenig.",
    "Ich sage: „{noch-einmal-bitte}“ Du sprichst langsam.",
    "Dann sagst du deinen {name:Namen}. Ich sage: „{freut-mich}“",
    "Am nächsten Morgen weiß ich ihn nicht mehr. {wirklich} nicht.",
  ] },
  { scene: 'r1-b4', lines: [
    "Ich will meine Schwester {anrufen}. Das Telefon ist tot.",
    "Im {supermarkt} {neben} dem {bahnhof} ist niemand. Die Kassen sind offen.",
    "Ein {hund} sitzt vor der Tür. In meiner {tasche} ist Brot, ich gebe es ihm.",
    "Du sprichst von deiner {heimat}. Ein {flugzeug} fliegt dahin. Fliegt es noch?",
  ] },
  { scene: 'r1-b5', lines: [
    "Ich gehe zur {polizei}. Ich habe eine {frage}: Wo sind die Leute?",
    "Der Polizist schreibt nichts auf. Er sagt nur: „Kein {fall}.“",
    "Auch die {post} ist zu. Ein Brief liegt im {muell:Müll}.",
    "Zu Hause esse ich einen {apfel} mit dem {messer}. Ich bin {gesund}. Ich bin {sicher}.",
    "Das ist erst der {anfang}, glaube ich.",
  ] },
  { scene: 'r1-b6', lines: [
    "Heute {kriegen:kriege} ich einen {brief}. Das Papier ist {schwarz}, nur die Adresse ist weiß.",
    "Ich {meinen:meine}, das ist ein Witz. Aber ich lache nicht.",
    "Dein {gepaeck} steht {bereits} an der Tür. Willst du weg?",
    "Ich {wuenschen:wünsche} dir Glück. Ich hoffe, du {schaffen:schaffst} es.",
  ] },
  { scene: 'r1-b7', lines: [
    "Du bleibst. {natuerlich} bleibst du.",
    "Ich frage {oft}: „Wie {heissen:heißt} du?“ Du sagst es, und ich {verlieren:verliere} es wieder.",
    "Es tut mir {leid}. Du lachst, es ist dir {gar} nicht wichtig.",
    "Du kommst aus einem kleinen {dorf}. Dort ist es {warm}, sagst du.",
    "Du {lieben:liebst} {kaese:Käse}. Ich schreibe es auf.",
    "Beim Gehen sagst du: „{tschuess}!“",
  ] },
  { scene: 'r1-b8', lines: [
    "Das {wetter} ist grau. Ich {waschen:wasche} meine {kleidung} mit der Hand.",
    "Die {apotheke} ist leer. Ich nehme Tabletten und lege Geld hin.",
    "Beim {zahnarzt} brennt Licht, aber niemand ist da.",
    "Ich rufe um {hilfe}. Nur mein Echo antwortet. Das {gefallen:gefällt} mir nicht.",
  ] },
  { scene: 'r1-c1', lines: [
    "Wir gehen {zusammen} auf die {strasse}. Am {stand} an der Ecke {verkaufen:verkauft} niemand mehr.",
    "Du trägst meine alte {jacke}. Sie ist zu groß, {aber} warm.",
    "Du gibst mir einen {schluessel} zu deiner Wohnung. „Für den Notfall“, sagst du.",
    "Ich {denken:denke} lange {darueber} nach.",
    "Ich will das Haus nicht mehr allein {verlassen}.",
  ] },
  { scene: 'r1-c2', lines: [
    "Heute fällt {schnee}. Wir machen ein {feuer} im Hof.",
    "Du backst einen {kuchen} mit viel {butter}. Ich {moegen:mag} ihn sehr.",
    "Wir {reden} lange. Du sprichst schon gut {deutsch:Deutsch}.",
    "Ich {glauben:glaube}, du hast recht. Das {stimmen:stimmt}.",
    "In meinem {kopf} ist es leer.",
  ] },
  { scene: 'r1-c3', lines: [
    "Der {bus} fährt wieder, nur {kurz} und ohne Fahrer.",
    "Die {leute} sitzen still und {schauen} aus dem Fenster.",
    "{manchmal} {einziehen:ziehen} neue Leute in unser Haus ein. Sie bleiben nicht.",
    "Du bist mein {freund}. Ich halte deine Hand {fest}.",
    "Ein Schild ist {rot}, die Schrift ist {halb} weg.",
  ] },
  { scene: 'r1-c4', lines: [
    "Ich {treffen:treffe} dich im Treppenhaus. Ich {kennen:kenne} dein Gesicht, aber nicht mehr deinen Namen.",
    "Ich {erinnern:erinnere} mich nicht. Ist das {falsch}?",
    "Wir trinken {tee} und essen {reis}. Das {dauern:dauert} lange.",
    "Ich schreibe dir eine {e-mail}. Sie kommt nicht an.",
    "{wann} ist das alles {fertig}?",
  ] },
  { scene: 'r1-c5', lines: [
    "Am {freitag} zähle ich die Leute im Haus. Es sind nur noch {drei-num}.",
    "Du und ich, das sind {zwei-num}. Und die Frau mit dem Baby.",
    "Mein {bruder} {wohnen:wohnt} in einer anderen Stadt. Ich höre {niemals} etwas von ihm.",
    "Im {geschaeft} unten frage ich: „{wie-viel} kostet die {decke}?“ Niemand antwortet.",
  ] },
  { scene: 'r1-c6', lines: [
    "Ich zahle meine {miete}, aber niemand nimmt das Geld.",
    "Ich habe ein komisches {gefuehl}. {deshalb} koche ich nicht mehr allein.",
    "Wir kochen {gemeinsam} auf meinem {herd} und trinken {saft}.",
    "Danach sehen wir einen alten {film} über ein {schiff}. Er hat keinen Ton.",
    "In der {ecke} wartet etwas. Ich weiß keine {antwort}.",
  ] },
  { scene: 'r1-d1', lines: [
    "Heute verschwindet das erste {wort}. Ich {sagen:sage} „{kuehlschrank}“, aber ich höre nichts.",
    "Ich {versuchen:versuche} es noch einmal, {schnell} und laut.",
    "Mein {nachbar} – das bist du – fragt, {ob} alles gut ist.",
    "Ich {halten:halte} einen {schuh} in der Hand und weiß nicht, wofür.",
    "Ich {machen:mache} eine Liste. Ich {lassen:lasse} kein Wort mehr gehen.",
  ] },
  { scene: 'r1-d2', lines: [
    "Ich {suchen:suche} ein {foto} von meiner Familie. Ich {haben:habe} es nicht mehr.",
    "Ein {maedchen} im Hof sagt: „Ich {wollen:will} {zurueck} nach Hause.“",
    "Ich {nehmen:nehme} sie mit und {bringen:bringe} sie zu ihrer Mutter.",
    "Die Straße zum {flughafen} ist {frei}. Niemand fährt.",
  ] },
  { scene: 'r1-d3', lines: [
    "Auf dem {markt} {finden:finde} ich Äpfel. Ich lege einen {euro} hin.",
    "Ein alter Mann sucht seinen {sohn}. Er weiß den Namen {nicht} mehr.",
    "Ich {verstehen:verstehe} das nicht. {warum} wir?",
    "{trotzdem} ist der Himmel {schoen}. Die Wolken sind {hoch}.",
    "Ich {muessen:muss} das aufschreiben, {einmal} am Tag.",
  ] },
  { scene: 'r1-d4', lines: [
    "Du hast eine {idee}: Wir {stellen} Kerzen in jedes Fenster.",
    "Ich {warten:warte} am Fenster. Die Sonne {scheinen:scheint}, aber es wird nicht warm.",
    "Eine Flasche {wein} aus {frankreich} {liegen:liegt} im Keller. Wir trinken sie. Sie ist {lecker}.",
    "{wo} ist das {ende}? Ich {fragen:frage} niemanden mehr.",
  ] },
  { scene: 'r1-d5', lines: [
    "Am Morgen {stehen:steht} ein Fremder vor der Tür. Er sagt: „{hallo}.“",
    "Er {kommen:kommt} von {weit} her, aus einem anderen {land}.",
    "Er fragt: „{koennen:Können} Sie mir {helfen}?“ Ich will, aber er ist {sofort} {weg}.",
    "Ich {wissen:weiß} nicht mehr, wie man ohne Angst {leben} soll.",
  ] },
  { scene: 'r1-d6', lines: [
    "{hier} wohnen nur noch {vier-num} {mensch:Menschen}.",
    "Im {hotel} an der Ecke brennt kein Licht.",
    "Du {zeigen:zeigst} mir Wörter in deiner {eigen:eigenen} Sprache. Sie sind {einfach} und schön.",
    "Wir {sprechen} {viel}, obwohl wir wenig verstehen.",
    "Die {sonne} steht {tief}. Sie sieht {klein} aus.",
  ] },
  { scene: 'r1-d7', lines: [
    "Seit einer {stunde} sitze ich im Flur und warte.",
    "Ein {jung:junger} Mann zieht ins {haus}. Er ist {neu} und hat {wenig} Gepäck.",
    "Ich sage: „Sie {duerfen:dürfen} nicht {bleiben}.“ Ich weiß nicht, warum ich das sage.",
    "Er ist sehr {beschaeftigt} und hört nicht zu. Morgen ist er weg.",
  ] },
  { scene: 'r1-d8', lines: [
    "Auf meinem {handy} ist eine neue {nachricht}. Ich {lesen:lese} sie, aber die Buchstaben fliehen.",
    "Die Stadt hat eine {million} Einwohner. {frueher} waren sie laut.",
    "Am {eingang} vom {rathaus} steht ein Schild. Ich {erkennen:erkenne} kein Wort.",
    "Niemand kann mir den {grund} {erklaeren}.",
  ] },
  { scene: 'r1-e1', lines: [
    "Du hast {fieber}. Ich bringe dir {brot} und Tee.",
    "Du {essen:isst} wenig. Ich {hoeren:höre} dich nachts husten.",
    "Morgen geht es dir {bestimmt} besser, sage ich.",
    "Am {zweite-num:zweiten} Tag stehst du auf. {auch} ich bin froh.",
    "{falls} du {ausziehen:ausziehst}, sag es mir vorher.",
  ] },
  { scene: 'r1-e2', lines: [
    "Der {wind} schlägt gegen das {fenster}. {immer} {wieder}.",
    "In der {innenstadt} {verschwinden} jeden Tag mehr Schilder.",
    "Vor der Tür liegt ein {paket}. Kein Name steht {drauf}.",
    "{wenn} ich {daran} denke, wird mir kalt. Wer schickt mir das?",
  ] },
  { scene: 'r1-e3', lines: [
    "Wir {laufen} jeden Morgen zum {platz} vor der Kirche.",
    "Dort steht ein alter {baum}. {oben} sitzen Vögel, sie singen nicht.",
    "Du sagst: „Wir müssen die Wörter {retten}.“ Wir {anfangen:fangen} heute damit an.",
    "Du bist der {einzig:einzige} Mensch hier, mit dem ich noch rede.",
    "Vielen {dank}, sage ich. Du lachst.",
  ] },
  { scene: 'r1-e4', lines: [
    "Am {samstag} gehe ich zur {arbeit}. Mein {chef} ist nicht da.",
    "Kein {anruf}, keine Post. Ich höre {kaum} etwas.",
    "In der {nacht} träume ich von meinem {vater}. Er hält meine {hand}.",
    "Die {bahn} fährt {nah} an meinem Haus vorbei, aber leer.",
  ] },
  { scene: 'r1-e5', lines: [
    "Ich {arbeiten:arbeite} nicht mehr. Mein {job} ist weg, die {stelle} auch.",
    "{waehrend} du schläfst, putze ich die {kueche}. Alles muss in {ordnung} sein.",
    "An der {tankstelle} sitzt ein Mann. Er ist {krank} und sagt: „Mir ist alles {egal}.“",
    "Ich finde das nicht {dumm}.",
  ] },
  { scene: 'r1-e6', lines: [
    "Ich {schlafen:schlafe} schlecht, {weil} die Stille so laut ist.",
    "Ich schreibe {weiter}, {damit} ich nichts vergesse. Das ist {wichtig}.",
    "Ich {unterschreiben:unterschreibe} jede Seite mit meinem Namen. Ist er noch {richtig}?",
    "Du sagst: „Wir machen {bald} {urlaub}.“ Wir wissen, das passiert {nie}.",
  ] },
  { scene: 'r1-e7', lines: [
    "Die Glocke der {kirche} läutet {laut}. Niemand zieht am Seil.",
    "Mein {herz} schlägt schnell. Ich {treten:trete} ans Fenster.",
    "{unten} steht ein {fahrrad} vor dem {kindergarten}. Es ist leer.",
    "Auf dem {tisch} liegt ein {stueck} Brot. Es {reichen:reicht} für uns beide.",
    "Zum {glueck} bist du da.",
  ] },
  { scene: 'r1-e8', lines: [
    "Dieses {buch} ist für dich. Ich {stecken:stecke} es unter deine Tür.",
    "Du {trinken:trinkst} {gern} Tee mit {zucker}. Das weiß ich noch.",
    "Dein Gesicht ist mir {bekannt}, aber dein Name ist fort. Meiner auch.",
    "Ich {wagen:wage} es nicht, in den Spiegel zu sehen. {danach} kommt nur noch Stille.",
    "Wenn du das liest: Wie heiße ich?",
  ] },
  // ---- Region 2 · the shopping book: Konrad's bread, his daughter Lina ----
  { scene: 'r2-a1', lines: [
    "Ein neues Heft. Ich nenne es mein Einkaufsbuch. Ich schreibe nur noch auf, was ich kaufe.",
    "Ich brauche {wasser} und {irgendwas} zu essen.",
    "Konrad, der Bäcker, sagt: „Komm {her} und {probieren:probier} das!“",
    "Das Brot ist {ausgezeichnet}. Ich {versprechen:verspreche}, morgen wiederzukommen.",
    "Er will kein Geld. „{bitte}“, sagt er nur.",
  ] },
  { scene: 'r2-a2', lines: [
    "Konrad hat einen weißen {bart} und eine {gelb:gelbe} Schürze.",
    "{hinten} in der Bäckerei steht seine Tochter Lina.",
    "Sie lacht nie. Sie ist sehr {ernst}.",
    "Am Abend trinkt Konrad ein {bier}. Er sagt die {wahrheit}: „Lina will {heiraten}, aber ihr Mann ist weg.“",
    "Ich frage nicht, was sie jetzt {vorhaben:vorhat}.",
  ] },
  { scene: 'r2-a3', lines: [
    "Am {sonntag} hat Lina {geburtstag}. Konrad backt einen Kuchen.",
    "Er gibt mir einen {teil} davon. „{fuers} Einkaufsbuch“, sagt er.",
    "Ihr {onkel} war {fischer}. Er hat ihr {staendig} Geschichten erzählt.",
    "Lina isst {vegetarisch}. Kein Fisch, kein Fleisch, nur Brot.",
  ] },
  { scene: 'r2-a4', lines: [
    "Im Laden {erhoehen:erhöht} niemand die Preise. Es gibt {sowieso} kaum etwas.",
    "{statt} Butter kaufe ich Öl.",
    "Konrad {sorgen:sorgt} sich um Lina. Sie will nicht mehr backen.",
    "Am Bahnhof hängt ein neuer {fahrplan}. Lina liest ihn jeden Tag. Das ist doch {sinnlos}, sagt Konrad.",
    "Ich kann nichts {aendern}.",
  ] },
  { scene: 'r2-a5', lines: [
    "Heute gibt es {rindfleisch}. Es riecht {schlecht}, ich kaufe es nicht.",
    "Lina ist {still}. Sie hat ein {geheimnis}, glaube ich.",
    "In ihrer Tasche ist eine neue {sim-karte}. Für wen?",
    "Konrad will ein Regal {bauen}. Er {behandeln:behandelt} das Holz mit Öl, ganz langsam.",
    "Draußen ist das Gras wieder {gruen}.",
  ] },
  { scene: 'r2-a6', lines: [
    "Im Café sage ich: „{zahlen-bitte}“ Der Kellner ist nicht da.",
    "Mein Kaffee ist {kalt}.",
    "Konrad {verdienen:verdient} kein Geld mehr. Er backt {absolut} umsonst.",
    "Er hat keinen {kontakt} zu seinen Kunden, sagt er. Sie vergessen ihn.",
    "Der {buergermeister} hat sein Büro zu. An der Tür steht: „{anmeldung} geschlossen“.",
  ] },
  { scene: 'r2-a7', lines: [
    "Konrad ist mein {vorbild}. Er ist {mutig} und bleibt {locker}.",
    "Jeden Tag macht er die Bäckerei {erneut} auf, zur selben {oeffnungszeit}.",
    "Ich gebe ihm zwei Euro und sage: „{stimmt-so}“",
    "Er lacht. Für eine {sekunde} ist alles normal.",
    "Das Leben ist {hart}, sagt er.",
  ] },
  { scene: 'r2-b1', lines: [
    "Ich soll Brot für Lina {abholen}. Sie ist nicht da.",
    "Ihre {firma} war am Bahnhof. Jetzt ist das Büro leer.",
    "Konrad sucht eine {loesung}. Er backt {zwanzig-num} Brote für die Nachbarn.",
    "Am {dritte-num:dritten} Tag kommt Lina zurück. Ihr Arm hat eine {verletzung}.",
    "Sie sagt nicht, woher.",
  ] },
  { scene: 'r2-b2', lines: [
    "Im Kleiderladen fragt eine Stimme: „{noch-etwas}“",
    "Ich sage: „{ich-schaue-mich-nur-um}“",
    "Am {geldautomat:Geldautomaten} kommt kein Geld {mehr}.",
    "Heute Abend bin ich {gast} bei Konrad. Zum {abendessen} gibt es Suppe.",
    "Lina bleibt die ganze Nacht {wach}. Mir {auffallen:fällt} ein {geruch} auf, nach Rauch.",
  ] },
  { scene: 'r2-b3', lines: [
    "Ich frage am Markt: „{was-kostet-das}“",
    "Die Frau sagt: „Heute ist alles im {angebot}.“",
    "Ich nehme eine {gabel} und sage: „{das-ist-alles}“",
    "Auf dem {kassenbon} steht kein Preis. {irgendwie} komisch.",
    "Konrad will mich {einladen}. Wir trinken {leitungswasser}, sonst gibt es nichts.",
  ] },
  { scene: 'r2-b4', lines: [
    "In der {umkleidekabine} hängt ein {spiegel}. Ich sehe mich nicht darin.",
    "Ich sage zum {kassierer}: „{ich-nehme-das}“ Er nimmt mein {geld} und schweigt.",
    "Bei Konrad frage ich wie jeden Morgen: „{haben-sie-brot}“",
    "Lina war {lehrerin}, sagt er. Sie {trauen:traut} niemandem mehr.",
  ] },
  { scene: 'r2-b5', lines: [
    "Am Markt sage ich: „{ich-haette-gern-ein-kilo-aepfel}“",
    "Ich höre den Preis und sage: „{das-ist-zu-teuer}“",
    "Ich {tragen:trage} zwei Kilo {mehl} zu Konrad. Mir {wehtun:tut} der Rücken weh.",
    "Ein {polizist} schiebt einen leeren {einkaufswagen} durch die Straße.",
    "Konrad sagt, das ist kein {scherz}.",
  ] },
  { scene: 'r2-b6', lines: [
    "In der {metzgerei} frage ich: „{wo-ist-die-kasse}“ Niemand {antworten:antwortet}.",
    "Ich will {bezahlen}, aber die Karte geht nicht.",
    "Bei Konrad {schmecken:schmeckt} das Brot heute bitter. Er {aufraeumen:räumt} die Bäckerei auf.",
    "Lina {achten:achtet} auf jede {briefmarke} in der Post. Sie sucht einen Brief.",
    "Ich {einschlafen:schlafe} spät ein.",
  ] },
  { scene: 'r2-b7', lines: [
    "In der {drogerie} frage ich: „{kann-ich-mit-karte-zahlen}“",
    "Die Frau sagt: „{das-macht-fuenf-euro}“ Meine {ec-karte} ist leer.",
    "Bald ist {weihnachten}. Die Stadt {klingen:klingt} trotzdem still.",
    "Konrad sagt, die Kälte {kosten:kostet} ihn viel Kraft. Ich {widersprechen:widerspreche} nicht.",
  ] },
  { scene: 'r2-c1', lines: [
    "Im {tuerkisch:türkischen} Laden frage ich: „{gibt-es-einen-rabatt}“",
    "Der Mann fragt: „{bar-oder-mit-karte}“ Ich gebe ihm Münzen.",
    "Ich kaufe {sprudel} und eine {packung} Reis im {sonderangebot}.",
    "{zuhause} frage ich mich: Was {passieren:passiert} mit Lina?",
  ] },
  { scene: 'r2-c2', lines: [
    "Lina {stammen:stammt} nicht von hier, sagt Konrad. Ihre Mutter war aus dem Norden.",
    "Die {situation} ist schwer. Lina will nicht mehr reden.",
    "Ich {vermuten:vermute}, sie sucht jemanden.",
    "Konrad {ueberpruefen:überprüft} jeden Morgen die Kasse. {wenigstens} das Geld ist noch da.",
    "{mitten} in der Nacht hängt Lina die {waesche} auf.",
  ] },
  { scene: 'r2-c3', lines: [
    "Konrad hat Schmerzen im {ruecken}. Er hat keine {kraft} mehr.",
    "Ich helfe ihm. Das ist {noetig}.",
    "Im {hof} malt Lina ein {zeichen} an die Wand.",
    "Ich {erwischen:erwische} sie dabei. Sie sagt: „Die {haelfte} der Stadt ist schon weg.“",
  ] },
  { scene: 'r2-c4', lines: [
    "In der {kneipe} {singen:singt} jemand. Ich höre es nur mit einem {ohr}.",
    "Lina {schenken:schenkt} mir ein Bild. Sie liebt {kunst}, sagt sie.",
    "Auf dem Bild ist eine {zahl}: sieben. Was bedeutet das?",
    "In meinem {briefkasten} liegt ein {formular}. Es ist {komplett} leer.",
  ] },
  { scene: 'r2-c5', lines: [
    "Die {baeckerei} ist heute {voller} Leute. Konrad ist glücklich.",
    "Er sagt: „Es ist mir eine {ehre}.“ Alle lachen. Es ist {lustig}.",
    "Lina sitzt hinten und trinkt ein warmes {getraenk}.",
    "Im {schrank} finde ich einen {hinweis}: eine Fahrkarte ohne Ziel.",
  ] },
  { scene: 'r2-c6', lines: [
    "Konrad ist {stolz} auf Lina, aber sie spricht nicht über ihre {vergangenheit}.",
    "Sie sagt: „Ich will mir einen Traum {erfuellen}.“",
    "Ich frage: „Welchen?“ Sie zeigt auf den Bahnhof. Dort {abfahren:fahren} keine Züge mehr ab.",
    "Konrad sagt, das ist {verrueckt}.",
    "{vorher} war Lina anders, sagt er.",
  ] },
  { scene: 'r2-c7', lines: [
    "Konrad zeigt mir ein {video} von einer {party}. Lina tanzt und lacht.",
    "Es ist eine schöne {erinnerung}. Heute lacht sie nicht mehr.",
    "{ueberall} in der Stadt hängen Zettel mit einem {text}: „Fahrkarten gibt es nur am Bahnhof.“",
    "Lina kommt {naeher:näher} und liest ihn.",
  ] },
  { scene: 'r2-d1', lines: [
    "Mein {vermieter} schreibt mir nicht mehr. Die Wohnung unten ist {leer}.",
    "Jemand will meine {kreditkarte} {stehlen}. Sie ist sowieso nutzlos.",
    "Lina spricht {leise}: „{sobald} der Zug kommt, gehe ich.“",
    "Ich {ueberlegen:überlege} lange. Soll ich es Konrad sagen?",
  ] },
  { scene: 'r2-d2', lines: [
    "In der {naehe} vom Bahnhof {erscheinen:erscheint} jede Nacht ein Licht.",
    "Ein {kerl} in Uniform steht {darin}. Er {aussehen:sieht} aus wie ein Schaffner.",
    "Ich {merken:merke}: Lina sieht ihn auch.",
    "Konrad sagt, seine {tante} hat so einen Mann gesehen. Dann ist sie weggegangen.",
  ] },
  { scene: 'r2-d3', lines: [
    "Konrad hat {husten}. Ich bringe ihm einen warmen {pullover}.",
    "Er {weinen:weint} ein bisschen. Lina hat den Bahnhof wieder {erwaehnen:erwähnt}.",
    "Am Bahnhof hängt ein altes Schild: „{willkommen} in {berlin}“. Der Name ist halb weg.",
    "Das {licht} dort ist kalt, auch im {sommer}.",
  ] },
  { scene: 'r2-d4', lines: [
    "Lina sitzt {alleine} am Fenster. Hinter dem {vorhang} sieht sie den Bahnhof.",
    "Sie sagt: „Ich habe es {nochmal} gezählt. Jede Nacht ein Zug, aber keiner hält.“",
    "{trotz} der Kälte geht sie hin.",
    "Ich finde das {unglaublich}. Ihr {koerper} zittert, aber sie bleibt.",
  ] },
  { scene: 'r2-d5', lines: [
    "Am {mittag} bringe ich Lina etwas {suess:Süßes}.",
    "Ihr {opa} war Schaffner, {verraten:verrät} mir Konrad.",
    "Lina geht jeden Tag ein paar {meter} näher zum Bahnhof.",
    "Konrad will sie nicht {zwingen}, aber er {schreien:schreit} im Schlaf.",
    "{hoffentlich} bleibt sie, {solange} es Brot gibt.",
  ] },
  { scene: 'r2-d6', lines: [
    "Ich kaufe {broetchen} und {salat} für uns drei.",
    "Lina {gucken:guckt} aus dem Fenster. Draußen ist es {dunkel}.",
    "Eine alte {kamera} liegt auf dem Tisch. Daneben ein Foto vom Bahnhof, wie {zuvor}.",
    "Konrad sagt: „Das ist {privat}.“ Er will Lina nicht von dem Bild {trennen}.",
  ] },
  { scene: 'r2-e1', lines: [
    "Die {heizung} im {schlafzimmer} ist kalt. Die {luft} riecht nach Schnee.",
    "Lina sagt: „Meine {mama} wollte immer {reisen}.“",
    "{bisher} hat Konrad nie von Linas Mutter gesprochen.",
    "Der {gedanke} lässt mich nicht los. Die {lage} wird ernst.",
  ] },
  { scene: 'r2-e2', lines: [
    "Ich {putzen:putze} den {boden} der Bäckerei. Konrad sitzt still.",
    "{ploetzlich} steht Lina in der Tür, mit einer {tuete} voller Brot.",
    "Sie sagt: „Für die Reise.“ Ich {beobachten:beobachte} sie und sage nichts.",
    "Der Bahnhof ist nur zehn Minuten {entfernt}, zu {fuss}.",
    "Konrad will nicht {aufgeben}.",
  ] },
  { scene: 'r2-e3', lines: [
    "Heute {regnen:regnet} es. Ich {kochen:koche} Suppe mit wenig {salz}.",
    "Konrad und ich sind jetzt ein {team}. Wir {besuchen} jeden Abend den Bahnhof.",
    "Lina steht am {gleis}. Sie zählt bis {hundert-num} und geht keinen {schritt}.",
    "{obwohl} sie friert, bleibt sie dort.",
  ] },
  { scene: 'r2-e4', lines: [
    "Am {montag} fährt die {feuerwehr} durch die Stadt. Niemand sitzt drin.",
    "Eine alte {dame} am Bahnhof sagt: „{achtung}, der Zug ist {boese:böse}.“",
    "Lina hat eine Fahrkarte mit einer {nummer}. Sie will sie vor Konrad {verstecken}.",
    "Ich sehe es und sage nichts. {daher} schreibe ich es hier auf.",
  ] },
  { scene: 'r2-e5', lines: [
    "Konrad trinkt eine {tasse} Tee und hält eine lange {rede}.",
    "„Du bist meine Tochter. Ich {kuemmern:kümmere} mich um dich.“",
    "Lina sagt: „Das ist meine {entscheidung}.“",
    "Auf der Tafel am Bahnhof steht: „{ankunft} heute Nacht“. Kein {fahrer}, kein Zug.",
    "Ich habe einen bösen {traum}.",
  ] },
  { scene: 'r2-e6', lines: [
    "Lina ist {aufgeregt}. Sie packt eine {flasche} Wasser ein.",
    "Konrad ist {sauer}. Er ist {dagegen}, aber er sagt nichts mehr.",
    "{zuerst} will ich ihn trösten. Dann will ich mich {entschuldigen}.",
    "{draussen} ist es still wie im {theater} vor dem {beginn}.",
  ] },
  { scene: 'r2-e7', lines: [
    "Heute Nacht ist der {fluss} voller {eis}. Über die {bruecke} geht ein Licht.",
    "Am Bahnhof gibt es keine {information}, nur das Licht.",
    "Konrad bleibt in der Bäckerei. Er will Lina nicht {verletzen}.",
    "Er sagt: „Sie ist erwachsen.“ {jedoch} weint er.",
    "Lina geht zum Bahnhof. Ich gehe auch.",
  ] },
  // ---- Region 3 · Perfekt: the station, the whispering timetable, Lina's ticket ----
  { scene: 'r3-a1', lines: [
    "Wir sind zum Bahnhof gegangen. Ein {zug} hat auf uns gewartet.",
    "Er war {leicht} und still, wie aus Papier.",
    "Eine {katze} ist mit uns eingestiegen. Lina hat sie auf den Schoß genommen.",
    "Ich hatte einen {schnupfen} und einen kalten {hals}. Ich habe nichts gesagt.",
    "Nur wir drei sind {uebrig} geblieben: Lina, die Katze und ich.",
  ] },
  { scene: 'r3-a2', lines: [
    "Der Zug ist nicht weit {fahren:gefahren}. Wir sind in eine {s-bahn} umgestiegen.",
    "Lina hat zum ersten Mal {laecheln:gelächelt}. Sie war {neugierig}.",
    "Ich hatte {eher} Angst.",
    "Am Bahnsteig war eine {ausstellung} mit alten Fahrkarten. Die Namen haben gefehlt.",
    "Das war kein {spass} mehr.",
  ] },
  { scene: 'r3-a3', lines: [
    "Ich habe eine {monatskarte} gekauft. Der Automat hat {fuenfzig-num} Cent zu viel genommen.",
    "{zwischen} den Gleisen hat ein {ring} gelegen. Lina hat ihn aufgehoben.",
    "Ein Mann hat „{entschuldigung}“ gesagt und ist weitergegangen.",
    "{ausser} uns war niemand im {bezirk}. {zumindest} haben wir niemanden gesehen.",
  ] },
  { scene: 'r3-a4', lines: [
    "Ich habe am Automaten ein Ticket {loesen:gelöst}. „{hin-und-zurueck}“, habe ich gedrückt.",
    "Der Automat hat den Namen der Station gefressen. Er ist {elektrisch}, und er hat gelacht.",
    "Wir haben lange auf der Bank {sitzen:gesessen}.",
    "Hinter der {kreuzung} liegt ein {friedhof}. Lina wollte {hinein}.",
    "Das war {wahrscheinlich} ein Fehler.",
  ] },
  { scene: 'r3-a5', lines: [
    "Kein {auto}, kein Bus. Wir sind {zu-fuss} weitergegangen.",
    "Es war {heiss} im Tunnel, obwohl draußen Winter war.",
    "{unterwegs} haben wir einen alten {kumpel} von Konrad getroffen. Er hat den Boden {kehren:gekehrt}.",
    "Er hat gesagt: „Die Kameras {ueberwachen} alles. Geht nicht weiter.“",
    "{andererseits}: Wohin sonst?",
  ] },
  { scene: 'r3-a6', lines: [
    "Im {keller} der Station hat ein Telefon {klingeln:geklingelt}.",
    "Lina und ich sind {gleichzeitig} hingelaufen. Niemand war am Apparat.",
    "Ich habe es nicht {begreifen:begriffen}.",
    "Lina hat ihren {rucksack} fest gehalten. „Ich muss etwas {beweisen}“, hat sie gesagt.",
    "Ich habe ihre Entscheidung {respektieren:respektiert}.",
  ] },
  { scene: 'r3-b1', lines: [
    "Die {stadt} hinter dem Bahnhof hat keinen {strom} gehabt.",
    "Auf einer Karte von {deutschland} hat ein {gebiet} gefehlt. Da war nur ein weißer Fleck.",
    "Lina hat gesagt: „Das ist {gefaehrlich}.“ Ich habe lange {nachdenken:nachgedacht}.",
    "Um {zwoelf-num} sind wir die Treppe {raufgehen:raufgegangen}.",
  ] },
  { scene: 'r3-b2', lines: [
    "Am {hauptbahnhof} hat uns niemand {empfangen}.",
    "{dort} hat der Fahrplan geflüstert. Jeden {satz} hat er zweimal gesagt.",
    "Ich habe ein {bisschen} verstanden: „Der letzte Zug fährt nicht.“",
    "Lina hat das {gegenteil} gehört: „Der letzte Zug fährt heute.“",
    "Ich habe ihr nicht mehr {vertrauen:vertraut}.",
  ] },
  { scene: 'r3-b3', lines: [
    "An der {wand} hing ein Brief ohne {absender}.",
    "Darin stand nur ein {passwort}: „Heimweg“. Lina hat sich {freuen:gefreut}.",
    "Ich habe mich {verloren} gefühlt.",
    "Die {stimmung} war seltsam. {deswegen} haben wir ein Zimmer {mieten:gemietet}.",
    "{uebrigens}: Die Katze ist bei uns geblieben.",
  ] },
  { scene: 'r3-b4', lines: [
    "An der {kasse} vom Bahnhof saß niemand. Wir haben uns auf die Bank {setzen:gesetzt}.",
    "Ich hatte {durst}. Die große Uhr hat zwölf {schlagen:geschlagen}.",
    "Lina hat die Zeit bis zum Zug {ausrechnen:ausgerechnet}.",
    "Ich habe mich {aufregen:aufgeregt}: „Das ist nicht {menschlich}!“",
    "Sie hat nur gelacht. Ich habe es nicht {witzig} gefunden.",
  ] },
  { scene: 'r3-b5', lines: [
    "Ein Mann am Bahnsteig hat einen alten {song} gesungen.",
    "Er hat sich als {richter} {vorstellen:vorgestellt}. Er hat gesagt: „{euer} Zug kommt bald.“",
    "Lina und ich haben lange {diskutieren:diskutiert}.",
    "Ich wollte sie {schuetzen}. Sie wollte mit mir den Platz {tauschen}.",
  ] },
  { scene: 'r3-b6', lines: [
    "Wir haben den ganzen Tag am Bahnhof {verbringen:verbracht}.",
    "Am {himmel} war kein Stern. Lina hat Fahrkarten {sammeln:gesammelt}, alle ohne Namen.",
    "Ein {dieb} hat meine Tasche {oeffnen:geöffnet}. Er hat nichts genommen, nur ein {bild} von Konrad.",
    "Alle Züge sind {ausfallen:ausgefallen}.",
  ] },
  { scene: 'r3-c1', lines: [
    "Am {morgen} ist {regen} gefallen.",
    "Der {hausmeister} vom Bahnhof hat die Gleise {untersuchen:untersucht}.",
    "Er war {froh}, {als} er uns gesehen hat.",
    "Er hat {heimlich} einen Zettel in Linas Tasche {werfen:geworfen}.",
    "Ich habe ihn {noch} nicht gelesen.",
  ] },
  { scene: 'r3-c2', lines: [
    "Auf dem Zettel stand: „{morgen-2} kommt der letzte Zug.“",
    "Lina ist {voellig} ruhig geblieben. Ich war {besorgt}.",
    "Wir haben eine {pause} gemacht und die Koffer die Treppe {runter} getragen.",
    "{dann} haben wir auf dem {flohmarkt} etwas für die {reise} gekauft.",
    "{jetzt} weiß ich, es war {erst} der Anfang.",
  ] },
  { scene: 'r3-c3', lines: [
    "Am {tag} vor der Abfahrt hat Lina mich gefragt: „{wie-spaet-ist-es}“",
    "Ich habe auf die Uhr geschaut. Sie ist {gerade} stehen geblieben.",
    "Lina hat von ihrer {mutter} erzählt. Sie hat in der Hauptstadt {studieren:studiert}.",
    "{vielleicht} {existieren:existiert} die Hauptstadt nicht mehr.",
    "Ein Zug ist vorbeigefahren, aber er hat nicht {anhalten:angehalten}.",
  ] },
  { scene: 'r3-c4', lines: [
    "{heute} habe ich wieder {schreiben:geschrieben}. Die Wörter kommen langsam zurück.",
    "Ein {junge} hat im {buero} des Bahnhofs gesessen. Ich habe gefragt: „{um-wie-viel-uhr}“",
    "Er hat nur gesagt: „{gleich}.“ Dann hat er laut nach seiner Mutter {rufen:gerufen}.",
    "Was ist mit ihm {geschehen}?",
  ] },
  { scene: 'r3-c5', lines: [
    "{letzte-woche} war ich noch bei Konrad.",
    "Jetzt bin ich seit einer {woche} am Bahnhof.",
    "Ein Mann von der {behoerde} hat die Uhr {reparieren:repariert}. Er war {nett}.",
    "Er hat ein seltsames {ding} aus der Tasche {holen:geholt}: einen Stempel ohne Namen.",
    "Für einen {moment} war alles still.",
  ] },
  { scene: 'r3-c6', lines: [
    "{letztes-jahr} war hier alles anders, hat Lina gesagt.",
    "Es war schon {spaet}. Die {ampel} vor dem Bahnhof ist rot geblieben.",
    "Ich habe einen {plan} gemacht: Wir gehen zurück. Lina hat gesagt, sie hat keine {wahl}.",
    "Ein Schild hat uns {warnen:gewarnt}: „Keine Rückkehr.“",
    "War das eine {luege}?",
  ] },
  { scene: 'r3-c7', lines: [
    "Der Fahrplan hat {langsam} geflüstert: „Kein {ziel}, keine Rückkehr.“",
    "Lina hat ein rotes {kleid} angezogen. Sie hat gesagt: „Der Zug fährt {noch-nicht}.“",
    "Ich war der einzige {zeuge}.",
    "Ich habe gesagt: Das ist eine {gefahr}. Sie hat nicht {aufhoeren:aufgehört} zu lächeln.",
    "Hinter dem {berg} hat ein Licht gebrannt.",
  ] },
  { scene: 'r3-c8', lines: [
    "In der Nacht bin ich {aufwachen:aufgewacht}. Die {temperatur} ist gefallen.",
    "Der Wind hat durch die Halle {blasen:geblasen}.",
    "Lina hat vor einem kalten {ofen} gesessen und in einem {album} geblättert.",
    "Sie hat gesagt: „Mein Großvater hat hier seine {ausbildung} gemacht. Er ist nie {zurueckkommen:zurückgekommen}.“",
  ] },
  { scene: 'r3-d1', lines: [
    "Am {nachmittag} habe ich {kaffee} gekocht. Es waren null {grad} draußen.",
    "Lina hat auf einem {stuhl} gesessen und ihren {ausweis} angeschaut. Der Name war weg.",
    "Sie hat gesagt: „Ich habe keine {ahnung}, wer ich bin.“",
    "Ich habe gesagt: „Das ist nicht deine {schuld}.“",
    "{eigentlich} habe ich das über mich gesagt.",
  ] },
  { scene: 'r3-d2', lines: [
    "Im Wartesaal hat ein alter {computer} gebrummt. Auf dem Bildschirm war eine {botschaft}.",
    "Sie war auf {englisch:Englisch}, dann auf Deutsch: „Die {welt} wartet nicht.“",
    "Lina hat eine {blume} vom Bahnsteig gepflückt. Sie war gelb und {aehnlich} wie Papier.",
    "„Ich bin {bereit}“, hat sie gesagt. Eine {minute} später hat sie geweint.",
  ] },
  { scene: 'r3-d3', lines: [
    "Am Morgen ist eine {kontrolle} gekommen.",
    "Ich war {ueberrascht}: Der Kontrolleur hat Linas Schürze getragen.",
    "Er hat sich langsam zu uns {drehen:gedreht}. Ich habe Angst {fuehlen:gefühlt}.",
    "Er hat eine fremde {sprache} gesprochen. Kein Wort hatte einen {sinn}.",
    "Lina ist {aufstehen:aufgestanden} und hat ihm ihr Ticket gezeigt.",
  ] },
  { scene: 'r3-d4', lines: [
    "Der Kontrolleur hat {tatsaechlich} gelächelt.",
    "Lina hat gefragt: „{woher} hast du meine Schürze?“ Er hat nicht geantwortet.",
    "Er hat ihren {koffer} {mitnehmen:mitgenommen}. Ich habe ihn am Arm {ziehen:gezogen}, aber er war stärker.",
    "Nach {zehn-num} Minuten ist er im Zug verschwunden.",
    "Es war noch {frueh}.",
  ] },
  { scene: 'r3-d5', lines: [
    "{nachts} habe ich {schmerz:Schmerzen} im Kopf gehabt.",
    "Ich bin zur {praxis} am Bahnhof gegangen. Ich hatte keinen {termin}.",
    "Der Arzt hat gesagt: „Das ist eine {art} Heimweh. Diesen {ort} vergisst man nicht.“",
    "Es gibt nur eine {moeglichkeit}: zurückgehen. {darum} habe ich Lina gesucht.",
  ] },
  { scene: 'r3-d6', lines: [
    "Der {arzt} hat mir eine {liste} gegeben: Namen von Leuten, die gefahren sind.",
    "Linas Name war nicht dabei. Ich habe nicht verstanden, was das {bedeuten:bedeutet}.",
    "Ich war {muede}, aber ich musste {stark} bleiben.",
    "Eine {gruppe} von Schatten hat am Gleis gewartet. Einer hat eine Krone getragen wie ein {koenig}.",
  ] },
  { scene: 'r3-d7', lines: [
    "Zum {fruehstueck} habe ich {obst} {bestellen:bestellt}. Der Kellner war ein Schatten.",
    "Ein Mann im weißen {hemd} hat mir ein Papier gegeben. Er wollte meine {unterschrift}.",
    "Er hat gesagt: „{gute-besserung}“ Dann hat er mich ins {krankenhaus} geschickt.",
    "{wieso}? Ich war nicht krank.",
  ] },
  { scene: 'r3-d8', lines: [
    "Im Krankenhaus hat eine Uhr an der Wand {haengen:gehangen}. Sie hat sich nicht {bewegen:bewegt}.",
    "Ich habe die Tage {zaehlen:gezählt}. Es waren {acht-num}.",
    "Ich hatte Angst, den {anschluss} zu {verpassen}.",
    "Die Nacht war {ruhig}. Ich habe zu {gott} gebetet. Ich weiß nicht, ob ich glaube.",
  ] },
  { scene: 'r3-e1', lines: [
    "Ich bin aus dem Krankenhaus {fliehen:geflohen}, über den {balkon}.",
    "Am Bahnhof hing eine neue {vorschrift}: „{schwarzfahren} ist verboten. Ohne Namen fährt jeder schwarz.“",
    "Ich habe mir eine {story} für den Kontrolleur {ausdenken:ausgedacht}.",
    "Am {folgend:folgenden} Tag habe ich Lina wiedergesehen.",
  ] },
  { scene: 'r3-e2', lines: [
    "Lina hat in einem {dreckig:dreckigen} Café gesessen. Der {kellner} hat ihr Tee gebracht.",
    "Sie hatte {halsschmerzen} und hat {furchtbar} ausgesehen.",
    "Sie hat gesagt: „Ich habe eine {theorie}. Wer den Namen verliert, findet {nirgendwo} mehr nach Hause.“",
    "Ich habe ihr {vergeben}. Sie hat nicht gewusst, wofür.",
  ] },
  { scene: 'r3-e3', lines: [
    "Lina hat mir ihren {studentenausweis} gezeigt. Ihr {geburtsort} war weg.",
    "„Ich kenne einen {trick}“, hat sie gesagt. „Man fährt einfach, ohne Ziel.“",
    "Das war keine Reise, das war eine {flucht}.",
    "Draußen war die {aussicht} grau wie eine {wueste}.",
    "{wovon} hat sie geträumt?",
  ] },
  { scene: 'r3-e4', lines: [
    "Ein {musiker} hat am Gleis Geige gespielt. Es klang wie {magie}.",
    "Lina hat sich ein bisschen {erholen:erholt}.",
    "Sie hat gesagt: „Ich will nicht {abhauen}. Ich will nur wissen, {wonach} ich suche.“",
    "Das war {kompliziert}. Ich konnte Traum und Wahrheit nicht mehr {unterscheiden}.",
  ] },
  { scene: 'r3-e5', lines: [
    "Wir haben uns am {rand} des Bahnsteigs ein Lager {einrichten:eingerichtet}.",
    "Es gab eine lange {diskussion}. Ich habe meine {wut} nicht versteckt.",
    "Lina musste sich nicht {rechtfertigen}. Sie war {stets} ruhig.",
    "Die Gleise sind nach Westen gelaufen, {unendlich} weit.",
  ] },
  { scene: 'r3-e6', lines: [
    "{mittlerweile} hatten wir nicht mehr {genuegend:genügend} Brot.",
    "Lina hat gesagt: „Ich will nach {sueden} {wandern}.“",
    "Ich habe {beten:gebetet}, dass der Zug nicht kommt.",
    "Der {fakt} war: Er kommt jede Nacht. Kein {zauber} kann ihn stoppen.",
  ] },
  { scene: 'r3-e7', lines: [
    "Lina hat mir ein {gedicht} vorgelesen. Der {klang} der Wörter war schön.",
    "Ich habe mein {haar} im Spiegel gesehen. Es war weiß geworden.",
    "Lina hat gesagt: „Du bist mein {held}.“ Ich hatte keine {reaktion}.",
    "Ich habe nur {schrecken} {empfinden:empfunden}.",
  ] },
  { scene: 'r3-e8', lines: [
    "In der letzten Nacht hat es nach {rauch} {riechen:gerochen}. Der Zug hat {strahlen:gestrahlt}.",
    "Ich bin auf der Bank eingeschlafen. Am Morgen war Lina weg. Ich habe keine {warnung} gehört.",
    "Unter der Bank lag ihre Fahrkarte, mit einem {loch} in der Mitte. Ich lese nur: „Miet…“.",
    "Niemand kann sie mir {wegnehmen}.",
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
