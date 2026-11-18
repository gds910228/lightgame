// DOM UI layer for Prism Paths.

export function makeUI({ onStart, onContinue, onSelect, onBack, onPick, onUndo, onReset, onRestart, onBackTitle, onMute, onPause }) {
  const $ = id => document.getElementById(id);
  const el = {
    lvtag: $('lvtag'), best: $('best'), moves: $('moves'),
    banner: $('banner'), bmain: document.querySelector('#banner .bmain'), bsub: document.querySelector('#banner .bsub'),
    toast: $('toast'), title: $('title'), end: $('end'), endh: $('endh'), endd: $('endd'),
    titlebest: $('titlebest'), mutebtn: $('mutebtn'), pausebtn: $('pausebtn'),
    start: $('startbtn'), cont: $('contbtn'), select: $('select'), selectbtn: $('selectbtn'),
    selback: $('selback'), chaplist: $('chaplist'), selbest: $('selbest'),
    undobtn: $('undobtn'), resetbtn: $('resetbtn'), go: $('go'), go2: $('go2'),
  };

  el.start.addEventListener('click', () => onStart());
  el.cont.addEventListener('click', () => onContinue());
  el.selectbtn.addEventListener('click', () => onSelect());
  el.selback.addEventListener('click', () => onBack());
  el.undobtn.addEventListener('click', () => onUndo());
  el.resetbtn.addEventListener('click', () => onReset());
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
  function setLevel(n, name) { el.lvtag.textContent = `第 ${n} 关 · ${name}`; }
  function setStars(total, lvStars) {
    el.best.textContent = `总星 ${total} · 本关 ${'★'.repeat(lvStars) || '☆'}`;
    el.titlebest.textContent = total > 0 ? `已收集 ${total} / 90 星` : '还没有纪录，来点亮第一颗水晶吧';
    el.selbest.textContent = total > 0 ? `当前总星数 ${total} / 90` : '从第一章开始你的光路之旅';
  }
  function setMoves(m, par, lit = 0, total = 0) { el.moves.textContent = `步数 ${m} / par ${par} · 水晶 ${lit}/${total}`; }
  function renderSelect(LEVELS, stars, gates, current) {
    el.chaplist.innerHTML = '';
    const total = stars.reduce((a, b) => a + b, 0);
    const chapNames = ['第一章 · 反射入门', '第二章 · 分光与滤色', '第三章 · 综合挑战'];
    for (let ch = 0; ch < 3; ch++) {
      const div = document.createElement('div');
      div.className = 'chap';
      const unlocked = total >= gates[ch];
      div.innerHTML = `<div class="ct">${chapNames[ch]}${unlocked ? '' : `（需 ${gates[ch]} 星解锁）`}</div>`;
      const gridEl = document.createElement('div');
      gridEl.className = 'lgrid';
      for (let i = ch * 10; i < ch * 10 + 10; i++) {
        const btn = document.createElement('div');
        btn.className = 'lbtn' + (unlocked ? '' : ' locked') + (stars[i] ? ' done' : '');
        btn.innerHTML = `${i + 1}<div class="stars">${'★'.repeat(stars[i]) || '&nbsp;'}</div>`;
        btn.addEventListener('click', () => unlocked && onPick(i));
        gridEl.appendChild(btn);
      }
      div.appendChild(gridEl);
      el.chaplist.appendChild(div);
    }
  }
  function showSelect(v) { el.select.classList.toggle('on', v); }
  function showTitle(v) { el.title.classList.toggle('hide', !v); }
  function showEnd(v) { el.end.style.display = v ? 'flex' : 'none'; }
  function setEnd(head, detail) { el.endh.textContent = head; el.endd.textContent = detail; }
  function setMutedIcon(m) { el.mutebtn.textContent = m ? '🔇' : '🔊'; el.mutebtn.classList.toggle('on', m); }
  function setPausedIcon(p) { el.pausebtn.classList.toggle('on', p); }

  return { el, showBanner, showToast, setLevel, setStars, setMoves, renderSelect, showSelect, showTitle, showEnd, setEnd, setMutedIcon, setPausedIcon };
}
