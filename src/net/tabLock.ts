// 一个浏览器只开一个标签页 (体检 1a, Lucas 2026-11-27 按推荐): the newest tab wins. When a tab opens the game it says so
// on a BroadcastChannel; every older tab first writes its last progress (审核 1.0.9 M3), answers, then stops saving
// (local and cloud) and covers itself with a note. Clicking the note reloads that tab, which then becomes the newest
// and stops the others. Without BroadcastChannel nothing changes.
// A tab that only shows the login box does not claim (审核 1.0.9 M3): opening a password-reset link must not stop the
// tab you are playing in. After logging in the page reloads and claims then.

import { blockSaves } from '../core/state';

const CHANNEL = 'wortklinge-tab';
let ch: BroadcastChannel | null = null;
let flush: (() => void) | null = null;

/** What an older tab runs right before it stops saving (the controller's persist). */
export function setTakeoverFlush(fn: () => void): void {
  flush = fn;
}

function cover(): void {
  if (document.getElementById('tab-lock')) return;
  const el = document.createElement('div');
  el.id = 'tab-lock';
  el.setAttribute('style', 'position:fixed;inset:0;z-index:99999;background:rgba(7,4,10,.92);color:#eadfd2;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;font:16px/1.6 system-ui,sans-serif;text-align:center;padding:16px');
  el.innerHTML = '<div>游戏已经在另一个标签页打开了。<br>这个标签页的进度已经存好，之后不再存档，免得旧进度盖掉新进度。</div>';
  const btn = document.createElement('button');
  btn.textContent = '在这个标签页继续玩';
  btn.className = 'btn primary';
  btn.onclick = () => location.reload();
  el.append(btn);
  document.body.append(el);
}

/** Does this browser hold a Supabase login (so this page will open the game, not just the login box)? */
export function hasStoredLogin(): boolean {
  try {
    for (let i = 0; i < localStorage.length; i++) if (/^sb-.*-auth-token$/.test(localStorage.key(i) ?? '')) return true;
  } catch {
    /* storage blocked: treat as logged out */
  }
  return false;
}

/**
 * Claim the game for this tab; older tabs of this browser save once more and stop. The promise resolves once an
 * older tab has answered that its last save is written, or after `wait` ms when no tab answers (none open).
 * Await it before reading the local save.
 */
export function claimTab(wait = 400): Promise<void> {
  if (typeof BroadcastChannel === 'undefined' || ch) return Promise.resolve();
  ch = new BroadcastChannel(CHANNEL);
  const me = `${Date.now()}-${Math.random()}`;
  let done: () => void = () => undefined;
  const settled = new Promise<void>((res) => {
    done = res;
    window.setTimeout(res, wait);
  });
  ch.onmessage = (e: MessageEvent<{ claim?: string; flushed?: string }>) => {
    if (e.data?.flushed === me) return done();
    if (!e.data?.claim || e.data.claim === me) return;
    try {
      flush?.();
    } catch {
      /* a failed last save must not keep this tab saving */
    }
    blockSaves();
    ch?.postMessage({ flushed: e.data.claim });
    cover();
  };
  ch.postMessage({ claim: me });
  return settled;
}
