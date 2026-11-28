import { portrait } from './icons';
import type { BossFight, BossVerdict } from '../core/boss';
import type { BossQuestion } from '../data/boss';
import type { Board } from '../data/boss3';
import { maxHp } from '../core/state';
import { rank } from '../core/classes';
import { VOICE } from '../core/combat';
import { canListen, listenOnce, listening } from './listen';
import { BOSS as BOSS1 } from '../data/boss';
import { BOSS2 } from '../data/boss2';
import { BOSS3, boardText } from '../data/boss3';
import { LINA } from '../data/lina';
import { WEBER } from '../data/weber';
import { LATER_BOSS } from '../data/bossesLater';
import { bossFigure, bossFigureKey } from './bossFigure';

const MIRA_ID = { name: '商人 Mira · 鉴定', de: 'Mira', healLine: '', healZh: '' };
const GRETA_ENG = { name: '导师 Greta · 刻字', de: 'Greta', healLine: '', healZh: '' };
const single = (f: BossFight) => (f.current.id.startsWith('engrave-') ? GRETA_ENG : MIRA_ID);
import type { Controller } from '../game/controller';
import { $, bar, clear, h, umlautButtons } from './dom';

export class BossUI {
  fight: BossFight | null = null;
  private deadline = 0;
  private tick = 0;
  private last: BossVerdict | null = null;
  private lastAnswer = '';
  private waiting = false;
  /** 1.0.12 试玩 23/29: the question just answered, shown (with its feedback) until Enter; answerBoss has already moved on. */
  private shown: { asked: string; current: BossQuestion; board?: Board; turn: number } | null = null;
  private lastTimedOut = false;
  /** Letters gained on the name plate by the last answer (the plate only grows when HP crosses a letter). */
  private gained = 0;

  constructor(private ctrl: Controller) {}

  open(f: BossFight): void {
    this.fight = f;
    this.last = null;
    $('boss').hidden = false;
    this.ask();
  }

  close(): void {
    window.clearInterval(this.tick);
    $('boss').hidden = true;
    this.fight = null;
  }

  private ask() {
    const f = this.fight!;
    this.waiting = false;
    this.deadline = f.seconds ? Date.now() + f.seconds * 1000 : Infinity;
    const meta = f.which === 7 ? LATER_BOSS[f.region!]! : f.which === 6 ? single(f) : f.which === 5 ? WEBER : f.which === 4 ? LINA : f.which === 3 ? BOSS3 : f.which === 2 ? BOSS2 : BOSS1;
    this.ctrl.speak(f.delayNow ? `${BOSS3.delayLine} ${f.asked}` : f.healing ? `${meta.healLine} ${f.asked}` : f.asked);
    this.render();
    window.clearInterval(this.tick);
    this.tick = window.setInterval(() => this.onTick(), 250);
  }

  private onTick() {
    const left = this.deadline - Date.now();
    const t = document.querySelector('#boss .timer') as HTMLElement | null;
    if (t && !this.fight!.seconds) t.hidden = true;
    else if (t) {
      const pct = Math.max(0, left / (this.fight!.seconds * 1000)) * 100;
      (t.firstElementChild as HTMLElement).style.width = `${pct}%`;
      t.classList.toggle('low', pct < 25);
    }
    if (left <= 0 && !this.waiting) this.submit('', true);
  }

  submit(value: string, timedOut = false): void {
    if (!this.fight || this.waiting) return;
    // An empty box is ignored (a double-tapped Enter after 继续), as in normal battles; only the timer submits ''.
    if (!timedOut && !value.trim()) return;
    window.clearInterval(this.tick);
    this.waiting = true;
    this.lastAnswer = value;
    this.lastTimedOut = timedOut;
    const f = this.fight;
    this.shown = { asked: f.asked, current: f.current, board: f.board ? { ...f.board, rows: f.board.rows } : undefined, turn: f.turn };
    const before = this.letters(f);
    this.last = this.ctrl.answerBoss(value, timedOut);
    this.gained = (f.outcome === 'win' ? this.ctrl.state.name.length : this.letters(f)) - before;
    // 天赋「争分」: each right answer in a timed boss dialogue adds a second.
    if (this.last.ok && Number.isFinite(this.deadline) && rank(this.ctrl.state, 'zhengfen')) this.deadline += 1000;
    this.render();
  }

