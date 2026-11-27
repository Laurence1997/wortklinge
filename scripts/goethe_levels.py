"""Tag each lemma of data/wortschatz/wortschatz.tsv with the lowest Goethe-Zertifikat word list (A1, A2, B1) it appears in.

Inputs are the Goethe-Institut word list PDFs turned into text with `pdftotext -layout` (not kept in the repo):
    A1_SD1_Wortliste_02.pdf, Goethe-Zertifikat_A2_Wortliste.pdf, Goethe-Zertifikat_B1_Wortliste.pdf
    from https://www.goethe.de/pro/relaunch/prf/de/
A lemma counts as on a list when the word occurs anywhere in it (headword or example), so the tag is a lower bound.
Blank = on none of the three (B2 or later). Used by the 入学测试 and by the 推后 check (Lucas 2026-11-27).

    python3 scripts/goethe_levels.py A1.txt A2.txt B1.txt
"""
import csv
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / 'data' / 'wortschatz'


def main():
    found = {}
    for level, path in zip(('A1', 'A2', 'B1'), sys.argv[1:4]):
        text = Path(path).read_text(encoding='utf-8').replace('-\n', '')
        for tok in re.findall(r'[A-Za-zÄÖÜäöüß]+', text):
            found.setdefault(tok.lower(), level)
    rows = list(csv.DictReader((DATA / 'wortschatz.tsv').open(encoding='utf-8'), delimiter='\t'))
    out = ['原形\tGoethe']
    seen = set()
    for r in rows:
        de = r['原形'].strip()
        if de in seen:
            continue
        seen.add(de)
        out.append(f"{de}\t{'' if ' ' in de else found.get(de.lower(), '')}")
    (DATA / 'goethe-stufe.tsv').write_text('\n'.join(out) + '\n', encoding='utf-8')
    print(len(out) - 1, 'lemmas')


if __name__ == '__main__':
    main()
