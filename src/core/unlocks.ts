// Mirrors 游戏设计 › 等级与功能开放 for Lv 1–10. That table is the single source of truth;
// if a level changes there, change it here.

export const UNLOCK = {
  articleAttack: 1,
  typing: 2,
  bonfireRest: 3,
  echo: 4,
  layerCount: 4,
  gear: 5,
  sentence: 6,
  layerElement: 6,
  blockBreak: 7,
  boss: 8,
  skills: 8,
  heal: 8,
  purple: 8,
  layerNegation: 9,
  classes: 10,
} as const;

export type Feature = keyof typeof UNLOCK;

export function has(level: number, f: Feature): boolean {
  return level >= UNLOCK[f];
}

/** Chinese one-liners for the level-up banner (what opened at this level). */
export const UNLOCK_TEXT: Record<number, string[]> = {
  2: ['打字默写：用键盘打出单词，ä ö ü ß 可以点按钮，也可以写成 ae oe ue ss'],
  3: ['篝火：休息回满血，到期的词会重新变成怪物（遗忘刷新）', '归名进度：怪物重生时牙会越来越少'],
  4: ['死亡和回响：死了不丢学习进度，金币和经验留在杀死你的那个词上', '怪物意图开始带次数：zweimal、dreimal'],
  5: ['装备：笔、外套、护符、词典 4 个部位'],
  6: ['句式攻击：Ich möchte + einen / eine / ein + 名词', '冠词决定元素：der 冰、die 火、das 毒，怪物扔的东西也一样'],
  7: ['格挡和破防：三种招式学全，攻击克蓄力，格挡克攻击，破防克防御'],
  8: ['首领「无名的邻居」：在营地东边的门后等你', '怪物会回血：Ich mache eine Pause.', '紫装：首领必掉'],
  9: ['怪物意图出现否定：nicht、kein，说了动作但不做'],
  10: ['选职业和大地图在面包集市（第 2 区，下一版开放）'],
};