  continue(): void {
    if (!this.fight || !this.waiting) return;
    if (this.fight.outcome) {
      this.ctrl.finishBoss();
      return;
    }
    this.last = null;
    this.shown = null;
    this.ask();
  }

  private letters(f: BossFight): number {
    return Math.round(((f.maxHp - f.hp) / f.maxHp) * this.ctrl.state.name.length);
  }

  onKey(e: KeyboardEvent): boolean {
    if ($('boss').hidden) return false;
    if (this.waiting && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      this.continue();
      return true;
    }
    return false;
  }

  render(): void {
    const f = this.fight!;
    const s = this.ctrl.state;
    const el = $('boss');
    const BOSS = f.which === 7 ? LATER_BOSS[f.region!]! : f.which === 6 ? single(f) : f.which === 5 ? WEBER : f.which === 4 ? LINA : f.which === 3 ? BOSS3 : f.which === 2 ? BOSS2 : BOSS1;
    const killed = f.which === 7 ? s.flags[`boss${f.region}Kills`] : f.which === 6 ? false : f.which === 5 ? s.flags.weberForms : f.which === 3 ? s.flags.boss3Kills : f.which === 2 ? s.flags.boss2Kills : s.flags.bossKills;
    const pips = h('div.pips');
    for (let i = 0; i < f.maxHp; i++) pips.append(h(`div.pip${i < f.hp ? '' : '.off'}`));
    const letters = this.letters(f);
    // While the feedback shows, the screen keeps the question that was answered (answerBoss already drew the next).
    const shown = this.waiting && this.shown ? this.shown : { asked: f.asked, current: f.current, board: f.board, turn: f.turn };
    const plate = s.name.slice(0, letters) + '▒'.repeat(Math.max(0, s.name.length - letters));

    const figKey = bossFigureKey(f.which, f.region);
    const panel = h('div.panel');
    panel.append(
      h('div.row', { style: 'justify-content:space-between' }, h('span.small.muted', f.which === 6 ? (f.current.id.startsWith('engrave-') ? 'Greta 在孔边写了半句话：把小词填上' : 'Mira 指着一行字：把空填上（写这个词在句子里的形式）') : f.which === 5 ? `登记表 第 ${Math.min(f.maxHp - f.hp + 1, f.maxHp)} / ${f.maxHp} 项 · 用完整的句子回答 · 不限时` : `第 ${shown.turn} 问 · 用完整的德语句子回答`), h('span.small', `生命 ${s.hp} / ${maxHp(s)}`)),
      bar('hp', s.hp, maxHp(s)),
      h('div.timer', h('i', { style: 'width:100%' })),
    );
    if (!this.waiting) {
      const input = h('input', { type: 'text', autocomplete: 'off', spellcheck: 'false', placeholder: /^ich /i.test(f.current.model) ? 'Ich …' : '…' }) as HTMLInputElement;
      input.style.cssText = 'flex:1 1 300px;background:#000;color:#fff;border:1px solid var(--line-hi);padding:9px 10px;font-size:20px;font-family:var(--mono)';
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          e.stopPropagation();
          this.submit(input.value);
        }
      });
      // 开口作答: 34 级起可选；83 级起首领对话以开口为主（打字作为退路仍然可以交）.
      const st = this.ctrl.state;
      const canVoice = st.level >= VOICE.from && !st.settings.quiet && canListen();
      const mic = canVoice ? h(st.level >= VOICE.required ? 'button.btn.primary' : 'button.btn', { title: '按住说，松开就交' }, '🎤 说出来') : '';
      if (mic) {
        mic.addEventListener('pointerdown', (e) => {
          e.preventDefault();
          if (listening()) return;
          mic.textContent = '在听……松开就交';
          void listenOnce({ hold: true }).then((heard) => {
            mic.textContent = '🎤 说出来';
            if (heard?.length) this.submit(heard[0]);
          });
        });
      }
      panel.append(h('div.row', input, umlautButtons(input), mic, h(st.level >= VOICE.required && canVoice ? 'button.btn' : 'button.btn.primary', { onclick: () => this.submit(input.value) }, canVoice && st.level >= VOICE.required ? '打字交 ↵' : '回答 ↵')));
      window.setTimeout(() => input.focus(), 0);
    } else if (this.last) {
      const v = this.last;
      panel.append(
        h('div.feedback.' + (v.ok ? 'ok' : 'no'), h('b', f.which === 6 ? (f.current.id.startsWith('engrave-') ? (v.ok ? '字刻进去了。' : '刻歪了，这次没刻上。') : v.ok ? '「Genau!」Mira 擦掉灰：词缀亮了，而且每条都挑了更好的那个。' : '「Fast …」Mira 还是帮你把词缀擦亮了。') : f.which === 5 ? (v.ok ? 'Frau Weber 点点头，在表格上写了一行。' : '这一项还没填好，再说一次。') : v.ok ? (f.which === 4 ? '她点点头，在票上打了个孔。' : `它听懂了。${this.gained > 1 ? `名牌上多了 ${this.gained} 个字母。` : this.gained === 1 ? '名牌上多了一个字母。' : ''}`) : f.which === 4 ? `${this.lastTimedOut ? '时间到了。' : ''}她皱起眉：「Schwarzfahren!」` : this.lastTimedOut ? `时间到了，它不等你了。你受到 ${v.damageTaken} 点伤害。` : v.healed && !v.damageTaken ? '它没听懂。' : `它没听懂，你受到 ${v.damageTaken} 点伤害。`)),
        this.lastAnswer ? h('div.small.muted', `你说：${this.lastAnswer}`) : '',
        v.note ? h('div.small', v.note) : '',
        !v.ok ? h('div.small', `可以这样说：${v.model}`) : '',
        v.healed ? h('div.small', { style: 'color:var(--bad)' }, '它趁机休息，回复了生命。') : '',
        h('div.small.muted', { style: 'margin-top:6px' }, f.outcome ? '按 Enter 结束' : '按 Enter 继续'),
      );
    }

    clear(el).append(
      h('div.who', portrait(BOSS.name) ?? '', `${BOSS.de} · ${BOSS.name}`),
      f.which === 5 || f.which === 6 ? '' : h('div', { style: 'text-align:center' }, figKey ? bossFigure(figKey, f.outcome === 'win' ? 1 : (f.maxHp - f.hp) / f.maxHp) : h('div.figure', '▓▒█▒▓'), h('div', h('div.tagplate', plate || '▒▒▒▒'))),
      pips,
      f.healing && !this.waiting ? h('div', { style: 'color:var(--bad);font-family:var(--mono);font-size:18px' }, `「${BOSS.healLine}」`) : '',
      f.healing && !this.waiting ? h('div.askzh', BOSS.healZh) : '',
      f.finalAsked && !this.waiting ? h('div.askzh', LINA.finalZh) : '',
      f.delayNow && !this.waiting ? h('div', { style: 'color:var(--bad);font-family:var(--mono);font-size:18px' }, `「${BOSS3.delayLine}」`) : '',
      f.delayNow && !this.waiting ? h('div.askzh', BOSS3.delayZh) : '',
      h('div.ask', shown.asked),
      shown.current.visual
        ? h('div.tagplate', { style: `font-size:${f.which === 3 || f.which === 7 ? 18 : 22}px;margin:6px auto;display:inline-block;white-space:pre;text-align:left` }, shown.current.visual)
        : shown.board
          ? h('div.tagplate', { style: 'font-size:16px;margin:6px auto;display:inline-block;white-space:pre;text-align:left;opacity:.7' }, `Abfahrt\n${boardText(shown.board)}`)
          : '',
      h('div.row', { style: 'justify-content:center' }, h('button.btn.ghost.small', { onclick: () => this.ctrl.speak(shown.asked) }, '🔊 再听'), h('span.askzh', killed ? '' : `（${shown.current.zh}）`)),
      panel,
    );
  }
}
