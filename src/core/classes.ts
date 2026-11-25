// 天赋树（共用一棵）(游戏设计 十, Lucas 2026-11-25): the combat classes are gone. Everyone shares one tree with five
// branches of 15 nodes in 5 rows (rows open at 0/4/8/12/16 points in the branch, the big talent at 20). Points: 1 per
// level at 12–30, 1 per 2 levels at 31–200. From 141 the outer ring (语法星位) shares the same points. Respec at the
// mentor for about an hour's gold. Talents never change what counts as 认得 / 会写 / 归名, and add no spelling slack.

import { CONFIG } from './config';
import type { GameState } from './state';

/** Kept only so old saves and the leaderboard type-check; nobody has a class any more. */
export type ClassId = 'writer' | 'guardian';

export type Branch = 'bifeng' | 'shoushi' | 'yanci' | 'zhixu' | 'xunjie';

export const BRANCHES: Record<Branch, { zh: string; about: string }> = {
  bifeng: { zh: '笔锋', about: '默写、变形、墨水风暴' },
  shoushi: { zh: '守势', about: '答错减伤、稳住' },
  yanci: { zh: '言辞', about: '终结技、连句、搭配' },
  zhixu: { zh: '秩序', about: '格和变位、封印、破甲' },
  xunjie: { zh: '迅捷', about: '速答、即时战、听写' },
};

export interface TalentDef {
  id: string;
  zh: string;
  branch: Branch;
  /** 1–5, or 6 for the branch's big talent. */
  row: number;
  max: number;
  big?: boolean;
  /** 「81 级起」: can be learned earlier but does nothing before this level (shown grey). */
  from?: number;
  /** The system it rides on is not in the game yet: can be learned, does nothing yet (shown grey with this note). */
  pending?: string;
  desc: (rank: number) => string;
}

type Row = [id: string, zh: string, row: number, max: number, desc: (r: number) => string, extra?: Partial<TalentDef>];
const p = (n: number, r: number) => `${n * Math.max(1, r)}`;
const rows = (branch: Branch, list: Row[]): TalentDef[] => list.map(([id, zh, row, max, desc, extra]) => ({ id, zh, branch, row, max, desc, ...(row === 6 ? { big: true } : {}), ...extra }));

