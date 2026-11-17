// WebAudio synthesis for Deep Catch Saga: SFX (cast/splash/bite/reel/strain/
// burst/snap/catch/coin/buy/milestone/rock/stun/legendary/ui) + two-state
// music loop (surface / deep) with soft scheduling. All synthesized, no assets.
// BGM volume kept ≈ 1/4 of SFX per skill vfx-ui-audio guidance.
// Structure mirrors orchard-fusion/audio.js (ensure/hasCtx/setMuted/isMuted/
// state/update/stop/sfx); AUTOTEST mode keeps ctx null until ensure() is called.

export function makeAudio() {
  let ctx = null, master = null, sfxG = null, musG = null;
  let muted = false, state = 'surface', musTimer = 0, step16 = 0;
  const states = {
    surface: {
      bpm: 72, wave: 'sine',
      chords: [[261.6, 329.6, 392], [220, 277.2, 329.6], [196, 246.9, 293.7], [233.1, 293.7, 349.2]],
      arp: [0, 1, 2, 1], density: .35,
    },
    deep: {
      bpm: 56, wave: 'triangle',
      chords: [[146.8, 174.6, 220], [130.8, 155.6, 196], [123.5, 146.8, 185], [110, 130.8, 164.8]],
      arp: [0, 2, 1, 2], density: .3,
    },
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
    cast() {
      if (!ctx) return;
      noise({ t: .22, v: .16, f: 700, q: .7 });
      tone({ f: 260, f2: 900, type: 'sine', t: .18, v: .14 });
    },
    splash() {
      if (!ctx) return;
      noise({ t: .3, v: .3, f: 520, q: .6 });
      tone({ f: 220, f2: 80, type: 'sine', t: .18, v: .18 });
    },
    bite() {
      if (!ctx) return;
      tone({ f: 880, type: 'square', t: .07, v: .2 });
      tone({ f: 880, type: 'square', t: .07, v: .2, at: .11 });
      tone({ f: 480, f2: 720, type: 'sine', t: .12, v: .18, at: .05 });
    },
    reelTick() {
      if (!ctx) return;
      tone({ f: 1250, type: 'square', t: .03, v: .07 });
    },
    strain() {
      if (!ctx) return;
      tone({ f: 92, f2: 70, type: 'sawtooth', t: .14, v: .13 });
    },
    burst() {
      if (!ctx) return;
      noise({ t: .16, v: .3, f: 900, q: .8 });
      tone({ f: 220, f2: 60, type: 'square', t: .2, v: .3 });
    },
    snap() {
      if (!ctx) return;
      tone({ f: 420, f2: 55, type: 'sawtooth', t: .5, v: .28, decay: .3 });
      noise({ t: .3, v: .22, f: 1400, q: .6 });
      [330, 262, 196].forEach((f, i) => tone({ f, type: 'triangle', t: .2, v: .14, at: .2 + i * .16 }));
    },
    catch(q) {
      if (!ctx) return;
      const base = [392, 440, 494, 554, 622, 698, 784][Math.max(0, Math.min(6, q | 0))];
      [1, 1.25, 1.5, 2].forEach((m, i) => tone({ f: base * m, type: 'triangle', t: .16, v: .22, at: i * .08 }));
      if (q >= 4) noise({ t: .4, v: .1, f: 3200, q: .5, at: .1 });
    },
    legendary() {
      if (!ctx) return;
      [660, 880, 1108, 1318, 1760].forEach((f, i) => tone({ f, type: 'sine', t: .22, v: .18, at: i * .07 }));
      noise({ t: .5, v: .1, f: 4200, q: .4, at: .15 });
    },
    coin() {
      if (!ctx) return;
      tone({ f: 1320, type: 'sine', t: .06, v: .14 });
      tone({ f: 1760, type: 'sine', t: .08, v: .12, at: .06 });
    },
    buy() {
      if (!ctx) return;
      tone({ f: 520, f2: 780, type: 'triangle', t: .1, v: .2 });
      tone({ f: 1320, type: 'sine', t: .06, v: .12, at: .1 });
    },
    milestone() {
      if (!ctx) return;
      [784, 988, 1175, 1568].forEach((f, i) => tone({ f, type: 'triangle', t: .2, v: .18, at: i * .1 }));
    },
    rock() {
      if (!ctx) return;
      noise({ t: .16, v: .3, f: 220, q: .8 });
      tone({ f: 120, f2: 55, type: 'sine', t: .18, v: .26 });
    },
    stun() {
      if (!ctx) return;
      tone({ f: 620, f2: 180, type: 'sine', t: .32, v: .2 });
      tone({ f: 310, f2: 120, type: 'triangle', t: .32, v: .12, at: .05 });
    },
    ui() { if (ctx) tone({ f: 660, type: 'sine', t: .06, v: .16 }); },
  };

  // --- music: 16-step scheduler per state ---
  function musTick() {
    if (!ctx || muted) return;
    const s = states[state];
    const beat = 60 / s.bpm / 4;           // 16th note
    const chord = s.chords[Math.floor(step16 / 16) % s.chords.length];
    const ai = s.arp[step16 % s.arp.length];
    if (step16 % 16 === 0) {
      for (const f of chord) tone({ f, type: s.wave, t: beat * 14, v: .05, decay: beat * 6, dest: musG });
    }
    if (step16 % 2 === 0 || Math.random() < s.density * .5) {
      const f = chord[ai] * (step16 % 8 === 6 ? 2 : 1);
      tone({ f, type: 'sine', t: beat * 1.6, v: .09, decay: beat * 2, dest: musG });
    }
    if (state === 'surface' && step16 % 8 === 4) {
      noise({ t: .3, v: .05, f: 300, q: .5 });   // gentle wave wash
    }
    if (state === 'deep' && step16 % 16 === 12) {
      tone({ f: chord[0] * 4, type: 'sine', t: beat * 6, v: .04, decay: beat * 5, dest: musG }); // deep bell
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
