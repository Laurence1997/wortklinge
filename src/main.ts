import Phaser from 'phaser';
import './ui/style.css';
import { load, newGame, save } from './core/state';
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

const existing = load();
showTitle({
  existing,
  version: VERSION,
  onContinue: () => boot(existing!),
  onNew: (name, origin) => {
    const s = newGame(name, origin);
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
