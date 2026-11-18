/* LightGame station audio layer (generic) — all assets CC0, see snd/SOURCES.md.
   Non-invasive: adds BGM loop + tap/click feedback + mute toggle. Engine code untouched. */
(function () {
  if (window.lgAudio) return;
  var st = { ctx: null, started: false, bgmOn: false, plays: {}, loaded: {}, muted: false };
  try { st.muted = localStorage.getItem('lg_muted') === '1'; } catch (e) {}

  function ensure() {
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    if (!st.ctx) {
      st.ctx = new AC();
      st.master = st.ctx.createGain();
      st.master.gain.value = st.muted ? 0 : 1;
      st.master.connect(st.ctx.destination);
      st.music = st.ctx.createGain(); st.music.gain.value = 0.16; st.music.connect(st.master);
      st.sfx = st.ctx.createGain(); st.sfx.gain.value = 0.4; st.sfx.connect(st.master);
    }
    if (st.ctx.state === 'suspended') st.ctx.resume();
    return true;
  }
  function load(name, url) {
    fetch(url).then(function (r) { if (!r.ok) throw 0; return r.arrayBuffer(); })
      .then(function (b) { return new Promise(function (res, rej) { st.ctx.decodeAudioData(b, res, rej); }); })
      .then(function (buf) { st.loaded[name] = buf; if (name === 'bgm') startBgm(); })
      .catch(function () {});
  }
  function play(name) {
    var buf = st.loaded && st.loaded[name];
    if (!buf || !st.ctx) return;
    var src = st.ctx.createBufferSource(); src.buffer = buf; src.connect(st.sfx); src.start();
    st.plays[name] = (st.plays[name] || 0) + 1;
  }
  function startBgm() {
    if (st.bgmOn || !st.ctx || !st.loaded.bgm) return;
    var src = st.ctx.createBufferSource(); src.buffer = st.loaded.bgm; src.loop = true;
    src.connect(st.music); src.start(); st.bgmOn = true;
  }
  function unlock() {
    if (!ensure()) return;
    if (!st.started) {
      st.started = true;
      load('bgm', 'snd/bgm.mp3');
      load('click', 'snd/click.mp3');
    } else {
      play('click');
    }
  }
  window.addEventListener('pointerdown', unlock, true);
  window.addEventListener('keydown', unlock, true);

  // mute toggle (top-right, remembers state; never plays click for its own taps)
  function addMute() {
    var b = document.createElement('button');
    b.id = 'lgMute';
    b.setAttribute('aria-label', 'toggle sound');
    b.style.cssText = 'position:fixed;top:6px;right:6px;z-index:2147483000;width:30px;height:30px;border-radius:15px;' +
      'border:1px solid rgba(0,0,0,.25);background:rgba(0,0,0,.35);color:#fff;font-size:15px;line-height:1;' +
      'cursor:pointer;opacity:.55;padding:0;';
    function label() { b.textContent = st.muted ? '\uD83D\uDD07' : '\uD83D\uDD0A'; }
    label();
    b.addEventListener('pointerdown', function (e) { e.stopPropagation(); }, true);
    b.addEventListener('click', function (e) {
      e.stopPropagation();
      st.muted = !st.muted;
      try { localStorage.setItem('lg_muted', st.muted ? '1' : '0'); } catch (err) {}
      if (st.master) st.master.gain.value = st.muted ? 0 : 1;
      label();
    });
    document.body.appendChild(b);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', addMute);
  else addMute();

  window.lgAudio = { debug: function () { return { ctxState: st.ctx ? st.ctx.state : 'none', started: st.started, bgmOn: st.bgmOn, muted: st.muted, plays: st.plays }; } };
})();
