"""Sense and collocation pass over the example sentences (Lucas 2026-11-25: important words get more examples).

Plain words keep 3 examples. Verbs and words with several common senses get extra sentences so that
  - every common sense (义项) has at least one sentence, and
  - every verb + preposition pattern in data/wortschatz/verben-praeposition.tsv has at least one sentence
    (Luna may add up to 2 more very common ones that the table lacks).
Every sentence, the first 3 included, is tagged with its 义项 and, where there is one, its 搭配, so the game can
ask by sense and by collocation.

Sources for new sentences, in this order: Tatoeba native sentences (build/tatoeba/pool-1-3.tsv), the example of the
verb + preposition table, then Luna writes one.

Input:  build/zonen-1-3.tsv, beispiele.tsv (example 1), build/beispiele-mehr.tsv (examples 2–3), verben-praeposition.tsv,
        build/tatoeba/pool-1-3.tsv
Output: data/wortschatz/beispiele-1-3.tsv (all examples of zones 1–3: 原形, 序号, 例句, 例句中文, 例句出处, 义项, 搭配)
        data/wortschatz/build/yixiang-1-3.tsv (原形, 重要, 义项列表)
Resumable: words already in the output are skipped. Env: OPENAI_API_KEY, LIMIT (0 = all), MODEL (gpt-6-luna).
"""
import csv, json, os, sys, time, urllib.request, urllib.error
from concurrent.futures import ThreadPoolExecutor

ROOT = os.path.join(os.path.dirname(__file__), '..', '..')
D = os.path.join(ROOT, 'data', 'wortschatz')
KEY = os.environ.get('OPENAI_API_KEY')
if not KEY:
    print('OPENAI_API_KEY is not set: skipping.'); sys.exit(0)
MODEL = os.environ.get('MODEL', 'gpt-6-luna')
LIMIT = int(os.environ.get('LIMIT') or 0)
OUT = os.path.join(D, 'beispiele-1-3.tsv')
SENSES = os.path.join(D, 'build', 'yixiang-1-3.tsv')
COLS = ['原形', '序号', '例句', '例句中文', '例句出处', '义项', '搭配']

def tsv(p): return list(csv.DictReader(open(p, encoding='utf-8'), delimiter='\t')) if os.path.exists(p) else []
zone = tsv(os.path.join(D, 'build', 'zonen-1-3.tsv'))
ex = {}
for r in tsv(os.path.join(D, 'beispiele.tsv')):
    ex.setdefault(r['原形'], [{'例句': r['例句'], '例句中文': r['例句中文'], '例句出处': r['例句出处']}])
for r in tsv(os.path.join(D, 'build', 'beispiele-mehr.tsv')):
    ex.setdefault(r['原形'], []).append(r)
vp = {}
for r in tsv(os.path.join(D, 'verben-praeposition.tsv')):
    vp.setdefault(r['动词'], []).append(r)
pool = {}
for r in tsv(os.path.join(D, 'build', 'tatoeba', 'pool-1-3.tsv')):
    pool.setdefault(r['原形'], []).append(r)
done = {r['原形'] for r in tsv(OUT)}
todo = [r for r in zone if r['原形'] not in done and r['原形'] in ex]
if LIMIT: todo = todo[:LIMIT]
print(f'{len(zone)} words, {len(done)} done, sending {len(todo)}')

SYSTEM = """你是德语母语的编辑，给一款教在德国的中国人学德语的游戏整理例句。玩家在 1–3 区（A1，1–30 级）。
每个词给了词卡、已有例句（e1、e2…），动词还给了动介搭配表里的搭配（v1、v2…，带表里的例句），以及 Tatoeba 母语者候选句（p1、p2…）。
你要做三件事：
1. 列出这个词在日常德语里常用的义项（最多 4 个，用简短中文，尽量沿用词卡的中文说法）。只有一个常用义项就只列一个。
2. 给每句已有例句标「义项」（从你列的义项里选）和「搭配」（例如 warten auf + Akk.、sich freuen über + Akk.、Angst haben vor + Dat.；没有特别搭配就留空）。
3. 判断这个词是否「重要」：动词都算重要；有两个以上常用义项的词也算重要。重要的词要补句子，直到：每个常用义项至少 1 句；动介搭配表里给的每个搭配至少 1 句；动词再补最多 2 个表里没有、但非常常用的介词或格搭配（各 1 句）。不重要的词不补。每个词最多补 6 句。已有例句覆盖了的就不要重复补。
补句来源顺序：先从 p 候选里挑（必须地道、用法对得上、不超过 12 个词、内容不阴暗不奇怪）；没有合适的，用 v 搭配表里的例句；都没有才自己写（4–10 个词，常用词，德国日常生活，话题多样）。每句都给自然的简体中文翻译。
只输出 JSON：{"r":[{"w":"原形","senses":["义项1","义项2"],"important":true,"tags":[{"e":1,"sense":"…","colloc":"…"}],"add":[{"t":"p3 或 v1 或 new","de":"德语","zh":"中文","sense":"…","colloc":"…"}]}]}"""

