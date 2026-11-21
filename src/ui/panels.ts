import { CONFIG, xpToNext } from '../core/config';
import { AFFIX_ZH, itemScore, mainStatText, QUALITY_ZH, requiredLevel, SLOT_ZH } from '../core/loot';
import { kindOf, progressSummary, stageOf, STAGE_ZH } from '../core/srs';
import { affinityOf, attack, critChance, dayKey, hintsPerFight, maxHp, now } from '../core/state';
import type { AffixKey, Item, Slot, Word } from '../core/types';
import { has, UNLOCK } from '../core/unlocks';
import { FAMILIES } from '../data/families';
import { SKILLS, skillLinesOpen } from '../data/skills';
import { phraseCards } from '../core/combat';
import { SAYINGS, SAYING_CFG } from '../data/sayings';
import { canLearn, CLASSES, learn, rank, spent, talentPoints, TALENT_FROM_LEVEL, TALENTS, TIER_GATE } from '../core/classes';
import { fullForm, genderOf, hasArticleQuestion, WORDS, zhWithPos } from '../data/words';
import type { Controller } from '../game/controller';
import { $, bar, clear, h, umlautButtons } from './dom';
import { DUEL, duelPool, JUMP, startDuel, type Duel } from '../core/duel';
import { CHEST_ZH, type ChestKind } from '../core/chest';
import { favour, FAVOUR, QUESTS, type QuestId } from '../core/quests';
import { gradeTyped } from '../core/grading';
import { recordAnswer } from '../core/srs';
import { cloud, leaderboard, mustChangePassword, push, setNickname, signOut } from '../net/cloud';
import { loginView } from './account';
import { toast } from './feedback';
import { ACHIEVEMENTS, NOTES } from '../data/achievements';
import { canListen, listenOnce } from './listen';
import { lookPicker } from './title';
import { BARGAIN_LINES, ensureShop, price, refreshCost, sellPrice, SLOT_NOUN } from '../core/shop';

export type PanelName = 'hero' | 'talents' | 'quests' | 'codex' | 'words' | 'data' | 'account' | 'settings' | 'help' | 'shop' | 'chest' | 'quiz' | 'duel' | 'bigmap';

export class Panels {
  open: PanelName | null = null;
  private codexFilter: string = 'all';

  constructor(private ctrl: Controller) {
    cloud.onChange = () => {
      if (this.open === 'account') this.render();
    };
  }

  private bigmap: HTMLElement | null = null;

  /** 大地图 (0.5): the body comes from the scene map. */
  showBigMap(body: HTMLElement): void {
    this.bigmap = body;
    this.show('bigmap');
  }

  show(name: PanelName): void {
    this.open = name;
    this.render();
    $('modal').hidden = false;
  }

