// WebAudio synth: SFX variants with pitch randomization, 3-state music with crossfade.
// Skill rules: music ~1/3 of sfx volume; confirm sounds (parry) loudest; autotest starts muted.
const A = 440;
const noteHz = (semis) => A * Math.pow(2, semis / 12);

export function makeAudio() {
  let ctx = null, master, sfxG, musG, ambG;
  let musicState = 'none', musicNodes = [], muted = false;
  const rand = (a, b) => a + Math.random() * (b - a);

  function ensure() {
    if (ctx) return true;
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      master = ctx.createGain(); master.gain.value = muted ? 0 : .9; master.connect(ctx.destination);
      sfxG = ctx.createGain(); sfxG.gain.value = .9; sfxG.connect(master);
      musG = ctx.createGain(); musG.gain.value = .22; musG.connect(master);   // music at ~1/3 of sfx
      ambG = ctx.createGain(); ambG.gain.value = .14; ambG.connect(master);
    } catch (e) { ctx = null; return false; }
    return true;
  }
  const resume = () => { if (ctx && ctx.state === 'suspended') ctx.resume(); };

  // --- primitive helpers ---
  function noiseBuf(dur) {
    const n = ctx.sampleRate * dur | 0, b = ctx.createBuffer(1, n, ctx.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    return b;
  }
  function env(g, t0, a, peak, d, end = .0001) {
    g.gain.setValueAtTime(.0001, t0); g.gain.linearRampToValueAtTime(peak, t0 + a);
    g.gain.exponentialRampToValueAtTime(end, t0 + a + d);
  }
  function tone({ f = 440, f2, type = 'sine', dur = .2, vol = .3, delay = 0, out } = {}) {
    const o = ctx.createOscillator(), g = ctx.createGain(), t0 = ctx.currentTime + delay;
    o.type = type; o.frequency.setValueAtTime(f, t0);
    if (f2) o.frequency.exponentialRampToValueAtTime(Math.max(20, f2), t0 + dur);
    env(g, t0, .005, vol, dur);
    o.connect(g); g.connect(out || sfxG); o.start(t0); o.stop(t0 + dur + .05);
  }
  function noise({ dur = .2, vol = .3, filter = 'bandpass', f = 1200, f2, q = 1, delay = 0, out } = {}) {
    const s = ctx.createBufferSource(), g = ctx.createGain(), fl = ctx.createBiquadFilter();
    s.buffer = noiseBuf(dur + .05); fl.type = filter; fl.frequency.setValueAtTime(f, ctx.currentTime + delay); fl.Q.value = q;
    if (f2) fl.frequency.exponentialRampToValueAtTime(Math.max(20, f2), ctx.currentTime + delay + dur);
    env(g, ctx.currentTime + delay, .004, vol, dur);
    s.connect(fl); fl.connect(g); g.connect(out || sfxG);
    s.start(ctx.currentTime + delay);
  }
  const pv = () => rand(.92, 1.08); // pitch variant

  // --- SFX library (3+ variants by random pitch per skill) ---
  const S = {
    swing(heavy) {
      if (!ensure()) return; resume();
      const p = pv();
      noise({ dur: .13, vol: heavy ? .5 : .34, f: 2400 * p, f2: 500, q: 1.6 });
      if (heavy) noise({ dur: .1, vol: .3, f: 900 * p, f2: 220, q: 2, delay: .02 });
    },
    hit(heavy) {
      if (!ensure()) return; resume();
      const p = pv();
      tone({ f: heavy ? 70 : 110, f2: heavy ? 38 : 60, type: 'sine', dur: heavy ? .26 : .15, vol: heavy ? .8 : .55 });
      noise({ dur: .06, vol: .4, f: 2600 * p, f2: 800, q: 1.2 });
      tone({ f: 1300 * p, type: 'triangle', dur: .09, vol: .14 });           // metallic ping
      if (heavy) noise({ dur: .3, vol: .35, f: 300, f2: 60, q: .8 });
    },
    parry() {
      if (!ensure()) return; resume();
      const p = pv();
      tone({ f: 1750 * p, type: 'triangle', dur: .18, vol: .5 });            // loudest, crispest
      tone({ f: 2620 * p, type: 'sine', dur: .24, vol: .42, delay: .01 });
      noise({ dur: .12, vol: .28, f: 5200, f2: 2400, q: 2, delay: .005 });
      tone({ f: 660, f2: 990, type: 'sine', dur: .12, vol: .2, delay: .02 }); // synth overtone layer
    },
    dash() { if (!ensure()) return; noise({ dur: .18, vol: .25, f: 500, f2: 2200, q: 1.4 }); },
    step() { if (!ensure()) return; noise({ dur: .07, vol: .1, f: 380 * pv(), f2: 140, q: 1 }); },
    hurt() { if (!ensure()) return; tone({ f: 160, f2: 70, type: 'sawtooth', dur: .18, vol: .4 }); noise({ dur: .1, vol: .3, f: 700, f2: 200, q: 1 }); },
    cast() { if (!ensure()) return; tone({ f: 300, f2: 900, type: 'sine', dur: .7, vol: .16 }); tone({ f: 450, f2: 1350, type: 'sine', dur: .7, vol: .1, delay: .05 }); },
    orbBreak() { if (!ensure()) return; noise({ dur: .16, vol: .4, f: 3400, f2: 1200, q: 1.4 }); tone({ f: 980, f2: 500, type: 'triangle', dur: .12, vol: .2 }); },
    slam() {
      if (!ensure()) return;
      tone({ f: 55, f2: 30, type: 'sine', dur: .5, vol: .9 }); noise({ dur: .4, vol: .5, f: 260, f2: 50, q: .7 });
      noise({ dur: .12, vol: .3, f: 1800, f2: 500, q: 1 });
    },
    roar() {
      if (!ensure()) return;
      const o = ctx.createOscillator(), g = ctx.createGain(), t0 = ctx.currentTime;
      o.type = 'sawtooth'; o.frequency.setValueAtTime(62, t0);
      const lfo = ctx.createOscillator(), lg = ctx.createGain();
      lfo.frequency.value = 9; lg.gain.value = 14; lfo.connect(lg); lg.connect(o.frequency);
      const fl = ctx.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = 420;
      env(g, t0, .1, .75, 1.0);
      o.connect(fl); fl.connect(g); g.connect(sfxG);
      o.start(t0); lfo.start(t0); o.stop(t0 + 1.2); lfo.stop(t0 + 1.2);
      noise({ dur: .9, vol: .3, f: 300, f2: 90, q: .6 });
    },
    tele() { if (!ensure()) return; tone({ f: 220, f2: 340, type: 'sine', dur: .4, vol: .08 }); },
    drop(tier) {
      if (!ensure()) return; resume();
      const p = pv(), base = tier ? noteHz(24) : noteHz(17);
      [1, 1.5, 2.02].forEach((m, i) => tone({ f: base * m * p, type: 'sine', dur: tier ? .5 : .3, vol: .22 - i * .05, delay: i * .01 }));
    },
    heal() { if (!ensure()) return; [noteHz(12), noteHz(19), noteHz(24)].forEach((f, i) => tone({ f, type: 'sine', dur: .35, vol: .16, delay: i * .07 })); },
    exec() {
      if (!ensure()) return;
      noise({ dur: .2, vol: .55, f: 3000, f2: 400, q: 1.6 });
      tone({ f: 90, f2: 40, type: 'sine', dur: .35, vol: .7, delay: .05 });
      tone({ f: 1200, f2: 300, type: 'sawtooth', dur: .22, vol: .18 });
    },
    waveCast() { if (!ensure()) return; noise({ dur: .22, vol: .42, f: 600, f2: 2600, q: 1.2 }); tone({ f: 480, f2: 1050, type: 'sine', dur: .16, vol: .2 }); },
    rainHit() { if (!ensure()) return; tone({ f: 1350 * pv(), type: 'triangle', dur: .08, vol: .24 }); noise({ dur: .05, vol: .18, f: 2100, f2: 800, q: 1 }); },
    rainCast() { if (!ensure()) return; tone({ f: 700, f2: 1500, type: 'sine', dur: .5, vol: .16 }); noise({ dur: .4, vol: .12, f: 1600, f2: 600, q: 1.4 }); },
    meteor() { if (!ensure()) return; tone({ f: 1300, f2: 320, type: 'sine', dur: .8, vol: .16 }); noise({ dur: .7, vol: .14, f: 1800, f2: 500, q: 1.6 }); },
    click() { if (!ensure()) return; tone({ f: 720, type: 'triangle', dur: .06, vol: .15 }); },
    guardBreak() { if (!ensure()) return; tone({ f: 200, f2: 60, type: 'square', dur: .3, vol: .3 }); noise({ dur: .25, vol: .3, f: 900, f2: 200, q: 1 }); },
    win() { if (!ensure()) return; [12, 19, 24, 31].forEach((s, i) => tone({ f: noteHz(s), type: 'sine', dur: .8, vol: .2, delay: i * .16 })); },
    dead() { if (!ensure()) return; [7, 3, 0].forEach((s, i) => tone({ f: noteHz(s), type: 'sine', dur: .9, vol: .2, delay: i * .3 })); },
  };

  // --- procedural music: three states, crossfade; quiet (musG .22 vs sfx .9) ---
  const scales = { explore: [0, 2, 4, 7, 9], combat: [0, 3, 5, 7, 10], boss: [0, 1, 5, 7, 8] };
  let musTimer = null, step16 = 0, stateGain = {};
  function startMusic(state) {
    if (!ensure() || state === musicState) return; resume();
    musicState = state;
    for (const k of ['explore', 'combat', 'boss']) {
      if (!stateGain[k]) { stateGain[k] = ctx.createGain(); stateGain[k].gain.value = 0; stateGain[k].connect(musG); }
      stateGain[k].gain.setTargetAtTime(k === state ? 1 : 0, ctx.currentTime, .6);   // crossfade ~1.5s
    }
    if (!musTimer) {
      let next = ctx.currentTime + .1;
      const seq = () => {
        const t = next, s16 = step16++ % 16;
        const play = (st, f, dur, vol, type = 'sine') => {
          const o = ctx.createOscillator(), g = ctx.createGain();
          o.type = type; o.frequency.value = f;
          g.gain.setValueAtTime(.0001, t); g.gain.linearRampToValueAtTime(vol, t + .02);
          g.gain.exponentialRampToValueAtTime(.0001, t + dur);
          o.connect(g); g.connect(stateGain[st]); o.start(t); o.stop(t + dur + .1);
        };
        const drum = (st, vol) => {
          const s = ctx.createBufferSource(), g = ctx.createGain(), fl = ctx.createBiquadFilter();
          s.buffer = noiseBuf(.14); fl.type = 'lowpass'; fl.frequency.value = 180;
          g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(.0001, t + .13);
          s.connect(fl); fl.connect(g); g.connect(stateGain[st]); s.start(t);
        };
        const root = state === 'boss' ? -29 : state === 'combat' ? -24 : -27;   // low register
        const sc = scales[state];
        if (state === 'explore') {
          if (s16 % 8 === 0) play('explore', noteHz(root + 12), 2.2, .12, 'triangle');          // drone pulse
          if (s16 % 4 === 2 && Math.random() < .8) play('explore', noteHz(root + 24 + sc[Math.random() * sc.length | 0]), 1.1, .1, 'sine');
        } else if (state === 'combat') {
          if (s16 === 0) play('combat', noteHz(root), 1.4, .16, 'sawtooth');
          if (s16 % 8 === 4) play('combat', noteHz(root + 12), 1.2, .14, 'sawtooth');
          if (s16 % 4 === 0) drum('combat', .3);
          if (s16 % 2 === 1 && Math.random() < .5) play('combat', noteHz(root + 24 + sc[(step16 / 2 | 0) % sc.length]), .5, .09, 'triangle');
        } else if (state === 'boss') {
          if (s16 % 8 === 0) play('boss', noteHz(root), 1.8, .18, 'sawtooth');
          if (s16 % 8 === 3) play('boss', noteHz(root + 7), 1.4, .12, 'sawtooth');               // fifth
          if (s16 % 4 === 0) drum('boss', .42);
          if (s16 === 12) drum('boss', .3);
          if (s16 % 2 === 0 && Math.random() < .7) play('boss', noteHz(root + 24 + sc[(step16 / 2 | 0) % sc.length]), .4, .1, 'square');
        }
        next += .125;                                        // 120bpm 16ths
        musTimer = setTimeout(seq, Math.max(0, (next - ctx.currentTime - .02) * 1000));
      };
      seq();
    }
  }
  function stopMusic() {
    musicState = 'none';
    if (stateGain.explore) for (const k of Object.keys(stateGain)) stateGain[k].gain.setTargetAtTime(0, ctx.currentTime, .4);
  }

  // long ambient wind loop (>= several seconds so the loop point is inaudible per skill)
  let ambSrc = null;
  function startAmbient() {
    if (!ensure() || ambSrc) return;
    const b = noiseBuf(6), s = ctx.createBufferSource(), g = ctx.createGain(), fl = ctx.createBiquadFilter(), lfo = ctx.createOscillator(), lg = ctx.createGain();
    s.buffer = b; s.loop = true; fl.type = 'bandpass'; fl.frequency.value = 380; fl.Q.value = .5;
    g.gain.value = .1;
    lfo.frequency.value = .13; lg.gain.value = 180; lfo.connect(lg); lg.connect(fl.frequency);
    s.connect(fl); fl.connect(g); g.connect(ambG);
    s.start(); lfo.start(); ambSrc = { s, lfo };
  }

  return {
    S, startMusic, stopMusic, startAmbient,
    setMusic(state) { if (state) startMusic(state); else stopMusic(); },
    mute(m) {
      muted = m;
      if (ctx) master.gain.setTargetAtTime(m ? 0 : .9, ctx.currentTime, .05);
      else if (m) ensure();
    },
    get muted() { return muted; },
    dispose() { if (musTimer) clearTimeout(musTimer); if (ctx) ctx.close(); ctx = null; }
  };
}
