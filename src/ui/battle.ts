import { SAYING_BY_ID } from '../data/sayings';
import type { Battle, Question, TurnReport } from '../core/combat';
import { availableMoves, comboTier, effArmor, moveReady, resName } from '../core/combat';
import { ELEMENT_ZH } from '../core/intents';
import { STAGE_ZH } from '../core/srs';
import { maxHp } from '../core/state';
import type { Move } from '../core/types';
import { FAMILIES } from '../data/families';
import { SKILLS } from '../data/skills';
import { CLASSES, resMax } from '../core/classes';
import { fullForm, genderOf } from '../data/words';
import type { Controller } from '../game/controller';
import { ARTICLE_COLOR, GLITCH } from '../game/sprites';
import { $, bar, clear, h, umlautButtons } from './dom';

type Phase = 'choose' | 'answer' | 'result';

/** 0.4: the Chinese of a monster line without the old intent label in brackets (「别烦我！（要防御）」→「别烦我！」). */
function plainZh(zh: string): string {
  return zh.replace(/（[^）]*）/g, '').trim();
}

const MOVE_INFO: Record<Move, { key: string; zh: string; sub: string }> = {
  attack: { key: 'A', zh: '攻击', sub: '普通题' },
  block: { key: 'S', zh: '格挡', sub: '选择题 · 克攻击' },
  break: { key: 'D', zh: '破防', sub: '默写 · 克防御' },
  sentence: { key: 'F', zh: '终结技', sub: '看中文写整句 · 破甲' },
  inscribe: { key: 'Q', zh: '铭刻', sub: '题难一级 · 答对 ×1.5 · 答错丢 1 资源' },
  whisper: { key: 'W', zh: '低语', sub: '给首字母 · 不算会写' },
  chorus: { key: 'E', zh: '齐鸣', sub: '这一题打整群' },
  skill: { key: 'R', zh: '技能', sub: '写对整句' },
  cls: { key: 'G', zh: '职业技能', sub: '' },
};

export class BattleUI {
  phase: Phase = 'choose';
  move: Move = 'attack';
  question: Question | null = null;
  report: TurnReport | null = null;
  zhShown = false;
  input: HTMLInputElement | null = null;
  private autoTimer = 0;
  private lastValue = '';
  private voicedFull = '';
  private renderedQ: Question | null = null;

  constructor(private ctrl: Controller) {}

  get b(): Battle {
    return this.ctrl.battle!;
  }

  open(): void {
    this.phase = 'choose';
    this.report = null;
    this.zhShown = false;
    $('battle').hidden = false;
    this.startTurn();
  }

  close(): void {
    window.clearTimeout(this.autoTimer);
    $('battle').hidden = true;
    this.input = null;
  }

  private startTurn() {
    this.zhShown = this.ctrl.state.settings.autoZh || this.ctrl.state.level <= 3;
    this.ctrl.speak(this.b.intent.line);
    const moves = this.moves().filter((m) => moveReady(this.ctrl.state, this.b, m));
    if (moves.length === 1) this.choose(moves[0]);
    else {
      this.phase = 'choose';
      this.question = null;
      this.render();
    }
  }

  choose(move: Move): void {
    if (!this.moves().includes(move) || !moveReady(this.ctrl.state, this.b, move)) return;
    this.move = move;
    this.question = this.ctrl.askQuestion(move);
    // Listening step: the monster says its own name, the player picks the meaning.
    if (this.question.type === 'pickZh' && this.question.focus) this.ctrl.speak(this.question.focus);
    if (this.question.type === 'saying') this.ctrl.speak(SAYING_BY_ID[this.question.sayingId!].a);
    this.phase = 'answer';
    this.render();
  }

  private moves(): Move[] {
    return availableMoves(this.ctrl.state, this.b, this.ctrl.pack.filter((x) => !x.outcome).length);
  }

  submit(value: string): void {
    if (this.phase !== 'answer' || !this.question) return;
    this.lastValue = value;
    const voiced = this.b.intent;
    this.report = this.ctrl.answer(this.move, this.question, value);
    this.phase = 'result';
    // 完形填空: read the whole sentence once the blank is answered.
    if (this.question.type === 'cloze' && this.question.full) this.ctrl.speak(this.question.full);
    // 归名的奖励: a right answer gives the mumbled sentence back whole, read aloud.
    this.voicedFull = this.report.correct && voiced.full ? `${voiced.full}（${voiced.fullZh}）` : '';
    if (this.voicedFull && this.question.type !== 'cloze') this.ctrl.speak(voiced.full!);
    this.render();
    // Auto-advance: about a second for a clean hit, longer when there is a correction to read.
    const clean = this.report.correct && !this.report.verdict.notes.length;
    const delay = this.ctrl.fightOver() ? 1600 : clean ? 1000 : 2600;
    window.clearTimeout(this.autoTimer);
    this.autoTimer = window.setTimeout(() => this.continue(), delay);
  }

