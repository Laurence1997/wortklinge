// 会说谎的怪 (游戏设计 四, rules 暂定): every 3 turns it announces its next move; about half of it is a lie. A lie
// always carries a tell you can read — a Konjunktiv II form (würde / hätte / wäre), an 「angeblich」-type particle, or a
// second sentence that contradicts the first. The truth carries none.
// 「洞察」 costs the turn (no new resource): a 3-choice question 「它在说谎吗，破绽在哪里」. Right: its move misses and your
// next hit is ×1.5. Wrong: only the turn is lost. Without 洞察: the truth is done as said; a lie turns into a plain attack.
// Fixed line library (no live AI): offline, no AI budget. Answering 洞察 counts for no word.
// The doc asks for 30 true/false pairs per tell, written by Luna and auto-proofread; these are the first hand-written
// ones until that batch arrives (暂定).

import type { Intent } from './types';
import { pick, type Rng } from './rng';
import { LIAR_LINES_GEN } from '../data/liarLines-gen';

export const LIAR = {
  /** 暂定: liars come in batches in 16 面具剧场 (151+); the doc names no earlier level. */
  from: 151,
  /** 暂定: share of word monsters that come as liars. */
  chance: 0.25,
  every: 3,
  boost: 1.5,
};

export type Tell = 'k2' | 'angeblich' | 'contra';
export type Claim = 'attack' | 'wait' | 'defend';

export interface LiarLine {
  de: string;
  zh: string;
  claim: Claim;
  /** null = the truth. */
  tell: Tell | null;
}

export const TELL_ZH: Record<Tell, string> = {
  k2: '假话：破绽是第二虚拟式（würde / hätte / wäre）',
  angeblich: '假话：破绽是 angeblich 这类语气词',
  contra: '假话：破绽是前后两句自相矛盾',
};
export const TRUTH_ZH = '真话：没有破绽';

export const LIAR_LINES: LiarLine[] = [
  // truth
  { de: 'Jetzt greife ich an.', zh: '现在我要攻击了。', claim: 'attack', tell: null },
  { de: 'Pass auf, ich schlage zu.', zh: '小心，我要打了。', claim: 'attack', tell: null },
  { de: 'Ich bin wütend. Gleich beiße ich.', zh: '我很生气。马上就咬。', claim: 'attack', tell: null },
  { de: 'Diese Runde greife ich nicht an.', zh: '这一回合我不攻击。', claim: 'wait', tell: null },
  { de: 'Ich bin müde. Ich ruhe mich kurz aus.', zh: '我累了。歇一会儿。', claim: 'wait', tell: null },
  { de: 'Ich warte erst mal ab.', zh: '我先等等看。', claim: 'wait', tell: null },
  { de: 'Ich verteidige mich jetzt.', zh: '我现在防守。', claim: 'defend', tell: null },
  { de: 'Ich halte meinen Schild hoch.', zh: '我把盾举起来。', claim: 'defend', tell: null },
  { de: 'Ich habe Angst. Ich gehe in Deckung.', zh: '我害怕。我找掩护。', claim: 'defend', tell: null },
  // Konjunktiv II
  { de: 'Ich würde dich nie angreifen.', zh: '我绝不会攻击你。', claim: 'wait', tell: 'k2' },
  { de: 'Ich hätte gar keine Lust zu kämpfen.', zh: '我根本没兴趣打。', claim: 'wait', tell: 'k2' },
  { de: 'Ich wäre jetzt lieber ganz still.', zh: '我现在宁愿安安静静的。', claim: 'wait', tell: 'k2' },
  { de: 'An deiner Stelle würde ich mich ausruhen. Ich tue das auch.', zh: '要是我是你，我会歇着。我也歇。', claim: 'wait', tell: 'k2' },
  { de: 'Ich würde mich jetzt nur verteidigen.', zh: '我只会防守。', claim: 'defend', tell: 'k2' },
  { de: 'Ich hätte meinen Schild schon oben.', zh: '我的盾已经举起来了。', claim: 'defend', tell: 'k2' },
  // angeblich-type particles
  { de: 'Angeblich greife ich diese Runde nicht an.', zh: '据说我这回合不攻击。', claim: 'wait', tell: 'angeblich' },
  { de: 'Ich bin angeblich ganz harmlos.', zh: '据说我完全无害。', claim: 'wait', tell: 'angeblich' },
  { de: 'Ich mache angeblich nur eine Pause.', zh: '据说我只是歇一下。', claim: 'wait', tell: 'angeblich' },
  { de: 'Ich soll ja nur warten, sagen sie.', zh: '他们说我只是要等着。', claim: 'wait', tell: 'angeblich' },
  { de: 'Angeblich verteidige ich mich nur.', zh: '据说我只是在防守。', claim: 'defend', tell: 'angeblich' },
  { de: 'Ich bin angeblich zu schwach zum Angreifen.', zh: '据说我太弱，打不了。', claim: 'defend', tell: 'angeblich' },
  // contradictions
  { de: 'Ich habe keine Kraft mehr. Ich bin stark wie nie, aber ich warte.', zh: '我没力气了。我从没这么强过，但我等着。', claim: 'wait', tell: 'contra' },
  { de: 'Ich schlafe schon. Ich sehe dich ganz genau, aber ich tue nichts.', zh: '我已经睡着了。我把你看得清清楚楚，但我什么都不做。', claim: 'wait', tell: 'contra' },
  { de: 'Ich bin allein hier. Wir greifen heute nicht an.', zh: '这里只有我一个。我们今天不攻击。', claim: 'wait', tell: 'contra' },
  { de: 'Ich habe keinen Schild. Ich halte meinen Schild hoch.', zh: '我没有盾。我把盾举起来。', claim: 'defend', tell: 'contra' },
  { de: 'Ich bin sehr mutig. Ich habe Angst und verstecke mich.', zh: '我很勇敢。我害怕，躲起来了。', claim: 'defend', tell: 'contra' },
  { de: 'Ich bin satt. Ich bin so hungrig, aber ich beiße nicht.', zh: '我饱了。我好饿，但我不咬。', claim: 'wait', tell: 'contra' },
];

