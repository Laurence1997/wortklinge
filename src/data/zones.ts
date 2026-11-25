// 0.7 + 0.8 · 第 4–12 区 (游戏设计 四「20 个区域和主城」, 十五, 十六「第 4–12 区玩法骨架」).
// One row per region; scenes, links, zones and the street map are generated from it (src/data/world.ts,
// src/game/map.ts), so a region is added or changed here only, never in code.
//
// 游戏设计 rev 341 (6000 词分组方案): segments 8 (71–80) and 11 (101–110) are 蚀变 on old maps, not new regions:
// 钟楼城 is cancelled, 林底 moves past level 120 (PARKED_REGIONS). So REGION_DEFS holds the seven new regions
// 4, 5, 6, 7, 9, 10, 12 and ERODE_DEFS the two 蚀变 layers (old scenes that get a second, advanced word group).
//
// Layout: every new region uses one street plan (town west, field A north, field B south, field C east, boss door
// far east, hidden side path north-east, a road south-east onward). Three fields × 9–10 scenes (游戏设计 四: A2 起
// 每区 3 片 × 9–10 场景, 每场景 12–16 词, 分两批开). Scene count per field comes from the list below.
//
// Words: the scene topics below are what each scene is about. Until the 6000-word list is reviewed and imported,
// every scene is filled with stand-in words from regions 1–3 (src/data/zoneWords.ts, 游戏设计 十六: 「6000 词表导入前，
// 新区开发用 1–3 区的词占位、不上线」). The import replaces zoneWords.ts only.
//
// Scene names, field names and boss lines are written by Claude for the docs thread to confirm.
import type { MapRegionNo, ZoneId } from '../core/types';

export type FieldStyle = 'shops' | 'houses' | 'platforms' | 'stalls' | 'sheds' | 'docks' | 'grove' | 'yard';

export interface FieldDef {
  zh: string;
  de: string;
  style: FieldStyle;
  /** 9–10 scene names in route order (the topic of each scene's word group). New scenes are appended, so scene
   *  ids (r4-a1 …) of the earlier ones never move. */
  scenes: string[];
}

