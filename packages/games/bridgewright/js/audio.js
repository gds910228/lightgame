// Bridgewright — fully synthesised WebAudio SFX + a small frame-driven BGM
// sequencer. No samples, no network. The AudioContext is only created after a
// real user gesture (or explicit debug/test unlock).

export function makeAudio() {
  let ctx = null, master = null, sfxG = null, musG = null;
  let muted = false;
  let state = 'title';
  let beat = 0;
  let step = 0;
  let notes = 0;
  try { muted = localStorage.getItem('brw.mute') === '1'; } catch (e) { }

  const BGM = {
    title: { bpm: 64, chords: [[146.8, 196, 246.9], [130.8, 174.6, 220], [116.5, 155.6, 196], [130.8, 164.8, 207.6]], wave: 'sine', v: .035 },
    build: { bpm: 72, chords: [[174.6, 220, 261.6], [155.6, 196, 246.9], [146.8, 185, 233], [130.8, 174.6, 220]], wave: 'triangle', v: .032 },
    test: { bpm: 92, chords: [[196, 233, 293.7], [174.6, 220, 261.6], [146.8, 196, 246.9], [155.6, 207.6, 261.6]], wave: 'triangle', v: .04 },
    win: { bpm: 78, chords: [[261.6, 329.6, 392], [293.7, 370, 440], [329.6, 415.3, 493.9], [349.2, 440, 523.3]], wave: 'sine', v: .045 },
    fail: { bpm: 52, chords: [[130.8, 164.8, 196], [116.5, 146.8, 174.6], [110, 138.6, 164.8], [98, 130.8, 155.6]], wave: 'sawtooth', v: .025 },
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
      sfxG = ctx.createGain(); sfxG.gain.value = .7; sfxG.connect(master);
      musG = ctx.createGain(); musG.gain.value = .25; musG.connect(master);
      if (ctx.state === 'suspended') ctx.resume().catch(() => { });
      return true;
    } catch (e) { ctx = null; return false; }
  }
  const now = () => (ctx ? ctx.currentTime : 0);

  function tone(f, { f2, type = 'sine', t = .2, v = .2, at = 0, decay = .1, dest } = {}) {
    if (!ctx || !dest) return;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f, now() + at);
    if (f2) o.frequency.exponentialRampToValueAtTime(Math.max(24, f2), now() + at + t);
    g.gain.setValueAtTime(0.0001, now() + at);
    g.gain.linearRampToValueAtTime(Math.max(.0002, v), now() + at + .012);
    g.gain.exponentialRampToValueAtTime(.0001, now() + at + t + decay);
    o.connect(g); g.connect(dest);
    o.start(now() + at); o.stop(now() + at + t + decay + .06);
  }
  function noise({ t = .16, v = .18, at = 0, f = 1200, q = 1 } = {}) {
    if (!ctx) return;
    const len = Math.ceil(ctx.sampleRate * (t + .04));
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.2);
    const src = ctx.createBufferSource(); src.buffer = buf;
    const flt = ctx.createBiquadFilter(); flt.type = 'bandpass'; flt.frequency.value = f; flt.Q.value = q;
    const g = ctx.createGain(); g.gain.value = v;
    src.connect(flt); flt.connect(g); g.connect(sfxG);
    src.start(now() + at);
  }

  const sfx = {
    click() { if (ctx) tone(560, { type: 'sine', t: .05, v: .12, dest: sfxG }); },
    place() {
      if (!ctx) return;
      tone(240, { f2: 150, type: 'triangle', t: .1, v: .16, dest: sfxG });
      noise({ t: .12, v: .10, f: 900, q: .8 });
    },
    cable() { if (ctx) { tone(700, { f2: 980, type: 'sine', t: .12, v: .12, dest: sfxG }); noise({ t: .1, v: .04, f: 2600, q: 2 }); } },
    pillar() { if (ctx) { tone(90, { f2: 55, type: 'triangle', t: .28, v: .22, dest: sfxG }); noise({ t: .2, v: .15, f: 420, q: .7 }); } },
    undo() { if (ctx) tone(430, { f2: 300, type: 'sine', t: .1, v: .12, dest: sfxG }); },
    start() {
      if (!ctx) return;
      [220, 330, 440].forEach((f, i) => tone(f, { type: 'triangle', t: .12, v: .11, at: i * .07, dest: sfxG }));
    },
    stress(sev = .7) {
      if (!ctx) return;
      const s = Math.max(.5, Math.min(1.1, sev));
      tone(430 + s * 340, { f2: (430 + s * 340) * .72, type: 'square', t: .05, v: .028 + s * .05, dest: sfxG });
      tone(150 + s * 70, { f2: 105, type: 'triangle', t: .13, v: .04 + s * .045, dest: sfxG });
    },
    snap() { if (ctx) { noise({ t: .22, v: .22, f: 700 + Math.random() * 900, q: .6 }); tone(180, { f2: 70, type: 'sawtooth', t: .18, v: .14, dest: sfxG }); } },
    fail() {
      if (!ctx) return;
      [330, 262, 196, 147].forEach((f, i) => tone(f, { type: 'sawtooth', t: .22, v: .15, at: i * .17, decay: .25, dest: sfxG }));
      noise({ t: .5, v: .12, f: 280, q: .5 });
    },
    win() {
      if (!ctx) return;
      [392, 523, 659, 784, 1046].forEach((f, i) => tone(f, { type: 'triangle', t: .18, v: .14, at: i * .09, decay: .25, dest: sfxG }));
    },
    star() { if (ctx) tone(880, { type: 'sine', t: .18, v: .12, decay: .2, dest: sfxG }); },
    level() { if (ctx) [440, 587, 740].forEach((f, i) => tone(f, { type: 'sine', t: .1, v: .09, at: i * .05, dest: sfxG })); },
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
    if (step % 2 === 0) {
      tone(f, { type: cfg.wave, t: each * 1.65, v: cfg.v, decay: each * 2.4, dest: musG });
    }
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
      try { localStorage.setItem('brw.mute', muted ? '1' : '0'); } catch (e) { }
      return muted;
    },
    toggleMute() { return this.setMuted(!muted); },
    setState(s) { if (BGM[s] && s !== state) { state = s; step = 0; beat = 0; } },
    state: () => state,
    noteCount: () => notes,
    stop() { beat = 0; step = 0; },
  };
}
