import { accentOf } from '../ui/theme';
import { npcFigure } from '../ui/icons';
import { RIFT } from '../core/rift';
import { adventurersIn } from '../core/adventurers';
// 0.5 小世界: point-and-click scenes on top of the 0.4 map. The world scene keeps drawing the map, monsters and
// other players; this class owns where you stand (a scene), moving along the route, where monsters spawn
// (3 per field scene, never refilling the scene you stand in) and the scene panel on the right.
import { DUNGEON } from '../data/dungeon';
import { GRAM_DUNGEON } from '../core/gram/dungeons';
import { PARTNER } from '../core/gram/partner';
import { DUEL } from '../data/grammar/duels';
import { AI_TUTOR } from '../net/aiTutor';
import { sceneArtCanvas } from '../ui/sceneArt';
import Phaser from 'phaser';
import { CONFIG } from '../core/config';
import { has } from '../core/unlocks';
import { toast } from '../ui/feedback';
import { needsVerify, stageOf } from '../core/srs';
import { eligible, fieldCleared } from '../core/spawn';
import { erodeOpen, purified } from '../core/erosion';
import type { ZoneId } from '../core/types';
import { WORD_BY_ID, fullForm } from '../data/words';
import { AREAS, AREAS_LATER, HOME_SCENE, SCENE_BY_ID, SCENES, neighbours, nearestScene, routeTo, scenesOf, type SceneDef } from '../data/world';
import { h } from '../ui/dom';
import { sfx } from './audio';
import { ZONES, TILE, type NpcId } from './map';
import { ERODE_DEFS, REGION_DEF, REGION_DEFS, regionLevels } from '../data/zones';
import type { MonsterEntity, WorldScene } from './WorldScene';

const NPC_ZH: Record<NpcId, string> = { hilde: '守火人 Hilde', greta: '导师 Greta', mira: '商人 Mira', konrad: '面包师傅 Konrad', examiner: '考官', brandt: '站长 Herr Brandt', lina: 'Lina', weber: '秩序会 Frau Weber' };
const GATE_ZH: Record<number, string> = { 1: '穿过门回余烬营地', 2: '过桥回面包集市', 3: '过铁路桥去铁轨镇', ...Object.fromEntries(REGION_DEFS.map((d) => [d.region, `去${d.zh}`])) };
const OFFSETS = [[-28, -6], [28, -6], [0, -24], [-28, 16], [28, 16], [0, -38]];

/** 0.6: each word's home scene (from the scene word groups). */
const HOME = HOME_SCENE; // own groups + 蚀变 groups (src/data/world.ts)

export const anchorPx = (sc: SceneDef) => ({ x: sc.at.x * TILE + 8, y: sc.at.y * TILE + 8 });

export class NodeNav {
  here!: SceneDef;
  hopping = false;
  private veil?: Phaser.GameObjects.Rectangle;
  private gfx?: Phaser.GameObjects.Graphics;
  private labels: Phaser.GameObjects.Text[] = [];
  private panel: HTMLElement;
  private dirty = true;
  private timer = 0;

  constructor(private w: WorldScene) {
    let el = document.getElementById('scene-panel');
    if (!el) {
      el = h('div#scene-panel.panel');
      const modal = document.getElementById('modal');
      if (modal) modal.before(el);
      else document.body.append(el);
    }
    this.panel = el;
    this.panel.hidden = false;
  }

  get s() {
    return this.w.ctrl.state;
  }

  /** Hidden routes show once the sign's word can be read. */
  revealed = (sc: SceneDef): boolean => (!sc.hiddenBy || stageOf(this.s, WORD_BY_ID[sc.hiddenBy]) >= 3) && (!sc.openFlag || !!this.s.flags[sc.openFlag]);

  start(): void {
    const region = this.w.map.region;
    const hub = SCENE_BY_ID[AREAS.find((a) => a.region === region)!.hub];
    // First visit with the scene map: an old save wakes at the area's hub (游戏设计 第 5 块验收).
    if (!this.s.flags.nodeMap) {
      this.s.flags.nodeMap = true;
      this.here = hub;
    } else this.here = nearestScene(region, this.s.pos.x, this.s.pos.y, this.revealed);
    this.s.flags[`seenArea${region}`] = true;
    this.claim();
    if (this.here.type === 'road') this.s.flags[`road_${this.here.id}`] = true;
    // The 0.4 street map stays underneath (scenes stand on its tiles) but is veiled, so routes and monsters read first.
    this.veil?.destroy();
    this.veil = this.w.add.rectangle(0, 0, 8000, 8000, this.w.bright ? 0xfffaf0 : 0x07040a, this.w.bright ? CONFIG.map.veil * 0.4 : CONFIG.map.veil).setOrigin(0).setDepth(-1);
    this.place();
    this.draw();
  }

