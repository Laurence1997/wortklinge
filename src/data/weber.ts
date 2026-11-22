// 秩序会 (0.6 第 6 块 细则一): Frau Weber's 登记表. She asks 5 formal questions (Sie) drawn from this pool of ~20,
// you answer in full sentences about yourself, untimed. Using du/dein towards her is not wrong and not punished,
// but that answer has to be given again with Sie/Ihr before it counts. Reputation: 10 / 25 / 50 forms.
// Written by Claude; needs a native-speaker check.

import type { BossQuestion } from './boss';
import { gradePerfekt } from './boss3';
import { normalize } from '../core/grading';
import { shuffle, type Rng } from '../core/rng';

export const WEBER = {
  name: '秩序会书记员 Frau Weber',
  de: 'Frau Weber · Ordnungsamt',
  intro: [
    '办事处的窗口后面坐着一位戴老花镜的女士，桌上摞着一叠发黄的表格。',
    '「Guten Tag. Weber, Ordnungsamt. Sie möchten sich anmelden? Dann füllen wir zusammen ein Formular aus.」',
    '系统：【秩序会】Frau Weber 用 Sie 问你 5 个问题，你用完整的句子回答自己的情况，不限时。对她要用 Sie，不能用 du。',
  ],
  healLine: '',
  healZh: '',
  tiers: [10, 25, 50],
};

const any = (re: string) => new RegExp(`^(ja |also |hm |gut )?${re}$`);

