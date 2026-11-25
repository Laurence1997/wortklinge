// 「这句有问题」 button: a small link under the answer feedback. Clicking it pauses the auto-advance and opens
// a one-line form (reason + optional note). After sending or cancelling, Enter goes on to the next question.

import { h } from './dom';
import { toast } from './feedback';
import { cloud } from '../net/cloud';
import { REASON_ZH, sendReport, type ReportReason } from '../net/report';

const sent = new Set<string>();

export function reportButton(sentence: string, context: Record<string, unknown>, pause: () => void): HTMLElement {
  const box = h('span.note.report');
  if (!cloud.session) return box;
  if (sent.has(sentence)) {
    box.append(h('span.muted', '已报告这句，谢谢'));
    return box;
  }
  const open = h('button.btn.small.ghost', { title: '觉得这句德语或翻译有问题？告诉我们' }, '这句有问题？');
  open.addEventListener('click', (e) => {
    e.stopPropagation();
    pause();
    const reason = h(
      'select',
      ...(Object.keys(REASON_ZH) as ReportReason[]).map((k) => h('option', { value: k }, REASON_ZH[k])),
    ) as HTMLSelectElement;
    const note = h('input', { type: 'text', maxlength: '200', placeholder: '哪里不对？可以不写', spellcheck: 'false' }) as HTMLInputElement;
    const send = h('button.btn.small', '发送') as HTMLButtonElement;
    const cancel = h('button.btn.small.ghost', '取消');
    const form = h('span.report-form', h('span.muted', `「${sentence}」 `), reason, note, send, cancel);
    // Keys typed here belong to the form, not to the battle (Enter would continue, W would whisper).
    form.addEventListener('keydown', (ev) => {
      ev.stopPropagation();
      if (ev.key === 'Enter') {
        ev.preventDefault();
        send.click();
      } else if (ev.key === 'Escape') cancel.click();
    });
    const done = (msg: string) => {
      box.replaceChildren(h('span.muted', msg));
    };
    send.addEventListener('click', async (ev) => {
      ev.stopPropagation();
      send.disabled = true;
      const err = await sendReport({ sentence, reason: reason.value as ReportReason, note: note.value, context });
      if (err) {
        send.disabled = false;
        toast(err);
        return;
      }
      sent.add(sentence);
      toast('收到，谢谢！我们会核对这句。');
      done('已报告这句，谢谢');
    });
    cancel.addEventListener('click', (ev) => {
      ev.stopPropagation();
      box.replaceChildren(open);
    });
    box.replaceChildren(form);
    note.focus();
  });
  box.append(open);
  return box;
}
