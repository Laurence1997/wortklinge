"""Add hand-written C1 articles (abridged from cached Wikipedia pages) to data/wortschatz/artikel-c1.tsv.
Input: a JSON list; each item {"z": zone, "t": cached page title, "title": shown title,
  "p": [[source paragraph index or replacement text, ...], ...]  (one inner list per game paragraph),
  "zh": [Chinese per game paragraph], "g": [[word, German gloss, Chinese], ...],
  "q": [[question, question zh, answer, wrong1, wrong2] x3], "note": what was cut}.
Usage: python3 artikel_c1_add.py <pages450.json> <batch.json>   (pages450.json: title -> [title, rev, paras])
Only cuts are allowed: replacement text must be a shortened source paragraph (checked: every word must occur in it).
"""
import csv, json, os, re, sys
csv.field_size_limit(10**8)
D = os.path.join(os.path.dirname(__file__), '..', '..', 'data', 'wortschatz')
OUT = os.path.join(D, 'artikel-c1.tsv')
COLS = ['id', '段', '标题', '例句', '例句中文', '新词', '注释', '题目', '词数', '来源', '网址', '修订号', '许可证', '改编说明']
WORD = re.compile(r"[A-Za-zÄÖÜäöüß][\w'’-]*")
pages = json.load(open(sys.argv[1]))
rows = list(csv.DictReader(open(OUT, encoding='utf-8'), delimiter='\t')) if os.path.exists(OUT) else []
have = {r['网址'] for r in rows}
added = []
for a in json.load(open(sys.argv[2])):
    title, rev, src = pages[a['t']]
    paras = []
    for grp in a['p']:
        parts = []
        for x in grp:
            if isinstance(x, int): parts.append(src[x])
            else:
                pool = set(w.lower() for w in WORD.findall(' '.join(src)))
                extra = [w for w in WORD.findall(x) if w.lower() not in pool]
                assert not extra, (a['t'], extra)
                parts.append(x)
        paras.append(' '.join(parts).replace('｜', ' ').strip())
    n = len(WORD.findall(' '.join(paras)))
    assert 440 <= n <= 680, (a['t'], n)
    assert len(a['zh']) == len(paras), (a['t'], len(a['zh']), len(paras))
    assert len(a['q']) == 3 and all(len(q) == 5 for q in a['q']), a['t']
    url = f'https://de.wikipedia.org/w/index.php?oldid={rev}'
    if url in have: print('already in:', title); continue
    z = str(a['z'])
    k = max([int(r['id'].rsplit('-', 1)[1]) for r in rows if r['段'] == z] + [0]) + 1
    row = {'id': f'c1-{z}-{k:03d}', '段': z, '标题': a.get('title') or title, '例句': '｜'.join(paras),
           '例句中文': '｜'.join(s.replace('｜', ' ').strip() for s in a['zh']), '新词': '',
           '注释': json.dumps([{'w': w, 'de': de, 'zh': zh} for w, de, zh in a['g']], ensure_ascii=False),
           '题目': json.dumps([{'q': q, 'qZh': qz, 'answer': an, 'wrong': [w1, w2]} for q, qz, an, w1, w2 in a['q']], ensure_ascii=False),
           '词数': str(n), '来源': f'改编自 德语维基百科《{title}》', '网址': url, '修订号': str(rev), '许可证': 'CC BY-SA 4.0',
           '改编说明': a.get('note', '') + '（Claude 删减、翻译）'}
    rows.append(row); have.add(url); added.append((row['id'], title, n))
rows.sort(key=lambda r: r['id'])
with open(OUT, 'w', encoding='utf-8', newline='') as f:
    w = csv.DictWriter(f, fieldnames=COLS, delimiter='\t', lineterminator='\n'); w.writeheader(); w.writerows(rows)
for x in added: print(*x)
from collections import Counter
print(dict(Counter(r['段'] for r in rows)))
