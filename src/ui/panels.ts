import { CONFIG, xpToNext } from '../core/config';
import { AFFIX_ZH, itemScore, mainStatText, QUALITY_ZH, requiredLevel, SLOT_ZH } from '../core/loot';
import { kindOf, progressSummary, stageOf, STAGE_ZH } from '../core/srs';
import { attack, critChance, dayKey, hintsPerFight, maxHp, now } from '../core/state';
import type { Item, Slot } from '../core/types';
import { has } from '../core/unlocks';
import { FAMILIES } from '../data/families';
import { SKILLS } from '../data/skills';
import { fullForm, genderOf, WORDS } from '../data/words';
import type { Controller } from '../game/controller';
import { $, clear, h } from './dom';

export type PanelName = 'hero' | 'codex' | 'data' | 'settings' | 'help';

export class Panels {
  open: PanelName | null = null;
  private codexFilter: string = 'all';

  constructor(private ctrl: Controller) {}

  show(name: PanelName): void {
    this.open = name;
    this.render();
    $('modal').hidden = false;
  }

  close(): void {
    this.open = null;
    $('modal').hidden = true;
    this.ctrl.persist();
  }

  toggle(name: PanelName): void {
    if (this.open === name) this.close();
    else this.show(name);
  }

  render(): void {
    if (!this.open) return;
    const el = $('modal');
    const panel = h('div.panel');
    const titles: Record<PanelName, string> = { hero: '角色与装备', codex: '图鉴', data: '数据与存档', settings: '设置', help: '怎么玩' };
    const tabs = h('div.tabs');
    (Object.keys(titles) as PanelName[]).forEach((k) =>
      tabs.append(h(`button.btn${this.open === k ? '.on' : ''}`, { onclick: () => this.show(k) }, titles[k])),
    );
    panel.append(h('h2', h('span', titles[this.open]), h('button.btn.ghost', { onclick: () => this.close() }, '关闭 Esc')), tabs);
    const body = { hero: () => this.hero(), codex: () => this.codex(), data: () => this.data(), settings: () => this.settings(), help: () => this.help() }[this.open]();
    panel.append(body);
    clear(el).append(panel);
    el.onclick = (e) => {
      if (e.target === el) this.close();
    };
  }

  // ---- Hero & gear -----------------------------------------------------------

  private hero(): HTMLElement {
    const s = this.ctrl.state;
    const left = h('div');
    const stats: Array<[string, string]> = [
      ['等级', `${s.level}（经验 ${s.xp} / ${xpToNext(s.level)}）`],
      ['生命', `${s.hp} / ${maxHp(s)}`],
      ['攻击', String(attack(s))],
      ['暴击率', `${(critChance(s) * 100).toFixed(1)}%`],
      ['每场提示', String(hintsPerFight(s))],
      ['金币', String(s.gold)],
      ['最高连击', String(s.bestCombo)],
      ['击杀 / 死亡', `${s.stats.kills} / ${s.stats.deaths}`],
    ];
    for (const [k, v] of stats) left.append(h('div.stat', h('span', k), h('b', v)));
    if (s.skills.length) {
      left.append(h('h3', '句子技能'));
      for (const id of s.skills) {
        const sk = SKILLS[id];
        left.append(h('div.slot', h('div.k', sk.zh), h('div', h('div', { style: 'font-family:var(--mono)' }, sk.de), h('div.small.muted', sk.effect))));
      }
    }

    const right = h('div');
    if (!has(s.level, 'gear')) {
      right.append(h('p.muted', '5 级开放装备。'));
      return h('div.grid2', left, right);
    }
    right.append(h('h3', { style: 'margin-top:0' }, '已装备'));
    for (const slot of ['pen', 'coat', 'amulet', 'dict'] as Slot[]) {
      const it = s.equipped[slot];
      right.append(
        h(
          'div.slot',
          h('div.k', SLOT_ZH[slot]),
          it ? this.itemBody(it) : h('div.muted.small', '空'),
          it ? h('button.btn.small', { onclick: () => this.ctrl.unequip(slot) }, '卸下') : '',
        ),
      );
    }
    right.append(h('h3', `背包（${s.bag.length} / ${CONFIG.loot.bagSize}）`));
    const bag = h('div.bag');
    const sorted = s.bag.slice().sort((a, b) => itemScore(b) - itemScore(a));
    for (const it of sorted) {
      const cur = s.equipped[it.slot];
      const diff = cur ? itemScore(it) - itemScore(cur) : 1;
      const tooHigh = requiredLevel(it) > s.level;
      bag.append(
        h(
          `div.item.${it.quality}`,
          h('div', this.itemBody(it), diff > 0 ? h('div.better', '▲ 比身上的好') : diff < 0 ? h('div.worse', '▼ 不如身上的') : ''),
          h(
            'div.acts',
            h('button.btn', { disabled: tooHigh, title: tooHigh ? `需要 ${requiredLevel(it)} 级` : '', onclick: () => this.ctrl.equip(it.id) }, '穿上'),
            h('button.btn.ghost', { onclick: () => this.ctrl.discard(it.id) }, '丢弃'),
          ),
        ),
      );
    }
    if (!s.bag.length) bag.append(h('p.muted.small', '空。小怪有 20% 的概率掉装备，用默写和句子打、打到期的怪，好东西更多。'));
    right.append(bag);
    if (s.bag.length) right.append(h('p.small.muted', '商店和分解成字母在第 2 区开放，现在只能丢弃。'));
    return h('div.grid2', left, right);
  }

