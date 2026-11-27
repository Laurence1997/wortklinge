// 开口表达观点 (游戏设计 四「121–200 级」13 议会堡, 121 级; 0.8 先用 B1 话题): a monster throws out a claim, the player
// answers with an opinion pattern (Ich bin der Ansicht, dass …) and a reason; the AI judges whether it makes sense.
// The rule check runs first and alone when the AI can't be reached (offline, not logged in, out of credit).
//
// 暂定 (not in the doc): how often a monster opens with a claim, and what the verdict does — a sound answer starts the
// fight with the monster at half health, a weak one lets it strike first.

import type { GameState } from './state';
import type { Word } from './types';

export const OPINION = { from: 121, chance: 0.12, hpCut: 0.5, minWords: 8 };

/** B1 topics until the B2 ones come with the regions (0.9). */
export const CLAIMS: Array<{ de: string; zh: string }> = [
  { de: 'Handys sollten in der Schule verboten sein.', zh: '学校里应该禁止手机。' },
  { de: 'In der Stadt braucht man kein Auto.', zh: '在城市里不需要汽车。' },
  { de: 'Wer Deutsch lernen will, muss in Deutschland leben.', zh: '想学德语就必须住在德国。' },
  { de: 'Fleisch sollte teurer sein.', zh: '肉应该更贵。' },
  { de: 'Homeoffice ist besser als Arbeit im Büro.', zh: '在家办公比去办公室好。' },
  { de: 'Kinder sollten kein eigenes Handy haben.', zh: '孩子不该有自己的手机。' },
  { de: 'Der öffentliche Nahverkehr sollte kostenlos sein.', zh: '公共交通应该免费。' },
  { de: 'Am Sonntag sollten alle Geschäfte geöffnet sein.', zh: '星期天所有商店都应该开门。' },
  { de: 'Bücher sind besser als Filme.', zh: '书比电影好。' },
  { de: 'Man sollte nach der Schule erst einmal ein Jahr reisen.', zh: '中学毕业后应该先旅行一年。' },
  { de: 'Soziale Medien machen einsam.', zh: '社交媒体让人孤独。' },
  { de: 'Eine Fremdsprache lernt man am besten mit Apps.', zh: '学外语最好用应用程序。' },
  { de: 'Auf dem Land lebt man besser als in der Stadt.', zh: '住在乡下比住在城市好。' },
  { de: 'Hausaufgaben sollte man abschaffen.', zh: '应该取消家庭作业。' },
  { de: 'Mit Geld kann man Glück kaufen.', zh: '钱能买到幸福。' },
  { de: 'Jeder sollte im Haushalt gleich viel arbeiten.', zh: '家务应该每个人做得一样多。' },
  { de: 'Fliegen sollte man nur noch in Notfällen.', zh: '只有紧急情况才应该坐飞机。' },
  { de: 'Mieten in großen Städten sollten begrenzt werden.', zh: '大城市的房租应该限价。' },
  { de: 'Man sollte jeden Tag Sport treiben.', zh: '应该每天运动。' },
  { de: 'Ehrlichkeit ist immer die beste Lösung.', zh: '诚实永远是最好的办法。' },
];

// (?!\p{L}) instead of a closing \b: JS \b counts ü as a non-letter, so "dafür," would never end a match.
const OPENERS = /\b(ich bin der (ansicht|meinung|auffassung|überzeugung)|meiner (meinung|ansicht) nach|meines erachtens|ich finde|ich denke|ich glaube|ich meine|ich bin (davon )?überzeugt|ich halte|aus meiner sicht|ich stimme|ich bin (nicht )?einverstanden|ich bin (dafür|dagegen|fürs?|gegen)|ich sehe das)(?!\p{L})/iu;
// "z. B." ends in a dot, so it sits outside the \b group (a \b after the dot needs a letter right behind it).
const REASONS = /\b(weil|denn|da|deshalb|deswegen|darum|zum beispiel|einerseits|außerdem|trotzdem|obwohl)\b|\bz\.\s?b\./i;

export interface OpinionCheck {
  ok: boolean;
  /** What is missing, in Chinese, when not ok. */
  why?: string;
}

/** The rule part: an opinion opener, a reason, and enough words. */
export function opinionRule(reply: string): OpinionCheck {
  const t = reply.trim();
  const words = t.split(/\s+/).filter(Boolean).length;
  if (!OPENERS.test(t)) return { ok: false, why: '先用一个观点句式开头（Ich bin der Ansicht, dass … / Meiner Meinung nach … / Ich finde, …）。' };
  if (!REASONS.test(t)) return { ok: false, why: '还要给一个理由（weil …, denn …, zum Beispiel …）。' };
  if (words < OPINION.minWords) return { ok: false, why: `说得太短了，至少 ${OPINION.minWords} 个词。` };
  return { ok: true };
}

/** Does this map monster open with a claim? Not the first meeting with a word, never phrases. */
export function opinionEligible(s: GameState, w: Word): boolean {
  return s.level >= OPINION.from && !!s.words[w.id] && w.pos !== 'phr';
}

export function pickClaim(rng: () => number): { de: string; zh: string } {
  return CLAIMS[Math.floor(rng() * CLAIMS.length)];
}
