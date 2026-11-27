// AI 批改造句 + 决斗场 (10 级) + 小作文 (20 级) (游戏设计 rev 459, Lucas 2026-11-25): the browser sends a logged-in player's text; this
// function checks it in order and stops at the first step that decides:
//   1. rule check: the sentence must use the monster's word (one of `forms`), else no model call at all;
//   2. LanguageTool (public API): grammar / spelling matches, passed to the model as hints;
//   3. the model returns a short JSON verdict: DeepSeek (deepseek-flash, thinking off) when DEEPSEEK_API_KEY is set
//      (Lucas 2026-11-27, the OpenAI credit ran out), else OpenAI gpt-6-luna; if the first one fails the other is tried.
//      Both out of credit or down → 502 'model', and the game says AI is unavailable for now; nothing else depends on it.
// 决斗场 ('duel'): the model plays the scene's NPC in simple German and notes the player's mistakes. The client sends
// 3–5 target words the player must use; this function reports by rule which of them the reply used. Used by the
// 冒险者 (adventurers) now: `grammar` adds the region's grammar points (gramOk = the ones the player used right), and
// an NPC line that says a target first is regenerated once; targets it still says come back as `dropped`.
// 冒险者 in the world chat ('world'): one short German line. An answer to an @ takes quota 'duel'; an unprompted line
// (sent by whichever client leads the chat, about every 30 minutes) is not billed to that player (审核 1.0.10): it only
// needs a valid login and is throttled per user here.
// 小作文 ('essay'): 3–5 sentences with the given words, graded like 'grade'.
// `known`: the player's learned words; the model is told to stay inside them (and simple patterns) when it writes.
// Every model call (but an unprompted world line) takes one use of the player's daily quota (public.ai_take; caps are settings, migration 0004).
// Secrets (Supabase dashboard → Edge Functions → Secrets): DEEPSEEK_API_KEY and/or OPENAI_API_KEY; optional DEEPSEEK_MODEL, AI_MODEL (OpenAI).
// SUPABASE_URL and SUPABASE_ANON_KEY are provided by Supabase. No key ever reaches the browser.

