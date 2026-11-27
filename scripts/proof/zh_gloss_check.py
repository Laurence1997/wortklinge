#!/usr/bin/env python3
"""中文释义排查 (2026-11-27, Lucas: Termin 译成「约会」太影响体验).

Reads data/wortschatz/wortschatz.tsv and asks DeepSeek, 40 words per call, whether each Chinese gloss (中文) gives the
meaning a Chinese learner living in Germany needs most, and whether the example translation (例句中文) matches.
Report only: writes proof/out/zh-gloss.json (one entry per flagged word). Key: DEEPSEEK_API_KEY. Model: ZH_MODEL.
"""
import csv, json, os, sys, time, urllib.request, concurrent.futures as cf
csv.field_size_limit(10**8)
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SRC = os.path.join(ROOT, 'data/wortschatz/wortschatz.tsv')
OUT = os.path.join(ROOT, 'proof/out/zh-gloss.json')
MODEL = os.environ.get('ZH_MODEL', 'deepseek-v4-pro')
KEY = os.environ['DEEPSEEK_API_KEY']
SYSTEM = """你是德语词典编辑，读者是在德国生活、学德语的中国人（A1–B2）。逐个检查德语词的中文释义和例句中文。
只报真正有问题的词，问题类型：
- wrong：释义错了，或是望文生义/假朋友（如 Termin 译成「约会」，应为「预约；约定的时间」；eventuell 译成「最终」；Chef 译成「厨师」）。
- rare：只给了不常用的义项，漏了在德国日常生活里最常用的义项（例如 Kasse 只写「箱子」而不是「收银台；医保公司」）。
- narrow：释义太窄或太宽，会让学习者用错（如把 bekommen 写成「变成」，把 aktuell 写成「实际的」）。
- example：例句中文和例句德语意思不符，或和释义冲突（如例句里 Termin 被译成「约会」）。
- style：释义不像中文、太生硬，或用了大陆以外/过时的说法。
没有问题的词不要输出。不要因为可以「补充义项」就报 rare，只有漏了最常用义项才报。
输出 JSON：{"items":[{"id":"排名","type":"wrong|rare|narrow|example|style","problem":"一句中文说明","fix":"建议的中文释义（type=example 时给建议的例句中文）"}]}"""

rows = list(csv.DictReader(open(SRC, encoding='utf-8'), delimiter='\t'))
items = [{'id': r['排名'], 'de': (r['冠词'] + ' ' if r['冠词'] else '') + r['原形'], 'pos': r['词性'], 'zh': r['中文'],
          'ex': r['例句'], 'exZh': r['例句中文']} for r in rows if r['原形']]
LIMIT = int(os.environ.get('ZH_LIMIT', '0') or 0)
if LIMIT: items = items[:LIMIT]
B = 40
batches = [items[i:i + B] for i in range(0, len(items), B)]

def call(batch):
    user = '\n'.join(json.dumps(x, ensure_ascii=False) for x in batch)
    body = {'model': MODEL, 'temperature': 0, 'response_format': {'type': 'json_object'},
            'messages': [{'role': 'system', 'content': SYSTEM}, {'role': 'user', 'content': user}]}
    if MODEL.startswith('deepseek'): body['thinking'] = {'type': os.environ.get('ZH_THINKING', 'disabled')}
    for attempt in range(4):
        try:
            req = urllib.request.Request(os.environ.get('DEEPSEEK_URL', 'https://api.deepseek.com/chat/completions'),
                                         data=json.dumps(body).encode(), headers={'Authorization': 'Bearer ' + KEY, 'Content-Type': 'application/json'})
            with urllib.request.urlopen(req, timeout=300) as r:
                txt = json.load(r)['choices'][0]['message']['content']
            s = txt[txt.find('{'):txt.rfind('}') + 1]
            return json.loads(s).get('items', [])
        except Exception as e:
            print('retry', attempt, e, file=sys.stderr)
            if 'thinking' in body and attempt == 1: body.pop('thinking')
            time.sleep(5 * (attempt + 1))
    return [{'id': x['id'], 'type': 'error', 'problem': 'call failed', 'fix': ''} for x in batch[:1]]

by = {x['id']: x for x in items}
found = []
with cf.ThreadPoolExecutor(8) as ex:
    for n, res in enumerate(ex.map(call, batches)):
        for f in res:
            x = by.get(str(f.get('id')))
            if x: found.append({**x, **{k: f.get(k) for k in ('type', 'problem', 'fix')}})
        if n % 20 == 0: print(n, '/', len(batches), len(found), flush=True)
os.makedirs(os.path.dirname(OUT), exist_ok=True)
json.dump(found, open(OUT, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print('flagged', len(found), 'of', len(items))
