// Shadowspire Ninja — DOM UI layer. All Chinese microcopy lives here so the
// canvas can stay focused on the tower and the ninja.

export function makeUI(cb = {}) {
  const $ = id => document.getElementById(id);
  const el = {
    stage: $('stage'),
    title: $('title'), titleBest: $('titlebest'), start: $('startbtn'),
    end: $('end'), endKicker: $('endkicker'), endTitle: $('endh'), endDetail: $('endd'),
    restart: $('go'), back: $('go2'), share: $('sharebtn'),
    pause: $('pause'), resume: $('resumebtn'), pauseBack: $('pauseback'),
    mute: $('mutebtn'), pausebtn: $('pausebtn'),
    height: $('hud-height'), best: $('hud-best'), score: $('hud-score'), dust: $('hud-dust'),
    lives: $('hud-lives'), chiFill: $('chi-fill'), chiText: $('chi-text'),
    dash: $('dash-state'), flow: $('flow-badge'), zone: $('zone-name'), zoneEn: $('zone-en'),
    banner: $('banner'), bannerMain: $('banner-main'), bannerSub: $('banner-sub'),
    toast: $('toast'),
  };

  const cache = {};

  el.start.addEventListener('click', () => cb.onStart && cb.onStart());
  el.restart.addEventListener('click', () => cb.onRestart && cb.onRestart());
  el.back.addEventListener('click', () => cb.onBackTitle && cb.onBackTitle());
  el.share.addEventListener('click', () => cb.onShare && cb.onShare());
  el.mute.addEventListener('click', () => cb.onMute && cb.onMute());
  el.pausebtn.addEventListener('click', () => cb.onPause && cb.onPause());
  el.resume.addEventListener('click', () => cb.onPause && cb.onPause());
  el.pauseBack.addEventListener('click', () => cb.onBackTitle && cb.onBackTitle());

  let bannerT = 0, toastT = 0;

  function banner(main, sub = '', ms = 1600) {
    el.bannerMain.textContent = main;
    el.bannerSub.textContent = sub;
    el.banner.classList.add('show');
    clearTimeout(bannerT);
    bannerT = setTimeout(() => el.banner.classList.remove('show'), ms);
  }

  function toast(text, ms = 2200) {
    el.toast.textContent = text;
    el.toast.classList.add('show');
    clearTimeout(toastT);
    toastT = setTimeout(() => el.toast.classList.remove('show'), ms);
  }

  function setBest(v) {
    const b = Math.max(0, Math.floor(v || 0));
    cache.best = b;
    el.titleBest.textContent = b > 0 ? `最高抵达 ${b}m` : '尚无登顶纪录';
    el.best.textContent = `最高 ${b}m`;
  }

  function setMuted(m) {
    el.mute.textContent = m ? '静' : '声';
    el.mute.classList.toggle('on', !!m);
    el.mute.setAttribute('aria-label', m ? '取消静音' : '静音');
  }

  function setPaused(p) {
    el.pausebtn.classList.toggle('on', !!p);
    el.pause.classList.toggle('hide', !p);
  }

  function showTitle(v) {
    el.title.classList.toggle('hide', !v);
    el.stage.classList.toggle('title-mode', !!v);
    if (v) {
      el.end.classList.add('hide');
      el.pause.classList.add('hide');
    }
  }

  function showPause(v) {
    el.pause.classList.toggle('hide', !v);
  }

  function showEnd(data = {}) {
    const win = data.kind === 'win';
    el.endKicker.textContent = win ? 'THE MOON GATE OPENS' : 'THE LANTERN GOES DARK';
    el.endTitle.textContent = win ? '登临星阁' : '灯 熄 塔 沉';
    el.endDetail.textContent = win
      ? `抵达 1200m · 得分 ${data.score | 0}\n最高高度 ${data.best | 0}m\n用时 ${(data.time || 0).toFixed(1)} 秒`
      : `止步 ${data.height | 0}m · 得分 ${data.score | 0}\n最高高度 ${data.best | 0}m\n${data.cause || '坠入深渊'}`;
    el.restart.textContent = win ? '再登一次' : '再来一局';
    el.end.classList.remove('hide');
    el.share.textContent = win ? '分享登顶' : '分享高度';
  }

  function hideEnd() {
    el.end.classList.add('hide');
  }

  function setHud(s) {
    const h = Math.max(0, Math.floor(s.height));
    const b = Math.max(0, Math.floor(s.best));
    if (cache.height !== h) { el.height.textContent = `${h}m`; cache.height = h; }
    if (cache.bestHud !== b) { el.best.textContent = `最高 ${b}m`; cache.bestHud = b; }
    if (cache.score !== s.score) { el.score.textContent = String(s.score | 0); cache.score = s.score; }
    if (cache.dust !== s.dust) { el.dust.textContent = String(s.dust | 0); cache.dust = s.dust; }
    if (cache.lives !== s.lives) {
      el.lives.textContent = `${Math.max(0, s.lives)} / 3`;
      cache.lives = s.lives;
    }
    const pct = Math.max(0, Math.min(1, s.chi / s.maxChi));
    const chiKey = Math.round(pct * 100);
    if (cache.chi !== chiKey) {
      el.chiFill.style.width = `${chiKey}%`;
      el.chiText.textContent = `气 ${Math.floor(s.chi)}`;
      cache.chi = chiKey;
    }
    if (cache.zone !== s.zone.id) {
      el.zone.textContent = s.zone.name;
      el.zoneEn.textContent = s.zone.en;
      el.stage.dataset.zone = s.zone.id;
      cache.zone = s.zone.id;
    }
    const dashTxt = s.dashCd > 0.01 ? `疾影 ${s.dashCd.toFixed(1)}s` : '疾影 就绪';
    if (cache.dash !== dashTxt) { el.dash.textContent = dashTxt; cache.dash = dashTxt; }
    const flowOn = s.flowT > 0;
    el.flow.classList.toggle('show', flowOn);
    if (flowOn) el.flow.textContent = `流 ×${s.flowMult.toFixed(2)}  ${s.flowT.toFixed(1)}s`;
  }

  return {
    el, banner, toast, setBest, setMuted, setPaused, showTitle, showPause,
    showEnd, hideEnd, setHud,
  };
}
