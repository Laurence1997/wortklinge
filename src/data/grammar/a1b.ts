// A1 补全第二批 (游戏设计 十六「语法线」A1 补: nicht 的位置、时间介词、与格代词 mir / dir + helfen 等).
// Hand-written frames; sentences are short and checked against the usual A1 patterns (Tatoeba-style, no textbook text).

/** 时间介词 (10 级): which preposition a time word takes, and two frames per word (`___` = prep + article form). */
export const TIME_PREP: Record<string, { ans: string; frames: Array<[string, string]> }> = {
  Montag: { ans: 'am', frames: [['___ Montag gehe ich zur Arbeit.', '星期一我去上班。'], ['Wir sehen uns ___ Montag.', '我们星期一见。']] },
  Dienstag: { ans: 'am', frames: [['___ Dienstag habe ich Deutschkurs.', '星期二我有德语课。'], ['Der Arzt hat ___ Dienstag offen.', '医生星期二开门。']] },
  Mittwoch: { ans: 'am', frames: [['___ Mittwoch kaufe ich ein.', '星期三我去买东西。'], ['Kommst du ___ Mittwoch?', '你星期三来吗？']] },
  Donnerstag: { ans: 'am', frames: [['___ Donnerstag arbeite ich lange.', '星期四我工作到很晚。'], ['Das Paket kommt ___ Donnerstag.', '包裹星期四到。']] },
  Freitag: { ans: 'am', frames: [['___ Freitag gehen wir essen.', '星期五我们出去吃饭。'], ['Ich habe ___ Freitag frei.', '我星期五休息。']] },
  Samstag: { ans: 'am', frames: [['___ Samstag schlafe ich lange.', '星期六我睡懒觉。'], ['Der Markt ist ___ Samstag.', '集市在星期六。']] },
  Sonntag: { ans: 'am', frames: [['___ Sonntag ist der Supermarkt zu.', '星期天超市关门。'], ['Was machst du ___ Sonntag?', '你星期天做什么？']] },
  Wochenende: { ans: 'am', frames: [['___ Wochenende besuche ich meine Eltern.', '周末我去看父母。'], ['Was machst du ___ Wochenende?', '你周末做什么？']] },
  Morgen: { ans: 'am', frames: [['___ Morgen trinke ich Kaffee.', '早上我喝咖啡。'], ['Ich dusche ___ Morgen.', '我早上洗澡。']] },
  Vormittag: { ans: 'am', frames: [['___ Vormittag bin ich im Büro.', '上午我在办公室。'], ['Der Termin ist ___ Vormittag.', '预约在上午。']] },
  Mittag: { ans: 'am', frames: [['___ Mittag esse ich in der Kantine.', '中午我在食堂吃饭。'], ['Wir treffen uns ___ Mittag.', '我们中午见面。']] },
  Nachmittag: { ans: 'am', frames: [['___ Nachmittag gehe ich spazieren.', '下午我去散步。'], ['Hast du ___ Nachmittag Zeit?', '你下午有时间吗？']] },
  Abend: { ans: 'am', frames: [['___ Abend sehe ich fern.', '晚上我看电视。'], ['Wir kochen ___ Abend zusammen.', '我们晚上一起做饭。']] },
  Nacht: { ans: 'in der', frames: [['___ Nacht schlafe ich.', '夜里我睡觉。'], ['Es ist ___ Nacht sehr kalt.', '夜里很冷。']] },
  Uhr: { ans: 'um', frames: [['Der Zug fährt ___ acht Uhr.', '火车八点开。'], ['Ich stehe ___ sieben Uhr auf.', '我七点起床。']] },
  Januar: { ans: 'im', frames: [['___ Januar ist es kalt.', '一月很冷。'], ['Ich habe ___ Januar Geburtstag.', '我一月过生日。']] },
  Mai: { ans: 'im', frames: [['___ Mai blühen die Bäume.', '五月树开花。'], ['Wir fahren ___ Mai nach Italien.', '我们五月去意大利。']] },
  Juli: { ans: 'im', frames: [['___ Juli ist es heiß.', '七月很热。'], ['Ich habe ___ Juli Urlaub.', '我七月休假。']] },
  Dezember: { ans: 'im', frames: [['___ Dezember ist Weihnachten.', '十二月是圣诞节。'], ['Es schneit oft ___ Dezember.', '十二月常下雪。']] },
  Frühling: { ans: 'im', frames: [['___ Frühling ist es warm.', '春天很暖和。'], ['Ich ziehe ___ Frühling um.', '我春天搬家。']] },
  Sommer: { ans: 'im', frames: [['___ Sommer gehe ich schwimmen.', '夏天我去游泳。'], ['Es ist ___ Sommer lange hell.', '夏天天黑得晚。']] },
  Herbst: { ans: 'im', frames: [['___ Herbst regnet es viel.', '秋天雨多。'], ['Das Semester beginnt ___ Herbst.', '学期秋天开始。']] },
  Winter: { ans: 'im', frames: [['___ Winter ist es dunkel.', '冬天天黑得早。'], ['Ich trage ___ Winter eine Mütze.', '冬天我戴帽子。']] },
};

