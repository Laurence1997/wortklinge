"""Repair pass over data/wortschatz/beispiele-6000.tsv (run after examples_senses_luna.py; safe to rerun).

1. Words below the minimum get the missing sentences: 2 for content words and for anything marked important,
   1 for prepositions, pronouns, articles, conjunctions, particles and interjections; verb + preposition
   patterns from verben-praeposition.tsv that no sentence carries yet are added too. Sources as before:
   unused Tatoeba pool sentences, the table's example, then Luna.
2. Sentences without Chinese (Tatoeba example 1 of words ranked after 3000) get a translation.
Words missing from the file entirely are added with their example 1 first.
Env: OPENAI_API_KEY, MODEL (gpt-6-luna).
"""
import csv, json, os, sys, time, urllib.request, urllib.error
from concurrent.futures import ThreadPoolExecutor

ROOT = os.path.join(os.path.dirname(__file__), '..', '..')
D = os.path.join(ROOT, 'data', 'wortschatz')
KEY = os.environ.get('OPENAI_API_KEY')
if not KEY:
    print('OPENAI_API_KEY is not set: skipping.'); sys.exit(0)
MODEL = os.environ.get('MODEL', 'gpt-6-luna')
OUT = os.path.join(D, 'beispiele-6000.tsv')
COLS = ['原形', '序号', '例句', '例句中文', '例句出处', '义项', '搭配']
SMALL = {'介词', '代词', '冠词', '连词', '小品词', '感叹词'}

def tsv(p): return list(csv.DictReader(open(p, encoding='utf-8'), delimiter='\t')) if os.path.exists(p) else []
words, seen = [], set()
for r in tsv(os.path.join(D, 'wortschatz.tsv')):
    if int(r['排名']) <= 6000 and r['原形'] not in seen:
        seen.add(r['原形']); words.append(r)
rows = tsv(OUT)
by, first = {}, set()
for r in rows:
    if r['例句'] in first and r['序号'] != '1': continue  # the same sentence under two words: keep the first
    first.add(r['例句']); by.setdefault(r['原形'], []).append(r)
for r in tsv(os.path.join(D, 'beispiele.tsv')):
    w = r['原形']
    if w in seen and w not in by:
        by[w] = [{'原形': w, '序号': '1', '例句': r['例句'], '例句中文': r['例句中文'], '例句出处': r['例句出处'], '义项': '', '搭配': ''}]
imp = {r['原形']: bool(r['重要']) for r in tsv(os.path.join(D, 'build', 'yixiang-6000.tsv'))}
vp = {}
for r in tsv(os.path.join(D, 'verben-praeposition.tsv')): vp.setdefault(r['动词'], []).append(r)
used = {r['例句'] for rs in by.values() for r in rs}
pool = {}
for r in tsv(os.path.join(D, 'build', 'tatoeba', 'pool-6000.tsv')):
    if r['例句'] not in used: pool.setdefault(r['原形'], []).append(r)

def norm(s): return s.replace(' ', '').replace('jdn./etw.', '').replace('sich', '').lower()
todo = []
for r in words:
    w = r['原形']
    if w not in by: continue
    have = by[w]
    need = 1 if (r['词性'] in SMALL and not imp.get(w)) else 2
    tagged = {norm(x['搭配']) for x in have if x['搭配']}
    open_vp = [v for v in vp.get(w, []) if norm(v['搭配']) not in tagged and v['例句'] not in used]
    n = max(0, need - len(have)) + len(open_vp)
    if n: todo.append((r, min(n, 4), open_vp))
print(f'{len(todo)} words need sentences; {sum(1 for rs in by.values() for x in rs if not x["例句中文"].strip())} sentences need Chinese')

SYS_ADD = """你是德语母语的编辑，给一款教在德国的中国人学德语的游戏补例句。每个词标了词频排名（1–1000 约 A1，1001–3000 约 A2，3001–6000 约 B1）。
每个词给了词卡、已有例句（e1…）、还缺的动介搭配（v1…，带表里的例句）、Tatoeba 母语者候选（p1…），以及「要补 N 句」。
正好补 N 句：先覆盖每个 v 搭配（可以直接用 v 的例句，写 "t":"v1"）；其余用和已有例句不同的常用用法或义项。来源顺序：p 候选（地道、用法对、≤12 个词、内容不阴暗不奇怪）→ v 的例句 → 自己写（排名 1–1000：4–9 个词；1001–3000：6–12；3001 以后：8–14；用更常用的词，德国日常生活，话题多样）。
每句给自然的简体中文、简短的中文义项、搭配（如 warten auf + Akk.，没有就空）。
只输出 JSON：{"r":[{"w":"原形","add":[{"t":"p2 或 v1 或 new","de":"…","zh":"…","sense":"…","colloc":"…"}]}]}"""
SYS_ZH = """把每句德语译成自然、准确的简体中文（游戏里给学德语的中国人看）。只输出 JSON：{"r":[{"n":序号,"zh":"中文"}]}"""

