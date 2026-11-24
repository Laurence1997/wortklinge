// Which words become monsters in a field right now.
// Order: due words (遗忘之物, most overdue first) → new words → shadows of learned words.
// No daily review cap: a returning player meets the backlog in waves, because each field only
// holds `count` monsters and at least one slot stays for something else.

import { shuffle, type Rng } from './rng';
import { isRetired, kindOf, pendingToday, reviewMon, verifyOf } from './srs';
import { now, type GameState } from './state';
import type { Word, ZoneId } from './types';
import { has } from './unlocks';
import { WORDS } from '../data/words';
import { prioritise } from './wordImport';

export interface SpawnPick {
  word: Word;
  kind: 'new' | 'due' | 'shadow';
  /** 场景刷空: this slot is for a 残句 (the word only says where it stands). */
  phrase?: boolean;
}

export function zoneWords(zone: ZoneId): Word[] {
  return WORDS.filter((w) => w.zone === zone);
}

/** The lowest monster level of a field (its easiest word). */
export function zoneMinLevel(zone: ZoneId): number {
  const ws = zoneWords(zone).filter((w) => w.family !== 'truhe');
  return ws.length ? Math.min(...ws.map((w) => w.lvl)) : 1;
}

/** Words a player can meet at their level: Lv1 fights only nouns (冠词攻击). */
export function eligible(s: GameState, w: Word): boolean {
  if (w.family === 'truhe') return false; // 宝箱怪 only appears as a rare spawn
  if (!has(s.level, 'typing') && !w.art) return false;
  return true;
}