def prompt(batch):
    out = []
    for r in batch:
        w = r['原形']
        out.append(f"## {w} | 词卡：{r['卡片']} | {r['词性']} | {r['中文']}")
        for i, e in enumerate(ex[w], 1): out.append(f"e{i}：{e['例句']}")
        for i, v in enumerate(vp.get(w, []), 1): out.append(f"v{i}：{v['搭配']}（{v['中文']}）例：{v['例句']}")
        for i, p in enumerate(pool.get(w, [])[:12], 1): out.append(f"p{i}：{p['例句']}")
    return '\n'.join(out)

usage = [0, 0]
def call(batch):
    body = json.dumps({'model': MODEL, 'reasoning_effort': 'low', 'response_format': {'type': 'json_object'},
                       'messages': [{'role': 'system', 'content': SYSTEM}, {'role': 'user', 'content': prompt(batch)}]}).encode()
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
    return None

used = {e['例句'] for es in ex.values() for e in es}
def rows_for(batch, res):
    out, senses = [], []
    by = {x.get('w'): x for x in res or []}
    for r in batch:
        w = r['原形']; x = by.get(w)
        if not x: continue  # retried next run
        tags = {int(t.get('e', 0)): t for t in x.get('tags', []) if str(t.get('e', '')).isdigit()}
        for i, e in enumerate(ex[w], 1):
            t = tags.get(i, {})
            out.append([w, i, e['例句'], e['例句中文'], e['例句出处'], t.get('sense', ''), t.get('colloc', '')])
        n = len(ex[w])
        for a in (x.get('add') or [])[:6]:
            t = str(a.get('t', 'new')).strip().lower(); de = a.get('de', '').strip(); src = 'Luna 写'
            ps, vs = pool.get(w, []), vp.get(w, [])
            if t.startswith('p') and t[1:].isdigit() and 1 <= int(t[1:]) <= min(12, len(ps)):
                p = ps[int(t[1:]) - 1]; de = p['例句']; src = f"Tatoeba #{p['tatoeba_id']} · {p['作者']}"
            elif t.startswith('v') and t[1:].isdigit() and 1 <= int(t[1:]) <= len(vs):
                de = vs[int(t[1:]) - 1]['例句']; src = '动介搭配表'
            if not de or de in used: continue
            used.add(de); n += 1
            out.append([w, n, de, a.get('zh', '').strip(), src, a.get('sense', ''), a.get('colloc', '')])
        senses.append([w, 'ja' if x.get('important') else '', '；'.join(x.get('senses') or [])])
    return out, senses

def opener(p, cols):
    new = not os.path.exists(p)
    f = open(p, 'a', encoding='utf-8', newline=''); w = csv.writer(f, delimiter='\t', lineterminator='\n')
    if new: w.writerow(cols)
    return f, w
fo, wo = opener(OUT, COLS)
fs, ws = opener(SENSES, ['原形', '重要', '义项列表'])
SIZE = 8
batches = [todo[i:i + SIZE] for i in range(0, len(todo), SIZE)]
with ThreadPoolExecutor(6) as pool_ex:
    for k, (b, res) in enumerate(zip(batches, pool_ex.map(call, batches)), 1):
        o, s = rows_for(b, res); wo.writerows(o); ws.writerows(s); fo.flush(); fs.flush()
        print(f'{k}/{len(batches)}', flush=True)
fo.close(); fs.close()

order = {r['原形']: i for i, r in enumerate(zone)}
rows = tsv(OUT); rows.sort(key=lambda r: (order.get(r['原形'], 1e9), int(r['序号'])))
with open(OUT, 'w', encoding='utf-8', newline='') as f:
    w = csv.DictWriter(f, fieldnames=COLS, delimiter='\t', lineterminator='\n'); w.writeheader(); w.writerows(rows)
per = {}
for r in rows: per[r['原形']] = per.get(r['原形'], 0) + 1
src = [r['例句出处'] for r in rows]
print(f"{len(per)} words, {len(rows)} sentences (words with more than 3: {sum(1 for v in per.values() if v > 3)}); "
      f"added: Tatoeba {sum(1 for r in rows if int(r['序号']) > 3 and r['例句出处'].startswith('Tatoeba'))}, "
      f"table {src.count('动介搭配表')}, Luna {sum(1 for r in rows if int(r['序号']) > 3 and r['例句出处'] == 'Luna 写')}")
print(f'tokens: input {usage[0]}, output {usage[1]}')
