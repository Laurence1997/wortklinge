import { xpToNext } from '../core/config';
import { capAdvice, levelCapFor } from '../core/stages';
import { comboTier } from '../core/combat';
import { progressSummary } from '../core/srs';
import { maxHp, type GameState } from '../core/state';
import { WORDS } from '../data/words';
import { zoneAt } from '../game/map';
import { $, bar, clear, h } from './dom';
import { heroIcon } from './icons';
import { DEFAULT_LOOK } from '../core/look';

export function renderHud(s: GameState): void {
  const el = $('hud');
  el.className = 'panel';
  const p = progressSummary(s, WORDS);
  const zone = zoneAt(s.pos.x, s.pos.y, s.region ?? 1);
  const tier = comboTier(s.combo);
  const capped = s.level >= levelCapFor(s.flags) && s.xp >= xpToNext(s.level);
  // 1.0.11 试玩: at 30 / 80 / 120 / 160 the bar says which trial opens the cap.
  const capTip = capped ? capAdvice(s.level, s.flags) : null;
  clear(el).append(
    h('div.name', heroIcon(s.look ?? DEFAULT_LOOK, 2), h('span.nm', s.name), h('span', `Lv ${s.level}`)),
    // 状态框 (Lucas 11-26: 血条里的数字看不清): taller bars, white numbers with a dark edge, label left and
    // numbers right; the counters sit in a 3-column grid with the number above its name.
    bar('hp', s.hp, maxHp(s), '生命', `${s.hp} / ${maxHp(s)}`),
    bar('xp', s.xp, xpToNext(s.level), capped ? (capTip ? `经验已满：${capTip.replace('去主城', '')}` : '经验已满：等级到当前上限') : '经验', capped ? '' : `${s.xp} / ${xpToNext(s.level)}`),
    h(
      'div.hud-stats',
      h('div', h('b.gold', String(s.gold)), h('span', '金币')),
      h('div', h('b.combo', String(s.combo), tier ? ` ${tier.split(' ')[0]}` : ''), h('span', '连击')),
      h('div', h('b', String(p.guiming)), h('span', '归名')),
      h('div', h('b', String(s.daily.newCount)), h('span', '今日新词')),
      h('div', h('b', String(p.due)), h('span', '待复习')),
    ),
    h('div.hud-zone', h('span', zone ? `${zone.zh} · ${zone.levels}` : '浓雾边缘'), s.echo ? h('span.gold', '回响未取回') : ''),
  );
}
