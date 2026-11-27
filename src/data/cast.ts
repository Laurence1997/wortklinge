// 游荡的冒险者的固定角色 (Lucas 2026-11-26「再画一些 NPC，每个 NPC 需要个性和相貌鲜明」). Each region (and each 蚀变
// segment, keyed by its segment number) has its own 2–3 adventurers instead of random name/origin/manner picks, so
// nobody looks or talks like anyone else. Their figures are drawn in data/monster-art/npcs.txt (→ src/data/npcArt.ts,
// keyed by name). No name repeats a named NPC (Hilde, Greta, Mira, Konrad, Brandt, Weber, Lina, Jonas) or a scene NPC.

export interface CastMember {
  name: string;
  /** Region number, or the 蚀变 segment number for trapped survivors (8, 11, 15, 19). */
  home: number;
  /** Chinese, for the model and the greeting line: who they are and what they do. */
  origin: string;
  /** Chinese: how they talk. */
  manner: string;
}

export const CAST: CastMember[] = [
  // 1 余烬营地：营地生活、吃喝、打招呼
  { name: 'Ole', home: 1, origin: '从基尔来的退休船厨，天天守着篝火边那口汤锅', manner: '话多、热心，见人就盛一碗汤，张口就是北德的 Moin' },
  { name: 'Selin', home: 1, origin: '土耳其裔二代，学护理，背着急救包在营地里跑来跑去', manner: '热情、语速快，爱纠正别人的发音' },
  { name: 'Bastian', home: 1, origin: '十六岁的滑板少年，刚搬来，耳机从不摘', manner: '害羞、话少，只回短句，熟了以后才会笑' },
  // 2 集市：买东西、问价、付钱
  { name: 'Yara', home: 2, origin: '从大马士革来的香料摊主，记得每个熟客的名字', manner: '爱讨价还价，喜欢拿数字开玩笑' },
  { name: 'Emil', home: 2, origin: '有机农场的小伙子，推着菜车来赶集', manner: '慢条斯理，每样菜都要讲一遍它从哪块地来' },
  { name: 'Frieda', home: 2, origin: '八十岁的老太太，每天早上只买两个小面包', manner: '嘴毒心软，坚持用 Sie，也要求别人对她用 Sie' },
  // 3 铁轨镇：坐火车、问路、时间
  { name: 'Henrik', home: 3, origin: '火车迷，背着记满车次的笔记本', manner: '较真，爱纠正别人说错的时间' },
  { name: 'Amira', home: 3, origin: '每天通勤去法兰克福的程序员，永远在赶车', manner: '急性子、句子短，一开口就抱怨晚点' },
  { name: 'Mats', home: 3, origin: '退休的铁路信号员，还戴着旧制服帽', manner: '沉稳，爱讲故事，三句话离不开 früher' },
  // 4 租屋城：住房、家具、办手续
  { name: 'Kemal', home: 4, origin: '搬家公司的大力士，冰箱一个人就扛上五楼', manner: '乐观豪爽，爱夸人' },
  { name: 'Wiebke', home: 4, origin: '正在找房的建筑系学生，手里攥着一沓申请表', manner: '焦虑但幽默，一说房租就吐槽' },
  { name: 'Joscha', home: 4, origin: '合租公寓的「厨房规矩制定者」，冰箱上贴满了便条', manner: '认真、有点较真，什么都要排个表' },
  // 5 泉疗镇：身体、健康、看医生
  { name: 'Ida', home: 5, origin: '疗养院的瑜伽老师，常年光脚走路', manner: '温和、说话慢，总让人先深呼吸' },
  { name: 'Paul', home: 5, origin: '腿骨折了还硬撑着出来散步的前业余球员', manner: '嘴硬爱逞强，一聊比赛就停不下来' },
  { name: 'Rieke', home: 5, origin: '药店学徒，口袋里永远装着润喉糖', manner: '细心，爱提问，喜欢讲药名的来历' },
  // 6 雾港：旅行、天气、度假
  { name: 'Arne', home: 6, origin: '灯塔看守人的儿子，开渡轮，穿一身黄雨衣', manner: '寡言，开口先看天，天气从没说错过' },
  { name: 'Zoe', home: 6, origin: '背包走遍欧洲的加拿大女孩，德语才学了半年', manner: '好奇心重，最爱问「这个德语怎么说」' },
  { name: 'Dario', home: 6, origin: '在港口卖冰淇淋的意大利老板', manner: '夸张，说话带手势，热情得让人招架不住' },
  // 7 印章城：银行、保险、合同
  { name: 'Konstantin', home: 7, origin: '保险推销员，西装总是皱巴巴的', manner: '嘴甜爱打比方，什么话题都能绕到保险上' },
  { name: 'Merle', home: 7, origin: '银行柜员，下班后在乐队里打鼓', manner: '上班一丝不苟，私下很逗' },
  { name: 'Viktor', home: 7, origin: '刚开了家小公司的乌克兰工程师，每份合同都要逐条读', manner: '谨慎，爱追问细节' },
  // 9 工坊城：求职、职场
  { name: 'Svenja', home: 9, origin: '职业介绍所的顾问，走路带风', manner: '直接，爱给建议，常问「你的强项是什么」' },
  { name: 'Malik', home: 9, origin: '正在找第一份工作的厨师学徒，简历改了十遍', manner: '紧张，喜欢拉人练面试问题' },
  { name: 'Hanna', home: 9, origin: '木工坊的女师傅，手上全是茧', manner: '干脆利落，爱拿工具打比方' },
  // 10 电波塔：媒体、新闻、科技
  { name: 'Levin', home: 10, origin: '业余播客主，什么都想录下来', manner: '话痨，满嘴英语外来词' },
  { name: 'Thea', home: 10, origin: '报社实习记者，一直在核实消息', manner: '怀疑一切，口头禅是「消息来源呢」' },
  { name: 'Quentin', home: 10, origin: '修手机的小店老板，什么都能拆开', manner: '宅，冷幽默' },
  // 12 心巷：人际关系、情感
  { name: 'Lotte', home: 12, origin: '婚礼摄影师，拍过上千对新人', manner: '浪漫，爱八卦，喜欢打听感情故事' },
  { name: 'Nils', home: 12, origin: '刚失恋的大学生，写很糟糕的情诗', manner: '忧郁，爱自嘲' },
  { name: 'Elif', home: 12, origin: '开街角咖啡馆的，常替客人出主意', manner: '温暖，很会倾听' },
  // 13 议会堡：社会、政治、辩论
  { name: 'Ruben', home: 13, origin: '学生会主席，走到哪儿发传单到哪儿', manner: '激昂，逮着人就想辩论' },
  { name: 'Imke', home: 13, origin: '地方议员的发言人，说话滴水不漏', manner: '冷静，措辞正式' },
  // 14 铸币场：经济、消费、环境
  { name: 'Ylva', home: 14, origin: '骑二手自行车的环保活动家', manner: '理想主义，什么都要算一算碳排放' },
  { name: 'Moritz', home: 14, origin: '炒股赔了钱的前银行职员', manner: '爱算账，半开玩笑地悲观' },
  // 16 面具剧场：文化、艺术、科学、教育
  { name: 'Flora', home: 16, origin: '剧团的服装设计师，身上别满了别针', manner: '戏剧化，动不动引一句台词' },
  { name: 'Samuel', home: 16, origin: '博物馆讲解员，退休的物理老师', manner: '爱讲冷知识，讲着讲着就跑题' },
  // 17 档案深处：历史、记忆
  { name: 'Johanna', home: 17, origin: '档案馆的修复师，总戴着白手套', manner: '安静、精确，爱讲老照片背后的故事' },
  { name: 'Bruno', home: 17, origin: '业余家谱研究者，一直在找自己的祖先', manner: '啰嗦，热心过头' },
  // 18 天平庭：法律、论证、哲学
  { name: 'Carla', home: 18, origin: '法学院学生，模拟法庭冠军', manner: '好胜，逻辑严密' },
  { name: 'Anton', home: 18, origin: '读了很多年的哲学博士生', manner: '慢，爱反问「为什么」' },
  // 20 沉默之心：回顾、演讲
  { name: 'Juna', home: 20, origin: '失去过声音、又把它找回来的歌手', manner: '坚定，话少但每句都有分量' },
  { name: 'Erik', home: 20, origin: '做了一辈子翻译的老人', manner: '温和，爱讲两种语言之间的差别' },
  // 8 蚀变①「钟停之后」
  { name: 'Lasse', home: 8, origin: '被困在停摆钟声里的钟表匠学徒', manner: '神经质，总在数秒' },
  { name: 'Kaja', home: 8, origin: '在末班车上睡着、醒来就困在这里的女孩', manner: '迷迷糊糊，总以为现在还是昨晚' },
  // 11 蚀变②
  { name: 'Timo', home: 11, origin: '被驳回书困住的申请人，一直在排队', manner: '麻木，偶尔突然爆发' },
  { name: 'Sanne', home: 11, origin: '办事处以前的保洁员，认得每一条走廊', manner: '神秘，压低声音说话' },
  // 15 蚀变③「林底」
  { name: 'Matteo', home: 15, origin: '在林子里迷路的采蘑菇的人', manner: '乐呵呵，对危险总是后知后觉' },
  { name: 'Pia', home: 15, origin: '护林员，护着一盏不肯灭的灯', manner: '警惕，很会照顾人' },
  // 19 蚀变④「回潮」
  { name: 'Jannik', home: 19, origin: '潮水退了才露头的灯塔电工', manner: '疲惫，冷幽默' },
  { name: 'Tilda', home: 19, origin: '把所有词都写在手臂上的老教师', manner: '严厉但慈爱' },
];
