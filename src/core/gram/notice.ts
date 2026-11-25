// 告示怪 / 信件怪 (15 级): now and then a monster of a field carries its scene's notice or letter. The text is shown
// above every question, and its attack questions ask what the text says (choice). Damage as usual.

import { shuffle, type Rng } from '../rng';
import { NOTICES, type Notice } from '../../data/grammar/notices';
import type { GramTask } from './task';

export const NOTICE_CFG = { from: 15, chance: 0.12 };

export function noticeFor(zone: string, rng: Rng): Notice | null {
  const ns = NOTICES.filter((n) => n.zone === zone);
  return ns.length ? ns[Math.floor(rng() * ns.length)] : null;
}

export function noticeById(id: string): Notice | undefined {
  return NOTICES.find((n) => n.id === id);
}

/** Question `i` (cycling) of a notice. */
export function noticeTask(n: Notice, i: number, rng: Rng): GramTask {
  const q = n.qs[i % n.qs.length];
  return {
    sys: 'notice',
    prompt: `${n.kind === 'letter' ? '信件怪' : '告示怪'}：读上面的${n.kind === 'letter' ? '信' : '告示'}，回答 · ${q.q}`,
    focus: n.title,
    answer: q.answer,
    options: shuffle(rng, q.options),
    tier: 0,
    rule: '答案就在文字里，再读一遍找找看。',
    passage: n.text,
  };
}
