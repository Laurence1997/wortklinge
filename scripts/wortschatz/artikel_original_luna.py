"""B2 article monsters, part 2: original texts for the segment words Wikipedia and Wikinews can't cover.

Lucas 2026-11-26 (选 1): articles come from German Wikinews / Wikipedia first (artikel_luna.py); every B2 segment word
that no article claims afterwards gets an original article written by Luna, checked by a strict second Luna pass for
naturalness (plus LanguageTool and the Luna proofread in proofread.yml, like every 例句 column), and marked 「原创」 —
never passed off as a source.

Words are grouped by segment and 情境 (build/b2-v1.tsv), 6–8 per article. Luna 1 writes a 300–450 word text in a genre
that really exists in Germany (local paper, magazine column, blog, information leaflet, forum post …) on that 情境,
using all the group's words in their common meaning; translation; 3 content questions. Luna 2 reviews it as a native
editor (would a German write this? no AI phrasing, no translationese), fixes or drops it, and glosses words outside our
8000-word list. Words an article doesn't end up using stay open for the next run.

Output: appended to data/wortschatz/artikel-b2.tsv with the same columns as artikel_luna.py; 来源 「原创」, no 网址/许可证.
Resumable. Env: OPENAI_API_KEY, MODEL (gpt-6-luna), LIMIT (0 = all; positive = this many new articles spread over the
segments, for a trial). Needs `pip install simplemma`.
"""
import csv, json, os, re, sys, time, urllib.request, urllib.error
from collections import defaultdict
from concurrent.futures import ThreadPoolExecutor
import simplemma

ROOT = os.path.join(os.path.dirname(__file__), '..', '..')
D = os.path.join(ROOT, 'data', 'wortschatz')
KEY = os.environ.get('OPENAI_API_KEY')
if not KEY:
    print('OPENAI_API_KEY is not set: skipping.'); sys.exit(0)
MODEL = os.environ.get('MODEL', 'gpt-6-luna')
LIMIT = int(os.environ.get('LIMIT') or 0)
OUT = os.environ.get('OUT') or os.path.join(D, 'artikel-b2-original.tsv')
SEG = set((os.environ.get('SEG') or '').replace(',', ' ').split())  # e.g. '13' or '13 14'; empty = all
COLS = ['id', '段', '标题', '例句', '例句中文', '新词', '注释', '题目', '词数', '来源', '网址', '修订号', '许可证', '改编说明']
csv.field_size_limit(10**8)
def tsv(p): return list(csv.DictReader(open(p, encoding='utf-8'), delimiter='\t')) if os.path.exists(p) else []

known = {r['原形'].lower() for r in tsv(os.path.join(D, 'wortschatz.tsv'))}
b2 = tsv(os.path.join(D, 'build', 'b2-v1.tsv'))
known |= {r['原形'].lower() for r in b2}
have = tsv(OUT)
claimed = defaultdict(set)
for r in have + tsv(os.path.join(D, 'artikel-b2.tsv')):
    for w in r['新词'].split(', '):
        if w: claimed[r['段']].add(w.lower())

WORD = re.compile(r"[A-Za-zÄÖÜäöüß]+")
lc = {}
def lem(tok):
    k = tok.lower()
    if k not in lc: lc[k] = {k, simplemma.lemmatize(tok, lang='de').lower(), simplemma.lemmatize(k, lang='de').lower()}
    return lc[k]
def lemmas(text):
    out = set()
    for t in WORD.findall(text): out |= lem(t)
    return out

WRITE = """你是德语母语的作者，给一款游戏写 B2 阅读文章，读者是在德国生活的中国人。Lucas 很讨厌 AI 味的德语，所以文章要像德国人真的会写、真的会发表的东西。
- 话题按给出的话题写（贴情境）；社会话题写成具体的日常层面的事，不写党派斗争和争议政治；体裁从德国真实存在的里选一种最合适的：地方报纸的小报道、杂志专栏、个人博客、市政或机构的信息页、论坛长帖、读者来信、广播稿等，写出这种体裁的样子（报道有具体的时间地点和引语，博客有个人口吻，信息页有实用信息）。
- 必须用到给出的全部词（可以变形，用最常见的意思）；用得自然，不要为了凑词硬塞。其他词以 B1–B2 常用词为主。
- 300–450 个词，2–5 段，有一个具体的小故事、事件或问题，不要泛泛而谈。人名地名可以虚构，但要普通（德国常见的名字和中等城市）。
- 不要 AI 套话：不要 in der heutigen Zeit / spielt eine wichtige Rolle / nicht zuletzt / insgesamt lässt sich sagen / Fazit 之类，不要排比，不要说教式总结结尾，不要每段都以总结句结束。不阴暗，不涉及暴力犯罪和政治争议。
- 给全文自然的简体中文翻译（分段对应）；3 道德语内容题，每题三个德语选项只有一个对，考理解，错项合理但明显错，选项长短相近。
只输出 JSON：{"title":"…","genre":"体裁（中文）","paras":["…"],"zh":["…"],"used":["用到的目标词原形"],"questions":[{"q":"…","qZh":"…","answer":"…","wrong":["…","…"]}]}"""

