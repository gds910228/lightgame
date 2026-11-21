// Whisper Heist — fully synthesized WebAudio. No samples, no network.
// A sparse indigo ambience for calm, a ticking pulse while guards search and a
// driving low chase loop. Music sits at ~1/4 of SFX volume.

export function makeAudio() {
  let ctx = null, master = null, sfxG = null, musG = null;
  let muted = false, state = 'calm', musTimer = 0, step16 = 0;

  const STATES = {
    calm:  { bpm: 62,  chords: [[146.8, 174.6, 220], [130.8, 164.8, 196], [110, 146.8, 174.6], [130.8, 164.8, 220]], arp: [0, 2, 1, 2], density: 0.30, wave: 'sine' },
    alert: { bpm: 86,  chords: [[146.8, 185, 220], [130.8, 174.6, 207.6], [123.5, 155.6, 196], [110, 146.8, 185]], arp: [0, 1, 2, 1, 2, 0], density: 0.55, wave: 'triangle' },
    chase: { bpm: 124, chords: [[110, 130.8, 164.8], [98, 123.5, 155.6], [110, 146.8, 174.6], [92.5, 116.5, 146.8]], arp: [0, 2, 1, 2, 0, 1, 2, 1], density: 0.9, wave: 'sawtooth' },
  };

  function ensure() {
    if (ctx) return !!ctx;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
    } catch (e) { return false; }
    master = ctx.createGain(); master.gain.value = muted ? 0 : 1; master.connect(ctx.destination);
    sfxG = ctx.createGain(); sfxG.gain.value = 0.75; sfxG.connect(master);
    musG = ctx.createGain(); musG.gain.value = 0.2; musG.connect(master);
    return true;
  }
  const now = () => ctx.currentTime;

  function tone({ f = 440, f2, type = 'sine', t = 0.2, v = 0.25, at = 0, decay, dest }) {
    if (!ctx || muted) return;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f, now() + at);
    if (f2) o.frequency.exponentialRampToValueAtTime(Math.max(20, f2), now() + at + t);
    g.gain.setValueAtTime(0.0001, now() + at);
    g.gain.linearRampToValueAtTime(v, now() + at + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, now() + at + (decay || t) + 0.04);
    o.connect(g); g.connect(dest || sfxG);
    o.start(now() + at); o.stop(now() + at + (decay || t) + 0.1);
  }

  function noise({ t = 0.2, v = 0.2, at = 0, f = 1000, q = 1, type = 'bandpass', dest }) {
    if (!ctx || muted) return;
    const len = Math.max(1, (ctx.sampleRate * t) | 0);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2);
    const src = ctx.createBufferSource(); src.buffer = buf;
    const flt = ctx.createBiquadFilter(); flt.type = type; flt.frequency.value = f; flt.Q.value = q;
    const g = ctx.createGain(); g.gain.value = v;
    src.connect(flt); flt.connect(g); g.connect(dest || sfxG);
    src.start(now() + at);
  }

  const sfx = {
    step()   { noise({ t: 0.06, v: 0.05, f: 380, q: 0.6 }); },
    softstep() { noise({ t: 0.09, v: 0.018, f: 280, q: 0.5 }); },
    steal()  { [659, 880, 1174].forEach((f, i) => tone({ f, t: 0.14, v: 0.17, at: i * 0.07 })); noise({ t: 0.16, v: 0.08, f: 2400, q: 1.4 }); },
    throw()  { tone({ f: 900, f2: 300, type: 'triangle', t: 0.16, v: 0.13 }); },
    land()   { noise({ t: 0.28, v: 0.18, f: 520 }); tone({ f: 190, f2: 90, type: 'triangle', t: 0.2, v: 0.16 }); },
    alarm()  { [520, 392, 520, 392].forEach((f, i) => tone({ f, type: 'square', t: 0.12, v: 0.09, at: i * 0.13 })); },
    spotted(){ tone({ f: 330, f2: 660, type: 'sawtooth', t: 0.24, v: 0.16 }); noise({ t: 0.22, v: 0.12, f: 1600 }); },
    caught() { [392, 330, 262, 196].forEach((f, i) => tone({ f, type: 'sawtooth', t: 0.24, v: 0.16, at: i * 0.15, decay: 0.4 })); },
    win()    { [523, 659, 784, 1046, 1318].forEach((f, i) => tone({ f, t: 0.3, v: 0.18, at: i * 0.11 })); },
    fail()   { [262, 220, 174].forEach((f, i) => tone({ f, type: 'triangle', t: 0.35, v: 0.18, at: i * 0.18 })); },
    search() { tone({ f: 700, f2: 520, type: 'square', t: 0.08, v: 0.06 }); },
    door()   { noise({ t: 0.5, v: 0.15, f: 240 }); tone({ f: 110, f2: 60, t: 0.34, v: 0.12 }); },
    ui()     { tone({ f: 660, t: 0.05, v: 0.1 }); },
    crouch() { noise({ t: 0.07, v: 0.05, f: 220, q: 0.5 }); },
    pickup() { tone({ f: 880, t: 0.08, v: 0.1 }); },
  };

  function musicTick(dt) {
    if (!ctx || muted) return;
    const s = STATES[state];
    const stepDur = 60 / s.bpm / 4;
    musTimer += dt;
    let guard = 0;
    while (musTimer >= stepDur && guard++ < 24) {
      musTimer -= stepDur;
      const chord = s.chords[((step16 / 16) | 0) % s.chords.length];
      const s16 = step16 % 16;
      if (s16 === 0) {
        for (const f of chord) tone({ f: f / 2, type: 'sine', t: stepDur * 12, v: 0.045, decay: stepDur * 16, dest: musG });
      }
      if (Math.random() < s.density) {
        const f = chord[s.arp[s16 % s.arp.length]] * (s16 % 8 === 6 ? 2 : 1);
        tone({ f, type: s.wave === 'sawtooth' ? 'square' : s.wave, t: stepDur * 1.7, v: state === 'chase' ? 0.045 : 0.06, dest: musG });
      }
      if (state !== 'calm' && s16 % 4 === 0) noise({ t: 0.08, v: state === 'chase' ? 0.09 : 0.045, f: 160, dest: musG });
      step16++;
    }
  }

  return {
    ensure,
    unlock() { if (ensure() && ctx.state === 'suspended') ctx.resume(); },
    setMuted(v) { muted = !!v; if (master) master.gain.value = muted ? 0 : 1; },
    isMuted() { return muted; },
    hasCtx() { return !!ctx; },
    isRunning() { return !!ctx && ctx.state === 'running'; },
    setState(s) { if (STATES[s]) state = s; },
    get state() { return state; },
    tick(dt) { musicTick(dt); },
    stop() { musTimer = 0; step16 = 0; },
    sfx,
  };
}
