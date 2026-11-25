// 告示怪 / 信件怪 (15 级, 游戏设计 十六 + Lucas 2026-11-25 「先框架和 5–10 篇样文」): a monster carrying a short
// notice or letter of its scene; its attack questions ask what the text says. One sample per field zone for now;
// the full set follows the 6000-word scenes. Written by Claude; goes through the auto-proofreading pipeline.

export interface NoticeQ {
  /** The question, in Chinese. */
  q: string;
  options: string[];
  answer: string;
}

export interface Notice {
  id: string;
  zone: string;
  kind: 'notice' | 'letter';
  title: string;
  text: string;
  qs: NoticeQ[];
}

export const NOTICES: Notice[] = [
  {
    id: 'aschehof-feuer',
    zone: 'aschehof',
    kind: 'notice',
    title: 'Am Lagerfeuer',
    text: 'Liebe Gäste!\nDas Feuer brennt jeden Tag von 18 bis 23 Uhr.\nBitte kein Essen ins Feuer werfen.\nHolz liegt hinter dem Haus.',
    qs: [
      { q: '营火几点灭？', options: ['18 点', '23 点', '20 点'], answer: '23 点' },
      { q: '不能往火里扔什么？', options: ['木头', '吃的', '纸'], answer: '吃的' },
      { q: '木头在哪儿？', options: ['屋子后面', '火旁边', '门口'], answer: '屋子后面' },
    ],
  },
  {
    id: 'echogasse-brief',
    zone: 'echogasse',
    kind: 'letter',
    title: 'Ein Zettel an der Tür',
    text: 'Hallo Nachbar,\nich heiße Anna und wohne jetzt im zweiten Stock.\nAm Samstag feiere ich meinen Geburtstag. Es wird ein bisschen laut. Sorry!\nDu bist herzlich eingeladen.\nAnna',
    qs: [
      { q: 'Anna 住几楼？', options: ['一楼', '二楼', '三楼'], answer: '二楼' },
      { q: '星期六有什么事？', options: ['搬家', '过生日', '装修'], answer: '过生日' },
      { q: 'Anna 想让邻居做什么？', options: ['安静一点', '来参加', '帮忙搬东西'], answer: '来参加' },
    ],
  },
  {
    id: 'schilderstrasse-baustelle',
    zone: 'schilderstrasse',
    kind: 'notice',
    title: 'Baustelle',
    text: 'Achtung! Die Straße ist vom 3. bis 14. Mai gesperrt.\nFußgänger gehen bitte links über die Brücke.\nDer Bus fährt in dieser Zeit nicht.',
    qs: [
      { q: '路封到哪天？', options: ['5 月 3 日', '5 月 14 日', '4 月 14 日'], answer: '5 月 14 日' },
      { q: '行人怎么走？', options: ['从左边过桥', '从右边走', '坐公交'], answer: '从左边过桥' },
      { q: '这段时间公交车怎样？', options: ['照常开', '不开', '改晚上开'], answer: '不开' },
    ],
  },
  {
    id: 'gemuesegasse-angebot',
    zone: 'gemuesegasse',
    kind: 'notice',
    title: 'Angebot der Woche',
    text: 'Heute frisch: Tomaten 1 kg nur 2,50 €.\nÄpfel aus der Region: 3 kg für 4 €.\nKartoffeln sind leider aus.\nWir haben Montag bis Samstag offen.',
    qs: [
      { q: '一公斤番茄多少钱？', options: ['2.50 欧', '4 欧', '1 欧'], answer: '2.50 欧' },
      { q: '今天没有什么？', options: ['苹果', '土豆', '番茄'], answer: '土豆' },
      { q: '星期天开门吗？', options: ['开', '不开', '只开上午'], answer: '不开' },
    ],
  },
  {
    id: 'waagegasse-waage',
    zone: 'waagegasse',
    kind: 'notice',
    title: 'Die Waage',
    text: 'Bitte das Obst selbst wiegen.\nLegen Sie die Tüte auf die Waage und drücken Sie die Nummer.\nDann kleben Sie den Zettel auf die Tüte.\nDanke!',
    qs: [
      { q: '水果谁来称？', options: ['店员', '顾客自己', '收银员'], answer: '顾客自己' },
      { q: '称完要做什么？', options: ['把标签贴在袋子上', '直接付钱', '交给店员'], answer: '把标签贴在袋子上' },
    ],
  },
  {
    id: 'kornspeicher-brief',
    zone: 'kornspeicher',
    kind: 'letter',
    title: 'Eine Nachricht vom Bäcker',
    text: 'Lieber Kunde,\nunser Mehl kommt diese Woche erst am Donnerstag.\nBis dahin gibt es nur Brötchen, kein Brot.\nWir bitten um Verständnis.\nIhr Bäcker Konrad',
    qs: [
      { q: '面粉什么时候到？', options: ['星期二', '星期四', '星期六'], answer: '星期四' },
      { q: '在那之前有什么卖？', options: ['只有面包', '只有小面包', '什么都没有'], answer: '只有小面包' },
    ],
  },
  {
    id: 'bahnhofstrasse-fundbuero',
    zone: 'bahnhofstrasse',
    kind: 'notice',
    title: 'Fundbüro',
    text: 'Etwas verloren?\nDas Fundbüro ist im Bahnhof, Gleis 1, neben dem Kiosk.\nÖffnungszeiten: Mo–Fr 9–17 Uhr.\nBitte bringen Sie Ihren Ausweis mit.',
    qs: [
      { q: '失物招领处在哪儿？', options: ['1 站台报亭旁边', '售票处里面', '出口外面'], answer: '1 站台报亭旁边' },
      { q: '去的时候要带什么？', options: ['车票', '证件', '照片'], answer: '证件' },
      { q: '星期六开吗？', options: ['开', '不开', '只开上午'], answer: '不开' },
    ],
  },
  {
    id: 'fahrplanhalle-verspaetung',
    zone: 'fahrplanhalle',
    kind: 'notice',
    title: 'Information',
    text: 'Der Zug nach Hamburg hat heute 20 Minuten Verspätung.\nEr fährt von Gleis 5, nicht von Gleis 3.\nDer Zug nach Köln fällt leider aus.',
    qs: [
      { q: '去汉堡的车晚多久？', options: ['5 分钟', '20 分钟', '3 分钟'], answer: '20 分钟' },
      { q: '它从几站台开？', options: ['3 站台', '5 站台', '20 站台'], answer: '5 站台' },
      { q: '去科隆的车怎么了？', options: ['取消了', '提前了', '换站台了'], answer: '取消了' },
    ],
  },
];
