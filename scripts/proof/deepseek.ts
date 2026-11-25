// 德语句子校对 · step 3: a second model (DeepSeek) reads every sentence and lists only the suspicious ones.
// It sees the Chinese too, so it can catch a translation that says something else.
//
// Run: DEEPSEEK_API_KEY=sk-… npx vite-node scripts/proof/deepseek.ts   (after extract.ts)
// Without the key it prints a note and exits 0, so CI stays green until the key exists.
// The key must never be committed or put into web code: locally use an env variable, in CI a repository secret.
//
// Results are cached by sentence hash in proof/out/deepseek-cache.json, so a rerun only sends new or changed text.
// Env: DEEPSEEK_MODEL (default deepseek-flash), DEEPSEEK_THINKING=1, DEEPSEEK_LIMIT (max items this run, default all).

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Item } from './extract';
import { CONJ, PERSONS } from '../../src/data/verbs';
import { WORDS } from '../../src/data/words';
import { sentenceHash } from '../../src/core/sentenceId';

const root = join(__dirname, '../..');
const KEY = process.env.DEEPSEEK_API_KEY;
if (!KEY) {
  console.log('DEEPSEEK_API_KEY is not set: skipping the DeepSeek cross-check.');
  process.exit(0);
}
// deepseek-flash, thinking off: cheapest, and a yes/no check doesn't need reasoning. DEEPSEEK_THINKING=1 turns it on.
const MODEL = process.env.DEEPSEEK_MODEL ?? 'deepseek-flash';
const THINKING = process.env.DEEPSEEK_THINKING ? 'enabled' : 'disabled';
const URL = process.env.DEEPSEEK_URL ?? 'https://api.deepseek.com/chat/completions';

const all: Item[] = JSON.parse(readFileSync(join(root, 'proof/out/sentences.json'), 'utf8'));
// Single words and verb forms are checked as whole cards instead (gender, plural, meaning, the full table).
const items: Item[] = all.filter((x) => !['word', 'plural', 'conj'].includes(x.kind));
for (const w of WORDS) {
  const de = w.art ? `${w.art} ${w.de}${w.pl && w.pl !== '-' ? `, Plural: die ${w.pl}` : ''}` : w.de;
  items.push({ id: `card:${w.id}`, kind: 'card', text: de, zh: w.zh, src: 'src/data/words*.ts', hash: sentenceHash(`card ${de} ${w.zh}`) });
}
for (const [inf, c] of Object.entries(CONJ)) {
  const t = `${inf}: ${PERSONS.map((p) => `${p} ${c.forms[p]}`).join(', ')}`;
  items.push({ id: `conjrow:${inf}`, kind: 'conjrow', text: t, src: 'src/data/verbs.ts', hash: sentenceHash(t) });
}

export interface Verdict {
  ok: boolean;
  severity?: 'error' | 'unnatural' | 'translation';
  problem?: string;
  fix?: string;
}
const cachePath = join(root, 'proof/out/deepseek-cache.json');
const cache: Record<string, Verdict> = existsSync(cachePath) ? JSON.parse(readFileSync(cachePath, 'utf8')) : {};

const SYSTEM = `你是德语母语的编辑，在校对一款给中国人学德语的游戏（A1–A2 难度）里的德语。
每行一条，格式「序号 [类型] 德语 ‖ 中文」。类型：ex/diary/perfekt 等是句子；card 是词卡（冠词、复数、中文义）；conjrow 是现在时变位表；pattern 是程序生成的句子。
只挑出真正有问题的：语法或拼写错误、冠词/复数/格/变位错误、德国人不会这样说的不自然说法、中文翻译和德语意思不符。
不要挑：风格偏好、可以接受的多种说法、口语化但正确的说法、人名和游戏里编的地名（Gleisdorf、Brotmarkt、Altstadt 等）、故事里的奇幻内容。拿不准就不报。
只输出 JSON：{"issues":[{"n":序号,"severity":"error|unnatural|translation","problem":"用中文一句话说明","fix":"改好的德语（翻译问题就给改好的中文）"}]}。全部没问题就输出 {"issues":[]}。`;

