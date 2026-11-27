// 德语句子校对 · step 1: collect every German sentence the game can show, with a stable id.
// Vocab-agnostic: it reads whatever src/data holds now, so a new word list needs no change here as long as it
// keeps the same formats. New data files are still picked up by the generic walker at the bottom.
//
// Run: npx vite-node scripts/proof/extract.ts  → writes proof/out/sentences.json
//
// Every item: { id, kind, text, zh?, src }. `id` is `<kind>:<key>` and stays the same while the source key stays;
// `hash` is from the text, so the in-game report button (src/ui/report.ts) and these files can be matched either way.

import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { sentenceHash } from '../../src/core/sentenceId';
import { EXAMPLES } from '../../src/core/cloze';
import { WORDS, WORD_BY_ID } from '../../src/data/words';
import { DIARY, parseLine } from '../../src/data/diary';
import { PERFEKT } from '../../src/data/perfekt';
import { PARTICLE_SENTENCES } from '../../src/data/particles';
import { LINKS } from '../../src/data/links';
import { SAYINGS } from '../../src/data/sayings';
import { BOSS, BOSS_QUESTIONS, type BossQuestion } from '../../src/data/boss';
import { BOSS2, boss2Questions } from '../../src/data/boss2';
import { BOSS3, boss3Questions, makeBoard } from '../../src/data/boss3';
import { LINA, LINA_NAME_Q, linaQuestions } from '../../src/data/lina';
import { WEBER, WEBER_POOL } from '../../src/data/weber';
import { PHRASES } from '../../src/data/families';
import { RULES } from '../../src/data/dungeon';
import { CONJ, PERSONS } from '../../src/data/verbs';
import { expectedSentence, sentenceTags } from '../../src/core/sentence';
import { makeRng } from '../../src/core/rng';

export interface Item {
  id: string;
  kind: string;
  text: string;
  zh?: string;
  src: string;
  hash: string;
}

const items: Item[] = [];
const seen = new Set<string>();
const CJK = /[　-鿿＀-￯]/;

function add(kind: string, key: string, text: string, src: string, zh?: string) {
  const t = text.replace(/\s+/g, ' ').trim();
  if (!t || !/[A-Za-zÄÖÜäöüß]/.test(t) || CJK.test(t)) return;
  const id = `${kind}:${key}`;
  if (seen.has(id)) return;
  seen.add(id);
  items.push({ id, kind, text: t, ...(zh ? { zh } : {}), src, hash: sentenceHash(t) });
}

/** 'German with {blank} and [more]|中文' → full sentence and Chinese. */
const fill = (s: string) => s.replace(/[{}[\]]/g, '');
const split = (line: string) => {
  const i = line.indexOf('|');
  return i < 0 ? { de: line, zh: undefined } : { de: line.slice(0, i), zh: line.slice(i + 1) };
};

// 1. Example sentences (完形填空, 接句怪, 图鉴): the core of the check.
for (const [wid, lines] of Object.entries(EXAMPLES)) {
  lines.forEach((l, i) => {
    const { de, zh } = split(l);
    add('ex', `${wid}:${i}`, fill(de), 'src/data/examples*.ts', zh);
  });
}

// 2. Words: dictionary form and plural, so spelling slips in the word list show up too.
for (const w of WORDS) {
  add('word', w.id, w.art ? `${w.art} ${w.de}` : w.de, 'src/data/words*.ts', w.zh);
  if (w.pl && w.pl !== '-' && w.pl !== w.de) add('plural', w.id, `die ${w.pl}`, 'src/data/words*.ts', w.zh);
  if (w.ex) add('wordex', w.id, w.ex, 'src/data/words*.ts');
  // Generated sentence attacks (Ich möchte einen Tee.)
  sentenceTags(w).forEach((p) => add('pattern', `${w.id}:${p}`, expectedSentence(w, p), 'src/core/sentence.ts'));
}

