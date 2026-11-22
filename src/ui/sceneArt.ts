// 场景插画 renderer: Kenney 1-Bit tiles tinted red on black; a word's things light up as the word reaches 半名.
import { ART_COLS, ART_ROWS, parseArt, SCENE_ART } from '../data/sceneArt';
import { WORD_BY_ID, fullForm } from '../data/words';
import { stageOf } from '../core/srs';
import type { GameState } from '../core/state';

const T = 16;
const SHEET_COLS = 49;
const COLORS = { bg: '#140404', decor: '#4e1616', unseen: '#7a1f1f', met: '#d8333a', half: '#ffb4a8' };
let sheet: HTMLImageElement | null = null;
const waiting: Array<() => void> = [];

function loadSheet(): HTMLImageElement {
  if (!sheet) {
    sheet = new Image();
    sheet.onload = () => waiting.splice(0).forEach((f) => f());
    sheet.src = './art/kenney-1bit.png';
  }
  return sheet;
}

export function hasSceneArt(sceneId: string): boolean {
  return !!SCENE_ART[sceneId];
}

/** The picture for a scene, or null when it has none. Hovering a lit thing names its word. */
export function sceneArtCanvas(sceneId: string, s: GameState): HTMLCanvasElement | null {
  const spec = SCENE_ART[sceneId];
  if (!spec) return null;
  const tiles = parseArt(spec);
  const cv = document.createElement('canvas');
  cv.width = ART_COLS * T;
  cv.height = ART_ROWS * T;
  cv.className = 'scene-art';
  const draw = () => {
    const ctx = cv.getContext('2d')!;
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = COLORS.bg;
    ctx.fillRect(0, 0, cv.width, cv.height);
    ctx.fillStyle = COLORS.decor;
    ctx.fillRect(0, ART_ROWS * T - 3, cv.width, 1);
    const tmp = document.createElement('canvas');
    tmp.width = tmp.height = T;
    const tc = tmp.getContext('2d')!;
    for (const t of tiles) {
      // 全量筛选: a word named in town lights up when you first walk in (its 待领 is still waiting here).
      const st = t.word ? (s.screen?.pending?.[sceneId]?.includes(t.word) ? 1 : stageOf(s, WORD_BY_ID[t.word])) : -1;
      tc.globalCompositeOperation = 'source-over';
      tc.clearRect(0, 0, T, T);
      tc.drawImage(sheet!, (t.tile % SHEET_COLS) * T, Math.floor(t.tile / SHEET_COLS) * T, T, T, 0, 0, T, T);
      tc.globalCompositeOperation = 'source-in';
      tc.fillStyle = st < 0 ? COLORS.decor : st >= 2 ? COLORS.half : st >= 1 ? COLORS.met : COLORS.unseen;
      tc.fillRect(0, 0, T, T);
      ctx.save();
      if (t.flip) {
        ctx.translate((t.col + 1) * T, 0);
        ctx.scale(-1, 1);
        ctx.drawImage(tmp, 0, t.row * T);
      } else ctx.drawImage(tmp, t.col * T, t.row * T);
      ctx.restore();
    }
  };
  const img = loadSheet();
  if (img.complete && img.naturalWidth) draw();
  else waiting.push(draw);
  cv.addEventListener('mousemove', (e) => {
    const r = cv.getBoundingClientRect();
    const col = Math.floor(((e.clientX - r.left) / r.width) * ART_COLS);
    const row = Math.floor(((e.clientY - r.top) / r.height) * ART_ROWS);
    const hit = tiles.find((t) => t.word && t.col === col && t.row === row);
    const w = hit ? WORD_BY_ID[hit.word!] : null;
    cv.title = w && stageOf(s, w) >= 1 ? `${fullForm(w)} · ${w.zh}` : w ? '▒▒▒（还没见过）' : '';
  });
  return cv;
}
