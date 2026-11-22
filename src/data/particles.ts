// 刻字孔 (0.6 第 6 块 细则二, 25 级): engraving a socket asks one cloze with auch or denn blanked out.
// Only A1 words from regions 1–3. Written by Claude; needs a native-speaker check.

export const PARTICLE_SENTENCES: Record<'auch' | 'denn', string[]> = {
  auch: [
    'Ich trinke Kaffee. Mein Bruder trinkt {auch} Kaffee.|我喝咖啡。我哥哥也喝咖啡。',
    'Hilde ist müde. Ich bin {auch} müde.|Hilde 累了。我也累了。',
    'Wir fahren nach Altstadt. Fährst du {auch} mit?|我们去老城。你也一起去吗？',
    'Das Brot ist frisch, und der Kuchen ist {auch} gut.|面包很新鲜，蛋糕也不错。',
    'Ich spreche Chinesisch und {auch} ein bisschen Deutsch.|我说中文，也会一点德语。',
    'Der Zug ist spät. Der Bus ist {auch} spät.|火车晚了。公交车也晚了。',
    'Ich habe Hunger. – Ich {auch}!|我饿了。——我也是！',
    'Mira verkauft Stifte und {auch} Mäntel.|Mira 卖笔，也卖外套。',
    'Am Montag arbeite ich, am Dienstag {auch}.|周一我工作，周二也是。',
    'Die Kirche ist alt. Das Rathaus ist {auch} alt.|教堂很旧。市政厅也很旧。',
    'Ich habe meine Fahrkarte verloren. Lina hat ihre {auch} verloren.|我把车票弄丢了。Lina 也丢了她的。',
    'Kommst du {auch} zum Bahnhof?|你也来火车站吗？',
    'Meine Schwester wohnt {auch} in Gleisdorf.|我姐姐也住在铁轨镇。',
    'Gute Nacht! – Dir {auch}!|晚安！——你也是！',
    'Ich brauche einen Regenschirm, und {auch} eine Jacke.|我需要一把伞，还有一件夹克。',
  ],
  denn: [
    'Wo ist {denn} der Bahnhof?|火车站到底在哪儿？',
    'Was machst du {denn} hier?|你在这儿干什么呢？',
    'Wie spät ist es {denn}?|现在几点了？',
    'Wer ist das {denn}?|那是谁啊？',
    'Warum bist du {denn} so spät?|你怎么这么晚？',
    'Was kostet das {denn}?|这个多少钱呢？',
    'Wie heißt du {denn}?|你叫什么名字呀？',
    'Wann fährt {denn} der nächste Zug?|下一班车到底几点开？',
    'Wohin gehst du {denn}?|你要去哪儿呀？',
    'Hast du {denn} keine Fahrkarte?|你难道没有车票吗？',
    'Was ist {denn} passiert?|到底发生了什么？',
    'Woher kommst du {denn}?|你是哪里人呀？',
    'Ist das {denn} dein Rucksack?|那是你的背包吗？',
    'Wo wohnst du {denn} jetzt?|你现在住哪儿呢？',
    'Was hast du {denn} gestern gemacht?|你昨天到底做了什么？',
  ],
};
