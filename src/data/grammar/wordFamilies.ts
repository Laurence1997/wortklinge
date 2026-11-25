// 词族秘境 (37 级) sample data: a base word of the list and family members built from it (构词: -ung, -er, -heit,
// -keit, -chen, ab-/an-/ver- …). A first sample of families; the 6000-word list's 词族 column fills the rest.
// Written by Claude; goes through the auto-proofreading pipeline.

export interface FamMember {
  de: string;
  /** Article for nouns. */
  art?: 'der' | 'die' | 'das';
  zh: string;
  /** The word-building rule it shows (shown after answering). */
  how: string;
}

export const WORD_FAMILIES: Record<string, FamMember[]> = {
  fahren: [
    { de: 'Fahrt', art: 'die', zh: '行程', how: '动词词干 → 名词 die Fahrt' },
    { de: 'Fahrer', art: 'der', zh: '司机', how: '词干 + -er：做这件事的人（阳性）' },
    { de: 'abfahren', zh: '出发', how: 'ab- 离开' },
    { de: 'Abfahrt', art: 'die', zh: '出发；发车', how: 'ab- + Fahrt' },
  ],
  arbeiten: [
    { de: 'Arbeit', art: 'die', zh: '工作', how: '去掉 -en 得名词' },
    { de: 'Arbeiter', art: 'der', zh: '工人', how: '-er：做这件事的人' },
    { de: 'Arbeitszeit', art: 'die', zh: '工作时间', how: '复合词：性别跟最后一个词（die Zeit）' },
  ],
  wohnen: [
    { de: 'Wohnung', art: 'die', zh: '公寓', how: '-ung 结尾的名词都是 die' },
    { de: 'Wohnzimmer', art: 'das', zh: '客厅', how: '复合词：性别跟最后一个词（das Zimmer）' },
    { de: 'Bewohner', art: 'der', zh: '居民', how: 'be- + -er：住在某处的人' },
  ],
  lesen: [
    { de: 'Leser', art: 'der', zh: '读者', how: '-er：做这件事的人' },
    { de: 'vorlesen', zh: '朗读（给别人听）', how: 'vor- 在别人面前' },
  ],
  schreiben: [
    { de: 'Schreibtisch', art: 'der', zh: '书桌', how: '复合词：性别跟最后一个词（der Tisch）' },
    { de: 'aufschreiben', zh: '记下来', how: 'auf- 写到纸上' },
    { de: 'unterschreiben', zh: '签字', how: 'unter- 写在下面' },
  ],
  kaufen: [
    { de: 'Kauf', art: 'der', zh: '购买', how: '去掉 -en 得名词（多为 der）' },
    { de: 'Verkäufer', art: 'der', zh: '售货员', how: 'ver- 卖 + -er：卖东西的人' },
    { de: 'einkaufen', zh: '购物', how: 'ein- 买进来' },
  ],
  spielen: [
    { de: 'Spiel', art: 'das', zh: '游戏；比赛', how: '去掉 -en 得名词' },
    { de: 'Spieler', art: 'der', zh: '玩家；运动员', how: '-er：做这件事的人' },
  ],
  fliegen: [
    { de: 'Flug', art: 'der', zh: '航班', how: '变元音的名词 der Flug' },
    { de: 'Flughafen', art: 'der', zh: '机场', how: '复合词：性别跟最后一个词（der Hafen）' },
  ],
  sprechen: [
    { de: 'Sprache', art: 'die', zh: '语言', how: '变元音的名词 die Sprache' },
    { de: 'Gespräch', art: 'das', zh: '谈话', how: 'Ge- 开头的名词多为 das' },
    { de: 'besprechen', zh: '商量', how: 'be- 让动词带宾语' },
  ],
  krank: [
    { de: 'Krankheit', art: 'die', zh: '疾病', how: '-heit 结尾的名词都是 die' },
    { de: 'Krankenhaus', art: 'das', zh: '医院', how: '复合词：性别跟最后一个词（das Haus）' },
  ],
  frei: [
    { de: 'Freiheit', art: 'die', zh: '自由', how: '-heit 结尾的名词都是 die' },
    { de: 'Freizeit', art: 'die', zh: '空闲时间', how: '复合词：性别跟最后一个词（die Zeit）' },
  ],
  Haus: [
    { de: 'Häuschen', art: 'das', zh: '小房子', how: '-chen 结尾（变小）的名词都是 das' },
    { de: 'Hausaufgabe', art: 'die', zh: '家庭作业', how: '复合词：性别跟最后一个词（die Aufgabe）' },
  ],
  Freund: [
    { de: 'Freundin', art: 'die', zh: '女朋友；女性朋友', how: '-in：女性，都是 die' },
    { de: 'freundlich', zh: '友好的', how: '-lich 把名词变成形容词' },
    { de: 'Freundschaft', art: 'die', zh: '友谊', how: '-schaft 结尾的名词都是 die' },
  ],
};

/** 构词层: suffixes that fix the gender (shown in the 词族秘境's 构词 floor). */
export const SUFFIX_GENDER: Array<{ suf: string; art: 'der' | 'die' | 'das'; rule: string }> = [
  { suf: 'ung', art: 'die', rule: '-ung 结尾都是 die' },
  { suf: 'heit', art: 'die', rule: '-heit 结尾都是 die' },
  { suf: 'keit', art: 'die', rule: '-keit 结尾都是 die' },
  { suf: 'schaft', art: 'die', rule: '-schaft 结尾都是 die' },
  { suf: 'in', art: 'die', rule: '-in（女性）都是 die' },
  { suf: 'chen', art: 'das', rule: '-chen（变小）都是 das' },
  { suf: 'ment', art: 'das', rule: '-ment 结尾多为 das' },
  { suf: 'ismus', art: 'der', rule: '-ismus 结尾都是 der' },
];
