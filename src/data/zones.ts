// 0.7 + 0.8 · 第 4–12 区 (游戏设计 四「20 个区域和主城」, 十五, 十六「第 4–12 区玩法骨架」).
// One row per region; scenes, links, zones and the street map are generated from it (src/data/world.ts,
// src/game/map.ts), so a region is added or changed here only, never in code.
//
// Layout: every region 4–12 uses the region-3 street plan (town west, field A north, field B south, field C east,
// boss door far east, hidden side path north-east, a road south-east onward to the next region). Three fields ×
// 8 scenes = 24 scenes, as 游戏设计 四 says (「3 片野外，各约 8 个场景」).
//
// Words: the scene topics below are what each scene is about. Until the 6000-word list is reviewed and imported,
// every scene is filled with stand-in words from regions 1–3 (src/data/zoneWords.ts, 游戏设计 十六: 「6000 词表导入前，
// 新区开发用 1–3 区的词占位、不上线」). The import replaces zoneWords.ts only.
//
// Scene names, field names and boss lines are written by Claude for the docs thread to confirm.
import type { LaterRegionNo } from '../core/types';

export type FieldStyle = 'shops' | 'houses' | 'platforms' | 'stalls' | 'sheds' | 'docks' | 'grove' | 'yard';

export interface FieldDef {
  zh: string;
  de: string;
  style: FieldStyle;
  /** Eight scene names in route order (the topic of each scene's word group). */
  scenes: [string, string, string, string, string, string, string, string];
}

export interface RegionDef {
  region: LaterRegionNo;
  /** 主城 (游戏设计 四 table). */
  zh: string;
  de: string;
  /** 主题. */
  theme: string;
  /** 大区 (A2 日常 / B1 职场). */
  stage: 'A2' | 'B1';
  /** Kenney Tiny Town tile set of region 1, 2 or 3 (src/game/sprites.ts) the street map borrows. */
  look: 1 | 2 | 3;
  /** Scene names of the town: the square with the bonfire and the market stalls. */
  hubZh: string;
  standZh: string;
  /** The crossroads west of the fields and the hall entrance before field C. */
  crossZh: string;
  gateCZh: string;
  fields: [FieldDef, FieldDef, FieldDef];
  /** The boss's scene and the button on it. */
  doorZh: string;
  doorAct: string;
  /** Hidden side path (drawn once the first word of field C's second scene is 归名). */
  hiddenZh: string;
  /** The road on to the next region (opens once this region's boss has fallen). */
  onwardZh: string;
  /** First steps into the town. */
  enter: string[];
}

