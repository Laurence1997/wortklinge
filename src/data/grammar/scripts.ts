// 剧本模式 (游戏设计 五「决斗场」: 原剧场副本并进决斗场, Lucas 2026-11-25; 十五 151「剧本模式新剧本」): the player plays a
// role line by line from a script, the AI plays the other part and answers. It runs on the duel engine (target words,
// rewards and the daily paid count are the duel's) and opens from an adventurer, like its chat.
// 暂定: the mode opens with the adventurer chat (10 级); the doc only says 151 adds scripts. Scripts below 151 are
// everyday scenes; 151+ ones belong to 16 面具剧场's themes (culture, art, science, education).

export interface Script {
  id: string;
  title: string;
  from: number;
  /** Who the player plays (Chinese). */
  role: string;
  /** Who the AI plays, shown as the speaker. */
  npc: string;
  /** The situation, for the player and the model (Chinese). */
  setting: string;
  /** One cue per player line, in order (Chinese): what this line has to do. */
  beats: string[];
}

export const SCRIPTS: Script[] = [
  {
    id: 'fundbuero', title: '失物招领处', from: 10, role: '丢了钱包的乘客', npc: 'Mitarbeiter im Fundbüro',
    setting: '你昨天在公交车上丢了钱包，今天来失物招领处找。工作人员用 Sie，按规矩要先问清楚。',
    beats: ['打招呼，说你丢了钱包', '说什么时候、在哪条线路上丢的', '描述钱包的样子和里面的东西', '工作人员拿出一个钱包：说这不是你的，差在哪里', '留下电话号码，道谢告别'],
  },
  {
    id: 'wechselgeld', title: '找错钱了', from: 10, role: '买面包的顾客', npc: 'Verkäuferin',
    setting: '你在面包房付了 20 欧，店员只找了你 5 欧的零钱，你觉得少找了 10 欧。店员很忙，一开始不太相信。',
    beats: ['说你觉得找错钱了', '说清你付了多少、买了什么、该找多少', '店员说她记得是 10 欧：礼貌地坚持', '提出一个办法（比如数一下收银台）', '问题解决后道谢'],
  },
  {
    id: 'mitbewohner', title: '凌晨两点的室友', from: 20, role: '被吵醒的合租室友', npc: 'Mitbewohner Paul',
    setting: '室友 Paul 凌晨两点带朋友回来，声音很大，你第二天早上有考试。你们用 du。',
    beats: ['敲门，说你被吵醒了', '说明你明天早上有考试', 'Paul 说才两点、别这么严肃：说出你的感受', '提一个以后的规矩（比如几点以后小声）', '缓和气氛，约好明天再聊'],
  },
  {
    id: 'zugausfall', title: '火车取消了', from: 30, role: '赶去面试的乘客', npc: 'Mitarbeiterin am DB-Schalter',
    setting: '你的火车取消了，下午两点在科隆有面试。你到车站服务台问办法，对方用 Sie。',
    beats: ['说火车取消了，你要去科隆', '说明你两点有面试、时间很紧', '对方给了一个要换两次车的方案：问有没有更快的', '问车票还能不能用、能不能退一部分钱', '决定选哪一班，道谢'],
  },
  {
    id: 'ueberraschung', title: '偷偷准备生日', from: 40, role: '策划惊喜的朋友', npc: 'Lena（共同的朋友）',
    setting: '下周六是你们朋友 Max 的生日，你想给他办一个惊喜派对，打电话找 Lena 一起商量。用 du。',
    beats: ['说你想给 Max 办惊喜派对', '提议时间和地点', 'Lena 担心 Max 那天有安排：说怎么把他骗过来', '分工：谁买蛋糕、谁请人', '提醒她千万别说漏嘴'],
  },
  // ---- 151+: 面具剧场 ----------------------------------------------------------------------------------
  {
    id: 'premiere', title: '首演前夜', from: 151, role: '主演', npc: 'Regisseurin Frau Albers',
    setting: '明天首演。你觉得第三幕有一句台词不符合角色，想改；导演很固执，觉得你在耍大牌。用 Sie。',
    beats: ['请导演给你几分钟，说你想谈第三幕的一句台词', '说明这句台词为什么不符合角色（Zwar …, aber …）', '导演说现在改来不及：承认她的顾虑，再提出一个只改几个词的方案', '用前面几幕里角色的表现作证据', '如果她还是不同意，提出一个折中（今晚排一次两个版本看效果）'],
  },
  {
    id: 'faelschung', title: '画廊里的赝品', from: 151, role: '博物馆策展人', npc: 'Kunsthändler Herr Brenner',
    setting: '一位画商要把一幅十九世纪的画卖给你的博物馆。鉴定师私下告诉你，颜料里有一种 1950 年以后才有的成分。用 Sie。',
    beats: ['先称赞这幅画，问它的来历', '转述鉴定师的说法（Der Gutachter sagt, … sei …）', '画商说鉴定师不懂行：要求看来源证明', '指出他说法里前后矛盾的地方', '礼貌但清楚地说博物馆不会买，并说明理由'],
  },
  {
    id: 'verteidigung', title: '论文答辩', from: 161, role: '答辩的博士生', npc: 'Professor Dr. Hartmann',
    setting: '你在做博士论文答辩，题目是城市里的语言变化。Hartmann 教授是出了名的难缠。用 Sie。',
    beats: ['用两三句话介绍你的论文要回答的问题', '说出你的主要结论和依据', '教授说样本太小：承认局限，再说明为什么结论仍然成立', '回答他的追问：如果重做，你会怎么改进', '总结你的研究对以后有什么意义'],
  },
  {
    id: 'kritik', title: '影评人采访导演', from: 171, role: '影评人', npc: 'Regisseur Jonas Keller',
    setting: '你要采访一位导演。他的新片画面很美，但你觉得故事太空。你要把批评说出来，又不能让采访砸掉。用 Sie。',
    beats: ['开场：感谢他接受采访，先说你喜欢这部片子的哪一点', '委婉地提出你对故事的保留意见', '导演反问你是不是没看懂：用一个具体场景说明你的看法', '问他自己怎么看这个批评', '以一个关于他下一部片子的问题结束'],
  },
  {
    id: 'elternabend', title: '家长谈话', from: 181, role: '班主任', npc: 'Herr Yilmaz（学生家长）',
    setting: '你是一个九年级学生的班主任。学生成绩很差，你要建议家长让孩子留级一年。家长很激动。用 Sie。',
    beats: ['先说孩子的优点，再说你约这次谈话的原因', '用事实说明成绩的情况', '家长说是老师教得不好：不争辩，表示理解他的担心', '解释为什么留级对孩子可能是好事', '提出接下来具体能做什么，约下次谈话'],
  },
  {
    id: 'labordaten', title: '实验室的数据', from: 191, role: '研究员', npc: 'Kollegin Dr. Sommer',
    setting: '你发现同事 Dr. Sommer 发表的论文里有几组数据和实验记录对不上。她是你的朋友，也是项目负责人。用 du。',
    beats: ['说你有件不好开口的事想和她谈', '具体说出你发现的问题', '她说只是抄错了：说出你为什么不完全相信', '说明如果不处理会有什么后果（für das Projekt, für sie）', '提出你希望她怎么做，并说你会给她时间'],
  },
];

export const scriptsFor = (level: number): Script[] => SCRIPTS.filter((s) => level >= s.from);

/** The model's scene line for a script (the duel engine's `scene`). */
export function scriptPrompt(s: Script): string {
  return `这是剧本模式。你扮演 ${s.npc}，玩家扮演${s.role}。情境：${s.setting}剧本共 ${s.beats.length} 幕，玩家每轮演一幕：${s.beats.map((b, i) => `${i + 1}. ${b}`).join('；')}。你按剧本接话，在每一幕里给出能让玩家演下一幕的反应（剧本里写了你的反应就照着演），不要提前跳到后面的幕；玩家演完最后一幕后结束（done）。`;
}
