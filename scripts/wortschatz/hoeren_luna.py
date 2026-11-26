"""听段题 texts (游戏设计「听力」, 34 级; Lucas 2026-11-26 按推荐: one passage per word from zone 4 on).

For every top-6000 word that is not a zone 1–3 word (build/zonen-1-3.tsv): a 2–4 sentence talk or announcement of at
most 50 words that uses the word, fits its 情境 (station announcement, doctor's call, voicemail, shop notice, two people
talking …), plus one German content question with three answers (one right). Luna writes it, then a second Luna pass
checks each passage (natural German a native speaker would say, the word used in the card's meaning, exactly one right
answer that the text supports, Chinese correct) and either keeps, fixes or drops it.

Output: data/wortschatz/hoeren-6000.tsv. Columns: 原形, 排名, 情境, 类型, 例句 (the text; speaker lines separated by
「｜」, two-person talks start lines with A: / B:), 例句中文, 问题, 问题中文, 答案, 错项1, 错项2, 例句出处.
The 例句 column lets the proofread workflow (LanguageTool + Luna) check the texts like every other sentence.
Maps onto src/data/passages.ts (Passage): lines = 例句 split at ｜, zh, q, qZh, answer, wrong = [错项1, 错项2].
Speed (×1.0 from 34, ×1.15 from 91) and 盲听 (built from beispiele-6000) are the game's side, not here.

Resumable: words already in the output are skipped. Env: OPENAI_API_KEY, MODEL (gpt-6-luna),
LIMIT (0 = all; a positive LIMIT takes a sample spread evenly over the ranks, for a trial).
"""
import csv, json, os, sys, time, urllib.request, urllib.error
from concurrent.futures import ThreadPoolExecutor

ROOT = os.path.join(os.path.dirname(__file__), '..', '..')
D = os.path.join(ROOT, 'data', 'wortschatz')
KEY = os.environ.get('OPENAI_API_KEY')
if not KEY:
    print('OPENAI_API_KEY is not set: skipping.'); sys.exit(0)
MODEL = os.environ.get('MODEL', 'gpt-6-luna')
LIMIT = int(os.environ.get('LIMIT') or 0)
OUT = os.path.join(D, 'hoeren-6000.tsv')
COLS = ['原形', '排名', '情境', '类型', '例句', '例句中文', '问题', '问题中文', '答案', '错项1', '错项2', '例句出处']

def tsv(p): return list(csv.DictReader(open(p, encoding='utf-8'), delimiter='\t')) if os.path.exists(p) else []
SMALL = {'介词', '代词', '冠词', '连词', '小品词', '感叹词'}  # function words are not monsters
early = {r['原形'] for r in tsv(os.path.join(D, 'build', 'zonen-1-3.tsv'))}
words, seen = [], set()
for r in tsv(os.path.join(D, 'wortschatz.tsv')):
    if int(r['排名']) <= 6000 and r['原形'] not in seen and r['原形'] not in early and r['词性'] not in SMALL:
        seen.add(r['原形']); words.append(r)
ex = {}
for r in tsv(os.path.join(D, 'beispiele-6000.tsv')):
    ex.setdefault(r['原形'], []).append(r['例句'])
done = {r['原形'] for r in tsv(OUT)}
todo = [r for r in words if r['原形'] not in done]
if LIMIT and len(todo) > LIMIT:
    step = len(todo) / LIMIT
    todo = [todo[int(i * step)] for i in range(LIMIT)]
print(f'{len(words)} words from zone 4 on, {len(done)} done, sending {len(todo)}')

WRITE = """你是德语母语的编辑，给一款教在德国的中国人学德语的游戏写听力小段（玩家只听不看，用电脑语音朗读）。
每个词给了词卡、词频排名（1001–3000 约 A2，3001–6000 约 B1）、情境、已有例句。每个词写 1 段：
- 2–4 句，总共不超过 50 个词，必须用到这个词（用词卡的意思，可以变形），内容是德国日常生活里真的会听到的：车站或车上广播、医生诊所或房东的电话留言、商店或单位的通知、两个人的简短对话（每句前写 A: 或 B:）等。场合贴这个词的情境，话题多样。
- 其他词要比这个词更常用（A2 词配 A1–A2 的词，B1 词最多到 B1）；不用生僻人名地名，不用数字以外的缩写，数字写成阿拉伯数字也行但别多。不阴暗、不奇怪。
- 一道德语问题（问内容：谁、什么时候、在哪儿、要做什么、为什么），三个德语选项，只有一个对，答案要靠听懂才能选；错项是段里提到过但不对的信息或合理的干扰项；三个选项长短相近；不要直接考这个词怎么拼。
- 给全段自然的简体中文翻译和问题的中文。
type 填 广播 / 留言 / 通知 / 对话 / 其他。
只输出 JSON：{"r":[{"w":"原形","type":"对话","lines":["A: …","B: …"],"zh":"…","q":"…","qZh":"…","answer":"…","wrong":["…","…"]}]}"""

