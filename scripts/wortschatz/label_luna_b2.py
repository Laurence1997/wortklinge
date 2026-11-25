"""Tag ranks 6001–8000 (B2 words, zones 13–16) with 情境/功能线/宿主情境 by the B2 zone themes
(游戏设计 rev 488「121–200 级」): 13 议会堡 社会政治辩论 · 14 铸币场 经济金钱消费环境 ·
15 蚀变③ = 4–7 区情境（住房家具/身体看病/旅行天气自然/银行保险合同）的 B2 说法 · 16 面具剧场 文化艺术科学教育.
Output scripts/wortschatz/out/labels-b2.tsv; ranks already there are skipped on a rerun.
"""
import csv, json, os, sys, time, urllib.request, urllib.error
from concurrent.futures import ThreadPoolExecutor

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUT = os.path.join(ROOT, 'scripts/wortschatz/out/labels-b2.tsv')
MODEL = os.environ.get('MODEL', 'gpt-6-luna'); KEY = os.environ['OPENAI_API_KEY']
SIT = ['社会政治辩论', '经济金钱消费环境', '文化艺术科学教育', '住房家具', '身体看病', '旅行天气自然', '银行保险合同', '通用']
FUN = ['推测与可能', '观点与评价', '同意与反对', '原因与结果', '时间先后', '请求与礼貌', '情绪反应', '程度与频率', '转折与让步', '条件与假设']
HOST = [s for s in SIT if s != '通用']
SYSTEM = f"""你在给德语学习游戏的 B2 词（词频 6001–8000 名）分区。玩家是在德国生活的中国人，这些词在 121–160 级的文章里学。
每个词选 s（情境），只能从这里选一个：{'、'.join(SIT)}。
- 社会政治辩论（13 区）：社会、政治、新闻、法律、犯罪、历史、宗教、人际和社会关系，以及辩论说理用的抽象词（Ansatz、Argument、berücksichtigen）。
- 经济金钱消费环境（14 区）：经济、公司、工作、钱、消费、购物、广告、环境、能源、交通运输。
- 文化艺术科学教育（16 区）：文化、艺术、文学、音乐、电影戏剧、科学、技术、学校大学教育、媒体网络、情感和性格描写。
- 住房家具、身体看病、旅行天气自然、银行保险合同（15 区，日常生活话题的 B2 说法）：房子、家务、身体、健康、医疗、旅行、天气、动物植物、自然、银行、保险、合同。
- 通用：只给语法词（介词、连词、代词）和功能线词。
按词本身的意思判断；每个词都尽量放进一个具体情境。
f（功能线）：只给表达类的词（副词、连词、语气词、表达观点/推测/评价/让步的词），从这 10 条选一条：{'、'.join(FUN)}；其他留空。f 非空时 s 填「通用」，h 填一个具体情境（宿主）。f 为空时 h 为空。
只回 JSON：{{"r": [{{"i": 排名（照抄第一列的数字）, "w": "原形（照抄第二列）", "s": "...", "f": "...", "h": "..."}}, ...]}}，每个输入词一条。"""

def call(batch):
    user = '\n'.join(f"{x['排名']}\t{x['原形']}\t{x['词性']}\t{x['中文']}" for x in batch)
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
                if ranks.get(i) != e.get('w'): continue
                s = e.get('s', ''); f = e.get('f', '') if e.get('f') in FUN else ''
                h = e.get('h', '') if f and e.get('h') in HOST else ''
                if f and not h: continue
                if f: s = '通用'
                if s in SIT: out[i] = (s, f, h)
            print('batch', batch[0]['排名'], len(out), '/', len(batch), flush=True); return out
        except urllib.error.HTTPError as e:
            t = e.read().decode(errors='replace'); print('HTTP', e.code, t[:200], flush=True)
            if 'insufficient_quota' in t or 'billing' in t: sys.exit(3)
        except Exception as e: print('err', repr(e)[:200], flush=True)
        time.sleep(5 * (a + 1))
    return {}

rows = list(csv.DictReader(open(os.path.join(ROOT, 'data/wortschatz/wortschatz.tsv'), encoding='utf-8'), delimiter='\t'))[6000:8000]
done = {}
if os.path.exists(OUT):
    for r in csv.DictReader(open(OUT, encoding='utf-8'), delimiter='\t'):
        if r['原形'] in {x['原形'] for x in rows}: done[r['原形']] = (r['情境'], r['功能线'], r['宿主情境'])
for _ in range(2):   # second round fills words the model dropped
    todo = [x for x in rows if x['原形'] not in done]
    print(len(todo), 'to do', flush=True)
    if not todo: break
    with ThreadPoolExecutor(6) as ex:
        for out in ex.map(call, [todo[i:i + 60] for i in range(0, len(todo), 60)]):
            for k, v in out.items(): done[next(x['原形'] for x in todo if int(x['排名']) == k)] = v
with open(OUT, 'w', encoding='utf-8') as f:
    f.write('排名\t原形\t情境\t功能线\t宿主情境\n')
    for x in rows:
        if x['原形'] in done: f.write(f"{x['排名']}\t{x['原形']}\t" + '\t'.join(done[x['原形']]) + '\n')
print('labelled', len(done), 'of', len(rows))