export interface RegionDef {
  region: MapRegionNo;
  /** 各区色调 (游戏设计 十三): five #rrggbb steps, dark → light, that map tiles, NPCs and monsters are stretched over
   *  (src/game/palette.ts). Left out = the red-black of regions 1–3. */
  palette?: [string, string, string, string, string];
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
    palette: ['#120d08', '#3d2e1f', '#6b5236', '#c79a5b', '#f5dcb0'],
    hubZh: '租屋城门房', standZh: '门房摊位', crossZh: '看房路口', gateCZh: '市民局门口',
    fields: [
      { zh: '看房街', de: 'Besichtigungsgasse', style: 'houses', scenes: ['门铃面板', '楼梯间', '客厅', '厨房', '浴室', '卧室', '阳台', '地下室', '房屋广告'] },
      { zh: '家具市场', de: 'Möbelmarkt', style: 'stalls', scenes: ['床垫区', '柜子区', '灯具区', '搬家车', '工具角', '二手摊', '收据台', '摆家具（wo / wohin）', '组装说明书'] },
      { zh: '市民局', de: 'Bürgeramt', style: 'yard', scenes: ['排号机', '登记窗口', '表格桌', '房东办公室', '押金柜', '网络合同', '信箱墙', '盖章室', '邻居投诉栏', '搬出交接'] },
    ],
    doorZh: '登记大厅', doorAct: '走进登记大厅',
    hiddenZh: '无人认领的空房', onwardZh: '城南的温泉路',
    enter: ['城门上挂着一排没有名字的门铃。每扇窗后面都有人，但没有一扇门开着。', '系统：在这里，住下来要先说清楚你是谁、住哪里、住多久。'],
  },
  {
    region: 5, zh: '泉疗镇', de: 'Heilbrunn', theme: '身体、健康、看医生', stage: 'A2', look: 2,
    palette: ['#0f1006', '#34361a', '#5e6230', '#c2c95a', '#f3f6c8'],
    hubZh: '泉水广场', standZh: '广场药摊', crossZh: '疗养路口', gateCZh: '诊所长廊入口',
    fields: [
      { zh: '浴场街', de: 'Badgasse', style: 'houses', scenes: ['更衣室', '温泉池', '桑拿房', '按摩床', '体重秤', '淋浴间', '休息椅', '泉眼', '浴场规定'] },
      { zh: '诊所长廊', de: 'Praxisflur', style: 'shops', scenes: ['候诊室', '挂号台', '问诊室', '牙医', '眼科', '化验窗口', '药房', '急诊门', '病假条'] },
      { zh: '康复林苑', de: 'Kurpark', style: 'grove', scenes: ['散步道', '体操草地', '饮食指导', '睡眠小屋', '花园长椅', '心理咨询', '比较板（besser / schlechter）', '出院门', '运动处方', '复诊预约'] },
    ],
    doorZh: '空诊室', doorAct: '推开诊室的门',
    hiddenZh: '关闭的旧浴池', onwardZh: '下山去港口的路',
    enter: ['泉水还在冒热气，可镇上的人都说不出哪里疼。他们只会指着自己。', '系统：在这里，要会说身体哪里不舒服、从什么时候开始。'],
  },
  {
    region: 6, zh: '雾港', de: 'Nebelhafen', theme: '旅行、天气、度假', stage: 'A2', look: 3,
    palette: ['#070b12', '#1c2a3d', '#34506e', '#7fa6cf', '#dbe8f5'],
    hubZh: '雾港码头', standZh: '码头货摊', crossZh: '港口路口', gateCZh: '灯塔栈桥入口',
    fields: [
      { zh: '旅行社街', de: 'Reisegasse', style: 'shops', scenes: ['旅行社', '换钱处', '行李店', '地图墙', '护照处', '酒店前台', '青年旅舍', '纪念品店', '订票网站'] },
      { zh: '天气观测台', de: 'Wetterwarte', style: 'yard', scenes: ['风向标', '雨量筒', '雪堆', '温度计', '云层观测', '天气预报', '季节钟', '暴风门', '天气灾害'] },
      { zh: '灯塔栈桥', de: 'Leuchtturmsteg', style: 'docks', scenes: ['渡船售票', '甲板', '海滩', '帐篷营地', '野餐地', '明信片摊', '愿望墙（hätte gern / würde）', '灯塔下', '退票窗口', '度假照片'] },
    ],
    doorZh: '雾中泊位', doorAct: '走向雾中的船',
    hiddenZh: '退潮后的沉船', onwardZh: '船票上写着的下一站',
    enter: ['雾太浓了，连海浪的声音都像是隔着一层布。码头上的船没有名字，也没有方向。', '系统：在这里，要会说去哪里、怎么去、天气怎样、你想做什么。'],
  },
  {
    region: 7, zh: '印章城', de: 'Stempelstadt', theme: '银行、保险、合同', stage: 'A2', look: 1,
    palette: ['#0e0712', '#2f1a3d', '#533070', '#a066d6', '#ead4ff'],
    hubZh: '印章城交易所', standZh: '交易所柜台', crossZh: '盖章路口', gateCZh: '合同馆入口',
    fields: [
      { zh: '银行街', de: 'Bankstraße', style: 'shops', scenes: ['开户窗口', '取款机', '转账单', '账户流水', '信用卡', '贷款桌', '保险箱', '利息板', '网上银行'] },
      { zh: '保险巷', de: 'Versicherungsgasse', style: 'houses', scenes: ['健康保险', '责任险', '家财险', '车险', '理赔台', '损失报告', '保单柜', '投诉信', '保险顾问'] },
      { zh: '合同馆', de: 'Vertragshalle', style: 'yard', scenes: ['手机合同', '租房合同', '劳动合同', '解约信', '期限墙', '签名台', '账单堆（被动语态）', '小字走廊', '收据档案', '催款信'] },
    ],
    doorZh: '条款密室', doorAct: '翻开最后一页',
    hiddenZh: '作废合同的档案柜', onwardZh: '通往工坊城的货运路',
    enter: ['城里每一面墙上都盖满了印章。每一张纸都写着条款，字越往下越小。', '系统：在这里，读懂了才签字。看不懂就问，问了不丢人。'],
  },
  {
    region: 9, zh: '工坊城', de: 'Werkhalle', theme: '求职、职场', stage: 'B1', look: 3,
    palette: ['#0d0b09', '#2e2924', '#574a3d', '#e07a2e', '#ffd2a1'],
    hubZh: '工坊大门', standZh: '工坊食堂', crossZh: '传送带路口', gateCZh: '人事楼入口',
    fields: [
      { zh: '招聘街', de: 'Jobbörse', style: 'shops', scenes: ['招聘栏', '简历桌', '求职信', '证书柜', '职业介绍所', '实习生角', '兼职板', '电话面试', '求职网站', '劳动局'] },
      { zh: '车间', de: 'Werkstatt', style: 'sheds', scenes: ['工具墙', '流水线', '安全帽', '仓库', '叉车道', '质检台', '夜班', '休息室', '工伤报告', '加班表'] },
      { zh: '人事楼', de: 'Personalbüro', style: 'yard', scenes: ['会议室', '打印机', '邮件堆', '同事桌', '老板办公室', '工资单', '请假条', '晋升墙', '团队会议', '离职信'] },
    ],
    doorZh: '面试室', doorAct: '敲门进面试室',
    hiddenZh: '没人用的旧车间', onwardZh: '通往电波塔的电缆',
    enter: ['机器还在转，可没有一个工人记得自己是做什么的。门口的招聘栏上全是空白。', '系统：从这里开始，时间不再停下来等你（B1）。'],
  },
  {
    region: 10, zh: '电波塔', de: 'Funkturm', theme: '媒体、新闻、科技', stage: 'B1', look: 1,
    palette: ['#020d0a', '#0a2e22', '#145a40', '#2fd88a', '#b8ffd9'],
    hubZh: '电波塔底', standZh: '报刊亭', crossZh: '信号路口', gateCZh: '播音楼入口',
    fields: [
      { zh: '报刊街', de: 'Zeitungsgasse', style: 'shops', scenes: ['报摊', '头条', '天气版', '体育版', '广告栏', '读者来信', '杂志架', '印刷机', '社论'] },
      { zh: '数码巷', de: 'Digitalgasse', style: 'houses', scenes: ['手机店', '电脑桌', '密码锁', '网络信号', '应用商店', '聊天群', '网上购物', '数据中心', '网络安全'] },
      { zh: '播音楼', de: 'Sendehaus', style: 'platforms', scenes: ['录音室', '新闻台', '采访间', '直播灯', '电台', '电视机', '字幕墙', '发射天线', '辟谣台', '广播剧'] },
    ],
    doorZh: '播音间', doorAct: '走进播音间',
    hiddenZh: '断线的旧电台', onwardZh: '电缆尽头的小巷',
    enter: ['塔顶在不停地播报，可每一条新闻都只剩一半。城里的人听着收音机，什么也听不懂。', '系统：在这里，要听懂新闻里说的事。'],
  },
  {
    region: 12, zh: '心巷', de: 'Herzgasse', theme: '人际关系、情感', stage: 'B1', look: 1,
    palette: ['#12060c', '#3d1430', '#6e2456', '#e0559e', '#ffd0ea'],
    hubZh: '心巷口', standZh: '花店', crossZh: '牵手路口', gateCZh: '冷漠之屋门前',
    fields: [
      { zh: '邻里巷', de: 'Nachbarschaft', style: 'houses', scenes: ['邻居门口', '生日聚会', '借东西', '道歉信', '吵架以后', '帮忙搬家', '邀请卡', '告别', '婚礼'] },
      { zh: '情绪街', de: 'Gefühlsgasse', style: 'shops', scenes: ['开心', '难过', '生气', '害怕', '惊讶', '嫉妒', '孤独', '感激', '后悔'] },
      { zh: '冷漠之屋', de: 'Haus der Kälte', style: 'yard', scenes: ['老友照片', '恋人长椅', '家书', '误会', '和好', '信任', '承诺', '最后的门', '原谅'] },
    ],
    doorZh: '冷漠之心', doorAct: '走进最后那扇门',
    hiddenZh: '寄不出去的信', onwardZh: '议会堡的路（B2 以后开放）',
    enter: ['巷子里的人擦肩而过，谁也不看谁。他们不是忘了词，是不在乎了。', '系统：这里的怪不是物，是感受。说出来，它才会疼。'],
  },
];

