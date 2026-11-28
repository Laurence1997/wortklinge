// 言灵锁 (审查修订 2026-11-25): every gear action — 紫装鉴定, 宝箱言灵锁, 刻字 — asks one question on your most overdue
// word; right = the roll is made twice and the better kept, wrong = it still happens, rolled once.
// 紫装德语鉴定 (23 级): purple drops and chest items come unidentified (slot and main stat shown, affixes hidden and
// inactive, can still be worn). Mira identifies them with the lock question: right = every affix rolled twice.

import type { BossQuestion } from '../data/boss';
import { WORD_BY_ID, WORDS } from '../data/words';
import { now } from './state';
import type { Word } from './types';
import { makeCloze } from './cloze';
import { normalize } from './grading';
import { defDe, hidesZh, letterHint } from './dedef';
import { AFFIX_RANGE } from './loot';
import type { Rng } from './rng';
import type { GameState } from './state';
import type { Item } from './types';
import { CONFIG } from './config';
import { PARTICLE_SENTENCES } from '../data/particles';

export const IDENTIFY_FROM = 23;

/** New drops and chest items: purple comes unidentified from Lv23; purple/orange carry a 刻字孔 from Lv25. */
export function markUnidentified(s: GameState, it: Item): void {
  if (it.quality === 'purple' && s.level >= IDENTIFY_FROM) it.unidentified = true;
  if ((it.quality === 'purple' || it.quality === 'orange') && s.level >= CONFIG.engrave.from) it.socket = '';
}

export function socketItems(s: GameState): Item[] {
  return [...Object.values(s.equipped), ...s.bag].filter((x): x is Item => !!x && x.socket !== undefined);
}

/** 刻字: one cloze with the particle blanked out. */
export function engraveQuestion(word: 'auch' | 'denn', rng: Rng): BossQuestion {
  const line = PARTICLE_SENTENCES[word][Math.floor(rng() * PARTICLE_SENTENCES[word].length)];
  const [de, zh = ''] = line.split('|');
  return { id: `engrave-${word}`, ask: [de.replace(/\{[^}]+\}/, '___')], zh: `${zh}（填 auch 或 denn）`, accept: [new RegExp(`^${word}$`)], model: de.replace(/[{}]/g, '') };
}

export function unidentifiedItems(s: GameState): Item[] {
  return [...Object.values(s.equipped), ...s.bag].filter((x): x is Item => !!x && !!x.unidentified);
}

export function identify(it: Item, right: boolean, rng: Rng): void {
  if (right)
    for (const a of it.affixes) {
      const [lo, hi] = AFFIX_RANGE[a.key].purple;
      const v = Math.round((lo + rng() * (hi - lo)) * 100) / 100;
      if (v > a.value) a.value = v;
    }
  delete it.unidentified;
}

/** The 言灵锁 word: the most overdue word you know, else the one seen longest ago. */
export function lockWord(s: GameState, fallback: Word): Word {
  const t = now(s);
  let best: Word | null = null;
  let bestScore = -Infinity;
  for (const [id, p] of Object.entries(s.words)) {
    const w = WORD_BY_ID[id];
    if (!w || w.pos === 'phr' || w.digit) continue;
    const score = t - p.due; // most overdue first; not-yet-due words score negative
    if (score > bestScore) {
      bestScore = score;
      best = w;
    }
  }
  return best ?? fallback ?? WORDS[0];
}

/** The 言灵锁 question: an example sentence of your most overdue word (the next ones if it has none), form blanked. */
export function identifyQuestion(s: GameState, rng: Rng): BossQuestion {
  const met = Object.keys(s.words)
    .map((id) => WORD_BY_ID[id])
    .filter((w) => !!w && w.pos !== 'phr' && !w.digit)
    .sort((a, b) => s.words[a.id].due - s.words[b.id].due);
  for (let i = 0; i < Math.min(40, met.length); i++) {
    const w = met[i];
    const c = makeCloze(w, 'form', rng);
    if (!c) continue;
    const ans = normalize(c.answer);
    return {
      id: `identify-${w.id}`,
      ask: [c.shown],
      // 德语释义 (1.0.12): a de-tier word gives its definition and its dictionary form's first letter; the sentence's
      // Chinese is held back (examples show German only until answered).
      zh: hidesZh(w, s.settings) ? `填空：〔${defDe(w)}〕 原形 ${letterHint(w.de)}` : `${c.zh}（填空：${w.zh}）`,
      accept: [new RegExp(`^${ans.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`)],
      model: c.full,
    };
  }
  return { id: 'identify-x', ask: ['Ich ___ Lina. (heißen)'], zh: '我叫 Lina。', accept: [/^heisse$/], model: 'Ich heiße Lina.' };
}