/** 与格代词 (15 级): verbs whose person takes the dative (mir / dir / ihm / ihr / uns / euch / Ihnen). */
export const DAT_VERBS: Record<string, Array<[string, string, string]>> = {
  // [sentence with ___, answer, Chinese]
  helfen: [['Kannst du ___ helfen?', 'mir', '你能帮我吗？'], ['Ich helfe ___ gern.', 'dir', '我很乐意帮你。'], ['Wir helfen ___ beim Umzug.', 'ihm', '我们帮他搬家。']],
  gefallen: [['Die Stadt gefällt ___ sehr.', 'mir', '我很喜欢这座城市。'], ['Gefällt ___ das Kleid?', 'dir', '你喜欢这条裙子吗？'], ['Das Buch gefällt ___.', 'ihr', '她喜欢这本书。']],
  schmecken: [['Der Kuchen schmeckt ___ gut.', 'mir', '这蛋糕我觉得好吃。'], ['Schmeckt ___ die Suppe?', 'dir', '汤你觉得好喝吗？'], ['Das Essen schmeckt ___ nicht.', 'uns', '我们觉得饭不好吃。']],
  gehören: [['Das Handy gehört ___.', 'mir', '手机是我的。'], ['Gehört die Tasche ___?', 'dir', '包是你的吗？'], ['Der Schlüssel gehört ___.', 'ihm', '钥匙是他的。']],
  danken: [['Ich danke ___ für die Hilfe.', 'dir', '谢谢你的帮助。'], ['Wir danken ___ sehr.', 'Ihnen', '我们非常感谢您。']],
  geben: [['Gib ___ bitte das Salz.', 'mir', '请把盐递给我。'], ['Ich gebe ___ das Geld morgen.', 'dir', '我明天把钱给你。']],
  zeigen: [['Zeig ___ bitte das Foto.', 'mir', '请给我看看照片。'], ['Ich zeige ___ den Weg.', 'Ihnen', '我给您指路。']],
  schreiben: [['Schreib ___ eine Nachricht.', 'mir', '给我发条消息。'], ['Ich schreibe ___ morgen.', 'dir', '我明天给你写信。']],
  bringen: [['Bringen Sie ___ bitte die Rechnung.', 'mir', '请给我拿账单。'], ['Ich bringe ___ einen Kaffee.', 'dir', '我给你带杯咖啡。']],
  antworten: [['Bitte antworte ___ schnell.', 'mir', '请快点回复我。'], ['Ich antworte ___ morgen.', 'Ihnen', '我明天回复您。']],
  passen: [['Der Termin passt ___ gut.', 'mir', '这个时间我很合适。'], ['Passt ___ Montag?', 'dir', '星期一你方便吗？']],
};

/** The Chinese person each dative pronoun stands for (shown so the answer is never a guess). */
export const DAT_PRON_ZH: Record<string, string> = { mir: '我', dir: '你', ihm: '他', ihr: '她', uns: '我们', euch: '你们', Ihnen: '您' };
