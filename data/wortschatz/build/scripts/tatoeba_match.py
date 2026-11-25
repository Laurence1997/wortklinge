#!/usr/bin/env python3
"""Pick Tatoeba example sentences for data/wortschatz/wortschatz.tsv.

Input:  proof/tatoeba/ (from scripts/proof/tatoeba-download.sh), data/wortschatz/wortschatz.tsv
Output: data/wortschatz/build/tatoeba/candidates.tsv  (up to 3 per word, best first)
        data/wortschatz/build/tatoeba/missing.tsv     (words with no usable sentence)
Only sentences by native German speakers (Tatoeba skill level 5). 4–12 words, no names,
every other word in the list and no harder than max(3000, rank of the target word).
Licence: Tatoeba sentences CC BY 2.0 FR; keep sentence id and author.
"""
import csv, os, re, sys
from collections import defaultdict
import simplemma

ROOT = os.path.join(os.path.dirname(__file__), '..', '..', '..', '..')
T = os.path.join(ROOT, 'proof', 'tatoeba')
def f(n):
    p = os.path.join(T, n)
    return p if os.path.exists(p) else p.replace('.tsv', '.csv')
csv.field_size_limit(10**8)
rows = list(csv.DictReader(open(os.path.join(ROOT, 'data/wortschatz/wortschatz.tsv'), encoding='utf-8'), delimiter='\t'))
rank = {}; cased = {}
for r in rows:
    k = r['原形'].lower()
    if k not in rank:
        rank[k] = int(r['排名']); cased[k] = r['原形']
SEP = sorted({'ab','an','auf','aus','bei','ein','fest','her','hin','los','mit','nach','vor','weg','zu','zurück','zusammen','weiter','vorbei','herum','hinaus','heraus','herein','hinein','fern','frei','hoch','statt','teil','um','durch','über','unter','wieder','fort','kennen','heim','dabei','dazu','entgegen','voran','voraus','herunter','hinunter','herauf','hinauf','rüber','raus','rein','runter'})
natives = set()
for line in open(f('user_languages.tsv'), encoding='utf-8'):
    p = line.rstrip('\n').split('\t')
    if len(p) >= 3 and p[0] == 'deu' and p[1] == '5': natives.add(p[2])
audio = set()
for line in open(f('sentences_with_audio.tsv'), encoding='utf-8'):
    audio.add(line.split('\t', 1)[0])
zh = {}
if os.path.exists(f('cmn_sentences.tsv')):
    cmn = {}
    for line in open(f('cmn_sentences.tsv'), encoding='utf-8'):
        p = line.rstrip('\n').split('\t'); cmn[p[0]] = p[2]
    for line in open(f('deu-cmn_links.tsv'), encoding='utf-8'):
        a, b = line.rstrip('\n').split('\t')[:2]
        if b in cmn and a not in zh: zh[a] = cmn[b]
cache = {}
def lemmas(tok, first):
    key = (tok, first)
    if key in cache: return cache[key]
    out = set(); low = tok.lower(); cap = tok[0].isupper()
    cands = {low, simplemma.lemmatize(low, lang='de').lower(), simplemma.lemmatize(low.capitalize(), lang='de').lower()}
    for c in cands:
        if c not in rank: continue
        noun = cased[c][0].isupper()
        if first or noun == cap or c in ('ich',): out.add(c)
    cache[key] = out
    return out
WORD = re.compile(r"[A-Za-zÄÖÜäöüß]+")
best = defaultdict(list)
n = 0
for line in open(f('deu_sentences_detailed.tsv'), encoding='utf-8'):
    p = line.rstrip('\n').split('\t')
    if len(p) < 4 or p[3] not in natives: continue
    sid, text, user = p[0], p[2], p[3]
    if re.search(r'\d|[«»"„“]|Tom|Maria|Mary', text): continue
    toks = WORD.findall(text)
    if not 4 <= len(toks) <= 12: continue
    per = []; ok = True
    for i, t in enumerate(toks):
        L = lemmas(t, i == 0)
        if not L: ok = False; break
        per.append(L)
    if not ok: continue
    n += 1
    rk = [min(rank[l] for l in L) for L in per]
    targets = set().union(*per)
    last = toks[-1].lower()
    if last in SEP:
        for L in per[:-1]:
            for l in L:
                if last + l in rank: targets.add(last + l)
    for tgt in targets:
        tr = rank[tgt]
        pos = [i for i, L in enumerate(per) if tgt in L]
        if pos == [0] and tgt not in ('ich', 'ja', 'nein', 'danke', 'bitte', 'hallo'):
            continue  # only sentence-initial: case can't tell a noun from a verb/adjective
        if tr > 8000: continue
        others = [r for L, r in zip(per, rk) if tgt not in L]
        hard = max(others) if others else 0
        if hard > max(3000, tr): continue
        score = (0 if sid in zh else 50) + abs(len(toks) - 7) * 3 + hard / 200 + (0 if sid in audio else 5)
        lst = best[tgt]
        if len(lst) < 3 or score < lst[-1][0]:
            lst.append((score, sid, text, zh.get(sid, ''), user, 'ja' if sid in audio else ''))
            lst.sort(); del lst[3:]
out = os.path.join(ROOT, 'data/wortschatz/build/tatoeba'); os.makedirs(out, exist_ok=True)
with open(os.path.join(out, 'candidates.tsv'), 'w', encoding='utf-8', newline='') as fo:
    w = csv.writer(fo, delimiter='\t', lineterminator='\n')
    w.writerow(['排名', '原形', '候选', '例句', '例句中文', 'tatoeba_id', '作者', '有录音', '分数'])
    for r in rows:
        k = r['原形'].lower()
        for i, (s, sid, text, z, user, au) in enumerate(best.get(k, []), 1):
            w.writerow([r['排名'], r['原形'], i, text, z, sid, user, au, round(s, 1)])
miss = [r for r in rows if int(r['排名']) <= 8000 and r['原形'].lower() not in best]
with open(os.path.join(out, 'missing.tsv'), 'w', encoding='utf-8', newline='') as fo:
    w = csv.writer(fo, delimiter='\t', lineterminator='\n'); w.writerow(['排名', '原形', '词性', '中文'])
    for r in miss: w.writerow([r['排名'], r['原形'], r['词性'], r['中文']])
top = [r for r in rows if int(r['排名']) <= 6000]
hit = sum(1 for r in top if r['原形'].lower() in best)
print(f'natives {len(natives)}, usable sentences {n}, top6000 covered {hit}/{len(top)}, missing (≤8000) {len(miss)}')
