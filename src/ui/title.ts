import { applyTheme } from './theme';
import { CONFIG } from '../core/config';
import { LATER_BOSS } from '../data/bossesLater';
import { heroIcon } from './icons';
import { DEFAULT_LOOK, HAIR_COLORS, LOOK_OPTIONS, type Look } from '../core/look';
import type { GameState } from '../core/state';
import { $, clear, h } from './dom';

export const ORIGINS: Array<[string, string]> = [
  ['student', '留学生'],
  ['cook', '厨师'],
  ['engineer', '工程师'],
  ['nurse', '护士'],
  ['programmer', '程序员'],
];

/** 出身 (游戏设计 十二, Lucas 2026-11-25): no stats, only the topics you meet more often. Shown on the creation cards. */
export const ORIGIN_INFO: Record<string, { topics: string; de: [string, string] }> = {
  student: { topics: '选课、宿舍、考试、打工', de: ['Ich studiere hier.', 'Ich studiere hier.'] },
  cook: { topics: '厨房、食材、排班、客人', de: ['Ich bin Koch.', 'Ich bin Köchin.'] },
  engineer: { topics: '项目、工地、开会、出差', de: ['Ich bin Ingenieur.', 'Ich bin Ingenieurin.'] },
  nurse: { topics: '值班、病人、休假、医院', de: ['Ich bin Pfleger.', 'Ich bin Pflegerin.'] },
  programmer: { topics: '求职、面试、远程、同事', de: ['Ich bin Programmierer.', 'Ich bin Programmiererin.'] },
};

/** 出身 cards: one pick, with the topics it brings and a line the hero could say. */
export function originPicker(start: string, gender: () => number, onChange?: (v: string) => void): { el: HTMLElement; value: () => string; refresh: () => void } {
  let cur = ORIGINS.some(([v]) => v === start) ? start : 'student';
  const cards = ORIGINS.map(([v, zh]) => {
    const info = ORIGIN_INFO[v];
    const de = h('span.de');
    const b = h('button.origin-card', { type: 'button', onclick: () => pick(v) }, h('b', zh), h('span.topics', info?.topics ?? ''), de) as HTMLButtonElement;
    return { v, b, de };
  });
  const refresh = () => {
    for (const c of cards) {
      c.b.classList.toggle('on', c.v === cur);
      c.de.textContent = `„${ORIGIN_INFO[c.v]?.de[gender() === 1 ? 1 : 0] ?? ''}“`;
    }
  };
  const pick = (v: string) => {
    cur = v;
    refresh();
    onChange?.(v);
  };
  refresh();
  return { el: h('div.origin-cards', ...cards.map((c) => c.b)), value: () => cur, refresh };
}