export function pickSpawns(s: GameState, zone: ZoneId, count: number, alive: Set<string>, rng: Rng, opts: { phraseOk?: boolean } = {}): SpawnPick[] {
  const t = now(s);
  // 斩杀 (0.6.x): retired words stay away (except their 回响 check), 待验证 ones for the rest of the day.
  const gone = (w: Word) => pendingToday(s.words[w.id], t) || (isRetired(s.words[w.id]) && !verifyOf(s.words[w.id], t));
  const local = zoneWords(zone).filter((w) => eligible(s, w));
  const cut = local.filter(gone).length;
  const words = local.filter((w) => !alive.has(w.id) && !gone(w));
  const due: Word[] = [];
  const fresh: Word[] = [];
  const shadows: Word[] = [];
  const verify: Word[] = [];
  for (const w of words) {
    const k = kindOf(s, w, t);
    if (verifyOf(s.words[w.id], t)) verify.push(w);
    else if (k === 'due') due.push(w);
    else if (k === 'new') fresh.push(w);
    else if (k === 'shadow') shadows.push(w);
  }
  // Reviews (2026-11-21) come to wherever you are: due words of every field of your region and the ones before it.
  for (const w of WORDS) {
    if (w.zone === zone || alive.has(w.id) || (w.region ?? 1) > (s.region ?? 1) || !eligible(s, w)) continue;
    if (gone(w)) continue;
    if (verifyOf(s.words[w.id], t)) verify.push(w);
    else if (reviewMon(s.words[w.id], t)) due.push(w); // a learning word respawns only in its own scene
  }
  const out: SpawnPick[] = [];
  // Most overdue first. Leave room for one non-review monster so a big backlog never fills the field.
  due.sort((a, b) => s.words[a.id].due - s.words[b.id].due);
  const dueSlots = count > 1 ? count - 1 : count;
  for (const w of due.slice(0, dueSlots)) out.push({ word: w, kind: 'due' });
  // 斩杀: yesterday's 待验证 words (and due 回响 checks) come right after the reviews.
  for (const w of verify) {
    if (out.length >= dueSlots) break;
    out.push({ word: w, kind: kindOf(s, w, t) === 'new' ? 'new' : kindOf(s, w, t) === 'due' ? 'due' : 'shadow' });
  }

  // New words in list order (easiest first). No daily cap (言灵过载 removed 2026-11-20).
  // 词表导入 (2026-11-22): imported 优先 words of this scene come first, at most 3 at a time.
  const prio = new Set(s.wordImport?.ids ?? []);
  if (prio.size) fresh.splice(0, fresh.length, ...prioritise(fresh, prio));
  const newSlots = Math.min(count - out.length, Math.max(1, Math.ceil(count * 0.6)));
  for (const w of fresh.slice(0, newSlots)) out.push({ word: w, kind: 'new' });

  // 越区引导 (2026-11-21): between reviews, practise what you can't write yet: not recognised first, then
  // recognised but not written. Words you can already write stay away until they are due, so a region you
  // have learned empties out and only its reviews come back (no XP is taken away).
  const unwritten = shuffle(rng, shadows.filter((w) => !(s.words[w.id]?.write ?? 0)));
  unwritten.sort((a, b) => Number((s.words[a.id]?.read ?? 0) > 0) - Number((s.words[b.id]?.read ?? 0) > 0));
  for (const w of unwritten) {
    if (out.length >= count) break;
    out.push({ word: w, kind: 'shadow' });
  }
  // A brand-new player has few learned words: top up with new ones.
  for (const w of fresh.slice(newSlots)) {
    if (out.length >= count) break;
    out.push({ word: w, kind: 'new' });
  }
  // 场景刷空 (2026-11-24, 游戏设计 七): only the slots freed by 归名, retired and 待验证 words are filled:
  // review monsters → plural crowds of 归名 or retired nouns (Lv11+, at most a third) → 残句 (while short-saying
  // cards are missing) → new words of the next region. A scene never closes because you know its words.
  const named = local.filter((w) => !gone(w) && kindOf(s, w, t) === 'guiming').length;
  let room = Math.min(count - out.length, cut + named);
  const taken = new Set(out.map((p) => p.word.id));
  const add = (w: Word, kind: SpawnPick['kind'], phrase = false) => {
    if (room <= 0 || (taken.has(w.id) && !phrase)) return;
    out.push(phrase ? { word: w, kind, phrase } : { word: w, kind });
    if (!phrase) taken.add(w.id);
    room--;
  };
  for (const w of due) add(w, 'due');
  for (const w of verify) add(w, 'shadow');
  if (has(s.level, 'plural')) {
    let pl = Math.ceil(room / 3);
    const crowd = (x: Word) => (isRetired(s.words[x.id]) && !verifyOf(s.words[x.id], t)) || (!isRetired(s.words[x.id]) && kindOf(s, x, t) === 'guiming');
    for (const w of shuffle(rng, local.filter((x) => crowd(x) && !alive.has(x.id) && !taken.has(x.id) && !!x.art && !!x.pl && x.pl !== '-' && !x.plOnly))) {
      if (pl-- <= 0) break;
      add(w, 'shadow');
    }
  }
  // One 残句 per field at most (WorldScene turns the slot into one); its word only says which scene.
  const anchor = local.find((w) => !gone(w) && kindOf(s, w, t) === 'guiming') ?? local[0];
  if (opts.phraseOk && anchor && room > 0) add(anchor, 'shadow', true);
  const region = zoneWords(zone)[0]?.region ?? 1;
  for (const w of WORDS) {
    if (room <= 0) break;
    if ((w.region ?? 1) !== region + 1 || alive.has(w.id) || !eligible(s, w) || gone(w)) continue;
    const k = kindOf(s, w, t);
    if (k === 'new' || k === 'due') add(w, k);
  }
  return out;
}

/** 斩杀: every local word of this field is retired or 待验证 → 「这里的词你大多会了，去下一区吧」. */
export function fieldCleared(s: GameState, zone: ZoneId): boolean {
  const t = now(s);
  const ws = zoneWords(zone).filter((w) => w.family !== 'truhe' && !w.tutorial);
  return ws.length > 0 && ws.every((w) => isRetired(s.words[w.id]) || !!s.words[w.id]?.pend || (verifyOf(s.words[w.id], t) === 'pend'));
}

