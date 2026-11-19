// Turn-based combat as a reading game: the monster says its next move in German,
// you pick a counter, then answer a question. You act first.

import { CONFIG } from './config';
import { gradeMoechte, gradeTyped, type Verdict } from './grading';
import { COUNTER, ELEMENT_ZH, generateIntent, INTENT_ZH } from './intents';
import { between, pick, shuffle, type Rng } from './rng';
import { kindOf, stageOf, overdueSteps, type Kind, type Stage } from './srs';
import { affixTotal, attack, critChance, hintsPerFight, maxHp, now, type GameState } from './state';
import type { Element, Intent, Move, Word } from './types';
import { has } from './unlocks';
import { fullForm, genderOf, hasArticleQuestion, WORDS } from '../data/words';
import { SKILLS } from '../data/skills';

export type QuestionType = 'article' | 'pickDe' | 'pickZh' | 'typed' | 'sentence' | 'skill';

export interface Question {
  type: QuestionType;
  /** What the player sees as the task, in Chinese. */
  prompt: string;
  /** Big text: the German word or the Chinese meaning, depending on the type. */
  focus: string;
  options?: string[];
  answer?: string;
  /** Typed questions on nouns need the article. */
  withArticle?: boolean;
  skillId?: string;
}

export interface MonsterState {
  lvl: number;
  hp: number;
  maxHp: number;
  dmg: number;
  vulnerable: number;
  burn: number;
  poison: number;
  chilled: boolean;
}

export interface PlayerFx {
  burn: number;
  poison: number;
  chilled: boolean;
  shield: boolean;
}

export type Tutorial = 'loss' | 'block' | 'break' | 'negation' | 'heal' | null;

export interface Battle {
  word: Word;
  kind: Kind;
  stage: Stage;
  /** Intervals overdue when the fight started: fatter monster, bigger reward. */
  overdue: number;
  isEcho: boolean;
  tutorial: Tutorial;
  monster: MonsterState;
  fx: PlayerFx;
  intent: Intent;
  turn: number;
  turnsSinceCharge: number;
  trapUsed: boolean;
  wrongStreak: number;
  slipped: boolean;
  qIndex: number;
  hintsLeft: number;
  firstCorrectDone: boolean;
  lastKillTyped: boolean;
  skillCooldown: number;
  /** Orange 冠词审判: the next hit after a correct article answer deals double. */
  judgement: boolean;
  outcome: null | 'win' | 'lose' | 'fled';
  log: LogLine[];
  recap: string[];
}

export interface LogLine {
  text: string;
  tone: 'sys' | 'good' | 'bad' | 'crit' | 'info';
}

export function monsterStats(level: number, stage: Stage, kind: Kind, overdue: number) {
  const m = CONFIG.monster;
  const stageMult =
    kind === 'shadow' ? m.stageHp.shadow : stage === 0 ? m.stageHp.new : stage === 1 ? m.stageHp.cracked : m.stageHp.half;
  const hp = Math.max(4, Math.round((m.hpBase + m.hpPerLevel * level) * stageMult * (1 + m.overdueHpStep * overdue)));
  const dmg = Math.max(1, Math.round(m.dmgBase + m.dmgPerLevel * level));
  return { hp, dmg };
}

