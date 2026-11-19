// Sentence skills: lines the region-1 boss says. Beat it, then keep one of its sentences as a skill.

export interface Skill {
  id: string;
  de: string;
  zh: string;
  zhLine: string;
  effect: string;
  cooldown: number;
  /** Which boss teaches it (1 = 无名的邻居, 2 = 吞秤者). */
  boss: 1 | 2;
}

export const SKILLS: Record<string, Skill> = {
  keineAhnung: {
    id: 'keineAhnung',
    de: 'Ich habe keine Ahnung.',
    zh: '反弹护盾',
    zhLine: '我一点头绪都没有。',
    effect: '挡下怪物的下一击，并反弹 20% 伤害（守护者 30%）',
    cooldown: 4,
    boss: 1,
  },
  wieBitte: {
    id: 'wieBitte',
    de: 'Wie bitte?',
    zh: '打断',
    zhLine: '您说什么？',
    effect: '让怪物这回合的打算作废（能化解蓄满的大招）',
    cooldown: 5,
    boss: 1,
  },
  freutMich: {
    id: 'freutMich',
    de: 'Freut mich!',
    zh: '回春',
    zhLine: '很高兴认识你！',
    effect: '回复 30% 生命',
    cooldown: 5,
    boss: 1,
  },
  // 吞秤者 (region 2). None of them hits every monster: that belongs to Lv35「一句话打两只」.
  zuTeuer: {
    id: 'zuTeuer',
    de: 'Das ist zu teuer!',
    zh: '压价',
    zhLine: '这太贵了！',
    effect: '这回合怪物对你的伤害 −50%',
    cooldown: 4,
    boss: 2,
  },
  wieViel: {
    id: 'wieViel',
    de: 'Wie viel kostet das?',
    zh: '看穿',
    zhLine: '这个多少钱？',
    effect: '接下来 2 回合，提前看到怪物下一回合的打算',
    cooldown: 5,
    boss: 2,
  },
  stimmtSo: {
    id: 'stimmtSo',
    de: 'Stimmt so.',
    zh: '不用找了',
    zhLine: '不用找了。',
    effect: '这场战斗里打死的怪，金币翻倍',
    cooldown: 6,
    boss: 2,
  },
};