// 中文翻译易错词对照表 (1.0.10, from the proofreading thread's zh-guide.ts; inlined so the function stays one file):
// appended to the prompts whose JSON reply has a "zh" field.
const ZH_GUIDE = `
写 "zh" 中文翻译时：按德国日常生活里的意思译，用中国大陆常用说法；不要按字面或英语去猜。下面这些词最容易译错（左边德语，右边正确译法，括号里是不要用的错译）：
- Termin：预约；约好的时间；（看医生、办事的）号（不要译成「约会」；只有约朋友/恋爱见面才叫约会）
- Verabredung / sich verabreden：约好见面；约（朋友）（恋爱语境才用「约会」）
- Chef / Chefin：老板；上司；领导（不是「厨师」，厨师是 Koch）
- eventuell：可能；也许（不是「最终」）
- aktuell：当前的；最新的（不是「实际的」）
- bekommen：得到；收到（不是「变成」，变成是 werden）
- also：所以；那么（不是「也」）
- fast：几乎；差不多（不是「快」）
- bald：很快；不久（不是「秃」）
- Stelle：职位；工作岗位；（某个）位置（招聘语境不要译「地方」）
- Kasse：收银台；收款处；Krankenkasse = 医保公司；医疗保险（不是「医院」「钱箱」）
- Rezept：处方（看病语境）；食谱（做饭语境）
- Quittung / Kassenbon：收据；小票
- Rechnung：账单；发票
- Miete：房租；Kaltmiete = 冷租（不含杂费）；Warmmiete = 暖租（含杂费）
- Nebenkosten：（房租）杂费；附加费用（不是「额外开销」「副作用」）
- Kaution：押金（不是「小心」）
- Vermieter / Vermieterin：房东；Mieter / Mieterin：租客；房客（别弄反）
- Hausverwaltung：物业；Hausmeister：（楼的）管理员；物业师傅
- Behörde / Amt：政府部门；机关；Bürgeramt：市民服务中心；Ausländerbehörde：外管局；Ordnungsamt：秩序局
- Anmeldung：登记；（住址）登记；报名（不是「通知」）
- Ausweis / Personalausweis：证件；身份证；Aufenthaltstitel：居留许可
- Antrag：申请（表）（求婚只在 Heiratsantrag 里）
- Bescheid：通知；（官方）决定书；Bescheid sagen = 告诉一声
- Frist：期限；截止日期
- Kündigung：解约；辞职；解雇（看主语）
- Überweisung：转账（银行）；转诊单（看病语境）
- Praxis：诊所（医生语境）；实践
- Hausarzt：家庭医生；Facharzt：专科医生；Notaufnahme：急诊
- Krankschreibung / krankgeschrieben：病假条；开了病假
- Feierabend：下班（后）（不是「节日」「晚会」）
- Gymnasium：文理中学（不是「体育馆」）；Hochschule：高等院校；大学（不是「高中」）
- Abitur：（德国）高中毕业考试
- Azubi / Ausbildung：学徒；职业培训
- Note：分数；成绩（学校语境）；Zeugnis：成绩单；证书
- Handy：手机；Beamer：投影仪；Tablett：托盘（平板电脑是 Tablet）
- Gift：毒药（不是「礼物」）；Art：种类；方式（不是「艺术」）
- sympathisch：讨人喜欢的；有好感的（不是「同情」）
- konsequent：一贯的；说到做到的（不是「结果」）
- Personal：员工；人员（不是「个人的」）
- Lokal：饭馆；酒馆（名词）
- Billion：万亿（不是十亿；十亿是 Milliarde）
- Bad：浴室；卫生间（不是「坏」）
- gemütlich：舒适；惬意
- pünktlich：准时
- Stock / Etage：楼层；im ersten Stock = 二楼（德国一楼是 Erdgeschoss）
- Gleis：站台；轨道；Bahnsteig：月台
- Kneipe：小酒馆；Imbiss：小吃店
- Pfand：（瓶子）押金
- Steuer-ID / Steuernummer：税号
- Wohnheim：（学生）宿舍；WG：合租公寓`;

const ALLOWED = ['https://wortklinge.myreverielab.com', 'http://localhost:5173', 'http://localhost:4173'];
const MODEL = Deno.env.get('AI_MODEL') || 'gpt-6-luna';
const DS_MODEL = Deno.env.get('DEEPSEEK_MODEL') || 'deepseek-flash';

interface Provider { name: string; url: string; key?: string; model: string; extra: Record<string, unknown>; ping: Record<string, unknown> }
/** DeepSeek first (2026-11-27), OpenAI as the fallback; providers without a key are left out. */
function providers(): Provider[] {
  return [
    { name: 'deepseek', url: 'https://api.deepseek.com/chat/completions', key: Deno.env.get('DEEPSEEK_API_KEY'), model: DS_MODEL, extra: { thinking: { type: 'disabled' }, temperature: 0.3 }, ping: { thinking: { type: 'disabled' }, max_tokens: 8 } },
    { name: 'openai', url: 'https://api.openai.com/v1/chat/completions', key: Deno.env.get('OPENAI_API_KEY'), model: MODEL, extra: { reasoning_effort: 'low' }, ping: { max_completion_tokens: 64, reasoning_effort: 'low' } },
  ].filter((p) => !!p.key);
}

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
  /** Optional: the word in Chinese, named when the sentence misses it (the German is never shown, it is the answer). */
  zh?: string;
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
  /** Optional: the given words in Chinese, parallel to `words`. */
  zhs?: string[];
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
  /** 冒险者: grammar points of this region the talk should use (Chinese names). */
  grammar?: string[];
  /** Which player line this is and how many the talk allows (0 = not sent). */
  round?: number;
  rounds?: number;
}

/** 冒险者 in the world chat: one short line, unprompted or as a reply to an @. */
interface WorldReq {
  mode: 'world';
  name: string;
  origin: string;
  manner: string;
  /** The region's life situation (Chinese). */
  topic: string;
  level?: number;
  mention?: { nick: string; text: string };
  recent?: string[];
}

