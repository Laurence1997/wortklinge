// 连句终结技 (游戏设计 › 词表导入和 A1 写作, 2026-11-22): two short sentences and a joining word; you write them
// as one sentence. und / oder / aber / denn keep the word order; weil / dass / wenn send the verb to the end, so
// those rows carry their answer. Written for Wortklinge (no copied sources); needs the one-time German check.
//
// Row: 'Satz A | Satz B | joining word | 中文 | answer (only for weil / dass / wenn)'

export type LinkWord = 'und' | 'oder' | 'aber' | 'denn' | 'weil' | 'dass' | 'wenn';

export interface LinkRow {
  a: string;
  b: string;
  conj: LinkWord;
  zh: string;
  answer: string;
}

/** Joining words that move the verb to the end (open later). */
export const SUB_LINKS: LinkWord[] = ['weil', 'dass', 'wenn'];

const ROWS: string[] = [
  // und / oder: nothing moves.
  'Ich trinke einen Tee. | Ich esse ein Brot. | und | 我喝茶，吃面包。',
  'Das Zimmer ist klein. | Es ist sehr kalt. | und | 房间很小，而且很冷。',
  'Mein Bruder wohnt in Berlin. | Meine Schwester wohnt in Wien. | und | 我哥哥住在柏林，我姐姐住在维也纳。',
  'Ich kaufe Äpfel. | Ich kaufe Bananen. | und | 我买苹果，也买香蕉。',
  'Wir gehen in den Park. | Wir spielen Ball. | und | 我们去公园踢球。',
  'Möchtest du einen Kaffee? | Möchtest du ein Wasser? | oder | 你要咖啡还是水？',
  'Fährst du mit dem Bus? | Gehst du zu Fuß? | oder | 你坐公交还是走路？',
  'Ich koche heute. | Wir gehen ins Restaurant. | oder | 今天我做饭，或者我们去餐馆。',
  // aber / denn: comma, nothing moves.
  'Der Kuchen ist lecker. | Er ist zu teuer. | aber | 蛋糕很好吃，但是太贵了。',
  'Ich lerne Deutsch. | Ich spreche noch nicht gut. | aber | 我在学德语，但还说得不好。',
  'Die Wohnung ist schön. | Sie ist sehr klein. | aber | 公寓很漂亮，但是很小。',
  'Ich habe Hunger. | Ich habe kein Geld. | aber | 我饿了，可是没钱。',
  'Ich möchte kommen. | Ich habe keine Zeit. | aber | 我想来，可是没时间。',
  'Der Zug ist pünktlich. | Der Bus hat Verspätung. | aber | 火车准点，但公交晚点了。',
  'Ich kenne ihn. | Ich weiß seinen Namen nicht. | aber | 我认识他，可是不知道他的名字。',
  'Ich bleibe zu Hause. | Ich bin krank. | denn | 我待在家，因为我病了。',
  'Ich nehme eine Jacke mit. | Es ist kalt. | denn | 我带件夹克，因为天冷。',
  'Wir essen jetzt. | Wir haben Hunger. | denn | 我们现在吃饭，因为饿了。',
  'Ich trinke einen Kaffee. | Ich bin sehr müde. | denn | 我喝杯咖啡，因为我很累。',
  'Er lernt Deutsch. | Er wohnt in Deutschland. | denn | 他学德语，因为他住在德国。',
  'Ich rufe den Arzt an. | Mein Kopf tut weh. | denn | 我给医生打电话，因为我头疼。',
  'Ich glaube dir nicht. | Du lügst oft. | denn | 我不信你，因为你经常说谎。',
  // weil / dass / wenn: the verb goes to the end.
  'Ich bleibe zu Hause. | Ich bin krank. | weil | 我待在家，因为我病了。 | Ich bleibe zu Hause, weil ich krank bin.',
  'Ich trinke einen Kaffee. | Ich bin müde. | weil | 我喝咖啡，因为我累了。 | Ich trinke einen Kaffee, weil ich müde bin.',
  'Wir nehmen ein Taxi. | Der Bus kommt nicht. | weil | 我们打车，因为公交不来。 | Wir nehmen ein Taxi, weil der Bus nicht kommt.',
  'Ich lerne Deutsch. | Ich wohne in Deutschland. | weil | 我学德语，因为我住在德国。 | Ich lerne Deutsch, weil ich in Deutschland wohne.',
  'Er ist traurig. | Sein Hund ist krank. | weil | 他很难过，因为他的狗病了。 | Er ist traurig, weil sein Hund krank ist.',
  'Ich weiß. | Du hast keine Zeit. | dass | 我知道你没时间。 | Ich weiß, dass du keine Zeit hast.',
  'Ich glaube. | Der Zug kommt gleich. | dass | 我觉得火车马上就来。 | Ich glaube, dass der Zug gleich kommt.',
  'Es ist schade. | Du gehst schon. | dass | 你这就走了，真可惜。 | Es ist schade, dass du schon gehst.',
  'Ich hoffe. | Das Wetter ist morgen schön. | dass | 我希望明天天气好。 | Ich hoffe, dass das Wetter morgen schön ist.',
  'Ich denke. | Das ist eine gute Idee. | dass | 我觉得这是个好主意。 | Ich denke, dass das eine gute Idee ist.',
  'Ich komme mit. | Du hast Zeit. | wenn | 你有时间的话，我就一起去。 | Ich komme mit, wenn du Zeit hast.',
  'Ruf mich an. | Du bist zu Hause. | wenn | 到家了就给我打电话。 | Ruf mich an, wenn du zu Hause bist.',
  'Wir gehen in den Park. | Die Sonne scheint. | wenn | 出太阳的话我们就去公园。 | Wir gehen in den Park, wenn die Sonne scheint.',
  'Ich trinke einen Tee. | Ich bin krank. | wenn | 我生病的时候喝茶。 | Ich trinke einen Tee, wenn ich krank bin.',
];

// The second sentence never starts with a bare noun here, so its first letter goes lower case.
const lowerFirst = (s: string) => s[0].toLowerCase() + s.slice(1);

function joined(a: string, b: string, conj: LinkWord): string {
  const head = a.replace(/[.?!]$/, '');
  const end = /\?$/.test(b) ? '?' : '.';
  const tail = lowerFirst(b.replace(/[.?!]$/, ''));
  const comma = conj === 'aber' || conj === 'denn' ? ',' : '';
  return `${head}${comma} ${conj} ${tail}${end}`;
}

export const LINKS: LinkRow[] = ROWS.map((r) => {
  const [a, b, conj, zh, ans] = r.split('|').map((x) => x.trim());
  const c = conj as LinkWord;
  return { a, b, conj: c, zh, answer: ans || joined(a, b, c) };
});
