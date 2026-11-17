// WebAudio synthesis: peg chimes (pitch ladder), purple zap, fever swell,
// bucket splash, lose; dreamy pad loop. No assets.

export function makeAudio() {
  let ctx = null, master = null, sfxG = null, musG = null;
  let muted = false, musTimer = 0, step16 = 0;
  const bpm = 84;
  const chords = [[261.6, 329.6, 392, 523.3], [233, 293.7, 349.2], [220, 277.2, 329.6], [196, 246.9, 293.7]];

  function ensure() {
    if (ctx) return true;
    try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return false; }
    master = ctx.createGain(); master.gain.value = muted ? 0 : 1; master.connect(ctx.destination);
    sfxG = ctx.createGain(); sfxG.gain.value = .8; sfxG.connect(master);
    musG = ctx.createGain(); musG.gain.value = .2; musG.connect(master);
    return true;
  }
  const now = () => ctx.currentTime;

  function tone({ f = 440, f2, type = 'sine', t = .2, v = .3, at = 0, decay = .12, dest }) {
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
    pegLadder(n) {
      if (!ctx) return;
      const scale = [523.3, 587.3, 659.3, 784, 880, 1046.5, 1174.7, 1318.5];
      const f = scale[Math.min(n - 1, scale.length - 1)];
      tone({ f, type: 'triangle', t: .12, v: .22 });
      tone({ f: f * 2, type: 'sine', t: .07, v: .08, at: .02 });
    },
    purple() { if (ctx) { tone({ f: 1400, f2: 600, type: 'sawtooth', t: .14, v: .2 }); tone({ f: 880, type: 'square', t: .08, v: .1, at: .05 }); } },
    launch() { if (ctx) { tone({ f: 340, f2: 660, type: 'sine', t: .1, v: .18 }); noise({ t: .06, v: .08, f: 2000 }); } },
    fever() {
      if (!ctx) return;
      [523, 659, 784, 1046, 1318].forEach((f, i) => tone({ f, type: 'triangle', t: .22, v: .2, at: i * .07 }));
      noise({ t: .5, v: .1, f: 3000, q: .5, at: .2 });
    },
    clear() { if (ctx) [523, 659, 784, 1046, 1568].forEach((f, i) => tone({ f, type: 'sine', t: .3, v: .2, at: i * .12 })); },
    bucket() { if (ctx) { tone({ f: 988, f2: 494, type: 'sine', t: .2, v: .22 }); noise({ t: .15, v: .1, f: 700, q: .6 }); } },
    lose() { if (ctx) [392, 330, 262, 196].forEach((f, i) => tone({ f, type: 'sawtooth', t: .24, v: .18, at: i * .17, decay: .3 })); },
    ui() { if (ctx) tone({ f: 660, type: 'sine', t: .06, v: .16 }); },
  };

  function musTick() {
    if (!ctx || muted) return;
    const beat = 60 / bpm / 4;
    const chord = chords[Math.floor(step16 / 16) % chords.length];
    if (step16 % 16 === 0) for (const f of chord) tone({ f, type: 'sine', t: beat * 16, v: .04, decay: beat * 8, dest: musG });
    if (step16 % 4 === 2) {
      const f = chord[(step16 / 4) % 4 | 0] * 2;
      tone({ f, type: 'triangle', t: beat * 2.4, v: .055, decay: beat * 1.6, dest: musG });
    }
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
