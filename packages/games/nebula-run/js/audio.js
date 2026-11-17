// WebAudio synthesis: SFX (jump/slide/coin/nearmiss/hit/gate/milestone/lose/ui)
// + two-state music loop (cruise / tunnel). All synthesized, no assets.

export function makeAudio() {
  let ctx = null, master = null, sfxG = null, musG = null;
  let muted = false, state = 'cruise', musTimer = 0, step16 = 0;
  const states = {
    cruise: { bpm: 120, chords: [[220, 277.2, 329.6], [246.9, 293.7, 349.2], [196, 246.9, 293.7], [174.6, 220, 261.6]], arp: [0, 1, 2, 1, 0, 2], density: .7, wave: 'triangle' },
    tunnel: { bpm: 140, chords: [[196, 233, 293.7], [185, 233, 277.2], [174.6, 220, 261.6], [164.8, 207.6, 246.9]], arp: [0, 2, 1, 2, 0, 1, 2, 0], density: 1, wave: 'sawtooth' },
  };

  function ensure() {
    if (ctx) return true;
    try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return false; }
    master = ctx.createGain(); master.gain.value = muted ? 0 : 1; master.connect(ctx.destination);
    sfxG = ctx.createGain(); sfxG.gain.value = .8; sfxG.connect(master);
    musG = ctx.createGain(); musG.gain.value = .2; musG.connect(master);
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
    jump() { if (ctx) tone({ f: 340, f2: 620, type: 'sine', t: .16, v: .22 }); },
    land() { if (ctx) noise({ t: .07, v: .12, f: 380 }); },
    slide() { if (ctx) noise({ t: .24, v: .18, f: 1600, q: .5 }); },
    coin() { if (ctx) { tone({ f: 1180, type: 'sine', t: .07, v: .18 }); tone({ f: 1560, type: 'sine', t: .09, v: .14, at: .05 }); } },
    nearmiss() { if (ctx) { tone({ f: 880, f2: 1320, type: 'triangle', t: .1, v: .26 }); noise({ t: .1, v: .1, f: 2400, q: 1.4 }); } },
    gate(n) { if (ctx) [523, 659, 880].forEach((f, i) => tone({ f: f * (1 + n * .06), type: 'triangle', t: .12, v: .2, at: i * .06 })); },
    hit() { if (ctx) { noise({ t: .3, v: .4, f: 320, q: .5 }); tone({ f: 160, f2: 60, type: 'sawtooth', t: .3, v: .3 }); } },
    milestone() { if (ctx) [523, 659, 784, 1046].forEach((f, i) => tone({ f, type: 'triangle', t: .15, v: .2, at: i * .08 })); },
    lose() { if (ctx) [392, 311, 233, 174].forEach((f, i) => tone({ f, type: 'sawtooth', t: .26, v: .2, at: i * .17, decay: .3 })); },
    ui() { if (ctx) tone({ f: 660, type: 'sine', t: .06, v: .16 }); },
  };

  function musTick() {
    if (!ctx || muted) return;
    const s = states[state];
    const beat = 60 / s.bpm / 4;
    const chord = s.chords[Math.floor(step16 / 16) % s.chords.length];
    if (step16 % 16 === 0) for (const f of chord) tone({ f, type: s.wave, t: beat * 12, v: .045, decay: beat * 5, dest: musG });
    if (step16 % 2 === 0 || Math.random() < s.density * .4) {
      const ai = s.arp[step16 % s.arp.length];
      tone({ f: chord[ai] * 2, type: 'square', t: beat * 1.4, v: .06, decay: beat * 1.5, dest: musG });
    }
    if (step16 % 4 === 0) tone({ f: 98, f2: 60, type: 'sine', t: .1, v: .16, dest: musG });      // kick
    if (step16 % 4 === 2) tone({ f: 6000, type: 'square', t: .02, v: .03, dest: musG });        // hat
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
