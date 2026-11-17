// WebAudio synthesis: SFX (shot/graze/bomb/death/capture/bosskill/ui) +
// intense two-state music loop (fight / boss). All synthesized, no assets.

export function makeAudio() {
  let ctx = null, master = null, sfxG = null, musG = null;
  let muted = false, state = 'fight', musTimer = 0, step16 = 0;
  const states = {
    fight: { bpm: 128, chords: [[220, 261.6, 329.6], [196, 246.9, 293.7]], arp: [0, 1, 2, 1], density: .7, wave: 'triangle' },
    boss: { bpm: 148, chords: [[196, 233, 293.7], [185, 220, 277.2], [174.6, 220, 261.6]], arp: [0, 2, 1, 2, 0, 1], density: 1, wave: 'sawtooth' },
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
    bossShot() { if (ctx) tone({ f: 220, f2: 160, type: 'square', t: .06, v: .07 }); },
    graze() { if (ctx) tone({ f: 1400 + Math.random() * 300, type: 'sine', t: .04, v: .09 }); },
    bomb() {
      if (!ctx) return;
      noise({ t: .6, v: .4, f: 400, q: .4 });
      tone({ f: 110, f2: 40, type: 'sawtooth', t: .5, v: .3 });
    },
    death() { if (ctx) { [392, 311, 233].forEach((f, i) => tone({ f, type: 'sawtooth', t: .2, v: .22, at: i * .14 })); noise({ t: .3, v: .25, f: 500, q: .5 }); } },
    capture() { if (ctx) [523, 659, 784, 1046].forEach((f, i) => tone({ f, type: 'triangle', t: .16, v: .2, at: i * .08 })); },
    bosskill() { if (ctx) { [523, 659, 784, 1046, 1318].forEach((f, i) => tone({ f, type: 'triangle', t: .2, v: .22, at: i * .1 })); noise({ t: .5, v: .18, f: 2000, q: .4, at: .1 }); } },
    extend() { if (ctx) [784, 988, 1318].forEach((f, i) => tone({ f, type: 'sine', t: .14, v: .2, at: i * .07 })); },
    ui() { if (ctx) tone({ f: 620, type: 'sine', t: .06, v: .16 }); },
  };

  function musTick() {
    if (!ctx || muted) return;
    const s = states[state];
    const beat = 60 / s.bpm / 4;
    const chord = s.chords[Math.floor(step16 / 16) % s.chords.length];
    if (step16 % 8 === 0) {
      for (const f of chord) tone({ f: f / 2, type: s.wave, t: beat * 7, v: .05, decay: beat * 3, dest: musG });
    }
    if (step16 % 2 === 0) {
      const ai = s.arp[step16 % s.arp.length];
      tone({ f: chord[ai] * 2, type: 'square', t: beat * 1.3, v: .055, decay: beat, dest: musG });
    }
    if (step16 % 4 === 0) tone({ f: 98, f2: 55, type: 'sine', t: .1, v: .18, dest: musG });
    if (step16 % 4 === 2) tone({ f: 6000, type: 'square', t: .02, v: .03, dest: musG });
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
