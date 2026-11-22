import { portrait } from './icons';
import { $, clear, h } from './dom';
import { logLine } from './gamelog';

export function toast(text: string, cls = '', lead?: HTMLElement): void {
  logLine(text, cls === 'gold' ? 'gold' : 'info');
  const box = $('toasts');
  const el = h(`div.toast.panel${cls ? '.' + cls : ''}`, lead ?? '', text);
  box.append(el);
  while (box.children.length > 5) box.firstElementChild?.remove();
  window.setTimeout(() => el.remove(), 3300);
}

let bannerTimer = 0;
export function banner(big: string, sub = ''): void {
  logLine(sub ? `【${big}】${sub}` : `【${big}】`, 'gold');
  const el = $('banner');
  clear(el).append(h('div.big', big), sub ? h('div.sub', sub) : '');
  el.hidden = false;
  el.style.animation = 'none';
  void el.offsetWidth;
  el.style.animation = '';
  window.clearTimeout(bannerTimer);
  bannerTimer = window.setTimeout(() => (el.hidden = true), 2700);
}

export function setPrompt(text: string | null): void {
  const el = $('prompt');
  if (!text) {
    el.hidden = true;
    return;
  }
  el.className = 'panel';
  el.innerHTML = text;
  el.hidden = false;
}

export interface Line {
  who: string;
  text: string;
}

let dialogQueue: Array<{ lines: Line[]; done?: () => void; choices?: Array<{ label: string; act: () => void }> }> = [];
let current: (typeof dialogQueue)[number] | null = null;
let idx = 0;

/** Show a sequence of lines. German in 「…」 is highlighted. Enter / Space / click to continue. */
export function say(lines: Line[], done?: () => void, choices?: Array<{ label: string; act: () => void }>): void {
  dialogQueue.push({ lines, done, choices });
  if (!current) next();
}

function next() {
  current = dialogQueue.shift() ?? null;
  idx = 0;
  if (!current) {
    $('dialog').hidden = true;
    return;
  }
  render();
}

function render() {
  const el = $('dialog');
  if (!current) return;
  const line = current.lines[idx];
  const last = idx === current.lines.length - 1;
  const text = h('div.text');
  text.innerHTML = line.text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/「([^」]+)」/g, '「<span class="de">$1</span>」');
  const row = h('div.row');
  if (last && current.choices?.length) {
    const ch = h('div.choices');
    current.choices.forEach((c, i) =>
      ch.append(
        h(
          'button.btn' + (i === 0 ? '.primary' : ''),
          {
            onclick: () => {
              const cur = current;
              next();
              c.act();
              void cur;
            },
          },
          c.label,
        ),
      ),
    );
    row.append(ch);
  } else row.append(h('span', `${idx + 1} / ${current.lines.length}`), h('button.btn.ghost', { onclick: advance }, last ? '好的' : '继续 ▸'));
  const face = portrait(line.who);
  clear(el).append(face ? h('div.speaker-row', face, h('div.speaker', line.who)) : h('div.speaker', line.who), text, row);
  el.className = 'panel';
  el.hidden = false;
}

export function advance(): void {
  if (!current) return;
  if (idx < current.lines.length - 1) {
    idx += 1;
    render();
    return;
  }
  if (current.choices?.length) return;
  const done = current.done;
  next();
  done?.();
}

export function dialogOpen(): boolean {
  return !!current;
}

export function dialogHasChoices(): boolean {
  return !!current && idx === current.lines.length - 1 && !!current.choices?.length;
}

export function resetDialogs(): void {
  dialogQueue = [];
  current = null;
  $('dialog').hidden = true;
}
