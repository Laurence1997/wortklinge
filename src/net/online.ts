// 联机第一档: see other logged-in players in the same region and chat. Supabase Realtime:
// one channel per region for presence (who is here) and chat, plus small cell channels for walking
// positions (see update()). Nothing is stored. No grouping, no exact movement sync.

import type { RealtimeChannel } from '@supabase/supabase-js';
import { DEFAULT_LOOK, validLook, type Look } from '../core/look';
import { cloud, sb } from './cloud';
import { MAP_H, MAP_W, TILE } from '../game/map';

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
    .subscribe((status) => {
      online.status = status === 'SUBSCRIBED' ? 'ok' : status === 'CLOSED' ? 'off' : 'error';
      online.onChat();
      if (status === 'SUBSCRIBED') {
        sent = '';
        lastTrack = 0;
        myCell = '';
        update(me);
      }
    });
}

export function leave(): void {
  if (channel) void sb.removeChannel(channel);
  channel = null;
  leaveCells();
  online.status = 'off';
  online.region = 0;
  online.peers.clear();
}

// Network saving (Lucas, "按12改"): Realtime bills every message once per recipient, so walking
// positions only go to players nearby. The region is cut into cells of CELL px; you send on your own
// cell's channel and listen on the 3×3 cells around you, so a step reaches only players within about
// one cell (more than a screen). Presence (whole region) carries who you are, plus your position when
// you stand still (at most every 15 s), so far players still show up roughly where they are.
// Walking: one position every 3 s, or every 5 s once more than 10 players share the region; when you
// stop, the final position goes out at once.
export const CELL = 12 * TILE;
const COLS = Math.ceil((MAP_W * TILE) / CELL);
const ROWS = Math.ceil((MAP_H * TILE) / CELL);
const CROWD = 10;
const cellChannels = new Map<string, RealtimeChannel>();
let myCell = '';

const cellName = (region: number, cx: number, cy: number) => `wk-r${region}-c${cx}-${cy}`;

function onPos({ payload }: { payload: unknown }) {
  const p = payload as { id?: string; x?: number; y?: number };
  const peer = p.id ? online.peers.get(p.id) : undefined;
  if (peer) (peer.x = Number(p.x) || peer.x), (peer.y = Number(p.y) || peer.y);
}

/** Listens on the 3×3 cells around (cx, cy) and drops the others. */
function setCells(region: number, cx: number, cy: number) {
  const want = new Set<string>();
  for (let dx = -1; dx <= 1; dx++)
    for (let dy = -1; dy <= 1; dy++) {
      const x = cx + dx;
      const y = cy + dy;
      if (x >= 0 && y >= 0 && x < COLS && y < ROWS) want.add(cellName(region, x, y));
    }
  for (const [name, ch] of cellChannels) if (!want.has(name)) (void sb.removeChannel(ch), cellChannels.delete(name));
  for (const name of want) {
    if (cellChannels.has(name)) continue;
    const ch = sb.channel(name, { config: { broadcast: { self: false } } }).on('broadcast', { event: 'pos' }, onPos);
    ch.subscribe();
    cellChannels.set(name, ch);
  }
}

function leaveCells() {
  for (const ch of cellChannels.values()) void sb.removeChannel(ch);
  cellChannels.clear();
  myCell = '';
}

let lastTrack = 0;
let trackedPos = '';
let lastSentPos = '';
let prevPos = '';
let lastBroadcast = 0;

/** Called about once a second: keeps presence and the nearby cells up to date and sends your position. */
export function update(me: Me): void {
  if (!channel || online.status !== 'ok') return;
  const now = Date.now();
  const x = Math.round(me.x);
  const y = Math.round(me.y);
  const cx = Math.max(0, Math.min(COLS - 1, Math.floor(x / CELL)));
  const cy = Math.max(0, Math.min(ROWS - 1, Math.floor(y / CELL)));
  const cell = cellName(me.region, cx, cy);
  if (cell !== myCell) {
    myCell = cell;
    setCells(me.region, cx, cy);
  }
  const pos = `${Math.round(x / 4)},${Math.round(y / 4)}`;
  const moving = pos !== prevPos;
  const stopped = !moving && pos !== lastSentPos; // stood still this tick after walking
  prevPos = pos;

  // Presence (whole region): who you are, and where you stand when idle (at most every 15 s).
  const who = `${me.fighting},${JSON.stringify(me.look)},${myNick()}`;
  if ((who !== sent || (!moving && pos !== trackedPos && now - lastTrack > 15_000)) && now - lastTrack >= 3000) {
    sent = who;
    lastTrack = now;
    trackedPos = pos;
    lastSentPos = pos;
    void channel.track({ nick: myNick(), look: me.look, x, y, fighting: me.fighting });
    return;
  }

  // Walking (nearby only).
  const gap = online.peers.size + 1 > CROWD ? 5000 : 3000;
  if ((moving && now - lastBroadcast >= gap) || stopped) {
    const ch = cellChannels.get(myCell);
    if (!ch || ch.state !== 'joined') return;
    lastSentPos = pos;
    lastBroadcast = now;
    void ch.send({ type: 'broadcast', event: 'pos', payload: { id: myId(), x, y } });
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
