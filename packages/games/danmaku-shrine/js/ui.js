// DOM UI layer for Danmaku Shrine.

export function makeUI({ onStart, onRestart, onContinue, onBackTitle, onMute, onPause }) {
  const $ = id => document.getElementById(id);
  const el = {
    score: $('score'), best: $('best'), lives: $('lives'), bombs: $('bombs'),
    graze: $('graze'), bosstag: $('bosstag'),
    bossbar: $('bossbar'), bossname: $('bossname'), bossfill: $('bossfill'), spelltag: $('spelltag'),
    banner: $('banner'), bmain: document.querySelector('#banner .bmain'), bsub: document.querySelector('#banner .bsub'),
    toast: $('toast'), title: $('title'), end: $('end'), endh: $('endh'), endd: $('endd'),
    titlebest: $('titlebest'), mutebtn: $('mutebtn'), pausebtn: $('pausebtn'),
    start: $('startbtn'), go: $('go'), go2: $('go2'), touch: $('touch'),
  };

  el.start.addEventListener('click', () => onStart());
  el.go.addEventListener('click', () => onContinue());
  el.go2.addEventListener('click', () => onBackTitle());
  el.mutebtn.addEventListener('click', () => onMute());
  el.pausebtn.addEventListener('click', () => onPause());

  let bannerT = 0, toastT = 0;
  function showBanner(main, sub = '', ms = 1500) {
    el.bmain.textContent = main; el.bsub.textContent = sub;
    el.banner.classList.add('show');
    clearTimeout(bannerT); bannerT = setTimeout(() => el.banner.classList.remove('show'), ms);
  }
  function showToast(text, ms = 1500) {
    el.toast.textContent = text; el.toast.classList.add('show');
    clearTimeout(toastT); toastT = setTimeout(() => el.toast.classList.remove('show'), ms);
  }
  function setScore(v) { el.score.textContent = String(v); }
  function setBest(score, boss) {
    el.best.textContent = `纪录 ${score}${boss > 0 ? ` · 至第${boss + 1}魔` : ''}`;
    el.titlebest.textContent = score > 0 ? `最高纪录 ${score} · 到达第 ${boss + 1} 魔` : '还没有纪录，来创造第一个吧';
  }
  function setLives(n) { el.lives.textContent = '残机 ' + '✦'.repeat(Math.max(0, n)); }
  function setBombs(n) { el.bombs.textContent = '灵击 ' + '✺'.repeat(Math.max(0, n)); }
  function setGraze(g, meter) { el.graze.textContent = `擦弹 ${g} (灵击槽 ${Math.floor(meter)}%)`; }
  function showBoss(v) { el.bossbar.style.display = v ? 'block' : 'none'; }
  function setBoss(name, frac, spell) {
    el.bossname.textContent = name; el.bossfill.style.width = `${Math.max(0, Math.min(100, frac * 100))}%`;
    el.spelltag.textContent = spell;
  }
  function setBosstag(t) { el.bosstag.textContent = t; }
  function showTitle(v) { el.title.classList.toggle('hide', !v); }
  function showEnd(v) { el.end.style.display = v ? 'flex' : 'none'; }
  function setEnd(head, detail) { el.endh.textContent = head; el.endd.textContent = detail; }
  function setMutedIcon(m) { el.mutebtn.textContent = m ? '🔇' : '🔊'; el.mutebtn.classList.toggle('on', m); }
  function setPausedIcon(p) { el.pausebtn.classList.toggle('on', p); }

  return { el, showBanner, showToast, setScore, setBest, setLives, setBombs, setGraze, showBoss, setBoss, setBosstag, showTitle, showEnd, setEnd, setMutedIcon, setPausedIcon };
}
