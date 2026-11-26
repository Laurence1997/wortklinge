"""B2 article monsters (Lucas 2026-11-26 按推荐): abridged German Wikinews articles that carry the segment's new words.

From build/artikel/pool.tsv (artikel_pool.py) each B2 segment (段 13–16, words 6001–8000) gets articles until its words
are used up: every article claims the 5–8 of its segment's words it carries that no earlier article claimed.
Luna 1 abridges (B2 300–450 words: only cuts sentences, splits long ones and swaps very rare phrases, never rewrites
the content; keeps the claimed words), translates, writes 3 German content questions with three answers each, and
says in one line how it adapted the text. Luna 2 checks it (German correct after the cuts, every question has one
answer the text supports, Chinese right) and glosses the words that are not in our 8000-word list: a German
definition in simple words plus Chinese, shown on click in the game.

Output: data/wortschatz/artikel-b2.tsv. Columns: id, 段, 标题, 例句 (the text, paragraphs joined by ｜; the proofread
workflow checks it), 例句中文, 新词, 注释 (JSON [{w, de, zh}]), 题目 (JSON [{q, qZh, answer, wrong:[2]}]), 词数, 来源,
网址, 修订号, 许可证, 改编说明. 来源 + 许可证 + 网址 are the attribution line under each article (CC BY 2.5 needs it).
Resumable. Env: OPENAI_API_KEY, MODEL (gpt-6-luna), LIMIT (0 = all; positive = this many new articles, spread over
the segments, for a trial). Needs `pip install simplemma`.
"""
import csv, json, os, re, sys, time, urllib.request, urllib.error
from concurrent.futures import ThreadPoolExecutor
import simplemma

ROOT = os.path.join(os.path.dirname(__file__), '..', '..')
D = os.path.join(ROOT, 'data', 'wortschatz')
KEY = os.environ.get('OPENAI_API_KEY')
if not KEY:
    print('OPENAI_API_KEY is not set: skipping.'); sys.exit(0)
MODEL = os.environ.get('MODEL', 'gpt-6-luna')
LIMIT = int(os.environ.get('LIMIT') or 0)
OUT = os.path.join(D, 'artikel-b2.tsv')
COLS = ['id', '段', '标题', '例句', '例句中文', '新词', '注释', '题目', '词数', '来源', '网址', '修订号', '许可证', '改编说明']
LEN = {'13': (300, 450), '14': (300, 450), '15': (300, 450), '16': (300, 450)}
csv.field_size_limit(10**8)
def tsv(p): return list(csv.DictReader(open(p, encoding='utf-8'), delimiter='\t')) if os.path.exists(p) else []

known = set()
for r in tsv(os.path.join(D, 'wortschatz.tsv')): known.add(r['原形'].lower())
segw = {}
for r in tsv(os.path.join(D, 'build', 'b2-v1.tsv')): segw.setdefault(r['段'], set()).add(r['原形'].lower())
cased = {r['原形'].lower(): r['原形'] for r in tsv(os.path.join(D, 'build', 'b2-v1.tsv'))}
pool = {}
for r in tsv(os.path.join(D, 'build', 'artikel', 'pool.tsv')): pool.setdefault(r['段'], []).append(r)
have = tsv(OUT)
claimed = {s: set() for s in segw}
used_titles = {r['标题'] for r in have} | {r['网址'] for r in have}
for r in have:
    for w in r['新词'].split(', '):
        if w: claimed.setdefault(r['段'], set()).add(w.lower())

WORD = re.compile(r"[A-Za-zÄÖÜäöüß]+")
cache = {}
def lem(tok):
    k = tok.lower()
    if k not in cache: cache[k] = {k, simplemma.lemmatize(tok, lang='de').lower(), simplemma.lemmatize(k, lang='de').lower()}
    return cache[k]
def lemmas(text):
    out = set()
    for t in WORD.findall(text): out |= lem(t)
    return out

ABRIDGE = """你是德语母语的编辑，把德语维基新闻或维基百科原文删减成游戏里给 B2 学习者读的文章（在德国生活的中国人）。
规则：只删句子、把太长的句子拆开、把极少数生僻说法换成常用说法；不改写观点和事实，不加原文没有的内容；保留指定的目标词（可以变形），尽量全部保留，至少保留 5 个；长度 {lo}–{hi} 个词；分成 2–5 段；标题可以缩短。
内容不适合就 "skip": true：涉及死亡、暴力、犯罪、恐怖袭击、战争、灾难伤亡、镇压或抓捕的（哪怕只是一部分）；政治上敏感的；过时到看不懂、太专业、本质是列表或体育比分的。游戏要的是日常生活、城市、经济、环境、科技、文化、教育、交通这类话题，读完不压抑。
再写：全文自然的简体中文翻译（分段对应）；3 道德语内容题，每题三个德语选项只有一个对，考理解不考原句记忆，错项明显错但合理，选项长短相近；一句中文改编说明（例如「删去第 3–5 段，拆分 2 个长句」）。
只输出 JSON：{{"skip":false,"title":"…","paras":["…"],"zh":["…"],"kept":["目标词原形"],"questions":[{{"q":"…","qZh":"…","answer":"…","wrong":["…","…"]}}],"note":"…"}}"""

