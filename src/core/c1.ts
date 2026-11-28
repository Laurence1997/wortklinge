// C1 (161–200 级, 游戏设计 rev 488) pay rules, Lucas 2026-11-28「按推荐」(options 1 + 3).
// - C1 fields add no words: regions 17, 18, 20 (their zones have no word of their own) and the 蚀变④ scenes on the
//   old maps 9–12 fill with words you already know (src/core/spawn.ts). Such a monster used to keep its word's level,
//   so the level gap cut it to 1–2 XP. From 161 it stands at your level (like a 复习怪 already does) and pays at
//   least the due rate, even as a shadow. Only the reward and level change: the SRS ladder is untouched.
// - An unread C1 article (src/data/articlesC1-gen.ts) whose content questions are all answered right in the fight
//   pays as a new word monster ×1.75 (the 挑战怪 rate), once per article (GameState.articlesDone).

import type { GameState } from './state';
import type { ZoneId } from './types';
import { WORDS } from '../data/words';
import { ERODE_DEFS, REGION_DEF } from '../data/zones';
import { SCENES, SCENE_BY_ID } from '../data/world';
import { erodeOpen } from './erosion';
import { articleB2ById } from './gram/articleB2';
import type { Battle } from './combat';

export const C1_CFG = {
  /** First C1 level (end of the B2 突破试炼 stage at 160). */
  from: 161,
  /** C1 article segments (regions / 蚀变 segment 17–20). */
  articleSegFrom: 17,
  /** 零号站台 / 语法秘境 clear reward from 161 (review 1.0.12). The clear pays a fixed share of a level; from 161 an
   *  at-level monster dies to 1–2 answers, so a run lasts about 100 s and the dungeon paid about 2× the C1 field's XP
   *  per hour (sim: L170 7068 vs 3499 XP/h; the B2 field at L130 is within 1.26× of it). ×0.4 brings it back to about
   *  1.1–1.2× (kills are a quarter of a run's XP and stay as they are). */
  dungeonClearMult: 0.4,
};

/** The share of a dungeon's clear reward paid at this level (1 below C1). */
export function dungeonClearMult(level: number): number {
  return level >= C1_CFG.from ? C1_CFG.dungeonClearMult : 1;
}

const ZONES_WITH_WORDS = new Set<string>(WORDS.map((w) => w.zone));

/** Field zones of C1 regions that have no word of their own (r17a–c, r18a–c, r20a–c). */
export const C1_ZONES: ReadonlySet<ZoneId> = new Set(
  SCENES.filter((sc) => !!sc.zone && REGION_DEF[sc.region]?.stage === 'C1' && !ZONES_WITH_WORDS.has(sc.zone)).map((sc) => sc.zone!),
);

/** 蚀变 segments of the C1 stage (蚀变④, 19). */
export const C1_ERODE_SEGS: ReadonlySet<number> = new Set(ERODE_DEFS.filter((e) => e.stage === 'C1').map((e) => e.seg));

/** A monster spawned in this zone (and scene, on the scene map) is a C1 field monster for this player. */
export function c1Field(s: GameState, zone: ZoneId | undefined, sceneId?: string): boolean {
  if (s.level < C1_CFG.from || !zone) return false;
  if (C1_ZONES.has(zone)) return true;
  const sc = sceneId ? SCENE_BY_ID[sceneId] : undefined;
  return !!sc && sc.zone === zone && !!sc.erodeSeg && C1_ERODE_SEGS.has(sc.erodeSeg) && erodeOpen(s, sc.erodeSeg);
}

/** A C1 reading article (no new words, segment 17–20). */
export function isC1Article(id: string | undefined): boolean {
  const a = id ? articleB2ById(id) : undefined;
  return !!a && a.seg >= C1_CFG.articleSegFrom && !a.lemmas.length;
}

/** This fight's C1 article still pays the bonus: unread when this fight drew it (a failed article that comes back is
 *  read, its answers seen), never finished all right before, and no miss on it yet. */
export function c1ArticleOpen(s: GameState, b: Pick<Battle, 'notice'>): boolean {
  const n = b.notice;
  return !!n && !n.miss && !n.reread && isC1Article(n.id) && !s.articlesDone?.[n.id];
}

/** Every content question of the C1 article was answered right in this fight (and the bonus is still open). */
export function c1ArticleAllRight(s: GameState, b: Pick<Battle, 'notice'>): boolean {
  if (!c1ArticleOpen(s, b)) return false;
  const a = articleB2ById(b.notice!.id)!;
  const right = new Set(b.notice!.right ?? []);
  return a.qs.every((_, i) => right.has(i));
}