  stop(): void {
    this.panel.hidden = true;
    this.veil?.destroy();
    this.veil = undefined;
  }

  private place(): void {
    this.w.refreshPlates();
    const p = anchorPx(this.here);
    this.w.player.setPosition(p.x, p.y + 14).setDepth(3002);
    this.s.pos = { x: p.x, y: p.y };
    this.w.cameras.main.centerOn(p.x, p.y);
  }

  goHub(): void {
    const hub = scenesOf(this.w.map.region).find((x) => x.bonfire)!;
    this.here = hub;
    this.place();
    this.draw();
  }

  sceneOf(m: MonsterEntity): SceneDef {
    if (m.node && SCENE_BY_ID[m.node]) return SCENE_BY_ID[m.node];
    const sc = nearestScene(this.w.map.region, m.x, m.y);
    m.node = sc.id;
    return sc;
  }

  monstersIn(sc: SceneDef): MonsterEntity[] {
    return this.w.monsters.filter((m) => this.sceneOf(m) === sc);
  }

  /** A field scene is open when some word of its group can spawn now (greetings, verbs… wait for typing at Lv2). */
  open(sc: SceneDef): boolean {
    return !sc.words || sc.words.some((id) => WORD_BY_ID[id] && eligible(this.s, WORD_BY_ID[id]));
  }

  /** Slots of a scene: the zone keeps about CONFIG.map.zoneSlots monsters spread over its open scenes (at least
   *  CONFIG.map.slots each), so a zone with few open scenes is as full as one with many. */
  slotsOf(sc: SceneDef): number {
    if (sc.slots) return sc.slots;
    if (!this.open(sc)) return 0;
    const n = scenesOf(this.w.map.region).filter((x) => x.zone === sc.zone && !x.slots && x.type === 'field' && this.revealed(x) && this.open(x)).length;
    return Math.max(CONFIG.map.slots, Math.ceil(CONFIG.map.zoneSlots / Math.max(1, n)));
  }

  /** Field capacity of a zone in the scene map. */
  capacity(zone: ZoneId): number {
    return scenesOf(this.w.map.region)
      .filter((sc) => sc.zone === zone && this.revealed(sc))
      .reduce((a, sc) => a + this.slotsOf(sc), 0);
  }

  /** A free slot in this zone, never in the scene you stand in (so a cleared scene means moving on, as walking did).
   *  0.6 场景记忆法: a word with a home scene only ever stands there (null when its home is full or is where you are);
   *  words without one (reviews from other zones, 残句, rare monsters) take any free scene of the zone. */
  spot(zone: ZoneId, extra = false, wordId?: string): { x: number; y: number; sc: SceneDef } | null {
    const home = wordId ? HOME[wordId] : undefined;
    const homeHere = home && home.region === this.w.map.region && home.zone === zone;
    const cands = homeHere
      ? [home].filter((sc) => this.revealed(sc) && sc !== this.here)
      : scenesOf(this.w.map.region).filter((sc) => sc.zone === zone && this.revealed(sc) && sc !== this.here);
    let best: SceneDef | null = null;
    let room = 0;
    for (const sc of cands) {
      const free = this.slotsOf(sc) + (extra ? 1 : 0) - this.monstersIn(sc).length;
      if (free > room || (free === room && free > 0 && Math.random() < 0.5)) (best = sc), (room = free);
    }
    if (!best || room <= 0) return null;
    const used = new Set(this.monstersIn(best).map((m) => `${m.x},${m.y}`));
    const a = anchorPx(best);
    for (const [dx, dy] of OFFSETS) if (!used.has(`${a.x + dx},${a.y + dy}`)) return { x: a.x + dx, y: a.y + dy, sc: best };
    return { x: a.x, y: a.y - 18, sc: best };
  }

