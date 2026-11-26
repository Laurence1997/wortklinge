"""Candidate source texts for the B2 article monsters (游戏设计: 121 级起新词只在文章怪里出现).

Downloads the German Wikinews dump (CC BY 2.5) and keeps articles of 200–1500 words. For every B2 segment (段 13–16 in
data/wortschatz/build/b2-v1.tsv, words 6001–8000) each article is scored by how many of that segment's words it uses
(simplemma lemmas). Output: data/wortschatz/build/artikel/pool.tsv
(段, 词数, 命中数, 命中词, 标题, 修订号, 网址, 正文 with paragraphs joined by ｜), best 150 per segment.
artikel_luna.py picks, abridges and glosses from it. Needs `pip install simplemma mwparserfromhell`.
"""
import bz2, csv, os, re, sys, urllib.request
import xml.etree.ElementTree as ET
from collections import defaultdict
import mwparserfromhell, simplemma

ROOT = os.path.join(os.path.dirname(__file__), '..', '..')
D = os.path.join(ROOT, 'data', 'wortschatz')
B = os.path.join(D, 'build', 'artikel')
os.makedirs(B, exist_ok=True)
DUMP = os.path.join(B, 'dewikinews.xml.bz2')
if not os.path.exists(DUMP):
    # Wikimedia refuses requests without a descriptive User-Agent.
    req = urllib.request.Request('https://dumps.wikimedia.org/dewikinews/latest/dewikinews-latest-pages-articles.xml.bz2',
                                 headers={'User-Agent': 'wortklinge-content/1.0 (language-learning game; GitHub Actions)'})
    with urllib.request.urlopen(req, timeout=600) as r, open(DUMP, 'wb') as f:
        while chunk := r.read(1 << 20): f.write(chunk)
csv.field_size_limit(10**8)
def tsv(p): return list(csv.DictReader(open(p, encoding='utf-8'), delimiter='\t'))

seg = defaultdict(set)
for r in tsv(os.path.join(D, 'build', 'b2-v1.tsv')):
    seg[r['段']].add(r['原形'].lower())
allw = set().union(*seg.values())

CUT = re.compile(r'^==+\s*(Quellen?|Themenverwandte Artikel|Weblinks|Siehe auch|Einzelnachweise|Diskussion)\s*==+', re.M | re.I)
WORD = re.compile(r"[A-Za-zÄÖÜäöüß]+")
def plain(wikitext):
    t = CUT.split(wikitext)[0]
    code = mwparserfromhell.parse(t)
    for tpl in code.filter_templates(recursive=False):
        try: code.remove(tpl)
        except ValueError: pass
    s = code.strip_code(normalize=True, collapse=True)
    paras = []
    for p in re.split(r'\n\s*\n', s):
        p = re.sub(r'\s+', ' ', p).strip()
        if p.startswith(('Kategorie:', 'Datei:', 'Bild:', 'File:')) or len(p.split()) < 8: continue
        paras.append(p)
    return paras

cache = {}
def lem(tok):
    k = tok.lower()
    if k not in cache: cache[k] = {k, simplemma.lemmatize(tok, lang='de').lower(), simplemma.lemmatize(k, lang='de').lower()}
    return cache[k]

best = defaultdict(list)
n = 0
ns = ''
for ev, el in ET.iterparse(bz2.open(DUMP), events=('end',)):
    tag = el.tag.rsplit('}', 1)[-1]
    if tag != 'page': continue
    ns = el.tag[:-4]
    title = el.findtext(f'{ns}title') or ''
    if el.findtext(f'{ns}ns') != '0' or el.find(f'{ns}redirect') is not None:
        el.clear(); continue
    rev = el.find(f'{ns}revision')
    text = rev.findtext(f'{ns}text') or ''
    rid = rev.findtext(f'{ns}id') or ''
    el.clear()
    if re.search(r'\{\{\s*(Entwurf|Löschen|Schnelllöschen|Baustelle)', text, re.I): continue
    paras = plain(text)
    toks = WORD.findall(' '.join(paras))
    if not 200 <= len(toks) <= 1500: continue
    n += 1
    lemmas = set()
    for t in toks: lemmas |= lem(t)
    hit_all = lemmas & allw
    for s, ws in seg.items():
        hit = sorted(lemmas & ws)
        if len(hit) < 4: continue
        lst = best[s]
        lst.append((len(hit), len(toks), hit, title, rid, '｜'.join(paras)))
        if len(lst) > 400:
            lst.sort(key=lambda x: -x[0]); del lst[300:]

with open(os.path.join(B, 'pool.tsv'), 'w', encoding='utf-8', newline='') as f:
    w = csv.writer(f, delimiter='\t', lineterminator='\n')
    w.writerow(['段', '词数', '命中数', '命中词', '标题', '修订号', '网址', '正文'])
    for s in sorted(best):
        for h, nt, hit, title, rid, body in sorted(best[s], key=lambda x: -x[0])[:150]:
            w.writerow([s, nt, h, ', '.join(hit), title, rid, f'https://de.wikinews.org/w/index.php?oldid={rid}', body])
print(f'articles 200–1500 words: {n}; candidates per segment: ' + ', '.join(f'{s} {min(150, len(best[s]))}' for s in sorted(best)))
