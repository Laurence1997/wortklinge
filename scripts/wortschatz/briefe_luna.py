"""失语者的遗书 for 1.0 (1.0-范围清单「五、剧情」; 游戏设计「剧情：遗书真相」, Lucas 2026-11-25).

5 letters per zone for zones 4–20 (85). Written by ordinary people who slowly lose their language after the collapse;
one letter per zone is from the archivist Ilse Lehmann, whose line leads to the truth revealed in zone 17 (the archive's
「perfect dictionary」 project: every word one meaning, one form, no mistakes, no change; it opened the rift the Silence
came through; the Order is what is left of the project; the System is the dictionary's engine). Before 17 her letters
only hint. Each letter uses words of its zone (by 情境 and rank band; zones 13–16 the B2 segment words) and the zone's
grammar, at the zone's level.

Lucas finds AI-written German too obviously AI, so the prompt asks for plain, concrete, personal letters, and a second
Luna pass checks naturalness (like a real person's note), correctness, level, and fixes or rewrites.

Steps: 1. one call writes the outline (who writes each letter, what it tells, what Ilse reveals per zone);
2. per zone one call writes the 5 letters; 3. per zone one check call.
Output: data/wortschatz/briefe-1.0.tsv. Columns: id, 区, 序号, 写信人, 主线, 标题, 例句 (the letter, paragraphs joined
by ｜; the proofread workflow checks it), 例句中文, 本区词, 语法, 线索, 例句出处. build/briefe-outline.json keeps the outline.
Resumable per zone. Env: OPENAI_API_KEY, MODEL (gpt-6-luna).
"""
import csv, json, re, os, sys, time, urllib.request, urllib.error
from concurrent.futures import ThreadPoolExecutor

ROOT = os.path.join(os.path.dirname(__file__), '..', '..')
D = os.path.join(ROOT, 'data', 'wortschatz')
KEY = os.environ.get('OPENAI_API_KEY')
if not KEY:
    print('OPENAI_API_KEY is not set: skipping.'); sys.exit(0)
MODEL = os.environ.get('MODEL', 'gpt-6-luna')
OUT = os.path.join(D, 'briefe-1.0.tsv')
OUTLINE = os.path.join(D, 'build', 'briefe-outline.json')
COLS = ['id', '区', '序号', '写信人', '主线', '标题', '例句', '例句中文', '本区词', '语法', '线索', '例句出处']

