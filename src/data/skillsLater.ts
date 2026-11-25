// 0.7 + 0.8 · sentence skills of the region 4–12 bosses (游戏设计 十: every boss offers three sentences from its talk,
// you keep one). The effects come from the existing pool (`as` = the region 1–3 skill whose effect it uses), so
// combat needs no new rules. Drafted by Claude for the docs thread to confirm; needs a native-speaker check.
import type { Skill } from './skills';

type Pool = 'keineAhnung' | 'wieBitte' | 'freutMich' | 'zuTeuer' | 'wieViel' | 'stimmtSo' | 'zugFaehrtAb' | 'verpasst' | 'naechsterHalt' | 'wiederholen';

/** Effect text and cooldown of each pool skill (as in skills.ts). */
const POOL: Record<Pool, { zh: string; effect: string; cooldown: number }> = {
  keineAhnung: { zh: '反弹护盾', effect: '挡下怪物的下一击，并反弹 20% 伤害（守护者 30%）', cooldown: 4 },
  wieBitte: { zh: '打断', effect: '让怪物这回合的打算作废（能化解蓄满的大招）', cooldown: 5 },
  freutMich: { zh: '回春', effect: '回复 30% 生命', cooldown: 5 },
  zuTeuer: { zh: '压价', effect: '这回合怪物对你的伤害 −50%', cooldown: 4 },
  wieViel: { zh: '看穿', effect: '接下来 2 回合，怪物下回合要蓄力就提前一回合告诉你，可以先存资源或铭刻', cooldown: 5 },
  stimmtSo: { zh: '不用找了', effect: '这场战斗里打死的怪，金币翻倍', cooldown: 6 },
  zugFaehrtAb: { zh: '发车', effect: '每场一次：下一题答对伤害翻倍', cooldown: 99 },
  verpasst: { zh: '错过', effect: '每场一次：下一次答错不丢资源（铭刻失手不扣，连写不断）', cooldown: 99 },
  naechsterHalt: { zh: '下一站', effect: '每场一次：打倒这只怪后，下一只怪护甲降一档', cooldown: 99 },
  wiederholen: { zh: '换一题', effect: '每场一次：之后有一题可以换成同难度的另一题', cooldown: 99 },
};

/** boss = the region (stored as 100 + region, because boss 4 already means 秩序会声望 in skills.ts). */
type Row = [id: string, boss: number, as: Pool, name: string, lines: Array<[de: string, zh: string]>];

