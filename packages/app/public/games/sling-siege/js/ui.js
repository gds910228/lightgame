// DOM UI layer for Sling Siege: HUD (level/score/enemies), ammo selector,
// banner/toast, title / level-select / end / pause panels, mute/pause/retry
// buttons, star pop animation. Canvas-side floaters live in game.js.

export function makeUI({ onStart, onSelect, onBack, onPick, onRetry, onNext, onMenu, onResume, onMute, onPause }) {
  const $ = id => document.getElementById(id);
  const el = {
    lvtag: $('lvtag'), score: $('score'), enemies: $('enemies'),
    amb: $('am-ball'), amt: $('am-tnt'), amr: $('am-tri'),
    banner: $('banner'),
    bmain: document.querySelector('#banner .bmain'), bsub: document.querySelector('#banner .bsub'),
    toast: $('toast'), title: $('title'), titlebest: $('titlebest'),
    select: $('select'), chaplist: $('chaplist'), selbest: $('selbest'),
    end: $('end'), endh: $('endh'), endstars: $('endstars'), endd: $('endd'),
    next: $('nextbtn'), endretry: $('endretry'), endmenu: $('endmenu'),
    pausep: $('pausep'), resumebtn: $('resumebtn'), pauseretry: $('pauseretry'), pausemenu: $('pausemenu'),
    mutebtn: $('mutebtn'), pausebtn: $('pausebtn'), retrybtn: $('retrybtn'),
    start: $('startbtn'), selectbtn: $('selectbtn'), selback: $('selback'),
  };

  el.start.addEventListener('click', () => onStart());
  el.selectbtn.addEventListener('click', () => onSelect());
  el.selback.addEventListener('click', () => onBack());
  el.next.addEventListener('click', () => onNext());
  el.endretry.addEventListener('click', () => onRetry());
  el.endmenu.addEventListener('click', () => onMenu());
  el.resumebtn.addEventListener('click', () => onResume());
  el.pauseretry.addEventListener('click', () => onRetry());
  el.pausemenu.addEventListener('click', () => onMenu());
  el.mutebtn.addEventListener('click', () => onMute());
  el.pausebtn.addEventListener('click', () => onPause());
  el.retrybtn.addEventListener('click', () => onRetry());
  for (const [btn, kind] of [[el.amb, 'ball'], [el.amt, 'tnt'], [el.amr, 'tri']]) {
    btn.addEventListener('click', (e) => { e.stopPropagation(); onPick(kind); });
  }

  let bannerT = 0, toastT = 0;
  function showBanner(main, sub = '', ms = 1600) {
    el.bmain.textContent = main; el.bsub.textContent = sub;
    el.banner.classList.add('show');
    clearTimeout(bannerT); bannerT = setTimeout(() => el.banner.classList.remove('show'), ms);
  }
  function showToast(text, ms = 2400) {
    el.toast.textContent = text; el.toast.classList.add('show');
    clearTimeout(toastT); toastT = setTimeout(() => el.toast.classList.remove('show'), ms);
  }

  function setLevel(n, name, par) { el.lvtag.textContent = `第 ${n} 关 · ${name} · ≤${par} 发得三星`; }
  function setScore(v) { el.score.textContent = String(v); }
  function setEnemiesLeft(n) { el.enemies.textContent = `敌 ×${n}`; }
  function setTitleBest(total) {
    el.titlebest.textContent = total > 0 ? `已收集 ${total} / 72 星` : '还没有纪录，来拆第一座塔吧';
    el.selbest.textContent = total > 0 ? `当前总星数 ${total} / 72` : '从第一章开始你的破坏之旅';
  }
  function setAmmo(ammo, cur) {
    const map = [[el.amb, 'ball', '1 石球'], [el.amt, 'tnt', '2 炸药'], [el.amr, 'tri', '3 三连珠']];
    for (const [btn, k, label] of map) {
      btn.querySelector('.cnt').textContent = String(ammo[k] || 0);
      btn.classList.toggle('on', cur === k);
      btn.classList.toggle('empty', !(ammo[k] > 0));
    }
  }
  function setMutedIcon(m) { el.mutebtn.textContent = m ? '🔇' : '🔊'; el.mutebtn.classList.toggle('on', m); }
  function setPausedIcon(p) { el.pausebtn.classList.toggle('on', p); }

  function showTitle(v) { el.title.classList.toggle('hide', !v); }
  function showSelect(v) { el.select.classList.toggle('hide', !v); }
  function showEnd(v) { el.end.style.display = v ? 'flex' : 'none'; }
  function showPause(v) { el.pausep.style.display = v ? 'flex' : 'none'; }

  function setEnd(win, { stars = 0, score = 0, used = 0, par = 0, left = 0 } = {}) {
    el.endh.textContent = win ? '过关！' : '功亏一篑';
    el.endh.style.color = win ? '#ffd34d' : '#e88a7a';
    // stars row with staggered pop animation
    el.endstars.innerHTML = '';
    for (let i = 0; i < 3; i++) {
      const s = document.createElement('span');
      s.className = 'st' + (win && i < stars ? ' on' : '');
      s.textContent = win && i < stars ? '★' : '☆';
      s.style.animationDelay = `${0.15 + i * 0.18}s`;
      el.endstars.appendChild(s);
    }
    el.endd.textContent = win
      ? `得分 ${score}\n用弹 ${used} / 目标 ${par}${used <= par ? ' · 完美！' : ''}`
      : `还剩 ${left} 个敌人盘踞\n得分 ${score}`;
    el.next.style.display = win ? '' : 'none';
  }

  // level select grid: 3 chapter blocks, 8 buttons each
  function buildSelect(levels, records, unlockedLevel, pickFn) {
    el.chaplist.innerHTML = '';
    const chaps = [
      { name: '第一章 · 初试身手', need: 0 },
      { name: '第二章 · 石堡攻坚', need: 9 },
      { name: '第三章 · 机关要塞', need: 18 },
    ];
    for (const lv of levels) {
      // chapter header before levels 1 / 9 / 17
      if (lv.no === 1 || lv.no === 9 || lv.no === 17) {
        const chap = chaps[lv.no === 1 ? 0 : (lv.no === 9 ? 1 : 2)];
        const open = totalStarsOf(records) >= chap.need;
        const h = document.createElement('div');
        h.className = 'chaphead' + (open ? '' : ' chaplock');
        h.id = `chap-${lv.no === 1 ? 1 : (lv.no === 9 ? 2 : 3)}`;
        h.textContent = chap.need > 0 ? `${chap.name}（需 ${chap.need}★）` : chap.name;
        el.chaplist.appendChild(h);
      }
      const rec = records[lv.no];
      const unlocked = unlockedLevel(lv.no);
      const btn = document.createElement('button');
      btn.id = `lvl-${lv.no}`;
      btn.className = 'lvlbtn' + (unlocked ? '' : ' lock');
      const stars = rec ? '★'.repeat(rec.s) + '☆'.repeat(3 - rec.s) : '☆☆☆';
      btn.innerHTML = `<b>${lv.no}</b><i>${unlocked ? stars : '🔒'}</i><em>${lv.name}</em>`;
      btn.title = unlocked ? `${lv.name}：${lv.hint}` : '先收集足够星数并通关前一关';
      if (unlocked) btn.addEventListener('click', () => pickFn(lv.no));
      el.chaplist.appendChild(btn);
    }
  }

  function totalStarsOf(records) {
    let t = 0;
    for (const k in records) t += records[k].s || 0;
    return t;
  }

  return {
    el, showBanner, showToast, setLevel, setScore, setEnemiesLeft, setTitleBest,
    setAmmo, setMutedIcon, setPausedIcon, showTitle, showSelect, showEnd, showPause,
    setEnd, buildSelect,
  };
}
