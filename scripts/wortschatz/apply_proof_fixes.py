"""Apply the Luna cross-check findings to the data/wortschatz/*.tsv files that have a 例句 column.

Input: a proofread log (lines `[severity] id | text | zh | problem → fix`, as scripts/proof/deepseek.ts prints them).
Files: beispiele-6000 (sentences), hoeren-6000 (listening passages), briefe-1.0 (letters), artikel-b2 (articles).
- translation: the fix is Chinese → replaces 例句中文.
- error: the fix is German → replaces 例句; 例句中文 is cleared so examples_fill_luna.py translates it again
  (for passages, letters and articles 例句中文 is kept, see below).
- unnatural: same as error, except for Tatoeba sentences and Wikinews/Wikipedia articles (native text).
For the multi-sentence files (passages ｜, letters, articles) a fix is applied only if it is the whole text (at least
70 % of the old length) — a fix that quotes one sentence is put into the review list instead; their Chinese is kept
(the change is small) and listed for review.
A changed Tatoeba sentence keeps its id and author with「Luna 改」(CC BY: attribution + changes marked).
Writes data/wortschatz/build/review/proof-fixes.tsv with every change (and skipped partial fixes) for review.
Usage: python3 scripts/wortschatz/apply_proof_fixes.py <log>
"""
import csv, os, re, sys

ROOT = os.path.join(os.path.dirname(__file__), '..', '..')
W = os.path.join(ROOT, 'data', 'wortschatz')
csv.field_size_limit(10**8)
CJK = re.compile(r'[一-鿿]')
LINE = re.compile(r'\[(error|unnatural|translation)\] tsv:wortschatz/([^:]+):[^:]*:(\d+) \| (.*?) \| (.*?) \| (.*)$')
MULTI = {'hoeren-6000', 'briefe-1.0', 'artikel-b2', 'artikel-b2-original'}
NATIVE = {'artikel-b2'}
files, log, done = {}, [], set()
def rows_of(name):
    if name not in files:
        p = os.path.join(W, name + '.tsv')
        files[name] = list(csv.DictReader(open(p, encoding='utf-8'), delimiter='\t')) if os.path.exists(p) else None
    return files[name]
norm = lambda s: re.sub(r'\s+', ' ', s.replace('｜', ' ')).strip()
for line in open(sys.argv[1], encoding='utf-8', errors='replace'):
    m = LINE.search(line.rstrip('\n'))
    if not m: continue
    sev, name, n, text, zh, rest = m.groups()
    rows = rows_of(name)
    i = int(n) - 1
    if rows is None or (name, i) in done or not 0 <= i < len(rows): continue
    r = rows[i]
    if norm(r['例句']) != norm(text): continue
    problem, _, fix = rest.partition(' → ')
    fix = fix.strip()
    if not fix: continue
    multi = name in MULTI
    src = r.get('例句出处', '')
    tat = src.startswith('Tatoeba') or name in NATIVE
    if sev == 'translation':
        if not CJK.search(fix): continue
        if multi and len(fix) < 0.7 * len(r['例句中文']):
            log.append([name, r.get('原形') or r.get('id', ''), sev + '（部分，未改）', r['例句'], r['例句中文'], fix, problem]); continue
        log.append([name, r.get('原形') or r.get('id', ''), sev, r['例句'], r['例句中文'], fix, problem]); r['例句中文'] = fix
    else:
        if CJK.search(fix) or norm(fix) == norm(text) or (sev == 'unnatural' and tat): continue
        if multi and len(fix) < 0.7 * len(norm(r['例句'])):
            log.append([name, r.get('原形') or r.get('id', ''), sev + '（部分，未改）', r['例句'], r['例句中文'], fix, problem]); continue
        log.append([name, r.get('原形') or r.get('id', ''), sev, r['例句'], r['例句中文'], fix, problem])
        if multi:
            # keep the line / paragraph breaks where the fix kept the sentence count; otherwise one block
            r['例句'] = fix
        else:
            r['例句'] = fix; r['例句中文'] = ''
            if src.startswith('Tatoeba') and 'Luna 改' not in src: r['例句出处'] += '（Luna 改）'
            elif src and src != 'Luna 写' and 'Luna 改' not in src: r['例句出处'] = f'{src}（Luna 改）'
    done.add((name, i))
for name, rows in files.items():
    if not rows: continue
    with open(os.path.join(W, name + '.tsv'), 'w', encoding='utf-8', newline='') as f:
        w = csv.DictWriter(f, fieldnames=list(rows[0].keys()), delimiter='\t', lineterminator='\n'); w.writeheader(); w.writerows(rows)
out = os.path.join(W, 'build', 'review', 'proof-fixes.tsv')
os.makedirs(os.path.dirname(out), exist_ok=True)
with open(out, 'w', encoding='utf-8', newline='') as f:
    w = csv.writer(f, delimiter='\t', lineterminator='\n'); w.writerow(['文件', '词或编号', '类型', '原文', '原中文', '改成', '问题']); w.writerows(log)
from collections import Counter
print(f"logged {len(log)}: " + ', '.join(f'{k} {v}' for k, v in Counter((x[0], x[2]) for x in log).items()))
