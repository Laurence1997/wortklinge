// 告示牌「德语小规律」 (Lucas 2026-11-28): der/die/das rules and pronunciation rules, page by page. Opened from the
// board at 余烬营地 (the spawn camp) and from the 「规律」 tab of the menu, any time. Every German example can be
// clicked to hear it (browser TTS, like the monsters' lines). The gender pages show, for the rules the game can
// check, how many nouns of the game's own word list follow them (src/core/genderRules.ts).
import { h } from './dom';
import { speak } from '../game/audio';
import { ruleById, ruleStats } from '../core/genderRules';

interface Item {
  head: string;
  body?: string;
  /** German examples; each one is a play button. "der Tag" or "Tag|天" (with Chinese). */
  ex?: string[];
  /** Common exceptions, said plainly. */
  exc?: string;
  /** A rule of src/core/genderRules.ts: its word-list count is shown. */
  rule?: string;
}

interface Page {
  id: string;
  tab: string;
  title: string;
  intro?: string;
  items: Item[];
}

export const GENDER_PAGES: Page[] = [
  {
    id: 'g0',
    tab: '先读这页',
    title: '词性：怎么用这几页',
    intro: 'der、die、das 大部分得跟着词一起记，但有不少规律能帮你猜，而且越到后面越准：B1、B2 的长词多半带后缀，或者是复合词，看词尾就能定。下面每条都标了「都是」还是「多半是」，后面的数字是这个游戏词表里实际数出来的。',
    items: [
      { head: '记名词永远连冠词一起记', body: '背 der Tisch，不背 Tisch。打字题也要带冠词。', ex: ['der Tisch|桌子', 'die Lampe|灯', 'das Buch|书'] },
      { head: '先看词尾，再看是不是复合词，最后看意思', body: '词尾规律最稳；复合词看最后一个词；意思类别（星期、酒、金属……）能补上一部分。都对不上的，就是要硬记的那一批。' },
      { head: '复数一律 die', body: '不管单数是什么，复数的定冠词都是 die（第三格 den）。', ex: ['der Tisch → die Tische', 'das Kind → die Kinder', 'die Frau → die Frauen'] },
      { head: '战斗里会提醒你', body: '选错相、冠词写错，或者第一次见到一个新名词时，如果这个词归哪条规律，反馈里会顺带写出来；是例外也会告诉你。不归任何规律的词不显示。' },
    ],
  },
  {
    id: 'g1',
    tab: '一定是 die',
    title: '这些词尾一定是 die（阴性）',
    intro: '这一页最值得先记，几乎没有例外，而且这些词尾到了 B1、B2 越来越多。',
    items: [
      { head: '-ung', rule: 'ung', ex: ['die Wohnung|住房', 'die Zeitung|报纸', 'die Meinung|看法', 'die Erfahrung|经验'], exc: 'der Sprung、der Schwung 这种单音节词的 -ung 不是后缀（来自 springen、schwingen），所以是 der。' },
      { head: '-heit、-keit', rule: 'heit', ex: ['die Freiheit|自由', 'die Gesundheit|健康', 'die Möglichkeit|可能性', 'die Schwierigkeit|困难'] },
      { head: '-schaft', rule: 'schaft', ex: ['die Freundschaft|友谊', 'die Mannschaft|球队', 'die Wissenschaft|科学'] },
      { head: '-tion、-sion', rule: 'tion', ex: ['die Information|信息', 'die Station|站', 'die Diskussion|讨论'], exc: '只算 -tion、-sion。别的 -ion 不一定：der Spion（间谍）、das Stadion（体育场）。' },
      { head: '-tät（-ität）', rule: 'taet', ex: ['die Universität|大学', 'die Qualität|质量', 'die Realität|现实'] },
      { head: '-enz', rule: 'enz', ex: ['die Konferenz|会议', 'die Konkurrenz|竞争', 'die Tendenz|趋势'] },
      { head: '-ade、-age、-ette', rule: 'ade', ex: ['die Limonade|汽水', 'die Garage|车库', 'die Etage|楼层', 'die Toilette|厕所'], exc: 'das Image（形象）照英语读，不算这类。die Frage、die Lage、die Kette 是德语本族词，不是外来词；它们用 die，是因为以 -e 结尾。' },
      { head: '-erei、-elei', rule: 'erei', ex: ['die Bäckerei|面包店', 'die Metzgerei|肉铺', 'die Bücherei|图书馆'] },
      { head: '-in（指女性）', rule: 'fem', ex: ['die Lehrerin|女老师', 'die Ärztin|女医生', 'die Freundin|女朋友'], exc: '只算指女性的 -in。别的 -in 不算：der Termin、der Wein、das Benzin。' },
    ],
  },
  {
    id: 'g2',
    tab: '多半是 die',
    title: '这些词尾多半是 die',
    intro: '准确率低一些，但遇到没把握的词，先猜 die 很划算。',
    items: [
      { head: '-e（两个音节以上）', rule: 'e', body: '最大的一类。德语里 -e 结尾的名词大约八九成是 die。', ex: ['die Straße|街道', 'die Tasche|包', 'die Woche|星期', 'die Sprache|语言'], exc: '三类常见例外：① 指男人和某些动物的词是 der（der Junge、der Kunde、der Kollege、der Löwe、der Affe）；② der Name、der Gedanke、der Glaube、der Wille、der Käse；③ das Auge、das Ende、das Interesse，和 Ge-…-e 的集合词（das Gebäude、das Gemüse）。der Kaffee、der Tee、der See 的 -ee 不算 -e。' },
      { head: '-ie', rule: 'ie', ex: ['die Familie|家庭', 'die Biologie|生物学', 'die Energie|能量'], exc: 'das Knie、das Genie；英语借词指人的是 der（der Hippie、der Junkie）。' },
      { head: '-ik', rule: 'ik', ex: ['die Musik|音乐', 'die Politik|政治', 'die Technik|技术'], exc: 'der Streik、das Plastik；海洋 der Atlantik、der Pazifik。' },
      { head: '-ur（外来词）', rule: 'ur', ex: ['die Natur|自然', 'die Kultur|文化', 'die Temperatur|温度'], exc: 'der Flur、das Abitur。注意 -eur 是另一回事，是 der（der Friseur）。' },
      { head: '-anz（外来词）', rule: 'anz', ex: ['die Distanz|距离', 'die Toleranz|宽容', 'die Bilanz|结算'], exc: '德语本族的单音节词不算：der Tanz、der Glanz、der Schwanz。' },
    ],
  },
  {
    id: 'g3',
    tab: 'das 的词尾',
    title: '这些多半是 das（中性）',
    items: [
      { head: '-chen、-lein（小称）', rule: 'chen', body: '把东西说小的后缀，一定是 das，哪怕指的是女孩。所以是 das Mädchen。', ex: ['das Mädchen|女孩', 'das Brötchen|小面包', 'das Häuschen|小房子', 'das Fräulein|小姐'], exc: 'der Kuchen、der Knochen 的 -chen 本来就是词的一部分，不是小称。' },
      { head: '-um（拉丁来源）', rule: 'um', ex: ['das Museum|博物馆', 'das Zentrum|中心', 'das Studium|大学学业', 'das Datum|日期'], exc: '-aum 是本族词，是 der：der Raum、der Baum、der Traum。还有 der Konsum。' },
      { head: '-ment', rule: 'ment', ex: ['das Dokument|文件', 'das Instrument|乐器', 'das Experiment|实验'], exc: 'der Moment（片刻）。' },
      { head: '-ett', rule: 'ett', ex: ['das Ballett|芭蕾', 'das Tablett|托盘', 'das Etikett|标签'], exc: 'das Bett、das Brett 是本族词，不算这类。' },
      { head: '-ma（希腊来源）', rule: 'ma', ex: ['das Thema|话题', 'das Klima|气候', 'das Drama|戏剧'], exc: 'die Firma；指女性的 die Mama、die Oma。' },
      { head: '-tum', rule: 'tum', ex: ['das Eigentum|财产', 'das Wachstum|增长', 'das Christentum|基督教'], exc: 'der Reichtum、der Irrtum。' },
      { head: '动词原形当名词', body: '任何动词原形大写就成了名词，一律 das。', ex: ['das Essen|饭', 'das Leben|生活', 'das Schwimmen|游泳', 'das Lesen|阅读'], exc: '本来就是名词、碰巧像动词的不算：der Laden、der Schaden、der Regen。' },
      { head: 'Ge- 开头的集合名词', body: '把一堆东西说成一个整体的 Ge- 词常是 das，尤其是 Ge-…-e。', ex: ['das Gebäude|建筑', 'das Gemüse|蔬菜', 'das Gebirge|山脉', 'das Getränk|饮料'], exc: '这条例外很多，只当提示：die Geschichte、der Gedanke、die Gefahr、der Geschmack。' },
      { head: '-nis', body: '大约三分之二是 das。', ex: ['das Ergebnis|结果', 'das Zeugnis|成绩单', 'das Geheimnis|秘密'], exc: '不少是 die：die Erlaubnis、die Kenntnis、die Erkenntnis、die Wildnis。' },
      { head: '-o（多是外来词的缩写）', body: '大约七成是 das。', ex: ['das Auto|汽车', 'das Büro|办公室', 'das Kino|电影院', 'das Foto|照片', 'das Radio|收音机'], exc: 'der Euro、der Zoo、der Kakao、der Espresso；die Disco、die Demo、die Info（原词是阴性）。' },
    ],
  },
  {
    id: 'g4',
    tab: 'der 的词尾',
    title: '这些多半是 der（阳性）',
    items: [
      { head: '-ling', rule: 'ling', ex: ['der Frühling|春天', 'der Schmetterling|蝴蝶', 'der Lehrling|学徒', 'der Flüchtling|难民'] },
      { head: '-ismus', rule: 'ismus', ex: ['der Tourismus|旅游业', 'der Kapitalismus|资本主义', 'der Rassismus|种族主义'] },
      { head: '-eur（职业）', rule: 'eur', ex: ['der Friseur|理发师', 'der Ingenieur|工程师', 'der Regisseur|导演'] },
      { head: '-ist、-ant，和指人的 -ent', rule: 'ist', ex: ['der Polizist|警察', 'der Tourist|游客', 'der Elefant|大象', 'der Student|大学生'], exc: 'das Restaurant（法语借词，不是人）。不指人的 -ent 多是 das：das Talent、das Prozent。' },
      { head: '-or（外来词）', rule: 'or', ex: ['der Motor|发动机', 'der Doktor|博士', 'der Autor|作者'], exc: 'das Labor（Laboratorium 的缩写）；单音节的 das Tor、das Moor 不算。' },
      { head: '-ig、-ich', rule: 'ig', ex: ['der König|国王', 'der Honig|蜂蜜', 'der Essig|醋', 'der Teppich|地毯'], exc: 'das Sandwich（英语借词）。' },
      { head: '动词变来的 -er（做事的人或工具）', rule: 'agent', body: '动词词干 + -er 指「做这件事的人或东西」，几乎都是 der。', ex: ['der Lehrer|老师', 'der Fahrer|司机', 'der Wecker|闹钟', 'der Computer|电脑'], exc: '不是从动词来的 -er 很多不是 der：das Zimmer、das Fenster、das Wasser、das Messer、die Mutter、die Butter、die Nummer。' },
      { head: '指男人和某些动物的 -e', rule: 'nmasc', body: '这批词是 -e→die 的反面，变格也特别（第二、三、四格加 -n：den Kunden）。', ex: ['der Junge|男孩', 'der Kunde|顾客', 'der Kollege|同事', 'der Löwe|狮子', 'der Affe|猴子'] },
      { head: '-en（不是动词原形）', body: '一半左右是 der，没那么可靠。', ex: ['der Garten|花园', 'der Wagen|车', 'der Hafen|港口', 'der Boden|地面'], exc: '动词原形当名词的是 das（das Essen）；也有 das Zeichen、das Kissen、das Becken。' },
    ],
  },
  {
    id: 'g5',
    tab: '看意思',
    title: '按意思分的规律',
    intro: '这些不看词尾，看词是什么东西。',
    items: [
      { head: 'der：星期、月份、季节、一天里的时段', rule: 'day', ex: ['der Montag|星期一', 'der Mai|五月', 'der Sommer|夏天', 'der Abend|晚上'], exc: 'die Nacht；das Frühjahr（最后一部分是 das Jahr）。' },
      { head: 'der：方位和天气', rule: 'dir', ex: ['der Norden|北方', 'der Regen|雨', 'der Schnee|雪', 'der Wind|风'], exc: 'das Gewitter；die Sonne、die Wolke 是东西，不是天气现象。' },
      { head: 'der：酒', rule: 'drink', ex: ['der Wein|葡萄酒', 'der Sekt|起泡酒', 'der Schnaps|烈酒'], exc: 'das Bier！最常见的一个。' },
      { head: 'der：汽车牌子；die：摩托车和飞机牌子', body: '跟着 der Wagen、die Maschine 走。', ex: ['der BMW', 'der Audi', 'die Boeing'] },
      { head: 'das：金属和化学元素', rule: 'metal', ex: ['das Gold|金', 'das Silber|银', 'das Eisen|铁', 'das Kupfer|铜'], exc: '合金不算：der Stahl、die Bronze。' },
      { head: 'das：幼崽和小孩', rule: 'young', ex: ['das Kind|孩子', 'das Baby|婴儿', 'das Kalb|小牛', 'das Lamm|小羊'] },
      { head: 'das：大多数国家和城市', body: '平时不加冠词：Deutschland、Berlin。前面有形容词时才看得到：das schöne Berlin。', ex: ['Deutschland', 'das alte Wien'], exc: '要带冠词的国家要单独记：die Schweiz、die Türkei、der Iran、die USA（复数）。' },
      { head: 'das：颜色、语言、字母当名词', ex: ['das Rot|红色', 'das Deutsch|德语', 'das A|字母 A'] },
      { head: 'das：分数', rule: 'frac', ex: ['das Drittel|三分之一', 'das Viertel|四分之一'], exc: 'die Hälfte（一半）。' },
      { head: 'die：数字当名词，和多数树、花', ex: ['die Eins|数字一；成绩一分', 'die Zwei|二', 'die Eiche|橡树', 'die Rose|玫瑰', 'die Tulpe|郁金香'], exc: 'der Baum 本身是 der；der Ahorn（枫树）。' },
      { head: '人：按自然性别', body: '男人 der，女人 die。', ex: ['der Mann|男人', 'der Vater|父亲', 'die Frau|女人', 'die Tochter|女儿'], exc: 'das Mädchen（-chen 优先）、das Kind、das Baby、das Mitglied（成员）；不分男女的 die Person、die Geisel（人质）、die Waise（孤儿）。' },
    ],
  },
  {
    id: 'g6',
    tab: '复合词',
    title: '复合词：看最后一个词',
    intro: '德语长词多半是几个词拼起来的。冠词只看最后一个词，前面的不管。这是全书最稳的一条规律。',
    items: [
      { head: '最后一个词决定一切', ex: ['das Haus + die Tür = die Haustür', 'die Hand + der Schuh = der Handschuh', 'die Kinder + der Garten = der Kindergarten', 'die Stadt + der Plan = der Stadtplan'] },
      { head: '中间加的 -s-、-n- 不影响', body: '拼起来时常多一个连接音，冠词照样看最后一个词。', ex: ['die Geburt + der Tag = der Geburtstag', 'die Sonne + die Brille = die Sonnenbrille', 'das Schwein + das Fleisch = das Schweinefleisch'] },
      { head: '缩写跟原词走', ex: ['die Uni ← die Universität', 'das Labor ← das Laboratorium', 'die Kita ← die Kindertagesstätte', 'der Pkw ← der Personenkraftwagen'] },
      { head: '少数例外', exc: 'der Mut（勇气），但 die Demut（谦卑）、die Anmut（优雅）、die Wehmut（伤感）；der Hochmut、der Übermut 照常。der Teil 和 das Teil 都有（das Ersatzteil 零件）。' },
    ],
  },
  {
    id: 'g7',
    tab: '冠词变意思',
    title: '同一个词，冠词不同，意思不同',
    intro: '这几对要一起记，单独背其中一个容易混。',
    items: [
      { head: 'der See / die See', body: '湖 / 海（die Ostsee、die Nordsee）', ex: ['der See', 'die See'] },
      { head: 'der Leiter / die Leiter', body: '领导 / 梯子', ex: ['der Leiter', 'die Leiter'] },
      { head: 'das Steuer / die Steuer', body: '方向盘 / 税', ex: ['das Steuer', 'die Steuer'] },
      { head: 'die Band / das Band / der Band', body: '乐队 / 带子 / （书的）一卷', ex: ['die Band', 'das Band', 'der Band'] },
      { head: 'der Teil / das Teil', body: '部分 / 零件、一件东西', ex: ['der Teil', 'das Teil'] },
      { head: 'das Gehalt / der Gehalt', body: '工资 / 含量', ex: ['das Gehalt', 'der Gehalt'] },
      { head: 'der Kiefer / die Kiefer', body: '下巴骨 / 松树', ex: ['der Kiefer', 'die Kiefer'] },
      { head: 'das Schild / der Schild', body: '牌子 / 盾', ex: ['das Schild', 'der Schild'] },
      { head: 'der Moment / das Moment', body: '片刻 / 因素', ex: ['der Moment', 'das Moment'] },
      { head: 'die Mark / das Mark', body: '马克（旧货币） / 骨髓', ex: ['die Mark', 'das Mark'] },
    ],
  },
];

