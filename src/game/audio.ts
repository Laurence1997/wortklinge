// Code-generated 8-bit sound: a low drone with whispers, a heartbeat in fights, bleeps for feedback.
// Spoken lines use the browser's German voice (Chrome first; swappable later for pre-rendered audio).

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let musicBus: GainNode | null = null;
let sfxBus: GainNode | null = null;
let droneNodes: AudioNode[] = [];
let heartbeatTimer: number | null = null;
let whisperTimer: number | null = null;
let musicVol = 0.5;
let sfxVol = 0.7;

export function initAudio(music: number, sfx: number): void {
  musicVol = music;
  sfxVol = sfx;
  if (ctx) return;
  try {
    ctx = new AudioContext();
  } catch {
    return;
  }
  master = ctx.createGain();
  master.gain.value = 0.9;
  master.connect(ctx.destination);
  musicBus = ctx.createGain();
  musicBus.gain.value = musicVol * 0.35;
  musicBus.connect(master);
  sfxBus = ctx.createGain();
  sfxBus.gain.value = sfxVol * 0.5;
  sfxBus.connect(master);
  startDrone();
}

export function setVolumes(music: number, sfx: number): void {
  musicVol = music;
  sfxVol = sfx;
  if (musicBus) musicBus.gain.value = music * 0.35;
  if (sfxBus) sfxBus.gain.value = sfx * 0.5;
}

function startDrone() {
  if (!ctx || !musicBus) return;
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 420;
  lp.connect(musicBus);
  const notes = [55, 55 * 1.5, 55 * 1.007];
  for (const f of notes) {
    const o = ctx.createOscillator();
    o.type = 'sawtooth';
    o.frequency.value = f;
    const g = ctx.createGain();
    g.gain.value = 0.12;
    o.connect(g).connect(lp);
    o.start();
    droneNodes.push(o, g);
  }
  // Slow breathing on the filter.
  const lfo = ctx.createOscillator();
  lfo.frequency.value = 0.07;
  const lg = ctx.createGain();
  lg.gain.value = 180;
  lfo.connect(lg).connect(lp.frequency);
  lfo.start();
  droneNodes.push(lfo, lg, lp);
  scheduleWhisper();
}

function noiseBuffer(seconds: number): AudioBuffer | null {
  if (!ctx) return null;
  const buf = ctx.createBuffer(1, ctx.sampleRate * seconds, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return buf;
}

function scheduleWhisper() {
  if (whisperTimer) window.clearTimeout(whisperTimer);
  whisperTimer = window.setTimeout(() => {
    whisper();
    scheduleWhisper();
  }, 7000 + Math.random() * 12000);
}

/** Unintelligible whispering: band-passed noise with a wobbling formant. */
function whisper() {
  if (!ctx || !musicBus) return;
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer(2.4);
  const bp = ctx.createBiquadFilter();
  bp.type = 'bandpass';
  bp.Q.value = 6;
  const t = ctx.currentTime;
  for (let i = 0; i < 8; i++) bp.frequency.setValueAtTime(700 + Math.random() * 1600, t + i * 0.25);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(0.25, t + 0.4);
  g.gain.linearRampToValueAtTime(0, t + 2.3);
  const pan = ctx.createStereoPanner();
  pan.pan.value = Math.random() * 2 - 1;
  src.connect(bp).connect(g).connect(pan).connect(musicBus);
  src.start();
}

export function setBattleMusic(on: boolean): void {
  if (heartbeatTimer) {
    window.clearInterval(heartbeatTimer);
    heartbeatTimer = null;
  }
  if (!on || !ctx) return;
  const beat = () => {
    thump(0);
    thump(0.22);
  };
  beat();
  heartbeatTimer = window.setInterval(beat, 1100);
}

function thump(delay: number) {
  if (!ctx || !musicBus) return;
  const t = ctx.currentTime + delay;
  const o = ctx.createOscillator();
  o.type = 'sine';
  o.frequency.setValueAtTime(70, t);
  o.frequency.exponentialRampToValueAtTime(38, t + 0.18);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.9, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
  o.connect(g).connect(musicBus);
  o.start(t);
  o.stop(t + 0.25);
}

function blip(freqs: number[], dur = 0.08, type: OscillatorType = 'square', vol = 0.4) {
  if (!ctx || !sfxBus) return;
  let t = ctx.currentTime;
  for (const f of freqs) {
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.value = f;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g).connect(sfxBus);
    o.start(t);
    o.stop(t + dur + 0.02);
    t += dur * 0.9;
  }
}

