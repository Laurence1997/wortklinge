// Code-generated 8-bit sound: on bright daily maps a light tune per region (0.8.4, Lucas 11-26 选 1); on 蚀变 maps,
// bosses and 零号站台 the low drone with whispers and a heartbeat in fights; bleeps for feedback.
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
  if (wantBright) startTune();
  else startDrone();
}

// ---- 明亮区音乐 (0.8.4): a short looping tune, generated per region ------------------------------------

let wantBright = false;
let tuneRegion = 1;
let tuneTimer: number | null = null;
let tuneFast = false;

/** Region keys (semitones above C4) and tempi: each daily region sounds a little different. */
const TUNE_KEY = [0, 0, 5, 2, 7, 9, 3, 4, 10, 2, 7, 5, 9];
const TUNE_BPM = [0, 92, 104, 98, 100, 86, 94, 96, 102, 108, 90, 98, 84];
const PENTA = [0, 2, 4, 7, 9];
// I – V – vi – IV, as semitone roots with major / minor thirds.
const PROG: Array<[number, boolean]> = [[0, true], [7, true], [9, false], [5, true]];

function hz(semi: number): number {
  return 261.63 * Math.pow(2, semi / 12);
}

function note(freq: number, t: number, dur: number, type: OscillatorType, vol: number, dest: AudioNode) {
  if (!ctx) return;
  const o = ctx.createOscillator();
  o.type = type;
  o.frequency.value = freq;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(dest);
  o.start(t);
  o.stop(t + dur + 0.05);
}

function stopDrone() {
  for (const n of droneNodes) {
    try {
      (n as OscillatorNode).stop?.();
    } catch {
      /* already stopped */
    }
    n.disconnect();
  }
  droneNodes = [];
  if (whisperTimer) window.clearTimeout(whisperTimer);
  whisperTimer = null;
}

function stopTune() {
  if (tuneTimer) window.clearInterval(tuneTimer);
  tuneTimer = null;
}

function startTune() {
  if (!ctx || !musicBus) return;
  stopTune();
  const bus = ctx.createBiquadFilter();
  bus.type = 'lowpass';
  bus.frequency.value = 3200;
  bus.connect(musicBus);
  // A fixed melody per region (seeded), varied a little on every loop.
  let seed = tuneRegion * 9301 + 49297;
  const rnd = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);
  const melody: Array<number | null> = [];
  let deg = 2;
  for (let i = 0; i < 32; i++) {
    if (i % 2 === 1 && rnd() < 0.45) {
      melody.push(null);
      continue;
    }
    deg = Math.max(0, Math.min(9, deg + Math.round((rnd() - 0.5) * 3)));
    melody.push(deg);
  }
  const key = TUNE_KEY[tuneRegion] ?? 0;
  let step = 0;
  let next = ctx.currentTime + 0.1;
  const tick = () => {
    if (!ctx) return;
    const spb = 60 / ((TUNE_BPM[tuneRegion] ?? 96) * (tuneFast ? 1.25 : 1)) / 2; // eighth notes
    while (next < ctx.currentTime + 0.25) {
      const bar = Math.floor(step / 8) % 4;
      const [root, major] = PROG[bar];
      const s8 = step % 8;
      // Bass on beats 1 and 3, a soft arpeggio on the off-beats, the melody on top.
      if (s8 === 0 || s8 === 4) note(hz(key + root - 24), next, spb * 1.8, 'triangle', 0.32, bus);
      const arp = [0, major ? 4 : 3, 7, 12][s8 % 4];
      if (s8 % 2 === 1) note(hz(key + root + arp - 12), next, spb * 0.9, 'square', 0.035, bus);
      const m = melody[step % 32];
      if (m !== null && m !== undefined && (step < 32 || rnd() > 0.15)) {
        const semi = PENTA[m % 5] + 12 * Math.floor(m / 5);
        note(hz(key + semi), next, spb * 1.6, 'triangle', 0.16, bus);
      }
      next += spb;
      step = (step + 1) % 64;
    }
  };
  tick();
  tuneTimer = window.setInterval(tick, 90);
}