CHECK = """你是严格的德语母语审校。下面是一篇从维基新闻或维基百科删减来的 B2 学习文章，附中文、3 道题和一串「表外词」候选。
1. 删减后德语是否正确连贯（只修删减造成的语法或衔接问题，不改写原文）；中文是否准确；每道题是否只有一个答案且能从文中找到依据。能改就改，改不好 verdict 写 drop。
2. 给表外词候选写注释：跳过人名、地名、机构名和缩写；每个真正的词给一个简单的德语释义（只用最常用的 2000 个德语词，10 个词以内）和中文意思，de 和 zh 都不超过 40 个字符。w 写文中出现的形式。
只输出 JSON：{"verdict":"ok 或 fix 或 drop","why":"…","paras":[…],"zh":[…],"questions":[…],"gloss":[{"w":"…","de":"…","zh":"…"}]}（verdict 为 ok 时 paras/zh/questions 可省略）"""

usage = [0, 0]
def call(system, user):
    body = json.dumps({'model': MODEL, 'reasoning_effort': 'low', 'response_format': {'type': 'json_object'},
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
                print('OpenAI balance used up: top up under Billing.'); sys.exit(3)
            print(f'HTTP {e.code}: {t}')
        except Exception as e:
            print(f'error: {e}')
        time.sleep(5 * (attempt + 1))
    return None


# Screen the pool first: Luna reads title + opening of every candidate and keeps only topics that fit the game.
SCREEN = """下面是德语维基新闻或维基百科文章的标题和开头。游戏（给在德国的中国人学德语）只要读完不压抑的日常话题：城市生活、交通、住房、经济和消费、工作、环境和自然、天气、科技、文化艺术、教育、科学、健康常识、体育以外的社会生活。
不要：死亡、暴力、犯罪、恐怖、战争、灾难伤亡、镇压抓捕、选举争议和政党斗争、宗教冲突、体育比分、讣告。只输出 JSON：{"ok":[编号, …]}"""
SCREENED = os.path.join(D, 'build', 'artikel', 'screened.json')
okset = set(json.load(open(SCREENED))) if os.path.exists(SCREENED) else None
if okset is None:
    cands = {}
    for s_, rs in pool.items():
        for r in rs: cands.setdefault(r['网址'], r)
    items = list(cands.values()); okset = set()
    chunks = [items[i:i + 40] for i in range(0, len(items), 40)]
    def scr(ch):
        res = call(SCREEN, '\n'.join(f"{i}. {r['标题']}：{r['正文'][:220]}" for i, r in enumerate(ch, 1))) or {}
        return [ch[int(i) - 1]['网址'] for i in res.get('ok', []) if str(i).isdigit() and 1 <= int(i) <= len(ch)]
    with ThreadPoolExecutor(6) as ex:
        for got in ex.map(scr, chunks): okset |= set(got)
    json.dump(sorted(okset), open(SCREENED, 'w'))
    print(f'screened {len(items)} candidates, {len(okset)} fit the game')
for s_ in pool: pool[s_] = [r for r in pool[s_] if r['网址'] in okset]

# Plan which articles to send: per segment, greedily the article with the most unclaimed words (≥5), round robin.
plan, plan_claim = [], {s: set(claimed.get(s, set())) for s in segw}
queues = {s: [r for r in pool.get(s, []) if r['标题'] not in used_titles and r['网址'] not in used_titles] for s in segw}
def next_for(s):
    best, bh = None, []
    for r in queues[s]:
        h = [w for w in r['命中词'].split(', ') if w and w not in plan_claim[s]]
        if len(h) > len(bh): best, bh = r, h
    if not best or len(bh) < 5: return None
    queues[s].remove(best)
    tgt = bh[:8]; plan_claim[s] |= set(tgt)
    return (s, best, tgt)
active = sorted(segw)
while active and (not LIMIT or len(plan) < LIMIT):
    for s in list(active):
        if LIMIT and len(plan) >= LIMIT: break
        x = next_for(s)
        if x: plan.append(x)
        else: active.remove(s)
print(f'{len(have)} articles done; sending {len(plan)}: ' + ', '.join(f'段{s} {sum(1 for p in plan if p[0] == s)}' for s in sorted(segw)))


def qs_ok(qs):
    out = []
    for q in qs or []:
        w = [str(x).strip() for x in q.get('wrong') or [] if str(x).strip()]
        a = str(q.get('answer', '')).strip()
        if q.get('q') and a and len(w) == 2 and a not in w:
            out.append({'q': str(q['q']).strip(), 'qZh': str(q.get('qZh', '')).strip(), 'answer': a, 'wrong': w})
    return out if len(out) == 3 else None

def work(item):
    s, src, tgt = item
    lo, hi = LEN[s]
    body = src['正文'].replace('｜', '\n\n')
    a = call(ABRIDGE.format(lo=lo, hi=hi), f"目标词：{', '.join(cased.get(w, w) for w in tgt)}\n标题：{src['标题']}\n\n{body}")
    if not a or a.get('skip'): return ('skip', src['标题'], None)
    paras = [str(p).strip().replace('｜', ' ') for p in a.get('paras') or [] if str(p).strip()]
    qs = qs_ok(a.get('questions'))
    if not paras or not qs: return ('bad', src['标题'], None)
    text = ' '.join(paras)
    L = lemmas(text)
    off = sorted({t for t in WORD.findall(text) if len(t) > 3 and not (lem(t) & known)})
    c = call(CHECK, f"标题：{a.get('title', src['标题'])}\n\n" + '\n\n'.join(paras) + '\n\n中文：\n' + '\n'.join(a.get('zh') or []) +
             '\n\n题目：' + json.dumps(qs, ensure_ascii=False) + f"\n\n表外词候选：{', '.join(off)}")
    if not c or c.get('verdict') == 'drop': return ('drop', src['标题'], (c or {}).get('why'))
    zh = a.get('zh') or []
    if c.get('verdict') == 'fix':
        p2 = [str(p).strip().replace('｜', ' ') for p in c.get('paras') or [] if str(p).strip()]
        if p2: paras = p2; text = ' '.join(paras); L = lemmas(text)
        zh = c.get('zh') or zh
        qs = qs_ok(c.get('questions')) or qs
    kept = [w for w in tgt if w in L]
    if len(kept) < 3: return ('few', src['标题'], None)
    gloss = [{'w': str(g.get('w', '')).strip(), 'de': str(g.get('de', '')).strip(), 'zh': str(g.get('zh', '')).strip()}
             for g in c.get('gloss') or [] if g.get('w') and g.get('zh') and len(str(g.get('de', ''))) <= 40 and len(str(g['zh'])) <= 40]
    row = {'段': s, '标题': str(a.get('title') or src['标题']).strip(), '例句': '｜'.join(paras), '例句中文': '｜'.join(str(z).strip() for z in zh),
           '新词': ', '.join(cased.get(w, w) for w in kept), '注释': json.dumps(gloss, ensure_ascii=False),
           '题目': json.dumps(qs, ensure_ascii=False), '词数': str(len(WORD.findall(text))),
           '来源': f"改编自 德语{'维基百科' if 'wikipedia.org' in src['网址'] else '维基新闻'}《{src['标题']}》", '网址': src['网址'], '修订号': src['修订号'],
           '许可证': 'CC BY-SA 4.0' if 'wikipedia.org' in src['网址'] else 'CC BY 2.5',
           '改编说明': str(a.get('note', '')).strip() + ('；审校修改' if c.get('verdict') == 'fix' else '')}
    return ('ok', src['标题'], row)

rows = list(have)
stats = {}
with ThreadPoolExecutor(6) as ex:
    for k, (st, title, row) in enumerate(ex.map(work, plan), 1):
        stats[st] = stats.get(st, 0) + 1
        if st == 'ok': rows.append({k: re.sub(r'\s*[\r\n]+\s*', '｜', str(v)) for k, v in row.items()})
        elif st == 'drop': print(f'dropped: {title}: {row}')
        if k % 20 == 0: print(f'{k}/{len(plan)}', flush=True)
n = {}
for r in sorted(rows, key=lambda r: (r['段'], r.get('id') or 'zz')):
    n[r['段']] = n.get(r['段'], 0) + 1
    if not r.get('id'): r['id'] = f"b2-{r['段']}-{n[r['段']]:03d}"
rows.sort(key=lambda r: r['id'])
with open(OUT, 'w', encoding='utf-8', newline='') as f:
    w = csv.DictWriter(f, fieldnames=COLS, delimiter='\t', lineterminator='\n'); w.writeheader(); w.writerows(rows)
cov = {s: len({x.lower() for r in rows if r['段'] == s for x in r['新词'].split(', ') if x}) for s in sorted(segw)}
print(f'{len(rows)} articles; this run: {stats}; words covered: ' + ', '.join(f'段{s} {cov[s]}/{len(segw[s])}' for s in sorted(segw)))
print(f'tokens: input {usage[0]}, output {usage[1]}')