  /** Hidden scenes are lucky: more 残句 in region 1, more rare monsters in region 2. */
  lucky(sc: SceneDef): boolean {
    return !!sc.lucky && Math.random() < CONFIG.map.luckyChance;
  }

  // ---- moving -------------------------------------------------------------------------------------

  click(px: number, py: number): void {
    if (this.hopping || this.w.ctrl.uiBlocking()) return;
    const sc = scenesOf(this.w.map.region).find((x) => this.revealed(x) && Math.hypot(anchorPx(x).x - px, anchorPx(x).y - py) < 18);
    if (sc) this.travel(sc.id);
  }

  travel(id: string): void {
    if (this.hopping || this.w.ctrl.uiBlocking() || id === this.here.id) return;
    const path = routeTo(this.here.id, id, this.revealed);
    if (!path) return;
    this.hopping = true;
    this.dirty = true;
    const step = () => {
      const next = SCENE_BY_ID[path.shift()!];
      // 越区引导: a field above your level asks first (the same question walking in asked).
      if (!next || (next.zone && next.zone !== this.here.zone && !this.w.ctrl.mayEnterZone(next.zone))) return this.arrive();
      const p = anchorPx(next);
      sfx.step();
      this.w.player.setFlipX(p.x < this.w.player.x);
      this.w.player.play('walk', true);
      this.w.tweens.add({
        targets: this.w.player,
        x: p.x,
        y: p.y + 14,
        duration: CONFIG.map.hopSec * 1000,
        ease: 'Sine.easeInOut',
        onComplete: () => {
          this.here = next;
          this.s.pos = { x: p.x, y: p.y };
          this.claim();
          if (path.length) step();
          else this.arrive();
        },
      });
    };
    step();
  }

  private arrive(): void {
    this.hopping = false;
    this.w.player.anims.stop();
    this.w.player.setTexture('hero0');
    // Fields left half-empty while you stood in them refill now that you have moved.
    for (const z of new Set(scenesOf(this.w.map.region).map((x) => x.zone).filter(Boolean))) this.w.fillZone(z as ZoneId);
    this.claim();
    this.draw();
    // 驿站 (0.6 第 6 块): crossroads you have stood on become teleport targets from Lv21.
    if (this.here.type === 'road') this.s.flags[`road_${this.here.id}`] = true;
    if (this.here.id === 'r1-x') this.w.ctrl.sawNeighbour();
    if (this.here.zone === 'fahrplanhalle' && this.here.type === 'field') this.w.ctrl.maybeLina();
    if (this.here.id === 'r3-hide') this.s.flags.zeroSeen = true;
    // 怪物诅咒 教学: the first cursed monster waits just past the hall gate (Lv25+).
    if (this.here.id === 'r3-fx' && this.s.level >= CONFIG.curse.from && !this.s.flags.curseTaught) this.s.flags.curseNext = true;
  }

  /** 全量筛选: the words you named in town live here → pay their stored XP (one line in the scene panel). */
  private claimMsg: { scene: string; text: string } | null = null;
  private claim(): void {
    this.w.refreshPlates();
    const r = this.w.ctrl.claimScene(this.here.id);
    if (r) {
      this.claimMsg = { scene: this.here.id, text: `你在城里认出的 ${r.words} 个词就住在这里 · +${r.xp} 经验` };
      this.dirty = true;
    }
  }

  // ---- drawing ------------------------------------------------------------------------------------

