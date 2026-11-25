// 游荡的冒险者 (游戏设计 六「AI 批改和决斗场」, Lucas 2026-11-25; replaces the 决斗场 grounds). Every region has 2–3
// adventurers played by the AI, each with a name, an origin and a manner; they drift between the region's scenes.
// From 10: talk (the duel engine, the region's life situation and 1–2 of its grammar points, 3–5 target words) or PK
// (no AI: a race on the region's learned words and open grammar, judged by rule, first to 3). Below 10 they only greet.
// The name plate always says AI: never counted online, never on a leaderboard; they do speak in the world chat.
// Values marked 暂定 are not in the doc.

import { LINE_LV, allLineTasks } from './gram/lines';
import { BOARDS } from './gram/boards';
import type { GramSys, GramTask } from './gram/task';
import { gradeTyped } from './grading';
import { shuffle, type Rng } from './rng';
import { dayKey, now, type GameState } from './state';
import type { Word } from './types';
import { WORDS, fullForm } from '../data/words';
import { ERODE_DEF, REGION_DEF, regionLevels } from '../data/zones';
import { SCENES, scenesOf, type SceneDef } from '../data/world';

export const ADV = {
  from: 10,
  /** 暂定: minutes an adventurer stays in one scene before it moves on. */
  stayMin: 4,
  /** PK: first to this many points; daily paid PKs (separate from the 5 paid talks). */
  pkWin: 3,
  pkPaid: 5,
  pkShardsWin: 2,
  pkShardsLose: 1,
  /** 暂定: gold for a paid PK win, as kills of the player's level. */
  pkGoldKills: 3,
  /** Their accuracy: the player's recent one ±5%, held to 60–90%; time: the player's median × 0.9–1.2. */
  accLo: 0.6,
  accHi: 0.9,
  accJitter: 0.05,
  timeLo: 0.9,
  timeHi: 1.2,
  /** 暂定: before the player has 10 timed answers of a kind. */
  defaultAcc: 0.75,
  defaultMs: { pick: 4000, typed: 9000, gram: 9000 } as Record<PkKind, number>,
  /** World chat (all adventurers together): one unprompted line per 30 min at most, only after a human spoke; a
   *  player's @ gets at most 1 reply a minute and 20 a day. */
  worldGapMin: 30,
  mentionGapSec: 60,
  mentionDaily: 20,
};

export interface Adventurer {
  id: string;
  name: string;
  region: number;
  /** Chinese, for the model: where they come from and what they did before. */
  origin: string;
  manner: string;
  /** Kenney Tiny Dungeon figure tile. */
  tile: number;
  /** 蚀变 segment: a survivor trapped in that segment's scenes (region = the segment number). */
  erode?: boolean;
}

const NAMES = ['Jonas', 'Mila', 'Tarik', 'Greta', 'Ole', 'Selin', 'Paul', 'Yara', 'Emil', 'Nele', 'Bastian', 'Ida', 'Luca', 'Amira', 'Finn', 'Johanna', 'Malik', 'Frieda', 'Henrik', 'Leonie', 'Arne', 'Zoe', 'Konstantin', 'Ronja', 'Mats', 'Hanna', 'Levin', 'Pia', 'Dario', 'Svenja', 'Timo', 'Elif', 'Quentin', 'Merle', 'Ruben', 'Lotte', 'Nils', 'Ylva', 'Kemal', 'Wiebke', 'Bruno', 'Thea', 'Lasse', 'Carla', 'Joscha', 'Imke', 'Viktor', 'Sanne', 'Anton', 'Juna', 'Matteo', 'Flora', 'Erik', 'Lina', 'Moritz', 'Kaja', 'Jannik', 'Rieke', 'Samuel', 'Tilda'];
const ORIGINS = ['从汉堡来的护士，下班就出来走走', '刚到德国的留学生，学建筑', '在面包房干了二十年的老师傅', '退休的中学地理老师', '送快递的，整天骑车穿城', '从慕尼黑来的程序员，嘴上抱怨工作', '开小咖啡馆的', '从土耳其来的厨师，第二代移民', '在市政厅上班的公务员', '学音乐的大学生，背着吉他', '做园艺的，手上总有泥', '火车司机，说话带点方言', '刚当上爸爸的会计', '图书管理员，安安静静', '健身教练，什么都想比一比'];
const MANNERS = ['爱开玩笑', '认真、有点较真', '有点害羞，说话慢', '热情、话多', '冷静、爱提问', '乐观、爱夸人', '爱抱怨天气', '好奇心重'];
/** Figure tiles that are not the named NPCs (icons.NPC_TILE). */
const TILES = [87, 97, 98, 108, 109, 110, 112, 89];

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

