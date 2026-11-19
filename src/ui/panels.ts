import { CONFIG, xpToNext } from '../core/config';
import { AFFIX_ZH, itemScore, mainStatText, QUALITY_ZH, requiredLevel, SLOT_ZH } from '../core/loot';
import { kindOf, progressSummary, stageOf, STAGE_ZH } from '../core/srs';
import { attack, critChance, dayKey, hintsPerFight, maxHp, now } from '../core/state';
import type { AffixKey, Item, Slot, Word } from '../core/types';
import { has } from '../core/unlocks';
import { FAMILIES } from '../data/families';
import { SKILLS } from '../data/skills';
import { canLearn, CLASSES, learn, rank, spent, talentPoints, TALENT_FROM_LEVEL, TALENTS, TIER_GATE } from '../core/classes';
import { fullForm, genderOf, hasArticleQuestion, WORDS } from '../data/words';
import type { Controller } from '../game/controller';
import { $, clear, h, umlautButtons } from './dom';
import { CHEST_ZH, type ChestKind } from '../core/chest';
import { favour, FAVOUR, QUESTS, type QuestId } from '../core/quests';
import { gradeTyped } from '../core/grading';
import { recordAnswer } from '../core/srs';
import { BARGAIN_LINES, ensureShop, price, refreshCost, sellPrice, SLOT_NOUN } from '../core/shop';

