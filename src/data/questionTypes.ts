// 题型奖励表 (游戏设计 › 0.4 战斗修正版): every question type is rated on two axes.
// tier (难度) decides armor: 0 choice = full armor, 1 typed = half, 2 hard = breaks it (this hit + the next two).
// res (鼓励程度) is how much 墨水 / 沉着 / 言灵 a correct answer earns; it never multiplies damage.
// A new question type gets a row here first.

export type QKey =
  | 'article' | 'pickDe' | 'pickZh' | 'callout'
  | 'typed' | 'conj' | 'plural'
  | 'clozePick' | 'clozeBase' | 'clozeForm'
  | 'sentence' | 'sayingPick' | 'sayingTyped'
  | 'storm' | 'skill' | 'steady';

export interface QTypeRow {
  zh: string;
  tier: 0 | 1 | 2;
  res: number;
}

export const QTYPES: Record<QKey, QTypeRow> = {
  article: { zh: '选冠词', tier: 0, res: 0 },
  pickDe: { zh: '看中文选德语', tier: 0, res: 0 },
  pickZh: { zh: '听音选意思', tier: 0, res: 0 },
  callout: { zh: '点名（喊冠词）', tier: 0, res: 0 },
  clozePick: { zh: '完形填空 · 三选一', tier: 0, res: 0 },
  sayingPick: { zh: '接句 · 选', tier: 0, res: 0 },
  typed: { zh: '默写', tier: 1, res: 1 },
  conj: { zh: '写变位', tier: 1, res: 1 },
  plural: { zh: '写复数', tier: 1, res: 1 },
  clozeBase: { zh: '完形填空 · 填原形', tier: 1, res: 1 },
  sayingTyped: { zh: '接句 · 打字', tier: 1, res: 1 },
  clozeForm: { zh: '完形填空 · 填变形', tier: 2, res: 2 },
  // Spenders and class moves earn nothing.
  sentence: { zh: '终结技 · 看中文写整句', tier: 2, res: 0 },
  storm: { zh: '墨水风暴', tier: 1, res: 0 },
  skill: { zh: '技能（整句）', tier: 1, res: 0 },
  steady: { zh: '稳住', tier: 0, res: 0 },
};
