// Aqua Conduit — fully synthesised WebAudio SFX + a small frame-driven BGM.
// No samples, no network requests. The AudioContext is only created after a
// real gesture (or an explicit debug unlock).
export function makeAudio() {
  let ctx = null, master = null, sfxG = null, musG = null;
  let muted = false;
  let state = 'title';
  let beat = 0, step = 0, notes = 0;
  try { muted = localStorage.getItem('aqc.mute') === '1'; } catch (e) { }

  const BGM = {
    title: { bpm: 60, chords: [[146.8, 196, 246.9], [130.8, 174.6, 220], [116.5, 155.6, 196], [130.8, 164.8, 207.6]], wave: 'sine', v: .030 },
    play: { bpm: 74, chords: [[174.6, 220, 261.6], [155.6, 196, 246.9], [146.8, 185, 233], [164.8, 207.6, 261.6]], wave: 'triangle', v: .034 },
    win: { bpm: 82, chords: [[261.6, 329.6, 392], [293.7, 370, 440], [329.6, 415.3, 493.9], [349.2, 440, 523.3]], wave: 'sine', v: .046 },
    fail: { bpm: 48, chords: [[130.8, 164.8, 196], [116.5, 146.8, 174.6], [110, 138.6, 164.8], [98, 130.8, 155.6]], wave: 'sawtooth', v: .023 },
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
      sfxG = ctx.createGain(); sfxG.gain.value = .72; sfxG.connect(master);
      musG = ctx.createGain(); musG.gain.value = .22; musG.connect(master);
      if (ctx.state === 'suspended') ctx.resume().catch(() => { });
      return true;
    } catch (e) { ctx = null; return false; }
  }
  const now = () => (ctx ? ctx.currentTime : 0);

  function tone(f, { f2, type = 'sine', t = .2, v = .2, at = 0, decay = .1, dest } = {}) {
    if (!ctx) return;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f, now() + at);
    if (f2) o.frequency.exponentialRampToValueAtTime(Math.max(24, f2), now() + at + t);
    g.gain.setValueAtTime(.0001, now() + at);
    g.gain.linearRampToValueAtTime(Math.max(.0002, v), now() + at + .012);
    g.gain.exponentialRampToValueAtTime(.0001, now() + at + t + decay);
    o.connect(g); g.connect(dest || sfxG);
    o.start(now() + at); o.stop(now() + at + t + decay + .06);
  }
  function noise({ t = .16, v = .18, at = 0, f = 1200, q = 1, type = 'bandpass' } = {}) {
    if (!ctx) return;
    const len = Math.ceil(ctx.sampleRate * (t + .04));
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
    ui() { if (ctx) tone(560, { type: 'sine', t: .05, v: .10 }); },
    rotate() {
      if (!ctx) return;
      tone(260, { f2: 190, type: 'triangle', t: .07, v: .13 });
      noise({ t: .08, v: .05, f: 1100, q: 1.4 });
    },
    reverse() {
      if (!ctx) return;
      tone(220, { f2: 300, type: 'triangle', t: .07, v: .12 });
      noise({ t: .07, v: .04, f: 900, q: 1.3 });
    },
    valveOpen() {
      if (!ctx) return;
      tone(420, { f2: 720, type: 'triangle', t: .14, v: .16 });
      tone(840, { t: .1, v: .08, at: .08 });
      noise({ t: .18, v: .06, f: 1800, q: 1.1 });
    },
    valveClosed() {
      if (!ctx) return;
      tone(180, { f2: 90, type: 'square', t: .16, v: .12 });
    },
    blocked() {
      if (!ctx) return;
      tone(150, { f2: 110, type: 'triangle', t: .12, v: .12 });
      noise({ t: .08, v: .05, f: 400, q: .8 });
    },
    splash() {
      if (!ctx) return;
      noise({ t: .24, v: .10, f: 2400, q: .9, type: 'highpass' });
      tone(680, { f2: 420, type: 'sine', t: .18, v: .07 });
    },
    mix() {
      if (!ctx) return;
      tone(233.1, { type: 'sawtooth', t: .25, v: .10 });
      tone(246.9, { type: 'sawtooth', t: .25, v: .10 });
      noise({ t: .22, v: .08, f: 700, q: .7 });
    },
    unlock() {
      if (!ctx) return;
      [392, 523, 659, 784].forEach((f, i) => tone(f, { type: 'sine', t: .16, v: .12, at: i * .08, decay: .2 }));
    },
    star() { if (ctx) tone(880, { type: 'sine', t: .2, v: .10, decay: .24 }); },
    win() {
      if (!ctx) return;
      [392, 523, 659, 784, 1046].forEach((f, i) => tone(f, { type: 'triangle', t: .2, v: .14, at: i * .09, decay: .28 }));
      noise({ t: .5, v: .06, f: 2600, q: 1.2, type: 'highpass' });
    },
    fail() {
      if (!ctx) return;
      [330, 262, 196, 147].forEach((f, i) => tone(f, { type: 'sawtooth', t: .24, v: .14, at: i * .16, decay: .3 }));
      noise({ t: .55, v: .10, f: 260, q: .5 });
    },
    level() { if (ctx) [440, 587, 740].forEach((f, i) => tone(f, { type: 'sine', t: .1, v: .08, at: i * .05 })); },
  };

  function update(dt) {
    if (!ctx || muted) return;
    const cfg = BGM[state] || BGM.title;
    beat -= dt;
    if (beat > 0) return;
    const each = 60 / cfg.bpm / 4;
    beat = Math.max(.06, each);
    const chord = cfg.chords[Math.floor(step / 16) % cfg.chords.length];
    const pat = [0, 1, 2, 1, 0, 2, 1, 2];
    const f = chord[pat[step % pat.length]] * (step % 8 === 6 ? 2 : 1);
    if (step % 2 === 0) tone(f, { type: cfg.wave, t: each * 1.7, v: cfg.v, decay: each * 2.5, dest: musG });
    if (step % 16 === 0) for (const n of chord) tone(n / 2, { type: 'sine', t: each * 12, v: cfg.v * .5, decay: each * 7, dest: musG });
    if (state === 'play' && step % 8 === 2) noise({ t: .05, v: .018, f: 2800, q: 2 });
    notes++;
    step = (step + 1) % 64;
  }

  return {
    ensure, update, sfx,
    hasCtx: () => !!ctx,
    isMuted: () => muted,
    setMuted(v) {
      muted = !!v;
      if (master) master.gain.value = muted ? 0 : 1;
      try { localStorage.setItem('aqc.mute', muted ? '1' : '0'); } catch (e) { }
      return muted;
    },
    toggleMute() { return this.setMuted(!muted); },
    setMutedSilent(v) {
      muted = !!v;
      if (master) master.gain.value = muted ? 0 : 1;
      return muted;
    },
    setState(s) { if (BGM[s] && s !== state) { state = s; step = 0; beat = 0; } },
    state: () => state,
    noteCount: () => notes,
    stop() { beat = 0; step = 0; },
  };
}
