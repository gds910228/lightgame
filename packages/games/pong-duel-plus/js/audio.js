// Pong Duel Plus — fully synthesized WebAudio SFX + a four-state score.
// No samples, no network requests. The AudioContext is only created on the
// first real user gesture, never during ?autotest=1.

export function makeAudio() {
  let ctx = null, master = null, sfxG = null, musG = null;
  let muted = false, state = 'title', step16 = 0, musAcc = 0;

  const states = {
    title:   { bpm: 66, chords: [[146.8, 196, 246.9], [164.8, 207.6, 261.6], [130.8, 174.6, 220]], arp: [0, 2, 1, 2], density: .30, gain: .05 },
    match:   { bpm: 112, chords: [[220, 277.2, 329.6], [196, 246.9, 293.7], [246.9, 311.1, 370], [174.6, 220, 277.2]], arp: [0, 2, 1, 2, 0, 1], density: .72, gain: .052 },
    tension: { bpm: 138, chords: [[207.6, 261.6, 311.1], [185, 233, 293.7], [174.6, 220, 277.2]], arp: [0, 1, 2, 1, 0, 2], density: .92, gain: .058 },
    end:     { bpm: 70, chords: [[174.6, 220, 277.2], [164.8, 207.6, 261.6]], arp: [0, 1, 2, 1], density: .28, gain: .05 },
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
      sfxG = ctx.createGain(); sfxG.gain.value = .82; sfxG.connect(master);
      musG = ctx.createGain(); musG.gain.value = .27; musG.connect(master);
    } catch (e) { ctx = null; return false; }
    return true;
  }
  const now = () => ctx.currentTime;

  function tone({ f = 440, f2, type = 'sine', t = .18, v = .22, at = 0, decay, dest }) {
    if (!ctx) return;
    const t0 = now() + at;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(Math.max(20, f), t0);
    if (f2) o.frequency.exponentialRampToValueAtTime(Math.max(20, f2), t0 + t);
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(v, t0 + .012);
    g.gain.exponentialRampToValueAtTime(.0001, t0 + Math.max(.03, decay || t));
    o.connect(g); g.connect(dest || sfxG);
    o.start(t0); o.stop(t0 + Math.max(.05, decay || t) + .06);
  }
  function noise({ t = .14, v = .18, at = 0, f = 1000, q = .8, type = 'bandpass', dest }) {
    if (!ctx) return;
    const len = Math.max(1, Math.floor(ctx.sampleRate * (t + .04)));
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 1.6);
    const src = ctx.createBufferSource(); src.buffer = buf;
    const fl = ctx.createBiquadFilter(); fl.type = type; fl.frequency.value = f; fl.Q.value = q;
    const g = ctx.createGain(); g.gain.value = v;
    src.connect(fl); fl.connect(g); g.connect(dest || sfxG);
    src.start(now() + at);
  }

  const sfx = {
    ui() { tone({ f: 760, f2: 980, type: 'sine', t: .05, v: .13 }); },
    count() { tone({ f: 620, type: 'triangle', t: .09, v: .16 }); tone({ f: 930, type: 'sine', t: .06, v: .06, at: .02 }); },
    start() {
      tone({ f: 523, type: 'triangle', t: .12, v: .2 });
      tone({ f: 784, type: 'triangle', t: .16, v: .17, at: .08 });
      noise({ t: .14, v: .07, f: 2600, q: 1.4 });
    },
    serve() {
      tone({ f: 392, f2: 620, type: 'sine', t: .13, v: .1 });
      noise({ t: .05, v: .05, f: 2800, q: 1.6 });
    },
    hit(power = 1) {
      const p = Math.min(1, Math.max(.15, power));
      tone({ f: 210 + p * 150, f2: 86, type: 'triangle', t: .08 + p * .06, v: .17 + p * .2 });
      noise({ t: .045 + p * .06, v: .07 + p * .14, f: 1500 + p * 1000, q: 1.1 });
    },
    wall(power = 1) {
      const p = Math.min(1, Math.max(.1, power));
      tone({ f: 260, f2: 150, type: 'sine', t: .05, v: .045 + p * .1 });
      noise({ t: .03, v: .035 + p * .06, f: 800, q: .7 });
    },
    score() {
      noise({ t: .35, v: .2, f: 520, q: .6 });
      [392, 523, 659, 784].forEach((f, i) => tone({ f, type: 'triangle', t: .2, v: .18, at: i * .06, decay: .3 }));
      tone({ f: 104, f2: 58, type: 'sine', t: .34, v: .28 });
    },
    power(kind) {
      const base = kind === 'extend' ? 523 : kind === 'slow' ? 349 : 440;
      tone({ f: base, f2: base * 1.5, type: 'triangle', t: .16, v: .15 });
      tone({ f: base * 1.5, f2: base * 2.25, type: 'sine', t: .18, v: .1, at: .07 });
      noise({ t: .18, v: .06, f: 3200, q: 1.1, at: .02 });
    },
    powerSpawn() { tone({ f: 880, f2: 1180, type: 'sine', t: .09, v: .05 }); },
    win() {
      [523, 659, 784, 1046, 1318].forEach((f, i) => tone({ f, type: 'triangle', t: .34, v: .19, at: i * .11, decay: .55 }));
      noise({ t: .8, v: .07, f: 3000, q: .5, at: .1 });
    },
    lose() {
      [392, 330, 277, 196].forEach((f, i) => tone({ f, f2: f * .92, type: 'sawtooth', t: .3, v: .13, at: i * .16, decay: .48 }));
    },
    pause() { tone({ f: 480, f2: 360, type: 'sine', t: .11, v: .11 }); },
    share() { tone({ f: 880, f2: 1320, type: 'sine', t: .1, v: .1 }); },
  };

  function musTick(dt) {
    if (!ctx || muted) return;
    const st = states[state] || states.title;
    const beat = 60 / st.bpm / 4;
    musAcc += dt;
    let guard = 0;
    while (musAcc >= beat && guard++ < 8) {
      musAcc -= beat;
      const s = step16++ % 16;
      const chord = st.chords[((step16 / 16) | 0) % st.chords.length];
      if (s === 0) {
        for (const f of chord) tone({ f: f / 2, type: 'sine', t: beat * 13, v: st.gain * .72, decay: beat * 15, dest: musG });
      }
      if (s % 2 === 0 || Math.random() < st.density * .32) {
        const n = chord[st.arp[s % st.arp.length]] * (s % 8 === 6 ? 2 : 1);
        tone({ f: n, type: 'sine', t: beat * 1.7, v: st.gain, decay: beat * 2.2, dest: musG });
      }
      if (state !== 'title' && s % 4 === 2) {
        noise({ t: .032, v: state === 'tension' ? .028 : .018, f: 6600, q: 1.2, dest: musG });
      }
    }
  }

  return {
    unlock() {
      if (!ensure()) return false;
      if (ctx.state === 'suspended') ctx.resume().catch(() => { });
      return true;
    },
    play(name, arg) { if (ctx && !muted && sfx[name]) sfx[name](arg); },
    setState(s) { if (states[s]) state = s; },
    state() { return state; },
    tick(dt) { if (ctx && !muted) musTick(dt); },
    setMuted(v) { muted = !!v; if (master && ctx) master.gain.value = muted ? 0 : 1; },
    isMuted() { return muted; },
    toggleMute() { this.setMuted(!muted); return muted; },
    hasCtx() { return !!ctx; },
    reset() { step16 = 0; musAcc = 0; },
  };
}
