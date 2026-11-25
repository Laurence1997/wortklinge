// A1 语法补全 (0.6.x, 游戏设计 十六「语法线」): sentences the generators can't build from the example bank.
// Written for Wortklinge (no copied sources); goes through the auto-proofreading pipeline (LanguageTool + AI).

/** 可分动词现在时 (12 级): one sentence per separable verb. {finite} is the conjugated part, [particle] the prefix
 *  at the end. Key = the verb as in CONJ. */
export const SEP_EX: Record<string, string[]> = {
  abholen: ['Ich {hole} dich um acht Uhr [ab].|我八点来接你。', 'Wer {holt} die Kinder [ab]?|谁去接孩子？'],
  einsteigen: ['Wir {steigen} hier [ein].|我们在这里上车。', 'Bitte {steigen} Sie vorne [ein].|请从前门上车。'],
  aussteigen: ['Ich {steige} am Bahnhof [aus].|我在火车站下车。', '{Steigst} du hier [aus]?|你在这里下车吗？'],
  umsteigen: ['Wir {steigen} in Köln [um].|我们在科隆换车。', 'Wo {steigt} er [um]?|他在哪里换车？'],
  abfahren: ['Der Zug {fährt} um neun Uhr [ab].|火车九点开。', 'Wann {fahrt} ihr [ab]?|你们什么时候出发？'],
  ankommen: ['Der Bus {kommt} um zehn Uhr [an].|公交车十点到。', 'Wann {kommst} du in Berlin [an]?|你什么时候到柏林？'],
  mitnehmen: ['Ich {nehme} einen Schirm [mit].|我带一把伞。', '{Nimmst} du Wasser [mit]?|你带水吗？'],
  abbiegen: ['An der Ampel {biegen} Sie links [ab].|在红绿灯处您左转。', 'Hier {biege} ich rechts [ab].|我在这里右转。'],
  anrufen: ['Ich {rufe} dich morgen [an].|我明天给你打电话。', '{Rufst} du deine Mutter [an]?|你给你妈妈打电话吗？'],
  wehtun: ['Mein Kopf {tut} [weh].|我头疼。', 'Mein Bauch {tut} sehr [weh].|我肚子很疼。'],
  'spazieren gehen': ['Am Sonntag {gehen} wir im Park [spazieren].|星期天我们在公园散步。'],
  einladen: ['Ich {lade} dich zum Essen [ein].|我请你吃饭。', 'Sie {lädt} ihre Freunde [ein].|她邀请她的朋友。'],
  kennenlernen: ['Hier {lernst} du viele Leute [kennen].|在这里你会认识很多人。'],
  aufstehen: ['Ich {stehe} jeden Tag um sieben Uhr [auf].|我每天七点起床。', 'Wann {stehst} du [auf]?|你几点起床？'],
  aufwachen: ['Ich {wache} oft in der Nacht [auf].|我夜里常醒。', 'Das Baby {wacht} um sechs [auf].|宝宝六点醒。'],
  einschlafen: ['Ich {schlafe} schnell [ein].|我很快就睡着了。', 'Er {schläft} vor dem Fernseher [ein].|他在电视前睡着了。'],
  zurückkommen: ['Ich {komme} um fünf Uhr [zurück].|我五点回来。', 'Wann {kommt} ihr [zurück]?|你们什么时候回来？'],
  weggehen: ['Ich {gehe} jetzt [weg].|我现在走了。', '{Gehst} du heute Abend [weg]?|你今晚出去吗？'],
};

/** war / hatte (21 级, 并进完成时): Präteritum of sein and haben, one person each. {form} is blanked. */
export const PRAET_SEIN: string[] = [
  'Gestern {war} ich krank.|我昨天病了。',
  'Wo {warst} du am Wochenende?|你周末在哪儿？',
  'Das Wetter {war} sehr schön.|天气很好。',
  'Wir {waren} letzte Woche in Hamburg.|我们上周在汉堡。',
  '{Wart} ihr schon in Wien?|你们去过维也纳吗？',
  'Die Züge {waren} heute pünktlich.|今天火车很准时。',
  'Der Kaffee {war} zu kalt.|咖啡太凉了。',
];
export const PRAET_HABEN: string[] = [
  'Ich {hatte} keine Zeit.|我当时没有时间。',
  '{Hattest} du gestern Hunger?|你昨天饿吗？',
  'Sie {hatte} einen Termin beim Arzt.|她约了看医生。',
  'Wir {hatten} viel Glück.|我们运气很好。',
  'Ihr {hattet} Recht.|你们说得对。',
  'Die Kinder {hatten} Ferien.|孩子们放假了。',
  'Er {hatte} Kopfschmerzen.|他头疼。',
];

/** 情态动词: present form → Präteritum form (the person stays the same). möchte → wollte. */
export const MODAL_PAST: Record<string, string> = {
  muss: 'musste', musst: 'musstest', müssen: 'mussten', müsst: 'musstet',
  kann: 'konnte', kannst: 'konntest', können: 'konnten', könnt: 'konntet',
  will: 'wollte', willst: 'wolltest', wollen: 'wollten', wollt: 'wolltet',
  darf: 'durfte', darfst: 'durftest', dürfen: 'durften', dürft: 'durftet',
  soll: 'sollte', sollst: 'solltest', sollen: 'sollten', sollt: 'solltet',
  möchte: 'wollte', möchtest: 'wolltest', möchten: 'wollten', möchtet: 'wolltet',
};
export const MODAL_INF: Record<string, string> = {
  muss: 'müssen', musst: 'müssen', müssen: 'müssen', müsst: 'müssen',
  kann: 'können', kannst: 'können', können: 'können', könnt: 'können',
  will: 'wollen', willst: 'wollen', wollen: 'wollen', wollt: 'wollen',
  darf: 'dürfen', darfst: 'dürfen', dürfen: 'dürfen', dürft: 'dürfen',
  soll: 'sollen', sollst: 'sollen', sollen: 'sollen', sollt: 'sollen',
  möchte: 'möchten', möchtest: 'möchten', möchten: 'möchten', möchtet: 'möchten',
};
/** The ich-forms used to build a modal sentence from an ich-sentence, with the Chinese word put after 我. */
export const MODAL_BUILD: Array<{ de: string; zh: string }> = [
  { de: 'muss', zh: '得' },
  { de: 'möchte', zh: '想' },
  { de: 'kann', zh: '能' },
  { de: 'will', zh: '要' },
];