export type PanelName = 'hero' | 'talents' | 'quests' | 'codex' | 'data' | 'settings' | 'help' | 'shop' | 'chest' | 'quiz';

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
    const wasChest = this.open === 'chest';
    if (this.open === 'quiz' && this.quiz) {
      const q = this.quiz;
      this.quiz = null;
      if (!q.queue.length) window.setTimeout(() => q.onDone(), 0);
    }
    if (wasChest && this.chest && !this.chest.result) {
      // Closing an unopened chest opens it without the lock bonus.
      this.chest.result = this.ctrl.openLockedChest(this.chest.kind, this.chest.ilvl, this.chest.word, null);
    }
    this.chest = null;
    this.open = null;
    $('modal').hidden = true;
    this.ctrl.persist();
    if (wasChest) this.ctrl.chestClosed();
  }

  toggle(name: PanelName): void {
    if (this.open === name) this.close();
    else this.show(name);
  }

  render(): void {
    if (!this.open) return;
    const el = $('modal');
    const panel = h('div.panel');
    if (this.open === 'chest' && this.chest) {
      panel.append(h('h2', h('span', CHEST_ZH[this.chest.kind]), h('button.btn.ghost', { onclick: () => this.close() }, this.chest.result ? '收下 Esc' : '直接打开 Esc')), this.chestBody());
      clear(el).append(panel);
      el.onclick = null;
      window.setTimeout(() => (el.querySelector('input.lock') as HTMLInputElement | null)?.focus(), 0);
      return;
    }
    if (this.open === 'quiz' && this.quiz) {
      panel.append(h('h2', h('span', this.quiz.title), h('button.btn.ghost', { onclick: () => this.close() }, this.quiz.queue.length ? '先不教 Esc' : '完成 Esc')), this.quizBody());
      clear(el).append(panel);
      el.onclick = null;
      window.setTimeout(() => (el.querySelector('input.quiz') as HTMLInputElement | null)?.focus(), 0);
      return;
    }
    if (this.open === 'shop') {
      panel.append(h('h2', h('span', '商人 Mira 的摊子'), h('button.btn.ghost', { onclick: () => this.close() }, '离开 Esc')), this.shop());
      clear(el).append(panel);
      el.onclick = (e) => {
        if (e.target === el) this.close();
      };
      if (this.buying !== null) window.setTimeout(() => (el.querySelector('input.buy-line') as HTMLInputElement | null)?.focus(), 0);
      return;
    }
    const titles: Record<Exclude<PanelName, 'shop' | 'chest' | 'quiz'>, string> = { hero: '角色与装备', talents: '职业与天赋', quests: '任务', codex: '图鉴', data: '数据与存档', settings: '设置', help: '怎么玩' };
    const tabs = h('div.tabs');
    (Object.keys(titles) as Array<Exclude<PanelName, 'shop' | 'chest' | 'quiz'>>).forEach((k) =>
      tabs.append(h(`button.btn${this.open === k ? '.on' : ''}`, { onclick: () => this.show(k) }, titles[k])),
    );
    panel.append(h('h2', h('span', titles[this.open as Exclude<PanelName, 'shop' | 'chest' | 'quiz'>]), h('button.btn.ghost', { onclick: () => this.close() }, '关闭 Esc')), tabs);
    const body = { shop: () => h('div'), chest: () => h('div'), quiz: () => h('div'), hero: () => this.hero(), talents: () => this.talents(), quests: () => this.questsBody(), codex: () => this.codex(), data: () => this.data(), settings: () => this.settings(), help: () => this.help() }[this.open]();
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
    if (s.bag.length) right.append(h('p.small.muted', has(s.level, 'shop') ? '不要的装备可以拿到面包集市卖给商人 Mira。' : '11 级后可以在面包集市把装备卖给商人，现在只能丢弃。'));
    return h('div.grid2', left, right);
  }

  // ---- Quests (J) and the small typing quiz (Konrad's lesson) ----------------------------

  private questsBody(): HTMLElement {
    const s = this.ctrl.state;
    const wrap = h('div');
    const ids = Object.keys(s.quests ?? {}) as QuestId[];
    if (!ids.length) {
      wrap.append(h('p.muted', '还没有任务。第 2 区（面包集市）开始有任务。'));
      return wrap;
    }
    for (const id of ids) {
      const def = QUESTS[id];
      const p = s.quests![id]!;
      const box = h('div.slot', h('div.k', def.giver), h('div'));
      const body = box.lastChild as HTMLElement;
      body.append(h('div', h('b', def.zh), p.done ? h('span.muted', '  已完成') : ''));
      def.steps.forEach((st, i) => {
        const mark = i < p.step || p.done ? '✓' : i === p.step ? '▸' : '·';
        const cnt = i === p.step && !p.done && st.count ? `（${p.count}/${st.count}）` : '';
        if (i <= p.step || p.done) body.append(h(`div.small${i < p.step || p.done ? '.muted' : ''}`, `${mark} ${st.zh}${cnt}`));
      });
      if (id === 'konrad') body.append(h('div.small', `好感：${FAVOUR[favour(s)]}`));
      wrap.append(box);
    }
    return wrap;
  }

  private quiz: { title: string; intro: string; queue: Word[]; done: Word[]; last?: { ok: boolean; text: string }; onDone: () => void } | null = null;

  /** Type each word (German with article, from the Chinese); a miss goes back into the queue. */
  showQuiz(title: string, intro: string, words: Word[], onDone: () => void): void {
    this.quiz = { title, intro, queue: words.slice(), done: [], onDone };
    this.show('quiz');
  }

  private quizBody(): HTMLElement {
    const q = this.quiz!;
    const wrap = h('div', h('p', q.intro));
    if (q.last) wrap.append(h(`div.feedback.${q.last.ok ? 'ok' : 'no'}`, q.last.text));
    if (!q.queue.length) {
      wrap.append(h('p', '都教会了。'));
      return wrap;
    }
    const w = q.queue[0];
    const input = h('input.quiz', { type: 'text', autocomplete: 'off', spellcheck: 'false', placeholder: hasArticleQuestion(w) ? 'der / die / das + 名词' : '' }) as HTMLInputElement;
    const go = () => {
      const v = gradeTyped(input.value, w, hasArticleQuestion(w));
      recordAnswer(this.ctrl.state, w, v.ok);
      q.queue.shift();
      if (v.ok) q.done.push(w);
      else q.queue.push(w);
      q.last = v.ok ? { ok: true, text: `对：${fullForm(w)}` } : { ok: false, text: `不对，是 ${fullForm(w)}。待会儿再问一次。` };
      this.render();
    };
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        e.stopPropagation();
        go();
      }
    });
    wrap.append(
      h('div.small.muted', `${q.done.length} / ${q.done.length + q.queue.length}`),
      h('div.focus', { style: 'font-size:28px;margin:10px 0' }, w.zh),
      h('div.typing', input, umlautButtons(input), h('button.btn.primary', { onclick: go }, '说 ↵')),
    );
    return wrap;
  }

  // ---- Chest (言灵锁) -------------------------------------------------------------

  private chest: { kind: ChestKind; ilvl: number; word: Word; result?: ReturnType<Controller['openLockedChest']> } | null = null;

  showChest(c: { kind: ChestKind; ilvl: number; word: Word }): void {
    this.chest = c;
    this.show('chest');
  }

  private chestBody(): HTMLElement {
    const c = this.chest!;
    const wrap = h('div');
    if (!c.result) {
      const input = h('input.lock', { type: 'text', autocomplete: 'off', spellcheck: 'false', placeholder: hasArticleQuestion(c.word) ? 'der / die / das + 名词' : '' }) as HTMLInputElement;
      const go = () => {
        c.result = this.ctrl.openLockedChest(c.kind, c.ilvl, c.word, input.value);
        this.render();
      };
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          e.stopPropagation();
          go();
        }
      });
      wrap.append(
        h('p', '箱子上有一道言灵锁，锁上浮着一个你最该复习的词。写对它，每件东西的品质都会再掷一次、取更好的那个；写错了箱子照样打开。'),
        h('div.focus', { style: 'font-size:28px;margin:10px 0' }, c.word.zh),
        h('div.typing', input, umlautButtons(input), h('button.btn.primary', { onclick: go }, '开锁 ↵')),
      );
      return wrap;
    }
    const r = c.result;
    wrap.append(h(`div.feedback.${r.ok ? 'ok' : 'no'}`, r.ok ? `锁开了：${fullForm(c.word)}。品质各掷了两次。` : `锁没认出来，正确是 ${fullForm(c.word)}。箱子还是开了。`));
    const bag = h('div.bag');
    for (const it of r.items) bag.append(h(`div.item.${it.quality}`, h('div', this.itemBody(it))));
    if (r.bagFull) bag.append(h('p.small.muted', `背包满了，${r.bagFull} 件没装下。`));
    wrap.append(bag);
    return wrap;
  }

  // ---- Shop (Mira) ---------------------------------------------------------------

  /** Index of the shelf item being bought (the sentence box is open), or null. */
  buying: number | null = null;
  private shopMsg: { text: string; tone: 'ok' | 'no' } | null = null;

  private shop(): HTMLElement {
    const s = this.ctrl.state;
    const shop = ensureShop(s);
    const wrap = h('div');
    const rc = refreshCost(s);
    wrap.append(
      h(
        'div.hud-row',
        h('span', `金币 `, h('b', String(s.gold))),
        h('button.btn.small', { disabled: s.gold < rc, onclick: () => { this.ctrl.shopRefresh(); } }, rc ? `刷新货架（${rc} 金币）` : '刷新货架（这小时免费）'),
      ),
    );
    // Wishlist.
    const wishSlot = h('select', { onchange: (e: Event) => { shop.wish.slot = ((e.target as HTMLSelectElement).value || undefined) as Slot | undefined; this.ctrl.persist(); } }) as HTMLSelectElement;
    wishSlot.append(h('option', { value: '' }, '任意部位'));
    for (const sl of ['pen', 'coat', 'amulet', 'dict'] as Slot[]) wishSlot.append(h('option', { value: sl, selected: shop.wish.slot === sl }, SLOT_ZH[sl]));
    const wishAffix = h('select', { onchange: (e: Event) => { shop.wish.affix = ((e.target as HTMLSelectElement).value || undefined) as AffixKey | undefined; this.ctrl.persist(); } }) as HTMLSelectElement;
    wishAffix.append(h('option', { value: '' }, '任意词条'));
    for (const k of Object.keys(AFFIX_ZH) as AffixKey[]) wishAffix.append(h('option', { value: k, selected: shop.wish.affix === k }, AFFIX_ZH[k](0).replace(/[+\-]?0(\.0)?%?/, '').trim() || k));
    wrap.append(h('div.hud-row.small', h('span.muted', '心愿单（刷新时出现的概率约 ×3）：'), wishSlot, wishAffix));

    if (this.shopMsg) wrap.append(h(`div.feedback.${this.shopMsg.tone}`, this.shopMsg.text));

    const shelf = h('div.bag');
    shop.items.forEach((it, i) => {
      const p = price(s, it);
      const card = h(
        `div.item.${it.quality}`,
        h('div', this.itemBody(it), h('div.small', `价格 ${p} 金币`)),
        h('div.acts', h('button.btn', { onclick: () => { this.buying = i; this.shopMsg = null; this.render(); } }, '买')),
      );
      shelf.append(card);
      if (this.buying === i) shelf.append(this.buyBox(i));
    });
    if (!shop.items.length) shelf.append(h('p.muted.small', '货架空了。刷新一下吧。'));
    wrap.append(h('h3', '货架'), shelf);

    // Selling.
    wrap.append(h('h3', `卖掉背包里的东西（卖价是买价的五分之一）`));
    const bag = h('div.bag');
    for (const it of s.bag) {
      bag.append(h(`div.item.${it.quality}`, h('div', this.itemBody(it)), h('div.acts', h('button.btn.ghost', { onclick: () => this.ctrl.shopSell(it.id) }, `卖 ${sellPrice(s, it)}`))));
    }
    if (!s.bag.length) bag.append(h('p.muted.small', '背包是空的。'));
    wrap.append(bag);
    return wrap;
  }

  private buyBox(i: number): HTMLElement {
    const s = this.ctrl.state;
    const it = ensureShop(s).items[i];
    const n = SLOT_NOUN[it.slot];
    const bargain = h('input', { type: 'text', placeholder: `讲价（可选）：${BARGAIN_LINES[0]}`, autocomplete: 'off', spellcheck: 'false' }) as HTMLInputElement;
    const line = h('input.buy-line', { type: 'text', value: 'Ich nehme ', autocomplete: 'off', spellcheck: 'false' }) as HTMLInputElement;
    const go = () => {
      const r = this.ctrl.shopBuy(i, line.value, bargain.value);
      if (r.ok) {
        this.buying = null;
        this.shopMsg = { text: `Mira：「Gern!」${r.bargained ? '讲价成功，打了九折。' : ''}花了 ${r.paid} 金币，${it.name} 放进了背包。`, tone: 'ok' };
      } else if (r.reason === 'sentence') {
        this.shopMsg = { text: `Mira 没听懂。正确说法：${r.verdict.correct} ${r.verdict.notes.join(' ')}`, tone: 'no' };
      } else if (r.reason === 'gold') this.shopMsg = { text: `钱不够：要 ${r.paid} 金币。`, tone: 'no' };
      else this.shopMsg = { text: '背包满了，先卖掉一些。', tone: 'no' };
      this.render();
    };
    for (const inp of [bargain, line]) {
      inp.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          e.stopPropagation();
          go();
        }
      });
    }
    return h(
      'div.buybox',
      h('div.small', `用德语说「我要这个${n.zh}」：Ich nehme + ${n.nom} 的第四格。讲价的话（Geht das billiger? / Das ist zu teuer. / Haben Sie einen Rabatt?），这次打九折。`),
      h('div.typing', bargain),
      h('div.typing', line, umlautButtons(line), h('button.btn.primary', { onclick: go }, '成交 ↵')),
    );
  }

  // ---- Class & talents ---------------------------------------------------------

  private talents(): HTMLElement {
    const s = this.ctrl.state;
    const wrap = h('div');
    if (!s.cls) {
      wrap.append(h('p.muted', s.level < 10 ? '10 级以后，去面包集市找导师 Greta 选职业。' : '去面包集市找导师 Greta：先打一场试炼，再选职业。'));
      return wrap;
    }
    const c = CLASSES[s.cls];
    wrap.append(h('h3', { style: 'margin-top:0' }, `${c.zh} · 资源「${c.res}」`));
    for (const line of c.blurb) wrap.append(h('p.small', line));
    const pts = talentPoints(s);
    const used = spent(s);
    wrap.append(h('h3', `天赋（已用 ${used} / ${pts} 点）`));
    if (s.level < TALENT_FROM_LEVEL) {
      wrap.append(h('p.muted.small', `${TALENT_FROM_LEVEL} 级起每升一级得 1 点天赋。`));
      return wrap;
    }
    for (const tier of [1, 2, 3] as const) {
      const row = h('div.talent-row');
      row.append(h('div.small.muted', tier === 1 ? '第 1 层' : `第 ${tier} 层（先花满 ${TIER_GATE[tier]} 点）`));
      for (const t of TALENTS[s.cls].filter((x) => x.tier === tier)) {
        const r = rank(s, t.id);
        row.append(
          h(
            `div.slot${r ? '' : '.dim'}`,
            h('div.k', `${t.zh} ${r}/${t.max}`),
            h('div.small', t.desc(Math.max(1, r))),
            h('button.btn.small', { disabled: !canLearn(s, t), onclick: () => { learn(s, t.id); this.ctrl.persist(); this.render(); } }, '点'),
          ),
        );
      }
      wrap.append(row);
    }
    wrap.append(h('p.small.muted', '洗点：在导师 Greta 那里花一小时的金币。每个职业的天赋分开存。'));
    return wrap;
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
    wrap.append(h('p.small.muted', `0.3：第 1 区余烬营地（1–10 级）和第 2 区面包集市（11–20 级）。当前 ${s.level} 级，等级上限 ${CONFIG.levelCap}。`));
    return wrap;
  }
}
