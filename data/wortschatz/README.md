# Wortschatz (word list data)

Not wired into the game yet. The top 6000 rows of `wortschatz.tsv` are the planned game vocabulary; rows 6001+ are a reserve for the post-121 article mode.

- `wortschatz.tsv`: lemma, card display form (noun article + plural, irregular genitive only; verb 3sg · Präteritum · Perfekt; irregular comparatives), POS, Chinese gloss, tags, examples (to be filled).
- `verben-praeposition.tsv`: verb + preposition pairs grouped by preposition, with case, Chinese meaning, example (self-written, unproofread), reflexive flag.
- Re-import an edited spreadsheet: `python3 scripts/wortschatz_import.py <file.xlsx>` (needs `openpyxl`).
- `build/`: the scripts and manual review files used to build the list (inputs were downloaded separately; see sources).

## Sources and licence

This data is licensed **CC BY-SA 4.0** (https://creativecommons.org/licenses/by-sa/4.0/), because it is derived from:

- FrequencyWords by Hermit Dave (OpenSubtitles 2018, German), CC BY-SA 4.0: https://github.com/hermitdave/FrequencyWords
- wordfreq by Robyn Speer, data CC BY-SA 4.0: https://github.com/rspeer/wordfreq
- german-nouns by gambolputty (from Wiktionary), CC BY-SA 4.0: https://github.com/gambolputty/german-nouns
- german-verbs / german-verbs-dict (based on german-pos-dict): https://github.com/ludan/german-verbs-dict

Chinese glosses, the life-in-Germany word list and the example sentences in `verben-praeposition.tsv` were written for this project.
