// 镜像怪 (35 级): a verb monster that mirrors you — every attack question is the reflexive pronoun on its own verb.
// Dative (mir / dir) joins at 81. Some verb monsters with a reflexive use turn up as 镜像怪 (about one in three).

import { pick, type Rng } from '../rng';
import { REFL_ZH, REFLEXIVE_ACC, REFLEXIVE_DAT } from '../../data/grammar/reflexive';
import type { Word } from '../types';
import type { GramTask } from './task';

export const MIRROR = { from: 35, datFrom: 81, chance: 1 / 3 };

export function hasMirror(w: Word): boolean {
  return w.pos === 'v' && !!REFLEXIVE_ACC[w.de];
}

export function mirrorTask(w: Word, rng: Rng, level: number): GramTask | null {
  if (w.pos !== 'v') return null;
  const acc = REFLEXIVE_ACC[w.de] ?? [];
  const dat = level >= MIRROR.datFrom ? REFLEXIVE_DAT[w.de] ?? [] : [];
  const rows = [...acc.map((r) => ({ r, d: false })), ...dat.map((r) => ({ r, d: true }))];
  if (!rows.length) return null;
  const { r, d } = pick(rng, rows);
  const [de, ans, zh] = r;
  return {
    sys: 'mirror',
    prompt: `镜像怪：填反身代词（${REFL_ZH[ans] ?? ''}）· ${zh}`,
    focus: de,
    answer: ans,
    tier: 1,
    rule: d
      ? '句子里已经有第四格宾语（die Hände）时，反身代词用第三格：mir, dir, sich, uns, euch, sich'
      : '反身代词（第四格）：mich, dich, sich, uns, euch, sich（Sie 也用 sich）',
    full: de.replace('___', ans),
    zh,
    wordId: w.id,
  };
}
