// Mirrors 游戏设计 › 等级与功能开放 for Lv 1–10. That table is the single source of truth;
// if a level changes there, change it here.

export const UNLOCK = {
  articleAttack: 1,
  typing: 2,
  bonfireRest: 3,
  echo: 4,
  gear: 3,
  inscribe: 4,
  whisper: 4,
  shadowing: 5,
  chorus: 11,
  sentence: 5,
  /** 6 级: the element a right stance carries (player side only; monster attacks have no element since 0.6.x). */
  layerElement: 6,
  boss: 8,
  skills: 8,
  purple: 8,
  affinity: 9,
  /** 野外精英 (2026-11-23): 场景精英. */
  elite: 9,
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
  boss2: 18,
  boss3: 28,
  // 0.7 + 0.8: region bosses 4–12 (10N − 2, src/data/bossesLater.ts).
  boss4: 38,
  boss5: 48,
  boss6: 58,
  boss7: 68,
  boss8: 78,
  boss9: 88,
  boss10: 98,
  boss11: 108,
  boss12: 118,
  breakA2: 80,
  breakB1: 120,
  // 0.6 第 6 块 (21–30 级系统)
  waystation: 21,
  dailies: 21,
  order: 21,
  // A1 写作 (2026-11-22): 排句, 槽位造句, 连句 (und / oder / aber / denn, then weil / dass / wenn), 篝火日记.
  wordOrder: 7,
  slot: 9,
  link: 14,
  diaryWrite: 16,
  linkSub: 23,
  // 回音怪 (2026-11-23): minimal pairs, with 跟读 (both are 「说」).
  pron: 5,
  ultimate: 30,
  breakthrough: 30,
} as const;

export type Feature = keyof typeof UNLOCK;

export function has(level: number, f: Feature): boolean {
  return level >= UNLOCK[f];
}

