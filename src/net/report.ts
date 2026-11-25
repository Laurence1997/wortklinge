// 「这句有问题」: a player flags a German sentence. One row in Supabase public.sentence_reports (RLS: insert and
// read your own only). The developer reads them in the dashboard and matches them to scripts/proof output by hash.

import { sb, cloud } from './cloud';
import { sentenceHash } from '../core/sentenceId';

let version = '';
/** main.ts passes the game version once at start. */
export function setReportVersion(v: string): void {
  version = v;
}

export type ReportReason = 'wrong' | 'unnatural' | 'translation' | 'grading' | 'other';

export const REASON_ZH: Record<ReportReason, string> = {
  wrong: '德语有错',
  unnatural: '德国人不这么说',
  translation: '中文翻译不对',
  grading: '我的答案也对，被判错了',
  other: '其他',
};

export interface ReportInput {
  sentence: string;
  reason: ReportReason;
  note?: string;
  /** Where it was seen: question type, word id, expected answer, what the player typed, level. */
  context?: Record<string, unknown>;
}

/** Sends one report; returns null on success or a Chinese error message. */
export async function sendReport(r: ReportInput): Promise<string | null> {
  if (!cloud.session) return '登录后才能报告';
  const sentence = r.sentence.replace(/\s+/g, ' ').trim().slice(0, 500);
  if (!sentence) return '没有可报告的句子';
  try {
    const { error } = await sb.from('sentence_reports').insert({
      sentence_hash: sentenceHash(sentence),
      sentence,
      reason: r.reason,
      note: r.note?.trim().slice(0, 500) || null,
      context: r.context ?? {},
      game_version: version || null,
    });
    if (!error) return null;
    if (/too many reports/.test(error.message)) return '今天报告得够多了，明天再来，谢谢！';
    return '没发出去，请稍后再试';
  } catch {
    return '没发出去，请检查网络';
  }
}
