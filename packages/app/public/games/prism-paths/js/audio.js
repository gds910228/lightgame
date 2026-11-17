// WebAudio synthesis for Prism Paths: rotate/undo/win/extend sfx + ambient pad.

export function makeAudio() {
  let ctx = null, master = null, sfxG = null, musG = null;
  let muted = false, musTimer = 0, step16 = 0;
  const bpm = 66;
  const chords = [[220, 277.2, 329.6], [196, 246.9, 293.7], [174.6, 220, 261.6], [196, 233, 293.7]];

  function ensure() {
    if (ctx) return true;
    try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return false; }
    master = ctx.createGain(); master.gain.value = muted ? 0 : 1; master.connect(ctx.destination);
    sfxG = ctx.createGain(); sfxG.gain.value = .8; sfxG.connect(master);
    musG = ctx.createGain(); musG.gain.value = .16; musG.connect(master);
    return true;
  }
  const now = () => ctx.currentTime;

  function tone({ f = 440, f2, type = 'sine', t = .2, v = .3, at = 0, decay = .1, dest }) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(f, now() + at);
    if (f2) o.frequency.exponentialRampToValueAtTime(Math.max(20, f2), now() + at + t);
    g.gain.setValueAtTime(0, now() + at);
    g.gain.linearRampToValueAtTime(v, now() + at + .01);
    g.gain.exponentialRampToValueAtTime(.001, now() + at + t + decay);
    o.connect(g); g.connect(dest || sfxG);
    o.start(now() + at); o.stop(now() + at + t + decay + .05);
  }
  function noise({ t = .15, v = .2, at = 0, f = 1000, q = .8 }) {
    const len = Math.ceil(ctx.sampleRate * (t + .05));
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2);
    const src = ctx.createBufferSource(); src.buffer = buf;
    const flt = ctx.createBiquadFilter(); flt.type = 'bandpass'; flt.frequency.value = f; flt.Q.value = q;
    const g = ctx.createGain(); g.gain.value = v;
    src.connect(flt); flt.connect(g); g.connect(sfxG);
    src.start(now() + at);
  }

  const sfx = {
    rotate() { if (ctx) tone({ f: 480, f2: 620, type: 'sine', t: .08, v: .18 }); },
    undo() { if (ctx) tone({ f: 620, f2: 480, type: 'sine', t: .08, v: .16 }); },
    win() {
      if (!ctx) return;
      [523, 659, 784, 1046].forEach((f, i) => tone({ f, type: 'triangle', t: .16, v: .2, at: i * .07 }));
      noise({ t: .3, v: .08, f: 2400, q: .6, at: .1 });
    },
    bigwin() { if (ctx) [523, 659, 784, 1046, 1318].forEach((f, i) => tone({ f, type: 'triangle', t: .25, v: .22, at: i * .12 })); },
    ui() { if (ctx) tone({ f: 620, type: 'sine', t: .06, v: .16 }); },
  };

  function musTick() {
    if (!ctx || muted) return;
    const beat = 60 / bpm / 4;
    const chord = chords[Math.floor(step16 / 16) % chords.length];
    if (step16 % 16 === 0) for (const f of chord) tone({ f, type: 'sine', t: beat * 18, v: .045, decay: beat * 8, dest: musG });
    if (step16 % 8 === 4) tone({ f: chord[2] * 2, type: 'triangle', t: beat * 3, v: .05, decay: beat * 2, dest: musG });
    step16++;
    musTimer = setTimeout(musTick, beat * 1000);
  }

  return {
    ensure,
    setMuted(v) { muted = v; if (master) master.gain.value = v ? 0 : 1; },
    isMuted() { return muted; },
    hasCtx() { return !!ctx; },
    update() {
      if (!ctx) return;
      if (muted) { clearTimeout(musTimer); musTimer = 0; return; }
      if (!musTimer) musTick();
    },
    stop() { clearTimeout(musTimer); musTimer = 0; step16 = 0; },
    sfx,
  };
}
