// AI 批改造句 + 决斗场 (10 级) + 小作文 (20 级) (游戏设计 rev 459, Lucas 2026-11-25): the browser sends a logged-in player's text; this
// function checks it in order and stops at the first step that decides:
//   1. rule check: the sentence must use the monster's word (one of `forms`), else no model call at all;
//   2. LanguageTool (public API): grammar / spelling matches, passed to the model as hints;
//   3. the model (gpt-6-luna, OpenAI only — Lucas 2026-11-25, no fallback) returns a short JSON verdict.
//      Out of credit or down → 502 'model', and the game says AI is unavailable for now; nothing else depends on it.
// 决斗场 ('duel'): the model plays the scene's NPC in simple German and notes the player's mistakes. The client sends
// 3–5 target words the player must use; this function reports by rule which of them the reply used.
// 小作文 ('essay'): 3–5 sentences with the given words, graded like 'grade'.
// `known`: the player's learned words; the model is told to stay inside them (and simple patterns) when it writes.
// Every model call takes one use of the player's daily quota (public.ai_take; caps are settings, migration 0004).
// Secrets (Supabase dashboard → Edge Functions → Secrets): OPENAI_API_KEY; optional AI_MODEL.
// SUPABASE_URL and SUPABASE_ANON_KEY are provided by Supabase. No key ever reaches the browser.

const ALLOWED = ['https://wortklinge.myreverielab.com', 'http://localhost:5173', 'http://localhost:4173'];
const MODEL = Deno.env.get('AI_MODEL') || 'gpt-6-luna';

function cors(origin: string | null): Record<string, string> {
  const o = origin && ALLOWED.includes(origin) ? origin : ALLOWED[0];
  return {
    'Access-Control-Allow-Origin': o,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'content-type, apikey, authorization, x-client-info',
    Vary: 'Origin',
  };
}

interface GradeReq {
  mode: 'grade';
  sentence: string;
  /** The monster's word in its accepted forms (Tee, Tees; trinke, trinkst …). */
  forms: string[];
  /** The task in Chinese, e.g. 「用 der Tee 说你想要什么」. */
  task?: string;
  level?: number;
  known?: string[];
}
interface EssayReq {
  mode: 'essay';
  text: string;
  /** Each given word in its accepted forms. */
  words: string[][];
  task?: string;
  level?: number;
  known?: string[];
}
interface DuelReq {
  mode: 'duel';
  /** The scene in Chinese (who the NPC is, what the player wants). */
  scene: string;
  history: Array<{ who: 'npc' | 'me'; de: string }>;
  reply: string;
  level?: number;
  /** Words the player must use in the talk: an id and its accepted forms. */
  targets?: Array<{ id: string; de: string; forms: string[] }>;
  known?: string[];
}

interface OpinionReq {
  mode: 'opinion';
  /** The monster's claim (German). */
  claim: string;
  reply: string;
  level?: number;
  known?: string[];
}

const clip = (s: unknown, n: number) => String(s ?? '').slice(0, n);
const norm = (s: string) => s.toLowerCase().replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss');

/** Does the text use this word (all parts of one of its forms, umlauts folded)? */
function uses(text: string, forms: string[]): boolean {
  const words = norm(text).split(/[^a-z]+/);
  return forms.some((f) => norm(f).split(/\s+/).every((p) => words.includes(p)));
}
const knownLine = (k: unknown) => {
  const list = (Array.isArray(k) ? k : []).slice(0, 600).map((x) => clip(x, 30)).filter(Boolean);
  return list.length ? `玩家学过的词（你写德语时尽量只用这些词、加上最基本的代词/冠词/介词/sein/haben，句型要简单）：${list.join(', ')}` : '';
};

async function takeQuota(auth: string, kind: 'grade' | 'duel' | 'essay'): Promise<boolean | 'unauth'> {
  const url = Deno.env.get('SUPABASE_URL')!;
  // The publishable key is public (it is in the web client too); used when the legacy anon key is not set.
  const anon = Deno.env.get('SUPABASE_ANON_KEY') || 'sb_publishable_ZP1aefkKlLhCNvaiGG3ZcA_gz46eEON';
  const r = await fetch(`${url}/rest/v1/rpc/ai_take`, {
    method: 'POST',
    headers: { apikey: anon, Authorization: auth, 'Content-Type': 'application/json' },
    body: JSON.stringify({ p_kind: kind }),
  });
  if (r.status === 401 || r.status === 403) return 'unauth';
  if (!r.ok) return false;
  return (await r.json()) === true;
}

