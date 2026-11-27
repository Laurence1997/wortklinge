// 冒险者 PK (游戏设计 六, Lucas 2026-11-25): no AI. Both answer the same question at once; the first right answer
// scores; first to 3 wins. The adventurer only says fixed taunts and never shows its answer; the right answer is shown
// when both have answered or the round ends.

import { clear, h, umlautButtons } from './dom';
import { ADV, gradePk, pkQuestion, rivalFor, type Adventurer, type PkQuestion } from '../core/adventurers';
import type { Rng } from '../core/rng';
import type { GameState } from '../core/state';

const TAUNT_START = ['Los geht’s!', 'Bereit?', 'Na, schaffst du das?'];
const TAUNT_RIGHT = ['Ha! Erster!', 'Punkt für mich!', 'Zu langsam!'];
const TAUNT_WRONG = ['Mist …', 'Oh nein.', 'Hmm, falsch.'];
const TAUNT_LOSE = ['Gut gemacht!', 'Respekt!', 'Okay, du warst schneller.'];
const ROUND_MS = 25_000;

export interface PkEnd {
  won: boolean;
  me: number;
  rival: number;
}

export function runPk(s: GameState, a: Adventurer, region: number, rng: Rng, onAnswer: (q: PkQuestion, ok: boolean) => void, onEnd: (r: PkEnd) => void): boolean {
  if (!pkQuestion(s, region, rng)) return false;
  let el = document.getElementById('pk');
  if (!el) {
    el = h('div#pk.modal-pk');
    document.getElementById('ui')!.append(el);
  }
  const root = el;
  root.hidden = false;
  let me = 0;
  let rival = 0;
  let timers: number[] = [];
  const pick = (xs: string[]) => xs[Math.floor(rng() * xs.length)];
  const stopTimers = () => {
    for (const t of timers) window.clearTimeout(t);
    timers = [];
  };
  const onKey = (e: KeyboardEvent) => {
    if (root.hidden || (document.activeElement as HTMLElement | null)?.tagName === 'INPUT') return;
    const n = Number(e.key);
    if (n >= 1 && n <= 9) {
      const btns = Array.from(root.querySelectorAll('.pk-q .row button')) as HTMLButtonElement[];
      if (btns[n - 1] && !btns[n - 1].disabled) (e.preventDefault(), e.stopImmediatePropagation(), btns[n - 1].click());
    }
  };
  window.addEventListener('keydown', onKey, true);
  const close = () => {
    stopTimers();
    window.removeEventListener('keydown', onKey, true);
    root.hidden = true;
    clear(root);
  };

  const round = () => {
    const q = pkQuestion(s, region, rng);
    if (!q) return finish();
    const rv = rivalFor(s, q.kind, rng);
    const rivalRight = rng() < rv.acc;
    let myDone = false;
    let rivalDone = false;
    let over = false;
    const say = h('div.pk-say', `${a.name}：${pick(TAUNT_START)}`);
    const note = h('div.pk-note');
    const score = h('div.pk-score', `你 ${me} : ${rival} ${a.name}（AI）· 先拿 ${ADV.pkWin} 分赢`);
    const body = h('div.pk-q');
    const decided = () => me >= ADV.pkWin || rival >= ADV.pkWin;
    // Once the match is decided the header button just leaves with the result (win or loss reward), never as a forfeit.
    const quit = h('button.btn.ghost', { onclick: () => (decided() ? finish() : (close(), onEnd({ won: false, me, rival: -1 }))) }, '认输离开') as HTMLButtonElement;
    const end = (why: string) => {
      if (over) return;
      over = true;
      stopTimers();
      note.textContent = `${why} 答案：${q.full}`;
      score.textContent = `你 ${me} : ${rival} ${a.name}（AI）`;
      for (const b of Array.from(body.querySelectorAll('button, input'))) (b as HTMLButtonElement).disabled = true;
      if (decided()) quit.textContent = '离开';
      const next = h('button.btn.primary', { onclick: () => (decided() ? finish() : round()) }, decided() ? '结束 ↵' : '下一题 ↵') as HTMLButtonElement;
      body.append(next);
      window.setTimeout(() => next.focus(), 0);
    };
    const mine = (input: string) => {
      if (over || myDone) return;
      myDone = true;
      const ok = gradePk(q, input);
      onAnswer(q, ok);
      if (ok) {
        me += 1;
        say.textContent = `${a.name}：${pick(TAUNT_LOSE)}`;
        return end('你先答对了，+1。');
      }
      note.textContent = '你答错了，这一题不能再答。';
      if (rivalDone) end('都没答对。');
    };
    timers.push(
      window.setTimeout(() => {
        if (over) return;
        rivalDone = true;
        if (rivalRight) {
          rival += 1;
          say.textContent = `${a.name}：${pick(TAUNT_RIGHT)}`;
          end(`${a.name} 先答对了。`);
        } else {
          say.textContent = `${a.name}：${pick(TAUNT_WRONG)}`;
          if (myDone) end('都没答对。');
        }
      }, rv.ms),
      window.setTimeout(() => end('时间到。'), ROUND_MS),
    );
    body.append(h('div.small.muted', q.prompt), h('div.pk-focus', q.focus));
    if (q.options?.length) {
      body.append(h('div.row', ...q.options.map((o, i) => h('button.btn', { onclick: () => mine(o) }, h('kbd', String(i + 1)), ` ${o}`))));
    } else {
      const input = h('input.pk-in', { type: 'text', autocomplete: 'off', spellcheck: 'false', placeholder: q.word.art ? 'der / die / das + 名词' : '' }) as HTMLInputElement;
      input.addEventListener('keydown', (e) => {
        e.stopPropagation();
        if (e.isComposing || e.keyCode === 229) return; // Enter that commits an IME composition
        if (e.key === 'Enter' && input.value.trim()) mine(input.value);
      });
      body.append(h('div.typing', input, umlautButtons(input), h('button.btn.primary', { onclick: () => input.value.trim() && mine(input.value) }, '交 ↵')));
      window.setTimeout(() => input.focus(), 0);
    }
    clear(root).append(h('div.panel.pk', h('h2', h('span', `PK · ${a.name}（AI）`), quit), score, say, body, note));
  };

  const finish = () => {
    close();
    onEnd({ won: me > rival, me, rival });
  };
  round();
  return true;
}

export function pkOpen(): boolean {
  const el = document.getElementById('pk');
  return !!el && !el.hidden;
}
