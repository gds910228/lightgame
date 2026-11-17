// WebAudio synthesis: SFX (drop/merge/combo/lose/ui/firework) + two-state
// music loop (calm / danger) with soft crossfade. All synthesized, no assets.
// BGM volume kept ≈ 1/4 of SFX per skill vfx-ui-audio guidance.

export function makeAudio() {
  let ctx = null, master = null, sfxG = null, musG = null;
  let muted = false, state = 'calm', musTimer = 0, step16 = 0;
  const states = {
    calm:   { bpm: 76, chords: [[220, 277.2, 329.6], [174.6, 220, 261.6], [196, 246.9, 293.7], [164.8, 207.6, 246.9]], arp: [0, 1, 2, 1], density: .4, wave: 'sine' },
    danger: { bpm: 108, chords: [[196, 233, 293.7], [185, 220, 277.2], [174.6, 207.6, 261.6], [164.8, 196, 246.9]], arp: [0, 2, 1, 2, 0, 1], density: .85, wave: 'triangle' },
  };

  function ensure() {
    if (ctx) return true;
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
    } catch (e) { return false; }
    master = ctx.createGain(); master.gain.value = muted ? 0 : 1; master.connect(ctx.destination);
    sfxG = ctx.createGain(); sfxG.gain.value = .8; sfxG.connect(master);
    musG = ctx.createGain(); musG.gain.value = .22; musG.connect(master);
    return true;
  }
  const now = () => ctx.currentTime;

  function tone({ f = 440, f2, type = 'sine', t = .2, v = .3, at = 0, decay = .12, dest }) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(f, now() + at);
    if (f2) o.frequency.exponentialRampToValueAtTime(Math.max(20, f2), now() + at + t);
    g.gain.setValueAtTime(0, now() + at);
    g.gain.linearRampToValueAtTime(v, now() + at + .012);
    g.gain.exponentialRampToValueAtTime(.001, now() + at + t + decay);
    o.connect(g); g.connect(dest || sfxG);
    o.start(now() + at); o.stop(now() + at + t + decay + .05);
  }
  function noise({ t = .18, v = .25, at = 0, f = 1200, q = 1 }) {
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

  // --- SFX library ---
  const sfx = {
    drop(tier) {
      if (!ctx) return;
      const f = 320 - tier * 22;
      tone({ f, f2: f * .55, type: 'sine', t: .1, v: .3 });
      noise({ t: .08, v: .12, f: 500, q: .8 });
    },
    merge(tier, combo) {
      if (!ctx) return;
      const base = 300 + tier * 26 + Math.min(combo, 6) * 40;
      tone({ f: base, f2: base * 1.5, type: 'triangle', t: .12, v: .3 });
      tone({ f: base * 2, type: 'sine', t: .08, v: .16, at: .04 });
      noise({ t: .1, v: .1, f: 1800, q: 1.2 });
    },
    comboUp(n) {
      if (!ctx) return;
      tone({ f: 520 + n * 60, type: 'square', t: .09, v: .12 });
      tone({ f: 780 + n * 90, type: 'square', t: .09, v: .1, at: .07 });
    },
    bigMerge() {
      if (!ctx) return;
      [523, 659, 784, 1046].forEach((f, i) => tone({ f, type: 'triangle', t: .16, v: .22, at: i * .07 }));
    },
    firework() {
      if (!ctx) return;
      for (let i = 0; i < 5; i++) noise({ t: .4, v: .18, at: i * .13, f: 700 + Math.random() * 2400, q: .6 });
      [660, 880, 990, 1320].forEach((f, i) => tone({ f, f2: f * .5, type: 'sine', t: .3, v: .14, at: .1 + i * .12 }));
    },
    lose() {
      if (!ctx) return;
      [392, 330, 262, 196].forEach((f, i) => tone({ f, type: 'sawtooth', t: .22, v: .18, at: i * .18, decay: .3 }));
    },
    warn() { if (ctx) tone({ f: 880, f2: 660, type: 'square', t: .1, v: .1 }); },
    ui() { if (ctx) tone({ f: 660, type: 'sine', t: .06, v: .18 }); },
    swap() { if (ctx) tone({ f: 500, f2: 700, type: 'sine', t: .07, v: .16 }); },
  };

  // --- music: 16-step scheduler per state ---
  function musTick() {
    if (!ctx || muted) return;
    const s = states[state];
    const beat = 60 / s.bpm / 4;           // 16th note
    const chord = s.chords[Math.floor(step16 / 16) % s.chords.length];
    const ai = s.arp[step16 % s.arp.length];
    // pad on bar start
    if (step16 % 16 === 0) {
      for (const f of chord) tone({ f, type: s.wave, t: beat * 14, v: .05, decay: beat * 6, dest: musG });
    }
    // arp
    if (step16 % 2 === 0 || Math.random() < s.density * .5) {
      const f = chord[ai] * (step16 % 8 === 6 ? 2 : 1);
      tone({ f, type: 'sine', t: beat * 1.6, v: .09, decay: beat * 2, dest: musG });
    }
    // soft hat
    if (step16 % 4 === 2) {
      const g = ctx.createGain(); g.gain.value = .04; g.connect(musG);
      tone({ f: 6000, type: 'square', t: .02, v: .03, dest: musG });
    }
    step16++;
    musTimer = setTimeout(musTick, beat * 1000);
  }

  return {
    ensure,
    setMuted(v) { muted = v; if (master) master.gain.value = v ? 0 : 1; },
    isMuted() { return muted; },
    hasCtx() { return !!ctx; },
    state(s) { if (s && states[s]) state = s; return state; },
    update() {
      if (!ctx) return;
      if (muted) { clearTimeout(musTimer); musTimer = 0; return; }
      if (!musTimer) musTick();
    },
    stop() { clearTimeout(musTimer); musTimer = 0; step16 = 0; },
    sfx,
  };
}
