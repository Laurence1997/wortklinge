// Accounts and cloud saves (Supabase). Optional: the game runs fully without logging in.
// Local save stays the source of play; when logged in it syncs with the cloud and the newer save wins.
// Only the publishable (anon) key lives here; row-level security limits each player to their own save.

import { createClient, type Session } from '@supabase/supabase-js';
import { migrate, type GameState } from '../core/state';

// The one place the project's address and public key live.
export const SUPABASE_URL = 'https://xmttluclhrjhgokemnso.supabase.co';
export const SUPABASE_KEY = 'sb_publishable_ZP1aefkKlLhCNvaiGG3ZcA_gz46eEON';

export const sb = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: 'implicit' },
});

export interface Profile {
  nickname: string;
  level: number;
  cls: string | null;
  named: number;
}

export type SyncStatus = 'off' | 'syncing' | 'ok' | 'offline';

export const cloud = {
  session: null as Session | null,
  profile: null as Profile | null,
  status: 'off' as SyncStatus,
  lastSync: 0,
  onChange: () => {},
};

const uid = () => cloud.session?.user.id ?? null;
const changed = () => cloud.onChange();

function withTimeout<T>(p: PromiseLike<T>, ms = 5000): Promise<T> {
  return Promise.race([Promise.resolve(p), new Promise<T>((_, rej) => setTimeout(() => rej(new Error('timeout')), ms))]);
}

export function namedCount(s: GameState): number {
  return Object.values(s.words).filter((p) => p.stage === 3).length;
}

/** Reads the session (including one arriving from a magic link) and the profile. */
export async function initCloud(): Promise<void> {
  try {
    const { data } = await withTimeout(sb.auth.getSession());
    cloud.session = data.session;
    if (location.hash.includes('access_token')) history.replaceState(null, '', location.pathname + location.search);
    sb.auth.onAuthStateChange((_e, session) => {
      cloud.session = session;
      if (!session) cloud.profile = null;
      changed();
    });
    if (cloud.session) await loadProfile();
  } catch {
    cloud.status = 'offline';
  }
}

export async function sendLoginLink(email: string): Promise<string | null> {
  const { error } = await sb.auth.signInWithOtp({ email, options: { emailRedirectTo: location.origin + location.pathname } });
  return error ? error.message : null;
}

export async function signOut(): Promise<void> {
  await sb.auth.signOut();
  cloud.session = null;
  cloud.profile = null;
  cloud.status = 'off';
  changed();
}

async function loadProfile(): Promise<void> {
  const id = uid();
  if (!id) return;
  const { data } = await withTimeout(sb.from('profiles').select('nickname, level, cls, named').eq('id', id).maybeSingle());
  cloud.profile = (data as Profile | null) ?? null;
}

/** Sets the nickname (shown on the leaderboard instead of the email). Returns an error in Chinese or null. */
export async function setNickname(s: GameState, nickname: string): Promise<string | null> {
  const id = uid();
  const name = nickname.trim();
  if (!id) return '请先登录';
  if (!name || name.length > 16) return '昵称要 1–16 个字';
  const row = { id, nickname: name, level: s.level, cls: s.cls, named: namedCount(s), updated_at: new Date().toISOString() };
  const { error } = await sb.from('profiles').upsert(row);
  if (error) return error.code === '23505' ? '这个昵称已经有人用了' : `保存失败：${error.message}`;
  cloud.profile = { nickname: name, level: row.level, cls: row.cls, named: row.named };
  changed();
  return null;
}

/**
 * At boot: if logged in, fetch the cloud save and keep the newer of the two.
 * Offline or slow: plays the local save and syncs later.
 */
export async function syncOnBoot(local: GameState | null): Promise<GameState | null> {
  const id = uid();
  if (!id) return local;
  cloud.status = 'syncing';
  try {
    const { data, error } = await withTimeout(sb.from('saves').select('data').eq('user_id', id).maybeSingle());
    if (error) throw error;
    const remote = data ? migrate((data as { data: unknown }).data) : null;
    cloud.status = 'ok';
    cloud.lastSync = Date.now();
    if (remote && (!local || (remote.savedAt ?? 0) > (local.savedAt ?? 0))) return remote;
    if (local) void push(local);
    return local;
  } catch {
    cloud.status = 'offline';
    return local;
  }
}

/** Uploads the save and refreshes the leaderboard row. Failures are silent; the next push retries. */
export async function push(s: GameState): Promise<boolean> {
  const id = uid();
  if (!id) return false;
  try {
    const at = new Date(s.savedAt ?? Date.now()).toISOString();
    const { error } = await withTimeout(sb.from('saves').upsert({ user_id: id, data: s, version: s.version, updated_at: at }), 10000);
    if (error) throw error;
    if (cloud.profile) {
      const stats = { level: s.level, cls: s.cls, named: namedCount(s), updated_at: at };
      await sb.from('profiles').update(stats).eq('id', id);
      Object.assign(cloud.profile, stats);
    }
    cloud.status = 'ok';
    cloud.lastSync = Date.now();
    changed();
    return true;
  } catch {
    cloud.status = 'offline';
    changed();
    return false;
  }
}

let timer = 0;
/** Called after every local save: uploads at most once every 30 s. */
export function schedulePush(s: GameState): void {
  if (!uid() || timer) return;
  timer = window.setTimeout(() => {
    timer = 0;
    void push(s);
  }, 30_000);
}

export async function leaderboard(): Promise<Profile[]> {
  const { data, error } = await sb.from('profiles').select('nickname, level, cls, named').order('level', { ascending: false }).order('named', { ascending: false }).limit(50);
  if (error) throw error;
  return (data ?? []) as Profile[];
}