const ROWS: Row[] = [
  // 4 · 登记魔像
  ['mietvertrag', 4, 'keineAhnung', '盖章护盾', [['Hier ist mein Mietvertrag.', '这是我的租房合同。'], ['Hier ist die Bestätigung.', '这是确认书。'], ['Ich habe alle Unterlagen dabei.', '我所有材料都带了。']]],
  ['formularFertig', 4, 'naechsterHalt', '下一位', [['Das Formular ist ausgefüllt.', '表格填好了。'], ['Ich habe alles ausgefüllt.', '我全都填好了。'], ['Hier fehlt nichts mehr.', '这里什么都不缺了。']]],
  ['termin', 4, 'wiederholen', '改约', [['Ich brauche einen neuen Termin.', '我需要一个新的预约。'], ['Geht es auch an einem anderen Tag?', '换一天也可以吗？'], ['Kann ich den Termin verschieben?', '我可以改约吗？']]],
  // 5 · 无痛医生
  ['guteBesserung', 5, 'freutMich', '回春', [['Gute Besserung!', '早日康复！'], ['Werd schnell wieder gesund!', '快点好起来！'], ['Ich wünsche Ihnen gute Besserung.', '祝您早日康复。']]],
  ['schonBesser', 5, 'zuTeuer', '缓痛', [['Mir geht es schon besser.', '我已经好些了。'], ['Es tut nicht mehr so weh.', '没那么疼了。'], ['Heute ist es besser als gestern.', '今天比昨天好。']]],
  ['pause', 5, 'verpasst', '歇口气', [['Ich brauche eine Pause.', '我需要休息一下。'], ['Ich muss mich kurz ausruhen.', '我得先歇一会儿。'], ['Einen Moment, bitte.', '请稍等一下。']]],
  // 6 · 雾中之船
  ['schiffLegtAb', 6, 'zugFaehrtAb', '起航', [['Das Schiff legt ab!', '船开了！'], ['Leinen los!', '解缆！'], ['Wir fahren jetzt los!', '我们现在出发！']]],
  ['wetterMorgen', 6, 'wieViel', '观天', [['Wie wird das Wetter morgen?', '明天天气怎么样？'], ['Kommt ein Sturm?', '要起风暴了吗？'], ['Es soll morgen regnen.', '听说明天要下雨。']]],
  ['zimmerFrei', 6, 'freutMich', '歇脚', [['Hätten Sie noch ein Zimmer frei?', '您还有空房间吗？'], ['Ich hätte gern ein Einzelzimmer.', '我想要一间单人房。'], ['Ich würde gern eine Nacht bleiben.', '我想住一晚。']]],
  // 7 · 小字条款
  ['nochEineFrage', 7, 'wieBitte', '打断', [['Ich habe noch eine Frage.', '我还有一个问题。'], ['Was bedeutet das genau?', '这具体是什么意思？'], ['Können Sie das bitte erklären?', '您能解释一下吗？']]],
  ['kleingedruckt', 7, 'wieViel', '看穿', [['Das steht im Kleingedruckten.', '这写在小字里。'], ['Ich lese zuerst den Vertrag.', '我先读合同。'], ['Wo steht das im Vertrag?', '这写在合同哪里？']]],
  ['ichKuendige', 7, 'naechsterHalt', '解约', [['Ich kündige den Vertrag.', '我解除合同。'], ['Hiermit kündige ich fristgerecht.', '我在此按期解约。'], ['Der Vertrag wird gekündigt.', '合同被解除了。']]],
  // 8 · 停摆的钟
  ['esWarEinmal', 8, 'verpasst', '从前', [['Es war einmal …', '从前……'], ['Damals war alles anders.', '那时候一切都不一样。'], ['Früher hatte ich mehr Zeit.', '以前我时间多一些。']]],
  ['alsIchKleinWar', 8, 'wiederholen', '回溯', [['Als ich klein war …', '我小的时候……'], ['Als ich ankam, war alles neu.', '我刚到的时候，一切都很新。'], ['Wenn es regnete, blieb ich zu Hause.', '每次下雨我都待在家里。']]],
  ['zeitStehtStill', 8, 'keineAhnung', '定格', [['Die Zeit bleibt stehen.', '时间停住了。'], ['Einen Augenblick!', '等一下！'], ['Halt, nicht so schnell!', '停，别这么快！']]],
  // 9 · 面试官
  ['zuverlaessig', 9, 'keineAhnung', '稳重', [['Ich bin zuverlässig.', '我很可靠。'], ['Ich arbeite gern im Team.', '我喜欢团队合作。'], ['Auf mich kann man sich verlassen.', '大家可以信赖我。']]],
  ['wannAnfangen', 9, 'zugFaehrtAb', '上岗', [['Wann kann ich anfangen?', '我什么时候能开始？'], ['Ich kann sofort anfangen.', '我可以马上开始。'], ['Ab Montag bin ich da.', '周一起我就到。']]],
  ['wirMeldenUns', 9, 'stimmtSo', '入职奖金', [['Wir melden uns.', '我们会联系您。'], ['Sie sind eingestellt!', '您被录用了！'], ['Willkommen im Team!', '欢迎加入团队！']]],
  // 10 · 播报者
  ['nachrichten', 10, 'wieViel', '预报', [['Und nun die Nachrichten.', '下面播报新闻。'], ['Hier ist der Wetterbericht.', '下面是天气预报。'], ['Die Lage bleibt angespannt.', '局势依然紧张。']]],
  ['eilmeldung', 10, 'wieBitte', '插播', [['Wir unterbrechen für eine Eilmeldung.', '我们插播一条快讯。'], ['Achtung, eine Durchsage!', '注意，现在广播！'], ['Das ist eine wichtige Meldung.', '这是一条重要消息。']]],
  ['dasWarens', 10, 'naechsterHalt', '收播', [['Das waren die Nachrichten.', '新闻播报完毕。'], ['Bis morgen um die gleiche Zeit.', '明天同一时间再见。'], ['Und jetzt zum Sport.', '下面是体育新闻。']]],
  // 11 · 枯林之母
  ['blaetterFallen', 11, 'freutMich', '新叶', [['Die Blätter wachsen wieder.', '叶子又长出来了。'], ['Der Wald wird wieder grün.', '森林又绿了。'], ['Im Frühling blüht alles.', '春天万物开花。']]],
  ['waldSchuetzt', 11, 'zuTeuer', '林荫', [['Der Wald schützt uns.', '森林保护我们。'], ['Die Bäume geben uns Schatten.', '树给我们遮阴。'], ['Hier ist es ruhig und sicher.', '这里安静又安全。']]],
  ['weilBaeume', 11, 'verpasst', '扎根', [['Weil die Bäume uns Luft geben.', '因为树给我们空气。'], ['Weil wir die Natur brauchen.', '因为我们需要自然。'], ['Weil alles zusammenhängt.', '因为一切都是相连的。']]],
  // 12 · 冷漠
  ['nichtEgal', 12, 'zugFaehrtAb', '在乎', [['Das ist mir nicht egal.', '这对我不是无所谓的。'], ['Du bist mir wichtig.', '你对我很重要。'], ['Ich mache mir Sorgen um dich.', '我担心你。']]],
  ['freueMichAufDich', 12, 'freutMich', '期待', [['Ich freue mich auf dich.', '我很期待见到你。'], ['Ich freue mich über deinen Besuch.', '你来看我，我很高兴。'], ['Schön, dass du da bist.', '你在真好。']]],
  ['tutMirLeid', 12, 'wieBitte', '和解', [['Es tut mir leid.', '对不起。'], ['Das war mein Fehler.', '那是我的错。'], ['Verzeih mir, bitte.', '请原谅我。']]],
];

export const LATER_SKILLS: Record<string, Skill> = Object.fromEntries(
  ROWS.map(([id, boss, as, name, lines]) => [
    id,
    { id, de: lines[0][0], zh: name, zhLine: lines[0][1], lines: lines.map(([de, zh]) => ({ de, zh })), effect: POOL[as].effect, cooldown: POOL[as].cooldown, boss: 100 + boss, as },
  ]),
);
