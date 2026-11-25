// 秘术栏 (游戏设计 九「短句卡和俚语秘术」+「短句卡和俚语效果表」, 2026-11-25, values 暂定).
// One slot (two from B1 = 81), not counted in the skill slots. A short card (3 级) or a slang line (50 级) goes in it.
// Each fight it can be shouted once: type the whole sentence and its effect lands on numbers only (damage, HP, hits
// taken, drops, XP, gold, the monster's pace), never on learning. Before 33 shouting takes the turn (the monsters act);
// from 33 it is a bonus action (附赠动作). Slang only works on the situation it names; the wrong one backfires: no
// effect, and this fight's next wrong answer is hit +50%.

import { normalize } from './grading';
import { SAYINGS } from '../data/sayings';
import { maxHp, type GameState } from './state';

export const CHARM = {
  from: 3,
  slangFrom: 50,
  bonusFrom: 33,
  twoSlotsFrom: 81,
  backfireMult: 1.5,
};

/** Effects a shout can set for the rest of the fight (on PlayerFx, shared by a pack). */
export interface CharmFx {
  /** Shouted this fight (ids). */
  used: string[];
  firstWrongHalf?: boolean;
  firstWrongDone?: boolean;
  xp?: number;
  quickMs?: number;
  crit?: number;
  shard?: number;
  firstQ?: number;
  vsReview?: number;
  firstThree?: number;
  lowHeal?: boolean;
  vsHigher?: number;
  drop?: number;
  keepCombo?: boolean;
  delay?: number;
  taken?: number;
  gold?: number;
  typed?: number;
  replay?: number;
  chargeHalf?: boolean;
  afterHeal?: number;
  dmg?: number;
  ironChest?: number;
  /** Backfire: the next wrong answer is hit ×1.5. */
  backfire?: boolean;
}

export type CharmKind = 'card' | 'slang';

export interface CharmDef {
  id: string;
  kind: CharmKind;
  /** The whole sentence to type. */
  de: string;
  zh: string;
  /** What it does, in Chinese (shown in the 秘术 panel). */
  fx: string;
  /** Slang only: the situation in Chinese. */
  when?: string;
  apply: (f: CharmFx, s: GameState) => string | void;
}

// The 20 cards in the game differ from the doc's table in 7 places: each takes the closest row (doc rule).
const CARD_FX: Record<string, { fx: string; apply: CharmDef['apply'] }> = {
  sicher: { fx: '本场第一次答错只受一半伤害', apply: (f) => void (f.firstWrongHalf = true) },
  uebung: { fx: '本场经验 +10%', apply: (f) => void (f.xp = (f.xp ?? 0) + 0.1) },
  klar: { fx: '本场快答线放宽 1 秒', apply: (f) => void (f.quickMs = (f.quickMs ?? 0) + 1000) },
  problem: { fx: '立即回 15% 生命', apply: (_f, s) => heal(s, 0.15) },
  sehen: { fx: '本场暴击率 +5%', apply: (f) => void (f.crit = (f.crit ?? 0) + 0.05) },
  endeGut: { fx: '本场击杀时多 1 片碎片', apply: (f) => void (f.shard = (f.shard ?? 0) + 1) },
  anfang: { fx: '本场第一题伤害 ×1.5', apply: (f) => void (f.firstQ = 1.5) },
  spaet: { fx: '本场对复习怪伤害 +20%', apply: (f) => void (f.vsReview = 0.2) },
  glueck: { fx: '本场掉落率 +20%', apply: (f) => void (f.drop = (f.drop ?? 0) + 0.2) },
  besserung: { fx: '战斗结束后回 50% 生命', apply: (f) => void (f.afterHeal = 0.5) },
  // closest rows (暂定): Schönes Wochenende → Los geht's!, Bis morgen → Ohne Fleiß kein Preis, Das ist mir egal → Na und?,
  // Ordnung muss sein → Schon gut., Morgen ist auch noch ein Tag → Moment mal!, Andere Länder, andere Sitten → Nur Mut!,
  // Wie bitte? → Noch einmal, bitte., Keine Ahnung, Kopf hoch, Zeit ist Geld as in the table.
  wochenende: { fx: '本场前 3 题伤害 +15%', apply: (f) => void (f.firstThree = 0.15) },
  morgen: { fx: '本场打字题伤害 +10%', apply: (f) => void (f.typed = 0.1) },
  ahnung: { fx: '本场一次答错不断连击', apply: (f) => void (f.keepCombo = true) },
  egal: { fx: '本场第一次被蓄力大招打中时伤害减半', apply: (f) => void (f.chargeHalf = true) },
  zeit: { fx: '本场金币 +25%', apply: (f) => void (f.gold = (f.gold ?? 0) + 0.25) },
  ordnung: { fx: '本场受到伤害 −10%', apply: (f) => void (f.taken = (f.taken ?? 0) + 0.1) },
  nochEinTag: { fx: '怪的下一次出手推迟一回合', apply: (f) => void (f.delay = (f.delay ?? 0) + 1) },
  sitten: { fx: '本场对等级高于自己的怪伤害 +15%', apply: (f) => void (f.vsHigher = 0.15) },
  kopf: { fx: '本场生命低于 30% 时自动回 25%（一次）', apply: (f) => void (f.lowHeal = true) },
  bitte: { fx: '本场听力题多一次免费重听', apply: (f) => void (f.replay = (f.replay ?? 0) + 1) },
};

