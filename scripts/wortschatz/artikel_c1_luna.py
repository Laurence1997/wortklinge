"""C1 article monsters for zones 17–20 (游戏设计: C1 adds no new words; articles 450–600 words, 3 questions).

Source: the German Wikipedia pages artikel_wiki_pool.py already downloaded (data/wortschatz/build/wiki-cache, kept
between runs by actions/cache in content-b2.yml) — real texts, not AI-written (Lucas: 优先维基原文, AI 只删减加注释).
Luna 1 sorts every usable page (title + opening) into the zone whose theme it fits, or none:
  17 档案深处: history, archives, old newspapers, memorials, forgotten places
  18 天平庭: law and rights in everyday life, libraries, philosophy, ethics, debate
  19 蚀变④回潮: work, media, nature and environment, relationships, society
  20 沉默之心: language, speech and rhetoric, cities, communication, silence and sound
and skips what does not fit the game (death, violence, crime, war, disasters, politics in dispute, sport results,
lists, very technical pages). Then per zone the best N pages are abridged by Luna 2 (only cuts, splits very long
sentences, keeps the original's wording and facts; 450–600 words), translated, given 3 content questions, and checked
by Luna 3 with glosses for words outside our 8000-word list (German definition in simple words + Chinese).

Output: data/wortschatz/artikel-c1.tsv, same columns as artikel-b2.tsv (段 = zone 17–20, 新词 empty).
Resumable. Env: OPENAI_API_KEY, MODEL (gpt-6-luna), PER_ZONE (default 60; articles per zone in total).
"""
import csv, gzip, json, os, re, sys, time, urllib.request, urllib.error
from concurrent.futures import ThreadPoolExecutor
import simplemma

ROOT = os.path.join(os.path.dirname(__file__), '..', '..')
D = os.path.join(ROOT, 'data', 'wortschatz')
KEY = os.environ.get('OPENAI_API_KEY')
if not KEY:
    print('OPENAI_API_KEY is not set: skipping.'); sys.exit(0)
MODEL = os.environ.get('MODEL', 'gpt-6-luna')
PER_ZONE = int(os.environ.get('PER_ZONE') or 60)
OUT = os.path.join(D, 'artikel-c1.tsv')
CACHE = os.path.join(D, 'build', 'wiki-cache', 'cache.json.gz')
SORTED = os.path.join(D, 'build', 'wiki-cache', 'c1-zones.json')  # kept with the wiki cache
COLS = ['id', '段', '标题', '例句', '例句中文', '新词', '注释', '题目', '词数', '来源', '网址', '修订号', '许可证', '改编说明']
csv.field_size_limit(10**8)
def tsv(p): return list(csv.DictReader(open(p, encoding='utf-8'), delimiter='\t')) if os.path.exists(p) else []
if not os.path.exists(CACHE):
    print('no Wikipedia cache: run content-b2.yml with artikel 0 first.'); sys.exit(0)

known = {r['原形'].lower() for r in tsv(os.path.join(D, 'wortschatz.tsv'))} | {r['原形'].lower() for r in tsv(os.path.join(D, 'build', 'b2-v1.tsv'))}
pages = {}
for v in json.load(gzip.open(CACHE, 'rt', encoding='utf-8'))['pages'].values():
    if v and v[0] not in pages and sum(len(p.split()) for p in v[2]) >= 450: pages[v[0]] = v
have = tsv(OUT)
used = {r['标题'] for r in have} | {r['网址'] for r in have}
used_src = {r['网址'] for f in ('artikel-b2.tsv', 'artikel-b2-original.tsv') for r in tsv(os.path.join(D, f))}
print(f'{len(pages)} cached Wikipedia pages with 450+ words; {len(have)} C1 articles done')

usage = [0, 0]
import threading
QUOTA = threading.Event()  # balance used up: stop calling, keep what is done, exit 3 at the end

def call(system, user, effort='low'):
    if QUOTA.is_set(): return None
    body = json.dumps({'model': MODEL, 'reasoning_effort': effort, 'response_format': {'type': 'json_object'},
                       'messages': [{'role': 'system', 'content': system}, {'role': 'user', 'content': user}]}).encode()
    for attempt in range(5):
        try:
            req = urllib.request.Request('https://api.openai.com/v1/chat/completions', body,
                                         {'Content-Type': 'application/json', 'Authorization': 'Bearer ' + KEY})
            with urllib.request.urlopen(req, timeout=300) as r:
                j = json.load(r)
            usage[0] += j.get('usage', {}).get('prompt_tokens', 0); usage[1] += j.get('usage', {}).get('completion_tokens', 0)
            txt = j['choices'][0]['message']['content']
            return json.loads(txt[txt.find('{'):txt.rfind('}') + 1])
        except urllib.error.HTTPError as e:
            t = e.read().decode()[:300]
            if 'insufficient_quota' in t:
                QUOTA.set(); return None
            print(f'HTTP {e.code}: {t}')
        except Exception as e:
            print(f'error: {e}')
        time.sleep(5 * (attempt + 1))
    return None

