import Phaser from 'phaser';
import './ui/style.css';
import { load, newGame, save, saveRaw, setSaveHook } from './core/state';
import { cloud, initCloud, mustChangePassword, push, schedulePush, syncOnBoot } from './net/cloud';
import { loginView } from './ui/account';
import { mountChat } from './ui/chat';
import { $ } from './ui/dom';
import { joinRegion, leave, update } from './net/online';
import { h } from './ui/dom';
import { Controller } from './game/controller';
import { WorldScene } from './game/WorldScene';
import { showTitle } from './ui/title';
import { importJson } from './core/state';
import { toast } from './ui/feedback';

const VERSION = '0.3.0';
const dev = new URLSearchParams(location.search).has('dev');

function boot(state: ReturnType<typeof newGame>) {
  const ctrl = new Controller(state, dev);
  (window as unknown as { wk: Controller }).wk = ctrl; // handy for debugging in the console
  // 联机第一档: about once a second, join the region room and send your position if it changed.
  const chat = mountChat();
  window.setInterval(() => {
    const st = ctrl.state;
    const ready = !!cloud.session && !!cloud.profile && !mustChangePassword();
    chat.setVisible(ready && $('title').hidden);
    if (!ready) return leave();
    if (!st.look) return;
    const me = { region: st.region ?? 1, look: st.look, x: st.pos.x, y: st.pos.y, fighting: !!ctrl.battle || !!ctrl.boss };
    joinRegion(me);
    update(me);
  }, 1000);
  if (cloud.session && !mustChangePassword() && (!cloud.profile || !state.look)) window.setTimeout(() => ctrl.panels.show('account'), 2500);
  new Phaser.Game({
    type: Phaser.AUTO,
    parent: 'game',
    backgroundColor: '#07040a',
    pixelArt: true,
    scale: { mode: Phaser.Scale.RESIZE, width: window.innerWidth, height: window.innerHeight },
    scene: [],
    callbacks: {
      postBoot: (game) => {
        game.scene.add('world', WorldScene, true, { ctrl });
      },
    },
  });
}

async function start() {
  await initCloud();
  const local = load();
  const existing = await syncOnBoot(local);
  if (existing && existing !== local) saveRaw(existing); // adopt the newer cloud save as-is
  setSaveHook(schedulePush);
  document.addEventListener('visibilitychange', () => {
    const wk = (window as unknown as { wk?: Controller }).wk;
    if (document.visibilityState === 'hidden' && wk) void push(wk.state);
  });
  title(existing);
}

function title(existing: ReturnType<typeof load>) {
// Title-screen account line: log in here, then reload so the cloud save is picked up.
let account: HTMLElement | undefined;
if (!cloud.session || mustChangePassword()) {
  account = h('div.form.panel');
  const inner = h('div');
  const open = h('button.btn.ghost', { onclick: () => { open.remove(); loginView(inner, () => location.reload()); } }, '登录账号（云存档、排行榜）');
  account.append(open, inner);
  if (cloud.session) open.click();
} else account = h('p.small.muted', `已登录 ${cloud.profile?.nickname ?? cloud.session.user.email ?? ''} · 云存档${cloud.status === 'offline' ? '暂时连不上，先存本地' : '已同步'}`);
showTitle({
  account,
  existing,
  version: VERSION,
  onContinue: () => boot(existing!),
  onNew: (name, origin, look) => {
    const s = newGame(name, origin);
    s.look = look;
    save(s);
    boot(s);
  },
  onImport: (text) => {
    const s = importJson(text);
    if (!s) return toast('这个文件不是失语纪元的存档');
    save(s);
    location.reload();
  },
});
}

void start();
