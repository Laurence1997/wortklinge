// 德语句子校对 · step 4: Tatoeba, sentences written by native German speakers.
//  a) Which of our own sentences already exist on Tatoeba from a native speaker (= checked by a native).
//  b) For every word in the game, up to 3 native sentences that use it, preferring ones with a recording,
//     a Chinese translation, and words the game already teaches. These are suggestions to replace or add to
//     self-written examples; nothing goes into the game automatically.
//
// Data: scripts/proof/tatoeba-download.sh puts the plain TSV files into proof/tatoeba/ (not committed, ~100 MB).
// Licence: Tatoeba sentences are CC BY 2.0 FR. Anything we take must keep its sentence id and author
// (the output lists both) and the README credits Tatoeba. Recordings have their own licence per file.
//
// Run: npx vite-node scripts/proof/tatoeba.ts   (after extract.ts)

import { createReadStream, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createInterface } from 'node:readline';
import type { Item } from './extract';
import { WORDS } from '../../src/data/words';
import { CONJ, PERSONS } from '../../src/data/verbs';

const root = join(__dirname, '../..');
const dir = join(root, 'proof/tatoeba');
const file = (n: string) => join(dir, n);
if (!existsSync(file('deu_sentences_detailed.tsv'))) {
  console.log('proof/tatoeba/ is empty: run scripts/proof/tatoeba-download.sh first.');
  process.exit(0);
}

async function eachLine(path: string, fn: (cols: string[]) => void) {
  if (!existsSync(path)) return false;
  const rl = createInterface({ input: createReadStream(path), crlfDelay: Infinity });
  for await (const line of rl) fn(line.split('\t'));
  return true;
}

// Native German speakers: skill level 5 for deu.
const natives = new Set<string>();
await eachLine(file('user_languages.tsv'), ([lang, level, user]) => {
  if (lang === 'deu' && level === '5') natives.add(user);
});

interface Sent { id: string; text: string; user: string; audio?: string; zh?: string }
const sents = new Map<string, Sent>();
await eachLine(file('deu_sentences_detailed.tsv'), ([id, , text, user]) => {
  if (natives.has(user)) sents.set(id, { id, text, user });
});
await eachLine(file('sentences_with_audio.tsv'), ([sid, , user, license]) => {
  const s = sents.get(sid);
  if (s && !s.audio) s.audio = `${user}${license ? ` · ${license}` : ''}`;
});
// Chinese translations (optional files).
const zh = new Map<string, string>();
await eachLine(file('cmn_sentences.tsv'), ([id, , text]) => zh.set(id, text));
await eachLine(file('deu-cmn_links.tsv'), ([a, b]) => {
  const s = sents.get(a);
  if (s && !s.zh && zh.has(b)) s.zh = zh.get(b);
});
console.log(`${natives.size} native German speakers, ${sents.size} of their sentences, ${[...sents.values()].filter((s) => s.audio).length} with audio`);