CHECK = """你是很挑剔的德国报刊编辑，审一篇给 B2 学习者读的原创德语文章（附中文、3 道题、指定词和表外词候选）。
1. 读起来像不像德国人写的真实文章：有没有翻译腔、AI 套话、生硬的搭配、凑词的痕迹、不合体裁的地方；语法是否完全正确。有问题就改（直接给改好的全文），改不好或通篇假就 drop。改的时候保留指定词。
2. 中文是否准确；每道题是否只有一个答案且能从文中找到依据。
3. 给表外词候选写注释：跳过人名、地名、机构名和缩写；每个真正的词给一个简单的德语释义（只用最常用的 2000 个德语词，10 个词以内）和中文意思，de 和 zh 都不超过 40 个字符。w 写文中出现的形式。
只输出 JSON：{"verdict":"ok 或 fix 或 drop","why":"简短中文","paras":[…],"zh":[…],"questions":[…],"gloss":[{"w":"…","de":"…","zh":"…"}]}（verdict 为 ok 时 paras/zh/questions 可省略）"""

usage = [0, 0]
def call(system, user, effort='low'):
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
                print('OpenAI balance used up: top up under Billing.'); sys.exit(3)
            print(f'HTTP {e.code}: {t}')
        except Exception as e:
            print(f'error: {e}')
        time.sleep(5 * (attempt + 1))
    return None

# Luna groups the open words (per segment and 情境, 70 at a time) into topics of 6–8 words that fit one everyday text.
PLAN = """下面是一串德语 B2 词（同一个大情境）。把它们分成若干组，每组 6–8 个词，每组配一个能自然用上这些词的具体话题——德国日常生活里的一件事（例如「市议会讨论新自行车道」「社区图书馆延长开放时间」「房东涨租后租客协会开会」），不要泛泛的大题目。社会话题写成具体的、日常层面的事，不写党派斗争和争议政治。尽量每个词都分进去；实在放不进的词放进 rest。
只输出 JSON：{"groups":[{"topic":"中文话题","words":["原形", …]}],"rest":["原形", …]}"""
by = defaultdict(list)
for r in b2:
    if r['原形'].lower() not in claimed[r['段']] and (not SEG or r['段'] in SEG): by[(r['段'], r['情境'])].append(r)
chunks = [(s, sit, rs[i:i + 70]) for (s, sit), rs in sorted(by.items()) for i in range(0, len(rs), 70)]
def plan_chunk(ch):
    s, sit, rs = ch
    info = {r['原形']: r for r in rs}
    res = call(PLAN, f"情境：{sit}\n" + ', '.join(f"{r['原形']}（{r['词性']}）" for r in rs)) or {}
    out, used = [], set()
    for g in res.get('groups') or []:
        ws = [w for w in g.get('words') or [] if w in info and w not in used]
        if len(ws) >= 4:
            used |= set(ws); out.append((s, sit, str(g.get('topic', '')).strip(), [info[w] for w in ws[:9]]))
            used -= set(ws[9:])
    rest = [r for r in rs if r['原形'] not in used]
    for i in range(0, len(rest), 7):
        if len(rest[i:i + 7]) >= 3: out.append((s, sit, '', rest[i:i + 7]))
    return out
groups = []
with ThreadPoolExecutor(6) as ex:
    for got in ex.map(plan_chunk, chunks): groups += got
if LIMIT and len(groups) > LIMIT:
    step = len(groups) / LIMIT; groups = [groups[int(i * step)] for i in range(LIMIT)]
print(f"{len(have)} articles so far; {sum(len(v) for v in by.values())} open words; writing {len(groups)} original articles", flush=True)

import random
FIRST = 'Anna Ben Clara David Emine Felix Greta Hannes Ida Jakob Katrin Lars Leonie Malte Nadine Ole Paula Rainer Selin Tobias Ulrike Vincent Wiebke Yusuf Zoe Birgit Dennis Elif Frank Heike Igor Jana Kai Lena Marco Nils Petra Ralf Sandra Timo Ute Wolfgang Aylin Bernd Carla Dirk Esra Gisela Henrik Inga'.split()
LAST = 'Albrecht Bauer Demir Ebert Fuchs Graf Hahn Jansen Kaiser Lorenz Möller Nowak Otto Pohl Roth Seidel Thiel Ulrich Vogel Winkler Yilmaz Ziegler Brandt Dietrich Engel Franke Günther Horn Jung Kraus Lange Marx Neumann Peters Richter Schulz Arnold Böhm Kühn Sommer'.split()
CITIES = 'Bielefeld Regensburg Kiel Erfurt Ulm Oldenburg Potsdam Würzburg Trier Rostock Heilbronn Gießen Paderborn Koblenz Jena Flensburg Ingolstadt Kassel Osnabrück Bamberg Lübeck Saarbrücken Wuppertal Halle Augsburg Freiburg Darmstadt Magdeburg Siegen Konstanz'.split()

