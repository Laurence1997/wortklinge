// Region 1 · 余烬营地 Glutheim · Lv 1–10 · about 200 words.
// Backbone: Goethe-Zertifikat A1 word list; picked by life scene (arriving in Germany,
// introducing yourself, numbers, family). Written by Claude; needs a native-speaker check.
//
// Row format for nouns: 'art de | plural | 中文 | flags'
// flags: m = usable in "Ich möchte …", t = tutorial word
// Other rows: 'de | 中文'

import type { Article, FamilyId, Pos, Word, ZoneId } from '../core/types';

interface Group {
  family: FamilyId;
  zone: ZoneId;
  pos: Pos;
  /** Monster level for the first rows → last rows (spread evenly). */
  lvl: [number, number];
  rows: string[];
}

const groups: Group[] = [
  {
    // 牙物: camp objects that grew teeth. Nouns, so they teach der/die/das from Lv1.
    family: 'zahnding',
    zone: 'echogasse',
    pos: 'n',
    lvl: [1, 3],
    rows: [
      'das Brot | Brote | 面包 | mt',
      'der Tee | Tees | 茶 | mt',
      'die Tasse | Tassen | 杯子（带把的） | mt',
      'das Wasser | - | 水 | m',
      'der Kaffee | Kaffees | 咖啡 | m',
      'die Flasche | Flaschen | 瓶子 | m',
      'das Glas | Gläser | 玻璃杯 | m',
      'der Stuhl | Stühle | 椅子 | m',
      'der Tisch | Tische | 桌子 | m',
      'das Bett | Betten | 床 | m',
      'die Lampe | Lampen | 灯 | m',
      'die Tür | Türen | 门 |',
      'das Fenster | Fenster | 窗户 |',
      'der Schlüssel | Schlüssel | 钥匙 | m',
      'die Tasche | Taschen | 包 | m',
      'das Buch | Bücher | 书 | m',
      'der Stift | Stifte | 笔 | m',
      'das Papier | Papiere | 纸 | m',
      'die Uhr | Uhren | 钟；手表 | m',
      'das Handy | Handys | 手机 | m',
      'die Jacke | Jacken | 夹克 | m',
      'der Schuh | Schuhe | 鞋 |',
      'die Brille | Brillen | 眼镜 | m',
      'das Feuer | - | 火 |',
      'die Decke | Decken | 毯子 | m',
      'der Koffer | Koffer | 行李箱 | m',
      'die Karte | Karten | 卡片；地图 | m',
      'das Foto | Fotos | 照片 | m',
      'die Zeitung | Zeitungen | 报纸 | m',
      'der Computer | Computer | 电脑 | m',
      'das Zimmer | Zimmer | 房间 | m',
      'das Haus | Häuser | 房子 |',
      'die Wohnung | Wohnungen | 公寓 | m',
      'die Straße | Straßen | 街道 |',
    ],
  },
  {
    // 回声: greetings that lost their speakers and keep shouting.
    family: 'echo',
    zone: 'echogasse',
    pos: 'phr',
    lvl: [2, 3],
    rows: [
      'Hallo | 你好',
      'Guten Morgen | 早上好',
      'Guten Tag | 你好（白天）',
      'Guten Abend | 晚上好',
      'Gute Nacht | 晚安',
      'Tschüss | 再见（熟人之间）',
      'Auf Wiedersehen | 再见（正式）',
      'Danke | 谢谢',
      'Bitte | 请；不客气',
      'Vielen Dank | 非常感谢',
      'Ja | 是',
      'Nein | 不是',
      'Entschuldigung | 对不起；打扰一下',
      'Wie bitte? | 什么？请再说一遍',
      'Wie geht’s? | 你好吗？',
      'Freut mich | 很高兴认识你',
      'Bis bald | 回头见',
      'Bis morgen | 明天见',
      'Herzlich willkommen | 热烈欢迎',
      'Alles klar | 明白了',
      'Kein Problem | 没问题',
      'Ich weiß nicht | 我不知道',
      'Noch einmal, bitte | 请再说一遍',
      'Gern | 乐意',
    ],
  },
  {
    // 名牌: name tags, forms and job titles that forgot who they belong to.
    family: 'schild',
    zone: 'schilderstrasse',
    pos: 'n',
    lvl: [3, 6],
    rows: [
      'der Name | Namen | 名字 |',
      'der Vorname | Vornamen | 名（不含姓） |',
      'der Familienname | Familiennamen | 姓 |',
      'die Adresse | Adressen | 地址 |',
      'die Telefonnummer | Telefonnummern | 电话号码 |',
      'die E-Mail | E-Mails | 电子邮件 |',
      'das Alter | - | 年龄 |',
      'der Beruf | Berufe | 职业 |',
      'die Sprache | Sprachen | 语言 |',
      'das Land | Länder | 国家 |',
      'die Stadt | Städte | 城市 |',
      'der Ausweis | Ausweise | 身份证件 | m',
      'der Pass | Pässe | 护照 |',
      'das Formular | Formulare | 表格 | m',
      'der Kurs | Kurse | 课程 | m',
      'die Schule | Schulen | 学校 |',
      'die Arbeit | Arbeiten | 工作 |',
      'der Student | Studenten | 大学生（男） |',
      'die Studentin | Studentinnen | 大学生（女） |',
      'der Lehrer | Lehrer | 老师（男） |',
      'die Lehrerin | Lehrerinnen | 老师（女） |',
      'der Arzt | Ärzte | 医生（男） |',
      'die Ärztin | Ärztinnen | 医生（女） |',
      'der Koch | Köche | 厨师（男） |',
      'die Köchin | Köchinnen | 厨师（女） |',
      'der Ingenieur | Ingenieure | 工程师（男） |',
      'der Freund | Freunde | 朋友（男） |',
      'die Freundin | Freundinnen | 朋友（女） |',
      'der Mann | Männer | 男人；丈夫 |',
      'die Frau | Frauen | 女人；妻子；女士 |',
      'das Kind | Kinder | 孩子 |',
      'der Herr | Herren | 先生 |',
      'der Nachbar | Nachbarn | 邻居（男） |',
      'die Nachbarin | Nachbarinnen | 邻居（女） |',
      'das Wort | Wörter | 词 |',
      'der Satz | Sätze | 句子 |',
      'die Frage | Fragen | 问题 |',
      'die Antwort | Antworten | 回答 |',
    ],
  },
  {
    family: 'schild',
    zone: 'schilderstrasse',
    pos: 'name',
    lvl: [4, 6],
    rows: [
      'Deutschland | 德国',
      'China | 中国',
      'Österreich | 奥地利',
      'die Schweiz | 瑞士',
      'die Türkei | 土耳其',
      'Italien | 意大利',
      'Spanien | 西班牙',
      'Frankreich | 法国',
      'Japan | 日本',
      'Deutsch | 德语',
      'Chinesisch | 汉语',
      'Englisch | 英语',
    ],
  },
  {
    family: 'schild',
    zone: 'schilderstrasse',
    pos: 'q',
    lvl: [3, 5],
    rows: ['wer | 谁', 'was | 什么', 'wo | 在哪里', 'woher | 从哪里', 'wie | 怎样；如何', 'wie viel | 多少'],
  },
  {
    family: 'schild',
    zone: 'schilderstrasse',
    pos: 'v',
    lvl: [4, 7],
    rows: [
      'sein | 是',
      'haben | 有',
      'heißen | 叫做',
      'kommen | 来',
      'wohnen | 住',
      'sprechen | 说（语言）',
      'lernen | 学习',
      'arbeiten | 工作',
      'machen | 做',
      'gehen | 去；走',
      'verstehen | 理解；听懂',
      'buchstabieren | 拼写（逐个字母念）',
      'fragen | 问',
      'antworten | 回答',
      'schreiben | 写',
      'lesen | 读',
      'hören | 听',
      'sagen | 说',
    ],
  },
  {
    // 数虫: numbers that crawl and sting.
    family: 'zahlwurm',
    zone: 'schilderstrasse',
    pos: 'num',
    lvl: [3, 5],
    rows: [
      'null | 0',
      'eins | 1',
      'zwei | 2',
      'drei | 3',
      'vier | 4',
      'fünf | 5',
      'sechs | 6',
      'sieben | 7',
      'acht | 8',
      'neun | 9',
      'zehn | 10',
      'elf | 11',
      'zwölf | 12',
    ],
  },
  {
    family: 'zahlwurm',
    zone: 'aschehof',
    pos: 'num',
    lvl: [6, 8],
    rows: [
      'dreizehn | 13',
      'vierzehn | 14',
      'fünfzehn | 15',
      'sechzehn | 16',
      'siebzehn | 17',
      'achtzehn | 18',
      'neunzehn | 19',
      'zwanzig | 20',
      'einundzwanzig | 21',
      'dreißig | 30',
      'vierzig | 40',
      'fünfzig | 50',
      'hundert | 100',
    ],
  },
  {
    // 影亲: shadows of family members in the burnt-out flats.
    family: 'sippe',
    zone: 'aschehof',
    pos: 'n',
    lvl: [6, 9],
    rows: [
      'die Familie | Familien | 家庭 |',
      'der Vater | Väter | 父亲 |',
      'die Mutter | Mütter | 母亲 |',
      'die Eltern | pl | 父母 |',
      'der Sohn | Söhne | 儿子 |',
      'die Tochter | Töchter | 女儿 |',
      'der Bruder | Brüder | 兄弟 |',
      'die Schwester | Schwestern | 姐妹 |',
      'die Geschwister | pl | 兄弟姐妹 |',
      'der Opa | Opas | 爷爷；外公 |',
      'die Oma | Omas | 奶奶；外婆 |',
      'der Großvater | Großväter | 祖父 |',
      'die Großmutter | Großmütter | 祖母 |',
      'das Baby | Babys | 婴儿 |',
      'der Onkel | Onkel | 叔叔；舅舅 |',
      'die Tante | Tanten | 阿姨；姑姑 |',
      'der Junge | Jungen | 男孩 |',
      'das Mädchen | Mädchen | 女孩 |',
      'die Leute | pl | 人们 |',
      'der Hund | Hunde | 狗 | m',
      'die Katze | Katzen | 猫 | m',
      'der Geburtstag | Geburtstage | 生日 |',
      'das Jahr | Jahre | 年 |',
      'der Tag | Tage | 天 |',
      'die Woche | Wochen | 星期 |',
      'der Monat | Monate | 月 |',
    ],
  },
  {
    family: 'sippe',
    zone: 'aschehof',
    pos: 'adj',
    lvl: [6, 9],
    rows: [
      'groß | 大；高',
      'klein | 小',
      'alt | 老；旧',
      'jung | 年轻',
      'neu | 新',
      'schön | 美丽',
      'verheiratet | 已婚',
      'ledig | 单身',
      'müde | 累',
      'krank | 生病',
      'nett | 友好',
      'toll | 很棒',
      'hier | 这里',
      'heute | 今天',
      'morgen | 明天',
      'auch | 也',
      'sehr | 非常',
      'nicht | 不',
    ],
  },
];

