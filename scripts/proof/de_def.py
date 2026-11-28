#!/usr/bin/env python3
"""德语释义 (Lucas 2026-11-28 选 1): one short German definition for each word ranked 6001–8000 (B2, Lv121+), written with
the top-2000 words only. DeepSeek drafts them into proof/out/de-def.jsonl (resumable, see dsrun.py); every one is reviewed
by hand before it goes into the 德语释义 column of wortschatz.tsv."""
import json, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import dsrun
ROOT = dsrun.ROOT
rows = [l.split('\t') for l in open(os.path.join(ROOT, 'data/wortschatz/wortschatz.tsv'), encoding='utf-8').read().split('\n')[1:] if l]
head = open(os.path.join(ROOT, 'data/wortschatz/wortschatz.tsv'), encoding='utf-8').readline().rstrip('\n').split('\t')
I = {h: i for i, h in enumerate(head)}
basic = [r[I['原形']] for r in rows if r[I['排名']].isdigit() and int(r[I['排名']]) <= 2000]
SYSTEM = """Du schreibst Worterklärungen auf Deutsch für ein Lernspiel. Die Spieler sind Chinesen, die in Deutschland leben und Deutsch auf Niveau B1–B2 lernen.
Für jedes Wort: genau EINE kurze Erklärung, wie in einem Lernerwörterbuch (Langenscheidt Großwörterbuch DaF), höchstens 12 Wörter.
Regeln:
- Benutze NUR einfache Wörter aus der Liste unten (Grundwortschatz, auch ihre Formen: Plural, konjugiert, dekliniert) und Funktionswörter (Artikel, Pronomen, Präpositionen, Konjunktionen). Wenn es gar nicht anders geht, höchstens ein anderes sehr bekanntes Wort.
- Das Wort selbst und Wörter aus derselben Wortfamilie dürfen NICHT vorkommen (für Röhre nicht „Rohr“, für Verkäuferin nicht „verkaufen“).
- Erkläre die Bedeutung, die zur chinesischen Übersetzung (zh) und zum Beispielsatz passt, so wie man das Wort im Alltag in Deutschland benutzt.
- Nomen: ohne Artikel am Anfang, z. B. „Geld, das man dem Vermieter am Anfang gibt“, „Person, die …“, „Ort, an dem …“.
- Verben: als Infinitivgruppe, z. B. „etwas sehr genau prüfen“, „sich über etwas ärgern“ (reflexiv mit sich).
- Adjektive/Adverbien: kurze Umschreibung, z. B. „so, dass man es nicht sehen kann“, „sehr müde“.
- Kein Chinesisch, kein Englisch, keine Synonymliste mit Kommas als einzige Erklärung.
- Wenn das Wort ein Eigenname oder Ortsname ist oder man es nicht sinnvoll einfach erklären kann, schreib trotzdem eine Erklärung und setze "flag" mit einem kurzen Grund.
Ausgabe JSON: {"items":[{"id":"id genau kopieren","def":"Erklärung","flag":"optional"}]}

Grundwortschatz (nur diese Wörter benutzen):
""" + ', '.join(basic)
items = []
for r in rows:
    if r[I['排名']].isdigit() and 6000 < int(r[I['排名']]) <= 8000:
        items.append({'id': r[I['排名']], 'w': r[I['原形']], 'art': r[I['冠词']], 'pos': r[I['词性']], 'zh': r[I['中文']], 'ex': r[I['例句']]})
B = 40
batches = [('d' + items[i]['id'], '\n'.join(json.dumps(x, ensure_ascii=False) for x in items[i:i + B]), None) for i in range(0, len(items), B)]
dsrun.run('de-def', SYSTEM, batches, os.environ.get('ZH_MODEL', 'deepseek-flash'), float(os.environ.get('ZH_BUDGET', '1.5')))
