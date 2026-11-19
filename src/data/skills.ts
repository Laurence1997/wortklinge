// Sentence skills: lines the region-1 boss says. Beat it, then keep one of its sentences as a skill.

export interface Skill {
  id: string;
  de: string;
  zh: string;
  zhLine: string;
  effect: string;
  cooldown: number;
}

export const SKILLS: Record<string, Skill> = {
  keineAhnung: {
    id: 'keineAhnung',
    de: 'Ich habe keine Ahnung.',
    zh: '反弹护盾',
    zhLine: '我一点头绪都没有。',
    effect: '挡下怪物的下一击，并反弹一半伤害',
    cooldown: 4,
  },
  wieBitte: {
    id: 'wieBitte',
    de: 'Wie bitte?',
    zh: '打断',
    zhLine: '您说什么？',
    effect: '让怪物这回合的打算作废（能化解蓄满的大招）',
    cooldown: 5,
  },
  freutMich: {
    id: 'freutMich',
    de: 'Freut mich!',
    zh: '回春',
    zhLine: '很高兴认识你！',
    effect: '回复 30% 生命',
    cooldown: 5,
  },
};
