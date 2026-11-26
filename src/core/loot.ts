import { CONFIG } from './config';
import { between, pick, weighted, type Rng } from './rng';
import type { Affix, AffixKey, Item, Legendary, Quality, Slot } from './types';

const NAMES: Record<Slot, Record<Quality, string[]>> = {
  pen: {
    white: ['秃头铅笔', '断尖圆珠笔', '营地粉笔'],
    green: ['磨尖的铅笔', '旧钢笔', '记号笔'],
    purple: ['守夜人的鹅毛笔', '灰烬钢笔'],
    orange: ['冠词审判者'],
    red: ['失语者的最后一支笔'],
  },
  coat: {
    white: ['破外套', '旧雨衣', '烧焦的毛衣'],
    green: ['厚呢大衣', '补过的雨衣', '工装夹克'],
    purple: ['守火人斗篷', '铁轨工大衣'],
    orange: ['冠词审判者的长袍'],
    red: ['沉默织成的外衣'],
  },
  amulet: {
    white: ['旧车票', '钥匙扣', '纽扣'],
    green: ['褪色的车票护符', '铜钥匙坠'],
    purple: ['余烬吊坠', '无名者的戒指'],
    orange: ['冠词审判者的徽记'],
    red: ['被叫回的名字'],
  },
  dict: {
    white: ['缺页小词典', '单词卡片'],
    green: ['口袋词典', '旧语法书'],
    purple: ['守夜人笔记', '烧焦的杜登'],
    orange: ['冠词审判者的典籍'],
    red: ['完整的杜登'],
  },
  // 0.6 第 6 块 (23 级): the fifth slot; main stat = less damage from a charged hit.
  glasses: {
    white: ['裂了一片的眼镜', '站台捡的墨镜'],
    green: ['站长的老花镜', '圆框眼镜'],
    purple: ['检票员的单片镜', '时刻表读书镜'],
    orange: ['冠词审判者的镜片'],
    red: ['看穿沉默的镜片'],
  },
  // 34 级 第 6 个部位: listening questions hit harder.
  phones: {
    white: ['缠着胶布的耳机', '车站捡的耳塞'],
    green: ['广播员的旧耳机', '降噪耳罩'],
    purple: ['调度室的监听耳机', '听得见低语的耳机'],
    orange: ['冠词审判者的耳罩'],
    red: ['听见沉默的耳机'],
  },
};

/** 眼镜 main stat by quality (系统审查 2026-11-26): a turn you answer wrong hurts this much less. */
export const GLASSES_MAIN: Record<Quality, number> = { white: 0.05, green: 0.08, purple: 0.12, orange: 0.16, red: 0.2 };
/** Glasses drop only from Lv23 (region 3). */
export const GLASSES_FROM = 23;
/** 传说效果 (系统审查 2026-11-26, 暂定 values): an orange or red item rolls one of these; different kinds stack, two of
 *  the same kind count once. Old items keep 冠词审判. */
export const LEGENDARY: Record<Legendary, { zh: string; fx: string }> = {
  articleJudgement: { zh: '冠词审判', fx: '答对冠词题或选对相后，下一击伤害翻倍' },
  inkCrit: { zh: '墨痕', fx: '打字题暴击率 +10%' },
  comboHeal: { zh: '余烬', fx: '连击每到 5 的倍数，回复 5% 生命' },
  listenEcho: { zh: '回声', fx: '听力题答对后，下一击伤害 ×1.5' },
};
export const LEGENDARY_KEYS = Object.keys(LEGENDARY) as Legendary[];

/** 词典 main stat by quality (系统审查 2026-11-26, replaces 低语纸条上限): typed questions hit this much harder. */
export const DICT_MAIN: Record<Quality, number> = { white: 0.05, green: 0.08, purple: 0.12, orange: 0.16, red: 0.2 };
/** A dictionary's damage bonus; old saves stored a note count (1–4) there, read by quality instead. */
export function dictMain(it: Pick<Item, 'main' | 'quality'> | undefined): number {
  if (!it) return 0;
  return it.main >= 1 ? DICT_MAIN[it.quality] : it.main;
}
/** 耳机 (34 级, 第 6 个部位): main stat = listening questions hit this much harder (暂定, by quality); +4% per tier. */
export const PHONES_FROM = 34;
export const PHONES_MAIN: Record<Quality, number> = { white: 0.05, green: 0.08, purple: 0.12, orange: 0.16, red: 0.2 };
export const PHONES_PER_TIER = 0.04;
/** The slots that drop at this item level. */
export function slotsAt(ilvl: number): Slot[] {
  return ['pen', 'coat', 'amulet', 'dict', ...(ilvl >= GLASSES_FROM ? (['glasses'] as Slot[]) : []), ...(ilvl >= PHONES_FROM ? (['phones'] as Slot[]) : [])];
}

