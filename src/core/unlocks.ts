// Mirrors 游戏设计 › 等级与功能开放 for Lv 1–10. That table is the single source of truth;
// if a level changes there, change it here.

export const UNLOCK = {
  articleAttack: 1,
  typing: 2,
  bonfireRest: 3,
  echo: 4,
  layerCount: 7,
  gear: 5,
  inscribe: 6,
  whisper: 5,
  chorus: 11,
  sentence: 6,
  layerElement: 6,
  blockBreak: 7,
  boss: 8,
  skills: 8,
  heal: 8,
  purple: 8,
  layerNegation: 9,
  classes: 10,
  shop: 11,
  chests: 11,
  flee: 11,
  packs: 11,
  plural: 11,
  conjugation: 12,
  talents: 12,
  quests: 12,
  layerObject: 13,
  boss2: 18,
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
  5: ['装备：笔、外套、护符、词典 4 个部位；打得越多，装备档位越高（伤害、生命、破甲）', '低语 W：下一题给首字母（选择题去掉一个错项），伤害减半，耗 3 言灵或 1 次词典提示'],
  6: ['铭刻：下一题难一级，答对伤害 ×1.5（冷却 4 回合）', '终结技 F：言灵攒满（打字题答对 +1，填变形 +2），看中文写整句（Ich möchte einen …），破甲', '冠词决定元素：der 冰、die 火、das 毒，怪物扔的东西也一样'],
  7: ['破防和多段：怪缩起来防御时，写对它的名字才能破防；连击怪答对只挨第一下'],
  8: ['首领「无名的邻居」：在营地东边的门后等你', '怪物会回血：Ich mache eine Pause.', '紫装：首领必掉'],
  9: ['怪物意图出现否定：nicht、kein，说了动作但不做'],
  10: ['浓雾散开：邻居家的门通向面包集市（第 2 区）', '选职业：去集市找导师 Greta，书写者或守护者'],
  11: ['商店：用德语跟商人 Mira 买东西（Ich nehme den Mantel.），也能讨价还价', '宝箱和宝箱怪：喊着 Ich muss los! 的怪，这回合打不死就跑了', '群怪：附近的怪会一起扑上来，先选中一只，再喊它的冠词（点名）；齐鸣：一题打一群', '复数：Ich nehme zwei Äpfel.，到期复习的名词也开始考复数'],
  12: ['动词怪要写出现在时变位：du nimmst、er nimmt', '天赋树：每升 1 级得 1 点，去导师 Greta 那里点', '任务：按 J 打开任务面板'],
  13: ['怪物意图带对象：Ich heile mich. 是治自己，Ich greife dich an. 是打你'],
  18: ['第 2 区首领「吞秤者」：在粮仓尽头的秤房里，考价格和数量'],
};