/** No adventurer is named after a word of its region that is still to learn (防泄露 ③). */
function nameOk(name: string, region: number): boolean {
  const n = name.toLowerCase();
  return !WORDS.some((w) => (w.region ?? 1) === region && w.de.toLowerCase().replace(/^(der|die|das) /, '') === n);
}

const CACHE = new Map<number, Adventurer[]>();
/** The region's 2–3 adventurers (fixed per region). */
export function adventurersOf(region: number, erode = false): Adventurer[] {
  const key = erode ? -region : region;
  const hit = CACHE.get(key);
  if (hit) return hit;
  const n = 2 + (hash(`n${key}`) % 2);
  const out: Adventurer[] = [];
  let k = hash(`r${key}`);
  for (let i = 0; out.length < n && i < 50; i++, k = hash(`${k}`)) {
    const name = NAMES[k % NAMES.length];
    if (out.some((a) => a.name === name) || !nameOk(name, region)) continue;
    out.push({ id: `${erode ? 'ero' : 'adv'}${region}-${out.length}`, name, region, origin: ORIGINS[(k >>> 4) % ORIGINS.length], manner: MANNERS[(k >>> 9) % MANNERS.length], tile: TILES[(k >>> 13) % TILES.length], ...(erode ? { erode: true } : {}) });
  }
  CACHE.set(key, out);
  return out;
}

export function adventurerById(id: string): Adventurer | undefined {
  const m = /^(adv|ero)(\d+)-/.exec(id);
  if (!m) return undefined;
  return adventurersOf(Number(m[2]), m[1] === 'ero').find((a) => a.id === id);
}

/** Where an adventurer is now: one of its scenes (a region's fields and camp; a 蚀变 segment's scenes), changing every
 *  few minutes, the same for everyone. */
export function adventurerScene(a: Adventurer, t = Date.now()): SceneDef | null {
  const sc = a.erode ? SCENES.filter((x) => x.erodeSeg === a.region) : scenesOf(a.region as never).filter((x) => x.type === 'field' || x.type === 'camp' || x.bonfire);
  if (!sc.length) return null;
  return sc[hash(`${a.id}:${Math.floor(t / (ADV.stayMin * 60_000))}`) % sc.length];
}

/** Adventurers standing in a scene now (the region's own, and in an open 蚀变 scene its survivors). */
export function adventurersIn(sc: SceneDef, erodeOpen: boolean, t = Date.now()): Adventurer[] {
  const own = adventurersOf(sc.region).filter((a) => adventurerScene(a, t)?.id === sc.id);
  const ero = sc.erodeSeg && erodeOpen ? adventurersOf(sc.erodeSeg, true).filter((a) => adventurerScene(a, t)?.id === sc.id) : [];
  return [...own, ...ero];
}

// ---- Topic and grammar ---------------------------------------------------------------------------------------

const EARLY_TOPIC: Record<number, string> = { 1: '营地生活、吃的喝的、打招呼和介绍自己', 2: '在集市买东西、问价钱、付钱', 3: '坐火车、问路、时间和日程' };
const EARLY_GRAM: Record<number, string[]> = { 1: ['名词的冠词（der / die / das）', '动词现在时变位'], 2: ['宾格（einen / den）', '情态动词（möchten, können）'], 3: ['完成时（haben / sein + 分词）', '与格（mit dem / mit der）'] };

