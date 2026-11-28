import { monsterArt, monsterIcon, heroIcon } from './icons';
import { genderHint } from '../core/genderRules';
import type { Word } from '../core/types';
import { DEFAULT_LOOK } from '../core/look';
import type { Battle, Question, TurnReport } from '../core/combat';
import { count as itemCount, itemsOpen, tabletHeal } from '../core/items';
import { CHARM, equippedCharms } from '../core/charms';
import { listenRate } from '../core/listening';
import { bestHeard, lineLeaks, plateZh, castMs, gcdMs, realtimeOn, voiceOpen } from '../core/combat';
import { availableMoves, chorusMates, canHint, comboTier, effArmor, moveReady, poolReady, needsPhase, phaseOf, resName, stancesFor, teachPhase, readTarget, readRecall, readShown, phaseWrongWhy, stanceRuleNote, nameStanceWhy } from '../core/combat';
import { articleSlip, clarity, shadowOk } from '../core/shadow';
import { has } from '../core/unlocks';
import { CONFIG } from '../core/config';
import type { Stance } from '../core/cloze';
import { ELEMENT_ZH } from '../core/intents';
import { STAGE_ZH } from '../core/srs';
import { maxHp } from '../core/state';
import type { Move } from '../core/types';
import { FAMILIES } from '../data/families';
import { carriesShout, combatSkills, POOL, type PoolId } from '../core/skillPool';
import { resMax } from '../core/classes';
import { fullForm, fullFormLong, genderOf, WORD_BY_ID, zhWithPos } from '../data/words';
import type { Controller } from '../game/controller';
import { ELEMENT_TAG, GLITCH, NAME_RED } from '../game/sprites';
import { GRAM_DUNGEON } from '../core/gram/dungeons';
import { $, bar, clear, h, isTyping, umlautButtons } from './dom';
import { reportButton } from './report';
import { logLine } from './gamelog';
import { dialogOpen } from './feedback';
import { canListen, lastConfidence, listenOnce, listening, stopHold, stopListening } from './listen';
import { defDe, defTier, SYN_NOTE, synonymHit, type DefTier } from '../core/dedef';
import { isRecording, judgePair, playRecording, pronReady, startRecording, stopRecording } from './phoneme';
import { ECHO_RETRIES, echoVerdict, listenSide, notePron } from '../core/pron';
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
  skill: { key: 'R', zh: '技能', sub: '' },
  cls: { key: 'G', zh: '技能', sub: '' },
  item: { key: 'H', zh: '药片', sub: '回血 · 不占回合' },
};

/** 试玩 #45/#52: the stance hint when the line gives no article to copy (the stance is the name's der/die/das). */
function nameStanceTip(s: Parameters<typeof nameStanceWhy>[0], b: Battle): string {
  const r = nameStanceWhy(s, b);
  if (r.why === 'closed') return `这句的空要用${r.c === 'dat' ? '第三格' : '第四格'}，${r.c === 'dat' ? CONFIG.phase.datFrom : CONFIG.phase.accFrom} 级才学到：先按名字选 der/die/das`;
  return '这句空里没有能照着选的冠词：按名字选 der/die/das';
}

