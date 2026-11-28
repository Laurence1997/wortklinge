// 区内路网 (方案 3, Lucas 2026-11-28): how far you are with a scene's word group, for the route map's circles and the
// scene panel's 「去下一个没学完的格子」. A word counts as met once you have fought it (a 推定会 guess that was never
// fought still waits); a 蚀变 scene counts its advanced group once that segment is open.
import type { GameState } from './state';
import type { SceneDef } from '../data/world';
import { WORD_BY_ID } from '../data/words';
import { isPlaced } from './placement';
import { erodeOpen } from './erosion';
import { eligible } from './spawn';

export interface SceneProgress {
  met: number;
  total: number;
  /** A word here you have not met yet that can come as a monster now. */
  open: boolean;
}

export function sceneProgress(s: GameState, sc: SceneDef): SceneProgress {
  const ids = sc.erodeSeg && sc.eroded?.length && erodeOpen(s, sc.erodeSeg) ? sc.eroded : sc.words ?? [];
  let met = 0;
  let total = 0;
  let open = false;
  for (const id of ids) {
    const w = WORD_BY_ID[id];
    if (!w || w.family === 'truhe' || w.tutorial) continue;
    total++;
    const p = s.words[id];
    if (p && (!isPlaced(p) || p.retired)) met++;
    else if (!open && eligible(s, w)) open = true;
  }
  return { met, total, open };
}

/** The scene's state on the map: not started, under way (met/total), or every word met. */
export function sceneState(pr: SceneProgress): 'new' | 'part' | 'done' {
  return pr.total > 0 && pr.met >= pr.total ? 'done' : pr.met > 0 ? 'part' : 'new';
}
