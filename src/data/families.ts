import type { FamilyId, IntentKind } from '../core/types';

export interface Family {
  id: FamilyId;
  zh: string;
  de: string;
  /** Flavour text for the 图鉴. */
  lore: string;
  /** The family's own attack verb, 1st person singular + infinitive (for the recap). */
  verb: { ich: string; inf: string; zh: string };
  /** Tendency table: weights per intent (heal only once heal is unlocked). */
  tendency: Partial<Record<IntentKind, number>>;
  /** Glyph colour accent before the article colour is revealed. */
  glyph: string;
}

export const FAMILIES: Record<FamilyId, Family> = {
  zahnding: {
    id: 'zahnding',
    zh: '牙物',
    de: 'Zahnding',
    lore: '失去名字的日常物品，长出了牙。叫对它的名字，牙就会一颗颗掉下来。',
    verb: { ich: 'beiße', inf: 'beißen', zh: '咬' },
    tendency: { attack: 60, defend: 25, charge: 15, heal: 10 },
    glyph: '▓',
  },
  echo: {
    id: 'echo',
    zh: '回声',
    de: 'Echo',
    lore: '说话的人不在了，问候还在街上来回喊。它们只会重复自己最后一句话。',
    verb: { ich: 'schreie', inf: 'schreien', zh: '尖叫' },
    tendency: { attack: 45, defend: 15, charge: 40, heal: 10 },
    glyph: '░',
  },
  schild: {
    id: 'schild',
    zh: '名牌',
    de: 'Namensschild',
    lore: '挂在门口、别在胸前的名牌，忘了自己属于谁。它们最怕被问「你叫什么」。',
    verb: { ich: 'kratze', inf: 'kratzen', zh: '抓' },
    tendency: { attack: 45, defend: 40, charge: 15, heal: 10 },
    glyph: '▒',
  },
  zahlwurm: {
    id: 'zahlwurm',
    zh: '数虫',
    de: 'Zahlwurm',
    lore: '一节一节的数字爬虫。它们最喜欢数自己要扎你几下。',
    verb: { ich: 'steche', inf: 'stechen', zh: '刺' },
    tendency: { attack: 70, defend: 15, charge: 15, heal: 5 },
    glyph: '#',
  },
  sippe: {
    id: 'sippe',
    zh: '影亲',
    de: 'Schattensippe',
    lore: '灰烬公寓里，家人的影子还在饭桌旁等着。它们护着彼此，也会一起扑上来。',
    verb: { ich: 'schlage', inf: 'schlagen', zh: '打' },
    tendency: { attack: 50, defend: 30, charge: 20, heal: 15 },
    glyph: '▚',
  },
  krume: {
    id: 'krume',
    zh: '碎屑兽',
    de: 'Krümel',
    lore: '集市上没卖掉的食物长出了嘴。它们饿，比你还饿。',
    verb: { ich: 'fresse', inf: 'fressen', zh: '吞' },
    tendency: { attack: 55, defend: 20, charge: 25, heal: 15 },
    glyph: '▙',
  },
  muenzling: {
    id: 'muenzling',
    zh: '铜板虫',
    de: 'Münzling',
    lore: '硬币、价签和收据串成的虫子。问它多少钱，它就掐你一下。',
    verb: { ich: 'zwicke', inf: 'zwicken', zh: '掐' },
    tendency: { attack: 60, defend: 25, charge: 15, heal: 10 },
    glyph: '¤',
  },
  kram: {
    id: 'kram',
    zh: '杂货',
    de: 'Kram',
    lore: '粮仓里的锅碗瓢盆，叮叮当当地互相撞着，等人叫出它们的名字。',
    verb: { ich: 'quetsche', inf: 'quetschen', zh: '夹' },
    tendency: { attack: 45, defend: 35, charge: 20, heal: 10 },
    glyph: '▟',
  },
  gier: {
    id: 'gier',
    zh: '贪念',
    de: 'Gier',
    lore: '「要」「吃」「买」这些动作脱离了做它们的人，自己在粮仓里游荡。',
    verb: { ich: 'packe', inf: 'packen', zh: '抓' },
    tendency: { attack: 50, defend: 20, charge: 30, heal: 15 },
    glyph: '§',
  },
  truhe: {
    id: 'truhe',
    zh: '宝箱怪',
    de: 'Truhe',
    lore: '背着一只铁箱到处跑的东西。打得太慢，它就喊着 Ich muss los! 溜走。',
    verb: { ich: 'beiße', inf: 'beißen', zh: '咬' },
    tendency: { attack: 40, defend: 40, charge: 20 },
    glyph: '▣',
  },
  fahrzeug: {
    id: 'fahrzeug',
    zh: '空车',
    de: 'Leerfahrzeug',
    lore: '没有司机的车票、车厢和行李，按着早已作废的时刻表在站前街上来回开。',
    verb: { ich: 'ramme', inf: 'rammen', zh: '撞' },
    tendency: { attack: 55, defend: 25, charge: 20, heal: 10 },
    glyph: '◫',
  },
  nachhall: {
    id: 'nachhall',
    zh: '余响',
    de: 'Nachhall',
    lore: '已经做完的事还在铁轨镇回荡：上车、下车、等过的车。它们只记得自己「做过了」。',
    verb: { ich: 'halle', inf: 'hallen', zh: '回荡' },
    tendency: { attack: 50, defend: 20, charge: 30, heal: 15 },
    glyph: '≈',
  },
  wegweiser: {
    id: 'wegweiser',
    zh: '路标鬼',
    de: 'Wegweiser',
    lore: '老城路口的路牌、门牌和楼层号，全都指向错误的方向。问路的人最后都站在原地。',
    verb: { ich: 'stoße', inf: 'stoßen', zh: '推' },
    tendency: { attack: 45, defend: 35, charge: 20, heal: 10 },
    glyph: '↱',
  },
  uhrwerk: {
    id: 'uhrwerk',
    zh: '钟虫',
    de: 'Uhrwerk',
    lore: '时刻表大厅里拆散的齿轮和指针。它们晚点，却总说自己准时。',
    verb: { ich: 'ticke', inf: 'ticken', zh: '滴答敲' },
    tendency: { attack: 50, defend: 25, charge: 25, heal: 10 },
    glyph: '◷',
  },
};