// 3. Verb tables: "du nimmst" style, so a wrong form is a visible agreement error.
const PRON: Record<string, string> = { ich: 'ich', du: 'du', er: 'er', wir: 'wir', ihr: 'ihr', sie: 'sie' };
for (const [inf, c] of Object.entries(CONJ)) {
  for (const p of PERSONS) add('conj', `${inf}:${p}`, `${PRON[p]} ${c.forms[p]}`, 'src/data/verbs.ts');
}

// 4. Perfekt sentences.
for (const [inf, p] of Object.entries(PERFEKT)) {
  const { de, zh } = split(p.ex);
  add('perfekt', inf, fill(de), 'src/data/perfekt.ts', zh);
}

// 5. Diary pages: blanks filled with the word's form.
const baseOf = (id: string) => {
  const w = WORD_BY_ID[id];
  return w ? w.de : id;
};
for (const page of DIARY) {
  page.lines.forEach((line, i) => {
    const text = parseLine(line, baseOf)
      .map((p) => (typeof p === 'string' ? p : p.form))
      .join('');
    add('diary', `${page.scene}:${i}`, text, 'src/data/diary.ts');
  });
}

// 6. Particles, links, sayings.
for (const [k, lines] of Object.entries(PARTICLE_SENTENCES)) {
  lines.forEach((l, i) => {
    const { de, zh } = split(l);
    add('particle', `${k}:${i}`, fill(de), 'src/data/particles.ts', zh);
  });
}
LINKS.forEach((r, i) => {
  add('link', `${i}:a`, r.a, 'src/data/links.ts', r.zh);
  add('link', `${i}:b`, r.b, 'src/data/links.ts', r.zh);
  add('link', `${i}:joined`, r.answer, 'src/data/links.ts', r.zh);
});
for (const s of SAYINGS) add('saying', s.id, `${s.a} ${s.b}`, 'src/data/sayings.ts', s.zh);

// 7. Bosses and NPC conversations. Generated rounds are sampled with fixed seeds, so ids stay stable.
const bossQ = (who: string, q: BossQuestion, src: string) => {
  q.ask.forEach((a, i) => add('boss', `${who}:${q.id}:ask${i}`, a, src, q.zh));
  if (q.model) add('boss', `${who}:${q.id}:model`, q.model.replace(/\{name\}/g, 'Lea'), src, q.zh);
};
BOSS_QUESTIONS.forEach((q) => bossQ('b1', q, 'src/data/boss.ts'));
for (let seed = 1; seed <= 40; seed++) boss2Questions(makeRng(seed), seed === 1).forEach((q) => bossQ('b2', q, 'src/data/boss2.ts'));
for (let seed = 1; seed <= 40; seed++) {
  const rng = makeRng(seed);
  boss3Questions(rng, makeBoard(rng)).forEach((q) => bossQ('b3', q, 'src/data/boss3.ts'));
}
for (let seed = 1; seed <= 20; seed++) linaQuestions(makeRng(seed)).forEach((q) => bossQ('lina', q, 'src/data/lina.ts'));
WEBER_POOL.forEach((q) => bossQ('weber', q, 'src/data/weber.ts'));
bossQ('lina', LINA_NAME_Q, 'src/data/lina.ts');

/** German inside 「…」 in Chinese story lines. */
const quoted = (s: string) => [...s.matchAll(/「([^」]+)」/g)].map((m) => m[1]).filter((x) => !CJK.test(x));
const story = (who: string, obj: Record<string, unknown>, src: string) => {
  for (const [k, v] of Object.entries(obj)) {
    const lines = Array.isArray(v) ? v : [v];
    lines.forEach((l, i) => {
      if (typeof l !== 'string') return;
      if (CJK.test(l)) quoted(l).forEach((q, j) => add('story', `${who}:${k}:${i}:${j}`, q, src));
      else add('story', `${who}:${k}:${i}`, l, src);
    });
  }
};
story('b1', BOSS, 'src/data/boss.ts');
story('b2', BOSS2, 'src/data/boss2.ts');
story('b3', BOSS3, 'src/data/boss3.ts');
story('lina', LINA, 'src/data/lina.ts');
story('weber', WEBER, 'src/data/weber.ts');

