// DOM UI layer for Hive IO.

export function makeUI({ onStart, onRestart, onBackTitle, onMute, onPause }) {
  const $ = id => document.getElementById(id);
  const el = {
    score: $('score'), best: $('best'), length: $('length'), kills: $('kills'),
    lbrows: $('lbrows'), banner: $('banner'),
    bmain: document.querySelector('#banner .bmain'), bsub: document.querySelector('#banner .bsub'),
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
  function showBanner(main, sub = '', ms = 1400) {
    el.bmain.textContent = main; el.bsub.textContent = sub;
    el.banner.classList.add('show');
    clearTimeout(bannerT); bannerT = setTimeout(() => el.banner.classList.remove('show'), ms);
  }
  function showToast(text, ms = 1600) {
    el.toast.textContent = text; el.toast.classList.add('show');
    clearTimeout(toastT); toastT = setTimeout(() => el.toast.classList.remove('show'), ms);
  }
  function setScore(v) { el.score.textContent = String(v); }
  function setBest(len, kills) {
    el.best.textContent = `纪录 体长${len} · 吞噬${kills}`;
    el.titlebest.textContent = len > 0 ? `最高纪录 体长 ${len} · 吞噬 ${kills}` : '还没有纪录，来创造第一个吧';
  }
  function setLength(v) { el.length.textContent = `体长 ${v}`; }
  function setKills(v) { el.kills.textContent = `吞噬 ${v}`; }
  // rows: [{name, len, me}]
  function setLeaderboard(rows) {
    let html = '';
    for (const r of rows) html += `<div class="row${r.me ? ' me' : ''}"><span>${r.rank}. ${r.name}</span><span>${r.len}</span></div>`;
    el.lbrows.innerHTML = html;
  }
  function showTitle(v) { el.title.classList.toggle('hide', !v); }
  function showEnd(v) { el.end.style.display = v ? 'flex' : 'none'; }
  function setEnd(head, detail) { el.endh.textContent = head; el.endd.textContent = detail; }
  function setMutedIcon(m) { el.mutebtn.textContent = m ? '🔇' : '🔊'; el.mutebtn.classList.toggle('on', m); }
  function setPausedIcon(p) { el.pausebtn.classList.toggle('on', p); }

  return { el, showBanner, showToast, setScore, setBest, setLength, setKills, setLeaderboard, showTitle, showEnd, setEnd, setMutedIcon, setPausedIcon };
}
