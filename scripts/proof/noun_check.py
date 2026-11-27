#!/usr/bin/env python3
"""冠词和复数排查 (2026-11-27): DeepSeek checks article (冠词) and plural (复数) of every noun in wortschatz.tsv against
standard German (Duden). Regional variants (das Teller, der Taxi) count as wrong when shown next to the standard one.
Report only: proof/out/nouns.json. Key: DEEPSEEK_API_KEY."""
import csv, json, os, sys, time, urllib.request, concurrent.futures as cf
csv.field_size_limit(10**8)
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
KEY = os.environ['DEEPSEEK_API_KEY']; MODEL = os.environ.get('ZH_MODEL', 'deepseek-v4-pro')
SYSTEM = """你是德语词典编辑。每行是一个德语名词：冠词 art、复数 pl、中文 zh。按标准德语（Duden）检查冠词和复数是否正确、是否和中文意思对应
（例如 das Steuer 是方向盘，die Steuer 才是税；das Alter 不是 der Alter）。几个冠词并列时，如果其中有地区变体或错误的（如 der/das Monat，
标准只有 der Monat），也要报，给出标准写法。真正两个都标准的（der/das Liter、der/das Joghurt 等）不报。名词化形容词（der/die Bekannte）不报。
没有复数写「-」或「kein Pl.」都算对。只报有问题的，输出 JSON：{"items":[{"id":"…","art":"正确冠词","pl":"正确复数","problem":"一句中文"}]}"""
R = [r for r in csv.DictReader(open(os.path.join(ROOT, 'data/wortschatz/wortschatz.tsv'), encoding='utf-8'), delimiter='\t') if r['词性'] == '名词']
items = [{'id': r['排名'], 'word': r['原形'], 'art': r['冠词'], 'pl': r['复数'], 'zh': r['中文']} for r in R]
batches = [items[i:i + 60] for i in range(0, len(items), 60)]
def call(b):
    body = {'model': MODEL, 'temperature': 0, 'response_format': {'type': 'json_object'}, 'thinking': {'type': 'disabled'},
            'messages': [{'role': 'system', 'content': SYSTEM}, {'role': 'user', 'content': '\n'.join(json.dumps(x, ensure_ascii=False) for x in b)}]}
    for a in range(4):
        try:
            req = urllib.request.Request('https://api.deepseek.com/chat/completions', data=json.dumps(body).encode(), headers={'Authorization': 'Bearer ' + KEY, 'Content-Type': 'application/json'})
            with urllib.request.urlopen(req, timeout=300) as r: t = json.load(r)['choices'][0]['message']['content']
            return json.loads(t[t.find('{'):t.rfind('}') + 1]).get('items', [])
        except Exception as e:
            print('retry', a, e, file=sys.stderr); time.sleep(5 * (a + 1))
            if a == 1: body.pop('thinking', None)
    return []
by = {x['id']: x for x in items}; out = []
with cf.ThreadPoolExecutor(8) as ex:
    for res in ex.map(call, batches):
        for f in res:
            x = by.get(str(f.get('id')))
            if x: out.append({**x, 'fixArt': f.get('art'), 'fixPl': f.get('pl'), 'problem': f.get('problem')})
os.makedirs(os.path.join(ROOT, 'proof/out'), exist_ok=True)
json.dump(out, open(os.path.join(ROOT, 'proof/out/nouns.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print('flagged', len(out), 'of', len(items))
