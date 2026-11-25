#!/usr/bin/env python3
"""Import the edited word list (xlsx) back into the repo.

Usage:  python3 scripts/wortschatz_import.py 德语常用词-8000.xlsx
Writes: data/wortschatz/wortschatz.tsv (all rows of the first two sheets, re-ranked in sheet order);
        if the sheet 全部例句 is there, also data/wortschatz/beispiele-6000.tsv, and each word's 序号 1 sentence
        becomes its 例句 in wortschatz.tsv and beispiele.tsv.
Needs:  pip install openpyxl

Rules: column headers must stay as they are. Rows can be deleted, added or edited.
Rows are ranked by their order in the sheets (sheet 1 first), so moving a row moves its rank.
Rows with an empty 原形 are skipped. Duplicate 原形+词性 keeps the first.
"""
import sys, csv, os
from openpyxl import load_workbook

COLS = ['排名','卡片','原形','冠词','复数','属格(仅不规则)','动词三形','比较级(仅不规则)','词性','中文','标签','游戏里已有','例句','例句中文','例句出处','来源','备注']
OPTIONAL = ['词族','近义词组','语体','先后','情境','功能线','宿主情境','场景','类别','专属造型','形近词','德语释义']  # newer columns; an older xlsx without them still imports
OUT = os.path.join(os.path.dirname(__file__), '..', 'data', 'wortschatz', 'wortschatz.tsv')

def main(path):
    wb = load_workbook(path, read_only=True)
    rows, seen = [], set()
    for ws in wb.worksheets[:2]:
        it = ws.iter_rows(values_only=True)
        head = [str(h).strip() if h is not None else '' for h in next(it)]
        missing = [c for c in COLS if c not in head]
        if missing:
            sys.exit(f'{ws.title}: 缺列 {missing}，请不要改列名')
        idx = {c: head.index(c) for c in COLS + OPTIONAL if c in head}
        for r in it:
            get = lambda c: ('' if c not in idx or r[idx[c]] is None else str(r[idx[c]]).strip())
            lemma = get('原形')
            if not lemma:
                continue
            key = (lemma, get('词性'))
            if key in seen:
                print('重复，跳过:', lemma, get('词性'))
                continue
            seen.add(key)
            rows.append({c: get(c) for c in COLS + OPTIONAL})
    for i, r in enumerate(rows, 1):
        r['排名'] = str(i)
    if '全部例句' in wb.sheetnames:
        it = wb['全部例句'].iter_rows(values_only=True)
        head = [str(h).strip() if h is not None else '' for h in next(it)]
        bc = ['原形', '序号', '例句', '例句中文', '例句出处', '义项', '搭配']
        if [c for c in bc if c not in head]:
            sys.exit('全部例句: 缺列，请不要改列名')
        ex = []
        for r in it:
            d = {c: ('' if r[head.index(c)] is None else str(r[head.index(c)]).strip()) for c in bc}
            if d['原形'] and d['例句']: ex.append(d)
        with open(os.path.join(os.path.dirname(OUT), 'beispiele-6000.tsv'), 'w', encoding='utf-8', newline='') as f:
            w = csv.DictWriter(f, fieldnames=bc, delimiter='\t', lineterminator='\n'); w.writeheader(); w.writerows(ex)
        first = {d['原形']: d for d in ex if d['序号'] == '1'}
        for r in rows:
            d = first.get(r['原形'])
            if d:
                for c in ('例句', '例句中文', '例句出处'): r[c] = d[c]
        bp = os.path.join(os.path.dirname(OUT), 'beispiele.tsv')
        old = list(csv.DictReader(open(bp, encoding='utf-8'), delimiter='\t')) if os.path.exists(bp) else []
        for o in old:
            d = first.get(o['原形'])
            if d:
                for c in ('例句', '例句中文', '例句出处'): o[c] = d[c]
        with open(bp, 'w', encoding='utf-8', newline='') as f:
            w = csv.DictWriter(f, fieldnames=['原形', '例句', '例句中文', '例句出处'], delimiter='\t', lineterminator='\n'); w.writeheader(); w.writerows(old)
        print(f'{len(ex)} 句例句 → beispiele-6000.tsv')
    with open(OUT, 'w', encoding='utf-8', newline='') as f:
        w = csv.DictWriter(f, fieldnames=COLS + OPTIONAL, delimiter='\t', lineterminator='\n')
        w.writeheader(); w.writerows(rows)
    print(f'{len(rows)} 行 → {os.path.normpath(OUT)}（前 6000 = 游戏词）')

if __name__ == '__main__':
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    main(sys.argv[1])
