# 德语句子校对 (German proofreading)

No human proofreader yet, so every German string the game can show goes through four checks. None of them
changes game data by itself; they produce lists for a person to decide on.

| Step | What | Where it runs | Cost |
|---|---|---|---|
| 1 | `scripts/proof/extract.ts` collects every German item with an id and a hash (examples, diary, bosses, verb tables, generated sentences, German in game code) | everywhere | — |
| 2 | `scripts/proof/languagetool.ts`: LanguageTool (open source) grammar and spelling check | GitHub Action on every change to German text; locally with Docker | free |
| 3 | `scripts/proof/deepseek.ts`: DeepSeek reads sentences + Chinese and lists only suspicious ones | same Action, once the `DEEPSEEK_API_KEY` repository secret exists | cents per full run; cached, reruns only send changed text |
| 4 | `scripts/proof/tatoeba.ts`: which of our sentences a native speaker already wrote on Tatoeba, and native example candidates (with audio / Chinese) for every word | Action, run by hand ("Run workflow" → tick Tatoeba) | free |

Plus the in-game 「这句有问题？」 link under answer feedback (`src/ui/report.ts`), which writes to the Supabase table
`sentence_reports` (migration `supabase/migrations/0002_sentence_reports.sql`). Report rows carry the same
sentence hash as the files here.

## Run locally

```bash
docker run -d -p 8010:8010 erikvl87/languagetool    # once
npx vite-node scripts/proof/extract.ts
npx vite-node scripts/proof/languagetool.ts          # → proof/out/languagetool.md
DEEPSEEK_API_KEY=sk-... npx vite-node scripts/proof/deepseek.ts   # → proof/out/deepseek.md
scripts/proof/tatoeba-download.sh && npx vite-node scripts/proof/tatoeba.ts   # → proof/out/tatoeba.md
```

## Files kept in the repo

- `ignore.json`: LanguageTool false positives (rules off everywhere / per kind / one sentence by hash).
- `allow-words.txt`: names and words LanguageTool's dictionary does not know.
- `baseline.json`: findings already known, so the Action only warns about new ones. Refresh with `LT_WRITE_BASELINE=1`.

The DeepSeek key never goes into the repo or the web page: locally an environment variable, in CI the
repository secret `DEEPSEEK_API_KEY` (Settings → Secrets and variables → Actions).

Tatoeba sentences are CC BY 2.0 FR: anything taken keeps its sentence id and author (the report lists both),
and the README credits Tatoeba.