# zone: (name, levels, CEFR, theme, 情境 for its words or B2 segment, grammar, words per letter)
Z = {
    4: ('租屋城 Mietshausen', '31–40', 'A2', '住房、家具、办手续', ['住房家具', '办手续'], '双向介词 wo/wohin（stellen/stehen, legen/liegen）、woher；双宾语顺序', '60–90'),
    5: ('泉疗镇 Heilbrunn', '41–50', 'A2', '身体、健康、看医生', ['身体看病'], '比较级和最高级（als/wie）；形容词词尾；语气词 mal/doch；deshalb/trotzdem', '60–90'),
    6: ('雾港 Nebelhafen', '51–60', 'A2', '旅行、天气、度假', ['旅行天气自然', '交通'], 'wenn 条件句；weil/dass 从句', '70–100'),
    7: ('粉笔原 Kreidefeld', '61–70', 'A2', '学校、学习', ['通用', '讨论说理'], '情态动词过去时 konnte/musste/wollte；als/wenn', '70–100'),
    8: ('钟楼城 Uhrstadt', '71–80', 'A2', '作息、爱好、讲过去的事', ['作息爱好'], '过去时综合：现在完成时加过去时', '80–110'),
    9: ('工坊城 Werkhalle', '81–90', 'B1', '求职、职场', ['求职职场'], '被动过去式 wurde + 第二分词；过去完成时 + nachdem/bevor', '100–140'),
    10: ('电波塔 Funkturm', '91–100', 'B1', '媒体、新闻、科技', ['媒体科技', '新闻社会'], '间接疑问句 ob / w-；将来时 werden + 推测；属格介词 wegen/während', '100–140'),
    11: ('林底 Waldgrund', '101–110', 'B1', '自然、环境、动物', ['旅行天气自然'], '关系从句；第一分词作形容词；形容词名词化', '100–140'),
    12: ('心巷 Herzgasse', '111–120', 'B1', '人际关系、情感', ['人际情感'], 'zu 不定式、um…zu / damit、obwohl；entweder…oder / weder…noch', '110–150'),
    13: ('议会堡', '121–130', 'B2', '市政、报刊、大学、观点', '13', '第一虚拟式间接引语；功能动词结构', '150–200'),
    14: ('铸币场', '131–140', 'B2', '交易所、商场废墟、金钱、消费、环境', '14', '被动替代 sein + zu、sich lassen、-bar；属格介词 aufgrund/trotz/innerhalb', '150–200'),
    15: ('蚀变③林底', '141–150', 'B2', '4–7 区旧地方蚀变后：住房、身体、旅行、自然', '15', '方位副词 hin/her、oben/unten；情态动词主观用法 soll/will/muss … haben', '150–200'),
    16: ('面具剧场', '151–160', 'B2', '后台、博物馆、实验室、文化艺术科学', '16', '扩展分词定语 der von ihm geschriebene Brief；名词化文体', '150–200'),
    17: ('档案深处', '161–170', 'C1', '地下档案室、旧报库、纪念碑园：被抹去的历史', None, '过去时虚拟式和 als ob；学术连接词 sofern/indem/wohingegen', '180–240'),
    18: ('天平庭', '171–180', 'C1', '法庭、图书馆、废弃哲学系', None, '让步和论证 wenngleich / zwar … aber / einerseits … andererseits；习语', '180–240'),
    19: ('蚀变④回潮', '181–190', 'C1', '8–12 区旧地方蚀变后：工作、媒体、自然、人际', None, '语域转换；复杂名词化和分词结构', '180–240'),
    20: ('沉默之心', '191–200', 'C1', '失语的城市、回声走廊、开场的篝火', None, '修辞和演讲结构', '180–240'),
}

def tsv(p): return list(csv.DictReader(open(p, encoding='utf-8'), delimiter='\t')) if os.path.exists(p) else []
early = {r['原形'] for r in tsv(os.path.join(D, 'build', 'zonen-1-3.tsv'))}
wl = [r for r in tsv(os.path.join(D, 'wortschatz.tsv')) if int(r['排名']) <= 6000 and r['原形'] not in early]
b2 = tsv(os.path.join(D, 'build', 'b2-v1.tsv'))
def zone_words(z):
    name, lv, cefr, theme, sit, gram, ln = Z[z]
    if sit is None: return []
    if isinstance(sit, str): return [r['原形'] for r in b2 if r['段'] == sit][:120]
    lo, hi = (1, 3000) if cefr == 'A2' else (3001, 6000)
    return [r['原形'] for r in wl if r['情境'] in sit and lo <= int(r['排名']) <= hi][:120]

STORY = """背景（游戏「失语纪元」）：一场「崩塌」后，「沉默」从裂缝里进来，人们慢慢失去语言：先是忘词，再是说不出整句，最后只剩沉默。玩家是能重生的主角，靠「系统」找回词。地图上散落「失语者的遗书」：崩塌后慢慢失语的普通人写给家人、朋友、邻居或自己的信和便条。
主线：档案馆的档案员 Ilse Lehmann，每区 1 封，从 4 区到 20 区。真相在 17 区揭开：崩塌前，档案馆的一个项目想把语言整理成一部「完美的词典」：每个词只有一个意思、一种说法，不允许错和变化。项目开了裂缝，沉默从里面进来。「秩序会」是这个项目的残部（Frau Weber 是秩序会的人，18 区面临选择）。「系统」是那部词典的引擎，它帮人找回名字，但它自己的目标是「完成词典」，也就是另一种沉默。系统提示里的错字是它和沉默相连的痕迹。林远（游戏里的同伴）见过系统的另一面。17 区之前 Ilse 只能暗示（她参与过一个项目、她后悔、她在整理卡片、她发现词条在消失……），不能说破；17 区说清；18–20 区写后果和她最后的话。最终主题：活的语言允许错、允许不同的说法。"""

