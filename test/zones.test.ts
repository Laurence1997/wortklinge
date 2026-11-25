// 0.7 + 0.8 · regions 4–12: data checks for the generated scenes, stand-in words, bosses, skills and trial gates.
import { describe, expect, it } from 'vitest';
import { newGame, addXp } from '../src/core/state';
import { makeRng } from '../src/core/rng';
import { normalize } from '../src/core/grading';
import { answerBoss, startBoss } from '../src/core/boss';
import { levelCapFor, trialDue } from '../src/core/stages';
import { startExam, examParts } from '../src/core/breakthrough';
import { EXAMPLES } from '../src/core/cloze';
import { UNLOCK } from '../src/core/unlocks';
import { WORDS, WORD_BY_ID, LATER_SCENE_WORDS } from '../src/data/words';
import { SCENES, SCENE_BY_ID, routeTo } from '../src/data/world';
import { REGION_DEFS, fieldLevels } from '../src/data/zones';
import { LATER_BOSSES, laterBossXp } from '../src/data/bossesLater';
import { SKILLS } from '../src/data/skills';
import { generateMap, isBlocked, zonesOf } from '../src/game/map';

describe('0.7/0.8 区域数据', () => {
  it('every region 4–12 has a town, 3 fields × 8 scenes with words in the field band, a door and a hidden path', () => {
    for (const d of REGION_DEFS) {
      const ss = SCENES.filter((s) => s.region === d.region);
      const fields = ss.filter((s) => s.type === 'field');
      expect(fields.length, `r${d.region}`).toBe(24);
      expect(ss.some((s) => s.type === 'door')).toBe(true);
      const hide = ss.find((s) => s.type === 'hidden')!;
      expect(WORD_BY_ID[hide.hiddenBy!], `r${d.region} hidden sign`).toBeTruthy();
      expect(zonesOf(d.region).filter((z) => z.monsters).length).toBe(3);
      fields.forEach((sc) => {
        expect(sc.words!.length, sc.id).toBeGreaterThan(0);
        expect(sc.words).toEqual(LATER_SCENE_WORDS[sc.id]);
        const fi = 'abc'.indexOf(sc.id.split('-')[1][0]) as 0 | 1 | 2;
        const [lo, hi] = fieldLevels(d.region, fi);
        for (const id of sc.words!) {
          const w = WORD_BY_ID[id];
          expect(w.region).toBe(d.region);
          expect(w.zone).toBe(sc.zone);
          expect(w.lvl).toBeGreaterThanOrEqual(lo);
          expect(w.lvl).toBeLessThanOrEqual(hi);
        }
      });
    }
  });

  it('stand-in words copy a region 1–3 noun and share its example sentences; word ids stay unique', () => {
    const ph = WORDS.filter((w) => w.base);
    expect(ph.length).toBeGreaterThan(2000);
    for (const w of ph) {
      expect(WORD_BY_ID[w.base!]?.region ?? 0).toBeLessThanOrEqual(3);
      if (EXAMPLES[w.base!]) expect(EXAMPLES[w.id]).toBe(EXAMPLES[w.base!]);
    }
    expect(new Set(WORDS.map((w) => w.id)).size).toBe(WORDS.length);
  });

  it('each region chains to the next: gate back from the town, road on after the boss', () => {
    for (let r = 3; r <= 11; r++) {
      const on = SCENES.find((s) => s.region === r && s.gate === r + 1)!;
      expect(on, `r${r} onward`).toBeTruthy();
      expect(on.openFlag).toBe(`boss${r}Kills`);
    }
    for (const d of REGION_DEFS) expect(SCENE_BY_ID[`r${d.region}-hub`].gate).toBe(d.region - 1);
    expect(routeTo('r4-hub', 'r4-door')).not.toBeNull();
  });

  it('the street maps are generated and every scene stands on open ground', () => {
    for (const d of REGION_DEFS) {
      const m = generateMap(d.region);
      expect(m.region).toBe(d.region);
      for (const sc of SCENES.filter((s) => s.region === d.region)) expect(isBlocked(m, sc.at.x, sc.at.y), sc.id).toBe(false);
    }
  });
});