SORT = """下面是德语维基百科条目的标题和开头。给一款教在德国的中国人学德语的游戏挑 C1 阅读文章，按主题分到四个区，不合适的写 0：
17 档案深处：历史、档案、旧报纸、纪念碑、被遗忘的地方和习俗
18 天平庭：日常生活里的法律和权利、图书馆、哲学、伦理、辩论
19 蚀变④回潮：工作、媒体、自然和环境、人际关系、社会生活
20 沉默之心：语言、说话和修辞、城市、交流、声音和寂静
不要（写 0）：死亡、暴力、犯罪、战争、灾难伤亡、有争议的政治、宗教冲突、体育比分、人物生平流水账、列表、很专业的技术或医学条目、读完让人压抑的内容。只选读起来有意思、能讲出一个话题的条目。
只输出 JSON：{"z":{"编号":区号, …}}"""
zones = json.load(open(SORTED)) if os.path.exists(SORTED) else {}
todo = [t for t in pages if t not in zones]
if todo:
    chunks = [todo[i:i + 40] for i in range(0, len(todo), 40)]
    def srt(ch):
        res = call(SORT, '\n'.join(f"{i}. {t}：{' '.join(pages[t][2])[:240]}" for i, t in enumerate(ch, 1))) or {}
        z = res.get('z') or {}
        return {t: int(z.get(str(i), 0) or 0) for i, t in enumerate(ch, 1)} if res else {}
    with ThreadPoolExecutor(6) as ex:
        for got in ex.map(srt, chunks): zones.update(got)
    json.dump(zones, open(SORTED, 'w'), ensure_ascii=False)
from collections import Counter
print('sorted into zones:', dict(Counter(v for v in zones.values())))

plan = []
for z in (17, 18, 19, 20):
    n_have = sum(1 for r in have if r['段'] == str(z))
    cands = [t for t, v in zones.items() if v == z and t in pages and t not in used
             and f'https://de.wikipedia.org/w/index.php?oldid={pages[t][1]}' not in used_src]
    cands.sort(key=lambda t: -sum(len(p.split()) for p in pages[t][2]))
    plan += [(z, t) for t in cands[:max(0, PER_ZONE - n_have)]]
print(f'sending {len(plan)}: ' + ', '.join(f'{z}区 {sum(1 for p in plan if p[0] == z)}' for z in (17, 18, 19, 20)))

ABRIDGE = """你是德语母语的编辑，把一篇德语维基百科条目删减成游戏里给 C1 学习者读的文章（读者是在德国生活的中国人）。
规则：只删句子和段落、把特别长的句子拆开；保留原文的措辞、句式和事实，不改写观点，不加原文没有的内容；保留 C1 水平的复杂句（名词化、分词结构、虚拟式等）；470–600 个词（少于 450 个词会被退回，原文够长就别删太多）；分成 3–6 段；避开术语堆砌、数据罗列的段落，挑有故事、有观点的部分；挑最能讲出一个话题的部分，开头要让人读得进去。标题可以缩短。
内容不适合（死亡、暴力、犯罪、战争、灾难伤亡、有争议的政治、读完压抑）就 "skip": true。
再写：全文自然的简体中文翻译（分段对应）；3 道德语内容题，每题三个德语选项只有一个对，考理解和推断，错项合理但明显错，选项长短相近；一句中文改编说明（例如「删去第 3–5 段，拆分 2 个长句」）。
只输出 JSON：{"skip":false,"title":"…","paras":["…"],"zh":["…"],"questions":[{"q":"…","qZh":"…","answer":"…","wrong":["…","…"]}],"note":"…"}"""
CHECK = """你是严格的德语母语审校。下面是一篇从德语维基百科删减来的 C1 学习文章，附中文、3 道题和一串「表外词」候选。
1. 删减后德语是否正确连贯（只修删减造成的语法或衔接问题，不改写原文）；中文是否准确；每道题是否只有一个答案且能从文中找到依据。能改就改，改不好 verdict 写 drop。
2. 给表外词候选写注释：跳过人名、地名、机构名和缩写；只注真正难的词（C1 读者也可能不认识的），每个给一个简单的德语释义（只用最常用的 2000 个德语词，10 个词以内）和中文意思，de 和 zh 都不超过 40 个字符。w 写文中出现的形式。最多 25 个。
只输出 JSON：{"verdict":"ok 或 fix 或 drop","why":"…","paras":[…],"zh":[…],"questions":[…],"gloss":[{"w":"…","de":"…","zh":"…"}]}（verdict 为 ok 时 paras/zh/questions 可省略）"""

