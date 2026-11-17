// WebAudio synthesis for Sling Siege: SFX (fire/hits/breaks/boom/kill/win...)
// + two-state music loop (calm = title/select dusk pad, battle = play).
// All synthesized, no assets. BGM volume kept ≈ 1/4 of SFX.
// Structure mirrors orchard-fusion audio.js (field-checked template).

export function makeAudio() {
  let ctx = null, master = null, sfxG = null, musG = null;
  let muted = false, state = 'calm', musTimer = 0, step16 = 0;
  const states = {
    calm:   { bpm: 72, chords: [[220, 277.2, 329.6], [174.6, 220, 261.6], [196, 246.9, 293.7], [164.8, 207.6, 246.9]], arp: [0, 1, 2, 1], density: .35, wave: 'sine' },
    battle: { bpm: 104, chords: [[196, 233, 293.7], [185, 220, 277.2], [174.6, 207.6, 261.6], [196, 246.9, 293.7]], arp: [0, 2, 1, 2, 0, 1], density: .8, wave: 'triangle' },
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
  function noise({ t = .18, v = .25, at = 0, f = 1200, q = 1, f2 }) {
    const len = Math.ceil(ctx.sampleRate * (t + .05));
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2);
    const src = ctx.createBufferSource(); src.buffer = buf;
    const flt = ctx.createBiquadFilter(); flt.type = 'bandpass';
    flt.frequency.setValueAtTime(f, now() + at);
    if (f2) flt.frequency.exponentialRampToValueAtTime(Math.max(40, f2), now() + at + t);
    flt.Q.value = q;
    const g = ctx.createGain(); g.gain.value = v;
    src.connect(flt); flt.connect(g); g.connect(sfxG);
    src.start(now() + at);
  }

  // --- SFX library ---
  const sfx = {
    fire() {
      if (!ctx) return;
      noise({ t: .14, v: .22, f: 900, f2: 2600, q: .8 });
      tone({ f: 240, f2: 480, type: 'triangle', t: .1, v: .16 });
    },
    stretch() { if (ctx) tone({ f: 160, f2: 190, type: 'sawtooth', t: .12, v: .08 }); },
    hitWood(v = 1) {
      if (!ctx) return;
      tone({ f: 150, type: 'square', t: .07, v: .2 * v });
      noise({ t: .06, v: .14 * v, f: 500, q: 1 });
    },
    hitStone(v = 1) {
      if (!ctx) return;
      tone({ f: 520, f2: 320, type: 'triangle', t: .06, v: .18 * v });
      noise({ t: .05, v: .16 * v, f: 2200, q: 2 });
    },
    woodBreak() {
      if (!ctx) return;
      noise({ t: .16, v: .3, f: 700, f2: 250, q: .8 });
      tone({ f: 110, f2: 60, type: 'square', t: .12, v: .2 });
    },
    glassBreak() {
      if (!ctx) return;
      noise({ t: .2, v: .28, f: 3400, f2: 1400, q: 1.4 });
      [1500, 2100, 2800].forEach((f, i) => tone({ f, f2: f * .6, type: 'sine', t: .1, v: .1, at: i * .03 }));
    },
    stoneBreak() {
      if (!ctx) return;
      noise({ t: .22, v: .32, f: 320, f2: 120, q: .7 });
      tone({ f: 85, f2: 45, type: 'square', t: .16, v: .24 });
    },
    boom() {
      if (!ctx) return;
      noise({ t: .5, v: .5, f: 400, f2: 60, q: .5 });
      tone({ f: 120, f2: 34, type: 'sine', t: .4, v: .4, decay: .3 });
      noise({ t: .18, v: .2, f: 2600, q: .6 });
    },
    kill() {
      if (!ctx) return;
      tone({ f: 660, f2: 990, type: 'triangle', t: .1, v: .24 });
      noise({ t: .07, v: .14, f: 1200, q: 1 });
      [1320, 1760].forEach((f, i) => tone({ f, type: 'sine', t: .08, v: .1, at: .08 + i * .06 }));
    },
    thud() {
      if (!ctx) return;
      tone({ f: 90, f2: 50, type: 'sine', t: .1, v: .2 });
      noise({ t: .06, v: .1, f: 300, q: 1 });
    },
    win() {
      if (!ctx) return;
      [523, 659, 784, 1046].forEach((f, i) => tone({ f, type: 'triangle', t: .18, v: .22, at: i * .12 }));
    },
    lose() {
      if (!ctx) return;
      [392, 330, 262, 196].forEach((f, i) => tone({ f, type: 'sawtooth', t: .22, v: .16, at: i * .18, decay: .3 }));
    },
    star(n = 0) { if (ctx) tone({ f: 900 + n * 140, type: 'sine', t: .12, v: .18 }); },
    ui() { if (ctx) tone({ f: 660, type: 'sine', t: .06, v: .16 }); },
    select() { if (ctx) tone({ f: 500, f2: 760, type: 'sine', t: .08, v: .16 }); },
  };

  // --- music: 16-step scheduler per state ---
  function musTick() {
    if (!ctx || muted) return;
    const s = states[state] || states.calm;
    const beat = 60 / s.bpm / 4;
    const chord = s.chords[Math.floor(step16 / 16) % s.chords.length];
    const ai = s.arp[step16 % s.arp.length];
    if (step16 % 16 === 0) {
      for (const f of chord) tone({ f, type: s.wave, t: beat * 14, v: .05, decay: beat * 6, dest: musG });
    }
    if (step16 % 2 === 0 || Math.random() < s.density * .5) {
      const f = chord[ai] * (step16 % 8 === 6 ? 2 : 1);
      tone({ f, type: 'sine', t: beat * 1.6, v: .09, decay: beat * 2, dest: musG });
    }
    if (state === 'battle' && step16 % 4 === 2) {
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