export const REGION_DEF: Partial<Record<number, RegionDef>> = Object.fromEntries(REGION_DEFS.map((d) => [d.region, d]));

/** 林底 (was region 11) moves past level 120 with 枯林之母 (游戏设计 rev 341). Kept here, not built. */
export const PARKED_REGIONS: Array<Omit<RegionDef, 'region'> & { region: number }> = [
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
];

// ---- 蚀变 (游戏设计 四「词怎么分层、蚀变和挑战怪」) ------------------------------------------------------------
// The second-to-last segment of a stage goes back to old maps: same scenes and ids, a second word group per chosen
// scene (the advanced layer of its life situation), monsters at the segment's level, its own gear tiers. Words come
// from SCENE_ROWS[`${scene}@${seg}`] (src/data/zoneWords.ts) or stand-ins until the import. The scene picks below
// follow 6000 词分组方案 §4–5 (蚀变①: 作息、爱好、讲经历 / 下馆子、退换货 / 换乘、改期, ~28 of the 69 region 1–3
// scenes; 蚀变②: ~4 per region 1–7) and are replaced by the reviewed scene table.

export interface ErodeScene {
  scene: string;
  /** The field (word pool) the old scene belongs to. */
  zone: ZoneId;
}

export interface ErodeDef {
  seg: 8 | 11;
  /** Name shown in banners and the 图鉴. */
  zh: string;
  stage: 'A2' | 'B1';
  /** Opens once this boss has fallen (the last new region before it). */
  after: number;
  /** The old region whose boss door the segment's boss stands behind, with the door's lines. */
  bossRegion: 1 | 2 | 3 | 4 | 5 | 6 | 7;
  doorZh: string;
  doorAct: string;
  /** Said when it opens. */
  open: string[];
  /** 蚀变① has its own ramp (游戏设计 十三); 蚀变② darkens each old map's own (src/game/palette.ts). */
  palette?: [string, string, string, string, string];
  scenes: ErodeScene[];
}

