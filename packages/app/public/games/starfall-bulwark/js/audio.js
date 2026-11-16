// WebAudio synthesis: SFX library + three-state score (build / combat / boss)
// with crossfade. Volume kept ≈1/3 of SFX per skill vfx-ui-audio guidance.
export function makeAudio() {
  let ctx = null, master = null, sfxG = null, musG = null;
  let muted = false, state = 'build', musTimer = 0, step16 = 0;
  const states = {
    build:  { bpm: 84,  chords: [[220, 261.6, 329.6], [196, 246.9, 293.7]], arp: [0, 1, 2, 1], density: .45, wave: 'sine' },
    combat: { bpm: 112, chords: [[220, 261.6, 329.6], [233, 293.7, 349.2], [196, 246.9, 293.7], [174.6, 220, 261.6]], arp: [0, 2, 1, 2, 0, 1], density: .8, wave: 'triangle' },
    boss:   { bpm: 132, chords: [[174.6, 207.6, 261.6], [185, 233, 277.2]], arp: [0, 1, 2, 0, 1, 2, 1, 0], density: 1, wave: 'sawtooth' },
  };

  function ensure() {
    if (ctx) return;
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain(); master.gain.value = muted ? 0 : 1; master.connect(ctx.destination);
    sfxG = ctx.createGain(); sfxG.gain.value = .8; sfxG.connect(master);
    musG = ctx.createGain(); musG.gain.value = .24; musG.connect(master);
  }
  const now = () => ctx.currentTime;

  function tone({ f = 440, f2, type = 'sine', t = .2, v = .3, at = 0, decay, dest }) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(f, now() + at);
    if (f2) o.frequency.exponentialRampToValueAtTime(Math.max(20, f2), now() + at + t);
    g.gain.setValueAtTime(0, now() + at);
    g.gain.linearRampToValueAtTime(v, now() + at + .012);
    g.gain.exponentialRampToValueAtTime(.0001, now() + at + (decay || t));
    o.connect(g); g.connect(dest || sfxG);
    o.start(now() + at); o.stop(now() + at + (decay || t) + .05);
  }
  function noise({ t = .3, v = .3, at = 0, f = 900, q = 1, type = 'lowpass', dest }) {
    const len = Math.max(1, (t * ctx.sampleRate) | 0);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource(); src.buffer = buf;
    const fl = ctx.createBiquadFilter(); fl.type = type; fl.frequency.value = f; fl.Q.value = q;
    const g = ctx.createGain(); g.gain.value = v;
    src.connect(fl); fl.connect(g); g.connect(dest || sfxG);
    src.start(now() + at);
  }

  const S = {
    place:   () => { tone({ f: 180, f2: 90, type: 'triangle', t: .22, v: .5 }); tone({ f: 880, t: .12, v: .18, at: .02 }); },
    upgrade: () => { tone({ f: 520, f2: 880, t: .16, v: .3 }); tone({ f: 780, f2: 1240, t: .18, v: .22, at: .09 }); },
    sell:    () => { tone({ f: 660, f2: 330, t: .18, v: .25 }); },
    bolt:    () => { tone({ f: 1400, f2: 500, t: .07, v: .22, type: 'square' }); },
    shard:   () => { tone({ f: 1800, f2: 1200, t: .12, v: .18, type: 'sine' }); tone({ f: 2400, t: .05, v: .1, at: .02 }); },
    zap:     () => { noise({ t: .14, v: .3, f: 2600, type: 'highpass' }); tone({ f: 300, f2: 120, t: .1, v: .2, type: 'sawtooth' }); },
    shell:   () => { tone({ f: 220, f2: 90, t: .2, v: .4, type: 'triangle' }); },
    boom:    () => { noise({ t: .5, v: .55, f: 380 }); tone({ f: 120, f2: 45, t: .4, v: .5, type: 'triangle' }); },
    beamTick:() => { tone({ f: 1100, f2: 900, t: .06, v: .1 }); },
    leak:    () => { noise({ t: .4, v: .5, f: 240 }); tone({ f: 300, f2: 70, t: .35, v: .5, type: 'sawtooth' }); },
    coin:    () => { tone({ f: 990, t: .07, v: .16 }); tone({ f: 1320, t: .09, v: .14, at: .05 }); },
    heal:    () => { tone({ f: 620, f2: 930, t: .2, v: .18 }); },
    stomp:   () => { tone({ f: 90, f2: 40, t: .5, v: .6, type: 'triangle' }); noise({ t: .3, v: .4, f: 200 }); },
    meteor:  () => { tone({ f: 1400, f2: 200, t: .7, v: .25, type: 'sawtooth' }); },
    waveStart:() => { tone({ f: 392, t: .14, v: .3 }); tone({ f: 523, t: .18, v: .3, at: .12 }); },
    victory: () => { [523, 659, 784, 1046].forEach((f, i) => tone({ f, t: .4, v: .3, at: i * .16 })); },
    defeat:  () => { [392, 330, 262, 196].forEach((f, i) => tone({ f, t: .5, v: .3, at: i * .2, type: 'triangle' })); },
    click:   () => { tone({ f: 700, t: .05, v: .12 }); },
    roar:    () => { tone({ f: 130, f2: 60, t: .8, v: .55, type: 'sawtooth' }); noise({ t: .6, v: .3, f: 500 }); },
    disable: () => { tone({ f: 500, f2: 150, t: .25, v: .3, type: 'square' }); },
  };

  // --- music scheduler: 16-step bar loop, crossfade via state change ---
  function musicTick(dt) {
    if (!ctx || muted) return;
    const st = states[state];
    const stepDur = 60 / st.bpm / 4;
    musTimer += dt;
    while (musTimer >= stepDur) {
      musTimer -= stepDur;
      const s = step16++ % 16;
      const chord = st.chords[((step16 / 16) | 0) % st.chords.length];
      if (s === 0) chord.forEach(f => tone({ f: f / 2, type: 'sine', t: stepDur * 14, v: .05, decay: stepDur * 15, dest: musG }));
      if (st.arp[s % st.arp.length] !== undefined && Math.random() < st.density) {
        const n = chord[st.arp[s % st.arp.length]] * 2;
        tone({ f: n, type: st.wave === 'sawtooth' ? 'square' : st.wave, t: stepDur * 1.8, v: .05, dest: musG });
      }
      if (state !== 'build' && s % 4 === 0) noise({ t: .09, v: state === 'boss' ? .16 : .1, f: 150, dest: musG });
    }
  }

  return {
    unlock() { ensure(); if (ctx.state === 'suspended') ctx.resume(); },
    play(name) { if (!ctx || muted) return; S[name] && S[name](); },
    setState(s) { if (states[s] && state !== s) state = s; },
    get state() { return state; },
    toggleMute() { ensure(); muted = !muted; master.gain.value = muted ? 0 : 1; return muted; },
    get muted() { return muted; },
    tick(dt) { if (ctx) musicTick(dt); },
  };
}