export const SLOT_ZH: Record<Slot, string> = { pen: '笔', coat: '外套', amulet: '护符', dict: '词典', glasses: '眼镜', phones: '耳机' };
export const QUALITY_ZH: Record<Quality, string> = { white: '普通', green: '优秀', purple: '史诗', orange: '传说', red: '套装最高档' };

export const AFFIX_ZH: Record<AffixKey, (v: number) => string> = {
  dmg: (v) => `伤害 +${pct(v)}`,
  hp: (v) => `生命 +${pct(v)}`,
  pen: (v) => `护甲穿透 +${pct(v)}`,
  vsMasc: (v) => `选对相时，对阳性怪伤害 +${pct(v)}`,
  vsFem: (v) => `选对相时，对阴性怪伤害 +${pct(v)}`,
  vsNeut: (v) => `选对相时，对中性怪伤害 +${pct(v)}`,
  wrongDmgReduce: (v) => `答错时受到伤害 −${pct(v)}`,
  xp: (v) => `经验 +${pct(v)}`,
  dropRate: (v) => `掉宝率 +${pct(v)}`,
};

function pct(v: number): string {
  return `${Math.round(v * 100)}%`;
}

/** Affix ranges by quality (游戏设计 › 词条库, scaled down for Lv 1–10). */
export const AFFIX_RANGE: Record<AffixKey, Record<'green' | 'purple' | 'orange', [number, number]>> = {
  dmg: { green: [0.06, 0.1], purple: [0.11, 0.16], orange: [0.17, 0.22] },
  hp: { green: [0.05, 0.08], purple: [0.09, 0.13], orange: [0.14, 0.2] },
  pen: { green: [0.02, 0.03], purple: [0.04, 0.05], orange: [0.06, 0.07] },
  vsMasc: { green: [0.05, 0.08], purple: [0.09, 0.13], orange: [0.14, 0.2] },
  vsFem: { green: [0.05, 0.08], purple: [0.09, 0.13], orange: [0.14, 0.2] },
  vsNeut: { green: [0.05, 0.08], purple: [0.09, 0.13], orange: [0.14, 0.2] },
  wrongDmgReduce: { green: [0.03, 0.05], purple: [0.06, 0.08], orange: [0.09, 0.12] },
  xp: { green: [0.02, 0.03], purple: [0.04, 0.05], orange: [0.06, 0.08] },
  dropRate: { green: [0.05, 0.1], purple: [0.11, 0.2], orange: [0.21, 0.3] },
};

/** Old saves (before 2026-11-24): the removed affixes become 伤害 +% of the same standing in its range. */
const LEGACY_RANGE: Record<string, Record<'green' | 'purple' | 'orange', [number, number]>> = {
  typedDmg: AFFIX_RANGE.dmg,
  sentenceDmg: AFFIX_RANGE.dmg,
  choiceCrit: { green: [0.02, 0.03], purple: [0.04, 0.05], orange: [0.06, 0.07] },
};
export function convertLegacyAffixes(it: Item | null | undefined): void {
  if (!it?.affixes) return;
  const q = (it.quality === 'white' ? 'green' : it.quality) as 'green' | 'purple' | 'orange';
  for (const a of it.affixes as Array<{ key: string; value: number }>) {
    const old = LEGACY_RANGE[a.key];
    if (!old) continue;
    const [lo, hi] = old[q];
    const [nlo, nhi] = AFFIX_RANGE.dmg[q];
    const f = hi > lo ? Math.min(1, Math.max(0, (a.value - lo) / (hi - lo))) : 0.5;
    a.key = 'dmg';
    a.value = Math.round((nlo + f * (nhi - nlo)) * 100) / 100;
  }
}

