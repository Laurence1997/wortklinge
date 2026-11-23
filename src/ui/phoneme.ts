// 发音训练 (游戏设计 › 回音怪规则, 2026-11-23): an espeak-IPA wav2vec2 phoneme recognizer running in the browser.
// Model: facebook/wav2vec2-lv-60-espeak-cv-ft (Apache-2.0, Meta), ONNX export sadda-speech/wav2vec2-espeak-ctc
// (fp16, ~635 MB), run with onnxruntime-web (WebGPU first, WASM fallback). Downloaded only when the player turns
// 发音训练 on, then kept in the browser's Cache Storage. Audio never leaves the computer.
// Judging: decode only over German phoneme classes and compare the CTC likelihood of the word with its partner's
// (the method that worked in the 2026-11-23 test; free decoding + edit distance did not).

const ORT_VER = '1.20.1';
const ORT_URL = `https://cdn.jsdelivr.net/npm/onnxruntime-web@${ORT_VER}/dist/ort.all.min.js`;
const MODEL_URL = 'https://huggingface.co/sadda-speech/wav2vec2-espeak-ctc/resolve/main/model.onnx';
const VOCAB_URL = 'https://huggingface.co/sadda-speech/wav2vec2-espeak-ctc/resolve/main/vocab.json';
const CACHE = 'wk-phoneme-v1';
export const MODEL_MB = 635;

/* eslint-disable @typescript-eslint/no-explicit-any */
type Ort = any;
let ort: Ort = null;
let session: any = null;
let vocab: string[] = [];
let inputType: 'float32' | 'float16' | null = null;
let loading: Promise<void> | null = null;
export type PronStatus = 'off' | 'loading' | 'ready' | 'error';
let status: PronStatus = 'off';
let lastError = '';
let progress = 0;

export function pronStatus(): { status: PronStatus; progress: number; error: string } {
  return { status, progress, error: lastError };
}
export const pronReady = (): boolean => status === 'ready';

function loadScript(url: string): Promise<void> {
  return new Promise((res, rej) => {
    const el = document.createElement('script');
    el.src = url;
    el.onload = () => res();
    el.onerror = () => rej(new Error('运行库下载失败'));
    document.head.append(el);
  });
}

async function fetchCached(url: string, onProgress?: (p: number) => void): Promise<ArrayBuffer> {
  let cache: Cache | null = null;
  try {
    cache = await caches.open(CACHE);
    const hit = await cache.match(url);
    if (hit) {
      onProgress?.(1);
      return hit.arrayBuffer();
    }
  } catch {
    cache = null;
  }
  const r = await fetch(url);
  if (!r.ok || !r.body) throw new Error(`下载失败（${r.status}）`);
  const total = Number(r.headers.get('content-length')) || 0;
  const reader = r.body.getReader();
  const parts: Uint8Array[] = [];
  let got = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    parts.push(value);
    got += value.length;
    if (total) onProgress?.(got / total);
  }
  const buf = new Uint8Array(got);
  let o = 0;
  for (const p of parts) {
    buf.set(p, o);
    o += p.length;
  }
  try {
    await cache?.put(url, new Response(buf));
  } catch {
    /* quota: works this session, downloads again next time */
  }
  return buf.buffer;
}

/** Is the model already in the browser cache (no download needed)? */
export async function pronCached(): Promise<boolean> {
  try {
    return !!(await (await caches.open(CACHE)).match(MODEL_URL));
  } catch {
    return false;
  }
}

/** Remove the downloaded model (settings › 发音训练 › 删除). */
export async function pronForget(): Promise<void> {
  try {
    await caches.delete(CACHE);
  } catch {
    /* nothing to delete */
  }
  session = null;
  status = 'off';
  progress = 0;
}

/** Download (or read from cache) and start the model. Safe to call twice. */
export function loadPron(onProgress?: (p: number) => void): Promise<void> {
  if (status === 'ready') return Promise.resolve();
  if (loading) return loading;
  status = 'loading';
  lastError = '';
  loading = (async () => {
    try {
      if (!(window as any).ort) await loadScript(ORT_URL);
      ort = (window as any).ort;
      ort.env.wasm.wasmPaths = `https://cdn.jsdelivr.net/npm/onnxruntime-web@${ORT_VER}/dist/`;
      const v = JSON.parse(new TextDecoder().decode(await fetchCached(VOCAB_URL))) as Record<string, number>;
      vocab = [];
      for (const [t, i] of Object.entries(v)) vocab[i] = t;
      buildClasses();
      const buf = await fetchCached(MODEL_URL, (p) => {
        progress = p;
        onProgress?.(p);
      });
      for (const ep of ['webgpu', 'wasm']) {
        try {
          session = await ort.InferenceSession.create(buf, { executionProviders: [ep] });
          break;
        } catch (e) {
          console.warn('phoneme model', ep, e);
        }
      }
      if (!session) throw new Error('模型启动失败（显卡和 CPU 都试过了）');
      status = 'ready';
      progress = 1;
    } catch (e) {
      status = 'error';
      lastError = (e as Error).message || String(e);
      throw e;
    } finally {
      loading = null;
    }
  })();
  return loading;
}

