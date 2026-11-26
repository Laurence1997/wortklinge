import { neighbours, SCENES, scenesOf } from '../data/world';
import { applyTheme } from '../ui/theme';
import { setMusicMood } from './audio';
import { RED, redAsleep, redEligible } from '../core/redname';
import { OPINION, opinionEligible } from '../core/opinion';
import { elitePick, type ElitePick } from '../core/elite';
import Phaser from 'phaser';
import { needsVerify, stageOf, type Stage } from '../core/srs';
import { now } from '../core/state';
import type { Word, ZoneId } from '../core/types';
import { fullForm, WORD_BY_ID } from '../data/words';
import { has } from '../core/unlocks';
import { phraseCards, phraseWord, plateZh } from '../core/combat';
import { SAYING_CFG, SAYINGS } from '../data/sayings';
import { FAMILIES } from '../data/families';
import type { Controller } from './controller';
import { DEFAULT_LOOK } from '../core/look';
import { generateMap, isBlocked, MAP_H, MAP_W, TILE, walkableTilesIn, zonesOf, zoneAt, type MapData, type NpcId, type RegionId, type ZoneDef } from './map';
import { GLITCH, heroFramesKenney, dungeonTile, SHADE_RAMP, CHAR_RAMP, makeTextures, renderMapCanvas, PAL, BRIGHT, renderBrightMap, rawFigure } from './sprites';
import { NPC_TILE, isRestored, wordArt } from '../ui/icons';
import { artKey, monsterCanvas, type SheetId } from './monsterArt';
import { sfx } from './audio';
import { CONFIG } from '../core/config';
import { NodeNav } from './nodes';
import { charRamp, mapRamp, mapShades, shadeRamp, type Ramp5 } from './palette';
import { REGION_DEF } from '../data/zones';

export interface MonsterEntity {
  uid: number;
  word: Word;
  kind: 'new' | 'due' | 'shadow';
  zone: ZoneId;
  isEcho: boolean;
  scripted?: 'loss' | 'trial';
  /** Rare (gold-rimmed) or 宝箱怪: flees at half HP / turn 3, drops an iron chest. */
  rare?: boolean;
  /** 挑战怪 (rev 342): from the scene's challenge pool. */
  challenge?: boolean;
  /** 残句 (0.5): a sentence monster carrying this short saying (no word nameplate). */
  phrase?: string;
  x: number;
  y: number;
  tx: number;
  ty: number;
  wait: number;
  container: Phaser.GameObjects.Container;
  label: Phaser.GameObjects.Text;
  teeth: Phaser.GameObjects.Text;
  marker: Phaser.GameObjects.Text;
  reveal: boolean[];
  stage: Stage;
  /** 小世界 (0.5): the scene this monster stands in. */
  node?: string;
  /** 野外精英 · 场景精英 (2026-11-23): the scene quiz it carries (its word is the first part's). */
  elite?: ElitePick;
  /** 红名怪 (81): rushes you on sight; `chasing` while it runs at you (contact starts the fight with its 结构魔). */
  red?: boolean;
  /** 开口表达观点 (121): throws out a claim before the fight. */
  opinion?: boolean;
  chasing?: boolean;
}

const SPEED = 72;
const FONT = '"Courier New", ui-monospace, monospace';

export class WorldScene extends Phaser.Scene {
  ctrl!: Controller;
  /** 各区色调: this map's 5-step ramp, or null for the classic red (src/game/palette.ts). */
  ramp: Ramp5 | null = null;
  bright = false;
  map!: MapData;
  player!: Phaser.GameObjects.Sprite;
  monsters: MonsterEntity[] = [];
  keys!: Record<string, Phaser.Input.Keyboard.Key>;
  cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  moveTarget: { x: number; y: number } | null = null;
  frozen = false;
  graceUntil = 0;
  ring?: Phaser.GameObjects.Graphics;
  signTexts: Array<{ text: Phaser.GameObjects.Text; wordId: string; x: number; y: number }> = [];
  private uid = 1;
  private stepTimer = 0;
  private jitterTimer = 0;
  private respawnTimers: Partial<Record<ZoneId, number>> = {};
  zones: ZoneDef[] = [];
  /** 小世界 (0.5): set when the scene map is on (CONFIG.map.nodes, ?oldmap turns it off). */
  nodes: NodeNav | null = null;
  private interactable: { kind: 'bonfire' | 'npc' | 'door' | 'sign' | 'gate'; data?: string } | null = null;

  constructor() {
    super('world');
  }

  init(data: { ctrl: Controller }) {
    this.ctrl = data.ctrl;
  }

  preload() {
    if (!this.textures.exists('town')) this.load.image('town', './art/kenney-tiny-town.png');
    if (!this.textures.exists('farm')) this.load.image('farm', './art/kenney-tiny-farm.png');
    if (!this.textures.exists('battle')) this.load.image('battle', './art/kenney-tiny-battle.png');
    if (!this.textures.exists('dungeon')) this.load.image('dungeon', './art/kenney-tiny-dungeon.png');
  }