export function startBattle(
  s: GameState,
  word: Word,
  rng: Rng,
  opts: { isEcho?: boolean; tutorial?: Tutorial } = {},
): Battle {
  const t = now(s);
  const kind = kindOf(s, word, t);
  const stage = stageOf(s, word, t);
  // The word holding your echo waits at your level, so you can win it back.
  const lvl = opts.isEcho ? Math.min(word.lvl, s.level) : word.lvl;
  const overdue = overdueSteps(s, word, t);
  const st = monsterStats(lvl, stage, kind, overdue);
  const monster: MonsterState = { lvl, hp: st.hp, maxHp: st.hp, dmg: st.dmg, vulnerable: 0, burn: 0, poison: 0, chilled: false };
  const tutorial = opts.tutorial ?? null;
  if (tutorial === 'loss') {
    monster.lvl = s.level + 6;
    monster.hp = monster.maxHp = 999;
    monster.dmg = Math.ceil(maxHp(s) / 2.5);
  }
  const b: Battle = {
    word,
    kind,
    overdue,
    stage,
    isEcho: !!opts.isEcho,
    tutorial,
    monster,
    fx: { burn: 0, poison: 0, chilled: false, shield: false },
    intent: null as unknown as Intent,
    turn: 1,
    turnsSinceCharge: 0,
    trapUsed: false,
    wrongStreak: 0,
    slipped: false,
    qIndex: 0,
    hintsLeft: hintsPerFight(s),
    firstCorrectDone: false,
    lastKillTyped: false,
    skillCooldown: 0,
    judgement: false,
    outcome: null,
    log: [],
    recap: [],
  };
  b.intent = nextIntent(s, b, rng);
  return b;
}

function nextIntent(s: GameState, b: Battle, rng: Rng): Intent {
  const tut = b.tutorial;
  const ctx = {
    level: s.level,
    family: b.word.family,
    hpRatio: b.monster.hp / b.monster.maxHp,
    turnsSinceCharge: b.turnsSinceCharge,
    trapUsed: b.trapUsed,
  };
  let intent: Intent;
  if (tut === 'loss') {
    intent = generateIntent(rng, { ...ctx, force: { kind: 'attack', hits: 3, line: 'Ich beiße dreimal!', zh: '我咬三下！', layers: ['count'] } });
  } else if (tut === 'block' && b.turn <= 2) {
    intent = generateIntent(rng, { ...ctx, force: { kind: 'attack', line: 'Ich greife an!', zh: '我要进攻！' } });
  } else if (tut === 'break' && b.turn <= 2) {
    intent = generateIntent(rng, { ...ctx, force: { kind: 'defend', line: 'Ich verteidige mich.', zh: '我要防守。' } });
  } else if (tut === 'negation' && b.turn === 1) {
    intent = generateIntent(rng, {
      ...ctx,
      force: { kind: 'wait', shown: 'attack', hits: 0, line: 'Ich greife jetzt nicht an.', zh: '我现在不进攻。（这回合不攻击）', layers: ['negation'] },
    });
  } else if (tut === 'heal' && ctx.hpRatio <= 0.5 && !b.trapUsed) {
    intent = generateIntent(rng, { ...ctx, force: { kind: 'heal', line: 'Ich mache eine Pause.', zh: '我休息一下。（要回血）' } });
  } else if (b.monster.chilled && b.intent?.kind === 'charge') {
    // Ice pushed the charge back: it is still charging.
    intent = { ...b.intent, line: 'Moment … noch nicht …', zh: '等等……还没好……（冰把蓄力往后推了）' };
  } else {
    intent = generateIntent(rng, ctx);
  }
  if (intent.layers.includes('negation') || (tut === 'heal' && intent.kind === 'heal')) b.trapUsed = true;
  if (intent.kind === 'charge') b.turnsSinceCharge = 0;
  else b.turnsSinceCharge += 1;
  return intent;
}

// ---- Questions -------------------------------------------------------------

function distractors(rng: Rng, w: Word, field: 'de' | 'zh', n: number): string[] {
  const samePos = WORDS.filter((x) => x.id !== w.id && x.pos === w.pos && x[field] !== w[field]);
  const pool = samePos.length >= n ? samePos : WORDS.filter((x) => x.id !== w.id);
  const out: string[] = [];
  for (const x of shuffle(rng, pool)) {
    const v = field === 'de' ? x.de : x.zh;
    if (!out.includes(v) && v !== (field === 'de' ? w.de : w.zh)) out.push(v);
    if (out.length >= n) break;
  }
  return out;
}

