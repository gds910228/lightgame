// Crucible Atelier — WebAudio synthesis. All SFX and the music loop are
// generated at runtime; no samples, no network. The audio context is created
// only after a real user gesture (and never during autotest).

export function makeAudio() {
  let ctx = null, master = null, sfxG = null, musG = null;
  let muted = false, musicState = 'title', timer = 0, step16 = 0;

  const states = {
    title: {
      bpm: 62, wave: 'sine', musicGain: 0.16,
      chords: [[174.6, 220.0, 261.6], [146.8, 196.0, 246.9], [164.8, 207.6, 261.6], [130.8, 174.6, 220.0]],
      arp: [0, 2, 1, 2], density: 0.30,
    },
    play: {
      bpm: 74, wave: 'sine', musicGain: 0.17,
      chords: [[196.0, 246.9, 293.7], [174.6, 220.0, 277.2], [220.0, 261.6, 329.6], [164.8, 207.6, 246.9]],
      arp: [0, 1, 2, 1, 2], density: 0.48,
    },
    tense: {
      bpm: 104, wave: 'triangle', musicGain: 0.20,
      chords: [[146.8, 185.0, 220.0], [138.6, 174.6, 207.6], [130.8, 164.8, 196.0], [123.5, 155.6, 185.0]],
      arp: [0, 2, 1, 2, 0, 1], density: 0.82,
    },
    win: {
      bpm: 86, wave: 'triangle', musicGain: 0.20,
      chords: [[261.6, 329.6, 392.0], [246.9, 311.1, 370.0], [220.0, 277.2, 329.6], [196.0, 246.9, 293.7]],
      arp: [0, 2, 1, 2, 2], density: 0.62,
    },
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
      sfxG = ctx.createGain(); sfxG.gain.value = 0.72; sfxG.connect(master);
      musG = ctx.createGain(); musG.gain.value = states[musicState].musicGain; musG.connect(master);
      if (ctx.state === 'suspended') {
        const rp = ctx.resume();
        if (rp && rp.catch) rp.catch(() => { });
      }
      return true;
    } catch (e) { ctx = null; return false; }
  }

  const now = () => ctx.currentTime;

  function tone(f, opts = {}) {
    if (!ctx) return;
    const {
      f2, type = 'sine', t = 0.2, v = 0.2, at = 0, decay = 0.12, dest,
    } = opts;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(Math.max(20, f), now() + at);
    if (f2) o.frequency.exponentialRampToValueAtTime(Math.max(20, f2), now() + at + t);
    g.gain.setValueAtTime(0, now() + at);
    g.gain.linearRampToValueAtTime(v, now() + at + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0008, now() + at + t + decay);
    o.connect(g); g.connect(dest || sfxG);
    o.start(now() + at); o.stop(now() + at + t + decay + 0.05);
  }

  function noise(opts = {}) {
    if (!ctx) return;
    const { t = 0.18, v = 0.2, at = 0, f = 1000, q = 0.9, dest } = opts;
    const len = Math.max(8, Math.ceil(ctx.sampleRate * (t + 0.04)));
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) {
      const k = 1 - i / len;
      d[i] = (Math.random() * 2 - 1) * k * k;
    }
    const src = ctx.createBufferSource(); src.buffer = buf;
    const flt = ctx.createBiquadFilter(); flt.type = 'bandpass';
    flt.frequency.value = f; flt.Q.value = q;
    const g = ctx.createGain(); g.gain.value = v;
    src.connect(flt); flt.connect(g); g.connect(dest || sfxG);
    src.start(now() + at);
  }

  const sfx = {
    ui() { tone(620, { type: 'sine', t: 0.05, v: 0.12 }); },
    gather() {
      tone(420, { f2: 300, type: 'sine', t: 0.08, v: 0.16 });
      noise({ t: 0.06, v: 0.06, f: 900, q: 0.7 });
    },
    craft(tier = 1) {
      const base = 330 + tier * 28;
      tone(base, { f2: base * 1.45, type: 'triangle', t: 0.12, v: 0.18 });
      tone(base * 2, { type: 'sine', t: 0.10, v: 0.09, at: 0.04 });
      noise({ t: 0.08, v: 0.06, f: 1500 + tier * 160, q: 1.3 });
    },
    unlock(tier = 1) {
      const base = 440 + tier * 20;
      [0, 4, 7, 12].forEach((semi, i) => tone(base * Math.pow(2, semi / 12), {
        type: 'triangle', t: 0.13, v: 0.12, at: i * 0.065,
      }));
      noise({ t: 0.2, v: 0.05, f: 2400, q: 0.6 });
    },
    upgrade() {
      tone(180, { f2: 260, type: 'square', t: 0.09, v: 0.09 });
      tone(360, { type: 'sine', t: 0.1, v: 0.08, at: 0.05 });
    },
    deny() { tone(150, { f2: 112, type: 'square', t: 0.09, v: 0.08 }); },
    overload() {
      tone(90, { f2: 320, type: 'sawtooth', t: 0.34, v: 0.11 });
      noise({ t: 0.3, v: 0.1, f: 420, q: 0.5 });
    },
    explode() {
      noise({ t: 0.9, v: 0.34, f: 220, q: 0.3 });
      noise({ t: 0.7, v: 0.2, f: 900, q: 0.4 });
      [150, 110, 82, 58].forEach((f, i) => tone(f, { f2: f * 0.5, type: 'sawtooth', t: 0.28, v: 0.14, at: i * 0.08, decay: 0.3 }));
    },
    win() {
      [523, 659, 784, 1046, 1318].forEach((f, i) => tone(f, { type: 'triangle', t: 0.2, v: 0.14, at: i * 0.12 }));
      [261, 329, 392].forEach((f) => tone(f, { type: 'sine', t: 0.7, v: 0.06, at: 0.1, decay: 0.5 }));
    },
    lose() {
      [330, 277, 220, 165].forEach((f, i) => tone(f, { type: 'sawtooth', t: 0.24, v: 0.12, at: i * 0.16, decay: 0.25 }));
    },
  };

  function musTick() {
    timer = 0;
    if (!ctx || muted) return;
    const st = states[musicState] || states.play;
    const beat = 60 / st.bpm / 4;
    const chord = st.chords[Math.floor(step16 / 16) % st.chords.length];
    const ai = st.arp[step16 % st.arp.length];
    if (step16 % 16 === 0) {
      for (const f of chord) tone(f, { type: st.wave, t: beat * 12, v: 0.035, decay: beat * 5, dest: musG });
    }
    if (step16 % 2 === 0 || Math.random() < st.density * 0.45) {
      const f = chord[ai] * (step16 % 8 === 6 ? 2 : 1);
      tone(f, { type: 'sine', t: beat * 1.5, v: 0.05, decay: beat * 2, dest: musG });
    }
    if (step16 % 4 === 2) {
      noise({ t: 0.03, v: 0.018, f: 5200, q: 0.6, dest: musG });
    }
    step16++;
    timer = setTimeout(musTick, beat * 1000);
  }

  return {
    ensure,
    hasCtx: () => !!ctx,
    isMuted: () => muted,
    setMuted(v) {
      muted = !!v;
      if (master) master.gain.value = muted ? 0 : 1;
      if (muted) { clearTimeout(timer); timer = 0; }
      else if (ctx) { timer = 0; musTick(); }
    },
    setState(s) {
      if (!states[s] || s === musicState) return;
      musicState = s;
      if (musG) musG.gain.value = states[s].musicGain;
      step16 = 0;
    },
    state: () => musicState,
    tick() {
      if (!ctx || muted) return;
      if (!timer) musTick();
    },
    stop() { clearTimeout(timer); timer = 0; step16 = 0; },
    sfx,
  };
}