export const SOUND_PAGES: Page[] = [
  {
    id: 's1',
    tab: '元音长短',
    title: '元音读长还是读短',
    intro: '德语元音分长短，长短不同就是不同的词。基本看元音后面跟几个辅音。',
    items: [
      { head: '读长：后面只有一个辅音，或在音节末尾', ex: ['Tag|天', 'gut|好', 'Name|名字', 'Brot|面包', 'du|你'] },
      { head: '读长：双写元音', ex: ['Tee|茶', 'Boot|小船', 'Haar|头发', 'Zoo|动物园'] },
      { head: '读长：元音后面跟 h（h 不发音）', ex: ['fahren|开车', 'Uhr|钟', 'Kuh|奶牛', 'sehen|看', 'Sohn|儿子'] },
      { head: '读长：ie', ex: ['Liebe|爱', 'Bier|啤酒', 'vier|四', 'spielen|玩'] },
      { head: '读短：后面有两个或更多辅音，包括双写辅音', ex: ['Bett|床', 'kommen|来', 'Hand|手', 'Mittag|中午', 'Wasser|水'] },
      { head: '读短：ck 和 tz 前面', ex: ['Zucker|糖', 'Glück|运气', 'Katze|猫', 'jetzt|现在'] },
      { head: '听出区别', body: '下面每对只差长短，意思完全不同：', ex: ['Staat|国家', 'Stadt|城市', 'Miete|房租', 'Mitte|中间', 'Ofen|炉子', 'offen|开着的', 'bieten|提供', 'bitten|请求'] },
      { head: '例外', exc: '一些常用小词虽然只有一个辅音也读短：das、was、mit、bin、hat、ab、an、in、um、es。也有两个辅音前读长的：Obst、Mond、Arzt、Erde、Pferd。变位形式跟着原形：geht（gehen 长）。' },
    ],
  },
  {
    id: 's2',
    tab: 'ä ö ü',
    title: '变音字母 ä、ö、ü',
    intro: '打字时写不出来可以用 ae、oe、ue，但读音一定要分清，换一个字母就是另一个词（schon / schön，Mutter / Mütter）。',
    items: [
      { head: 'ä：基本就读 e', body: '短的像「诶」；长的嘴再张大一点。', ex: ['Käse|奶酪', 'Mädchen|女孩', 'Bär|熊', 'Hände|手（复数）', 'spät|晚'] },
      { head: 'ö：嘴型 o，舌头念 e', body: '先摆好 e 的舌位，再把嘴唇撮圆。', ex: ['schön|美', 'hören|听', 'Öl|油', 'können|能', 'zwölf|十二'] },
      { head: 'ü：嘴型 u，舌头念 i', body: '和汉语拼音的 ü（「鱼」）很像，长的就是它，短的更松一点。', ex: ['über|在上方', 'Tür|门', 'früh|早', 'müssen|必须', 'Glück|运气'] },
      { head: 'y 在外来词里读 ü', ex: ['Typ|类型', 'Physik|物理', 'System|系统'], exc: '词首、词尾和英语借词照原样：Yoga、Hobby、Party。' },
      { head: '一个点之差', ex: ['schon|已经', 'schön|美', 'Mutter|母亲', 'Mütter|母亲（复数）', 'zahlen|付钱', 'zählen|数'] },
    ],
  },
  {
    id: 's3',
    tab: 'ei ie eu',
    title: '双元音和 ei / ie',
    intro: 'ei 和 ie 最容易搞反。口诀：读第二个字母的英语字母名。ei 读 i 的名字「爱」，ie 读 e 的名字「伊」。',
    items: [
      { head: 'ei、ai 读「爱」', ex: ['Ei|蛋', 'mein|我的', 'Wein|葡萄酒', 'Mai|五月', 'Arbeit|工作'] },
      { head: 'ie 读长 i「伊」', ex: ['die|冠词 die', 'Brief|信', 'Bier|啤酒', 'lieben|爱'], exc: '词尾不重读的 -ie 读「伊额」两个音：Familie、Linie、Ferien。' },
      { head: 'eu、äu 读「奥伊」', ex: ['heute|今天', 'neu|新的', 'Leute|人们', 'Häuser|房子（复数）', 'Euro|欧元'] },
      { head: 'au 读「奥」（嘴先大后圆）', ex: ['Haus|房子', 'Frau|女人', 'auch|也', 'kaufen|买'] },
      { head: '对比着听', ex: ['Wein|葡萄酒', 'Wien|维也纳', 'Beine|腿', 'Biene|蜜蜂', 'leider|可惜', 'Lieder|歌'] },
    ],
  },
  {
    id: 's4',
    tab: 'ch',
    title: 'ch 的两种读法',
    intro: 'ch 不读汉语的「吃」。看它前面是什么元音。',
    items: [
      { head: '在 a、o、u、au 后面：喉咙后部的「赫」', body: '像清嗓子，舌根抬起摩擦，比汉语 h 靠后、更用力。', ex: ['Bach|小溪', 'Buch|书', 'noch|还', 'auch|也', 'machen|做'] },
      { head: '其余情况：舌面贴近上颚的轻「希」', body: '在 e、i、ä、ö、ü、ei、eu 后面，和在 l、n、r 后面。很像汉语「希」的开头，但不带 i。', ex: ['ich|我', 'Milch|牛奶', 'Bücher|书（复数）', 'Mädchen|女孩', 'leicht|轻', 'durch|穿过'] },
      { head: '同一个词，单复数读法会变', ex: ['Buch|书', 'Bücher|书（复数）', 'Nacht|夜', 'Nächte|夜（复数）', 'Tochter|女儿', 'Töchter|女儿（复数）'] },
      { head: '-chs 读 ks', ex: ['sechs|六', 'Fuchs|狐狸', 'wachsen|生长', 'Ochse|公牛'] },
      { head: '词首的 ch 看来源', ex: ['Chef|老板（sch）', 'Chance|机会（sch）', 'Chor|合唱团（k）', 'Christ|基督徒（k）', 'China|中国（希，南德读 k）'] },
      { head: '-ig 在词尾读「伊希」', body: '和 ich 一样的轻音；南德和奥地利常读 ik，两种都对。', ex: ['König|国王', 'zwanzig|二十', 'wichtig|重要', 'billig|便宜'], exc: '后面再接元音时 g 读回 g：Könige、wichtige。' },
    ],
  },
  {
    id: 's5',
    tab: 's sp st sch',
    title: 's、ß、sch、sp、st',
    items: [
      { head: 's 在元音前读浊音 z（像蜜蜂嗡嗡）', ex: ['Sonne|太阳', 'sehen|看', 'Hose|裤子', 'Rose|玫瑰', 'sagen|说'] },
      { head: 's 在词尾、辅音前读清音 s', ex: ['Haus|房子', 'Glas|玻璃', 'ist|是', 'Fenster|窗户', 'Bus|公交车'] },
      { head: 'ss 和 ß 都读清音 s', body: 'ß 跟在长元音或双元音后面，ss 跟在短元音后面。', ex: ['Straße|街道', 'Fuß|脚', 'heißen|叫做', 'Wasser|水', 'essen|吃', 'Fluss|河'] },
      { head: 'sch 读「诗」，嘴唇撮圆往前', ex: ['Schule|学校', 'schön|美', 'Tisch|桌子', 'Fisch|鱼', 'waschen|洗'] },
      { head: 'sp、st 在词首读 schp、scht', body: '复合词里每个词的开头也算词首，前缀后面也算。', ex: ['Sport|运动', 'sprechen|说话', 'Stadt|城市', 'Straße|街道', 'verstehen|理解', 'Bleistift|铅笔'] },
      { head: 'sp、st 在词中、词尾照常读 sp、st', ex: ['Fenster|窗户', 'ist|是', 'Wespe|黄蜂', 'Kiste|箱子', 'erst|首先'] },
      { head: 'tsch 读「吃」', ex: ['Deutsch|德语', 'tschüs|再见', 'Matsch|泥浆'] },
    ],
  },
  {
    id: 's6',
    tab: 'z v w j',
    title: '和英语、拼音不一样的辅音',
    intro: '中国学生最容易按英语或拼音读错的几个字母。',
    items: [
      { head: 'z 和 tz 读 ts（像「次」的开头）', ex: ['Zeit|时间', 'zehn|十', 'Zug|火车', 'Katze|猫', 'Pizza|比萨'] },
      { head: 'v 多数读 f', ex: ['Vater|父亲', 'viel|多', 'vier|四', 'vor|在前', 'verstehen|理解'], exc: '外来词里读 w：Vase、Video、Klavier、Universität、November。' },
      { head: 'w 读 v（上牙碰下唇）', body: '不是英语的 w，也不是拼音的 w。', ex: ['Wasser|水', 'wie|怎样', 'Wein|葡萄酒', 'Wohnung|住房', 'schwer|重'] },
      { head: 'j 读 y（像「呀」的开头）', ex: ['ja|是', 'Jahr|年', 'jung|年轻', 'Juni|六月'], exc: '外来词照原样：Journalist（法语音 zh）、Job、Jeans（英语音）。' },
      { head: 'qu 读 kv', ex: ['Quelle|源头', 'bequem|舒服', 'Qualität|质量', 'Quittung|收据'] },
      { head: 'pf 两个音都要读出来', body: '先闭嘴发 p，马上接 f。', ex: ['Apfel|苹果', 'Pferd|马', 'Kopf|头', 'Pflanze|植物'] },
      { head: 'h：词首读，元音后不读', ex: ['Haus|房子', 'heute|今天', 'gehen|走（h 不读）', 'Schuh|鞋（h 不读）'] },
      { head: 'th 读 t，ph 读 f', ex: ['Theater|剧院', 'Thema|话题', 'Physik|物理', 'Philosophie|哲学'] },
      { head: 'x 和 chs 读 ks', ex: ['Taxi|出租车', 'Text|文本', 'sechs|六'] },
      { head: '-tion 读 tsion（t 读成 ts）', ex: ['Station|站', 'Information|信息', 'Nation|国家'] },
    ],
  },
  {
    id: 's7',
    tab: 'r',
    title: 'r 的读法',
    items: [
      { head: '词首、元音前：小舌 r', body: '舌根靠近小舌，像漱口那样轻轻摩擦。舌尖颤音 r 在南德、奥地利也常听到，也能听懂。实在发不出，用舌根的轻「赫」代替，比汉语的 r 好懂得多。', ex: ['rot|红', 'Reise|旅行', 'Brot|面包', 'fahren|开车', 'grün|绿'] },
      { head: '元音后面、词尾：几乎变成元音「啊」', body: '这是最常被忽略的一条。-er 结尾读成轻的「啊」，不卷舌、不读 r。', ex: ['Vater|父亲', 'besser|更好', 'Lehrer|老师', 'der|冠词 der', 'Uhr|钟', 'vier|四', 'Tür|门'] },
      { head: '前缀 er-、ver-、zer-、her- 里的 r 也弱化', ex: ['verstehen|理解', 'erzählen|讲述', 'vergessen|忘记', 'Erfolg|成功'] },
    ],
  },
  {
    id: 's8',
    tab: '词尾',
    title: '词尾的读法',
    items: [
      { head: '词尾清化：b、d、g 在词尾读 p、t、k', body: '在音节末尾也一样。后面加了元音，又读回原样。', ex: ['gelb|黄', 'Hund|狗', 'Tag|天', 'Abend|晚上', 'Kind|孩子', 'Kinder|孩子们'] },
      { head: '-e 读轻而短的「额」', body: '不能省掉，也不能读成重音。', ex: ['bitte|请', 'Name|名字', 'Schule|学校', 'heute|今天'] },
      { head: '-en 的 e 很弱，常常只剩 n', ex: ['machen|做', 'haben|有', 'Garten|花园', 'essen|吃'] },
      { head: '-er 读轻「啊」', ex: ['Lehrer|老师', 'Fenster|窗户', 'immer|总是', 'Wetter|天气'] },
      { head: '-el 的 e 也很弱', ex: ['Apfel|苹果', 'Onkel|叔叔', 'Löffel|勺子', 'Mantel|大衣'] },
      { head: '-ng 只有鼻音，不读出 g', body: '像汉语「昂」的尾音。nk 是这个鼻音再加 k。', ex: ['lang|长', 'singen|唱', 'Zeitung|报纸', 'danke|谢谢', 'trinken|喝'] },
      { head: '-ig 读「伊希」', ex: ['König|国王', 'zwanzig|二十', 'fertig|完成'] },
    ],
  },
  {
    id: 's9',
    tab: '重音',
    title: '重音落在哪',
    intro: '重音读错，德国人常常听不懂，比个别音读错影响大。',
    items: [
      { head: '本族词：重音在词干，多在第一个音节', ex: ['Arbeit|工作', 'Fenster|窗户', 'Abend|晚上', 'arbeiten|工作', 'Mutter|母亲'] },
      { head: '不可分前缀不重读', body: 'be-、ge-、er-、ver-、zer-、ent-、emp-、miss- 都不重读，重音落在后面的词干上。', ex: ['besuchen|拜访', 'verstehen|理解', 'Geschenk|礼物', 'erzählen|讲述', 'entscheiden|决定'] },
      { head: '可分前缀重读', ex: ['ankommen|到达', 'aufstehen|起床', 'einkaufen|购物', 'Ausgang|出口', 'Anfang|开始'] },
      { head: '复合词：重音在第一个词', ex: ['Bahnhof|火车站', 'Haustür|大门', 'Kindergarten|幼儿园', 'Wörterbuch|词典'] },
      { head: '外来词：重音多在最后', body: '-ion、-tät、-ie、-ieren、-ur、-ent、-ant、-ist、-ment、-eur、-ei 这些后缀常常就是重音。', ex: ['Station|站', 'Universität|大学', 'Biologie|生物学', 'studieren|上大学', 'Natur|自然', 'Student|大学生', 'Bäckerei|面包店'], exc: '-ik 不一定：Musik、Physik、Politik 在最后，Technik、Grammatik 不在最后。' },
      { head: '同一个词，重音换了意思也换', ex: ['umfahren|撞倒（重音在 um）', 'umfahren|绕开（重音在 fah）', 'übersetzen|翻译（重音在 set）', 'übersetzen|摆渡过河（重音在 über）'] },
      { head: '元音开头的词前面要顿一下', body: '德语不连读：词首元音前有一个短暂的停顿（喉塞音），复合词和前缀后也一样。', ex: ['ein Apfel|一个苹果', 'beenden|结束', 'Erinnerung|回忆'] },
    ],
  },
];

