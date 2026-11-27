// Accounts and cloud saves (Supabase). Invite only (email + password); login is required to play; the local save is a cache that also keeps you playing offline.
// Local save stays the source of play; when logged in it syncs with the cloud and the newer save wins.
// Only the publishable (anon) key lives here; row-level security limits each player to their own save.

import { createClient, type Session } from '@supabase/supabase-js';
import { LEXICON, migrate, savesBlocked, type GameState } from '../core/state';

// The one place the project's address and public key live.
export const SUPABASE_URL = 'https://xmttluclhrjhgokemnso.supabase.co';
export const SUPABASE_KEY = 'sb_publishable_ZP1aefkKlLhCNvaiGG3ZcA_gz46eEON';

// A reset mail may carry a link instead of the 6-digit code (default template). The link logs you in
// with type=recovery in the URL: read that before the client strips it, then ask for a new password.
let recovering = typeof location !== 'undefined' && /type=recovery/.test(location.hash + location.search);
/** Where links in auth mails send people back to (must be in the Supabase Redirect URLs). */
const SITE = typeof location !== 'undefined' && location.protocol.startsWith('http') ? location.origin + location.pathname : 'https://wortklinge.myreverielab.com/';

export const sb = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
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
    sb.auth.onAuthStateChange((e, session) => {
      if (e === 'PASSWORD_RECOVERY') recovering = true;
      cloud.session = session;
      if (!session) cloud.profile = null;
      changed();
    });
    if (cloud.session) await loadProfile();
  } catch {
    cloud.status = 'offline';
  }
}

const ERR_ZH: Record<string, string> = {
  'Invalid login credentials': '邮箱或密码不对。第一次登录请用邀请里给的初始密码；忘了就点「忘记密码」。',
  'Email not confirmed': '这个邮箱还没确认',
  'Token has expired or is invalid': '验证码不对或已过期',
};
const NET_ZH = '连不上登录服务器。请检查网络后再试；在国内的话，可能需要换个网络或开加速器。';
const zh = (m: string) => ERR_ZH[m] ?? (/fetch|network|timeout|load failed/i.test(m) ? NET_ZH : m);

/** Can this browser reach the login server at all? (Blocked networks never show up in the server logs.) */
export async function serverReachable(): Promise<boolean> {
  try {
    const r = await withTimeout(fetch(`${SUPABASE_URL}/auth/v1/health`, { headers: { apikey: SUPABASE_KEY } }), 6000);
    return r.ok;
  } catch {
    return false;
  }
}

export async function signIn(email: string, password: string): Promise<string | null> {
  let res;
  try {
    res = await withTimeout(sb.auth.signInWithPassword({ email: email.trim().toLowerCase(), password }), 12000);
  } catch {
    return NET_ZH;
  }
  const { data, error } = res;
  if (error) return zh(error.message);
  cloud.session = data.session;
  await loadProfile();
  changed();
  return null;
}

/** Invited accounts start with a fixed password; until it is changed the game asks for a new one. */
/** Login isn't finished until the player has a nickname (skipped when offline: profile unknown). */
export function needsNickname(): boolean {
  return !!cloud.session && !cloud.profile && cloud.status !== 'offline';
}

export function mustChangePassword(): boolean {
  return !!cloud.session && (recovering || !cloud.session.user.user_metadata?.pw_changed);
}

/** Came back from a password-reset link: the change-password step should say so. */
export function isRecovering(): boolean {
  return recovering && !!cloud.session;
}

export async function changePassword(password: string): Promise<string | null> {
  const { data, error } = await sb.auth.updateUser({ password, data: { pw_changed: true } });
  if (error) return zh(error.message);
  if (cloud.session && data.user) cloud.session = { ...cloud.session, user: data.user };
  recovering = false;
  if (/type=recovery|access_token/.test(location.hash)) history.replaceState(null, '', location.pathname + location.search);
  changed();
  return null;
}

/** Forgot password: a 6-digit code by mail (the reset email template shows {{ .Token }}). */
export async function sendResetCode(email: string): Promise<string | null> {
  const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: SITE });
  return error ? zh(error.message) : null;
}