const norm = (s: string) => s.toLowerCase().replace(/[„“"‚‘’'«»]/g, '').replace(/[.,!?;:…–-]+/g, ' ').replace(/\s+/g, ' ').trim();
const tokens = (s: string) => norm(s).split(' ').filter(Boolean);

// a) our sentences that a native already wrote
const items: Item[] = JSON.parse(readFileSync(join(root, 'proof/out/sentences.json'), 'utf8'));
const byNorm = new Map<string, Sent>();
for (const s of sents.values()) byNorm.set(norm(s.text), s);
const confirmed = items
  .filter((x) => !['word', 'plural', 'conj'].includes(x.kind))
  .map((x) => ({ x, s: byNorm.get(norm(x.text)) }))
  .filter((m) => m.s);

// b) candidates per word. "Known" = every form the game teaches plus every word its own sentences use.
const known = new Set<string>();
for (const w of WORDS) {
  tokens(w.de).forEach((t) => known.add(t));
  if (w.pl) tokens(w.pl).forEach((t) => known.add(t));
}
for (const c of Object.values(CONJ)) PERSONS.forEach((p) => known.add(c.forms[p].toLowerCase()));
for (const x of items) tokens(x.text).forEach((t) => known.add(t));

const index = new Map<string, Sent[]>();
for (const s of sents.values()) {
  const n = tokens(s.text).length;
  if (n < 3 || n > 12) continue;
  for (const t of new Set(tokens(s.text))) {
    const list = index.get(t);
    if (list) list.push(s);
    else index.set(t, [s]);
  }
}

function formsOf(w: (typeof WORDS)[number]): string[] {
  const f = [w.de, ...(w.pl && w.pl !== '-' ? [w.pl] : [])];
  const c = CONJ[w.de];
  if (c) PERSONS.forEach((p) => f.push(c.forms[p]));
  return [...new Set(f.map((x) => norm(x)))];
}

const score = (s: Sent) => {
  const t = tokens(s.text);
  const knownShare = t.filter((x) => known.has(x)).length / t.length;
  return knownShare * 10 + (s.audio ? 3 : 0) + (s.zh ? 3 : 0) - Math.abs(t.length - 7) * 0.3;
};

const cands: Array<{ word: string; de: string; picks: Array<Sent & { score: number }> }> = [];
for (const w of WORDS) {
  if (w.digit) continue;
  const pool = new Map<string, Sent>();
  for (const f of formsOf(w)) {
    const parts = f.split(' ');
    for (const s of index.get(parts[0]) ?? []) if (parts.length === 1 || ` ${norm(s.text)} `.includes(` ${f} `)) pool.set(s.id, s);
  }
  const picks = [...pool.values()].map((s) => ({ ...s, score: Math.round(score(s) * 10) / 10 })).sort((a, b) => b.score - a.score).slice(0, 3);
  cands.push({ word: w.id, de: w.art ? `${w.art} ${w.de}` : w.de, picks });
}

const withPicks = cands.filter((c) => c.picks.length);
const lines = [
  '# Tatoeba 母语句子比对',
  '',
  `母语者（德语等级 5）${natives.size} 人，句子 ${sents.size} 条。`,
  `我们自己的句子里有 **${confirmed.length}** 条和母语者写的完全一样（相当于母语者校对过）。`,
  `${WORDS.length} 个词里 ${withPicks.length} 个找到了母语例句候选。`,
  '',
  '许可：句子 CC BY 2.0 FR，采用时保留句子编号和作者；录音按各自许可（列在「录音」后）。',
  '',
  '## 已有母语者原句',
  '',
  ...confirmed.map((m) => `- \`${m.x.id}\` ${m.x.text} — Tatoeba #${m.s!.id} (${m.s!.user})${m.s!.audio ? ' 🔊' : ''}`),
  '',
  '## 每个词的母语例句候选',
  '',
];
for (const c of withPicks) {
  lines.push(`- **${c.de}** (\`${c.word}\`)`);
  for (const p of c.picks) lines.push(`  - ${p.text}${p.zh ? ` — ${p.zh}` : ''} · #${p.id} ${p.user}${p.audio ? ` · 录音 ${p.audio}` : ''}`);
}
writeFileSync(join(root, 'proof/out/tatoeba.md'), lines.join('\n') + '\n');
writeFileSync(join(root, 'proof/out/tatoeba.json'), JSON.stringify({ confirmed: confirmed.map((m) => ({ id: m.x.id, tatoeba: m.s })), candidates: cands }, null, 1));
console.log(`${confirmed.length} of our sentences match a native Tatoeba sentence; ${withPicks.length}/${WORDS.length} words have candidates`);
if (process.env.GITHUB_STEP_SUMMARY) {
  writeFileSync(process.env.GITHUB_STEP_SUMMARY, `### 德语校对：Tatoeba\n我们的句子里 ${confirmed.length} 条和母语者原句一致；${withPicks.length}/${WORDS.length} 个词有母语例句候选（见 artifact proof-report）。\n`, { flag: 'a' });
}
