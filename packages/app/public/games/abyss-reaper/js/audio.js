// WebAudio synthesis for Abyss Reaper: SFX (shoot/hit/kill/pickup/levelup/
// evolve/hurt/heal/magnet/elite/bossWarn/bossDie/win/lose/ui...) + three-state
// music loop (calm / fight / boss) with per-sfx throttling for horde spam.
// All synthesized, no assets. BGM volume ≈ 1/4 of SFX per skill guidance.
// Field-by-field init mirrors orchard-fusion (missing fields get swallowed
// by catch — verify master/sfxG/musG all created).

export function makeAudio() {
  let ctx = null, master = null, sfxG = null, musG = null;
  let muted = false, state = 'calm', musTimer = 0, step16 = 0;
  const lastT = {};
  const guard = (k, gap) => {
    const t = performance.now();
    if (lastT[k] && t - lastT[k] < gap) return false;
    lastT[k] = t; return true;
  };

  const states = {
    calm:  { bpm: 66,  chords: [[110, 164.8, 196], [98, 146.8, 185], [87.3, 130.8, 174.6], [103.8, 155.6, 196]], arp: [0, 1, 2, 1], density: .35, wave: 'sine' },
    fight: { bpm: 96,  chords: [[130.8, 196, 233.1], [123.5, 185, 220], [110, 164.8, 207.7], [116.5, 174.6, 220]], arp: [0, 2, 1, 2, 0, 1, 2, 1], density: .7, wave: 'triangle' },
    boss:  { bpm: 132, chords: [[110, 130.8, 164.8], [103.8, 123.5, 155.6], [98, 116.5, 146.8], [92.5, 110, 138.6]], arp: [0, 1, 2, 1, 3, 1, 2, 1], density: .95, wave: 'sawtooth' },
  };

  function ensure() {
    if (ctx) return true;
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
    } catch (e) { return false; }
    master = ctx.createGain(); master.gain.value = muted ? 0 : 1; master.connect(ctx.destination);
    sfxG = ctx.createGain(); sfxG.gain.value = .8; sfxG.connect(master);
    musG = ctx.createGain(); musG.gain.value = .2; musG.connect(master);
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

  const sfx = {
    shoot() { if (!ctx || !guard('shoot', 90)) return; tone({ f: 520, f2: 320, type: 'triangle', t: .07, v: .14 }); },
    zap() { if (!ctx || !guard('zap', 110)) return; tone({ f: 1400, f2: 260, type: 'sawtooth', t: .1, v: .16 }); noise({ t: .08, v: .08, f: 2400, q: 1.4 }); },
    poison() { if (!ctx || !guard('poison', 200)) return; noise({ t: .3, v: .1, f: 420, q: .7 }); },
    hit() { if (!ctx || !guard('hit', 70)) return; tone({ f: 220, f2: 140, type: 'square', t: .045, v: .1 }); },
    kill() { if (!ctx || !guard('kill', 90)) return; tone({ f: 300, f2: 90, type: 'triangle', t: .1, v: .2 }); noise({ t: .08, v: .1, f: 900, q: .8 }); },
    pickup() { if (!ctx || !guard('pickup', 60)) return; tone({ f: 760, f2: 1140, type: 'sine', t: .07, v: .14 }); },
    levelup() { if (!ctx) return; [523, 659, 784].forEach((f, i) => tone({ f, type: 'triangle', t: .14, v: .2, at: i * .08 })); },
    evolve() { if (!ctx) return; [523, 659, 784, 1046, 1318].forEach((f, i) => tone({ f, type: 'triangle', t: .2, v: .2, at: i * .09 })); noise({ t: .5, v: .1, f: 1800, q: .6, at: .1 }); },
    hurt() { if (!ctx || !guard('hurt', 200)) return; tone({ f: 130, f2: 70, type: 'sawtooth', t: .18, v: .26 }); },
    heal() { if (!ctx) return; [392, 523, 659].forEach((f, i) => tone({ f, type: 'sine', t: .12, v: .16, at: i * .07 })); },
    magnet() { if (!ctx) return; noise({ t: .5, v: .16, f: 900, q: .5 }); tone({ f: 300, f2: 1200, type: 'sine', t: .4, v: .16 }); },
    elite() { if (!ctx) return; tone({ f: 160, f2: 60, type: 'sawtooth', t: .35, v: .3 }); noise({ t: .3, v: .2, f: 500, q: .6 }); },
    bossWarn() { if (!ctx) return; [660, 660, 440].forEach((f, i) => tone({ f, f2: f * .8, type: 'square', t: .18, v: .16, at: i * .3 })); },
    bossDie() { if (!ctx) return; noise({ t: .8, v: .3, f: 300, q: .5 }); [220, 180, 140, 100].forEach((f, i) => tone({ f, f2: f * .5, type: 'sawtooth', t: .3, v: .24, at: i * .14 })); },
    win() { if (!ctx) return; [523, 659, 784, 1046, 784, 1046, 1318].forEach((f, i) => tone({ f, type: 'triangle', t: .22, v: .2, at: i * .12 })); },
    lose() { if (!ctx) return; [392, 330, 262, 196].forEach((f, i) => tone({ f, type: 'sawtooth', t: .22, v: .18, at: i * .18, decay: .3 })); },
    ui() { if (!ctx) return; tone({ f: 660, type: 'sine', t: .06, v: .18 }); },
    warn() { if (!ctx) return; tone({ f: 880, f2: 660, type: 'square', t: .1, v: .1 }); },
  };

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
