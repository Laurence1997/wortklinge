"""Bring every word up to 3 example sentences (Lucas 2026-11-25), zones 1–3 first.

Example 1 is the one already in data/wortschatz/beispiele.tsv. Examples 2 and 3:
  1. Tatoeba sentences by native speakers (data/wortschatz/build/tatoeba/candidates.tsv). Luna keeps a
     candidate only if it is natural, uses the word in the card's meaning, shows a common everyday use
     that differs from the other examples, and is easy enough for the zone.
  2. Where fewer than 2 candidates pass, Luna writes the rest.
Every kept sentence gets a natural simplified-Chinese translation (Tatoeba's Chinese is often missing or traditional).

Input:  data/wortschatz/build/zonen-1-3.tsv (word → zone; from 6000词进场景-第1版.xlsx), beispiele.tsv, candidates.tsv
Output: data/wortschatz/beispiele-mehr.tsv (原形, 序号, 例句, 例句中文, 例句出处). The proofread workflow reads it
        automatically (column 例句), so LanguageTool and the Luna cross-check run on it like on everything else.
Resumable: words already in the output are skipped. Env: OPENAI_API_KEY, LIMIT (0 = all), MODEL (gpt-6-luna).
Licence: Tatoeba sentences CC BY 2.0 FR, the source column keeps sentence id and author.
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
OUT = os.path.join(D, 'beispiele-mehr.tsv')

def tsv(p): return list(csv.DictReader(open(p, encoding='utf-8'), delimiter='\t'))
zone = tsv(os.path.join(D, 'build', 'zonen-1-3.tsv'))
ex1 = {r['原形']: r for r in tsv(os.path.join(D, 'beispiele.tsv'))}
cands = {}
for r in tsv(os.path.join(D, 'build', 'tatoeba', 'candidates.tsv')):
    if r['例句'] != ex1.get(r['原形'], {}).get('例句'):
        cands.setdefault(r['原形'], []).append(r)
done = {r['原形'] for r in tsv(OUT)} if os.path.exists(OUT) else set()
todo = [r for r in zone if r['原形'] not in done]
if LIMIT: todo = todo[:LIMIT]
print(f'{len(zone)} words in zones 1–3, {len(done)} done, sending {len(todo)}')

SYSTEM = """你是德语母语的编辑，给一款教在德国的中国人学德语的游戏挑选和编写例句。玩家在 1–3 区（A1，1–30 级），句子要简单、日常、德国生活里真的会说。
每个词已经有「例句1」。你要给出例句2和例句3：
1. 先从 Tatoeba 母语者候选句（编号 t1、t2…）里挑。只挑同时满足这些的：标准德语、地道；用的是词卡给的意思；是这个词最常见的日常用法之一；和例句1以及彼此用法明显不同（换人称、换格、换搭配、换场合都算）；不超过 10 个词、没有生僻词；内容不阴暗、不奇怪。宁缺毋滥。
2. 候选不够两句，就自己写，补满两句。自己写的：4–9 个词，只用常用词，要体现这个词另一种常见用法或常见搭配，和德国日常生活有关，不要和例句1重复句型。名词尽量换一个格或用复数，动词尽量换人称或用现在完成时。
3. 每句都给自然的简体中文翻译（意思准确，不逐字硬译）。
只输出 JSON：{"r":[{"w":"原形","s":[{"t":"t1 或 new","de":"德语句子","zh":"中文"},{"t":"…","de":"…","zh":"…"}]}]}。每个词正好 2 句，顺序：先 Tatoeba 后自写。"""

def prompt(batch):
    lines = []
    for r in batch:
        w = r['原形']
        lines.append(f"## {w} | 词卡：{r['卡片']} | {r['词性']} | {r['中文']}")
        lines.append(f"例句1：{ex1[w]['例句']}")
        for i, c in enumerate(cands.get(w, [])[:3], 1):
            lines.append(f"t{i}：{c['例句']}")
    return '\n'.join(lines)

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

def rows_for(batch, res):
    out = []
    by = {x.get('w'): x for x in res or []}
    for r in batch:
        w = r['原形']; x = by.get(w)
        if not x or len(x.get('s', [])) < 2: continue  # retried next run
        n = 2
        for s in x['s'][:2]:
            t = str(s.get('t', 'new')).strip().lower()
            cs = cands.get(w, [])
            if t.startswith('t') and t[1:].isdigit() and 1 <= int(t[1:]) <= min(3, len(cs)):
                c = cs[int(t[1:]) - 1]
                out.append([w, n, c['例句'], s.get('zh', '').strip(), f"Tatoeba #{c['tatoeba_id']} · {c['作者']}"])
            else:
                out.append([w, n, s.get('de', '').strip(), s.get('zh', '').strip(), 'Luna 写'])
            n += 1
    return out

new = not os.path.exists(OUT)
f = open(OUT, 'a', encoding='utf-8', newline='')
wr = csv.writer(f, delimiter='\t', lineterminator='\n')
if new: wr.writerow(['原形', '序号', '例句', '例句中文', '例句出处'])
SIZE = 15
batches = [todo[i:i + SIZE] for i in range(0, len(todo), SIZE)]
with ThreadPoolExecutor(6) as pool:
    for k, (b, res) in enumerate(zip(batches, pool.map(call, batches)), 1):
        wr.writerows(rows_for(b, res)); f.flush()
        print(f'{k}/{len(batches)}', flush=True)
f.close()

# Keep the file in zone order so a diff is easy to read.
order = {r['原形']: i for i, r in enumerate(zone)}
rows = tsv(OUT)
rows.sort(key=lambda r: (order.get(r['原形'], 1e9), int(r['序号'])))
with open(OUT, 'w', encoding='utf-8', newline='') as f:
    w = csv.DictWriter(f, fieldnames=['原形', '序号', '例句', '例句中文', '例句出处'], delimiter='\t', lineterminator='\n')
    w.writeheader(); w.writerows(rows)
src = [r['例句出处'] for r in rows]
print(f"{len({r['原形'] for r in rows})} words, {len(rows)} sentences: Tatoeba {sum(s.startswith('Tatoeba') for s in src)}, Luna {sum(s == 'Luna 写' for s in src)}")
print(f'tokens: input {usage[0]}, output {usage[1]}')