  create() {
    const region: RegionId = this.ctrl.state.region ?? 1;
    this.map = generateMap(region);
    this.ramp = mapRamp(region, this.ctrl.state.flags);
    this.zones = zonesOf(region);
    this.monsters = [];
    this.signTexts = [];
    this.respawnTimers = {};
    this.interactable = null;
    const tex = makeTextures();
    // A scene restart (travel between regions) re-adds these textures; animations made from the old ones would point
    // at destroyed frames and crash create(), so drop them first and build them again below.
    for (const k of ['burn', 'walk']) if (this.anims.exists(k)) this.anims.remove(k);
    const addCanvas = (key: string, cv: HTMLCanvasElement) => {
      if (this.textures.exists(key)) this.textures.remove(key);
      this.textures.addCanvas(key, cv);
    };
    const oldmap = !CONFIG.map.nodes || new URLSearchParams(location.search).has('oldmap');
    const town = !oldmap && this.textures.exists('town') ? (this.textures.get('town').getSourceImage() as HTMLImageElement) : null;
    const hidden = SCENES.filter((x) => x.region === region && x.type === 'hidden').map((x) => x.at);
    // 明亮地图 (Lucas 2026-11-25): everyday maps in their own colours; 蚀变 maps keep their dark ramp (?dark = old look).
    const eroded = this.ramp !== ((REGION_DEF[region]?.palette as Ramp5 | undefined) ?? null);
    this.bright = !!town && !new URLSearchParams(location.search).has('dark') && !eroded && !!BRIGHT[region];
    addCanvas('map', this.bright ? renderBrightMap(this.map, town!, this.textures.exists('farm') ? (this.textures.get('farm').getSourceImage() as HTMLImageElement) : null, hidden, BRIGHT[region]) : renderMapCanvas(this.map, town, hidden, this.ramp ? mapShades(this.ramp) : undefined));
    void tex;
    for (const k of ['hero0', 'hero1']) {
      if (this.textures.exists(k)) this.textures.remove(k);
      this.textures.createCanvas(k, 16, 16);
    }
    this.applyLook();
    addCanvas('fire0', tex.fire[0]);
    addCanvas('fire1', tex.fire[1]);
    addCanvas('sign', tex.sign);
    addCanvas('glow', tex.glow);
    addCanvas('dot', tex.dot);

    this.add.image(0, 0, 'map').setOrigin(0, 0).setDepth(-2);
    const W = MAP_W * TILE;
    const H = MAP_H * TILE;
    this.cameras.main.setBounds(0, 0, W, H);
    applyTheme(this.bright, region);
    setMusicMood(this.bright, region);
    this.cameras.main.setBackgroundColor(this.bright ? BRIGHT[region].fog : PAL.void);

    // Light sources.
    const b = this.map.bonfire;
    const bx = b.x * TILE + 8;
    const by = b.y * TILE + 8;
    this.add.image(bx, by, 'glow').setScale(2.2).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.9);
    const fire = this.add.sprite(bx, by - 2, 'fire0').setDepth(by);
    this.anims.create({ key: 'burn', frames: [{ key: 'fire0' }, { key: 'fire1' }], frameRate: 5, repeat: -1 });
    fire.play('burn');
    this.tweens.add({ targets: fire, scaleX: 1.08, yoyo: true, repeat: -1, duration: 420 });
    for (const l of this.map.lamps) {
      this.add.image(l.x * TILE + 8, l.y * TILE + 4, 'glow').setScale(0.9).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.6);
    }
    const d = this.map.door;
    this.add.image(d.x * TILE + 8, d.y * TILE + 16, 'glow').setScale(1.1).setTint(0xff2040).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.7);

    // NPCs and signs: each NPC stands as its dialog portrait (Kenney Tiny Dungeon, red ramp).
    const NPC_LABEL: Record<NpcId, string> = { hilde: 'Hilde', greta: 'Greta', mira: 'Mira', konrad: 'Konrad', examiner: '考官 Prüfer', brandt: 'Herr Brandt', lina: 'Lina', weber: 'Frau Weber' };
    for (const n of this.map.npcs) {
      // Lina stays a shadow (two darkest steps) until she is freed, like her dialog portrait.
      const shadow = n.id === 'lina' && !isRestored('lina');
      const figure = this.ramp ? charRamp(this.ramp) : CHAR_RAMP;
      const nk = `npc-${n.id}${shadow ? '-s' : ''}${this.bright && !shadow ? '-raw' : this.ramp ? `-${this.ramp[3]}` : ''}`;
      if (!this.textures.exists(nk)) this.textures.addCanvas(nk, this.bright && !shadow ? rawFigure(this.dsheet(), NPC_TILE[n.id] ?? 111) : dungeonTile(this.dsheet(), NPC_TILE[n.id] ?? 111, shadow ? figure.slice(0, 2) : figure));
      this.add.sprite(n.x * TILE + 8, n.y * TILE + 6, nk).setDepth(n.y * TILE + 8);
      if (this.map.region >= 2 || n.id !== 'hilde')
        this.add
          .text(n.x * TILE + 8, n.y * TILE - 6, NPC_LABEL[n.id], { fontFamily: FONT, fontSize: '6px', color: this.bright ? '#2d2118' : '#d8c8b8', fontStyle: this.bright ? 'bold' : '', stroke: this.bright ? '#fffdf8' : undefined, strokeThickness: this.bright ? 2 : 0, resolution: 4 })
          .setOrigin(0.5, 1)
          .setDepth(n.y * TILE + 9);
    }
    for (const g of this.map.gates) {
      this.add.image(g.x * TILE + 8, g.y * TILE + 8, 'glow').setScale(0.7).setTint(0xffcf4a).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.5);
    }
    for (const sg of this.map.signs) {
      const sx = sg.x * TILE + 8;
      const sy = sg.y * TILE + 8;
      this.add.image(sx, sy, 'sign').setDepth(sy);
      const t = this.add
        .text(sx, sy - 3, '', { fontFamily: FONT, fontSize: '7px', color: '#d8c8b8', resolution: 4 })
        .setOrigin(0.5)
        .setDepth(sy + 1);
      this.signTexts.push({ text: t, wordId: sg.wordId, x: sg.x, y: sg.y });
    }
    this.refreshSigns();

    // Zone names written on the ground, very faint.
    for (const z of this.zones) {
      if (z.id === 'camp' || z.id === 'markt') continue;
      this.add
        // 美术小修 A (2026-11-26): on bright maps two short lines instead of one long one, so neighbouring zone names
        // no longer run into each other.
        .text((z.rect.x + z.rect.w / 2) * TILE, (z.rect.y + 1.2) * TILE, this.bright ? `${z.zh} · ${z.levels}\n${z.de}` : `${z.de} · ${z.zh} · ${z.levels}`, {
          fontFamily: FONT,
          fontSize: '8px',
          color: this.bright ? '#4a3420' : '#5a2a2e',
          align: 'center',
          resolution: 4,
        })
        .setOrigin(0.5)
        .setAlpha(this.bright ? 0.7 : 1)
        .setDepth(1);
    }

    // Player.
    const s = this.ctrl.state;
    const start = s.pos.x ? s.pos : { x: this.map.start.x * TILE + 8, y: this.map.start.y * TILE + 8 };
    this.player = this.add.sprite(start.x, start.y, 'hero0').setOrigin(0.5, 0.85);
    this.anims.create({ key: 'walk', frames: [{ key: 'hero0' }, { key: 'hero1' }], frameRate: 6, repeat: -1 });
    this.cameras.main.startFollow(this.player, true, 0.15, 0.15);
    this.cameras.main.setZoom(3);
    this.cameras.main.roundPixels = true;
    this.scale.on('resize', () => this.fitZoom());
    this.fitZoom();

    const kb = this.input.keyboard!;
    this.cursors = kb.createCursorKeys();
    this.keys = kb.addKeys('W,A,S,D,E') as Record<string, Phaser.Input.Keyboard.Key>;
    kb.disableGlobalCapture();
    this.nodes?.stop();
    this.nodes = CONFIG.map.nodes && !new URLSearchParams(location.search).has('oldmap') ? new NodeNav(this) : null;
    this.nodes?.start();
    this.fitZoom();
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      if (this.frozen) return;
      if (this.nodes) this.nodes.click(p.worldX, p.worldY);
      else this.moveTarget = { x: p.worldX, y: p.worldY };
    });
    kb.on('keydown', (e: KeyboardEvent) => {
      if (this.nodes?.key(e)) e.preventDefault();
    });
    this.events.once('shutdown', () => this.nodes?.stop());

    this.spawnAll();
    this.ctrl.onSceneReady(this);
  }

  fitZoom() {
    const w = this.scale.width;
    // Scene map: zoomed out so most of the route (and the next scenes) fits on screen; walking keeps the close view.
    if (this.nodes) this.cameras.main.setZoom(w < 1100 ? 1.5 : 2);
    else this.cameras.main.setZoom(w < 900 ? 2 : w > 1700 ? 4 : 3);
  }

  // ---- Monsters ------------------------------------------------------------

  aliveIds(): Set<string> {
    // A scene elite holds all three of its words: none of them spawns on its own meanwhile.
    return new Set(this.monsters.flatMap((m) => m.elite?.words ?? [m.word.id]));
  }

  spawnAll() {
    for (const m of this.monsters) m.container.destroy();
    this.monsters = [];
    for (const z of this.zones) if (z.monsters) this.fillZone(z.id);
    this.placeEcho();
    this.ctrl.afterSpawnAll();
  }

  fillZone(zone: ZoneId) {
    const z = this.zones.find((q) => q.id === zone);
    if (!z) return;
    const have = this.monsters.filter((m) => m.zone === zone && !m.isEcho).length;
    if (this.nodes) return this.fillScenes(zone, have);
    const need = z.monsters - have;
    if (need <= 0) return;
    const picks = this.ctrl.pickSpawns(zone, need, this.aliveIds());
    const tiles = walkableTilesIn(this.map, z.rect);
    for (const p of picks) {
      let spot = tiles[Math.floor(Math.random() * tiles.length)];
      for (let tries = 0; tries < 12; tries++) {
        const c = tiles[Math.floor(Math.random() * tiles.length)];
        const dx = c.x * TILE - this.player.x;
        const dy = c.y * TILE - this.player.y;
        if (dx * dx + dy * dy > 90 * 90 && !this.monsters.some((m) => Math.abs(m.x - c.x * TILE) < 20 && Math.abs(m.y - c.y * TILE) < 20)) {
          spot = c;
          break;
        }
      }
      const m = this.addMonster(p.word, p.kind, zone, spot.x * TILE + 8, spot.y * TILE + 8);
      if (p.challenge) {
        m.challenge = true;
        this.styleMonster(m);
      }
      if (p.phrase) this.phraseSlot(m, zone);
    }
    this.maybeRare(zone, picks.length, tiles);
    this.maybePhrase(zone, picks.length, tiles);
  }

  /** 小世界: fill free slots of this zone's scenes (not the one you stand in). Hidden scenes are lucky. */
  private fillScenes(zone: ZoneId, have: number) {
    const nav = this.nodes!;
    const need = nav.capacity(zone) - have;
    if (need <= 0) return;
    // Words only stand in their home scene: place the usual picks that fit, then top up from a longer list.
    const first = this.ctrl.pickSpawns(zone, need, this.aliveIds());
    const more = this.ctrl.pickSpawns(zone, need * 4, new Set([...this.aliveIds(), ...first.map((p) => p.word.id)]));
    let added = 0;
    for (const p of [...first, ...more]) {
      if (added >= need) break;
      if (p.phrase && this.monsters.some((o) => o.phrase && o.zone === zone)) continue;
      if (!p.phrase && this.monsters.some((m) => m.word.id === p.word.id)) continue;
      const sp = nav.spot(zone, false, p.word.id);
      if (!sp) continue;
      const m = this.addMonster(p.word, p.kind, zone, sp.x, sp.y);
      m.node = sp.sc.id;
      if (p.challenge) {
        m.challenge = true;
        this.styleMonster(m);
      }
      added++;
      if (p.phrase) {
        this.phraseSlot(m, zone);
        continue;
      }
      if (nav.lucky(sp.sc)) {
        if (this.map.region >= 2 && has(this.ctrl.state.level, 'flee')) {
          m.rare = true;
          this.styleMonster(m);
        } else if (this.map.region === 1 && this.ctrl.state.level >= SAYING_CFG.fromLevel) this.makePhrase(m, zone);
      }
    }
    const spot = () => nav.spot(zone, true);
    this.maybeRare(zone, added, [], spot);
    this.maybePhrase(zone, added, [], spot);
    this.maybeElite(zone);
    nav.touch();
  }

  /** 场景精英 (9 级): at most one per field; it stands in its own scene (one slot over the usual count). */
  maybeElite(zone: ZoneId) {
    const nav = this.nodes;
    const s = this.ctrl.state;
    if (!nav || !has(s.level, 'elite') || this.monsters.some((m) => m.elite && m.zone === zone)) return;
    const taken = this.aliveIds();
    for (const sc of scenesOf(this.map.region)) {
      if (sc.zone !== zone || sc.type !== 'field' || sc === nav.here || !nav.revealed(sc)) continue;
      const pick = elitePick(s, sc, taken, undefined, Math.random);
      if (!pick) continue;
      const sp = nav.spot(zone, true, pick.words[0]);
      if (!sp || sp.sc.id !== sc.id) continue;
      const w = WORD_BY_ID[pick.words[0]];
      const m = this.addMonster(w, pick.review ? 'due' : 'new', zone, sp.x, sp.y);
      m.node = sc.id;
      m.elite = pick;
      this.styleMonster(m);
      return;
    }
  }

  /** 场景刷空: a backfill slot meant for a 残句 (removed again when the field already has one). */
  private phraseSlot(m: MonsterEntity, zone: ZoneId) {
    if (this.monsters.some((o) => o !== m && o.phrase && o.zone === zone)) {
      m.container.destroy();
      this.monsters = this.monsters.filter((o) => o !== m);
      return;
    }
    this.makePhrase(m, zone);
  }

  /** Turn a freshly placed monster into a 残句 carrying a card you don't have yet (or any card). */
  private makePhrase(m: MonsterEntity, zone: ZoneId) {
    const s = this.ctrl.state;
    if (this.monsters.some((o) => o.phrase && o.zone === zone)) return;
    const cards = phraseCards();
    const fresh = cards.filter((x) => !s.sayings?.[x.id]);
    const pickFrom = fresh.length ? fresh : cards;
    const x = pickFrom[Math.floor(Math.random() * pickFrom.length)];
    m.container.destroy();
    this.monsters = this.monsters.filter((o) => o !== m);
    const p = this.addMonster(phraseWord(x.id, s.level, zone), 'new', zone, m.x, m.y);
    p.node = m.node;
    p.phrase = x.id;
    this.styleMonster(p);
  }

  /** 残句 (0.5, Lv3+): about 1 spawn slot in 10 (1 in 30 once every card is in), at most one per field. */
  private maybePhrase(zone: ZoneId, added: number, tiles: Array<{ x: number; y: number }>, spot?: () => { x: number; y: number; sc: { id: string } } | null) {
    const s = this.ctrl.state;
    if (s.level < SAYING_CFG.fromLevel || !added || (!tiles.length && !spot) || this.monsters.some((m) => m.phrase && m.zone === zone)) return;
    const cards = phraseCards();
    const fresh = cards.filter((x) => !s.sayings?.[x.id]);
    const per = fresh.length ? 0.1 : 1 / 30;
    if (Math.random() >= 1 - Math.pow(1 - per, added)) return;
    const pickFrom = fresh.length ? fresh : cards;
    const x = pickFrom[Math.floor(Math.random() * pickFrom.length)];
    const sp = spot ? spot() : null;
    if (spot && !sp) return;
    const c = tiles.length ? tiles[Math.floor(Math.random() * tiles.length)] : { x: 0, y: 0 };
    const m = this.addMonster(phraseWord(x.id, s.level, zone), 'new', zone, sp ? sp.x : c.x * TILE + 8, sp ? sp.y : c.y * TILE + 8);
    if (sp) m.node = sp.sc.id;
    m.phrase = x.id;
    this.styleMonster(m);
  }

  /** Region 2 (Lv11+): about 1 respawn in 10 brings a 宝箱怪 or turns a new monster rare. */
  private maybeRare(zone: ZoneId, added: number, tiles: Array<{ x: number; y: number }>, spot?: () => { x: number; y: number; sc: { id: string } } | null) {
    const s = this.ctrl.state;
    if (this.map.region < 2 || !has(s.level, 'flee') || (!tiles.length && !spot) || Math.random() >= 0.1) return;
    if (this.monsters.some((m) => m.rare && m.zone === zone)) return;
    const truhe = WORD_BY_ID['truhe'];
    if (truhe && Math.random() < 0.5) {
      const sp = spot ? spot() : null;
      if (spot && !sp) return;
      const c = tiles.length ? tiles[Math.floor(Math.random() * tiles.length)] : { x: 0, y: 0 };
      const m = this.addMonster(truhe, 'new', zone, sp ? sp.x : c.x * TILE + 8, sp ? sp.y : c.y * TILE + 8);
      if (sp) m.node = sp.sc.id;
      m.rare = true;
      this.styleMonster(m);
    } else if (added > 0) {
      const m = this.monsters[this.monsters.length - 1];
      if (m.zone === zone && !m.isEcho) {
        m.rare = true;
        this.styleMonster(m);
      }
    }
  }

  addMonster(word: Word, kind: MonsterEntity['kind'], zone: ZoneId, x: number, y: number, opts: { isEcho?: boolean; scripted?: 'loss' | 'trial' } = {}): MonsterEntity {
    const label = this.add.text(0, 0, '', { fontFamily: FONT, fontSize: '9px', fontStyle: 'bold', color: '#fff', resolution: 4 }).setOrigin(0.5, 1);
    const teeth = this.add.text(0, 1, '', { fontFamily: FONT, fontSize: '5px', color: '#ff3040', resolution: 4 }).setOrigin(0.5, 0);
    const marker = this.add.text(0, -12, '', { fontFamily: FONT, fontSize: '8px', fontStyle: 'bold', color: '#ffcf4a', resolution: 4 }).setOrigin(0.5, 1);
    const shadow = this.add.ellipse(0, 4, 18, 4, 0x000000, 0.6);
    // 怪物美术: the word's look, own colours on bright maps, the map's dark ramp on 蚀变 maps.
    const art = wordArt(word);
    const bk = `mon-${artKey(art)}${this.bright ? '-raw' : this.ramp ? `-${this.ramp[3]}` : ''}`;
    const sheetKey: Record<SheetId, string> = { d: 'dungeon', t: 'town', f: 'farm', b: 'battle', c: '' };
    const src = art.sheet === 'c' ? null : this.textures.exists(sheetKey[art.sheet]) ? (this.textures.get(sheetKey[art.sheet]).getSourceImage() as HTMLImageElement) : undefined;
    if (!this.textures.exists(bk) && src !== undefined) this.textures.addCanvas(bk, monsterCanvas(src, art, this.bright ? null : this.ramp ? shadeRamp(this.ramp) : SHADE_RAMP));
    const body = this.add.image(0, 5, bk).setOrigin(0.5, 1);
    label.setY(-14);
    teeth.setY(5);
    marker.setY(-25);
    const container = this.add.container(x, y, [shadow, body, label, teeth, marker]);
    const reveal = [...word.de].map(() => Math.random() < 0.5);
    const m: MonsterEntity = {
      uid: this.uid++,
      word,
      kind,
      zone,
      isEcho: !!opts.isEcho,
      scripted: opts.scripted,
      x,
      y,
      tx: x,
      ty: y,
      wait: Math.random() * 2,
      container,
      label,
      teeth,
      marker,
      reveal,
      stage: stageOf(this.ctrl.state, word),
    };
    // 红名怪 (81): some met verbs in the field come as born red-name 结构魔.
    if (!opts.isEcho && !opts.scripted && kind !== 'shadow' && redEligible(this.ctrl.state, word) && Math.random() < RED.chance) m.red = true;
    // 开口表达观点 (121): some monsters you have met open with a claim.
    else if (!opts.isEcho && !opts.scripted && kind !== 'shadow' && !m.elite && opinionEligible(this.ctrl.state, word) && Math.random() < OPINION.chance) m.opinion = true;
    this.styleMonster(m);
    this.monsters.push(m);
    this.nodes?.touch();
    container.setAlpha(0);
    this.tweens.add({ targets: container, alpha: m.kind === 'shadow' ? 0.5 : 1, duration: 600 });
    return m;
  }

  placeEcho() {
    const e = this.ctrl.state.echo;
    if (!e) return;
    const w = this.ctrl.wordById(e.wordId);
    if (!w) return;
    this.monsters = this.monsters.filter((m) => {
      if (m.word.id === w.id) {
        m.container.destroy();
        return false;
      }
      return true;
    });
    if ((w.region ?? 1) !== this.map.region) return;
    const z = zoneAt(e.x, e.y, this.map.region)?.id ?? w.zone;
    this.addMonster(w, 'new', z, e.x, e.y, { isEcho: true });
  }

  styleMonster(m: MonsterEntity) {
    const s = this.ctrl.state;
    // 斩杀: a word waiting for verification shows no letters on the map either.
    m.stage = !m.phrase && needsVerify(s, m.word, now(s)) ? 0 : stageOf(s, m.word, now(s));
    // 词性三相 (0.5): the map never shows a monster's gender either (no article colors).
    const color = m.phrase ? '#ffcf4a' : m.stage === 0 ? PAL.bone : '#c3a9ff';
    m.label.setColor(color);
    m.label.setShadow(0, 0, m.stage === 0 ? '#ff1830' : color, 6, true, true);
    m.teeth.setText('▼'.repeat(m.stage === 0 ? 4 : m.stage === 1 ? 2 : 1));
    m.marker.setText(m.isEcho ? '回响' : m.elite ? '◈ 精英' : m.rare ? '◆' : m.red ? (redAsleep(s) ? '红名 · 沉睡' : '红名') : m.opinion ? '❝ 观点' : m.challenge ? '▲ 挑战' : m.kind === 'due' ? '!' : '');
    m.marker.setColor(m.isEcho || m.rare ? '#ffcf4a' : m.elite ? '#ff9a3c' : '#ff5a5a');
    if (m.rare) m.label.setShadow(0, 0, '#ffcf4a', 8, true, true);
    if (m.elite) m.label.setShadow(0, 0, '#ff9a3c', 8, true, true);
    if (m.red) (m.label.setColor('#ff4a4a'), m.label.setShadow(0, 0, '#ff1830', 10, true, true), m.marker.setColor('#ff4a4a'));
    if (m.challenge && !m.elite && !m.rare && !m.isEcho) m.marker.setColor('#7fd4ff');
    // 美术小修 A (2026-11-26): on bright maps light plates and markers get a dark edge so they read on grass and sand.
    if (this.bright) {
      m.label.setStroke('#2d2118', 2);
      m.marker.setStroke('#2d2118', 2);
    }
    this.updateGlyph(m);
    m.container.setScale(m.kind === 'shadow' ? 0.85 : 1);
  }

  private plateNear(m: MonsterEntity): boolean {
    const here = this.nodes?.here?.id;
    if (!here || !m.node) return true;
    return m.node === here || neighbours(here).includes(m.node);
  }

  refreshPlates(): void {
    for (const m of this.monsters) this.updateGlyph(m);
  }

  /** 名牌 (Lucas 2026-11-25): the meaning in Chinese once you have met the word; glitch for a word never met and for
   *  蚀变 words. No German letters, no article. */
  updateGlyph(m: MonsterEntity) {
    const w = m.word;
    if (m.phrase) {
      const x = SAYINGS.find((y) => y.id === m.phrase);
      m.label.setText(x ? `${x.a} …` : '……');
      return;
    }
    // 0.8.4 (Lucas 11-26「按推荐」): only monsters in your scene and the scenes next to it wear a name plate; far
    // ones show just their figure, so a new character's map is not a sea of glitches.
    if (!this.plateNear(m)) {
      m.label.setText('');
      return;
    }
    const rnd = () => GLITCH[Math.floor(Math.random() * GLITCH.length)];
    const p = this.ctrl.state.words[w.id];
    const met = !!p;
    const presumed = !!p?.placed && !p.retired; // 快速通道: 名牌标「推定会」
    m.label.setText(!met || w.erode ? Array.from({ length: Math.max(3, Math.min(9, w.de.length)) }, rnd).join('') : presumed ? `推定会·${plateZh(w)}` : plateZh(w));
  }

  removeMonster(m: MonsterEntity, how: 'scatter' | 'guiming' | 'flee') {
    this.monsters = this.monsters.filter((x) => x !== m);
    if (how === 'guiming') {
      m.label.setText(fullForm(m.word));
      m.teeth.setText('');
      m.marker.setText('');
      this.tweens.add({ targets: m.container, y: m.y - 22, scale: 1.6, alpha: 0, duration: 1600, ease: 'Sine.easeOut', onComplete: () => m.container.destroy() });
    } else if (how === 'scatter') {
      const parts = this.add.particles(m.x, m.y, 'dot', {
        speed: { min: 20, max: 70 },
        lifespan: 600,
        quantity: 14,
        tint: [0xff2a3a, 0xe8dccf],
        scale: { start: 1, end: 0 },
        emitting: false,
      });
      parts.explode(14);
      this.time.delayedCall(800, () => parts.destroy());
      m.container.destroy();
    } else {
      this.tweens.add({ targets: m.container, alpha: 0, duration: 400, onComplete: () => m.container.destroy() });
    }
    this.nodes?.touch();
    if (!m.isEcho && !m.scripted) {
      this.respawnTimers[m.zone] = (this.respawnTimers[m.zone] ?? 0) + 1;
      this.time.delayedCall(9000 + Math.random() * 6000, () => {
        this.respawnTimers[m.zone] = Math.max(0, (this.respawnTimers[m.zone] ?? 1) - 1);
        if (this.scene.isActive()) this.fillZone(m.zone);
      });
    }
  }

  restyleAll() {
    for (const m of this.monsters) this.styleMonster(m);
    this.refreshSigns();
  }

  refreshSigns() {
    for (const sg of this.signTexts) {
      const w = this.ctrl.wordById(sg.wordId);
      if (!w) continue;
      const st = stageOf(this.ctrl.state, w);
      const glyphs = [...w.de].map((ch, i) => (st >= 3 || (st === 2 && i < w.de.length / 2) ? ch : GLITCH[(i * 7 + w.de.length) % GLITCH.length])).join('');
      sg.text.setText(glyphs);
      sg.text.setColor(st >= 3 ? '#f2e6d8' : '#6a4a4a');
    }
  }

  // ---- Battle focus ----------------------------------------------------------

  focusBattle(m: MonsterEntity) {
    this.frozen = true;
    this.moveTarget = null;
    this.player.anims.stop();
    // Step back so you and the monster stand face to face instead of on top of each other.
    const dx = this.player.x - m.x;
    const dy = this.player.y - m.y;
    const d = Math.hypot(dx, dy) || 1;
    const bx = m.x + (dx / d) * 18;
    const by = m.y + (dy / d) * 18;
    if (this.canStand(bx, by)) this.player.setPosition(bx, by);
    this.player.setFlipX(m.x < this.player.x);
    const cx = (m.x + this.player.x) / 2;
    const cy = (m.y + this.player.y) / 2;
    this.cameras.main.stopFollow();
    this.cameras.main.pan(cx, cy + 18, 400, 'Sine.easeInOut');
    this.cameras.main.zoomTo(this.cameras.main.zoom * 1.25, 400);
    this.ring?.destroy();
    this.ring = this.add.graphics().setDepth(5000);
    const r = Math.max(26, Math.hypot(m.x - this.player.x, m.y - this.player.y) / 2 + 16);
    this.ring.lineStyle(1, 0xff2a3a, 0.8);
    this.ring.strokeCircle(cx, cy, r);
    this.ring.lineStyle(1, 0xff2a3a, 0.3);
    this.ring.strokeCircle(cx, cy, r + 3);
    this.tweens.add({ targets: this.ring, alpha: 0.4, yoyo: true, repeat: -1, duration: 700 });
  }

  endFocus() {
    this.ring?.destroy();
    this.ring = undefined;
    this.fitZoom();
    this.cameras.main.startFollow(this.player, true, 0.15, 0.15);
    this.frozen = false;
    this.graceUntil = this.time.now + 1500;
  }

  shake(intensity = 0.006) {
    this.cameras.main.shake(160, intensity);
  }

  flashMonster(m: MonsterEntity) {
    this.tweens.add({ targets: m.container, x: m.x + 3, yoyo: true, repeat: 2, duration: 40 });
  }

  teleportToBonfire() {
    if (this.nodes) return this.nodes.goHub();
    const b = this.map.bonfire;
    this.player.setPosition(b.x * TILE + 8 + 16, b.y * TILE + 8 + 20);
    this.cameras.main.centerOn(this.player.x, this.player.y);
  }

  // ---- Update loop -------------------------------------------------------------

  update(_t: number, dtMs: number) {
    const dt = Math.min(0.05, dtMs / 1000);
    this.jitterTimer += dtMs;
    if (this.jitterTimer > 110) {
      this.jitterTimer = 0;
      for (const m of this.monsters) {
        if (m.stage === 0 || m.stage === 1) this.updateGlyph(m);
        if (m.stage === 0) m.label.setPosition((Math.random() - 0.5) * 1.5, (Math.random() - 0.5) * 1.5);
      }
    }
    if (this.nodes) {
      this.nodes.tick(dtMs);
      return;
    }
    this.updateMonsters(dt);
    if (this.frozen || this.ctrl.uiBlocking()) {
      this.player.anims.stop();
      return;
    }
    this.updatePlayer(dt);
    this.checkInteractions();
  }

  /** 越区引导: stepping into a field whose monsters are above your level asks first (once per field). */
  private zoneGate(x: number, y: number): boolean {
    const to = zoneAt(x, y, this.map.region);
    if (!to || !to.monsters) return true;
    const from = zoneAt(this.player.x, this.player.y, this.map.region);
    if (from?.id === to.id) return true;
    return this.ctrl.mayEnterZone(to.id);
  }

  private updatePlayer(dt: number) {
    let vx = 0;
    let vy = 0;
    const k = this.keys;
    if (this.cursors.left.isDown || k.A.isDown) vx -= 1;
    if (this.cursors.right.isDown || k.D.isDown) vx += 1;
    if (this.cursors.up.isDown || k.W.isDown) vy -= 1;
    if (this.cursors.down.isDown || k.S.isDown) vy += 1;
    if (vx || vy) this.moveTarget = null;
    else if (this.moveTarget) {
      const dx = this.moveTarget.x - this.player.x;
      const dy = this.moveTarget.y - this.player.y;
      const d = Math.hypot(dx, dy);
      if (d < 2) this.moveTarget = null;
      else {
        vx = dx / d;
        vy = dy / d;
      }
    }
    if (!vx && !vy) {
      this.player.anims.stop();
      this.player.setTexture('hero0');
      return;
    }
    const len = Math.hypot(vx, vy);
    const nx = this.player.x + (vx / len) * SPEED * dt;
    const ny = this.player.y + (vy / len) * SPEED * dt;
    let moved = false;
    if (!this.zoneGate(nx, ny)) {
      this.moveTarget = null;
      this.player.anims.stop();
      return;
    }
    if (this.canStand(nx, this.player.y)) {
      this.player.x = nx;
      moved = true;
    }
    if (this.canStand(this.player.x, ny)) {
      this.player.y = ny;
      moved = true;
    }
    if (!moved) this.moveTarget = null;
    if (vx) this.player.setFlipX(vx < 0);
    if (!this.player.anims.isPlaying) this.player.play('walk');
    this.player.setDepth(this.player.y);
    this.stepTimer += dt;
    if (this.stepTimer > 0.3) {
      this.stepTimer = 0;
      sfx.step();
    }
    this.ctrl.state.pos = { x: Math.round(this.player.x), y: Math.round(this.player.y) };
  }

