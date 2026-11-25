// 0.7 + 0.8 · words of the scenes in regions 4–12, keyed by scene id (r4-a1 … r12-c8, see src/data/zones.ts).
//
// THIS IS THE FILE THE 6000-WORD IMPORT FILLS. Until then it is empty and every scene gets ten stand-in nouns copied
// from regions 1–3 (built in src/data/words.ts, ids `ph4-…`, marked with `base`), as 游戏设计 十六 says:
// 「6000 词表导入前，新区开发用 1–3 区的词占位、不上线」. A scene listed here uses its own rows and no stand-ins.
//
// Row format (one word per row, the part before the first colon is the part of speech):
//   'n: die Wohnung | Wohnungen | 公寓'      noun: article + singular | plural ('-' none, 'pl' plural only) | 中文
//   'v: umziehen | 搬家'                     verb (conjugation / Perfekt data go to verbs.ts / perfekt.ts by id)
//   'adj: hell | 明亮的'   'phr: Wie hoch ist die Miete? | 房租多少？'   'num: dreihundert | 300'
// Levels follow the row order inside the field's band (first scene, first row = lowest), as in words3.ts.
// Ids are slug(German), like regions 1–3, so learned progress survives later list changes.

export const SCENE_ROWS: Record<string, string[]> = {};

/** Stand-in words per scene while SCENE_ROWS has no rows for it. */
export const PLACEHOLDER_PER_SCENE = 10;
