"""Second source for the B2 article monsters: German Wikipedia (CC BY-SA 4.0), for the segment words Wikinews can't cover.

Wikinews has only ~4000 articles, and most are politics or crime, so after the screening only a few dozen fit
(2026-11-26: 15 articles, 87 of 2000 words). For every segment word that no article in artikel-b2.tsv claims yet,
this searches de.wikipedia.org (2 hits per word), fetches the wikitext of the hits 50 pages per request, turns it into
plain paragraphs (lead + first sections, at most 1200 words, without lists, tables, references and links sections) and
scores it like artikel_pool.py. The best 400 per segment are appended to build/artikel/pool.tsv; artikel_luna.py then
screens, abridges and glosses them the same way and marks them 「改编自 德语维基百科《…》· CC BY-SA 4.0」.

Resumable: searches and fetched pages go to data/wortschatz/build/wiki-cache/cache.json.gz (the workflow keeps it
between runs with actions/cache), saved every few minutes. WIKI_MINUTES (default 200) caps the time; when it runs
out the script saves, scores what it has and the next run continues where this one stopped.
Needs `pip install simplemma mwparserfromhell`.
"""
import csv, gzip, json, os, re, time, urllib.error, urllib.parse, urllib.request
from collections import defaultdict
import mwparserfromhell, simplemma

T0 = time.time()
BUDGET = float(os.environ.get('WIKI_MINUTES') or 200) * 60
ROOT = os.path.join(os.path.dirname(__file__), '..', '..')
D = os.path.join(ROOT, 'data', 'wortschatz')
B = os.path.join(D, 'build', 'artikel')
C = os.path.join(D, 'build', 'wiki-cache')
os.makedirs(B, exist_ok=True); os.makedirs(C, exist_ok=True)
CACHE = os.path.join(C, 'cache.json.gz')
csv.field_size_limit(10**8)
def tsv(p): return list(csv.DictReader(open(p, encoding='utf-8'), delimiter='\t')) if os.path.exists(p) else []
UA = {'User-Agent': 'wortklinge-content/1.0 (language-learning game; GitHub Actions)', 'Accept-Encoding': 'gzip'}
API = 'https://de.wikipedia.org/w/api.php'

cache = {'search': {}, 'pages': {}}
if os.path.exists(CACHE):
    cache = json.load(gzip.open(CACHE, 'rt', encoding='utf-8'))
print(f"cache: {len(cache['search'])} searches, {len(cache['pages'])} pages", flush=True)
last_save = [time.time()]
def save(force=False):
    if force or time.time() - last_save[0] > 300:
        tmp = CACHE + '.tmp'
        with gzip.open(tmp, 'wt', encoding='utf-8') as f: json.dump(cache, f, ensure_ascii=False)
        os.replace(tmp, CACHE); last_save[0] = time.time()
def out_of_time(): return time.time() - T0 > BUDGET

stats = {'ok': 0, 'err': 0}
last_ok = [time.time()]
def get(params, post=False):
    """One request at a time, 1 s apart; on 429/5xx/maxlag wait as Wikipedia asks. None when out of time or refused 30 min."""
    q = urllib.parse.urlencode({**params, 'format': 'json', 'formatversion': 2, 'maxlag': 5})
    while not out_of_time():
        time.sleep(1.0)
        try:
            req = urllib.request.Request(API, q.encode(), UA) if post else urllib.request.Request(API + '?' + q, headers=UA)
            with urllib.request.urlopen(req, timeout=60) as r:
                raw = r.read()
                if r.headers.get('Content-Encoding') == 'gzip': raw = gzip.decompress(raw)
                j = json.loads(raw)
            if j.get('error', {}).get('code') == 'maxlag':
                time.sleep(10); continue
            stats['ok'] += 1; last_ok[0] = time.time()
            return j
        except urllib.error.HTTPError as e:
            stats['err'] += 1
            if e.code != 429 and e.code < 500: return {}
            wait = max(30, int(e.headers.get('Retry-After') or 0))
            if stats['err'] <= 5 or stats['err'] % 20 == 0:
                print(f"HTTP {e.code}, waiting {wait} s (errors {stats['err']}, ok {stats['ok']})", flush=True)
            time.sleep(wait)
        except Exception as e:
            stats['err'] += 1
            time.sleep(10)
        if time.time() - last_ok[0] > 1800:
            print('Wikipedia refused for 30 minutes: stopping the downloads', flush=True); return None
    return None

seg = defaultdict(set); cased = {}
for r in tsv(os.path.join(D, 'build', 'b2-v1.tsv')):
    seg[r['段']].add(r['原形'].lower()); cased[r['原形'].lower()] = r['原形']
claimed = defaultdict(set)
for r in tsv(os.path.join(D, 'artikel-b2.tsv')):
    for w in r['新词'].split(', '):
        if w: claimed[r['段']].add(w.lower())
open_words = sorted({w for s in seg for w in seg[s] - claimed[s]})
todo = [w for w in open_words if w not in cache['search']]
print(f'{len(open_words)} segment words without an article, {len(todo)} still to search', flush=True)

stopped = False
for k, w in enumerate(todo, 1):
    j = get({'action': 'query', 'list': 'search', 'srsearch': cased[w], 'srlimit': 2, 'srnamespace': 0, 'srprop': ''})
    if j is None: stopped = True; break
    cache['search'][w] = [h['title'] for h in j.get('query', {}).get('search', [])]
    save()
    if k % 100 == 0: print(f"searched {k}/{len(todo)} (ok {stats['ok']}, errors {stats['err']}, {int((time.time()-T0)/60)} min)", flush=True)
