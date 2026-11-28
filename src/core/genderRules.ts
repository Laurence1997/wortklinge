// 词性规律 (Lucas 2026-11-28「出生点加 der/die/das 的判断规则」): the rules a learner can lean on to guess a noun's
// gender, checked against the game's own word list (src/data/words.ts). Two uses:
//  1. genderHint(w): in battle, after a wrong stance / wrong article, or on the 先教后考 turn, the one rule this noun
//     falls under (or the rule it breaks, said as an exception). A noun no rule covers gets nothing.
//  2. ruleStats(rule): how many nouns of the word list a rule covers and how many follow it, shown on the board
//     (src/ui/rulesBoard.ts), so 「多半」 is backed by numbers, not by feeling.
// Only rules that hold for at least ~80% of the list's nouns are used in battle; weaker ones live on the board only.
import type { Article, Word } from './types';
import { WORDS } from '../data/words';

export interface GenderRule {
  id: string;
  art: Article;
  /** Short name on the board and in hints: 「-ung」「复合词」「星期」. */
  label: string;
  /** How the rule reads in a hint: 「-ung 结尾的名词」. */
  who: string;
  /** true: (almost) no exceptions → 「都是」; false → 「多半是」. */
  sure: boolean;
  test: (w: Word) => boolean;
  /** Exceptions worth a word of their own (key = Word.de). */
  why?: Record<string, string>;
}

const ends = (...sufs: string[]) => (w: Word) => sufs.some((x) => w.de.endsWith(x));
const isWord = (...list: string[]) => {
  const set = new Set(list);
  return (w: Word) => set.has(w.de);
};
const female = (w: Word) => /女|母|姐|妹|妻|婆|姑|姨|娘|奶奶|新娘|修女|寡妇/.test(w.zh);
const person = (w: Word) => w.cat === 'person';

let verbSet: Set<string> | null = null;
function verbs(): Set<string> {
  return (verbSet ??= new Set(WORDS.filter((x) => x.pos === 'v').map((x) => x.de.toLowerCase())));
}
/** Lehrer ← lehren, Fahrer ← fahren, Sammler ← sammeln: a doer or a tool made from a verb. */
function agentNoun(w: Word): boolean {
  if (!w.de.endsWith('er') || w.de.length < 5) return false;
  const st = w.de.slice(0, -2).toLowerCase();
  const v = verbs();
  return v.has(st + 'en') || v.has(st + 'n');
}

const ART_ZH: Record<Article, string> = { der: '阳性 der', die: '阴性 die', das: '中性 das' };

