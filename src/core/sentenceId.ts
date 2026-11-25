// A short, stable id for a German sentence: the same text always gives the same id, in the game and in the
// proofreading scripts (scripts/proof). Used by the 「这句有问题」 report button.

/** FNV-1a over the normalized text, as 8 hex digits. */
export function sentenceHash(text: string): string {
  const t = text.replace(/\s+/g, ' ').trim();
  let h = 0x811c9dc5;
  for (let i = 0; i < t.length; i++) {
    h ^= t.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}