save(True)

BAD_TITLE = re.compile(r'Begriffsklärung|^Liste ')
titles = sorted({t for w in open_words for t in cache['search'].get(w, []) if not BAD_TITLE.search(t)})
need = [t for t in titles if t not in cache['pages']]
print(f'{len(titles)} candidate pages, {len(need)} still to fetch', flush=True)

CUT = re.compile(r'^==+\s*(Literatur|Weblinks|Einzelnachweise|Siehe auch|Anmerkungen|Quellen|Filmografie|Diskografie|Werke|Schriften|Auszeichnungen|Belege|Fußnoten)\s*==+.*', re.M | re.S)
DROP_TAGS = {'ref', 'gallery', 'table', 'math', 'score', 'timeline', 'imagemap', 'references', 'syntaxhighlight', 'pre', 'chem'}
def plain(wikitext):
    code = mwparserfromhell.parse(re.sub(r'^[*#:;].*$', '', CUT.sub('', wikitext), flags=re.M))
    for n in code.filter_templates(recursive=False) + [t for t in code.filter_tags(recursive=False) if str(t.tag).lower() in DROP_TAGS]:
        try: code.remove(n)
        except ValueError: pass
    for l in code.filter_wikilinks():
        if re.match(r'\s*(Datei|File|Bild|Image|Kategorie|Category):', str(l.title), re.I):
            try: code.remove(l)
            except ValueError: pass
    s = code.strip_code(normalize=True, collapse=True)
    paras, n = [], 0
    for p in re.split(r'\n+', s):
        p = re.sub(r'\s+', ' ', p).strip()
        if not p or p.startswith(('=', '*', '#', ':', ';', '|', '{', '!')) or len(p.split()) < 12: continue
        paras.append(p); n += len(p.split())
        if n >= 1200: break
    return paras if n >= 200 else None

for i in range(0, len(need), 50):
    chunk = need[i:i + 50]
    j = get({'action': 'query', 'prop': 'revisions', 'rvprop': 'content|ids', 'rvslots': 'main', 'redirects': 1,
             'titles': '|'.join(chunk)}, post=True)
    if j is None: stopped = True; break
    q = j.get('query', {})
    alias = {}
    for m in q.get('normalized', []) + q.get('redirects', []): alias[m['to']] = alias.get(m['from'], m['from'])
    got = set()
    for p in q.get('pages', []):
        src = alias.get(p.get('title'), p.get('title'))
        rv = (p.get('revisions') or [{}])[0]
        txt = rv.get('slots', {}).get('main', {}).get('content')
        res = None
        if txt and not p.get('missing'):
            try: paras = plain(txt)
            except Exception: paras = None
            if paras: res = [p['title'], str(rv.get('revid', '')), paras]
        cache['pages'][src] = res; got.add(src)
    if not j:  # refused (4xx): don't ask again
        for t in chunk: cache['pages'].setdefault(t, None)
    save()
    if (i // 50) % 10 == 0: print(f"fetched {min(i + 50, len(need))}/{len(need)} (ok {stats['ok']}, errors {stats['err']}, {int((time.time()-T0)/60)} min)", flush=True)
save(True)
left = len([t for t in titles if t not in cache['pages']])
print(f"downloads {'stopped early' if stopped else 'complete'}: {len(cache['search'])}/{len(open_words)} words searched, {len(titles) - left}/{len(titles)} pages fetched", flush=True)

lc = {}
def lem(tok):
    k = tok.lower()
    if k not in lc: lc[k] = {k, simplemma.lemmatize(tok, lang='de').lower(), simplemma.lemmatize(k, lang='de').lower()}
    return lc[k]
WORD = re.compile(r"[A-Za-zÄÖÜäöüß]+")
DARK = re.compile(r'\b(Terror\w*|Anschl[aä]g\w*|Krieg\w*|getötet|Tote[nr]?|Todesopfer\w*|Mord\w*|ermordet|Massaker|Folter\w*|Gewalt\w*|Waffe\w*|Selbstmord\w*|Suizid\w*|Hinrichtung\w*)\b')
done_titles = {r['标题'] for r in tsv(os.path.join(B, 'pool.tsv'))}
best = defaultdict(list); seen = set()
for t in titles:
    res = cache['pages'].get(t)
    if not res or res[0] in seen or res[0] in done_titles: continue
    seen.add(res[0])
    title, rev, paras = res
    body = ' '.join(paras)
    if len(DARK.findall(body)) >= 2: continue
    toks = WORD.findall(body)
    L = set()
    for tk in toks: L |= lem(tk)
    for s in seg:
        hit = sorted((L & seg[s]) - claimed[s])
        if len(hit) >= 4: best[s].append((len(hit), len(toks), hit, title, rev, '｜'.join(paras)))

out = os.path.join(B, 'pool.tsv')
new = not os.path.exists(out)
with open(out, 'a', encoding='utf-8', newline='') as f:
    w = csv.writer(f, delimiter='\t', lineterminator='\n')
    if new: w.writerow(['段', '词数', '命中数', '命中词', '标题', '修订号', '网址', '正文'])
    for s in sorted(best):
        for h, nt, hit, title, rev, body in sorted(best[s], key=lambda x: -x[0])[:400]:
            w.writerow([s, nt, h, ', '.join(hit), title, rev, f'https://de.wikipedia.org/w/index.php?oldid={rev}', body])
print('Wikipedia candidates per segment: ' + ', '.join(f'{s} {min(400, len(best[s]))}' for s in sorted(best)), flush=True)
