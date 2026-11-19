// 句式攻击说的是眼前这只怪 (游戏设计 › 招式, 2026-11-19): the sentence must use the target's own noun,
// with the article its case needs. Each noun carries 0–2 sentence patterns (data: SENTENCE_TAGS);
// the first sentence in a fight uses the first pattern, the second the second, then the move greys out.

import { gradeNehme, normalize, type SentenceVerdict } from './grading';
import { genderOf } from '../data/words';
import { SENTENCE_TAGS, type Pattern } from '../data/sentenceTags';
import type { Word } from './types';

export type { Pattern };

type ArtKind = 'indefAcc' | 'defAcc' | 'defNom' | 'possNom' | 'none';

export const PATTERNS: Record<Pattern, { lead: string; art: ArtKind; q?: boolean; zh: string }> = {
  moechte: { lead: 'Ich möchte', art: 'indefAcc', zh: '我想要一个' },
  brauche: { lead: 'Ich brauche', art: 'indefAcc', zh: '我需要一个' },
  nehme: { lead: 'Ich nehme', art: 'indefAcc', zh: '我要（买）' },
  moechte0: { lead: 'Ich möchte', art: 'none', zh: '我想要（不可数，不带冠词）' },
  brauche0: { lead: 'Ich brauche', art: 'none', zh: '我需要（不可数，不带冠词）' },
  woist: { lead: 'Wo ist', art: 'defNom', q: true, zh: '……在哪儿？（第一格）' },
  suche: { lead: 'Ich suche', art: 'defAcc', zh: '我在找（第四格）' },
  habe: { lead: 'Ich habe', art: 'indefAcc', zh: '我有一个' },
  mein: { lead: 'Das ist', art: 'possNom', zh: '这是我的' },
};

const ARTS: Record<ArtKind, Record<'m' | 'f' | 'n', string>> = {
  indefAcc: { m: 'einen', f: 'eine', n: 'ein' },
  defAcc: { m: 'den', f: 'die', n: 'das' },
  defNom: { m: 'der', f: 'die', n: 'das' },
  possNom: { m: 'mein', f: 'meine', n: 'mein' },
  none: { m: '', f: '', n: '' },
};

const CASE_ZH: Record<ArtKind, string> = {
  indefAcc: '第四格不定冠词：阳性 einen，阴性 eine，中性 ein',
  defAcc: '第四格定冠词：阳性 den，阴性 die，中性 das',
  defNom: 'Wo ist 后面是第一格：der / die / das',
  possNom: '第一格：阳性、中性 mein，阴性 meine',
  none: '不可数名词，不带冠词',
};

export function sentenceTags(w: Word): Pattern[] {
  return SENTENCE_TAGS[w.id] ?? [];
}

/** The pattern the next sentence attack on this word uses, or null when none is left. */
export function nextPattern(w: Word, used: number): Pattern | null {
  return sentenceTags(w)[used] ?? null;
}

export function expectedSentence(w: Word, p: Pattern): string {
  const P = PATTERNS[p];
  const g = (genderOf(w) ?? 'n') as 'm' | 'f' | 'n';
  const art = ARTS[P.art][g === ('pl' as string) ? 'f' : g];
  return `${P.lead} ${art ? art + ' ' : ''}${w.de}${P.q ? '?' : '.'}`;
}

const key = (v: string) =>
  normalize(v)
    .split(/\s+/)
    .filter((t) => t && t !== 'bitte' && t !== 'gern' && t !== 'gerne')
    .join(' ');

export function gradeSentence(input: string, w: Word, p: Pattern): SentenceVerdict & { plural?: boolean } {
  const correct = expectedSentence(w, p);
  // 第 2 区「Ich nehme」keeps its plural form: Ich nehme zwei Äpfel.
  if (p === 'nehme') {
    const v = gradeNehme(input, [w]);
    if (v.ok || v.word) return v;
    return { ...v, correct, notes: [`要说眼前这只怪：${correct}`] };
  }
  const P = PATTERNS[p];
  const lead = key(P.lead);
  let n = key(input);
  // The box starts pre-filled with the lead; forgive typing it twice.
  while (n.startsWith(`${lead} ${lead}`)) n = n.slice(lead.length + 1);
  if (n === key(correct)) return { ok: true, notes: [], correct, word: w };
  const notes: string[] = [];
  if (!n.startsWith(lead + ' ')) notes.push(`句型是：${P.lead} …`);
  else {
    const rest = n.slice(lead.length + 1).split(' ');
    const noun = key(w.de);
    const nounAt = rest.join(' ').endsWith(noun);
    if (!nounAt) notes.push(`要说眼前这只怪的名字：${w.de}`);
    else {
      const artIn = rest.slice(0, rest.length - noun.split(' ').length).join(' ');
      const g = (genderOf(w) ?? 'n') as 'm' | 'f' | 'n';
      const want = ARTS[P.art][g];
      if (artIn !== key(want)) notes.push(`${w.art ?? ''} ${w.de}：${CASE_ZH[P.art]}`.trim());
    }
  }
  return { ok: false, notes, correct, word: w };
}
