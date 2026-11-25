"""Apply the Luna cross-check findings to data/wortschatz/beispiele-6000.tsv.

Input: a proofread log (lines `[severity] id | text | zh | problem → fix`, as scripts/proof/deepseek.ts prints them).
- translation: the fix is Chinese → replaces 例句中文.
- error: the fix is German → replaces 例句; 例句中文 is cleared so examples_fill_luna.py translates it again.
- unnatural: same as error, except for Tatoeba sentences (native speakers; the AI is more often wrong there).
A changed Tatoeba sentence keeps its id and author with「Luna 改」(CC BY: attribution + changes marked).
Writes data/wortschatz/build/review/proof-fixes.tsv with every change for review.
Usage: python3 scripts/wortschatz/apply_proof_fixes.py <log>
"""
import csv, os, re, sys

ROOT = os.path.join(os.path.dirname(__file__), '..', '..')
P = os.path.join(ROOT, 'data', 'wortschatz', 'beispiele-6000.tsv')
rows = list(csv.DictReader(open(P, encoding='utf-8'), delimiter='\t'))
CJK = re.compile(r'[一-鿿]')
LINE = re.compile(r'\[(error|unnatural|translation)\] tsv:wortschatz/beispiele-6000:[^:]*:(\d+) \| (.*?) \| (.*?) \| (.*)$')
log = []
done = set()
for line in open(sys.argv[1], encoding='utf-8', errors='replace'):
    m = LINE.search(line.rstrip('\n'))
    if not m: continue
    sev, n, text, zh, rest = m.groups()
    i = int(n) - 1
    if i in done or not 0 <= i < len(rows) or rows[i]['例句'] != text: continue
    problem, _, fix = rest.partition(' → ')
    fix = fix.strip()
    if not fix: continue
    r = rows[i]; tat = r['例句出处'].startswith('Tatoeba')
    if sev == 'translation':
        if not CJK.search(fix): continue
        log.append([r['原形'], sev, r['例句'], r['例句中文'], fix, problem]); r['例句中文'] = fix
    else:
        if CJK.search(fix) or fix == text or (sev == 'unnatural' and tat): continue
        log.append([r['原形'], sev, r['例句'], r['例句中文'], fix, problem])
        r['例句'] = fix; r['例句中文'] = ''
        if tat and 'Luna 改' not in r['例句出处']: r['例句出处'] += '（Luna 改）'
        elif r['例句出处'] != 'Luna 写': r['例句出处'] = f"{r['例句出处']}（Luna 改）"
    done.add(i)
with open(P, 'w', encoding='utf-8', newline='') as f:
    w = csv.DictWriter(f, fieldnames=list(rows[0].keys()), delimiter='\t', lineterminator='\n'); w.writeheader(); w.writerows(rows)
out = os.path.join(ROOT, 'data', 'wortschatz', 'build', 'review', 'proof-fixes.tsv')
os.makedirs(os.path.dirname(out), exist_ok=True)
with open(out, 'w', encoding='utf-8', newline='') as f:
    w = csv.writer(f, delimiter='\t', lineterminator='\n'); w.writerow(['原形', '类型', '原句', '原中文', '改成', '问题']); w.writerows(log)
print(f"changed {len(log)} rows: " + ', '.join(f"{s} {sum(1 for x in log if x[1] == s)}" for s in ('error', 'unnatural', 'translation')))
