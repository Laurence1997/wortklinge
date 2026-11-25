#!/usr/bin/env bash
# Downloads the Tatoeba exports the proofreading script needs into proof/tatoeba/ (plain TSV, not committed).
# Source: https://tatoeba.org/downloads · sentences CC BY 2.0 FR.
set -euo pipefail
cd "$(dirname "$0")/../.."
mkdir -p proof/tatoeba && cd proof/tatoeba
base=https://downloads.tatoeba.org/exports
get() { curl -fsSL --retry 3 "$1" -o "$2"; }
get "$base/per_language/deu/deu_sentences_detailed.tsv.bz2" deu.bz2 && bunzip2 -c deu.bz2 > deu_sentences_detailed.tsv && rm deu.bz2
get "$base/user_languages.tar.bz2" ul.tar.bz2 && tar -xjf ul.tar.bz2 && rm ul.tar.bz2
get "$base/sentences_with_audio.tar.bz2" au.tar.bz2 && tar -xjf au.tar.bz2 && rm au.tar.bz2
# Chinese translations are optional: skip quietly if a file is missing.
get "$base/per_language/cmn/cmn_sentences.tsv.bz2" cmn.bz2 && bunzip2 -c cmn.bz2 > cmn_sentences.tsv && rm cmn.bz2 || true
get "$base/per_language/deu/deu-cmn_links.tsv.bz2" links.bz2 && bunzip2 -c links.bz2 > deu-cmn_links.tsv && rm links.bz2 || true
ls -la