export const sfx = {
  correct: () => blip([660, 990], 0.07),
  wrong: () => blip([180, 120], 0.12, 'sawtooth', 0.35),
  hit: () => blip([220, 110], 0.05, 'square', 0.3),
  crit: () => blip([523, 784, 1047, 1568], 0.06),
  hurt: () => blip([140, 90], 0.1, 'sawtooth', 0.4),
  parry: () => blip([1200, 600, 1200], 0.04),
  levelUp: () => blip([392, 523, 659, 784, 1047], 0.1, 'triangle', 0.5),
  guiming: () => blip([523, 659, 784, 1047, 1319, 1568], 0.11, 'triangle', 0.5),
  loot: () => blip([880, 1175], 0.06, 'triangle'),
  orange: () => blip([392, 494, 587, 784, 988, 1175], 0.09, 'triangle', 0.55),
  step: () => blip([90], 0.02, 'square', 0.05),
  ui: () => blip([700], 0.03, 'square', 0.15),
  death: () => blip([330, 262, 196, 131, 98], 0.18, 'sawtooth', 0.4),
};

// ---- Speech ---------------------------------------------------------------

let germanVoice: SpeechSynthesisVoice | null = null;
/** Chrome's Google voices are online; when one stays silent the local German voice takes over for this session. */
let onlineFailed = false;

function findVoice() {
  if (typeof speechSynthesis === 'undefined') return;
  const voices = speechSynthesis.getVoices();
  const local = voices.find((v) => v.lang.startsWith('de') && v.localService) ?? null;
  germanVoice =
    (onlineFailed ? local : null) ??
    voices.find((v) => v.lang === 'de-DE' && /Google/.test(v.name)) ??
    voices.find((v) => v.lang === 'de-DE') ??
    voices.find((v) => v.lang.startsWith('de')) ??
    null;
}

if (typeof speechSynthesis !== 'undefined') {
  findVoice();
  speechSynthesis.onvoiceschanged = findVoice;
}

export function speechAvailable(): boolean {
  return typeof speechSynthesis !== 'undefined';
}

/** What is read aloud: the monster's swallowed word (mmh) and … become short pauses, never spelled out. */
export function spokenText(text: string): string {
  return text.replace(/\bm+h+\b/gi, ' ').replace(/…/g, ', ').replace(/(\s*,\s*)+/g, ', ').replace(/^[\s,]+/, '').trim();
}

let speakSeq = 0;

export function speak(text: string, enabled: boolean, rate = 0.9): void {
  if (!enabled || typeof speechSynthesis === 'undefined') return;
  const said = spokenText(text);
  if (!said) return;
  const seq = ++speakSeq;
  const go = (retry: boolean) => {
    try {
      speechSynthesis.cancel();
      speechSynthesis.resume();
      const u = new SpeechSynthesisUtterance(said);
      u.lang = 'de-DE';
      if (germanVoice) u.voice = germanVoice;
      u.rate = rate;
      u.pitch = 0.85;
      let started = false;
      u.onstart = () => (started = true);
      const online = !!germanVoice && !germanVoice.localService;
      const fallBack = () => {
        if (retry || !online || seq !== speakSeq) return;
        onlineFailed = true;
        findVoice();
        go(true);
      };
      u.onerror = (e) => {
        if (e.error !== 'interrupted' && e.error !== 'canceled') fallBack();
      };
      speechSynthesis.speak(u);
      // An online voice that has not started within 2.5 s is stuck: switch to the local voice.
      if (online && !retry) window.setTimeout(() => !started && fallBack(), 2500);
    } catch {
      /* speech is a bonus, never a blocker */
    }
  };
  go(false);
}

export function hasGermanVoice(): boolean {
  return !!germanVoice;
}