  private itemBody(it: Item): HTMLElement {
    return h(
      'div',
      { style: 'flex:1' },
      h(`div.item-name.${it.quality}`, `${it.name}`, h('span.small.muted', `  ${QUALITY_ZH[it.quality]} · ${SLOT_ZH[it.slot]} · 物品等级 ${it.ilvl}`)),
      h('div.small', mainStatText(it)),
      ...it.affixes.map((a) => h('div.aff', AFFIX_ZH[a.key](a.value))),
      it.legendary ? h('div.aff', { style: 'color:var(--q-orange)' }, '传说：冠词审判——答对一道冠词题后，下一击伤害翻倍') : '',
    );
  }

  // ---- Codex -------------------------------------------------------------------

  private codex(): HTMLElement {
    const s = this.ctrl.state;
    const wrap = h('div');
    const p = progressSummary(s, WORDS);
    wrap.append(
      h('p.small.muted', `共 ${WORDS.length} 个词：无名 ${p.new} · 裂形 ${p.cracked} · 半名 ${p.half} · 归名 ${p.guiming}。今天到期 ${p.due} 个。打熟了，它们才会变回原样。`),
    );
    const filters = h('div.tabs');
    const fams = [['all', '全部'], ...Object.values(FAMILIES).map((f) => [f.id, f.zh])];
    for (const [id, zh] of fams)
      filters.append(h(`button.btn${this.codexFilter === id ? '.on' : ''}`, { onclick: () => { this.codexFilter = id; this.render(); } }, zh));
    wrap.append(filters);
    const grid = h('div.codex');
    const t = now(s);
    for (const w of WORDS) {
      if (this.codexFilter !== 'all' && w.family !== this.codexFilter) continue;
      const st = stageOf(s, w, t);
      const seen = st > 0;
      const gg = genderOf(w);
      const g = gg ? { m: 'der', f: 'die', n: 'das', pl: 'pl' }[gg] : null;
      const due = seen && kindOf(s, w, t) === 'due';
      grid.append(
        h(
          `div.card${seen ? '' : '.unseen'}`,
          h('span.st', `${STAGE_ZH[st]}${due ? ' · 到期' : ''}`),
          h('div.w', seen && g ? h(`span.art-mark.${g}`) : '', h(`span${seen && g ? '.art-' + g : ''}`, seen ? fullForm(w) : '？？？')),
          h('div.z', seen ? w.zh : FAMILIES[w.family].zh),
          seen && w.pl && w.pl !== '-' && st >= 2 ? h('div.small.muted', `复数 die ${w.pl}`) : '',
        ),
      );
    }
    wrap.append(grid);
    return wrap;
  }

  // ---- Data & saves --------------------------------------------------------------

