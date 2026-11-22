// 词表导入 (游戏设计 › 词表导入和 A1 写作, 2026-11-22): a player brings a word list from another app
// (Language Reactor, Anki, Excel → CSV / TSV, or Language Reactor's xlsx). Only the word column is read.
// Words the game has become 「优先」 (they come first among the new words of their own scene, at most
// PRIO_PER_SCENE at a time); the game's own data is used, never the imported translation. Words the
// game doesn't have go to 「待收录」. Importing gives no XP and no loot: it only changes what you learn first.
// The file is read in the player's browser and never uploaded; the save keeps word ids and the 待收录 list.

import type { Word } from './types';

/** How many priority words of one scene may be out as new monsters at the same time. */
export const PRIO_PER_SCENE = 3;
/** With a rank column, only the first N ranked rows are marked (the rest would make everything priority). */
export const PRIO_RANKED_DEFAULT = 300;
/** 待收录 keeps at most this many lemmas in the save. */
export const PENDING_MAX = 2000;

export interface ImportResult {
  /** Word ids the game has (in file order, or rank order when the file has ranks). */
  matched: string[];
  /** Lemmas the game doesn't have (yet). */
  missing: string[];
  /** Rows read (after dropping empty and duplicate ones). */
  rows: number;
  /** Ranked rows past the limit that were left out. */
  skipped: number;
}