/** The region's life situation, for the model. 蚀变 regions: trapped survivors of the old situation. */
export function regionTopic(region: number, sceneZh = ''): string {
  const d = REGION_DEF[region] as { theme?: string; zh?: string } | undefined;
  return EARLY_TOPIC[region] ?? (d?.theme ? `${d.zh ?? ''}：${d.theme}` : sceneZh ? `${sceneZh}一带的日常生活` : '这个区的日常生活');
}

/** Grammar systems taught in a region (line rules opening inside its levels), open at the player's level. */
export function regionGramSys(region: number, level: number): GramSys[] {
  const [lo, hi] = regionLevels(region as never) as [number, number];
  return (Object.entries(LINE_LV) as Array<[GramSys, number]>).filter(([, lv]) => lv >= lo && lv <= hi && lv <= level).map(([sys]) => sys);
}

/** 1–2 grammar points (Chinese names) the adventurer works into the talk. */
export function regionGrammar(region: number, level: number, rng: Rng): string[] {
  const sys = regionGramSys(region, level);
  const names = sys.length ? sys.map((x) => (BOARDS[x]?.title ?? x).replace(/^规则怪谈 · /, '')) : EARLY_GRAM[region] ?? [];
  return shuffle(rng, names).slice(0, 2);
}

/** The scene line for the duel engine (persona, situation, grammar). */
export function adventurerPrompt(a: Adventurer, sc: SceneDef | null, playerOrigin: string, grammar: string[]): string {
  const ero = a.erode ? ERODE_DEF[a.region] : undefined;
  const topic = a.erode ? `${sc?.zh ?? '这里'}（${ero?.zh ?? '蚀变区'}）的旧场合` : regionTopic(a.region, sc?.zh);
  return [
    `你是冒险者 ${a.name}（AI 扮演，玩家知道你是 AI），${a.origin}，性格${a.manner}。${a.erode ? '你是被困在这个蚀变区的幸存者，聊这个地方原来的生活场合。' : ''}`,
    `你们在「${topic}」这一带碰到，话题跟着这个生活场合走；你的出身和玩家的出身（${playerOrigin || '不详'}）只作点缀。`,
    grammar.length ? `这场有意识地用上这些语法：${grammar.join('、')}。你自己先用一次，再问一个需要玩家用这个语法回答的问题（例：完成时就问 Was hast du gestern gemacht?）。` : '',
    '目标：聊满几轮，玩家把要用的词都用上。不谈政治，不说粗口，不问玩家的真实个人信息。',
  ].filter(Boolean).join('');
}

/** Below 10: a fixed greeting (no AI). */
export const GREET = [
  ['Hallo! Ich bin {n}. Bis später!', '你好！我是 {n}。回头见！'],
  ['Hi! Alles gut? Ich muss weiter.', '嗨！还好吗？我得走了。'],
  ['Guten Tag! Viel Glück heute!', '你好！今天好运！'],
];

// ---- PK ---------------------------------------------------------------------------------------------------------

export type PkKind = 'pick' | 'typed' | 'gram';

export interface PkQuestion {
  kind: PkKind;
  word: Word;
  prompt: string;
  focus: string;
  options?: string[];
  answer: string;
  /** Grammar task (graded by gradeGram). */
  gram?: GramTask;
  /** Shown after the round. */
  full: string;
}

/** Recent answers (battle), for the adventurer's accuracy and pace. */
export interface AnsRec {
  k: PkKind;
  ok: boolean;
  ms: number;
}

export function noteAnswer(s: GameState, k: PkKind, ok: boolean, ms: number | undefined): void {
  if (ms === undefined || ms <= 0 || ms > 120_000) return;
  const list = (s.recentAns ??= []);
  list.push({ k, ok, ms: Math.round(ms) });
  if (list.length > 90) list.splice(0, list.length - 90);
}

