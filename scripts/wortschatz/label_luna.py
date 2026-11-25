"""Tag the top 6000 words with 情境 (life situation) and 功能线 (expression function line) using an OpenAI model.

Rules: /mnt/project-files/wortklinge-plan/6000词分组和进场景方案.md §3.2–3.3 (Lucas, 2026-11-25).
Runs in GitHub Actions (key = OPENAI_API_KEY secret). Output: scripts/wortschatz/out/labels.tsv
(排名, 原形, 情境, 功能线, 宿主情境). Already-labelled ranks in that file are skipped, so a rerun only fills gaps.
"""
import csv, json, os, sys, time, urllib.request, urllib.error
from concurrent.futures import ThreadPoolExecutor

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUT = os.path.join(ROOT, 'scripts/wortschatz/out/labels.tsv')
MODEL = os.environ.get('MODEL', 'gpt-6-luna')
KEY = os.environ['OPENAI_API_KEY']
SIT = ['问候客套', '自我介绍家庭', '数字', '日常物品', '吃喝', '购物付钱', '交通', '方向和城里的地方', '时间日期',
       '住房家具', '办手续', '身体看病', '旅行天气自然', '银行保险合同', '作息爱好', '求职职场', '媒体科技', '人际情感', '通用']
FUN = ['推测与可能', '观点与评价', '同意与反对', '原因与结果', '时间先后', '请求与礼貌', '情绪反应', '程度与频率', '转折与让步', '条件与假设']

SYSTEM = f"""你在给一个德语学习游戏的词表分组。玩家是在德国生活的中国人。对每个词给出：
1. s（情境）：这个词最常在哪个生活情境里用到，只能从下面选一个：{'、'.join(SIT)}。
   - 选「这个词第一次真正用得上」的情境：Kartoffel→吃喝，Miete→住房家具，Rezept→身体看病（若例句是菜谱也可吃喝，以中文释义第一义为准）。
   - 数词、Uhr、Minute 等：数字或时间日期。动物、植物、天气、风景：旅行天气自然。情感、恋爱、吵架、朋友：人际情感。
   - 犯罪、警察、法律、政治、历史、宗教这类：如果是办事会碰到的（Polizei、Gesetz）可放办手续，新闻里才见的放媒体科技。
   - 按词本身的意思判断，不要看它碰巧出现在什么句子里。
   - 语法词一律标「通用」：冠词、代词、物主词、介词（及 im/zum 这类缩合）、并列连词 und/oder、助动词和情态动词（sein、haben、werden、können、müssen…）、疑问词。
   - 意思很宽、哪个情境都常用的普通词（machen、geben、sagen、Sache、Ding、gut、groß、neu）也标「通用」。
   - 有具体生活场合的词才给具体情境：Termin→身体看病或办手续，Wasser→吃喝，Stadt→方向和城里的地方，Schule→自我介绍家庭。
2. f（功能线）：只给「表达类」的词填：副词、连词、语气词、感叹词、表达观点/推测/评价/请求的动词或形容词（meinen、glauben、vermuten、bitten、wahrscheinlich、leider、trotzdem、weil、falls）。
   从这 10 条里选一条：{'、'.join(FUN)}。具体名词、动作动词、普通形容词、介词、代词、数词一律留空 ""。
3. h（宿主情境）：只在 f 非空时填，从情境列表里选这个词最自然先用到的一个（不能是「通用」），例如 vielleicht→时间日期（约时间），leider→问候客套（婉拒），weil→作息爱好（讲经历），bitte→吃喝（点餐），trotzdem→旅行天气自然（下雨也出门），sehr→问候客套（Danke sehr）。f 为空时 h 为空。f 非空时 s 填「通用」。
   情态动词、助动词不算表达类（f 留空）。
只回 JSON：{{"r": [{{"i": 排名, "s": "...", "f": "...", "h": "..."}}, ...]}}，每个输入词一条，不要解释。"""


def call(batch):
    user = '\n'.join(f"{x['排名']}\t{x['原形']}\t{x['词性']}\t{x['中文']}" for x in batch)
    body = json.dumps({'model': MODEL, 'reasoning_effort': 'low', 'response_format': {'type': 'json_object'},
                       'messages': [{'role': 'system', 'content': SYSTEM}, {'role': 'user', 'content': user}]}).encode()
    for attempt in range(5):
        try:
            req = urllib.request.Request('https://api.openai.com/v1/chat/completions', body,
                                         {'Content-Type': 'application/json', 'Authorization': 'Bearer ' + KEY})
            with urllib.request.urlopen(req, timeout=300) as r:
                j = json.load(r)
            txt = j['choices'][0]['message']['content']
            res = json.loads(txt[txt.find('{'):txt.rfind('}') + 1])['r']
            out = {}
            for e in res:
                s = e.get('s', '') if e.get('s') in SIT else ''
                f = e.get('f', '') if e.get('f') in FUN else ''
                h = e.get('h', '') if f and e.get('h') in SIT and e.get('h') != '通用' else ''
                if s: out[int(e['i'])] = (s, f, h)
            u = j.get('usage', {})
            print(f"batch {batch[0]['排名']}: {len(out)}/{len(batch)} tokens in {u.get('prompt_tokens')} out {u.get('completion_tokens')}", flush=True)
            return out
        except urllib.error.HTTPError as e:
            t = e.read().decode(errors='replace')
            print('HTTP', e.code, t[:300], flush=True)
            if 'insufficient_quota' in t or 'billing' in t:
                sys.exit(3)
        except Exception as e:
            print('error', batch[0]['排名'], repr(e)[:200], flush=True)
        time.sleep(5 * (attempt + 1))
    return {}


rows = list(csv.DictReader(open(os.path.join(ROOT, 'data/wortschatz/wortschatz.tsv'), encoding='utf-8'), delimiter='\t'))[:6000]
done = {}
if os.path.exists(OUT):
    for r in csv.DictReader(open(OUT, encoding='utf-8'), delimiter='\t'):
        done[int(r['排名'])] = (r['情境'], r['功能线'], r['宿主情境'])
todo = [x for x in rows if int(x['排名']) not in done]
LIMIT = int(os.environ.get('LIMIT', '0') or 0)
if LIMIT: todo = todo[:LIMIT]
print(len(rows), 'rows,', len(done), 'already labelled,', len(todo), 'to do', flush=True)
batches = [todo[i:i + 60] for i in range(0, len(todo), 60)]
with ThreadPoolExecutor(6) as ex:
    for out in ex.map(call, batches):
        done.update(out)
os.makedirs(os.path.dirname(OUT), exist_ok=True)
with open(OUT, 'w', encoding='utf-8') as f:
    f.write('排名\t原形\t情境\t功能线\t宿主情境\n')
    for x in rows:
        k = int(x['排名'])
        if k in done: f.write(f"{k}\t{x['原形']}\t" + '\t'.join(done[k]) + '\n')
print('labelled', len(done), 'of', len(rows))
