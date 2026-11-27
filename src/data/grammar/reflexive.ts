// 镜像怪 (35 级, 游戏设计 十六「语法线」): reflexive pronouns. Accusative from 35 (Ich freue mich), dative from 81
// (Ich wasche mir die Hände). Verbs not in the word list yet wait for the 6000-word import.
// [sentence with ___, answer, Chinese]. Written by Claude; goes through the auto-proofreading pipeline.

export const REFLEXIVE_ACC: Record<string, Array<[string, string, string]>> = {
  waschen: [['Ich wasche ___ jeden Morgen.', 'mich', '我每天早上洗漱。'], ['Das Kind wäscht ___ allein.', 'sich', '孩子自己洗。']],
  treffen: [['Wir treffen ___ um acht Uhr.', 'uns', '我们八点见面。'], ['Trefft ihr ___ morgen?', 'euch', '你们明天见面吗？']],
  freuen: [['Ich freue ___ sehr.', 'mich', '我很高兴。'], ['Freust du ___ auf den Urlaub?', 'dich', '你期待假期吗？']],
  setzen: [['Bitte setzen Sie ___.', 'sich', '请坐。'], ['Ich setze ___ ans Fenster.', 'mich', '我坐到窗边。']],
  anziehen: [['Ich ziehe ___ schnell an.', 'mich', '我很快穿好衣服。'], ['Zieh ___ warm an!', 'dich', '穿暖和点！']],
  duschen: [['Ich dusche ___ am Abend.', 'mich', '我晚上洗澡。'], ['Er duscht ___ nach dem Sport.', 'sich', '他运动后洗澡。']],
  beeilen: [['Wir müssen ___ beeilen.', 'uns', '我们得快点。'], ['Beeil ___!', 'dich', '你快点！']],
  fühlen: [['Ich fühle ___ nicht gut.', 'mich', '我感觉不舒服。'], ['Wie fühlst du ___?', 'dich', '你感觉怎么样？']],
  vorstellen: [['Darf ich ___ vorstellen?', 'mich', '我可以自我介绍吗？'], ['Sie stellt ___ kurz vor.', 'sich', '她简短地自我介绍。']],
  erinnern: [['Ich erinnere ___ nicht.', 'mich', '我想不起来了。'], ['Erinnerst du ___ an mich?', 'dich', '你还记得我吗？']],
  ärgern: [['Ich ärgere ___ über den Lärm.', 'mich', '我对噪音很恼火。'], ['Ärgere ___ nicht!', 'dich', '别生气！']],
  interessieren: [['Ich interessiere ___ für Musik.', 'mich', '我对音乐感兴趣。'], ['Interessierst du ___ für Fußball?', 'dich', '你对足球感兴趣吗？']],
  entschuldigen: [['Ich entschuldige ___ für die Verspätung.', 'mich', '我为迟到道歉。'], ['Er entschuldigt ___ bei ihr.', 'sich', '他向她道歉。']],
  verlieben: [['Sie verliebt ___ in ihn.', 'sich', '她爱上了他。']],
  ausruhen: [['Ich ruhe ___ ein bisschen aus.', 'mich', '我稍微休息一下。']],
};

/** Dative reflexive (81 级): when the sentence already has an accusative object. */
export const REFLEXIVE_DAT: Record<string, Array<[string, string, string]>> = {
  waschen: [['Ich wasche ___ die Hände.', 'mir', '我洗手。'], ['Wasch ___ die Haare!', 'dir', '你洗洗头！']],
  putzen: [['Ich putze ___ die Zähne.', 'mir', '我刷牙。'], ['Hast du ___ die Zähne geputzt?', 'dir', '你刷牙了吗？']],
  anziehen: [['Ich ziehe ___ eine Jacke an.', 'mir', '我穿上一件夹克。'], ['Zieh ___ die Schuhe an!', 'dir', '把鞋穿上！']],
  vorstellen: [['Ich stelle ___ das schwierig vor.', 'mir', '我想象那很难。'], ['Stell ___ vor, …', 'dir', '你想象一下……']],
  merken: [['Ich merke ___ die Nummer.', 'mir', '我记住这个号码。'], ['Merk ___ das!', 'dir', '你记住这个！']],
  kaufen: [['Ich kaufe ___ ein neues Handy.', 'mir', '我给自己买个新手机。']],
};

export const REFL_ZH: Record<string, string> = { mich: '我自己', dich: '你自己', sich: '他/她/您自己', uns: '我们自己', euch: '你们自己', mir: '我自己（第三格）', dir: '你自己（第三格）' };