export interface LiarState {
  /** The announcement of this turn (it stands until the turn resolves). */
  claim?: LiarLine;
  /** 洞察 answered this turn (once per announcement). */
  probed?: boolean;
  /** 看穿: the announced move misses. */
  dodge?: boolean;
  /** 看穿: your next hit ×1.5. */
  boost?: boolean;
  /** This announcement's 洞察 choices. */
  options?: string[];
  answer?: string;
}

/** Turn `turn` is an announcement turn (the 3rd, 6th, …). */
export function announces(turn: number): boolean {
  return turn > 0 && turn % LIAR.every === 0;
}

/** Pick this turn's announcement: about half lies. Returns the intent it stands for (a lie becomes a plain attack). */
export function liarIntent(base: Intent, rng: Rng): { intent: Intent; line: LiarLine } {
  const lie = rng() < 0.5;
  const line = pick(rng, [...LIAR_LINES, ...LIAR_LINES_GEN].filter((l) => (lie ? l.tell !== null : l.tell === null)));
  const kind = line.tell ? 'attack' : line.claim;
  return {
    line,
    intent: { ...base, kind, shown: line.claim === 'defend' ? 'defend' : 'attack', hits: 1, line: line.de, zh: '它在预告下一招——真话还是假话？（按 I 洞察）', full: undefined, fullZh: undefined, caseArt: undefined, layers: [] },
  };
}

/** The 洞察 question: the right reading and two others. */
export function insightOptions(line: LiarLine, rng: Rng): { options: string[]; answer: string } {
  const answer = line.tell ? TELL_ZH[line.tell] : TRUTH_ZH;
  const all = [TRUTH_ZH, ...Object.values(TELL_ZH)].filter((x) => x !== answer);
  const others: string[] = [];
  while (others.length < 2) {
    const x = pick(rng, all);
    if (!others.includes(x)) others.push(x);
  }
  // The truth is always among the choices when it is a lie (the main question is 说谎吗).
  if (line.tell && !others.includes(TRUTH_ZH)) others[0] = TRUTH_ZH;
  const options = [answer, ...others];
  for (let i = options.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [options[i], options[j]] = [options[j], options[i]];
  }
  return { options, answer };
}
