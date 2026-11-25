import { icon, monsterTile, heroIcon } from './icons';
import { DEFAULT_LOOK } from '../core/look';
import type { Battle, Question, TurnReport } from '../core/combat';
import { count as itemCount, itemsOpen, tabletHeal } from '../core/items';
import { availableMoves, chorusMates, canHint, comboTier, effArmor, moveReady, needsPhase, phaseOf, resName, shownDe, stancesFor, teachPhase, readTarget, readRecall, readShown, phaseWrongWhy } from '../core/combat';
import { articleSlip, clarity, shadowOk } from '../core/shadow';
import { has } from '../core/unlocks';
import type { Stance } from '../core/cloze';
import { ELEMENT_ZH } from '../core/intents';
import { STAGE_ZH } from '../core/srs';
import { maxHp } from '../core/state';
import type { Move } from '../core/types';
import { FAMILIES } from '../data/families';
import { SKILLS } from '../data/skills';
import { CLASSES, resMax } from '../core/classes';
import { fullForm, genderOf, WORD_BY_ID, zhWithPos } from '../data/words';
import type { Controller } from '../game/controller';
import { ELEMENT_TAG, GLITCH, NAME_RED } from '../game/sprites';
import { $, bar, clear, h, umlautButtons } from './dom';
import { reportButton } from './report';
import { logLine } from './gamelog';
import { canListen, lastConfidence, listenOnce, listening, stopHold, stopListening } from './listen';
import { isRecording, judgePair, playRecording, pronReady, startRecording, stopRecording } from './phoneme';
import { ECHO_RETRIES, echoVerdict, notePron } from '../core/pron';
import { PRON_TIP } from '../data/pairs';

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
  chorus: { key: 'E', zh: '齐鸣', sub: '这一题打同相的整群' },
  skill: { key: 'R', zh: '技能', sub: '写对整句' },
  cls: { key: 'G', zh: '职业技能', sub: '' },
  item: { key: 'H', zh: '药片', sub: '回血 · 占一回合' },
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
  /** 齐鸣 (rev 234): one box per same-stance mate, sent after the target's answer joined with |. */
  private mateBoxes: HTMLInputElement[] = [];
  private voicedFull = '';
  /** 跟读: the German sentence just read aloud after a right answer, and the last attempt's feedback. */
  private shadowText = '';
  private readMsg = '';
  private shadowMsg = '';
  private renderedQ: Question | null = null;
  private phaseNag = false;
  // 回音怪 (2026-11-23): the pair's two options, re-reads used, the last message, a judgement in progress.
  private echoOpts: string[] = [];
  private echoTries = 0;
  private echoMsg = '';
  private echoBusy = false;

  constructor(private ctrl: Controller) {
    // Push-to-talk: releasing S ends the recording.
    window.addEventListener('keyup', (e) => {
      if (e.key.toLowerCase() === 's' && listening()) stopHold();
    });
    window.addEventListener('pointerup', () => listening() && stopHold());
    window.addEventListener('keyup', (e) => {
      if (e.key === ' ' && isRecording()) void this.echoStop();
    });
  }

  /** 回音怪: read aloud when 发音训练 is on and the pair can be judged, otherwise listen and pick. */
  private echoSetup(): void {
    const q = this.question;
    if (!q?.echo) return;
    this.echoOpts = q.options ?? [q.echo.target, q.echo.partner];
    this.echoTries = 0;
    this.echoMsg = '';
    if (q.echo.sayable && this.ctrl.state.settings.pron && pronReady()) {
      this.question = { ...q, echo: { ...q.echo, say: true }, options: undefined, prompt: '回音怪 · 读出来：按住空格（或按住下面的按钮）读这个词，松开就判', focus: `${q.echo.target}   /${q.echo.ipaT.replace(/ /g, '')}/` };
    } else this.echoListen();
  }

  private echoListen(): void {
    const q = this.question;
    if (!q?.echo) return;
    this.question = { ...q, echo: { ...q.echo, say: false }, options: this.echoOpts, prompt: `回音怪 · 听辨：它读的是 ${this.echoOpts.join(' 还是 ')}？`, focus: '🔊 ？' };
    this.ctrl.speak(q.echo.target);
  }

  private async echoStart(): Promise<void> {
    if (this.phase !== 'answer' || !this.question?.echo?.say || this.echoBusy || isRecording()) return;
    const ok = await startRecording();
    if (!ok) {
      this.echoMsg = '用不了麦克风（在地址栏左边允许麦克风），这题改成听辨';
      this.echoListen();
    } else this.echoMsg = '在听……松开就判';
    this.render();
  }

  private async echoStop(): Promise<void> {
    if (!isRecording()) return;
    const wave = await stopRecording();
    const q = this.question;
    if (!q?.echo || this.phase !== 'answer') return;
    if (!wave) {
      this.echoMsg = '太短了，按住读完整个词再松开';
      this.render();
      return;
    }
    const t = q.echo;
    this.echoBusy = true;
    this.echoMsg = '在判……';
    this.render();
    try {
      const r = await judgePair(wave, t.ipaT, t.ipaP);
      const v = echoVerdict(r.target, r.partner);
      if (v === 'ref') {
        this.echoBusy = false;
        this.submit(t.target);
        return;
      }
      if (v === 'tie') {
        this.echoTries += 1;
        if (this.echoTries > ECHO_RETRIES) {
          this.echoMsg = `还是没听清（听到 /${r.heard}/），这题改成听辨`;
          this.echoListen();
        } else this.echoMsg = `没听清（听到 /${r.heard}/），再读一次`;
      } else {
        // 读错不罚 (2026-11-23): no turn spent; show what it sounded like, play the model and the recording, then listen.
        notePron(this.ctrl.state, t.cat, false);
        this.ctrl.persist();
        this.echoMsg = `听起来像 ${t.partner}（${t.zhP}），不扣血。${PRON_TIP[t.cat]}。先听示范，再听你的录音`;
        this.ctrl.speak(t.target);
        window.setTimeout(() => playRecording(wave), 1300);
        window.setTimeout(() => {
          if (this.question === q) {
            this.echoListen();
            this.render();
          }
        }, 3200);
      }
    } catch (e) {
      this.echoMsg = `发音模型出错了（${(e as Error).message}），这题改成听辨`;
      this.echoListen();
    }
    this.echoBusy = false;
    this.render();
  }

  /** A hold-to-talk button: press starts recording, release (or leaving the button) stops it. */
  private holdBtn(sel: string, attrs: Record<string, string | boolean>, start: () => void, ...kids: Array<HTMLElement | string>): HTMLElement {
    const el = h(sel, attrs, ...kids);
    el.addEventListener('pointerdown', (e) => {
      if ((el as HTMLButtonElement).disabled || listening()) return;
      e.preventDefault();
      start();
    });
    for (const ev of ['pointerup', 'pointerleave', 'pointercancel']) el.addEventListener(ev, () => listening() && stopHold());
    return el;
  }

  get b(): Battle {
    return this.ctrl.battle!;
  }

  open(): void {
    this.phase = 'choose';
    this.report = null;
    this.zhShown = false;
    this.shadowText = '';
    this.shadowMsg = '';
    $('battle').hidden = false;
    this.startTurn();
  }

  close(): void {
    window.clearTimeout(this.autoTimer);
    stopListening();
    $('battle').hidden = true;
    this.input = null;
  }

  private startTurn() {
    this.zhShown = this.ctrl.state.settings.autoZh || this.ctrl.state.level <= 3;
    this.ctrl.speak(this.b.intent.line);
    teachPhase(this.b);
    const moves = this.moves().filter((m) => moveReady(this.ctrl.state, this.b, m));
    // 词性三相: a noun monster waits for a stance first (it stays picked for this monster).
    this.readMsg = '';
    const rt = canListen() ? readTarget(this.ctrl.state, this.b) : null;
    if (rt) window.setTimeout(() => this.ctrl.speak(readShown(this.b, rt)), 1800);
    if (moves.length === 1 && !rt && !this.b.cutReady && !(needsPhase(this.b) && !this.b.phase)) this.choose(moves[0]);
    else {
      this.phase = 'choose';
      this.question = null;
      this.render();
    }
  }

  /** 词性三相: pick der / die / das (keys 1–3 before choosing a move, or click any time before answering). */
  setPhase(p: Stance): void {
    if (this.phase === 'result' || !needsPhase(this.b)) return;
    this.b.phase = p;
    const ready = this.moves().filter((m) => moveReady(this.ctrl.state, this.b, m));
    if (this.phase === 'choose' && ready.length === 1) this.choose(ready[0]);
    else this.render();
  }

  choose(move: Move): void {
    if (!(this.moves().includes(move) || move === 'whisper') || !moveReady(this.ctrl.state, this.b, move)) return;
    stopListening();
    if (needsPhase(this.b) && !this.b.phase && move !== 'skill' && move !== 'cls') {
      this.phaseNag = true;
      this.render();
      return;
    }
    this.phaseNag = false;
    this.move = move;
    this.question = this.ctrl.askQuestion(move);
    this.echoSetup();
    // Listening step: the monster says its own name, the player picks the meaning.
    if (this.question.type === 'pickZh' && this.question.focus) this.ctrl.speak(this.question.focus);
    if (this.question.type === 'saying') this.ctrl.speak(this.question.say!.a);
    this.phase = 'answer';
    this.render();
  }

  /** 药片 (物品栏): heal and spend the turn; the monsters act. */
  tablet(): void {
    if (this.phase !== 'choose') return;
    const target = this.b;
    const from = target.log.length;
    const r = this.ctrl.useTablet();
    if (!r) return;
    stopListening();
    this.report = r.report;
    this.question = { type: 'steady', prompt: '吃了一片药', focus: `生命 +${r.heal}`, item: true };
    this.move = 'item';
    this.phase = 'result';
    this.lastValue = '';
    this.voicedFull = '';
    this.shadowText = '';
    logLine(`吃了一片药：生命 +${r.heal}`, 'good');
    if (r.report.monsterDamage) logLine(`  它出手：你受到 ${r.report.monsterDamage} 伤害`, 'bad');
    for (const l of target.log.slice(from)) logLine(`  ${l.text}`, l.tone === 'good' ? 'good' : l.tone === 'bad' ? 'bad' : l.tone === 'crit' ? 'gold' : 'info');
    this.render();
    window.clearTimeout(this.autoTimer);
    this.autoTimer = window.setTimeout(() => this.continue(), this.ctrl.fightOver() ? 1600 : 1400);
  }

  /** 低语 as a hint on the question already shown (2026-11-22, Lucas: 精简出手按钮). */
  hint(): void {
    if (this.phase !== 'answer' || !this.question) return;
    const q = this.ctrl.hint(this.move, this.question);
    if (!q) return;
    this.question = q;
    this.renderedQ = q; // keep what was typed so far
    this.move = 'whisper';
    this.render();
  }

  private moves(): Move[] {
    return availableMoves(this.ctrl.state, this.b, this.ctrl.pack.filter((x) => !x.outcome).length, chorusMates(this.b, this.ctrl.pack).length);
  }

  submit(value: string): void {
    if (this.phase !== 'answer' || !this.question) return;
    if (this.question.mates?.length) value = [value, ...this.mateBoxes.map((x) => x.value)].join('|');
    this.lastValue = value;
    const voiced = this.b.intent;
    const target = this.b;
    const logFrom = target.log.length;
    this.report = this.ctrl.answer(this.move, this.question, value);
    this.phase = 'result';
    this.logTurn(target, this.question, value, this.report, logFrom);
    // 完形填空: read the whole sentence once the blank is answered.
    if (this.question.type === 'cloze' && this.question.full) this.ctrl.speak(this.question.full);
    // 归名的奖励: a right answer gives the mumbled sentence back whole, read aloud.
    this.voicedFull = this.report.correct && voiced.full ? `${voiced.full}（${voiced.fullZh}）` : '';
    if (this.voicedFull && this.question.type !== 'cloze') this.ctrl.speak(voiced.full!);
    this.shadowText = this.report.correct ? (this.question.type === 'cloze' && this.question.full ? this.question.full : voiced.full ?? '') : '';
    this.shadowMsg = '';
    this.render();
    // Auto-advance: about a second for a clean hit, longer when there is a correction to read.
    const clean = this.report.correct && !this.report.verdict.notes.length;
    const delay = this.ctrl.fightOver() ? 1600 : clean ? 1000 : 2600;
    window.clearTimeout(this.autoTimer);
    // 0.6.x: a wrong cloze waits for Enter, so the correction and its rule can be read.
    if (!this.report.correct && this.question.type === 'cloze' && !this.ctrl.fightOver()) return;
    this.autoTimer = window.setTimeout(() => this.continue(), delay);
  }

  /** 「这句有问题」: the German sentence this question showed, if any, and where it came from. */
  private reportable(qq: Question): { sentence: string; context: Record<string, unknown> } | null {
    let k = 0;
    const sentence = qq.full ?? (qq.frame && qq.ult ? qq.frame.replace(/___/g, () => qq.ult![k++] ?? '___') : '');
    const voiced = this.b.intent.full ?? '';
    const s = sentence || voiced || (qq.say ? `${qq.say.a} ${qq.say.b}` : '');
    if (!s || !/[a-zäöüß]{2,}\s+\S/i.test(s)) return null;
    return {
      sentence: s,
      context: {
        type: qq.type,
        word: this.b.word?.id ?? null,
        answer: qq.answer ?? null,
        input: this.lastValue.slice(0, 120),
        correct: !!this.report?.correct,
        zh: qq.clozeZh ?? this.b.intent.fullZh ?? null,
        level: this.ctrl.state.level,
      },
    };
  }

  /** 记录: one line per answer (question, your answer, the right one, damage), then the fight's own log lines. */
  private logTurn(b: Battle, q: Question, value: string, r: TurnReport, from: number): void {
    const name = b.spellSeen || b.verifyDone || b.outcome ? fullForm(b.word) : nameGlyph(b);
    const ask = q.focus ? `「${q.focus}」` : '';
    const right = r.verdict.correct || q.answer || '';
    const head = r.correct
      ? `${name}：${ask} 你答 ${value} ✓${r.crit ? ' 暴击' : ''}${r.playerDamage ? `，造成 ${r.playerDamage} 伤害` : ''}`
      : `${name}：${ask} 你答 ${value || '（空）'} ✗${right ? `，正确：${right}` : ''}`;
    logLine(head, r.correct ? 'good' : 'bad');
    for (const n of r.verdict.notes) if (!n.startsWith('正确答案')) logLine(`  ${n}`, 'info');
    if (r.monsterDamage) logLine(`  它出手：你受到 ${r.monsterDamage} 伤害`, 'bad');
    for (const l of b.log.slice(from)) logLine(`  ${l.text}`, l.tone === 'good' ? 'good' : l.tone === 'bad' ? 'bad' : l.tone === 'crit' ? 'gold' : 'info');
  }

  /** 跟读 (Lv5+, optional): read the sentence back, on the result screen or on the next turn before choosing
   *  (the result screen moves on by itself). Sounding right pays XP once per fight, a miss costs nothing. */
  private shadowReady(): boolean {
    return !!this.shadowText && (this.phase === 'result' || this.phase === 'choose') && canListen() && this.ctrl.canShadow();
  }

  private shadowRow(): HTMLElement | string {
    if (!this.shadowText || !canListen() || (!this.ctrl.canShadow() && !this.shadowMsg)) return '';
    return h(
      'span.note.shadow',
      this.shadowReady() && !listening() && this.phase === 'result'
        ? this.holdBtn('button.btn', { title: '跟读（按住 S 说，松开结束）：读得像多给经验，读不好不扣东西' }, () => void this.shadow(), h('kbd', 'S'), '按住跟读')
        : '',
      this.shadowMsg ? h('span', ` ${this.shadowMsg}`) : '',
    );
  }

  async shadow(): Promise<void> {
    const text = this.shadowText;
    const from = this.phase;
    if (!this.shadowReady() || listening()) return;
    if (from === 'result') window.clearTimeout(this.autoTimer); // the player is reading: wait for Enter
    this.shadowMsg = `录音中……读出「${text}」，松开结束`;
    this.render();
    const heard = await listenOnce({ hold: true });
    if (this.phase !== from || this.shadowText !== text) return;
    if (heard === null) this.shadowMsg = '';
    else if (!heard.length) this.shadowMsg = '没听清，可以再读一次（不扣任何东西）';
    else {
      const r = this.ctrl.shadowed(text, heard);
      const c = clarity(text, heard, lastConfidence);
      this.shadowMsg = r.ok ? `读得像！清晰度 ${c}${r.xp ? `，经验 +${r.xp}` : ''}` : `听到的是「${heard[0]}」，清晰度 ${c}，差一点，可以再读一次`;
    }
    this.render();
  }

  /** 读音攻击: read a never-met word aloud. Heard close enough → the turn's attack lands as a right answer;
   *  otherwise nothing is spent (read again or attack normally). */
  async readAttack(): Promise<void> {
    const s = this.ctrl.state;
    const fresh = readTarget(s, this.b);
    const target = fresh ?? readRecall(s, this.b);
    if (!target || this.phase !== 'choose' || listening() || !canListen() || !moveReady(s, this.b, 'attack')) return;
    if (needsPhase(this.b) && !this.b.phase) {
      this.phaseNag = true;
      this.render();
      return;
    }
    const b = this.b;
    const zh = b.word.zh;
    const shown = fresh ? readShown(b, fresh) : '';
    this.readMsg = (fresh ? `录音中……读出「${shown}」${shown !== fresh ? '（连冠词一起读）' : ''}` : `录音中……说出「${zh}」的德语${b.word.art ? '（带冠词）' : ''}`) + '，松开结束';
    this.render();
    const heard = await listenOnce({ hold: true });
    if (this.phase !== 'choose' || this.b !== b) return;
    const retry = '：再说一次，或者正常出手（不耗回合）';
    if (heard === null) this.readMsg = '';
    else if (!heard.length) this.readMsg = `没听清${retry}`;
    else if (!shadowOk(target, heard)) {
      const slip = articleSlip(target, heard);
      this.readMsg =
        slip === null
          ? `听到的是「${heard[0]}」，清晰度 ${clarity(target, heard, lastConfidence)}${retry}`
          : slip
            ? `冠词读错了：你读的是 ${slip}${retry}`
            : `没听清冠词${retry}`;
    }
    else {
      this.readMsg = '';
      const c = clarity(target, heard, lastConfidence);
      logLine(fresh ? `读音攻击：「${target}」读对了，清晰度 ${c}，必中` : `读音攻击：说对了「${target}」，清晰度 ${c}，算一次低语（弱一击）`, 'good');
      this.choose(fresh ? 'attack' : 'whisper');
      const q = this.question;
      if ((this.phase as Phase) === 'answer' && q) this.submit(q.answer ?? '');
      return;
    }
    this.render();
  }

  /** 斩杀: the verified monster dies on the spot. */
  cut(): void {
    if (this.phase !== 'choose' || !this.b.cutReady || this.b.outcome) return;
    stopListening();
    logLine(`斩杀 · ${fullForm(this.b.word)}（${this.b.word.zh}）${this.b.verify === 'recheck' ? '永久退役' : '已退役，30 天后回响抽查一次'}`, 'gold');
    if (this.ctrl.cut()) return; // the fight is over
    this.startTurn();
  }

  continue(): void {
    if (this.phase !== 'result') return;
    window.clearTimeout(this.autoTimer);
    stopListening();
    if (this.ctrl.fightOver()) {
      // 场景精英: the next part starts right away (same fight, no heal).
      if (this.ctrl.nextElitePart()) {
        this.startTurn();
        return;
      }
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
    if (!typing && e.key === 'Enter' && this.phase === 'choose' && this.b.cutReady && !this.b.outcome) {
      e.preventDefault();
      this.cut();
      return true;
    }
    if (this.phase === 'result' && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      this.continue();
      return true;
    }
    if (!typing && e.key.toLowerCase() === 's' && e.repeat && listening()) return true;
    if (!typing && e.key.toLowerCase() === 's' && this.phase === 'choose' && canListen() && (readTarget(this.ctrl.state, this.b) || readRecall(this.ctrl.state, this.b))) {
      void this.readAttack();
      return true;
    }
    if (!typing && e.key.toLowerCase() === 's' && this.shadowReady()) {
      void this.shadow();
      return true;
    }
    if (this.phase === 'answer' && e.key === 'Escape' && this.moves().length > 1 && !this.question?.whispered) {
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
      if (k === 'h' && this.phase === 'choose') {
        this.tablet();
        return true;
      }
      if (k === 'w' && this.phase === 'answer') {
        this.hint();
        return true;
      }
      const map: Record<string, Move> = { a: 'attack', q: 'inscribe', e: 'chorus', f: 'sentence', r: 'skill', g: 'cls' };
      if (map[k]) {
        this.choose(map[k]);
        return true;
      }
    }
    if (this.phase === 'choose' && needsPhase(this.b) && /^[0-9]$/.test(e.key)) {
      const list = stancesFor(this.ctrl.state.level, this.b);
      const st = list[(Number(e.key) + 9) % 10];
      if (st) {
        this.setPhase(st);
        return true;
      }
    }
    if (this.phase === 'answer' && this.question?.echo?.say && e.key === ' ' && !typing) {
      e.preventDefault();
      if (!e.repeat) void this.echoStart();
      return true;
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
    const taught = this.phase !== 'result' ? teachPhase(b) : !!b.phaseTaught && b.phaseTaught === b.turn && b.phase === phaseOf(b); // a pack's next target is taught too
    const el = $('battle');
    el.className = 'panel';
    const w = b.word;
    const g = genderOf(w);
    // 词性三相: the card never gives the gender away until the right stance has landed once.
    const showG = !needsPhase(b) || !!b.phaseHit;
    const color = b.stage === 0 || !showG ? '#e8dccf' : NAME_RED;
    const elTag = b.stage > 0 && showG && (b.pluralMon || g) ? ELEMENT_TAG[b.pluralMon ? 'pl' : g!] : '';

    // Monster card.
    const glyph = nameGlyph(b);
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
      icon(monsterTile(b, this.ctrl.dungeon?.left === 1), 5, false, 'mon-icon'),
      h('div.glyph', { style: `color:${color};text-shadow:0 0 8px ${b.stage === 0 ? '#ff1830' : color}` }, glyph, elTag ? h('span.tag', { style: 'margin-left:6px;font-size:11px;vertical-align:middle' }, elTag) : ''),
      h(
        'div',
        b.rusty ? h('span.tag.due', '锈名 · 久拖的遗忘之物') : b.kind === 'due' ? h('span.tag.due', '遗忘之物') : b.kind === 'new' ? h('span.tag', '新怪') : h('span.tag', '影子'),
        b.isEcho ? h('span.tag.echo', '带着你的回响') : '',
        b.saying && !b.sayingDone ? h('span.tag.echo', '接句怪') : '',
        b.pluralMon ? h('span.tag.echo', '复数怪 · 一群') : '',
        b.curse ? h('span.tag.due', b.curse === 'forget' ? '诅咒 · 遗忘' : '诅咒 · 沉默') : b.cursed ? h('span.tag', '咒已破') : '',
        b.phrase ? h('span.tag.echo', `残句 · ${b.phraseStep ?? 0}/3`) : '',
        b.elite ? h('span.tag.echo', `◈ 精英 ${b.elite.seg + 1}/${b.elite.words.length} · ${['认', '用', '写'][b.elite.seg]}`) : '',
        b.stage === 2 && b.kind === 'due' && !b.verify ? h('span.tag', '可归名') : '',
        b.verify && !b.verifyDone ? h('span.tag.echo', b.verify === 'recheck' ? '回响抽查 · 写对永久斩杀' : '待验证 · 写对就能斩杀') : '',
        b.cutReady && !b.outcome ? h('span.tag.echo', '可斩杀') : '',
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
        h('div.kind', `${pack.length > 1 ? nameGlyph(b) + ' ' : '它'}说`),
        h('div.line', it.line),
        h('div.zh', this.zhShown && this.b.curse !== 'forget' ? plainZh(it.zh) : ''),
        b.queued?.kind === 'charge' ? h('div.zh', { style: 'color:var(--gold, #ffcf4a)' }, '看穿 · 它下回合要蓄力') : '',
        h(
          'div.ib',
          h('button.btn', { onclick: () => this.ctrl.speak(it.line), title: '再听一遍（V）' }, '🔊 再听'),
          this.b.curse === 'forget' ? '' : h('button.btn', { onclick: () => { this.zhShown = !this.zhShown; this.render(); }, title: '中文（Z）' }, this.zhShown ? '隐藏中文' : '看中文'),
          this.phase === 'choose' ? this.shadowRow() : '',
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
      heroIcon(s.look ?? DEFAULT_LOOK, 5),
      h('div.fam', h('span', s.name), h('span', `Lv ${s.level}`)),
      bar('hp', s.hp, maxHp(s), `${s.hp} / ${maxHp(s)}`),
      h('div.hud-row', h('span', '连击 ', h('b.combo', String(s.combo))), tier ? h('span.combo', tier.split(' ')[0]) : ''),
      h('div.status', fx.join(' · ')),
      itemsOpen(s) && !b.tutorial
        ? h(
            'div.hud-row.small',
            h('span', { title: '低语纸条：答题时按 W（打字时按 ?）给提示，这题不算会写。篝火休息补到 3 张' }, `纸条 ×${itemCount(s, 'hint')}`),
            h('button.btn.ghost.small', {
              disabled: this.phase !== 'choose' || itemCount(s, 'tablet') <= 0 || s.hp >= maxHp(s),
              onclick: () => this.tablet(),
              title: `药片：回 ${tabletHeal(s)} 生命，占一回合（怪照常出手）`,
            }, h('kbd', 'H'), `药片 ×${itemCount(s, 'tablet')}`),
          )
        : '',
      h('div.hud-row', h('button.btn.ghost.small', { onclick: () => this.ctrl.flee(), title: '撤退：连击清零' }, '撤退')),
    );

    // Moves.
    const moves = this.moves();
    const movesEl = h('div.moves');
    // 斩杀: a verified word dies in one click (XP and drops as usual).
    if (b.cutReady && !b.outcome)
      movesEl.append(h('button.btn.primary', { disabled: this.phase !== 'choose', onclick: () => this.cut(), title: '斩杀（Enter）：你会写它了，一键秒杀，经验和掉落照拿' }, h('kbd', 'Enter'), '斩杀', h('small', '一键秒杀 · 以后不用再背')));
    if (moves.length > 1 || b.cutReady) {
      for (const mv of moves) {
        // 2026-11-22 精简出手按钮: the finisher shows only when the resource bar is full.
        if (mv === 'sentence' && !moveReady(s, b, mv)) continue;
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
                  : mv === 'sentence'
                    ? `${resName(s)} ${b.cfx.res}/${resMax(s)} · 可以放了`
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

    // 读出来 (Lv5+): always on the move bar, so it can be found. A never-met word → 读音攻击; after a right answer → 跟读.
    if (has(s.level, 'shadowing') && canListen() && !b.tutorial) {
      const rt = readTarget(s, b);
      const rr = rt ? null : readRecall(s, b);
      const canShadowNow = this.shadowReady() && this.phase === 'choose';
      const on = !listening() && this.phase === 'choose' && (!!rt || !!rr || canShadowNow);
      const sub = listening()
        ? '在听……'
        : rt
          ? `必中 · ${readShown(b, rt)}${readShown(b, rt) !== rt ? '（连冠词读）' : ''}`
          : rr
            ? `弱一击 · 凭记忆说出「${w.zh}」`
            : canShadowNow
              ? '跟读上一句 · 多给经验'
              : this.ctrl.canShadow()
                ? '新词可读出来攻击；答对后可跟读'
                : '这场已经读过了';
      movesEl.append(
        this.holdBtn(
          'button.btn',
          { disabled: !on, title: '读出来（按住 S 或按住按钮说，松开结束）：新词读得像就是必中的一击；见过的词凭记忆说出来算一次低语；答对后可以跟读整句多拿经验。读不好不扣任何东西' },
          () => void (rt || rr ? this.readAttack() : this.shadow()),
          h('kbd', 'S'),
          '按住读',
          h('small', sub),
        ),
      );
    }

    // Question.
    const q = h('div.q');
    if (this.phase === 'choose') {
      q.append(
        h('div.prompt', h('span', needsPhase(b) && !b.phase ? b.perfekt ? '先选相：它这句完成时缺的是 haben 还是 sein？按 1 haben、2 sein，再出手' : (s.level >= 7 ? '先选相：按数字键选它这句话需要的冠词，再出手' : '先选相：按 1 der、2 die、3 das，再出手') : '听它说什么，再出手')),
      );
      const rt = canListen() ? readTarget(s, b) : null;
      const rs = rt ? readShown(b, rt) : '';
      if (rt)
        q.append(
          h(
            'div.note.shadow',
            h('span.small', { style: 'color:var(--gold, #ffcf4a)' }, this.readMsg || `新词：${rs} · ${w.zh}　按住 S（或按住「按住读」）把它${rs !== rt ? '连冠词一起' : ''}读出来，松开结束，读得像就是必中的一击`),
            h('button.btn.small', { onclick: () => this.ctrl.speak(rs), title: '再听一遍' }, '再听'),
          ),
        );
      else if (this.readMsg) q.append(h('div.note.shadow', h('span.small', { style: 'color:var(--gold, #ffcf4a)' }, this.readMsg)));
    } else if (this.question) {
      q.append(this.renderQuestion(this.question));
    }

    // The whole fight's log, scrollable (the newest line in view).
    const blog = h('div.blog');
    for (const l of b.log) blog.append(h(`div.${l.tone}`, l.text));

    // 词性三相 row: the stance for this monster.
    let stance: HTMLElement | string = '';
    if (needsPhase(b)) {
      stance = h(
        'div.stance',
        h('span.muted', '相：'),
        ...stancesFor(s.level, b).map((p, i) =>
          h(`button.btn.${p}${b.phase === p ? '.sel' : ''}`, { disabled: this.phase === 'result', onclick: () => this.setPhase(p), title: `${p}（${(i + 1) % 10}）` }, h('kbd', String((i + 1) % 10)), p),
        ),
        taught
          ? h(
              'span.small',
              { style: 'color:var(--gold, #ffcf4a)' },
              b.perfekt
                ? `  新词：${w.de} · ${w.zh}　完成时用 ${b.phase}，相已替你选好，记住它`
                : `  新词：${fullForm(w)} · ${w.zh}　第一次见，相已替你选好${b.phase !== w.art ? `（这句要 ${b.phase}）` : ''}，记住它`,
            )
          : b.pluralMon
            ? h('span.small', { style: 'color:var(--gold, #ffcf4a)' }, this.phase === 'answer' && this.question?.type === 'pickZh' ? '  复数怪 → 一律选 die' : `  这是一群「${w.zh}」（复数怪）→ 一律选 die`)
          : b.curse !== 'forget' && !(this.phase === 'answer' && this.question?.type === 'pickZh')
            ? h('span.small', { style: 'color:var(--gold, #ffcf4a)' }, `  它是「${w.zh}」→ 选它的相`)
            : '',
        h(
          'span.small.muted',
          taught ? '' : b.perfekt
            ? s.level <= 22 ? '  完成时：移动、变化（fahren、kommen、aufstehen）多用 sein，其余用 haben；23 级前选错不罚' : '  选对护甲降一档、回资源；选错护甲翻倍'
            : this.phaseNag && !b.phase
            ? s.level >= 7 ? '  先选相：它这句话里缺的那个冠词是什么？' : '  先选相：它是 der、die 还是 das？'
            : b.pluralMon
              ? ''
              : s.level >= 7
                ? b.intent.caseArt ? '  选句子空里那个冠词：照句中形式选，可能是 ein/eine、den/dem，不一定是词典里的 der/die/das' : '  这句没有它的名字：按名字选 der/die/das'
                : s.level <= 5 ? (s.level >= 4 ? '  选对护甲降一档、回言灵；6 级前选错不罚' : '  选对护甲降一档；6 级前选错不罚') : '  选对护甲降一档、回资源；选错护甲翻倍',
        ),
      );
    }

    // 教学战 (0.5 节奏表): the first fight after a new move opens points at it.
    const teach = this.phase === 'choose' && s.flags.teachSkills && !b.tutorial ? h('div.small', { style: 'color:var(--gold, #ffcf4a)' }, '新招：试试 Q 铭刻（下一题难一级，伤害 ×1.5）；答题卡住时可以按 W 低语（给提示，但这题不算会写）') : this.phase === 'choose' && b.teachFin ? h('div.small', { style: 'color:var(--gold, #ffcf4a)' }, '言灵已满：按 F 放终结技，看中文写整句') : '';
    clear(el).append(h('div.b-top', monEl, intent, me), stance, teach, movesEl, q, blog);
    blog.scrollTop = blog.scrollHeight;
    if (this.input && this.phase === 'answer') window.setTimeout(() => (this.mateBoxes[0] ?? this.input)?.focus(), 0);
  }

  private pending: string | undefined;

  /** 群怪 cards: name (article only once the right stance has landed), HP and each monster's own intent. */
  private renderPack(): HTMLElement {
    const wrap = h('div.b-mon.b-pack');
    this.ctrl.pack.forEach((pb, i) => {
      const w = pb.word;
      const g = genderOf(w);
      const known = !needsPhase(pb) || !!pb.phaseHit;
      const color = known && g ? NAME_RED : '#e8dccf';
      const elTag = known && (pb.pluralMon || g) ? ELEMENT_TAG[pb.pluralMon ? 'pl' : g!] : '';
      const it = pb.intent;
      const dead = !!pb.outcome;
      const card = h(
        `button.pk${pb === this.b ? '.sel' : ''}${dead ? '.dead' : ''}`,
        { onclick: () => this.target(i), title: '选中它（Tab 切换）', disabled: dead },
        h('div.fam', h('span', `${FAMILIES[w.family].zh} · Lv ${pb.monster.lvl}`), h('span', dead ? '已打散' : STAGE_ZH[pb.stage])),
        icon(monsterTile(pb), 2, dead, 'mon-icon small'),
        h('div.nm', { style: `color:${color}` }, dead ? (pb.pluralMon ? `die ${w.pl}` : fullForm(w)) : nameGlyph(pb), elTag && !dead ? h('span.tag', { style: 'margin-left:4px;font-size:10px' }, elTag) : ''),
        pb.pluralMon && !dead ? h('span.tag.echo', '复数怪 · 一律 die') : '',
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
    if (this.b.fx.swap && this.phase === 'answer' && this.move !== 'skill')
      wrap.append(
        h('button.btn.ghost.small', {
          onclick: () => {
            this.b.fx.swap = false;
            this.question = this.ctrl.askQuestion(this.move);
            this.echoSetup();
            this.render();
          },
        }, '🔁 Könnten Sie das wiederholen? 换一题'),
      );
    if (this.b.intent.kind === 'charge' && this.phase !== 'result') wrap.append(h('div.prompt', { style: 'color:var(--gold, #ffcf4a)' }, h('span', '它在蓄力——答对打断')));
    const tags = [qq.inscribed ? '铭刻 ×1.5' : '', qq.whispered ? '低语 · 不算会写' : '', qq.chorus ? '齐鸣' : ''].filter(Boolean).join(' · ');
    const hintBtn =
      this.phase === 'answer' && canHint(this.ctrl.state, this.b, this.move, qq)
        ? h('button.btn.ghost.small', { onclick: () => this.hint(), title: '低语：用一张纸条，给一个提示（选择题去掉一个错选项，打字题给首字母）。代价：这题不算会写、不回资源、护甲按低一档算，这个词下次要先不带提示答对' }, h('kbd', 'W'), `低语 · 提示（纸条 ${itemCount(this.ctrl.state, 'hint')}）`)
        : '';
    wrap.append(h('div.prompt', h('span', qq.prompt), tags ? h('span.tag', tags) : '', hintBtn));
    const focusColor = qq.type === 'article' && this.phase === 'result' && this.b.word.art ? NAME_RED : '';
    const long = qq.type === 'cloze' ? 'font-size:22px;line-height:1.4;' : '';
    wrap.append(h('div.focus', { style: (focusColor ? `color:${focusColor};` : '') + long }, qq.focus));
    this.input = null;
    // 告示怪 / 信件怪 / 文章群怪: the text the questions are about.
    if (qq.gram?.passage) wrap.append(h('div.passage', { style: 'white-space:pre-wrap;font-size:15px;line-height:1.5;border:1px solid var(--line, #553);padding:8px 10px;margin:6px 0;max-height:220px;overflow:auto' }, qq.gram.passage));
    // 齐鸣 (rev 234): write each same-stance mate's own word (with the article); each right one is hit.
    this.mateBoxes = [];
    if (qq.mates?.length) {
      const prev = this.lastValue.split('|').slice(1);
      const rows = qq.mates.map((id, i) => {
        const mw = WORD_BY_ID[id];
        const box = h('input', { type: 'text', autocomplete: 'off', autocapitalize: 'off', spellcheck: 'false', placeholder: 'der / die / das + 名词', disabled: this.phase !== 'answer' }) as HTMLInputElement;
        if (this.phase === 'result') box.value = prev[i] ?? '';
        box.addEventListener('keydown', (e) => {
          if (e.key !== 'Enter') return;
          e.preventDefault();
          e.stopPropagation();
          (this.mateBoxes[i + 1] ?? this.input)?.focus();
        });
        this.mateBoxes.push(box);
        return h('div.typing', h('span.small', `齐鸣 → ${mw ? zhWithPos(mw) : id}`), box, umlautButtons(box));
      });
      wrap.append(h('div.small.muted', '齐鸣：先写下同相伙伴的词（带冠词），写对一个伤一只；再答目标的题'), ...rows);
    }
    if (qq.echo && this.phase === 'answer') {
      if (this.echoMsg) wrap.append(h('div.small', { style: 'color:var(--gold, #ffcf4a)' }, this.echoMsg));
      if (!qq.echo.say) wrap.append(h('button.btn.ghost.small', { onclick: () => this.ctrl.speak(qq.echo!.target) }, '🔊 再听'));
    }
    if (qq.echo?.say) {
      const btn = h('button.btn.primary', { disabled: this.phase !== 'answer' || this.echoBusy }, isRecording() ? '在听……松开就判' : '🎤 按住读（空格）');
      btn.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        void this.echoStart();
      });
      for (const ev of ['pointerup', 'pointerleave', 'pointercancel']) btn.addEventListener(ev, () => void this.echoStop());
      wrap.append(h('div.opts', btn, h('button.btn.ghost.small', { onclick: () => this.ctrl.speak(qq.echo!.target), disabled: this.phase !== 'answer' }, '🔊 听示范'), h('button.btn.ghost.small', { onclick: () => { this.echoMsg = ''; this.echoListen(); this.render(); }, disabled: this.phase !== 'answer' }, '改成听辨')));
    } else if (qq.options) {
      const opts = h('div.opts');
      qq.options.forEach((o, i) => {
        const cls = qq.type === 'article' ? `.${o}` : '';
        opts.append(
          h(`button.btn${cls}`, { disabled: this.phase !== 'answer', onclick: () => this.submit(o) }, h('kbd', String(i + 1)), o),
        );
      });
      wrap.append(opts);
    } else if (qq.boxes?.length) {
      // 墨水风暴 (rev 234): one box per form, in order; Enter moves on, the last one sends "a|b|c".
      const prev = this.lastValue.split('|');
      const boxes = qq.boxes.map((label, i) => {
        const box = h('input', { type: 'text', autocomplete: 'off', autocapitalize: 'off', spellcheck: 'false', placeholder: label, disabled: this.phase !== 'answer' }) as HTMLInputElement;
        if (this.phase === 'result') box.value = prev[i] ?? '';
        return box;
      });
      const send = () => this.submit(boxes.map((x) => x.value).join('|'));
      boxes.forEach((box, i) =>
        box.addEventListener('keydown', (e) => {
          if (e.key !== 'Enter') return;
          e.preventDefault();
          e.stopPropagation();
          if (boxes[i + 1]) boxes[i + 1].focus();
          else send();
        }),
      );
      this.input = boxes[0];
      wrap.append(
        ...boxes.map((box, i) => h('div.typing', h('span.small', `${i + 1}. ${qq.boxes![i]}`), box, umlautButtons(box))),
        h('div.typing', h('button.btn.primary', { disabled: this.phase !== 'answer', onclick: send }, '出招 ↵')),
      );
    } else if (qq.ult) {
      // 终极技能: the frame with two blanks, one box each; sent as "a|b".
      const box = () => h('input', { type: 'text', autocomplete: 'off', autocapitalize: 'off', spellcheck: 'false', placeholder: '填空', disabled: this.phase !== 'answer' }) as HTMLInputElement;
      const a = box();
      const c = box();
      if (this.phase === 'result') [a.value, c.value = ''] = this.lastValue.split('|');
      const send = () => this.submit(`${a.value}|${c.value}`);
      a.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          e.stopPropagation();
          c.focus();
        }
      });
      c.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          e.stopPropagation();
          send();
        }
      });
      this.input = a;
      wrap.append(
        h('div.focus', { style: 'font-size:20px' }, qq.frame ?? ''),
        h('div.typing', a, c, umlautButtons(c), h('button.btn.primary', { disabled: this.phase !== 'answer', onclick: send }, '出招 ↵')),
      );
    } else if (qq.item) {
      // 药片 turn: nothing to answer.
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
      if (this.phase === 'result') input.value = qq.mates?.length ? this.lastValue.split('|')[0] : this.lastValue;
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          e.stopPropagation(); // don't let the same Enter also press "continue"
          this.submit(input.value);
        } else if (e.key === '?' && this.phase === 'answer' && canHint(this.ctrl.state, this.b, this.move, qq)) {
          // 低语 while typing (W would be a letter): grading ignores '?', so it is free to use as the key.
          e.preventDefault();
          this.hint();
        }
      });
      this.input = input;
      wrap.append(
        h('div.typing', input, umlautButtons(input), h('button.btn.primary', { disabled: this.phase !== 'answer', onclick: () => this.submit(input.value) }, '出招 ↵')),
      );
    }
    if (this.phase === 'result' && r) {
      const fb = h(`div.feedback.${r.correct ? 'ok' : 'no'}`);
      const head = qq.item ? '吃了药片' : r.correct ? (r.crit ? (r.newSpell ? '新言灵！暴击！' : '暴击！') : r.parried ? '弹反！' : '答对了') : '答错了';
      fb.append(h('b', head));
      if (qq.item && r.monsterDamage) fb.append(h('span', `  它趁机出手：${r.monsterDamage} 伤害`));
      if (r.correct && this.b.word && (qq.type === 'article' || qq.type === 'typed')) fb.append(h('span', `  ${fullForm(this.b.word)} · ${this.b.word.zh}`));
      if (qq.echo) fb.append(h('span', `  ${qq.echo.target}（${qq.echo.zhT}） · ${qq.echo.partner}（${qq.echo.zhP}）`));
      if (r.phase === 'right') fb.append(h('span', `  ${this.b.phase} 相 · 弱点`));
      if (r.phase === 'wrong') fb.append(h('span', `  ${this.b.phase} 相被抵抗：${phaseWrongWhy(this.b)}`));
      if (r.element) fb.append(h('span', `  元素：${ELEMENT_ZH[r.element]}`));
      for (const n of r.verdict.notes) fb.append(h('span.note', n));
      if (r.readRight) fb.append(h('span.note', '读懂了它：连击 +1'));
      if (this.voicedFull) fb.append(h('span.note', `它刚才念的是：${this.voicedFull}`));
      fb.append(this.shadowRow());
      const reportable = this.reportable(qq);
      if (reportable) {
        fb.append(
          reportButton(reportable.sentence, reportable.context, () => window.clearTimeout(this.autoTimer)),
        );
      }
      fb.append(h('span.note.muted', this.ctrl.fightOver() ? '结算（Enter 跳过）' : !r.correct && qq.type === 'cloze' ? h('button.btn.small', { onclick: () => this.continue() }, '看完了，继续（Enter）') : '下一题（Enter 跳过）'));
      wrap.append(fb);
    }
    return wrap;
  }

}

/** The monster's name as the player may see it (0.6.x: single card, pack cards and 「X 说」 use the same rule):
 *  glitch when unnamed, every other letter when cracked, half the word (article once the right stance landed) after. */
function nameGlyph(b: Battle): string {
  const de = shownDe(b);
  const showG = !needsPhase(b) || !!b.phaseHit;
  if (b.phrase) return `${b.phrase.a} …`;
  // 斩杀: a word being verified shows no letters at all, whatever its stage.
  if (b.stage === 0 || (b.verify && !b.verifyDone)) return Array.from({ length: Math.max(3, Math.min(9, de.length)) }, () => GLITCH[Math.floor(Math.random() * GLITCH.length)]).join('');
  if (b.stage === 1) return [...de].map((c, i) => (i % 2 === 0 || c === ' ' ? c : '▒')).join('');
  return (showG && b.word.art ? (b.pluralMon ? 'die' : b.word.art) + ' ' : '') + de.slice(0, Math.ceil(de.length / 2)) + '▒▒';
}
