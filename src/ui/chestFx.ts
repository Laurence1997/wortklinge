// 开箱动画 (0.6.x 小修, docs 游戏设计「开宝箱动画」): chests only, pure presentation (rolls, rates and contents are
// decided before this plays). The chest is a Kenney Tiny Dungeon tile on the red ramp: it shakes, opens, glows in
// the best quality's colour and the items pop out one by one. With a right 言灵锁 each item shows its two rolls and
// keeps the better one. Any key or click jumps to the end. An orange flashes the whole screen in reds, not white.

import type { ChestKind, ChestResult } from '../core/chest';
import type { Item, Quality } from '../core/types';
import { icon, SLOT_TILE } from './icons';
import { h } from './dom';

const ORDER: Quality[] = ['white', 'green', 'purple', 'orange'];
const Q_ZH: Record<Quality, string> = { white: '普通', green: '优秀', purple: '史诗', orange: '传说' };
const Q_COLOR: Record<Quality, string> = { white: '#cfc6be', green: '#5fdc7f', purple: '#b07cff', orange: '#ff9a3a' };
/** Closed / open chest tiles (Tiny Dungeon 90 front closed, 91 open; same view so the lid visibly opens). */
const TILE: Record<ChestKind, [number, number]> = { wood: [90, 91], forgotten: [90, 91], iron: [90, 91], gold: [90, 91] };
/** Time per item (ms): wood about 1 s in all, iron about 2 s, gold about 3 s. */
const STEP: Record<ChestKind, number> = { wood: 200, forgotten: 200, iron: 650, gold: 750 };

export interface ChestShow {
  kind: ChestKind;
  title: string;
  result: Pick<ChestResult, 'items' | 'gold' | 'rolls' | 'bagFull'>;
}

let active: (() => void) | null = null;

/** Plays the animation in a full-screen overlay; `done` runs once it is dismissed. */
export function playChest(c: ChestShow, done: () => void, sfx: { open: () => void; item: (q: Quality) => void }): void {
  active?.();
  const best = c.result.items.reduce<Quality>((b, it) => (ORDER.indexOf(it.quality) > ORDER.indexOf(b) ? it.quality : b), 'white');
  const [closedT, openT] = TILE[c.kind];
  const box = h('div.cfx-box');
  const closed = icon(closedT, 6, false, 'cfx-chest');
  const open = icon(openT, 6, false, 'cfx-chest');
  open.style.display = 'none';
  const glow = h('div.cfx-glow', { style: `--q:${Q_COLOR[best]}` });
  box.append(glow, closed, open);
  const list = h('div.cfx-items');
  const hint = h('div.cfx-hint', '任意键跳过');
  const panel = h('div.cfx-panel', h('div.cfx-title', c.title), box, list, hint);
  const flash = h('div.cfx-flash');
  const root = h('div#chest-fx', flash, panel);
  document.body.append(root);

  const timers: number[] = [];
  const at = (ms: number, f: () => void) => timers.push(window.setTimeout(f, ms));
  let finished = false;
  const shown = new Set<number>();

  const card = (it: Item, i: number, animate: boolean) => {
    const rolls = c.result.rolls[i] ?? [it.quality];
    const row = h(`div.cfx-item${animate ? '.pop' : ''}`);
    if (rolls.length > 1) {
      // 言灵锁 written right: both rolls side by side, the better one stays lit.
      const keep = ORDER.indexOf(rolls[1]) > ORDER.indexOf(rolls[0]) ? 1 : 0;
      const pair = h('div.cfx-pair');
      rolls.forEach((q, k) => pair.append(h(`span.cfx-roll${k === keep ? '.keep' : '.drop'}${animate ? '.flip' : ''}`, { style: `--q:${Q_COLOR[q]};animation-delay:${k * 160}ms` }, Q_ZH[q])));
      row.append(pair);
    }
    row.append(icon(SLOT_TILE[it.slot], 2, false, `slot-icon q-${it.quality}`), h(`span.item-name.${it.quality}`, it.name), h('span.small.muted', ` ${Q_ZH[it.quality]}`));
    return row;
  };

  const showItem = (i: number, animate: boolean) => {
    if (shown.has(i)) return;
    shown.add(i);
    const it = c.result.items[i];
    list.append(card(it, i, animate));
    if (animate) sfx.item(it.quality);
    if (it.quality === 'orange') {
      flash.classList.remove('on');
      void flash.offsetWidth;
      flash.classList.add('on');
    }
  };

  const tail = () => {
    if (c.result.gold) list.append(h('div.cfx-item.small', `${c.result.gold} 金币`));
    if (c.result.bagFull) list.append(h('div.cfx-item.small.muted', `背包满了，${c.result.bagFull} 件没装下`));
    if (!c.result.items.length && !c.result.gold && !c.result.bagFull) list.append(h('div.cfx-item.small.muted', '空的'));
  };

  const openUp = (animate: boolean) => {
    closed.style.display = 'none';
    open.style.display = '';
    box.classList.remove('shake');
    glow.classList.add('on');
    if (animate) sfx.open();
  };

  const finish = () => {
    if (finished) return close();
    finished = true;
    timers.splice(0).forEach(clearTimeout);
    openUp(false);
    c.result.items.forEach((_, i) => showItem(i, false));
    tail();
    hint.textContent = '任意键收下';
    // Chests put themselves away (wood and forgotten come mid-grind; iron and gold leave their panel with the details).
    at(c.kind === 'wood' || c.kind === 'forgotten' ? 900 : 1600, close);
  };

  const close = () => {
    timers.splice(0).forEach(clearTimeout);
    window.removeEventListener('keydown', onKey, true);
    root.remove();
    if (active === stop) active = null;
    done();
  };
  const stop = () => close();
  const onKey = (e: KeyboardEvent) => {
    e.preventDefault();
    e.stopPropagation();
    finish();
  };
  window.addEventListener('keydown', onKey, true);
  root.addEventListener('click', () => finish());
  active = stop;

  box.classList.add('shake');
  at(320, () => openUp(true));
  const step = STEP[c.kind];
  c.result.items.forEach((_, i) => at(420 + i * step, () => showItem(i, true)));
  at(420 + Math.max(1, c.result.items.length) * step, () => {
    if (!finished) finish();
  });
}