  draw(): void {
    this.gfx?.destroy();
    for (const t of this.labels) t.destroy();
    this.labels = [];
    const g = (this.gfx = this.w.add.graphics().setDepth(3000));
    const list = scenesOf(this.w.map.region).filter(this.revealed);
    // 明亮画风: route and circles in the region's accent on a bright map; dark red on 蚀变 maps.
    const bright = this.w.bright;
    const accent = parseInt(accentOf(this.w.map.region).slice(1), 16);
    for (const a of list)
      for (const id of neighbours(a.id)) {
        const b = SCENE_BY_ID[id];
        if (!this.revealed(b) || a.id > b.id) continue;
        const pa = anchorPx(a);
        const pb = anchorPx(b);
        g.lineStyle(bright ? 3 : 2, b.type === 'hidden' || a.type === 'hidden' ? 0xb8963a : bright ? accent : 0x7a2630, bright ? 0.85 : 0.7);
        g.lineBetween(pa.x, pa.y, pb.x, pb.y);
      }
    for (const sc of list) {
      const p = anchorPx(sc);
      const color = bright
        ? sc.type === 'door' ? 0xc0392b : sc.type === 'hidden' ? 0xb8963a : sc.type === 'road' ? 0x8a7a68 : accent
        : sc.type === 'camp' ? 0xffb347 : sc.type === 'door' ? 0xff2040 : sc.type === 'hidden' ? 0xffcf4a : sc.type === 'road' ? 0x9a8a80 : 0xc23040;
      g.fillStyle(bright ? 0xfffaf0 : 0x07040a, bright ? 0.95 : 0.85).fillCircle(p.x, p.y, 9);
      g.lineStyle(sc === this.here ? 2.5 : bright ? 1.5 : 1, sc === this.here ? (bright ? 0x2d2118 : 0xffffff) : color, 1).strokeCircle(p.x, p.y, 9);
      // 全量筛选: XP waiting here (待领) → a small gold dot beside the circle until it is claimed.
      if (this.s.screen?.pending?.[sc.id]?.length) g.fillStyle(0xffcf4a, 1).fillCircle(p.x + 9, p.y - 8, 2.5);
      this.labels.push(
        this.w.add
          .text(p.x, p.y, String(sc.no), { fontFamily: '"Courier New", monospace', fontSize: '8px', color: bright ? '#2d2118' : '#e8dccf', fontStyle: bright ? 'bold' : '', resolution: 4 })
          .setOrigin(0.5)
          .setDepth(3001),
      );
    }
    this.dirty = true;
  }

  // ---- the scene panel ----------------------------------------------------------------------------

  tick(dtMs: number): void {
    this.panel.hidden = !!this.w.ctrl.battle || !!this.w.ctrl.boss;
    this.timer += dtMs;
    if (!this.dirty && this.timer < 500) return;
    this.timer = 0;
    this.dirty = false;
    this.render();
  }

  touch(): void {
    this.dirty = true;
  }

  /** Number keys 1–9 fight the n-th monster here. */
  key(e: KeyboardEvent): boolean {
    if (this.hopping || this.w.ctrl.uiBlocking()) return false;
    if (/^[1-9]$/.test(e.key)) {
      const m = this.monstersIn(this.here)[Number(e.key) - 1];
      if (m) this.fight(m);
      return !!m;
    }
    if (e.key.toLowerCase() === 'm') {
      this.bigMap();
      return true;
    }
    return false;
  }

  private fight(m: MonsterEntity): void {
    if (this.hopping || this.w.ctrl.uiBlocking() || this.w.frozen) return;
    this.w.ctrl.encounter(m);
  }

  /** 蚀变 (rev 341): an open 蚀变 scene says so; once all its advanced words are gone it reads 已净化. */
  private erodeTag(sc: SceneDef): HTMLElement | string {
    if (!sc.erodeSeg || !erodeOpen(this.s, sc.erodeSeg)) return '';
    const lv = regionLevels(sc.erodeSeg).join('–');
    return purified(this.s, sc.eroded, sc.erodeSeg)
      ? h('span.small', { style: 'color:var(--gold, #ffcf4a)' }, ' · 已净化')
      : h('span.small', { style: 'color:#c06cff' }, ` · 蚀变 Lv ${lv}`);
  }

