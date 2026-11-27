// 冒险者 in the world chat (游戏设计 六, Lucas 2026-11-25). They reply when someone @s them (at that player's region
// level; at most once a minute and 20 times a day per player) and now and then say one line on their own (simple early
// A2 German, about their region's life situation): all adventurers together at most once per 30 minutes, and only
// after a real player has spoken. Replies give no reward and count for no review. When the AI is out they stay quiet.
// The lines are written by one online client (the asker for @, the chat leader for unprompted lines) and broadcast
// with an AI tag.

import { ADV, adventurersOf, adventurerScene, regionTopic, type Adventurer } from '../core/adventurers';
import { dayKey, now, type GameState } from '../core/state';
import { worldLine } from './aiTutor';
import { isChatLeader, joinedAt, onChatMsg, sendAiLine, social, type ChatMsg } from './social';

let lastPro = 0;
let lastMention = 0;
let busy = false;

function recent(): string[] {
  return social.msgs.slice(-6).map((m) => `${m.ai ? `${m.nick}(AI)` : m.nick}：${m.text}`);
}

function persona(a: Adventurer) {
  const sc = adventurerScene(a);
  return { name: a.name, origin: a.origin, manner: a.manner, topic: regionTopic(a.region, sc?.zh) };
}

/** Adventurers that can be @-ed: every region's, by name (first match). */
function byName(name: string, region: number): Adventurer | undefined {
  const n = name.toLowerCase();
  const own = adventurersOf(region).find((a) => a.name.toLowerCase() === n);
  if (own) return own;
  for (let r = 1; r <= 20; r++) {
    const a = adventurersOf(r).find((x) => x.name.toLowerCase() === n);
    if (a) return a;
  }
  return undefined;
}

export function initAdvChat(state: () => GameState | null): void {
  onChatMsg((m: ChatMsg) => void handle(m, state()));
}

async function handle(m: ChatMsg, s: GameState | null): Promise<void> {
  if (m.ai) {
    if (m.pro) lastPro = Date.now();
    return;
  }
  if (!s || busy) return;
  // @ a name: only the asker's own client answers.
  const at = /@([A-Za-zÄÖÜäöüß]+)/.exec(m.text);
  if (m.me && at) {
    const a = byName(at[1], s.region ?? 1);
    if (!a) return;
    const day = dayKey(now(s));
    if (s.flags.advAtDay !== day) (s.flags.advAtDay = day), (s.flags.advAtN = 0);
    if (Date.now() - lastMention < ADV.mentionGapSec * 1000 || ((s.flags.advAtN as number) ?? 0) >= ADV.mentionDaily) return;
    lastMention = Date.now();
    s.flags.advAtN = ((s.flags.advAtN as number) ?? 0) + 1;
    busy = true;
    try {
      const de = await worldLine({ ...persona(a), level: s.level, mention: { nick: m.nick, text: m.text }, recent: recent() });
      if (de) await sendAiLine(a.name, de);
    } finally {
      busy = false;
    }
    return;
  }
  // Unprompted: the leader, after a human line, when nobody has heard an adventurer for 30 minutes.
  const gap = ADV.worldGapMin * 60_000;
  if (!isChatLeader() || Date.now() - joinedAt.t < gap || Date.now() - lastPro < gap) return;
  const list = adventurersOf(s.region ?? 1);
  const a = list[Math.floor(Math.random() * list.length)];
  if (!a) return;
  lastPro = Date.now();
  busy = true;
  try {
    const de = await worldLine({ ...persona(a), level: 35, recent: recent() });
    if (de) await sendAiLine(a.name, de, true);
  } finally {
    busy = false;
  }
}