// 8. Monster lines and dungeon rules (sentence skills were removed with the skills rework).
for (const [k, list] of Object.entries(PHRASES)) list.forEach(([de, zh], i) => add('phrase', `${k}:${i}`, de, 'src/data/families.ts', zh));
for (const r of RULES) add('rule', r.id, r.de, 'src/data/dungeon.ts', r.zh);

// 9. Anything else in src/data: walk every exported value and take German-looking strings, so a new data file
//    is never silently skipped. Strings already collected above are not repeated.
const knownText = new Set(items.map((x) => x.text));
/** Exports read above in their own format (their raw strings still hold blanks like {tisch} or ids). */
const HANDLED = new Set(['EX1', 'EX2', 'EX3', 'EX4', 'DIARY', 'WORDS', 'WORD_BY_ID', 'REGION2_GROUPS', 'REGION3_GROUPS', 'PERFEKT',
  'PARTICLE_SENTENCES', 'LINKS', 'SAYINGS', 'SAYING_BY_ID', 'BOSS', 'BOSS_QUESTIONS', 'BOSS2', 'BOSS3', 'LINA', 'LINA_NAME_Q', 'WEBER',
  'WEBER_POOL', 'PHRASES', 'SKILLS', 'RULES', 'CONJ']);
const looksGerman = (s: string) => {
  if (CJK.test(s)) return false;
  const words = s.trim().split(/\s+/);
  return words.length >= 3 && /^[A-ZÄÖÜ„]/.test(s.trim()) && /[a-zäöüß]{2,}/.test(s) && !/[=<>{}\\/_#]|^https?:/.test(s);
};
function walk(v: unknown, path: string, file: string, depth = 0) {
  if (depth > 6 || v == null) return;
  if (typeof v === 'string') {
    for (const part of v.split('|')) {
      const t = fill(part).trim();
      if (CJK.test(part)) quoted(part).forEach((q, j) => !knownText.has(q) && add('misc', `${path}:${j}`, q, file));
      else if (looksGerman(t) && !knownText.has(t)) add('misc', path, t, file);
    }
  } else if (Array.isArray(v)) v.forEach((x, i) => walk(x, `${path}.${i}`, file, depth + 1));
  else if (typeof v === 'object') for (const [k, x] of Object.entries(v as object)) walk(x, `${path}.${k}`, file, depth + 1);
}
const dataDir = join(__dirname, '../../src/data');
for (const f of readdirSync(dataDir).filter((f) => f.endsWith('.ts'))) {
  const mod = await import(join(dataDir, f));
  for (const [name, v] of Object.entries(mod)) if (typeof v !== 'function' && !HANDLED.has(name)) walk(v, `${f.replace('.ts', '')}.${name}`, `src/data/${f}`);
}

// 10. German written straight into game code (NPC lines, shop talk, battle shouts). Ids are file:line here, so
//     they move with edits; the hash does not.
const NOT_GERMAN = /^(Email|Invalid|Token|Noto|Failed|Error)\b/;
for (const dir of ['core', 'ui', 'game', 'net']) {
  const d = join(__dirname, '../../src', dir);
  for (const f of readdirSync(d).filter((f) => f.endsWith('.ts'))) {
    readFileSync(join(d, f), 'utf8').split('\n').forEach((line, n) => {
      if (/^\s*(\/\/|\*|\/\*)/.test(line)) return;
      const lits = [...line.matchAll(/'([^'\n]*)'|"([^"\n]*)"|`([^`$\n]*)`/g)].map((m) => m[1] ?? m[2] ?? m[3]);
      lits.forEach((lit, j) => {
        const parts = CJK.test(lit) ? quoted(lit) : [lit];
        parts.forEach((t, k) => {
          t = t.trim();
          if (!t || knownText.has(t) || NOT_GERMAN.test(t)) return;
          const german = CJK.test(lit) ? /[a-zäöüß]{2,}/.test(t) && t.includes(' ') : looksGerman(t);
          if (german && !/[<>{}=]/.test(t)) add('code', `src/${dir}/${f}:${n + 1}:${j}${k ? '.' + k : ''}`, t, `src/${dir}/${f}`);
        });
      });
    });
  }
}

// 11. Word-list data files (data/**/*.tsv, e.g. data/wortschatz/): every row with a 例句 column. 搭配 (verb +
//     preposition pattern) goes along in zh, so DeepSeek can check that the sentence really uses it.
function tsvFiles(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? (e.name === 'build' ? [] : tsvFiles(join(dir, e.name))) : e.name.endsWith('.tsv') ? [join(dir, e.name)] : [],
  );
}
const repo = join(__dirname, '../..');
for (const f of tsvFiles(join(repo, 'data'))) {
  const [head, ...rows] = readFileSync(f, 'utf8').split(/\r?\n/).filter((l) => l.trim());
  const cols = head.split('\t');
  // 例句 in most files; 正文 in the B2 notices/letters (b2-aushaenge), de in the liar lines (luegner).
  const exName = ['例句', '正文', 'de'].find((n) => cols.includes(n));
  if (!exName) continue;
  const ex = cols.indexOf(exName);
  const zhCol = cols.indexOf({ 例句: '例句中文', 正文: '正文中文', de: 'zh' }[exName]!);
  const qCol = exName === '例句' ? -1 : cols.indexOf('题目');
  const pat = cols.indexOf('搭配');
  const rel = relative(repo, f);
  const name = rel.replace(/^data\//, '').replace(/\.tsv$/, '');
  rows.forEach((r, i) => {
    const c = r.split('\t');
    const key = (pat >= 0 ? c[pat] : c[0])?.trim() || String(i + 1);
    const zh = [pat >= 0 && c[pat] ? `搭配：${c[pat]}` : '', zhCol >= 0 ? c[zhCol] ?? '' : ''].filter(Boolean).join('；');
    // Multi-paragraph texts (听段, letters, articles) join paragraphs with a full-width ｜, which the CJK test below
    // would take for Chinese and silently drop the whole text.
    add('tsv', `${name}:${key}:${i + 1}`, (c[ex] ?? '').replace(/｜/g, ' '), rel, zh || undefined);
    // Content questions ([{q, qZh, answer, wrong}]) of the newer files: question, answer and wrong options.
    if (qCol >= 0 && c[qCol]) {
      try {
        // csv.DictWriter quotes the JSON field ("[{""q"": …}]").
        const raw = /^".*"$/s.test(c[qCol]) ? c[qCol].slice(1, -1).replace(/""/g, '"') : c[qCol];
        (JSON.parse(raw) as { q: string; qZh?: string; answer: string; wrong: string[] }[]).forEach((x, j) => {
          add('tsv', `${name}:${key}:${i + 1}:q${j + 1}`, x.q, rel, x.qZh);
          add('tsv', `${name}:${key}:${i + 1}:q${j + 1}a`, x.answer, rel, `答案；题目：${x.q}`);
          x.wrong.forEach((w, k) => add('tsv', `${name}:${key}:${i + 1}:q${j + 1}w${k + 1}`, w, rel, `错误选项；题目：${x.q}`));
        });
      } catch {
        console.warn(`bad 题目 JSON in ${rel}:${i + 2}`);
      }
    }
  });
}

const outDir = join(__dirname, '../../proof/out');
mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, 'sentences.json'), JSON.stringify(items, null, 1));
const byKind: Record<string, number> = {};
for (const x of items) byKind[x.kind] = (byKind[x.kind] ?? 0) + 1;
console.log(`${items.length} German items`, byKind);
