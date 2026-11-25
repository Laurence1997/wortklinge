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
  twoway: { title: '规则怪谈 · 在哪里，还是去哪里', lines: ['in、an、auf、über、unter、vor、hinter、neben、zwischen 是双向介词。', '在哪里（Wo?）用第三格：Das Buch liegt auf dem Tisch.', '去哪里、放到哪里（Wohin?）用第四格：Ich lege das Buch auf den Tisch.'], shows: /\b(in|an|auf|unter|neben) (dem|den)\b/ },
  woher: { title: '规则怪谈 · zum、beim、vom', lines: ['去人或店那里：zum Arzt, zur Post。', '在那里：beim Arzt, bei der Post。从那里来：vom Arzt, von der Post。', '城市和国家：nach Berlin / in Berlin / aus Berlin。'], shows: /\b(zum|beim|vom|zur) [A-ZÄÖÜ]/ },
  posVerb: { title: '规则怪谈 · 放下和放着', lines: ['stellen / legen / hängen：把东西放过去（动作），Wohin? + 第四格。', 'stehen / liegen / hängen：东西在那儿（状态），Wo? + 第三格。', 'Ich stelle die Vase auf den Tisch. → Die Vase steht auf dem Tisch.'], shows: /\b(steht|liegt|stellt|legt|stehen|liegen)\b/ },
  dblObj: { title: '规则怪谈 · 两个宾语谁在前', lines: ['两个名词：第三格（人）在前，第四格（物）在后：Ich gebe dem Kind den Ball.', '代词比名词靠前：Ich gebe ihm den Ball.', '两个代词：第四格在前：Ich gebe ihn ihm.'], shows: /\b(mir|dir|ihm|Ihnen) (den|die|das|einen|eine|ein) [A-ZÄÖÜ]/ },
  artSuffix: { title: '规则怪谈 · 看词尾猜冠词', lines: ['-ung、-heit、-keit、-schaft、-tion、-tät、-ei、-ik：die。', '-chen、-lein、-ment、-ium：das（das Mädchen 也是 das）。', '-ling、-ismus：der。词尾规律有例外，例外照旧记。'] },
  compare: { title: '规则怪谈 · 比一比', lines: ['比较级：形容词 + er + als：Berlin ist größer als Köln。单音节常变音：alt → älter。', '最高级：am + (e)sten：am schnellsten。不规则：gut – besser – am besten，gern – lieber – am liebsten。', '一样：so … wie：so groß wie。'], shows: /\b([a-zäöüß]+er als|am [a-zäöüß]+sten|so [a-zäöüß]+ wie)\b/ },
  connAdv: { title: '规则怪谈 · deshalb 之后动词抢先', lines: ['deshalb、trotzdem、dann、sonst、danach 也占第一位。', '所以变位动词紧跟着它，主语退到动词后面。', 'Es regnet, deshalb bleibe ich zu Hause.'], shows: /\b(deshalb|trotzdem|sonst|danach) [a-zäöüß]+ (ich|du|er|sie|es|wir|man)\b/i },
  negAdv: { title: '规则怪谈 · 还没和不再', lines: ['noch nicht：还没有（以后可能会）：Der Bus ist noch nicht da.', 'nicht mehr：不再（以前是）：Ich rauche nicht mehr.', '名词前：noch kein Geld / kein Geld mehr。'], shows: /\b(noch nicht|nicht mehr)\b/ },
  k2: { title: '规则怪谈 · 如果、要是、劳驾', lines: ['第二虚拟式说愿望、假设和客气话。', 'haben → hätte，sein → wäre，können → könnte；其余多用 würde + 原形。', 'Ich hätte gern einen Kaffee. Wenn ich Zeit hätte, würde ich kommen.'], shows: /\b(hätte|wäre|könnte|würde)\b/ },
  future: { title: '规则怪谈 · werden 说以后和猜测', lines: ['werden 变位放第二位，动词原形放句末：Ich werde morgen anrufen.', '也用来猜测：Er wird krank sein.（他大概病了）', '日常说将来多用现在时加时间词，werden 更正式、更确定。'], shows: /\b(werde|wirst|wird)\b[^.!?,]* [a-zäöüß]+en[.!?]/ },
  relative: { title: '规则怪谈 · 关系从句', lines: ['用 der / die / das 接着解释前面的名词，从句里动词放末尾。', '性和数跟前面的名词，格看它在从句里做什么：', 'der Mann, der hier wohnt / den ich kenne / dem ich helfe。'], shows: /[A-ZÄÖÜ][a-zäöüß]+, (der|die|das|den|dem) [a-zäöüß]/ },
  passive: { title: '规则怪谈 · 被动：werden + 分词', lines: ['重点在「被做了什么」，不在谁做：Das Haus wird gebaut.', 'werden 变位放第二位，第二分词放句末。', '谁做的用 von + 第三格：Der Brief wird von meiner Mutter geschrieben.'], shows: /\b(wird|werden)\b[^.!?]*\bge[a-zäöüß]+(t|en)[.!?]/ },
  zuInf: { title: '规则怪谈 · zu + 原形、um … zu', lines: ['Ich habe Lust / keine Zeit / vor … 后面的动作：zu + 原形放句末。', '为了：主语相同 um … zu（Ich lerne, um in Deutschland zu arbeiten.），不同用 damit。', '虽然：obwohl + 从句，动词放末尾。'], shows: /\b(um [^,.]* zu [a-zäöüß]+en|obwohl|damit)\b/ },
  alsWenn: { title: '规则怪谈 · als 还是 wenn', lines: ['过去只发生一次（或人生的一段）：als：Als ich klein war, …', '反复发生、现在和将来：wenn：Wenn es regnet, bleibe ich zu Hause.', '两个都是从句，动词放末尾。'], shows: /(^|, )(Als|als|Wenn|wenn) (ich|du|er|sie|wir)\b/ },
  plq: { title: '规则怪谈 · 过去的过去', lines: ['两件过去的事，先发生的那件用过去完成时：hatte / war + 第二分词。', 'Als wir ankamen, war der Zug schon abgefahren.', '常和 nachdem 一起用。'], shows: /\b(hatte|war)\b[^.!?,]* ge[a-zäöüß]+(t|en)[,.!?]/ },
  nachdem: { title: '规则怪谈 · nachdem 和 bevor', lines: ['nachdem：在……之后；bevor：在……之前。', '都是从句，动词放末尾。', 'Nachdem ich gegessen hatte, ging ich spazieren. Bevor ich gehe, rufe ich dich an.'], shows: /\b(nachdem|bevor)\b/i },
  indirect: { title: '规则怪谈 · 问别人「是不是」', lines: ['间接问句是从句：变位动词放末尾。', '有疑问词照用：Weißt du, wo der Bahnhof ist?', '没有疑问词（是不是）用 ob：Ich weiß nicht, ob er kommt.'], shows: /, (ob|wo|wann|wie|warum) [a-zäöüß]/ },
  lassen: { title: '规则怪谈 · lassen：让别人做', lines: ['lassen + 原形 = 让别人做 / 让某事发生：Ich lasse mein Auto reparieren.', 'lassen 变位放第二位，原形放句末。du lässt, er lässt。', 'sich lassen = 能被……：Das lässt sich machen.'], shows: /\b(lasse|lässt|lassen)\b/ },
  passPast: { title: '规则怪谈 · 被动过去式', lines: ['过去的被动：wurde / wurden + 第二分词。', 'Die Brücke wurde 1900 gebaut.', '报纸和书面语里很常见。'], shows: /\b(wurde|wurden)\b[^.!?]*\bge[a-zäöüß]+(t|en)\b/ },
  genitive: { title: '规则怪谈 · 属格：谁的', lines: ['阳性和中性：des / eines，名词加 -(e)s：das Auto des Vaters。', '阴性和复数：der：die Farbe der Tür。', '口语常用 von + 第三格代替：das Auto von meinem Vater。'], shows: /\b(des|eines) [A-ZÄÖÜ][a-zäöüß]*e?s\b/ },
  genPrep: { title: '规则怪谈 · wegen、trotz、während', lines: ['wegen（因为）、trotz（尽管）、während（期间）、innerhalb（之内）后面用属格。', 'wegen des Regens, trotz der Kälte, während der Arbeit。'], shows: /\b(wegen|trotz|während|innerhalb) (des|der|eines|einer)\b/i },
  nDecl: { title: '规则怪谈 · n 变化名词', lines: ['一些阳性名词（多指人）除了第一格单数都加 -(e)n：', 'der Kunde → den / dem / des Kunden；der Herr → den Herrn。', '常见：Kollege, Kunde, Junge, Nachbar, Mensch, Student, Patient, Name。'] },
  nomAdj: { title: '规则怪谈 · 形容词变名词', lines: ['形容词当名词用要大写，词尾照形容词变：der Deutsche, ein Deutscher。', 'etwas / nichts / viel + 形容词 + es：etwas Gutes, nichts Neues。'], shows: /\b(etwas|nichts) [A-ZÄÖÜ][a-zäöüß]+es\b/ },
  dblConj: { title: '规则怪谈 · 成对的连词', lines: ['entweder … oder（要么……要么）、weder … noch（既不……也不）', 'sowohl … als auch（既……又）、nicht nur … sondern auch（不但……而且）', 'je + 比较级 …, desto + 比较级（越……越）：Je früher, desto besser.'], shows: /\b(weder|entweder|sowohl|nicht nur|je)\b/i },
  tempClause: { title: '规则怪谈 · während、seit、bis', lines: ['während：同时（Während ich koche, hört er Musik.）', 'seit(dem)：从过去一直到现在（Seit ich hier wohne, …）', 'bis：直到（Warte, bis ich komme.）。都是从句，动词放末尾。'], shows: /(^|, )(Während|während|Seit|seit|Bis|bis) (ich|du|er|sie|wir)\b/ },
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