OUTLINE_SYS = STORY + """
请写 4–20 区遗书的大纲，每区 5 封（序号 1–5，其中 1 封是 Ilse，位置随意）。其他写信人是各种普通人（房东、护士、渔夫、老师、学生、钟表匠、工人、记者、护林员、恋人、议员、商人、演员……），贴本区主题；有几位可以跨区再出现。每封写：写信人、写给谁、讲什么具体的事、失语到什么程度、带出的线索（可空）。不要阴暗血腥，悲伤但克制，偶尔有温暖和幽默。
只输出 JSON：{"zones":{"4":[{"n":1,"who":"…","to":"…","plot":"…","clue":"…","ilse":false}],"5":[…]}}"""

WRITE_SYS = STORY + """
你是德语母语作家。按大纲写本区 5 封信。要求：
- 像真人写的信或便条：具体的小事、真实的细节和名字（德国常见名），口吻各不相同（有人写得工整，有人写得匆忙）；不用套话和华丽比喻，不说教，不要「AI 味」的句式（例如「这不仅仅是…而是…」、成串的形容词、总结式结尾）。
- 德语完全正确、地道，难度符合本区级别；必须自然地用上本区语法（每封至少一两处），多用本区词表里的词（每封至少 5 个，可变形）；其他词不比本区级别难。
- 失语可以体现在内容上（写信人说他忘了某个词、找不到说法、用简单的话绕过去），但句子本身要正确。
- 每封给标题（德语，短）、正文分 1–4 段、自然的简体中文翻译（分段对应）、用到的本区词（原形）、用到的语法、线索（中文一句，没有就空）。
只输出 JSON：{"r":[{"n":1,"who":"写信人（德语名字＋中文身份）","title":"…","paras":["…"],"zh":["…"],"words":["…"],"grammar":"…","clue":"…"}]}"""

CHECK_SYS = """你是严格的德语母语编辑，审一款德语学习游戏里的「遗书」（崩塌后慢慢失语的普通人写的信）。逐封检查：
1. 德语完全正确；2. 读起来像真人写的，不像 AI（套话、空泛抒情、过度修辞、说教、总结式结尾都算问题）；3. 难度符合标注的级别，用上了标注的语法；4. 中文翻译准确自然。
有问题就改（给出改好的整封：paras 和 zh），改动尽量小；整封都不行就重写。没问题写 ok。
只输出 JSON：{"r":[{"n":1,"verdict":"ok 或 fix","why":"简短中文","paras":[…],"zh":[…]}]}"""

usage = [0, 0]
def call(system, user, effort='low'):
    body = json.dumps({'model': MODEL, 'reasoning_effort': effort, 'response_format': {'type': 'json_object'},
                       'messages': [{'role': 'system', 'content': system}, {'role': 'user', 'content': user}]}).encode()
    for attempt in range(5):
        try:
            req = urllib.request.Request('https://api.openai.com/v1/chat/completions', body,
                                         {'Content-Type': 'application/json', 'Authorization': 'Bearer ' + KEY})
            with urllib.request.urlopen(req, timeout=600) as r:
                j = json.load(r)
            usage[0] += j.get('usage', {}).get('prompt_tokens', 0); usage[1] += j.get('usage', {}).get('completion_tokens', 0)
            txt = j['choices'][0]['message']['content']
            return json.loads(txt[txt.find('{'):txt.rfind('}') + 1])
        except urllib.error.HTTPError as e:
            t = e.read().decode()[:300]
            if 'insufficient_quota' in t:
                print('OpenAI balance used up: top up under Billing.'); sys.exit(3)
            if e.code == 400 and 'reasoning_effort' in t and effort != 'low':
                effort = 'low'; body = body.replace(b'"medium"', b'"low"')
            print(f'HTTP {e.code}: {t}')
        except Exception as e:
            print(f'error: {e}')
        time.sleep(5 * (attempt + 1))
    return None

if os.path.exists(OUTLINE):
    outline = json.load(open(OUTLINE, encoding='utf-8'))
