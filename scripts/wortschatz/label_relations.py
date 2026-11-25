"""Word relations for the 8000 words (词族秘境 / 挑战排除): for each word the model gives its root word(s) (词根: the simplest
German word it is built from; a compound gives up to two) and up to 3 true synonyms. Output scripts/wortschatz/out/labels-rel.tsv
(排名, 原形, 词根, 近义), keyed by word; roots and synonyms separated by |. build_relations.py turns it into data/wortschatz/relations.tsv."""
import csv, json, os, sys, time, urllib.request, urllib.error
from concurrent.futures import ThreadPoolExecutor
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUT = os.path.join(ROOT, 'scripts/wortschatz/out/labels-rel.tsv')
MODEL = os.environ.get('MODEL', 'gpt-6-luna'); KEY = os.environ['OPENAI_API_KEY']
SYSTEM = """给德语词表里的每个词标两样东西，用来做德语学习游戏的「词族」和「近义词」关卡。
1. g（词根）：这个词由哪个最基本的德语词构成，写那个词的原形（动词写不定式，名词不带冠词，按德语正常大小写）。
   - 派生词、带前缀的词写基本词：Fahrer→fahren，Abfahrt→fahren，Wohnung→wohnen，Freiheit→frei，unglücklich→Glück，verkaufen→kaufen，Bewohner→wohnen。
   - 复合词写两个组成词：Wohnzimmer→wohnen|Zimmer，Bahnhof→Bahn|Hof，Kühlschrank→kühlen|Schrank。
   - 本身就是基本词的写它自己：fahren→fahren，Haus→Haus，und→und。
   - 只写真正同源、现代德语里看得出的词根；外来词（Computer、Telefon）写它自己，不要硬拆。
2. s（近义词）：最多 3 个在常见意思上能互相替换的德语近义词（词性相同，原形），没有就给空数组。不要写反义词、上下位词或只是相关的词。
只回 JSON：{"r": [{"i": 排名（照抄）, "w": "原形（照抄）", "g": ["词根", ...], "s": ["近义词", ...]}]}，每个输入词一条。"""

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
                g = [x.strip() for x in e.get('g') or [] if isinstance(x, str) and x.strip()][:2]
                s = [x.strip() for x in e.get('s') or [] if isinstance(x, str) and x.strip()][:3]
                if ranks.get(i) == e.get('w') and g: out[e['w']] = ('|'.join(g), '|'.join(s))
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
    for r in csv.DictReader(open(OUT, encoding='utf-8'), delimiter='\t'): done[r['原形']] = (r['词根'], r['近义'])
for _ in range(3):
    todo = [x for x in rows if x['原形'] not in done]
    print(len(todo), 'words to do', flush=True)
    if not todo: break
    with ThreadPoolExecutor(8) as ex:
        for out in ex.map(call, [todo[i:i + 60] for i in range(0, len(todo), 60)]): done.update(out)
with open(OUT, 'w', encoding='utf-8') as f:
    f.write('排名\t原形\t词根\t近义\n')
    for x in rows:
        if x['原形'] in done: f.write(f"{x['排名']}\t{x['原形']}\t{done[x['原形']][0]}\t{done[x['原形']][1]}\n")
print('labelled', sum(1 for x in rows if x['原形'] in done), 'of', len(rows))
