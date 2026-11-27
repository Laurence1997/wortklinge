// 一个浏览器只开一个标签页 (体检 1a, Lucas 2026-11-27 按推荐): the newest tab wins. When a tab opens it says so on a
// BroadcastChannel; every older tab stops saving at once (local and cloud) and covers itself with a note. Clicking the
// note reloads that tab, which then becomes the newest and stops the others. Without BroadcastChannel nothing changes.

import { blockSaves } from '../core/state';

const CHANNEL = 'wortklinge-tab';
let ch: BroadcastChannel | null = null;

function cover(): void {
  if (document.getElementById('tab-lock')) return;
  const el = document.createElement('div');
  el.id = 'tab-lock';
  el.setAttribute('style', 'position:fixed;inset:0;z-index:99999;background:rgba(7,4,10,.92);color:#eadfd2;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;font:16px/1.6 system-ui,sans-serif;text-align:center;padding:16px');
  el.innerHTML = '<div>游戏已经在另一个标签页打开了。<br>为了不让旧进度盖掉新进度，这个标签页已停止存档。</div>';
  const btn = document.createElement('button');
  btn.textContent = '在这个标签页继续玩';
  btn.className = 'btn primary';
  btn.onclick = () => location.reload();
  el.append(btn);
  document.body.append(el);
}

/** Claim the game for this tab; older tabs of this browser stop saving. */
export function claimTab(): void {
  if (typeof BroadcastChannel === 'undefined' || ch) return;
  ch = new BroadcastChannel(CHANNEL);
  const me = `${Date.now()}-${Math.random()}`;
  ch.onmessage = (e: MessageEvent<{ claim?: string }>) => {
    if (!e.data?.claim || e.data.claim === me) return;
    blockSaves();
    cover();
  };
  ch.postMessage({ claim: me });
}