  continue(): void {
    if (this.phase !== 'result') return;
    window.clearTimeout(this.autoTimer);
    if (this.ctrl.fightOver()) {
      this.ctrl.finishBattle();
      return;
    }
    this.startTurn();
  }

  /** 群怪: change target. Mid-question the question is asked again for the new target. */
  target(i: number): void {
    if (this.phase === 'result') return;
    const before = this.b;
    this.ctrl.setTarget(i);
    if (this.b === before) return;
    if (this.phase === 'answer') this.question = this.ctrl.askQuestion(this.move);
    this.ctrl.speak(this.b.intent.line);
    this.render();
  }

  /** Keyboard: A/S/D/F/R to pick a move, 1–3 for options, Enter to continue, Esc to change move. */
  onKey(e: KeyboardEvent): boolean {
    if ($('battle').hidden) return false;
    const typing = document.activeElement === this.input;
    if (this.phase === 'result' && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      this.continue();
      return true;
    }
    if (this.phase === 'answer' && e.key === 'Escape' && this.moves().length > 1) {
      this.phase = 'choose';
      this.render();
      return true;
    }
    if (e.key === 'Tab' && this.ctrl.pack.length > 1) {
      e.preventDefault();
      const n = this.ctrl.pack.length;
      const cur = this.ctrl.pack.indexOf(this.b);
      for (let d = 1; d < n; d++) {
        const i = (cur + d) % n;
        if (!this.ctrl.pack[i].outcome) {
          this.target(i);
          break;
        }
      }
      return true;
    }
    if (typing) return false;
    const k = e.key.toLowerCase();
    if (this.phase === 'choose' || (this.phase === 'answer' && this.question?.options)) {
      const map: Record<string, Move> = { a: 'attack', q: 'inscribe', w: 'whisper', e: 'chorus', f: 'sentence', r: 'skill', g: 'cls' };
      if (map[k]) {
        this.choose(map[k]);
        return true;
      }
    }
    if (this.phase === 'answer' && this.question?.options) {
      const n = Number(e.key);
      if (n >= 1 && n <= this.question.options.length) {
        this.submit(this.question.options[n - 1]);
        return true;
      }
    }
    if (k === 'z' && this.phase !== 'result') {
      this.zhShown = !this.zhShown;
      this.render();
      return true;
    }
    if (k === 'v') {
      this.ctrl.speak(this.b.intent.line);
      return true;
    }
    return false;
  }

