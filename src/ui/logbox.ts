// Bottom-left box: 记录 (game log) and 聊天 (全服聊天, Lucas 2026-11-25: chat + online count, nothing stored).
// Press / to type a chat line; Enter sends, Esc leaves the box.

import { h } from './dom';
import { gameLog, onGameLog } from './gamelog';
import { CHAT, onSocial, sendChat, social } from '../net/social';
import { cloud } from '../net/cloud';

export function mountLogBox(): { setVisible: (v: boolean) => void } {
  let collapsed = false;
  let tab: 'log' | 'chat' = 'log';
  let unread = 0;
  const tLog = h('button.tab.on', { onclick: () => pick('log') }, '记录');
  const tChat = h('button.tab', { onclick: () => pick('chat') }, '聊天');
  const online = h('span.chat-online');
  const tFold = h('button.tab.fold', { onclick: () => { collapsed = !collapsed; draw(); }, title: '收起 / 展开' }, '–');
  const logBox = h('div.game-log');
  const chatLog = h('div.game-log.chat-lines');
  const note = h('div.chat-status');
  const input = h('input', { maxLength: CHAT.maxLen, placeholder: '按 / 说话，Enter 发送；@名字 叫冒险者（AI）。不会保存，只有在线的人看得到' }) as HTMLInputElement;
  input.addEventListener('keydown', async (e) => {
    e.stopPropagation();
    if (e.key === 'Escape') return input.blur();
    if (e.key !== 'Enter') return;
    const why = await sendChat(input.value);
    if (why === null) input.value = '';
    note.textContent = why ?? '';
  });
  const chatPane = h('div', chatLog, note, input);
  const box = h('div#chat', h('div.chat-tabs', tLog, tChat, online, tFold), logBox, chatPane);
  box.hidden = true;
  document.getElementById('ui')!.append(box);
  let logCount = -1;
  const follow = (el: HTMLElement, fill: () => void) => {
    // Keep the reader's place when they scrolled up; follow the newest line otherwise.
    const atEnd = el.scrollHeight - el.scrollTop - el.clientHeight < 24;
    fill();
    if (atEnd) el.scrollTop = el.scrollHeight;
  };
  const drawLog = () =>
    follow(logBox, () => {
      if (logCount !== gameLog.length || gameLog.length >= 200) {
        logBox.replaceChildren(...(gameLog.length ? gameLog.map((l) => h(`div.${l.tone}`, h('i', l.t), ' ', l.text)) : [h('div.info', '这里会记下每一题、每一下伤害、击杀和掉落。')]));
        logCount = gameLog.length;
      }
    });
  const time = (t: number) => new Date(t).toTimeString().slice(0, 5);
  const drawChat = () =>
    follow(chatLog, () =>
      chatLog.replaceChildren(
        ...(social.msgs.length
          ? social.msgs.map((m) => h(m.me ? 'div.me' : 'div', h('i', time(m.t)), ' ', m.ai ? h('span.ai-tag', 'AI') : '', m.ai ? ' ' : '', h('b', m.ai ? m.nick : `${m.nick} Lv${m.level}`), '：', m.text))
          : [h('div.info', cloud.profile ? '全服聊天：在线的人都看得到，下线就没了。' : '登录并起好昵称后才能聊天。')]),
      ),
    );
  const pick = (t: typeof tab) => {
    tab = t;
    collapsed = false;
    if (t === 'chat') unread = 0;
    draw();
  };
  const draw = () => {
    tFold.textContent = collapsed ? '+' : '–';
    tLog.classList.toggle('on', tab === 'log');
    tChat.classList.toggle('on', tab === 'chat');
    tChat.textContent = unread ? `聊天 (${unread})` : '聊天';
    online.textContent = social.ready ? `当前在线 ${social.online} 人` : '';
    logBox.hidden = collapsed || tab !== 'log';
    chatPane.hidden = collapsed || tab !== 'chat';
    if (!logBox.hidden) drawLog();
    if (!chatPane.hidden) drawChat();
  };
  onGameLog(() => {
    if (!logBox.hidden) drawLog();
  });
  let seen = 0;
  onSocial(() => {
    if (tab !== 'chat' || collapsed) unread += social.total - seen;
    seen = social.total;
    draw();
  });
  window.addEventListener('keydown', (e) => {
    if (e.key !== '/' || box.hidden || box.offsetParent === null) return;
    const a = document.activeElement;
    if (a && (a.tagName === 'INPUT' || a.tagName === 'TEXTAREA' || (a as HTMLElement).isContentEditable)) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    pick('chat');
    input.focus();
  }, true);
  return {
    setVisible: (v) => {
      box.hidden = !v;
      draw();
    },
  };
}
