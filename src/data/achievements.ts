// 成就 (0.5 节奏表, minimal version): shown in the codex, a gold toast when earned, a title only (no stats).
export interface Achievement {
  id: string;
  zh: string;
  title: string;
  how: string;
}

export const ACHIEVEMENTS: Achievement[] = [
  { id: 'weak5', zh: '五连弱点', title: '「辨相者」', how: '连续 5 次选对相，打中弱点' },
  { id: 'half1', zh: '第一个半名', title: '「叫得出口」', how: '第一个词进入「半名」：你认得它了' },
  { id: 'card1', zh: '第一张短句卡', title: '「拾句人」', how: '打散一只接句怪或残句，收下第一张短句卡' },
];

/** Story notes (纸条), found as drops. */
export const NOTES: Array<{ id: string; zh: string; text: string }> = [
  {
    id: 'neighbour',
    zh: '邻居留下的纸条',
    text: '纸被火烤得发脆，字是德语，歪歪扭扭：「Bin gleich zurück.」马上回来。下面用中文补了一行，笔迹不一样：「别等了。它在门后数名字。」',
  },
];
