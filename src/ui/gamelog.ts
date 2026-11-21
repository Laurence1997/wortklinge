// 记录 (2026-11-21, Lucas): every answer, hit, kill, drop and passing toast lands here, so nothing that
// flashed by is lost. Last 200 lines, this session only (not saved). Shown in the bottom-left box (chat.ts).

export type LogTone = 'good' | 'bad' | 'info' | 'gold';
export interface GameLogLine {
  t: string;
  text: string;
  tone: LogTone;
}

const MAX = 200;
export const gameLog: GameLogLine[] = [];
const listeners: Array<() => void> = [];

export function logLine(text: string, tone: LogTone = 'info'): void {
  if (!text) return;
  const d = new Date();
  gameLog.push({ t: `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`, text, tone });
  if (gameLog.length > MAX) gameLog.splice(0, gameLog.length - MAX);
  for (const f of listeners) f();
}

export function onGameLog(f: () => void): void {
  listeners.push(f);
}
