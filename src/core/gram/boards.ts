// 规则怪谈看板 (语法教学统一框架, Lucas 2026-11-25): when a grammar system unlocks, the first question of that kind
// comes with a board — one rule in 30 seconds, and two sentences the player has already met (例句初印象 first, rule
// second). Seen boards are kept on the save (optional field) and can be read again in the wordbook.

import { EXAMPLES, parse } from '../cloze';
import type { GameState } from '../state';
import type { GramSys } from './task';

export interface Board {
  title: string;
  /** The rule, 2–4 short lines in Chinese. */
  lines: string[];
  /** Picks the player's own sentences that show it (whole German sentence). */
  shows?: RegExp;
}

export const BOARDS: Partial<Record<GramSys, Board>> = {
  kein: { title: '规则怪谈 · 「没有」要说 kein', lines: ['名词前是 ein / eine / einen 时，否定不用 nicht，用 kein。', 'kein 的词尾跟 ein 一样：kein / keine / keinen / keinem。', '复数也用 keine：Ich habe keine Zeit.'], shows: /\bkein(e|en|em|er)?\b/i },
  nicht: { title: '规则怪谈 · kein 还是 nicht', lines: ['ein + 名词、不带冠词的名词：用 kein。', 'der / die / das + 名词、动词、形容词：用 nicht。', '否定整句时 nicht 常放句末：Ich sehe den Bus nicht.'], shows: /\bnicht\b/i },
  mein: { title: '规则怪谈 · 我的、你的', lines: ['mein（我的）、dein（你的）放在名词前，词尾和 ein 一模一样。', 'mein Bruder / meine Mutter / meinen Schlüssel / mit meinem Freund。'], shows: /\b(mein|dein)(e|en|em|er)?\b/i },
  timePrep: { title: '规则怪谈 · am、um、im', lines: ['星期、早上晚上、周末：am（am Montag, am Abend）。', '钟点：um（um acht Uhr）。月份、季节：im（im Mai, im Winter）。', '夜里例外：in der Nacht。'], shows: /\b(am|um|im) (Montag|Dienstag|Mittwoch|Donnerstag|Freitag|Samstag|Sonntag|Wochenende|Morgen|Abend|Mittag|\w+ Uhr|Januar|Mai|Juli|Sommer|Winter)\b/ },
  modal: { title: '规则怪谈 · 情态动词把动词赶到句尾', lines: ['muss、kann、möchte、will 变位，放第二位。', '真正要做的那个动词用原形，放到句子最后。', 'Ich muss heute Brot kaufen.'], shows: /\b(muss|kann|möchte|will|darf|soll)\b.*\b\w+en[.?!]$/i },
  sep: { title: '规则怪谈 · 可分动词会裂开', lines: ['aufstehen、einkaufen、anrufen：现在时前缀掉到句末。', 'Ich stehe um sieben Uhr auf.', '和情态动词一起用时不裂开：Ich muss früh aufstehen.'] },
  imp: { title: '规则怪谈 · 礼貌地请人做事', lines: ['Sie 的命令式：动词原形放句首，后面跟 Sie。', 'Geben Sie mir bitte einen Kaffee.（要的东西用第四格）'] },
  datPron: { title: '规则怪谈 · 有些动词要 mir / dir', lines: ['helfen、gefallen、schmecken、gehören、danken 后面的人用第三格。', 'ich → mir，du → dir，er → ihm，sie → ihr，wir → uns，Sie → Ihnen。', 'Das gefällt mir. Ich helfe dir.'], shows: /\b(mir|dir|ihm|uns|Ihnen)\b/ },
  praetSein: { title: '规则怪谈 · 说过去：war 和 hatte', lines: ['说过去的状态，德国人用 war / hatte，很少说 ist gewesen。', 'Ich war krank. Ich hatte keine Zeit.'], shows: /\b(war|waren|hatte|hatten)\b/ },
  praetModal: { title: '规则怪谈 · konnte、musste、wollte', lines: ['情态动词的过去多用过去式：去掉变音，加 -te。', 'können → konnte，müssen → musste，wollen → wollte。'], shows: /\b(konnte|musste|wollte|durfte|sollte)\b/ },
  praet: { title: '规则怪谈 · 书面的过去式', lines: ['故事、报纸里说过去用过去式。', '规则动词：词干 + te（machte）；强变化动词换元音（kam, ging）。', 'ich 和 er 没有词尾。'] },
  adj: { title: '规则怪谈 · 形容词的尾巴', lines: ['形容词放在名词前要加词尾。', 'der 后面多半是 -e / -en；ein 后面要替冠词把性别露出来：ein guter Tee, ein gutes Brot。'] },
  mirror: { title: '规则怪谈 · 镜子里的自己', lines: ['反身动词：动作回到自己身上，要配 mich / dich / sich。', 'Ich freue mich. Er wäscht sich.'], shows: /\b(mich|dich|sich)\b/ },
  prep: { title: '规则怪谈 · 动词锁着介词', lines: ['有些动词固定配一个介词：warten auf, denken an, sich freuen über。', '介词后面的格也是固定的，要一起记。'] },
  ablaut: { title: '规则怪谈 · 变音的血统', lines: ['强变化动词按元音变化分成几族：e → i（nehmen → nimmt），a → ä（fahren → fährt）。', '同族的动词变法一样，学会一个，同族都会。'] },
  wordfam: { title: '规则怪谈 · 一个词根长出一家', lines: ['fahren → die Fahrt, der Fahrer, abfahren。', '认出词根，新词就不陌生。'] },
};

export interface ShownBoard extends Board {
  sys: GramSys;
  /** Two sentences from words the player has met (may be fewer for a brand-new player). */
  examples: string[];
}

/** The board for this system if the player hasn't seen it yet. */
export function boardDue(s: GameState, sys: GramSys): ShownBoard | null {
  const b = BOARDS[sys];
  if (!b || s.gram?.boards?.includes(sys)) return null;
  return { ...b, sys, examples: seenExamples(s, b.shows) };
}

export function markBoard(s: GameState, sys: GramSys): void {
  s.gram ??= {};
  s.gram.boards ??= [];
  if (!s.gram.boards.includes(sys)) s.gram.boards.push(sys);
}

/** Two whole example sentences of words the player knows that match the board (例句初印象 → 规则). */
export function seenExamples(s: GameState, re?: RegExp): string[] {
  if (!re) return [];
  const out: string[] = [];
  for (const id of Object.keys(s.words)) {
    for (const line of EXAMPLES[id] ?? []) {
      const p = parse(line);
      if (!p) continue;
      const de = `${p.before}${p.blank}${p.after}`.replace(/\s+/g, ' ').trim();
      if (re.test(de) && !out.some((x) => x.startsWith(de))) out.push(`${de}（${p.zh}）`);
      if (out.length >= 2) return out;
    }
  }
  return out;
}

export interface GramSave {
  /** Boards already shown. */
  boards?: string[];
  /** 变音秘境: cleared floors (strong-verb group ids). */
  ablaut?: string[];
  /** 介词秘境: cleared floors. */
  prep?: string[];
  /** 词族秘境: cleared floors. */
  wordfam?: string[];
  /** 复习伙伴 (43): the 归名 word that fights along. */
  partner?: string;
}
