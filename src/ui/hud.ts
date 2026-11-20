import { CONFIG, xpToNext } from '../core/config';
import { comboTier } from '../core/combat';
import { progressSummary } from '../core/srs';
import { maxHp, type GameState } from '../core/state';
import { WORDS } from '../data/words';
import { zoneAt } from '../game/map';
import { $, bar, clear, h } from './dom';

export function renderHud(s: GameState): void {
  const el = $('hud');
  el.className = 'panel';
  const p = progressSummary(s, WORDS);
  const zone = zoneAt(s.pos.x, s.pos.y, s.region ?? 1);
  const tier = comboTier(s.combo);
  const capped = s.level >= CONFIG.levelCap && s.xp >= xpToNext(s.level);
  clear(el).append(
    h('div.name', h('span', s.name), h('span', `Lv ${s.level}`)),
    bar('hp', s.hp, maxHp(s), `生命 ${s.hp} / ${maxHp(s)}`),
    bar('xp', s.xp, xpToNext(s.level), capped ? '经验已满：第 2 区下一版开放' : `经验 ${s.xp} / ${xpToNext(s.level)}`),
    h(
      'div.hud-row',
      h('span', '金币 ', h('b.gold', String(s.gold))),
      h('span', '连击 ', h('b.combo', String(s.combo)), tier ? h('span.combo', ` ${tier.split(' ')[0]}`) : ''),
    ),
    h(
      'div.hud-row',
      h('span', '今日新词 ', h('b', String(s.daily.newCount))),
      h('span', '待复习 ', h('b', String(p.due))),
      h('span', '归名 ', h('b', String(p.guiming))),
    ),
    h('div.hud-row', h('span', zone ? `${zone.zh} · ${zone.levels}` : '浓雾边缘'), s.echo ? h('span.gold', '回响未取回') : ''),
  );
}