export function showTitle(opts: {
  account?: HTMLElement;
  existing: GameState | null;
  onContinue: () => void;
  onNew: (name: string, origin: string, look: Look) => void;
  onImport: (text: string) => void;
  version: string;
  /** Logged in, but the cloud save could not be read (offline / timeout): never offer a fresh start up front. */
  cloudFailed?: boolean;
  onRetry?: () => void;
}): void {
  const el = $('title');
  el.hidden = false;
  applyTheme(true, 1); // 标题页跟日常区一样明亮 (Lucas 11-26)
  const name = h('input', { type: 'text', maxlength: 16, placeholder: '比如 Lucas', autocomplete: 'off' }) as HTMLInputElement;
  const preview = h('div.hero-preview');
  const card = h('div.hero-card', preview, h('div.hero-name', '……'), h('div.hero-origin'));
  const drawCard = () => {
    preview.replaceChildren(heroIcon(look.value(), 8));
    (card.querySelector('.hero-name') as HTMLElement).textContent = name.value.trim() || 'Lucas';
    const o = ORIGINS.find(([v]) => v === origin.value())?.[1] ?? '';
    (card.querySelector('.hero-origin') as HTMLElement).textContent = `${o} · ${ORIGIN_INFO[origin.value()]?.de[look.value().gender === 1 ? 1 : 0] ?? ''}`;
  };
  const look = lookSwatches(DEFAULT_LOOK, () => {
    origin.refresh();
    drawCard();
  });
  const origin = originPicker('student', () => look.value().gender, () => drawCard());
  name.addEventListener('input', () => drawCard());
  const file = h('input', { type: 'file', accept: '.json,application/json', hidden: true }) as HTMLInputElement;
  file.onchange = async () => {
    const f = file.files?.[0];
    if (f) opts.onImport(await f.text());
  };
  const start = () => {
    const n = name.value.trim() || 'Lucas';
    if (opts.existing && !confirmOverwrite()) return;
    el.hidden = true;
    opts.onNew(n, origin.value(), look.value());
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
      '面包长出牙齿，街牌在低语，幸存者只能发出含混的声音。',
      h('br'),
      '你在篝火旁醒来。叫对一个名字，它就会变回原样。',
    ),
  );
  // An existing character (or a cloud save we could not reach) takes the centre; creating a new one is folded away.
  const form = h('div');
  const folded = !!opts.existing || !!opts.cloudFailed;
  form.hidden = folded;
  box.classList.toggle('wide', !folded);
  if (opts.existing) {
    // 6000 词导入 (the one save reset): say so here, before anything else, so a level-1 character is no surprise.
    if (opts.existing.flags?.reset6000) box.append(h('p.small', { style: 'color:var(--gold, #ffcf4a)' }, '这一版换成了 6000 词的新词表，旧存档按之前的通知清空了：角色名和账号保留，从 1 级重新开始（旧存档的备份留在这个浏览器里）。'));
    box.append(
      h(
        'div.actions',
        h('button.btn.primary', { onclick: () => { el.hidden = true; opts.onContinue(); } }, `继续：${opts.existing.name} · Lv ${opts.existing.level}`),
      ),
    );
  } else if (opts.cloudFailed) {
    box.append(
      h('p', '连不上云存档，现在读不到你的角色。请检查网络后重试；先别新建角色，以免盖掉云端的存档。'),
      h('div.actions', h('button.btn.primary', { onclick: () => opts.onRetry?.() }, '重试')),
    );
  }
  if (folded) {
    const unfold = h('button.btn.ghost.small', { style: 'margin-top:18px' }, opts.existing ? '开始一个新角色（会覆盖当前存档）' : '我确定没有角色，新建一个') as HTMLButtonElement;
    const open = () => {
      unfold.remove();
      form.hidden = false;
      box.classList.add('wide');
      name.focus();
    };
    // Lucas 11-26: a new character overwrites the save, so with a save present you first type its name to confirm.
    unfold.onclick = () => {
      const ex = opts.existing;
      if (!ex) return open();
      const typed = h('input', { type: 'text', autocomplete: 'off', spellcheck: 'false', placeholder: ex.name }) as HTMLInputElement;
      const go = h('button.btn.primary', { disabled: true }, '确认，新建角色') as HTMLButtonElement;
      const check = () => (go.disabled = typed.value.trim() !== ex.name.trim());
      typed.addEventListener('input', check);
      typed.addEventListener('keydown', (e) => e.key === 'Enter' && !go.disabled && go.click());
      go.onclick = () => {
        confirmBox.remove();
        open();
      };
      const back = h('button.btn', { onclick: () => (confirmBox.remove(), box.append(h('div', unfold))) }, '算了');
      const confirmBox = h(
        'div.panel.confirm-new',
        h('p', `新角色会覆盖「${ex.name} · Lv ${ex.level}」的存档，进度找不回来。`),
        h('p.small.muted', `确定的话，输入现在的角色名「${ex.name}」：`),
        typed,
        h('div.row', { style: 'justify-content:center' }, back, go),
      );
      unfold.parentElement?.replaceWith(confirmBox);
      typed.focus();
    };
    box.append(h('div', unfold));
  }
  box.append(form);
  form.append(
    h(
      'div.create.panel',
      card,
      h(
        'div.create-steps',
        h('label', h('span.step', h('i', '1'), '名字', h('small', '首领会问你「Wie heißt du?」')), name),
        h('div', h('span.step', h('i', '2'), '外观', h('small', '性别和发色')), look.el),
        h('div', h('span.step', h('i', '3'), '出身', h('small', '不加数值，只决定你常遇到的话题；在篝火旁可以免费改')), origin.el),
      ),
    ),
    h(
      'div.actions',
      h('button.btn' + (opts.existing ? '' : '.primary'), { onclick: start }, '在篝火旁醒来'),
      h('button.btn.ghost', { onclick: () => file.click() }, '导入存档'),
      file,
    ),
  );
  box.append(
    opts.account ?? '',
    h('div.ver', `v${opts.version} · 第 1–${releasedRegions()} 区（1–${CONFIG.releaseCap} 级） · 请用电脑上的 Chrome 打开，开声音`),
  );
  clear(el).append(box);
  drawCard();
  window.setTimeout(() => (folded ? null : name.focus()), 50);
}

/** 性别 as two toggles and 发色 as swatches (the creation screen); the bonfire keeps the compact lookPicker. */
function lookSwatches(start: Look, onChange: (l: Look) => void): { el: HTMLElement; value: () => Look } {
  const cur: Look = { ...start };
  const genders = LOOK_OPTIONS.gender.options.map((o, i) => h('button.btn.small.seg', { type: 'button', onclick: () => set('gender', i) }, o) as HTMLButtonElement);
  const colors = HAIR_COLORS.map((c, i) => h('button.swatch', { type: 'button', title: `发色：${LOOK_OPTIONS.color.options[i]}`, style: `background:${c}`, onclick: () => set('color', i) }) as HTMLButtonElement);
  const mark = () => {
    genders.forEach((b, i) => b.classList.toggle('on', cur.gender === i));
    colors.forEach((b, i) => b.classList.toggle('on', cur.color === i));
  };
  const set = (k: 'gender' | 'color', i: number) => {
    (cur as unknown as Record<string, number>)[k] = i;
    mark();
    onChange({ ...cur });
  };
  mark();
  return { el: h('div.look-row', h('div.segs', ...genders), h('div.swatches', ...colors)), value: () => ({ ...cur }) };
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

/** Regions open in this release: every region whose boss level is within the release cap (read from the data, so the
 *  title footer follows the cap instead of being written by hand). */
function releasedRegions(): number {
  return Math.max(3, ...Object.values(LATER_BOSS).filter((b) => b && b.level <= CONFIG.releaseCap).map((b) => b!.region));
}
