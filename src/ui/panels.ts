import { loadPron, MODEL_MB, pronForget, pronStatus } from './phoneme';
import { icon, SLOT_TILE, portrait } from './icons';
import { CONFIG, xpToNext } from '../core/config';
import { levelCapFor } from '../core/stages';
import { AFFIX_ZH, itemScore, LEGENDARY, mainStatText, QUALITY_ZH, requiredLevel, SLOT_ZH } from '../core/loot';
import { cutStatus, kindOf, progressSummary, reviewMon, stageOf, STAGE_ZH } from '../core/srs';
import { affinityOf, attack, critChance, dayKey, maxHp, now } from '../core/state';
import type { AffixKey, Item, Slot, Word } from '../core/types';
import { has, UNLOCK } from '../core/unlocks';
import { BLIND_FROM, blindBoxes, boxLabel, boxPrice, buyBox } from '../core/blindbox';
import { FAMILIES } from '../data/families';
import { loadout, owned, POOL, POOL_FROM, POOL_ORDER, slotCount, toggleLoadout } from '../core/skillPool';
import { phraseCards } from '../core/combat';
import { gemText } from '../core/gems';
import { CHARM, CHARM_BY_ID, equipCharm, equippedCharms, SLANG } from '../core/charms';
import { SAYINGS, SAYING_CFG } from '../data/sayings';
import { MASTERY, masteryFree, masteryIn, masteryPts, spendMastery, type MasteryTrack } from '../core/mastery';
import { BRANCHES, canLearn, canLight, learn, learned, lightStar, litStars, ROW_GATE, spent, spentIn, STARS, STARS_FROM, starsPassed, talentPoints, TALENT_FROM_LEVEL, TALENT_TREE, type Branch } from '../core/classes';
import { finishStarTrial, starTrial, STAR_TRIAL } from '../core/stars';
import { fullForm, fullFormLong, genderOf, reflNote, hasArticleQuestion, WORD_BY_ID, WORDS, zhWithPos } from '../data/words';
import type { Controller } from '../game/controller';
import { $, clear, h, umlautButtons } from './dom';
import { BREAK, examParts, examPassed, PART_ZH, type Exam } from '../core/breakthrough';
import { pendingScenes, regionLeft, type ScreenRun } from '../core/screen';
import { bandRange, levelFor, PLACE, regionFor, topPassed, type PickBoard, type PlaceRun } from '../core/placement';
import { CHEST_ZH, type ChestKind } from '../core/chest';
import { playChest } from './chestFx';
import { favour, FAVOUR, QUESTS, type QuestId } from '../core/quests';
import { gradeTyped } from '../core/grading';
import { recordAnswer, reviewedByWriting } from '../core/srs';
import { track } from '../net/social';
import { BOARD, BOARD_ZH, type BoardKind } from '../core/board';
import { cloud, leaderboard, mustChangePassword, push, setNickname, signOut } from '../net/cloud';
import { loginView } from './account';
import { toast } from './feedback';
import { ACHIEVEMENTS, NOTES } from '../data/achievements';
import { canListen, lastConfidence, listening, listenOnce, stopHold } from './listen';
import { clarity, shadowOk } from '../core/shadow';
import { DIARY, DIARY_WRITER, type DiaryBlank } from '../data/diary';
import { AREAS, SCENE_BY_ID } from '../data/world';
import { archive, isRead, LETTER_BY_ID, LETTER_CFG } from '../core/letters';
import { blanksOf, checkBlank, DIARY_MISSES, DIARY_XP, lineText, pageLines, pageNo, pageRegion, pageState } from '../core/diary';
import { lookPicker, originPicker } from './title';
import { CONSUMABLE, cap as itemCap, count as itemCount, itemPrice, type Consumable } from '../core/items';
import { matchRows, mergeImport, readTable } from '../core/wordImport';
import { checkJournal, type JournalHint } from '../core/journal';
import { BARGAIN_LINES, ensureShop, price, refreshCost, sellPrice, SLOT_NOUN } from '../core/shop';

export type PanelName = 'hero' | 'talents' | 'quests' | 'codex' | 'words' | 'data' | 'account' | 'settings' | 'help' | 'shop' | 'chest' | 'quiz' | 'screen' | 'bigmap' | 'diary' | 'ask' | 'exam' | 'journal' | 'place' | 'letter';

export class Panels {
  open: PanelName | null = null;
  private codexFilter: string = 'all';