/** A personal answer: ich-sentence patterns. Names and places are free text. */
const POOL: BossQuestion[] = [
  { id: 'name', ask: ['Wie heißen Sie?', 'Ihr Name, bitte?'], zh: '问你叫什么（Ich heiße …）', accept: [any('(ich heisse|mein name ist|ich bin) [a-z ]+')], model: 'Ich heiße {name}.' },
  { id: 'vorname', ask: ['Wie ist Ihr Vorname?'], zh: '问你的名（Mein Vorname ist …）', accept: [any('(mein vorname ist|ich heisse)? ?[a-z]+( [a-z]+)?')], model: 'Mein Vorname ist {name}.' },
  { id: 'nachname', ask: ['Wie ist Ihr Familienname?', 'Und Ihr Nachname?'], zh: '问你的姓（Mein Familienname ist …）', accept: [any('(mein (familien|nach)name ist )?[a-z]+( [a-z]+)?')], model: 'Mein Familienname ist Wang.' },
  { id: 'woher', ask: ['Woher kommen Sie?', 'Aus welchem Land kommen Sie?'], zh: '问你从哪里来（Ich komme aus …）', accept: [any('ich komme aus( der| dem)? [a-z ]+')], model: 'Ich komme aus China.', traps: [[/^ich komme [a-z]+$/, '国家前面要加 aus：Ich komme aus …']] },
  { id: 'wohnen', ask: ['Wo wohnen Sie?', 'Wo wohnen Sie jetzt?'], zh: '问你住在哪里（Ich wohne in …）', accept: [any('ich wohne (in|im|bei|am) [a-z ]+')], model: 'Ich wohne in Gleisdorf.' },
  { id: 'adresse', ask: ['Wie ist Ihre Adresse?'], zh: '问你的地址（Meine Adresse ist …）', accept: [any('(meine adresse ist |ich wohne in der )[a-z ]+')], model: 'Meine Adresse ist Bahnhofstraße zwölf.', traps: [[/\d/, '门牌号也写成单词：zwölf']] },
  { id: 'beruf', ask: ['Was sind Sie von Beruf?', 'Was machen Sie beruflich?'], zh: '问你的职业（Ich bin … / Ich arbeite als …）', accept: [any('(ich bin|ich arbeite als|ich arbeite bei|ich studiere|ich lerne) [a-z ]+')], model: 'Ich bin Student.' },
  { id: 'telefon', ask: ['Wie ist Ihre Telefonnummer?', 'Und Ihre Handynummer?'], zh: '问你的电话号码（数字写成单词）', accept: [any('(meine (telefon|handy)nummer ist )?(null|eins|zwei|drei|vier|fuenf|sechs|sieben|acht|neun|zwo)( (null|eins|zwei|drei|vier|fuenf|sechs|sieben|acht|neun|zwo))+')], model: 'Meine Telefonnummer ist null eins fünf sieben …', traps: [[/\d/, '数字要写成单词：null eins fünf …']] },
  { id: 'alter', ask: ['Wie alt sind Sie?'], zh: '问你几岁（数字写成单词）', accept: [any('ich bin [a-z]+( jahre alt)?')], model: 'Ich bin dreiundzwanzig Jahre alt.', traps: [[/\d/, '数字要写成单词：dreiundzwanzig']] },
  { id: 'geboren', ask: ['Wann sind Sie geboren?', 'Wann haben Sie Geburtstag?'], zh: '问你的生日', accept: [any('ich bin (am|im) [a-z ]+ geboren'), any('(ich habe |mein geburtstag ist )?(am|im) [a-z ]+( geburtstag)?')], model: 'Ich bin im Mai geboren.' },
  { id: 'sprachen', ask: ['Welche Sprachen sprechen Sie?'], zh: '问你会说哪些语言（Ich spreche …）', accept: [any('ich spreche [a-z ]+')], model: 'Ich spreche Chinesisch und ein bisschen Deutsch.' },
  { id: 'seit', ask: ['Seit wann sind Sie hier?', 'Seit wann wohnen Sie in Deutschland?'], zh: '问你从什么时候起在这里（Seit …）', accept: [any('((ich bin|ich wohne) (hier |in deutschland )?)?seit [a-z ]+')], model: 'Ich bin seit einem Jahr hier.' },
  { id: 'verheiratet', ask: ['Sind Sie verheiratet?'], zh: '问你结婚了没有', accept: [any('(ja|nein)( ich bin (nicht )?(verheiratet|ledig|single))?'), any('ich bin (nicht )?(verheiratet|ledig|single)')], model: 'Nein, ich bin ledig.' },
  { id: 'kinder', ask: ['Haben Sie Kinder?'], zh: '问你有没有孩子', accept: [any('(ja|nein)( ich habe (keine kinder|ein kind|[a-z]+ kinder))?'), any('ich habe (keine kinder|ein kind|[a-z]+ kinder)')], model: 'Nein, ich habe keine Kinder.' },
  { id: 'bleiben', ask: ['Wie lange bleiben Sie?', 'Wie lange bleiben Sie in Gleisdorf?'], zh: '问你待多久（Ich bleibe …）', accept: [any('(ich bleibe )?([a-z]+ )*(tag|tage|woche|wochen|monat|monate|jahr|jahre|lange)( hier)?')], model: 'Ich bleibe zwei Wochen.' },
  { id: 'unterschreiben', ask: ['Können Sie hier bitte unterschreiben?'], zh: '请你在这里签字', accept: [any('(ja|ja klar|ja gerne|ja natuerlich|natuerlich|klar|gerne|kein problem)( hier| bitte| gerne)*')], model: 'Ja, gerne.' },
  { id: 'gekommen', ask: ['Wann sind Sie nach Gleisdorf gekommen?'], zh: '问你什么时候来的（完成时）', accept: [], grade: gradePerfekt, model: 'Ich bin gestern gekommen.' },
  { id: 'vorher', ask: ['Wo haben Sie vorher gewohnt?'], zh: '问你以前住在哪里（完成时）', accept: [], grade: gradePerfekt, model: 'Ich habe in Brotmarkt gewohnt.' },
  { id: 'gestern', ask: ['Was haben Sie gestern gemacht?'], zh: '问你昨天做了什么（完成时）', accept: [], grade: gradePerfekt, model: 'Ich habe Deutsch gelernt.' },
  { id: 'zug', ask: ['Sind Sie mit dem Zug gekommen?', 'Wie sind Sie hierher gekommen?'], zh: '问你怎么来的（完成时）', accept: [], grade: gradePerfekt, model: 'Ich bin mit dem Bus gekommen.' },
];

export const WEBER_POOL = POOL;

/** du / dich / dir / dein… towards Frau Weber: not wrong, but answer again with Sie. */
export function usesDu(input: string): boolean {
  return /\b(du|dich|dir|dein|deine|deinen|deinem|deiner)\b/.test(normalize(input));
}

export function weberQuestions(rng: Rng): BossQuestion[] {
  const pick = shuffle(rng, POOL);
  // Start with the name, like a real form.
  const first = POOL[0];
  return [first, ...pick.filter((q) => q.id !== first.id).slice(0, 4)];
}