interface PersuadeReq {
  mode: 'persuade';
  /** Who the NPC is and what the player wants from it (Chinese). */
  scene: string;
  /** What the NPC really cares about (Chinese; revealed as a hint from the second try). */
  cares: string;
  /** Sie (officials, landlords) or du (peers). */
  formal: boolean;
  attempt: number;
  history: Array<{ who: 'npc' | 'me'; de: string }>;
  reply: string;
  level?: number;
  known?: string[];
  /** 171+: the argument must have a claim, reasons, an example, a rebuttal and a conclusion. */
  argue?: boolean;
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

/** Is token `t` the form part `p`, or a regular inflection of it? Besides the exact form: up to three more letters
 *  on a stem of 4+ (schön → schöne/schönen, Kind → Kindern, Mann → Mannes, like the game's journal.usesWord), an
 *  adjective / case ending on a 3-letter stem (gut → gute, neu → neuen, alt → alter; Tee → Teer still does not count),
 *  and the regular Perfekt participle of an -en verb (machen → gemacht, arbeiten → gearbeitet; besucht, verkauft
 *  come in as present forms). */
function tokenIs(t: string, p: string): boolean {
  if (t === p) return true;
  if (p.length >= 4 && t.startsWith(p) && t.length <= p.length + 3) return true;
  if (p.length === 3 && t.startsWith(p) && /^(e|en|em|er|es)$/.test(t.slice(3))) return true;
  if (p.length >= 5 && p.endsWith('en')) {
    const st = p.slice(0, -2);
    return t === `ge${st}t` || t === `ge${st}et` || t === `${st}et`;
  }
  return false;
}
/** Does the text use this word (all parts of one of its forms, umlauts folded)? */
function uses(text: string, forms: string[]): boolean {
  const words = norm(text).split(/[^a-z]+/).filter(Boolean);
  return forms.some((f) => norm(f).split(/\s+/).filter(Boolean).every((p) => words.some((t) => tokenIs(t, p))));
}
const knownLine = (k: unknown) => {
  const list = (Array.isArray(k) ? k : []).slice(0, 600).map((x) => clip(x, 30)).filter(Boolean);
  return list.length ? `玩家学过的词（你写德语时尽量只用这些词、加上最基本的代词/冠词/介词/sein/haben，句型要简单）：${list.join(', ')}` : '';
};

/** The logged-in user's id, null when the token is not valid. For the one call that takes no quota. */
async function userId(auth: string): Promise<string | null> {
  const url = Deno.env.get('SUPABASE_URL')!;
  const anon = Deno.env.get('SUPABASE_ANON_KEY') || 'sb_publishable_ZP1aefkKlLhCNvaiGG3ZcA_gz46eEON';
  try {
    const r = await fetch(`${url}/auth/v1/user`, { headers: { apikey: anon, Authorization: auth } });
    if (!r.ok) return null;
    const j = await r.json();
    return typeof j?.id === 'string' && j.id ? j.id : null;
  } catch {
    return null;
  }
}
/** Unprompted world lines: at most one per user per 10 minutes on this instance (the game sends one per 30 minutes). */
const WORLD_GAP = 10 * 60_000;
const lastWorld = new Map<string, number>();
/** …and at most 20 a minute on this instance in all, so many accounts can't turn the free line into a free model. */
const WORLD_PER_MIN = 20;
let worldMin: number[] = [];

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

/** One chat call: DeepSeek, then OpenAI. Null when no key is set, both are out of credit or both calls fail. */
async function chat(system: string, user: string): Promise<{ json: any; model: string } | null> {
  for (const t of providers()) {
    try {
      const r = await fetch(t.url, {
        method: 'POST',
        headers: { Authorization: `Bearer ${t.key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: t.model, messages: [{ role: 'system', content: system }, { role: 'user', content: user }], response_format: { type: 'json_object' }, ...t.extra }),
      });
      if (!r.ok) {
        console.error(t.name, r.status, (await r.text()).slice(0, 300));
        continue;
      }
      const j = await r.json();
      const raw = j.choices?.[0]?.message?.content ?? '';
      return { json: JSON.parse(raw.slice(raw.indexOf('{'), raw.lastIndexOf('}') + 1)), model: t.model };
    } catch (e) {
      console.error(t.name, String(e).slice(0, 200));
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
note 只针对玩家最新的这一句，前几轮已经纠正过的错误不要再提。zh 按场景译成准确、自然的中文，不要逐词硬译：Termin 是预约、约好的时间或安排（看医生、去办事处、开会），不要译成「约会」（「约会」只用于恋爱的 Date 或朋友间的 Verabredung）；Sie 译「您」，du 译「你」。
只输出 JSON：{"de":"你说的德语","zh":"中文翻译","note":"对玩家上一句的纠错，中文，可为空","done":true|false（场景目标完成时为 true）,"bad":["「要用的词」里玩家上一句用错了的词，照给的写法，没有就空数组"],"gram_ok":["「本场语法」里玩家上一句用对了的语法点，照给的写法，没有就空数组"]}`;

// 冒险者 in the world chat (游戏设计 六, Lucas 2026-11-25): one short German line, no reward.
const WORLD_SYS = `你在一款学德语的游戏的全服聊天里扮演一个冒险者（标着 AI），用德语说一句话。
没人叫你时：用很简单的 A2 初级德语（短句、常用词），聊你所在区域的生活处境，可以接最近的聊天，但不要重复别人的话。
有人 @你 时：直接回应他说的内容，用词难度按他的等级（1–30 级很简单，31–80 级 A2，81–120 级 B1，121 级以上 B2）。
最多两句、不超过 25 个词。不谈政治、宗教、真实的新闻人物，不骂人，不问也不要别人的个人信息（真名、住址、电话、账号）；有人把话题往这些方向带时，礼貌地用一句话拉回游戏里的事。不要冒充真人，不承诺奖励。
只输出 JSON：{"de":"你说的德语"}`;

// 开口表达观点 (121): does the answer take a position on the claim with a reason that holds? Language errors are noted
// but do not decide the verdict.
const OPINION_SYS = `你在一款学德语的游戏里当辩论裁判。怪物说了一个观点（德语），玩家用德语回应（B1–B2 水平）。
判断：玩家是否明确表态（赞成、反对或部分同意），并给出至少一个和这个说法相关、说得通的理由或例子。离题、只重复对方的话、理由和结论对不上，都算说不通。
德语错误不影响判定，但在 errors 里指出最重要的最多 2 处，用中文简短说明。
只输出 JSON：{"ok":true|false,"note":"中文一句话：为什么说得通或说不通","errors":[{"bad":"错的部分","fix":"改法","why":"中文一句话"}],"better":"更好的一两句德语回应（简短，只用玩家学过的词）"}`;

// 说服段 (游戏设计 任务, Lucas 2026-11-25): the model plays an NPC the player must talk round, in the duel engine.
const PERSUADE_SYS = `你在一款学德语的游戏里扮演一个需要被说服的人物，和玩家用简单德语对话（按给的等级调整用词）。
人物有自己在意的东西（给在「它在意」里）。玩家只有说到点子上（回应你在意的东西、给出合理的理由或让步）你才会被说服；空话、命令、威胁不算。
称呼规则：场景要求 Sie 时，玩家对你用 du/dich/dir/dein 就是用错了；要求 du 时用 Sie 也算用错。用错时 register_wrong 为 true，你在 de 里用人物的口吻当场指出（例如 „Wir duzen uns nicht.“），这一轮不算数；这时 note 不要再提称呼（de 里已经说了），note 只写别的错，没有就留空。
需要论证时（argue=true），玩家要有论点、理由、例子、反驳、结论，缺得多就不被说服。
第 2 次及以后尝试（attempt≥2）时，在对话里自然透露你在意什么。每次只说一两句。
note 只针对玩家最新的这一句，前几轮已经纠正过的错误不要再提。zh 按场景译成准确、自然的中文，不要逐词硬译：Termin 是预约、约好的时间或安排（看医生、去办事处、开会），不要译成「约会」（「约会」只用于恋爱的 Date 或朋友间的 Verabredung）；Sie 译「您」，du 译「你」。
只输出 JSON：{"de":"你说的德语","zh":"中文翻译","note":"对玩家上一句德语最重要的一处纠错，中文，可为空","convinced":true|false,"register_wrong":true|false}`;

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
    const p = providers()[0];
    if (!p) return Response.json({ ok: false, why: 'no_key' }, { headers: h });
    if (Date.now() - lastPing < 60_000) return Response.json({ ok: lastPingOk, cached: true, provider: p.name, model: p.model }, { headers: h });
    lastPing = Date.now();
    const r = await fetch(p.url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${p.key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: p.model, messages: [{ role: 'user', content: 'Antworte nur mit: ok' }], ...p.ping }),
    });
    const why = r.ok ? '' : (await r.text()).slice(0, 200);
    lastPingOk = r.ok;
    return Response.json({ ok: r.ok, status: r.status, provider: p.name, model: p.model, why }, { headers: h });
  }
  if (!auth.startsWith('Bearer ')) return Response.json({ error: 'login' }, { status: 401, headers: h });
  let body: GradeReq | DuelReq | EssayReq | OpinionReq | PersuadeReq | WorldReq;
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
      // 审核 1.0.10: name the word in Chinese only (the German is the answer the player must recall); not every caller
      // is a monster, so no 「这只怪」.
      const zh = clip(body.zh, 40).trim();
      return Response.json({ ok: false, step: 'rule', errors: [{ bad: '', fix: '', why: zh ? `句子里要用上「${zh}」这个词` : '句子里还没用上要练的词' }], better: '' }, { headers: h });
    }
    const q = await takeQuota(auth, 'grade');
    if (q === 'unauth') return Response.json({ error: 'login' }, { status: 401, headers: h });
    if (!q) return Response.json({ error: 'quota' }, { status: 429, headers: h });
    // 2. LanguageTool hints. 3. The model.
    const lt = await languageTool(sentence);
    const user = `任务：${clip(body.task, 200) || '用指定的词写一句德语'}\n必须用到的词：${forms.join(' / ') || '（无）'}\n玩家等级：${Number(body.level) || 10}\n${knownLine(body.known)}\n玩家的句子：${sentence}\nLanguageTool 提示：${lt.length ? lt.map((m) => `「${m.bad}」${m.msg}${m.fix ? ` → ${m.fix}` : ''}`).join('；') : '无'}`;
    const out = await chat(GRADE_SYS, user);
    if (!out) return Response.json({ error: 'model' }, { status: 502, headers: h });
    return Response.json({ ok: !!out.json.ok, step: 'ai', errors: (Array.isArray(out.json.errors) ? out.json.errors : []).slice(0, 3), better: clip(out.json.better, 300), lt: lt.length, model: out.model }, { headers: h });
  }

  if (body.mode === 'essay') {
    const text = clip(body.text, 1200).trim();
    const zhs = Array.isArray(body.zhs) ? body.zhs : [];
    const given = (Array.isArray(body.words) ? body.words : []).slice(0, 6).map((fs, i) => ({ forms: (Array.isArray(fs) ? fs : []).slice(0, 20).map((f) => clip(f, 40)).filter(Boolean), zh: clip(zhs[i], 40).trim() })).filter((g) => g.forms.length);
    const words = given.map((g) => g.forms);
    if (!text) return Response.json({ error: 'empty' }, { status: 400, headers: h });
    const skipped = given.filter((g) => !uses(text, g.forms));
    const missing = skipped.map((g) => g.forms[0]); // the client matches these to its words; never shown as text
    if (missing.length === words.length && words.length) {
      // 审核 1.0.10: name the skipped words in Chinese only, never the German.
      const zhList = skipped.map((g) => g.zh).filter(Boolean);
      const why = zhList.length === skipped.length ? `还没用上：${zhList.map((z) => `「${z}」`).join('、')}` : '还没用上给的词';
      return Response.json({ ok: false, step: 'rule', errors: [{ bad: '', fix: '', why }], better: '', missing }, { headers: h });
    }
    const q = await takeQuota(auth, 'essay');
    if (q === 'unauth') return Response.json({ error: 'login' }, { status: 401, headers: h });
    if (!q) return Response.json({ error: 'quota' }, { status: 429, headers: h });
    const lt = await languageTool(text);
    const user = `任务：${clip(body.task, 200) || '用给的词写 3–5 句'}\n给的词：${words.map((fs) => fs[0]).join(' / ')}\n玩家等级：${Number(body.level) || 20}\n${knownLine(body.known)}\n玩家的作文：${text}\nLanguageTool 提示：${lt.length ? lt.map((m) => `「${m.bad}」${m.msg}${m.fix ? ` → ${m.fix}` : ''}`).join('；') : '无'}`;
    const out = await chat(ESSAY_SYS, user);
    if (!out) return Response.json({ error: 'model' }, { status: 502, headers: h });
    return Response.json({ ok: !!out.json.ok, step: 'ai', errors: (Array.isArray(out.json.errors) ? out.json.errors : []).slice(0, 5), better: clip(out.json.better, 1500), missing, model: out.model }, { headers: h });
  }

  if (body.mode === 'duel') {
    const reply = clip(body.reply, 300).trim();
    const targets = (Array.isArray(body.targets) ? body.targets : []).slice(0, 5).map((t) => ({ id: clip(t?.id, 60), de: clip(t?.de, 60), forms: (Array.isArray(t?.forms) ? t.forms : []).slice(0, 20).map((f) => clip(f, 40)).filter(Boolean) }));
    const used = reply ? targets.filter((t) => t.forms.length && uses(reply, t.forms)).map((t) => t.id) : [];
    const history = (Array.isArray(body.history) ? body.history : []).slice(-10).map((x) => `${x.who === 'npc' ? '人物' : '玩家'}：${clip(x.de, 300)}`);
    const q = await takeQuota(auth, 'duel');
    if (q === 'unauth') return Response.json({ error: 'login' }, { status: 401, headers: h });
    if (!q) return Response.json({ error: 'quota' }, { status: 429, headers: h });
    const tl = targets.length ? `\n玩家要在对话里用上的词（你自己绝对不要说出这些词的任何形式）：${targets.map((t) => t.de).join('、')}` : '';
    const grammar = (Array.isArray(body.grammar) ? body.grammar : []).slice(0, 3).map((g) => clip(g, 40)).filter(Boolean);
    const gl = grammar.length ? `\n本场语法（你说话时自然地用上这些语法，也引玩家用）：${grammar.join('、')}` : '';
    const int = (x: unknown) => Math.max(0, Math.min(50, Math.floor(Number(x) || 0)));
    const round = int(body.round), rounds = int(body.rounds);
    const rl = rounds && round && reply ? `\n这是玩家第 ${round}/${rounds} 句${round >= rounds ? '（最后一句：请自然地结束对话；只要场景目标基本达到就把 done 设为 true）' : round === rounds - 1 ? '（还剩一句，往收尾推进）' : ''}` : '';
    const user = `场景：${clip(body.scene, 1200)}\n玩家等级：${Number(body.level) || 10}${tl}${gl}\n${knownLine(body.known)}\n对话：\n${history.join('\n')}\n玩家：${reply || '（开始对话，你先说）'}${rl}`;
    let out = await chat(DUEL_SYS + ZH_GUIDE, user);
    if (!out) return Response.json({ error: 'model' }, { status: 502, headers: h });
    // 防泄露: the NPC must not say a target first. Regenerate once; a target it still says leaves this talk.
    const leaked = () => targets.filter((t) => t.forms.length && !used.includes(t.id) && uses(String(out!.json.de ?? ''), t.forms));
    if (leaked().length) {
      const again = await chat(DUEL_SYS + ZH_GUIDE, `${user}\n（注意：你上一版回答说出了「${leaked().map((t) => t.de).join('、')}」，这是玩家要自己说的词，重写一次，换个说法，不要出现它们。）`);
      if (again) out = again;
    }
    const dropped = leaked().map((t) => t.id);
    const bare = (x: string) => norm(x).trim().replace(/^(der|die|das|sich) /, '');
    const bad = new Set((Array.isArray(out.json.bad) ? out.json.bad : []).map((x: unknown) => bare(clip(x, 60))));
    const gramOk = reply ? (Array.isArray(out.json.gram_ok) ? out.json.gram_ok : []).map((x: unknown) => clip(x, 40)).filter((x: string) => grammar.includes(x)) : [];
    return Response.json({ de: clip(out.json.de, 400), zh: clip(out.json.zh, 400), note: clip(out.json.note, 300), done: !!out.json.done, used: used.filter((id) => !bad.has(bare(targets.find((t) => t.id === id)!.de))), dropped, gramOk, model: out.model }, { headers: h });
  }
  if (body.mode === 'world') {
    if (body.mention) {
      const q = await takeQuota(auth, 'duel');
      if (q === 'unauth') return Response.json({ error: 'login' }, { status: 401, headers: h });
      if (!q) return Response.json({ error: 'quota' }, { status: 429, headers: h });
    } else {
      // 审核 1.0.10: the chat leader's unprompted line is not the player's own chat, so it takes none of their quota.
      const uid = await userId(auth);
      if (!uid) return Response.json({ error: 'login' }, { status: 401, headers: h });
      const t = Date.now();
      if (t - (lastWorld.get(uid) ?? 0) < WORLD_GAP) return Response.json({ error: 'quota' }, { status: 429, headers: h });
      worldMin = worldMin.filter((x) => t - x < 60_000);
      if (worldMin.length >= WORLD_PER_MIN) return Response.json({ error: 'quota' }, { status: 429, headers: h });
      worldMin.push(t);
      lastWorld.set(uid, t);
      if (lastWorld.size > 5000) for (const [k, v] of lastWorld) if (t - v >= WORLD_GAP) lastWorld.delete(k);
    }
    const recent = (Array.isArray(body.recent) ? body.recent : []).slice(-6).map((x) => clip(x, 200));
    const m = body.mention ? `\n${clip(body.mention.nick, 30)}（${Number(body.level) || 35} 级）@你说：${clip(body.mention.text, 200)}` : `\n（没人叫你，你自己说一句；用 A2 初级德语）`;
    const user = `你是：${clip(body.name, 30)}，来自${clip(body.origin, 40)}，说话风格：${clip(body.manner, 60)}\n你所在区域的处境：${clip(body.topic, 200)}\n最近的聊天：\n${recent.join('\n') || '（没有）'}${m}`;
    const out = await chat(WORLD_SYS, user);
    if (!out) return Response.json({ error: 'model' }, { status: 502, headers: h });
    return Response.json({ de: clip(out.json.de, 200), model: out.model }, { headers: h });
  }
  if (body.mode === 'persuade') {
    const reply = clip(body.reply, 400).trim();
    const history = (Array.isArray(body.history) ? body.history : []).slice(-12).map((x) => `${x.who === 'npc' ? '人物' : '玩家'}：${clip(x.de, 300)}`);
    const q = await takeQuota(auth, 'duel');
    if (q === 'unauth') return Response.json({ error: 'login' }, { status: 401, headers: h });
    if (!q) return Response.json({ error: 'quota' }, { status: 429, headers: h });
    const user = `场景：${clip(body.scene, 400)}\n它在意：${clip(body.cares, 200)}\n称呼：${body.formal ? 'Sie' : 'du'}\n第 ${Number(body.attempt) || 1} 次尝试\n需要论证：${body.argue ? '是' : '否'}\n玩家等级：${Number(body.level) || 21}\n${knownLine(body.known)}\n对话：\n${history.join('\n')}\n玩家：${reply || '（开始对话，你先说）'}`;
    const out = await chat(PERSUADE_SYS + ZH_GUIDE, user);
    if (!out) return Response.json({ error: 'model' }, { status: 502, headers: h });
    return Response.json({ de: clip(out.json.de, 400), zh: clip(out.json.zh, 400), note: clip(out.json.note, 300), convinced: !!out.json.convinced && !out.json.register_wrong, registerWrong: !!out.json.register_wrong, model: out.model }, { headers: h });
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
    return Response.json({ ok: !!out.json.ok, note: clip(out.json.note, 300), errors: (Array.isArray(out.json.errors) ? out.json.errors : []).slice(0, 2), better: clip(out.json.better, 400), model: out.model }, { headers: h });
  }

  return Response.json({ error: 'mode' }, { status: 400, headers: h });
});