else:
    desc = '\n'.join(f'{z} 区 {v[0]}（{v[1]} 级，{v[2]}）：{v[3]}；语法：{v[5]}' for z, v in Z.items())
    o = call(OUTLINE_SYS, desc, 'medium')
    if not o or 'zones' not in o: print('outline failed'); sys.exit(1)
    outline = o['zones']
    os.makedirs(os.path.dirname(OUTLINE), exist_ok=True)
    json.dump(outline, open(OUTLINE, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)

have = tsv(OUT)
done = {int(r['区']) for r in have}

def zone(z):
    name, lv, cefr, theme, sit, gram, ln = Z[z]
    plan = outline.get(str(z)) or []
    if len(plan) < 5: return []
    words = zone_words(z)
    prev = outline.get(str(z - 1)) or []
    user = (f'{z} 区 {name}（{lv} 级，{cefr}），主题：{theme}\n本区语法：{gram}\n每封 {ln} 个词\n'
            f"本区词表（挑着用）：{', '.join(words) if words else '（C1 不加新词，用前面学过的词，按主题选）'}\n\n"
            f"上一区 Ilse 的信讲到：{next((p.get('plot', '') for p in prev if p.get('ilse')), '（这是第一封）')}\n\n大纲：\n" +
            '\n'.join(f"{p.get('n')}. {p.get('who')} → {p.get('to')}：{p.get('plot')}（线索：{p.get('clue') or '无'}）{' [Ilse]' if p.get('ilse') else ''}" for p in plan))
    w = call(WRITE_SYS, user, 'medium')
    letters = [x for x in (w or {}).get('r', []) if x.get('paras') and x.get('zh')]
    if len(letters) < 5: return []
    chk = '\n\n'.join(f"## {i} | 级别 {cefr} | 语法：{gram}\n" + '\n'.join(x['paras']) + '\n中文：\n' + '\n'.join(x['zh'])
                      for i, x in enumerate(letters, 1))
    v = {int(c['n']): c for c in (call(CHECK_SYS, chk) or {}).get('r', []) if str(c.get('n', '')).isdigit()}
    if not v: return []
    rows = []
    for i, x in enumerate(letters[:5], 1):
        c = v.get(i, {}); src = 'Luna 写'
        paras, zh = x['paras'], x['zh']
        if c.get('verdict') == 'fix' and c.get('paras'):
            paras, zh = c['paras'], c.get('zh') or zh; src = 'Luna 写（审校改）'
        p = plan[i - 1] if i <= len(plan) else {}
        rows.append({'id': f'brief-{z:02d}-{i}', '区': str(z), '序号': str(i), '写信人': str(x.get('who', '')).strip(),
                     '主线': 'Ilse' if p.get('ilse') or 'Ilse' in str(x.get('who', '')) else '', '标题': str(x.get('title', '')).strip(),
                     '例句': '｜'.join(str(s).strip().replace('｜', ' ') for s in paras), '例句中文': '｜'.join(str(s).strip() for s in zh),
                     '本区词': ', '.join(x.get('words') or []), '语法': str(x.get('grammar', '')).strip(), '线索': str(x.get('clue', '')).strip(),
                     '例句出处': src})
    return rows

todo = [z for z in Z if z not in done]
print(f'{len(done)} zones done, writing {len(todo)}')
rows = list(have)
with ThreadPoolExecutor(6) as ex:
    for z, rs in zip(todo, ex.map(zone, todo)):
        print(f'zone {z}: {len(rs)} letters', flush=True)
        rows += [{k: re.sub(r'\s*[\r\n]+\s*', '｜', str(v)) for k, v in r.items()} for r in rs]
rows.sort(key=lambda r: r['id'])
with open(OUT, 'w', encoding='utf-8', newline='') as f:
    w = csv.DictWriter(f, fieldnames=COLS, delimiter='\t', lineterminator='\n'); w.writeheader(); w.writerows(rows)
print(f"{len(rows)} letters; fixed by the check {sum(1 for r in rows if '审校改' in r['例句出处'])}")
print(f'tokens: input {usage[0]}, output {usage[1]}')
