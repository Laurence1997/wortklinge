// 德语句子校对 · step 3: a second model (DeepSeek) reads every sentence and lists only the suspicious ones.
// It sees the Chinese too, so it can catch a translation that says something else.
//
// Run: DEEPSEEK_API_KEY=sk-… npx vite-node scripts/proof/deepseek.ts   (after extract.ts)
// Without the key it prints a note and exits 0, so CI stays green until the key exists.
// The key must never be committed or put into web code: locally use an env variable, in CI a repository secret.
//
// Results are cached by sentence hash in proof/out/deepseek-cache.json, so a rerun only sends new or changed text.
// Env: DEEPSEEK_MODEL (workflow default gpt-6-luna; deepseek-flash when unset), DEEPSEEK_THINKING=1, DEEPSEEK_LIMIT (max items this run, default all).

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Item } from './extract';
import { CONJ, PERSONS } from '../../src/data/verbs';
import { WORDS } from '../../src/data/words';
import { sentenceHash } from '../../src/core/sentenceId';

const root = join(__dirname, '../..');
// deepseek-flash, thinking off: cheapest, and a yes/no check doesn't need reasoning. DEEPSEEK_THINKING=1 turns it on.
// A gpt-* model goes to OpenAI instead (key OPENAI_API_KEY), with the lowest reasoning effort; used to compare models.
const MODEL = process.env.DEEPSEEK_MODEL ?? 'deepseek-flash';
const OPENAI = MODEL.startsWith('gpt-');
const KEY = OPENAI ? process.env.OPENAI_API_KEY : process.env.DEEPSEEK_API_KEY;
if (!KEY) {
  console.log(`${OPENAI ? 'OPENAI_API_KEY' : 'DEEPSEEK_API_KEY'} is not set: skipping the AI cross-check.`);
  process.exit(0);
}
const THINKING = process.env.DEEPSEEK_THINKING ? 'enabled' : 'disabled';
const URL = OPENAI ? 'https://api.openai.com/v1/chat/completions' : (process.env.DEEPSEEK_URL ?? 'https://api.deepseek.com/chat/completions');
// OpenAI models may reject a parameter; when one does, it is dropped for the rest of the run.
const params: Record<string, unknown> = OPENAI
  ? { reasoning_effort: process.env.OPENAI_EFFORT ?? 'low', response_format: { type: 'json_object' } }
  : { temperature: 0, thinking: { type: THINKING }, response_format: { type: 'json_object' } };
const usage = { prompt: 0, cached: 0, completion: 0 };

const all: Item[] = JSON.parse(readFileSync(join(root, 'proof/out/sentences.json'), 'utf8'));
// Single words and verb forms are checked as whole cards instead (gender, plural, meaning, the full table).
// Boss lines carry a task description in Chinese (问你叫什么) and link halves carry the joined sentence's Chinese:
// neither is a translation, so DeepSeek doesn't see them (it flagged every one of them on the first run).
const NOT_TRANSLATION = (x: Item) => x.kind === 'boss' || (x.kind === 'link' && !x.id.endsWith(':joined'));
const items: Item[] = all
  .filter((x) => !['word', 'plural', 'conj'].includes(x.kind))
  .map((x) => (NOT_TRANSLATION(x) ? { ...x, zh: undefined, hash: sentenceHash(`noz ${x.text}`) } : x));
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
// One cache per model, so trying another model re-checks everything.
const cachePath = join(root, MODEL === 'deepseek-flash' ? 'proof/out/deepseek-cache.json' : `proof/out/deepseek-cache-${MODEL}.json`);
const cache: Record<string, Verdict> = existsSync(cachePath) ? JSON.parse(readFileSync(cachePath, 'utf8')) : {};

const SYSTEM = `你是德语母语的编辑，在校对一款给中国人学德语的游戏（A1–A2 难度）里的德语。
每行一条，格式「序号 [类型] 德语 ‖ 中文」。类型：ex/diary/perfekt 等是句子；card 是词卡（冠词、复数、中文义）；conjrow 是现在时变位表；pattern 是程序生成的句子；tsv 是词表数据里的例句，中文部分若写了「搭配：…」，还要检查句子是否真的用了这个搭配和格。
只挑出真正有问题的：语法或拼写错误、冠词/复数/格/变位错误、德国人不会这样说的不自然说法、中文翻译和德语意思不符。
不要挑：风格偏好、可以接受的多种说法、口语化但正确的说法、人名和游戏里编的地名（Gleisdorf、Brotmarkt、Altstadt 等）、故事里的奇幻内容。拿不准就不报。觉得没问题的句子不要写进 issues（不要写「不算错」「不报」之类的条目）。
标准德语里正确的说法不算错（例如 hat gelegen、hat geschlossen、Mein Knie hat wehgetan），不要用南德/奥地利用法去改。
只输出 JSON：{"issues":[{"n":序号,"severity":"error|unnatural|translation","problem":"用中文一句话说明","fix":"改好的德语（翻译问题就给改好的中文）"}]}。全部没问题就输出 {"issues":[]}。`;

