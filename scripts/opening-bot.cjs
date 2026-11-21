// Timed bot run of the opening on the scene map: a fresh account, balance-type answers, simulated seconds.
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1400, height: 860 } });
  const errs = [];
  p.on('pageerror', (e) => errs.push(e.message + ' ' + (e.stack || '').split('\n').slice(0, 2).join(' | ')));
  const base = 'http://localhost:5179/';
  await p.goto(base + '?dev=1');
  await p.waitForTimeout(2500);
  await p.evaluate(async ({ base }) => {
    const Phaser = (await import(base + 'node_modules/.vite/deps/phaser.js')).default;
    const { Controller } = await import(base + 'src/game/controller.ts');
    const { WorldScene } = await import(base + 'src/game/WorldScene.ts');
    const { CONFIG } = await import(base + 'src/core/config.ts');
    CONFIG.map.hopSec = 0.02;
    const st = await import(base + 'src/core/state.ts');
    const s = st.newGame('Bot', 'student');
    document.getElementById('title').hidden = true;
    const ctrl = new Controller(s, true);
    window.wk = ctrl;
    new Phaser.Game({ type: Phaser.AUTO, parent: 'game', pixelArt: true, scale: { mode: Phaser.Scale.RESIZE, width: 1400, height: 860 }, scene: [], callbacks: { postBoot: (g) => g.scene.add('world', WorldScene, true, { ctrl }) } });
  }, { base });
  await p.waitForTimeout(2500);
  const MIN = +(process.env.MIN ?? 70);
  const res = await p.evaluate(async ({ base, MIN }) => {
    const { qTier, needsPhase, phaseOf, moveReady } = await import(base + 'src/core/combat.ts');
    const { SCENES, routeTo } = await import(base + 'src/data/world.ts');
    const { maxHp } = await import(base + 'src/core/state.ts');
    const { has } = await import(base + 'src/core/unlocks.ts');
    const wk = window.wk; const ui = wk.battleUI; const s = wk.state;
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    let t = 0; // simulated seconds
    const ACC = [0.95, 0.8, 0.65], QT = [3, 6, 10], PA = 0.85;
    const rng = Math.random;
    const tick = () => { s.flags.playSec = Math.round(t); };
    const log = [];
    const drain = async () => {
      for (let i = 0; i < 80; i++) {
        const d = document.getElementById('dialog');
        const modal = document.getElementById('modal');
        if (!modal.hidden) { t += 3; tick(); wk.panels.close(); await sleep(20); continue; }
        if (d.hidden) return;
        t += 2.5; tick();
        const cs = [...d.querySelectorAll('.choices button')];
        if (cs.length) { const go = cs.find((c) => /进去|穿过/.test(c.innerText)); (go ?? cs[cs.length - 1]).click(); }
        else window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
        await sleep(15);
      }
    };
    const zoneFor = (L) => (L <= 2 ? 'echogasse' : L <= 6 ? 'schilderstrasse' : 'aschehof');
    const nav = () => wk.scene.nodes;
    let fights = 0;
    while (t < MIN * 60) {
      await drain();
      if (wk.battle) {
        const bt = wk.battle;
        if (ui.phase === 'choose') {
          if (needsPhase(bt) && !bt.phase) {
            const right = phaseOf(bt);
            const pick = rng() < PA ? right : ['der', 'die', 'das'].filter((x) => x !== right)[Math.floor(rng() * 2)];
            t += 1.2; tick(); ui.setPhase(pick); await sleep(10);
          }
          if (ui.phase === 'choose') { const mv = moveReady(s, bt, 'sentence') && ui.moves().includes('sentence') ? 'sentence' : 'attack'; ui.choose(mv); await sleep(10); }
        }
        if (ui.phase === 'answer' && ui.question) {
          const q = ui.question; const tier = qTier(q); const ok = rng() < ACC[tier];
          t += QT[tier] + (ok ? 1 : 2.6); tick();
          ui.submit(ok ? (q.answer ?? '') : 'zzz'); await sleep(10);
        }
        if (ui.phase === 'result') { ui.continue(); await sleep(10); }
        await drain();
        continue;
      }
      // Low HP: walk to the bonfire (from Lv3).
      const n = nav();
      if (has(s.level, 'bonfireRest') && s.hp < 0.35 * maxHp(s)) {
        const hub = SCENES.find((x) => x.region === (s.region ?? 1) && x.bonfire);
        const hops = routeTo(n.here.id, hub.id)?.length ?? 0;
        t += hops * 2; tick(); n.travel(hub.id); await sleep(hops * 40 + 60);
        t += 2; tick(); wk.interact({ kind: 'bonfire' }); await sleep(20); await drain();
        continue;
      }
      const here = n.monstersIn(n.here);
      const z = zoneFor(s.level);
      if (here.length && (n.here.zone === z || here.some((m) => m.word.id === 'brot' || m.isEcho || m.scripted))) {
        t += 0.5; tick(); fights++;
        wk.encounter(here[0]); await sleep(20);
        continue;
      }
      // Next field scene of the target zone with monsters.
      const cands = SCENES.filter((x) => x.region === (s.region ?? 1) && x.zone === z && n.revealed(x) && x.id !== n.here.id)
        .map((x) => ({ x, d: routeTo(n.here.id, x.id, n.revealed)?.length ?? 99, c: wk.scene.monsters.filter((m) => n.sceneOf(m).id === x.id).length }))
        .filter((o) => o.c > 0).sort((a, b) => a.d - b.d);
      if (!cands.length) { if (!window.__dbg) { window.__dbg = 1; log.push(JSON.stringify({ here: n.here.id, z, battle: !!wk.battle, block: wk.uiBlocking(), dlg: !document.getElementById('dialog').hidden, modal: !document.getElementById('modal').hidden, mons: wk.scene.monsters.map((m) => m.zone + ':' + (m.node || '')).slice(0, 12) })); } t += 1; tick(); await sleep(30); continue; }
      t += cands[0].d * 2; tick();
      n.travel(cands[0].x.id); await sleep(cands[0].d * 40 + 80);
      await drain();
    }
    const ms = Object.entries(s.flags).filter(([k]) => k.startsWith('ms_')).sort((a, b) => a[1] - b[1]).map(([k, v]) => `${String(v).padStart(5)}  ${k.slice(3)}`);
    return { level: s.level, fights, ms, log };
  }, { base, MIN });
  console.log('level', res.level, 'fights', res.fights);
  console.log(res.ms.join('\n')); console.log(res.log);
  console.log('errors', errs.slice(0, 5));
  await b.close();
})();