/** Chinese one-liners for the level-up banner (what opened at this level). */
export const UNLOCK_TEXT: Record<number, string[]> = {
  2: ['打字默写：用键盘打出单词，ä ö ü ß 可以点按钮，也可以写成 ae oe ue ss'],
  3: ['篝火：休息回满血，到期的词会重新变成怪物（遗忘刷新）', '归名进度：怪物重生时牙会越来越少', '装备：笔、外套、护符、词典 4 个部位；打得越多，装备档位越高（伤害、生命、破甲）'],
  4: ['死亡和回响：死了不丢学习进度，金币和经验留在杀死你的那个词上', '铭刻 Q：下一题难一级，答对伤害 ×1.5，答错丢 1 点言灵，不限次数', '低语 W：下一题给首字母（选择题去掉一个错项），不耗资源，但那题不算会写、不回言灵、不能归名；下次见到它先不带提示再考', '言灵：打中弱点、答对打字题都攒言灵（最多 5 点），铭刻答错扣 1 点；5 级起攒满能放终结技'],
  5: ['终结技 F：言灵攒满（打字题答对 +1，填变形 +2），对任何怪看中文写整句，破甲', '跟读（可选）：答对后怪会把整句念出来，点技能栏的「读出来」或按 S 跟着读，读得像多给经验，读不好不扣任何东西；没见过的新词还可以直接读出来当攻击，读得像必中', '回音怪：有的怪会考只差一个音的两个词（schon / schön）。默认听它读、选是哪个；在设置里打开「发音训练」后可以读出来打它，读错不罚'],
  6: ['规则动词要写变位：du lernst、er wohnt（nehmen 这类不规则的 12 级再考）', '选错相开始受罚：被抵抗，护甲翻倍、破甲清零', '相决定元素：der 冰、die 火、das 毒（复数怪是雷），选对相时附带'],
  7: ['商人 Mira 在营地篝火边摆了小摊：买东西要说「Ich nehme den Stift.」（第四格）', '格位姿态：选相要按怪那句话里缺的位置选变格后的冠词（den、einen……），这一级选错不罚', '排句：有时怪会把一句话拆成几块打乱，你按顺序打出整句（大写的那块在句首，动词放第二位）'],
  8: ['首领「无名的邻居」：在营地东边的门后等你', '紫装：首领必掉'],
  9: ['槽位造句：怪问你「Was brauchst du?」，你用单词本里任何合适的名词回答（Ich brauche einen Stift.），冠词和格要对；最近用过的 5 个词先不算，逼你换着说', '护符相亲和：篝火旁把护符调成 der、die 或 das（免费随时换）。对上亲和的怪第一次选对相时墨水或沉着 +2（平时 +1），换句重选后再算一次；破甲照旧每档 4%，选错亲和也不吃亏', '场景精英 ◈：一个场景的词一半到了半名，就会出一只精英。它带这个场景的 3 个词，分 3 段考：认、用、写。打赢第一次必掉铁箱'],
  10: ['浓雾散开：邻居家的门通向面包集市（第 2 区）', '技能池：去集市找导师 Greta，她送你墨水风暴和稳住（技能格 2 格，战斗里按 R / G）'],
  11: ['商人 Mira 回到面包集市，营地的摊子照开', '宝箱和宝箱怪：喊着 Ich muss los! 的怪，这回合打不死就跑了', '群怪：附近的怪会一起扑上来；齐鸣 E：这一题打中所有和你同相的怪', '复数怪：一群同一个词的怪（die Äpfel），复数一律 die 相，打字题要写复数'],
  12: ['不规则动词也要写变位：du nimmst、er nimmt', '天赋树（共用一棵，五个方向）：每升 1 级得 1 点，按 T 点', '任务：按 J 打开任务面板'],
  13: ['und 一句打两只：终结技写「Ich möchte einen Tee und eine Tasse.」，一句打中两只怪'],
  14: ['连句终结技：有时终结技给你两句短句和一个连词（und、oder、aber、denn），连成一句'],
  16: ['篝火日记：在篝火边用今天打过的 3 个词写两三句话。不判对错，只提示查得出的错（冠词、变位、没用到给的词），写完记进日记，给一点经验'],
  18: ['第 2 区首领「吞秤者」：在粮仓尽头的秤房里，考价格和数量'],
  21: [
    '现在完成时：动词怪说过去的事，选 haben 或 sein 相（22 级前选错不罚）',
    '蓄大招的台词带时间：jetzt 马上、gleich 下回合、in zwei Runden 两回合后，说几回合就几回合',
    '驿站：在篝火或主城，从大地图免费传到去过的片区路口',
    '每日委托：篝火旁的委托板每天 3 条',
    '秩序会：铁轨镇广场的 Frau Weber，用 Sie 填登记表攒声望',
  ],
  23: ['连句加 weil、dass、wenn：动词要放到句末（Ich bleibe zu Hause, weil ich krank bin.）', '眼镜：第 5 个部位，蓄力大招对你的伤害更低', '紫装德语鉴定：紫装掉下来是未鉴定的，到 Mira 那里读懂一句德语才揭示词缀'],
  25: ['刻字孔：紫装和橙装带一个孔，Greta 那里填一句挖空了 auch 或 denn 的句子，刻进去', '怪物诅咒：有的怪带「遗忘」（没有低语和中文提示）或「沉默」（不能跟读），答对一道难题就破咒；带咒的怪经验更多'],
  26: ['盲盒摊：Mira 的摊子每天 3 个盲盒，只写一句德语描述，读懂了再买'],
  27: ['锈名怪：过期很久的复习怪生了锈（越久越肥第 3–4 层的样子），血更多，奖励和普通怪一样'],
  28: ['零号站台：铁轨镇里隐藏的站台，进门前读一张德语规则卡，5 场加一个小首领，守住规则奖励更多'],
  30: ['A1 突破试炼：主城考官那里考听、读、写、语法四段，各 8 题对 5 题算过', '终极技能：每场第一次终结技变成句型填空，给好句型，两个空填进你学过的词，全对 ×3，对一个 ×1.5'],
  // 0.7 + 0.8 · region bosses and breakthrough trials (区域内容线程).
  38: ['第 4 区首领「登记魔像」：在租屋城登记大厅里等你，问你住哪里、家具放在哪里（wo / wohin）'],
  48: ['第 5 区首领「无痛医生」：在泉疗镇的空诊室里，问你哪里疼、比昨天好还是差'],
  58: ['第 6 区首领「雾中之船」：在雾港的泊位上，问你去哪里、天气怎样、你想做什么（würde）'],
  68: ['第 7 区首领「小字条款」：读懂合同再签字，它催你签的时候先问清楚'],
  78: ['蚀变①首领「停摆的钟」（铁轨镇末班站台）：讲往事，一次的用 als，每次都这样的用 wenn'],
  80: ['A2 突破试炼：主城考官那里考听、读、写、语法四段；过了才能升到 81 级'],
  88: ['第 9 区首领「面试官」：一场面试，理由用 weil，想要的工作用关系从句'],
  98: ['第 10 区首领「播报者」：听新闻，回答问题'],
  108: ['蚀变②首领「驳回书」（租屋城登记大厅）：一场正式的投诉和申诉'],
  118: ['第 12 区首领「冷漠」：第一只神格，说出你的感受，说「egal」只会让它更强'],
  120: ['B1 突破试炼：主城考官那里考听、读、写、语法四段'],
};

