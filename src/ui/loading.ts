// 加载画面 (Lucas 2026-11-27): shown from page open until the title, and again from 继续 until the map is ready.
// If something throws while it is up, it says so instead of leaving a half-drawn game behind (the game finishing
// its load still hides it, so a harmless error cannot trap the player).

const el = () => document.getElementById('loading');

export function showLoading(tip: string): void {
  const l = el();
  if (!l) return;
  l.hidden = false;
  l.classList.remove('ld-out', 'ld-err');
  setTip(tip);
  setProgress(null);
}

export function setTip(tip: string): void {
  const t = el()?.querySelector('.ld-tip');
  if (t) t.textContent = tip;
}

/** 0–1 fills the bar; null = the sliding "busy" bar. */
export function setProgress(p: number | null): void {
  const bar = el()?.querySelector('.ld-bar');
  const span = bar?.querySelector('span') as HTMLElement | null;
  if (!bar || !span) return;
  bar.classList.toggle('ld-pct', p !== null);
  span.style.width = p === null ? '' : `${Math.round(Math.max(0.05, Math.min(1, p)) * 100)}%`;
}

export function hideLoading(): void {
  const l = el();
  if (!l || l.hidden) return;
  l.classList.add('ld-out');
  window.setTimeout(() => {
    if (l.classList.contains('ld-out')) l.hidden = true;
  }, 400);
}

export function loadingVisible(): boolean {
  const l = el();
  return !!l && !l.hidden && !l.classList.contains('ld-out');
}

const onError = () => {
  if (!loadingVisible()) return;
  el()!.classList.add('ld-err');
  setTip('载入出错了。请刷新页面；还不行的话，按 Cmd+Option+J（Windows: Ctrl+Shift+J）截图控制台发给开发者。');
};
window.addEventListener('error', onError);
