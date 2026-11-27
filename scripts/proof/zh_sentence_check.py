#!/usr/bin/env python3
"""中文翻译排查 (2026-11-27): DeepSeek reads every German sentence that has a Chinese translation (proof/out/sentences.json
from scripts/proof/extract.ts; articles over 600 characters are skipped, they were checked paragraph by paragraph before)
and reports only meaning errors: a word translated with the wrong sense (Termin → 约会), false friends, wrong numbers,
times, negation or person. Style is ignored. Report only: proof/out/zh-sentences.json. Key: DEEPSEEK_API_KEY."""
import json, os, sys, time, urllib.request, concurrent.futures as cf
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
MODEL = os.environ.get('ZH_MODEL', 'deepseek-v4-pro')
KEY = os.environ['DEEPSEEK_API_KEY']
SYSTEM = """你在审校德语学习游戏的中文翻译，读者是在德国生活的中国人。每行是一个德语句子和它的中文翻译。
只报「意思错了」的翻译：
- 某个德语词译错了义项，或按字面/假朋友译错（例：Termin 译成「约会」——在德国 Termin 是预约、约好的时间，只有约朋友/恋爱才是约会；Chef 译成厨师；eventuell 译成最终；bekommen 译成变成；Kasse 在医保语境译成钱箱；Stelle 指职位却译成地方）。
- 数字、时间、日期、否定、人称、主语宾语弄反、漏译了影响理解的关键信息。
- 在德国生活场景里明显不对的说法（例：Bürgeramt 译成派出所，Hausverwaltung 译成房东，Nebenkosten 译成额外费用而不是房租杂费/附加费）。
不要报：文风、语序、可以更好但意思没错的翻译、德语本身的语法问题、只是意译。
输出 JSON：{"items":[{"id":"原样抄行首的 id","problem":"一句中文说明哪个词错在哪","fix":"改好的完整中文翻译"}]}，没有问题输出 {"items":[]}。"""
S = json.load(open(os.path.join(ROOT, 'proof/out/sentences.json'), encoding='utf-8'))
items = [s for s in S if s.get('zh') and len(s['text']) <= 600 and s.get('kind') not in ('word', 'plural')]
LIMIT = int(os.environ.get('ZH_LIMIT', '0') or 0)
if LIMIT: items = items[:LIMIT]
B = 40
batches = [items[i:i + B] for i in range(0, len(items), B)]
print('items', len(items), 'batches', len(batches), flush=True)

def call(batch):
    user = '\n'.join(json.dumps({'id': s['id'], 'de': s['text'], 'zh': s['zh']}, ensure_ascii=False) for s in batch)
    body = {'model': MODEL, 'temperature': 0, 'response_format': {'type': 'json_object'}, 'thinking': {'type': 'disabled'},
            'messages': [{'role': 'system', 'content': SYSTEM}, {'role': 'user', 'content': user}]}
    for attempt in range(4):
        try:
            req = urllib.request.Request('https://api.deepseek.com/chat/completions', data=json.dumps(body).encode(),
                                         headers={'Authorization': 'Bearer ' + KEY, 'Content-Type': 'application/json'})
            with urllib.request.urlopen(req, timeout=300) as r:
                txt = json.load(r)['choices'][0]['message']['content']
            return json.loads(txt[txt.find('{'):txt.rfind('}') + 1]).get('items', [])
        except Exception as e:
            print('retry', attempt, e, file=sys.stderr)
            if attempt == 1: body.pop('thinking', None)
            time.sleep(5 * (attempt + 1))
    return [{'id': batch[0]['id'], 'problem': 'CALL FAILED for batch', 'fix': ''}]

by = {s['id']: s for s in items}
found = []
with cf.ThreadPoolExecutor(10) as ex:
    for n, res in enumerate(ex.map(call, batches)):
        for f in res:
            s = by.get(str(f.get('id')))
            if s: found.append({'id': s['id'], 'src': s['src'], 'de': s['text'], 'zh': s['zh'], 'problem': f.get('problem'), 'fix': f.get('fix')})
        if n % 100 == 0: print(n, '/', len(batches), len(found), flush=True)
os.makedirs(os.path.join(ROOT, 'proof/out'), exist_ok=True)
json.dump(found, open(os.path.join(ROOT, 'proof/out/zh-sentences.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print('flagged', len(found), 'of', len(items))
