"""Quick parallel check of the rewritten example sentences (scripts/wortschatz/out/check-input.tsv):
LanguageTool (local server in the job) + an OpenAI model. Writes scripts/wortschatz/out/check-result.tsv.
The full proofread.yml run checks everything sequentially; this one only covers the rewritten sentences, in parallel."""
import csv, json, os, sys, time, urllib.request, urllib.parse, urllib.error
from concurrent.futures import ThreadPoolExecutor
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
IN = os.path.join(ROOT, 'scripts/wortschatz/out/check-input.tsv')
OUT = os.path.join(ROOT, 'scripts/wortschatz/out/check-result.tsv')
MODEL = os.environ.get('MODEL', 'gpt-6-luna'); KEY = os.environ['OPENAI_API_KEY']
rows = list(csv.DictReader(open(IN, encoding='utf-8'), delimiter='\t'))
# LanguageTool rules that only produce noise on single example sentences
SKIP = {'DE_CASE', 'GERMAN_SPELLER_RULE', 'WHITESPACE_RULE', 'TYPOGRAFISCHE_ANFUEHRUNGSZEICHEN', 'DOPPELTES_AUSRUFEZEICHEN', 'EINHEIT_LEERZEICHEN'}

def lt(r):
    data = urllib.parse.urlencode({'language': 'de-DE', 'text': r['例句']}).encode()
    try:
        with urllib.request.urlopen('http://localhost:8010/v2/check', data, timeout=60) as f:
            m = json.load(f)['matches']
        return [(r['i'], 'LT', x['rule']['id'], x['message'], r['例句'][x['offset']:x['offset'] + x['length']]) for x in m if x['rule']['id'] not in SKIP]
    except Exception as e:
        return [(r['i'], 'LT', 'error', repr(e)[:100], '')]

SYSTEM = """你是德语母语的编辑，在审一个德语学习游戏的例句（给在德国生活的中国人）。每行：编号、目标词、德语例句、中文翻译。
只报真问题：语法错误、搭配或用法错误、德国人不会这么说的不自然说法、中文翻译和德语意思不符、例句没有用到目标词的典型意思。
口语化、句子简单、标点风格不算问题。没问题的不要列出。
只回 JSON：{"issues": [{"i": 编号, "w": "目标词（照抄）", "type": "error|unnatural|translation", "problem": "中文说明", "fix": "改好的德语句子或中文"}]}"""

def ai(batch):
    user = '\n'.join(f"{r['i']}\t{r['原形']}\t{r['例句']}\t{r['例句中文']}" for r in batch)
    body = json.dumps({'model': MODEL, 'reasoning_effort': 'low', 'response_format': {'type': 'json_object'},
                       'messages': [{'role': 'system', 'content': SYSTEM}, {'role': 'user', 'content': user}]}).encode()
    ids = {r['i']: r['原形'] for r in batch}
    for a in range(5):
        try:
            req = urllib.request.Request('https://api.openai.com/v1/chat/completions', body, {'Content-Type': 'application/json', 'Authorization': 'Bearer ' + KEY})
            with urllib.request.urlopen(req, timeout=300) as f: j = json.load(f)
            t = j['choices'][0]['message']['content']; res = json.loads(t[t.find('{'):t.rfind('}') + 1]).get('issues', [])
            out = [(str(e['i']), 'AI', e.get('type', ''), e.get('problem', ''), e.get('fix', '')) for e in res if ids.get(str(e.get('i'))) == e.get('w')]
            print('batch', batch[0]['i'], len(out), flush=True); return out
        except urllib.error.HTTPError as e:
            t = e.read().decode(errors='replace'); print('HTTP', e.code, t[:200], flush=True)
            if 'insufficient_quota' in t: sys.exit(3)
        except Exception as e: print('err', repr(e)[:200], flush=True)
        time.sleep(5 * (a + 1))
    return [(batch[0]['i'], 'AI', 'skipped', 'batch failed', '')]

found = []
with ThreadPoolExecutor(16) as ex:
    for x in ex.map(lt, rows): found += x
print('LT', len(found), flush=True)
with ThreadPoolExecutor(8) as ex:
    for x in ex.map(ai, [rows[i:i + 40] for i in range(0, len(rows), 40)]): found += x
by = {r['i']: r for r in rows}
with open(OUT, 'w', encoding='utf-8') as f:
    f.write('i\t原形\t例句\t例句中文\t来源\t类型\t问题\t建议\n')
    for i, src, typ, prob, fix in sorted(found, key=lambda x: int(x[0])):
        r = by.get(i, {'原形': '', '例句': '', '例句中文': ''})
        f.write('\t'.join(s.replace('\t', ' ').replace('\n', ' ') for s in (i, r['原形'], r['例句'], r['例句中文'], src, typ, prob, fix)) + '\n')
print('total', len(found))
