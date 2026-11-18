/* gold-miner audio layer — non-invasive (no engine changes).
   Hooks: first pointerdown = unlock + hook-launch sound;
          #hs score increase = coin sound; BGM loops after unlock.
   All audio CC0, see snd/CREDITS.txt. Music gain ~1/4 of SFX. */
(function () {
  if (window.gmAudio) return;
  var st = { ctx: null, music: null, sfx: null, started: false, bgmOn: false, loaded: {}, lastCoin: 0, plays: {} };
  var defs = { launch: 'snd/launch.mp3', coin: 'snd/coin.mp3', win: 'snd/win.mp3', lose: 'snd/lose.mp3' };

  function ensure() {
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    if (!st.ctx) {
      st.ctx = new AC();
      st.music = st.ctx.createGain(); st.music.gain.value = 0.22; st.music.connect(st.ctx.destination);
      st.sfx = st.ctx.createGain(); st.sfx.gain.value = 0.9; st.sfx.connect(st.ctx.destination);
    }
    if (st.ctx.state === 'suspended') st.ctx.resume();
    return true;
  }
  function load(name, url) {
    fetch(url).then(function (r) { if (!r.ok) throw 0; return r.arrayBuffer(); })
      .then(function (b) { return new Promise(function (res, rej) { st.ctx.decodeAudioData(b, res, rej); }); })
      .then(function (buf) { st.loaded[name] = buf; if (name === 'bgm') startBgm(); })
      .catch(function () { /* missing/unreadable file: stay silent */ });
  }
  function play(name) {
    var buf = st.loaded[name];
    if (!buf || !st.ctx) return;
    var src = st.ctx.createBufferSource();
    src.buffer = buf;
    src.connect(st.sfx);
    src.start();
    st.plays[name] = (st.plays[name] || 0) + 1;
  }
  function startBgm() {
    if (st.bgmOn || !st.ctx || !st.loaded.bgm) return;
    var src = st.ctx.createBufferSource();
    src.buffer = st.loaded.bgm;
    src.loop = true;
    src.connect(st.music);
    src.start();
    st.bgmOn = true;
  }
  function unlock() {
    if (!ensure()) return;
    if (!st.started) {
      st.started = true;
      for (var k in defs) load(k, defs[k]);
      load('bgm', 'snd/bgm.mp3');
    }
    play('launch');
  }
  window.addEventListener('pointerdown', unlock, true);

  // score increase -> coin (engine writes 'Score: NNNNN' into #s1; #hs was a decoy)
  function watchScore() {
    var el = document.getElementById('s1') || document.getElementById('hs');
    if (!el) return;
    var prev = parseInt((el.innerText || '').replace(/\D/g, ''), 10) || 0;
    new MutationObserver(function () {
      var v = parseInt((el.innerText || '').replace(/\D/g, ''), 10) || 0;
      if (v > prev && Date.now() - st.lastCoin > 120) { play('coin'); st.lastCoin = Date.now(); }
      prev = v;
    }).observe(el, { childList: true, characterData: true, subtree: true });
  }

  function debug() {
    return {
      ctxState: st.ctx ? st.ctx.state : 'none',
      started: st.started,
      bgmOn: st.bgmOn,
      loaded: Object.keys(st.loaded),
      plays: st.plays,
      sfxGain: st.sfx ? st.sfx.gain.value : null,
      musicGain: st.music ? st.music.gain.value : null
    };
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', watchScore);
  } else {
    watchScore();
  }
  window.gmAudio = { debug: debug, play: play };
})();
