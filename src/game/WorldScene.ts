import Phaser from 'phaser';
import { stageOf, type Stage } from '../core/srs';
import { now } from '../core/state';
import type { Word, ZoneId } from '../core/types';
import { fullForm, genderOf } from '../data/words';
import { FAMILIES } from '../data/families';
import type { Controller } from './controller';
import { generateMap, isBlocked, MAP_H, MAP_W, TILE, walkableTilesIn, zonesOf, zoneAt, type MapData, type NpcId, type RegionId, type ZoneDef } from './map';
import { ARTICLE_COLOR, GLITCH, makeTextures, renderMapCanvas, PAL } from './sprites';
import { sfx } from './audio';

export interface MonsterEntity {
  uid: number;
  word: Word;
  kind: 'new' | 'due' | 'shadow';
  zone: ZoneId;
  isEcho: boolean;
  scripted?: 'loss' | 'trial';
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
}

const SPEED = 72;
const FONT = '"Courier New", ui-monospace, monospace';

export class WorldScene extends Phaser.Scene {
  ctrl!: Controller;
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
  private interactable: { kind: 'bonfire' | 'npc' | 'door' | 'sign' | 'gate'; data?: string } | null = null;

  constructor() {
    super('world');
  }

  init(data: { ctrl: Controller }) {
    this.ctrl = data.ctrl;
  }

