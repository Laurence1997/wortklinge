import { CONFIG } from './config';
import { between, pick, weighted, type Rng } from './rng';
import type { Affix, AffixKey, Item, Quality, Slot } from './types';

const NAMES: Record<Slot, Record<Quality, string[]>> = {
  pen: {
    white: ['秃头铅笔', '断尖圆珠笔', '营地粉笔'],
    green: ['磨尖的铅笔', '旧钢笔', '记号笔'],
    purple: ['守夜人的鹅毛笔', '灰烬钢笔'],
    orange: ['冠词审判者'],
  },
  coat: {
    white: ['破外套', '旧雨衣', '烧焦的毛衣'],
    green: ['厚呢大衣', '补过的雨衣', '工装夹克'],
    purple: ['守火人斗篷', '铁轨工大衣'],
    orange: ['冠词审判者的长袍'],
  },
  amulet: {
    white: ['旧车票', '钥匙扣', '纽扣'],
    green: ['褪色的车票护符', '铜钥匙坠'],
    purple: ['余烬吊坠', '无名者的戒指'],
    orange: ['冠词审判者的徽记'],
  },
  dict: {
    white: ['缺页小词典', '单词卡片'],
    green: ['口袋词典', '旧语法书'],
    purple: ['守夜人笔记', '烧焦的杜登'],
    orange: ['冠词审判者的典籍'],
  },
  // 0.6 第 6 块 (23 级): the fifth slot; main stat = less damage from a charged hit.
  glasses: {
    white: ['裂了一片的眼镜', '站台捡的墨镜'],
    green: ['站长的老花镜', '圆框眼镜'],
    purple: ['检票员的单片镜', '时刻表读书镜'],
    orange: ['冠词审判者的镜片'],
  },
};

/** 眼镜 main stat by quality: a charged hit on you does this much less. */
export const GLASSES_MAIN: Record<Quality, number> = { white: 0.05, green: 0.08, purple: 0.12, orange: 0.16 };
/** Glasses drop only from Lv23 (region 3). */
export const GLASSES_FROM = 23;

export const SLOT_ZH: Record<Slot, string> = { pen: '笔', coat: '外套', amulet: '护符', dict: '词典', glasses: '眼镜' };
export const QUALITY_ZH: Record<Quality, string> = { white: '普通', green: '优秀', purple: '史诗', orange: '传说' };

export const AFFIX_ZH: Record<AffixKey, (v: number) => string> = {
  typedDmg: (v) => `默写伤害 +${pct(v)}`,
  choiceCrit: (v) => `选择题暴击率 +${pct(v)}`,
  vsMasc: (v) => `对阳性名词怪伤害 +${pct(v)}`,
  vsFem: (v) => `对阴性名词怪伤害 +${pct(v)}`,
  vsNeut: (v) => `对中性名词怪伤害 +${pct(v)}`,
  wrongDmgReduce: (v) => `答错时受到伤害 −${pct(v)}`,
  xp: (v) => `经验 +${pct(v)}`,
  dropRate: (v) => `掉宝率 +${pct(v)}`,
  sentenceDmg: (v) => `句式攻击伤害 +${pct(v)}`,
};

function pct(v: number): string {
  return `${Math.round(v * 100)}%`;
}

/** Affix ranges by quality (游戏设计 › 词条库, scaled down for Lv 1–10). */
export const AFFIX_RANGE: Record<AffixKey, Record<'green' | 'purple' | 'orange', [number, number]>> = {
  typedDmg: { green: [0.06, 0.1], purple: [0.11, 0.16], orange: [0.17, 0.22] },
  choiceCrit: { green: [0.02, 0.03], purple: [0.04, 0.05], orange: [0.06, 0.07] },
  vsMasc: { green: [0.05, 0.08], purple: [0.09, 0.13], orange: [0.14, 0.2] },
  vsFem: { green: [0.05, 0.08], purple: [0.09, 0.13], orange: [0.14, 0.2] },
  vsNeut: { green: [0.05, 0.08], purple: [0.09, 0.13], orange: [0.14, 0.2] },
  wrongDmgReduce: { green: [0.03, 0.05], purple: [0.06, 0.08], orange: [0.09, 0.12] },
  xp: { green: [0.02, 0.03], purple: [0.04, 0.05], orange: [0.06, 0.08] },
  dropRate: { green: [0.05, 0.1], purple: [0.11, 0.2], orange: [0.21, 0.3] },
  sentenceDmg: { green: [0.06, 0.1], purple: [0.11, 0.16], orange: [0.17, 0.22] },
};

const AFFIX_COUNT: Record<Quality, number> = { white: 0, green: 1, purple: 2, orange: 3 };

export function rollQuality(rng: Rng, maxQuality: Quality, guaranteeMin?: Quality): Quality {
  const order: Quality[] = ['white', 'green', 'purple', 'orange'];
  const w = { ...CONFIG.loot.qualityWeights } as Record<Quality, number>;
  let q = weighted(rng, w);
  if (order.indexOf(q) > order.indexOf(maxQuality)) q = maxQuality;
  if (guaranteeMin && order.indexOf(q) < order.indexOf(guaranteeMin)) q = guaranteeMin;
  return q;
}

let counter = 0;

export function makeItem(rng: Rng, ilvl: number, quality: Quality, slot?: Slot): Item {
  const s: Slot = slot ?? pick(rng, (ilvl >= GLASSES_FROM ? ['pen', 'coat', 'amulet', 'dict', 'glasses'] : ['pen', 'coat', 'amulet', 'dict']) as Slot[]);
  const qMult = { white: 1, green: 1.25, purple: 1.6, orange: 2 }[quality];
  const main =
    s === 'pen'
      ? Math.max(1, Math.round((1 + ilvl * 0.6) * qMult))
      : s === 'coat'
        ? Math.max(2, Math.round((3 + ilvl * 1.5) * qMult))
        : s === 'amulet'
          ? Math.round((0.01 + ilvl * 0.002) * qMult * 1000) / 1000
          : s === 'glasses'
            ? GLASSES_MAIN[quality]
            : Math.min(4, quality === 'white' ? 1 : quality === 'green' ? 1 : quality === 'purple' ? 2 : 3);
  const keys = Object.keys(AFFIX_RANGE) as AffixKey[];
  const affixes: Affix[] = [];
  const pool = keys.slice();
  for (let i = 0; i < AFFIX_COUNT[quality]; i++) {
    const k = pool.splice(Math.floor(rng() * pool.length), 1)[0];
    const [lo, hi] = AFFIX_RANGE[k][quality as 'green' | 'purple' | 'orange'];
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
    legendary: quality === 'orange' ? 'articleJudgement' : undefined,
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
      return `低语纸条上限 +${it.main}`;
    case 'glasses':
      return `蓄力大招对你的伤害 −${Math.round(it.main * 100)}%`;
  }
}

/** Rough power score to compare items in the bag. */
export function itemScore(it: Item): number {
  const base = it.slot === 'pen' ? it.main * 3 : it.slot === 'coat' ? it.main : it.slot === 'amulet' ? it.main * 300 : it.slot === 'glasses' ? it.main * 200 : it.main * 6;
  return base + it.affixes.reduce((s, a) => s + a.value * 60, 0);
}

export function requiredLevel(it: Item): number {
  return Math.max(1, it.ilvl - 2);
}