function heal(s: GameState, pct: number): string {
  const max = maxHp(s);
  const before = s.hp;
  s.hp = Math.min(max, s.hp + Math.round(max * pct));
  return `回了 ${s.hp - before} 点生命`;
}

/** Situation a slang line names. `ctx` is filled by the caller from the fight. */
export interface CharmCtx {
  struct: boolean;
  cursed: boolean;
  pack: boolean;
  red: boolean;
  challenge: boolean;
  elite: boolean;
  /** Berlin hour 0–23. */
  hour: number;
}

export interface SlangDef extends CharmDef {
  fits: (c: CharmCtx) => boolean;
  /** Where it comes from (shown when not owned). */
  source: string;
}

export const SLANG: SlangDef[] = [
  { id: 'bahnhof', kind: 'slang', de: 'Ich verstehe nur Bahnhof.', zh: '我完全听不懂', when: '结构魔', fx: '它的下一次出手推迟 2 回合', source: '流浪商人的俚语卷轴', fits: (c) => c.struct, apply: (f) => void (f.delay = (f.delay ?? 0) + 2) },
  { id: 'wurst', kind: 'slang', de: 'Das ist mir Wurst.', zh: '我无所谓', when: '诅咒怪', fx: '直接破咒', source: 'Konrad 支线最后一环', fits: (c) => c.cursed, apply: () => 'curse' },
  { id: 'bock', kind: 'slang', de: 'Kein Bock!', zh: '没兴趣 / 不想干', when: '群怪战', fx: '本场伤害 +30%', source: '流浪商人的俚语卷轴', fits: (c) => c.pack, apply: (f) => void (f.dmg = (f.dmg ?? 0) + 0.3) },
  { id: 'mirEgal', kind: 'slang', de: 'Mir doch egal!', zh: '关我什么事', when: '红名怪', fx: '本场受到伤害 −25%', source: '流浪商人的俚语卷轴', fits: (c) => c.red, apply: (f) => void (f.taken = (f.taken ?? 0) + 0.25) },
  { id: 'bier', kind: 'slang', de: 'Das ist nicht mein Bier.', zh: '这不关我的事', when: '挑战怪', fx: '本场受到伤害 −20%', source: '流浪商人的俚语卷轴', fits: (c) => c.challenge, apply: (f) => void (f.taken = (f.taken ?? 0) + 0.2) },
  { id: 'daumen', kind: 'slang', de: 'Ich drück dir die Daumen.', zh: '祝你好运（我为你捏把汗）', when: '精英', fx: '这只精英掉铁箱的概率 ×1.5', source: 'Lina 支线最后一环', fits: (c) => c.elite, apply: (f) => void (f.ironChest = 1.5) },
  { id: 'mahlzeit', kind: 'slang', de: 'Mahlzeit!', zh: '午饭时间到了（午间问候）', when: '德国时间 11–14 点', fx: '回 30% 生命', source: '流浪商人的俚语卷轴', fits: (c) => c.hour >= 11 && c.hour < 14, apply: (_f, s) => heal(s, 0.3) },
  { id: 'schwein', kind: 'slang', de: 'Schwein gehabt!', zh: '运气真好', when: '任何怪（不反噬）', fx: '下一只怪掉落翻倍', source: '流浪商人的俚语卷轴', fits: () => true, apply: (_f, s) => void (s.flags.schweinNext = true) },
];