WORD = re.compile(r"[A-Za-zÄÖÜäöüß]+")
lc = {}
def lem(tok):
    k = tok.lower()
    if k not in lc: lc[k] = {k, simplemma.lemmatize(tok, lang='de').lower(), simplemma.lemmatize(k, lang='de').lower()}
    return lc[k]
def qs_ok(qs):
    out = []
    for q in qs or []:
        w = [str(x).strip().replace('｜', ' ') for x in q.get('wrong') or [] if str(x).strip()]
        a = str(q.get('answer', '')).strip().replace('｜', ' ')
        if q.get('q') and a and len(w) == 2 and a not in w:
            out.append({'q': str(q['q']).strip(), 'qZh': str(q.get('qZh', '')).strip(), 'answer': a, 'wrong': w})
    return out if len(out) == 3 else None

def work(item):
    z, t = item
    title, rev, paras0 = pages[t]
    a = call(ABRIDGE, f"标题：{title}\n\n" + '\n\n'.join(paras0), effort='medium')
    if not a or a.get('skip'): return ('skip', title, None)
    paras = [str(p).strip().replace('｜', ' ') for p in a.get('paras') or [] if str(p).strip()]
    qs = qs_ok(a.get('questions'))
    if not paras or not qs: return ('bad', title, None)
    text = ' '.join(paras)
    off = sorted({w for w in WORD.findall(text) if len(w) > 4 and not (lem(w) & known)})
    c = call(CHECK, f"标题：{a.get('title', title)}\n\n" + '\n\n'.join(paras) + '\n\n中文：\n' + '\n'.join(str(x) for x in a.get('zh') or []) +
             '\n\n题目：' + json.dumps(qs, ensure_ascii=False) + f"\n\n表外词候选：{', '.join(off)}")
    if not c or c.get('verdict') == 'drop': return ('drop', title, (c or {}).get('why'))
    zh = a.get('zh') or []
    if c.get('verdict') == 'fix':
        p2 = [str(p).strip().replace('｜', ' ') for p in c.get('paras') or [] if str(p).strip()]
        if p2: paras = p2; text = ' '.join(paras)
        zh = c.get('zh') or zh
        qs = qs_ok(c.get('questions')) or qs
    n = len(WORD.findall(text))
    if not 440 <= n <= 680: return ('len', title, n)
    gloss = [{'w': str(g.get('w', '')).strip(), 'de': str(g.get('de', '')).strip(), 'zh': str(g.get('zh', '')).strip()}
             for g in c.get('gloss') or [] if g.get('w') and g.get('zh') and len(str(g.get('de', ''))) <= 40 and len(str(g['zh'])) <= 40]
    return ('ok', title, {'段': str(z), '标题': str(a.get('title') or title).strip(), '例句': '｜'.join(paras),
            '例句中文': '｜'.join(str(x).strip() for x in zh), '新词': '', '注释': json.dumps(gloss, ensure_ascii=False),
            '题目': json.dumps(qs, ensure_ascii=False), '词数': str(n), '来源': f'改编自 德语维基百科《{title}》',
            '网址': f'https://de.wikipedia.org/w/index.php?oldid={rev}', '修订号': rev, '许可证': 'CC BY-SA 4.0',
            '改编说明': str(a.get('note', '')).strip() + ('；审校修改' if c.get('verdict') == 'fix' else '')})

rows = list(have); stats = Counter()
with ThreadPoolExecutor(6) as ex:
    for k, (st, title, row) in enumerate(ex.map(work, plan), 1):
        stats[st] += 1
        if st == 'ok': rows.append({kk: re.sub(r'\s*[\r\n]+\s*', '｜', str(v)) for kk, v in row.items()})
        elif st in ('drop', 'len'): print(f'{st}: {title}: {row}')
        if k % 20 == 0: print(f'{k}/{len(plan)}', flush=True)
n = {}
for r in rows:
    if r.get('id'): n[r['段']] = max(n.get(r['段'], 0), int(r['id'].rsplit('-', 1)[1]))
for r in rows:
    if not r.get('id'):
        n[r['段']] = n.get(r['段'], 0) + 1; r['id'] = f"c1-{r['段']}-{n[r['段']]:03d}"
rows.sort(key=lambda r: r['id'])
with open(OUT, 'w', encoding='utf-8', newline='') as f:
    w = csv.DictWriter(f, fieldnames=COLS, delimiter='\t', lineterminator='\n'); w.writeheader(); w.writerows(rows)
print(f"{len(rows)} C1 articles: " + ', '.join(f"{z}区 {sum(1 for r in rows if r['段'] == str(z))}" for z in (17, 18, 19, 20)) + f"; this run {dict(stats)}")
print(f'tokens: input {usage[0]}, output {usage[1]}')
if QUOTA.is_set():
    print('OpenAI balance used up: top up under Billing. Finished articles were kept.'); sys.exit(3)
