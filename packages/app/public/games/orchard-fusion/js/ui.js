// DOM UI layer: score/best, next preview canvas, banner/toast, title & end
// screens, mute/pause buttons. Canvas-side floaters live in game.js.

export function makeUI({ onStart, onRestart, onBackTitle, onSwap, onMute, onPause }) {
  const $ = id => document.getElementById(id);
  const el = {
    score: $('score'), best: $('best'), nextcv: $('nextcv'), nextbox: $('nextbox'),
    banner: $('banner'), bmain: document.querySelector('#banner .bmain'), bsub: document.querySelector('#banner .bsub'),
    toast: $('toast'), title: $('title'), end: $('end'), endh: $('endh'), endd: $('endd'),
    titlebest: $('titlebest'), mutebtn: $('mutebtn'), pausebtn: $('pausebtn'),
    start: $('startbtn'), go: $('go'), go2: $('go2'),
  };

  el.start.addEventListener('click', () => onStart());
  el.go.addEventListener('click', () => onRestart());
  el.go2.addEventListener('click', () => onBackTitle());
  el.nextbox.addEventListener('click', () => onSwap());
  el.mutebtn.addEventListener('click', () => onMute());
  el.pausebtn.addEventListener('click', () => onPause());

  let bannerT = 0, toastT = 0;
  function showBanner(main, sub = '', ms = 1400) {
    el.bmain.textContent = main; el.bsub.textContent = sub;
    el.banner.classList.add('show');
    clearTimeout(bannerT); bannerT = setTimeout(() => el.banner.classList.remove('show'), ms);
  }
  function showToast(text, ms = 1800) {
    el.toast.textContent = text; el.toast.classList.add('show');
    clearTimeout(toastT); toastT = setTimeout(() => el.toast.classList.remove('show'), ms);
  }

  function setScore(v) { el.score.textContent = String(v); }
  function setBest(v) { el.best.textContent = `纪录 ${v}`; el.titlebest.textContent = v > 0 ? `最高纪录 ${v}` : '还没有纪录，来创造第一个吧'; }

  function drawNext(tier, r, drawFn) {
    const c = el.nextcv.getContext('2d');
    c.clearRect(0, 0, 72, 72);
    if (tier >= 0) drawFn(c, tier, 36, 38, r);
  }

  function showTitle(v) { el.title.classList.toggle('hide', !v); }
  function showEnd(v) { el.end.style.display = v ? 'flex' : 'none'; }
  function setEnd(head, detail) { el.endh.textContent = head; el.endd.textContent = detail; }
  function setMutedIcon(m) { el.mutebtn.textContent = m ? '🔇' : '🔊'; el.mutebtn.classList.toggle('on', m); }
  function setPausedIcon(p) { el.pausebtn.classList.toggle('on', p); }

  return { el, showBanner, showToast, setScore, setBest, drawNext, showTitle, showEnd, setEnd, setMutedIcon, setPausedIcon };
}
