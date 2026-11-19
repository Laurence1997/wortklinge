import type { GameState } from '../core/state';
import { $, clear, h } from './dom';

export const ORIGINS: Array<[string, string]> = [
  ['student', '留学生'],
  ['cook', '厨师'],
  ['engineer', '工程师'],
  ['nurse', '护士'],
  ['programmer', '程序员'],
];

export function showTitle(opts: {
  account?: HTMLElement;
  existing: GameState | null;
  onContinue: () => void;
  onNew: (name: string, origin: string) => void;
  onImport: (text: string) => void;
  version: string;
}): void {
  const el = $('title');
  el.hidden = false;
  const name = h('input', { type: 'text', maxlength: 16, placeholder: '比如 Lucas', autocomplete: 'off' }) as HTMLInputElement;
  const origin = h('select') as HTMLSelectElement;
  for (const [v, zh] of ORIGINS) origin.append(h('option', { value: v }, zh));
  const file = h('input', { type: 'file', accept: '.json,application/json', hidden: true }) as HTMLInputElement;
  file.onchange = async () => {
    const f = file.files?.[0];
    if (f) opts.onImport(await f.text());
  };
  const start = () => {
    const n = name.value.trim() || 'Lucas';
    if (opts.existing && !confirmOverwrite()) return;
    el.hidden = true;
    opts.onNew(n, origin.value);
  };
  name.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') start();
  });
  const box = h(
    'div.box',
    h('h1', 'Wortklinge', h('small', '失 语 纪 元')),
    h(
      'div.lore',
      '一夜之间，无名之物吃掉了世界的名字。',
      h('br'),
      '面包长出牙齿，街牌在低语，幸存者只剩嗯嗯啊啊。',
      h('br'),
      '你在篝火旁醒来。叫对一个名字，它就会变回原样。',
    ),
  );
  if (opts.existing) {
    box.append(
      h(
        'div.actions',
        h('button.btn.primary', { onclick: () => { el.hidden = true; opts.onContinue(); } }, `继续：${opts.existing.name} · Lv ${opts.existing.level}`),
      ),
      h('p.small.muted', { style: 'margin-top:18px' }, '或者开始一个新角色（会覆盖当前存档）：'),
    );
  }
  box.append(
    h(
      'div.form.panel',
      h('label', h('span', '名字（首领会问你「Wie heißt du?」）'), name),
      h('label', h('span', '出身（第 2 区起，对应主题的怪伤害 +10%）'), origin),
    ),
    h(
      'div.actions',
      h('button.btn' + (opts.existing ? '' : '.primary'), { onclick: start }, '在篝火旁醒来'),
      h('button.btn.ghost', { onclick: () => file.click() }, '导入存档'),
      file,
    ),
    opts.account ?? '',
    h('div.ver', `v${opts.version} · 第 1 区 · 请用电脑上的 Chrome 打开，开声音`),
  );
  clear(el).append(box);
  window.setTimeout(() => (opts.existing ? null : name.focus()), 50);
}

function confirmOverwrite(): boolean {
  // A plain confirm is fine here: it only guards an irreversible overwrite.
  return window.confirm('开始新角色会覆盖现在的存档。确定吗？（可以先在游戏里导出存档）');
}
