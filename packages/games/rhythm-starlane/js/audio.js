// audio.js — WebAudio 全合成：SFX（判定/UI/Fever/结算）+ 按谱实时合成的歌曲播放器。
// 歌曲事件来自 songs.js 的 buildMusic（lead 旋律 + pad 和弦 + 鼓组 + bass），
// 由游戏每帧 songSync(songTime) 驱动前瞻调度（LOOKAHEAD 0.18s）。
// 暂停 = 停调度 + 掐掉未结束的源；恢复 = 重新锚定 ctx 时钟。无 ctx 时全部安全空转。

export function makeAudio() {
  let ctx = null, master = null, sfxG = null, musG = null, noiseBuf = null;
  let muted = false;
  let curSong = null, evq = [], evIdx = 0, anchor = 0, playing = false, pausedFlag = false;
  const live = new Set();
  const LOOKAHEAD = 0.18;
  const HIT_FREQS = [523.25, 659.25, 783.99, 987.77];   // C5 D5 E5 G5 四轨音色

  function ensure() {
    if (ctx) return true;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    try { ctx = new AC(); } catch (e) { return false; }
    master = ctx.createGain(); master.gain.value = muted ? 0 : 1; master.connect(ctx.destination);
    sfxG = ctx.createGain(); sfxG.gain.value = .55; sfxG.connect(master);
    musG = ctx.createGain(); musG.gain.value = .2; musG.connect(master);
    const len = ctx.sampleRate | 0;
    noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    return true;
  }
  const now = () => (ctx ? ctx.currentTime : 0);

  function reg(node, at, end) {
    live.add(node);
    node.addEventListener('ended', () => live.delete(node));
    node.start(at); node.stop(end);
  }
  function killLive() {
    for (const n of live) { try { n.stop(); } catch (e) { } }
    live.clear();
  }

  // at = 绝对 ctx 时间（undefined = 立即）
  function tone({ f = 440, f2, type = 'sine', t = .2, v = .3, at, decay = .1, dest }) {
    if (!ctx) return;
    at = at === undefined ? now() : at;
    if (at < now() - .01) return;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(f, at);
    if (f2) o.frequency.exponentialRampToValueAtTime(Math.max(20, f2), at + t);
    g.gain.setValueAtTime(0, at);
    g.gain.linearRampToValueAtTime(v, at + .01);
    g.gain.exponentialRampToValueAtTime(.0008, at + t + decay);
    o.connect(g); g.connect(dest || sfxG);
    reg(o, at, at + t + decay + .05);
  }
  function noise({ t = .15, v = .2, at, f = 1200, q = 1, dest }) {
    if (!ctx) return;
    at = at === undefined ? now() : at;
    if (at < now() - .01) return;
    const src = ctx.createBufferSource(); src.buffer = noiseBuf; src.loop = true;
    const flt = ctx.createBiquadFilter(); flt.type = 'bandpass'; flt.frequency.value = f; flt.Q.value = q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(v, at);
    g.gain.exponentialRampToValueAtTime(.001, at + t);
    src.connect(flt); flt.connect(g); g.connect(dest || sfxG);
    reg(src, at, at + t + .05);
  }
  function padTone(freqs, at, dur, wave) {
    for (const f of freqs) {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = wave || 'triangle'; o.frequency.value = f;
      o.detune.value = Math.random() * 6 - 3;
      g.gain.setValueAtTime(0, at);
      g.gain.linearRampToValueAtTime(.05, at + .25);
      g.gain.setValueAtTime(.05, at + Math.max(.26, dur - .15));
      g.gain.linearRampToValueAtTime(.0001, at + dur + .1);
      o.connect(g); g.connect(musG);
      reg(o, at, at + dur + .15);
    }
  }

  // ==================== 歌曲调度 ====================
  function scheduleEv(ev, at) {
    switch (ev.type) {
      case 'lead': {
        const v = ev.wave === 'sawtooth' ? .09 : .13;
        tone({ f: ev.f, type: ev.wave, t: Math.max(.09, ev.dur * .9), v, at, decay: .08, dest: musG });
        tone({ f: ev.f * 1.005, type: 'sine', t: Math.max(.09, ev.dur * .8), v: .05, at, decay: .08, dest: musG });
        break;
      }
      case 'pad': padTone(ev.freqs, at, ev.dur, ev.wave); break;
      case 'bass': tone({ f: ev.f, type: 'triangle', t: ev.dur * .85, v: .2, at, decay: .06, dest: musG }); break;
      case 'kick': tone({ f: 150, f2: 45, type: 'sine', t: .16, v: .5, at, decay: .05, dest: musG }); break;
      case 'snare':
        noise({ t: .12, v: .28, at, f: 1800, q: .9, dest: musG });
        tone({ f: 210, type: 'triangle', t: .05, v: .12, at, dest: musG });
        break;
      case 'hat': noise({ t: .03, v: .07, at, f: 7000, q: .7, dest: musG }); break;
    }
  }

  function playSong(music, fromT = 0) {
    curSong = music; evq = music ? music.evq : []; evIdx = 0; pausedFlag = false;
    while (evIdx < evq.length && evq[evIdx].t < fromT - .001) evIdx++;
    if (ctx) { anchor = now() + .08 - fromT; killLive(); }
    playing = !!music;
  }
  function pauseSong() {
    if (!playing) return;
    pausedFlag = true; playing = false;
    if (ctx) killLive();
  }
  function resumeSong(t) {
    if (!curSong) return;
    pausedFlag = false; playing = true;
    if (ctx) anchor = now() + .05 - t;
    while (evIdx < evq.length && evq[evIdx].t < t - .001) evIdx++;
  }
  function stopSong() {
    playing = false; pausedFlag = false; curSong = null; evq = []; evIdx = 0;
    if (ctx) killLive();
  }
  function seek(t) {
    if (!ctx || !playing) return;
    killLive();
    anchor = now() + .03 - t;
    while (evIdx < evq.length && evq[evIdx].t < t - .001) evIdx++;
  }
  function songSync(t) {
    if (!ctx || !playing || !curSong) return;
    while (evIdx < evq.length && evq[evIdx].t <= t + LOOKAHEAD) {
      const ev = evq[evIdx++];
      const at = anchor + ev.t;
      if (at < now() - .02) continue;      // 已经过期的拍点跳过
      scheduleEv(ev, at);
    }
  }

  // ==================== SFX ====================
  const sfx = {
    hit(judge, lane) {
      if (!ctx) return;
      if (judge === 'perfect') {
        const f = HIT_FREQS[lane] || 660;
        tone({ f, type: 'triangle', t: .09, v: .26, decay: .06 });
        tone({ f: f * 2, type: 'sine', t: .05, v: .1, at: now() + .012 });
        noise({ t: .04, v: .06, f: 4200, q: .8 });
      } else if (judge === 'good') {
        tone({ f: (HIT_FREQS[lane] || 660) * .75, type: 'sine', t: .07, v: .16, decay: .05 });
        noise({ t: .04, v: .04, f: 1500, q: .8 });
      } else {
        tone({ f: 140, f2: 70, type: 'sawtooth', t: .12, v: .2 });
        noise({ t: .09, v: .15, f: 300, q: .7 });
      }
    },
    fever() {
      if (!ctx) return;
      [440, 554, 659, 880].forEach((f, i) => tone({ f, type: 'triangle', t: .09, v: .2, at: now() + i * .07 }));
    },
    complete() {
      if (!ctx) return;
      [523, 659, 784, 1046, 1318].forEach((f, i) => tone({ f, type: 'triangle', t: .12, v: .2, at: now() + i * .11 }));
    },
    lose() {
      if (!ctx) return;
      [392, 330, 262, 196].forEach((f, i) => tone({ f, type: 'sawtooth', t: .2, v: .15, at: now() + i * .16, decay: .25 }));
    },
    ui() { if (ctx) tone({ f: 660, type: 'sine', t: .06, v: .16 }); },
  };

  return {
    ensure,
    setMuted(v) { muted = v; if (master) master.gain.value = v ? 0 : 1; },
    isMuted() { return muted; },
    hasCtx() { return !!ctx; },
    playSong, pauseSong, resumeSong, stopSong, seek, songSync,
    songPlaying: () => playing,
    songPausedFlag: () => pausedFlag,
    sfx,
  };
}
