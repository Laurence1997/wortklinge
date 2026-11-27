import type { AiGrade } from '../net/aiTutor';
import type { Line } from '../ui/feedback';

/** The AI teacher's verdict as dialogue lines; never empty (an empty say() would leave the dialog stuck).
 *  审核 1.0.10: `text` = the player's own text, so a rewrite that only echoes it is dropped (case counts: in German
 *  「hause」→「Hause」 is a real fix); empty or malformed error
 *  items are skipped; on an ok verdict the errors read as 「小问题」, not as a failing grade. `okWord` replaces
 *  「写得对」 (小作文 with skipped words). */
export function gradeLines(r: AiGrade, text = '', okWord = '写得对'): Line[] {
  const norm = (x: string) => x.replace(/[\s.,!?;:„“”"'»«…-]+/g, ' ').trim();
  const str = (x: unknown) => (typeof x === 'string' ? x.trim() : '');
  const rb = str(r.better);
  const better = rb && norm(rb) !== norm(text) ? rb : '';
  const errors = (Array.isArray(r.errors) ? r.errors : []).map((x) => ({ bad: str(x?.bad), fix: str(x?.fix), why: str(x?.why) })).filter((x) => x.bad || x.why);
  if (r.ok && !errors.length) return [{ who: '批改', text: `${okWord}。${better ? `更自然的说法：${better}` : ''}` }];
  const out: Line[] = [
    ...errors.map((x) => ({ who: '批改', text: `${r.ok ? '小问题：' : ''}${x.bad ? `「${x.bad}」${x.fix ? `→「${x.fix}」` : ''}${x.why ? `：${x.why}` : ''}` : x.why}` })),
    ...(better ? [{ who: '批改', text: `${r.ok ? '更好的写法' : '改好的'}：${better}` }] : []),
  ];
  return out.length ? out : [{ who: '批改', text: '这次批改没给出具体意见，再试一次。' }];
}