/** The adventurer's chance and time for this kind of question. */
export function rivalFor(s: GameState, k: PkKind, rng: Rng): { acc: number; ms: number } {
  const recs = (s.recentAns ?? []).filter((r) => r.k === k).slice(-30);
  const acc0 = recs.length >= 10 ? recs.filter((r) => r.ok).length / recs.length : ADV.defaultAcc;
  const acc = Math.min(ADV.accHi, Math.max(ADV.accLo, acc0 + (rng() * 2 - 1) * ADV.accJitter));
  const ms = recs.filter((r) => r.ok).map((r) => r.ms).sort((a, b) => a - b);
  const med = ms.length >= 5 ? ms[Math.floor(ms.length / 2)] : ADV.defaultMs[k];
  return { acc, ms: Math.round(med * (ADV.timeLo + rng() * (ADV.timeHi - ADV.timeLo))) };
}

/** PK words: this region's words the player has at 半名 or better (not retired-and-gone phrases). */
export function pkWords(s: GameState, region: number): Word[] {
  return WORDS.filter((w) => (w.region ?? 1) === region && w.pos !== 'phr' && (s.words[w.id]?.stage ?? 0) >= 2);
}

export function pkQuestion(s: GameState, region: number, rng: Rng): PkQuestion | null {
  const pool = pkWords(s, region);
  if (pool.length < 4) return null;
  const w = pool[Math.floor(rng() * pool.length)];
  const r = rng();
  const sys = regionGramSys(region, s.level);
  if (sys.length && r < 0.3) {
    for (const x of shuffle(rng, sys)) {
      const tasks = allLineTasks(w, x);
      if (tasks.length) {
        const g = tasks[Math.floor(rng() * tasks.length)];
        return { kind: 'gram', word: w, prompt: g.prompt, focus: g.focus, options: g.options, answer: g.answer, gram: g, full: g.full ?? fullForm(w) };
      }
    }
  }
  const others = shuffle(rng, pool.filter((x) => x.id !== w.id && x.zh !== w.zh)).slice(0, 3);
  if (r < 0.55) {
    const opts = shuffle(rng, [w, ...others]).map((x) => x.zh);
    return { kind: 'pick', word: w, prompt: '选意思', focus: fullForm(w), options: opts, answer: w.zh, full: `${fullForm(w)} · ${w.zh}` };
  }
  if (r < 0.75) {
    const opts = shuffle(rng, [w, ...others]).map((x) => fullForm(x));
    return { kind: 'pick', word: w, prompt: '选德语', focus: w.zh, options: opts, answer: fullForm(w), full: `${fullForm(w)} · ${w.zh}` };
  }
  return { kind: 'typed', word: w, prompt: w.art ? '写出德语（带冠词）' : '写出德语', focus: w.zh, answer: fullForm(w), full: `${fullForm(w)} · ${w.zh}` };
}

export function gradePk(q: PkQuestion, input: string): boolean {
  if (q.gram) {
    if (q.options) return input === q.answer || (q.gram.alts ?? []).includes(input);
    const k = (x: string) => x.toLowerCase().replace(/[.,!?]/g, '').replace(/\s+/g, ' ').trim();
    return [q.answer, ...(q.gram.alts ?? [])].some((a) => k(a) === k(input));
  }
  if (q.options) return input === q.answer;
  return gradeTyped(input, q.word, !!q.word.art).ok;
}

/** Today's paid PKs so far. */
export function pkPaidLeft(s: GameState): number {
  const day = dayKey(now(s));
  if (s.flags.pkDay !== day) return ADV.pkPaid;
  return Math.max(0, ADV.pkPaid - ((s.flags.pkN as number) ?? 0));
}

export function notePkPaid(s: GameState): boolean {
  const day = dayKey(now(s));
  if (s.flags.pkDay !== day) (s.flags.pkDay = day), (s.flags.pkN = 0);
  s.flags.pkN = ((s.flags.pkN as number) ?? 0) + 1;
  return (s.flags.pkN as number) <= ADV.pkPaid;
}