CHECK = """你是严格的德语母语审校，审一款游戏里给中国人学德语用的听力小段（只听不看）。逐段检查：
1. 德语是否完全正确、自然，是德国人在这个场合真的会说的话（不是翻译腔）；
2. 是否用到了指定的词，且用的是词卡的意思；
3. 问题是否只有一个正确答案，且答案能从段里听出来；错项是否明确是错的；
4. 中文翻译是否准确自然。
能改好就改（给出改好的完整一段），改不好就丢弃。
只输出 JSON：{"r":[{"n":序号,"verdict":"ok 或 fix 或 drop","why":"简短中文原因（ok 可空）","lines":[…],"zh":"…","q":"…","qZh":"…","answer":"…","wrong":["…","…"]}]}（verdict 为 ok 时可只给 n 和 verdict）"""

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
            return json.loads(txt[txt.find('{'):txt.rfind('}') + 1])['r']
        except urllib.error.HTTPError as e:
            t = e.read().decode()[:300]
            if 'insufficient_quota' in t:
                print('OpenAI balance used up: top up under Billing.'); sys.exit(3)
            print(f'HTTP {e.code}: {t}')
        except Exception as e:
            print(f'error: {e}')
        time.sleep(5 * (attempt + 1))
    return None

def clean(x):
    lines = [str(l).strip().replace('｜', ' ') for l in x.get('lines') or [] if str(l).strip()]
    wrong = [str(w).strip() for w in x.get('wrong') or [] if str(w).strip()]
    ans = str(x.get('answer', '')).strip()
    if not 2 <= len(lines) <= 4 or len(wrong) != 2 or not ans or ans in wrong or not x.get('q') or not x.get('zh'): return None
    if len(' '.join(lines).split()) > 60: return None
    return {'lines': lines, 'zh': str(x['zh']).strip(), 'q': str(x['q']).strip(), 'qZh': str(x.get('qZh', '')).strip(),
            'answer': ans, 'wrong': wrong}

def work(batch):
    user = []
    for r in batch:
        user.append(f"## {r['原形']} | 排名 {r['排名']} | 词卡：{r['卡片']} | {r['词性']} | {r['中文']} | 情境：{r['情境']}")
        for e in ex.get(r['原形'], [])[:2]: user.append(f'例句：{e}')
    res = call(WRITE, '\n'.join(user)) or []
    got = {x.get('w'): x for x in res}
    items = []
    for r in batch:
        x = got.get(r['原形'])
        c = clean(x) if x else None
        if c: items.append((r, str(x.get('type', '其他')).strip() or '其他', c))
    if not items: return []
    chk = []
    for n, (r, t, c) in enumerate(items, 1):
        chk.append(f"## {n} | 词：{r['原形']}（{r['中文']}）| 词卡：{r['卡片']}\n" + '\n'.join(c['lines']) +
                   f"\n中文：{c['zh']}\n问题：{c['q']}（{c['qZh']}）\n答案：{c['answer']}\n错项：{c['wrong'][0]}；{c['wrong'][1]}")
    verdicts = {int(v['n']): v for v in (call(CHECK, '\n\n'.join(chk)) or []) if str(v.get('n', '')).isdigit()}
    out = []
    for n, (r, t, c) in enumerate(items, 1):
        v = verdicts.get(n)
        if not v: continue  # not checked: retried next run
        if v.get('verdict') == 'drop': continue
        src = 'Luna 写'
        if v.get('verdict') == 'fix':
            f = clean(v)
            if not f: continue
            c = f; src = 'Luna 写（审校改）'
        out.append([r['原形'], r['排名'], r['情境'], t, '｜'.join(c['lines']), c['zh'], c['q'], c['qZh'], c['answer'],
                    c['wrong'][0], c['wrong'][1], src])
    return out

new = not os.path.exists(OUT)
f = open(OUT, 'a', encoding='utf-8', newline='')
wr = csv.writer(f, delimiter='\t', lineterminator='\n')
if new: wr.writerow(COLS)
SIZE = 10
batches = [todo[i:i + SIZE] for i in range(0, len(todo), SIZE)]
kept = 0
with ThreadPoolExecutor(6) as pool:
    for k, rows in enumerate(pool.map(work, batches), 1):
        wr.writerows(rows); f.flush(); kept += len(rows)
        if k % 20 == 0 or k == len(batches): print(f'{k}/{len(batches)} batches, kept {kept}', flush=True)
f.close()

order = {r['原形']: i for i, r in enumerate(words)}
rows = tsv(OUT); rows.sort(key=lambda r: order.get(r['原形'], 1e9))
with open(OUT, 'w', encoding='utf-8', newline='') as fo:
    w = csv.DictWriter(fo, fieldnames=COLS, delimiter='\t', lineterminator='\n'); w.writeheader(); w.writerows(rows)
print(f"{len(rows)} passages for {len(words)} words; fixed by the check {sum(1 for r in rows if '审校改' in r['例句出处'])}")
print(f'tokens: input {usage[0]}, output {usage[1]}')
