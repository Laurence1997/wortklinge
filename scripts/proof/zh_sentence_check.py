#!/usr/bin/env python3
"""中文翻译排查 (2026-11-27): DeepSeek reads every German sentence that has a Chinese translation (proof/out/sentences.json
from scripts/proof/extract.ts; articles over 600 characters are skipped, they were checked paragraph by paragraph before)
and reports only meaning errors: a word translated with the wrong sense (Termin → 约会), false friends, wrong numbers,
times, negation or person. Style is ignored. Report only: proof/out/zh-sentences.jsonl (saved per batch, resumable; see dsrun.py). Key: DEEPSEEK_API_KEY."""
import json, os, sys
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
MODEL = os.environ.get('ZH_MODEL', 'deepseek-v4-pro')
KEY = os.environ['DEEPSEEK_API_KEY']
SYSTEM = """你在审校德语学习游戏的中文翻译，读者是在德国生活的中国人。每行是一个德语句子和它的中文翻译。
只报「意思错了」的翻译：
- 某个德语词译错了义项，或按字面/假朋友译错（例：Termin 译成「约会」——在德国 Termin 是预约、约好的时间，只有约朋友/恋爱才是约会；Chef 译成厨师；eventuell 译成最终；bekommen 译成变成；Kasse 在医保语境译成钱箱；Stelle 指职位却译成地方）。
- 数字、时间、日期、否定、人称、主语宾语弄反、漏译了影响理解的关键信息。
- 在德国生活场景里明显不对的说法（例：Bürgeramt 译成派出所，Hausverwaltung 译成房东，Nebenkosten 译成额外费用而不是房租杂费/附加费）。
不要报：文风、语序、可以更好但意思没错的翻译、德语本身的语法问题、只是意译。
输出 JSON：{"items":[{"id":"原样抄行首的 id","problem":"一句中文说明哪个词错在哪","fix":"改好的完整中文翻译"}]}，没有问题输出 {"items":[]}。"""
S = json.load(open(os.path.join(ROOT, 'proof/out/sentences.json'), encoding='utf-8'))
items = [s for s in S if s.get('zh') and len(s['text']) <= 600 and s.get('kind') not in ('word', 'plural')]
LIMIT = int(os.environ.get('ZH_LIMIT', '0') or 0)
if LIMIT: items = items[:LIMIT]
B = 40
# Batch ids are the first sentence id of each batch, so a resumed run (same sentences.json) skips finished batches.
batches = []
for i in range(0, len(items), B):
    b = items[i:i + B]
    user = '\n'.join(json.dumps({'id': s['id'], 'de': s['text'], 'zh': s['zh']}, ensure_ascii=False) for s in b)
    batches.append((b[0]['id'], user, None))
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import dsrun
dsrun.run('zh-sentences', SYSTEM, batches, MODEL, float(os.environ.get('ZH_BUDGET', '26')))