  private render(): void {
    const sc = this.here;
    const busy = this.hopping || this.w.ctrl.uiBlocking();
    const zone = sc.zone ? ZONES.find((z) => z.id === sc.zone) : null;
    const mons = this.monstersIn(sc);
    const tag = (m: MonsterEntity) => (m.isEcho ? '回响' : m.elite ? '◈ 精英' : m.phrase ? '残句' : m.rare ? '◆ 稀有' : !m.phrase && !m.isEcho && needsVerify(this.s, m.word) ? '待验证' : m.kind === 'due' ? '! 复习' : m.kind === 'shadow' ? '旧识' : '新');
    const ia = (kind: string, data?: string) => () => {
      if (!this.w.ctrl.uiBlocking()) this.w.ctrl.interact({ kind, data });
    };
    const things: HTMLElement[] = [];
    if (sc.bonfire) things.push(h('button.btn', { onclick: ia('bonfire') }, '🔥 篝火休息'));
    if (sc.id === 'r3-hide' && this.s.level >= DUNGEON.from) things.push(h('button.btn.primary', { disabled: busy, onclick: () => this.w.ctrl.enterDungeon() }, '🚪 进入零号站台（规则表地下城）'));
    // 语法秘境 (0.7–0.8): entered from a region's camp.
    if (sc.type === 'camp' && sc.bonfire && this.s.level >= RIFT.from) things.push(h('button.btn', { disabled: busy, onclick: () => this.w.ctrl.enterRift() }, '🌀 裂隙（白板 roguelite）'));
    // 审查修订: one 「AI 对话」 entry; the modes (决斗场, AI 批改造句, 小作文) are inside.
    if (sc.type === 'camp' && sc.bonfire && this.s.level >= Math.min(DUEL.from, AI_TUTOR.grade)) things.push(h('button.btn', { disabled: busy, onclick: () => this.w.ctrl.openAiHub() }, '💬 AI 对话'));
    if (sc.type === 'camp' && sc.bonfire && this.s.level >= PARTNER.from) things.push(h('button.btn', { disabled: busy, onclick: () => this.w.ctrl.choosePartner() }, '🤝 复习伙伴'));
    if (sc.type === 'camp' && sc.bonfire && this.s.level >= GRAM_DUNGEON.from.ablaut) things.push(h('button.btn', { disabled: busy, onclick: () => this.w.ctrl.enterGramDungeon() }, '📜 语法秘境'));
    if (sc.bonfire && has(this.s.level, 'dailies')) things.push(h('button.btn', { disabled: busy, onclick: () => this.w.ctrl.showDailies() }, '📋 每日委托'));
    const npcs: NpcId[] = [...(sc.npcs ?? []), ...(sc.id === 'r3-platz' && this.s.flags.linaFreed ? (['lina'] as NpcId[]) : [])];
    for (const n of npcs) things.push(h('button.btn', { onclick: ia('npc', n) }, NPC_ZH[n]));
    // 游荡的冒险者: the AI players standing in this scene now (name plate always says AI).
    for (const a of adventurersIn(sc, !!sc.erodeSeg && erodeOpen(this.s, sc.erodeSeg))) things.push(h('button.btn.adv', { onclick: ia('adv', a.id), title: a.origin }, npcFigure(a.name, 1.5, 'adv-fig'), h('span.ai-tag', 'AI'), ` ${a.name}${a.erode ? '（被困的幸存者）' : ''}`));
    const eb = ERODE_DEFS.find((e) => e.scene === sc.id);
    if (sc.door) things.push(h('button.btn', { onclick: ia('door', sc.id) }, eb ? eb.doorAct : REGION_DEF[this.w.map.region] ? REGION_DEF[this.w.map.region]!.doorAct : this.w.map.region === 3 ? '走上末班站台' : this.w.map.region === 2 ? '推开秤房的门' : '敲门'));
    if (sc.gate) things.push(h('button.btn', { onclick: ia('gate', String(sc.gate)) }, GATE_ZH[sc.gate]));
    for (const sg of sc.signs ?? []) things.push(h('button.btn', { onclick: ia('sign', sg) }, stageOf(this.s, WORD_BY_ID[sg]) >= 3 ? `路牌：${fullForm(WORD_BY_ID[sg])}` : '路牌：▒▒▒'));
    const exits = neighbours(sc.id)
      .map((id) => SCENE_BY_ID[id])
      .filter(this.revealed)
      .map((x) => h('button.btn', { disabled: busy, onclick: () => this.travel(x.id) }, `→ ${x.no} ${x.zh}`));
    this.panel.replaceChildren(
      h('div.sp-head', h('b', `${sc.no} · ${sc.zh}`), h('span.muted', zone ? ` ${zone.zh} · ${zone.levels}` : sc.type === 'camp' ? ' 安全区' : ''), this.erodeTag(sc)),
      this.claimMsg?.scene === sc.id ? h('div.small', { style: 'color:var(--gold, #ffcf4a)' }, this.claimMsg.text) : '',
      sceneArtCanvas(sc.id, this.s) ?? '',
      sc.zone
        ? h(
            'div.sp-sec',
            h('div.muted', mons.length ? '这里的怪（点它或按数字键开打）' : '这里暂时没有怪，去下一个场景'),
            fieldCleared(this.s, sc.zone)
              ? h('div.small', { style: 'color:var(--gold, #ffcf4a)' }, '这里的词你大多会了，去下一区吧，或者找主城考官考「分级考核」')
              : '',
            ...mons.map((m, i) =>
              h(
                'button.btn.sp-mon' + (m.phrase || m.rare || m.isEcho || m.elite ? '.gold' : ''),
                { disabled: busy, onclick: () => this.fight(m) },
                h('kbd', String(i + 1)),
                ` ${m.label.text.replace(/\n/g, ' ')} `,
                h('span.muted', tag(m)),
              ),
            ),
          )
        : mons.length
          ? h('div.sp-sec', ...mons.map((m, i) => h('button.btn.sp-mon', { disabled: busy, onclick: () => this.fight(m) }, h('kbd', String(i + 1)), ` ${m.label.text} `, h('span.muted', tag(m)))))
          : '',
      things.length ? h('div.sp-sec', h('div.muted', '这里有'), ...things) : '',
      h('div.sp-sec', h('div.muted', this.hopping ? '赶路中……' : '出口（也可以点地图上的圆点，远处去过的会自动走过去）'), ...exits),
      h('div.sp-sec', h('button.btn.ghost', { onclick: () => this.bigMap() }, '🗺 大地图（M）')),
    );
  }

