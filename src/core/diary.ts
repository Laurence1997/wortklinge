// 日记残页 (0.6 block 3): drop, restore and read-aloud rules. State lives in flags:
//   diary_<scene> = 1 dropped · 2 restored;  diaryRead_<scene> = true once read aloud.
import { DIARY, parseLine, type DiaryBlank, type DiaryPage, type DiaryPart } from '../data/diary';
import { SCENES } from '../data/world';
import { WORD_BY_ID } from '../data/words';
import { normalize } from './grading';
import type { GameState } from './state';

export const DIARY_XP = { blank: 20, restore: 30, read: 30 } as const;
/** Misses on one blank before its answer is shown. */
export const DIARY_MISSES = 2;

const groupOf = (scene: string): string[] => SCENES.find((sc) => sc.id === scene)?.words ?? [];
const regionOf = (scene: string): number => SCENES.find((sc) => sc.id === scene)?.region ?? 0;

export function pageState(s: GameState, scene: string): 0 | 1 | 2 {
  const v = s.flags[`diary_${scene}`];
  return v === 2 ? 2 : v ? 1 : 0;
}

/** Page number within its region (route order of the diary). */
export function pageNo(scene: string): number {
  const r = regionOf(scene);
  return DIARY.filter((p) => regionOf(p.scene) === r).findIndex((p) => p.scene === scene) + 1;
}

export function pageRegion(scene: string): number {
  return regionOf(scene);
}

/** Drops every page whose whole word group is at least 半名 (old saves get theirs on load). Returns the new ones. */
export function dropPages(s: GameState): DiaryPage[] {
  const out: DiaryPage[] = [];
  for (const p of DIARY) {
    if (pageState(s, p.scene)) continue;
    const g = groupOf(p.scene);
    if (g.length && g.every((id) => (s.words[id]?.stage ?? 0) >= 2)) {
      s.flags[`diary_${p.scene}`] = 1;
      out.push(p);
    }
  }
  return out;
}

export function pageLines(p: DiaryPage): DiaryPart[][] {
  return p.lines.map((l) => parseLine(l, (id) => WORD_BY_ID[id].de));
}

export function blanksOf(p: DiaryPage): DiaryBlank[] {
  return pageLines(p).flat().filter((x): x is DiaryBlank => typeof x !== 'string');
}

export function checkBlank(input: string, b: DiaryBlank): boolean {
  return normalize(input) === normalize(b.form) && normalize(input) !== '';
}

/** Restoring a page: +20 per blank right on the first try and +30, the first time only (no level-gap decay). */
export function restorePage(s: GameState, scene: string, firstTry: number): number {
  if (pageState(s, scene) === 2) return 0;
  s.flags[`diary_${scene}`] = 2;
  return firstTry * DIARY_XP.blank + DIARY_XP.restore;
}

/** Reading a restored page aloud: +30 the first time. */
export function readPage(s: GameState, scene: string): number {
  if (s.flags[`diaryRead_${scene}`]) return 0;
  s.flags[`diaryRead_${scene}`] = true;
  return DIARY_XP.read;
}

/** Every page of the region restored (the region's title). */
export function regionRestored(s: GameState, region: number): boolean {
  const ps = DIARY.filter((p) => regionOf(p.scene) === region);
  return ps.length > 0 && ps.every((p) => pageState(s, p.scene) === 2);
}

/** The whole text of a line with its blanks filled (for reading aloud). */
export function lineText(parts: DiaryPart[]): string {
  return parts.map((x) => (typeof x === 'string' ? x : x.form)).join('');
}
