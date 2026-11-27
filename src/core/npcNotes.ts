/**
 * NPC talk (Lucas 2026-11-27): the AI sees the whole conversation and sometimes corrects an old line again each round.
 * A correction is dropped only when it is clearly about an earlier line (none of its German quotes are in the player's
 * latest line, but one is in an earlier line), or when it repeats an earlier correction word for word. Notes that quote
 * the fix first, quote only the corrected form or a missing word, or use 「…」 for a Chinese grammar term are kept
 * (审核 1.0.10 UX).
 */
const notesSeen = new WeakMap<object, Set<string>>();
const linesSeen = new WeakMap<object, string[]>();

const norm = (x: string) => x.toLowerCase().replace(/[\s.,!?;:"„“”«»「」『』'‘’…]+/g, ' ').trim();

/** Is the quote in the line? A quote with an ellipsis (「ich habe … gegangen」) matches when every part is there. */
function inLine(line: string, quote: string): boolean {
  const parts = quote.split(/…|\.{3}/).map(norm).filter(Boolean);
  return parts.length > 0 && parts.every((p) => line.includes(` ${p} `));
}

export function freshNote(run: object, note: string | undefined, reply: string): string {
  const said = ` ${norm(reply)} `;
  const past = linesSeen.get(run) ?? [];
  if (reply.trim()) linesSeen.set(run, [...past, said]);
  const n = (note ?? '').trim();
  if (!n) return '';
  // Only German quotes count; 「完成时」 and other Chinese terms in 「」 say nothing about which line is meant.
  const quoted = [...n.matchAll(/[„“"«「『]([^„“”"«»「」『』]{1,80})[“”"»」』]/g)].map((m) => m[1]).filter((q) => /[a-zäöüß]/i.test(q));
  const seen = notesSeen.get(run) ?? new Set<string>();
  notesSeen.set(run, seen);
  const key = norm(n);
  // The mistake is in the latest line: show it, even if it was corrected before (made again).
  if (quoted.some((q) => inLine(said, q))) {
    seen.add(key);
    return n;
  }
  const aboutOld = quoted.some((q) => past.some((p) => inLine(p, q)));
  if (aboutOld || seen.has(key)) return '';
  seen.add(key);
  return n;
}