/** The board, page by page. `kind` picks the section; `page` the page id inside it (updated as the reader turns pages). */
export function rulesBoard(start: { kind: 'gender' | 'sound'; page?: string } = { kind: 'gender' }): HTMLElement {
  const wrap = h('div.rules-board');
  // The caller's object remembers where the reader is, so a re-render of the menu keeps the page.
  let kind = start.kind;
  let pageId = start.page;
  const render = () => {
    const pages = kind === 'gender' ? GENDER_PAGES : SOUND_PAGES;
    const page = pages.find((p) => p.id === pageId) ?? pages[0];
    pageId = page.id;
    start.kind = kind;
    start.page = pageId;
    const kinds = h(
      'div.row.rb-kinds',
      h(`button.btn.small${kind === 'gender' ? '.primary' : ''}`, { onclick: () => ((kind = 'gender'), (pageId = undefined), render()) }, 'der / die / das'),
      h(`button.btn.small${kind === 'sound' ? '.primary' : ''}`, { onclick: () => ((kind = 'sound'), (pageId = undefined), render()) }, '发音'),
      h('span.small.muted', '　点德语可以听读音'),
    );
    const tabs = h('div.rb-tabs', ...pages.map((p, i) => h(`button.btn.small${p.id === page.id ? '.on' : '.ghost'}`, { onclick: () => ((pageId = p.id), render()) }, `${i + 1} ${p.tab}`)));
    const body = h('div.rb-page', h('h3', page.title), page.intro ? h('p.rb-intro', page.intro) : '');
    for (const it of page.items) body.append(itemEl(it));
    const i = pages.indexOf(page);
    const nav = h(
      'div.row.rb-nav',
      i > 0 ? h('button.btn.small.ghost', { onclick: () => ((pageId = pages[i - 1].id), render()) }, `← ${pages[i - 1].tab}`) : h('span'),
      i < pages.length - 1 ? h('button.btn.small', { onclick: () => ((pageId = pages[i + 1].id), render()) }, `${pages[i + 1].tab} →`) : h('span'),
    );
    wrap.replaceChildren(kinds, tabs, body, nav);
    wrap.scrollTop = 0;
  };
  render();
  return wrap;
}

function itemEl(it: Item): HTMLElement {
  const el = h('div.rb-item');
  const head = h('div.rb-head', h('b', it.head));
  if (it.rule) {
    const r = ruleById(it.rule);
    if (r) {
      const st = ruleStats(r);
      if (st.n >= 3) head.append(h('span.rb-stat', { title: '这个游戏词表里数出来的' }, `词表里 ${st.ok}/${st.n} 个是 ${r.art}`));
    }
  }
  el.append(head);
  if (it.body) el.append(h('div.rb-body', it.body));
  if (it.ex?.length) el.append(h('div.rb-ex', ...it.ex.map(exEl)));
  if (it.exc) el.append(h('div.rb-exc', h('span.rb-exc-tag', '例外'), it.exc));
  return el;
}

/** "der Tag|天" → a play button saying «der Tag». Arrows and pluses are read part by part. */
function exEl(x: string): HTMLElement {
  const [de, zh] = x.split('|');
  const said = de.replace(/[←→=+]/g, ',').replace(/（.*?）/g, '');
  return h('button.rb-word', { title: '点一下听读音', onclick: () => speak(said, true, 0.8) }, h('span.rb-de', de), zh ? h('span.rb-zh', zh) : '');
}
