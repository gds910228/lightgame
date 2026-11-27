// Card Duel Arena 斗牌竞技场 — fully synthesized WebAudio.
// No samples, no network. The AudioContext is created only after a real user
// gesture and never during ?autotest=1.

export function makeAudio() {
  let ctx = null, master = null, sfxG = null, musG = null;
  let muted = false, state = 'title', step16 = 0, musAcc = 0;

  const states = {
    title: {
      bpm: 62, gain: .048,
      chords: [[146.83, 196.00, 246.94], [130.81, 174.61, 220.00], [164.81, 207.65, 261.63]],
      arp: [0, 2, 1, 2],
    },
    battle: {
      bpm: 102, gain: .052,
      chords: [[220.00, 277.18, 329.63], [196.00, 246.94, 293.66], [174.61, 220.00, 293.66], [207.65, 261.63, 329.63]],
      arp: [0, 1, 2, 1, 0, 2],
    },
    result: {
      bpm: 72, gain: .046,
      chords: [[196.00, 246.94, 293.66], [174.61, 220.00, 261.63]],
      arp: [0, 1, 2, 1],
    },
    end: {
      bpm: 58, gain: .043,
      chords: [[146.83, 196.00, 246.94], [130.81, 174.61, 220.00]],
      arp: [0, 2, 1, 0],
    },
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

  function tone({ f = 440, f2, type = 'sine', t = .16, v = .18, at = 0, decay, dest }) {
    if (!ctx) return;
    try {
      const t0 = now() + at;
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = type;
      o.frequency.setValueAtTime(Math.max(20, f), t0);
      if (f2) o.frequency.exponentialRampToValueAtTime(Math.max(20, f2), t0 + Math.max(.02, t));
      g.gain.setValueAtTime(.0001, t0);
      g.gain.linearRampToValueAtTime(Math.max(.0002, v), t0 + .012);
      g.gain.exponentialRampToValueAtTime(.0001, t0 + Math.max(.04, decay || t));
      o.connect(g); g.connect(dest || sfxG);
      o.start(t0); o.stop(t0 + Math.max(.06, decay || t) + .05);
    } catch (e) { }
  }
  function noise({ t = .12, v = .12, at = 0, f = 1300, q = .9, type = 'bandpass', dest }) {
    if (!ctx) return;
    try {
      const len = Math.max(1, Math.floor(ctx.sampleRate * (t + .04)));
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 1.7);
      const src = ctx.createBufferSource(); src.buffer = buf;
      const fl = ctx.createBiquadFilter(); fl.type = type; fl.frequency.value = f; fl.Q.value = q;
      const g = ctx.createGain(); g.gain.value = v;
      src.connect(fl); fl.connect(g); g.connect(dest || sfxG);
      src.start(now() + at);
    } catch (e) { }
  }

  const sfx = {
    ui() { tone({ f: 740, f2: 960, type: 'sine', t: .045, v: .1 }); },
    select() { tone({ f: 560, f2: 720, type: 'triangle', t: .05, v: .09 }); },
    card() { noise({ t: .045, v: .045, f: 3300, q: 1.6 }); tone({ f: 420, f2: 620, type: 'sine', t: .07, v: .055 }); },
    attack(power = 1) {
      const p = Math.min(1, Math.max(.2, Number(power) || 1));
      noise({ t: .07 + p * .05, v: .08 + p * .1, f: 1600 + p * 900, q: .9 });
      tone({ f: 230 + p * 90, f2: 82, type: 'triangle', t: .11 + p * .05, v: .13 + p * .15 });
    },
    block() { tone({ f: 900, f2: 610, type: 'square', t: .055, v: .055 }); noise({ t: .05, v: .07, f: 3400, q: 2.2 }); },
    heal() { [523, 659, 784].forEach((f, i) => tone({ f, type: 'sine', t: .14, v: .08, at: i * .055, decay: .22 })); },
    draw() { noise({ t: .04, v: .035, f: 2800, q: 1.2 }); },
    energy() { [440, 660, 880].forEach((f, i) => tone({ f, type: 'triangle', t: .08, v: .06, at: i * .04 })); },
    burn() { noise({ t: .13, v: .07, f: 800, q: .5 }); tone({ f: 240, f2: 130, type: 'sawtooth', t: .13, v: .04 }); },
    turn() { tone({ f: 660, type: 'sine', t: .1, v: .1 }); tone({ f: 990, type: 'sine', t: .09, v: .055, at: .05 }); },
    start() { [392, 523, 659, 784].forEach((f, i) => tone({ f, type: 'triangle', t: .16, v: .11, at: i * .07, decay: .3 })); },
    win() { [523, 659, 784, 1046, 1318].forEach((f, i) => tone({ f, type: 'triangle', t: .3, v: .16, at: i * .1, decay: .5 })); noise({ t: .65, v: .05, f: 3000, q: .5, at: .1 }); },
    lose() { [392, 330, 277, 196].forEach((f, i) => tone({ f, f2: f * .94, type: 'sawtooth', t: .26, v: .1, at: i * .14, decay: .4 })); },
    pause() { tone({ f: 480, f2: 360, type: 'sine', t: .1, v: .09 }); },
    share() { tone({ f: 880, f2: 1320, type: 'sine', t: .09, v: .08 }); },
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
      if (s % 2 === 0 || Math.random() < .17) {
        const n = chord[st.arp[s % st.arp.length]] * (s % 8 === 6 ? 2 : 1);
        tone({ f: n, type: 'sine', t: beat * 1.6, v: st.gain, decay: beat * 2.1, dest: musG });
      }
      if (state === 'battle' && s % 4 === 2) noise({ t: .025, v: .012, f: 6200, q: 1.2, dest: musG });
    }
  }

  return {
    unlock() {
      if (!ensure()) return false;
      try { if (ctx.state === 'suspended') ctx.resume().catch(() => { }); } catch (e) { }
      return true;
    },
    play(name, arg) { if (ctx && !muted && sfx[name]) { try { sfx[name](arg); } catch (e) { } } },
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
