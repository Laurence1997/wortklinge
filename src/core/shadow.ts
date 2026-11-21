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

function lev(a: string, b: string): number {
  const d = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    let prev = d[0];
    d[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const t = d[j];
      d[j] = Math.min(d[j] + 1, d[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = t;
    }
  }
  return d[b.length];
}

/** How close the heard words are to the target's, letter by letter (0–1): a near miss like Brote for Brot still counts most. */
function closeness(target: string, heard: string[]): number {
  const want = words(target);
  if (!want.length) return 0;
  let best = 0;
  for (const h of heard) {
    const pool = words(h);
    let sum = 0;
    for (const w of want) sum += pool.reduce((m, x) => Math.max(m, 1 - lev(w, x) / Math.max(w.length, x.length)), 0);
    best = Math.max(best, sum / want.length);
  }
  return best;
}

/** 清晰度 0–100 for the player: how close Chrome's hearing came to the target, letter by letter, weighted by its own
 *  confidence when it gives one. Not a phoneme-level pronunciation grade (Chrome has none); it says how understandable it sounded. */
export function clarity(target: string, heard: string[], confidence = 0): number {
  const m = closeness(target, heard);
  return Math.round(100 * m * (confidence > 0 ? 0.6 + 0.4 * confidence : 1));
}
