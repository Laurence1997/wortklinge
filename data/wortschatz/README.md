# Wortschatz (word list data)

Not wired into the game yet. The top 6000 rows of `wortschatz.tsv` are the planned game vocabulary; rows 6001+ are a reserve for the post-121 article mode.

- `wortschatz.tsv`: lemma, card display form (noun article + plural, irregular genitive only; verb 3sg · Präteritum · Perfekt; irregular comparatives), POS, Chinese gloss, tags, examples (to be filled).
- `verben-praeposition.tsv`: verb + preposition pairs grouped by preposition, with case, Chinese meaning, example (self-written, unproofread), reflexive flag.
- `reflexiv.tsv`: reflexive verbs (Lucas 2026-11-27): form (`sich` / `(sich)` / `sich ~ lassen`), the reflexive's case when dative, the usual preposition. Read by `scripts/build_lexicon.py`.
- `goethe-stufe.tsv`: lowest Goethe-Zertifikat word list (A1/A2/B1) each lemma appears on, blank = none; made by `scripts/goethe_levels.py` from the Goethe-Institut PDFs (not kept here). Used by the 入学测试.
- `verschoben.tsv`: A1-segment words on no Goethe list up to B1, moved to a B1 scene by `build_lexicon.py` (Lucas 2026-11-27).
- Re-import an edited spreadsheet: `python3 scripts/wortschatz_import.py <file.xlsx>` (needs `openpyxl`).
- `build/`: the scripts and manual review files used to build the list (inputs were downloaded separately; see sources).

## Sources and licence

This data is licensed **CC BY-SA 4.0** (https://creativecommons.org/licenses/by-sa/4.0/), because it is derived from:

- FrequencyWords by Hermit Dave (OpenSubtitles 2018, German), CC BY-SA 4.0: https://github.com/hermitdave/FrequencyWords
- wordfreq by Robyn Speer, data CC BY-SA 4.0: https://github.com/rspeer/wordfreq
- german-nouns by gambolputty (from Wiktionary), CC BY-SA 4.0: https://github.com/gambolputty/german-nouns
- german-verbs / german-verbs-dict from RosaeNLG (Apache-2.0; dictionary based on german-pos-dict, CC BY-SA 4.0): https://github.com/RosaeNLG/rosaenlg

Example sentences: mostly from Tatoeba (https://tatoeba.org, CC BY 2.0 FR; sentence id and author kept in the 例句出处 column), picked by `build/scripts/tatoeba_match.py`; rows marked 自写 and the Chinese marked 中文自译 were written for this project (`beispiele.tsv`).

Chinese glosses, the life-in-Germany word list and the example sentences in `verben-praeposition.tsv` were written for this project.