const sc = (zone: ZoneId, ...ids: string[]): ErodeScene[] => ids.map((scene) => ({ scene, zone }));

export const ERODE_DEFS: ErodeDef[] = [
  {
    seg: 8, zh: '蚀变①「钟停之后」', stage: 'A2', after: 7, bossRegion: 3,
    palette: ['#0c0303', '#331010', '#521717', '#8f2a2a', '#f08a3c'],
    doorZh: '停摆的末班站台', doorAct: '走上停摆的末班站台',
    open: [
      '印章城的章盖完了。可你回头看的时候，来时的路变了颜色。',
      '营地、集市、铁轨镇……路牌上换了说法，老熟人说话也不一样了。铁轨镇的钟全停在一个不存在的时间。',
      '系统：【蚀变①「钟停之后」71–80 级】回 1–3 区。蚀变的场景里住着同一件事的进阶说法：基础词写对过一次，进阶词才会出来。首领「停摆的钟」在铁轨镇末班站台。',
    ],
    scenes: [
      ...sc('echogasse', 'r1-e1', 'r1-e2', 'r1-e7'),
      ...sc('schilderstrasse', 'r1-s2', 'r1-s6', 'r1-s7', 'r1-s9'),
      ...sc('aschehof', 'r1-a2', 'r1-a7'),
      ...sc('gemuesegasse', 'r2-g1', 'r2-g5', 'r2-g4'),
      ...sc('waagegasse', 'r2-w5', 'r2-w7', 'r2-w8', 'r2-w4'),
      ...sc('kornspeicher', 'r2-k6', 'r2-k7'),
      ...sc('bahnhofstrasse', 'r3-b1', 'r3-b2', 'r3-b5', 'r3-b7'),
      ...sc('fahrplanhalle', 'r3-f1', 'r3-f2', 'r3-f3', 'r3-f5', 'r3-f6', 'r3-f7'),
    ],
  },
  {
    seg: 11, zh: '蚀变②', stage: 'B1', after: 10, bossRegion: 4,
    doorZh: '蚀变的登记大厅', doorAct: '走进蚀变的登记大厅',
    open: [
      '电波塔安静下来以后，收音机里开始播一些旧地方的名字：租屋城、泉疗镇、雾港、印章城……',
      '那些地方的话又变了，变得更正式、更长。信、表格和投诉都要用另一种说法。',
      '系统：【蚀变② 101–110 级】回 1–7 区。每区有几个场景蚀变，放 B1 的正式说法。首领在租屋城的登记大厅。',
    ],
    scenes: [
      ...sc('echogasse', 'r1-e4'), ...sc('schilderstrasse', 'r1-s1', 'r1-s5'), ...sc('aschehof', 'r1-a5'),
      ...sc('waagegasse', 'r2-w1', 'r2-w3', 'r2-w6'), ...sc('gemuesegasse', 'r2-g7'),
      ...sc('altstadt', 'r3-a4', 'r3-a6', 'r3-a8'), ...sc('bahnhofstrasse', 'r3-b6'),
      ...sc('r4b', 'r4-b7'), ...sc('r4c', 'r4-c2', 'r4-c5', 'r4-c6'),
      ...sc('r5b', 'r5-b2', 'r5-b3', 'r5-b7'), ...sc('r5c', 'r5-c6'),
      ...sc('r6a', 'r6-a5', 'r6-a6'), ...sc('r6b', 'r6-b6'), ...sc('r6c', 'r6-c1'),
      ...sc('r7a', 'r7-a3'), ...sc('r7b', 'r7-b5', 'r7-b8'), ...sc('r7c', 'r7-c4'),
    ],
  },
];

export const ERODE_DEF: Partial<Record<number, ErodeDef>> = Object.fromEntries(ERODE_DEFS.map((e) => [e.seg, e]));

/** The segment after `seg` that has a map (7 → 9, 10 → 12), or null after 12. */
export function nextMapRegion(seg: number): number | null {
  for (let r = seg + 1; r <= 12; r++) if (REGION_DEF[r]) return r;
  return null;
}

/** The map region before `r` (9 → 7, 12 → 10, 4 → 3). */
export function prevMapRegion(r: number): number {
  for (let p = r - 1; p >= 4; p--) if (REGION_DEF[p]) return p;
  return 3;
}

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
