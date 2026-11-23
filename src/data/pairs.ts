// 回音怪 (游戏设计 › 回音怪规则, 2026-11-23): minimal pairs, two words one sound apart. Sound-quality and consonant
// pairs can be read aloud (the in-browser phoneme model tells them apart); length pairs are listen-only, because
// neither Chrome's recognizer nor the phoneme model told long from short vowels in the 2026-11-23 tests.
// IPA is written in the phoneme model's units (espeak style, short ü as y, every r-sound as r), space-separated.
//
// Row: 'word A | IPA A | 中文 A | word B | IPA B | 中文 B | category'

export type PronCat = 'iü' | 'uü' | 'oö' | 'eö' | 'chsch' | 'ssch' | 'rl' | 'long';

export const PRON_CAT_ZH: Record<PronCat, string> = {
  iü: 'i 和 ü',
  uü: 'u 和 ü',
  oö: 'o 和 ö',
  eö: 'e 和 ö',
  chsch: 'ch 和 sch',
  ssch: 's 和 sch',
  rl: 'r 和 l',
  long: '长短元音',
};

/** How to make the sound, shown after a misread. */
export const PRON_TIP: Record<PronCat, string> = {
  iü: 'ü：舌头位置和 i 一样，嘴唇撅圆，像吹口哨',
  uü: 'ü：舌头往前放到 i 的位置，嘴唇保持圆',
  oö: 'ö：舌头位置和 e 一样，嘴唇撅圆',
  eö: 'ö：先发 e，保持舌头不动，再把嘴唇撅圆',
  chsch: 'ich 的 ch：舌面贴近上颚，像轻声的「希」，嘴唇不要撅；sch 才撅嘴',
  ssch: 'sch：嘴唇往前撅，舌头往后收；s 是扁的「丝」',
  rl: 'l：舌尖顶住上齿龈；r：舌根靠近小舌，喉咙里轻轻擦一下',
  long: '长元音拖长一倍，短元音后面的辅音要读得紧',
};

/** Categories the phoneme model can judge when read aloud. */
export const SAYABLE: PronCat[] = ['iü', 'uü', 'oö', 'eö', 'chsch', 'ssch', 'rl'];

export interface PronPair {
  a: string;
  ipaA: string;
  zhA: string;
  b: string;
  ipaB: string;
  zhB: string;
  cat: PronCat;
}

// Every row needs at least one side in the word bank (test/pron.test.ts); kennen/können, mich/misch,
// Löcher/Löscher and Hütte/Hüte were dropped for that reason and can come back when those words are added.
const ROWS: string[] = [
  'vier | f iː ɐ | 四 | für | f yː ɐ | 为了 | iü',
  'Tier | t iː ɐ | 动物 | Tür | t yː ɐ | 门 | iü',
  'spielen | ʃ p iː l ə n | 玩 | spülen | ʃ p yː l ə n | 冲洗 | iü',
  'liegen | l iː ɡ ə n | 躺 | lügen | l yː ɡ ə n | 说谎 | iü',
  'Mutter | m ʊ t ɐ | 母亲 | Mütter | m y t ɐ | 母亲们 | uü',
  'Bruder | b r uː d ɐ | 兄弟 | Brüder | b r yː d ɐ | 兄弟们 | uü',
  'Kuchen | k uː x ə n | 蛋糕 | Küchen | k y ç ə n | 厨房（复数） | uü',
  'schon | ʃ oː n | 已经 | schön | ʃ øː n | 美丽的 | oö',
  'Tochter | t ɔ x t ɐ | 女儿 | Töchter | t œ ç t ɐ | 女儿们 | oö',
  'Ofen | oː f ə n | 炉子 | Öfen | øː f ə n | 炉子（复数） | oö',
  'lesen | l eː z ə n | 读 | lösen | l øː z ə n | 解决 | eö',
  'Herren | h ɛ r ə n | 先生们 | hören | h øː r ə n | 听 | eö',
  'Kirche | k ɪ r ç ə | 教堂 | Kirsche | k ɪ r ʃ ə | 樱桃 | chsch',
  'Tasse | t a s ə | 杯子 | Tasche | t a ʃ ə | 包 | ssch',
  'Land | l a n t | 国家 | Rand | r a n t | 边缘 | rl',
  'Lampe | l a m p ə | 灯 | Rampe | r a m p ə | 坡道 | rl',
  'leise | l aɪ z ə | 小声的 | Reise | r aɪ z ə | 旅行 | rl',
  'Stadt | ʃ t a t | 城市 | Staat | ʃ t aː t | 国家（政体） | long',
  'Mitte | m ɪ t ə | 中间 | Miete | m iː t ə | 房租 | long',
  'Bett | b ɛ t | 床 | Beet | b eː t | 花坛 | long',
  'satt | z a t | 饱的 | Saat | z aː t | 种子 | long',
  'offen | ɔ f ə n | 开着的 | Ofen | oː f ə n | 炉子 | long',
];

export const PRON_PAIRS: PronPair[] = ROWS.map((r) => {
  const [a, ipaA, zhA, b, ipaB, zhB, cat] = r.split('|').map((x) => x.trim());
  return { a, ipaA, zhA, b, ipaB, zhB, cat: cat as PronCat };
});