/** Bright daily map → the region's tune; otherwise the drone. Called whenever a map is drawn. */
export function setMusicMood(bright: boolean, region: number): void {
  const changed = bright !== wantBright || (bright && region !== tuneRegion);
  wantBright = bright;
  tuneRegion = region;
  if (!ctx || !changed) return;
  if (bright) {
    stopDrone();
    startTune();
  } else {
    stopTune();
    if (!droneNodes.length) startDrone();
  }
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

/** `dark` = a boss fight: always the heartbeat (the tune stops), even on a bright map. */
export function setBattleMusic(on: boolean, dark = false): void {
  if (heartbeatTimer) {
    window.clearInterval(heartbeatTimer);
    heartbeatTimer = null;
  }
  tuneFast = on && wantBright && !dark;
  if (wantBright && ctx) {
    if (on && dark) stopTune();
    else if (!tuneTimer) startTune();
  }
  // Bright maps: the tune just picks up the pace in a fight; the heartbeat belongs to the dark places and bosses.
  if (!on || !ctx || (wantBright && !dark)) return;
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
/** Chrome drops callbacks (and sometimes the sound) of an utterance it has garbage-collected: keep the current one. */
let current: SpeechSynthesisUtterance | null = null;

/** Why nothing could be heard (告示牌没声音, Lucas 2026-11-28): no German voice on this computer, or the voice failed. */
export type SpeechTrouble = 'noVoice' | 'failed';
let troubleHook: ((t: SpeechTrouble) => void) | null = null;
export function onSpeechTrouble(fn: (t: SpeechTrouble) => void): void {
  troubleHook = fn;
}
function trouble(t: SpeechTrouble) {
  try {
    troubleHook?.(t);
  } catch {
    /* never a blocker */
  }
}

/** Voices load late in Chrome: wait up to 1.5 s for the list before deciding there is no German voice. */
function voicesReady(): Promise<void> {
  if (typeof speechSynthesis === 'undefined' || speechSynthesis.getVoices().length) return Promise.resolve();
  return new Promise((res) => {
    const done = () => (findVoice(), res());
    speechSynthesis.addEventListener('voiceschanged', done, { once: true });
    window.setTimeout(done, 1500);
  });
}

export function speak(text: string, enabled: boolean, rate = 0.9): void {
  if (!enabled || typeof speechSynthesis === 'undefined') return;
  const said = spokenText(text);
  if (!said) return;
  const seq = ++speakSeq;
  const go = (retry: boolean) => {
    try {
      if (seq !== speakSeq) return;
      if (!germanVoice) findVoice();
      // No German voice at all: Chrome would read German with a Chinese voice (or stay silent). Say why instead.
      if (!germanVoice) return trouble('noVoice');
      const u = new SpeechSynthesisUtterance(said);
      current = u;
      u.lang = germanVoice.lang || 'de-DE';
      u.voice = germanVoice;
      u.rate = rate;
      u.pitch = 0.85;
      let started = false;
      u.onstart = () => (started = true);
      u.onend = () => {
        if (current === u) current = null;
      };
      const online = !germanVoice.localService;
      const fallBack = () => {
        if (seq !== speakSeq) return;
        const before = germanVoice;
        if (!retry && online) {
          onlineFailed = true;
          findVoice();
          if (germanVoice && germanVoice !== before) return go(true);
        }
        trouble('failed');
      };
      u.onerror = (e) => {
        if (e.error !== 'interrupted' && e.error !== 'canceled') fallBack();
      };
      speechSynthesis.speak(u);
      // A voice that has not started within 2.5 s is stuck (Chrome's online Google voices do this): try the local one.
      window.setTimeout(() => !started && seq === speakSeq && (speechSynthesis.cancel(), fallBack()), 2500);
    } catch {
      /* speech is a bonus, never a blocker */
    }
  };
  // Chrome sometimes swallows an utterance queued in the same tick as cancel(): cancel, then speak a moment later.
  let busy = false;
  try {
    busy = speechSynthesis.speaking || speechSynthesis.pending;
    speechSynthesis.cancel();
    speechSynthesis.resume();
  } catch {
    /* no TTS */
  }
  void voicesReady().then(() => window.setTimeout(() => go(false), busy ? 80 : 0));
}

export function hasGermanVoice(): boolean {
  return !!germanVoice;
}