// ---- German phoneme classes ----
export const GSPEC = 'p b t d k ɡ f v s z ʃ ʒ ç x h m n ŋ l j ʔ ts pf tʃ dʒ a aː ɛ ɛː e eː ɪ i iː ɔ o oː ʊ u uː y yː ø øː œ ə ɐ aɪ aʊ'.split(' ');
let GCLASS: Array<{ name: string; ids: number[] }> = [];
function buildClasses(): void {
  const id = (t: string) => vocab.indexOf(t);
  const raw = [...GSPEC.map((n) => ({ name: n, ids: [id(n)] })), { name: 'r', ids: ['r', 'ɾ', 'ʁ', 'ɹ'].map(id) }, { name: 'ɔø', ids: ['ɔø', 'ɔɪ'].map(id) }];
  GCLASS = raw.map((g) => ({ ...g, ids: g.ids.filter((i) => i >= 0) })).filter((g) => g.ids.length);
}
const classIndex = (u: string) => GCLASS.findIndex((g) => g.name === u) + 1;

interface Frames {
  T: number;
  K: number;
  lp: Float32Array;
}

function f32ToF16(x: Float32Array): Uint16Array {
  const f = new Float32Array(1);
  const i = new Int32Array(f.buffer);
  const out = new Uint16Array(x.length);
  for (let k = 0; k < x.length; k++) {
    f[0] = x[k];
    const b = i[0];
    const s = (b >> 16) & 0x8000;
    const e = ((b >> 23) & 0xff) - 112;
    const m = b & 0x7fffff;
    out[k] = e <= 0 ? s : e >= 31 ? s | 0x7c00 : s | (e << 10) | (m >> 13);
  }
  return out;
}
function f16ToF32(h: number): number {
  const s = h & 0x8000 ? -1 : 1;
  const e = (h >> 10) & 0x1f;
  const m = h & 0x3ff;
  return e === 0 ? s * m * 2 ** -24 : e === 31 ? s * Infinity : s * (1 + m / 1024) * 2 ** (e - 15);
}

async function frames(wave: Float32Array): Promise<Frames> {
  if (!session) throw new Error('发音模型还没加载');
  let mean = 0;
  for (const x of wave) mean += x;
  mean /= wave.length;
  let v = 0;
  for (const x of wave) v += (x - mean) ** 2;
  const sd = Math.sqrt(v / wave.length + 1e-7);
  const norm = new Float32Array(wave.length);
  for (let k = 0; k < wave.length; k++) norm[k] = (wave[k] - mean) / sd;
  const name = session.inputNames[0];
  let out: any = null;
  for (const t of inputType ? [inputType] : (['float32', 'float16'] as const)) {
    try {
      const tensor = t === 'float32' ? new ort.Tensor('float32', norm, [1, norm.length]) : new ort.Tensor('float16', f32ToF16(norm), [1, norm.length]);
      out = await session.run({ [name]: tensor });
      inputType = t;
      break;
    } catch (e) {
      if (inputType) throw e;
    }
  }
  if (!out) throw new Error('发音模型运行失败');
  const y = out[session.outputNames[0]];
  const [, T, C] = y.dims as number[];
  const d = y.data as Float32Array | Uint16Array;
  const f16 = y.type === 'float16';
  const K = GCLASS.length + 1;
  const lp = new Float32Array(T * K);
  const row = new Float32Array(C);
  for (let t = 0; t < T; t++) {
    let mx = -Infinity;
    for (let c = 0; c < C; c++) {
      row[c] = f16 ? f16ToF32(d[t * C + c]) : d[t * C + c];
      if (row[c] > mx) mx = row[c];
    }
    const cls = new Float64Array(K);
    cls[0] = Math.exp(row[0] - mx);
    GCLASS.forEach((g, k) => {
      let s2 = 0;
      for (const i of g.ids) s2 += Math.exp(row[i] - mx);
      cls[k + 1] = s2;
    });
    let tot = 0;
    for (let k = 0; k < K; k++) tot += cls[k];
    for (let k = 0; k < K; k++) lp[t * K + k] = Math.log(cls[k] / tot + 1e-30);
  }
  return { T, K, lp };
}

