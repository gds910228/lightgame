// Ironwright Arena — fully synthesized WebAudio. No samples and no network.
// The AudioContext is only created after a real gesture; the autotest suite
// never unlocks it and therefore stays silent.

export function makeAudio() {
  let ctx = null, master = null, sfxG = null, musG = null;
  let muted = false, state = 'title', musTimer = 0, step16 = 0;
  let cfg = null;

  const states = {
    title: {
      bpm: 64, wave: 'sine', density: 0.30,
      chords: [[174.6, 220, 261.6], [164.8, 207.6, 246.9], [146.8, 185, 220], [138.6, 174.6, 207.6]],
      arp: [0, 2, 1, 2, 0, 1],
    },
    forge: {
      bpm: 78, wave: 'triangle', density: 0.42,
      chords: [[196, 246.9, 293.7], [174.6, 220, 261.6], [164.8, 207.6, 246.9], [185, 233, 277.2]],
      arp: [0, 1, 2, 1, 0, 2],
    },
    combat: {
      bpm: 108, wave: 'triangle', density: 0.72,
      chords: [[220, 277.2, 329.6], [196, 246.9, 293.7], [174.6, 220, 261.6], [185, 233, 277.2]],
      arp: [0, 2, 1, 2, 0, 1, 2, 1],
    },
    boss: {
      bpm: 132, wave: 'sawtooth', density: 0.9,
      chords: [[146.8, 174.6, 220], [155.6, 196, 233], [146.8, 185, 220], [130.8, 164.8, 196]],
      arp: [0, 1, 2, 0, 1, 2, 1, 0],
    },
    end: {
      bpm: 56, wave: 'sine', density: 0.28,
      chords: [[174.6, 220, 261.6], [164.8, 207.6, 246.9], [146.8, 185, 220]],
      arp: [0, 2, 1, 0],
    },
  };

  function ensure() {
    if (ctx) return true;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain(); master.gain.value = muted ? 0 : 1; master.connect(ctx.destination);
      sfxG = ctx.createGain(); sfxG.gain.value = 0.70; sfxG.connect(master);
      musG = ctx.createGain(); musG.gain.value = 0.18; musG.connect(master);
      return true;
    } catch (e) { return false; }
  }
  const now = () => ctx.currentTime;

  function tone({ f = 440, f2, type = 'sine', t = 0.2, v = 0.3, at = 0, decay = 0.1, dest }) {
    if (!ctx) return;
    const o = ctx.createOscillator(), g = ctx.createGain();
    const t0 = now() + at;
    o.type = type; o.frequency.setValueAtTime(Math.max(20, f), t0);
    if (f2) o.frequency.exponentialRampToValueAtTime(Math.max(20, f2), t0 + Math.max(0.02, t));
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(v, t0 + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + Math.max(0.04, t + decay));
    o.connect(g); g.connect(dest || sfxG);
    o.start(t0); o.stop(t0 + t + decay + 0.08);
  }

  function noise({ t = 0.18, v = 0.25, at = 0, f = 1200, q = 1, type = 'bandpass' }) {
    if (!ctx) return;
    const len = Math.max(8, Math.ceil(ctx.sampleRate * (t + 0.05)));
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.1);
    const src = ctx.createBufferSource(); src.buffer = buf;
    const flt = ctx.createBiquadFilter(); flt.type = type; flt.frequency.value = f; flt.Q.value = q;
    const g = ctx.createGain(); g.gain.value = v;
    src.connect(flt); flt.connect(g); g.connect(sfxG);
    src.start(now() + at);
  }

  const sfx = {
    ui() { tone({ f: 620, type: 'sine', t: 0.05, v: 0.12 }); },
    select() { tone({ f: 420, f2: 620, type: 'triangle', t: 0.08, v: 0.15 }); },
    confirm() { tone({ f: 196, f2: 392, type: 'triangle', t: 0.22, v: 0.24 }); tone({ f: 784, type: 'sine', t: 0.16, v: 0.12, at: 0.1 }); },
    fireAuto() { tone({ f: 280, f2: 120, type: 'square', t: 0.045, v: 0.12 }); noise({ t: 0.035, v: 0.05, f: 2600, q: 1.2 }); },
    fireHeavy() { tone({ f: 150, f2: 62, type: 'triangle', t: 0.13, v: 0.24 }); noise({ t: 0.09, v: 0.08, f: 900 }); },
    missile() { tone({ f: 480, f2: 180, type: 'sawtooth', t: 0.2, v: 0.12 }); noise({ t: 0.2, v: 0.08, f: 1600 }); },
    beam() { tone({ f: 880, f2: 700, type: 'sine', t: 0.08, v: 0.06 }); },
    slash() { noise({ t: 0.16, v: 0.18, f: 2400, type: 'highpass', q: 0.6 }); tone({ f: 300, f2: 900, type: 'sawtooth', t: 0.13, v: 0.12 }); },
    hit() { tone({ f: 820, f2: 480, type: 'square', t: 0.035, v: 0.09 }); noise({ t: 0.025, v: 0.05, f: 3000 }); },
    bossHit() { tone({ f: 120, f2: 70, type: 'triangle', t: 0.06, v: 0.1 }); },
    boom() { noise({ t: 0.4, v: 0.26, f: 360 }); tone({ f: 100, f2: 38, type: 'triangle', t: 0.36, v: 0.3 }); },
    dash() { tone({ f: 220, f2: 760, type: 'sawtooth', t: 0.16, v: 0.18 }); noise({ t: 0.16, v: 0.09, f: 1800 }); },
    barrier() { [392, 523, 659].forEach((f, i) => tone({ f, type: 'sine', t: 0.22, v: 0.14, at: i * 0.04 })); noise({ t: 0.2, v: 0.07, f: 3000, type: 'highpass' }); },
    overheat() { tone({ f: 700, f2: 120, type: 'sawtooth', t: 0.32, v: 0.22 }); noise({ t: 0.25, v: 0.16, f: 800 }); },
    hurt() { noise({ t: 0.3, v: 0.24, f: 200 }); tone({ f: 160, f2: 60, type: 'sawtooth', t: 0.26, v: 0.24 }); },
    repair() { [330, 440, 660].forEach((f, i) => tone({ f, type: 'sine', t: 0.2, v: 0.12, at: i * 0.08 })); noise({ t: 0.25, v: 0.06, f: 1900 }); },
    coin() { tone({ f: 980, type: 'triangle', t: 0.07, v: 0.1 }); tone({ f: 1320, type: 'sine', t: 0.09, v: 0.09, at: 0.05 }); },
    bossDown() { noise({ t: 0.9, v: 0.35, f: 220 }); tone({ f: 90, f2: 28, type: 'sawtooth', t: 0.9, v: 0.32 }); [523, 659, 784, 1046].forEach((f, i) => tone({ f, type: 'triangle', t: 0.3, v: 0.16, at: 0.35 + i * 0.1 })); },
    win() { [262, 330, 392, 523, 659, 784, 1046].forEach((f, i) => tone({ f, type: 'triangle', t: 0.3, v: 0.18, at: i * 0.1, decay: 0.26 })); noise({ t: 0.8, v: 0.08, f: 2400, q: 0.4 }); },
    lose() { [349, 294, 247, 196, 147].forEach((f, i) => tone({ f, type: 'sawtooth', t: 0.3, v: 0.15, at: i * 0.15, decay: 0.3 })); noise({ t: 0.7, v: 0.08, f: 300 }); },
  };

  function musTick() {
    if (!ctx || muted) { musTimer = 0; return; }
    cfg = states[state] || states.combat;
    const beat = 60 / cfg.bpm / 4;
    const bar = Math.floor(step16 / 16) % cfg.chords.length;
    const chord = cfg.chords[bar];
    const ai = cfg.arp[step16 % cfg.arp.length];
    if (step16 % 16 === 0) {
      for (const f of chord) tone({ f, type: cfg.wave === 'sawtooth' ? 'sawtooth' : cfg.wave, t: beat * 13, v: 0.045, decay: beat * 4, dest: musG });
      tone({ f: chord[0] / 2, type: 'sine', t: beat * 11, v: 0.05, decay: beat * 4, dest: musG });
    }
    if (step16 % 2 === 0 || Math.random() < cfg.density * 0.3) {
      tone({ f: chord[ai] * (step16 % 16 === 14 ? 2 : 1), type: 'sine', t: beat * 1.5, v: 0.065, decay: beat * 2, dest: musG });
    }
    if (state === 'boss' && step16 % 4 === 0) noise({ t: 0.07, v: 0.06, f: 180, dest: musG });
    step16++;
    musTimer = setTimeout(musTick, beat * 1000);
  }

  function startMusic() {
    if (musTimer || !ctx || muted) return;
    musTick();
  }

  return {
    ensure,
    hasCtx() { return !!ctx; },
    unlock() { if (ensure()) { if (ctx.state === 'suspended') ctx.resume(); startMusic(); } },
    play(name) { if (ctx && !muted && sfx[name]) sfx[name](); },
    setMuted(v) {
      muted = !!v;
      if (master) master.gain.value = muted ? 0 : 1;
      if (muted) { if (musTimer) { clearTimeout(musTimer); musTimer = 0; } }
      else startMusic();
    },
    isMuted() { return muted; },
    setState(s) {
      if (!states[s]) return;
      if (state !== s) { state = s; step16 = 0; if (ctx && !muted && !musTimer) startMusic(); }
    },
    state() { return state; },
    tick() { /* scheduler self-drives with setTimeout */ },
    stop() { if (musTimer) { clearTimeout(musTimer); musTimer = 0; } step16 = 0; },
  };
}
