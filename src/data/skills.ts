// Sentence skills: lines the region-1 boss says. Beat it, then keep one of its sentences as a skill.

export interface Skill {
  id: string;
  de: string;
  zh: string;
  zhLine: string;
  /** 轮换句 (2026-11-21): same use, rotating. lines[0] is de/zhLine; one more unlocks every 5 casts. */
  lines: Array<{ de: string; zh: string }>;
  effect: string;
  cooldown: number;
  /** Which boss teaches it (1 = 无名的邻居, 2 = 吞秤者, 3 = 晚点之王; 4 = 秩序会声望第 2 档). */
  boss: 1 | 2 | 3 | 4;
}

/** Lines unlocked so far: the first, plus one per 5 casts. */
export function skillLinesOpen(sk: Skill, uses: number): number {
  return Math.min(sk.lines.length, 1 + Math.floor(uses / 5));
}

/** The line this cast asks for: rotates through the unlocked lines (the newest one comes up the cast it unlocks). */
export function skillLine(sk: Skill, uses: number): { de: string; zh: string } {
  const open = skillLinesOpen(sk, uses);
  const fresh = uses > 0 && uses % 5 === 0 && open > skillLinesOpen(sk, uses - 1);
  return sk.lines[fresh ? open - 1 : uses % open];
}

