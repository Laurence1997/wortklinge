"""Wider Tatoeba pools for the sense / collocation pass (examples_senses_luna.py).

For every word of the top 6000 in data/wortschatz/wortschatz.tsv: up to 12 native-speaker sentences (Tatoeba skill 5) that use it,
4–12 words, no digits or names, every other word in the list and no harder than max(3000, the word's rank). Sentences already used as an
example anywhere (beispiele.tsv, beispiele-mehr.tsv) are left out. Output: data/wortschatz/build/tatoeba/pool-6000.tsv.
Needs proof/tatoeba/ from scripts/proof/tatoeba-download.sh and `pip install simplemma`. Licence: CC BY 2.0 FR.
"""
import csv, os, re
from collections import defaultdict
import simplemma

ROOT = os.path.join(os.path.dirname(__file__), '..', '..')
D = os.path.join(ROOT, 'data', 'wortschatz')
T = os.path.join(ROOT, 'proof', 'tatoeba')
def f(n):
    p = os.path.join(T, n)
    return p if os.path.exists(p) else p.replace('.tsv', '.csv')
def tsv(p): return list(csv.DictReader(open(p, encoding='utf-8'), delimiter='\t'))
csv.field_size_limit(10**8)

rank, cased = {}, {}
for r in tsv(os.path.join(D, 'wortschatz.tsv')):
    k = r['原形'].lower()
    if k not in rank: rank[k] = int(r['排名']); cased[k] = r['原形']
WORDS = [r for r in tsv(os.path.join(D, 'wortschatz.tsv')) if int(r['排名']) <= 6000]
want = {r['原形'].lower() for r in WORDS}
used = {r['例句'] for r in tsv(os.path.join(D, 'beispiele.tsv'))}
mehr = os.path.join(D, 'build', 'beispiele-mehr.tsv')
if os.path.exists(mehr): used |= {r['例句'] for r in tsv(mehr)}
SEP = {'ab','an','auf','aus','bei','ein','fest','her','hin','los','mit','nach','vor','weg','zu','zurück','zusammen','weiter','vorbei','herum','hinaus','heraus','herein','hinein','frei','statt','teil','um','durch','über','wieder','fort','kennen','heim','herunter','hinunter','raus','rein','runter'}

natives = {p[2] for p in (l.rstrip('\n').split('\t') for l in open(f('user_languages.tsv'), encoding='utf-8')) if len(p) >= 3 and p[0] == 'deu' and p[1] == '5'}
audio = {l.split('\t', 1)[0] for l in open(f('sentences_with_audio.tsv'), encoding='utf-8')}
cache = {}
def lemmas(tok, first):
    key = (tok, first)
    if key in cache: return cache[key]
    out = set(); low = tok.lower(); cap = tok[0].isupper()
    for c in {low, simplemma.lemmatize(low, lang='de').lower(), simplemma.lemmatize(low.capitalize(), lang='de').lower()}:
        if c in rank and (first or cased[c][0].isupper() == cap or c == 'ich'): out.add(c)
    cache[key] = out
    return out

WORD = re.compile(r"[A-Za-zÄÖÜäöüß]+")
best = defaultdict(list)
for line in open(f('deu_sentences_detailed.tsv'), encoding='utf-8'):
    p = line.rstrip('\n').split('\t')
    if len(p) < 4 or p[3] not in natives: continue
    sid, text, user = p[0], p[2], p[3]
    if text in used or re.search(r'\d|[«»"„“]|Tom|Maria|Mary', text): continue
    toks = WORD.findall(text)
    if not 4 <= len(toks) <= 12: continue
    per = []
    for i, t in enumerate(toks):
        L = lemmas(t, i == 0)
        if not L: break
        per.append(L)
    else:
        targets = set().union(*per) & want
        last = toks[-1].lower()
        if last in SEP:
            targets |= {last + l for L in per[:-1] for l in L if last + l in want}
        for tgt in targets:
            others = [min(rank[l] for l in L) for L in per if tgt not in L]
            if others and max(others) > max(3000, rank[tgt]): continue
            score = abs(len(toks) - 7) * 3 + (max(others) / 200 if others else 0) + (0 if sid in audio else 5)
            lst = best[tgt]
            if len(lst) < 12 or score < lst[-1][0]:
                lst.append((score, sid, text, user)); lst.sort(); del lst[12:]

out = os.path.join(D, 'build', 'tatoeba', 'pool-6000.tsv')
with open(out, 'w', encoding='utf-8', newline='') as fo:
    w = csv.writer(fo, delimiter='\t', lineterminator='\n')
    w.writerow(['原形', '例句', 'tatoeba_id', '作者'])
    for r in WORDS:
        for s, sid, text, user in best.get(r['原形'].lower(), []):
            w.writerow([r['原形'], text, sid, user])
print(f'natives {len(natives)}; words with a pool {sum(1 for k in want if best.get(k))}/{len(want)}')
