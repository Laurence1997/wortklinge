// 6000 词导入 (0.7+0.8, 游戏设计 rev 425/430): every monster word comes from the 6000-word list and its scene groups
// 《6000词进场景-第1版》, generated into src/data/lexicon.ts by scripts/build_lexicon.py. Regions 1–3 have five fields,
// regions 4–12 three; 蚀变 groups (segments 8 and 11) hang on old field scenes. Words carry their scene, batch and,
// for 蚀变 ladder words, the base word they are the advanced form of (`after`).
// The only word outside the list is the 宝箱怪 Truhe (rare spawn, flees with its chest).

import type { Article, ErodeSeg, FamilyId, Pos, RegionNo, Word, ZoneId } from '../core/types';
import { LEX_ERODED, LEX_ROWS, LEX_SCENES } from './lexicon';

/** Nouns of these situations work in 「Ich möchte …」 (food, drink and things you can ask for). */
const MOECHTE_SITUATIONS = new Set(['吃喝', '日常物品', '购物付钱']);

function build(): Word[] {
  const situation = new Map<string, string>();
  for (const [, , , , sit, ids] of LEX_SCENES) for (const id of ids) situation.set(id, sit);
  const out: Word[] = LEX_ROWS.split('\n').map((line) => {
    const [id, de, art, pl, zh, pos, family, lvl, zone, scene, region, erode, batch, after, digit, , , , , ex, sit] = line.split('\t');
    const w: Word = { id, de, zh, pos: pos as Pos, family: family as FamilyId, lvl: +lvl, zone: zone as ZoneId, region: +region as RegionNo, scene };
    if (art) w.art = art as Article;
    if (pl === '+') w.plOnly = true;
    else if (pl) w.pl = pl;
    if (erode) w.erode = +erode as ErodeSeg;
    if (batch) w.batch = 2;
    if (after) w.after = after;
    if (digit) w.digit = digit;
    if (pos === 'num') w.zh = `数字 ${digit}`;
    if (ex) w.ex = ex;
    // The word's own situation (列「情境」), else its scene's.
    if (pos === 'n' && !erode && w.pl && w.pl !== '-' && MOECHTE_SITUATIONS.has(sit || (situation.get(id) ?? ''))) w.moechte = true;
    return w;
  });
  // The opening bread by the bonfire (tutorial respawn) is the list's Brot.
  const brot = out.find((w) => w.id === 'brot');
  if (brot) brot.tutorial = true;
  out.push({ id: 'truhe', de: 'Truhe', art: 'die', pl: 'Truhen', zh: '宝箱', pos: 'n', family: 'truhe', lvl: 15, zone: 'waagegasse', region: 2 });
  return out;
}

/** Word ids of each field scene (all regions), in group order. */
export const SCENE_WORDS: Record<string, string[]> = Object.fromEntries(LEX_SCENES.map(([id, , , , , ids]) => [id, ids]));
/** @deprecated name from before the import; same object as SCENE_WORDS. */
export const LATER_SCENE_WORDS = SCENE_WORDS;
/** 蚀变 word groups by old scene id. */
export const ERODED_SCENE_WORDS: Record<string, string[]> = Object.fromEntries(LEX_ERODED.map(([scene, , ids]) => [scene, ids]));
/** Segment of each 蚀变 host scene. */
export const ERODED_SEG: Record<string, ErodeSeg> = Object.fromEntries(LEX_ERODED.map(([scene, seg]) => [scene, seg]));

export const WORDS: Word[] = build();
export const WORD_BY_ID: Record<string, Word> = Object.fromEntries(WORDS.map((w) => [w.id, w]));

/** Old region 1–3 content made for the 640-word scenes (diary pages, scene pictures) follows its words to the 6000-word
 *  scenes: each item goes to the scene of its region that holds most of its words, one item per scene, best matches
 *  first. Items with no word left in their region get no scene. */
export function sceneByWords(items: Array<{ key: string; ids: string[] }>): Map<string, string> {
  const cands: Array<[string, string, number]> = [];
  for (const it of items) {
    const region = +it.key.slice(1, it.key.indexOf('-'));
    const count = new Map<string, number>();
    for (const id of it.ids) {
      const w = WORD_BY_ID[id];
      if (w?.scene && !w.erode && w.region === region) count.set(w.scene, (count.get(w.scene) ?? 0) + 1);
    }
    for (const [sc, n] of count) cands.push([it.key, sc, n]);
  }
  cands.sort((a, b) => b[2] - a[2]);
  const out = new Map<string, string>();
  const taken = new Set<string>();
  for (const [key, sc] of cands) {
    if (out.has(key) || taken.has(sc)) continue;
    out.set(key, sc);
    taken.add(sc);
  }
  return out;
}

/** Display form with article: "der Tee", "die Eltern", "Hallo". */
export function fullForm(w: Word): string {
  return w.art ? `${w.art} ${w.de}` : w.de;
}

export function genderOf(w: Word): 'm' | 'f' | 'n' | 'pl' | null {
  if (!w.art) return null;
  if (w.plOnly) return 'pl';
  return w.art === 'der' ? 'm' : w.art === 'die' ? 'f' : 'n';
}

/** Words you can be asked der/die/das about (plural-only nouns answer "die"). */
/** 词性标签 for questions that show Chinese and ask for German (是 = Ja / sein, 工作 = Arbeit / arbeiten). */
export function posTag(w: Word): string {
  if (w.pos === 'name') {
    // Languages (Deutsch, Chinesisch) and countries share the 'name' pos; tell them apart by the Chinese (…语).
    if (/语$/.test(w.zh)) return '语言名·不带冠词';
    return w.art ? '国名·带冠词' : '国名·不带冠词';
  }
  return { n: w.art ? '名词·带冠词' : '名词', v: '动词', adj: '形容词·副词', phr: '日常用语', num: '数词', q: '疑问词' }[w.pos];
}

/** The Chinese with its 词性 tag: 工作〔动词〕. */
export function zhWithPos(w: Word): string {
  return `${w.digit ?? w.zh}〔${posTag(w)}〕`;
}

export function hasArticleQuestion(w: Word): boolean {
  return !!w.art;
}