export const SKILLS: Record<string, Skill> = {
  keineAhnung: {
    id: 'keineAhnung',
    de: 'Ich habe keine Ahnung.',
    zh: '反弹护盾',
    zhLine: '我一点头绪都没有。',
    lines: [
      { de: 'Ich habe keine Ahnung.', zh: '我一点头绪都没有。' },
      { de: 'Das weiß ich nicht.', zh: '这个我不知道。' },
      { de: 'Keine Ahnung!', zh: '不知道！（口语）' },
      { de: 'Ich bin nicht sicher.', zh: '我不确定。' },
      { de: 'Das weiß ich leider nicht.', zh: '很遗憾，这个我不知道。' },
    ],
    effect: '挡下怪物的下一击，并反弹 20% 伤害（守护者 30%）',
    cooldown: 4,
    boss: 1,
  },
  wieBitte: {
    id: 'wieBitte',
    de: 'Wie bitte?',
    zh: '打断',
    zhLine: '您说什么？',
    lines: [
      { de: 'Wie bitte?', zh: '您说什么？' },
      { de: 'Noch einmal, bitte.', zh: '请再说一遍。' },
      { de: 'Können Sie das wiederholen?', zh: '您能重复一下吗？' },
      { de: 'Etwas langsamer, bitte.', zh: '请说慢一点。' },
      { de: 'Ich verstehe das nicht.', zh: '我听不懂。' },
    ],
    effect: '让怪物这回合的打算作废（能化解蓄满的大招）',
    cooldown: 5,
    boss: 1,
  },
  freutMich: {
    id: 'freutMich',
    de: 'Freut mich!',
    zh: '回春',
    zhLine: '很高兴认识你！',
    lines: [
      { de: 'Freut mich!', zh: '很高兴认识你！' },
      { de: 'Freut mich, Sie kennenzulernen.', zh: '很高兴认识您。（正式）' },
      { de: 'Schön, dich kennenzulernen.', zh: '很高兴认识你。（熟人口吻，用 dich）' },
      { de: 'Gleichfalls!', zh: '我也是！（回应对方的客套话）' },
    ],
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
    lines: [
      { de: 'Das ist zu teuer!', zh: '这太贵了！' },
      { de: 'Das ist mir zu teuer.', zh: '这对我来说太贵了。' },
      { de: 'Geht das billiger?', zh: '能便宜点吗？' },
      { de: 'Haben Sie etwas Billigeres?', zh: '有便宜点的吗？' },
      { de: 'Das kann ich nicht bezahlen.', zh: '这个我付不起。' },
    ],
    effect: '这回合怪物对你的伤害 −50%',
    cooldown: 4,
    boss: 2,
  },
  wieViel: {
    id: 'wieViel',
    de: 'Wie viel kostet das?',
    zh: '看穿',
    zhLine: '这个多少钱？',
    lines: [
      { de: 'Wie viel kostet das?', zh: '这个多少钱？' },
      { de: 'Was kostet der Kaffee?', zh: '咖啡多少钱？' },
      { de: 'Wie viel kosten die Äpfel?', zh: '苹果多少钱？（复数）' },
      { de: 'Was macht das zusammen?', zh: '一共多少钱？' },
      { de: 'Wie teuer ist das?', zh: '这个有多贵？' },
    ],
    effect: '接下来 2 回合，提前看到怪物下一回合的打算',
    cooldown: 5,
    boss: 2,
  },
  stimmtSo: {
    id: 'stimmtSo',
    de: 'Stimmt so.',
    zh: '不用找了',
    zhLine: '不用找了。',
    lines: [
      { de: 'Stimmt so.', zh: '不用找了。' },
      { de: 'Der Rest ist für Sie.', zh: '剩下的给您。' },
      { de: 'Passt so!', zh: '就这样，零钱不用找了。（口语）' },
      { de: 'Machen Sie zehn Euro.', zh: '收十欧就行。（凑整给小费）' },
    ],
    effect: '这场战斗里打死的怪，金币翻倍',
    cooldown: 6,
    boss: 2,
  },
  zugFaehrtAb: {
    id: 'zugFaehrtAb',
    de: 'Der Zug fährt ab!',
    zh: '发车',
    zhLine: '火车开了！',
    lines: [
      { de: 'Der Zug fährt ab!', zh: '火车开了！' },
      { de: 'Bitte einsteigen!', zh: '请上车！' },
      { de: 'Wir fahren jetzt los.', zh: '我们现在出发。' },
      { de: 'Der Zug fährt pünktlich ab.', zh: '火车准时开出。' },
    ],
    effect: '每场一次：下一题答对伤害翻倍',
    cooldown: 99,
    boss: 3,
  },
  verpasst: {
    id: 'verpasst',
    de: 'Ich habe den Zug verpasst.',
    zh: '错过',
    zhLine: '我错过了火车。',
    lines: [
      { de: 'Ich habe den Zug verpasst.', zh: '我错过了火车。' },
      { de: 'Ich bin zu spät gekommen.', zh: '我来晚了。' },
      { de: 'Der Bus ist schon abgefahren.', zh: '公交车已经开走了。' },
      { de: 'Ich habe den Bus verpasst.', zh: '我错过了公交车。' },
    ],
    effect: '每场一次：下一次答错不丢资源（铭刻失手不扣，连写不断）',
    cooldown: 99,
    boss: 3,
  },
  naechsterHalt: {
    id: 'naechsterHalt',
    de: 'Nächster Halt!',
    zh: '下一站',
    zhLine: '下一站！',
    lines: [
      { de: 'Nächster Halt!', zh: '下一站！' },
      { de: 'Nächste Station: Altstadt.', zh: '下一站：老城。' },
      { de: 'Wir steigen hier aus.', zh: '我们在这里下车。' },
      { de: 'Endstation, bitte alle aussteigen!', zh: '终点站，请全部下车！' },
    ],
    effect: '每场一次：打倒这只怪后，下一只怪护甲降一档',
    cooldown: 99,
    boss: 3,
  },
  wiederholen: {
    id: 'wiederholen',
    de: 'Könnten Sie das bitte wiederholen?',
    zh: '请再说一遍',
    zhLine: '您能再说一遍吗？',
    lines: [
      { de: 'Könnten Sie das bitte wiederholen?', zh: '您能再说一遍吗？' },
      { de: 'Noch einmal, bitte.', zh: '请再说一次。' },
      { de: 'Wie bitte? Ich habe das nicht verstanden.', zh: '什么？我没听懂。' },
      { de: 'Können Sie bitte langsamer sprechen?', zh: '您能说慢一点吗？' },
    ],
    effect: '每场一次：之后有一题可以换成同难度的另一题',
    cooldown: 99,
    boss: 4,
  },
};
