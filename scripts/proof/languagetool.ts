// 德语句子校对 · step 2: run every collected item through LanguageTool and write a report.
// Needs a LanguageTool server. Locally: docker run -d -p 8010:8010 erikvl87/languagetool
// (free, open source, nothing leaves your machine). In CI the workflow starts the same image.
//
// Run: npx vite-node scripts/proof/languagetool.ts   (after extract.ts)
// Env: LT_URL (default http://localhost:8010), LT_STRICT=1 → exit 1 when there are new findings.
//
// False positives go into proof/ignore.json (see the comment at its top); names into proof/allow-words.txt.

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Item } from './extract';

const root = join(__dirname, '../..');
const LT = process.env.LT_URL ?? 'http://localhost:8010';
const items: Item[] = JSON.parse(readFileSync(join(root, 'proof/out/sentences.json'), 'utf8'));

interface Ignore {
  /** Rule ids ignored everywhere. */
  rules: string[];
  /** Rule ids ignored for some kinds only (fragments like word lists are not full sentences). */
  rulesByKind: Record<string, string[]>;
  /** One finding judged fine: sentence hash + rule id (+ optional note why). */
  accepted: Array<{ hash: string; rule: string; text?: string; note?: string }>;
}
const ignore: Ignore = JSON.parse(readFileSync(join(root, 'proof/ignore.json'), 'utf8'));
const allow = new Set(
  readFileSync(join(root, 'proof/allow-words.txt'), 'utf8')
    .split('\n')
    .map((l) => l.replace(/#.*/, '').trim())
    .filter(Boolean),
);
const accepted = new Set(ignore.accepted.map((a) => `${a.hash}:${a.rule}`));

export interface Finding {
  id: string;
  kind: string;
  hash: string;
  text: string;
  zh?: string;
  src: string;
  rule: string;
  category: string;
  message: string;
  bad: string;
  fix: string[];
}

const SPELL = /SPELLER_RULE|MORFOLOGIK/;

async function check(text: string): Promise<any[]> {
  const body = new URLSearchParams({ language: 'de-DE', text, level: process.env.LT_LEVEL ?? 'picky', disabledRules: ignore.rules.join(',') });
  for (let attempt = 0; ; attempt++) {
    try {
      const r = await fetch(`${LT}/v2/check`, { method: 'POST', body });
      if (r.status === 429 && attempt < 5) {
        await new Promise((res) => setTimeout(res, 4000 * (attempt + 1)));
        continue;
      }
      if (!r.ok) throw new Error(`LanguageTool ${r.status}: ${await r.text()}`);
      return (await r.json()).matches;
    } catch (e) {
      if (attempt >= 4) throw e;
      await new Promise((res) => setTimeout(res, 2000 * (attempt + 1)));
    }
  }
}

// Items go in batches, one per paragraph, so LanguageTool never reads two items as one text.
const SEP = '\n\n';
const MAX = 12000;
const batches: Item[][] = [];
let cur: Item[] = [];
let len = 0;
for (const it of items) {
  if (len + it.text.length + SEP.length > MAX && cur.length) {
    batches.push(cur);
    cur = [];
    len = 0;
  }
  cur.push(it);
  len += it.text.length + SEP.length;
}
if (cur.length) batches.push(cur);

const findings: Finding[] = [];
let suppressed = 0;
for (const [bi, batch] of batches.entries()) {
  const starts: number[] = [];
  let text = '';
  for (const it of batch) {
    starts.push(text.length);
    text += it.text + SEP;
  }
  const matches = await check(text);
  for (const m of matches) {
    let i = starts.length - 1;
    while (i > 0 && starts[i] > m.offset) i--;
    const it = batch[i];
    const local = m.offset - starts[i];
    if (local >= it.text.length) continue; // the separator itself
    const bad = it.text.slice(local, local + m.length);
    const rule: string = m.rule.id;
    if ((ignore.rulesByKind[it.kind] ?? []).includes(rule)) { suppressed++; continue; }
    if (accepted.has(`${it.hash}:${rule}`)) { suppressed++; continue; }
    if (SPELL.test(rule) && bad.split(/[\s-]+/).every((w) => allow.has(w))) { suppressed++; continue; }
    findings.push({
      id: it.id, kind: it.kind, hash: it.hash, text: it.text, zh: it.zh, src: it.src,
      rule, category: m.rule.category?.id ?? '', message: m.message, bad,
      fix: (m.replacements ?? []).slice(0, 3).map((r: any) => r.value),
    });
  }
  process.stdout.write(`\rLanguageTool ${bi + 1}/${batches.length}`);
}
process.stdout.write('\n');

writeFileSync(join(root, 'proof/out/languagetool.json'), JSON.stringify(findings, null, 1));

// Markdown report: the sentences people should look at, grouped by where they live.
const flagged = new Map<string, Finding[]>();
for (const f of findings) flagged.set(f.id, [...(flagged.get(f.id) ?? []), f]);
const byKind = new Map<string, number>();
for (const id of flagged.keys()) byKind.set(id.split(':')[0], (byKind.get(id.split(':')[0]) ?? 0) + 1);
const byRule = new Map<string, number>();
for (const f of findings) byRule.set(f.rule, (byRule.get(f.rule) ?? 0) + 1);

const mark = (f: Finding) => f.text.replace(f.bad, `**${f.bad}**`);
const lines: string[] = [
  '# LanguageTool 检查结果',
  '',
  `检查了 ${items.length} 条德语，${flagged.size} 条被标出（${findings.length} 处），另有 ${suppressed} 处按 proof/ignore.json 和 allow-words.txt 忽略。`,
  '',
  '按来源：' + [...byKind].map(([k, n]) => `${k} ${n}`).join('，'),
  '',
  '按规则：' + [...byRule].sort((a, b) => b[1] - a[1]).map(([k, n]) => `${k} ${n}`).join('，'),
  '',
  '判断为误报的：把 hash 和 rule 加进 proof/ignore.json 的 accepted；人名地名加进 proof/allow-words.txt。',
  '',
];
let lastKind = '';
for (const [id, fs] of [...flagged].sort((a, b) => a[0].localeCompare(b[0]))) {
  const kind = id.split(':')[0];
  if (kind !== lastKind) lines.push('', `## ${kind}`, '');
  lastKind = kind;
  const f0 = fs[0];
  lines.push(`- \`${id}\` (${f0.hash}) ${mark(f0)}${f0.zh ? ` — ${f0.zh}` : ''}`);
  for (const f of fs) lines.push(`  - ${f.rule}: ${f.message}${f.fix.length ? ` → ${f.fix.join(' / ')}` : ''}`);
}
writeFileSync(join(root, 'proof/out/languagetool.md'), lines.join('\n') + '\n');

// A baseline lets CI tell new problems from ones already listed.
const basePath = join(root, 'proof/baseline.json');
const base = new Set<string>(existsSync(basePath) ? JSON.parse(readFileSync(basePath, 'utf8')) : []);
const fresh = findings.filter((f) => !base.has(`${f.hash}:${f.rule}`));
if (process.env.LT_WRITE_BASELINE) writeFileSync(basePath, JSON.stringify([...new Set(findings.map((f) => `${f.hash}:${f.rule}`))].sort(), null, 0) + '\n');
writeFileSync(join(root, 'proof/out/languagetool-new.json'), JSON.stringify(fresh, null, 1));

console.log(`${items.length} items, ${flagged.size} flagged (${findings.length} findings, ${suppressed} ignored), ${fresh.length} new since baseline`);
if (process.env.GITHUB_STEP_SUMMARY) {
  const sum = [
    `### 德语校对：LanguageTool`,
    `${items.length} 条德语，${flagged.size} 条被标出，其中 **${fresh.length}** 处是这次新出现的。`,
    '',
    ...fresh.slice(0, 40).map((f) => `- \`${f.id}\` ${mark(f)} — ${f.message}${f.fix.length ? ` → ${f.fix[0]}` : ''}`),
    fresh.length > 40 ? `- ……还有 ${fresh.length - 40} 处，见 artifact proof-report` : '',
  ];
  writeFileSync(process.env.GITHUB_STEP_SUMMARY, sum.join('\n') + '\n', { flag: 'a' });
  for (const f of fresh.slice(0, 50)) console.log(`::warning file=${f.src},title=LanguageTool ${f.rule}::${f.id}: ${f.text} — ${f.message}`);
}
if (process.env.LT_STRICT && fresh.length) process.exit(1);
