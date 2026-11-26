// 失语者的遗书 (游戏设计 剧情「遗书真相」, 1.0): from region 4 on, five letters per region (蚀变 segments too) lie in
// its field scenes, written with that region's words and grammar. One of the lines is the archivist Ilse Lehmann's.
// Found in the scene panel; read with the Chinese one paragraph at a time; kept in the 档案 (word book) to re-read.
// Placement, the read reward and the archive are the systems thread's implementation (暂定, written to the docs).

import { ERODE_DEF, fieldScenes, regionLevels } from '../data/zones';
import { LETTERS } from '../data/letters';
import { erodeOpen } from './erosion';
import type { GameState } from './state';

export interface Letter {
  id: string;
  /** Region or 蚀变 segment (4–20). */
  region: number;
  /** 1–5 inside the region. */
  n: number;
  from: string;
  /** 'Ilse' on the main line. */
  main: string | null;
  title: string;
  /** Paragraphs. */
  de: string[];
  zh: string[];
  /** The region words it is written with. */
  words: string[];
  grammar: string;
  /** What it reveals (shown in the archive once read). */
  clue: string;
  src: string;
}

export const LETTER_CFG = {
  /** 暂定: first read gives this share of the XP to the next level. */
  xpShare: 0.03,
};

export const LETTER_BY_ID: Record<string, Letter> = Object.fromEntries(LETTERS.map((l) => [l.id, l]));

/** The field scenes a region's letters lie in (a 蚀变 segment's: its old host scenes). */
function hostScenes(region: number): string[] {
  const e = ERODE_DEF[region];
  if (e) return e.scenes.map((x) => x.scene);
  return fieldScenes(region).flat();
}

/** Scene of each letter: spread evenly over the region's route, letter 1 near the start, 5 near the end. */
const SCENE_OF = new Map<string, string>();
for (const l of LETTERS) {
  const hosts = hostScenes(l.region);
  if (!hosts.length) continue;
  const per = LETTERS.filter((x) => x.region === l.region).length || 5;
  const i = Math.min(hosts.length - 1, Math.floor(((l.n - 0.5) / per) * hosts.length));
  SCENE_OF.set(l.id, hosts[i]);
}

export function letterScene(id: string): string | undefined {
  return SCENE_OF.get(id);
}

/** Letters lying in this scene that this player can see now (its region's level reached, a 蚀变 layer opened). */
export function lettersIn(s: GameState, sceneId: string): Letter[] {
  return LETTERS.filter((l) => SCENE_OF.get(l.id) === sceneId && letterVisible(s, l));
}

export function letterVisible(s: GameState, l: Letter): boolean {
  if (ERODE_DEF[l.region]) return erodeOpen(s, l.region);
  return s.level >= regionLevels(l.region)[0] - 5;
}

export function lettersRead(s: GameState): Record<string, number> {
  return (s.letters ??= {});
}

export function isRead(s: GameState, id: string): boolean {
  return !!s.letters?.[id];
}

/** Marks a letter read; true the first time (the caller gives the XP). */
export function readLetter(s: GameState, id: string, t = Date.now()): boolean {
  const r = lettersRead(s);
  if (r[id] || !LETTER_BY_ID[id]) return false;
  r[id] = t;
  return true;
}

/** The archive: read letters by region, Ilse's main line in its own order. */
export function archive(s: GameState): { main: Letter[]; byRegion: Array<{ region: number; letters: Letter[]; total: number }> } {
  const read = LETTERS.filter((l) => isRead(s, l.id));
  const regions = [...new Set(LETTERS.map((l) => l.region))].sort((a, b) => a - b);
  return {
    main: read.filter((l) => l.main === 'Ilse').sort((a, b) => a.region - b.region || a.n - b.n),
    byRegion: regions.map((region) => ({ region, letters: read.filter((l) => l.region === region).sort((a, b) => a.n - b.n), total: LETTERS.filter((l) => l.region === region).length })).filter((x) => x.letters.length),
  };
}
