// audio.js — fully synthesized engine, SFX and a quiet starport synth loop.
// No samples, no external requests. AudioContext is only created after a gesture
// (or explicitly by the autotest suite).

export function makeAudio() {
  let ctx = null, master = null, sfxG = null, musG = null;
  let muted = false, musicState = 'title', musicTimer = 0, step = 0;
  let engOsc = null, engOsc2 = null, engGain = null, engFilter = null, engOn = false;
  const loaded = { engine: false, music: false, noise: false };
  let noiseBuf = null;

  const now = () => (ctx ? ctx.currentTime : 0);

  function ensure() {
    if (ctx) return true;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    try { ctx = new AC(); } catch (e) { return false; }
    master = ctx.createGain();
    master.gain.value = muted ? 0 : 1;
    master.connect(ctx.destination);
    sfxG = ctx.createGain(); sfxG.gain.value = .52; sfxG.connect(master);
    musG = ctx.createGain(); musG.gain.value = .13; musG.connect(master);
    const len = ctx.sampleRate | 0;
    noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    loaded.noise = true;
    // engine bus
    engGain = ctx.createGain(); engGain.gain.value = 0;
    engFilter = ctx.createBiquadFilter(); engFilter.type = 'lowpass'; engFilter.frequency.value = 460; engFilter.Q.value = 2.2;
    engGain.connect(engFilter); engFilter.connect(master);
    engOsc = ctx.createOscillator(); engOsc.type = 'sawtooth'; engOsc.frequency.value = 62;
    engOsc2 = ctx.createOscillator(); engOsc2.type = 'triangle'; engOsc2.frequency.value = 124;
    const g2 = ctx.createGain(); g2.gain.value = .35;
    engOsc.connect(engGain); engOsc2.connect(g2); g2.connect(engGain);
    engOsc.start(); engOsc2.start();
    loaded.engine = true;
    return true;
  }

  function tone({ f = 440, f2, type = 'sine', t = .18, v = .2, at = 0, decay = .1, dest }) {
    if (!ctx) return;
    const when = now() + at;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(Math.max(20, f), when);
    if (f2) o.frequency.exponentialRampToValueAtTime(Math.max(20, f2), when + t);
    g.gain.setValueAtTime(0, when);
    g.gain.linearRampToValueAtTime(v, when + .012);
    g.gain.exponentialRampToValueAtTime(.0008, when + t + decay);
    o.connect(g); g.connect(dest || sfxG);
    o.start(when); o.stop(when + t + decay + .04);
  }

  function noise({ t = .12, v = .18, at = 0, f = 1400, q = 1, dest }) {
    if (!ctx || !noiseBuf) return;
    const when = now() + at;
    const src = ctx.createBufferSource(); src.buffer = noiseBuf;
    const flt = ctx.createBiquadFilter(); flt.type = 'bandpass'; flt.frequency.value = f; flt.Q.value = q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(v, when);
    g.gain.exponentialRampToValueAtTime(.001, when + t);
    src.connect(flt); flt.connect(g); g.connect(dest || sfxG);
    src.start(when); src.stop(when + t + .03);
  }

  function engine(speed, boost, drift) {
    if (!ctx || !engGain) return;
    const s = Math.min(1, speed / 60);
    const f = 54 + s * 165 + (boost ? 36 : 0);
    engOsc.frequency.setTargetAtTime(f, now(), .07);
    engOsc2.frequency.setTargetAtTime(f * 2.02, now(), .07);
    engGain.gain.setTargetAtTime(muted ? 0 : .038 + s * .09, now(), .09);
    engFilter.frequency.setTargetAtTime(300 + s * 900 + (boost ? 500 : 0), now(), .08);
    if (drift && !engOn) { engOn = true; }
    if (!drift) engOn = false;
  }

  const sfx = {
    ui() { if (ctx) tone({ f: 620, f2: 760, type: 'sine', t: .06, v: .12 }); },
    count() { if (ctx) tone({ f: 440, type: 'triangle', t: .14, v: .2 }); },
    go() {
      if (!ctx) return;
      tone({ f: 660, type: 'triangle', t: .25, v: .24 });
      tone({ f: 990, type: 'sine', t: .3, v: .12, at: .06 });
    },
    pickup() {
      if (!ctx) return;
      [660, 880, 1320].forEach((f, i) => tone({ f, type: 'triangle', t: .1, v: .13, at: i * .045 }));
    },
    driftStart() { if (ctx) noise({ t: .2, v: .08, f: 1800, q: .7 }); },
    boost(level = 1) {
      if (!ctx) return;
      noise({ t: .28, v: .16, f: 1100 + level * 550, q: .5 });
      tone({ f: 180, f2: 520 + level * 160, type: 'sawtooth', t: .22, v: .08 });
    },
    missile() {
      if (!ctx) return;
      noise({ t: .3, v: .1, f: 2400, q: .8 });
      tone({ f: 900, f2: 320, type: 'square', t: .2, v: .055 });
    },
    hit() {
      if (!ctx) return;
      tone({ f: 120, f2: 42, type: 'sawtooth', t: .34, v: .25, decay: .18 });
      noise({ t: .18, v: .2, f: 500, q: .7 });
    },
    drop() { if (ctx) tone({ f: 210, f2: 95, type: 'square', t: .12, v: .09 }); },
    lap() {
      if (!ctx) return;
      [523, 659, 784].forEach((f, i) => tone({ f, type: 'triangle', t: .2, v: .15, at: i * .08 }));
    },
    win() {
      if (!ctx) return;
      [523, 659, 784, 1046, 1318].forEach((f, i) => tone({ f, type: 'triangle', t: .32, v: .15, at: i * .11 }));
    },
    lose() {
      if (!ctx) return;
      [392, 330, 262, 196].forEach((f, i) => tone({ f, type: 'sawtooth', t: .3, v: .1, at: i * .17, decay: .22 }));
    },
  };

  // Four-bar pattern, quiet, changes with state.
  function musicTick() {
    if (!ctx || muted) { musicTimer = 0; return; }
    const sets = {
      title: { root: 146.8, notes: [0, 7, 12, 15, 12, 7], bpm: 66 },
      race: { root: 174.6, notes: [0, 5, 7, 12, 7, 5, 3, 7], bpm: 104 },
      result: { root: 130.8, notes: [0, 4, 7, 11, 7, 4], bpm: 72 }
    };
    const s = sets[musicState] || sets.title;
    const beat = 60 / s.bpm;
    if (step % 4 === 0) {
      const bass = s.root / 2;
      tone({ f: bass, type: 'triangle', t: beat * 2.5, v: .07, decay: beat, dest: musG });
      tone({ f: s.root * 2, type: 'sine', t: beat * 3, v: .022, decay: beat * 1.5, dest: musG });
    }
    const note = s.notes[step % s.notes.length];
    const f = s.root * Math.pow(2, note / 12) * (step % 8 === 6 ? 2 : 1);
    tone({ f, type: 'sine', t: beat * 1.05, v: .036, decay: beat * .7, dest: musG });
    if (step % 2 === 1) noise({ t: .025, v: .015, f: 6400, q: .8, dest: musG });
    step++;
    musicTimer = setTimeout(musicTick, beat * 1000);
  }

  return {
    ensure,
    state: () => musicState,
    loaded,
    sfx,
    engine,
    hasCtx: () => !!ctx,
    isMuted: () => muted,
    setMuted(v) {
      muted = !!v;
      if (master) master.gain.setTargetAtTime(muted ? 0 : 1, now(), .02);
      if (engGain) engGain.gain.setTargetAtTime(muted ? 0 : .05, now(), .05);
      if (!muted) this.updateMusic(); else { clearTimeout(musicTimer); musicTimer = 0; }
    },
    setState(s) { if (s !== musicState) { musicState = s; step = 0; } },
    updateMusic() {
      if (!ctx || muted || musicTimer) return;
      musicTick();
    },
    stopEngine() { if (engGain) engGain.gain.setTargetAtTime(0, now(), .07); },
    dispose() {
      clearTimeout(musicTimer); musicTimer = 0;
      try { if (ctx) ctx.close(); } catch (e) {}
      ctx = null;
    }
  };
}
