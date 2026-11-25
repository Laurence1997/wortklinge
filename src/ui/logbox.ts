// Bottom-left box: 记录 (game log). The chat tab went with 联机第一档 (Lucas 2026-11-25: cut).

import { h } from './dom';
import { gameLog, onGameLog } from './gamelog';

export function mountLogBox(): { setVisible: (v: boolean) => void } {
  let collapsed = false;
  const tLog = h('button.tab.on', { onclick: () => { collapsed = false; draw(); } }, '记录');
  const tFold = h('button.tab.fold', { onclick: () => { collapsed = !collapsed; draw(); }, title: '收起 / 展开' }, '–');
  const logBox = h('div.game-log');
  const box = h('div#chat', h('div.chat-tabs', tLog, tFold), logBox);
  box.hidden = true;
  document.getElementById('ui')!.append(box);
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
    tFold.textContent = collapsed ? '+' : '–';
    logBox.hidden = collapsed;
    if (!logBox.hidden) drawLog();
  };
  onGameLog(() => {
    if (!logBox.hidden) drawLog();
  });
  return {
    setVisible: (v) => {
      box.hidden = !v;
      draw();
    },
  };
}