  constructor(private ctrl: Controller) {
    cloud.onChange = () => {
      if (this.open === 'account') this.render();
    };
    // 日记残页: hold S to read the current line (release ends it; battle.ts stops the hold on keyup).
    window.addEventListener('keydown', (e) => {
      if (this.open !== 'diary' || e.repeat || e.key.toLowerCase() !== 's' || document.activeElement?.tagName === 'INPUT') return;
      e.preventDefault();
      void this.diaryReadLine();
    });
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
    this.screen = null;
    if (this.open === 'place' && this.place) {
      // Closing mid-test keeps what was answered (it only ever raises the level).
      const run = this.place.run;
      const daily = this.place.daily;
      this.place = null;
      window.setTimeout(() => this.ctrl.placeClosed(run, daily), 0);
    }
    if (this.open === 'exam' && this.exam) {
      const e = this.exam;
      this.exam = null;
      if (e.over) window.setTimeout(() => this.ctrl.examDone(e), 0);
    }
    if (this.open === 'ask' && this.asking) {
      // Closing without answering counts as an empty answer, so the caller always continues.
      const a = this.asking;
      this.asking = null;
      window.setTimeout(() => a.onAnswer(''), 0);
    }
    if (this.open === 'journal') this.journalState = null;
    if (this.open === 'letter') this.letter = null;
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
    if (this.open === 'screen' && this.screen) {
      const run = this.screen;
      const leave = () => {
        // Leaving shows the small summary first (in the examiner's panel, not a popup).
        if (!run.over && (run.cut.length || run.skipped || run.wrong)) {
          run.over = true;
          this.render();
        } else this.close();
      };
      panel.append(h('h2', h('span', '全量筛选 · 考官'), h('button.btn.ghost', { onclick: leave }, '离开 Esc')), this.screenBody());
      clear(el).append(panel);
      el.onclick = null;
      window.setTimeout(() => (el.querySelector('input.duel, button.duel-next') as HTMLElement | null)?.focus(), 0);
      return;
    }
    if (this.open === 'place' && this.place) {
      const pl = this.place;
      const title = pl.daily ? '分级考核 · 考官' : '入学测试';
      const btn = pl.run?.outcome ? '出发 Esc' : pl.run ? '结束测试 Esc' : '先不测了 Esc';
      panel.append(h('h2', h('span', title), h('button.btn.ghost', { onclick: () => this.close() }, btn)), this.placeBody());
      clear(el).append(panel);
      el.onclick = null;
      window.setTimeout(() => (el.querySelector('input.duel, button.duel-next') as HTMLElement | null)?.focus(), 0);
      return;
    }
    if (this.open === 'exam' && this.exam) {
      panel.append(h('h2', h('span', `${this.exam.stage ?? 'A1'} 突破试炼 · 考官`), h('button.btn.ghost', { onclick: () => this.close() }, this.exam.over ? '离开 Esc' : '放弃 Esc')), this.examBody());
      clear(el).append(panel);
      el.onclick = null;
      window.setTimeout(() => (el.querySelector('input.exam, button.exam-first') as HTMLElement | null)?.focus(), 0);
      return;
    }
    if (this.open === 'ask' && this.asking) {
      const a = this.asking;
      const input = (a.multi
        ? h('textarea.ask', { rows: 6, autocomplete: 'off', spellcheck: 'false', placeholder: 'Ich …（Ctrl + Enter 交）', style: 'width:100%;font-size:18px' })
        : h('input.ask', { type: 'text', autocomplete: 'off', spellcheck: 'false', placeholder: 'Ich …' })) as HTMLInputElement;
      // 冒险者语音对话: hold to speak German (Chrome's recognition); the text goes the same way as typed.
      let heard = '';
      const go = () => {
        if (!input.value.trim()) return;
        this.asking = null;
        this.close();
        a.onAnswer(input.value, !!heard && input.value.trim() === heard);
      };
      const mic = a.voice && canListen()
        ? h('button.btn', {
            title: '按住说德语，松开结束',
            onmousedown: async () => {
              const s = this.ctrl.state;
              if (!s.flags.voiceChatNote) {
                s.flags.voiceChatNote = true;
                toast('提示：Chrome 的语音识别会把录音发给 Google 处理。不想用就继续打字。');
              }
              mic!.textContent = '🎤 在听……';
              const r = await listenOnce({ hold: true });
              mic!.textContent = '🎤 按住说';
              if (r?.[0]) {
                heard = r[0].trim();
                input.value = heard;
                input.focus();
              } else if (r === null) toast('用不了麦克风：在地址栏左边的网站设置里允许麦克风');
            },
            onmouseup: () => stopHold(),
            onmouseleave: () => stopHold(),
          }, '🎤 按住说')
        : null;
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && (!a.multi || e.ctrlKey || e.metaKey)) {
          e.preventDefault();
          e.stopPropagation();
          go();
        } else if (a.multi) e.stopPropagation();
      });
      panel.append(h('h2', h('span', a.title), h('button.btn.ghost', { onclick: () => this.close() }, '不回答 Esc')), h('p', { style: 'white-space:pre-line' }, a.prompt), h('div.typing', input, umlautButtons(input), mic, h('button.btn.primary', { onclick: go }, a.multi ? '交 Ctrl+↵' : '说 ↵')));
      clear(el).append(panel);
      el.onclick = null;
      window.setTimeout(() => input.focus(), 0);
      return;
    }
    if (this.open === 'quiz' && this.quiz) {
      panel.append(h('h2', h('span', this.quiz.title), h('button.btn.ghost', { onclick: () => this.close() }, this.quiz.queue.length ? '先不教 Esc' : '完成 Esc')), this.quizBody());
      clear(el).append(panel);
      el.onclick = null;
      window.setTimeout(() => (el.querySelector('input.quiz') as HTMLInputElement | null)?.focus(), 0);
      return;
    }
    if (this.open === 'journal' && this.journalState) {
      panel.append(h('h2', h('span', '篝火日记'), h('button.btn.ghost', { onclick: () => this.close() }, this.journalState.saved ? '合上 Esc' : '先不写 Esc')), this.journalBody());
      clear(el).append(panel);
      el.onclick = null;
      window.setTimeout(() => (el.querySelector('textarea.journal') as HTMLTextAreaElement | null)?.focus(), 0);
      return;
    }
    if (this.open === 'letter' && this.letter) {
      const l = LETTER_BY_ID[this.letter.id];
      panel.append(h('h2', h('span', `✉ ${l.title}`), h('button.btn.ghost', { onclick: () => this.close() }, '合上 Esc')), this.letterBody());
      clear(el).append(panel);
      el.onclick = (e) => {
        if (e.target === el) this.close();
      };
      return;
    }
    if (this.open === 'diary' && this.diary) {
      panel.append(h('h2', h('span', portrait('Jonas', 2) ?? '', `日记残页 · 第 ${pageRegion(this.diary.scene)} 区第 ${pageNo(this.diary.scene)} 页`), h('button.btn.ghost', { onclick: () => this.close() }, '合上 Esc')), this.diaryBody());
      clear(el).append(panel);
      el.onclick = null;
      window.setTimeout(() => (el.querySelector('input.diary') as HTMLInputElement | null)?.focus(), 0);
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
    const titles: Record<Exclude<PanelName, 'shop' | 'chest' | 'quiz' | 'screen' | 'bigmap' | 'diary' | 'ask' | 'exam' | 'journal' | 'place' | 'letter'>, string> = { hero: '角色与装备', talents: '技能与天赋', quests: '任务', codex: '图鉴', words: '单词本', data: '数据与存档', account: '账号与排行', settings: '设置', help: '怎么玩' };
    const tabs = h('div.tabs');
    (Object.keys(titles) as Array<Exclude<PanelName, 'shop' | 'chest' | 'quiz' | 'screen' | 'bigmap' | 'diary' | 'ask' | 'exam' | 'journal' | 'place' | 'letter'>>).forEach((k) =>
      tabs.append(h(`button.btn${this.open === k ? '.on' : ''}`, { onclick: () => this.show(k) }, titles[k])),
    );
    panel.append(h('h2', h('span', titles[this.open as Exclude<PanelName, 'shop' | 'chest' | 'quiz' | 'screen' | 'bigmap' | 'diary' | 'ask' | 'exam' | 'journal' | 'place' | 'letter'>]), h('button.btn.ghost', { onclick: () => this.close() }, '关闭 Esc')), tabs);
    const body = { letter: () => h('div'), journal: () => h('div'), exam: () => h('div'), ask: () => h('div'), diary: () => h('div'), bigmap: () => h('div'), shop: () => h('div'), chest: () => h('div'), quiz: () => h('div'), place: () => h('div'), screen: () => h('div'), hero: () => this.hero(), talents: () => this.talents(), quests: () => this.questsBody(), codex: () => this.codex(), words: () => this.wordbook(), data: () => this.data(), account: () => this.account(), settings: () => this.settings(), help: () => this.help() }[this.open]();
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
    if (this.ctrl.nearBonfire()) {
      left.append(h('h3', '外观（篝火旁免费改）'), lookPicker(s.look, (l) => this.ctrl.setLook(l)).el);
      left.append(h('h3', '出身（篝火旁免费改，不加数值，只决定常遇到的话题）'), h('div.origin-wrap', originPicker(s.origin, () => s.look?.gender ?? 0, (v) => this.ctrl.setOrigin(v)).el));
    }
    if (s.level >= UNLOCK.affinity) {
      const aff = affinityOf(s);
      left.append(h('h3', '护符亲和'), h('p.muted', `现在：${aff ?? '无'}。破甲照旧每档 4%。${aff ? `${aff} 的怪（复数算 die）第一次选对相时资源 +2（平时 +1），换句重选后再算一次。` : ''}`));
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
      ['攻击', String(Math.round(attack(s)))],
      ['暴击率', `${(critChance(s) * 100).toFixed(1)}%`],
      ['低语纸条上限', '5'],
      ['金币', String(s.gold)],
      ['最高连击', String(s.bestCombo)],
      ['击杀 / 死亡', `${s.stats.kills} / ${s.stats.deaths}`],
    ];
    for (const [k, v] of stats) left.append(h('div.stat', h('span', k), h('b', v)));
    if (owned(s).length) {
      const lo = loadout(s);
      left.append(h('h3', `技能（出战 ${lo.length} / ${slotCount(s.level)} 格，按 T 换）`));
      for (const id of lo) left.append(h('div.slot', h('div.k', POOL[id].zh), h('div.small.muted', `${POOL[id].asks} · ${POOL[id].effect}`)));
    }

    const right = h('div');
    if (!has(s.level, 'gear')) {
      right.append(h('p.muted', '5 级开放装备。'));
      return h('div.grid2', left, right);
    }
    right.append(h('h3', { style: 'margin-top:0' }, '已装备'));
    for (const slot of ['pen', 'coat', 'amulet', 'dict', 'glasses', 'phones'] as Slot[]) {
      const it = s.equipped[slot];
      right.append(
        h(
          'div.slot',
          h('div.k', it ? '' : icon(SLOT_TILE[slot], 1, true, 'slot-icon'), SLOT_ZH[slot]),
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

  private exam: Exam | null = null;

  showExam(e: Exam): void {
    this.exam = e;
    this.show('exam');
    this.speakExam();
  }

  private speakExam() {
    const q = this.exam?.qs[this.exam.at];
    if (q?.say && !this.exam!.over) this.ctrl.speak(q.say);
  }

  private examBody(): HTMLElement {
    const e = this.exam!;
    const wrap = h('div');
    const parts = examParts(e).map((p) => `${PART_ZH[p]} ${e.right[p]} / ${BREAK.perPart}`).join(' · ');
    wrap.append(h('p.small.muted', `每部分对 ${BREAK.pass} 题算过。${parts}`));
    if (e.last) {
      const l = e.last;
      const fb = h(`div.feedback.${l.ok ? 'ok' : 'no'}`, h('b', l.ok ? '对' : '不对'));
      if (!l.ok) fb.append(h('span.note', `正确：${l.q.part === 'write' ? fullForm(l.q.word) : l.q.full ?? l.q.answer}`));
      if (!l.ok && l.q.hint) fb.append(h('span.note', l.q.hint));
      if (!l.ok && l.q.alts && l.q.alts.length > 1) fb.append(h('span.note', `这里填 ${l.q.alts.slice(0, 2).join(' 或 ')} 都对。`));
      if (l.q.say) fb.append(h('span.note', `听到的是：${l.q.say}`));
      wrap.append(fb);
    }
    if (e.over) {
      const ok = examPassed(e);
      wrap.append(
        h('h3', ok ? (e.grammarOnly ? '语法补考通过。' : `${e.stage ?? 'A1'} 突破试炼通过。`) : '这次没过。'),
        h('p', ok ? '考官在你的证件上盖了一个章。等级上限往上走了，存着的经验接着算。' : `每部分要对 ${BREAK.pass} 题。不罚，随时再考，题目会换。`),
        h('div.row', h('button.btn.primary', { onclick: () => this.close() }, '离开')),
      );
      return wrap;
    }
    const q = e.qs[e.at];
    const go = (v: string) => {
      if (!v.trim()) return;
      this.ctrl.examAnswer(e, v);
      this.render();
      this.speakExam();
    };
    wrap.append(h('h3', `${PART_ZH[q.part]} · 第 ${e.at + 1} / ${e.qs.length} 题`));
    if (q.part === 'listen') {
      wrap.append(h('p', '听，选出意思。'), h('div.row', h('button.btn', { onclick: () => this.ctrl.speak(q.say!) }, '🔊 再听一遍')));
    } else if (q.part === 'read') wrap.append(h('p', '选出空里的词。'), h('div.focus', { style: 'font-size:22px;margin:10px 0' }, q.prompt));
    if (q.part === 'grammar' && q.options) {
      // A2 / B1 语法段: some items are a contrast to choose (stellen / stehen, wegen / trotz …).
      const row = h('div.choices');
      q.options.forEach((o, i) => row.append(h(`button.btn${i === 0 ? '.exam-first' : ''}`, { onclick: () => go(o) }, `${i + 1}. ${o}`)));
      wrap.append(h('p', '选出空里的词。'), h('div.focus', { style: 'font-size:22px;margin:10px 0' }, q.prompt), q.zh ? h('div.small.muted', q.zh) : '', row);
      return wrap;
    }
    if (q.part === 'grammar') {
      // 语法: type into the sentence; the Perfekt has two blanks (auxiliary, participle), sent as "a|b".
      const boxes = (q.blanks ?? ['']).map(() => h('input.exam', { type: 'text', autocomplete: 'off', spellcheck: 'false', placeholder: '填空' }) as HTMLInputElement);
      const send = () => go(boxes.map((b) => b.value.trim()).join('|').replace(/^\|+|\|+$/g, '') ? boxes.map((b) => b.value).join('|') : '');
      boxes.forEach((b, i) =>
        b.addEventListener('keydown', (ev) => {
          if (ev.key !== 'Enter') return;
          ev.preventDefault();
          ev.stopPropagation();
          if (i < boxes.length - 1) boxes[i + 1].focus();
          else send();
        }),
      );
      wrap.append(
        h('p', boxes.length > 1 ? '在句子里填两个空：助动词和分词。' : '在句子里填空。'),
        h('div.focus', { style: 'font-size:22px;margin:10px 0' }, q.prompt),
        q.zh ? h('div.small.muted', q.zh) : '',
        h('div.typing', ...boxes, umlautButtons(boxes[boxes.length - 1]), h('button.btn.primary', { onclick: send }, '写 ↵')),
      );
      return wrap;
    }
    if (q.options) {
      const row = h('div.choices');
      q.options.forEach((o, i) => row.append(h(`button.btn${i === 0 ? '.exam-first' : ''}`, { onclick: () => go(o) }, `${i + 1}. ${o}`)));
      wrap.append(row);
      return wrap;
    }
    const input = h('input.exam', { type: 'text', autocomplete: 'off', spellcheck: 'false', placeholder: hasArticleQuestion(q.word) ? 'der / die / das + 名词' : '写出德语' }) as HTMLInputElement;
    input.addEventListener('keydown', (ev) => {
      if (ev.key === 'Enter') {
        ev.preventDefault();
        ev.stopPropagation();
        go(input.value);
      }
    });
    wrap.append(h('div.focus', { style: 'font-size:28px;margin:10px 0' }, q.prompt), h('div.typing', input, umlautButtons(input), h('button.btn.primary', { onclick: () => go(input.value) }, '写 ↵')));
    return wrap;
  }

  private asking: { title: string; prompt: string; onAnswer: (text: string, spoken?: boolean) => void; multi?: boolean; voice?: boolean } | null = null;

  /** One free-text answer (the night guard's formal question in 零号站台). `multi`: a few sentences (小作文). */
  ask(title: string, prompt: string, onAnswer: (text: string, spoken?: boolean) => void, multi = false, voice = false): void {
    this.asking = { title, prompt, onAnswer, multi, voice };
    this.show('ask');
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

  // ---- 篝火日记 (2026-11-22): write freely; only sure mistakes are pointed out, nothing is graded ----

  private journalState: { words: Word[]; text: string; hints: JournalHint[] | null; saved: number | null } | null = null;

  showJournal(words: Word[]): void {
    this.journalState = { words, text: '', hints: null, saved: null };
    this.show('journal');
  }

  private journalBody(): HTMLElement {
    const j = this.journalState!;
    const wrap = h('div');
    wrap.append(
      h('p', '用下面 3 个今天打过的词（给的是中文，德语要自己想起来）写两三句你自己的话。写什么都行：今天去了哪儿、看见了什么、想要什么。登录后 AI 会批改，每天一篇。'),
      h('p.small.muted', '这里不判对错。「检查」只会指出规则能确定的错：没用到给的词、冠词和名词对不上、ich / du / er 后面的动词形式不对。查不出的就不管。写完记进日记，每天第一篇给一点经验。'),
      h('div.row', ...j.words.map((w) => h('span.tag', `「${w.zh}」${w.art ? '（名词，带冠词）' : ''}`))), // 审查修订: the words in Chinese, so writing them is recall
    );
    if (j.saved !== null) {
      wrap.append(h('div.feedback.ok', j.saved ? `记进日记了。经验 +${j.saved}` : '记进日记了。'), h('pre.small', j.text));
      return wrap;
    }
    const ta = h('textarea.journal', { rows: 5, spellcheck: 'false', autocomplete: 'off', placeholder: 'Heute …', style: 'width:100%;font-size:18px' }) as HTMLTextAreaElement;
    ta.value = j.text;
    ta.oninput = () => (j.text = ta.value);
    const check = () => {
      j.text = ta.value;
      j.hints = checkJournal(j.text, j.words);
      this.render();
    };
    const save = () => {
      j.text = ta.value;
      const hints = checkJournal(j.text, j.words);
      if (hints.some((x) => x.kind === 'short' || x.kind === 'missing')) {
        j.hints = hints;
        this.render();
        return;
      }
      j.saved = this.ctrl.saveJournal(j.words, j.text);
      this.render();
    };
    wrap.append(h('div', ta), h('div', umlautButtons(ta as unknown as HTMLInputElement)));
    if (j.hints) {
      if (!j.hints.length) wrap.append(h('div.feedback.ok', '没查出问题。可以记进日记了。'));
      else wrap.append(h('div.feedback.no', h('ul', ...j.hints.map((x) => h('li', x.text)))));
    }
    wrap.append(
      h(
        'div.row',
        h('button.btn', { onclick: check }, '检查'),
        h('button.btn.primary', { onclick: save, title: '要用到 3 个词、至少两句；冠词和变位的提示不拦你' }, '记进日记'),
      ),
    );
    const s = this.ctrl.state;
    const past = (s.journal ?? []).slice(-3).reverse();
    if (past.length) {
      const det = h('details.small');
      det.append(h('summary', `以前的日记（${(s.journal ?? []).length} 篇）`), ...past.map((e) => h('p.small', h('b', e.day), ' ', e.text)));
      wrap.append(det);
    }
    return wrap;
  }

  // ---- 失语者的遗书 (1.0) ----------------------------------------------------------------

  private letter: { id: string; zh: Set<number> } | null = null;

  showLetter(id: string): void {
    if (!LETTER_BY_ID[id]) return;
    this.letter = { id, zh: new Set() };
    this.show('letter');
  }

  private letterBody(): HTMLElement {
    const lt = this.letter!;
    const l = LETTER_BY_ID[lt.id];
    const s = this.ctrl.state;
    const wrap = h('div.letter-page');
    wrap.append(h('p.small.muted', `${l.region} 区第 ${l.n} 封 · 写信的人：${l.from}${l.main === 'Ilse' && !l.from.includes('Ilse') ? '（Ilse 的信）' : ''}。德语一段一段读，读不懂的段落点「看中文」。`));
    l.de.forEach((para, i) => {
      const row = h('div.letter-para');
      row.append(h('p.letter-de', para));
      if (lt.zh.has(i)) row.append(h('p.small.muted.letter-zh', l.zh[i] ?? ''));
      row.append(
        h('div.letter-acts',
          h('button.btn.ghost.tiny', { onclick: () => { if (lt.zh.has(i)) lt.zh.delete(i); else lt.zh.add(i); this.render(); } }, lt.zh.has(i) ? '收起中文' : '看中文'),
          h('button.btn.ghost.tiny', { title: '听这一段', onclick: () => this.ctrl.speak(para) }, '听'),
        ),
      );
      wrap.append(row);
    });
    if (l.words.length) wrap.append(h('p.small', `本区的词：${l.words.join('、')}`));
    if (l.grammar) wrap.append(h('p.small', `语法：${l.grammar}`));
    if (isRead(s, l.id)) {
      if (l.clue) wrap.append(h('p.small', { style: 'color:var(--gold, #ffcf4a)' }, `线索：${l.clue}`));
      wrap.append(h('p.small.muted', '已收进单词本的「档案」，可以随时重读。'));
    } else wrap.append(h('button.btn.primary', { onclick: () => { this.ctrl.letterRead(l.id); this.render(); } }, `读完了，收进档案（经验 +${Math.round(LETTER_CFG.xpShare * 100)}% 到下一级）`));
    return wrap;
  }

  /** 档案: read letters by region, Ilse's line first. */
  private letterArchive(): HTMLElement | string {
    const a = archive(this.ctrl.state);
    if (!a.byRegion.length) return '';
    const wrap = h('div.sp-sec');
    wrap.append(h('h3', '档案 · 失语者的遗书'));
    if (a.main.length) wrap.append(h('p.small', 'Ilse 的信：', ...a.main.map((l) => h('button.btn.ghost.tiny', { onclick: () => this.showLetter(l.id) }, `${l.region}-${l.n} ${l.title}`))));
    for (const r of a.byRegion) wrap.append(h('p.small', `${r.region} 区（${r.letters.length}/${r.total}）：`, ...r.letters.map((l) => h('button.btn.ghost.tiny', { onclick: () => this.showLetter(l.id) }, l.title))));
    return wrap;
  }

  // ---- 日记残页 (0.6) --------------------------------------------------------------------

  private diary: { scene: string; at: number; misses: number; firstTry: number; revealed: Set<number>; msg: string; readAt: number; readMsg: string } | null = null;

  showDiary(scene: string): void {
    const restored = pageState(this.ctrl.state, scene) === 2;
    const n = blanksOf(DIARY.find((p) => p.scene === scene)!).length;
    this.diary = { scene, at: restored ? n : 0, misses: 0, firstTry: 0, revealed: new Set(), msg: '', readAt: 0, readMsg: '' };
    this.show('diary');
  }

  private diaryBody(): HTMLElement {
    const d = this.diary!;
    const s = this.ctrl.state;
    const page = DIARY.find((p) => p.scene === d.scene)!;
    const lines = pageLines(page);
    const blanks = blanksOf(page);
    const done = d.at >= blanks.length;
    const writer = s.flags.bossKills ? DIARY_WRITER : 'J▒▒▒s K▒▒l▒r';
    const wrap = h('div.diary-page');
    wrap.append(h('p.small.muted', `写日记的人：${writer}。${done ? '' : '把这一页的词填回去（每个空下面是中文，上面的小字是原形）。错两次就亮答案，这一页照样能复原。'}`));
    let k = 0;
    lines.forEach((parts, li) => {
      const row = h(`div.diary-line${done && d.readAt === li && pageState(s, d.scene) === 2 && !s.flags[`diaryRead_${d.scene}`] ? '.reading' : ''}`);
      for (const part of parts) {
        if (typeof part === 'string') {
          row.append(h('span', part));
          continue;
        }
        const i = k++;
        const zh = WORD_BY_ID[part.id]?.zh ?? '';
        const cell = h('span.diary-blank');
        if (part.base && i >= d.at) cell.append(h('small.base', part.base));
        if (i < d.at) cell.append(h(`b.${d.revealed.has(i) ? 'revealed' : 'filled'}`, part.form));
        else if (i === d.at) {
          const input = h('input.diary', { type: 'text', autocomplete: 'off', spellcheck: 'false', style: `width:${Math.max(4, part.form.length + 2)}ch` }) as HTMLInputElement;
          input.addEventListener('keydown', (e) => {
            if (e.key !== 'Enter') return;
            e.preventDefault();
            e.stopPropagation();
            this.diaryAnswer(input.value, part);
          });
          cell.append(input);
        } else cell.append(h('span.hole', '＿'.repeat(Math.min(8, Math.max(2, Math.ceil(part.form.length / 2))))));
        if (i >= d.at) cell.append(h('small.zh', zh));
        row.append(cell);
      }
      if (done) row.append(h('button.btn.ghost.tiny', { title: '听这一句', onclick: () => this.ctrl.speak(lineText(parts)) }, '听'));
      wrap.append(row);
    });
    if (!done) {
      const cur = wrap.querySelector('input.diary') as HTMLInputElement | null;
      if (cur) wrap.append(h('div.typing', umlautButtons(cur), h('button.btn.primary', { onclick: () => this.diaryAnswer(cur.value, blanks[d.at]) }, '填 ↵')));
      wrap.append(h('div.small.muted', `${d.at} / ${blanks.length}`));
    }
    if (d.msg) wrap.append(h('div.feedback.' + (d.msg.startsWith('对') || d.msg.startsWith('复原') ? 'ok' : 'no'), d.msg));
    if (done && pageState(s, d.scene) === 2) {
      if (s.flags[`diaryRead_${d.scene}`]) wrap.append(h('p.small.muted', '这一页已经读过了。可以点「听」再听一遍。'));
      else if (canListen()) {
        const btn = h('button.btn', {}, `按住读第 ${d.readAt + 1} 句（S）`);
        btn.addEventListener('pointerdown', (e) => {
          e.preventDefault();
          void this.diaryReadLine();
        });
        wrap.append(h('p.small', `可选：一句一句读出来（读得像就过，七成的词对上就行），全读完经验 +${DIARY_XP.read}。`), btn);
        if (d.readMsg) wrap.append(h('div.small', d.readMsg));
      } else wrap.append(h('p.small.muted', '朗读要用 Chrome 的麦克风；设置里可以试麦克风。'));
    }
    return wrap;
  }

  private diaryAnswer(value: string, b: DiaryBlank): void {
    const d = this.diary!;
    if (!value.trim()) return;
    if (checkBlank(value, b)) {
      if (d.misses === 0) d.firstTry++;
      if (WORD_BY_ID[b.id]) reviewedByWriting(this.ctrl.state, WORD_BY_ID[b.id]); // 写对就算复习 (rev 51)
      d.msg = `对：${b.form}`;
      d.at++;
      d.misses = 0;
    } else if (++d.misses >= DIARY_MISSES) {
      d.msg = `是「${b.form}」。记住它，接着填。`;
      d.revealed.add(d.at);
      d.at++;
      d.misses = 0;
    } else {
      d.msg = `不对，再想想（还能错 ${DIARY_MISSES - d.misses} 次）`;
    }
    const page = DIARY.find((p) => p.scene === d.scene)!;
    if (d.at >= blanksOf(page).length && pageState(this.ctrl.state, d.scene) !== 2) {
      const xp = this.ctrl.diaryDone(d.scene, d.firstTry);
      d.msg = `复原了这一页。${xp ? `经验 +${xp}（一次填对 ${d.firstTry} 空）` : ''}`;
    }
    this.render();
  }

  private async diaryReadLine(): Promise<void> {
    const d = this.diary;
    const s = this.ctrl.state;
    if (!d || listening() || !canListen() || pageState(s, d.scene) !== 2 || s.flags[`diaryRead_${d.scene}`]) return;
    const lines = pageLines(DIARY.find((p) => p.scene === d.scene)!);
    const at = d.readAt;
    const target = lineText(lines[at]);
    d.readMsg = '录音中……读完松开';
    this.render();
    const heard = await listenOnce({ hold: true });
    if (this.diary !== d || d.readAt !== at) return;
    if (heard === null) d.readMsg = '';
    else if (!heard.length) d.readMsg = '没听清，再读一次（不扣任何东西）';
    else if (!shadowOk(target, heard)) d.readMsg = `听到的是「${heard[0]}」，清晰度 ${clarity(target, heard, lastConfidence)}，再读一次`;
    else {
      d.readAt++;
      d.readMsg = `第 ${at + 1} 句读得像，清晰度 ${clarity(target, heard, lastConfidence)}`;
      if (d.readAt >= lines.length) {
        const xp = this.ctrl.diaryRead(d.scene);
        d.readMsg = `整页读完了。${xp ? `经验 +${xp}` : ''}`;
      }
    }
    this.render();
  }

  // ---- 默写对决 ---------------------------------------------------------------------

  /** 默写对决: after a wrong answer the next word waits until Enter. */

  private screen: ScreenRun | null = null;
  /** 入学测试 / 分级考核: run is null while picking the starting band. */
  private place: { run: PlaceRun | null; daily: boolean; hold: boolean; board?: PickBoard; picked: Set<string> } | null = null;

  showPlacement(daily: boolean): void {
    this.place = { run: null, daily, hold: false, picked: new Set() };
    this.show('place');
  }

  private placeBody(): HTMLElement {
    const pl = this.place!;
    const wrap = h('div');
    const run = pl.run;
    if (!run) {
      // Lucas 11-26: whole words to click instead of truncated band lines; invented words mixed in; the typing check
      // then starts where the clicks point.
      if (!pl.board) pl.board = this.ctrl.placeBoard();
      const board = pl.board;
      const picked = pl.picked;
      const count = h('span.small.muted', `已点 ${picked.size} 个`);
      wrap.append(
        h('div.place-head', portrait('考官', 3) ?? '', h('div', h('div.place-say', '「Was kannst du schon?」'), h('div.small.muted', '先点出你认识的词（知道大概意思就算），我从你认识到的地方开始考几道打字题确认。会的直接斩杀，测出的等级只会往上调，随时可以结束。里面混了几个不存在的词，别乱点。'))),
        h('p.place-ask', '点出你认识的词：'),
      );
      const groups: Array<[string, number, number]> = [['A1', 1, 30], ['A2', 31, 80], ['B1', 81, 120], ['B2', 121, 160]];
      for (const [label, glo, ghi] of groups) {
        const tiles = board.items.filter((it) => {
          const lo = bandRange(it.band)[0];
          return lo >= glo && lo <= ghi;
        });
        if (!tiles.length) continue;
        const grid = h('div.place-words');
        for (const it of tiles) {
          const btn = h(`button.place-word-tile${picked.has(it.key) ? '.on' : ''}`, {}, it.label) as HTMLButtonElement;
          btn.onclick = () => {
            if (picked.has(it.key)) picked.delete(it.key);
            else picked.add(it.key);
            btn.classList.toggle('on', picked.has(it.key));
            count.textContent = `已点 ${picked.size} 个`;
          };
          grid.append(btn);
        }
        wrap.append(h('div.place-stage', label), grid);
      }
      wrap.append(
        h(
          'div.row',
          { style: 'margin-top:12px;align-items:center;gap:10px' },
          h('button.btn.primary', { onclick: () => this.ctrl.placeFromPicks(board, picked) }, '点好了，开始确认 →'),
          h('button.btn', { onclick: () => this.ctrl.placeStart(0) }, '不点了，从头开始测'),
          count,
        ),
      );
      return wrap;
    }
    const top = topPassed(run);
    const lv = levelFor(top);
    if (run.outcome) {
      const o = run.outcome;
      const rz = o.region === 1 ? '余烬营地' : AREAS.find((a) => a.region === o.region)?.zh ?? '';
      wrap.append(
        h('h3', o.gained.length ? `测完了：从 ${o.level} 级起步，进第 ${o.region} 区「${rz}」。` : top < 0 ? '测完了：从头开始最合适。' : `测完了：你现在的等级已经够了（测出 ${levelFor(top)} 级）。`),
        h('p', `写对 ${o.retired} 个，直接斩杀。` + (o.half ? `冠词或拼写差一点的 ${o.half} 个记成半名，野外再写对一次就归名。` : '')),
        o.gaps ? h('p', `会的那几段里有 ${o.gaps} 个词没写出来或没点，它们会作为复习怪跟着你，按你的等级出、经验照拿。`) : '',
        o.placed ? h('p', `没抽到的 ${o.placed} 个词先算你会了（推定会）。之后每场战斗可能抽查一道：写对就斩杀，写错就变成复习怪。想快点清掉，可以找考官做全量筛选。`) : '',
        h('div.row', h('button.btn.primary.duel-next', { onclick: () => this.close() }, '出发 ↵')),
      );
      return wrap;
    }
    const [lo, hi] = bandRange(run.band);
    const need = run.extended ? PLACE.per + PLACE.extra : PLACE.per;
    const mine = run.results.filter((r) => r.band === run.band).slice(-run.asked);
    const pips = h('div.place-pips', ...Array.from({ length: need }, (_, k) => h(`i${mine[k] ? (mine[k].res === 'ok' || mine[k].res === 'half' ? '.ok' : '.no') : ''}`)));
    wrap.append(h('div.place-progress', h('b', `${lo}–${hi} 级`), pips, h('span.small.muted', `目前测出：${top < 0 ? '从头开始' : `${lv} 级起步（第 ${regionFor(lv)} 区）`}`)));
    const c = run.claim;
    if (c && !run.results.length)
      wrap.append(
        h(
          'p.small.muted',
          (c.top < 0 ? '你点的词不多，从头开始考。' : `按你点的词，先从 ${bandRange(c.top)[0]}–${bandRange(c.top)[1]} 级考起：答得好往上走，答不上往下退。`) +
            (c.fakes.length ? `你点了 ${c.fakes.length} 个不存在的词（${c.fakes.join('、')}），起点往下调了。` : ''),
        ),
      );
    const l = run.last;
    if (l) {
      const fb = h(`div.feedback.${l.res === 'ok' ? 'ok' : 'no'}`);
      if (l.res === 'ok') fb.append(h('b', `✓ ${fullForm(l.word)}`));
      else if (l.res === 'half') fb.append(h('b', `差一点 · ${fullForm(l.word)}`), h('span.note', `你写的：${l.input}`), ...l.verdict.notes.slice(0, 1).map((n) => h('span.note', n)));
      else if (l.res === 'skip') fb.append(h('b', `不会 · ${fullForm(l.word)}`));
      else fb.append(h('b', `✗ ${fullForm(l.word)}`), h('span.note', `你写的：${l.input}`));
      wrap.append(fb);
    }
    if (run.over) {
      wrap.append(h('div.row', h('button.btn.primary.duel-next', { onclick: () => this.ctrl.placeFinish(run, pl.daily) }, '看结果 ↵')));
      return wrap;
    }
    if (pl.hold && l && l.res !== 'ok') {
      const next = h('button.btn.primary.duel-next', { onclick: () => { pl.hold = false; this.render(); } }, '下一个 ↵') as HTMLButtonElement;
      next.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          e.stopPropagation();
          next.click();
        }
      });
      wrap.append(h('div.row', next));
      return wrap;
    }
    const w = run.current!;
    const input = h('input.duel', { type: 'text', autocomplete: 'off', spellcheck: 'false', placeholder: w.art ? 'der / die / das + 名词' : '写出德语' }) as HTMLInputElement;
    const go = () => {
      if (!input.value.trim()) return;
      this.ctrl.placeAnswer(run, input.value);
      pl.hold = run.last?.res !== 'ok' && !run.over;
      this.render();
    };
    const skip = () => {
      this.ctrl.placeAnswer(run, '', true);
      pl.hold = false;
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
      h('div.place-word', zhWithPos(w)),
      h('div.place-typing', input, h('button.btn.primary', { onclick: go }, '写 ↵'), h('button.btn', { onclick: skip }, '不会')),
      h('div.place-typing', umlautButtons(input)),
      h('div.place-typing', h('button.btn.ghost.small', { onclick: () => { this.ctrl.placeStop(run); this.render(); } }, '后面都不会了，结束')),
    );
    return wrap;
  }

  /** Called by the controller once a run starts or its outcome is in. */
  setPlaceRun(run: PlaceRun): void {
    if (!this.place) return;
    this.place.run = run;
    this.place.hold = false;
    this.render();
  }
  private screenHold = false;

  /** 主城全量筛选 (0.6.x): one word at a time, Chinese only, no damage, no timer. */
  showScreen(run: ScreenRun): void {
    this.screen = run;
    this.screenHold = false;
    this.show('screen');
  }

  private screenBody(): HTMLElement {
    const run = this.screen!;
    const s = this.ctrl.state;
    const scopeZh = run.scope === 'all' ? '全部' : `第 ${run.scope} 区`;
    const wrap = h('div');
    wrap.append(h('p.small.muted', `${scopeZh} · 这次斩杀 ${run.cut.length} 个 · 跳过 ${run.skipped} · 写错 ${run.wrong}。只给中文，名词连冠词写，必须完全写对；不扣血、不限时，随时离开，进度会保存。`));
    const l = run.last;
    if (l) {
      const fb = h(`div.feedback.${l.ok ? 'ok' : 'no'}`);
      if (l.ok) {
        const w = l.wrote ?? l.word;
        if (l.pend) fb.append(h('b', `✓ 写对了 · ${fullForm(w)}`), h('span.note', '之前在这里看过它的答案，所以先记「待验证」：明天在野外再写对一次就斩杀'));
        else fb.append(h('b', `✓ 斩杀 · ${fullForm(w)}`), h('span.note', l.scene ? `经验存在「${l.scene.zh}」，到那里领` : l.placed ? '入学测试推定你会，这下确认了（等级已经按它给过，不另存经验）' : '它已经斩杀过了'));
        for (const n of l.verdict?.notes ?? []) fb.append(h('span.note', n));
      } else if (l.skipped) fb.append(h('b', '这个留到野外学。'));
      else
        fb.append(
          h('b', '这个留到野外学。'),
          h('span.note', `你写的：${l.input || '（空）'}`),
          h('span.note', h('b', `正确写法：${fullFormLong(l.word)}`)),
        );
      wrap.append(fb);
    }
    const summary = () => {
      const lines: Array<HTMLElement | string> = [];
      for (const r of [1, 2, 3]) {
        if (run.scope !== 'all' && run.scope !== String(r)) continue;
        const x = regionLeft(s, r);
        lines.push(h('p', `第 ${r} 区：归名 ${x.learned} 个，还剩 ${x.left} 个要学（共 ${x.total} 个）。`));
        // A region more than half retired → the placement test can move you up.
        if (x.left * 2 < x.total && this.ctrl.canPlaceNow())
          lines.push(h('div.row', h('button.btn.primary', { onclick: () => { this.close(); this.ctrl.openPlacement(true); } }, `第 ${r} 区的词你大多会了，可以试试分级考核 →`)));
      }
      return lines;
    };
    if (run.over) {
      wrap.append(h('h3', `这次斩杀 ${run.cut.length} 个词。${run.current ? '' : `${scopeZh}这一轮问完了。`}`), ...summary(), h('div.row', h('button.btn', { onclick: () => this.close() }, '离开')));
      return wrap;
    }
    if (this.screenHold && l && !l.ok) {
      const next = h('button.btn.primary.duel-next', { onclick: () => { this.screenHold = false; this.render(); } }, '下一个 ↵') as HTMLButtonElement;
      next.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          e.stopPropagation();
          next.click();
        }
      });
      wrap.append(h('div.row', next));
      return wrap;
    }
    const w = run.current!;
    const input = h('input.duel', { type: 'text', autocomplete: 'off', spellcheck: 'false', placeholder: w.art ? 'der / die / das + 名词' : '写出德语' }) as HTMLInputElement;
    const go = () => {
      if (!input.value.trim()) return;
      this.ctrl.screenAnswer(run, input.value);
      this.screenHold = !run.last?.ok;
      this.render();
    };
    const skip = () => {
      this.ctrl.screenAnswer(run, '', true);
      this.screenHold = false;
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
      h('div.place-word', zhWithPos(w)),
      h('div.typing', input, umlautButtons(input), h('button.btn.primary', { onclick: go }, '写 ↵'), h('button.btn', { onclick: skip }, '不会，下一个')),
      run.cut.length || run.skipped || run.wrong ? h('details', h('summary.small.muted', '结算'), ...summary()) : '',
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
        if (this.ctrl.state.settings.chestAnim !== false) playChest({ kind: c.kind, title: `${CHEST_ZH[c.kind]} · ${c.result.ok ? '锁开了，品质各掷两次' : '锁没认出来，箱子照样打开'}`, result: c.result }, () => {}, this.ctrl.chestSfx);
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
    for (const sl of ['pen', 'coat', 'amulet', 'dict', 'glasses', 'phones'] as Slot[]) wishSlot.append(h('option', { value: sl, selected: shop.wish.slot === sl }, SLOT_ZH[sl]));
    const wishAffix = h('select', { onchange: (e: Event) => { shop.wish.affix = ((e.target as HTMLSelectElement).value || undefined) as AffixKey | undefined; this.ctrl.persist(); } }) as HTMLSelectElement;
    wishAffix.append(h('option', { value: '' }, '任意词条'));
    for (const k of Object.keys(AFFIX_ZH) as AffixKey[]) wishAffix.append(h('option', { value: k, selected: shop.wish.affix === k }, AFFIX_ZH[k](0).replace(/[+\-]?0(\.0)?%?/, '').trim() || k));
    wrap.append(h('div.hud-row.small', h('span.muted', '心愿单（刷新时出现的概率约 ×3）：'), wishSlot, wishAffix));

    if (this.shopMsg) wrap.append(h(`div.feedback.${this.shopMsg.tone}`, this.shopMsg.text));

    // 物品栏 (2026-11-22): 纸条 and 药片, one at a time, bought with a German sentence too.
    const cons = h('div.bag');
    for (const k of ['hint', 'tablet'] as Consumable[]) {
      const c = CONSUMABLE[k];
      const line = h('input.buy-line', { type: 'text', value: 'Ich nehme ', autocomplete: 'off', spellcheck: 'false' }) as HTMLInputElement;
      const go = () => {
        const r = this.ctrl.buyConsumable(k, line.value);
        this.shopMsg = r.ok
          ? { text: `Mira：「Gern!」花了 ${r.paid} 金币，现在有 ${itemCount(s, k)} 个${c.zh}。`, tone: 'ok' }
          : r.reason === 'sentence'
            ? { text: `Mira 没听懂。可以说：Ich nehme ${c.acc}.`, tone: 'no' }
            : r.reason === 'full'
              ? { text: `${c.zh}已经带满了（上限 ${itemCap(s, k)}）。`, tone: 'no' }
              : { text: `钱不够：要 ${r.paid} 金币。`, tone: 'no' };
        this.render();
      };
      line.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          e.stopPropagation();
          go();
        }
      });
      cons.append(
        h(
          'div.item',
          h('div', h('b', `${c.zh}（${c.de}）`), h('div.small', c.use), h('div.small', `价格 ${itemPrice(s, k)} 金币 · 现有 ${itemCount(s, k)} / ${itemCap(s, k)}`)),
          h('div.typing', line, umlautButtons(line), h('button.btn.primary', { onclick: go }, '买 ↵')),
        ),
      );
    }
    wrap.append(h('h3', '消耗品（用德语说：Ich nehme + 第四格）'), cons);

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
    // 盲盒摊 (0.6, 26 级): read the German label to know what is inside.
    if (s.level >= BLIND_FROM) {
      const boxes = blindBoxes(s, this.ctrl.rng);
      wrap.append(
        h('h3', '盲盒摊（读懂盒子上的德语，就知道里面是什么）'),
        h(
          'div.row',
          { style: 'flex-wrap:wrap;gap:8px' },
          ...boxes.map((b, i) =>
            h(
              'div.panel',
              { style: 'padding:8px 10px;min-width:220px' },
              h('div', { style: 'font-family:var(--mono);color:var(--gold, #ffcf4a)' }, `「${boxLabel(b)}」`),
              h('button.btn.small', {
                disabled: s.gold < boxPrice(s, b),
                onclick: () => {
                  const r = buyBox(s, i, this.ctrl.rng, CONFIG.loot.bagSize);
                  this.shopMsg = r.ok ? { text: `打开盒子：${r.item!.name}`, tone: 'ok' } : { text: r.why ?? '买不了', tone: 'no' };
                  this.ctrl.persist();
                  this.render();
                },
              }, `买（${boxPrice(s, b)} 金币）`),
            ),
          ),
        ),
      );
    }
    wrap.append(h('h3', `卖掉或分解背包里的东西（卖价是买价的五分之一；分解得 3 片本区碎片，本区余额 ${s.shardBal?.[String(s.region ?? 1)] ?? 0} 片，在篝火换档）`));
    const bag = h('div.bag');
    for (const it of s.bag) {
      bag.append(h(`div.item.${it.quality}`, h('div', this.itemBody(it)), h('div.acts', h('button.btn.ghost', { onclick: () => this.ctrl.shopSell(it.id) }, `卖 ${sellPrice(s, it)}`), h('button.btn.ghost', { title: '分解成本区碎片', onclick: () => this.ctrl.salvageItem(it.id) }, '分解'))));
    }
    if (!s.bag.length) bag.append(h('p.muted.small', '背包是空的。'));
    wrap.append(bag);
    // 流浪商人的俚语卷轴 (50 级; 行商团 merged into the shop).
    if (s.level >= CHARM.slangFrom) {
      const price = this.ctrl.slangPrice();
      const list = h('div.bag');
      for (const x of SLANG.filter((y) => y.source.includes('商人'))) {
        const have = !!s.slang?.[x.id];
        list.append(h('div.item', h('div', h('b', have ? x.de : '俚语卷轴'), h('div.small', `${x.when} · ${x.fx}`)), h('div.acts', have ? h('span.small.muted', '已学会') : h('button.btn.ghost', { disabled: s.gold < price, onclick: () => { this.ctrl.buySlang(x.id); this.render(); } }, `买 ${price}`))));
      }
      wrap.append(h('h3', '俚语卷轴（流浪商人）'), h('p.small.muted', '买下就学会这句俚语，可以选给「俚语」技能。只对写明的场合管用。'), list);
    }
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

  // ---- 技能池 & 天赋树 (游戏设计 十) ----------------------------------------------------------------

  private talents(): HTMLElement {
    const s = this.ctrl.state;
    const wrap = h('div');
    // Skill pool and loadout.
    wrap.append(h('h3', { style: 'margin-top:0' }, `技能池（出战 ${loadout(s).length} / ${slotCount(s.level)} 格）`));
    if (s.level < POOL_FROM) wrap.append(h('p.muted.small', `${POOL_FROM} 级打完第 1 区首领后，导师 Greta 送你墨水风暴和稳住。技能格：10 级 2 格、30 级 3 格、61 级 4 格。`));
    else {
      wrap.append(h('p.small.muted', '技能不花资源，按回合冷却。每个技能都问眼前这只怪的词的另一层。点一下放进或拿出出战栏；战斗里按 R / G / T / Y 放。'));
      const lo = loadout(s);
      const own = owned(s);
      for (const id of POOL_ORDER) {
        const sk = POOL[id];
        const have = own.includes(id);
        const on = lo.includes(id);
        wrap.append(
          h(
            `div.slot${have ? '' : '.dim'}`,
            h('div.k', sk.zh, on ? h('span.tag-on', '出战') : ''),
            h('div.small', { style: 'flex:1' }, `${sk.asks}。${sk.effect}。冷却 ${sk.cd}`),
            have
              ? h('button.btn.small', { disabled: !on && lo.length >= slotCount(s.level), onclick: () => { toggleLoadout(s, id); this.ctrl.persist(); this.render(); } }, on ? '拿出' : '带上')
              : h('span.small.muted', `${sk.lv} 级`),
          ),
        );
      }
    }
    // Shared talent tree.
    const pts = talentPoints(s);
    const used = spent(s);
    wrap.append(h('h3', `天赋（已用 ${used} / ${pts} 点）`));
    if (s.level < TALENT_FROM_LEVEL) {
      wrap.append(h('p.muted.small', `${TALENT_FROM_LEVEL} 级起每 2 级得 1 点天赋（31–120 级每 3 级 1 点，121 级起每 2 级 1 点）。`));
      return wrap;
    }
    for (const br of Object.keys(BRANCHES) as Branch[]) {
      const row = h('div.talent-row');
      const inBr = spentIn(s, br);
      row.append(h('div.small.muted', `${BRANCHES[br].zh}（${BRANCHES[br].about}）· 已点 ${inBr}`));
      for (let r = 1; r <= 5; r++) {
        const nodes = TALENT_TREE.filter((x) => x.branch === br && x.row === r);
        const open = inBr >= ROW_GATE[r];
        row.append(h('div.small.muted', r === 5 ? `大天赋（这一支点满 ${ROW_GATE[5]} 点）` : r === 1 ? '第 1 排' : `第 ${r} 排（这一支点满 ${ROW_GATE[r]} 点${open ? '' : '，还没开'}）`));
        for (const t of nodes) {
          const k = learned(s, t.id);
          const grey = t.pending ? `（${t.pending}，点了暂不生效）` : t.from && s.level < t.from ? `（${t.from} 级起生效）` : '';
          row.append(
            h(
              `div.slot${k && !grey ? '' : '.dim'}`,
              h('div.k', `${t.big ? '★ ' : ''}${t.zh} ${k}/${t.max}`),
              h('div.small', `${t.desc(Math.max(1, k))}${grey}`),
              h('button.btn.small', { disabled: !canLearn(s, t), onclick: () => { learn(s, t.id); this.ctrl.persist(); this.render(); } }, '点'),
            ),
          );
        }
      }
      wrap.append(row);
    }
    // 外圈：语法星位 (141+).
    wrap.append(h('h3', `语法星位（${litStars(s).length} / ${STARS.length} 已点亮）`));
    if (s.level < STARS_FROM) wrap.append(h('p.muted.small', `${STARS_FROM} 级起：每个星位是一条语法。先过这条语法的试炼（${STAR_TRIAL.n} 题对 ${STAR_TRIAL.pass}，不挨打、随时重考），再花 1 点点亮：这条语法的题伤害 +10%，答错连击只减半；每点亮 5 个生命 +3%。`));
    else {
      const row = h('div.talent-row');
      for (const st of STARS) {
        const lit = litStars(s).includes(st.id);
        const passed = starsPassed(s).includes(st.id);
        row.append(
          h(
            `div.slot${lit ? '' : '.dim'}`,
            h('div.k', `${lit ? '✦' : passed ? '✧' : '·'} ${st.zh}`),
            h('div.small', lit ? '已点亮' : passed ? '试炼已过，可以点亮' : '还没过试炼'),
            lit ? '' : passed
              ? h('button.btn.small', { disabled: !canLight(s, st.id), onclick: () => { lightStar(s, st.id); this.ctrl.persist(); this.render(); } }, '点亮')
              : h('button.btn.small', { onclick: () => this.runStarTrial(st.id, st.zh) }, '试炼'),
          ),
        );
      }
      wrap.append(row);
    }
    // 言灵精通 (满级后).
    if (s.level >= CONFIG.levelCap || masteryPts(s.flags) > 0) {
      wrap.append(h('h3', `言灵精通（可用 ${masteryFree(s.flags)} / 共 ${masteryPts(s.flags)} 点）`));
      wrap.append(h('p.muted.small', '满级后每攒满一级的经验得 1 点；裂隙深层第一次到达每 10 层也给 1 点。'));
      const row = h('div.talent-row');
      for (const t of Object.keys(MASTERY) as MasteryTrack[]) {
        const m = MASTERY[t];
        const n = masteryIn(s.flags, t);
        row.append(
          h(
            'div.slot',
            h('div.k', `${m.zh} ${n} / ${m.max}`),
            h('div.small', `+${Math.round(n * m.per * 1000) / 10}%（每点 +${m.per * 100}%）`),
            h('button.btn.small', { disabled: masteryFree(s.flags) <= 0 || n >= m.max, onclick: () => { spendMastery(s.flags, t); this.ctrl.persist(); this.render(); } }, '加点'),
          ),
        );
      }
      wrap.append(row);
    }
    wrap.append(h('p.small.muted', '洗点：在导师 Greta 那里花一小时的金币。'));
    return wrap;
  }

  /** 语法星位试炼: 8 questions one after another in the answer box; 6 right passes. */
  private runStarTrial(id: string, zh: string): void {
    const s = this.ctrl.state;
    const tasks = starTrial(s, id, Math.random);
    if (!tasks) {
      this.ask(`试炼 · ${zh}`, `你见过的这类句子还不够 ${STAR_TRIAL.n} 句。多打一些用到「${zh}」的怪再来。（随便写点什么关掉）`, () => this.show('talents'));
      return;
    }
    const answers: string[] = [];
    const next = (i: number) => {
      if (i >= tasks.length) {
        const r = finishStarTrial(s, id, tasks, answers);
        this.ctrl.persist();
        this.ask(`试炼 · ${zh}`, `${r.right} / ${tasks.length} 题对。${r.passed ? '过了：回天赋页花 1 点点亮它。' : `差一点，要对 ${STAR_TRIAL.pass} 题。随时可以重考。`}（随便写点什么关掉）`, () => this.show('talents'));
        return;
      }
      const t = tasks[i];
      const opts = t.options ? `\n可选：${t.options.join(' / ')}` : '';
      this.ask(`试炼 · ${zh}（${i + 1} / ${tasks.length}）`, `${t.prompt}\n${t.focus}${opts}`, (text) => {
        if (!text.trim()) return; // closed: the trial stops, nothing counted
        answers.push(text.trim());
        next(i + 1);
      });
    };
    next(0);
  }

  private itemBody(it: Item): HTMLElement {
    return h(
      'div',
      { style: 'flex:1' },
      h(`div.item-name.${it.quality}`, icon(SLOT_TILE[it.slot], 1, false, `slot-icon q-${it.quality}`), `${it.name}`, h('span.small.muted', `  ${QUALITY_ZH[it.quality]} · ${SLOT_ZH[it.slot]} · 物品等级 ${it.ilvl}`)),
      h('div.small', mainStatText(it)),
      it.tier ? h('div.small', { style: 'color:var(--gold, #ffcf4a)' }, `第 ${it.tier} 档（${it.region ?? '?'} 区）${it.slot === 'pen' ? `：伤害 +${Math.round(it.tier * CONFIG.gear.dmg * 100)}%` : it.slot === 'coat' ? `：生命 +${Math.round(it.tier * CONFIG.gear.hp * 100)}%` : it.slot === 'amulet' ? `：穿透 +${Math.round(it.tier * CONFIG.gear.pen * 100)}%` : ''}（在下一区减半，再往后不算）`) : '',
      ...(it.unidentified ? [h('div.aff', { style: 'color:var(--muted)' }, `未鉴定：${it.affixes.length} 条词缀还没生效（找 Mira 鉴定）`)] : it.affixes.map((a) => h('div.aff', AFFIX_ZH[a.key](a.value)))),
      it.socket === undefined ? '' : h('div.aff', { style: 'color:var(--gold, #ffcf4a)' }, it.socket === '' ? '语气词孔：空的（找导师 Greta 刻 auch、denn，45 级起 mal、doch）' : it.socket === 'auch' ? '语气词 auch：齐鸣打到的其他怪伤害 +20%' : it.socket === 'denn' ? '语气词 denn：难题答对伤害 +20%' : it.socket === 'mal' ? '语气词 mal：终结技整句在请求句里用上 mal，伤害 +20%' : '语气词 doch：终结技整句里用上 doch，伤害 +20%'),
      it.gem ? h('div.aff', { style: 'color:#7fd6ff' }, `${QUALITY_ZH[it.gem.q]}${gemText(it.gem)}`) : '',
      it.legendary ? h('div.aff', { style: 'color:var(--q-orange)' }, `传说：${LEGENDARY[it.legendary].zh}——${LEGENDARY[it.legendary].fx}`) : '',
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
    const pages = DIARY.filter((p) => pageState(s, p.scene));
    const diaryRow = h('div.small', h('b', `日记残页 ${pages.length} / ${DIARY.length} `));
    if (!pages.length) diaryRow.append(h('span.muted', '一个场景的一组词全到半名，就掉一页邻居的日记。'));
    for (const p of pages) {
      const st = pageState(s, p.scene);
      diaryRow.append(h(`button.btn.tiny${st === 2 ? '.ghost' : ''}`, { title: SCENE_BY_ID[p.scene]?.zh ?? '', onclick: () => this.showDiary(p.scene) }, `${pageRegion(p.scene)}-${pageNo(p.scene)}${st === 2 ? (s.flags[`diaryRead_${p.scene}`] ? ' ✓读' : ' ✓') : ' 待复原'}`));
    }
    wrap.append(diaryRow);
    const notes = NOTES.filter((n) => s.flags[`note_${n.id}`]);
    if (notes.length) wrap.append(h('div.small', h('b', '纸条 '), ...notes.map((n) => h('p.small', `【${n.zh}】${n.text}`))));
    const filters = h('div.tabs');
    const fams = [['all', '全部'], ...Object.values(FAMILIES).map((f) => [f.id, f.zh])];
    for (const [id, zh] of fams)
      filters.append(h(`button.btn${this.codexFilter === id ? '.on' : ''}`, { onclick: () => { this.codexFilter = id; this.render(); } }, zh));
    wrap.append(filters);
    const grid = h('div.codex');
    const t = now(s);
    let unseen = 0;
    for (const w of WORDS) {
      if (this.codexFilter !== 'all' && w.family !== this.codexFilter) continue;
      const st = stageOf(s, w, t);
      const seen = st > 0;
      // 0.8.4: words not met yet are only counted (a new character used to open a wall of 「？？？」 cards).
      if (!seen) {
        unseen++;
        continue;
      }
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
          seen && reflNote(w) ? h('div.small.muted', reflNote(w)) : '',
        ),
      );
    }
    if (grid.childElementCount) wrap.append(grid);
    else wrap.append(h('p.muted', '还没遇见过这一类的怪。出去打几只吧。'));
    if (unseen) wrap.append(h('p.small.muted', { style: 'margin-top:10px' }, `还有 ${unseen} 个词没遇见过，遇见后会出现在这里。`));
    return wrap;
  }

  // ---- 词表导入 (2026-11-22): bring a word list from another app; only changes what you meet first ----

  private importBox(): HTMLElement {
    const s = this.ctrl.state;
    const box = h('div.import-box');
    const imp = s.wordImport;
    const file = h('input', { type: 'file', accept: '.csv,.tsv,.txt,.xlsx,text/csv,text/plain', hidden: true }) as HTMLInputElement;
    file.onchange = async () => {
      const f = file.files?.[0];
      if (!f) return;
      try {
        const table = await readTable(f);
        const r = matchRows(table, WORDS);
        if (!r.rows) {
          toast('没在这个文件里找到单词');
          return;
        }
        s.wordImport = mergeImport(s.wordImport, r);
        this.ctrl.persist();
        toast(`读了 ${r.rows} 个词：${r.matched.length} 个游戏里有，标成优先；${r.missing.length} 个游戏里还没有，放进待收录${r.skipped ? `；表里有排名，只取了排名最前的 ${r.rows} 个` : ''}`);
        this.render();
      } catch {
        toast('读不了这个文件。请导出成 CSV（或 Language Reactor 的 xlsx）再试');
      }
    };
    const n = imp?.ids.length ?? 0;
    const learned = (imp?.ids ?? []).filter((id) => s.words[id]).length;
    box.append(
      h('h3', '导入要学的词'),
      h('p.small.muted', '从 Language Reactor、Anki、Excel 导出 CSV（或 Language Reactor 的 xlsx），游戏里有的词会标成「优先」，在它所在的场景里先出来；还没到那个区的，到了才出现。只改先学哪些词，不加经验和掉落。文件只在你的浏览器里读，不会上传。'),
      h(
        'div.row',
        h('button.btn', { onclick: () => file.click() }, n ? '再导入一个文件' : '选择文件导入'),
        file,
        n || imp?.pending.length
          ? h('button.btn.ghost', { onclick: () => { if (window.confirm('清除导入的优先词和待收录清单？（学习进度不受影响）')) { s.wordImport = undefined; this.ctrl.persist(); this.render(); } } }, '清除导入')
          : null,
      ),
    );
    if (imp && (n || imp.pending.length)) {
      box.append(h('p.small', `优先 ${n} 个（已经见过 ${learned} 个）· 待收录 ${imp.pending.length} 个`));
      if (imp.pending.length) {
        const det = h('details.small');
        det.append(h('summary', '待收录：游戏里还没有的词'), h('p.small.muted', '这些词以后补进词库后会自动标成优先。'), h('p.small', imp.pending.join('、')));
        box.append(det);
      }
    }
    return box;
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
    const cut: Row[] = [];
    for (const w of WORDS) {
      const p = s.words[w.id];
      if (!p) continue;
      if (p.retired) {
        cut.push({ w, p });
        continue;
      }
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
    const pendN = Object.values(s.words).filter((p) => p.pend).length;
    const claims = pendingScenes(s);
    wrap.append(h('p', `已斩杀 ${cut.length} · 待验证 ${pendN}${claims.length ? ` · 待领经验：${claims.map((x) => x.zh).join('、')}` : ''}`));
    wrap.append(h('p.small.muted', `见过 ${shaky.length + learningN + known.length + cut.length} 个词：熟练 ${known.length} · 学习中 ${learningN} · 常错 ${shaky.length}。「认得」是选择题答对过，「会写」是默写、变位或整句写对过。存档同步到云端，换电脑也在。`));
    const table = (title: string, note: string, rows: Row[]) => {
      if (!rows.length) return;
      const tb = h('table.log');
      tb.append(h('tr', h('th', '德语'), h('th', '中文'), h('th', '复数'), h('th', '认得'), h('th', '会写'), h('th', '对 / 错'), h('th', '状态')));
      for (const { w, p } of rows) {
        const g = genderOf(w);
        const gk = g ? { m: 'der', f: 'die', n: 'das', pl: 'pl' }[g] : null;
        const due = p.due <= t && !p.retired;
        tb.append(
          h(
            'tr',
            h('td', h(`span${gk ? '.art-' + gk : ''}`, fullFormLong(w))),
            h('td', w.zh, p.mix?.length ? h('span.small.muted', { title: '词族秘境里答混过' }, ` · 易混：${p.mix.map((x) => WORD_BY_ID[x]?.de ?? x).join('、')}`) : ''),
            h('td', w.pl && w.pl !== '-' ? `die ${w.pl}` : '—'),
            h('td', p.read ? '✓' : '—'),
            h('td', p.write ? '✓' : '—'),
            h('td', `${p.correct} / ${p.wrong}`),
            h('td', p.retired || p.stage === 3 || reviewMon(p, t) ? cutStatus(p, t) : `${STAGE_ZH[p.stage as 0 | 1 | 2 | 3] ?? ''} · ${cutStatus(p, t)}${due ? ' · 该复习了' : ''}`),
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
    cut.sort((a, b) => a.w.de.localeCompare(b.w.de, 'de'));
    table('已斩杀', '会写的词：不再进复习，也不当委托目标。练出来的斩杀 30 天后回响抽查一次，写对就永久斩杀；入学测试、主城筛选和直接叫名判会的词直接永久，不再抽查。', cut);
    if (s.level >= SAYING_CFG.fromLevel) {
      const got = SAYINGS.filter((x) => s.sayings?.[x.id]);
      const phraseIds = new Set(phraseCards().map((x) => x.id));
      const head = () => h('tr', h('th', '短句'), h('th', '中文'), h('th', '什么时候说'), h('th', '效果'), h('th', ''));
      const tb = h('table.log.text', head());
      const locked = h('table.log.text', h('tr', h('th', '短句'), h('th', '怎么收'), h('th', '效果')));
      const on = new Set(equippedCharms(s).map((c) => c.id));
      const equipBtn = (id: string) => h('button.btn.small' + (on.has(id) ? '.primary' : ''), { onclick: () => { equipCharm(s, id); this.ctrl.persist(); this.render(); } }, on.has(id) ? '已选' : '选这张');
      for (const x of SAYINGS) {
        const c = CHARM_BY_ID[x.id];
        if (s.sayings?.[x.id]) tb.append(h('tr', h('td', `${x.a} ${x.b}`), h('td', x.zh), h('td', x.when), h('td.small', c ? c.fx : ''), h('td', on.has(x.id) ? h('span.small', '这场') : '')));
        else locked.append(h('tr', h('td', `${x.a} ……`), h('td.small.muted', phraseIds.has(x.id) ? '金色「残句」怪：接上、听懂、写出整句' : '接句怪：接上下半句'), h('td.small', c ? c.fx : '')));
      }
      // 还没收到的卡折起来：开局一张都没有时，整页不该被 20 行问号占满。
      const rest = SAYINGS.length - got.length;
      wrap.append(
        h('h3', `短句卡（${got.length} / ${SAYINGS.length}）`),
        h('p.small.muted', `大部分卡从野外金色的「残句」怪身上掉；怪的词正好在这句里时，接句怪也会喊它。「短句」技能每场从你收到的卡里轮换抽一张（10 级前自动带上，之后要在技能格里带上）：战斗里打出整句生效，每场一次；${s.level < CHARM.bonusFrom ? '33 级前喊一次占一回合' : '不占回合'}。`),
        got.length ? tb : h('p.small.muted', '还没有收到短句卡。'),
        rest ? h('details', h('summary.small', `还没收到的 ${rest} 张（看看能从哪儿收）`), locked) : '',
      );
      if (s.level >= CHARM.slangFrom) {
        const st = h('table.log');
        st.append(h('tr', h('th', '俚语'), h('th', '中文'), h('th', '场合'), h('th', '效果'), h('th', '')));
        for (const x of SLANG) {
          const have = !!s.slang?.[x.id];
          st.append(h('tr', h('td', have ? x.de : '……'), h('td', have ? x.zh : '？'), h('td', x.when ?? ''), h('td.small', have ? x.fx : x.source), h('td', have ? equipBtn(x.id) : '')));
        }
        wrap.append(h('h3', `俚语（${SLANG.filter((x) => s.slang?.[x.id]).length} / ${SLANG.length}）`), h('p.small.muted', '在这里选一条给「俚语」技能（要在技能格里带上）。只对写明的场合管用；用错场合会反噬：不生效，本场下一次答错伤害 +50%。'), st);
      }
    }
    if (!Object.keys(s.words).length) wrap.append(h('p', '还没有见过的词。出去打几只怪吧。'));
    wrap.append(this.letterArchive());
    // Importing a word list is a one-off setup step: it sits at the end, after the player's own words (0.8 UI pass).
    wrap.append(this.importBox());
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
      wrap.append(h('h3', '选一个外观'), h('p.small.muted', '你在地图上的样子。之后在篝火旁可以免费改。'), pick.el, h('button.btn.primary', { onclick: () => { this.ctrl.setLook(pick.value()); this.render(); } }, '就这样'));
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
      wrap.append(h('h3', '起个昵称'), h('p.small.muted', '排行榜和聊天只显示昵称和等级，不显示邮箱。'), h('div.row', nick, h('button.btn.primary', { onclick: () => void saveNick() }, '保存')), msg);
      return wrap;
    }
    wrap.append(h('h3', `排行榜 · 你是 ${cloud.profile.nickname}`));
    const kinds: BoardKind[] = ['daily', 'total', 'gram'];
    const HEAD: Record<BoardKind, [string, string]> = { daily: ['今天答对', ''], total: ['已归名', '等级'], gram: ['语法试炼', '语法正确率'] };
    const NOTE: Record<BoardKind, string> = {
      daily: '今天（柏林时间）答对的题数，零点清零。只比学习量。',
      total: '归名（或考核里写对直接毕业）的词数。',
      gram: `通过的语法星位试炼和阶段突破数；答过 ${BOARD.gramMin} 道语法题才上榜，旁边是语法题正确率。`,
    };
    const table = h('table.log');
    const note = h('p.small.muted');
    const tabs = h('div.row');
    const load = (k: BoardKind) => {
      tabs.replaceChildren(...kinds.map((x) => h(`button.btn.small${x === k ? '.primary' : ''}`, { onclick: () => load(x) }, BOARD_ZH[x])));
      note.textContent = NOTE[k] + ' 数据在你同步存档时更新（最多晚半分钟）。';
      clear(table).append(h('tr', h('td', { colspan: 4 }, '加载中…')));
      leaderboard(k)
        .then((rows) => {
          const [a1, a2] = HEAD[k];
          clear(table).append(h('tr', h('th', '#'), h('th', '昵称'), h('th', a1), a2 ? h('th', a2) : null));
          if (!rows.length) table.append(h('tr', h('td', { colspan: 4 }, '还没有人上榜。')));
          for (const r of rows)
            table.append(h(`tr${r.me ? '.me' : ''}`, h('td', r.pos), h('td', `${r.nickname} Lv${r.level}${r.me ? '（你）' : ''}`), h('td', r.score), a2 ? h('td', k === 'gram' ? `${r.extra}%` : r.extra) : null));
        })
        .catch(() => clear(table).append(h('tr', h('td', { colspan: 4 }, '排行榜加载失败，可能是断网了。'))));
    };
    const hide = h('input', { type: 'checkbox' }) as HTMLInputElement;
    hide.checked = !!s.settings.hideBoard;
    hide.onchange = () => {
      s.settings.hideBoard = hide.checked;
      this.ctrl.persist();
      void track();
      void push(s);
    };
    wrap.append(tabs, table, note, h('label.toggle', hide, h('span', '隐身'), h('span.small.muted', '不上排行榜，也不算进「当前在线」；聊天照样能看能说')));
    load('daily');
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
      const MS: Record<string, string> = { lv: '升到', q_: '题型：', mv_: '招式：', m_: '遇到：', z_: '第一次在这片打怪：', gear: '装备升到第', drop: '第一次掉装备', card: '第一张短句卡', guiming: '第一次归名', duel: '第一次默写对决', screen: '第一次全量筛选', cut: '第一次斩杀', bonfire: '第一次篝火休息', shadow: '第一次跟读成功' };
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
    const toggle = (label: string, key: 'tts' | 'autoZh' | 'chestAnim' | 'realtime' | 'realtimeSlow' | 'quiet', note: string) => {
      const cb = h('input', { type: 'checkbox' }) as HTMLInputElement;
      cb.checked = key === 'realtimeSlow' || key === 'quiet' ? !!s.settings[key] : s.settings[key] !== false;
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
      toggle('开箱动画', 'chestAnim', '宝箱抖一下再打开，东西一件件飞出来；任意键跳过'),
      slider('音乐', 'music'),
      slider('音效', 'sfx'),
    );
    // 即时战 (81): on by default from 81; turn-based stays available (no quick-answer bonus there).
    if (s.level >= 34) wrap.append(toggle('安静模式', 'quiet', '不方便出声时打开：不出现「说出来」，要开口的内容等你关掉再做'));
    if (s.level >= 81) wrap.append(toggle('即时战', 'realtime', '关掉就回到回合制（拿不到快答加成）'), toggle('即时战慢速', 'realtimeSlow', '怪的读条 ×1.5'));
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
    wrap.append(this.pronSetting());
    return wrap;
  }

  /** 发音训练 (2026-11-23): opt-in phoneme model for reading 回音怪 pairs aloud. */
  private pronSetting(): HTMLElement {
    const s = this.ctrl.state;
    const cb = h('input', { type: 'checkbox' }) as HTMLInputElement;
    cb.checked = !!s.settings.pron;
    const st = pronStatus();
    const note = h('span.small.muted', st.status === 'ready' ? '模型已就绪：回音怪的 ü / ö / ch / r 这几类可以读出来打' : st.status === 'loading' ? `下载中… ${Math.round(st.progress * 100)}%` : st.status === 'error' ? `出错了：${st.error}` : `回音怪可以读出来打（读错不罚）。要先下载一个约 ${MODEL_MB} MB 的发音模型，存在浏览器里，录音不上传。建议连 Wi-Fi`);
    const load = () => {
      void loadPron((p) => (note.textContent = `下载中… ${Math.round(p * 100)}%`))
        .then(() => (note.textContent = '模型已就绪：回音怪的 ü / ö / ch / r 这几类可以读出来打'))
        .catch((e) => (note.textContent = `出错了：${(e as Error).message}（可以关掉再打开重试）`));
    };
    cb.onchange = () => {
      s.settings.pron = cb.checked;
      this.ctrl.persist();
      if (cb.checked) load();
    };
    const del = h('button.btn.small', { onclick: async () => { await pronForget(); s.settings.pron = false; this.ctrl.persist(); this.render(); } }, '删除模型');
    return h('label.toggle', cb, h('span', '发音训练'), note, st.status === 'ready' ? del : '');
  }

  private help(): HTMLElement {
    const s = this.ctrl.state;
    const rows: Array<[string, string]> = [
      ['移动', '点地图上的圆点或右边面板里的出口，一站一站走过去（远处去过的会自动走）；M 打开大地图；数字键 1–9 打这个场景里的第几只怪。地址后加 ?oldmap 可以用回 0.4 的自由走动地图'],
      ['互动', '点地图上的篝火、守火人、路牌、门（旧版自由走动地图按 E）'],
      ['面板', 'C 角色和装备 · B 图鉴 · N 单词本 · T 天赋 · J 任务 · H 这页帮助 · Esc 关闭'],
      ['词性三相', '名词怪出手前先选相：1 der · 2 die · 3 das（对这只怪一直有效，随时可以点按钮换）。选对：护甲降一档、回 1 点资源、附带元素；6 级起选错：护甲翻倍、破甲清零。复数怪一律 die'],
      ['战斗', 'A 攻击 · Q 铭刻 · E 齐鸣（只打同相的怪）· F 终结技（言灵满了才出现）· R / G / T / Y 技能（出战栏里的技能，冷却制）· H 吃药片（回血，占一回合）· 群怪时 Tab 换目标 · 答题时 Esc 换招式；答题时 W 低语（用一张纸条给提示，打字时按 ?）；1/2/3 选答案；打字题按 Enter 交卷；结果会自动进下一题（Enter 跳过等待）；Z 看中文；V 再听；S 读出来（5 级起可选：答对后跟着读那句德语，读得像每场多给一次经验，读不好不扣东西；没有麦克风就不显示）'],
      ['变音字母', '点 ä ö ü ß 按钮，或者写 ae oe ue ss（算对，但会提示正确拼法）'],
      ['新词', '第一次见：先出一道选择题教你（同时显示整个词、中文和发音），2 级起下一题就默写。打完还没写过它的，下一场第一题就默写。会的词可以点「我认识它」直接叫名，写对直接永久斩杀'],
      ['归名', '一个词就是一只怪。一般打败它 3 次（认、用、写；打完它几分钟后在原场景重生，一天里就能归名），最后一下要默写带冠词的全名，它才变回原样。第一场就写对、没答错也没用提示，打 2 次就够'],
      ['复习', '归名后按表现复习，每次是战斗里的一道语境题：一次就写对的词 2 天、7 天、30 天各一次，三次都对就不再复习；答错过的词间隔更密，复习答错就重来'],
      ['遗忘之物', '头上有「!」的怪是今天到期的词，经验和掉落更多。篝火休息会刷新所有怪'],
      ['影子', '半透明的怪是还没到期的词：给金币和经验，但不推进归名'],
      ['死亡', '学习进度永远不丢。金币和这一级的经验留在杀死你的那个词上（回响），回去打败它就能捡回；再死一次，上一份回响就散了'],
    ];
    const wrap = h('div');
    for (const [k, v] of rows) wrap.append(h('div.stat', h('span', { style: 'width:90px;flex:none' }, k), h('span', { style: 'text-align:right' }, v)));
    wrap.append(h('p.small.muted', `1–${CONFIG.releaseCap} 级已开放。当前 ${s.level} 级，等级上限 ${levelCapFor(s.flags)}（过突破试炼再往上）。`));
    return wrap;
  }
}
