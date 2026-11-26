// 17 区揭示「完美词典」(游戏设计 四「剧情：遗书真相」/「末日和系统的动机」/「世界观一致性」, Lucas 2026-11-26).
// At Ilse Lehmann's workbench in 档案深处 (or before the region's boss, if the player never went there) 林远 tells the
// truth once: the system is the engine of the perfect dictionary; its typos were the silence leaking through; the
// living language you learned is what the dictionary cannot swallow. Red line: learning more makes you stronger.

/** 系统错字伏笔: the deliberate typos in the system's region-entry lines (src/data/zones.ts), regions 4–14.
 *  Never in questions, example sentences or answers. Do not "fix" them: the reveal reads them back. */
export const SYSTEM_TYPOS: Array<{ region: number; wrong: string; right: string }> = [
  { region: 4, wrong: '住那里', right: '住哪里' },
  { region: 5, wrong: '时侯', right: '时候' },
  { region: 6, wrong: '天汽', right: '天气' },
  { region: 7, wrong: '不丢入', right: '不丢人' },
  { region: 9, wrong: '不在停下来', right: '不再停下来' },
  { region: 12, wrong: '才回疼', right: '才会疼' },
  { region: 14, wrong: '张了多少', right: '涨了多少' },
];

export const LIN = '林远';

export function revealLines(seen: number[]): Array<{ who: string; text: string }> {
  const typos = SYSTEM_TYPOS.filter((t) => seen.includes(t.region));
  const list = (typos.length ? typos : SYSTEM_TYPOS).map((t) => `「${t.wrong}」`).join('');
  return [
    { who: '系统', text: '工作台上压着一沓卡片。每张只写一个词、一个意思、一种写法。最上面那张：„Das vollkommene Wörterbuch – Arbeitsstand 97 %“。' },
    { who: LIN, text: '你也走到这里了。我叫林远，比你早醒过来，也是被它叫醒的。' },
    { who: LIN, text: 'Ilse 的信你读过吧。档案馆的项目想让每个词只有一个答案：不许错，不许换个说法。裂缝就是从这张桌子开的，沉默从里面进来。' },
    { who: LIN, text: '系统是那部词典的引擎。它帮你找回名字，可它真正要的是把词典填满。每一次蚀变，都是它又完成了一截，把世界上不同的说法抹平。' },
    { who: LIN, text: `你注意过它偶尔写错字吗？${list}。那不是笔误，是它和沉默连在一起的地方，沉默从那里漏了出来。` },
    { who: LIN, text: '可它算错了一件事。你在句子和文章里学会的是活的说法：一件事能换着说，说错了也能接着说下去。这些，词典吞不下。' },
    { who: LIN, text: '所以别停。你学得越多，它越拿你没办法。Sprich weiter – auch mit Fehlern.' },
    { who: '系统', text: '【真相】系统借你收词，可你学会的活语言，正是对付词典的武器。最后那场演讲，就是要证明这一点。' },
  ];
}
