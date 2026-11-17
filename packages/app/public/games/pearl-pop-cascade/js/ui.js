// DOM UI layer for Pearl Pop Cascade.

export function makeUI({ onStart, onRestart, onBackTitle, onMute, onPause }) {
  const $ = id => document.getElementById(id);
  const el = {
    score: $('score'), best: $('best'), round: $('round'), mult: $('mult'),
    ballcount: $('ballcount'), pegcount: $('pegcount'),
    banner: $('banner'), bmain: document.querySelector('#banner .bmain'), bsub: document.querySelector('#banner .bsub'),
    toast: $('toast'), title: $('title'), end: $('end'), endh: $('endh'), endd: $('endd'),
    titlebest: $('titlebest'), mutebtn: $('mutebtn'), pausebtn: $('pausebtn'),
    start: $('startbtn'), go: $('go'), go2: $('go2'),
  };

  el.start.addEventListener('click', () => onStart());
  el.go.addEventListener('click', () => onRestart());
  el.go2.addEventListener('click', () => onBackTitle());
  el.mutebtn.addEventListener('click', () => onMute());
  el.pausebtn.addEventListener('click', () => onPause());

  let bannerT = 0, toastT = 0;
  function showBanner(main, sub = '', ms = 1500) {
    el.bmain.textContent = main; el.bsub.textContent = sub;
    el.banner.classList.add('show');
    clearTimeout(bannerT); bannerT = setTimeout(() => el.banner.classList.remove('show'), ms);
  }
  function showToast(text, ms = 1600) {
    el.toast.textContent = text; el.toast.classList.add('show');
    clearTimeout(toastT); toastT = setTimeout(() => el.toast.classList.remove('show'), ms);
  }
  function setScore(v) { el.score.textContent = String(v); }
  function setBest(score, round) {
    el.best.textContent = `纪录 ${score}${round > 0 ? ` · 第${round}轮` : ''}`;
    el.titlebest.textContent = score > 0 ? `最高纪录 ${score} 分 · 第 ${round} 轮` : '还没有纪录，来创造第一个吧';
  }
  function setRound(v) { el.round.textContent = `第 ${v} 轮`; }
  function setMult(v) { el.mult.textContent = `本击倍率 ×${v}`; }
  function setBalls(v) { el.ballcount.textContent = `钢珠 ${v}`; }
  function setPegs(v) { el.pegcount.textContent = `珍珠 ${v}`; }
  function showTitle(v) { el.title.classList.toggle('hide', !v); }
  function showEnd(v) { el.end.style.display = v ? 'flex' : 'none'; }
  function setEnd(head, detail) { el.endh.textContent = head; el.endd.textContent = detail; }
  function setMutedIcon(m) { el.mutebtn.textContent = m ? '🔇' : '🔊'; el.mutebtn.classList.toggle('on', m); }
  function setPausedIcon(p) { el.pausebtn.classList.toggle('on', p); }

  return { el, showBanner, showToast, setScore, setBest, setRound, setMult, setBalls, setPegs, showTitle, showEnd, setEnd, setMutedIcon, setPausedIcon };
}
