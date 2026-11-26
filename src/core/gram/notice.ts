// 告示怪 / 信件怪 (15 级): now and then a monster of a field carries its scene's notice or letter. The text is shown
// above every question, and its attack questions ask what the text says (choice). Damage as usual.

import { shuffle, type Rng } from '../rng';
import { articleNotice } from './articleB2';
import { ARTICLES, NOTICES, type Notice } from '../../data/grammar/notices';
import type { GramTask } from './task';

export const NOTICE_CFG = { from: 15, chance: 0.12, articleFrom: 81, articleChance: 0.08 };

export function noticeFor(zone: string, rng: Rng, region?: number): Notice | null {
  const ns = NOTICES.filter((n) => n.zone === zone || (region !== undefined && n.region === region));
  return ns.length ? ns[Math.floor(rng() * ns.length)] : null;
}

export function noticeById(id: string): Notice | undefined {
  return NOTICES.find((n) => n.id === id) ?? ARTICLES.find((n) => n.id === id) ?? articleNotice(id);
}

/** 文章群怪 (81): an article for a pack (each member asks from its own starting question). */
export function articleFor(rng: Rng): Notice | null {
  return ARTICLES.length ? ARTICLES[Math.floor(rng() * ARTICLES.length)] : null;
}

export const KIND_ZH = { notice: '告示怪', letter: '信件怪', article: '文章群怪' } as const;

/** Question `i` (cycling) of a notice. */
export function noticeTask(n: Notice, i: number, rng: Rng): GramTask {
  const q = n.qs[i % n.qs.length];
  return {
    sys: 'notice',
    prompt: `${KIND_ZH[n.kind]}：读上面的${n.kind === 'letter' ? '信' : n.kind === 'article' ? '文章' : '告示'}，回答 · ${q.q}`,
    focus: n.title,
    answer: q.answer,
    options: shuffle(rng, q.options),
    tier: 0,
    rule: q.qZh ? `题目意思：${q.qZh}。答案就在文章里，再读一遍找找看。` : '答案就在文字里，再读一遍找找看。',
    passage: n.text,
  };
}
