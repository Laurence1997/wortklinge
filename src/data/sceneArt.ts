// 场景插画 (0.6 block 2): one small picture per field scene, built from Kenney 1-Bit Pack tiles (CC0, www.kenney.nl;
// public/art/kenney-1bit.png, 16 px tiles, 49 per row). Each picture shows at least 3 things from the scene's own word
// group; those tiles light up as their word reaches 半名, the rest of the picture stays dark red (场景记忆法).
// Format: "tile@col,row" or "tile@col,row:wordId", on a 10 × 5 tile canvas. A trailing "!" mirrors the tile.

export const ART_COLS = 10;
export const ART_ROWS = 5;

export const SCENE_ART: Record<string, string> = {
  // ---- Region 1 ----
  'r1-e1': '598@8,0 452@1,3 394@3,3:tisch 394@4,3 452@6,3:stuhl 965@3,2:brot 579@4,2:glas 964@5,2:flasche 720@6,2:tasse 505@8,3:wasser',
  'r1-e2': '607@4,1:fenster 598@7,1:uhr 397@1,3:bett 609@2,3:decke 738@3,3:lampe 571@5,3:schluessel 504@6,3:feuer 444@8,3:tuer',
  'r1-e3': '611@1,1 292@1,2:tasche 290@3,3:buch 1061@4,3:stift 767@5,3:papier 1042@6,3:handy 24@8,3',
  'r1-e5': '566@8,0:guten-morgen 633@1,0:gute-nacht 512@2,1 512@3,1 512@4,1 512@5,1 512@6,1 25@2,3 721@3,2:hallo 24@5,3 177@7,3 770@6,2:herzlich-willkommen',
  'r1-e6': '495@1,3 25@3,3 292@4,3 24@6,3 671@3,1:entschuldigung 721@5,1:danke 529@6,1:freut-mich 773@7,2:kein-problem 555@8,3',
  'r1-e7': '633@8,0 983@1,3 981@3,3 986@7,3 675@2,1:ja 676@4,1:nein 673@5,1:wie-bitte 723@6,2:ich-weiss-nicht',
  'r1-e4': '981@1,3:haus 749@3,3 750@4,3 292@5,3:koffer 359@4,2:foto 768@6,3:zeitung 762@7,3:computer 291@8,3:karte',
  'r1-s1': '347@1,3 767@2,3:formular 825@3,3:ausweis 1038@5,3:e-mail 989@6,3:telefonnummer 824@8,3:adresse 966@3,1:name 917@4,1 929@5,1 921@6,1',
  'r1-s2': '1034@1,2 598@1,1 673@3,1:wer 674@5,1:was 824@7,1:wo 1058@3,3:kommen 25@5,3 292@7,3:haben',
  'r1-s5': '868@1,1:null-num 869@2,1:eins-num 870@3,1:zwei-num 871@4,1:drei-num 872@5,1:vier-num 873@6,1:fuenf-num 874@7,1:sechs-num 875@1,3:sieben-num 876@2,3:acht-num 877@3,3:neun-num 869@5,3:elf-num 869@6,3 869@8,3:zwoelf-num 870@9,3',
  'r1-s3': '1035@1,2 291@3,3 767@4,3 138@6,1:land 1032@8,2:stadt 458@3,1:deutschland 457@4,1:china 554@6,3',
  'r1-s6': '1031@1,2:schule 359@4,1:kurs 917@3,3:wort 918@4,3 919@5,3 673@7,2:frage 671@8,2:antwort 773@6,1:sprache',
  'r1-s7': '292@1,3:arbeit 490@3,3:arzt 691@4,3:koch 289@6,3:ingenieur 359@7,1:lehrer 290@8,3:student 25@2,3',
  'r1-s8': '495@1,3 24@3,3:frau 25@4,3:mann 177@5,3:kind 222@7,3:herr 74@8,3:nachbar 529@6,1:freund',
  'r1-s9': '357@4,1 824@1,3:wohnen 292@3,3:arbeiten 1058@5,3:gehen 773@6,2:sprechen 290@8,3:lernen',
  'r1-s4': '347@1,3 1061@3,3:schreiben 290@4,3:lesen 822@6,2:hoeren 773@7,2:sagen 673@8,2:fragen 917@3,1:buchstabieren 918@4,1 919@5,1',
  'r1-a1': '689@1,2 689@2,2 689@3,2 689@4,2 869@1,1:dreizehn-num 871@2,1 870@6,1:zwanzig-num 868@7,1 870@6,3:einundzwanzig-num 869@7,3 869@1,3:neunzehn-num 877@2,3',
  'r1-a2': '555@8,3 25@1,3:vater 24@2,3:mutter 177@3,3:sohn 220@4,3:tochter 518@6,2:bruder 515@7,2:schwester 529@5,1:familie',
  'r1-a5': '1036@1,2:gross 824@3,3:klein 73@5,3:alt 177@6,3:jung 337@8,2:verheiratet 529@8,1:schoen 616@4,1:neu',
  'r1-a6': '73@1,3:opa 79@2,3:oma 177@4,3:junge 220@5,3:maedchen 515@6,2:baby 222@7,3:onkel 24@8,3:tante',
  'r1-a3': '566@8,0:tag 1032@1,2:jahr 1032@2,2:monat 872@4,1:vierzig-num 868@5,1 871@4,3:dreissig-num 868@5,3 869@7,3:hundert-num 868@8,3 868@9,3',
  'r1-a7': '397@1,3 490@3,3:krank 633@2,1:muede 529@5,2:nett 823@6,3:toll 676@8,2:nicht 942@4,3',
  'r1-a4': '397@1,3 373@2,2:katze 374@4,3:hund 604@6,3:geburtstag 566@8,0:heute 1056@8,3:hier 607@5,1',
  // ---- Region 2 ----
  'r2-g1': '562@1,2 553@3,3:obst 915@4,2:apfel 916@5,2:birne 605@6,2:kirsche 915@7,3 916@8,3',
  'r2-g5': '394@3,3 394@4,3 818@3,2:kaese 867@4,2:ei 604@5,2:kuchen 720@6,3:milch 965@7,3:broetchen 651@8,3:butter',
  'r2-g2': '562@1,2 553@3,3:gemuese 1014@4,2:karotte 103@5,3:pilz 866@6,2:salat 867@7,3:kartoffel 915@8,3:tomate',
  'r2-g6': '394@3,3 394@4,3 817@3,2:fisch 965@4,2:fleisch 369@6,3:haehnchen 690@7,3:suppe 994@8,3:reis',
  'r2-g3': '650@1,3 505@1,2 964@3,2:wein 579@4,2:saft 578@5,2:bier 720@6,2:kakao 616@7,1:eis 394@4,3 394@5,3',
  'r2-g7': '562@1,2 651@3,2:zucker 578@4,2:salz 601@5,2:honig 964@6,2:oel 504@7,3:scharf 529@8,2:suess 394@3,3 394@5,3',
  'r2-g4': '394@3,3 394@4,3 394@5,3 866@3,2:frisch 504@4,2:heiss 616@5,2:kalt 721@7,2:lecker 529@8,2:gesund 25@1,3',
  'r2-w1': '594@1,3:kasse 239@3,2:geld 554@4,3:muenze 819@5,1:euro 820@6,1:cent 825@7,3:kreditkarte 243@8,3:portemonnaie',
  'r2-w5': '357@2,1:preis 1057@4,1:teuer 1059@5,1:billig 554@7,3:viel 188@8,3:wenig 819@3,3:sonderangebot',
  'r2-w2': '598@2,1:waage 749@4,3:packung 650@5,3:dose 241@6,3:tuete 720@7,3:becher 869@3,1:kilo',
  'r2-w6': '874@1,1:sechzig-num 868@2,1 875@4,1:siebzig-num 868@5,1 877@7,1:neunundneunzig-num 877@8,1 869@2,3:tausend-num 868@3,3 868@4,3 868@5,3',
  'r2-w3': '1033@1,2:supermarkt 1035@3,2:geschaeft 1036@5,2:laden 1034@7,2:kiosk 490@9,3:geschlossen 551@9,2:geoeffnet',
  'r2-w7': '25@1,3:kunde 24@3,3:verkaeuferin 553@5,3:korb 767@6,2:liste 749@7,3:paket 688@9,3:truhe',
  'r2-w8': '25@1,3 24@8,3 673@2,1:was-kostet-das 1057@4,1:das-ist-zu-teuer 675@6,1:ich-nehme-das 825@7,2:bar-oder-mit-karte 554@4,3',
  'r2-w4': '594@1,3:wo-ist-die-kasse 825@3,3:kann-ich-mit-karte-zahlen 965@5,2:haben-sie-brot 915@6,2:ich-haette-gern-ein-kilo-aepfel 554@8,3:stimmt-so',
  'r2-k1': '241@1,3 241@2,3 965@4,2:essen 579@5,2:trinken 553@6,3:kaufen 819@7,1:bezahlen 554@8,3:kosten',
  'r2-k5': '689@1,2:geschirr 603@3,2:teller 1013@4,2:messer 994@5,2:schuessel 720@6,2:kanne 394@4,3 394@5,3',
  'r2-k2': '562@8,2 867@2,2:fruehstueck 690@3,2:mittagessen 633@5,0:abendessen 241@6,3:sack 119@7,3:korn 119@8,3',
  'r2-k3': '691@1,3:kochen 571@3,2:finden 721@5,2:schmecken 529@6,2:moegen 25@7,3 24@8,3',
  'r2-k6': '691@1,3:topf 694@2,3:ofen 696@3,3:herd 701@5,3:kuehlschrank 695@6,2:mikrowelle 767@8,2:rezept',
  'r2-k7': '1036@1,2:restaurant 394@4,3 394@5,3 767@3,1:speisekarte 604@4,2:pizza 579@5,2:getraenk 651@6,2:nachtisch 222@7,3:kellner 220@8,3:kellnerin',
  'r2-k4': '694@1,3:backen 1013@3,2:schneiden 505@4,2:waschen 749@5,3:tragen 598@7,1:wiegen 690@8,3:braten 870@6,1:zaehlen',
};

export interface ArtTile {
  tile: number;
  col: number;
  row: number;
  word?: string;
  flip?: boolean;
}

export function parseArt(spec: string): ArtTile[] {
  return spec.split(/\s+/).filter(Boolean).map((t) => {
    const m = /^(\d+)@(\d+),(\d+)(?::([a-z0-9-]+))?(!)?$/.exec(t);
    if (!m) throw new Error(`bad art tile ${t}`);
    return { tile: +m[1], col: +m[2], row: +m[3], ...(m[4] ? { word: m[4] } : {}), ...(m[5] ? { flip: true } : {}) };
  });
}
