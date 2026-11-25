import { heroIcon } from './icons';
import { DEFAULT_LOOK, LOOK_OPTIONS, type Look } from '../core/look';
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
  onNew: (name: string, origin: string, look: Look) => void;
  onImport: (text: string) => void;
  version: string;
}): void {
  const el = $('title');
  el.hidden = false;
  const name = h('input', { type: 'text', maxlength: 16, placeholder: '比如 Lucas', autocomplete: 'off' }) as HTMLInputElement;
  const look = lookPicker();
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
    opts.onNew(n, origin.value, look.value());
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
      h('label', h('span', '出身（只是背景设定，不加数值）'), origin),
      h('label', h('span', '外观（联机时别人看到的样子）'), look.el),
    ),
    h(
      'div.actions',
      h('button.btn' + (opts.existing ? '' : '.primary'), { onclick: start }, '在篝火旁醒来'),
      h('button.btn.ghost', { onclick: () => file.click() }, '导入存档'),
      file,
    ),
    opts.account ?? '',
    h('div.ver', `v${opts.version} · 第 1–2 区 · 请用电脑上的 Chrome 打开，开声音`),
  );
  clear(el).append(box);
  window.setTimeout(() => (opts.existing ? null : name.focus()), 50);
}

function confirmOverwrite(): boolean {
  // A plain confirm is fine here: it only guards an irreversible overwrite.
  return window.confirm('开始新角色会覆盖现在的存档。确定吗？（可以先在游戏里导出存档）');
}

/** Two small selects (性别 发色) with a live preview. 画风统一: 体型 and 发型 stay in the save but no longer change the figure. */
export function lookPicker(start: Look = DEFAULT_LOOK, onChange?: (l: Look) => void): { el: HTMLElement; value: () => Look } {
  const cur: Look = { ...start };
  const preview = h('span', { style: 'display:inline-block;width:64px;height:64px;vertical-align:middle;background:#1d0a0c' });
  const draw = () => preview.replaceChildren(heroIcon(cur, 4));
  const row = h('div.row', { style: 'gap:6px;align-items:center;flex-wrap:wrap' }, preview);
  (['gender', 'color'] as Array<keyof Look>).forEach((k) => {
    const sel = h('select', { title: LOOK_OPTIONS[k].zh }) as HTMLSelectElement;
    LOOK_OPTIONS[k].options.forEach((o, i) => sel.append(h('option', { value: i }, `${LOOK_OPTIONS[k].zh}：${o}`)));
    sel.value = String(cur[k]);
    sel.onchange = () => {
      (cur as unknown as Record<string, number>)[k] = Number(sel.value);
      draw();
      onChange?.({ ...cur });
    };
    row.append(sel);
  });
  draw();
  return { el: row, value: () => ({ ...cur }) };
}
