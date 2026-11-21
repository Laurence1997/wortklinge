// 跟读 (0.5): Chrome's built-in speech recognition (webkitSpeechRecognition). Desktop Chrome only, by design.
// No microphone, or permission refused → the button stays hidden; nothing here may ever block play.

type Rec = {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  continuous: boolean;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  abort(): void;
};

const Ctor: (new () => Rec) | undefined =
  typeof window !== 'undefined' ? ((window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition) : undefined;

let blocked = !Ctor;
let active: Rec | null = null;

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
export function listenOnce(): Promise<string[] | null> {
  if (!Ctor || blocked) return Promise.resolve(null);
  active?.abort();
  // Don't let the game's own voice be heard as the player's.
  try { speechSynthesis.cancel(); } catch { /* no TTS */ }
  return new Promise((resolve) => {
    const r = new Ctor();
    r.lang = 'de-DE';
    r.interimResults = false;
    r.maxAlternatives = 3;
    r.continuous = false;
    let heard: string[] = [];
    let done = false;
    const finish = (v: string[] | null) => {
      if (done) return;
      done = true;
      if (active === r) active = null;
      resolve(v);
    };
    r.onresult = (e) => {
      const first = e.results[0];
      heard = first ? Array.from(first, (a) => a.transcript) : [];
    };
    r.onerror = (e) => {
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed' || e.error === 'audio-capture') {
        blocked = true;
        finish(null);
      } else finish([]);
    };
    r.onend = () => finish(heard);
    active = r;
    try {
      r.start();
    } catch {
      finish([]);
    }
  });
}

export function stopListening(): void {
  active?.abort();
  active = null;
}