/** Redraws your own hero from state.look (title, login prompt, bonfire). */
  dsheet(): HTMLImageElement {
    return this.textures.get('dungeon').getSourceImage() as HTMLImageElement;
  }

  applyLook(): void {
    const frames = heroFramesKenney(this.ctrl.state.look ?? DEFAULT_LOOK, this.dsheet(), true, this.bright);
    ['hero0', 'hero1'].forEach((k, i) => {
      const t = this.textures.get(k) as Phaser.Textures.CanvasTexture;
      t.context.clearRect(0, 0, 16, 16);
      t.context.drawImage(frames[i], 0, 0);
      t.refresh();
    });
  }

  canStand(x: number, y: number): boolean {
    const pts = [
      [x - 4, y - 1],
      [x + 4, y - 1],
      [x - 4, y + 2],
      [x + 4, y + 2],
    ];
    return pts.every(([px, py]) => !isBlocked(this.map, Math.floor(px / TILE), Math.floor(py / TILE)));
  }

  private updateMonsters(dt: number) {
    if (this.frozen) return;
    for (const m of this.monsters) {
      m.container.setDepth(m.y);
      if (m.isEcho || m.scripted) continue;
      // 红名怪: sees you within RED.sight and runs at you (asleep after a long absence).
      if (m.red && !redAsleep(this.ctrl.state) && !this.ctrl.uiBlocking()) {
        const px = this.player.x - m.x;
        const py = this.player.y - m.y;
        const pd = Math.hypot(px, py);
        if (pd < RED.sight && pd > 1) {
          m.chasing = true;
          const st = Math.min(pd, RED.speed * dt);
          const nx = m.x + (px / pd) * st;
          const ny = m.y + (py / pd) * st;
          if (!isBlocked(this.map, Math.floor(nx / TILE), Math.floor(ny / TILE))) {
            m.x = m.tx = nx;
            m.y = m.ty = ny;
            m.container.setPosition(m.x, m.y);
          }
          continue;
        }
        m.chasing = false;
      }
      m.wait -= dt;
      if (m.wait > 0) continue;
      const dx = m.tx - m.x;
      const dy = m.ty - m.y;
      const d = Math.hypot(dx, dy);
      if (d < 1) {
        m.wait = 1.5 + Math.random() * 3;
        const z = this.zones.find((q) => q.id === m.zone);
        if (!z) continue;
        const ntx = m.x + (Math.random() - 0.5) * 60;
        const nty = m.y + (Math.random() - 0.5) * 60;
        const r = z.rect;
        const inside = ntx > r.x * TILE && ntx < (r.x + r.w) * TILE && nty > r.y * TILE && nty < (r.y + r.h) * TILE;
        if (inside && !isBlocked(this.map, Math.floor(ntx / TILE), Math.floor(nty / TILE))) {
          m.tx = ntx;
          m.ty = nty;
        }
        continue;
      }
      const step = Math.min(d, 18 * dt);
      const nx = m.x + (dx / d) * step;
      const ny = m.y + (dy / d) * step;
      if (isBlocked(this.map, Math.floor(nx / TILE), Math.floor(ny / TILE))) {
        m.tx = m.x;
        m.ty = m.y;
        continue;
      }
      m.x = nx;
      m.y = ny;
      m.container.setPosition(m.x, m.y);
    }
  }

  private checkInteractions() {
    const px = this.player.x;
    const py = this.player.y;
    if (this.time.now > this.graceUntil) {
      for (const m of this.monsters) {
        if (Math.abs(m.x - px) < 11 && Math.abs(m.y - py) < 11) {
          if (m.red && m.chasing) return this.ctrl.redCatch(m);
          if (m.opinion) return this.ctrl.opinion(m);
          this.ctrl.encounter(m);
          return;
        }
      }
    }
    const near = (tx: number, ty: number, r = 22) => Math.hypot(tx * TILE + 8 - px, ty * TILE + 8 - py) < r;
    let it: WorldScene['interactable'] = null;
    if (near(this.map.bonfire.x, this.map.bonfire.y, 26)) it = { kind: 'bonfire' };
    else if (this.map.npcs.some((n) => near(n.x, n.y))) it = { kind: 'npc', data: this.map.npcs.find((n) => near(n.x, n.y))!.id };
    else if (this.map.gates.some((g) => near(g.x, g.y, 20))) it = { kind: 'gate', data: String(this.map.gates[0].to) };
    else if (near(this.map.door.x, this.map.door.y, 30) || near(this.map.door.x, this.map.door.y + 1, 30)) it = { kind: 'door' };
    else for (const sg of this.map.signs) if (near(sg.x, sg.y, 18)) it = { kind: 'sign', data: sg.wordId };
    if (it?.kind !== this.interactable?.kind || it?.data !== this.interactable?.data) {
      this.interactable = it;
      this.ctrl.setPrompt(it);
    }
    if (it && Phaser.Input.Keyboard.JustDown(this.keys.E)) this.ctrl.interact(it);
  }

  familyName(m: MonsterEntity): string {
    return FAMILIES[m.word.family].zh;
  }
}
