// AI 练习 (游戏设计 rev 459): which words the 决斗场 / 批改造句 / 小作文 hand the player, and the rule check of a
// 造句 answer (场景精英 第 3 段). The model itself lives in the `ai-tutor` edge function (src/net/aiTutor.ts).

import { checkJournal, usesWord } from './journal';
import { isRetired, kindOf, stageOf } from './srs';
import { now, type GameState } from './state';
import type { Word } from './types';
import { WORDS } from '../data/words';

/** Learned but not mastered: 半名 (stage 2) or due for review, never retired, phrases or numbers. */
export function practiceWords(s: GameState, t = now(s), pool: Word[] = WORDS): Word[] {
  const ok = (w: Word) => w.pos !== 'phr' && w.pos !== 'num' && !w.digit && w.family !== 'truhe';
  const list = pool.filter((w) => {
    const p = s.words[w.id];
    if (!p || isRetired(p) || !ok(w)) return false;
    return kindOf(s, w, t) === 'due' || stageOf(s, w, t) === 2;
  });
  // Due first (most overdue), then 半名 seen most recently.
  const due = (w: Word) => (kindOf(s, w, t) === 'due' ? 0 : 1);
  return list.sort((a, b) => due(a) - due(b) || (due(a) === 0 ? s.words[a.id].due - s.words[b.id].due : (s.words[b.id].lastSeen ?? 0) - (s.words[a.id].lastSeen ?? 0)));
}

/** n words for one practice, drawn from the first 3n candidates so repeats vary. */
export function drawPractice(s: GameState, n: number, rng: () => number, t = now(s)): Word[] {
  const cand = practiceWords(s, t).slice(0, n * 3);
  const out: Word[] = [];
  while (out.length < n && cand.length) out.push(cand.splice(Math.floor(rng() * cand.length), 1)[0]);
  return out;
}

/** 造句 by rule: the sentence uses the word, has 3+ words, and no article or person mistake the rules are sure of. */
export function gradeCompose(input: string, w: Word): { ok: boolean; notes: string[] } {
  const text = input.trim();
  const n = text.split(/\s+/).filter(Boolean).length;
  if (!usesWord(text, w)) return { ok: false, notes: [`句子里要用上 ${w.art ? `${w.art} ${w.de}` : w.de}（${w.zh}）`] };
  if (n < 3) return { ok: false, notes: ['写一句完整的短句（至少 3 个词）'] };
  const hints = checkJournal(text, [w]).filter((h) => h.kind === 'article' || h.kind === 'verb');
  return { ok: !hints.length, notes: hints.map((h) => h.text) };
}
