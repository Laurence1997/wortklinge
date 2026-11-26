// 18 区 Frau Weber 的选择 (Lucas 2026-11-26 按推荐: 方案 1): after the first win over 审判者, a short scene with no
// branch. She leaves the 秩序会 and hands over the list of banned words; the empty last pages lead on to 19 回潮.
// The German uses region 18's grammar (zwar … aber, obwohl, nicht … sondern).

export const WEBER = 'Frau Weber';

export const WEBER18: Array<{ who: 'sys' | 'weber'; de?: string; text: string }> = [
  { who: 'sys', text: '庭审散了。Frau Weber 没有回办事处，她在天平庭门口等你。' },
  { who: 'weber', de: 'Dreißig Jahre lang habe ich aufgeschrieben, welche Wörter verboten sind. Ich dachte, Ordnung schützt uns.', text: '三十年来，我一直在登记哪些词被禁了。我以为秩序能保护我们。' },
  { who: 'weber', de: 'Heute haben Sie für mich gesprochen, obwohl ich Ihnen immer nur Formulare gegeben habe.', text: '今天您替我说话了，虽然我给您的一直只有表格。' },
  { who: 'sys', text: '她从包里拿出一本很厚的册子，封面上印着「Verzeichnis der untersagten Wörter」（禁词名录）。' },
  { who: 'weber', de: 'Nehmen Sie es. Die Wörter gehören nicht dem Orden, sondern den Menschen, die sie sprechen.', text: '拿去吧。这些词不属于秩序会，属于说它们的人。' },
  { who: 'weber', de: 'Ich trete aus dem Orden aus. Zwar habe ich Angst, aber schweigen will ich nicht mehr.', text: '我要退出秩序会。我虽然害怕，但我不想再沉默了。' },
  { who: 'sys', text: '她把登记处的印章放在台阶上，走了，没有回头。' },
  { who: 'sys', text: '名录最后几页是空白的，纸边却有被吸过的痕迹。回潮那边，有东西正在把词一个个抽空。' },
];
