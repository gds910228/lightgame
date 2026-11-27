// Steel Frontier — fully synthesized WebAudio soundscape.
// Nothing is created until the first real user gesture; autotest stays silent.

export function makeAudio() {
  let ctx = null, master = null, sfxBus = null, musicBus = null;
  let muted = false, scene = 'title', bgmTimer = null, step = 0;

  function ensure() {
    if (muted) return null;
    if (!ctx) {
      try {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return null;
        ctx = new AC();
        master = ctx.createGain(); master.gain.value = 0.6; master.connect(ctx.destination);
        sfxBus = ctx.createGain(); sfxBus.gain.value = 0.9; sfxBus.connect(master);
        musicBus = ctx.createGain(); musicBus.gain.value = 0.24; musicBus.connect(master);
        if (ctx.state === 'suspended') ctx.resume();
        startBgm();
      } catch (e) { ctx = null; }
    }
    if (ctx && ctx.state === 'suspended') { try { ctx.resume(); } catch (e) { } }
    return ctx;
  }

  function tone(freq, dur, type = 'sine', vol = 0.25, slide = 0, delay = 0) {
    const c = ensure(); if (!c) return;
    const t0 = c.currentTime + delay;
    const o = c.createOscillator(), g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t0);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq + slide), t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g); g.connect(sfxBus); o.start(t0); o.stop(t0 + dur + 0.03);
  }

  function noise(dur, vol = 0.2, cutoff = 900, delay = 0) {
    const c = ensure(); if (!c) return;
    const len = Math.max(1, Math.floor(c.sampleRate * dur));
    const buf = c.createBuffer(1, len, c.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = c.createBufferSource(); src.buffer = buf;
    const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = cutoff;
    const g = c.createGain(); g.gain.value = vol;
    src.connect(f); f.connect(g); g.connect(sfxBus);
    src.start(c.currentTime + delay);
  }

  function play(name) {
    if (muted) return;
    switch (name) {
      case 'cannon': tone(160, 0.14, 'square', 0.22, -90); noise(0.08, 0.13, 900); break;
      case 'spread': tone(120, 0.18, 'sawtooth', 0.18, -45); noise(0.12, 0.16, 1300); break;
      case 'laser': tone(880, 0.16, 'sawtooth', 0.16, -560); tone(1420, 0.1, 'sine', 0.08, -820); break;
      case 'missile': tone(240, 0.28, 'triangle', 0.15, 130); noise(0.18, 0.1, 480, 0.02); break;
      case 'mine': tone(110, 0.12, 'square', 0.16, -40); noise(0.07, 0.12, 700); break;
      case 'hit': tone(95, 0.09, 'square', 0.22, -50); noise(0.08, 0.22, 900); break;
      case 'kill': noise(0.4, 0.32, 700); tone(70, 0.42, 'sawtooth', 0.25, -45); break;
      case 'explode': noise(0.34, 0.26, 520); tone(62, 0.32, 'sine', 0.25, -30); break;
      case 'spark': noise(0.05, 0.06, 2600); break;
      case 'round': tone(330, 0.16, 'triangle', 0.18); tone(440, 0.2, 'triangle', 0.16, 0, 0.11); tone(660, 0.28, 'triangle', 0.15, 0, 0.22); break;
      case 'win': [392, 523, 659, 784].forEach((f, i) => tone(f, 0.4, 'triangle', 0.2, 0, i * 0.12)); break;
      case 'lose': [330, 294, 247, 196].forEach((f, i) => tone(f, 0.42, 'sawtooth', 0.12, 0, i * 0.14)); break;
      case 'ui': tone(620, 0.055, 'square', 0.08); break;
      case 'count': tone(440, 0.08, 'square', 0.12); break;
      default: break;
    }
  }

  function startBgm() {
    if (bgmTimer || !ctx || muted) return;
    bgmTimer = setInterval(() => {
      if (muted || !ctx) return;
      if (!musicBus || ctx.state !== 'running') return;
      const scales = {
        title: [110, 138.6, 164.8, 196],
        battle: [98, 123.5, 146.8, 196],
        end: [130.8, 164.8, 196, 246.9],
      };
      const notes = scales[scene] || scales.title;
      const n = notes[step % notes.length];
      const c = ctx, t0 = c.currentTime;
      const o = c.createOscillator(), g = c.createGain();
      o.type = 'triangle'; o.frequency.value = n / 2;
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.linearRampToValueAtTime(0.05, t0 + 0.05);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.62);
      o.connect(g); g.connect(musicBus); o.start(t0); o.stop(t0 + 0.68);
      if (step % 4 === 2) {
        const h = c.createOscillator(), hg = c.createGain();
        h.type = 'sine'; h.frequency.value = n * 2;
        hg.gain.setValueAtTime(0.0001, t0); hg.gain.linearRampToValueAtTime(0.022, t0 + 0.03);
        hg.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.5);
        h.connect(hg); hg.connect(musicBus); h.start(t0); h.stop(t0 + 0.55);
      }
      step++;
    }, 520);
  }

  function setScene(s) {
    scene = s;
    if (s === 'battle') step = 1; else step = 0;
  }

  return {
    unlock: () => ensure(),
    play,
    setScene,
    setMuted(v) {
      muted = !!v;
      if (master) master.gain.value = muted ? 0 : 0.6;
      if (bgmTimer) { clearInterval(bgmTimer); bgmTimer = null; }
      if (!muted && ctx) startBgm();
    },
    isMuted: () => muted,
    hasCtx: () => !!ctx,
    close() { if (bgmTimer) clearInterval(bgmTimer); bgmTimer = null; try { ctx && ctx.close(); } catch (e) { } ctx = null; },
  };
}
