// Counts the distinct grammar-line questions the game can make per system (B2 rules by default).
// Run: npx tsx scripts/count_lines.ts [sys ...]   (after python3 scripts/build_lexicon.py)
import { allLineTasks, LINE_LV } from '../src/core/gram/lines';
import { WORDS } from '../src/data/words';

const want = process.argv.slice(2).length ? process.argv.slice(2) : ['k1', 'fvg', 'passAlt', 'nomPrep', 'hinHer', 'k2Past', 'b2Conj', 'concess'];
for (const sys of want) {
  const seen = new Set<string>();
  const hosts = new Set<string>();
  for (const w of WORDS)
    for (const t of allLineTasks(w, sys as never)) {
      const k = `${t.prompt}|${t.answer}`;
      if (!seen.has(k)) (seen.add(k), hosts.add(w.id));
    }
  console.log(`${sys} (Lv ${LINE_LV[sys as keyof typeof LINE_LV] ?? '?'}): ${seen.size} questions on ${hosts.size} words`);
}
