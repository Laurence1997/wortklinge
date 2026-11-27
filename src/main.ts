import { applyTheme } from './ui/theme';
import Phaser from 'phaser';
import './ui/style.css';
import { checkImport, importPrompt, load, markSaved, newGame, save, saveRaw, setSaveHook } from './core/state';
import { cloud, initCloud, mustChangePassword, needsNickname, push, schedulePush, setNickname, syncOnBoot } from './net/cloud';
import { loginView } from './ui/account';
import { $ } from './ui/dom';
import { mountLogBox } from './ui/logbox';
import { joinWorld } from './net/social';
import { initAdvChat } from './net/advChat';
import { h } from './ui/dom';
import { Controller } from './game/controller';
import { WorldScene } from './game/WorldScene';
import { showTitle } from './ui/title';
import { hideLoading, setTip, showLoading } from './ui/loading';
import { toast } from './ui/feedback';
import { setReportVersion } from './net/report';
import { loadPassages } from './data/passages';
import { loadArticlesB2, loadArticlesC1 } from './data/articlesB2';

const VERSION = '1.0.6';
setReportVersion(VERSION);
// 审查 B3: the dev menu (+1 级 …) only on localhost or a dev build, never on the live site.
const dev = new URLSearchParams(location.search).has('dev') && (import.meta.env.DEV || ['localhost', '127.0.0.1'].includes(location.hostname));

function boot(state: ReturnType<typeof newGame>) {
  showLoading('正在点燃篝火…');
  const ctrl = new Controller(state, dev);
  if (state.level >= 115) void loadArticlesB2(); // 文章群怪 from 121: its own chunk
  if (state.level >= 155) void loadArticlesC1(); // C1 文章怪 from 161
  if (state.level >= 30) void loadPassages(); // 听段 from 34: its own chunk, fetched once the player is close
  (window as unknown as { wk: Controller }).wk = ctrl; // handy for debugging in the console
  const logBox = mountLogBox();
  joinWorld(() => ({ level: ctrl.state.level, hidden: !!ctrl.state.settings.hideBoard }));
  initAdvChat(() => ctrl.state);
  window.setInterval(() => logBox.setVisible($('title').hidden), 1000);
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
  // Login required: without a (cached) session the title screen only offers the login box.
  if (!cloud.session || mustChangePassword() || needsNickname()) return loginOnly();
  setTip('正在读取存档…');
  const local = load();
  const existing = await syncOnBoot(local);
  if (existing && existing !== local) saveRaw(existing); // adopt the newer cloud save as-is
  if (existing) markSaved(existing); // unchanged since loading: no restamp (审查 A1)
  setSaveHook(schedulePush);
  window.addEventListener('wk-cloud-conflict', () => toast('这个角色在别的页面或电脑上有更新的进度，这里先不再上传。请刷新页面载入最新进度。', 'bad'));
  document.addEventListener('visibilitychange', () => {
    const wk = (window as unknown as { wk?: Controller }).wk;
    if (document.visibilityState === 'hidden' && wk) void push(wk.state);
  });
  title(existing);
}

function loginOnly() {
  hideLoading();
  const el = $('title');
  el.hidden = false;
  applyTheme(true, 1); // 标题页跟日常区一样明亮 (Lucas 11-26)
  const inner = h('div.panel.login');
  el.replaceChildren(
    h(
      'div.box',
      h('h1', 'Wortklinge', h('small', '失 语 纪 元')),
      h('div.lore', '一夜之间，无名之物吃掉了世界的名字。', h('br'), '面包长出牙齿，街牌在低语，幸存者只能发出含混的声音。', h('br'), '你在篝火旁醒来。叫对一个名字，它就会变回原样。'),
      inner,
      h('div.ver', `v${VERSION} · 请用电脑上的 Chrome 打开，开声音`),
    ),
  );
  loginView(inner, () => location.reload());
}

function title(existing: ReturnType<typeof load>) {
// Lucas 11-26: the title greets you by your character's name; the account nickname (排行榜) only when there is no save.
const account = h('p.small.muted', `已登录 ${existing?.name ?? cloud.profile?.nickname ?? cloud.session?.user.email ?? ''} · 云存档${cloud.status === 'offline' ? '暂时连不上，先存本地，联网后自动同步' : '已同步'}`);
hideLoading();
showTitle({
  account,
  existing,
  version: VERSION,
  cloudFailed: !existing && !!cloud.session && cloud.status === 'offline',
  onRetry: () => location.reload(),
  onContinue: () => boot(existing!),
  onNew: (name, origin, look) => {
    const s = newGame(name, origin);
    s.look = look;
    s.owner = cloud.session?.user.id;
    save(s, true);
    // A new character's name becomes the leaderboard / chat nickname too, so the game uses one name (Lucas 11-26).
    // If someone else already has it the old nickname stays and the account panel can change it.
    if (cloud.session && cloud.profile && cloud.profile.nickname !== name.trim())
      void setNickname(s, name).then((err) => err && toast(`排行榜昵称没改成「${name.trim()}」：${err}。可以在「账号」里改。`, 'bad'));
    boot(s);
  },
  onImport: (text) => {
    const r = checkImport(text);
    if (!r.ok) return toast(r.why);
    if (!window.confirm(importPrompt(r.s, existing))) return;
    save(r.s, true);
    void push(r.s);
    location.reload();
  },
});
}

void start();