/** Ordered: the first rule that matches decides (sure suffixes, then natural gender, then the softer rules). */
export const GENDER_RULES: GenderRule[] = [
  // ---- die: sure suffixes
  { id: 'ung', art: 'die', label: '-ung', who: '-ung 结尾的名词', sure: true, test: ends('ung'),
    why: { Sprung: 'Sprung 来自 springen，-ung 不是后缀', Ursprung: '它的最后一部分是 der Sprung（来自 springen），-ung 不是后缀', Vorsprung: '它的最后一部分是 der Sprung（来自 springen），-ung 不是后缀', Schwung: 'Schwung 来自 schwingen，-ung 不是后缀' } },
  { id: 'heit', art: 'die', label: '-heit / -keit', who: '-heit、-keit 结尾的名词', sure: true, test: ends('heit', 'keit') },
  { id: 'schaft', art: 'die', label: '-schaft', who: '-schaft 结尾的名词', sure: true, test: ends('schaft') },
  { id: 'tion', art: 'die', label: '-tion / -sion', who: '-tion、-sion 结尾的名词', sure: true, test: ends('tion', 'sion') },
  { id: 'taet', art: 'die', label: '-tät', who: '-tät 结尾的名词', sure: true, test: ends('tät') },
  { id: 'enz', art: 'die', label: '-enz', who: '-enz 结尾的名词', sure: true, test: ends('enz') },
  { id: 'ade', art: 'die', label: '-ade / -age / -ette', who: '-ade、-age、-ette 结尾的外来词', sure: true, test: ends('ade', 'age', 'ette'),
    why: { Image: 'Image 是英语借词，照英语读，不算这类' } },
  { id: 'erei', art: 'die', label: '-erei / -elei', who: '-erei、-elei 结尾的名词（Bäckerei 这类）', sure: true, test: ends('erei', 'elei') },
  // ---- das: sure suffixes
  { id: 'chen', art: 'das', label: '-chen / -lein', who: '-chen、-lein 结尾的小称（指小的东西）', sure: true, test: ends('chen', 'lein'),
    why: { Kuchen: '它的 -chen 本来就是词的一部分，不是小称', Knochen: '它的 -chen 本来就是词的一部分，不是小称', Pfannkuchen: '它的最后一部分是 der Kuchen，-chen 不是小称' } },
  { id: 'ment', art: 'das', label: '-ment', who: '-ment 结尾的外来词', sure: true, test: ends('ment'),
    why: { Moment: '另有一个 das Moment，意思是「因素」，别弄混' } },
  { id: 'um', art: 'das', label: '-um', who: '-um 结尾的拉丁来源词（Museum、Zentrum）', sure: true, test: (w) => w.de.endsWith('um') && !w.de.endsWith('aum') && !w.de.endsWith('tum') },
  { id: 'ett', art: 'das', label: '-ett', who: '-ett 结尾的外来词', sure: true, test: ends('ett') },
  // ---- der: sure suffixes
  { id: 'ling', art: 'der', label: '-ling', who: '-ling 结尾的名词', sure: true, test: ends('ling') },
  { id: 'ismus', art: 'der', label: '-ismus', who: '-ismus 结尾的名词', sure: true, test: ends('ismus') },
  { id: 'eur', art: 'der', label: '-eur', who: '-eur 结尾的职业（Friseur）', sure: true, test: ends('eur') },
  // ---- natural gender
  { id: 'fem', art: 'die', label: '女性 -in', who: '-in 结尾、指女性的名词', sure: true, test: (w) => w.de.endsWith('in') && (female(w) || w.de.endsWith('erin')) },
  { id: 'agent', art: 'der', label: '动词 + -er', who: '动词变来的 -er（做事的人或工具：Lehrer、Wecker）', sure: false, test: agentNoun,
    why: { Trauer: '它不是做事的人或工具，是抽象名词', Leber: '它和 leben 没有关系', Messer: '它和 messen 没有关系' } },
  { id: 'nmasc', art: 'der', label: '男人和雄性动物 -e', who: '-e 结尾、指男人或动物的这类词（der Kunde、der Löwe）', sure: false,
    test: (w) => w.de.endsWith('e') && (person(w) || w.cat === 'animal') && w.art === 'der' },
  // ---- meaning groups
  { id: 'day', art: 'der', label: '星期、月份、季节', who: '星期、月份、季节、一天里的时段', sure: true,
    test: isWord('Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonnabend', 'Sonntag', 'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember', 'Frühling', 'Sommer', 'Herbst', 'Winter', 'Morgen', 'Vormittag', 'Mittag', 'Nachmittag', 'Abend', 'Frühjahr', 'Nacht'),
    why: { Frühjahr: '它的最后一部分是 das Jahr' } },
  { id: 'dir', art: 'der', label: '方向和天气', who: '方位和天气现象', sure: true,
    test: isWord('Norden', 'Süden', 'Osten', 'Westen', 'Regen', 'Schnee', 'Wind', 'Nebel', 'Sturm', 'Hagel', 'Frost', 'Donner', 'Blitz', 'Tau', 'Nieselregen', 'Gewitter'),
    why: { Gewitter: 'Ge- 开头的集合词常是 das' } },
  { id: 'drink', art: 'der', label: '酒', who: '酒（Wein、Schnaps）', sure: true,
    test: isWord('Wein', 'Rotwein', 'Weißwein', 'Sekt', 'Schnaps', 'Whisky', 'Wodka', 'Likör', 'Rum', 'Champagner', 'Cognac', 'Bier'),
    why: { Bier: '这是最常见的一个，一定要记住' } },
  { id: 'metal', art: 'das', label: '金属', who: '金属和化学元素', sure: true,
    test: isWord('Gold', 'Silber', 'Eisen', 'Kupfer', 'Blei', 'Zinn', 'Zink', 'Platin', 'Aluminium', 'Uran', 'Titan', 'Messing', 'Stahl', 'Bronze'),
    why: { Stahl: '钢是合金，不是元素', Bronze: '青铜是合金，跟着 -e 走' } },
  { id: 'young', art: 'das', label: '幼崽', who: '幼崽（Kalb、Lamm）', sure: true, test: isWord('Kalb', 'Lamm', 'Ferkel', 'Küken', 'Fohlen', 'Kitz', 'Baby', 'Kind') },
  { id: 'frac', art: 'das', label: '分数', who: '分数（Drittel、Viertel）', sure: true, test: (w) => /^(Dritt|Viert|Fünft|Sechst|Siebt|Acht|Zehnt|Hundertst|Tausendst)el$/.test(w.de) || w.de === 'Hälfte',
    why: { Hälfte: '它跟着 -e 走' } },
  // ---- die / das / der: softer suffixes
  { id: 'ie', art: 'die', label: '-ie', who: '-ie 结尾的名词', sure: false, test: ends('ie') },
  { id: 'ik', art: 'die', label: '-ik', who: '-ik 结尾的名词（Musik、Politik）', sure: false, test: ends('ik') },
  { id: 'ur', art: 'die', label: '-ur', who: '-ur 结尾的外来词（Natur、Kultur）', sure: false, test: (w) => w.de.endsWith('ur') && !w.de.endsWith('eur') },
  { id: 'anz', art: 'die', label: '-anz', who: '-anz 结尾的外来词（Distanz、Toleranz）', sure: false, test: (w) => w.de.endsWith('anz') && !/(T|t)anz$|(G|g)lanz$|(S|s)chwanz$|(K|k)ranz$/.test(w.de) },
  { id: 'ma', art: 'das', label: '-ma', who: '-ma 结尾的名词（Thema、Klima 这类希腊来源词）', sure: false, test: ends('ma'),
    why: { Mama: '指女性的词按自然性别', Oma: '指女性的词按自然性别' } },
  { id: 'tum', art: 'das', label: '-tum', who: '-tum 结尾的名词', sure: false, test: ends('tum'),
    why: { Reichtum: 'Reichtum 和 Irrtum 是 -tum 里最常见的两个 der', Irrtum: 'Irrtum 和 Reichtum 是 -tum 里最常见的两个 der' } },
  { id: 'ist', art: 'der', label: '-ist / -ant / -ent（人）', who: '-ist、-ant 结尾的名词，和 -ent 结尾的人（Polizist、Elefant、Student）', sure: false,
    test: (w) => (w.de.endsWith('ist') && w.de.length > 5) || (w.de.endsWith('ant') && w.de.length > 5) || (w.de.endsWith('ent') && !w.de.endsWith('ment') && person(w)),
    why: { Restaurant: '它是法语借词，而且不是人' } },
  { id: 'or', art: 'der', label: '-or', who: '-or 结尾的外来词（Motor、Doktor）', sure: false, test: (w) => w.de.endsWith('or') && w.de.length > 4,
    why: { Labor: '它是 Laboratorium 的缩写，跟原词走' } },
  { id: 'ig', art: 'der', label: '-ig / -ich', who: '-ig、-ich 结尾的名词（König、Teppich）', sure: false, test: (w) => (w.de.endsWith('ig') || w.de.endsWith('ich')) && w.de.length > 4 },
  { id: 'e', art: 'die', label: '-e', who: '-e 结尾的名词', sure: false, test: ends('e') },
];

