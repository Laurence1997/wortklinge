// 审核 1.0.10 (server group): the ai-tutor edge function, run under a stubbed Deno and fetch.
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { transformSync } from 'esbuild';
import src from '../supabase/functions/ai-tutor/index.ts?raw';

type Handler = (req: Request) => Promise<Response>;
let handler: Handler;
const calls: Array<{ url: string; body: any }> = [];
let modelReply: Record<string, unknown> = {};
const realFetch = globalThis.fetch;

beforeAll(async () => {
  // The function has no imports or exports: strip the types and run it as a plain script.
  const js = transformSync(src, { loader: 'ts' }).code;
  const env: Record<string, string> = { SUPABASE_URL: 'https://sb.test', DEEPSEEK_API_KEY: 'k' };
  (globalThis as any).Deno = { env: { get: (k: string) => env[k] }, serve: (fn: Handler) => (handler = fn) };
  globalThis.fetch = vi.fn(async (input: any, init?: any) => {
    const url = String(input);
    const body = init?.body && typeof init.body === 'string' ? JSON.parse(init.body) : init?.body;
    calls.push({ url, body });
    if (url.endsWith('/rpc/ai_take')) return Response.json(true);
    if (url.endsWith('/auth/v1/user')) return init?.headers?.Authorization === 'Bearer good' ? Response.json({ id: 'u1' }) : new Response('no', { status: 401 });
    if (url.includes('languagetool')) return Response.json({ matches: [] });
    return Response.json({ choices: [{ message: { content: JSON.stringify(modelReply) } }] });
  }) as any;
  new Function(js)();
});
afterAll(() => {
  globalThis.fetch = realFetch;
});
beforeEach(() => {
  calls.length = 0;
  modelReply = { ok: true, errors: [], better: '', de: 'Hallo.', zh: '你好。', note: '', done: false };
});

const post = (body: unknown, auth = 'Bearer good') =>
  handler(new Request('https://fn.test/ai-tutor', { method: 'POST', headers: { origin: 'http://localhost:5173', authorization: auth }, body: JSON.stringify(body) })).then((r) => r.json().then((j) => ({ status: r.status, j })));
const quotaCalls = () => calls.filter((c) => c.url.endsWith('/rpc/ai_take'));
const modelUser = () => calls.find((c) => c.url.includes('deepseek'))!.body.messages[1].content as string;

describe('#25 missing-word reply and lenient matching', () => {
  it('names the word in Chinese only, never the German, and never 这只怪', async () => {
    const { j } = await post({ mode: 'grade', sentence: 'Ich trinke Kaffee.', forms: ['Tee', 'Tees'], zh: '茶' });
    expect(j.step).toBe('rule');
    expect(j.errors[0]).toEqual({ bad: '', fix: '', why: '句子里要用上「茶」这个词' });
    const old = await post({ mode: 'grade', sentence: 'Ich trinke Kaffee.', forms: ['Tee'] });
    expect(JSON.stringify(old.j)).not.toMatch(/Tee|这只怪/);
  });

  it('essay rule reply names skipped words in Chinese; missing keeps the German keys for the client', async () => {
    const { j } = await post({ mode: 'essay', text: 'Ich gehe heute.', words: [['Tee'], ['Haus', 'Häuser']], zhs: ['茶', '房子'] });
    expect(j.errors[0].why).toBe('还没用上：「茶」、「房子」');
    expect(j.errors[0].fix).toBe('');
    expect(j.missing).toEqual(['Tee', 'Haus']);
    const old = await post({ mode: 'essay', text: 'Ich gehe heute.', words: [['Tee'], ['Haus']] });
    expect(old.j.errors[0].why).toBe('还没用上给的词');
  });

  it('accepts declined adjectives, dative plural, genitive and regular participles', async () => {
    for (const [sentence, forms] of [
      ['Das ist ein schönes Haus.', ['schön']],
      ['Ich spiele mit den Kindern.', ['Kind', 'Kinder']],
      ['Das Auto des Mannes ist rot.', ['Mann', 'Männer']],
      ['Ich habe das gemacht.', ['machen', 'mache', 'machst', 'macht']],
      ['Ich habe gestern gearbeitet.', ['arbeiten', 'arbeite']],
    ] as Array<[string, string[]]>) {
      const { j } = await post({ mode: 'grade', sentence, forms });
      expect(j.step, sentence).toBe('ai');
    }
  });

  it('still rejects a short word that is only a prefix of another', async () => {
    const { j } = await post({ mode: 'grade', sentence: 'Ich trinke Teer.', forms: ['Tee', 'Tees'] });
    expect(j.step).toBe('rule');
  });
});

describe('#2 duel round / limit', () => {
  it('tells the NPC the round, and to wrap up and set done on the last one', async () => {
    await post({ mode: 'duel', scene: '市政厅登记住址', history: [], reply: 'Ich heiße Li.', round: 3, rounds: 3 });
    expect(modelUser()).toContain('这是玩家第 3/3 句（最后一句');
    expect(modelUser()).toContain('done 设为 true');
    calls.length = 0;
    await post({ mode: 'duel', scene: 's', history: [], reply: 'Ja.', round: 2, rounds: 3 });
    expect(modelUser()).toContain('第 2/3 句（还剩一句');
  });

  it('says nothing about rounds for old clients or the opening line', async () => {
    await post({ mode: 'duel', scene: 's', history: [], reply: 'Ja.' });
    expect(modelUser()).not.toContain('这是玩家第');
    calls.length = 0;
    await post({ mode: 'duel', scene: 's', history: [], reply: '', round: 0, rounds: 3 });
    expect(modelUser()).not.toContain('这是玩家第');
  });
});

describe('#10 world chat quota', () => {
  const persona = { mode: 'world', name: 'Ana', origin: 'Porto', manner: 'ruhig', topic: '找房', recent: [] };
  it('an @ reply takes the duel quota', async () => {
    const { status } = await post({ ...persona, mention: { nick: 'li', text: 'Hallo!' } });
    expect(status).toBe(200);
    expect(quotaCalls().map((c) => c.body.p_kind)).toEqual(['duel']);
  });

  it('an unprompted line takes no quota, needs a valid login and is throttled per user', async () => {
    const bad = await post(persona, 'Bearer nope');
    expect(bad.status).toBe(401);
    const first = await post(persona);
    expect(first.status).toBe(200);
    expect(first.j.de).toBe('Hallo.');
    expect(quotaCalls()).toHaveLength(0);
    const second = await post(persona);
    expect(second.status).toBe(429);
  });
});
