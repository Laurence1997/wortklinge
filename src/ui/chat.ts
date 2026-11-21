// Bottom-left box: 记录 (game log, always there) and 聊天 (联机第一档, only when online).
// Chat: last 50 lines, Enter or / to talk, Esc to leave the box. L switches tabs.

import { CHAT_MAX, online, say } from '../net/online';
import { h } from './dom';
import { gameLog, onGameLog } from './gamelog';

export function mountChat(): { setVisible: (v: boolean) => void } {
  let tab: 'log' | 'chat' = 'log';
  let chatOn = false;
  let collapsed = false;
  const tLog = h('button.tab', { onclick: () => setTab('log') }, '记录');
  const tChat = h('button.tab', { onclick: () => setTab('chat') }, '聊天');
  const tFold = h('button.tab.fold', { onclick: () => { collapsed = !collapsed; draw(); }, title: '收起 / 展开' }, '–');
  const tabs = h('div.chat-tabs', tLog, tChat, tFold);
  const logBox = h('div.game-log');
  const log = h('div.chat-log');
  const status = h('div.chat-status');
  const input = h('input#chat-input', { maxlength: CHAT_MAX, placeholder: '按 / 聊天（2 秒一条）', autocomplete: 'off' }) as HTMLInputElement;
  const chatPane = h('div', status, log, input);
  const box = h('div#chat', tabs, logBox, chatPane);
  box.hidden = true;
  document.getElementById('ui')!.append(box);
  const setTab = (t: 'log' | 'chat') => {
    tab = t;
    collapsed = false;
    draw();
    if (t === 'log') logBox.scrollTop = logBox.scrollHeight;
  };
  let logCount = -1;
  const drawLog = () => {
    // Keep the reader's place when they scrolled up; follow the newest line otherwise.
    const atEnd = logBox.scrollHeight - logBox.scrollTop - logBox.clientHeight < 24;
    if (logCount !== gameLog.length || gameLog.length >= 200) {
      logBox.replaceChildren(...(gameLog.length ? gameLog.map((l) => h(`div.${l.tone}`, h('i', l.t), ' ', l.text)) : [h('div.info', '这里会记下每一题、每一下伤害、击杀和掉落。')]));
      logCount = gameLog.length;
    }
    if (atEnd) logBox.scrollTop = logBox.scrollHeight;
  };
  const draw = () => {
    if (!chatOn && tab === 'chat') tab = 'log';
    tChat.hidden = !chatOn;
    tLog.classList.toggle('on', tab === 'log');
    tChat.classList.toggle('on', tab === 'chat');
    tFold.textContent = collapsed ? '+' : '–';
    logBox.hidden = collapsed || tab !== 'log';
    chatPane.hidden = collapsed || tab !== 'chat';
    if (!logBox.hidden) drawLog();
    status.textContent = online.status === 'ok' ? `联机中 · 本区还有 ${online.peers.size} 人` : online.status === 'error' ? '联机断开，正在重连…' : '正在连接联机…';
    if (!chatPane.hidden) {
      log.replaceChildren(...online.chat.map((l) => h(`div${l.me ? '.me' : ''}`, h('b', `${l.nick}：`), l.text)));
      log.scrollTop = log.scrollHeight;
    }
  };
  onGameLog(() => {
    if (!logBox.hidden) drawLog();
  });
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
    if (box.hidden) return;
    const a = document.activeElement;
    if (a && (a.tagName === 'INPUT' || a.tagName === 'TEXTAREA' || a.tagName === 'SELECT')) return;
    if (!document.getElementById('battle')!.hidden || !document.getElementById('modal')!.hidden) return;
    if (e.key === '/' && chatOn) {
      e.preventDefault();
      setTab('chat');
      input.focus();
    }
  });
  return {
    setVisible: (v) => {
      // The box is always there once in the game; the chat tab only while online.
      box.hidden = !document.getElementById('title')!.hidden;
      chatOn = v;
      draw();
    },
  };
}