export class BattleUI {
  phase: Phase = 'choose';
  move: Move = 'attack';
  question: Question | null = null;
  report: TurnReport | null = null;
  zhShown = false;
  input: HTMLInputElement | null = null;
  private autoTimer = 0;
  /** 即时战: on for this fight, when the current cast started and how long it is, the 100 ms loop. */
  private rtOn = false;
  private castStart = 0;
  private castLen = 0;
  private rtLoop = 0;
  /** 1.0.11 试玩 15: when the cast loop last ran (performance.now()); held time is added back to the cast. */
  private rtLast = 0;
  private lastValue = '';
  /** 齐鸣 (rev 234): one box per same-stance mate, sent after the target's answer joined with |. */
  private mateBoxes: HTMLInputElement[] = [];
  /** Where the player had scrolled the current notice / article to. */
  private passageAt: { text: string; top: number } | null = null;
  private voicedFull = '';
  /** 1.0.12 试玩 107: the line the monster said for the question just answered; the result screen keeps showing it
   *  (the monster's next line comes with the next turn), so 「它刚才念的是」 matches the line on top. */
  private answeredLine: { b: Battle; intent: Battle['intent'] } | null = null;
  /** 跟读: the German sentence just read aloud after a right answer, and the last attempt's feedback. */
  private shadowText = '';
  private readMsg = '';
  /** 德语释义 (1.0.12): words whose Chinese was opened this fight (a tap, or a miss); the question's own Chinese clue. */
  private zhOpen = new Set<string>();
  private qZhOpen = false;
  /** 近义容错: the note under the box after a synonym was typed (the question stays open). */
  private synMsg = '';
  /** When the current question showed (performance.now()). */
  private askedAt = 0;
  private shadowMsg = '';
  private renderedQ: Question | null = null;
  private phaseNag = false;
  /** 秘术栏: the charm being shouted (its input row is open). */
  private charmId: string | null = null;
  private ult97Busy = false;
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
      this.question = { ...q, echo: { ...q.echo, say: true }, options: undefined, prompt: `${this.b?.pronMon ? '发音怪' : '回音怪'} · 读出来：按住空格（或按住下面的按钮）读这个词，松开就判`, focus: `${q.echo.target}   /${q.echo.ipaT.replace(/ /g, '')}/` };
    } else this.echoListen();
  }

  private echoListen(): void {
    const q = this.question;
    if (!q?.echo) return;
    const e = q.echo.say === false ? q.echo : listenSide(q.echo, Math.random);
    this.question = { ...q, echo: { ...e, say: false }, answer: e.target, options: this.echoOpts, prompt: `${this.b?.pronMon ? '发音怪' : '回音怪'} · 听辨：它读的是 ${this.echoOpts.join(' 还是 ')}？`, focus: '🔊 ？' };
    this.ctrl.speak(e.target);
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
    this.zhOpen.clear();
    this.shadowText = '';
    this.shadowMsg = '';
    $('battle').hidden = false;
    this.rtSetup();
    this.startTurn();
  }

  close(): void {
    window.clearTimeout(this.autoTimer);
    window.clearInterval(this.rtLoop);
    this.rtOn = false;
    this.ctrl.realtime = false;
    stopListening();
    $('battle').hidden = true;
    this.input = null;
  }

  private startTurn() {
    // 德语释义 (1.0.12): a word shown by its German definition keeps its example's Chinese until the answer.
    this.zhShown = (this.ctrl.state.settings.autoZh || this.ctrl.state.level <= 3) && this.defView(this.b)?.tier !== 'de';
    this.qZhOpen = false;
    this.synMsg = '';
    // 直接叫名 (审查修订: chosen before the fight): straight to the dictation — no teaching, nothing read aloud.
    if (this.b.direct) {
      this.readMsg = '';
      this.zhShown = false;
      this.phaseNag = false;
      this.move = 'attack';
      this.question = this.ctrl.askQuestion('attack');
      this.phase = 'answer';
      this.askedAt = performance.now();
      this.render();
      return;
    }
    // 1.0.12 (#47): while the 「我认识它」 button stands, the monster's line (often the word's own example) is not read.
    if (!this.offerDirect()) this.ctrl.speak(this.b.intent.line);
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

  /** 技能池: keys R G T Y for the loadout's skills, in order. */
  static readonly SKILL_KEYS = ['R', 'G', 'T', 'Y'];
  private skillId: PoolId | undefined;

  chooseSkill(id: PoolId): void {
    if (!poolReady(this.ctrl.state, this.b, id)) return;
    this.skillId = id;
    this.choose('skill');
  }

  choose(move: Move): void {
    if (!(this.moves().includes(move) || move === 'whisper') || !moveReady(this.ctrl.state, this.b, move)) return;
    if (move !== 'skill') this.skillId = undefined;
    stopListening();
    if (needsPhase(this.b) && !this.b.phase && move !== 'skill') {
      this.phaseNag = true;
      this.render();
      return;
    }
    this.phaseNag = false;
    this.move = move;
    this.question = this.ctrl.askQuestion(move, move === 'skill' ? this.skillId : undefined);
    if (this.question.listen) this.ctrl.speak(this.question.listen, this.question.gram?.sys === 'listen' || this.question.gram?.sys === 'blind' ? listenRate(this.ctrl.state.level) : undefined);
    this.echoSetup();
    // Listening step: the monster says its own name, the player picks the meaning.
    if (this.question.type === 'pickZh' && this.question.focus) this.ctrl.speak(this.question.focus);
    else if (this.question.teach) this.ctrl.speak(this.question.teach.de); // 初见教学: hear it once
    if (this.question.type === 'saying') this.ctrl.speak(this.question.say!.a);
    this.phase = 'answer';
    this.askedAt = performance.now();
    this.render();
  }

  /** 秘术栏: type the whole sentence; before 33 it spends the turn like a tablet. */
  shout(id: string, input: string): void {
    if (this.phase !== 'choose') return;
    const target = this.b;
    const from = target.log.length;
    const r = this.ctrl.shoutCharm(id, input);
    this.charmId = null;
    if (!r) return;
    logLine(`喊出：${r.res.text}`, r.res.ok && !r.res.backfire ? 'good' : 'bad');
    if (!r.report) {
      this.render();
      return;
    }
    stopListening();
    this.report = r.report;
    this.question = { type: 'steady', prompt: '喊出短句', focus: r.res.text, item: true };
    this.move = 'item';
    this.answeredLine = null; // 1.0.12 试玩 107: no line was answered; show its current one
    this.phase = 'result';
    this.lastValue = '';
    this.voicedFull = '';
    this.shadowText = '';
    for (const l of target.log.slice(from + 1)) logLine(`  ${l.text}`, l.tone === 'good' ? 'good' : l.tone === 'bad' ? 'bad' : l.tone === 'crit' ? 'gold' : 'info');
    this.render();
    window.clearTimeout(this.autoTimer);
    this.autoTimer = window.setTimeout(() => this.continue(), this.ctrl.fightOver() ? 1600 : 1400);
  }

  private charmRow(): HTMLElement | string {
    const s = this.ctrl.state;
    const b = this.b;
    const list = equippedCharms(s, carriesShout(s));
    if (!list.length || b.tutorial) return '';
    const used = b.fx.charm?.used ?? [];
    const row = h('div.hud-row.small');
    for (const c of list) {
      row.append(h('button.btn.ghost.small', {
        disabled: this.phase !== 'choose' || used.includes(c.id),
        onclick: () => { this.charmId = this.charmId === c.id ? null : c.id; this.render(); },
        title: `${c.zh}：${c.fx}${c.kind === 'slang' ? `（只对${(c as { when?: string }).when}）` : ''}。打出整句生效，每场一次；${s.level < CHARM.bonusFrom ? '占一回合（33 级起不占回合）' : '附赠动作，不占回合'}`,
      }, used.includes(c.id) ? `${c.kind === 'slang' ? '俚语' : '短句'} ✓ ${c.zh}` : `${c.kind === 'slang' ? '俚语' : '短句'} · ${c.zh}`));
    }
    if (this.charmId && this.phase === 'choose') {
      const c = list.find((x) => x.id === this.charmId);
      if (c) {
        const inp = h('input.charm-in', { placeholder: `打出整句：${c.zh}`, autocomplete: 'off', spellcheck: false }) as HTMLInputElement;
        inp.addEventListener('keydown', (e) => {
          e.stopPropagation();
          if (e.key === 'Enter' && inp.value.trim()) this.shout(c.id, inp.value);
          if (e.key === 'Escape') { this.charmId = null; this.render(); }
        });
        row.append(inp, h('button.btn.small', { onclick: () => inp.value.trim() && this.shout(c.id, inp.value) }, '喊出'));
        window.setTimeout(() => inp.focus(), 0);
      }
    }
    return row;
  }

  /** 药片 (物品栏): heal at once, no turn spent (Lucas 2026-11-27): usable while choosing or answering. */
  tablet(): void {
    if (this.phase !== 'choose' && this.phase !== 'answer') return;
    const r = this.ctrl.useTablet();
    if (!r) return;
    logLine(`吃了一片药：生命 +${r.heal}（不占回合）`, 'good');
    if (this.question) this.renderedQ = this.question; // keep what was typed so far
    this.render();
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
    // 提示词造句 (97): the sentence is checked first (rules → LanguageTool → AI), then the turn runs.
    if (this.question.prompt97 && !this.question.ultGrade) {
      if (this.ult97Busy) return;
      this.ult97Busy = true;
      this.question.ms ??= Math.round(performance.now() - this.askedAt);
      const q = this.question;
      logLine('提示词造句：检查中……', 'info');
      void this.ctrl.ultCheck(q, value).then((notes) => {
        this.ult97Busy = false;
        for (const n of notes) logLine(`  ${n}`, q.ultGrade === 'fail' ? 'bad' : 'info');
        if (this.question === q && this.phase === 'answer') this.submit(value);
      });
      return;
    }
    if (this.question.mates?.length) value = [value, ...this.mateBoxes.map((x) => x.value)].join('|');
    // 近义容错 (1.0.12): a 近义 word of the target is not wrong — no HP, no record; the same question stays open.
    const synOf = this.question.review ? WORD_BY_ID[this.question.review] : this.b.word;
    if (synOf && synonymHit(this.question, synOf, value)) {
      this.synMsg = SYN_NOTE;
      this.lastValue = value;
      logLine(`你写的 ${value.trim()}：${SYN_NOTE}`, 'info');
      this.render();
      return;
    }
    this.synMsg = '';
    // 答题用时 (速记 / A2 快答 / 一气呵成): from the question showing to the answer.
    this.question.ms ??= Math.round(performance.now() - this.askedAt);
    this.lastValue = value;
    const intentBefore = this.b.intent;
    const voiced = this.b.intent;
    const target = this.b;
    const logFrom = target.log.length;
    this.report = this.ctrl.answer(this.move, this.question, value);
    // 德语释义: a miss on the monster's own word opens its Chinese for the rest of the fight (free).
    if (!this.report.correct && !this.question.review) this.zhOpen.add(target.word.id);
    this.answeredLine = { b: target, intent: intentBefore };
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
    // 1.0.12 试玩 51: a clean hit that gives the whole sentence back stays long enough to read it (Enter skips).
    const clean = this.report.correct && !this.report.verdict.notes.length;
    const delay = this.ctrl.fightOver() ? 1600 : clean ? (this.voicedFull ? resultReadMs(this.voicedFull) : 1000) : 2600;
    window.clearTimeout(this.autoTimer);
    if (this.rtOn) {
      // 即时战: an interrupted cast restarts with its next move; the next question comes after the global cooldown
      // (a wrong choice answer staggers you longer). Time keeps running meanwhile: the cooldown is the cost.
      if (this.b && this.b.intent !== intentBefore) this.startCast();
      this.autoTimer = window.setTimeout(() => this.continue(), this.ctrl.fightOver() ? 1600 : gcdMs(this.ctrl.state, this.question, this.report.correct));
      return;
    }
    // 0.6.x: a wrong cloze waits for Enter, so the correction and its rule can be read.
    if (!this.report.correct && this.question.type === 'cloze' && !this.ctrl.fightOver()) return;
    this.autoTimer = window.setTimeout(() => this.continue(), delay);
  }

  /** 德语释义 (1.0.12): how this monster's word shows its meaning, or null for plain Chinese. */
  private defView(b: Battle): { tier: DefTier; def: string; open: boolean } | null {
    if (!b || b.phrase) return null;
    const def = defDe(b.word);
    const tier = defTier(b.word, this.ctrl.state.settings);
    if (!def || tier === 'zh') return null;
    return { tier, def, open: tier === 'zhDe' || this.zhOpen.has(b.word.id) };
  }

  /** The word's meaning as the player sees it now: the definition while its Chinese is hidden, else the Chinese. */
  private meaningText(b: Battle): string {
    const v = this.defView(b);
    return v && !v.open ? v.def : b.word.zh;
  }

  /** The meaning in a short label (move button, stance bar): a long definition is clipped. */
  private shortMeaning(b: Battle): string {
    const v = this.defView(b);
    return v && !v.open ? clipDef(v.def) : b.word.zh;
  }

  /** A pack card's short plate: the garble rule first, then a clipped definition while the Chinese is hidden. */
  private packName(b: Battle, hide: boolean): string {
    const v = hide || b.word.erode ? null : this.defView(b);
    if (v && !v.open) return clipDef(v.def) + (b.pluralMon ? ' · 复数' : '');
    return nameGlyph(b, hide);
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
    // 1.0.10 (Lucas: 「你答 das Bar ✗，正确：das Bar」): 造句 / 句式题 have no single right answer — q.answer is only
    // the word to use, so the log says what was asked instead of a 「正确」 that equals the input.
    const free = q.write === 'compose' || q.write === 'slot';
    const right = free ? '' : r.verdict.correct || q.answer || '';
    const head = r.correct
      ? `${name}：${ask} 你答 ${value} ✓${r.crit ? ' 暴击' : ''}${r.playerDamage ? `，造成 ${r.playerDamage} 伤害` : ''}`
      : `${name}：${ask} 你答 ${value || '（空）'} ✗${right ? `，正确：${right}` : free ? `（${q.write === 'compose' ? '造句题：要用这个词写一句完整的句子' : '句式题：要按句式写一整句'}）` : ''}`;
    logLine(head, r.correct ? 'good' : 'bad');
    for (const n of r.verdict.notes) if (!n.startsWith('正确答案')) logLine(`  ${n}`, 'info');
    // 1.0.12 试玩 66: the fight's own log already says every hit (「它打中你，共 N 点」), so no second line here.
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
    const zh = this.meaningText(b);
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
      if (q) q.spoken = true;
      if ((this.phase as Phase) === 'answer' && q) this.submit(q.answer ?? '');
      return;
    }
    this.render();
  }

  // ---- 即时战 (81) ---------------------------------------------------------------------------------

  private rtSetup(): void {
    window.clearInterval(this.rtLoop);
    this.rtOn = realtimeOn(this.ctrl.state, this.b);
    this.ctrl.realtime = this.rtOn;
    if (!this.rtOn) return;
    this.startCast();
    this.rtLast = performance.now();
    this.rtLoop = window.setInterval(() => this.rtStep(), 100);
  }

  private startCast(): void {
    this.castStart = performance.now();
    this.castLen = castMs(this.ctrl.state, this.b);
  }

  private castLeft(): number {
    return Math.max(0, this.castStart + this.castLen - performance.now());
  }

  /** 1.0.11 试玩 15: the cast waits while a long text or a listening passage is answered, while a dialog or panel is
   *  open and while the tab is hidden. The feedback after an answer is not held: in 即时战 it lasts exactly the global
   *  cooldown / the 2 s stagger of a wrong choice (REALTIME.gcd / stagger), and that time is meant to cost. */
  private castHeld(): boolean {
    if (this.phase === 'answer' && longRead(this.question)) return true;
    // 1.0.12 试玩 40: 直接叫名 (nobody hits during it) and 造句 (a sentence of your own) wait too.
    if (this.phase === 'answer' && (this.question?.directName || this.question?.write === 'compose')) return true;
    if (dialogOpen()) return true;
    if (typeof document === 'undefined') return false;
    if (document.visibilityState === 'hidden') return true;
    const modal = document.getElementById('modal');
    return !!modal && !modal.hidden;
  }

  private rtStep(): void {
    if (!this.rtOn || !this.ctrl.battle || this.ctrl.fightOver()) return;
    // A held cast keeps its time; a long gap between steps (a throttled background tab) counts as held too.
    const now = performance.now();
    const dt = Math.max(0, now - (this.rtLast || now));
    this.rtLast = now;
    const held = this.castHeld();
    this.castStart += held ? dt : Math.max(0, dt - 250);
    const left = this.castLeft();
    const bar = document.getElementById('rt-cast');
    if (bar) bar.style.width = `${Math.round((100 * left) / this.castLen)}%`;
    const lab = document.getElementById('rt-cast-label');
    if (lab) lab.textContent = `${(left / 1000).toFixed(1)} 秒${held ? '（暂停）' : ''}`;
    if (held || left > 0) return;
    const target = this.b;
    const from = target.log.length;
    const r = this.ctrl.tick();
    if (!r) return;
    for (const l of target.log.slice(from)) logLine(`  ${l.text}`, l.tone === 'good' ? 'good' : l.tone === 'bad' ? 'bad' : l.tone === 'crit' ? 'gold' : 'info');
    if (this.ctrl.fightOver()) {
      this.report = r;
      this.question = { type: 'steady', prompt: '它出手了', focus: '', item: true, tick: true };
      this.answeredLine = null;
      this.phase = 'result';
      this.render();
      window.clearTimeout(this.autoTimer);
      this.autoTimer = window.setTimeout(() => this.continue(), 1600);
      return;
    }
    this.startCast();
    this.render();
  }

  private voiceMsg = '';

  /** 开口作答: hold to speak; the best heard version is sent as the answer (spoken = 认得, never 会写). */
  async voiceAnswer(): Promise<void> {
    const q = this.question;
    if (!q || this.phase !== 'answer' || listening() || !canListen()) return;
    this.voiceMsg = '录音中……说出答案，松开结束';
    this.render();
    const heard = await listenOnce({ hold: true });
    if (this.question !== q || this.phase !== 'answer') return;
    if (!heard?.length) {
      this.voiceMsg = heard === null ? '' : '没听清，再说一次，或者直接打字';
      this.render();
      return;
    }
    this.voiceMsg = '';
    const pick = bestHeard(heard, q.answer ?? '');
    q.spoken = true;
    q.voiced = true;
    this.submit(pick);
  }

  /** 1.0.12 (#47): the in-fight 「我认识它」 button stands (「没学过」 players) — not while the 读出来 note shows the word. */
  private offerDirect(): boolean {
    const b = this.b;
    return !!b.directOffer && !b.outcome && !(canListen() && readTarget(this.ctrl.state, b));
  }

  /** 直接叫名: the next attack question is a plain dictation. */
  directName(): void {
    if (this.phase !== 'choose' || !this.offerDirect()) return;
    this.b.direct = true;
    this.startTurn(); // straight to the dictation, like the offer before the fight (no stance first)
  }

  /** 斩杀: the verified monster dies on the spot. */
  cut(): void {
    if (this.phase !== 'choose' || !this.b.cutReady || this.b.outcome) return;
    stopListening();
    // 1.0.12 试玩 66: the controller's 斩杀 toast is the log line (toast() logs it); no second one here.
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
    // 格位连锁: the follow-up question comes right away, before the monster's next turn.
    if (this.b.chainOffer) {
      this.choose('attack');
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
    this.speakLine();
    this.render();
  }

  /** Keyboard: A/S/D/F/R to pick a move, 1–3 for options, Enter to continue, Esc to change move. */
  onKey(e: KeyboardEvent): boolean {
    if ($('battle').hidden) return false;
    // 1.0.11 试玩 9: a panel on top gets the keys (Esc closes it); the fight waits behind it.
    if (!$('modal').hidden) return false;
    // Any text box (墨水风暴 forms, ult frame, 齐鸣 mates), not only the main one: Z/V/S are letters there.
    const typing = isTyping();
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
      if (k === 'h') {
        this.tablet();
        return true;
      }
      if (k === 'w' && this.phase === 'answer') {
        this.hint();
        return true;
      }
      const si = BattleUI.SKILL_KEYS.indexOf(k.toUpperCase());
      const lo = combatSkills(this.ctrl.state);
      if (si >= 0 && lo[si]) {
        this.chooseSkill(lo[si]);
        return true;
      }
      const map: Record<string, Move> = { a: 'attack', q: 'inscribe', e: 'chorus', f: 'sentence' };
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
      this.speakLine();
      return true;
    }
    return false;
  }

  render(): void {
    // Keep what the player typed when the panel re-renders (e.g. after 看中文).
    const keep = this.phase === 'answer' && this.renderedQ === this.question ? this.input?.value : undefined;
    this.pending = keep;
    // 1.0.11 试玩 13: the same for every box (墨水风暴, 终结技, 齐鸣) and the one that had the focus.
    const kept = keep !== undefined ? keepInputs($('battle')) : null;
    // 1.0.12 试玩 36: the box scrolls inside when it is taller than the window; a re-render of the same question keeps the place.
    const sameQ = !!this.question && this.renderedQ === this.question;
    const scrolled = $('battle').scrollTop;
    const s = this.ctrl.state;
    const b = this.b;
    // 试玩 #64/#71: a 直接叫名 turn (and its result) has no line and no stance: no hint, no 第一次见 strip.
    const directQ = b.direct || !!this.question?.directName;
    const taught = directQ ? false : this.phase !== 'result' ? teachPhase(b) : !!b.phaseTaught && b.phaseTaught === b.turn && b.phase === phaseOf(b); // a pack's next target is taught too
    const el = $('battle');
    el.className = 'panel';
    const w = b.word;
    const g = genderOf(w);
    // 词性三相: the card never gives the gender away until the right stance has landed once.
    const showG = !needsPhase(b) || !!b.phaseHit;
    const color = b.stage === 0 || !showG ? '#e8dccf' : NAME_RED;
    const elTag = b.stage > 0 && showG && (b.pluralMon || g) ? ELEMENT_TAG[b.pluralMon ? 'pl' : g!] : '';

    // Monster card.
    const garbled = !b.phrase && (!!b.word.erode || (this.phase === 'answer' && asksMeaning(this.question)));
    // 德语释义 (1.0.12): the garble rule comes first; then the definition under (zhDe) or instead of (de) the Chinese.
    const dv = garbled ? null : this.defView(b);
    const defOnly = !!dv && dv.tier === 'de' && !dv.open;
    const openZh = () => {
      this.zhOpen.add(b.word.id);
      this.render();
    };
    const glyph = defOnly ? dv!.def + (b.pluralMon ? ' · 复数' : '') : nameGlyph(b, this.phase === 'answer' && asksMeaning(this.question));
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
      monsterIcon(monsterArt(b, this.ctrl.dungeon?.left === 1), 5, false, 'mon-icon', this.ctrl.dungeon?.left !== 1 && !!this.ctrl.scene?.bright),
      // 1.0.10 (Lucas: 字体不清晰): no blurred glow on the plate; a garbled plate is crisp symbols that jitter.
      h(
        `div.glyph${b.stage === 0 || !showG ? '.plain' : ''}${garbled ? '.garble' : ''}${defOnly ? '.defde' : ''}`,
        defOnly ? { style: `color:${color};${DEF_PLATE_STYLE}`, title: '点一下看中文', onclick: openZh } : { style: `color:${color}` },
        glyph,
        elTag ? h('span.tag', { style: 'margin-left:6px;font-size:11px;vertical-align:middle' }, elTag) : '',
      ),
      defOnly
        ? h('button.btn.ghost.tiny', { onclick: openZh, title: '看中文不花任何代价' }, '看中文')
        : dv
          ? h('div.plate-def.small', { style: DEF_LINE_STYLE }, dv.def)
          : '',
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
    const said = this.phase === 'result' && this.answeredLine?.b === b ? this.answeredLine.intent : it;
    const intent = h(
      'div.b-intent',
      h(
        'div',
        { style: 'flex:1;min-width:0' },
        h('div.kind', `${pack.length > 1 ? this.packName(b, this.phase === 'answer' && asksMeaning(this.question)) + ' ' : '它'}说`),
        // 审查修订: the line often is the word's own example — while a finisher / ultimate or 直接叫名 is answered it
        // only mumbles.
        ...(() => {
          const mum = b.direct || (this.phase === 'choose' && this.offerDirect()) || (this.phase === 'answer' && (this.move === 'sentence' || !!this.question?.ult || lineLeaks(it.line, this.question)));
          // 德语释义: a definition word's example shows its Chinese once the question is answered.
          const zhNow = this.zhShown || (this.phase === 'result' && this.defView(b)?.tier === 'de');
          return [h('div.line', mum ? '… mmh …' : said.line), h('div.zh', !mum && zhNow && this.b.curse !== 'forget' ? plainZh(said.zh) : '')];
        })(),
        // 即时战: its cast bar; answer right while an attack casts and it misses, during a charge and it breaks.
        this.rtOn
          ? h(
              'div.small',
              { style: 'margin:4px 0' },
              h('div', { style: 'height:6px;background:#2a1414;border-radius:3px;overflow:hidden' }, h('div#rt-cast', { style: `height:100%;width:${Math.round((100 * this.castLeft()) / (this.castLen || 1))}%;background:${it.kind === 'charge' ? 'var(--gold, #ffcf4a)' : '#d8333a'}` })),
              h('span#rt-cast-label.muted', `${(this.castLeft() / 1000).toFixed(1)} 秒`),
              h('span.muted', it.kind === 'attack' ? ' · 读条结束前答对就躲开这一下' : it.kind === 'charge' ? ' · 读条结束前答对就打断' : ''),
            )
          : '',
        h(
          'div.ib',
          h('button.btn', { onclick: () => this.speakLine(), title: '再听一遍（V）' }, '🔊 再听'),
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
              disabled: (this.phase !== 'choose' && this.phase !== 'answer') || itemCount(s, 'tablet') <= 0 || s.hp >= maxHp(s),
              onclick: () => this.tablet(),
              title: `药片：回 ${tabletHeal(s)} 生命，不占回合`,
            }, h('kbd', 'H'), `药片 ×${itemCount(s, 'tablet')}`),
          )
        : '',
      this.charmRow(),
      h('div.hud-row', h('button.btn.ghost.small', { onclick: () => this.ctrl.flee(), title: '撤退：连击清零' }, '撤退')),
    );

    // Moves.
    const moves = this.moves();
    const movesEl = h('div.moves');
    // 斩杀: a verified word dies in one click (XP and drops as usual).
    if (b.cutReady && !b.outcome)
      movesEl.append(h('button.btn.primary', { disabled: this.phase !== 'choose', onclick: () => this.cut(), title: '斩杀（Enter）：你会写它了，一键秒杀，经验和掉落照拿' }, h('kbd', 'Enter'), '斩杀', h('small', '一键秒杀 · 以后不用再背')));
    // 直接叫名 (Lucas 2026-11-25): first meeting only, before its first question.
    // 1.0.12 (#47): players who said 「没学过」 get this small button instead of a pop-up before every new word.
    if (this.offerDirect() && this.phase === 'choose' && moves.length > 1)
      movesEl.append(h('button.btn.ghost', { onclick: () => this.directName(), title: '直接叫名：不看提示写出它，写对直接斩杀，写错照常学、不罚' }, '我认识它', h('small', '直接叫名')));
    if (moves.length > 1 || b.cutReady) {
      for (const mv of moves) {
        // 2026-11-22 精简出手按钮: the finisher shows only when the resource bar is full.
        if (mv === 'sentence' && !moveReady(s, b, mv)) continue;
        // 技能池: one button per skill in the loadout.
        if (mv === 'skill') {
          combatSkills(s).forEach((id, i) => {
            const sk = POOL[id];
            const cd = b.poolCd[id] ?? 0;
            const ok = poolReady(s, b, id);
            const sub = cd ? `冷却 ${cd}` : ok ? sk.asks : '这只怪用不了';
            movesEl.append(h(`button.btn${this.move === 'skill' && this.skillId === id && this.phase !== 'choose' ? '.sel' : ''}`, { disabled: this.phase === 'result' || !ok, onclick: () => this.chooseSkill(id), title: `${sk.zh}：${sk.asks}。${sk.effect}（冷却 ${sk.cd} 回合）` }, h('kbd', BattleUI.SKILL_KEYS[i]), sk.zh, h('small', sub)));
          });
          continue;
        }
        const info = MOVE_INFO[mv];
        const disabled = this.phase === 'result' || !moveReady(s, b, mv);
        const sub =
          mv === 'inscribe' && b.cfx.inscribeCd
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
            ? `弱一击 · 凭记忆说出「${this.shortMeaning(b)}」`
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
            h('span.small', { style: 'color:var(--gold, #ffcf4a)' }, this.readMsg || `新词：${rs} · ${this.meaningText(b)}　按住 S（或按住「按住读」）把它${rs !== rt ? '连冠词一起' : ''}读出来，松开结束，读得像就是必中的一击`),
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
    if (needsPhase(b) && !directQ) {
      stance = h(
        'div.stance',
        h('span.muted', '相：'),
        ...stancesFor(s.level, b).map((p, i) =>
          h(`button.btn.${p}${b.phase === p ? '.sel' : ''}`, { disabled: this.phase === 'result', onclick: () => this.setPhase(p), title: `${p}（${(i + 1) % 10}）` }, h('kbd', String((i + 1) % 10)), p),
        ),
        // 审查修订: while answering, the stance bar shows nothing about the word (no German, no Chinese).
        this.phase === 'answer' && !b.pluralMon
          ? ''
          : taught
          ? h(
              'span.small',
              { style: 'color:var(--gold, #ffcf4a)' },
              b.perfekt
                ? `  新词：${w.de} · ${this.shortMeaning(b)}　完成时用 ${b.phase}，相已替你选好，记住它`
                : `  新词：${fullForm(w)} · ${this.shortMeaning(b)}　第一次见，相已替你选好${b.phase !== w.art ? `（这句要 ${b.phase}）` : ''}，记住它${taughtRule(w)}`,
            )
          : b.pluralMon
            ? h('span.small', { style: 'color:var(--gold, #ffcf4a)' }, this.phase === 'answer' && this.question?.type === 'pickZh' ? '  复数怪 → 一律选 die' : `  这是一群「${this.shortMeaning(b)}」（复数怪）→ 一律选 die`)
          : b.curse !== 'forget' && !(this.phase === 'answer' && this.question?.type === 'pickZh')
            ? h('span.small', { style: 'color:var(--gold, #ffcf4a)' }, `  它是「${this.shortMeaning(b)}」→ 选它的相`)
            : '',
        h(
          'span.small.muted',
          taught ? '' : b.perfekt
            ? s.level <= 22 ? '  完成时：移动、变化（fahren、kommen、aufstehen）多用 sein，其余用 haben；23 级前选错不罚' : '  选对护甲降一档、回资源；选错护甲翻倍'
            : this.phaseNag && !b.phase
            ? b.pluralMon ? '  先选相：复数怪一律选 die' : s.level >= 7 ? (b.intent.caseArt ? '  先选相：它这句话里缺的那个冠词是什么？' : `  先选相：${nameStanceTip(s, b)}`) : '  先选相：它是 der、die 还是 das？'
            : b.pluralMon
              ? ''
              : s.level >= 7
                ? b.intent.caseArt ? '  选句子空里那个冠词：照句中形式选，可能是 ein/eine、den/dem，不一定是词典里的 der/die/das' : `  ${nameStanceTip(s, b)}`
                : s.level <= 5 ? (s.level >= 4 ? '  选对护甲降一档、回言灵；6 级前选错不罚' : '  选对护甲降一档；6 级前选错不罚') : '  选对护甲降一档、回资源；选错护甲翻倍',
        ),
      );
    }

    // 教学战 (0.5 节奏表): the first fight after a new move opens points at it.
    const teach = this.phase === 'choose' && s.flags.teachSkills && !b.tutorial ? h('div.small', { style: 'color:var(--gold, #ffcf4a)' }, '新招：试试 Q 铭刻（下一题难一级，伤害 ×1.5）；答题卡住时可以按 W 低语（给提示，但这题不算会写）') : this.phase === 'choose' && b.teachFin ? h('div.small', { style: 'color:var(--gold, #ffcf4a)' }, '言灵已满：按 F 放终结技，看中文写整句') : '';
    // 语法秘境 run (1.0.10): which dungeon, floor and fight this is.
    const gr = this.ctrl.gramRun;
    const gramTag = gr ? h('div.small', { style: 'color:var(--gold, #ffcf4a);font-weight:700' }, `${GRAM_DUNGEON.name[gr.kind]} · ${gr.floor.label} · 第 ${gr.i + 1}/${gr.words.length} 场`) : '';
    clear(el).append(gramTag, h('div.b-top', monEl, intent, me), stance, teach, movesEl, q, blog);
    blog.scrollTop = blog.scrollHeight;
    if (sameQ) el.scrollTop = scrolled;
    const again = kept ? restoreInputs(el, kept) : null;
    if (this.input && this.phase === 'answer') window.setTimeout(() => (again ? again() : (this.mateBoxes[0] ?? this.input)?.focus()), 0);
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
        monsterIcon(monsterArt(pb), 2, dead, 'mon-icon small', !!this.ctrl.scene?.bright),
        h(`div.nm${color === NAME_RED ? '.named' : ''}`, { style: `color:${color}` }, dead ? (pb.pluralMon ? `die ${w.pl}` : fullForm(w)) : this.packName(pb, this.phase === 'answer' && asksMeaning(this.question)), elTag && !dead ? h('span.tag', { style: 'margin-left:4px;font-size:10px' }, elTag) : ''),
        pb.pluralMon && !dead ? h('span.tag.echo', '复数怪 · 一律 die') : '',
        bar('hp', pb.monster.hp, pb.monster.maxHp, `${pb.monster.hp} / ${pb.monster.maxHp}`),
        dead ? '' : h('div.it', this.phase === 'answer' && lineLeaks(it.line, this.question) ? '…mmh…' : it.line),
      );
      wrap.append(card);
    });
    return wrap;
  }

  /** 审查 C1/C2: while answering, never read out a line that contains the answer (a participle, an article …). */
  private speakLine(): void {
    const line = this.b.intent.line;
    if (this.phase === 'answer' && lineLeaks(line, this.question)) return;
    if (this.b.direct || (this.phase === 'choose' && this.offerDirect())) return; // 1.0.12 (#47): it only mumbles
    this.ctrl.speak(line);
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
    // 规则怪谈看板: the first question of a newly opened grammar system teaches its rule with sentences you met.
    if (qq.board && this.phase === 'answer')
      wrap.append(
        h(
          'div.board',
          h('div.board-title', qq.board.title),
          ...qq.board.lines.map((l) => h('div', l)),
          ...(qq.board.examples.length ? [h('div.board-ex', { style: 'margin-top:4px' }, '你见过的句子：'), ...qq.board.examples.map((x) => h('div.board-ex', `· ${x}`))] : []),
        ),
      );
    // 初见教学 (Lucas 2026-11-27): a never-met word's one choice question shows it whole first; the next one writes it.
    if (qq.teach && this.phase === 'answer')
      wrap.append(
        h(
          'div.board',
          h('div.board-title', has(this.ctrl.state.level, 'typing') ? '初见 · 先认识它，下一题就写' : '初见 · 先认识它，下一题考你认不认得'), // 1.0.12 (#102): no typing at Lv1
          h(
            'div',
            { style: 'font-size:20px' },
            h('b', qq.teach.de),
            // 德语释义: in the de tier the definition stands in for the Chinese, which is one tap away (free).
            qq.teach.hideZh && !this.qZhOpen && !this.zhOpen.has(this.b.word.id) ? '　' : `　${qq.teach.zh}　`,
            h('button.btn.ghost.small', { onclick: () => this.ctrl.speak(qq.teach!.de), title: '再听一遍' }, '🔊'),
            qq.teach.hideZh && !this.qZhOpen && !this.zhOpen.has(this.b.word.id) ? h('button.btn.ghost.small', { onclick: () => { this.qZhOpen = true; this.render(); }, title: '看中文不花任何代价' }, '看中文') : '',
          ),
          qq.teach.def ? h('div', { style: DEF_LINE_STYLE }, qq.teach.def) : '',
        ),
      );
    // 1.0.10 (Lucas): a review / spot check slipped into this fight asks ANOTHER word — say so loudly, or the player
    // answers with the monster's word that the name plate, 相 row and skills all show.
    if (qq.review && !qq.partner)
      wrap.append(
        h(
          'div.board.review-insert',
          h('div.board-title', '插题 · 这题问的是另一个词，不是这只怪'),
          h('div', `这只怪是「${this.meaningText(this.b)}」，但这道题考的是你以前学过的另一个词（看下面的${qq.defDe ? '释义' : '中文'}）。答对答错只算那个词，伤害照常打在这只怪身上。`),
        ),
      );
    wrap.append(h('div.prompt', h('span', qq.prompt), tags ? h('span.tag', tags) : '', hintBtn));
    const focusColor = qq.type === 'article' && this.phase === 'result' && this.b.word.art ? NAME_RED : '';
    const long = qq.type === 'cloze' ? 'font-size:22px;line-height:1.4;' : '';
    wrap.append(h('div.focus', { style: (focusColor ? `color:${focusColor};` : '') + (qq.defDe && qq.type !== 'cloze' ? 'font-size:20px;line-height:1.4;' : long) }, qq.focus));
    // 德语释义 (1.0.12): first letter + letter count, and the Chinese clue — a tap away, or shown after answering.
    if (qq.defHint) wrap.append(h('div.def-hint', { style: 'font-family:var(--mono);font-size:18px;letter-spacing:1px;margin:2px 0 4px' }, qq.defHint));
    if (qq.zhHidden)
      wrap.append(
        this.phase === 'result' || this.qZhOpen
          ? h('div.small.muted', `中文：${qq.zhHidden}`)
          : h('div', h('button.btn.ghost.tiny', { onclick: () => { this.qZhOpen = true; this.render(); }, title: '看中文不花任何代价' }, '看中文')),
      );
    if (this.synMsg && this.phase === 'answer') wrap.append(h('div.note', { style: 'color:var(--gold, #ffcf4a)' }, this.synMsg));
    this.input = null;
    // 告示怪 / 信件怪 / 文章群怪: the text the questions are about.
    // 听段题 / 盲听: no text before answering; a free replay (or two with 「Wie bitte?」).
    if ((qq.gram?.sys === 'listen' || qq.gram?.sys === 'blind') && qq.listen && this.phase === 'answer') {
      const left = this.b.replays ?? 0;
      wrap.append(h('div.hud-row', h('button.btn.small', { disabled: left <= 0, onclick: () => { this.b.replays = left - 1; this.ctrl.speak(qq.listen!, listenRate(this.ctrl.state.level)); this.render(); } }, `🔁 重听（还剩 ${left} 次）`)));
    }
    // 审查 C3: 听整句选德语 (a word met before) — replay the sentence freely.
    if (qq.type === 'pickDe' && qq.listen && !qq.echo && !qq.gram && this.phase === 'answer') wrap.append(h('div.hud-row', h('button.btn.small', { onclick: () => this.ctrl.speak(qq.listen!) }, '🔁 再听这句')));
    if (qq.gram?.passage) {
      // Long texts (B2 articles are 300–450 words) scroll inside the box; the scrollbar is always drawn and the
      // place you read to is kept across questions on the same text.
      const text = qq.gram.passage;
      const box = h('div.passage', {}, text);
      const hint = h('div.passage-hint.small.muted', '↓ 文章较长，在框里滚动鼠标滚轮看全文');
      box.addEventListener('scroll', () => {
        this.passageAt = { text, top: box.scrollTop };
        hint.hidden = box.scrollTop + box.clientHeight >= box.scrollHeight - 4;
      });
      wrap.append(box, hint);
      window.setTimeout(() => {
        if (this.passageAt?.text === text) box.scrollTop = this.passageAt.top;
        hint.hidden = box.scrollHeight <= box.clientHeight + 4 || box.scrollTop + box.clientHeight >= box.scrollHeight - 4;
      }, 0);
    }
    // 齐鸣 (rev 234): write each same-stance mate's own word (with the article); each right one is hit.
    this.mateBoxes = [];
    if (qq.mates?.length) {
      const prev = this.lastValue.split('|').slice(1);
      const rows = qq.mates.map((id, i) => {
        const mw = WORD_BY_ID[id];
        const box = h('input', { type: 'text', autocomplete: 'off', autocapitalize: 'off', spellcheck: 'false', placeholder: 'der / die / das + 名词', disabled: this.phase !== 'answer', 'data-k': `mate${i}` }) as HTMLInputElement;
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
      // 1.0.12 试玩 51: on the result screen the picked option and the right one are marked.
      const mark = (o: string): string => {
        if (this.phase !== 'result' || !r || qq.item) return '';
        if (o === this.lastValue) return r.correct ? '.right' : '.wrong';
        return !r.correct && (o === qq.answer || o === r.verdict.correct) ? '.right' : '';
      };
      qq.options.forEach((o, i) => {
        const cls = qq.type === 'article' ? `.${o}` : '';
        const m = mark(o);
        opts.append(
          h(`button.btn${cls}${m}`, { disabled: this.phase !== 'answer', onclick: () => this.submit(o) }, h('kbd', String(i + 1)), o, m ? h('span.mark', m === '.right' ? ' ✓' : ' ✗') : ''),
        );
      });
      wrap.append(opts);
    } else if (qq.boxes?.length) {
      // 墨水风暴 (rev 234): one box per form, in order; Enter moves on, the last one sends "a|b|c".
      const prev = this.lastValue.split('|');
      const boxes = qq.boxes.map((label, i) => {
        const box = h('input', { type: 'text', autocomplete: 'off', autocapitalize: 'off', spellcheck: 'false', placeholder: label, disabled: this.phase !== 'answer', 'data-k': `box${i}` }) as HTMLInputElement;
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
      const box = (k: string) => h('input', { type: 'text', autocomplete: 'off', autocapitalize: 'off', spellcheck: 'false', placeholder: '填空', disabled: this.phase !== 'answer', 'data-k': k }) as HTMLInputElement;
      const a = box('ultA');
      const c = box('ultC');
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
        'data-k': 'main',
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
      // 开口作答 (34 级起可选；83 级起首领对话等处必修): say the answer instead of typing it.
      const voice = voiceOpen(this.ctrl.state, this.b, qq) && this.phase === 'answer' ? h('button.btn', { title: '按住说，松开就交（算「认得」，不算「会写」）' }, listening() ? '在听……' : '🎤 说出来') : '';
      if (voice) {
        voice.addEventListener('pointerdown', (e) => {
          e.preventDefault();
          void this.voiceAnswer();
        });
      }
      wrap.append(
        h('div.typing', input, umlautButtons(input), voice, h('button.btn.primary', { disabled: this.phase !== 'answer', onclick: () => this.submit(input.value) }, '出招 ↵')),
      );
      if (this.voiceMsg) wrap.append(h('div.small', { style: 'color:var(--gold, #ffcf4a)' }, this.voiceMsg));
    }
    if (this.phase === 'result' && r) {
      const fb = h(`div.feedback.${r.correct ? 'ok' : 'no'}`);
      // 1.0.12 试玩 73: an item turn is now a cast that landed (tick) or a shouted phrase; 药片 takes no turn.
      const head = qq.tick ? '它出手了' : qq.item ? '喊出了短句' : r.correct ? (r.crit ? (r.newSpell ? '初识暴击！' : '暴击！') : r.parried ? '躲开了' : '答对了') : '答错了';
      fb.append(h('b', head));
      if (qq.item && r.monsterDamage) fb.append(h('span', qq.tick ? `  你受到 ${r.monsterDamage} 伤害` : `  它趁机出手：${r.monsterDamage} 伤害`));
      if (r.correct && this.b.word && (qq.type === 'article' || qq.type === 'typed')) fb.append(h('span', `  ${fullFormLong(this.b.word)} · ${this.b.word.zh}`));
      if (qq.echo) fb.append(h('span', `  ${qq.echo.target}（${qq.echo.zhT}） · ${qq.echo.partner}（${qq.echo.zhP}）`));
      if (r.phase === 'right') fb.append(h('span', `  ${this.b.phase} 相 · 弱点`));
      if (r.phase === 'wrong') fb.append(h('span', `  ${this.b.phase} 相被抵抗：${phaseWrongWhy(this.b)}`));
      // 词性规律 (2026-11-28): the rule this noun falls under, after a stance that missed its gender.
      if ((r.phase === 'wrong' || r.phase === 'soft') && stanceRuleNote(this.b)) fb.append(h('span.note.gender-hint', stanceRuleNote(this.b)));
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

/** A definition clipped for a small label. */
function clipDef(def: string): string {
  return def.length > 22 ? `${def.slice(0, 21).trimEnd()}…` : def;
}

/** 德语释义 on the plate: a definition is a sentence, so it wraps in a smaller, plain font. */
const DEF_PLATE_STYLE = 'font-family:inherit;font-size:16px;line-height:1.35;letter-spacing:0;white-space:normal;overflow-wrap:anywhere;max-width:100%;cursor:pointer';
const DEF_LINE_STYLE = 'font-size:13px;line-height:1.35;opacity:.85;overflow-wrap:anywhere;margin:2px 0';

/** 名牌 (Lucas 2026-11-25, replaces 「作答时乱码、平时半名」): the meaning in Chinese in battle (the fight means you
 *  have met it); glitch only for 蚀变 words and, while a question that asks the meaning is answered, hidden. No
 *  article, no letters; 半名 shows in the stage label, not in the plate. */
function nameGlyph(b: Battle, hide = false): string {
  if (b.phrase) return `${b.phrase.a} …`;
  if (b.word.erode || hide) return Array.from({ length: Math.max(3, Math.min(9, b.word.de.length)) }, () => GLITCH[Math.floor(Math.random() * GLITCH.length)]).join('');
  return plateZh(b.word) + (b.pluralMon ? ' · 复数' : '');
}

/** 1.0.11 试玩 13: what was typed in each answer box (by data-k) and which box had the focus, with its caret. */
export interface KeptInputs {
  values: Record<string, string>;
  focus: { k: string; start: number | null; end: number | null } | null;
}

type BoxRoot = Pick<ParentNode, 'querySelectorAll'>;

export function keepInputs(root: BoxRoot | null, active: Element | null = typeof document === 'undefined' ? null : document.activeElement): KeptInputs {
  const out: KeptInputs = { values: {}, focus: null };
  if (!root) return out;
  for (const box of Array.from(root.querySelectorAll<HTMLInputElement>('input[data-k]'))) {
    const k = box.dataset.k!;
    out.values[k] = box.value;
    if (box === active) out.focus = { k, start: box.selectionStart, end: box.selectionEnd };
  }
  return out;
}

/** Puts kept values back into the new boxes; returns how to give the focus back (null when no box had it). */
export function restoreInputs(root: BoxRoot, kept: KeptInputs): (() => void) | null {
  let focusBox: HTMLInputElement | null = null;
  for (const box of Array.from(root.querySelectorAll<HTMLInputElement>('input[data-k]'))) {
    const k = box.dataset.k!;
    if (kept.values[k] !== undefined && !box.disabled) box.value = kept.values[k];
    if (kept.focus?.k === k) focusBox = box;
  }
  const f = kept.focus;
  if (!focusBox || !f) return null;
  const box = focusBox;
  return () => {
    box.focus();
    if (f.start !== null) {
      try {
        box.setSelectionRange(f.start, f.end ?? f.start);
      } catch {
        /* not a text box */
      }
    }
  };
}

/** 1.0.11 试玩 15: a question with a text to read (告示 / 信件 / 文章) or a passage to listen to. */
/** 1.0.12 试玩 51: how long a clean hit's result stays when it gives the whole sentence back (ms). */
export function resultReadMs(full: string): number {
  return Math.min(4000, Math.max(1800, 1000 + 45 * full.length));
}

export function longRead(q: Question | null | undefined): boolean {
  if (!q?.gram) return false;
  return !!q.gram.passage || ((q.gram.sys === 'listen' || q.gram.sys === 'blind') && !!q.listen);
}

/** The question on screen asks the meaning (pick the Chinese, listen and pick, 回音听辨, Chinese options). */
function asksMeaning(q: Question | null | undefined): boolean {
  if (!q || q.teach) return false;
  return q.type === 'pickZh' || (!!q.echo && !q.echo.say) || !!q.options?.some((o) => /[\u4e00-\u9fff]/.test(o));
}

/** 词性规律 on the 先教后考 turn (2026-11-28): the rule the new noun follows, so the first article comes with a reason.
 *  An exception is left to the wrong-pick feedback, so the first sight of a word is not a warning. */
function taughtRule(w: Word): string {
  const g = genderHint(w);
  return g && g.follows ? `　${g.text}` : '';
}