/** Gender words whose article really changes the meaning: no head word is trusted when the last part is one of these. */
const AMBIG = new Set(['Teil', 'See', 'Band', 'Gin', 'Mus', 'Tor', 'Leiter', 'Steuer', 'Bar', 'Eis', 'Ende', 'Wert', 'Tat', 'Rat', 'Alter', 'Ufer', 'Leber', 'Erbe', 'Rose', 'Fee', 'Tee', 'Dom', 'Lust', 'Tanz', 'Wand', 'Uhr', 'Ding', 'Stier', 'Gier', 'Messer', 'Windel', 'Eid', 'Rad', 'Lamm', 'Tracht', 'Dienst', 'Fakt', 'Wein', 'Mut', 'Gehalt', 'Kiefer', 'Schild', 'Moment', 'Heide', 'Golf', 'Bund', 'Erbe', 'Pony', 'Weise', 'Mark']);

let nounArt: Map<string, Article> | null = null;
let stems: Set<string> | null = null;
function index(): void {
  if (nounArt) return;
  nounArt = new Map();
  stems = new Set();
  for (const w of WORDS) {
    if (w.de.includes(' ')) continue;
    if (w.art && !w.plOnly && !nounArt.has(w.de)) nounArt.set(w.de, w.art);
    const d = w.de.toLowerCase();
    stems.add(d);
    if (w.pos === 'v') stems.add(d.endsWith('en') ? d.slice(0, -2) : d.endsWith('n') ? d.slice(0, -1) : d);
  }
}