const AFFIX_COUNT: Record<Quality, number> = { white: 0, green: 1, purple: 2, orange: 3, red: 4 };
/** 红装 (111 级): orange ranges, raised by this much (暂定). */
export const RED_AFFIX = 1.15;
export function affixRange(k: AffixKey, q: Quality): [number, number] {
  if (q === 'red') {
    const [lo, hi] = AFFIX_RANGE[k].orange;
    return [lo * RED_AFFIX, hi * RED_AFFIX];
  }
  return AFFIX_RANGE[k][(q === 'white' ? 'green' : q) as 'green' | 'purple' | 'orange'];
}

export function rollQuality(rng: Rng, maxQuality: Quality, guaranteeMin?: Quality): Quality {
  const order: Quality[] = ['white', 'green', 'purple', 'orange', 'red'];
  const w = { ...CONFIG.loot.qualityWeights } as Record<Quality, number>;
  let q = weighted(rng, w);
  if (order.indexOf(q) > order.indexOf(maxQuality)) q = maxQuality;
  if (guaranteeMin && order.indexOf(q) < order.indexOf(guaranteeMin)) q = guaranteeMin;
  return q;
}

let counter = 0;

export function makeItem(rng: Rng, ilvl: number, quality: Quality, slot?: Slot): Item {
  const s: Slot = slot ?? pick(rng, slotsAt(ilvl));
  const qMult = { white: 1, green: 1.25, purple: 1.6, orange: 2, red: 2.4 }[quality];
  const main =
    s === 'pen'
      ? Math.max(1, Math.round((1 + ilvl * 0.6) * qMult))
      : s === 'coat'
        ? Math.max(2, Math.round((3 + ilvl * 1.5) * qMult))
        : s === 'amulet'
          ? Math.round((0.01 + ilvl * 0.002) * qMult * 1000) / 1000
          : s === 'glasses'
            ? GLASSES_MAIN[quality]
            : s === 'phones'
              ? PHONES_MAIN[quality]
            : DICT_MAIN[quality];
  const keys = Object.keys(AFFIX_RANGE) as AffixKey[];
  const affixes: Affix[] = [];
  const pool = keys.slice();
  for (let i = 0; i < AFFIX_COUNT[quality]; i++) {
    const k = pool.splice(Math.floor(rng() * pool.length), 1)[0];
    const [lo, hi] = affixRange(k, quality);
    affixes.push({ key: k, value: Math.round(between(rng, lo, hi) * 100) / 100 });
  }
  counter += 1;
  return {
    id: `it${Date.now().toString(36)}${counter}${Math.floor(rng() * 1e4)}`,
    slot: s,
    quality,
    ilvl,
    name: pick(rng, NAMES[s][quality]),
    main,
    affixes,
    legendary: quality === 'orange' || quality === 'red' ? pick(rng, LEGENDARY_KEYS) : undefined,
  };
}

export function mainStatText(it: Item): string {
  switch (it.slot) {
    case 'pen':
      return `攻击 +${it.main}`;
    case 'coat':
      return `生命 +${it.main}`;
    case 'amulet':
      return `暴击率 +${(it.main * 100).toFixed(1)}%`;
    case 'dict':
      return `打字题伤害 +${Math.round(dictMain(it) * 100)}%`;
    case 'glasses':
      return `答错时受到的伤害 −${Math.round(it.main * 100)}%`;
    case 'phones':
      return `听力题伤害 +${Math.round(it.main * 100)}%（每档再 +${Math.round(PHONES_PER_TIER * 100)}%）`;
  }
}

/** Rough power score to compare items in the bag. */
export function itemScore(it: Item): number {
  const base = it.slot === 'pen' ? it.main * 3 : it.slot === 'coat' ? it.main : it.slot === 'amulet' ? it.main * 300 : it.slot === 'glasses' || it.slot === 'phones' ? it.main * 200 : dictMain(it) * 200;
  // 碎片换档: a pen / coat / amulet tier is worth far more than its main stat.
  const tier = ['pen', 'coat', 'amulet'].includes(it.slot) ? (it.tier ?? 0) * 40 : 0;
  return base + tier + it.affixes.reduce((s, a) => s + a.value * 60, 0);
}

export function requiredLevel(it: Item): number {
  return Math.max(1, it.ilvl - 2);
}