  render(): void {
    // Keep what the player typed when the panel re-renders (e.g. after 看中文).
    const keep = this.phase === 'answer' && this.renderedQ === this.question ? this.input?.value : undefined;
    this.pending = keep;
    const s = this.ctrl.state;
    const b = this.b;
    const el = $('battle');
    el.className = 'panel';
    const w = b.word;
    const g = genderOf(w);
    const color = b.stage === 0 ? '#e8dccf' : g ? ARTICLE_COLOR[g] : '#c3a9ff';

    // Monster card.
    const glyph =
      b.stage === 0
        ? Array.from({ length: Math.max(3, Math.min(9, w.de.length)) }, () => GLITCH[Math.floor(Math.random() * GLITCH.length)]).join('')
        : b.stage === 1
          ? [...w.de].map((c, i) => (i % 2 === 0 || c === ' ' ? c : '▒')).join('')
          : (w.art ? w.art + ' ' : '') + w.de.slice(0, Math.ceil(w.de.length / 2)) + '▒▒';
    const m = b.monster;
    const st: string[] = [];
    if (m.broken > 0) st.push(`破甲 ${m.broken}`);
    else st.push(`护甲 ${Math.round(effArmor(s, b, 0) * 100)}%`);
    if (m.burn > 0) st.push(`灼烧 ${m.burn}`);
    if (m.poison > 0) st.push(`中毒 ×${m.poison}`);
    if (m.chilled) st.push('冰冻');
    const fam = FAMILIES[w.family];
    const mon = h(
      'div.b-mon',
      h('div.fam', h('span', `${fam.zh} · Lv ${m.lvl}`), h('span', STAGE_ZH[b.stage])),
      h('div.glyph', { style: `color:${color};text-shadow:0 0 8px ${b.stage === 0 ? '#ff1830' : color}` }, glyph),
      h(
        'div',
        b.kind === 'due' ? h('span.tag.due', '遗忘之物') : b.kind === 'new' ? h('span.tag', '新怪') : h('span.tag', '影子'),
        b.isEcho ? h('span.tag.echo', '带着你的回响') : '',
        b.saying && !b.sayingDone ? h('span.tag.echo', '接句怪') : '',
        b.stage === 2 && b.kind === 'due' ? h('span.tag', '可归名') : '',
      ),
      bar('hp', m.hp, m.maxHp, `${m.hp} / ${m.maxHp}`),
      h('div.status', st.join(' · ')),
    );

    const pack = this.ctrl.pack;
    const monEl = pack.length > 1 ? this.renderPack() : mon;

    // 0.4 难题就是预告: no intent icon or rule text. The monster's line is still shouted and read aloud;
    // what it is about to do shows in the question it asks.
    const it = b.intent;
    const intent = h(
      'div.b-intent',
      h(
        'div',
        { style: 'flex:1;min-width:0' },
        h('div.kind', `${pack.length > 1 ? (b.named || b.stage > 0 ? fullForm(w) : w.de) + ' ' : '它'}说`),
        h('div.line', it.line),
        h('div.zh', this.zhShown ? plainZh(it.zh) : ''),
        b.queued ? h('div.zh', { style: 'color:var(--gold, #ffcf4a)' }, `看穿 · 下回合：${b.queued.line}${this.zhShown ? `（${plainZh(b.queued.zh)}）` : ''}`) : '',
        h(
          'div.ib',
          h('button.btn', { onclick: () => this.ctrl.speak(it.line), title: '再听一遍（V）' }, '🔊 再听'),
          h('button.btn', { onclick: () => { this.zhShown = !this.zhShown; this.render(); }, title: '中文（Z）' }, this.zhShown ? '隐藏中文' : '看中文'),
        ),
      ),
    );

    const tier = comboTier(s.combo);
    const fx: string[] = [];
    if (b.fx.burn > 0) fx.push(`灼烧 ${b.fx.burn}`);
    if (b.fx.poison > 0) fx.push(`中毒 ×${b.fx.poison}`);
    if (b.fx.shield) fx.push('护盾');
    if (resMax(s)) fx.push(`${resName(s)} ${b.cfx.res}/${resMax(s)}${b.cfx.critReady ? ' · 必暴击' : ''}`);
    const me = h(
      'div.b-me',
      h('div.fam', h('span', s.name), h('span', `Lv ${s.level}`)),
      bar('hp', s.hp, maxHp(s), `${s.hp} / ${maxHp(s)}`),
      h('div.hud-row', h('span', '连击 ', h('b.combo', String(s.combo))), tier ? h('span.combo', tier.split(' ')[0]) : ''),
      h('div.status', fx.join(' · ')),
      h('div.hud-row', h('button.btn.ghost.small', { onclick: () => this.ctrl.flee(), title: '撤退：连击清零' }, '撤退')),
    );

    // Moves.
    const moves = this.moves();
    const movesEl = h('div.moves');
    if (moves.length > 1) {
      for (const mv of moves) {
        const info = MOVE_INFO[mv];
        const disabled = this.phase === 'result' || !moveReady(s, b, mv);
        const sub =
          mv === 'skill' && s.skills[0]
            ? `${SKILLS[s.skills[0]].zh}${b.skillCooldown ? ` · 冷却 ${b.skillCooldown}` : ''}`
            : mv === 'cls' && s.cls
              ? `${CLASSES[s.cls].skillZh} · ${CLASSES[s.cls].res} ${b.cfx.res}/${CLASSES[s.cls].skillCost}`
              : mv === 'inscribe' && b.cfx.inscribeCd
                ? `冷却 ${b.cfx.inscribeCd}`
                : mv === 'chorus' && b.chorusCd
                  ? `冷却 ${b.chorusCd}`
                  : mv === 'whisper' && !moveReady(s, b, 'whisper')
                    ? '上次提示过，这次先自己写'
                    : mv === 'sentence'
                      ? `${resName(s)} ${b.cfx.res}/${resMax(s)}${b.cfx.res >= resMax(s) ? ' · 可以放了' : ' · 满了才能用'}`
                      : info.sub;
        movesEl.append(
          h(
            `button.btn${this.move === mv && this.phase !== 'choose' ? '.sel' : ''}`,
            { disabled, onclick: () => this.choose(mv) },
            h('kbd', info.key),
            info.zh,
            h('small', sub),
          ),
        );
      }
    }

    // Question.
    const q = h('div.q');
    if (this.phase === 'choose') {
      q.append(
        h('div.prompt', h('span', '听它说什么，再出手')),
      );
    } else if (this.question) {
      q.append(this.renderQuestion(this.question));
    }

    const blog = h('div.blog');
    for (const l of b.log.slice(-3)) blog.append(h(`div.${l.tone}`, l.text));

    clear(el).append(h('div.b-top', monEl, intent, me), movesEl, q, blog);
    if (this.input && this.phase === 'answer') window.setTimeout(() => this.input?.focus(), 0);
  }