/** The first complete {...} in the reply: the model sometimes adds a note after the JSON. */
function firstJson(raw: string): { issues?: any[] } {
  const start = raw.indexOf('{');
  let depth = 0;
  let inStr = false;
  for (let i = start; i >= 0 && i < raw.length; i++) {
    const c = raw[i];
    if (inStr) {
      if (c === '\\') i++;
      else if (c === '"') inStr = false;
    } else if (c === '"') inStr = true;
    else if (c === '{') depth++;
    else if (c === '}' && --depth === 0) return JSON.parse(raw.slice(start, i + 1));
  }
  throw new Error(`no JSON in reply: ${raw.slice(0, 120)}`);
}

async function ask(batch: Item[]): Promise<Map<number, Verdict>> {
  const user = batch.map((x, i) => `${i + 1} [${x.kind}] ${x.text}${x.zh ? ` ‖ ${x.zh}` : ''}`).join('\n');
  for (let attempt = 0; ; attempt++) {
    try {
      const r = await fetch(URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${KEY}` },
        body: JSON.stringify({ model: MODEL, ...params, messages: [{ role: 'system', content: SYSTEM }, { role: 'user', content: user }] }),
      });
      if (!r.ok) {
        const t = await r.text();
        const bad = Object.keys(params).find((k) => r.status === 400 && t.includes(k));
        if (bad) {
          console.log(`\n${MODEL} does not accept ${bad}: dropping it`);
          delete params[bad];
          attempt--;
          continue;
        }
        if (/insufficient_quota|billing/i.test(t)) {
          // Exit code 3 tells the workflow to fall back to DeepSeek.
          console.log(`\n${MODEL}: the account has no balance (${t.slice(0, 200)}). Top up under Billing.`);
          if (process.env.GITHUB_STEP_SUMMARY) writeFileSync(process.env.GITHUB_STEP_SUMMARY, `### ⚠️ ${MODEL} 余额用完，这次改用 DeepSeek\n`, { flag: 'a' });
          process.exit(3);
        }
        throw new Error(`${MODEL} ${r.status}: ${t.slice(0, 300)}`);
      }
      const j = await r.json();
      usage.prompt += j.usage?.prompt_tokens ?? 0;
      usage.cached += j.usage?.prompt_tokens_details?.cached_tokens ?? j.usage?.prompt_cache_hit_tokens ?? 0;
      usage.completion += j.usage?.completion_tokens ?? 0;
      const raw: string = j.choices[0].message.content ?? '';
      const parsed = firstJson(raw);
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
// Several batches at once (env PROOF_PARALLEL, default 6): 30 000 sentences one batch at a time took over an hour.
const PAR = Number(process.env.PROOF_PARALLEL ?? 6);
const batches: Item[][] = [];
for (let i = 0; i < run.length; i += SIZE) batches.push(run.slice(i, i + SIZE));
let next = 0;
let sent = 0;
async function worker() {
  while (next < batches.length) {
    const k = next++;
    const batch = batches[k];
    try {
      const res = await ask(batch);
      batch.forEach((x, j) => (cache[x.hash] = res.get(j) ?? { ok: true }));
    } catch (e) {
      // One bad batch must not lose the rest: leave it uncached, the next run sends it again.
      console.log(`\nbatch ${k + 1} skipped: ${(e as Error).message.slice(0, 200)}`);
    }
    sent += batch.length;
    if (k % 10 === 0) writeFileSync(cachePath, JSON.stringify(cache));
    process.stdout.write(`\rcross-check ${Math.min(sent, run.length)}/${run.length}`);
  }
}
await Promise.all(Array.from({ length: PAR }, worker));
writeFileSync(cachePath, JSON.stringify(cache));
process.stdout.write('\n');
console.log(`tokens: input ${usage.prompt} (cached ${usage.cached}), output ${usage.completion}`);

const flagged = items.filter((x) => cache[x.hash] && !cache[x.hash].ok);
const ZH = { error: '错误', unnatural: '不自然', translation: '翻译不符' } as Record<string, string>;
const lines = [
  `# DeepSeek 交叉复查结果（${MODEL}）`,
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
writeFileSync(join(root, `proof/out/deepseek${MODEL === 'deepseek-flash' ? '' : '-' + MODEL}.md`), lines.join('\n'));
writeFileSync(join(root, 'proof/out/deepseek.json'), JSON.stringify(flagged.map((x) => ({ ...x, ...cache[x.hash] })), null, 1));
console.log(`${flagged.length} suspicious → proof/out/deepseek.md`);
// The full list in the log too, so it can be read without downloading the artifact.
for (const x of flagged) {
  const v = cache[x.hash];
  console.log(`[${v.severity ?? 'error'}] ${x.id} | ${x.text}${x.zh ? ` | ${x.zh}` : ''} | ${v.problem ?? ''}${v.fix ? ` → ${v.fix}` : ''}`);
}
if (process.env.GITHUB_STEP_SUMMARY) {
  const sum = [`### 德语校对：DeepSeek`, `${items.length} 条，${flagged.length} 条可疑。完整名单见 artifact proof-report。`, ''];
  for (const x of flagged.slice(0, 30)) sum.push(`- \`${x.id}\` ${x.text} — ${cache[x.hash].problem ?? ''}${cache[x.hash].fix ? ` → ${cache[x.hash].fix}` : ''}`);
  writeFileSync(process.env.GITHUB_STEP_SUMMARY, sum.join('\n') + '\n', { flag: 'a' });
}