function slug(s: string): string {
  return s
    .toLowerCase()
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function build(): Word[] {
  const out: Word[] = [];
  const seen = new Set<string>();
  for (const g of groups) {
    g.rows.forEach((row, i) => {
      const parts = row.split('|').map((p) => p.trim());
      const t = g.rows.length > 1 ? i / (g.rows.length - 1) : 0;
      const lvl = Math.round(g.lvl[0] + (g.lvl[1] - g.lvl[0]) * t);
      let w: Word;
      if (g.pos === 'n') {
        const [head, pl, zh, flags = ''] = parts;
        const sp = head.indexOf(' ');
        const art = head.slice(0, sp) as Article;
        const de = head.slice(sp + 1);
        w = {
          id: slug(de),
          de,
          art,
          pl: pl === 'pl' ? undefined : pl,
          plOnly: pl === 'pl' || undefined,
          zh,
          pos: 'n',
          family: g.family,
          lvl,
          zone: g.zone,
          moechte: flags.includes('m') || undefined,
          tutorial: flags.includes('t') || undefined,
        };
      } else {
        const [deRaw, zh] = parts;
        let de = deRaw;
        let art: Article | undefined;
        // Country names with an article (die Schweiz) still count as names.
        const m = /^(der|die|das) (.+)$/.exec(deRaw);
        if (m && g.pos === 'name') {
          art = m[1] as Article;
          de = m[2];
        }
        w = {
          id: slug(de) + (g.pos === 'num' ? '-num' : ''),
          de,
          art,
          zh: g.pos === 'num' ? `数字 ${zh}` : zh,
          digit: g.pos === 'num' ? zh : undefined,
          pos: g.pos,
          family: g.family,
          lvl,
          zone: g.zone,
        };
      }
      // "morgen" (tomorrow) vs "Guten Morgen" and similar: ids must stay unique.
      while (seen.has(w.id)) w.id += '-2';
      seen.add(w.id);
      out.push(w);
    });
  }
  return out;
}

export const WORDS: Word[] = build();
export const WORD_BY_ID: Record<string, Word> = Object.fromEntries(WORDS.map((w) => [w.id, w]));

/** Display form with article: "der Tee", "die Eltern", "Hallo". */
export function fullForm(w: Word): string {
  return w.art ? `${w.art} ${w.de}` : w.de;
}

export function genderOf(w: Word): 'm' | 'f' | 'n' | 'pl' | null {
  if (!w.art) return null;
  if (w.plOnly) return 'pl';
  return w.art === 'der' ? 'm' : w.art === 'die' ? 'f' : 'n';
}

/** Words you can be asked der/die/das about (plural-only nouns answer "die"). */
export function hasArticleQuestion(w: Word): boolean {
  return !!w.art;
}
