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
  /** Character name, used until a leaderboard nickname is set. */
  name: string;
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
  status: 'off' as 'off' | 'ok' | 'error',
  lastSend: 0,
};

let channel: RealtimeChannel | null = null;
let sent = '';

const myId = () => cloud.session?.user.id ?? '';
let fallbackName = '';
const myNick = () => cloud.profile?.nickname || fallbackName || '旅人';

/** Joins (or switches to) the region's room. Logged-in players only; the nickname falls back to the character name. */
export function joinRegion(me: Me): void {
  fallbackName = me.name.slice(0, 16);
  if (!myId()) return leave();
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
    .on('broadcast', { event: 'pos' }, ({ payload }) => {
      const p = payload as { id?: string; x?: number; y?: number };
      const peer = p.id ? online.peers.get(p.id) : undefined;
      if (peer) (peer.x = Number(p.x) || peer.x), (peer.y = Number(p.y) || peer.y);
    })
    .subscribe((status) => {
      online.status = status === 'SUBSCRIBED' ? 'ok' : status === 'CLOSED' ? 'off' : 'error';
      online.onChat();
      if (status === 'SUBSCRIBED') {
        sent = '';
        lastTrack = 0;
        update(me);
      }
    });
}

export function leave(): void {
  if (channel) void sb.removeChannel(channel);
  channel = null;
  online.status = 'off';
  online.region = 0;
  online.peers.clear();
}

/** Sends where you are, only when something changed (call about once a second). */
// Presence has a tight per-client rate limit, so it only carries who you are (nick, look, fighting)
// and a position refreshed at most every 10 s; walking goes out as a broadcast about once a second.
let lastTrack = 0;
let lastPos = '';
export function update(me: Me): void {
  if (!channel || online.status !== 'ok') return;
  const now = Date.now();
  const x = Math.round(me.x);
  const y = Math.round(me.y);
  const who = `${me.fighting},${JSON.stringify(me.look)},${myNick()}`;
  const pos = `${Math.round(x / 4)},${Math.round(y / 4)}`;
  if (who !== sent || (pos !== lastPos && now - lastTrack > 10_000)) {
    if (now - lastTrack < 3000) return; // never more than one presence update every 3 s
    sent = who;
    lastTrack = now;
    lastPos = pos;
    void channel.track({ nick: myNick(), look: me.look, x, y, fighting: me.fighting });
    return;
  }
  if (pos !== lastPos) {
    lastPos = pos;
    void channel.send({ type: 'broadcast', event: 'pos', payload: { id: myId(), x, y } });
  }
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
  if (!channel) return '还没连上联机服务器，稍等一下';
  const now = Date.now();
  if (now - online.lastSend < CHAT_GAP_MS) return '说慢一点（2 秒一条）';
  online.lastSend = now;
  void channel.send({ type: 'broadcast', event: 'chat', payload: { id: myId(), nick: myNick(), text: t } });
  addLine({ nick: myNick(), text: t, at: now, me: true });
  myBubble = { text: t, until: now + BUBBLE_MS };
  return null;
}

export let myBubble: { text: string; until: number } | null = null;
