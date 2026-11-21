// Silkline Swing — fully synthesized WebAudio SFX + a frame-driven music loop.
// No samples, no network. BGM sits around 1/4 of the SFX bus.
let ctx = null, master = null, sfxBus = null, musBus = null;
let muted = false;
let musState = 'calm', beatAcc = 0, step16 = 0;
const states = {
  calm: {
    bpm: 68, wave: 'sine', vol: 0.05,
    chords: [[220, 261.6, 329.6], [196, 246.9, 293.7], [174.6, 220, 261.6], [196, 233.1, 293.7]],
    arp: [0, 1, 2, 1, 0, 2, 1, 2], density: 0.5,
  },
  play: {
    bpm: 92, wave: 'triangle', vol: 0.045,
    chords: [[220, 277.2, 329.6], [246.9, 293.7, 370], [196, 246.9, 293.7], [174.6, 220, 277.2]],
    arp: [0, 2, 1, 2, 0, 1, 2, 1], density: 0.8,
  },
  danger: {
    bpm: 118, wave: 'sawtooth', vol: 0.04,
    chords: [[196, 233, 293.7], [185, 220, 277.2], [174.6, 207.6, 261.6], [164.8, 196, 246.9]],
    arp: [0, 2, 1, 2, 0, 1, 2, 0, 1, 2], density: 0.95,
  },
  win: {
    bpm: 84, wave: 'sine', vol: 0.055,
    chords: [[261.6, 329.6, 392], [293.7, 370, 440], [349.2, 440, 523.3], [392, 493.9, 587.3]],
    arp: [0, 1, 2, 1, 2, 0, 1, 2], density: 0.6,
  },
};

function ensure() {
  if (ctx) return true;
  try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return false; }
  master = ctx.createGain(); master.gain.value = muted ? 0 : 1; master.connect(ctx.destination);
  sfxBus = ctx.createGain(); sfxBus.gain.value = 0.75; sfxBus.connect(master);
  musBus = ctx.createGain(); musBus.gain.value = 0.24; musBus.connect(master);
  return true;
}

function tone({ f = 440, f2 = 0, type = 'sine', t = 0.2, v = 0.3, at = 0, decay = 0.12, bus = null, detune = 0 }) {
  if (!ctx) return;
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f, ctx.currentTime + at);
  if (detune) o.detune.value = detune;
  if (f2) o.frequency.exponentialRampToValueAtTime(Math.max(24, f2), ctx.currentTime + at + t);
  g.gain.setValueAtTime(0, ctx.currentTime + at);
  g.gain.linearRampToValueAtTime(v, ctx.currentTime + at + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0008, ctx.currentTime + at + t + decay);
  o.connect(g); g.connect(bus || sfxBus);
  o.start(ctx.currentTime + at); o.stop(ctx.currentTime + at + t + decay + 0.05);
}

function noise({ t = 0.16, v = 0.22, at = 0, f = 1400, q = 1, type = 'bandpass', bus = null }) {
  if (!ctx) return;
  const len = Math.ceil(ctx.sampleRate * (t + 0.05));
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2);
  const src = ctx.createBufferSource(); src.buffer = buf;
  const flt = ctx.createBiquadFilter(); flt.type = type; flt.frequency.value = f; flt.Q.value = q;
  const g = ctx.createGain(); g.gain.value = v;
  src.connect(flt); flt.connect(g); g.connect(bus || sfxBus);
  src.start(ctx.currentTime + at);
}

const sfx = {
  grab() { if (!ctx) return; tone({ f: 520, f2: 780, type: 'triangle', t: 0.08, v: 0.2 }); noise({ t: 0.05, v: 0.07, f: 2400, q: 1.4 }); },
  release() { if (!ctx) return; tone({ f: 760, f2: 380, type: 'sine', t: 0.12, v: 0.16 }); },
  pump() { if (!ctx) return; tone({ f: 300, f2: 360, type: 'sine', t: 0.05, v: 0.05 }); },
  shard() {
    if (!ctx) return;
    [880, 1174.7, 1568].forEach((f, i) => tone({ f, type: 'triangle', t: 0.12, v: 0.18, at: i * 0.055 }));
    noise({ t: 0.12, v: 0.08, f: 4200, q: 1.8 });
  },
  gate() {
    if (!ctx) return;
    [392, 523.3, 659.3, 784, 1046.5].forEach((f, i) => tone({ f, type: 'triangle', t: 0.22, v: 0.16, at: i * 0.075 }));
    noise({ t: 0.5, v: 0.08, f: 900, q: 0.6 });
  },
  death() {
    if (!ctx) return;
    [330, 262, 196, 147].forEach((f, i) => tone({ f, type: 'sawtooth', t: 0.2, v: 0.14, at: i * 0.11, decay: 0.24 }));
    noise({ t: 0.3, v: 0.16, f: 420, q: 0.7 });
  },
  frail() { if (!ctx) return; tone({ f: 660, f2: 220, type: 'square', t: 0.12, v: 0.12 }); noise({ t: 0.16, v: 0.12, f: 2600, q: 0.9 }); },
  wind() { if (!ctx) return; noise({ t: 0.5, v: 0.05, f: 700, q: 0.4 }); },
  ui() { if (!ctx) return; tone({ f: 620, type: 'sine', t: 0.05, v: 0.13 }); },
  fail() {
    if (!ctx) return;
    [262, 220, 174.6].forEach((f, i) => tone({ f, type: 'sine', t: 0.3, v: 0.15, at: i * 0.16, decay: 0.3 }));
  },
};

function musicTick(dt) {
  if (!ctx || muted) return;
  const s = states[musState] || states.calm;
  const beat = 60 / s.bpm / 4;
  beatAcc += dt;
  while (beatAcc >= beat) {
    beatAcc -= beat;
    const beatIdx = step16 % 16;
    const chord = s.chords[Math.floor(step16 / 16) % s.chords.length];
    if (beatIdx === 0) {
      for (const f of chord) tone({ f, type: s.wave, t: beat * 13, v: s.vol, decay: beat * 5, bus: musBus });
    }
    if (beatIdx % 2 === 0 || Math.random() < s.density * 0.4) {
      const f = chord[s.arp[step16 % s.arp.length]] * (beatIdx === 6 ? 2 : 1);
      tone({ f, type: 'sine', t: beat * 1.5, v: s.vol * 1.1, decay: beat * 1.6, bus: musBus });
    }
    if (beatIdx % 4 === 2) tone({ f: 5600, type: 'square', t: 0.02, v: 0.018, bus: musBus });
    step16++;
  }
}

export function makeAudio() {
  return {
    ensure,
    sfx,
    setMuted(v) { muted = !!v; if (master) master.gain.value = muted ? 0 : 1; },
    isMuted() { return muted; },
    hasCtx() { return !!ctx; },
    state(s) { if (s && states[s]) musState = s; return musState; },
    tick(dt) { musicTick(dt); },
    stop() { beatAcc = 0; step16 = 0; },
  };
}

export default makeAudio;
