// 0.7 + 0.8 · regions 4–12 (游戏设计 rev 341: 8 and 11 are 蚀变 on old maps): generated scenes, stand-in words,
// 蚀变 layers, two-batch scenes, bosses, skills and trial gates.
import { describe, expect, it } from 'vitest';
import { newGame, addXp } from '../src/core/state';
import { makeRng } from '../src/core/rng';
import { normalize } from '../src/core/grading';
import { answerBoss, startBoss } from '../src/core/boss';
import { levelCapFor, trialDue } from '../src/core/stages';
import { startExam, examParts } from '../src/core/breakthrough';
import { UNLOCK } from '../src/core/unlocks';
import { WORDS, WORD_BY_ID, SCENE_WORDS, ERODED_SCENE_WORDS } from '../src/data/words';
import { SCENES, SCENE_BY_ID, routeTo } from '../src/data/world';
import { ERODE_DEFS, REGION_DEFS, fieldLevels, fieldScenes, regionLevels } from '../src/data/zones';
import { laterReady, purified } from '../src/core/erosion';
import { eligible } from '../src/core/spawn';
import { LATER_BOSSES, laterBossXp } from '../src/data/bossesLater';
import { generateMap, isBlocked, zonesOf } from '../src/game/map';

describe('0.7/0.8 区域数据', () => {
  it('the seven new regions have a town, 3 fields of scenes with words in the field band, a door and a hidden path', () => {
    expect(REGION_DEFS.map((d) => d.region)).toEqual([4, 5, 6, 7, 9, 10, 12]);
    for (const r of [1, 2, 3, ...REGION_DEFS.map((d) => d.region)]) {
      const ss = SCENES.filter((s) => s.region === r);
      const fields = ss.filter((s) => s.type === 'field');
      const nf = r <= 3 ? 5 : 3;
      expect(fieldScenes(r).length, `r${r}`).toBe(nf);
      for (const f of fieldScenes(r)) expect(f.length, `r${r}`).toBeGreaterThanOrEqual(4);
      expect(fields.length, `r${r}`).toBe(fieldScenes(r).flat().length);
      expect(ss.some((s) => s.type === 'door')).toBe(true);
      const hide = ss.find((s) => s.type === 'hidden')!;
      expect(WORD_BY_ID[hide.hiddenBy!], `r${r} hidden sign`).toBeTruthy();
      expect(zonesOf(r as never).filter((z) => z.monsters).length).toBe(nf);
      fields.forEach((sc) => {
        expect(sc.words!.length, sc.id).toBeGreaterThan(0);
        expect(sc.words).toEqual(SCENE_WORDS[sc.id]);
        const fi = 'abcde'.indexOf(sc.id.split('-')[1][0]);
        const [lo, hi] = fieldLevels(r, fi);
        for (const id of sc.words!) {
          const w = WORD_BY_ID[id];
          expect(w.region).toBe(r);
          expect(w.zone).toBe(sc.zone);
          expect(w.lvl, id).toBeGreaterThanOrEqual(lo - 1);
          expect(w.lvl, id).toBeLessThanOrEqual(hi + 1);
        }
      });
    }
  });

  it('every word comes from the 6000-word list (no stand-ins left); word ids stay unique', () => {
    expect(WORDS.filter((w) => w.base)).toEqual([]);
    expect(WORDS.length).toBeGreaterThan(5800);
    expect(new Set(WORDS.map((w) => w.id)).size).toBe(WORDS.length);
  });

  it('each region chains to the next; 7 → 9 and 10 → 12 open with the 蚀变 boss in between', () => {
    const want: Array<[number, number, string]> = [[3, 4, 'boss3Kills'], [4, 5, 'boss4Kills'], [5, 6, 'boss5Kills'], [6, 7, 'boss6Kills'], [7, 9, 'boss8Kills'], [9, 10, 'boss9Kills'], [10, 12, 'boss11Kills']];
    for (const [r, to, flag] of want) {
      const on = SCENES.find((s) => s.region === r && s.gate === to)!;
      expect(on, `r${r} onward`).toBeTruthy();
      expect(on.openFlag).toBe(flag);
    }
    expect(SCENES.some((s) => s.region === 12 && s.openFlag)).toBe(false);
    const back: Record<number, number> = { 4: 3, 5: 4, 6: 5, 7: 6, 9: 7, 10: 9, 12: 10 };
    for (const d of REGION_DEFS) expect(SCENE_BY_ID[`r${d.region}-hub`].gate).toBe(back[d.region]);
    expect(routeTo('r4-hub', 'r4-door')).not.toBeNull();
    for (const d of REGION_DEFS) for (const sc of SCENES.filter((s) => s.region === d.region)) expect(routeTo(`r${d.region}-hub`, sc.id), sc.id).not.toBeNull();
  });

  it('the street maps are generated and every scene stands on open ground', () => {
    for (const d of REGION_DEFS) {
      const m = generateMap(d.region);
      expect(m.region).toBe(d.region);
      for (const sc of SCENES.filter((s) => s.region === d.region)) expect(isBlocked(m, sc.at.x, sc.at.y), sc.id).toBe(false);
    }
  });
});