  close(): void {
    const wasChest = this.open === 'chest';
    this.duel = null;
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
    if (this.open === 'duel' && this.duel) {
      panel.append(h('h2', h('span', '默写对决 · 考官'), h('button.btn.ghost', { onclick: () => this.close() }, this.duel.over ? '离开 Esc' : '认输离开 Esc')), this.duelBody());
      clear(el).append(panel);
      el.onclick = null;
      window.setTimeout(() => (el.querySelector('input.duel') as HTMLInputElement | null)?.focus(), 0);
      return;
    }
    if (this.open === 'quiz' && this.quiz) {
      panel.append(h('h2', h('span', this.quiz.title), h('button.btn.ghost', { onclick: () => this.close() }, this.quiz.queue.length ? '先不教 Esc' : '完成 Esc')), this.quizBody());
      clear(el).append(panel);
      el.onclick = null;
      window.setTimeout(() => (el.querySelector('input.quiz') as HTMLInputElement | null)?.focus(), 0);
      return;
    }
    if (this.open === 'bigmap' && this.bigmap) {
      panel.append(h('h2', h('span', '大地图'), h('button.btn.ghost', { onclick: () => this.close() }, '关闭 Esc')), this.bigmap);
      clear(el).append(panel);
      el.onclick = (e) => {
        if (e.target === el) this.close();
      };
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
    const titles: Record<Exclude<PanelName, 'shop' | 'chest' | 'quiz' | 'duel' | 'bigmap'>, string> = { hero: '角色与装备', talents: '职业与天赋', quests: '任务', codex: '图鉴', words: '单词本', data: '数据与存档', account: '账号与排行', settings: '设置', help: '怎么玩' };
    const tabs = h('div.tabs');
    (Object.keys(titles) as Array<Exclude<PanelName, 'shop' | 'chest' | 'quiz' | 'duel' | 'bigmap'>>).forEach((k) =>
      tabs.append(h(`button.btn${this.open === k ? '.on' : ''}`, { onclick: () => this.show(k) }, titles[k])),
    );
    panel.append(h('h2', h('span', titles[this.open as Exclude<PanelName, 'shop' | 'chest' | 'quiz' | 'duel' | 'bigmap'>]), h('button.btn.ghost', { onclick: () => this.close() }, '关闭 Esc')), tabs);
    const body = { bigmap: () => h('div'), shop: () => h('div'), chest: () => h('div'), quiz: () => h('div'), duel: () => h('div'), hero: () => this.hero(), talents: () => this.talents(), quests: () => this.questsBody(), codex: () => this.codex(), words: () => this.wordbook(), data: () => this.data(), account: () => this.account(), settings: () => this.settings(), help: () => this.help() }[this.open]();
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
    if (this.ctrl.nearBonfire()) left.append(h('h3', '外观（篝火旁免费改）'), lookPicker(s.look, (l) => this.ctrl.setLook(l)).el);
    if (s.level >= UNLOCK.affinity) {
      const aff = affinityOf(s);
      left.append(h('h3', '护符亲和'), h('p.muted', `现在：${aff ?? '无（普通护符，所有怪破甲每档 4%）'}。${aff ? `${aff} 的怪、选对相时破甲每档 10%，其他怪不破。` : ''}`));
      if (this.ctrl.nearBonfire()) {
        const row = h('div.row');
        for (const a of ['der', 'die', 'das', null] as const)
          row.append(h(`button.btn${aff === a ? '' : '.ghost'}`, { onclick: () => (this.ctrl.setAffinity(a), this.render()) }, a ?? '无'));
        left.append(row);
      } else left.append(h('p.muted', '到篝火旁可以免费换。'));
    }
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
        left.append(h('div.slot', h('div.k', sk.zh), h('div', h('div', { style: 'font-family:var(--mono)' }, sk.lines.slice(0, skillLinesOpen(sk, s.skillUses[sk.id] ?? 0)).map((l) => l.de).join(' / ')), h('div.small.muted', `${sk.effect} · 已解锁 ${skillLinesOpen(sk, s.skillUses[sk.id] ?? 0)} / ${sk.lines.length} 种说法，每放 5 次多一种`))));
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
    if (s.bag.length) right.append(h('p.small.muted', has(s.level, 'shop') ? '不要的装备可以卖给商人 Mira（营地篝火边，或面包集市）。' : `${UNLOCK.shop} 级后可以把装备卖给营地的商人 Mira，现在只能丢弃。`));
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
      recordAnswer(this.ctrl.state, w, v.ok, 'write');
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

  // ---- 默写对决 ---------------------------------------------------------------------

  private duel: Duel | null = null;
  /** 默写对决: after a wrong answer the next word waits until Enter. */
  private duelHold = false;

  showDuel(d: Duel): void {
    this.duel = d;
    this.duelHold = false;
    this.show('duel');
  }

  private duelBody(): HTMLElement {
    const d = this.duel!;
    const s = this.ctrl.state;
    const wrap = h('div');
    wrap.append(
      bar('hp', s.hp, maxHp(s), `你的生命 ${s.hp} / ${maxHp(s)}`),
      d.exam
        ? h('p.small.muted', `跳区考核：写对 ${d.right} / ${JUMP.pass} · 写错 ${d.wrong} · 剩 ${d.queue.length} 个词（考官不出手）`)
        : bar('xp', d.hp, DUEL.examinerHp, `考官 ${d.hp} / ${DUEL.examinerHp}`),
      d.exam ? '' : h('p.small.muted', `考官读条：${'■'.repeat(d.bar)}${'□'.repeat(DUEL.readBar - d.bar)}（满了就出手）· 写对 ${d.right} · 写错 ${d.wrong} · 剩 ${d.queue.length} 个词`),
    );
    if (d.last) {
      const l = d.last;
      const fb = h(`div.feedback.${l.ok ? 'ok' : 'no'}`);
      if (l.ok) {
        fb.append(h('b', `写对了：${fullForm(l.word)}`), h('span', `（${zhWithPos(l.word)}）`), h('span.note', `当场归名！+${l.xp} 经验`));
        for (const n of l.verdict.notes) fb.append(h('span.note', n));
      } else {
        // A wrong answer waits for Enter: what you wrote, then the right spelling, each on its own line.
        fb.append(
          h('b', '写错了'),
          h('span.note', `题目：${zhWithPos(l.word)}`),
          h('span.note', `你写的：${l.input || '（空）'}`),
          h('span.note', h('b', `正确写法：${fullForm(l.word)}`)),
        );
        for (const n of l.verdict.notes) if (!n.startsWith('正确答案')) fb.append(h('span.note', n));
      }
      if (l.hit) fb.append(h('span.note', `考官出手：你受到 ${l.hit} 点伤害`));
      wrap.append(fb);
    }
    if (d.over) {
      wrap.append(
        h('h3', d.exam ? (d.over === 'win' ? `跳区考核通过：升到 ${s.level} 级。` : `差一点：写对 ${d.right} 个，要 ${JUMP.pass} 个。没关系，随时再考。`) : d.over === 'win' ? (d.hp <= 0 ? '你赢了考官。' : '这一区没有词可考了。') : '你撑不住了，对决结束。'),
        h('p', `这一场写对 ${d.right} 个词，都已经归名。`),
        h('div.row', d.exam ? '' : h('button.btn.primary', { onclick: () => { const r = s.region ?? 1; if (duelPool(s, r).length) this.showDuel(startDuel(s, r, Math.random)); else this.close(); } }, '再来一场'), h('button.btn', { onclick: () => this.close() }, '离开')),
      );
      return wrap;
    }
    if (this.duelHold && d.last && !d.last.ok) {
      const next = h('button.btn.primary.duel-next', { onclick: () => { this.duelHold = false; this.render(); } }, '看清了，下一个 ↵') as HTMLButtonElement;
      next.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          e.stopPropagation();
          next.click();
        }
      });
      wrap.append(h('div.row', next));
      window.setTimeout(() => next.focus(), 0);
      return wrap;
    }
    const w = d.queue[0];
    const input = h('input.duel', { type: 'text', autocomplete: 'off', spellcheck: 'false', placeholder: hasArticleQuestion(w) ? 'der / die / das + 名词' : '写出德语' }) as HTMLInputElement;
    const go = () => {
      if (!input.value.trim()) return;
      this.ctrl.duelAnswer(d, input.value);
      this.duelHold = !d.last?.ok;
      this.render();
    };
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        e.stopPropagation();
        go();
      }
    });
    wrap.append(h('div.focus', { style: 'font-size:28px;margin:10px 0' }, zhWithPos(w)), h('div.typing', input, umlautButtons(input), h('button.btn.primary', { onclick: go }, '写 ↵')));
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
      h('div.small', `用德语说「我要这个${n.zh}」：Ich nehme + ${n.nom} 的第四格。讲价的话（Geht das billiger? / Das ist zu teuer. / Gibt es einen Rabatt?），这次打九折。`),
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
    // 成就 and 纸条 (0.5).
    const ach = h('div.small', h('b', '成就 '), ...ACHIEVEMENTS.map((a) => h('span', { title: a.how, style: s.flags[`ach_${a.id}`] ? 'color:var(--gold, #ffcf4a)' : 'opacity:.45' }, ` ${s.flags[`ach_${a.id}`] ? '★' : '☆'} ${a.zh}${s.flags[`ach_${a.id}`] ? a.title : ''}（${a.how}）`)));
    wrap.append(ach);
    const notes = NOTES.filter((n) => s.flags[`note_${n.id}`]);
    if (notes.length) wrap.append(h('div.small', h('b', '纸条 '), ...notes.map((n) => h('p.small', `【${n.zh}】${n.text}`))));
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

  // ---- 单词本: what you know, what you're learning, what you keep getting wrong ----------------

  private wordbook(): HTMLElement {
    const s = this.ctrl.state;
    const t = now(s);
    const wrap = h('div');
    type Row = { w: Word; p: (typeof s.words)[string] };
    const shaky: Row[] = [];
    const wrote: Row[] = [];
    const readOnly: Row[] = [];
    const notYet: Row[] = [];
    const known: Row[] = [];
    for (const w of WORDS) {
      const p = s.words[w.id];
      if (!p) continue;
      const tries = p.correct + p.wrong;
      const weak = p.wrong >= 2 && p.wrong / Math.max(1, tries) >= 0.34;
      if (weak || p.relapse > 0) shaky.push({ w, p });
      else if (p.stage === 3 && p.write) known.push({ w, p });
      else if (p.write) wrote.push({ w, p });
      else if (p.read) readOnly.push({ w, p });
      else notYet.push({ w, p });
    }
    shaky.sort((a, b) => b.p.wrong - a.p.wrong);
    for (const l of [wrote, readOnly, notYet]) l.sort((a, b) => a.p.due - b.p.due);
    known.sort((a, b) => a.w.de.localeCompare(b.w.de, 'de'));
    const learningN = wrote.length + readOnly.length + notYet.length;
    wrap.append(h('p.small.muted', `见过 ${shaky.length + learningN + known.length} 个词：熟练 ${known.length} · 学习中 ${learningN} · 常错 ${shaky.length}。「认得」是选择题答对过，「会写」是默写、变位或整句写对过。存档同步到云端，换电脑也在。`));
    const table = (title: string, note: string, rows: Row[]) => {
      if (!rows.length) return;
      const tb = h('table.log');
      tb.append(h('tr', h('th', '德语'), h('th', '中文'), h('th', '复数'), h('th', '认得'), h('th', '会写'), h('th', '对 / 错'), h('th', '状态')));
      for (const { w, p } of rows) {
        const g = genderOf(w);
        const gk = g ? { m: 'der', f: 'die', n: 'das', pl: 'pl' }[g] : null;
        const due = p.due <= t;
        tb.append(
          h(
            'tr',
            h('td', h(`span${gk ? '.art-' + gk : ''}`, fullForm(w))),
            h('td', w.zh),
            h('td', w.pl && w.pl !== '-' ? `die ${w.pl}` : '—'),
            h('td', p.read ? '✓' : '—'),
            h('td', p.write ? '✓' : '—'),
            h('td', `${p.correct} / ${p.wrong}`),
            h('td', `${STAGE_ZH[p.stage as 0 | 1 | 2 | 3] ?? ''}${due ? ' · 该复习了' : ''}`),
          ),
        );
      }
      wrap.append(h('h3', `${title}（${rows.length}）`), h('p.small.muted', note), tb);
    };
    table('常错', '错了两次以上、错的比例超过三分之一，或者归名后又忘过的词。多打几次这些怪。', shaky);
    table('学习中 · 会写了', '写对过，还没归名。按复习时间排，最该复习的在前。', wrote);
    table('学习中 · 认得，还不会写', '选择题答得出来，还没默写对过。归名的最后一击要默写。', readOnly);
    table('学习中 · 还不认得', '见过，但还没答对过。', notYet);
    table('熟练', '已经归名的词：认得，也会写。', known);
    if (s.level >= SAYING_CFG.fromLevel) {
      const got = SAYINGS.filter((x) => s.sayings?.[x.id]);
      const phraseIds = new Set(phraseCards().map((x) => x.id));
      const tb = h('table.log');
      tb.append(h('tr', h('th', '短句'), h('th', '中文'), h('th', '什么时候说')));
      for (const x of SAYINGS) {
        const have = !!s.sayings?.[x.id];
        tb.append(h('tr', h('td', have ? `${x.a} ${x.b}` : `${x.a} ……`), h('td', have ? x.zh : '？'), h('td', have ? x.when : (phraseIds.has(x.id) ? '野外金色的「残句」怪：接上、听懂、写出整句就能收下' : '在野外遇到喊这句的接句怪，接上下半句就能收下'))));
      }
      wrap.append(h('h3', `短句卡（${got.length} / ${SAYINGS.length}）`), h('p.small.muted', '大部分卡从野外金色的「残句」怪身上掉；怪的词正好在这句里时，接句怪也会喊它。卡只用来收集，没有战斗效果。'), tb);
    }
    if (!Object.keys(s.words).length) wrap.append(h('p', '还没有见过的词。出去打几只怪吧。'));
    return wrap;
  }

  // ---- Data & saves --------------------------------------------------------------

  private account(): HTMLElement {
    const s = this.ctrl.state;
    const wrap = h('div');
    if (!cloud.session || mustChangePassword()) {
      loginView(wrap, () => {
        void push(s);
        this.render();
      });
      return wrap;
    }
    if (!s.look) {
      const pick = lookPicker();
      wrap.append(h('h3', '选一个外观'), h('p.small.muted', '联机时别人看到的样子。之后在篝火旁可以免费改。'), pick.el, h('button.btn.primary', { onclick: () => { this.ctrl.setLook(pick.value()); this.render(); } }, '就这样'));
      return wrap;
    }
    const st = { off: '未同步', syncing: '同步中…', ok: `已同步${cloud.lastSync ? `（${new Date(cloud.lastSync).toLocaleTimeString().slice(0, 5)}）` : ''}`, offline: '连不上服务器，先存在本地，联网后自动同步' }[cloud.status];
    wrap.append(
      h('p.small', `已登录：${cloud.session.user.email ?? ''} · 云存档：${st}`),
      h('div.row', h('button.btn', { onclick: async () => { this.ctrl.persist(); await push(s); } }, '立即同步'), h('button.btn.ghost', { onclick: async () => { this.ctrl.persist(); await push(s); await signOut(); location.reload(); } }, '退出登录')),
    );
    if (!cloud.profile) {
      const nick = h('input', { placeholder: '昵称（1–16 个字）', maxlength: 16, value: s.name }) as HTMLInputElement;
      const msg = h('p.small');
      const saveNick = async () => {
        const err = await setNickname(s, nick.value);
        msg.textContent = err ?? '';
      };
      wrap.append(h('h3', '起个昵称'), h('p.small.muted', '排行榜只显示昵称、等级和职业，不显示邮箱。'), h('div.row', nick, h('button.btn.primary', { onclick: () => void saveNick() }, '保存')), msg);
      return wrap;
    }
    wrap.append(h('h3', `排行榜 · 你是 ${cloud.profile.nickname}`));
    const table = h('table.log');
    table.append(h('tr', h('td', { colspan: 5 }, '加载中…')));
    wrap.append(table, h('p.small.muted', '按等级排，同级比已归名的词数。数据在你同步存档时更新。'));
    leaderboard()
      .then((rows) => {
        clear(table).append(h('tr', h('th', '#'), h('th', '昵称'), h('th', '等级'), h('th', '职业'), h('th', '已归名')));
        rows.forEach((r, i) => {
          const me = r.nickname === cloud.profile?.nickname;
          table.append(h(`tr${me ? '.me' : ''}`, h('td', i + 1), h('td', me ? `${r.nickname}（你）` : r.nickname), h('td', r.level), h('td', r.cls ? CLASSES[r.cls as keyof typeof CLASSES]?.zh ?? '—' : '—'), h('td', r.named)));
        });
      })
      .catch(() => clear(table).append(h('tr', h('td', { colspan: 5 }, '排行榜加载失败，可能是断网了。'))));
    return wrap;
  }

  private data(): HTMLElement {
    const s = this.ctrl.state;
    const wrap = h('div');
    wrap.append(h('p.small.muted', '存档会同步到云端，换电脑登录就能接着玩；断网时先存在这个浏览器里，联网后自动同步。导出的文件可以留作备份。试玩时请每周把导出的文件发给开发者：里面只有游戏记录（每天玩了多久、学了几个词）和你起的角色名。'));
    const table = h('table.log');
    table.append(h('tr', h('th', '日期'), h('th', '分钟'), h('th', '击杀'), h('th', '答对'), h('th', '答错'), h('th', '新词'), h('th', '归名')));
    const days = Object.keys(s.log).sort().reverse();
    for (const d of days) {
      const l = s.log[d];
      table.append(h('tr', h('td', d === dayKey(now(s)) ? `${d}（今天）` : d), h('td', l.minutes), h('td', l.kills), h('td', l.correct), h('td', l.wrong), h('td', l.newWords), h('td', l.guiming)));
    }
    if (!days.length) table.append(h('tr', h('td', { colspan: 7 }, '还没有记录。')));
    wrap.append(table);
    // 开局计时 (0.5): the active-play minute each thing first happened, for the 60-minute rhythm check.
    const ms = Object.entries(s.flags).filter(([k]) => k.startsWith('ms_')).sort((a, b) => Number(a[1]) - Number(b[1]));
    if (ms.length) {
      const MS: Record<string, string> = { lv: '升到', q_: '题型：', mv_: '招式：', m_: '遇到：', z_: '第一次在这片打怪：', gear: '装备升到第', drop: '第一次掉装备', card: '第一张短句卡', guiming: '第一次归名', duel: '第一次默写对决', bonfire: '第一次篝火休息', shadow: '第一次跟读成功' };
      const label = (k: string) => { const key = k.slice(3); const p = Object.keys(MS).find((x) => key.startsWith(x)); return p ? `${MS[p]}${key.slice(p.length)}` : key; };
      const lines = ms.map(([k, v]) => `${String(v).padStart(5)} 分  ${label(k)}`);
      wrap.append(h('h3', `开局计时（累计游玩 ${Math.round(((s.flags.playSec as number) ?? 0) / 60)} 分钟）`), h('pre.small', lines.join('\n')));
      wrap.append(h('button.btn', { onclick: () => void navigator.clipboard?.writeText(lines.join('\n')).then(() => toast('已复制')).catch(() => undefined) }, '复制开局计时'));
    }
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
    // 跟读试音: check the microphone and Chrome's recognition at any level (跟读 itself opens at Lv5).
    const out = h('span.small.muted', canListen() ? '读一句德语，比如「Ich trinke Kaffee.」' : '没检测到麦克风，或者这个网站的麦克风权限被拒绝了');
    const btn = h('button.btn', '试麦克风') as HTMLButtonElement;
    btn.onclick = async () => {
      btn.disabled = true;
      out.textContent = '在听……请说德语';
      const heard = await listenOnce();
      btn.disabled = false;
      out.textContent = heard === null ? '用不了麦克风：在地址栏左边的网站设置里允许麦克风，再刷新' : heard.length ? `听到：${heard[0]}` : '没听清，再试一次';
    };
    wrap.append(h('label.toggle', h('span', { style: 'width:60px' }, '跟读'), btn, out));
    return wrap;
  }

  private help(): HTMLElement {
    const s = this.ctrl.state;
    const rows: Array<[string, string]> = [
      ['移动', '点地图上的圆点或右边面板里的出口，一站一站走过去（远处去过的会自动走）；M 打开大地图；数字键 1–9 打这个场景里的第几只怪。地址后加 ?oldmap 可以用回 0.4 的自由走动地图'],
      ['互动', 'E（篝火、守火人、路牌、门）'],
      ['面板', 'C 角色和装备 · B 图鉴 · Esc 关闭'],
      ['词性三相', '名词怪出手前先选相：1 der · 2 die · 3 das（对这只怪一直有效，随时可以点按钮换）。选对：护甲降一档、回 1 点资源、附带元素；6 级起选错：护甲翻倍、破甲清零。复数怪一律 die'],
      ['战斗', 'A 攻击 · Q 铭刻 · W 低语 · E 齐鸣（只打同相的怪）· F 终结技 · R 技能 · G 职业技能；1/2/3 选答案；打字题按 Enter 交卷；结果会自动进下一题（Enter 跳过等待）；Z 看中文；V 再听；S 读出来（5 级起可选：答对后跟着读那句德语，读得像每场多给一次经验，读不好不扣东西；没有麦克风就不显示）'],
      ['变音字母', '点 ä ö ü ß 按钮，或者写 ae oe ue ss（算对，但会提示正确拼法）'],
      ['归名', '一个词就是一只怪。打败它 3 次（3 次不同的重生，隔天才会重生），最后一下要默写带冠词的全名，它才变回原样'],
      ['遗忘之物', '头上有「!」的怪是今天到期的词，经验和掉落更多。篝火休息会刷新所有怪'],
      ['影子', '半透明的怪是还没到期的词：给金币和经验，但不推进归名'],
      ['死亡', '学习进度永远不丢。金币和这一级的经验留在杀死你的那个词上（回响），回去打败它就能捡回'],
    ];
    const wrap = h('div');
    for (const [k, v] of rows) wrap.append(h('div.stat', h('span', { style: 'width:90px;flex:none' }, k), h('span', { style: 'text-align:right' }, v)));
    wrap.append(h('p.small.muted', `0.5：第 1 区余烬营地（1–10 级）和第 2 区面包集市（11–20 级）。当前 ${s.level} 级，等级上限 ${CONFIG.levelCap}。`));
    return wrap;
  }
}