export async function resetWithCode(email: string, token: string, password: string): Promise<string | null> {
  const { data, error } = await sb.auth.verifyOtp({ email, token, type: 'recovery' });
  if (error) return zh(error.message);
  cloud.session = data.session;
  const err = await changePassword(password);
  if (err) return err;
  await loadProfile();
  return null;
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
export async function setNickname(s: GameState | null, nickname: string): Promise<string | null> {
  const id = uid();
  const name = nickname.trim();
  if (!id) return '请先登录';
  if (!name || name.length > 16) return '昵称要 1–16 个字';
  const row = { id, nickname: name, level: s?.level ?? 1, cls: s?.cls ?? null, named: s ? namedCount(s) : 0, updated_at: new Date().toISOString() };
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
    const { data, error } = await withTimeout(sb.from('saves').select('data, updated_at').eq('user_id', id).maybeSingle());
    if (error) throw error;
    lastRemoteAt = (data as { updated_at?: string } | null)?.updated_at ?? null;
    const raw = (data as { data?: { lexicon?: number; level?: unknown } } | null)?.data;
    // 审查 A2: an old-format cloud save (a stale 0.6 page uploaded it) never replaces a new-format local save.
    const oldFormat = !!raw && typeof raw.level === 'number' && (raw.lexicon ?? 0) < LEXICON;
    const mineEarly = local && (!local.owner || local.owner === id) ? local : null;
    if (oldFormat && mineEarly) {
      cloud.status = 'ok';
      cloud.lastSync = Date.now();
      mineEarly.owner = id;
      void push(mineEarly);
      return mineEarly;
    }
    // 审查 A5: a cloud save migrate() throws on counts as unreadable (locked), not as offline.
    let remote: GameState | null = null;
    try {
      remote = data ? migrate(raw) : null;
    } catch {
      remote = null;
    }
    // A cloud save we can't read must never be overwritten by a fresh game: stop uploading until fixed.
    if (data && !remote) {
      cloudLocked = true;
      cloud.status = 'offline';
      return local;
    }
    cloud.status = 'ok';
    cloud.lastSync = Date.now();
    // A local save from another account on this browser is not yours: ignore it.
    const mine = local && (!local.owner || local.owner === id) ? local : null;
    if (remote && (!mine || (remote.savedAt ?? 0) > (mine.savedAt ?? 0))) {
      bootAt = remote.savedAt ?? 0;
      return { ...remote, owner: id };
    }
    if (mine) {
      mine.owner = id;
      bootAt = mine.savedAt ?? 0;
      void push(mine);
    }
    return mine;
  } catch {
    cloud.status = 'offline';
    const mine = local && (!local.owner || local.owner === id) ? local : null;
    if (mine) mine.owner = id;
    return mine;
  }
}

/** Uploads the save and refreshes the leaderboard row. Failures are silent; the next push retries. */
let cloudLocked = false;
/** updated_at of the cloud row as this page last read or wrote it (审查 A1 ②). */
let lastRemoteAt: string | null = null;
/** savedAt of the save this page started from: a cloud row written later but holding no newer save (the older tab of
 *  this browser finishing its last upload as this tab opened, 审核 1.0.9 L4) is already inside this page's progress. */
let bootAt = 0;

/** Was the cloud row last written with a save no newer than the one this page started from? */
async function notNewerThanBoot(id: string): Promise<boolean> {
  if (!bootAt) return false;
  try {
    const { data, error } = await withTimeout(sb.from('saves').select('saved:data->savedAt').eq('user_id', id).maybeSingle());
    const at = Number((data as { saved?: unknown } | null)?.saved ?? NaN);
    return !error && Number.isFinite(at) && at <= bootAt;
  } catch {
    return false;
  }
}

export async function push(s: GameState): Promise<boolean> {
  const id = uid();
  if (!id || cloudLocked || savesBlocked()) return false;
  try {
    // 审查 A1 ②: someone else (another tab or computer) wrote a newer save since we last synced: stop and say so.
    const head = await withTimeout(sb.from('saves').select('updated_at').eq('user_id', id).maybeSingle());
    const remoteAt = (head.data as { updated_at?: string } | null)?.updated_at ?? null;
    const moved = remoteAt && (lastRemoteAt ? Date.parse(remoteAt) !== Date.parse(lastRemoteAt) : Date.parse(remoteAt) > (s.savedAt ?? 0));
    if (!head.error && moved && !(await notNewerThanBoot(id))) {
      cloudLocked = true;
      cloud.status = 'offline';
      changed();
      window.dispatchEvent(new CustomEvent('wk-cloud-conflict'));
      return false;
    }
    const at = new Date(s.savedAt ?? Date.now()).toISOString();
    const { error } = await withTimeout(sb.from('saves').upsert({ user_id: id, data: s, version: s.version, updated_at: at }), 10000);
    if (error) throw error;
    lastRemoteAt = at;
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
    if (savesBlocked()) return; // a newer tab of this browser took over
    void push(s);
  }, 30_000);
}

export interface BoardRow {
  pos: number;
  nickname: string;
  level: number;
  score: number;
  extra: number;
  me: boolean;
}

/** 排行榜 (每日榜 / 总榜 / 语法榜): ranked on the server from the saved counters; hidden players are left out. */
export async function leaderboard(kind: 'daily' | 'total' | 'gram'): Promise<BoardRow[]> {
  const { data, error } = await withTimeout(sb.rpc('leaderboard', { kind, lim: 30 }));
  if (error) throw error;
  return (data ?? []) as BoardRow[];
}
