// DOM UI layer for Nebula Run.

export function makeUI({ onStart, onRestart, onBackTitle, onMute, onPause }) {
  const $ = id => document.getElementById(id);
  const el = {
    score: $('score'), best: $('best'), dist: $('dist'), mult: $('mult'), shield: $('shield'),
    banner: $('banner'), bmain: document.querySelector('#banner .bmain'), bsub: document.querySelector('#banner .bsub'),
    toast: $('toast'), title: $('title'), end: $('end'), endh: $('endh'), endd: $('endd'),
    titlebest: $('titlebest'), mutebtn: $('mutebtn'), pausebtn: $('pausebtn'),
    start: $('startbtn'), go: $('go'), go2: $('go2'), touch: $('touch'),
  };

  el.start.addEventListener('click', () => onStart());
  el.go.addEventListener('click', () => onRestart());
  el.go2.addEventListener('click', () => onBackTitle());
  el.mutebtn.addEventListener('click', () => onMute());
  el.pausebtn.addEventListener('click', () => onPause());

  let bannerT = 0, toastT = 0;
  function showBanner(main, sub = '', ms = 1300) {
    el.bmain.textContent = main; el.bsub.textContent = sub;
    el.banner.classList.add('show');
    clearTimeout(bannerT); bannerT = setTimeout(() => el.banner.classList.remove('show'), ms);
  }
  function showToast(text, ms = 1600) {
    el.toast.textContent = text; el.toast.classList.add('show');
    clearTimeout(toastT); toastT = setTimeout(() => el.toast.classList.remove('show'), ms);
  }
  function setScore(v) { el.score.textContent = String(v); }
  function setBest(v) { el.best.textContent = `纪录 ${v}`; el.titlebest.textContent = v > 0 ? `最高纪录 ${v}` : '还没有纪录，来创造第一个吧'; }
  function setDist(m) { el.dist.textContent = `${Math.floor(m)} m`; }
  function setMult(n) { el.mult.textContent = `倍率 ×${n}`; }
  function setShield(on) { el.shield.textContent = on ? '护盾 ✓' : '护盾 ✗'; el.shield.style.color = on ? '#8af0c8' : '#e87a8a'; }
  function showTitle(v) { el.title.classList.toggle('hide', !v); }
  function showEnd(v) { el.end.style.display = v ? 'flex' : 'none'; }
  function setEnd(head, detail) { el.endh.textContent = head; el.endd.textContent = detail; }
  function setMutedIcon(m) { el.mutebtn.textContent = m ? '🔇' : '🔊'; el.mutebtn.classList.toggle('on', m); }
  function setPausedIcon(p) { el.pausebtn.classList.toggle('on', p); }

  return { el, showBanner, showToast, setScore, setBest, setDist, setMult, setShield, showTitle, showEnd, setEnd, setMutedIcon, setPausedIcon };
}