describe('0.7/0.8 首领', () => {
  it('unlock at 10N − 2 and pay about 30% of a level', () => {
    for (const b of LATER_BOSSES) {
      expect(UNLOCK[`boss${b.region}` as keyof typeof UNLOCK]).toBe(b.level);
      expect(b.level).toBe(b.region * 10 - 2);
    }
    expect(laterBossXp(38)).toBeGreaterThan(1000);
  });

  it('every question accepts its own model answer, over many draws', () => {
    for (const b of LATER_BOSSES)
      for (let seed = 1; seed <= 40; seed++)
        for (const q of b.questions(makeRng(seed))) {
          const model = normalize(q.model.replace('{name}', 'Lucas').split(' / ')[0]);
          expect(q.accept.some((re) => re.test(model)), `${b.name} ${q.id}: «${model}»`).toBe(true);
          expect(q.ask.length).toBeGreaterThan(0);
        }
  });

  it('a fight can be won with model answers and refills its queue', () => {
    for (const b of LATER_BOSSES) {
      const s = newGame('Lucas', 'student');
      s.level = b.level;
      const rng = makeRng(7);
      const f = startBoss(s, rng, 7, undefined, b.region);
      expect(f.hp).toBe(b.hp);
      let turns = 0;
      while (!f.outcome && turns++ < 40) answerBoss(s, f, f.current.model.replace('{name}', 'Lucas').split(' / ')[0], rng);
      expect(f.outcome, b.name).toBe('win');
    }
  });

  it('three sentence skills per boss, each reusing an existing effect', () => {
    for (const b of LATER_BOSSES) {
      const ks = Object.values(SKILLS).filter((k) => k.boss === 100 + b.region);
      expect(ks.length, b.name).toBe(3);
      for (const k of ks) expect(SKILLS[k.as!]?.boss).toBeLessThanOrEqual(4);
    }
  });
});

describe('0.7/0.8 突破试炼', () => {
  it('cap 30 → 80 → 120 and the trial due at each cap', () => {
    const f: Record<string, unknown> = {};
    expect(levelCapFor(f)).toBe(30);
    expect(trialDue(30, f)).toBe('A1');
    f.a1Passed = f.a1Grammar = true;
    expect(levelCapFor(f)).toBe(80);
    expect(trialDue(79, f)).toBe(null);
    expect(trialDue(80, f)).toBe('A2');
    f.a2Passed = true;
    expect(levelCapFor(f)).toBe(120);
    expect(trialDue(120, f)).toBe('B1');
    f.b1Passed = true;
    expect(trialDue(120, f)).toBe(null);
  });

  it('XP saved at the cap counts once the trial is passed', () => {
    const s = newGame('T', 'student');
    addXp(s, 1_000_000);
    expect(s.level).toBe(30);
    s.flags.a1Passed = s.flags.a1Grammar = true;
    const r = addXp(s, 0);
    expect(r.levels).toEqual([31]);
  });

  it('A2 and B1 trials ask four parts from their own regions', () => {
    for (const [stage, lo, hi] of [['A2', 4, 8], ['B1', 9, 12]] as const) {
      const s = newGame('T', 'student');
      const e = startExam(s, makeRng(3), stage);
      expect(e.stage).toBe(stage);
      for (const p of examParts(e)) expect(e.qs.filter((q) => q.part === p).length, `${stage} ${p}`).toBeGreaterThanOrEqual(5);
      for (const q of e.qs.filter((x) => x.part !== 'grammar')) {
        expect(q.word.region).toBeGreaterThanOrEqual(lo);
        expect(q.word.region).toBeLessThanOrEqual(hi);
      }
    }
  });
});