def qs_ok(qs):
    out = []
    for q in qs or []:
        w = [str(x).strip().replace('｜', ' ') for x in q.get('wrong') or [] if str(x).strip()]
        a = str(q.get('answer', '')).strip().replace('｜', ' ')
        if q.get('q') and a and len(w) == 2 and a not in w:
            out.append({'q': str(q['q']).strip(), 'qZh': str(q.get('qZh', '')).strip(), 'answer': a, 'wrong': w})
    return out if len(out) == 3 else None

def work(g):
    s, sit, topic, rs = g
    tgt = [r['原形'] for r in rs]
    rnd = random.Random('|'.join(tgt))
    seed = f"如果需要人名，从这些里挑：{', '.join(rnd.sample(FIRST, 3))}；姓：{', '.join(rnd.sample(LAST, 3))}；如果需要城市：{rnd.choice(CITIES)}（也可以不写城市）\n"
    a = call(WRITE, seed + f"情境：{sit}\n话题：{topic or '自己选一个贴情境的具体日常话题'}\n目标词：" + ', '.join(f"{r['原形']}（{r['词性']}）" for r in rs), effort='medium')
    if not a: return ('bad', sit, None)
    paras = [str(p).strip().replace('｜', ' ') for p in a.get('paras') or [] if str(p).strip()]
    qs = qs_ok(a.get('questions'))
    if not paras or not qs: return ('bad', sit, None)
    text = ' '.join(paras)
    off = sorted({t for t in WORD.findall(text) if len(t) > 3 and not (lem(t) & known)})
    c = call(CHECK, f"体裁：{a.get('genre', '')}\n指定词：{', '.join(tgt)}\n标题：{a.get('title', '')}\n\n" + '\n\n'.join(paras) +
             '\n\n中文：\n' + '\n'.join(str(z) for z in a.get('zh') or []) + '\n\n题目：' + json.dumps(qs, ensure_ascii=False) +
             f"\n\n表外词候选：{', '.join(off)}", effort='medium')
    if not c or c.get('verdict') == 'drop': return ('drop', sit, (c or {}).get('why'))
    zh = a.get('zh') or []
    if c.get('verdict') == 'fix':
        p2 = [str(p).strip().replace('｜', ' ') for p in c.get('paras') or [] if str(p).strip()]
        if p2: paras = p2; text = ' '.join(paras)
        zh = c.get('zh') or zh
        qs = qs_ok(c.get('questions')) or qs
    L = lemmas(text)
    kept = [w for w in tgt if w.lower() in L]
    n = len(WORD.findall(text))
    if len(kept) < min(3, len(tgt)) or not 250 <= n <= 520: return ('few', sit, f'{len(kept)} words, {n} tokens')
    gloss = [{'w': str(x.get('w', '')).strip(), 'de': str(x.get('de', '')).strip(), 'zh': str(x.get('zh', '')).strip()}
             for x in c.get('gloss') or [] if x.get('w') and x.get('zh') and len(str(x.get('de', ''))) <= 40 and len(str(x['zh'])) <= 40]
    return ('ok', sit, {'段': s, '标题': str(a.get('title', '')).strip(), '例句': '｜'.join(paras),
            '例句中文': '｜'.join(str(z).strip() for z in zh), '新词': ', '.join(kept), '注释': json.dumps(gloss, ensure_ascii=False),
            '题目': json.dumps(qs, ensure_ascii=False), '词数': str(n), '来源': f"原创（{a.get('genre', '文章')}）", '网址': '', '修订号': '',
            '许可证': '', '改编说明': 'Luna 原创' + ('；审校修改' if c.get('verdict') == 'fix' else '')})

rows = list(have); stats = {}
with ThreadPoolExecutor(6) as ex:
    for k, (st, sit, row) in enumerate(ex.map(work, groups), 1):
        stats[st] = stats.get(st, 0) + 1
        if st == 'ok': rows.append({kk: re.sub(r'\s*[\r\n]+\s*', '｜', str(v)) for kk, v in row.items()})
        elif st in ('drop', 'few'): print(f'{st}: {sit}: {row}')
        if k % 20 == 0: print(f'{k}/{len(groups)}', flush=True)
n = {}
for r in rows:
    if r.get('id'): n[r['段']] = max(n.get(r['段'], 0), int(r['id'].rsplit('-', 1)[1]))
for r in rows:
    if not r.get('id'):
        n[r['段']] = n.get(r['段'], 0) + 1; r['id'] = f"b2o-{r['段']}-{n[r['段']]:03d}"
rows.sort(key=lambda r: r['id'])
with open(OUT, 'w', encoding='utf-8', newline='') as f:
    w = csv.DictWriter(f, fieldnames=COLS, delimiter='\t', lineterminator='\n'); w.writeheader(); w.writerows(rows)
segw = defaultdict(set)
for r in b2: segw[r['段']].add(r['原形'].lower())
cov = {s: len({x.lower() for r in rows if r['段'] == s for x in r['新词'].split(', ') if x}) for s in sorted(segw)}
print(f'{len(rows)} articles; this run: {stats}; words covered: ' + ', '.join(f'段{s} {cov[s]}/{len(segw[s])}' for s in sorted(segw)))
print(f'tokens: input {usage[0]}, output {usage[1]}')