  private data(): HTMLElement {
    const s = this.ctrl.state;
    const wrap = h('div');
    wrap.append(h('p.small.muted', '0.3 没有服务器：存档只在这个浏览器里。换电脑或清理浏览器前请先导出。试玩时请每周把导出的文件发给开发者：里面只有游戏记录（每天玩了多久、学了几个词）和你起的角色名。'));
    const table = h('table.log');
    table.append(h('tr', h('th', '日期'), h('th', '分钟'), h('th', '击杀'), h('th', '答对'), h('th', '答错'), h('th', '新词'), h('th', '归名')));
    const days = Object.keys(s.log).sort().reverse();
    for (const d of days) {
      const l = s.log[d];
      table.append(h('tr', h('td', d === dayKey(now(s)) ? `${d}（今天）` : d), h('td', l.minutes), h('td', l.kills), h('td', l.correct), h('td', l.wrong), h('td', l.newWords), h('td', l.guiming)));
    }
    if (!days.length) table.append(h('tr', h('td', { colspan: 7 }, '还没有记录。')));
    wrap.append(table);
    const file = h('input', { type: 'file', accept: '.json,application/json', hidden: true }) as HTMLInputElement;
    file.onchange = async () => {
      const f = file.files?.[0];
      if (f) this.ctrl.importSave(await f.text());
    };
    wrap.append(
      h('h3', '存档'),
      h(
        'div.row',
        h('button.btn.primary', { onclick: () => this.ctrl.exportSave() }, '导出存档'),
        h('button.btn', { onclick: () => file.click() }, '导入存档'),
        file,
        h('button.btn.ghost', { onclick: () => this.ctrl.resetSave() }, '删除存档，重新开始'),
      ),
    );
    return wrap;
  }

  // ---- Settings -----------------------------------------------------------------

  private settings(): HTMLElement {
    const s = this.ctrl.state;
    const wrap = h('div');
    const toggle = (label: string, key: 'tts' | 'autoZh', note: string) => {
      const cb = h('input', { type: 'checkbox' }) as HTMLInputElement;
      cb.checked = s.settings[key];
      cb.onchange = () => {
        s.settings[key] = cb.checked;
        this.ctrl.persist();
      };
      return h('label.toggle', cb, h('span', label), h('span.small.muted', note));
    };
    const slider = (label: string, key: 'music' | 'sfx') => {
      const r = h('input', { type: 'range', min: 0, max: 1, step: 0.05 }) as HTMLInputElement;
      r.value = String(s.settings[key]);
      r.oninput = () => {
        s.settings[key] = Number(r.value);
        this.ctrl.applyVolumes();
      };
      return h('label.toggle', h('span', { style: 'width:60px' }, label), r);
    };
    wrap.append(
      toggle('朗读怪物的台词', 'tts', this.ctrl.voiceNote()),
      toggle('自动显示台词的中文', 'autoZh', '关掉更有挑战：读懂德语就是你的情报（1–3 级总是显示）'),
      slider('音乐', 'music'),
      slider('音效', 'sfx'),
    );
    return wrap;
  }

  private help(): HTMLElement {
    const s = this.ctrl.state;
    const rows: Array<[string, string]> = [
      ['移动', 'WASD / 方向键，或者鼠标点地面'],
      ['互动', 'E（篝火、守火人、路牌、门）'],
      ['面板', 'C 角色和装备 · B 图鉴 · Esc 关闭'],
      ['战斗', 'A 攻击 · S 格挡 · D 破防 · F 句式 · R 技能；1/2/3 选答案；Enter 出招和继续；Z 看中文；V 再听'],
      ['变音字母', '点 ä ö ü ß 按钮，或者写 ae oe ue ss（算对，但会提示正确拼法）'],
      ['归名', '一个词就是一只怪。打败它 3 次（3 次不同的重生，隔天才会重生），最后一下要默写带冠词的全名，它才变回原样'],
      ['遗忘之物', '头上有「!」的怪是今天到期的词，经验和掉落更多。篝火休息会刷新所有怪'],
      ['影子', '半透明的怪是还没到期的词：给金币和经验，但不推进归名'],
      ['死亡', '学习进度永远不丢。金币和这一级的经验留在杀死你的那个词上（回响），回去打败它就能捡回'],
    ];
    const wrap = h('div');
    for (const [k, v] of rows) wrap.append(h('div.stat', h('span', { style: 'width:90px;flex:none' }, k), h('span', { style: 'text-align:right' }, v)));
    wrap.append(h('p.small.muted', `0.3 第一周：第 1 区余烬营地（1–10 级）。当前 ${s.level} 级，等级上限 ${CONFIG.levelCap}。`));
    return wrap;
  }
}
