// Western Showdown Trio — fully synthesized WebAudio (no samples, no network).
// AudioContext is created only on a real user gesture and never during
// ?autotest=1. Six procedural BGM states share a dusty minor-pentatonic mood.

export function makeAudio() {
  let ctx = null, master = null, sfxG = null, musG = null;
  let muted = false, state = 'title', step16 = 0, musAcc = 0;

  // Minor-pentatonic saloon loops. Frequencies in Hz.
  const states = {
    title:   { bpm: 62, root: 146.8, chords: [[146.8, 174.6, 220.0], [130.8, 164.8, 196.0], [146.8, 196.0, 233.1]], arp: [0, 2, 1, 2, 0, 1], density: 0.28, gain: 0.048, swing: 0.06 },
    quick:   { bpm: 132, root: 196.0, chords: [[196.0, 233.1, 293.7], [174.6, 220.0, 261.6], [196.0, 246.9, 311.1]], arp: [0, 2, 1, 2, 0, 1, 2, 1], density: 0.62, gain: 0.044, swing: 0.12 },
    color:   { bpm: 112, root: 220.0, chords: [[220.0, 261.6, 329.6], [196.0, 246.9, 293.7], [174.6, 220.0, 277.2]], arp: [0, 1, 2, 1, 0, 2, 1, 2], density: 0.66, gain: 0.046, swing: 0.04 },
    memory:  { bpm: 84, root: 164.8, chords: [[164.8, 196.0, 246.9], [146.8, 174.6, 220.0], [130.8, 164.8, 196.0]], arp: [0, 2, 1, 2], density: 0.40, gain: 0.046, swing: 0.08 },
    result:  { bpm: 76, root: 196.0, chords: [[196.0, 246.9, 293.7], [174.6, 220.0, 261.6]], arp: [0, 1, 2, 1], density: 0.34, gain: 0.044, swing: 0.05 },
    end:     { bpm: 68, root: 174.6, chords: [[174.6, 220.0, 261.6], [146.8, 196.0, 233.1]], arp: [0, 1, 2, 1], density: 0.26, gain: 0.046, swing: 0.05 },
  };

  function ensure() {
    if (ctx) return true;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = muted ? 0 : 1;
      master.connect(ctx.destination);
      sfxG = ctx.createGain(); sfxG.gain.value = 0.82; sfxG.connect(master);
      musG = ctx.createGain(); musG.gain.value = 0.27; musG.connect(master);
    } catch (e) { ctx = null; return false; }
    return true;
  }
  const now = () => ctx.currentTime;

  function tone({ f = 440, f2, type = 'sine', t = 0.18, v = 0.2, at = 0, decay, dest, bend }) {
    if (!ctx) return;
    const t0 = now() + at;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(Math.max(20, f), t0);
    if (f2) o.frequency.exponentialRampToValueAtTime(Math.max(20, f2), t0 + t);
    if (bend) o.detune.setValueAtTime(bend, t0);
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(v, t0 + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + Math.max(0.035, decay || t));
    o.connect(g); g.connect(dest || sfxG);
    o.start(t0); o.stop(t0 + Math.max(0.06, decay || t) + 0.06);
  }
  function noise({ t = 0.14, v = 0.16, at = 0, f = 1000, q = 0.8, type = 'bandpass', dest }) {
    if (!ctx) return;
    const len = Math.max(1, Math.floor(ctx.sampleRate * (t + 0.04)));
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 1.5);
    const src = ctx.createBufferSource(); src.buffer = buf;
    const fl = ctx.createBiquadFilter(); fl.type = type; fl.frequency.value = f; fl.Q.value = q;
    const g = ctx.createGain(); g.gain.value = v;
    src.connect(fl); fl.connect(g); g.connect(dest || sfxG);
    src.start(now() + at);
  }

  // Plucked saloon string.
  function pluck(f, at, v = 0.13, dur = 0.22, dest) {
    tone({ f, f2: f * 0.995, type: 'triangle', t: dur, v, at, decay: dur, dest });
    tone({ f: f * 2, type: 'sine', t: dur * 0.6, v: v * 0.35, at, decay: dur * 0.6, dest });
  }

  const sfx = {
    ui() { pluck(880, 0, 0.09, 0.07); pluck(1174, 0.02, 0.05, 0.08); },
    count() { tone({ f: 523, type: 'triangle', t: 0.09, v: 0.14 }); noise({ t: 0.03, v: 0.05, f: 2400, q: 1.2 }); },
    start() {
      [523.3, 659.3, 784.0].forEach((f, i) => pluck(f, i * 0.07, 0.14, 0.24));
      noise({ t: 0.16, v: 0.06, f: 2600, q: 1.4 });
    },
    signal() {
      // coyote-call / signal whistle
      tone({ f: 880, f2: 1320, type: 'sine', t: 0.20, v: 0.16 });
      tone({ f: 1320, f2: 990, type: 'sine', t: 0.16, v: 0.10, at: 0.18 });
      noise({ t: 0.10, v: 0.06, f: 3600, q: 1.6, at: 0.02 });
    },
    draw() {
      // gunshot: crack + low boom
      noise({ t: 0.16, v: 0.30, f: 1900, q: 0.7 });
      tone({ f: 150, f2: 48, type: 'square', t: 0.16, v: 0.22 });
      noise({ t: 0.42, v: 0.10, f: 700, q: 0.5, at: 0.05 });
    },
    falseStart() {
      tone({ f: 180, f2: 108, type: 'sawtooth', t: 0.22, v: 0.16 });
      tone({ f: 126, f2: 90, type: 'square', t: 0.26, v: 0.10, at: 0.02 });
      noise({ t: 0.18, v: 0.08, f: 500, q: 0.6 });
    },
    correct(combo = 0) {
      const base = 523.3 * Math.pow(2, Math.min(6, combo | 0) / 12);
      pluck(base, 0, 0.15, 0.18);
      pluck(base * 1.5, 0.055, 0.10, 0.18);
    },
    wrong() {
      tone({ f: 196, f2: 130, type: 'sawtooth', t: 0.16, v: 0.14 });
      noise({ t: 0.10, v: 0.10, f: 520, q: 0.7 });
    },
    flip() {
      noise({ t: 0.045, v: 0.06, f: 2800, q: 1.4 });
      pluck(660, 0.01, 0.06, 0.09);
    },
    pair() {
      [659.3, 830.6, 987.8].forEach((f, i) => pluck(f, i * 0.055, 0.12, 0.22));
    },
    miss() {
      tone({ f: 246.9, f2: 185, type: 'triangle', t: 0.16, v: 0.09 });
      noise({ t: 0.08, v: 0.06, f: 700, q: 0.8 });
    },
    lampTick() { pluck(1046.5 + Math.random() * 120, 0, 0.028, 0.06); },
    roundWin() {
      [392.0, 523.3, 659.3, 784.0].forEach((f, i) => pluck(f, i * 0.075, 0.14, 0.30));
    },
    win() {
      [392.0, 523.3, 659.3, 784.0, 1046.5].forEach((f, i) => pluck(f, i * 0.10, 0.16, 0.48));
      noise({ t: 0.6, v: 0.06, f: 3000, q: 0.5, at: 0.08 });
    },
    lose() {
      [392.0, 329.6, 277.2, 196.0].forEach((f, i) => tone({ f, f2: f * 0.92, type: 'sawtooth', t: 0.28, v: 0.11, at: i * 0.15, decay: 0.44 }));
    },
    pause() { tone({ f: 480, f2: 360, type: 'sine', t: 0.10, v: 0.10 }); },
    share() { pluck(880, 0, 0.12, 0.12); pluck(1320, 0.06, 0.09, 0.14); },
  };

  function musTick(dt) {
    if (!ctx || muted) return;
    const st = states[state] || states.title;
    const beat = 60 / st.bpm / 4;
    musAcc += dt;
    let guard = 0;
    while (musAcc >= beat && guard++ < 10) {
      musAcc -= beat;
      const s = step16++ % 16;
      const chord = st.chords[((step16 / 16) | 0) % st.chords.length];
      // bass on the bar
      if (s === 0 || s === 8) {
        pluck(chord[0] / 2, 0, st.gain * 0.95, beat * 6, musG);
      }
      // sparse saloon arpeggio with human-ish swing
      if (s % 2 === 0 || Math.random() < st.density * 0.3) {
        const n = chord[st.arp[s % st.arp.length]] * (s % 8 === 6 ? 2 : 1);
        const swing = s % 2 === 1 ? beat * st.swing : 0;
        pluck(n, swing, st.gain, beat * 1.6, musG);
      }
      // brushed snare / woodblock
      if (state !== 'title' && (s === 4 || s === 12)) {
        noise({ t: 0.035, v: state === 'quick' ? 0.024 : 0.016, f: 5200, q: 1.1, dest: musG });
      }
      if (state === 'quick' && s % 4 === 3) {
        noise({ t: 0.02, v: 0.012, f: 7200, q: 1.4, dest: musG });
      }
    }
  }

  return {
    unlock() {
      if (!ensure()) return false;
      if (ctx.state === 'suspended') ctx.resume().catch(() => {});
      return true;
    },
    play(name, arg) { if (ctx && !muted && sfx[name]) sfx[name](arg); },
    setState(s) { if (states[s]) state = s; },
    state() { return state; },
    tick(dt) { if (ctx && !muted) musTick(dt); },
    setMuted(v) { muted = !!v; if (master && ctx) master.gain.value = muted ? 0 : 1; },
    isMuted() { return muted; },
    toggleMute() { this.setMuted(!muted); return muted; },
    hasCtx() { return !!ctx; },
    reset() { step16 = 0; musAcc = 0; },
  };
}
