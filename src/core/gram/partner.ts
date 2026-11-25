// 复习伙伴 (43 级, 游戏设计 十六): a 归名 word of yours keeps you company. 审查修订 (2026-11-25): it is only the skin of
// 语境复习 — the partner brings the due word's context question (no question on itself, no extra hit). Picked at a
// camp; the newest 归名 word by default.

import type { GameState } from '../state';
import { isRetired, kindOf } from '../srs';
import { EXAMPLES } from '../cloze';
import { WORD_BY_ID, WORDS } from '../../data/words';
import type { Word } from '../types';

export const PARTNER = { from: 43, mult: 1.5, atQuestion: 1 };

/** Words that can be the partner: 归名 or retired, with an example sentence. */
export function partnerChoices(s: GameState): Word[] {
  return WORDS.filter((w) => s.words[w.id] && (EXAMPLES[w.id]?.length ?? 0) > 0 && (isRetired(s.words[w.id]) || kindOf(s, w) === 'guiming'));
}

export function partnerOf(s: GameState): Word | null {
  if (s.level < PARTNER.from) return null;
  const id = s.gram?.partner;
  if (id && WORD_BY_ID[id]) return WORD_BY_ID[id];
  const all = partnerChoices(s).sort((a, b) => (s.words[b.id].lastSeen ?? 0) - (s.words[a.id].lastSeen ?? 0));
  return all[0] ?? null;
}

export function setPartner(s: GameState, id: string): void {
  s.gram ??= {};
  s.gram.partner = id;
}