  create() {
    const region: RegionId = this.ctrl.state.region ?? 1;
    this.map = generateMap(region);
    this.zones = zonesOf(region);
    this.monsters = [];
    this.signTexts = [];
    this.respawnTimers = {};
    this.interactable = null;
    const tex = makeTextures();
    const addCanvas = (key: string, cv: HTMLCanvasElement) => {
      if (this.textures.exists(key)) this.textures.remove(key);
      this.textures.addCanvas(key, cv);
    };
    addCanvas('map', renderMapCanvas(this.map));
    addCanvas('hero0', tex.hero[0]);
    addCanvas('hero1', tex.hero[1]);
    addCanvas('hilde', tex.hilde);
    addCanvas('fire0', tex.fire[0]);
    addCanvas('fire1', tex.fire[1]);
    addCanvas('sign', tex.sign);
    addCanvas('glow', tex.glow);
    addCanvas('dot', tex.dot);

    this.add.image(0, 0, 'map').setOrigin(0, 0);
    const W = MAP_W * TILE;
    const H = MAP_H * TILE;
    this.cameras.main.setBounds(0, 0, W, H);
    this.cameras.main.setBackgroundColor(PAL.void);

    // Light sources.
    const b = this.map.bonfire;
    const bx = b.x * TILE + 8;
    const by = b.y * TILE + 8;
    this.add.image(bx, by, 'glow').setScale(2.2).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.9);
    const fire = this.add.sprite(bx, by - 2, 'fire0').setDepth(by);
    if (!this.anims.exists('burn')) this.anims.create({ key: 'burn', frames: [{ key: 'fire0' }, { key: 'fire1' }], frameRate: 5, repeat: -1 });
    fire.play('burn');
    this.tweens.add({ targets: fire, scaleX: 1.08, yoyo: true, repeat: -1, duration: 420 });
    for (const l of this.map.lamps) {
      this.add.image(l.x * TILE + 8, l.y * TILE + 4, 'glow').setScale(0.9).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.6);
    }
    const d = this.map.door;
    this.add.image(d.x * TILE + 8, d.y * TILE + 16, 'glow').setScale(1.1).setTint(0xff2040).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.7);

    // NPCs and signs. Region-2 NPCs reuse Hilde's figure with their own tint until they get sprites.
    const NPC_TINT: Record<NpcId, number> = { hilde: 0xffffff, greta: 0x9fc4ff, mira: 0xffd27a, konrad: 0xe8b48a };
    const NPC_LABEL: Record<NpcId, string> = { hilde: 'Hilde', greta: 'Greta', mira: 'Mira', konrad: 'Konrad' };
    for (const n of this.map.npcs) {
      this.add.sprite(n.x * TILE + 8, n.y * TILE + 6, 'hilde').setDepth(n.y * TILE + 8).setTint(NPC_TINT[n.id]);
      if (this.map.region === 2)
        this.add
          .text(n.x * TILE + 8, n.y * TILE - 6, NPC_LABEL[n.id], { fontFamily: FONT, fontSize: '6px', color: '#d8c8b8', resolution: 4 })
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
        .text((z.rect.x + z.rect.w / 2) * TILE, (z.rect.y + 1.2) * TILE, `${z.de} · ${z.zh} · ${z.levels}`, {
          fontFamily: FONT,
          fontSize: '8px',
          color: '#5a2a2e',
          resolution: 4,
        })
        .setOrigin(0.5)
        .setDepth(1);
    }

    // Player.
    const s = this.ctrl.state;
    const start = s.pos.x ? s.pos : { x: this.map.start.x * TILE + 8, y: this.map.start.y * TILE + 8 };
    this.player = this.add.sprite(start.x, start.y, 'hero0').setOrigin(0.5, 0.85);
    if (!this.anims.exists('walk')) this.anims.create({ key: 'walk', frames: [{ key: 'hero0' }, { key: 'hero1' }], frameRate: 6, repeat: -1 });
    this.cameras.main.startFollow(this.player, true, 0.15, 0.15);
    this.cameras.main.setZoom(3);
    this.cameras.main.roundPixels = true;
    this.scale.on('resize', () => this.fitZoom());
    this.fitZoom();

    const kb = this.input.keyboard!;
    this.cursors = kb.createCursorKeys();
    this.keys = kb.addKeys('W,A,S,D,E') as Record<string, Phaser.Input.Keyboard.Key>;
    kb.disableGlobalCapture();
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      if (this.frozen) return;
      this.moveTarget = { x: p.worldX, y: p.worldY };
    });

    this.spawnAll();
    this.ctrl.onSceneReady(this);
  }

  fitZoom() {
    const w = this.scale.width;
    this.cameras.main.setZoom(w < 900 ? 2 : w > 1700 ? 4 : 3);
  }

  // ---- Monsters ------------------------------------------------------------

  aliveIds(): Set<string> {
    return new Set(this.monsters.map((m) => m.word.id));
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
      this.addMonster(p.word, p.kind, zone, spot.x * TILE + 8, spot.y * TILE + 8);
    }
  }

  addMonster(word: Word, kind: MonsterEntity['kind'], zone: ZoneId, x: number, y: number, opts: { isEcho?: boolean; scripted?: 'loss' | 'trial' } = {}): MonsterEntity {
    const label = this.add.text(0, 0, '', { fontFamily: FONT, fontSize: '9px', fontStyle: 'bold', color: '#fff', resolution: 4 }).setOrigin(0.5, 1);
    const teeth = this.add.text(0, 1, '', { fontFamily: FONT, fontSize: '5px', color: '#ff3040', resolution: 4 }).setOrigin(0.5, 0);
    const marker = this.add.text(0, -12, '', { fontFamily: FONT, fontSize: '8px', fontStyle: 'bold', color: '#ffcf4a', resolution: 4 }).setOrigin(0.5, 1);
    const shadow = this.add.ellipse(0, 4, 18, 4, 0x000000, 0.6);
    const container = this.add.container(x, y, [shadow, label, teeth, marker]);
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
    this.styleMonster(m);
    this.monsters.push(m);
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
    m.stage = stageOf(s, m.word, now(s));
    const g = genderOf(m.word);
    const artColor = g ? ARTICLE_COLOR[g] : '#c3a9ff';
    const color = m.stage === 0 ? PAL.bone : artColor;
    m.label.setColor(color);
    m.label.setShadow(0, 0, m.stage === 0 ? '#ff1830' : color, 6, true, true);
    m.teeth.setText('▼'.repeat(m.stage === 0 ? 4 : m.stage === 1 ? 2 : 1));
    m.marker.setText(m.isEcho ? '回响' : m.kind === 'due' ? '!' : '');
    m.marker.setColor(m.isEcho ? '#ffcf4a' : '#ff5a5a');
    this.updateGlyph(m);
    m.container.setScale(m.kind === 'shadow' ? 0.85 : 1);
  }

  /** The name restores with 归名: garbage → half-revealed → "der Ap▒▒". */
  updateGlyph(m: MonsterEntity) {
    const w = m.word;
    const rnd = () => GLITCH[Math.floor(Math.random() * GLITCH.length)];
    let txt: string;
    if (m.stage === 0) {
      const n = Math.max(3, Math.min(9, w.de.length));
      txt = Array.from({ length: n }, rnd).join('');
    } else if (m.stage === 1) {
      txt = [...w.de].map((ch, i) => (ch === ' ' ? ' ' : m.reveal[i] ? ch : rnd())).join('');
    } else {
      const half = Math.ceil(w.de.length / 2);
      txt = (w.art ? w.art + ' ' : '') + w.de.slice(0, half) + '▒'.repeat(Math.max(1, w.de.length - half));
    }
    m.label.setText(txt);
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
    this.updateMonsters(dt);
    if (this.frozen || this.ctrl.uiBlocking()) {
      this.player.anims.stop();
      return;
    }
    this.updatePlayer(dt);
    this.checkInteractions();
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