function decode({ T, K, lp }: Frames): string[] {
  const out: string[] = [];
  let prev = -1;
  for (let t = 0; t < T; t++) {
    let b = 0;
    for (let k = 1; k < K; k++) if (lp[t * K + k] > lp[t * K + b]) b = k;
    if (b !== prev && b > 0) out.push(GCLASS[b - 1].name);
    prev = b;
  }
  return out;
}

/** CTC log-likelihood of a phoneme sequence (space-separated units) given the frames; blank = class 0. */
export function ctcScore({ T, K, lp }: Frames, ipa: string): number {
  const L = ipa.split(' ').filter(Boolean).map(classIndex);
  if (!L.length || L.some((x) => x <= 0)) return -Infinity;
  const ext = [0];
  for (const x of L) ext.push(x, 0);
  const S = ext.length;
  const NEG = -Infinity;
  const lse = (a: number, b: number) => (a === NEG ? b : b === NEG ? a : Math.max(a, b) + Math.log1p(Math.exp(-Math.abs(a - b))));
  let al = new Float64Array(S).fill(NEG);
  al[0] = lp[ext[0]];
  al[1] = lp[ext[1]];
  for (let t = 1; t < T; t++) {
    const nx = new Float64Array(S).fill(NEG);
    for (let s = 0; s < S; s++) {
      let v = al[s];
      if (s > 0) v = lse(v, al[s - 1]);
      if (s > 1 && ext[s] !== 0 && ext[s] !== ext[s - 2]) v = lse(v, al[s - 2]);
      nx[s] = v === NEG ? NEG : v + lp[t * K + ext[s]];
    }
    al = nx;
  }
  return lse(al[S - 1], al[S - 2]);
}

/** Score a recording against a word and its partner. */
export async function judgePair(wave: Float32Array, ipaTarget: string, ipaPartner: string): Promise<{ heard: string; target: number; partner: number }> {
  const fr = await frames(wave);
  return { heard: decode(fr).join(''), target: ctcScore(fr, ipaTarget), partner: ctcScore(fr, ipaPartner) };
}

// ---- recording: hold to talk, mono 16 kHz ----
let stream: MediaStream | null = null;
let ctx: AudioContext | null = null;
let proc: ScriptProcessorNode | null = null;
let src: MediaStreamAudioSourceNode | null = null;
let chunks: Float32Array[] = [];
let recording = false;

export const isRecording = (): boolean => recording;

export async function startRecording(): Promise<boolean> {
  if (recording) return true;
  try {
    stream ??= await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true } });
  } catch {
    return false;
  }
  ctx ??= new AudioContext();
  await ctx.resume();
  src = ctx.createMediaStreamSource(stream);
  proc = ctx.createScriptProcessor(4096, 1, 1);
  chunks = [];
  proc.onaudioprocess = (e) => chunks.push(new Float32Array(e.inputBuffer.getChannelData(0)));
  src.connect(proc);
  proc.connect(ctx.destination);
  recording = true;
  return true;
}

/** Stop and return the recording at 16 kHz (null when too short). */
export function stopRecording(): Promise<Float32Array | null> {
  return new Promise((res) => {
    if (!recording || !ctx) return res(null);
    recording = false;
    window.setTimeout(() => {
      proc?.disconnect();
      src?.disconnect();
      const rate = ctx!.sampleRate;
      const len = chunks.reduce((n, c) => n + c.length, 0);
      if (len < rate * 0.3) return res(null);
      const all = new Float32Array(len);
      let o = 0;
      for (const c of chunks) {
        all.set(c, o);
        o += c.length;
      }
      const ratio = rate / 16000;
      const n = Math.floor(len / ratio);
      const w = new Float32Array(n);
      for (let i = 0; i < n; i++) {
        let s = 0;
        const a = Math.floor(i * ratio);
        const b = Math.min(len, Math.floor((i + 1) * ratio));
        for (let j = a; j < b; j++) s += all[j];
        w[i] = s / Math.max(1, b - a);
      }
      res(w);
    }, 250);
  });
}

/** Play a 16 kHz recording back (for the 示范 vs 你的录音 comparison). */
export function playRecording(w: Float32Array): void {
  if (!ctx) return;
  const b = ctx.createBuffer(1, w.length, 16000);
  b.copyToChannel(w, 0);
  const s = ctx.createBufferSource();
  s.buffer = b;
  s.connect(ctx.destination);
  s.start();
}
