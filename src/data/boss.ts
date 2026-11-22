// Region 1 boss: 无名的邻居 · Der namenlose Nachbar.
// A timed conversation with the neighbour every new arrival meets: who are you, where are you from.
// Phrasings are drawn at random, so you can't memorise answers, only learn to answer.

export interface BossQuestion {
  id: string;
  /** Variants the boss may say. */
  ask: string[];
  zh: string;
  /** Accepted answers, tested on normalized text (lowercase, ae/oe/ue/ss, no punctuation). */
  accept: RegExp[];
  /** Model answer shown after a miss. */
  model: string;
  /** Region 2: the price tag or count shown on screen. */
  visual?: string;
  /** Region 3: a grader instead of patterns (Perfekt answers about yourself). */
  grade?: (input: string) => { ok: boolean; note: string | null };
  /** Mistakes worth naming: [pattern, note]. */
  traps?: Array<[RegExp, string]>;
}

const WORD = "[a-z]+";

export const BOSS_QUESTIONS: BossQuestion[] = [
  {
    id: 'greet',
    ask: ['Guten Tag!', 'Hallo!', 'Guten Abend!'],
    zh: '打招呼',
    accept: [/^(guten (tag|morgen|abend)|hallo|hi|moin|servus|gruess gott)( |$)/],
    model: 'Guten Tag!',
  },
  {
    id: 'name',
    ask: ['Wie heißen Sie?', 'Wie heißt du?', 'Wie ist Ihr Name?', 'Und Sie? Wer sind Sie?'],
    zh: '问你叫什么',
    accept: [/^(ich heisse|ich bin|mein name ist|ich heiss) \S+/],
    model: 'Ich heiße {name}.',
    traps: [[new RegExp(`^${WORD}$`), '用完整的句子回答：Ich heiße …']],
  },
  {
    id: 'origin',
    ask: ['Woher kommen Sie?', 'Woher kommst du?', 'Und woher kommen Sie?'],
    zh: '问你从哪里来',
    accept: [new RegExp(`^ich komme aus ${WORD}`), new RegExp(`^aus ${WORD}`)],
    model: 'Ich komme aus China.',
    traps: [
      [/^ich komme von /, '从某个国家来用 aus：Ich komme aus …'],
      [/^ich bin aus /, '可以理解，但更常说：Ich komme aus …'],
    ],
  },
  {
    id: 'home',
    ask: ['Wo wohnen Sie?', 'Wo wohnst du?', 'Und wo wohnen Sie jetzt?'],
    zh: '问你住在哪里',
    accept: [new RegExp(`^ich wohne (jetzt )?(in|hier|im|bei) ?${WORD}?`), new RegExp(`^in ${WORD}`)],
    model: 'Ich wohne in Berlin.',
    traps: [[/^ich lebe /, 'leben 也对，但问 wohnen 就答 Ich wohne in …']],
  },
  {
    id: 'lang',
    ask: ['Welche Sprachen sprechen Sie?', 'Sprechen Sie Deutsch?', 'Sprichst du Englisch?'],
    zh: '问你会说什么语言',
    accept: [
      new RegExp(`^(ja |nein )?(ich spreche) ${WORD}`),
      /^(ja|nein)( |$)/,
      /^(ein bisschen|ein wenig)/,
    ],
    model: 'Ich spreche Chinesisch und ein bisschen Deutsch.',
    traps: [[/^ich sprechen /, 'ich 后面是 spreche：Ich spreche …']],
  },
  {
    id: 'job',
    ask: ['Was sind Sie von Beruf?', 'Was machen Sie beruflich?', 'Was machst du hier?'],
    zh: '问你的职业',
    accept: [
      new RegExp(`^ich bin ${WORD}`),
      new RegExp(`^ich arbeite (als|bei|in) ${WORD}`),
      new RegExp(`^ich (studiere|lerne)`),
    ],
    model: 'Ich bin Student. / Ich bin Studentin.',
    traps: [[/^ich bin ein (student|lehrer|arzt|koch|ingenieur)/, '说职业不加 ein：Ich bin Student.']],
  },
  {
    id: 'age',
    ask: ['Wie alt sind Sie?', 'Wie alt bist du?'],
    zh: '问你几岁',
    accept: [/^ich bin ([0-9]+|[a-z]+) (jahre alt|jahre)?$/, /^ich bin ([0-9]+|[a-z]+)$/, /^([0-9]+|[a-z]+zig|[a-z]+zehn)( jahre( alt)?)?$/],
    model: 'Ich bin 24 Jahre alt.',
    traps: [[/^ich habe /, '年龄用 sein：Ich bin … Jahre alt.']],
  },
  {
    id: 'phone',
    ask: ['Wie ist Ihre Telefonnummer?', 'Haben Sie eine Telefonnummer?'],
    zh: '问你的电话号码',
    accept: [/^(meine (telefon)?nummer ist |ja |die nummer ist )?[0-9 ]{3,}$/, /^((null|eins|zwei|drei|vier|fuenf|sechs|sieben|acht|neun) ?){3,}$/],
    model: 'Meine Nummer ist 0176 123 456.',
  },
  {
    id: 'spell',
    ask: ['Wie schreibt man das?', 'Buchstabieren Sie bitte!'],
    zh: '让你拼写你的名字',
    accept: [/^([a-z] ?){2,}$/],
    model: 'L – U – C – A – S（一个字母一个字母地写）',
  },
  {
    id: 'siblings',
    ask: ['Haben Sie Geschwister?', 'Hast du Geschwister?'],
    zh: '问你有没有兄弟姐妹',
    accept: [/^(ja|nein)( |$)/, /^ich habe (einen|eine|zwei|drei|vier|keine) /],
    model: 'Ja, ich habe einen Bruder. / Nein, ich habe keine Geschwister.',
    traps: [[/^ich habe kein geschwister/, 'Geschwister 是复数：keine Geschwister']],
  },
  {
    id: 'mood',
    ask: ['Wie geht es Ihnen?', 'Wie geht’s?'],
    zh: '问你好不好',
    accept: [/(gut|super|toll|es geht|nicht so gut|schlecht|muede|krank|okay|ok|prima)/],
    model: 'Gut, danke! Und Ihnen?',
  },
];

export const BOSS = {
  name: '无名的邻居',
  de: 'Der namenlose Nachbar',
  intro: [
    '门开了一条缝。门后的东西没有脸，只有一块空白的名牌。',
    '「Guten Tag …」它的声音像从很远的楼道里传来。「Ich kenne Sie nicht.」',
    '系统：它想知道你是谁。用完整的德语句子回答它，回答得越快越好。',
  ],
  healLine: 'Ich mache eine Pause.',
  healZh: '我休息一下。（它要回血！下一题答对才能抢在它回血前打倒它）',
  outro: [
    '名牌上慢慢浮出几个字母。',
    '「… Freut mich.」它第一次笑了。',
    '系统：你完成了来到这里以后的第一场德语对话。',
  ],
};
