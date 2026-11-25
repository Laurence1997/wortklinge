"""Second opinion on 情境 for the top 6000: the model sees each word with its current label and returns only the
wrong ones with a better situation. Writes scripts/wortschatz/out/label-verify.tsv (排名, 原形, 旧情境, 新情境, 新宿主, 理由).
Applying the changes to labels.tsv is a separate, reviewed step."""
import csv, json, os, sys, time, urllib.request, urllib.error
from concurrent.futures import ThreadPoolExecutor
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUT = os.path.join(ROOT, 'scripts/wortschatz/out/label-verify.tsv')
MODEL = os.environ.get('MODEL', 'gpt-6-luna'); KEY = os.environ['OPENAI_API_KEY']
HOSTS = ['问候和自我介绍', '数字', '日常物品', '吃喝', '购物付钱', '交通', '方向和城里的地方', '时间日期', '住房家具', '办手续',
         '身体看病', '旅行天气自然', '银行保险合同', '作息爱好', '求职职场', '媒体科技', '人际情感']
SIT = HOSTS + ['讨论说理', '新闻社会', '通用']
SYSTEM = f"""你在复查一个德语学习游戏的词表分组（玩家是在德国生活的中国人）。每行：排名、原形、词性、中文、当前情境、宿主情境。
情境含义：{'、'.join(HOSTS)} 是具体生活场合；讨论说理=抽象词，讨论评价事情用；新闻社会=犯罪、警察、法律、政治、战争、历史、宗教、影视剧词；通用=语法词、到处都用的最基础词、以及功能线词（副词连词等表达类）。
按词本身最常见的意思，判断当前情境是否明显不对。只列出明显错的（比如 Mord 标成吃喝、Messer 标成办手续），差不多也行的不要列。
新情境只能从这里选：{'、'.join(SIT)}。新情境是讨论说理或新闻社会时，h 给一个具体生活场合作宿主，否则 h 为空。
只回 JSON：{{"r": [{{"i": 排名（照抄）, "w": "原形（照抄）", "s": "新情境", "h": "...", "why": "简短中文理由"}}]}}；全部没问题就回 {{"r": []}}。"""

def call(batch):
    user = '\n'.join(f"{x['排名']}\t{x['原形']}\t{x['词性']}\t{x['中文']}\t{x['情境']}\t{x['宿主情境']}" for x in batch)
    body = json.dumps({'model': MODEL, 'reasoning_effort': 'low', 'response_format': {'type': 'json_object'},
                       'messages': [{'role': 'system', 'content': SYSTEM}, {'role': 'user', 'content': user}]}).encode()
    ranks = {int(x['排名']): x for x in batch}
    for a in range(5):
        try:
            req = urllib.request.Request('https://api.openai.com/v1/chat/completions', body, {'Content-Type': 'application/json', 'Authorization': 'Bearer ' + KEY})
            with urllib.request.urlopen(req, timeout=300) as r: j = json.load(r)
            t = j['choices'][0]['message']['content']; out = []
            for e in json.loads(t[t.find('{'):t.rfind('}') + 1])['r']:
                try: i = int(e['i'])
                except Exception: continue
                x = ranks.get(i)
                if not x or x['原形'] != e.get('w') or e.get('s') not in SIT or e.get('s') == x['情境']: continue
                h = e.get('h', '') if e['s'] in ('讨论说理', '新闻社会') and e.get('h') in HOSTS else ''
                if e['s'] in ('讨论说理', '新闻社会') and not h: continue
                out.append((x['排名'], x['原形'], x['情境'], e['s'], h, str(e.get('why', '')).replace('\t', ' ')))
            print('batch', batch[0]['排名'], len(out), flush=True); return out
        except urllib.error.HTTPError as e:
            t = e.read().decode(errors='replace'); print('HTTP', e.code, t[:200], flush=True)
            if 'insufficient_quota' in t or 'billing' in t: sys.exit(3)
        except Exception as e: print('err', repr(e)[:200], flush=True)
        time.sleep(5 * (a + 1))
    return []

W = {r['原形']: r for r in csv.DictReader(open(os.path.join(ROOT, 'data/wortschatz/wortschatz.tsv'), encoding='utf-8'), delimiter='\t')}
L = [r for r in csv.DictReader(open(os.path.join(ROOT, 'scripts/wortschatz/out/labels.tsv'), encoding='utf-8'), delimiter='\t') if int(r['排名']) <= 6000]
rows = [dict(r, 词性=W[r['原形']]['词性'], 中文=W[r['原形']]['中文']) for r in L if not r['功能线']]
print(len(rows), 'to check', flush=True)
res = []
with ThreadPoolExecutor(8) as ex:
    for out in ex.map(call, [rows[i:i + 60] for i in range(0, len(rows), 60)]): res += out
res.sort(key=lambda x: int(x[0]))
with open(OUT, 'w', encoding='utf-8') as f:
    f.write('排名\t原形\t旧情境\t新情境\t新宿主\t理由\n')
    for r in res: f.write('\t'.join(r) + '\n')
print('flagged', len(res))
