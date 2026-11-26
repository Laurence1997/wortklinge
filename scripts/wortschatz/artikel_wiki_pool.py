"""Second source for the B2 article monsters: German Wikipedia (CC BY-SA 4.0), for the segment words Wikinews can't cover.

Wikinews has only ~4000 articles, and most are politics or crime, so after the screening only a few dozen fit
(2026-11-26: 15 articles, 87 of 2000 words). For every segment word that no article in artikel-b2.tsv claims yet,
this searches de.wikipedia.org (3 hits per word), fetches the plain text of each hit (lead + first sections, at most
1200 words, without lists, references and links sections) and scores it like artikel_pool.py. The best 400 per segment
are appended to build/artikel/pool.tsv; artikel_luna.py then screens, abridges and glosses them the same way and marks
them 「改编自 德语维基百科《…》· CC BY-SA 4.0」. Needs `pip install simplemma`.
"""
import csv, json, os, re, time, urllib.parse, urllib.request
from collections import defaultdict
from concurrent.futures import ThreadPoolExecutor
import simplemma

ROOT = os.path.join(os.path.dirname(__file__), '..', '..')
D = os.path.join(ROOT, 'data', 'wortschatz')
B = os.path.join(D, 'build', 'artikel')
os.makedirs(B, exist_ok=True)
csv.field_size_limit(10**8)
def tsv(p): return list(csv.DictReader(open(p, encoding='utf-8'), delimiter='\t')) if os.path.exists(p) else []
UA = {'User-Agent': 'wortklinge-content/1.0 (language-learning game; GitHub Actions)'}
API = 'https://de.wikipedia.org/w/api.php?'

errors = [0, 0]  # failed, done
def get(params):
    for attempt in range(3):
        try:
            req = urllib.request.Request(API + urllib.parse.urlencode({**params, 'format': 'json', 'formatversion': 2, 'maxlag': 5}), headers=UA)
            with urllib.request.urlopen(req, timeout=20) as r:
                errors[1] += 1
                return json.load(r)
        except Exception as e:
            if errors[0] < 5: print(f'request error: {e}', flush=True)
            errors[0] += 1
            if errors[0] > 200 and errors[0] > errors[1]: raise SystemExit('Wikipedia keeps refusing: stopping')
            time.sleep(3 * (attempt + 1))
    return {}

seg = defaultdict(set); cased = {}
for r in tsv(os.path.join(D, 'build', 'b2-v1.tsv')):
    seg[r['段']].add(r['原形'].lower()); cased[r['原形'].lower()] = r['原形']
claimed = defaultdict(set)
for r in tsv(os.path.join(D, 'artikel-b2.tsv')):
    for w in r['新词'].split(', '):
        if w: claimed[r['段']].add(w.lower())
open_words = [(s, w) for s in sorted(seg) for w in sorted(seg[s] - claimed[s])]
print(f'{len(open_words)} segment words without an article')

def search(sw):
    s, w = sw
    j = get({'action': 'query', 'list': 'search', 'srsearch': cased[w], 'srlimit': 2, 'srnamespace': 0})
    return [h['title'] for h in j.get('query', {}).get('search', [])]
titles = set()
with ThreadPoolExecutor(3) as ex:
    for k, ts in enumerate(ex.map(search, open_words), 1):
        titles |= set(ts)
        if k % 300 == 0: print(f'searched {k}/{len(open_words)}, {len(titles)} pages, errors {errors[0]}', flush=True)
titles = sorted(t for t in titles if not re.search(r'\(Begriffsklärung\)|^Liste |Begriffsklärung', t))
print(f'{len(titles)} candidate pages')

CUT = re.compile(r'^==+\s*(Literatur|Weblinks|Einzelnachweise|Siehe auch|Anmerkungen|Quellen|Filmografie|Diskografie|Werke|Schriften|Auszeichnungen)\s*==+.*', re.M | re.S)
WORD = re.compile(r"[A-Za-zÄÖÜäöüß]+")
def fetch(title):
    j = get({'action': 'query', 'prop': 'extracts|revisions', 'rvprop': 'ids', 'explaintext': 1, 'exsectionformat': 'wiki', 'titles': title, 'redirects': 1})
    pages = j.get('query', {}).get('pages', [])
    if not pages or 'extract' not in pages[0]: return None
    p = pages[0]
    text = CUT.sub('', p['extract'])
    paras, n = [], 0
    for para in re.split(r'\n+', text):
        para = para.strip()
        if not para or para.startswith('=') or len(para.split()) < 12: continue
        paras.append(para); n += len(para.split())
        if n >= 1200: break
    if n < 200: return None
    rev = (p.get('revisions') or [{}])[0].get('revid', '')
    return (p['title'], str(rev), paras)

cache = {}
def lem(tok):
    k = tok.lower()
    if k not in cache: cache[k] = {k, simplemma.lemmatize(tok, lang='de').lower(), simplemma.lemmatize(k, lang='de').lower()}
    return cache[k]
DARK = re.compile(r'\b(Terror\w*|Anschl[aä]g\w*|Krieg\w*|getötet|Tote[nr]?|Todesopfer\w*|Mord\w*|ermordet|Massaker|Folter\w*|Gewalt\w*|Waffe\w*|Selbstmord\w*|Suizid\w*|Hinrichtung\w*)\b')
best = defaultdict(list)
with ThreadPoolExecutor(3) as ex:
    for k, res in enumerate(ex.map(fetch, titles), 1):
        if k % 300 == 0: print(f'fetched {k}/{len(titles)}, errors {errors[0]}', flush=True)
        if not res: continue
        title, rev, paras = res
        body = ' '.join(paras)
        if len(DARK.findall(body)) >= 2: continue
        toks = WORD.findall(body)
        L = set()
        for t in toks: L |= lem(t)
        for s in seg:
            hit = sorted((L & seg[s]) - claimed[s])
            if len(hit) >= 4:
                best[s].append((len(hit), len(toks), hit, title, rev, '｜'.join(paras)))

out = os.path.join(B, 'pool.tsv')
new = not os.path.exists(out)
with open(out, 'a', encoding='utf-8', newline='') as f:
    w = csv.writer(f, delimiter='\t', lineterminator='\n')
    if new: w.writerow(['段', '词数', '命中数', '命中词', '标题', '修订号', '网址', '正文'])
    for s in sorted(best):
        for h, nt, hit, title, rev, body in sorted(best[s], key=lambda x: -x[0])[:400]:
            w.writerow([s, nt, h, ', '.join(hit), title, rev, f'https://de.wikipedia.org/w/index.php?oldid={rev}', body])
print('Wikipedia candidates per segment: ' + ', '.join(f'{s} {min(400, len(best[s]))}' for s in sorted(best)))
