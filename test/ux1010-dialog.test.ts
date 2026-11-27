import { describe, expect, it } from 'vitest';
import { freshNote } from '../src/core/npcNotes';

describe('ux 1.0.10 dialog: freshNote keeps real corrections', () => {
  it('keeps a note that quotes the fix first, the fix only, or a missing word', () => {
    const run = {};
    const a = '应该说「ich bin gegangen」，不是「ich habe gegangen」';
    expect(freshNote(run, a, 'Ich habe gegangen.')).toBe(a);
    const b = '缺少动词，应该是「Ich bin in Berlin」';
    expect(freshNote(run, b, 'Ich in Berlin.')).toBe(b);
    const c = '拼写：「Brötchen」';
    expect(freshNote(run, c, 'Ich möchte zwei Broetchen.')).toBe(c);
  });

  it('ignores Chinese terms in 「」 and matches quotes with an ellipsis', () => {
    const run = {};
    const a = '这里要用「完成时」的 sein：应该说「Ich bin gegangen」';
    expect(freshNote(run, a, 'Ich habe nach Hause gegangen.')).toBe(a);
    const b = '「habe … gegangen」要改成「bin … gegangen」';
    expect(freshNote(run, b, 'Ich habe gestern gegangen.')).toBe(b);
  });

  it('still drops a correction about an earlier line, and exact repeats', () => {
    const run = {};
    const a = '「einen Problem」应为「ein Problem」';
    expect(freshNote(run, a, 'Ich habe einen Problem.')).toBe(a);
    expect(freshNote(run, '这里要用「完成时」。', 'Ich habe gegangen.')).toBe('这里要用「完成时」。');
    expect(freshNote(run, '「einen Problem」要用中性：ein Problem', 'Morgen um zehn.')).toBe(''); // new wording, old line
    expect(freshNote(run, '这里要用「完成时」。', 'Ja.')).toBe(''); // repeat
  });
});
