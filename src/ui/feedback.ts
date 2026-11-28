import { portrait } from './icons';
import { $, clear, h } from './dom';
import { logLine } from './gamelog';

export function toast(text: string, cls = '', lead?: HTMLElement): void {
  logLine(text, cls === 'gold' ? 'gold' : 'info');
  showToast(text, cls, lead);
}

/** 1.0.12 panel: a passing "waiting for the AI" note. Shown like a toast but kept out of the 记录 box, where a bare
 *  「……」 used to pile up as unreadable rows. */
export function waitToast(text: string): void {
  showToast(text, '');
}

function showToast(text: string, cls: string, lead?: HTMLElement): void {
  const box = $('toasts');
  const el = h(`div.toast.panel${cls ? '.' + cls : ''}`, lead ?? '', text);
  box.append(el);
  while (box.children.length > 5) box.firstElementChild?.remove();
  window.setTimeout(() => el.remove(), Math.max(3300, text.length * 110)); // long notes stay long enough to read
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

/** `disabled` (试玩 95): shown greyed out and not clickable, so a choice that can't be taken yet still says why. */
export type Choice = { label: string; act: () => void; disabled?: boolean };
let dialogQueue: Array<{ lines: Line[]; done?: () => void; choices?: Choice[] }> = [];
let current: (typeof dialogQueue)[number] | null = null;
let idx = 0;

/** Show a sequence of lines. German in 「…」 is highlighted. Enter / Space / click to continue. */
export function say(lines: Line[], done?: () => void, choices?: Choice[]): void {
  if (!lines.length) return void done?.(); // 审核 1.0.10: an empty dialog would never close and freeze input
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
  // 「系统：…」 narration in story data shows under 系统 once, not as 系统 / 系统：… or a boss name / 系统：… (试玩 79).
  const raw = current.lines[idx];
  const line = /^系统[：:]/.test(raw.text ?? '') ? { who: '系统', text: raw.text.replace(/^系统[：:]\s*/, '') } : raw;
  const last = idx === current.lines.length - 1;
  const text = h('div.text');
  text.innerHTML = (line.text ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/「([^」]+)」/g, '「<span class="de">$1</span>」');
  const row = h('div.row');
  if (last && current.choices?.length) {
    const ch = h('div.choices');
    current.choices.forEach((c, i) =>
      ch.append(
        h(
          'button.btn' + (i === 0 && !c.disabled ? '.primary' : ''),
          {
            disabled: !!c.disabled,
            onclick: () => {
              if (c.disabled) return;
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
