// 全服聊天 + 「当前在线 N 人」 (Lucas 2026-11-25). One Supabase Realtime channel: presence for the count, broadcast
// for chat. Nothing is stored: a message only reaches who is online now. Logged-in players with a nickname only;
// they show as nickname + level, never the email. 隐身 (settings.hideBoard): you can read, you are not counted.
// 暂定: 2 s between messages, 120 characters. Before strangers join, add report / block (and move to a private channel).

import type { RealtimeChannel } from '@supabase/supabase-js';
import { cloud, sb } from './cloud';

export const CHAT = { gapMs: 2000, maxLen: 120, keep: 100 };

export interface ChatMsg {
  nick: string;
  level: number;
  text: string;
  t: number;
  me?: boolean;
  /** 冒险者 (AI): shown with an AI tag, never a real player. */
  ai?: boolean;
  /** An unprompted adventurer line (for the 30-minute gap shared by everyone online). */
  pro?: boolean;
  /** A local hint for this player only (never sent, never seen by hooks or the AI). */
  sys?: boolean;
}

export const social = {
  online: 0,
  msgs: [] as ChatMsg[],
  /** Messages seen since joining (for the unread count). */
  total: 0,
  ready: false,
  listeners: new Set<() => void>(),
};

let ch: RealtimeChannel | null = null;
/** Called for every message that arrives or is sent (冒险者 replies hang here). */
const hooks = new Set<(m: ChatMsg) => void>();
export function onChatMsg(f: (m: ChatMsg) => void): void {
  hooks.add(f);
}
export const joinedAt = { t: Date.now() };

/** The online player who speaks for the adventurers (lowest id), so only one client posts their lines. */
export function isChatLeader(): boolean {
  const uid = cloud.session?.user.id;
  if (!ch || !uid) return false;
  const keys = Object.keys(ch.presenceState()).sort();
  return keys.length > 0 && keys[0] === uid;
}

/** Post an adventurer's line (AI tag) to everyone, this client included. */
export async function sendAiLine(nick: string, text: string, pro = false): Promise<void> {
  if (!ch || !social.ready) return;
  const m: ChatMsg = { nick, level: 0, text: text.slice(0, 300), t: Date.now(), ai: true, ...(pro ? { pro: true } : {}) };
  await ch.send({ type: 'broadcast', event: 'chat', payload: m });
  addMsg(m);
  for (const f of hooks) f(m);
}
/** Show a hint line in this player's chat only (not broadcast, runs no hooks). */
export function localNote(text: string): void {
  addMsg({ nick: '', level: 0, text, t: Date.now(), sys: true });
}
let lastSent = 0;
let meta: () => { level: number; hidden: boolean } = () => ({ level: 1, hidden: false });
const emit = () => social.listeners.forEach((f) => f());

export function onSocial(f: () => void): () => void {
  social.listeners.add(f);
  return () => social.listeners.delete(f);
}

function countOnline(): number {
  if (!ch) return 0;
  return Object.keys(ch.presenceState()).length;
}

/** Join the world channel (once logged in). `who` reads your level and 隐身 at each presence update. */
export function joinWorld(who: typeof meta): void {
  meta = who;
  const uid = cloud.session?.user.id;
  if (ch || !uid) return;
  ch = sb.channel('world', { config: { presence: { key: uid }, broadcast: { self: false } } });
  ch.on('presence', { event: 'sync' }, () => {
    social.online = countOnline();
    emit();
  });
  ch.on('broadcast', { event: 'chat' }, ({ payload }) => {
    const m = payload as ChatMsg;
    if (typeof m?.text !== 'string' || typeof m.nick !== 'string') return;
    const msg: ChatMsg = { nick: m.nick.slice(0, 16), level: Number(m.level) || 1, text: m.text.slice(0, m.ai ? 300 : CHAT.maxLen), t: Date.now(), ...(m.ai ? { ai: true } : {}), ...(m.pro ? { pro: true } : {}) };
    addMsg(msg);
    for (const f of hooks) f(msg);
  });
  ch.subscribe((status) => {
    social.ready = status === 'SUBSCRIBED';
    if (social.ready) void track();
    emit();
  });
}

/** Re-announce presence (level change, 隐身 switched). */
export async function track(): Promise<void> {
  if (!ch || !social.ready) return;
  const m = meta();
  if (m.hidden) await ch.untrack();
  else await ch.track({ nick: cloud.profile?.nickname ?? '', level: m.level });
  social.online = countOnline();
  emit();
}

function addMsg(m: ChatMsg): void {
  social.msgs.push(m);
  social.total += 1;
  if (social.msgs.length > CHAT.keep) social.msgs.splice(0, social.msgs.length - CHAT.keep);
  emit();
}

/** Send one chat line. Returns why not, or null when sent. */
export async function sendChat(raw: string): Promise<string | null> {
  const text = raw.trim().slice(0, CHAT.maxLen);
  if (!text) return '';
  const nick = cloud.profile?.nickname;
  if (!cloud.session || !nick) return '登录并起好昵称后才能聊天。';
  if (!ch || !social.ready) return '聊天还没连上，稍等一下。';
  if (Date.now() - lastSent < CHAT.gapMs) return '说慢一点。';
  lastSent = Date.now();
  const m: ChatMsg = { nick, level: meta().level, text, t: Date.now() };
  const r = await ch.send({ type: 'broadcast', event: 'chat', payload: m });
  if (r !== 'ok') return '没发出去，网络不太好。';
  const mine = { ...m, me: true };
  addMsg(mine);
  for (const f of hooks) f(mine);
  return null;
}
