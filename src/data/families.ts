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
