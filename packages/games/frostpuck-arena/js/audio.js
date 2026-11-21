// Frostpuck Arena — fully synthesized WebAudio SFX + a three-state ice score.
// No samples, no network requests. The AudioContext is only created on the
// first real user gesture (never during ?autotest=1).

export function makeAudio() {
  let ctx = null, master = null, sfxG = null, musG = null;
  let muted = false, state = 'title', step16 = 0, musAcc = 0;

  const states = {
    title:  { bpm: 68,  chords: [[174.6, 220, 261.6], [196, 246.9, 293.7], [146.8, 196, 246.9]], arp: [0, 2, 1, 2], density: .34, gain: .055 },
    match:  { bpm: 102, chords: [[220, 277.2, 329.6], [196, 246.9, 293.7], [246.9, 311.1, 370], [174.6, 220, 277.2]], arp: [0, 2, 1, 2, 0, 1], density: .66, gain: .050 },
    tension:{ bpm: 132, chords: [[207.6, 261.6, 311.1], [185, 233, 293.7], [174.6, 220, 277.2]], arp: [0, 1, 2, 1, 0, 2], density: .9, gain: .058 },
    end:    { bpm: 72,  chords: [[174.6, 220, 277.2], [164.8, 207.6, 261.6]], arp: [0, 1, 2, 1], density: .3, gain: .05 },
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
      musG = ctx.createGain(); musG.gain.value = .26; musG.connect(master);
    } catch (e) { ctx = null; return false; }
    return true;
  }
  const now = () => ctx.currentTime;

  function tone({ f = 440, f2, type = 'sine', t = .18, v = .25, at = 0, decay, dest }) {
    if (!ctx) return;
    const t0 = now() + at;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(Math.max(20, f), t0);
    if (f2) o.frequency.exponentialRampToValueAtTime(Math.max(20, f2), t0 + t);
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(v, t0 + .012);
    g.gain.exponentialRampToValueAtTime(.0001, t0 + Math.max(.025, decay || t));
    o.connect(g); g.connect(dest || sfxG);
    o.start(t0); o.stop(t0 + Math.max(.04, decay || t) + .05);
  }
  function noise({ t = .15, v = .2, at = 0, f = 900, q = .8, type = 'bandpass', dest }) {
    if (!ctx) return;
    const len = Math.max(1, Math.floor(ctx.sampleRate * (t + .04)));
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 1.7);
    const src = ctx.createBufferSource(); src.buffer = buf;
    const fl = ctx.createBiquadFilter(); fl.type = type; fl.frequency.value = f; fl.Q.value = q;
    const g = ctx.createGain(); g.gain.value = v;
    src.connect(fl); fl.connect(g); g.connect(dest || sfxG);
    src.start(now() + at);
  }

  const sfx = {
    ui() { tone({ f: 760, f2: 980, type: 'sine', t: .055, v: .14 }); },
    count() { tone({ f: 620, type: 'triangle', t: .09, v: .16 }); },
    start() {
      tone({ f: 523, type: 'triangle', t: .12, v: .2 });
      tone({ f: 784, type: 'triangle', t: .15, v: .18, at: .08 });
      noise({ t: .12, v: .08, f: 2400, q: 1.4 });
    },
    hit(power = 1) {
      const p = Math.min(1, Math.max(.15, power));
      tone({ f: 190 + p * 120, f2: 80, type: 'triangle', t: .09 + p * .05, v: .18 + p * .2 });
      noise({ t: .05 + p * .05, v: .08 + p * .14, f: 1400 + p * 900, q: 1.2 });
    },
    wall(power = 1) {
      const p = Math.min(1, Math.max(.1, power));
      tone({ f: 240, f2: 150, type: 'sine', t: .055, v: .05 + p * .12 });
      noise({ t: .035, v: .04 + p * .07, f: 700, q: .6 });
    },
    goal() {
      noise({ t: .5, v: .23, f: 460, q: .6 });
      [392, 523, 659, 784, 1046].forEach((f, i) => tone({ f, type: 'triangle', t: .22, v: .19, at: i * .065, decay: .32 }));
      tone({ f: 98, f2: 52, type: 'sine', t: .4, v: .3 });
    },
    win() {
      [523, 659, 784, 1046, 1318].forEach((f, i) => tone({ f, type: 'triangle', t: .35, v: .2, at: i * .12, decay: .55 }));
      noise({ t: .8, v: .08, f: 2800, q: .5, at: .1 });
    },
    lose() {
      [392, 330, 277, 196].forEach((f, i) => tone({ f, f2: f * .92, type: 'sawtooth', t: .32, v: .14, at: i * .17, decay: .5 }));
    },
    pause() { tone({ f: 480, f2: 360, type: 'sine', t: .12, v: .12 }); },
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
        for (const f of chord) tone({ f: f / 2, type: 'sine', t: beat * 13, v: st.gain * .7, decay: beat * 15, dest: musG });
      }
      if (s % 2 === 0 || Math.random() < st.density * .35) {
        const n = chord[st.arp[s % st.arp.length]] * (s % 8 === 6 ? 2 : 1);
        tone({ f: n, type: 'sine', t: beat * 1.7, v: st.gain, decay: beat * 2.2, dest: musG });
      }
      if (state !== 'title' && s % 4 === 2) {
        noise({ t: .035, v: state === 'tension' ? .03 : .018, f: 6400, q: 1.2, dest: musG });
      }
    }
  }

  return {
    unlock() {
      if (!ensure()) return false;
      if (ctx.state === 'suspended') ctx.resume().catch(() => {});
      return true;
    },
    play(name, arg) { if (ctx && !muted && sfx[name]) sfx[name](arg); },
    setState(s) { if (states[s]) state = s; },
    state() { return state; },
    tick(dt) { if (ctx && !muted) musTick(dt); },
    setMuted(v) {
      muted = !!v;
      if (master && ctx) master.gain.value = muted ? 0 : 1;
    },
    isMuted() { return muted; },
    toggleMute() { this.setMuted(!muted); return muted; },
    hasCtx() { return !!ctx; },
    reset() { step16 = 0; musAcc = 0; },
  };
}
