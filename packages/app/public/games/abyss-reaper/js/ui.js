// DOM UI layer for Abyss Reaper: HUD (time/kills/level/hp/xp), boss bar,
// level-up three-choice cards, banner/toast, weapon chips, title & end
// screens, mute/pause buttons. World/floaters render on canvas in game.js.

export function makeUI({ onStart, onRestart, onBackTitle, onMute, onPause, onChoose }) {
  const $ = id => document.getElementById(id);
  const el = {
    time: $('time'), kills: $('kills'), lvl: $('lvl'),
    hpfill: $('hpfill'), hptext: $('hptext'), xpfill: $('xpfill'),
    bossbar: $('bossbar'), bossfill: $('bossfill'),
    mutebtn: $('mutebtn'), pausebtn: $('pausebtn'), wlist: $('wlist'),
    banner: $('banner'), bmain: document.querySelector('#banner .bmain'), bsub: document.querySelector('#banner .bsub'),
    toast: $('toast'), joy: $('joy'), joyknob: $('joyknob'),
    lvup: $('lvup'), lvcards: $('lvcards'),
    title: $('title'), titlebest: $('titlebest'), end: $('end'), endh: $('endh'), endd: $('endd'),
    start: $('startbtn'), go: $('go'), go2: $('go2'),
  };

  el.start.addEventListener('click', () => onStart());
  el.go.addEventListener('click', () => onRestart());
  el.go2.addEventListener('click', () => onBackTitle());
  el.mutebtn.addEventListener('click', () => onMute());
  el.pausebtn.addEventListener('click', () => onPause());

  let bannerT = 0, toastT = 0;
  function showBanner(main, sub = '', ms = 1400, cls = '') {
    el.bmain.textContent = main; el.bsub.textContent = sub;
    el.banner.className = 'show' + (cls ? ' ' + cls : '');
    clearTimeout(bannerT); bannerT = setTimeout(() => el.banner.classList.remove('show'), ms);
  }
  function showToast(text, ms = 2000) {
    el.toast.textContent = text; el.toast.classList.add('show');
    clearTimeout(toastT); toastT = setTimeout(() => el.toast.classList.remove('show'), ms);
  }

  let lastHud = '';
  function setHud(o) {
    // cheap change-detection: one string compare per frame
    const key = o.t + o.kills + o.lvl + o.hp + o.need + o.xp;
    if (key === lastHud) return;
    lastHud = key;
    el.time.textContent = o.t;
    el.kills.textContent = `击杀 ${o.kills}`;
    el.lvl.textContent = `Lv.${o.lvl}`;
    el.hpfill.style.width = `${Math.max(0, Math.min(100, o.hp / o.maxHp * 100))}%`;
    el.hptext.textContent = `${Math.ceil(o.hp)} / ${o.maxHp}`;
    el.xpfill.style.width = `${Math.max(0, Math.min(100, o.xp / o.need * 100))}%`;
  }

  function setBest(b) {
    const txt = (b.time > 0 || b.kills > 0)
      ? `最长存活 ${b.time}s · 最高击杀 ${b.kills}`
      : '还没有纪录，来创造第一个吧';
    el.titlebest.textContent = txt;
  }

  function setBoss(v) {   // null hides; {name, frac} shows
    if (v) { el.bossbar.classList.remove('hide'); el.bossfill.style.width = `${Math.max(0, Math.min(100, v.frac * 100))}%`; }
    else el.bossbar.classList.add('hide');
  }
  function setBossFrac(f) { el.bossfill.style.width = `${Math.max(0, Math.min(100, f * 100))}%`; }

  function setWeapons(items) {   // [{g, lv, evo}]
    el.wlist.innerHTML = items.map(it =>
      `<span class="wchip${it.evo ? ' evo' : ''}">${it.g}${it.lv}${it.evo ? '★' : ''}</span>`).join('');
  }

  function renderChoices(cards, onPick) {
    el.lvcards.innerHTML = '';
    cards.forEach((cd, i) => {
      const div = document.createElement('div');
      div.className = 'card' + (cd.cls ? ' ' + cd.cls : '');
      div.innerHTML = `<div class="cg">${cd.glyph}</div><div class="ctag">${cd.tag}</div>` +
        `<div class="cname">${cd.name}</div><div class="cdesc">${cd.desc}</div><div class="ckeys">按 ${i + 1} 或点选</div>`;
      div.addEventListener('click', () => onPick(i));
      el.lvcards.appendChild(div);
    });
  }
  function showLevelUp(v) { el.lvup.classList.toggle('hide', !v); }

  function showTitle(v) { el.title.classList.toggle('hide', !v); }
  function showEnd(v) { el.end.style.display = v ? 'flex' : 'none'; }
  function setEnd(head, detail, lose) {
    el.endh.textContent = head; el.endd.textContent = detail;
    el.end.classList.toggle('lose', !!lose);
  }
  function setMutedIcon(m) { el.mutebtn.textContent = m ? '🔇' : '🔊'; el.mutebtn.classList.toggle('on', m); }
  function setPausedIcon(p) { el.pausebtn.classList.toggle('on', p); }

  function showJoy(x, y, kx, ky) {
    el.joy.classList.remove('hide');
    el.joy.style.left = `${x - 48}px`; el.joy.style.top = `${y - 48}px`;
    el.joyknob.style.left = `${27 + kx}px`; el.joyknob.style.top = `${27 + ky}px`;
  }
  function hideJoy() { el.joy.classList.add('hide'); }

  return { el, showBanner, showToast, setHud, setBest, setBoss, setBossFrac, setWeapons, renderChoices, showLevelUp, showTitle, showEnd, setEnd, setMutedIcon, setPausedIcon, showJoy, hideJoy };
}
