import { describe, expect, it, vi } from 'vitest';
import { newGame } from '../src/core/state';
import { makeRng } from '../src/core/rng';
import { gradePk, pkQuestion, type PkQuestion } from '../src/core/adventurers';
import { WORDS, fullForm } from '../src/data/words';

// 1.0.10 UX audit, group "input".
describe('PK: shared Chinese glosses', () => {
  // A region with two non-phrase words that share one gloss.
  const pair = (() => {
    for (const w of WORDS) {
      if (w.pos === 'phr') continue;
      const o = WORDS.find((x) => x.id !== w.id && x.zh === w.zh && (x.region ?? 1) === (w.region ?? 1) && x.pos !== 'phr' && x.de.toLowerCase() !== w.de.toLowerCase());
      if (o) return [w, o] as const;
    }
    throw new Error('no shared gloss');
  })();

  it('a typed answer with the other valid word is right', () => {
    const [w, o] = pair;
    const q: PkQuestion = { kind: 'typed', word: w, prompt: '写出德语', focus: w.zh, answer: fullForm(w), full: '' };
    expect(gradePk(q, fullForm(w))).toBe(true);
    expect(gradePk(q, fullForm(o))).toBe(true);
    expect(gradePk(q, 'zzzz')).toBe(false);
  });

  it('pick questions never show two options that are the same or mean the same', () => {
    const region = pair[0].region ?? 1;
    const s = newGame('T', 'student');
    for (const w of WORDS) if ((w.region ?? 1) === region) s.words[w.id] = { stage: 3 } as never;
    const rng = makeRng(7);
    for (let i = 0; i < 400; i++) {
      const q = pkQuestion(s, region, rng)!;
      expect(q).not.toBeNull();
      if (q.kind !== 'pick' || !q.options) continue;
      expect(new Set(q.options).size).toBe(q.options.length);
      if (q.prompt === '选德语') {
        const zhs = q.options.map((o) => WORDS.find((x) => (x.region ?? 1) === region && fullForm(x) === o)?.zh);
        expect(new Set(zhs).size).toBe(zhs.length);
      }
    }
  });
});

// @冒险者: every unanswered @ tells the asker why, and only an answer uses up the minute and a daily @.
const net = vi.hoisted(() => ({ hook: null as null | ((m: unknown) => void), notes: [] as string[], sent: [] as string[], reply: null as string | null }));
vi.mock('../src/net/social', () => ({
  social: { msgs: [] },
  joinedAt: { t: Date.now() },
  isChatLeader: () => false,
  onChatMsg: (f: (m: unknown) => void) => (net.hook = f),
  localNote: (t: string) => net.notes.push(t),
  sendAiLine: async (_n: string, t: string) => void net.sent.push(t),
}));
vi.mock('../src/net/aiTutor', () => ({ worldLine: async () => net.reply }));

describe('@ adventurers in world chat', () => {
  it('AI out: a note, no count; then answers; then the minute gap is told', async () => {
    const { initAdvChat } = await import('../src/net/advChat');
    const { adventurersOf } = await import('../src/core/adventurers');
    const s = newGame('T', 'student');
    initAdvChat(() => s);
    const name = adventurersOf(1)[0].name;
    const say = async () => {
      net.hook!({ nick: 'me', level: 1, text: `@${name} hallo`, t: Date.now(), me: true });
      await new Promise((r) => setTimeout(r, 0));
    };
    await say();
    expect(net.sent).toHaveLength(0);
    expect(net.notes[net.notes.length - 1]).toContain('不算次数');
    expect(s.flags.advAtN ?? 0).toBe(0);
    net.reply = 'Hallo!';
    await say();
    expect(net.sent).toEqual(['Hallo!']);
    expect(s.flags.advAtN).toBe(1);
    await say();
    expect(net.sent).toHaveLength(1);
    expect(net.notes[net.notes.length - 1]).toContain('一分钟');
  });
});
