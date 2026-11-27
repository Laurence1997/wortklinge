/**
 * NPC talk (Lucas 2026-11-27): the AI sees the whole conversation and sometimes corrects an old line again each round.
 * A correction that quotes words not in the player's latest line, or repeats an earlier correction word for word, is
 * dropped, so each mistake is pointed out once, in its own round.
 */
const notesSeen = new WeakMap<object, Set<string>>();
export function freshNote(run: object, note: string | undefined, reply: string): string {
  const n = (note ?? '').trim();
  if (!n) return '';
  const norm = (x: string) => x.toLowerCase().replace(/[\s.,!?;:"„“”«»「」『』'‘’]+/g, ' ').trim();
  const quoted = [...n.matchAll(/[„“"«「『]([^„“”"«»「」『』]{1,80})[“”"»」』]/g)].map((m) => norm(m[1])).filter(Boolean);
  const said = ` ${norm(reply)} `;
  const seen = notesSeen.get(run) ?? new Set<string>();
  notesSeen.set(run, seen);
  // Quoted words: the first quote is what the player wrote; show the note only if the latest line has it.
  if (quoted.length ? !said.includes(` ${quoted[0]} `) : seen.has(norm(n))) return '';
  seen.add(norm(n));
  return n;
}