export const REGION_DEFS: RegionDef[] = [
  {
    region: 4, zh: '租屋城', de: 'Mietshausen', theme: '住房、家具、办手续', stage: 'A2', look: 3,
    hubZh: '租屋城门房', standZh: '门房摊位', crossZh: '看房路口', gateCZh: '市民局门口',
    fields: [
      { zh: '看房街', de: 'Besichtigungsgasse', style: 'houses', scenes: ['门铃面板', '楼梯间', '客厅', '厨房', '浴室', '卧室', '阳台', '地下室'] },
      { zh: '家具市场', de: 'Möbelmarkt', style: 'stalls', scenes: ['床垫区', '柜子区', '灯具区', '搬家车', '工具角', '二手摊', '收据台', '摆家具（wo / wohin）'] },
      { zh: '市民局', de: 'Bürgeramt', style: 'yard', scenes: ['排号机', '登记窗口', '表格桌', '房东办公室', '押金柜', '网络合同', '信箱墙', '盖章室'] },
    ],
    doorZh: '登记大厅', doorAct: '走进登记大厅',
    hiddenZh: '无人认领的空房', onwardZh: '城南的温泉路',
    enter: ['城门上挂着一排没有名字的门铃。每扇窗后面都有人，但没有一扇门开着。', '系统：在这里，住下来要先说清楚你是谁、住哪里、住多久。'],
  },
  {
    region: 5, zh: '泉疗镇', de: 'Heilbrunn', theme: '身体、健康、看医生', stage: 'A2', look: 2,
    hubZh: '泉水广场', standZh: '广场药摊', crossZh: '疗养路口', gateCZh: '诊所长廊入口',
    fields: [
      { zh: '浴场街', de: 'Badgasse', style: 'houses', scenes: ['更衣室', '温泉池', '桑拿房', '按摩床', '体重秤', '淋浴间', '休息椅', '泉眼'] },
      { zh: '诊所长廊', de: 'Praxisflur', style: 'shops', scenes: ['候诊室', '挂号台', '问诊室', '牙医', '眼科', '化验窗口', '药房', '急诊门'] },
      { zh: '康复林苑', de: 'Kurpark', style: 'grove', scenes: ['散步道', '体操草地', '饮食指导', '睡眠小屋', '花园长椅', '心理咨询', '比较板（besser / schlechter）', '出院门'] },
    ],
    doorZh: '空诊室', doorAct: '推开诊室的门',
    hiddenZh: '关闭的旧浴池', onwardZh: '下山去港口的路',
    enter: ['泉水还在冒热气，可镇上的人都说不出哪里疼。他们只会指着自己。', '系统：在这里，要会说身体哪里不舒服、从什么时候开始。'],
  },
  {
    region: 6, zh: '雾港', de: 'Nebelhafen', theme: '旅行、天气、度假', stage: 'A2', look: 3,
    hubZh: '雾港码头', standZh: '码头货摊', crossZh: '港口路口', gateCZh: '灯塔栈桥入口',
    fields: [
      { zh: '旅行社街', de: 'Reisegasse', style: 'shops', scenes: ['旅行社', '换钱处', '行李店', '地图墙', '护照处', '酒店前台', '青年旅舍', '纪念品店'] },
      { zh: '天气观测台', de: 'Wetterwarte', style: 'yard', scenes: ['风向标', '雨量筒', '雪堆', '温度计', '云层观测', '天气预报', '季节钟', '暴风门'] },
      { zh: '灯塔栈桥', de: 'Leuchtturmsteg', style: 'docks', scenes: ['渡船售票', '甲板', '海滩', '帐篷营地', '野餐地', '明信片摊', '愿望墙（hätte gern / würde）', '灯塔下'] },
    ],
    doorZh: '雾中泊位', doorAct: '走向雾中的船',
    hiddenZh: '退潮后的沉船', onwardZh: '船票上写着的下一站',
    enter: ['雾太浓了，连海浪的声音都像是隔着一层布。码头上的船没有名字，也没有方向。', '系统：在这里，要会说去哪里、怎么去、天气怎样、你想做什么。'],
  },
  {
    region: 7, zh: '粉笔原', de: 'Kreidefeld', theme: '银行、保险、合同', stage: 'A2', look: 1,
    hubZh: '粉笔原交易所', standZh: '交易所柜台', crossZh: '白线路口', gateCZh: '合同馆入口',
    fields: [
      { zh: '银行街', de: 'Bankstraße', style: 'shops', scenes: ['开户窗口', '取款机', '转账单', '账户流水', '信用卡', '贷款桌', '保险箱', '利息板'] },
      { zh: '保险巷', de: 'Versicherungsgasse', style: 'houses', scenes: ['健康保险', '责任险', '家财险', '车险', '理赔台', '损失报告', '保单柜', '投诉信'] },
      { zh: '合同馆', de: 'Vertragshalle', style: 'yard', scenes: ['手机合同', '租房合同', '劳动合同', '解约信', '期限墙', '签名台', '账单堆（被动语态）', '小字走廊'] },
    ],
    doorZh: '条款密室', doorAct: '翻开最后一页',
    hiddenZh: '作废合同的档案柜', onwardZh: '钟声传来的方向',
    enter: ['白色的粉笔线把这片原野分成一格一格。每一格都写着条款，字越往下越小。', '系统：在这里，读懂了才签字。看不懂就问，问了不丢人。'],
  },
  {
    region: 8, zh: '钟楼城', de: 'Uhrstadt', theme: '作息、爱好、用 als / wenn 讲往事', stage: 'A2', look: 1,
    hubZh: '钟楼广场', standZh: '钟楼下的摊位', crossZh: '齿轮路口', gateCZh: '回忆长廊入口',
    fields: [
      { zh: '作息街', de: 'Alltagsgasse', style: 'houses', scenes: ['闹钟', '早餐桌', '通勤车', '午休', '下班路', '家务', '晚饭', '睡前'] },
      { zh: '爱好俱乐部', de: 'Vereinshaus', style: 'shops', scenes: ['足球场', '乐器室', '画室', '读书会', '厨艺班', '健身房', '合唱团', '手工桌'] },
      { zh: '回忆长廊', de: 'Erinnerungsgang', style: 'platforms', scenes: ['童年房间', '旧学校', '第一份工作', '搬家那天', '婚礼照片', '旅行相册', '那年冬天（als）', '每到周末（wenn）'] },
    ],
    doorZh: '停摆的钟室', doorAct: '爬上钟楼',
    hiddenZh: '倒着走的钟', onwardZh: '工坊城的烟囱',
    enter: ['钟楼的指针指向一个不存在的时间。城里的人每天做同样的事，却说不出昨天发生了什么。', '系统：在这里，要会讲过去的事：一次的用 als，每次都这样的用 wenn。'],
  },
  {
    region: 9, zh: '工坊城', de: 'Werkhalle', theme: '求职、职场', stage: 'B1', look: 3,
    hubZh: '工坊大门', standZh: '工坊食堂', crossZh: '传送带路口', gateCZh: '人事楼入口',
    fields: [
      { zh: '招聘街', de: 'Jobbörse', style: 'shops', scenes: ['招聘栏', '简历桌', '求职信', '证书柜', '职业介绍所', '实习生角', '兼职板', '电话面试'] },
      { zh: '车间', de: 'Werkstatt', style: 'sheds', scenes: ['工具墙', '流水线', '安全帽', '仓库', '叉车道', '质检台', '夜班', '休息室'] },
      { zh: '人事楼', de: 'Personalbüro', style: 'yard', scenes: ['会议室', '打印机', '邮件堆', '同事桌', '老板办公室', '工资单', '请假条', '晋升墙'] },
    ],
    doorZh: '面试室', doorAct: '敲门进面试室',
    hiddenZh: '没人用的旧车间', onwardZh: '通往电波塔的电缆',
    enter: ['机器还在转，可没有一个工人记得自己是做什么的。门口的招聘栏上全是空白。', '系统：从这里开始，时间不再停下来等你（B1）。'],
  },
  {
    region: 10, zh: '电波塔', de: 'Funkturm', theme: '媒体、新闻、科技', stage: 'B1', look: 1,
    hubZh: '电波塔底', standZh: '报刊亭', crossZh: '信号路口', gateCZh: '播音楼入口',
    fields: [
      { zh: '报刊街', de: 'Zeitungsgasse', style: 'shops', scenes: ['报摊', '头条', '天气版', '体育版', '广告栏', '读者来信', '杂志架', '印刷机'] },
      { zh: '数码巷', de: 'Digitalgasse', style: 'houses', scenes: ['手机店', '电脑桌', '密码锁', '网络信号', '应用商店', '聊天群', '网上购物', '数据中心'] },
      { zh: '播音楼', de: 'Sendehaus', style: 'platforms', scenes: ['录音室', '新闻台', '采访间', '直播灯', '电台', '电视机', '字幕墙', '发射天线'] },
    ],
    doorZh: '播音间', doorAct: '走进播音间',
    hiddenZh: '断线的旧电台', onwardZh: '电缆尽头的森林',
    enter: ['塔顶在不停地播报，可每一条新闻都只剩一半。城里的人听着收音机，什么也听不懂。', '系统：在这里，要听懂新闻里说的事。'],
  },
  {
    region: 11, zh: '林底', de: 'Waldgrund', theme: '自然、环境、动物', stage: 'B1', look: 2,
    hubZh: '林底营地', standZh: '护林人小屋', crossZh: '林间岔路', gateCZh: '枯林入口',
    fields: [
      { zh: '林中小径', de: 'Waldweg', style: 'grove', scenes: ['松树林', '蘑菇地', '小溪', '鸟窝', '狐狸洞', '鹿群', '野猪痕', '林间空地'] },
      { zh: '回收站', de: 'Wertstoffhof', style: 'sheds', scenes: ['分类垃圾桶', '玻璃箱', '旧衣回收', '电池箱', '堆肥', '太阳能板', '节水阀', '自行车铺'] },
      { zh: '枯林', de: 'Totholz', style: 'grove', scenes: ['四季树', '暴风雨后', '干涸的湖', '山顶', '洞穴', '保护区', '动物收容所', '枯林深处'] },
    ],
    doorZh: '枯林中心', doorAct: '走进枯林中心',
    hiddenZh: '只有动物知道的路', onwardZh: '回城的林间小路',
    enter: ['树都还站着，可叶子是灰的。林子里的动物没有名字，连鸟都不叫。', '系统：在这里，要会说自然和环境，也要会说你自己能做什么。'],
  },
  {
    region: 12, zh: '心巷', de: 'Herzgasse', theme: '人际关系、情感', stage: 'B1', look: 1,
    hubZh: '心巷口', standZh: '花店', crossZh: '牵手路口', gateCZh: '冷漠之屋门前',
    fields: [
      { zh: '邻里巷', de: 'Nachbarschaft', style: 'houses', scenes: ['邻居门口', '生日聚会', '借东西', '道歉信', '吵架以后', '帮忙搬家', '邀请卡', '告别'] },
      { zh: '情绪街', de: 'Gefühlsgasse', style: 'shops', scenes: ['开心', '难过', '生气', '害怕', '惊讶', '嫉妒', '孤独', '感激'] },
      { zh: '冷漠之屋', de: 'Haus der Kälte', style: 'yard', scenes: ['老友照片', '恋人长椅', '家书', '误会', '和好', '信任', '承诺', '最后的门'] },
    ],
    doorZh: '冷漠之心', doorAct: '走进最后那扇门',
    hiddenZh: '寄不出去的信', onwardZh: '议会堡的路（B2 以后开放）',
    enter: ['巷子里的人擦肩而过，谁也不看谁。他们不是忘了词，是不在乎了。', '系统：这里的怪不是物，是感受。说出来，它才会疼。'],
  },
];

export const REGION_DEF: Partial<Record<number, RegionDef>> = Object.fromEntries(REGION_DEFS.map((d) => [d.region, d]));

/** Level band of a region: 4 → 31–40 … 12 → 111–120. */
export function regionLevels(region: number): [number, number] {
  return [(region - 1) * 10 + 1, region * 10];
}

/** Level band of a field (A, B, C) inside its region, overlapping by a level like region 3 (21–24, 24–27, 27–30). */
export function fieldLevels(region: number, field: 0 | 1 | 2): [number, number] {
  const base = (region - 1) * 10 + 1;
  return [base + field * 3, base + field * 3 + 3];
}

/** The scene id prefix letter of each field. */
export const FIELD_KEYS = ['a', 'b', 'c'] as const;
