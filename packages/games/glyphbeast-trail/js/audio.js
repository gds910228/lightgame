// Glyphbeast: Sixfold Trail — fully synthesized WebAudio.
// Warm pentatonic exploration, tenser battle cues, a low boss pulse.
export function makeAudio() {
  let ctx = null, master = null, sfxG = null, musG = null;
  let muted = false, state = 'title', musTimer = 0, step16 = 0;

  const states = {
    title:   { bpm: 68,  chords: [[146.8, 220, 293.7], [130.8, 196, 261.6]], arp: [0, 2, 1, 2], density: 0.3, wave: 'sine' },
    explore: { bpm: 82,  chords: [[146.8, 220, 293.7], [164.8, 246.9, 329.6], [130.8, 196, 293.7]], arp: [0, 1, 2, 1, 0, 2], density: 0.42, wave: 'sine' },
    battle:  { bpm: 126, chords: [[174.6, 220, 261.6], [196, 246.9, 293.7], [164.8, 207.6, 246.9]], arp: [0, 2, 1, 2, 0, 1, 2, 1], density: 0.75, wave: 'triangle' },
    boss:    { bpm: 142, chords: [[130.8, 174.6, 207.6], [146.8, 185, 220], [123.5, 164.8, 196]], arp: [0, 1, 2, 0, 2, 1, 2, 0], density: 0.9, wave: 'sawtooth' },
  };

  function ensure() {
    if (ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain(); master.gain.value = muted ? 0 : 1; master.connect(ctx.destination);
    sfxG = ctx.createGain(); sfxG.gain.value = 0.7; sfxG.connect(master);
    musG = ctx.createGain(); musG.gain.value = 0.16; musG.connect(master);
  }
  const now = () => ctx.currentTime;

  function tone({ f = 440, f2, type = 'sine', t = 0.2, v = 0.3, at = 0, decay, dest }) {
    if (!ctx) return;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(Math.max(20, f), now() + at);
    if (f2) o.frequency.exponentialRampToValueAtTime(Math.max(20, f2), now() + at + t);
    g.gain.setValueAtTime(0.0001, now() + at);
    g.gain.linearRampToValueAtTime(v, now() + at + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, now() + at + (decay || t));
    o.connect(g); g.connect(dest || sfxG);
    o.start(now() + at); o.stop(now() + at + (decay || t) + 0.06);
  }
  function noise({ t = 0.3, v = 0.3, at = 0, f = 900, q = 1, type = 'lowpass', dest }) {
    if (!ctx) return;
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
    menu:    () => { tone({ f: 660, t: 0.045, v: 0.1, type: 'sine' }); },
    confirm: () => { tone({ f: 540, f2: 810, t: 0.11, v: 0.16 }); tone({ f: 1080, t: 0.08, v: 0.08, at: 0.05 }); },
    back:    () => { tone({ f: 420, f2: 300, t: 0.09, v: 0.12 }); },
    hit:     () => { noise({ t: 0.12, v: 0.28, f: 1300, type: 'bandpass', q: 0.8 }); tone({ f: 220, f2: 120, t: 0.12, v: 0.2, type: 'triangle' }); },
    crit:    () => { noise({ t: 0.22, v: 0.42, f: 900 }); tone({ f: 300, f2: 90, t: 0.25, v: 0.4, type: 'sawtooth' }); tone({ f: 1400, f2: 700, t: 0.12, v: 0.2, at: 0.02 }); },
    miss:    () => { tone({ f: 500, f2: 240, t: 0.16, v: 0.14, type: 'sine' }); },
    status:  () => { tone({ f: 900, f2: 1200, t: 0.18, v: 0.14, type: 'triangle' }); },
    heal:    () => { [523, 659, 784].forEach((f, i) => tone({ f, t: 0.26, v: 0.14, at: i * 0.08 })); },
    shield:  () => { tone({ f: 300, f2: 700, t: 0.24, v: 0.16, type: 'triangle' }); noise({ t: 0.2, v: 0.08, f: 2200, type: 'highpass' }); },
    faint:   () => { [392, 330, 262, 196].forEach((f, i) => tone({ f, t: 0.32, v: 0.2, at: i * 0.11, type: 'triangle' })); },
    seal:    () => { tone({ f: 1200, f2: 1800, t: 0.3, v: 0.18, type: 'sine' }); noise({ t: 0.3, v: 0.1, f: 3000, type: 'highpass' }); },
    capture: () => { [659, 784, 988, 1318].forEach((f, i) => tone({ f, t: 0.4, v: 0.2, at: i * 0.12 })); noise({ t: 0.5, v: 0.08, f: 4000, type: 'highpass' }); },
    levelup: () => { [523, 659, 784, 1046, 1318].forEach((f, i) => tone({ f, t: 0.3, v: 0.18, at: i * 0.07 })); },
    coin:    () => { tone({ f: 988, t: 0.07, v: 0.12 }); tone({ f: 1318, t: 0.1, v: 0.1, at: 0.05 }); },
    encounter: () => { [392, 523, 659, 523, 784].forEach((f, i) => tone({ f, t: 0.18, v: 0.22, at: i * 0.09, type: 'square' })); noise({ t: 0.5, v: 0.16, f: 500 }); },
    gate:    () => { tone({ f: 196, f2: 98, t: 0.7, v: 0.32, type: 'sawtooth' }); noise({ t: 0.6, v: 0.15, f: 300 }); },
    win:     () => { [523, 659, 784, 1046].forEach((f, i) => tone({ f, t: 0.42, v: 0.24, at: i * 0.14 })); },
    lose:    () => { [392, 330, 262, 196].forEach((f, i) => tone({ f, t: 0.5, v: 0.26, at: i * 0.18, type: 'triangle' })); },
    camp:    () => { [392, 523, 659].forEach((f, i) => tone({ f, t: 0.5, v: 0.12, at: i * 0.12 })); noise({ t: 0.5, v: 0.06, f: 600 }); },
    flee:    () => { noise({ t: 0.35, v: 0.16, f: 1500, type: 'bandpass' }); tone({ f: 700, f2: 240, t: 0.3, v: 0.14 }); },
    buy:     () => { tone({ f: 880, t: 0.07, v: 0.12 }); tone({ f: 1174, t: 0.1, v: 0.1, at: 0.06 }); },
    deny:    () => { tone({ f: 240, f2: 160, t: 0.16, v: 0.16, type: 'square' }); },
  };

  function musicTick(dt) {
    if (!ctx || muted) return;
    const st = states[state] || states.explore;
    const stepDur = 60 / st.bpm / 4;
    musTimer += dt;
    while (musTimer >= stepDur) {
      musTimer -= stepDur;
      const s = step16++ % 16;
      const chord = st.chords[((step16 / 16) | 0) % st.chords.length];
      if (s === 0) chord.forEach(f => tone({ f: f / 2, type: 'sine', t: stepDur * 14, v: 0.045, decay: stepDur * 15, dest: musG }));
      if (Math.random() < st.density) {
        const n = chord[st.arp[s % st.arp.length]] * 2;
        tone({ f: n, type: st.wave === 'sawtooth' ? 'square' : st.wave, t: stepDur * 1.8, v: 0.045, dest: musG });
      }
      if ((state === 'battle' || state === 'boss') && s % 4 === 0) noise({ t: 0.08, v: state === 'boss' ? 0.13 : 0.08, f: 160, dest: musG });
    }
  }

  return {
    unlock() { ensure(); if (ctx && ctx.state === 'suspended') ctx.resume(); },
    play(name) { if (!ctx || muted) return; if (S[name]) S[name](); },
    setState(s) { if (states[s]) state = s; },
    get state() { return state; },
    setMuted(v) {
      muted = !!v;
      if (!ctx && !muted) ensure();
      if (master) master.gain.value = muted ? 0 : 1;
      return muted;
    },
    get muted() { return muted; },
    get hasCtx() { return !!ctx; },
    tick(dt) { if (ctx) musicTick(dt); },
  };
}
