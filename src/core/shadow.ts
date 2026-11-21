// 跟读 (0.5): compare what Chrome's speech recognition heard with the sentence the monster said.
import { CONFIG } from './config';

function words(t: string): string[] {
  return t
    .toLowerCase()
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
    .replace(/[^a-z0-9 ]+/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
}

/** Share of the target's words (as a multiset) found in what was heard; the best of the alternatives counts. */
export function shadowScore(target: string, heard: string[]): number {
  const want = words(target);
  if (!want.length) return 0;
  let best = 0;
  for (const h of heard) {
    const pool = words(h);
    let hit = 0;
    for (const w of want) {
      const i = pool.indexOf(w);
      if (i >= 0) {
        hit++;
        pool.splice(i, 1);
      }
    }
    best = Math.max(best, hit / want.length);
  }
  return best;
}

export function shadowOk(target: string, heard: string[]): boolean {
  return shadowScore(target, heard) >= CONFIG.shadow.match;
}