// 天赋节点表 (游戏设计 十, rev 488). Old ids kept where a node carried over (bifeng = 落笔, changci = 笔顺,
// critRun = 连笔, houpi = 硬皮, shoushi = 守心), so a save's ranks stay where they were.
export const TALENT_TREE: TalentDef[] = [
  ...rows('bifeng', [
    ['bifeng', '落笔', 1, 3, (r) => `打字题（默写、句中默写）答对伤害 +${p(5, r)}%`],
    ['xingbi', '形笔', 1, 1, () => '变形题（复数、变位、连冠词变形）答对伤害 +8%'],
    ['changci', '笔顺', 1, 1, () => '墨水风暴每写对一个形式再 +10%'],
    ['critRun', '连笔', 2, 1, () => '连对 3 题后下一击必暴击（和别的必暴击同时满足只算一次）'],
    ['guanbi', '冠词笔', 2, 2, (r) => `名词带冠词写对伤害 +${p(5, r)}%（冠词错整题照旧算错）`],
    ['mozi', '墨渍', 2, 1, () => '墨水风暴冷却 −1'],
    ['changju', '长句笔', 3, 3, (r) => `句中默写和终结技整句答对伤害 +${p(4, r)}%`],
    ['xuxie', '续写', 3, 1, () => '墨水风暴写错一个形式不停，跳到下一个继续写；写错的那个不算伤害，这次也不算全写对'],
    ['fengli', '锋利', 3, 2, (r) => `答对难题后，下一击暴击率 +${p(10, r)}%`],
    ['dingming', '定名', 4, 2, (r) => `归名一击伤害 +${p(15, r)}%`],
    ['wutishi', '无提示', 4, 1, () => '这一场没用过低语时，打字题伤害 +10%'],
    ['biji', '笔记', 4, 2, (r) => `这一场答错过的词再出现时，写对伤害 +${p(15, r)}%`],
    ['bili', '笔力', 5, 2, (r) => `打字题暴击伤害 +${(0.1 * Math.max(1, r)).toFixed(1)}`],
    ['mochong', '墨水充盈', 5, 1, () => '墨水风暴全写对时冷却减半'],
    ['tengxie', '誊写', 6, 1, () => '难题破甲从 3 下延长到 4 下'],
  ]),
  ...rows('shoushi', [
    ['houpi', '硬皮', 1, 3, (r) => `生命 +${p(5, r)}%`],
    ['shoushi', '守心', 1, 1, () => '答错受伤 −20%'],
    ['wenbu', '稳步', 1, 2, (r) => `稳住冷却 −${p(1, r)}`],
    ['buhuang', '不慌', 2, 1, () => '答错时连击只减半，不归零'],
    ['gaiguo', '改过', 2, 2, (r) => `答错后的下一题答对，回 ${p(3, r)}% 生命`],
    ['wengu', '稳固', 2, 1, () => '稳住的题改成这只怪的打字题（不再是选择题），答对后保险从 2 次变 3 次'],
    ['tiebi', '铁壁', 3, 3, (r) => `选对相的那一回合受伤 −${p(5, r)}%`],
    ['shengdun', '声盾', 3, 1, () => '读出来读对后，下一次受伤 −30%'],
    ['wengu2', '温故', 3, 2, (r) => `复习题（语境题、复习怪）答对回 ${p(2, r)}% 生命`],
    ['gangyi', '刚毅', 4, 2, (r) => `生命低于 30% 时答对伤害 +${p(10, r)}%`],
    ['dingshen', '定神', 4, 1, () => '稳住生效期间每答对一题 +1 言灵'],
    ['jianshou', '坚守', 4, 2, (r) => `打断蓄力后得一层护盾，等于 ${p(5, r)}% 生命`],
    ['houjia', '厚甲', 5, 2, (r) => `生命再 +${p(5, r)}%`],
    ['mingbihu', '名之庇护', 5, 1, () => '每次归名一击回 10% 生命'],
    ['yishou', '以守为攻', 6, 1, () => '稳住生效时答对，同时打出一次普通攻击'],
  ]),
  ...rows('yanci', [
    ['chengju', '成句', 1, 3, (r) => `终结技（整句、连句、und 句、句型填空）伤害 +${p(5, r)}%`],
    ['qisheng', '齐声', 1, 1, () => '齐鸣冷却 −1'],
    ['cikuai', '词块', 1, 2, (r) => `搭配倍率 +${(0.1 * Math.max(1, r)).toFixed(1)}（×1.6 → ×1.8）`],
    ['jiehua', '接话', 2, 1, () => '接句怪和回话类怪答对额外 +1 言灵'],
    ['lianci', '连词', 2, 2, (r) => `连句答对伤害再 +${p(8, r)}%`],
    ['kaikou', '开口', 2, 1, () => '读出来读对伤害 +15%'],
    ['yuyun', '余韵', 3, 3, (r) => `终结技答对后，接下来 2 回合打字题伤害 +${p(5, r)}%`],
    ['dapei', '搭配记忆', 3, 1, () => '搭配写对后，这只怪护甲降一档 2 回合'],
    ['yuqi', '语气', 3, 2, (r) => `刻字孔里的语气词生效时伤害 +${p(5, r)}%`],
    ['juxing', '句型熟练', 4, 2, (r) => `句型填空答对伤害 +${p(10, r)}%`],
    ['xiushi', '修饰', 4, 1, () => '完美言灵（B1 起）暴击伤害 ×2.5 → ×2.8', { pending: '完美言灵还没做' }],
    ['jiantan', '健谈', 4, 2, (r) => `决斗场 AI 对话里每轮句子没错，金币 +${p(10, r)}%`],
    ['xiongbian', '雄辩', 5, 2, (r) => `开口说的题（83 级起必修）答对伤害 +${p(8, r)}%`, { pending: '开口说的题还没做' }],
    ['chengsheng', '乘胜', 5, 1, () => '终结技答对后连击 +3'],
    ['taotao', '滔滔不绝', 6, 1, () => '终结技不再耗光言灵，只耗 3 点（还是要写整句，不降难度，只是能多写）'],
  ]),
  ...rows('zhixu', [
    ['gelv', '格律', 1, 3, (r) => `格位题和变位题答对伤害 +${p(5, r)}%`],
    ['shiruo', '识弱', 1, 1, () => '打中弱点后，这一击伤害 +10%'],
    ['pozhan', '破绽', 1, 2, (r) => `难题破甲期间伤害 +${p(5, r)}%`],
    ['cixu', '词序', 2, 2, (r) => `语序题（可分动词句尾、从句动词句末）答对伤害 +${p(6, r)}%`],
    ['chaijie', '拆解', 2, 1, () => '拆词冷却 −1'],
    ['shuangsuo', '双锁', 2, 2, (r) => `锁链怪：填对介词再选对格，伤害 +${p(8, r)}%`],
    ['fengyin', '封印熟练', 3, 2, (r) => `格之封印冷却 −${p(1, r)}（61 级起有技能）`],
    ['changfeng', '长封', 3, 1, () => '格之封印从 2 回合延长到 3 回合'],
    ['guizheng', '规整', 3, 3, (r) => `不规则动词形式（过去式、分词、不规则现在时）写对伤害 +${p(4, r)}%`],
    ['chuantou', '穿透', 4, 2, (r) => `格位题或变位题写对，这一击穿透 +${p(1, r)} 档`],
    ['chengxi', '乘隙', 4, 1, () => '打断蓄力后，这只怪护甲降一档 2 回合'],
    ['kegou', '克构', 4, 2, (r) => `对精英和结构魔，格位题和变位题伤害 +${p(8, r)}%`],
    ['tiaoli', '条理', 5, 1, () => '难题答对额外 +1 言灵'],
    ['zhenya', '镇压', 5, 2, (r) => `封印期间对这只怪伤害 +${p(10, r)}%`],
    ['gesuo', '格位连锁', 6, 1, () => '选对相并答对格位题后，再出一道同一个词换一个格的题（dem Freund → den Freund），答对再打一次 ×1.5；每 3 回合最多一次'],
  ]),
  ...rows('xunjie', [
    ['kuaibi', '快笔', 1, 3, (r) => `有时限的题（首领对话、A2 起快答）答对伤害 +${p(5, r)}%`],
    ['zhengfen', '争分', 1, 1, () => '首领限时对话里每答对一题，剩余时间 +1 秒'],
    ['qiangda', '抢答', 1, 2, (r) => `速答暴击率 +${p(5, r)}%`],
    ['tingyin', '听音', 2, 2, (r) => `听力题（听音选词、回音怪）答对伤害 +${p(6, r)}%`],
    ['lianzhu', '连珠', 2, 1, () => '连击 10 以上时，快答伤害 +10%'],
    ['suji', '速记', 2, 2, (r) => `打字题 5 秒内答对伤害 +${p(4, r)}%（从题目出现计到交答案，回合制也算）`],
    ['erchong', '耳聪', 3, 2, (r) => `听写伤害 +${p(6, r)}%（81 级起）`, { from: 81 }],
    ['yiqi', '一气呵成', 3, 3, (r) => `一场战斗里每题都在 8 秒内答对，这场经验 +${p(3, r)}%`],
    ['jingting', '静听', 3, 1, () => '跟读和听力题答对后，下一题时限 +2 秒'],
    ['jixing', '疾行', 4, 2, (r) => `即时战公共冷却 −${(0.2 * Math.max(1, r)).toFixed(1)} 秒（81 级起）`, { from: 81, pending: '即时战还没做' }],
    ['tanfan', '弹反', 4, 1, () => '即时战弹反窗口从最后 1 秒延到 1.5 秒（81 级起）', { from: 81, pending: '即时战还没做' }],
    ['qiangxian', '抢先', 4, 2, (r) => `打断读条或打断蓄力后，下一题伤害 +${p(8, r)}%`],
    ['lianfa', '连发', 5, 2, (r) => `听写冷却 −${p(1, r)}（81 级起）`, { from: 81 }],
    ['kuairen', '快刃', 5, 1, () => '速答暴击伤害 +0.2'],
    ['xinliu', '心流', 6, 1, () => '连续 5 题都在快答时限内答对，进入心流 3 回合（即时战 6 秒）：每次答对追加一次 30% 伤害的追击，追击不能当归名一击'],
  ]),
];

