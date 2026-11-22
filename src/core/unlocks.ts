// Mirrors 游戏设计 › 等级与功能开放 for Lv 1–10. That table is the single source of truth;
// if a level changes there, change it here.

export const UNLOCK = {
  articleAttack: 1,
  typing: 2,
  bonfireRest: 3,
  echo: 4,
  layerCount: 7,
  gear: 3,
  inscribe: 4,
  whisper: 4,
  shadowing: 5,
  chorus: 11,
  sentence: 5,
  layerElement: 6,
  blockBreak: 7,
  boss: 8,
  skills: 8,
  heal: 8,
  purple: 8,
  layerNegation: 9,
  affinity: 9,
  classes: 10,
  shop: 7,
  chests: 11,
  flee: 11,
  packs: 11,
  plural: 11,
  und: 13,
  conjugation: 6,
  conjStrong: 12,
  talents: 12,
  quests: 12,
  layerObject: 13,
  boss2: 18,
  boss3: 28,
} as const;

export type Feature = keyof typeof UNLOCK;

export function has(level: number, f: Feature): boolean {
  return level >= UNLOCK[f];
}

/** Chinese one-liners for the level-up banner (what opened at this level). */
export const UNLOCK_TEXT: Record<number, string[]> = {
  2: ['打字默写：用键盘打出单词，ä ö ü ß 可以点按钮，也可以写成 ae oe ue ss'],
  3: ['篝火：休息回满血，到期的词会重新变成怪物（遗忘刷新）', '归名进度：怪物重生时牙会越来越少', '装备：笔、外套、护符、词典 4 个部位；打得越多，装备档位越高（伤害、生命、破甲）'],
  4: ['死亡和回响：死了不丢学习进度，金币和经验留在杀死你的那个词上', '怪物意图开始带次数：zweimal、dreimal', '铭刻 Q：下一题难一级，答对伤害 ×1.5，答错丢 1 点言灵，不限次数', '低语 W：下一题给首字母（选择题去掉一个错项），不耗资源，但那题不算会写、不回言灵、不能归名；下次见到它先不带提示再考', '言灵：打中弱点、答对打字题都攒言灵（最多 5 点），铭刻答错扣 1 点；5 级起攒满能放终结技'],
  5: ['终结技 F：言灵攒满（打字题答对 +1，填变形 +2），对任何怪看中文写整句，破甲', '跟读（可选）：答对后怪会把整句念出来，点技能栏的「读出来」或按 S 跟着读，读得像多给经验，读不好不扣任何东西；没见过的新词还可以直接读出来当攻击，读得像必中'],
  6: ['规则动词要写变位：du lernst、er wohnt（nehmen 这类不规则的 12 级再考）', '选错相开始受罚：被抵抗，护甲翻倍、破甲清零', '相决定元素：der 冰、die 火、das 毒（复数怪是雷），选对相时附带'],
  7: ['商人 Mira 在营地篝火边摆了小摊：买东西要说「Ich nehme den Stift.」（第四格）', '格位姿态：选相要按怪那句话里缺的位置选变格后的冠词（den、einen……），这一级选错不罚', '破防和多段：怪缩起来防御时，写对它的名字才能破防；连击怪答对只挨第一下'],
  8: ['首领「无名的邻居」：在营地东边的门后等你', '怪物会回血：Ich mache eine Pause.', '紫装：首领必掉'],
  9: ['护符相亲和：篝火旁把护符调成 der、die 或 das（免费随时换）。对上亲和的怪第一次选对相时墨水或沉着 +2（平时 +1），换句重选后再算一次；破甲照旧每档 4%，选错亲和也不吃亏'],
  10: ['浓雾散开：邻居家的门通向面包集市（第 2 区）', '选职业：去集市找导师 Greta，书写者或守护者'],
  11: ['商人 Mira 回到面包集市，营地的摊子照开', '宝箱和宝箱怪：喊着 Ich muss los! 的怪，这回合打不死就跑了', '群怪：附近的怪会一起扑上来；齐鸣 E：这一题打中所有和你同相的怪', '复数怪：一群同一个词的怪（die Äpfel），复数一律 die 相，打字题要写复数'],
  12: ['不规则动词也要写变位：du nimmst、er nimmt', '天赋树：每升 1 级得 1 点，去导师 Greta 那里点', '任务：按 J 打开任务面板'],
  13: ['怪物意图带对象：Ich heile mich. 是治自己，Ich greife dich an. 是打你'],
  18: ['第 2 区首领「吞秤者」：在粮仓尽头的秤房里，考价格和数量'],
};