/** A1 phrase bank (游戏设计 › 同一个意图，不同的说法). Lines marked * in the doc are game-only. */
export const PHRASES: Record<'attack' | 'defend' | 'charge' | 'heal', Array<[string, string]>> = {
  attack: [
    ['Pass auf!', '小心！（要攻击了）'],
    ['Vorsicht!', '当心！（要攻击了）'],
    ['Achtung, ich komme!', '注意，我来了！'],
    ['Los geht’s!', '开始了！（要攻击了）'],
    ['Jetzt bist du dran!', '现在轮到你了！（要攻击了）'],
    ['Ich greife an!', '我要进攻！'],
  ],
  defend: [
    ['Nein, danke!', '不用了，谢谢！（要防御）'],
    ['Lass mich in Ruhe!', '别烦我！（要防御）'],
    ['Nicht mit mir!', '休想！（要防御）'],
    ['Ich verteidige mich.', '我要防守。'],
  ],
  charge: [
    ['Moment!', '等一下！（在蓄力）'],
    ['Einen Moment, bitte …', '请稍等……（在蓄力）'],
    ['Warte mal …', '等等……（在蓄力）'],
    ['Gleich!', '马上！（在蓄力）'],
    ['Ich sammle meine Kraft …', '我在积蓄力量……'],
  ],
  heal: [
    ['Ich mache eine Pause.', '我休息一下。（要回血）'],
    ['Ich esse etwas.', '我吃点东西。（要回血）'],
    ['Ich trinke einen Tee.', '我喝杯茶。（要回血）'],
    ['Das tut gut.', '真舒服。（在回血）'],
    ['Ich heile mich.', '我治疗自己。'],
  ],
};

/** Nouns monsters throw (element layer). Accusative definite article. */
export const THROWABLES: Array<{ akk: string; de: string; g: 'm' | 'f' | 'n'; zh: string }> = [
  { akk: 'den', de: 'Stuhl', g: 'm', zh: '椅子' },
  { akk: 'den', de: 'Schlüssel', g: 'm', zh: '钥匙' },
  { akk: 'den', de: 'Schuh', g: 'm', zh: '鞋' },
  { akk: 'den', de: 'Koffer', g: 'm', zh: '行李箱' },
  { akk: 'die', de: 'Tasse', g: 'f', zh: '杯子' },
  { akk: 'die', de: 'Flasche', g: 'f', zh: '瓶子' },
  { akk: 'die', de: 'Lampe', g: 'f', zh: '灯' },
  { akk: 'die', de: 'Uhr', g: 'f', zh: '钟' },
  { akk: 'das', de: 'Glas', g: 'n', zh: '玻璃杯' },
  { akk: 'das', de: 'Buch', g: 'n', zh: '书' },
  { akk: 'das', de: 'Handy', g: 'n', zh: '手机' },
  { akk: 'das', de: 'Brot', g: 'n', zh: '面包' },
];
