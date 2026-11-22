import type { BossFight, BossVerdict } from '../core/boss';
import { maxHp } from '../core/state';
import { BOSS as BOSS1 } from '../data/boss';
import { BOSS2 } from '../data/boss2';
import { BOSS3, boardText } from '../data/boss3';
import { LINA } from '../data/lina';
import { WEBER } from '../data/weber';

const MIRA_ID = { name: '商人 Mira · 鉴定', de: 'Mira', healLine: '', healZh: '' };
import type { Controller } from '../game/controller';
import { $, bar, clear, h, umlautButtons } from './dom';

export class BossUI {
  fight: BossFight | null = null;
  private deadline = 0;
  private tick = 0;
  private last: BossVerdict | null = null;
  private lastAnswer = '';
  private waiting = false;

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
    const meta = f.which === 6 ? MIRA_ID : f.which === 5 ? WEBER : f.which === 4 ? LINA : f.which === 3 ? BOSS3 : f.which === 2 ? BOSS2 : BOSS1;
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
    window.clearInterval(this.tick);
    this.waiting = true;
    this.lastAnswer = value;
    this.last = this.ctrl.answerBoss(value, timedOut);
    this.render();
  }

  continue(): void {
    if (!this.fight || !this.waiting) return;
    if (this.fight.outcome) {
      this.ctrl.finishBoss();
      return;
    }
    this.last = null;
    this.ask();
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
    const BOSS = f.which === 6 ? MIRA_ID : f.which === 5 ? WEBER : f.which === 4 ? LINA : f.which === 3 ? BOSS3 : f.which === 2 ? BOSS2 : BOSS1;
    const killed = f.which === 6 ? false : f.which === 5 ? s.flags.weberForms : f.which === 3 ? s.flags.boss3Kills : f.which === 2 ? s.flags.boss2Kills : s.flags.bossKills;
    const pips = h('div.pips');
    for (let i = 0; i < f.maxHp; i++) pips.append(h(`div.pip${i < f.hp ? '' : '.off'}`));
    const letters = Math.round(((f.maxHp - f.hp) / f.maxHp) * s.name.length);
    const plate = s.name.slice(0, letters) + '▒'.repeat(Math.max(0, s.name.length - letters));

    const panel = h('div.panel');
    panel.append(
      h('div.row', { style: 'justify-content:space-between' }, h('span.small.muted', f.which === 6 ? 'Mira 指着一行字：把空填上（写这个词在句子里的形式）' : f.which === 5 ? `登记表 第 ${f.maxHp - f.hp + 1} / ${f.maxHp} 项 · 用完整的句子回答 · 不限时` : `第 ${f.turn} 问 · 用完整的德语句子回答`), h('span.small', `生命 ${s.hp} / ${maxHp(s)}`)),
      bar('hp', s.hp, maxHp(s)),
      h('div.timer', h('i', { style: 'width:100%' })),
    );
    if (!this.waiting) {
      const input = h('input', { type: 'text', autocomplete: 'off', spellcheck: 'false', placeholder: /^(time|way)-/.test(f.current.id) ? '…' : 'Ich …' }) as HTMLInputElement;
      input.style.cssText = 'flex:1 1 300px;background:#000;color:#fff;border:1px solid var(--line-hi);padding:9px 10px;font-size:20px;font-family:var(--mono)';
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          e.stopPropagation();
          this.submit(input.value);
        }
      });
      panel.append(h('div.row', input, umlautButtons(input), h('button.btn.primary', { onclick: () => this.submit(input.value) }, '回答 ↵')));
      window.setTimeout(() => input.focus(), 0);
    } else if (this.last) {
      const v = this.last;
      panel.append(
        h('div.feedback.' + (v.ok ? 'ok' : 'no'), h('b', f.which === 6 ? (v.ok ? '「Genau!」Mira 擦掉灰：词缀亮了，而且每条都挑了更好的那个。' : '「Fast …」Mira 还是帮你把词缀擦亮了。') : f.which === 5 ? (v.ok ? 'Frau Weber 点点头，在表格上写了一行。' : '这一项还没填好，再说一次。') : v.ok ? (f.which === 4 ? '她点点头，在票上打了个孔。' : '它听懂了。名牌上多了一个字母。') : f.which === 4 ? '她皱起眉：「Schwarzfahren!」' : `它没听懂，你受到 ${v.damageTaken} 点伤害。`)),
        this.lastAnswer ? h('div.small.muted', `你说：${this.lastAnswer}`) : '',
        v.note ? h('div.small', v.note) : '',
        !v.ok ? h('div.small', `可以这样说：${v.model}`) : '',
        v.healed ? h('div.small', { style: 'color:var(--bad)' }, '它趁机休息，回复了生命。') : '',
        h('div.small.muted', { style: 'margin-top:6px' }, f.outcome ? '按 Enter 结束' : '按 Enter 继续'),
      );
    }

    clear(el).append(
      h('div.who', `${BOSS.de} · ${BOSS.name}`),
      f.which >= 5 ? '' : h('div', { style: 'text-align:center' }, h('div.figure', '▓▒█▒▓'), h('div.tagplate', plate || '▒▒▒▒')),
      pips,
      f.healing && !this.waiting ? h('div', { style: 'color:var(--bad);font-family:var(--mono);font-size:18px' }, `「${BOSS.healLine}」`) : '',
      f.healing && !this.waiting ? h('div.askzh', BOSS.healZh) : '',
      f.finalAsked && !this.waiting ? h('div.askzh', LINA.finalZh) : '',
      f.delayNow && !this.waiting ? h('div', { style: 'color:var(--bad);font-family:var(--mono);font-size:18px' }, `「${BOSS3.delayLine}」`) : '',
      f.delayNow && !this.waiting ? h('div.askzh', BOSS3.delayZh) : '',
      h('div.ask', f.asked),
      f.current.visual
        ? h('div.tagplate', { style: `font-size:${f.which === 3 ? 18 : 22}px;margin:6px auto;display:inline-block;white-space:pre;text-align:left` }, f.current.visual)
        : f.board
          ? h('div.tagplate', { style: 'font-size:16px;margin:6px auto;display:inline-block;white-space:pre;text-align:left;opacity:.7' }, `Abfahrt\n${boardText(f.board)}`)
          : '',
      h('div.row', { style: 'justify-content:center' }, h('button.btn.ghost.small', { onclick: () => this.ctrl.speak(f.asked) }, '🔊 再听'), h('span.askzh', killed ? '' : `（${f.current.zh}）`)),
      panel,
    );
  }
}
