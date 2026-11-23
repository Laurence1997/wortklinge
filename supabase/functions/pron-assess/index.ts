// 发音评测中转 (游戏设计 › 下一版方向提案, 2026-11-23): the browser sends a short 16 kHz WAV and the text it
// should say; this calls Azure's pronunciation assessment (REST, short audio) with the key from the project's
// secrets and returns Azure's JSON. The key never reaches the browser.
// Secrets: AZURE_SPEECH_KEY, AZURE_SPEECH_REGION (default germanywestcentral).

const ALLOWED = ['https://wortklinge.myreverielab.com', 'http://localhost:5173', 'http://localhost:4173', 'null'];
const MAX_BYTES = 640_000; // ~20 s of 16 kHz mono PCM

function cors(origin: string | null): Record<string, string> {
  const o = origin && ALLOWED.includes(origin) ? origin : ALLOWED[0];
  return {
    'Access-Control-Allow-Origin': o,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'content-type, x-reference-text, apikey, authorization',
    Vary: 'Origin',
  };
}

const b64 = (s: string) => btoa(String.fromCharCode(...new TextEncoder().encode(s)));

Deno.serve(async (req) => {
  const origin = req.headers.get('origin');
  const h = cors(origin);
  if (req.method === 'OPTIONS') return new Response(null, { headers: h });
  if (req.method !== 'POST') return new Response('POST only', { status: 405, headers: h });
  if (!origin || !ALLOWED.includes(origin)) return new Response('origin not allowed', { status: 403, headers: h });

  const key = Deno.env.get('AZURE_SPEECH_KEY');
  const region = Deno.env.get('AZURE_SPEECH_REGION') || 'germanywestcentral';
  if (!key) return Response.json({ error: 'no_key' }, { status: 500, headers: h });

  const ref = decodeURIComponent(req.headers.get('x-reference-text') || '').trim();
  if (!ref || ref.length > 120) return Response.json({ error: 'bad_reference' }, { status: 400, headers: h });
  const audio = new Uint8Array(await req.arrayBuffer());
  if (audio.length < 1000 || audio.length > MAX_BYTES) return Response.json({ error: 'bad_audio' }, { status: 400, headers: h });

  const pa = b64(JSON.stringify({ ReferenceText: ref, GradingSystem: 'HundredMark', Granularity: 'Phoneme', Dimension: 'Comprehensive', EnableMiscue: true }));
  const url = `https://${region}.stt.speech.microsoft.com/speech/recognition/conversation/cognitiveservices/v1?language=de-DE&format=detailed`;
  const r = await fetch(url, {
    method: 'POST',
    headers: {
      'Ocp-Apim-Subscription-Key': key,
      'Content-Type': 'audio/wav; codecs=audio/pcm; samplerate=16000',
      'Pronunciation-Assessment': pa,
      Accept: 'application/json',
    },
    body: audio,
  });
  const text = await r.text();
  return new Response(text || JSON.stringify({ error: `azure_${r.status}` }), {
    status: r.ok ? 200 : 502,
    headers: { ...h, 'Content-Type': 'application/json' },
  });
});
