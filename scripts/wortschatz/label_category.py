"""Monster-shape 类别 for the 8000 words (游戏设计「怪物」, Lucas 2026-11-25): 食物 / 物品 / 动物 / 人物 / 地点 / 抽象.
Only nouns go to the model; every other part of speech is 抽象. Output scripts/wortschatz/out/labels-cat.tsv (原形, 类别), keyed by word."""
import csv, json, os, sys, time, urllib.request, urllib.error
from concurrent.futures import ThreadPoolExecutor
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUT = os.path.join(ROOT, 'scripts/wortschatz/out/labels-cat.tsv')
MODEL = os.environ.get('MODEL', 'gpt-6-luna'); KEY = os.environ['OPENAI_API_KEY']
CAT = ['食物', '物品', '动物', '人物', '地点', '抽象']
SYSTEM = """给德语学习游戏里的名词选怪物外形类别（怪长什么样）。只能从这 6 类选一个：
- 食物：吃的喝的、食材、菜（Brot、Kaffee、Kartoffel）。
- 物品：能拿在手里或放在屋里的东西，工具、家具、衣服、证件、电器（Schlüssel、Tisch、Jacke、Pass、Handy）。
- 动物：动物和植物等生物（Hund、Vogel、Baum、Blume）。
- 人物：人、职业、亲属、身体部位、神鬼怪物（Arzt、Mutter、Hand、Geist）。
- 地点：地方、建筑、房间、城市国家、交通工具、天气和自然风景（Bahnhof、Küche、Bus、Regen、Berg）。
- 抽象：看不见摸不着的概念、事件、时间、活动、感觉、数量（Zeit、Idee、Termin、Angst、Fußball 作为运动时）。
按词最常见的意思选。只回 JSON：{"r": [{"i": 排名（照抄）, "w": "原形（照抄）", "c": "类别"}]}，每个输入词一条。"""

def call(batch):
    user = '\n'.join(f"{x['排名']}\t{x['原形']}\t{x['中文']}" for x in batch)
    body = json.dumps({'model': MODEL, 'reasoning_effort': 'low', 'response_format': {'type': 'json_object'},
                       'messages': [{'role': 'system', 'content': SYSTEM}, {'role': 'user', 'content': user}]}).encode()
    ranks = {int(x['排名']): x['原形'] for x in batch}
    for a in range(5):
        try:
            req = urllib.request.Request('https://api.openai.com/v1/chat/completions', body, {'Content-Type': 'application/json', 'Authorization': 'Bearer ' + KEY})
            with urllib.request.urlopen(req, timeout=300) as r: j = json.load(r)
            t = j['choices'][0]['message']['content']; out = {}
            for e in json.loads(t[t.find('{'):t.rfind('}') + 1])['r']:
                try: i = int(e['i'])
                except Exception: continue
                if ranks.get(i) == e.get('w') and e.get('c') in CAT: out[e['w']] = e['c']
            print('batch', batch[0]['排名'], len(out), '/', len(batch), flush=True); return out
        except urllib.error.HTTPError as e:
            t = e.read().decode(errors='replace'); print('HTTP', e.code, t[:200], flush=True)
            if 'insufficient_quota' in t or 'billing' in t: sys.exit(3)
        except Exception as e: print('err', repr(e)[:200], flush=True)
        time.sleep(5 * (a + 1))
    return {}

rows = list(csv.DictReader(open(os.path.join(ROOT, 'data/wortschatz/wortschatz.tsv'), encoding='utf-8'), delimiter='\t'))
done = {}
if os.path.exists(OUT):
    for r in csv.DictReader(open(OUT, encoding='utf-8'), delimiter='\t'): done[r['原形']] = r['类别']
for x in rows:
    if x['词性'] != '名词': done.setdefault(x['原形'], '抽象')
for _ in range(3):
    todo = [x for x in rows if x['原形'] not in done]
    print(len(todo), 'nouns to do', flush=True)
    if not todo: break
    with ThreadPoolExecutor(8) as ex:
        for out in ex.map(call, [todo[i:i + 80] for i in range(0, len(todo), 80)]): done.update(out)
with open(OUT, 'w', encoding='utf-8') as f:
    f.write('排名\t原形\t类别\n')
    for x in rows:
        if x['原形'] in done: f.write(f"{x['排名']}\t{x['原形']}\t{done[x['原形']]}\n")
print('labelled', sum(1 for x in rows if x['原形'] in done), 'of', len(rows))