/** Lower case, ß = ss, no article / sich / trailing punctuation: the key both sides are compared on. */
export function lemmaKey(raw: string): string {
  let s = raw.normalize('NFC').trim().toLowerCase();
  s = s.replace(/\(.*?\)/g, ' ').replace(/[.!?¿¡"„“”«»]+/g, ' ').replace(/\s+/g, ' ').trim();
  s = s.replace(/^(der|die|das|ein|eine|sich)\s+/, '');
  s = s.split(/[,;|]/)[0].trim();
  return s.replace(/ß/g, 'ss').replace(/’/g, "'");
}

/** One key per game word; phrases keep their words (wie bitte), separable verbs their infinitive. */
export function gameIndex(words: Word[]): Map<string, Word> {
  const m = new Map<string, Word>();
  for (const w of words) {
    if (w.family === 'truhe' || w.id.startsWith('say_')) continue;
    const k = lemmaKey(w.de);
    if (k && !m.has(k)) m.set(k, w);
  }
  return m;
}

/** CSV / TSV with quotes ("a, b" and "" inside quotes). The separator is guessed from the first line. */
export function parseDelimited(text: string): string[][] {
  const t = text.replace(/^﻿/, '');
  const first = t.split(/\r?\n/, 1)[0] ?? '';
  const sep = (first.match(/\t/g)?.length ?? 0) > 0 ? '\t' : (first.match(/;/g)?.length ?? 0) > (first.match(/,/g)?.length ?? 0) ? ';' : ',';
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let q = false;
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (q) {
      if (c === '"' && t[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (c === '"') q = false;
      else cell += c;
    } else if (c === '"' && cell === '') q = true;
    else if (c === sep) {
      row.push(cell);
      cell = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && t[i + 1] === '\n') i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else cell += c;
  }
  if (cell !== '' || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter((r) => r.some((x) => x.trim() !== ''));
}

const WORD_HEADERS = ['lemma', 'word', 'german word', 'german', 'deutsch', 'wort', 'front', '单词', '德语', '词'];
const RANK_HEADERS = ['rank', 'frequency rank', 'freq', 'frequency', 'nr', 'no', '排名', '词频', '序号'];
const TYPE_HEADERS = ['item type', 'type'];

/** Which column holds the word, and which (if any) the rank. Without a known header: the first column. */
export function pickColumns(header: string[]): { word: number; rank: number; type: number; hasHeader: boolean } {
  const hs = header.map((x) => x.trim().toLowerCase());
  const find = (names: string[]) => {
    for (const n of names) {
      const i = hs.indexOf(n);
      if (i >= 0) return i;
    }
    return -1;
  };
  const word = find(WORD_HEADERS);
  const rank = find(RANK_HEADERS);
  const type = find(TYPE_HEADERS);
  return word >= 0 ? { word, rank, type, hasHeader: true } : { word: 0, rank: -1, type: -1, hasHeader: false };
}

/** Match a parsed table against the game's words. */
export function matchRows(table: string[][], words: Word[], rankedLimit = PRIO_RANKED_DEFAULT): ImportResult {
  if (!table.length) return { matched: [], missing: [], rows: 0, skipped: 0 };
  const cols = pickColumns(table[0]);
  let body = cols.hasHeader ? table.slice(1) : table;
  // Language Reactor also exports saved phrases (Item type = Phrase): only words are read.
  if (cols.type >= 0) body = body.filter((r) => !/phrase/i.test(r[cols.type] ?? ''));
  let skipped = 0;
  if (cols.rank >= 0) {
    const num = (r: string[]) => {
      const n = Number(String(r[cols.rank] ?? '').replace(/[^\d.]/g, ''));
      return Number.isFinite(n) && n > 0 ? n : Infinity;
    };
    body = [...body].sort((a, b) => num(a) - num(b));
    if (body.length > rankedLimit) {
      skipped = body.length - rankedLimit;
      body = body.slice(0, rankedLimit);
    }
  }
  const idx = gameIndex(words);
  const seen = new Set<string>();
  const matched: string[] = [];
  const missing: string[] = [];
  let rows = 0;
  for (const r of body) {
    const raw = (r[cols.word] ?? '').trim();
    const k = lemmaKey(raw);
    if (!k || seen.has(k) || !/\p{L}/u.test(k)) continue;
    seen.add(k);
    rows++;
    const w = idx.get(k);
    if (w) {
      if (!matched.includes(w.id)) matched.push(w.id);
    } else missing.push(raw.replace(/^(der|die|das)\s+/i, (a) => a.toLowerCase()));
  }
  return { matched, missing, rows, skipped };
}

/** Merge an import into what the save already has (re-importing the same list changes nothing). */
export function mergeImport(prev: { ids?: string[]; pending?: string[] } | undefined, r: ImportResult): { ids: string[]; pending: string[] } {
  const ids = [...(prev?.ids ?? [])];
  for (const id of r.matched) if (!ids.includes(id)) ids.push(id);
  const pend = [...(prev?.pending ?? [])];
  const have = new Set(pend.map(lemmaKey));
  for (const m of r.missing) {
    if (pend.length >= PENDING_MAX) break;
    if (!have.has(lemmaKey(m))) {
      pend.push(m);
      have.add(lemmaKey(m));
    }
  }
  return { ids, pending: pend };
}

/**
 * Put priority words first in a list of new words, at most `cap` of them; the rest keep their order.
 * (The normal order is easiest first, so a priority word only jumps the queue inside its own scene.)
 */
export function prioritise<T extends { id: string }>(fresh: T[], prio: ReadonlySet<string>, cap = PRIO_PER_SCENE): T[] {
  if (!prio.size) return fresh;
  const first: T[] = [];
  const rest: T[] = [];
  for (const w of fresh) (prio.has(w.id) && first.length < cap ? first : rest).push(w);
  return [...first, ...rest];
}

// ---- xlsx (Language Reactor exports .xlsx) -----------------------------------------------------
// An xlsx is a zip of XML files. Chrome (the only supported browser) can inflate with DecompressionStream,
// so a small reader is enough: first sheet, shared strings and inline strings, no formulas.

async function inflateRaw(data: Uint8Array): Promise<Uint8Array> {
  const ds = new DecompressionStream('deflate-raw');
  const out = new Blob([data]).stream().pipeThrough(ds);
  return new Uint8Array(await new Response(out).arrayBuffer());
}

/** Files of a zip by name (central directory, so sizes are right even with data descriptors). */
export async function unzip(buf: ArrayBuffer, want: (name: string) => boolean): Promise<Record<string, string>> {
  const u8 = new Uint8Array(buf);
  const dv = new DataView(buf);
  let eocd = -1;
  for (let i = u8.length - 22; i >= Math.max(0, u8.length - 65_557); i--) {
    if (dv.getUint32(i, true) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error('not a zip');
  const n = dv.getUint16(eocd + 10, true);
  let p = dv.getUint32(eocd + 16, true);
  const dec = new TextDecoder();
  const out: Record<string, string> = {};
  for (let k = 0; k < n; k++) {
    if (dv.getUint32(p, true) !== 0x02014b50) break;
    const method = dv.getUint16(p + 10, true);
    const csize = dv.getUint32(p + 20, true);
    const nlen = dv.getUint16(p + 28, true);
    const xlen = dv.getUint16(p + 30, true);
    const clen = dv.getUint16(p + 32, true);
    const local = dv.getUint32(p + 42, true);
    const name = dec.decode(u8.subarray(p + 46, p + 46 + nlen));
    p += 46 + nlen + xlen + clen;
    if (!want(name)) continue;
    const lnlen = dv.getUint16(local + 26, true);
    const lxlen = dv.getUint16(local + 28, true);
    const start = local + 30 + lnlen + lxlen;
    const raw = u8.subarray(start, start + csize);
    const bytes = method === 0 ? raw : method === 8 ? await inflateRaw(raw) : null;
    if (bytes) out[name] = dec.decode(bytes);
  }
  return out;
}

const unxml = (s: string) => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');

/** First sheet of an xlsx as rows of strings. */
export async function readXlsx(buf: ArrayBuffer): Promise<string[][]> {
  const files = await unzip(buf, (n) => n === 'xl/sharedStrings.xml' || /^xl\/worksheets\/sheet\d+\.xml$/.test(n));
  const shared: string[] = [];
  for (const si of (files['xl/sharedStrings.xml'] ?? '').match(/<si>[\s\S]*?<\/si>/g) ?? []) {
    shared.push(unxml((si.match(/<t[^>]*>[\s\S]*?<\/t>/g) ?? []).map((t) => t.replace(/<[^>]+>/g, '')).join('')));
  }
  const sheetName = Object.keys(files).filter((n) => n.startsWith('xl/worksheets/')).sort()[0];
  const xml = sheetName ? files[sheetName] : '';
  const rows: string[][] = [];
  for (const r of xml.match(/<row[^>]*>[\s\S]*?<\/row>/g) ?? []) {
    const row: string[] = [];
    for (const c of r.match(/<c [^>]*?(?:\/>|>[\s\S]*?<\/c>)/g) ?? []) {
      const ref = c.match(/ r="([A-Z]+)\d+"/)?.[1] ?? '';
      let col = 0;
      for (const ch of ref) col = col * 26 + (ch.charCodeAt(0) - 64);
      const type = c.match(/ t="(\w+)"/)?.[1];
      const v = c.match(/<v>([\s\S]*?)<\/v>/)?.[1];
      const inline = c.match(/<is>([\s\S]*?)<\/is>/)?.[1];
      const val = type === 's' && v != null ? shared[Number(v)] ?? '' : inline != null ? unxml(inline.replace(/<[^>]+>/g, '')) : unxml(v ?? '');
      row[(col || row.length + 1) - 1] = val;
    }
    rows.push(Array.from(row, (x) => x ?? ''));
  }
  return rows.filter((r) => r.some((x) => x.trim() !== ''));
}

/** Read whatever the player picked: xlsx by its zip signature, otherwise text (CSV / TSV). */
export async function readTable(file: { arrayBuffer(): Promise<ArrayBuffer> }): Promise<string[][]> {
  const buf = await file.arrayBuffer();
  const sig = new Uint8Array(buf.slice(0, 2));
  if (sig[0] === 0x50 && sig[1] === 0x4b) return readXlsx(buf);
  return parseDelimited(new TextDecoder().decode(buf));
}