export function availableMoves(s: GameState, b: Battle): Move[] {
  const moves: Move[] = ['attack'];
  if (has(s.level, 'blockBreak')) moves.push('block', 'break');
  if (has(s.level, 'sentence')) moves.push('sentence');
  if (has(s.level, 'skills') && s.skills.length) moves.push('skill');
  if (b.tutorial === 'loss') return ['attack'];
  return moves;
}

export function makeQuestion(s: GameState, b: Battle, move: Move, rng: Rng, skillId?: string): Question {
  const w = b.word;
  const isNoun = hasArticleQuestion(w);
  const canType = has(s.level, 'typing');
  const promptZh = w.digit ? w.digit : w.zh;

  if (move === 'sentence') {
    return { type: 'sentence', prompt: '句式攻击：Ich möchte + einen / eine / ein + 你见过的名词', focus: 'Ich möchte …' };
  }
  if (move === 'skill') {
    const sk = SKILLS[skillId ?? s.skills[0]];
    return { type: 'skill', prompt: `释放「${sk.zh}」：写对整句`, focus: sk.zhLine, answer: sk.de, skillId: sk.id };
  }
  const article = (): Question => ({
    type: 'article',
    prompt: '选对冠词',
    focus: w.de,
    options: ['der', 'die', 'das'],
    answer: w.art!,
  });
  const pickDe = (): Question => {
    const opts = shuffle(rng, [w.de, ...distractors(rng, w, 'de', 2)]);
    return { type: 'pickDe', prompt: '选出对应的德语', focus: promptZh, options: opts, answer: w.de };
  };
  const pickZh = (): Question => {
    const opts = shuffle(rng, [w.zh, ...distractors(rng, w, 'zh', 2)]);
    return { type: 'pickZh', prompt: '它在说什么？选出意思', focus: fullForm(w), options: opts, answer: w.zh };
  };
  const typed = (): Question => ({
    type: 'typed',
    prompt: isNoun ? '默写：带上冠词（der / die / das）' : '默写这个词',
    focus: promptZh,
    withArticle: isNoun,
    answer: fullForm(w),
  });

  if (move === 'break') return canType ? typed() : isNoun ? article() : pickDe();
  if (move === 'block') return isNoun && rng() < 0.5 ? article() : pickDe();

  // Normal attack.
  if (b.tutorial === 'loss') return isNoun ? article() : pickZh();
  if (b.stage === 0) return isNoun ? article() : pickZh();
  if (!canType) return isNoun ? article() : pickDe();
  // 半名 and due: the killing blow must be typed, so offer typing.
  if (b.stage === 2 && b.kind === 'due') return typed();
  const cycle: Array<() => Question> = isNoun ? [article, typed, pickDe] : [pickDe, typed];
  const q = cycle[b.qIndex % cycle.length]();
  return q;
}

export function knownMoechteNouns(s: GameState): Word[] {
  return WORDS.filter((w) => w.moechte && s.words[w.id]);
}

export function gradeQuestion(s: GameState, b: Battle, q: Question, input: string): Verdict & { word?: Word } {
  switch (q.type) {
    case 'article':
    case 'pickDe':
    case 'pickZh': {
      const ok = input === q.answer;
      return { ok, notes: ok ? [] : [`正确答案：${q.type === 'article' ? fullForm(b.word) : q.answer}`], correct: q.answer! };
    }
    case 'typed':
      return gradeTyped(input, b.word, !!q.withArticle);
    case 'sentence':
      return gradeMoechte(input, knownMoechteNouns(s));
    case 'skill': {
      const sk = SKILLS[q.skillId!];
      const fake: Word = { id: sk.id, de: sk.de, zh: sk.zh, pos: 'phr', family: 'echo', lvl: 1, zone: 'camp' };
      return gradeTyped(input, fake, false);
    }
  }
}

// ---- Resolution --------------------------------------------------------------

export interface TurnReport {
  correct: boolean;
  verdict: Verdict;
  playerDamage: number;
  crit: boolean;
  newSpell: boolean;
  monsterDamage: number;
  parried: boolean;
  element: Element | null;
  log: LogLine[];
  outcome: Battle['outcome'];
  readRight: boolean;
}