  /** 驿站 (0.6 第 6 块 细则一): from Lv21, free jumps to any crossroads you have visited, only from a bonfire/hub. */
  private waystation(): HTMLElement | string {
    const s = this.s;
    if (!has(s.level, 'waystation')) return '';
    const atFire = !!this.here.bonfire;
    const roads = SCENES.filter((x) => x.type === 'road' && s.flags[`road_${x.id}`] && x.id !== this.here.id);
    return h(
      'div.waystation',
      h('h3', `驿站 · 片区路口${atFire ? '' : '（在篝火或主城才能用）'}`),
      roads.length
        ? h(
            'div.row',
            { style: 'flex-wrap:wrap;gap:6px' },
            ...roads.map((x) =>
              h(
                'button.btn',
                {
                  disabled: !atFire,
                  onclick: () => {
                    this.w.ctrl.panels.close();
                    if (x.region === this.w.map.region) {
                      this.here = x;
                      this.place();
                      this.arrive();
                    } else this.w.ctrl.travel(x.region, anchorPx(x));
                  },
                },
                `${AREAS.find((a) => a.region === x.region)!.zh} · ${x.zh}`,
              ),
            ),
          )
        : h('div.small.muted', '还没走到过任何路口。'),
    );
  }

  /** 大地图: every area; open ones you have visited can be entered (you arrive at their hub). */
  bigMap(): void {
    if (this.w.ctrl.uiBlocking() || this.hopping) return;
    const s = this.s;
    const open = (r: number) => r <= this.w.map.region || !!s.flags[`seenArea${r}`] || (r === 2 && !!s.flags.bossKills && s.level >= CONFIG.region2Level) || (r === 3 && !!s.flags.boss2Kills) || (r >= 4 && !!s.flags[`boss${r - 1}Kills`]);
    this.w.ctrl.panels.showBigMap(
      h(
        'div.bigmap',
        ...AREAS.map((a) =>
          h(
            'button.btn' + (a.region === this.w.map.region ? '.primary' : ''),
            {
              disabled: !open(a.region),
              onclick: () => {
                this.w.ctrl.panels.close();
                if (a.region === this.w.map.region) this.goHub();
                else this.w.ctrl.travel(a.region, anchorPx(SCENE_BY_ID[a.hub]));
              },
            },
            `${a.zh} · ${a.de} · ${a.levels}${a.region === this.w.map.region ? '（你在这里，点一下回主城）' : open(a.region) ? '' : '（还没去过）'}`,
          ),
        ),
        ...AREAS_LATER.map((t) => h('button.btn', { disabled: true }, `${t}（以后开放）`)),
        this.waystation(),
      ),
    );
    if (has(s.level, 'waystation') && !s.flags.waystationSeen) {
      s.flags.waystationSeen = true;
      toast('驿站开了：在篝火或主城，可以从大地图直接传到去过的片区路口，免费。', 'gold');
    }
  }
}
