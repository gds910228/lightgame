// Shadowspire Ninja — fully synthesised WebAudio score and SFX.
// No samples, no network. AudioContext is only created after a real gesture.
// The autotest harness keeps everything muted.

export function makeAudio(opts = {}) {
  const AUTOTEST = !!opts.autotest;
  let ctx = null, master = null, sfxBus = null, musBus = null;
  let muted = AUTOTEST;
  let musicState = 'title';
  let step = 0, timer = 0;
  let noiseBuf = null;

  try {
    if (!AUTOTEST) muted = localStorage.getItem('ssn.mute') === '1';
  } catch (e) { }

  const states = {
    title: { bpm: 68, root: 196.0, mode: [0, 3, 5, 7, 10], wave: 'sine', density: 0.46, bass: 0.32 },
    wood: { bpm: 92, root: 220.0, mode: [0, 2, 5, 7, 9], wave: 'triangle', density: 0.64, bass: 0.46 },
    wind: { bpm: 104, root: 246.94, mode: [0, 3, 5, 7, 10], wave: 'sine', density: 0.7, bass: 0.4 },
    star: { bpm: 116, root: 261.63, mode: [0, 2, 4, 7, 9], wave: 'triangle', density: 0.78, bass: 0.48 },
    danger: { bpm: 128, root: 174.61, mode: [0, 1, 5, 6, 8], wave: 'sawtooth', density: 0.92, bass: 0.62 },
    win: { bpm: 88, root: 293.66, mode: [0, 4, 7, 11], wave: 'sine', density: 0.54, bass: 0.28 },
  };

  function ensure() {
    if (ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : 0.82;
    master.connect(ctx.destination);
    sfxBus = ctx.createGain();
    sfxBus.gain.value = 0.72;
    sfxBus.connect(master);
    musBus = ctx.createGain();
    musBus.gain.value = 0.2;
    musBus.connect(master);
  }

  function unlock() {
    if (AUTOTEST) return;
    ensure();
    if (ctx && ctx.state === 'suspended') {
      ctx.resume().catch(() => { });
    }
  }

  function setMuted(v, persist = true) {
    muted = !!v;
    if (master) master.gain.value = muted ? 0 : 0.82;
    if (persist) {
      try { localStorage.setItem('ssn.mute', muted ? '1' : '0'); } catch (e) { }
    }
  }
  function toggleMute() {
    ensure();
    setMuted(!muted);
    return muted;
  }

  const now = () => ctx.currentTime;

  function tone(f, o = {}) {
    if (!ctx) return;
    const t0 = now() + (o.at || 0);
    const dur = o.t || 0.18;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = o.type || 'sine';
    osc.frequency.setValueAtTime(Math.max(20, f), t0);
    if (o.f2) osc.frequency.exponentialRampToValueAtTime(Math.max(20, o.f2), t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(o.v == null ? 0.22 : o.v, t0 + Math.min(0.014, dur * 0.2));
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur + 0.035);
    osc.connect(g);
    g.connect(o.dest || sfxBus);
    osc.start(t0);
    osc.stop(t0 + dur + 0.06);
  }

  function noise(o = {}) {
    if (!ctx) return;
    const dur = o.t || 0.2;
    if (!noiseBuf) {
      const len = Math.floor(ctx.sampleRate * 0.6);
      noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    }
    const t0 = now() + (o.at || 0);
    const src = ctx.createBufferSource();
    src.buffer = noiseBuf;
    const f = ctx.createBiquadFilter();
    f.type = o.filter || 'bandpass';
    f.frequency.setValueAtTime(o.f || 900, t0);
    if (o.f2) f.frequency.exponentialRampToValueAtTime(Math.max(30, o.f2), t0 + dur);
    f.Q.value = o.q == null ? 1 : o.q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(o.v == null ? 0.18 : o.v, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(f); f.connect(g); g.connect(o.dest || sfxBus);
    src.start(t0);
    src.stop(t0 + dur + 0.03);
  }

  const S = {
    ui: () => { tone(680, { t: 0.05, v: 0.1, type: 'triangle' }); tone(980, { t: 0.05, v: 0.06, at: 0.035 }); },
    jump: () => { tone(310, { f2: 560, t: 0.12, v: 0.16, type: 'triangle' }); noise({ t: 0.08, v: 0.05, f: 1900, f2: 800 }); },
    land: () => { tone(105, { f2: 62, t: 0.09, v: 0.22, type: 'sine' }); noise({ t: 0.07, v: 0.06, f: 420 }); },
    wall: () => { tone(430, { f2: 610, t: 0.09, v: 0.12, type: 'square' }); noise({ t: 0.1, v: 0.09, f: 2200, f2: 700 }); },
    dash: () => { noise({ t: 0.22, v: 0.19, f: 2600, f2: 220, filter: 'bandpass', q: 0.8 }); tone(180, { f2: 90, t: 0.16, v: 0.13, type: 'sawtooth' }); },
    dashNo: () => { tone(160, { f2: 120, t: 0.09, v: 0.08, type: 'square' }); },
    dust: () => { tone(1180, { t: 0.1, v: 0.13, type: 'sine' }); tone(1770, { t: 0.13, v: 0.09, at: 0.045 }); tone(2360, { t: 0.09, v: 0.05, at: 0.085 }); },
    hurt: () => { tone(220, { f2: 48, t: 0.28, v: 0.33, type: 'sawtooth' }); noise({ t: 0.25, v: 0.24, f: 340, f2: 80 }); },
    checkpoint: () => { [392, 523.25, 659.25, 784].forEach((f, i) => tone(f, { t: 0.3, v: 0.14, at: i * 0.09, type: 'sine' })); },
    flow: () => { [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => tone(f, { t: 0.22, v: 0.15, at: i * 0.055, type: 'triangle' })); noise({ t: 0.3, v: 0.08, f: 2500, f2: 600 }); },
    wallDash: () => { tone(740, { f2: 1480, t: 0.16, v: 0.16, type: 'triangle' }); tone(1110, { t: 0.1, v: 0.1, at: 0.05 }); noise({ t: 0.16, v: 0.08, f: 3000, f2: 1000 }); },
    win: () => { [392, 523.25, 659.25, 783.99, 1046.5, 1318.5].forEach((f, i) => tone(f, { t: 0.5, v: 0.16, at: i * 0.13, type: 'sine' })); },
    over: () => { [392, 329.63, 261.63, 196].forEach((f, i) => tone(f, { t: 0.55, v: 0.17, at: i * 0.15, type: 'triangle' })); noise({ t: 0.7, v: 0.12, f: 300, f2: 80 }); },
  };

  function play(name) {
    if (!ctx || muted) return;
    const fn = S[name];
    if (fn) fn();
  }

  function setState(name) {
    if (states[name] && musicState !== name) {
      musicState = name;
      timer = 0;
      step = 0;
    }
  }

  // 16-step pentatonic scheduler. Very quiet pads, plucked lead, breath noise.
  function tick(dt) {
    if (!ctx || muted) return;
    const st = states[musicState] || states.title;
    const stepDur = 60 / st.bpm / 4;
    timer += dt;
    let guard = 0;
    while (timer >= stepDur && guard++ < 8) {
      timer -= stepDur;
      const s = step++ % 16;
      const bar = Math.floor(step / 16);
      const bass = st.root / 2 * Math.pow(2, st.mode[bar % st.mode.length] / 12);
      if (s === 0) {
        tone(bass, { t: stepDur * 6, v: st.bass * 0.1, type: 'sine', dest: musBus });
        tone(bass * 2, { t: stepDur * 4, v: st.bass * 0.045, type: 'triangle', dest: musBus, at: 0.04 });
      }
      const seq = [0, 2, 1, 3, 2, 4, 3, 1];
      const note = st.root * 2 * Math.pow(2, st.mode[seq[(s + bar) % seq.length]] / 12);
      if (Math.random() < st.density * 0.5 && s % 2 === 0) {
        tone(note, {
          t: stepDur * 2.1, v: 0.045, type: st.wave === 'sawtooth' ? 'square' : st.wave,
          dest: musBus,
        });
      }
      if (s === 6 || (musicState !== 'title' && s === 14 && Math.random() < 0.45)) {
        noise({ t: 0.08, v: musicState === 'danger' ? 0.055 : 0.025, f: 1400, filter: 'highpass', dest: musBus });
      }
      if (musicState === 'danger' && s % 4 === 0) {
        tone(bass, { t: stepDur * 1.3, v: 0.06, type: 'triangle', dest: musBus });
      }
    }
  }

  return {
    unlock,
    ensure,
    play,
    tick,
    setState,
    get state() { return musicState; },
    get muted() { return muted; },
    get hasCtx() { return !!ctx; },
    setMuted,
    toggleMute,
  };
}