  private pending: string | undefined;

  /** 群怪 cards: name (article only after 点名), HP and each monster's own intent. */
  private renderPack(): HTMLElement {
    const wrap = h('div.b-mon.b-pack');
    this.ctrl.pack.forEach((pb, i) => {
      const w = pb.word;
      const g = genderOf(w);
      const known = pb.named || pb.stage > 0;
      const color = known && g ? ARTICLE_COLOR[g] : '#e8dccf';
      const it = pb.intent;
      const dead = !!pb.outcome;
      const card = h(
        `button.pk${pb === this.b ? '.sel' : ''}${dead ? '.dead' : ''}`,
        { onclick: () => this.target(i), title: '选中它（Tab 切换）', disabled: dead },
        h('div.fam', h('span', `${FAMILIES[w.family].zh} · Lv ${pb.monster.lvl}`), h('span', dead ? '已打散' : STAGE_ZH[pb.stage])),
        h('div.nm', { style: `color:${color}` }, known ? fullForm(w) : `？ ${w.de}`),
        bar('hp', pb.monster.hp, pb.monster.maxHp, `${pb.monster.hp} / ${pb.monster.maxHp}`),
        dead ? '' : h('div.it', it.line),
      );
      wrap.append(card);
    });
    return wrap;
  }

  private renderQuestion(qq: Question): HTMLElement {
    this.renderedQ = qq;
    const wrap = h('div');
    const r = this.report;
    // 难题就是预告: the only hint left is on the question itself while it charges.
    if (this.b.intent.kind === 'charge' && this.phase !== 'result') wrap.append(h('div.prompt', { style: 'color:var(--gold, #ffcf4a)' }, h('span', '它在蓄力——答对打断')));
    const tags = [qq.inscribed ? '铭刻 ×1.5' : '', qq.whispered ? '低语 · 不算会写' : '', qq.chorus ? '齐鸣' : ''].filter(Boolean).join(' · ');
    wrap.append(h('div.prompt', h('span', qq.prompt), tags ? h('span.tag', tags) : ''));
    const focusColor = qq.type === 'article' && this.phase === 'result' && this.b.word.art ? ARTICLE_COLOR[genderOf(this.b.word) ?? 'pl'] : '';
    const long = qq.type === 'cloze' ? 'font-size:22px;line-height:1.4;' : '';
    wrap.append(h('div.focus', { style: (focusColor ? `color:${focusColor};` : '') + long }, qq.focus));
    this.input = null;
    if (qq.options) {
      const opts = h('div.opts');
      qq.options.forEach((o, i) => {
        const cls = qq.type === 'article' ? `.${o}` : '';
        opts.append(
          h(`button.btn${cls}`, { disabled: this.phase !== 'answer', onclick: () => this.submit(o) }, h('kbd', String(i + 1)), o),
        );
      });
      wrap.append(opts);
    } else {
      const input = h('input', {
        type: 'text',
        autocomplete: 'off',
        autocapitalize: 'off',
        spellcheck: 'false',
        placeholder: qq.whisper ?? (qq.withArticle ? 'der / die / das + 名词' : ''),
        disabled: this.phase !== 'answer',
      }) as HTMLInputElement;
      if (this.pending !== undefined) input.value = this.pending;
      if (this.phase === 'result') input.value = this.lastValue;
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          e.stopPropagation(); // don't let the same Enter also press "continue"
          this.submit(input.value);
        }
      });
      this.input = input;
      wrap.append(
        h('div.typing', input, umlautButtons(input), h('button.btn.primary', { disabled: this.phase !== 'answer', onclick: () => this.submit(input.value) }, '出招 ↵')),
      );
    }
    if (this.phase === 'result' && r) {
      const fb = h(`div.feedback.${r.correct ? 'ok' : 'no'}`);
      const head = r.correct ? (r.crit ? (r.newSpell ? '新言灵！暴击！' : '暴击！') : r.parried ? '弹反！' : '答对了') : '答错了';
      fb.append(h('b', head));
      if (r.correct && this.b.word && (qq.type === 'article' || qq.type === 'typed')) fb.append(h('span', `  ${fullForm(this.b.word)} · ${this.b.word.zh}`));
      if (r.element) fb.append(h('span', `  元素：${ELEMENT_ZH[r.element]}`));
      for (const n of r.verdict.notes) fb.append(h('span.note', n));
      if (r.readRight) fb.append(h('span.note', '读懂了它：连击 +1'));
      if (this.voicedFull) fb.append(h('span.note', `它刚才念的是：${this.voicedFull}`));
      fb.append(h('span.note.muted', this.ctrl.fightOver() ? '结算（Enter 跳过）' : '下一题（Enter 跳过）'));
      wrap.append(fb);
    }
    return wrap;
  }

}