/** Points spent in a branch before each row opens (row 1–5), and before the big talent. */
export const ROW_GATE = [0, 0, 4, 8, 12, 16, 20];
/** Kept for the panel text: points in the branch before its big talent. */
export const BIG_GATE = ROW_GATE[6];
export const TALENT_FROM_LEVEL = 12;
/** One per level up to here, then one per two levels up to 200. */
export const TALENT_EVERY_LEVEL_UNTIL = 30;
export const TALENT_UNTIL = 200;

export function talentPoints(s: Pick<GameState, 'level'>): number {
  const l = Math.min(s.level, TALENT_UNTIL);
  if (l < TALENT_FROM_LEVEL) return 0;
  const early = Math.min(l, TALENT_EVERY_LEVEL_UNTIL) - TALENT_FROM_LEVEL + 1;
  const late = l > TALENT_EVERY_LEVEL_UNTIL ? Math.floor((l - TALENT_EVERY_LEVEL_UNTIL) / 2) : 0;
  return early + late + starPoints(s);
}

/** Extra points from 誓约 quests later (none yet). */
function starPoints(_s: Pick<GameState, 'level'>): number {
  return 0;
}

export function tree(s: GameState): Record<string, number> {
  return ((s.talents as Record<string, Record<string, number>>).shared ??= {});
}

export function spent(s: GameState): number {
  return Object.values(tree(s)).reduce((a, b) => a + b, 0) + litStars(s).length;
}

export function spentIn(s: GameState, br: Branch): number {
  const t = tree(s);
  return TALENT_TREE.filter((x) => x.branch === br).reduce((a, x) => a + (t[x.id] ?? 0), 0);
}

