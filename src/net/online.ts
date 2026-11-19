// 联机第一档: see other logged-in players in the same region and chat. Supabase Realtime:
// one channel per region, presence for who is where (sent about once a second, only while moving),
// broadcast for chat (nothing is stored). No grouping, no exact movement sync.

import type { RealtimeChannel } from '@supabase/supabase-js';
import { DEFAULT_LOOK, validLook, type Look } from '../core/look';
import { cloud, sb } from './cloud';

export interface Peer {
  id: string;
  nick: string;
  look: Look;
  x: number;
  y: number;
  fighting: boolean;
  bubble?: string;
  bubbleUntil?: number;
}

export interface ChatLine {
  nick: string;
  text: string;
  at: number;
  me?: boolean;
}

export const CHAT_MAX = 100;
const CHAT_GAP_MS = 2000;
const BUBBLE_MS = 5000;
const LOG_MAX = 50;

export interface Me {
  region: number;
  look: Look;
  x: number;
  y: number;
  fighting: boolean;
}

export const online = {
  peers: new Map<string, Peer>(),
  chat: [] as ChatLine[],
  region: 0,
  onChat: () => {},
  lastSend: 0,
};

let channel: RealtimeChannel | null = null;
let sent = '';

const myId = () => cloud.session?.user.id ?? '';
const myNick = () => cloud.profile?.nickname ?? '';

/** Joins (or switches to) the region's room. Only for logged-in players with a nickname. */
export function joinRegion(me: Me): void {
  if (!myId() || !myNick()) return leave();
  if (channel && online.region === me.region) return;
  leave();
  online.region = me.region;
  channel = sb.channel(`wk-region-${me.region}`, { config: { presence: { key: myId() }, broadcast: { self: false } } });
  channel
    .on('presence', { event: 'sync' }, () => {
      const state = channel!.presenceState<Record<string, unknown>>();
      const seen = new Set<string>();
      for (const [id, metas] of Object.entries(state)) {
        if (id === myId()) continue;
        const m = metas[metas.length - 1] as Record<string, unknown>;
        seen.add(id);
        const old = online.peers.get(id);
        online.peers.set(id, {
          id,
          nick: String(m.nick ?? '?').slice(0, 16),
          look: validLook(m.look) ?? DEFAULT_LOOK,
          x: Number(m.x) || 0,
          y: Number(m.y) || 0,
          fighting: !!m.fighting,
          bubble: old?.bubble,
          bubbleUntil: old?.bubbleUntil,
        });
      }
      for (const id of [...online.peers.keys()]) if (!seen.has(id)) online.peers.delete(id);
    })
    .on('broadcast', { event: 'chat' }, ({ payload }) => {
      const p = payload as { id?: string; nick?: string; text?: string };
      const text = String(p.text ?? '').slice(0, CHAT_MAX);
      if (!text) return;
      const nick = String(p.nick ?? '?').slice(0, 16);
      addLine({ nick, text, at: Date.now() });
      const peer = p.id ? online.peers.get(p.id) : undefined;
      if (peer) (peer.bubble = text), (peer.bubbleUntil = Date.now() + BUBBLE_MS);
    })
    .subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        sent = '';
        update(me);
      }
    });
}

export function leave(): void {
  if (channel) void sb.removeChannel(channel);
  channel = null;
  online.region = 0;
  online.peers.clear();
}

/** Sends where you are, only when something changed (call about once a second). */
export function update(me: Me): void {
  if (!channel) return;
  const key = `${Math.round(me.x / 4)},${Math.round(me.y / 4)},${me.fighting},${JSON.stringify(me.look)},${myNick()}`;
  if (key === sent) return;
  sent = key;
  void channel.track({ nick: myNick(), look: me.look, x: Math.round(me.x), y: Math.round(me.y), fighting: me.fighting });
}

function addLine(l: ChatLine) {
  online.chat.push(l);
  if (online.chat.length > LOG_MAX) online.chat.shift();
  online.onChat();
}

/** Returns an error in Chinese, or null when sent. */
export function say(text: string): string | null {
  const t = text.trim().slice(0, CHAT_MAX);
  if (!t) return '';
  if (!channel) return '登录并起好昵称后才能聊天';
  const now = Date.now();
  if (now - online.lastSend < CHAT_GAP_MS) return '说慢一点（2 秒一条）';
  online.lastSend = now;
  void channel.send({ type: 'broadcast', event: 'chat', payload: { id: myId(), nick: myNick(), text: t } });
  addLine({ nick: myNick(), text: t, at: now, me: true });
  myBubble = { text: t, until: now + BUBBLE_MS };
  return null;
}

export let myBubble: { text: string; until: number } | null = null;
