// 跟读 (0.5): Chrome's built-in speech recognition (webkitSpeechRecognition). Desktop Chrome only, by design.
// No microphone, or permission refused → the button stays hidden; nothing here may ever block play.

type Rec = {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  continuous: boolean;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string; confidence?: number }>> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
};

const Ctor: (new () => Rec) | undefined =
  typeof window !== 'undefined' ? ((window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition) : undefined;

let blocked = !Ctor;
let active: Rec | null = null;
let holdTimer = 0;
/** Chrome's confidence (0–1) for the best guess of the last listen; 0 when it gave none. */
export let lastConfidence = 0;

// Hide early when the browser already knows: no microphone, or the site's mic permission is denied.
if (Ctor) {
  try {
    navigator.mediaDevices?.enumerateDevices?.().then((ds) => {
      if (!ds.some((d) => d.kind === 'audioinput')) blocked = true;
    }).catch(() => {});
    (navigator.permissions as any)?.query?.({ name: 'microphone' }).then((p: { state: string; onchange: unknown }) => {
      const sync = () => { if (p.state === 'denied') blocked = true; else if (p.state === 'granted') blocked = false; };
      sync();
      p.onchange = sync;
    }).catch(() => {});
  } catch {
    /* permission API is a hint, never a blocker */
  }
}

export function canListen(): boolean {
  return !blocked;
}

export function listening(): boolean {
  return !!active;
}

/** Listen once in German. Resolves with the heard alternatives ([] when nothing was understood);
 *  null when the mic turned out to be unavailable (the button then disappears for this session). */
/** hold: push-to-talk. Recording runs until stopHold() (release of the key or button), at most 10 s. */
export function listenOnce(opts: { hold?: boolean } = {}): Promise<string[] | null> {
  if (!Ctor || blocked) return Promise.resolve(null);
  active?.abort();
  // Don't let the game's own voice be heard as the player's.
  try { speechSynthesis.cancel(); } catch { /* no TTS */ }
  return new Promise((resolve) => {
    const r = new Ctor();
    r.lang = 'de-DE';
    r.interimResults = false;
    r.maxAlternatives = 5;
    r.continuous = !!opts.hold;
    lastConfidence = 0;
    let heard: string[] = [];
    let done = false;
    const finish = (v: string[] | null) => {
      if (done) return;
      done = true;
      if (active === r) active = null;
      resolve(v);
    };
    r.onresult = (e) => {
      const all = Array.from(e.results);
      const first = all[0];
      if (!first) return (heard = []);
      // Held recording may come back in pieces: the best guess is all pieces joined, plus the first piece's alternatives.
      const joined = all.map((x) => x[0]?.transcript ?? '').join(' ').trim();
      heard = [joined, ...Array.from(first, (a) => a.transcript).slice(1)];
      const cs = all.map((x) => x[0]?.confidence ?? 0).filter((c) => c > 0);
      lastConfidence = cs.length ? cs.reduce((a, b) => a + b, 0) / cs.length : 0;
    };
    r.onerror = (e) => {
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed' || e.error === 'audio-capture') {
        blocked = true;
        finish(null);
      } else finish([]);
    };
    r.onend = () => {
      window.clearTimeout(holdTimer);
      finish(heard);
    };
    active = r;
    if (opts.hold) holdTimer = window.setTimeout(() => r.stop(), 10000);
    try {
      r.start();
    } catch {
      finish([]);
    }
  });
}

/** Push-to-talk released: stop recording but keep what was said (results still arrive). */
export function stopHold(): void {
  window.clearTimeout(holdTimer);
  try {
    active?.stop();
  } catch {
    /* already ended */
  }
}

export function stopListening(): void {
  active?.abort();
  active = null;
}
