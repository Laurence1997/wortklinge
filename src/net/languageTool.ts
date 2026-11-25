// LanguageTool (public API) for 提示词造句 (97): grammar and spelling matches on one sentence. Network errors → null
// (the check is skipped, the rules and the AI still run).

export interface LtMatch {
  message: string;
  bad: string;
  fix: string;
}

export async function ltCheck(text: string): Promise<LtMatch[] | null> {
  try {
    const body = new URLSearchParams({ text, language: 'de-DE', enabledOnly: 'false' });
    const r = await fetch('https://api.languagetool.org/v2/check', { method: 'POST', body, signal: AbortSignal.timeout(6000) });
    if (!r.ok) return null;
    const j = (await r.json()) as { matches?: Array<{ message: string; offset: number; length: number; replacements?: Array<{ value: string }>; rule?: { issueType?: string; category?: { id?: string } } }> };
    return (j.matches ?? [])
      // Style and punctuation hints don't fail a sentence; grammar and spelling do.
      .filter((m) => ['grammar', 'misspelling'].includes(m.rule?.issueType ?? '') || ['GRAMMAR', 'TYPOS', 'CASING'].includes(m.rule?.category?.id ?? ''))
      .map((m) => ({ message: m.message, bad: text.slice(m.offset, m.offset + m.length), fix: m.replacements?.[0]?.value ?? '' }));
  } catch {
    return null;
  }
}
