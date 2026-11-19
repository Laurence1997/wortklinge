// Chat box (联机第一档): bottom-left, last 50 lines, Enter or / to talk, Esc to leave the box.

import { CHAT_MAX, online, say } from '../net/online';
import { h } from './dom';

export function mountChat(): { setVisible: (v: boolean) => void } {
  const log = h('div.chat-log');
  const status = h('div.chat-status');
  const input = h('input#chat-input', { maxlength: CHAT_MAX, placeholder: '按 / 聊天（2 秒一条）', autocomplete: 'off' }) as HTMLInputElement;
  const box = h('div#chat', status, log, input);
  box.hidden = true;
  document.getElementById('ui')!.append(box);
  const draw = () => {
    status.textContent = online.status === 'ok' ? `联机中 · 本区还有 ${online.peers.size} 人` : online.status === 'error' ? '联机断开，正在重连…' : '正在连接联机…';
    log.replaceChildren(...online.chat.map((l) => h(`div${l.me ? '.me' : ''}`, h('b', `${l.nick}：`), l.text)));
    log.scrollTop = log.scrollHeight;
  };
  online.onChat = draw;
  window.setInterval(draw, 2000);
  input.addEventListener('keydown', (e) => {
    e.stopPropagation();
    if (e.key === 'Enter') {
      const err = say(input.value);
      if (err === null) input.value = '';
      else if (err) input.placeholder = err;
      if (!input.value) input.blur();
    }
    if (e.key === 'Escape') input.blur();
  });
  window.addEventListener('keydown', (e) => {
    if (box.hidden || e.key !== '/') return;
    const a = document.activeElement;
    if (a && (a.tagName === 'INPUT' || a.tagName === 'TEXTAREA' || a.tagName === 'SELECT')) return;
    if (!document.getElementById('battle')!.hidden || !document.getElementById('modal')!.hidden) return;
    e.preventDefault();
    input.focus();
  });
  return { setVisible: (v) => (box.hidden = !v) };
}
