# Sentence-level fixes for multi-paragraph texts (听段/遗书/文章) from the Luna proofread json; used once on 2026-11-26.
# Usage: python3 apply_proof_long.py <filtered deepseek.json> <log.tsv>; whole-text hoeren fixes were applied separately, see the review tsv.
import csv, json, re, sys, difflib, os
csv.field_size_limit(10**8)
W = '/home/user/wortklinge/data/wortschatz'
mine = json.load(open(sys.argv[1]))
CJK = re.compile(r'[一-鿿]')
norm = lambda s: re.sub(r'\s+', ' ', s.replace('｜', ' ')).strip()
def load(name):
    p = f'{W}/{name}.tsv'
    if name in ('artikel-b2-original', 'artikel-b2'):
        rows = list(csv.DictReader(open(p, encoding='utf-8'), delimiter='\t')); return ('csv', rows)
    lines = open(p, encoding='utf-8').read().split('\n')
    hdr = lines[0].split('\t')
    rows = [dict(zip(hdr, l.split('\t'))) for l in lines[1:] if l]
    return ('raw', rows)
def save(name, kind, rows):
    p = f'{W}/{name}.tsv'
    hdr = list(rows[0].keys())
    if kind == 'csv':
        with open(p, 'w', encoding='utf-8', newline='') as f:
            w = csv.DictWriter(f, fieldnames=hdr, delimiter='\t', lineterminator='\n'); w.writeheader(); w.writerows(rows)
    else:
        open(p, 'w', encoding='utf-8').write('\n'.join(['\t'.join(hdr)] + ['\t'.join(r[h] for h in hdr) for r in rows]) + '\n')
SPLIT_DE = re.compile(r'(?<=[.!?…“])\s+(?=[A-ZÄÖÜ„])|｜')
SPLIT_ZH = re.compile(r'(?<=[。！？…”])|｜')
def sents(text, zh):
    pat = SPLIT_ZH if zh else SPLIT_DE
    out, pos = [], 0
    for m in pat.finditer(text):
        if m.end() > pos or m.group():
            out.append((pos, m.start())); pos = m.end()
    out.append((pos, len(text)))
    return [(a, b) for a, b in out if text[a:b].strip()]
def best_span(text, fix, zh):
    sp = sents(text, zh); best = (0, None)
    for k in range(len(sp)):
        for L in (1, 2, 3):
            if k + L > len(sp): break
            a, b = sp[k][0], sp[k + L - 1][1]
            r = difflib.SequenceMatcher(None, text[a:b].strip(), fix.strip()).ratio()
            if r > best[0]: best = (r, (a, b))
    return best
files, log = {}, []
PFX = re.compile(r'^[A-Z][:：]\s*')
SKIPID = ['b2o-13-039', 'b2o-15-044', ':Jobcenter:', ':Apotheker:', ':Chirurg:', ':faxen:', 'brief-14-3', 'brief-13-5', 'b2o-16-003']
for f in mine:
    name = f['id'].split(':')[1].split('/')[1]
    if name == 'artikel-b2' and f['severity'] == 'unnatural': continue
    if name not in files: files[name] = load(name)
    kind, rows = files[name]
    n = int(f['id'].rsplit(':', 1)[1]) - 1
    r = rows[n] if 0 <= n < len(rows) and norm(rows[n]['例句']) == norm(f['text']) else next((x for x in rows if norm(x['例句']) == norm(f['text'])), None)
    if r is None: log.append(['NOTFOUND', f['id'], '', f['fix']]); continue
    fix = (f.get('fix') or '').strip()
    if not fix: continue
    zh = bool(CJK.search(fix)); col = '例句中文' if zh else '例句'
    if (f['severity'] == 'translation') != zh: log.append(['MISMATCH', f['id'], f['problem'], fix]); continue
    t = r[col]
    if norm(fix) in norm(t): continue
    if len(fix) >= 0.7 * len(norm(t)):
        log.append(['WHOLE', f['id'], f['problem'], fix]); continue  # handle by hand
    if any(k in f['id'] for k in SKIPID): log.append(['SKIPID', f['id'], f['problem'], fix]); continue
    ratio, span = best_span(t, fix, zh)
    if ratio < 0.55: log.append([f'LOW {ratio:.2f}', f['id'], f['problem'], fix]); continue
    a, b = span; old = t[a:b]
    m = PFX.match(old.strip())
    if m and not PFX.match(fix): fix = m.group(0) + fix
    if old.rstrip().endswith('“') and not fix.endswith('“') and old.count('„') < old.count('“') + 0 and fix.count('„') < fix.count('“') + 1: fix += '“'
    core = lambda x: PFX.sub('', x.strip())
    if len(core(fix)) < 0.8 * len(core(old)): log.append(['SHORT', f['id'], old.strip(), fix]); continue
    words = [w for w in re.split(r'[,;、 ]+', r.get('新词', '')) if len(w) > 3] + ([r['原形']] if r.get('原形') else [])
    newtext = t[:a] + fix + t[b:]
    lost = [w for w in words if not zh and w.lower()[:5] in t.lower() and w.lower()[:5] not in newtext.lower()]
    if lost: log.append(['DROPS ' + ','.join(lost), f['id'], old.strip(), fix]); continue
    lead = old[:len(old) - len(old.lstrip())]; trail = old[len(old.rstrip()):]
    r[col] = t[:a] + lead + fix + trail + t[b:]
    log.append([f'OK {ratio:.2f} {f["severity"]}', f['id'], old.strip(), fix])
for name, (kind, rows) in files.items(): save(name, kind, rows)
with open(sys.argv[2], 'w') as o:
    for l in log: o.write('\t'.join(x.replace('\t', ' ') for x in l) + '\n')
from collections import Counter
print(Counter(l[0].split()[0] for l in log))