describe('0.7/0.8 蚀变和两批开', () => {
  it('蚀变① hangs on about half of the region 1–3 scenes, 蚀变② on regions 1–7; words stand at the segment level', () => {
    const [e8, e11] = ERODE_DEFS;
    const early = SCENES.filter((sc) => sc.type === 'field' && sc.region <= 3).length;
    expect(e8.scenes.length).toBeGreaterThanOrEqual(early * 0.4);
    expect(e8.scenes.length).toBeLessThanOrEqual(early * 0.7);
    expect(new Set(e8.scenes.map((x) => SCENE_BY_ID[x.scene].region))).toEqual(new Set([1, 2, 3]));
    for (const x of e11.scenes) expect(SCENE_BY_ID[x.scene].region).toBeLessThanOrEqual(7);
    const hosts = [...e8.scenes, ...e11.scenes].map((x) => x.scene);
    expect(new Set(hosts).size).toBe(hosts.length);
    for (const e of ERODE_DEFS) {
      const [lo, hi] = regionLevels(e.seg);
      for (const x of e.scenes) {
        const sc = SCENE_BY_ID[x.scene];
        expect(sc.type, x.scene).toBe('field');
        expect(sc.zone).toBe(x.zone);
        expect(sc.erodeSeg).toBe(e.seg);
        expect(sc.eroded).toEqual(ERODED_SCENE_WORDS[x.scene]);
        for (const id of sc.eroded!) {
          const w = WORD_BY_ID[id];
          expect(w.erode).toBe(e.seg);
          expect(w.region).toBe(e.seg);
          expect(w.lvl).toBeGreaterThanOrEqual(lo);
          expect(w.lvl).toBeLessThanOrEqual(hi);
          if (w.after) expect(WORD_BY_ID[w.after], `${id} after`).toBeTruthy();
        }
      }
    }
    // 近义词梯子: ladder words wait for their base word (reservieren → buchen).
    expect(WORDS.filter((w) => w.erode && w.after).length).toBeGreaterThan(100);
  });

  it('a 蚀变 word waits for its boss and its base word; the second batch for half the group', () => {
    const s = newGame('T', 'student');
    s.level = 75;
    const w = WORDS.find((x) => x.erode === 8 && x.after)!;
    const host = w.scene!;
    expect(laterReady(s, w)).toBe(false);
    s.flags.boss7Kills = 1;
    expect(laterReady(s, w)).toBe(w.batch === 2 ? false : false); // base never written
    s.words[w.after!] = { stage: 1, due: 0, write: 1 } as never;
    const group = SCENE_BY_ID[host].eroded!;
    if (w.batch === 2) for (const g of group.slice(0, Math.ceil(group.length / 2))) if (g !== w.id) s.words[g] = { stage: 2, due: 0 } as never;
    expect(laterReady(s, w)).toBe(true);
    expect(eligible(s, w)).toBe(true);
    expect(purified(s, group, 8)).toBe(false);
    for (const g of group) s.words[g] = { stage: 3, due: 0, retired: 1 } as never;
    expect(purified(s, group, 8)).toBe(true);
    // Two batches (《进场景第 1 版》 批次): 第 2 批 waits until half the group is 半名.
    const sc = SCENES.find((x) => x.type === 'field' && x.region === 4 && x.words!.some((id) => WORD_BY_ID[id].batch === 2))!;
    const ids = sc.words!;
    const late = WORD_BY_ID[ids.find((id) => WORD_BY_ID[id].batch === 2)!];
    const s2 = newGame('T', 'student');
    expect(laterReady(s2, late)).toBe(false);
    for (const g of ids.slice(0, Math.ceil(ids.length / 2))) s2.words[g] = { stage: 2, due: 0 } as never;
    expect(laterReady(s2, late)).toBe(true);
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

});

describe('0.7/0.8 驳回书', () => {
  it('three parts in order; du is stamped and heals; Frau Weber doubles one answer at half HP', () => {
    const qs = LATER_BOSSES.find((b) => b.region === 11)!.questions(makeRng(5));
    expect(qs.slice(0, 2).map((q) => q.id)).toEqual(['reason', 'frist']);
    expect(qs.slice(2, 5).every((q) => q.id.startsWith('fill-'))).toBe(true);
    expect(qs.slice(5, 8).map((q) => q.id).sort()).toEqual(['attest', 'kaution', 'klausel']);
    const s = newGame('Lucas', 'student');
    s.level = 108;
    const rng = makeRng(9);
    const f = startBoss(s, rng, 7, undefined, 11);
    answerBoss(s, f, f.current.model.split(' / ')[0], rng);
    expect(f.hp).toBe(7);
    const v = answerBoss(s, f, 'hey, kannst du mir helfen', rng);
    expect(v.healed).toBe(true);
    expect(f.hp).toBe(8);
    let turns = 0;
    while (f.hp > 4 && turns++ < 10) answerBoss(s, f, f.current.model.split(' / ')[0], rng);
    expect(f.assist).toBe('ready');
    const hp = f.hp;
    answerBoss(s, f, f.current.model.split(' / ')[0], rng);
    expect(f.hp).toBe(hp - 2);
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
