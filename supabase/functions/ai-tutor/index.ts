// AI 批改造句 + 决斗场 (40 级, 游戏设计 十六 / Lucas 2026-11-25): the browser sends a logged-in player's sentence; this
// function checks it in order and stops at the first step that decides:
//   1. rule check: the sentence must use the monster's word (one of `forms`), else no model call at all;
//   2. LanguageTool (public API): grammar / spelling matches, passed to the model as hints;
//   3. the model (gpt-6-luna; DeepSeek when OpenAI refuses for quota or errors) returns a short JSON verdict.
// 决斗场 ('duel'): the model plays the scene's NPC in simple German and notes the player's mistakes.
// Every model call takes one use of the player's daily quota (public.ai_take, migration 0003).
// Secrets (Supabase dashboard → Edge Functions → Secrets): OPENAI_API_KEY, DEEPSEEK_API_KEY; optional AI_MODEL.
// SUPABASE_URL and SUPABASE_ANON_KEY are provided by Supabase. No key ever reaches the browser.

const ALLOWED = ['https://wortklinge.myreverielab.com', 'http://localhost:5173', 'http://localhost:4173'];
const MODEL = Deno.env.get('AI_MODEL') || 'gpt-6-luna';

function cors(origin: string | null): Record<string, string> {
  const o = origin && ALLOWED.includes(origin) ? origin : ALLOWED[0];
  return {
    'Access-Control-Allow-Origin': o,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'content-type, apikey, authorization',
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
}
interface DuelReq {
  mode: 'duel';
  /** The scene in Chinese (who the NPC is, what the player wants). */
  scene: string;
  history: Array<{ who: 'npc' | 'me'; de: string }>;
  reply: string;
  level?: number;
}

const clip = (s: unknown, n: number) => String(s ?? '').slice(0, n);
const norm = (s: string) => s.toLowerCase().replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss');

async function takeQuota(auth: string, kind: 'grade' | 'duel'): Promise<boolean | 'unauth'> {
  const url = Deno.env.get('SUPABASE_URL')!;
  const anon = Deno.env.get('SUPABASE_ANON_KEY')!;
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

/** One chat call; OpenAI first, DeepSeek when OpenAI is out of quota or fails. */
async function chat(system: string, user: string): Promise<{ json: any; model: string } | null> {
  const tries: Array<{ url: string; key?: string; model: string; extra: Record<string, unknown> }> = [
    { url: 'https://api.openai.com/v1/chat/completions', key: Deno.env.get('OPENAI_API_KEY'), model: MODEL, extra: { reasoning_effort: 'low' } },
    { url: 'https://api.deepseek.com/chat/completions', key: Deno.env.get('DEEPSEEK_API_KEY'), model: 'deepseek-flash', extra: { temperature: 0.3 } },
  ];
  for (const t of tries) {
    if (!t.key) continue;
    try {
      const r = await fetch(t.url, {
        method: 'POST',
        headers: { Authorization: `Bearer ${t.key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: t.model, messages: [{ role: 'system', content: system }, { role: 'user', content: user }], response_format: { type: 'json_object' }, ...t.extra }),
      });
      if (!r.ok) continue; // 402 / 429 quota, 5xx: next provider
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

const DUEL_SYS = `你在一款学德语的游戏里扮演场景里的人物，和玩家用简单德语对话（玩家水平 A1–B1，按给的等级调整用词）。
每次只说一两句，自然、口语化，推动对话往场景目标走。玩家的德语有错时，在 note 里用中文简短指出最重要的一处（没有错就留空）。
只输出 JSON：{"de":"你说的德语","zh":"中文翻译","note":"对玩家上一句的纠错，中文，可为空","done":true|false（场景目标完成时为 true）}`;

Deno.serve(async (req) => {
  const origin = req.headers.get('origin');
  const h = cors(origin);
  if (req.method === 'OPTIONS') return new Response(null, { headers: h });
  if (req.method !== 'POST') return new Response('POST only', { status: 405, headers: h });
  if (!origin || !ALLOWED.includes(origin)) return new Response('origin not allowed', { status: 403, headers: h });
  const auth = req.headers.get('authorization') ?? '';
  if (!auth.startsWith('Bearer ')) return Response.json({ error: 'login' }, { status: 401, headers: h });
  let body: GradeReq | DuelReq;
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
    const words = norm(sentence).split(/[^a-z]+/);
    if (forms.length && !forms.some((f) => norm(f).split(/\s+/).every((p) => words.includes(p)))) {
      return Response.json({ ok: false, step: 'rule', errors: [{ bad: '', fix: forms[0], why: `句子里要用上这只怪的词（${forms[0]}）` }], better: '' }, { headers: h });
    }
    const q = await takeQuota(auth, 'grade');
    if (q === 'unauth') return Response.json({ error: 'login' }, { status: 401, headers: h });
    if (!q) return Response.json({ error: 'quota' }, { status: 429, headers: h });
    // 2. LanguageTool hints. 3. The model.
    const lt = await languageTool(sentence);
    const user = `任务：${clip(body.task, 200) || '用指定的词写一句德语'}\n必须用到的词：${forms.join(' / ') || '（无）'}\n玩家等级：${Number(body.level) || 40}\n玩家的句子：${sentence}\nLanguageTool 提示：${lt.length ? lt.map((m) => `「${m.bad}」${m.msg}${m.fix ? ` → ${m.fix}` : ''}`).join('；') : '无'}`;
    const out = await chat(GRADE_SYS, user);
    if (!out) return Response.json({ error: 'model' }, { status: 502, headers: h });
    return Response.json({ ok: !!out.json.ok, step: 'ai', errors: (out.json.errors ?? []).slice(0, 3), better: clip(out.json.better, 300), lt: lt.length, model: out.model }, { headers: h });
  }

  if (body.mode === 'duel') {
    const reply = clip(body.reply, 300).trim();
    const history = (Array.isArray(body.history) ? body.history : []).slice(-10).map((x) => `${x.who === 'npc' ? '人物' : '玩家'}：${clip(x.de, 300)}`);
    const q = await takeQuota(auth, 'duel');
    if (q === 'unauth') return Response.json({ error: 'login' }, { status: 401, headers: h });
    if (!q) return Response.json({ error: 'quota' }, { status: 429, headers: h });
    const user = `场景：${clip(body.scene, 400)}\n玩家等级：${Number(body.level) || 40}\n对话：\n${history.join('\n')}\n玩家：${reply || '（开始对话，你先说）'}`;
    const out = await chat(DUEL_SYS, user);
    if (!out) return Response.json({ error: 'model' }, { status: 502, headers: h });
    return Response.json({ de: clip(out.json.de, 400), zh: clip(out.json.zh, 400), note: clip(out.json.note, 300), done: !!out.json.done, model: out.model }, { headers: h });
  }
  return Response.json({ error: 'mode' }, { status: 400, headers: h });
});
