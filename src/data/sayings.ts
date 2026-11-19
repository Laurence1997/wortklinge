// 接句怪 (Lv3+): about 1 monster in 8 shouts the first half of a saying, the player finishes it.
// A right answer is a sure crit and drops the saying's card into the collection (no combat effect).
// To be checked by a Tandem partner before it counts as final.

export interface Saying {
  id: string;
  /** What the monster shouts. */
  a: string;
  /** What the player answers. */
  b: string;
  zh: string;
  /** When you say it, in Chinese. */
  when: string;
}

export const SAYINGS: Saying[] = [
  { id: 'sicher', a: 'Sicher ist', b: 'sicher', zh: '保险起见', when: '多做一步确认时，比如出门前再检查一次钥匙' },
  { id: 'klar', a: 'Alles', b: 'klar', zh: '明白了 / 一切都好', when: '听懂了安排，或者别人问你还好吗' },
  { id: 'problem', a: 'Kein', b: 'Problem', zh: '没问题', when: '别人道谢或请你帮个小忙' },
  { id: 'sehen', a: 'Mal', b: 'sehen', zh: '再看吧', when: '还没决定，不想马上答应' },
  { id: 'endeGut', a: 'Ende gut,', b: 'alles gut', zh: '结局好一切都好', when: '一波三折之后总算顺利收尾' },
  { id: 'anfang', a: 'Aller Anfang', b: 'ist schwer', zh: '万事开头难', when: '安慰刚开始学新东西、做新工作的人' },
  { id: 'spaet', a: 'Lieber spät', b: 'als nie', zh: '迟到总比不到好', when: '有人来晚了，或者很晚才开始做某事' },
  { id: 'uebung', a: 'Übung macht', b: 'den Meister', zh: '熟能生巧', when: '鼓励别人多练' },
  { id: 'glueck', a: 'Viel', b: 'Glück!', zh: '祝你好运', when: '别人要考试、面试之前' },
  { id: 'besserung', a: 'Gute', b: 'Besserung!', zh: '早日康复', when: '别人生病了' },
  { id: 'wochenende', a: 'Schönes', b: 'Wochenende!', zh: '周末愉快', when: '周五和同事、店员道别' },
  { id: 'morgen', a: 'Bis', b: 'morgen!', zh: '明天见', when: '和明天还会见到的人道别' },
  { id: 'ahnung', a: 'Keine', b: 'Ahnung', zh: '不知道', when: '口语里随口说不知道（对长辈、陌生人用 Das weiß ich nicht）' },
  { id: 'egal', a: 'Das ist mir', b: 'egal', zh: '我无所谓', when: '口语，选哪个都行；语气重了会显得不在乎，慎用' },
  { id: 'zeit', a: 'Zeit ist', b: 'Geld', zh: '时间就是金钱', when: '催人别磨蹭' },
  { id: 'ordnung', a: 'Ordnung', b: 'muss sein', zh: '规矩不能乱', when: '半开玩笑地说德国人爱守规矩，比如垃圾分类' },
  { id: 'nochEinTag', a: 'Morgen ist auch', b: 'noch ein Tag', zh: '明天还来得及', when: '劝人今天别熬了，明天再做' },
  { id: 'sitten', a: 'Andere Länder,', b: 'andere Sitten', zh: '入乡随俗 / 各地风俗不同', when: '碰到和家乡不一样的习惯' },
  { id: 'kopf', a: 'Kopf', b: 'hoch!', zh: '振作起来', when: '别人失败了、心情低落' },
  { id: 'bitte', a: 'Wie', b: 'bitte?', zh: '请再说一遍', when: '没听清对方说什么（比 Was? 礼貌）' },
];

export const SAYING_BY_ID: Record<string, Saying> = Object.fromEntries(SAYINGS.map((x) => [x.id, x]));

export const SAYING_CFG = {
  fromLevel: 3,
  /** Chance that a single (non-pack) monster is a 接句怪. */
  chance: 1 / 8,
  /** From this level the second half is typed instead of picked from three. */
  typedFrom: 6,
};