async function ask(batch: Item[]): Promise<Map<number, Verdict>> {
  const user = batch.map((x, i) => `${i + 1} [${x.kind}] ${x.text}${x.zh ? ` ‖ ${x.zh}` : ''}`).join('\n');
  for (let attempt = 0; ; attempt++) {
    try {
      const r = await fetch(URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${KEY}` },
        body: JSON.stringify({
          model: MODEL,
          temperature: 0,
          thinking: { type: THINKING },
          response_format: { type: 'json_object' },
          messages: [{ role: 'system', content: SYSTEM }, { role: 'user', content: user }],
        }),
      });
      if (!r.ok) throw new Error(`DeepSeek ${r.status}: ${(await r.text()).slice(0, 300)}`);
      const j = await r.json();
      const raw: string = j.choices[0].message.content ?? '';
      const parsed = JSON.parse(raw.replace(/^```(?:json)?\s*|\s*```$/g, ''));
      const out = new Map<number, Verdict>();
      for (const is of parsed.issues ?? []) {
        const n = Number(is.n);
        if (n >= 1 && n <= batch.length) out.set(n - 1, { ok: false, severity: is.severity, problem: is.problem, fix: is.fix });
      }
      return out;
    } catch (e) {
      if (attempt >= 3) throw e;
      await new Promise((res) => setTimeout(res, 3000 * (attempt + 1)));
    }
  }
}

const todo = items.filter((x) => !cache[x.hash]);
const limit = Number(process.env.DEEPSEEK_LIMIT ?? todo.length);
const run = todo.slice(0, limit);
console.log(`${items.length} items, ${items.length - todo.length} cached, sending ${run.length}`);
const SIZE = 40;
for (let i = 0; i < run.length; i += SIZE) {
  const batch = run.slice(i, i + SIZE);
  const res = await ask(batch);
  batch.forEach((x, k) => (cache[x.hash] = res.get(k) ?? { ok: true }));
  writeFileSync(cachePath, JSON.stringify(cache));
  process.stdout.write(`\rDeepSeek ${Math.min(i + SIZE, run.length)}/${run.length}`);
}
process.stdout.write('\n');

const flagged = items.filter((x) => cache[x.hash] && !cache[x.hash].ok);
const ZH = { error: '错误', unnatural: '不自然', translation: '翻译不符' } as Record<string, string>;
const lines = [
  '# DeepSeek 交叉复查结果',
  '',
  `复查了 ${items.length} 条（句子、词卡、变位表），${flagged.length} 条被认为可疑。AI 也会误报：这里只是「值得看一眼」的名单。`,
  '',
];
for (const sev of ['error', 'translation', 'unnatural']) {
  const list = flagged.filter((x) => (cache[x.hash].severity ?? 'error') === sev);
  if (!list.length) continue;
  lines.push(`## ${ZH[sev]}（${list.length}）`, '');
  for (const x of list) {
    const v = cache[x.hash];
    lines.push(`- \`${x.id}\` (${x.hash}) ${x.text}${x.zh ? ` — ${x.zh}` : ''}`, `  - ${v.problem ?? ''}${v.fix ? ` → ${v.fix}` : ''}`);
  }
  lines.push('');
}
writeFileSync(join(root, 'proof/out/deepseek.md'), lines.join('\n'));
writeFileSync(join(root, 'proof/out/deepseek.json'), JSON.stringify(flagged.map((x) => ({ ...x, ...cache[x.hash] })), null, 1));
console.log(`${flagged.length} suspicious → proof/out/deepseek.md`);
if (process.env.GITHUB_STEP_SUMMARY) {
  const sum = [`### 德语校对：DeepSeek`, `${items.length} 条，${flagged.length} 条可疑。完整名单见 artifact proof-report。`, ''];
  for (const x of flagged.slice(0, 30)) sum.push(`- \`${x.id}\` ${x.text} — ${cache[x.hash].problem ?? ''}${cache[x.hash].fix ? ` → ${cache[x.hash].fix}` : ''}`);
  writeFileSync(process.env.GITHUB_STEP_SUMMARY, sum.join('\n') + '\n', { flag: 'a' });
}