function comboMult(combo: number): number {
  for (const tier of CONFIG.combo) if (combo >= tier.at) return 1 + tier.dmg;
  return 1;
}

export function comboTier(combo: number): string | null {
  for (const tier of CONFIG.combo) if (combo >= tier.at) return tier.name;
  return null;
}

const ELEMENT_BY_GENDER: Record<'m' | 'f' | 'n' | 'pl', Element> = { m: 'ice', f: 'fire', n: 'poison', pl: 'lightning' };

export function resolveTurn(
  s: GameState,
  b: Battle,
  move: Move,
  q: Question,
  input: string,
  rng: Rng,
): TurnReport {
  const log: LogLine[] = [];
  const verdict = gradeQuestion(s, b, q, input);
  const m = b.monster;
  const intent = b.intent;
  const ok = verdict.ok;
  const typedQ = q.type === 'typed' || q.type === 'sentence';
  let playerDamage = 0;
  let crit = false;
  let newSpell = false;
  let element: Element | null = null;
  const readRight = ok && COUNTER[intent.kind] === (move === 'sentence' ? 'attack' : move);
  let blocking = false;
  let interrupted = false;
  b.qIndex += 1;

  // --- 1. You act first.
  if (ok) {
    b.wrongStreak = 0;
    s.combo += 1;
    if (readRight && move !== 'skill') s.combo += 1; // 读对意图并出对克制招式，连击额外 +1
    s.bestCombo = Math.max(s.bestCombo, s.combo);

    if (move === 'skill') {
      const sk = SKILLS[q.skillId!];
      b.skillCooldown = sk.cooldown;
      s.skillUses[sk.id] = (s.skillUses[sk.id] ?? 0) + 1;
      if (sk.id === 'keineAhnung') {
        b.fx.shield = true;
        log.push({ text: `「${sk.de}」——言灵护盾挡在你身前。`, tone: 'good' });
      } else if (sk.id === 'wieBitte') {
        interrupted = true;
        log.push({ text: `「${sk.de}」——它愣住了，这回合的打算作废。`, tone: 'good' });
      } else if (sk.id === 'freutMich') {
        const heal = Math.round(maxHp(s) * 0.3);
        s.hp = Math.min(maxHp(s), s.hp + heal);
        log.push({ text: `「${sk.de}」——你回复了 ${heal} 点生命。`, tone: 'good' });
      }
    } else if (move === 'block') {
      blocking = true;
      log.push({ text: '你摆好架势，准备格挡。', tone: 'info' });
    } else {
      const atk = attack(s);
      let mult = between(rng, CONFIG.damage.roll[0], CONFIG.damage.roll[1]);
      if (q.type === 'typed') mult *= CONFIG.damage.typed * (1 + affixTotal(s, 'typedDmg'));
      else if (q.type === 'sentence') {
        const noun = verdict.word!;
        const recent = s.recentNouns.slice(-5).filter((id) => id === noun.id).length;
        mult *= CONFIG.damage.sentence * CONFIG.damage.freshness[Math.min(recent, 3)] * (1 + affixTotal(s, 'sentenceDmg'));
        s.recentNouns.push(noun.id);
        if (s.recentNouns.length > 10) s.recentNouns.shift();
        if (has(s.level, 'layerElement')) element = ELEMENT_BY_GENDER[genderOf(noun) ?? 'n'];
        if (recent > 0) log.push({ text: `${noun.de} 用得太勤，威力只剩 ${Math.round(CONFIG.damage.freshness[Math.min(recent, 3)] * 100)}%。换个名词试试。`, tone: 'info' });
      } else mult *= CONFIG.damage.choice;

      if (move === 'break') mult *= CONFIG.damage.breakMult;
      const g = genderOf(b.word);
      if (g === 'm') mult *= 1 + affixTotal(s, 'vsMasc');
      if (g === 'f') mult *= 1 + affixTotal(s, 'vsFem');
      if (g === 'n') mult *= 1 + affixTotal(s, 'vsNeut');
      mult *= comboMult(s.combo);

      // Crits: forced ones first (初识暴击), then the random roll.
      if (b.stage === 0 && b.kind === 'new' && !b.firstCorrectDone) {
        crit = true;
        newSpell = true;
      } else if ((s.flags.wortgewalt as number) > 0) {
        crit = true;
      } else {
        const chance = critChance(s) + (q.type === 'article' || q.type === 'pickDe' || q.type === 'pickZh' ? affixTotal(s, 'choiceCrit') : 0);
        crit = rng() < chance;
      }
      b.firstCorrectDone = true;
      if (crit) mult *= CONFIG.player.critMult;
      if (m.vulnerable > 0) mult *= CONFIG.damage.vulnerable;
      const judged = b.judgement;
      if (judged) {
        mult *= 2;
        b.judgement = false;
      }
      if (q.type === 'article' && Object.values(s.equipped).some((it) => it?.legendary === 'articleJudgement')) b.judgement = true;

      const charging = intent.kind === 'charge';
      if (intent.kind === 'defend' && (move === 'attack' || move === 'sentence')) mult *= CONFIG.damage.vsDefend;
      if (move === 'break' && charging) mult = 0; // 破防对蓄力无效
      mult = Math.min(mult, CONFIG.damage.maxMultiplierOfBase);
      playerDamage = Math.max(move === 'break' && charging ? 0 : 1, Math.round(atk * mult));
      if (b.tutorial === 'loss') playerDamage = Math.min(playerDamage, 3);

      m.hp -= playerDamage;
      s.stats.maxHit = Math.max(s.stats.maxHit, playerDamage);
      if (crit) s.stats.crits += 1;
      if (charging && move !== 'break') interrupted = true;
      if (move === 'break' && intent.kind === 'defend') {
        m.vulnerable = CONFIG.status.vulnerableTurns + 1;
        log.push({ text: '护甲被你撬开了！接下来 2 回合它受到的伤害 +50%。', tone: 'good' });
      }
      if (element === 'ice') m.chilled = true;
      if (element === 'fire') m.burn = CONFIG.status.burnTurns;
      if (element === 'poison') m.poison = Math.min(CONFIG.status.poisonMaxStacks, m.poison + 1);

      const tag = (judged ? '冠词审判！' : '') + (crit ? (newSpell ? '新言灵！暴击 ' : '暴击 ') : '');
      const el = element ? `（${ELEMENT_ZH[element]}）` : '';
      log.push({ text: `${tag}你造成 ${playerDamage} 点伤害${el}。`, tone: crit ? 'crit' : 'good' });
      if (move === 'break' && charging) log.push({ text: '破防对蓄力没用：它根本没在防守。', tone: 'bad' });
      if (intent.kind === 'defend' && (move === 'attack' || move === 'sentence'))
        log.push({ text: '它在防御，伤害只剩三成。读到防御时用破防更好。', tone: 'info' });
    }

    if (m.hp <= 0) {
      m.hp = 0;
      b.outcome = 'win';
      b.lastKillTyped = typedQ && (q.type === 'sentence' ? verdict.word?.id === b.word.id : true);
      if (q.type === 'typed' && !q.withArticle && hasArticleQuestion(b.word)) b.lastKillTyped = false;
      log.push({ text: '它被打散了——你先出手，它的打算作废。', tone: 'sys' });
      return finish(s, b, { correct: true, verdict, playerDamage, crit, newSpell, monsterDamage: 0, parried: false, element, log, outcome: 'win', readRight });
    }
  } else {
    s.combo = 0;
    b.wrongStreak += 1;
    if (b.stage === 2 && !b.slipped && b.kind === 'due') {
      b.slipped = true;
      log.push({ text: '答错了，它长回一颗牙（退回裂形）。', tone: 'bad' });
    }
    log.push({ text: '招式失败：这一回合什么都没做成。', tone: 'bad' });
  }

  // --- 2. The monster acts.
  let monsterDamage = 0;
  let parried = false;
  const monsterCrit = b.wrongStreak >= 2;
  const wrongReduce = ok ? 0 : affixTotal(s, 'wrongDmgReduce');
  const chillMult = m.chilled ? CONFIG.status.iceDamageMult : 1;

  const hitPlayer = (raw: number) => {
    let d = Math.max(1, Math.round(raw * (1 - wrongReduce)));
    if (b.fx.shield) {
      b.fx.shield = false;
      const back = Math.max(1, Math.round(d * 0.5));
      m.hp = Math.max(0, m.hp - back);
      log.push({ text: `护盾挡下这一击，反弹 ${back} 点伤害。`, tone: 'good' });
      d = 0;
    }
    monsterDamage += d;
    s.hp -= d;
  };

  if (interrupted && intent.kind === 'charge') {
    log.push({ text: '你打断了它的蓄力！', tone: 'good' });
  } else if (interrupted) {
    /* 「Wie bitte?」cancelled the intent */
  } else {
    switch (intent.kind) {
      case 'attack': {
        let per = m.dmg * chillMult * (monsterCrit ? 1.5 : 1);
        for (let i = 0; i < intent.hits; i++) {
          if (i === 0 && blocking) {
            parried = true;
            const counter = Math.max(1, Math.round(attack(s) * CONFIG.player.critMult));
            m.hp = Math.max(0, m.hp - counter);
            log.push({ text: `弹反！挡住第一下并反击 ${counter} 点（算一次暴击）。`, tone: 'crit' });
            continue;
          }
          hitPlayer(per);
        }
        if (monsterDamage > 0) {
          const hitsTxt = intent.hits > 1 ? `${intent.hits} 下` : '';
          const el = intent.element !== 'phys' ? `（${ELEMENT_ZH[intent.element]}）` : '';
          log.push({ text: `${monsterCrit ? '它看准你的破绽，暴击！' : ''}它${hitsTxt}打中你，共 ${monsterDamage} 点${el}。`, tone: 'bad' });
          if (intent.element === 'ice') b.fx.chilled = true;
          if (intent.element === 'fire') b.fx.burn = CONFIG.status.burnTurns;
          if (intent.element === 'poison') b.fx.poison = Math.min(CONFIG.status.poisonMaxStacks, b.fx.poison + 1);
        }
        if (blocking && intent.hits > 1) log.push({ text: '格挡只挡得住第一下。', tone: 'info' });
        per = 0;
        break;
      }
      case 'defend':
        if (blocking) log.push({ text: '它在防御，你的格挡白白浪费了一回合。', tone: 'info' });
        else log.push({ text: '它缩起来防守。', tone: 'info' });
        break;
      case 'charge': {
        if (m.chilled) {
          log.push({ text: '冰冻拖住了它，大招推迟了。', tone: 'good' });
          break;
        }
        const heavy = m.dmg * CONFIG.monster.chargeMult * (monsterCrit ? 1.5 : 1);
        if (blocking) {
          hitPlayer(heavy / 2);
          log.push({ text: `你挡下一半大招，受到 ${monsterDamage} 点伤害。`, tone: 'bad' });
        } else {
          hitPlayer(heavy);
          log.push({ text: `蓄满的大招砸中你：${monsterDamage} 点！`, tone: 'bad' });
        }
        break;
      }
      case 'heal': {
        const heal = Math.round(m.maxHp * 0.35);
        m.hp = Math.min(m.maxHp, m.hp + heal);
        log.push({ text: `它回复了 ${heal} 点生命。${m.vulnerable > 0 ? '易伤还在。' : ''}`, tone: 'bad' });
        break;
      }
      case 'wait':
        log.push({ text: blocking ? '它根本没出手——nicht 的意思是「不」。格挡白费了。' : '它说了不打，就真的没打。', tone: 'info' });
        break;
    }
  }

  // Misreads for the post-fight recap.
  if (ok && move === 'block' && intent.kind === 'wait')
    b.recap.push(`第 ${b.turn} 回合：它说「${intent.line}」，有 nicht，其实不打。直接攻击更好。`);
  if (move === 'block' && intent.kind === 'attack' && intent.hits > 1 && ok)
    b.recap.push(`第 ${b.turn} 回合：「${intent.line}」是连击，格挡只挡第一下。`);
  if (move === 'break' && intent.kind === 'charge')
    b.recap.push(`第 ${b.turn} 回合：「${intent.line}」是蓄力，攻击才能打断，破防无效。`);
  if ((move === 'attack' || move === 'sentence') && intent.kind === 'defend' && has(s.level, 'blockBreak'))
    b.recap.push(`第 ${b.turn} 回合：「${intent.line}」是防御，破防更好。`);

  // --- 3. Damage over time and status ticks.
  if (m.burn > 0) {
    const d = Math.max(1, Math.round(attack(s) * CONFIG.status.burnPctOfAtk));
    m.hp = Math.max(0, m.hp - d);
    m.burn -= 1;
    log.push({ text: `灼烧：它掉了 ${d} 点。`, tone: 'good' });
  }
  if (m.poison > 0) {
    const d = Math.max(1, Math.round(attack(s) * CONFIG.status.poisonPerStackPctOfAtk * m.poison));
    m.hp = Math.max(0, m.hp - d);
    log.push({ text: `中毒（${m.poison} 层）：它掉了 ${d} 点。`, tone: 'good' });
  }
  if (b.fx.burn > 0) {
    const d = Math.max(1, Math.round(m.dmg * 0.4));
    s.hp -= d;
    b.fx.burn -= 1;
    log.push({ text: `你被灼烧，掉了 ${d} 点。`, tone: 'bad' });
  }
  if (b.fx.poison > 0) {
    const d = Math.max(1, Math.round(m.dmg * 0.15 * b.fx.poison));
    s.hp -= d;
    log.push({ text: `你中毒了（${b.fx.poison} 层），掉了 ${d} 点。`, tone: 'bad' });
  }
  if (m.vulnerable > 0) m.vulnerable -= 1;
  if (move !== 'sentence' || element !== 'ice') m.chilled = false;
  if (b.skillCooldown > 0) b.skillCooldown -= 1;
  if ((s.flags.wortgewalt as number) > 0) s.flags.wortgewalt = (s.flags.wortgewalt as number) - 1;
  if (s.combo >= 50 && !s.flags.wortgewaltUsedAt50) {
    s.flags.wortgewalt = 3;
    s.flags.wortgewaltUsedAt50 = true;
  }
  if (s.combo < 50) s.flags.wortgewaltUsedAt50 = false;

  if (m.hp <= 0) {
    b.outcome = 'win';
    b.lastKillTyped = false;
    log.push({ text: '它被打散了。', tone: 'sys' });
  } else if (s.hp <= 0) {
    s.hp = 0;
    b.outcome = 'lose';
    log.push({ text: '你倒下了……', tone: 'bad' });
  } else {
    b.turn += 1;
    b.intent = nextIntent(s, b, rng);
  }
  return finish(s, b, { correct: ok, verdict, playerDamage, crit, newSpell, monsterDamage, parried, element, log, outcome: b.outcome, readRight });
}

function finish(_s: GameState, b: Battle, r: TurnReport): TurnReport {
  b.log.push(...r.log);
  return r;
}

export function intentLabel(i: Intent): string {
  return INTENT_ZH[i.shown];
}

export function pickHint(b: Battle, q: Question): string | null {
  if (!q.answer || b.hintsLeft <= 0) return null;
  b.hintsLeft -= 1;
  const a = q.answer;
  if (q.withArticle && b.word.art) return `${b.word.art} ${b.word.de[0]}…`;
  return `${a[0]}…`;
}

export function randomFrom<T>(rng: Rng, arr: T[]): T {
  return pick(rng, arr);
}
