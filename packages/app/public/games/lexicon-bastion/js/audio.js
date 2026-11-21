// Lexicon Bastion — fully synthesised WebAudio SFX and a frame-driven BGM.
// No samples, no network. AudioContext is created only after a real gesture
// (or an explicit debug/test unlock). Volume of the music bed is ~1/3 SFX.

export function makeAudio() {
  let ctx = null, master = null, sfxG = null, musG = null;
  let muted = false;
  let state = 'title';
  let beat = 0, step = 0, notes = 0;
  try { muted = localStorage.getItem('lxb.mute') === '1'; } catch (e) { }

  const BGM = {
    title:  { bpm: 60, chords: [[146.8, 196.0, 246.9], [130.8, 174.6, 220.0], [116.5, 155.6, 196.0], [130.8, 164.8, 207.6]], wave: 'sine', v: .030 },
    calm:   { bpm: 74, chords: [[174.6, 220.0, 261.6], [196.0, 246.9, 293.7], [155.6, 196.0, 246.9], [164.8, 207.6, 261.6]], wave: 'triangle', v: .034 },
    combat: { bpm: 104, chords: [[196.0, 246.9, 293.7], [174.6, 220.0, 261.6], [155.6, 207.6, 261.6], [185.0, 233.1, 277.2]], wave: 'triangle', v: .038 },
    boss:   { bpm: 126, chords: [[146.8, 185.0, 233.1], [155.6, 196.0, 246.9], [130.8, 174.6, 220.0]], wave: 'sawtooth', v: .040 },
    win:    { bpm: 82, chords: [[261.6, 329.6, 392.0], [293.7, 370.0, 440.0], [329.6, 415.3, 493.9], [349.2, 440.0, 523.3]], wave: 'sine', v: .042 },
    over:   { bpm: 48, chords: [[130.8, 164.8, 196.0], [116.5, 146.8, 174.6], [110.0, 138.6, 164.8], [98.0, 130.8, 155.6]], wave: 'sawtooth', v: .026 },
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
      musG = ctx.createGain(); musG.gain.value = .24; musG.connect(master);
      if (ctx.state === 'suspended') ctx.resume().catch(() => { });
      return true;
    } catch (e) { ctx = null; return false; }
  }
  const now = () => (ctx ? ctx.currentTime : 0);

  function tone(f, { f2, type = 'sine', t = .2, v = .2, at = 0, decay = .12, dest } = {}) {
    if (!ctx) return;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f, now() + at);
    if (f2) o.frequency.exponentialRampToValueAtTime(Math.max(24, f2), now() + at + t);
    g.gain.setValueAtTime(0.0001, now() + at);
    g.gain.linearRampToValueAtTime(Math.max(.0003, v), now() + at + .012);
    g.gain.exponentialRampToValueAtTime(.0001, now() + at + t + decay);
    o.connect(g); g.connect(dest || sfxG);
    o.start(now() + at); o.stop(now() + at + t + decay + .06);
  }
  function noise({ t = .16, v = .16, at = 0, f = 1200, q = 1, type = 'bandpass' } = {}) {
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
    ui() { tone(620, { type: 'sine', t: .05, v: .11 }); },
    key(progress = 0) {
      const f = 520 + Math.min(9, progress * 10) * 46;
      tone(f, { type: 'sine', t: .045, v: .085, decay: .05 });
      tone(f * 2, { type: 'sine', t: .03, v: .035, at: .005 });
    },
    error() {
      tone(180, { f2: 92, type: 'square', t: .11, v: .10 });
      noise({ t: .12, v: .08, f: 480, q: .7 });
    },
    word() {
      [660, 880, 1180].forEach((f, i) => tone(f, { type: 'sine', t: .11, v: .10, at: i * .045, decay: .18 }));
      noise({ t: .1, v: .05, f: 2400, q: 1.4 });
    },
    shot() {
      tone(1500, { f2: 380, type: 'triangle', t: .10, v: .09 });
      noise({ t: .07, v: .05, f: 1800, q: 1.2 });
    },
    hit() {
      tone(440, { f2: 210, type: 'square', t: .07, v: .075 });
      noise({ t: .06, v: .05, f: 900, q: .8 });
    },
    kill() {
      [520, 720, 980].forEach((f, i) => tone(f, { type: 'triangle', t: .10, v: .10, at: i * .035, decay: .14 }));
      noise({ t: .16, v: .08, f: 1400, q: .8 });
    },
    bossHit() {
      tone(95, { f2: 46, type: 'triangle', t: .28, v: .22 });
      noise({ t: .2, v: .12, f: 260, q: .6 });
    },
    shieldBreak() {
      tone(1250, { f2: 300, type: 'sawtooth', t: .14, v: .11 });
      noise({ t: .18, v: .10, f: 2600, q: 2 });
    },
    leak() {
      tone(300, { f2: 78, type: 'sawtooth', t: .34, v: .18 });
      noise({ t: .35, v: .14, f: 300, q: .5 });
    },
    wave() {
      [294, 392, 494, 587].forEach((f, i) => tone(f, { type: 'triangle', t: .16, v: .12, at: i * .08, decay: .22 }));
    },
    boss() {
      tone(120, { f2: 52, type: 'sawtooth', t: .7, v: .20 });
      noise({ t: .6, v: .10, f: 420, q: .5 });
      [196, 233].forEach((f, i) => tone(f, { type: 'sawtooth', t: .5, v: .08, at: .1 + i * .12 }));
    },
    upgrade() {
      [523, 659, 784, 1046].forEach((f, i) => tone(f, { type: 'sine', t: .13, v: .10, at: i * .06, decay: .18 }));
    },
    volley() {
      tone(180, { f2: 1500, type: 'sawtooth', t: .30, v: .12 });
      noise({ t: .35, v: .13, f: 2200, q: 1.5 });
    },
    victory() {
      [392, 523, 659, 784, 1046].forEach((f, i) => tone(f, { type: 'triangle', t: .22, v: .13, at: i * .11, decay: .30 }));
    },
    defeat() {
      [330, 262, 196, 147].forEach((f, i) => tone(f, { type: 'sawtooth', t: .30, v: .14, at: i * .18, decay: .30 }));
      noise({ t: .6, v: .10, f: 240, q: .5 });
    },
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
    if (step % 2 === 0) tone(f, { type: cfg.wave, t: each * 1.6, v: cfg.v, decay: each * 2.2, dest: musG });
    if (step % 16 === 0) {
      for (const n of chord) tone(n / 2, { type: 'sine', t: each * 12, v: cfg.v * .55, decay: each * 7, dest: musG });
    }
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
      try { localStorage.setItem('lxb.mute', muted ? '1' : '0'); } catch (e) { }
      return muted;
    },
    toggleMute() { return this.setMuted(!muted); },
    setState(s) { if (BGM[s] && s !== state) { state = s; step = 0; beat = 0; } },
    state: () => state,
    noteCount: () => notes,
    stop() { beat = 0; step = 0; },
  };
}
