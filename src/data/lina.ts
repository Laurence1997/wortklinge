// Elite 「幽灵检票员」 Lina (0.6 第 5 块): Konrad's daughter, who ran for the last train the night the words went.
// From Lv25, once Konrad remembers her name starts with L. A short timed check (30 s a question, HP 5); she never
// kills you: a wrong answer is a fine and she is gone until next time. When her HP is out she asks «Wie heiße ich?»
// Written by Claude; needs a native-speaker check.

import type { BossQuestion } from './boss';
import { gradePerfekt } from './boss3';
import { shuffle, type Rng } from '../core/rng';

export const LINA = {
  name: '幽灵检票员',
  de: 'Die Kontrolleurin',
  intro: [
    '大厅的灯闪了一下。一个穿着旧外套的检票员从站台那头走过来，手里的打孔钳咔哒咔哒响。',
    '外套是集市面包房的围裙改的，口袋上还沾着面粉。',
    '「Ihre Fahrkarte, bitte!」',
    '系统：限时回答她的问题（每题 30 秒）。答错她就罚票、消失；问完以后，她会问你一件她自己忘了的事。',
  ],
  healLine: '',
  healZh: '',
  finalZh: '她停下打孔钳，第一次看着你的眼睛。（把她的名字还给她）',
  fine: 60,
  /** Each entry into a timetable-hall scene: chance to meet her; she always comes after this many misses. */
  chance: 0.15,
  pity: 4,
  outroWin: [
    '「Lina … ich heiße Lina.」打孔钳掉在地上。外套上的面粉一点点变白。',
    '「Papa? Die Bäckerei …」她想起来了。末班车没等她，她也不用再等末班车了。',
    '系统：Lina 回到了铁轨镇广场。集市的面包房会重新开张。',
  ],
  outroFine: '「Schwarzfahren! Das kostet sechzig Euro.」她在罚单上打了个洞，和灯一起暗下去。',
};

const Q: BossQuestion[] = [
  {
    id: 'ticket',
    ask: ['Ihre Fahrkarte, bitte!', 'Die Fahrkarte, bitte!', 'Fahrkarte, bitte. Schnell!'],
    zh: '查票：把票给她',
    accept: [
      /^(ja )?(hier|bitte|bitte schoen|bitte sehr|hier bitte|hier ist (meine|die) fahrkarte|hier ist sie|hier ist mein ticket|hier bitte schoen)( bitte)?$/,
      // 1.0.11 试玩: polite pieces combined (Bitte schön, hier ist meine Fahrkarte. / Hier, bitte sehr.)
      /^(ja |ok |okay |moment |einen moment |sofort )*((bitte( schoen| sehr)?|hier|natuerlich|gern|gerne|klar) )*(hier (ist|haben sie) (meine|die|mein|das) (fahrkarte|ticket)|hier ist sie|hier ist es|hier bitte|bitte( schoen| sehr)?|hier)( (bitte( schoen| sehr)?|hier|danke))*$/,
    ],
    model: 'Hier ist meine Fahrkarte.',
    traps: [[/keine/, 'Schwarzfahren! 没票就是逃票。给她票：Hier ist meine Fahrkarte.']],
  },
  {
    id: 'wohin',
    ask: ['Wohin fahren Sie?', 'Und wohin fahren Sie?', 'Wohin geht die Reise?'],
    zh: '问你去哪儿',
    accept: [/^(ich fahre |wir fahren )?(nach|zum|zur|in die|in den|ins) .+$/],
    model: 'Ich fahre nach Brotmarkt.',
    traps: [[/^(ich )?fahre [a-z]+$/, '地名前面要加 nach：Ich fahre nach …']],
  },
  {
    id: 'abgefahren',
    ask: ['Wann sind Sie abgefahren?', 'Um wie viel Uhr sind Sie abgefahren?'],
    zh: '问你什么时候出发的（用完成时）',
    accept: [],
    grade: gradePerfekt,
    model: 'Ich bin um acht Uhr abgefahren.',
  },
  {
    id: 'eingestiegen',
    ask: ['Wo sind Sie eingestiegen?', 'Wo sind Sie in den Zug gestiegen?'],
    zh: '问你在哪里上的车（用完成时）',
    accept: [],
    grade: gradePerfekt,
    model: 'Ich bin in Brotmarkt eingestiegen.',
  },
  {
    id: 'umgestiegen',
    ask: ['Sind Sie umgestiegen?', 'Wo sind Sie umgestiegen?'],
    zh: '问你在哪里换的车（用完成时）',
    accept: [],
    grade: gradePerfekt,
    model: 'Ich bin in Gleisdorf umgestiegen.',
  },
];

export const LINA_NAME_Q: BossQuestion = {
  id: 'name',
  ask: ['Wie heiße ich?', 'Wer … wer bin ich? Wie heiße ich?'],
  zh: '她问她叫什么',
  accept: [/^((du heisst|sie heissen|du bist|sie sind|dein name ist|ihr name ist) )?lina$/],
  model: 'Du heißt Lina.',
  traps: [[/heiss(e|t)? [a-z]+/, '她的父亲是面包师傅 Konrad，名字以 L 开头。']],
};

export function linaQuestions(rng: Rng): BossQuestion[] {
  const [ticket, ...rest] = Q;
  return [ticket, ...shuffle(rng, rest)];
}