usage = [0, 0]
def call(system, user):
    body = json.dumps({'model': MODEL, 'reasoning_effort': 'low', 'response_format': {'type': 'json_object'},
                       'messages': [{'role': 'system', 'content': system}, {'role': 'user', 'content': user}]}).encode()
    for attempt in range(5):
        try:
            req = urllib.request.Request('https://api.openai.com/v1/chat/completions', body,
                                         {'Content-Type': 'application/json', 'Authorization': 'Bearer ' + KEY})
            with urllib.request.urlopen(req, timeout=300) as r:
                j = json.load(r)
            usage[0] += j.get('usage', {}).get('prompt_tokens', 0); usage[1] += j.get('usage', {}).get('completion_tokens', 0)
            txt = j['choices'][0]['message']['content']
            return json.loads(txt[txt.find('{'):txt.rfind('}') + 1])['r']
        except urllib.error.HTTPError as e:
            t = e.read().decode()[:300]
            if 'insufficient_quota' in t:
                print('OpenAI balance used up: top up under Billing.'); sys.exit(3)
            print(f'HTTP {e.code}: {t}')
        except Exception as e:
            print(f'error: {e}')
        time.sleep(5 * (attempt + 1))
    return []

def add_prompt(batch):
    out = []
    for r, n, ov in batch:
        w = r['原形']
        out.append(f"## {w} | 排名 {r['排名']} | 词卡：{r['卡片']} | {r['词性']} | {r['中文']} | 要补 {n} 句")
        for i, e in enumerate(by[w], 1): out.append(f"e{i}：{e['例句']}")
        for i, v in enumerate(ov, 1): out.append(f"v{i}：{v['搭配']}（{v['中文']}）例：{v['例句']}")
        for i, p in enumerate(pool.get(w, [])[:12], 1): out.append(f"p{i}：{p['例句']}")
    return '\n'.join(out)

batches = [todo[i:i + 8] for i in range(0, len(todo), 8)]
added = 0
with ThreadPoolExecutor(6) as ex:
    for b, res in zip(batches, ex.map(lambda b: call(SYS_ADD, add_prompt(b)), batches)):
        got = {x.get('w'): x for x in res or []}
        for r, n, ov in b:
            w = r['原形']
            for a in (got.get(w, {}).get('add') or [])[:n]:
                t = str(a.get('t', 'new')).strip().lower(); de = a.get('de', '').strip(); src = 'Luna 写'
                ps = pool.get(w, [])
                if t.startswith('p') and t[1:].isdigit() and 1 <= int(t[1:]) <= min(12, len(ps)):
                    p = ps[int(t[1:]) - 1]; de = p['例句']; src = f"Tatoeba #{p['tatoeba_id']} · {p['作者']}"
                elif t.startswith('v') and t[1:].isdigit() and 1 <= int(t[1:]) <= len(ov):
                    de = ov[int(t[1:]) - 1]['例句']; src = '动介搭配表'
                if not de or de in used: continue
                used.add(de); added += 1
                by[w].append({'原形': w, '序号': str(len(by[w]) + 1), '例句': de, '例句中文': a.get('zh', '').strip(),
                              '例句出处': src, '义项': a.get('sense', ''), '搭配': a.get('colloc', '')})

need_zh = [x for rs in by.values() for x in rs if not x['例句中文'].strip()]
zb = [need_zh[i:i + 40] for i in range(0, len(need_zh), 40)]
with ThreadPoolExecutor(6) as ex:
    for b, res in zip(zb, ex.map(lambda b: call(SYS_ZH, '\n'.join(f'{i} {x["例句"]}' for i, x in enumerate(b, 1))), zb)):
        for y in res or []:
            n = int(y.get('n', 0)) if str(y.get('n', '')).isdigit() else 0
            if 1 <= n <= len(b) and y.get('zh'): b[n - 1]['例句中文'] = y['zh'].strip()

order = {r['原形']: i for i, r in enumerate(words)}
out = []
for w in sorted(by, key=lambda w: order.get(w, 1e9)):
    for i, x in enumerate(by[w], 1): x['序号'] = str(i); out.append(x)
with open(OUT, 'w', encoding='utf-8', newline='') as f:
    wr = csv.DictWriter(f, fieldnames=COLS, delimiter='\t', lineterminator='\n', extrasaction='ignore'); wr.writeheader(); wr.writerows(out)
print(f'added {added}; still without Chinese {sum(1 for x in out if not x["例句中文"].strip())}; {len(out)} sentences for {len(by)} words')
print(f'tokens: input {usage[0]}, output {usage[1]}')