export const CARDS: CharmDef[] = SAYINGS.filter((x) => CARD_FX[x.id]).map((x) => ({
  id: x.id,
  kind: 'card' as const,
  de: `${x.a} ${x.b}`.replace(/\s+/g, ' '),
  zh: x.zh,
  fx: CARD_FX[x.id].fx,
  apply: CARD_FX[x.id].apply,
}));

export const CHARM_BY_ID: Record<string, CharmDef | SlangDef> = Object.fromEntries([...CARDS, ...SLANG].map((c) => [c.id, c]));

export function charmSlots(level: number): number {
  return level < CHARM.from ? 0 : level >= CHARM.twoSlotsFrom ? 2 : 1;
}

export function ownsCharm(s: GameState, id: string): boolean {
  const c = CHARM_BY_ID[id];
  if (!c) return false;
  if (c.kind === 'card') return !!s.sayings?.[id];
  return s.level >= CHARM.slangFrom && !!s.slang?.[id];
}

/** The equipped charms still valid (owned, within the slot count). */
export function equippedCharms(s: GameState): CharmDef[] {
  return (s.charms ?? []).filter((id) => ownsCharm(s, id)).slice(0, charmSlots(s.level)).map((id) => CHARM_BY_ID[id]);
}

/** Toggle a charm in the slots: a full bar drops its oldest. */
export function equipCharm(s: GameState, id: string): void {
  if (!ownsCharm(s, id)) return;
  const cur = (s.charms ?? []).filter((x) => ownsCharm(s, x));
  if (cur.includes(id)) s.charms = cur.filter((x) => x !== id);
  else s.charms = [...cur, id].slice(-charmSlots(s.level));
}

export function grantSlang(s: GameState, id: string): boolean {
  if (!SLANG.some((x) => x.id === id)) return false;
  s.slang ??= {};
  const first = !s.slang[id];
  s.slang[id] = (s.slang[id] ?? 0) + 1;
  return first;
}

/** Slang owed by finished side quests, handed out once the player reaches 50 (Konrad 补发). */
export function slangOwed(s: GameState, questDone: (id: string) => boolean): string[] {
  if (s.level < CHARM.slangFrom) return [];
  const out: string[] = [];
  const owed: Array<[string, string]> = [['konrad', 'wurst'], ['lina', 'daumen']];
  for (const [q, id] of owed) if (questDone(q) && !s.slang?.[id]) out.push(id);
  return out;
}

export function berlinHour(t = Date.now()): number {
  const h = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Berlin', hour: 'numeric', hour12: false }).format(new Date(t));
  return Number(h) % 24;
}

export interface ShoutResult {
  ok: boolean;
  /** Typed right but the slang's situation was wrong. */
  backfire?: boolean;
  /** 'curse' = break the monster's curse now. */
  special?: 'curse';
  text: string;
  /** The shout spent the turn (before 33). */
  turn: boolean;
}

/** Shout a charm: typed `input` against its sentence. Once per fight, right or wrong (暂定). */
export function shoutCharm(s: GameState, fx: { charm?: CharmFx }, id: string, input: string, ctx: CharmCtx): ShoutResult {
  const c = CHARM_BY_ID[id];
  const f = (fx.charm ??= { used: [] });
  const turn = s.level < CHARM.bonusFrom;
  if (!c || f.used.includes(id)) return { ok: false, text: '这句本场已经喊过了。', turn: false };
  f.used.push(id);
  if (normalize(input).replace(/\s+/g, ' ').trim() !== normalize(c.de).replace(/\s+/g, ' ').trim()) return { ok: false, text: `没喊对：「${c.de}」`, turn };
  if (c.kind === 'slang' && !(c as SlangDef).fits(ctx)) {
    f.backfire = true;
    return { ok: true, backfire: true, text: `「${c.de}」用错了场合（${c.when}才管用）：没生效，本场下一次答错伤害 +50%。`, turn };
  }
  const r = c.apply(f, s);
  if (r === 'curse') return { ok: true, special: 'curse', text: `「${c.de}」——咒文碎了。`, turn };
  return { ok: true, text: `「${c.de}」——${r ?? c.fx}。`, turn };
}
