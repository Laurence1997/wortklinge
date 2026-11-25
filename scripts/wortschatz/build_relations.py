"""Builds data/wortschatz/relations.tsv: for each of the 8000 words, 同根 / 近义 / 形近 as lists of 原形 that are in the list
(separated by |, nearest rank first). Code reads it as word ids (WordLayers.rel).
- 同根: from the 词根 in scripts/wortschatz/out/labels-rel.tsv (Luna) plus the prefix-verb 词族 column: the word's roots, words
  built from it, then words sharing its root (non-compounds only). Max 8, in that order.
- 近义: the human-revised 近义词组 (true synonyms only; 易混/变体 groups are not synonyms) where a word has one, else Luna's
  synonyms that are in the list with the same part of speech. Made symmetric. Max 5.
- 形近: the 形近词 rule (one letter or umlaut apart), run over all 8000. Max 5.
Run: python3 scripts/wortschatz/build_relations.py"""
import csv, os, re, sys
from collections import defaultdict
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, os.path.join(ROOT, 'data/wortschatz/build/scripts'))
from xing import xing
rows = list(csv.DictReader(open(os.path.join(ROOT, 'data/wortschatz/wortschatz.tsv'), encoding='utf-8'), delimiter='\t'))
rank = {x['原形']: int(x['排名']) for x in rows}; pos = {x['原形']: x['词性'] for x in rows}
low = defaultdict(list)
for x in rows: low[x['原形'].lower()].append(x['原形'])
def find(w, p=None):
    if w in rank: return w
    c = low.get(w.lower(), [])
    if p: c = [y for y in c if pos[y] == p] or c
    return c[0] if c else None
order = lambda s: sorted(s, key=lambda w: rank[w])
rel = {}
for r in csv.DictReader(open(os.path.join(ROOT, 'scripts/wortschatz/out/labels-rel.tsv'), encoding='utf-8'), delimiter='\t'):
    rel[r['原形']] = ([g for g in r['词根'].split('|') if g], [s for s in r['近义'].split('|') if s])
# 同根: the word's own roots, then words built from it, then (for a non-compound) words sharing its root.
# Only content words (noun/verb/adjective) count as roots, so compounds with so/mit/über/hier do not link.
CONTENT = {'名词', '动词', '形容词'}
roots = {}
for x in rows:
    w = x['原形']; rs = []
    for g in rel.get(w, ([], []))[0]:
        y = find(g)
        if y and y != w and pos[y] in CONTENT: rs.append(y)
    if x['词族'] and x['词族'] != w and x['词族'] in rank: rs.append(x['词族'])
    if pos[w] == '名词':   # die Arbeit ↔ arbeiten, das Essen ↔ essen: the verb counts as the noun's root
        for v in (w.lower(), w.lower() + 'en', w.lower() + 'n'):
            if v in rank and pos[v] == '动词' and v not in rs: rs.insert(0, v)
    roots[w] = list(dict.fromkeys(rs))
kids = defaultdict(set)
for w, rs in roots.items():
    for g in rs: kids[g].add(w)
same = {}
for x in rows:
    w = x['原形']; rs = roots[w]; seen = []
    sib = set().union(*(kids[g] for g in rs)) - {w} if len(rs) == 1 else set()
    for grp in (rs, order(kids[w]), order(sib - kids[w] - set(rs))):
        for y in grp:
            if y not in seen and y != w: seen.append(y)
    same[w] = seen
# 近义
syn = defaultdict(set); human = set()
for x in rows:
    v = x['近义词组']
    if v and not v.startswith(('易混', '变体')):
        human.add(x['原形'])
        for y in v.split('：', 1)[-1].split('/'):
            y = find(y.strip())
            if y and y != x['原形']: syn[x['原形']].add(y)
for w, (_, ss) in rel.items():
    if w in human or w not in rank: continue
    for s in ss:
        y = find(s, pos[w])
        if y and y != w and pos[y] == pos[w] and y not in human: syn[w].add(y)
for w in list(syn):
    for y in list(syn[w]):
        if w not in human or y in human: syn[y].add(w)
# 形近
xrows = [{'rank': rank[w], 'lemma': w} for w in rank]
FAM = {x['原形']: x['词族'] for x in rows if x['词族']}
X = {k: v.split('/') for k, v in xing(xrows, FAM, upto=8000).items()}
out = os.path.join(ROOT, 'data/wortschatz/relations.tsv')
with open(out, 'w', encoding='utf-8') as f:
    f.write('排名\t原形\t同根\t近义\t形近\n')
    for x in rows:
        w = x['原形']
        xs = order({y for y in X.get(w, []) if y in rank} - set(same[w]) - syn[w])
        f.write(f"{x['排名']}\t{w}\t{'|'.join(same[w][:8])}\t{'|'.join(order(syn[w])[:5])}\t{'|'.join(xs[:5])}\n")
n = lambda d: sum(1 for x in rows if d.get(x['原形']))
print('同根', n(same), '近义', n(syn), '形近', n(X), 'of', len(rows), '→', out)
