"""Second labelling pass (方案 §13, 2026-11-25):
1. 问候客套 + 自我介绍家庭 → 问候和自我介绍 (rename only, no model call).
2. 通用 content words (noun/verb/adjective without 功能线) → 讨论说理, 通用 or a concrete situation; 讨论说理 gets a 宿主情境.
3. 媒体科技 → 媒体科技 (phone, internet, TV, computer) or 新闻社会 (crime, police, law, politics, history, film words);
   新闻社会 gets a 宿主情境.
Rewrites scripts/wortschatz/out/labels.tsv in place. Rows already carrying a §13 label are skipped on a rerun.
"""
import csv, json, os, sys, time, urllib.request, urllib.error
from concurrent.futures import ThreadPoolExecutor

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUT = os.path.join(ROOT, 'scripts/wortschatz/out/labels.tsv')
MODEL = os.environ.get('MODEL', 'gpt-6-luna')
KEY = os.environ['OPENAI_API_KEY']
HOSTS = ['问候和自我介绍', '数字', '日常物品', '吃喝', '购物付钱', '交通', '方向和城里的地方', '时间日期', '住房家具', '办手续',
         '身体看病', '旅行天气自然', '银行保险合同', '作息爱好', '求职职场', '媒体科技', '人际情感']
REN = {'问候客套': '问候和自我介绍', '自我介绍家庭': '问候和自我介绍'}

SYS_ABS = f"""你在给德语学习游戏的词表分组，玩家是在德国生活的中国人。下面的词上一轮被标成「通用」。请重新给每个词选 s：
- 「讨论说理」：抽象词，讨论、说理、评价事情时用（Problem、Lösung、Erfahrung、Vorteil、Risiko、Ursache、entwickeln、auslösen、optimal、komplex）。
- 「通用」：只留给最基础、到处都用的日常词（machen、geben、nehmen、gut、groß、neu、Leute、Mensch、Ding、Sache）。
- 或者一个具体情境（如果这个词其实明显属于某个生活场合）：{'、'.join(HOSTS)}。
s 为「讨论说理」时，再给 h（宿主情境）：从具体情境里选这个词最自然先用到的一个，例如 Problem→住房家具（房子出问题），Erfahrung→求职职场，Lösung→办手续。其他情况 h 为空。
按词本身的意思判断。只回 JSON：{{"r": [{{"i": 排名（照抄第一列的数字）, "w": "原形（照抄第二列）", "s": "...", "h": "..."}}, ...]}}，每个输入词一条。"""

SYS_MED = f"""你在给德语学习游戏的词表分组，玩家是在德国生活的中国人。下面的词上一轮被标成「媒体科技」。请把每个词分到：
- 「媒体科技」：手机、网络、电脑、电视、应用、社交媒体、拍照等日常科技和媒体使用（Handy、Video、Internet、herunterladen、Akku）。
- 「新闻社会」：新闻里才常见的犯罪、警察、法庭、法律、政治、战争、历史、宗教，以及影视剧里的词（Mord、verhaften、Regierung、Krieg、Zombie、Vampir）。
- 或者一个更合适的具体情境：{'、'.join(h for h in HOSTS if h != '媒体科技')}。
s 为「新闻社会」时，再给 h（宿主情境）：从具体情境里选这个词在德国生活中最可能先碰到的一个，例如 Polizei→方向和城里的地方，Gesetz→办手续，Diebstahl→交通（车上被偷），Regierung→媒体科技（看新闻）。其他情况 h 为空。
只回 JSON：{{"r": [{{"i": 排名（照抄第一列的数字）, "w": "原形（照抄第二列）", "s": "...", "h": "..."}}, ...]}}，每个输入词一条。"""


def call(args):
    system, allowed, needs_host, batch = args
    user = '\n'.join(f"{x['排名']}\t{x['原形']}\t{x['词性']}\t{x['中文']}" for x in batch)
    body = json.dumps({'model': MODEL, 'reasoning_effort': 'low', 'response_format': {'type': 'json_object'},
                       'messages': [{'role': 'system', 'content': system}, {'role': 'user', 'content': user}]}).encode()
    for attempt in range(5):
        try:
            req = urllib.request.Request('https://api.openai.com/v1/chat/completions', body,
                                         {'Content-Type': 'application/json', 'Authorization': 'Bearer ' + KEY})
            with urllib.request.urlopen(req, timeout=300) as r:
                j = json.load(r)
            txt = j['choices'][0]['message']['content']
            out = {}
            ranks = {int(x['排名']): x['原形'] for x in batch}
            for e in json.loads(txt[txt.find('{'):txt.rfind('}') + 1])['r']:
                try: i = int(e['i'])
                except Exception: continue
                if ranks.get(i) != e.get('w'): continue   # the model must echo rank and word; a mismatch is dropped
                s = e.get('s', '')
                if s not in allowed: continue
                h = e.get('h', '') if s == needs_host and e.get('h') in HOSTS else ''
                if s == needs_host and not h: continue
                out[i] = (s, h)
            print(f"batch {batch[0]['排名']}: {len(out)}/{len(batch)}", flush=True)
            return out
        except urllib.error.HTTPError as e:
            t = e.read().decode(errors='replace')
            print('HTTP', e.code, t[:300], flush=True)
            if 'insufficient_quota' in t or 'billing' in t: sys.exit(3)
        except Exception as e:
            print('error', batch[0]['排名'], repr(e)[:200], flush=True)
        time.sleep(5 * (attempt + 1))
    return {}


W = {r['排名']: r for r in csv.DictReader(open(os.path.join(ROOT, 'data/wortschatz/wortschatz.tsv'), encoding='utf-8'), delimiter='\t')}
L = list(csv.DictReader(open(OUT, encoding='utf-8'), delimiter='\t'))
for r in L:
    r['情境'] = REN.get(r['情境'], r['情境']); r['宿主情境'] = REN.get(r['宿主情境'], r['宿主情境'])
abs_ = [W[r['排名']] for r in L if r['情境'] == '通用' and not r['功能线'] and W[r['排名']]['词性'] in ('名词', '动词', '形容词')]
med = [W[r['排名']] for r in L if r['情境'] == '媒体科技' and not r['宿主情境']]
print(len(abs_), 'abstract candidates,', len(med), 'media words', flush=True)
jobs = [(SYS_ABS, set(HOSTS) | {'讨论说理', '通用'}, '讨论说理', abs_[i:i + 60]) for i in range(0, len(abs_), 60)]
jobs += [(SYS_MED, set(HOSTS) | {'新闻社会'}, '新闻社会', med[i:i + 60]) for i in range(0, len(med), 60)]
res = {}
with ThreadPoolExecutor(6) as ex:
    for out in ex.map(call, jobs): res.update(out)
for r in L:
    k = int(r['排名'])
    if k in res: r['情境'], r['宿主情境'] = res[k]
with open(OUT, 'w', encoding='utf-8') as f:
    f.write('排名\t原形\t情境\t功能线\t宿主情境\n')
    for r in L: f.write('\t'.join(r[c] for c in ('排名', '原形', '情境', '功能线', '宿主情境')) + '\n')
print('relabelled', len(res), 'of', len(abs_) + len(med))