/** 复合词: the last part of a compound, when both parts are words of the list (Haus + Tür → Tür). */
export function headOf(w: Word): { de: string; art: Article } | null {
  index();
  const d = w.de;
  for (let i = 3; i < d.length - 3; i++) {
    const head = d[i].toUpperCase() + d.slice(i + 1);
    const art = nounArt!.get(head);
    if (!art || AMBIG.has(head)) continue;
    const left = d.slice(0, i).toLowerCase();
    for (const f of ['', 's', 'es', 'n', 'en', 'e', 'er']) {
      if (f && !left.endsWith(f)) continue;
      const base = f ? left.slice(0, left.length - f.length) : left;
      if (base.length >= 3 && stems!.has(base)) return { de: head, art };
    }
  }
  return null;
}

export interface GenderHint {
  rule: GenderRule | null;
  /** The noun follows the rule (false: it is an exception to it). */
  follows: boolean;
  text: string;
}

/** The rule a noun falls under, said in one line; null when no rule covers it (then nothing is shown). */
export function genderHint(w: Word): GenderHint | null {
  if (!w.art || w.plOnly || w.de.includes(' ')) return null;
  const name = `${w.art} ${w.de}`;
  const sureHit = GENDER_RULES.find((r) => r.sure && r.id !== 'fem' && r.test(w) && !['day', 'dir', 'drink', 'metal', 'young', 'frac'].includes(r.id));
  if (sureHit && sureHit.art === w.art) return say(sureHit, w, true);
  // 复合词看最后一个词: a sure suffix it breaks is better explained by its head word, when there is one.
  const head = headOf(w);
  if (head && head.art === w.art) {
    return { rule: COMPOUND, follows: true, text: `规律：复合词看最后一个词。${w.de} 的最后一部分是 ${head.art} ${head.de}，所以是 ${name}。` };
  }
  if (sureHit) return say(sureHit, w, false);
  const r = GENDER_RULES.find((x) => x.test(w));
  if (!r) return null;
  // A soft rule broken with no note of its own is not worth a line: 「-e 多半是 die，der Käse 例外」 says little
  // a player can use. Sure rules and noted exceptions still say it.
  if (r.art !== w.art && !r.sure && !r.why?.[w.de]) return null;
  return say(r, w, r.art === w.art);
}

const COMPOUND: GenderRule = { id: 'compound', art: 'der', label: '复合词', who: '复合词', sure: true, test: (w) => !!headOf(w) };

function say(r: GenderRule, w: Word, follows: boolean): GenderHint {
  const name = `${w.art} ${w.de}`;
  const note = r.why?.[w.de];
  if (r.id === 'nmasc') return { rule: r, follows: true, text: `规律：-e 结尾多半是 die，但有一批指男人和某些动物的 -e 词是 der（der Kunde、der Junge、der Löwe），${name} 就是这类。` };
  if (follows) return { rule: r, follows, text: `规律：${r.who}${r.sure ? '都是' : '多半是'}${ART_ZH[r.art]}。${note ? `${note}。` : ''}` };
  return { rule: r, follows, text: `注意：${r.who}${r.sure ? '都是' : '多半是'} ${r.art}，${name} 是例外。${note ? `${note}。` : '要单独记。'}` };
}

/** 词表统计 for the board: nouns the rule covers and how many of them follow it. */
export function ruleStats(r: GenderRule): { n: number; ok: number; except: string[] } {
  let n = 0;
  let ok = 0;
  const except: string[] = [];
  for (const w of WORDS) {
    if (!w.art || w.plOnly || w.de.includes(' ') || !r.test(w)) continue;
    n++;
    if (w.art === r.art) ok++;
    else if (except.length < 12) except.push(`${w.art} ${w.de}`);
  }
  return { n, ok, except };
}

export function ruleById(id: string): GenderRule | undefined {
  return GENDER_RULES.find((r) => r.id === id);
}