// 0.7–0.8 语法线和新系统 (游戏设计 十六): appended to the level-up banner of their level.
const GRAM_UNLOCK_TEXT: Record<number, string[]> = {
  5: ['否定 kein / nicht：怪有时会让你把它的句子改成否定（第一次会先贴一张规则看板）'],
  6: ['物主冠词 mein / dein：词尾和 ein 一样'],
  8: ['情态动词：muss / kann / möchte 放第二位，另一个动词放句尾'],
  10: [
    '时间介词：am Montag、um acht Uhr、im Mai',
    'AI 批改造句（要登录）：篝火边用一个还没记牢的词写一句，AI 只改错、不打分；写对算复习。篝火日记和场景精英的造句也会交给 AI 看',
    '决斗场（AI 对话，要登录）：篝火边和 AI 用德语办一件事，每场要用上 3–5 个还没记牢的词，用对一个算复习一次',
  ],
  20: ['小作文（AI 批改，要登录）：篝火边用 3 个词写 3–5 句；决斗场的对话变长（6–8 轮）'],
  12: ['可分动词：Ich stehe um sieben Uhr auf.'],
  14: ['命令式：Geben Sie mir bitte …'],
  15: ['与格代词 mir / dir：helfen、gefallen、schmecken、gehören', '告示怪 / 信件怪：有的怪身上贴着告示或信，读懂才打得中'],
  21: ['过去式 war / hatte：说过去的状态'],
  24: ['语法秘境 · 变音秘境：营地的「语法秘境」，按元音变化分族练强变化动词；打通一族，这一族在野外也会考变音'],
  31: ['介词秘境：锁链怪，先填介词再选格（warten auf + 第四格）'],
  33: ['情态动词过去式：konnte、musste、wollte'],
  35: ['镜像怪：反身代词 mich / dich / sich'],
  37: ['词族秘境：一个词根长出一家（die Fahrt、der Fahrer），构词层看词尾定性别'],
  41: ['形容词词尾：ein guter Tee、das gute Brot'],
  43: ['复习伙伴：在营地选一个归名的词陪你打，语境复习的题由它来出（换个样子，规则不变）'],
  81: ['过去式（所有动词）、变音秘境过去式层、镜像怪第三格（Ich wasche mir die Hände）、文章群怪'],
  // B2–C1 (游戏设计 四「121–200 级」): grammar line and the new monster kinds.
  121: ['第一虚拟式：转述别人的话（Er sagte, er sei krank.）', '转述怪：把它的话用第一虚拟式转述出来', '开口表达观点：标着「❝ 观点」的怪先抛出一个说法，用观点句式加理由回应它（登录后 AI 判说得通不通）'],
  125: ['功能动词结构：eine Entscheidung treffen、Rücksicht nehmen'],
  131: ['不用 werden 的被动：sein + zu、sich lassen、-bar', '数字怪：读图表，说清涨了多少（um）、涨到多少（auf）'],
  135: ['书面介词：aufgrund、infolge、angesichts、mithilfe'],
  141: ['hin 和 her：朝说话人来是 her，离开是 hin', '改写怪：把大白话改成书面名词式（weil es regnet → wegen des Regens）'],
  161: ['第二虚拟式过去时：Ich hätte dich angerufen. / als ob', '时间线怪：把打乱的记载按先后排好'],
  165: ['sofern、indem、soweit、wohingegen'],
  171: ['zwar … aber、einerseits … andererseits'],
  181: ['三语域怪：同一件事的口语、正式、书面说法'],
  191: ['回顾怪：从走过的路上捡回旧词和旧句式'],
};
// 技能池 (游戏设计 十): skills handed over by level, and the extra slots.
GRAM_UNLOCK_TEXT[15] = [...(GRAM_UNLOCK_TEXT[15] ?? []), '新技能「拆词」：复合词写出两部分、可分动词拆开写进短句。答对破甲 3 下（按 T 放进出战栏）'];
GRAM_UNLOCK_TEXT[30] = [...(GRAM_UNLOCK_TEXT[30] ?? []), '技能格 +1（共 3 格）'];
GRAM_UNLOCK_TEXT[41] = [...(GRAM_UNLOCK_TEXT[41] ?? []), '新技能「搭配」：写出这个词的固定搭配（warten auf），伤害 ×1.6'];
GRAM_UNLOCK_TEXT[61] = [...(GRAM_UNLOCK_TEXT[61] ?? []), '新技能「格之封印」：把词放进要变格或变位的短句，写对它 2 回合蓄不了力', '技能格 +1（共 4 格）'];
GRAM_UNLOCK_TEXT[34] = [...(GRAM_UNLOCK_TEXT[34] ?? []), '开口作答（可选）：要打字的题旁边多了「🎤 说出来」，按住说、松开就交。听得懂就算对，不看口音；说对算「认得」，要「会写」还得打字。不方便出声可以在设置里开安静模式'];
GRAM_UNLOCK_TEXT[81] = [...(GRAM_UNLOCK_TEXT[81] ?? []), '新技能「听写」：听它喊出例句，打出被挖掉的词，伤害 ×1.3'];
GRAM_UNLOCK_TEXT[31] = [...(GRAM_UNLOCK_TEXT[31] ?? []), '快答：仍是回合制，答得快（选择 2 秒内、默写约每 3 个字母 1 秒）有天赋加成，慢了不罚', '天赋点改成每 2 级 1 点'];
GRAM_UNLOCK_TEXT[81] = [...(GRAM_UNLOCK_TEXT[81] ?? []), '即时战：时间不再停。怪按自己的读条出手（约 6 秒，蓄力两倍），你随时答题，每招后 1 秒冷却，选择题答错僵直 2 秒。读条最后 1 秒答对是弹反（不挨打、反击算暴击），蓄力时答对就打断。设置里可以换回回合制或开慢速（读条 ×1.5），只是拿不到快答加成'];
GRAM_UNLOCK_TEXT[81] = [...(GRAM_UNLOCK_TEXT[81] ?? []), '红名怪：野外出现红名的结构魔，看到你就扑上来。被它追上就直接开打。离开超过 3 天回来的第一天，红名都在沉睡'];
GRAM_UNLOCK_TEXT[141] = [...(GRAM_UNLOCK_TEXT[141] ?? []), '语法星位（天赋页最下面）：每个星位一条语法，过试炼（8 题对 6，随时重考）后花 1 点点亮，这条语法的题伤害 +10%、答错连击只减半'];
GRAM_UNLOCK_TEXT[83] = [...(GRAM_UNLOCK_TEXT[83] ?? []), '发音怪：专打难发的音（r 和 l、ü 和 ö、ich 和 sch），每一击都要分清它和它的近音词；开了发音训练就要读出来，没开就听辨，别的招式只擦过它'];
// 秘术栏 (游戏设计 九「短句卡和俚语秘术」).
GRAM_UNLOCK_TEXT[3] = [...(GRAM_UNLOCK_TEXT[3] ?? []), '秘术栏 1 格：收到的短句卡可以在词汇本里「带上」，战斗中点「秘术」打出整句就生效（每场一次，先占一回合）'];
GRAM_UNLOCK_TEXT[33] = [...(GRAM_UNLOCK_TEXT[33] ?? []), '附赠动作：喊秘术不再占回合，喊完还能出一招'];
GRAM_UNLOCK_TEXT[50] = [...(GRAM_UNLOCK_TEXT[50] ?? []), '俚语秘术：俚语只对写明的场合管用，用错会反噬。NPC 支线最后一环和商店的流浪商人卷轴给俚语'];
GRAM_UNLOCK_TEXT[81] = [...(GRAM_UNLOCK_TEXT[81] ?? []), '秘术栏 +1（共 2 格）'];
GRAM_UNLOCK_TEXT[62] = [...(GRAM_UNLOCK_TEXT[62] ?? []), '言石：在篝火用碎片合成，每颗刻一条学过的语法，镶进紫装或橙装；答对这条语法的题就触发它的效果。遗忘宝箱起必出一颗'];
for (const [lv, lines] of Object.entries(GRAM_UNLOCK_TEXT)) UNLOCK_TEXT[Number(lv)] = [...(UNLOCK_TEXT[Number(lv)] ?? []), ...lines];