/** Learned rank, as stored (the panel shows it even when the node does nothing yet). */
export function learned(s: Pick<GameState, 'talents'>, id: string): number {
  return (s.talents as Record<string, Record<string, number>>).shared?.[id] ?? 0;
}

/** Rank that takes effect: 0 before a node's 「81 级起」 level. */
export function rank(s: Pick<GameState, 'talents' | 'level'>, id: string): number {
  const r = learned(s, id);
  if (!r) return 0;
  const t = TALENT_BY_ID[id];
  return t?.from && s.level < t.from ? 0 : r;
}

export const TALENT_BY_ID: Record<string, TalentDef> = Object.fromEntries(TALENT_TREE.map((t) => [t.id, t]));

export function rowOpen(s: GameState, t: TalentDef): boolean {
  return spentIn(s, t.branch) >= ROW_GATE[t.row];
}

export function canLearn(s: GameState, t: TalentDef): boolean {
  return spent(s) < talentPoints(s) && learned(s, t.id) < t.max && rowOpen(s, t);
}

export function learn(s: GameState, id: string): boolean {
  const t = TALENT_BY_ID[id];
  if (!t || !canLearn(s, t)) return false;
  tree(s)[id] = learned(s, id) + 1;
  return true;
}

// ---- 外圈：语法星位 (141 级起) ------------------------------------------------------------------------

export const STARS_FROM = 141;

export interface StarDef {
  id: string;
  zh: string;
  /** B2/C1 stars come with their zones (content); 0.8 ships the A1–B1 twenty. */
  tier: 'base' | 'b2';
}

export const STARS: StarDef[] = [
  ['article', '冠词和相'], ['plural', '复数'], ['present', '现在时变位'], ['irregular', '不规则现在时'], ['separable', '可分动词'],
  ['modal', '情态动词'], ['perfekt', '完成式'], ['acc', '宾格'], ['dat', '与格'], ['twoway', '双向介词'],
  ['adjEnd', '形容词词尾'], ['compare', '比较级'], ['reflexive', '反身动词'], ['subOrder', '从句语序'], ['relative', '关系从句'],
  ['k2', '第二虚拟式'], ['passive', '被动'], ['praet', '过去时'], ['genitive', '属格'], ['nDecl', 'n 变化名词'],
].map(([id, zh]) => ({ id, zh, tier: 'base' as const }));

/** Stars passed at the mentor (8 questions, 6 right) — the trial itself is where a point may be spent. */
export function starsPassed(s: GameState): string[] {
  return String(s.flags.starsPassed ?? '').split(',').filter(Boolean);
}

export function litStars(s: GameState): string[] {
  return String(s.flags.starsLit ?? '').split(',').filter(Boolean);
}

export function passStar(s: GameState, id: string): void {
  if (!starsPassed(s).includes(id)) s.flags.starsPassed = [...starsPassed(s), id].join(',');
}

export function canLight(s: GameState, id: string): boolean {
  return s.level >= STARS_FROM && starsPassed(s).includes(id) && !litStars(s).includes(id) && spent(s) < talentPoints(s);
}

export function lightStar(s: GameState, id: string): boolean {
  if (!canLight(s, id)) return false;
  s.flags.starsLit = [...litStars(s), id].join(',');
  return true;
}

/** Each lit star: +10% damage on its grammar's questions, and a miss on them only halves the combo. */
export const STAR_BONUS = 0.1;
/** Every 5 lit stars: +3% HP. */
export function starHpBonus(s: GameState): number {
  return 0.03 * Math.floor(litStars(s).length / 5);
}

/** 「一小时金币」: 60 kills' worth of gold at your level. Prices and respec are counted in it. */
export function hourGold(s: GameState): number {
  return 60 * CONFIG.gold.perKill(s.level);
}

export function respecCost(s: GameState): number {
  return hourGold(s);
}

export function respec(s: GameState): boolean {
  const cost = respecCost(s);
  if (s.gold < cost || spent(s) === 0) return false;
  s.gold -= cost;
  (s.talents as Record<string, Record<string, number>>).shared = {};
  s.flags.starsLit = '';
  return true;
}

/** 言灵 is the only resource: 5 at most, from Lv4 (铭刻 misses cost it; 终结技 spends it from Lv5). */
export function resMax(s: GameState): number {
  return s.level >= 4 ? 5 : 0;
}

/** Share of a wrong-answer hit you still take (talent 守势 −20%). */
export function wrongHitShare(s: GameState): number {
  return 1 - 0.2 * rank(s, 'shoushi');
}

/** Typed hits in a row before the guaranteed crit (talent 一气呵成), or 0 when not learned. */
export function critRunNeeded(s: GameState): number {
  return rank(s, 'critRun') ? 3 : 0;
}

export function hpBonus(s: GameState): number {
  return 0.05 * rank(s, 'houpi') + 0.05 * rank(s, 'houjia') + starHpBonus(s);
}