async function languageTool(text: string): Promise<Array<{ msg: string; bad: string; fix?: string }>> {
  try {
    const r = await fetch('https://api.languagetool.org/v2/check', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ text, language: 'de-DE' }),
    });
    if (!r.ok) return [];
    const j = await r.json();
    return (j.matches ?? []).slice(0, 6).map((m: any) => ({ msg: m.message, bad: text.substr(m.offset, m.length), fix: m.replacements?.[0]?.value }));
  } catch {
    return [];
  }
}

/** One chat call to OpenAI (gpt-6-luna). Null when the key is missing, the account is out of credit or the call fails. */
async function chat(system: string, user: string): Promise<{ json: any; model: string } | null> {
  const tries: Array<{ url: string; key?: string; model: string; extra: Record<string, unknown> }> = [
    { url: 'https://api.openai.com/v1/chat/completions', key: Deno.env.get('OPENAI_API_KEY'), model: MODEL, extra: { reasoning_effort: 'low' } },
  ];
  for (const t of tries) {
    if (!t.key) continue;
    try {
      const r = await fetch(t.url, {
        method: 'POST',
        headers: { Authorization: `Bearer ${t.key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: t.model, messages: [{ role: 'system', content: system }, { role: 'user', content: user }], response_format: { type: 'json_object' }, ...t.extra }),
      });
      if (!r.ok) {
        console.error('openai', r.status, (await r.text()).slice(0, 300));
        continue;
      }
      const j = await r.json();
      const raw = j.choices?.[0]?.message?.content ?? '';
      return { json: JSON.parse(raw.slice(raw.indexOf('{'), raw.lastIndexOf('}') + 1)), model: t.model };
    } catch {
      continue;
    }
  }
  return null;
}

const GRADE_SYS = `你是德语老师，批改一款给中国人学德语的游戏里玩家写的一句德语（A1–B1）。
先看是否完成了任务，再看语法、拼写、冠词、格、变位、语序。LanguageTool 的提示仅供参考，可能误报。
标准德语里正确、自然的说法就算对，不要挑风格；只指出真正的错误，最多 3 条，用中文简短说明。
只输出 JSON：{"ok":true|false,"errors":[{"bad":"错的部分","fix":"改法","why":"中文一句话"}],"better":"改好的整句（ok 时可给更自然的说法或空字符串）"}`;

const ESSAY_SYS = `你是德语老师，批改一款给中国人学德语的游戏里玩家写的小作文（3–5 句，A1–B1）。
看语法、拼写、冠词、格、变位、语序，以及给的词用得对不对。LanguageTool 的提示仅供参考，可能误报。
只指出真正的错误，最多 5 条，用中文简短说明；改写时只用玩家学过的词。不打分。
只输出 JSON：{"ok":true|false,"errors":[{"bad":"错的部分","fix":"改法","why":"中文一句话"}],"better":"改好的全文（ok 时可为空字符串）"}`;

const DUEL_SYS = `你在一款学德语的游戏里扮演场景里的人物，和玩家用简单德语对话（玩家水平 A1–B1，按给的等级调整用词；1–19 级用最短最简单的句子）。
每次只说一两句，自然、口语化，推动对话往场景目标走；玩家还没用上的「要用的词」，用提问自然地引他说出来，但你自己不要先说出这些词。玩家的德语有错时，在 note 里用中文简短指出最重要的一处（没有错就留空）。
只输出 JSON：{"de":"你说的德语","zh":"中文翻译","note":"对玩家上一句的纠错，中文，可为空","done":true|false（场景目标完成时为 true）,"bad":["「要用的词」里玩家上一句用错了的词，照给的写法，没有就空数组"]}`;

// 开口表达观点 (121): does the answer take a position on the claim with a reason that holds? Language errors are noted
// but do not decide the verdict.
const OPINION_SYS = `你在一款学德语的游戏里当辩论裁判。怪物说了一个观点（德语），玩家用德语回应（B1–B2 水平）。
判断：玩家是否明确表态（赞成、反对或部分同意），并给出至少一个和这个说法相关、说得通的理由或例子。离题、只重复对方的话、理由和结论对不上，都算说不通。
德语错误不影响判定，但在 errors 里指出最重要的最多 2 处，用中文简短说明。
只输出 JSON：{"ok":true|false,"note":"中文一句话：为什么说得通或说不通","errors":[{"bad":"错的部分","fix":"改法","why":"中文一句话"}],"better":"更好的一两句德语回应（简短，只用玩家学过的词）"}`;

let lastPing = 0;
let lastPingOk = false;

Deno.serve(async (req) => {
  const origin = req.headers.get('origin');
  const h = cors(origin);
  if (req.method === 'OPTIONS') return new Response(null, { headers: h });
  if (req.method !== 'POST') return new Response('POST only', { status: 405, headers: h });
  if (!origin || !ALLOWED.includes(origin)) return new Response('origin not allowed', { status: 403, headers: h });
  const auth = req.headers.get('authorization') ?? '';
  // Health check (no login): is the key there, and does a tiny call go through (credit left)? At most once a minute
  // per instance, a few tokens, so it can't be used to run up the bill.
  if (new URL(req.url).searchParams.get('ping') === '1') {
    const key = Deno.env.get('OPENAI_API_KEY');
    if (!key) return Response.json({ ok: false, why: 'no_key' }, { headers: h });
    if (Date.now() - lastPing < 60_000) return Response.json({ ok: lastPingOk, cached: true, model: MODEL }, { headers: h });
    lastPing = Date.now();
    const r = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: MODEL, messages: [{ role: 'user', content: 'Antworte nur mit: ok' }], max_completion_tokens: 64, reasoning_effort: 'low' }),
    });
    const why = r.ok ? '' : (await r.text()).slice(0, 200);
    lastPingOk = r.ok;
    return Response.json({ ok: r.ok, status: r.status, model: MODEL, why }, { headers: h });
  }
  if (!auth.startsWith('Bearer ')) return Response.json({ error: 'login' }, { status: 401, headers: h });
  let body: GradeReq | DuelReq | EssayReq | OpinionReq;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: 'bad_json' }, { status: 400, headers: h });
  }

  if (body.mode === 'grade') {
    const sentence = clip(body.sentence, 300).trim();
    const forms = (Array.isArray(body.forms) ? body.forms : []).slice(0, 20).map((f) => clip(f, 40)).filter(Boolean);
    if (!sentence) return Response.json({ error: 'empty' }, { status: 400, headers: h });
    // 1. Rule check: no model call when the monster's word is missing.
    if (forms.length && !uses(sentence, forms)) {
      return Response.json({ ok: false, step: 'rule', errors: [{ bad: '', fix: forms[0], why: `句子里要用上这只怪的词（${forms[0]}）` }], better: '' }, { headers: h });
    }
    const q = await takeQuota(auth, 'grade');
    if (q === 'unauth') return Response.json({ error: 'login' }, { status: 401, headers: h });
    if (!q) return Response.json({ error: 'quota' }, { status: 429, headers: h });
    // 2. LanguageTool hints. 3. The model.
    const lt = await languageTool(sentence);
    const user = `任务：${clip(body.task, 200) || '用指定的词写一句德语'}\n必须用到的词：${forms.join(' / ') || '（无）'}\n玩家等级：${Number(body.level) || 10}\n${knownLine(body.known)}\n玩家的句子：${sentence}\nLanguageTool 提示：${lt.length ? lt.map((m) => `「${m.bad}」${m.msg}${m.fix ? ` → ${m.fix}` : ''}`).join('；') : '无'}`;
    const out = await chat(GRADE_SYS, user);
    if (!out) return Response.json({ error: 'model' }, { status: 502, headers: h });
    return Response.json({ ok: !!out.json.ok, step: 'ai', errors: (out.json.errors ?? []).slice(0, 3), better: clip(out.json.better, 300), lt: lt.length, model: out.model }, { headers: h });
  }

  if (body.mode === 'essay') {
    const text = clip(body.text, 1200).trim();
    const words = (Array.isArray(body.words) ? body.words : []).slice(0, 6).map((fs) => (Array.isArray(fs) ? fs : []).slice(0, 20).map((f) => clip(f, 40)).filter(Boolean)).filter((fs) => fs.length);
    if (!text) return Response.json({ error: 'empty' }, { status: 400, headers: h });
    const missing = words.filter((fs) => !uses(text, fs)).map((fs) => fs[0]);
    if (missing.length === words.length && words.length) {
      return Response.json({ ok: false, step: 'rule', errors: [{ bad: '', fix: missing.join(' / '), why: `要用上给的词（${missing.join('、')}）` }], better: '', missing }, { headers: h });
    }
    const q = await takeQuota(auth, 'essay');
    if (q === 'unauth') return Response.json({ error: 'login' }, { status: 401, headers: h });
    if (!q) return Response.json({ error: 'quota' }, { status: 429, headers: h });
    const lt = await languageTool(text);
    const user = `任务：${clip(body.task, 200) || '用给的词写 3–5 句'}\n给的词：${words.map((fs) => fs[0]).join(' / ')}\n玩家等级：${Number(body.level) || 20}\n${knownLine(body.known)}\n玩家的作文：${text}\nLanguageTool 提示：${lt.length ? lt.map((m) => `「${m.bad}」${m.msg}${m.fix ? ` → ${m.fix}` : ''}`).join('；') : '无'}`;
    const out = await chat(ESSAY_SYS, user);
    if (!out) return Response.json({ error: 'model' }, { status: 502, headers: h });
    return Response.json({ ok: !!out.json.ok, step: 'ai', errors: (out.json.errors ?? []).slice(0, 5), better: clip(out.json.better, 1500), missing, model: out.model }, { headers: h });
  }

  if (body.mode === 'duel') {
    const reply = clip(body.reply, 300).trim();
    const targets = (Array.isArray(body.targets) ? body.targets : []).slice(0, 5).map((t) => ({ id: clip(t?.id, 60), de: clip(t?.de, 60), forms: (Array.isArray(t?.forms) ? t.forms : []).slice(0, 20).map((f) => clip(f, 40)).filter(Boolean) }));
    const used = reply ? targets.filter((t) => t.forms.length && uses(reply, t.forms)).map((t) => t.id) : [];
    const history = (Array.isArray(body.history) ? body.history : []).slice(-10).map((x) => `${x.who === 'npc' ? '人物' : '玩家'}：${clip(x.de, 300)}`);
    const q = await takeQuota(auth, 'duel');
    if (q === 'unauth') return Response.json({ error: 'login' }, { status: 401, headers: h });
    if (!q) return Response.json({ error: 'quota' }, { status: 429, headers: h });
    const tl = targets.length ? `\n玩家要在对话里用上的词：${targets.map((t) => t.de).join('、')}` : '';
    const user = `场景：${clip(body.scene, 400)}\n玩家等级：${Number(body.level) || 10}${tl}\n${knownLine(body.known)}\n对话：\n${history.join('\n')}\n玩家：${reply || '（开始对话，你先说）'}`;
    const out = await chat(DUEL_SYS, user);
    if (!out) return Response.json({ error: 'model' }, { status: 502, headers: h });
    const bare = (x: string) => norm(x).trim().replace(/^(der|die|das|sich) /, '');
    const bad = new Set((Array.isArray(out.json.bad) ? out.json.bad : []).map((x: unknown) => bare(clip(x, 60))));
    return Response.json({ de: clip(out.json.de, 400), zh: clip(out.json.zh, 400), note: clip(out.json.note, 300), done: !!out.json.done, used: used.filter((id) => !bad.has(bare(targets.find((t) => t.id === id)!.de))), model: out.model }, { headers: h });
  }
  if (body.mode === 'opinion') {
    const reply = clip(body.reply, 600).trim();
    const claim = clip(body.claim, 300).trim();
    if (!reply || !claim) return Response.json({ error: 'empty' }, { status: 400, headers: h });
    // The rule part (opener, reason, length) runs in the game first; the quota is the grading one.
    const q = await takeQuota(auth, 'grade');
    if (q === 'unauth') return Response.json({ error: 'login' }, { status: 401, headers: h });
    if (!q) return Response.json({ error: 'quota' }, { status: 429, headers: h });
    const user = `怪物的说法：${claim}\n玩家等级：${Number(body.level) || 121}\n${knownLine(body.known)}\n玩家的回应：${reply}`;
    const out = await chat(OPINION_SYS, user);
    if (!out) return Response.json({ error: 'model' }, { status: 502, headers: h });
    return Response.json({ ok: !!out.json.ok, note: clip(out.json.note, 300), errors: (out.json.errors ?? []).slice(0, 2), better: clip(out.json.better, 400), model: out.model }, { headers: h });
  }

  return Response.json({ error: 'mode' }, { status: 400, headers: h });
});
