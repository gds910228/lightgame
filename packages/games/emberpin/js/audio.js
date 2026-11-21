// Emberpin — fully synthesized WebAudio: SFX library plus a three-state
// ember-glow music loop. No samples, no network. The AudioContext is created
// only after a real gesture; the autotest suite stays muted.

export function makeAudio() {
  let ctx = null, master = null, sfxG = null, musG = null;
  let muted = false, state = 'title', musTimer = 0, step16 = 0;
  let cfg = null;

  const states = {
    title: {
      bpm: 66, wave: 'sine', density: 0.32,
      chords: [[196, 246.9, 293.7], [174.6, 220, 261.6], [164.8, 207.6, 246.9], [146.8, 185, 220]],
      arp: [0, 2, 1, 2, 0, 1],
    },
    play: {
      bpm: 92, wave: 'triangle', density: 0.62,
      chords: [[220, 277.2, 329.6], [196, 246.9, 293.7], [174.6, 220, 261.6], [185, 233, 277.2]],
      arp: [0, 1, 2, 1, 2, 0],
    },
    tension: {
      bpm: 118, wave: 'triangle', density: 0.9,
      chords: [[196, 233, 293.7], [185, 220, 277.2], [174.6, 207.6, 261.6], [164.8, 196, 246.9]],
      arp: [0, 2, 1, 2, 0, 1],
    },
    end: {
      bpm: 58, wave: 'sine', density: 0.35,
      chords: [[174.6, 220, 261.6], [164.8, 207.6, 246.9], [146.8, 185, 220], [130.8, 164.8, 196]],
      arp: [0, 1, 2, 1],
    },
  };

  function ensure() {
    if (ctx) return true;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain(); master.gain.value = muted ? 0 : 1; master.connect(ctx.destination);
      sfxG = ctx.createGain(); sfxG.gain.value = 0.72; sfxG.connect(master);
      musG = ctx.createGain(); musG.gain.value = 0.19; musG.connect(master);
      return true;
    } catch (e) { return false; }
  }
  const now = () => ctx.currentTime;

  function tone({ f = 440, f2, type = 'sine', t = 0.2, v = 0.3, at = 0, decay = 0.12, dest }) {
    if (!ctx) return;
    const o = ctx.createOscillator(), g = ctx.createGain();
    const t0 = now() + at;
    o.type = type; o.frequency.setValueAtTime(f, t0);
    if (f2) o.frequency.exponentialRampToValueAtTime(Math.max(20, f2), t0 + t);
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(v, t0 + 0.012);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + t + decay);
    o.connect(g); g.connect(dest || sfxG);
    o.start(t0); o.stop(t0 + t + decay + 0.06);
  }

  function noise({ t = 0.18, v = 0.25, at = 0, f = 1200, q = 1, type = 'bandpass' }) {
    if (!ctx) return;
    const len = Math.max(8, Math.ceil(ctx.sampleRate * (t + 0.05)));
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.2);
    const src = ctx.createBufferSource(); src.buffer = buf;
    const flt = ctx.createBiquadFilter(); flt.type = type; flt.frequency.value = f; flt.Q.value = q;
    const g = ctx.createGain(); g.gain.value = v;
    src.connect(flt); flt.connect(g); g.connect(sfxG);
    src.start(now() + at);
  }

  const sfx = {
    ui() { if (ctx) tone({ f: 640, type: 'sine', t: 0.06, v: 0.16 }); },
    charge(t) {
      if (!ctx) return;
      tone({ f: 140 + t * 260, type: 'sawtooth', t: 0.1, v: 0.055 });
    },
    launch(power) {
      if (!ctx) return;
      tone({ f: 120 + power * 120, f2: 70, type: 'triangle', t: 0.24, v: 0.3 });
      noise({ t: 0.18, v: 0.16, f: 700 + power * 900, q: 0.7 });
    },
    flip(side) {
      if (!ctx) return;
      tone({ f: side === 'left' ? 300 : 360, f2: 170, type: 'square', t: 0.055, v: 0.11 });
      noise({ t: 0.045, v: 0.06, f: 2200, q: 1.4 });
    },
    bumper(key) {
      if (!ctx) return;
      const base = key === 'top' ? 560 : key === 'left' ? 470 : 510;
      tone({ f: base, f2: base * 0.55, type: 'triangle', t: 0.11, v: 0.26 });
      tone({ f: base * 1.5, type: 'sine', t: 0.06, v: 0.12, at: 0.025 });
      noise({ t: 0.08, v: 0.08, f: 1800, q: 1 });
    },
    target(n) {
      if (!ctx) return;
      tone({ f: 520 + n * 55, f2: 720 + n * 55, type: 'triangle', t: 0.12, v: 0.24 });
      noise({ t: 0.07, v: 0.09, f: 2500, q: 1.2 });
    },
    ring() {
      if (!ctx) return;
      [660, 880, 1100].forEach((f, i) => tone({ f, type: 'sine', t: 0.18, v: 0.14, at: i * 0.055 }));
    },
    sling() {
      if (!ctx) return;
      tone({ f: 220, f2: 420, type: 'square', t: 0.07, v: 0.12 });
      noise({ t: 0.06, v: 0.07, f: 1500, q: 0.9 });
    },
    wall(impact) {
      if (!ctx || impact < 180) return;
      tone({ f: 150 + Math.min(impact, 900) * 0.18, f2: 90, type: 'sine', t: 0.055, v: Math.min(0.16, impact / 9000) });
    },
    drain() {
      if (!ctx) return;
      [300, 240, 180, 130].forEach((f, i) => tone({ f, type: 'sawtooth', t: 0.16, v: 0.15, at: i * 0.12, decay: 0.22 }));
      noise({ t: 0.4, v: 0.1, f: 420, q: 0.6 });
    },
    group() {
      if (!ctx) return;
      [392, 523, 659, 784, 1046].forEach((f, i) => tone({ f, type: 'triangle', t: 0.22, v: 0.2, at: i * 0.075 }));
      noise({ t: 0.45, v: 0.1, f: 1200, q: 0.5 });
    },
    extra() {
      if (!ctx) return;
      [784, 988, 1175, 1568].forEach((f, i) => tone({ f, type: 'sine', t: 0.16, v: 0.17, at: i * 0.06 }));
    },
    multiball() {
      if (!ctx) return;
      tone({ f: 180, f2: 540, type: 'triangle', t: 0.3, v: 0.2 });
      [660, 880, 990].forEach((f, i) => tone({ f, type: 'sine', t: 0.16, v: 0.14, at: 0.1 + i * 0.06 }));
    },
    win() {
      if (!ctx) return;
      [262, 330, 392, 523, 659, 784, 1046].forEach((f, i) => tone({ f, type: 'triangle', t: 0.3, v: 0.19, at: i * 0.11, decay: 0.3 }));
      noise({ t: 0.8, v: 0.1, f: 2200, q: 0.4 });
    },
    lose() {
      if (!ctx) return;
      [349, 294, 247, 196, 147].forEach((f, i) => tone({ f, type: 'sawtooth', t: 0.28, v: 0.16, at: i * 0.16, decay: 0.34 }));
      noise({ t: 0.7, v: 0.09, f: 320, q: 0.5 });
    },
  };

  function musTick() {
    if (!ctx || muted) return;
    cfg = states[state] || states.play;
    const beat = 60 / cfg.bpm / 4;
    const bar = Math.floor(step16 / 16) % cfg.chords.length;
    const chord = cfg.chords[bar];
    const ai = cfg.arp[step16 % cfg.arp.length];
    if (step16 % 16 === 0) {
      for (const f of chord) tone({ f, type: cfg.wave, t: beat * 13, v: 0.05, decay: beat * 5, dest: musG });
      tone({ f: chord[0] / 2, type: 'sine', t: beat * 10, v: 0.05, decay: beat * 4, dest: musG });
    }
    if (step16 % 2 === 0 || Math.random() < cfg.density * 0.35) {
      const f = chord[ai] * (step16 % 16 === 14 ? 2 : 1);
      tone({ f, type: 'sine', t: beat * 1.5, v: 0.075, decay: beat * 2, dest: musG });
    }
    if (step16 % 4 === 2) tone({ f: 5200, type: 'square', t: 0.018, v: 0.018, dest: musG });
    step16++;
    musTimer = setTimeout(musTick, beat * 1000);
  }

  return {
    ensure,
    hasCtx() { return !!ctx; },
    unlock() { ensure(); },
    play(name, arg) { if (ctx && !muted && sfx[name]) sfx[name](arg); },
    setMuted(v) { muted = !!v; if (master) master.gain.value = muted ? 0 : 1; },
    isMuted() { return muted; },
    setState(s) { if (states[s] && s !== state) { state = s; step16 = 0; } },
    state() { return state; },
    tick() {
      if (!ctx || muted) { if (musTimer) { clearTimeout(musTimer); musTimer = 0; } return; }
      if (!musTimer) musTick();
    },
    stop() { if (musTimer) { clearTimeout(musTimer); musTimer = 0; } step16 = 0; },
  };
}
