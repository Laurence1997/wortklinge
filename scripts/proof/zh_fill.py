#!/usr/bin/env python3
"""补中文 (2026-11-27, Lucas 选 2): example sentences of the B2 words (wortschatz.tsv 例句 / beispiele.tsv) that have no
Chinese yet. DeepSeek translates them for a Chinese learner living in Germany; the word the example is for is given so the
right sense is used. Output proof/out/zh-fill.jsonl (resumable, see dsrun.py); reviewed by hand before it goes in."""
import json, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import dsrun
ROOT = dsrun.ROOT
SYSTEM = """把德语例句译成自然的中文（中国大陆用法），读者是在德国生活、学德语的中国人。每行给出例句和它要教的词（w）及该词的中文释义（gloss）。
要求：按德国日常生活里的意思译，例句里那个词要按给出的释义译；不要按字面或英语去猜（Termin 是预约/约好的时间，不是约会；Chef 是老板；eventuell 是可能）。
句子本身有错或意思不通时照样译，并在 note 里说明。
输出 JSON：{"items":[{"id":"原样抄 id","zh":"中文翻译","note":"可选，句子本身的问题"}]}"""
rows = {}
for l in open(os.path.join(ROOT, 'data/wortschatz/wortschatz.tsv'), encoding='utf-8').read().split('\n')[1:]:
    c = l.split('\t')
    if len(c) > 13 and c[12] and not c[13]:
        rows.setdefault(c[12], (c[2], c[9]))
gloss = {}
for l in open(os.path.join(ROOT, 'data/wortschatz/wortschatz.tsv'), encoding='utf-8').read().split('\n')[1:]:
    c = l.split('\t')
    if len(c) > 9:
        gloss.setdefault(c[2], c[9])
for l in open(os.path.join(ROOT, 'data/wortschatz/beispiele.tsv'), encoding='utf-8').read().split('\n')[1:]:
    c = l.split('\t')
    if len(c) > 2 and c[1] and not c[2]:
        rows.setdefault(c[1], (c[0], gloss.get(c[0], '')))
items = [{'id': f'f{i}', 'de': de, 'w': w, 'gloss': g} for i, (de, (w, g)) in enumerate(sorted(rows.items()))]
json.dump(items, open(os.path.join(ROOT, 'proof/out/zh-fill-input.json'), 'w', encoding='utf-8'), ensure_ascii=False)
B = 30
batches = [(items[i]['de'][:60], '\n'.join(json.dumps(x, ensure_ascii=False) for x in items[i:i + B]), None) for i in range(0, len(items), B)]
dsrun.run('zh-fill', SYSTEM, batches, os.environ.get('ZH_MODEL', 'deepseek-v4-pro'), float(os.environ.get('ZH_FILL_BUDGET', '3')))
