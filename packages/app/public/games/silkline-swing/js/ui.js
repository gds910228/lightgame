// Silkline Swing — DOM UI layer: HUD, title level grid, end panel, touch pad.
import { LEVELS } from './levels.js';

export function makeUI(cb) {
  const $ = (id) => document.getElementById(id);
  const el = {
    hud: $('hud'), chapter: $('hud-chapter'), level: $('hud-level'),
    shards: $('hud-shards'), lives: $('hud-lives'), time: $('hud-time'), total: $('hud-total'),
    mute: $('mutebtn'), pause: $('pausebtn'), restart: $('restartbtn'),
    title: $('title'), grid: $('level-grid'), titleBest: $('title-best'), start: $('startbtn'),
    end: $('end'), endKick: $('end-kicker'), endHead: $('end-heading'), endReason: $('end-reason'),
    endStars: $('end-stars'), endShards: $('end-shards'), endTime: $('end-time'), endTotal: $('end-total'),
    endNext: $('end-next'), endRetry: $('end-retry'), endHome: $('end-home'),
    banner: $('banner'), bmain: document.querySelector('#banner .bmain'), bsub: document.querySelector('#banner .bsub'),
    toast: $('toast'), flash: $('flash'), guide: $('guide'), touch: $('touch'),
    grab: $('tgrab'), left: $('tleft'), right: $('tright'), tin: $('tin'), tout: $('tout'),
  };

  el.start.addEventListener('click', () => cb.onStart());
  el.endNext.addEventListener('click', () => cb.onNext());
  el.endRetry.addEventListener('click', () => cb.onRetry());
  el.endHome.addEventListener('click', () => cb.onHome());
  el.mute.addEventListener('click', () => cb.onMute());
  el.pause.addEventListener('click', () => cb.onPause());
  el.restart.addEventListener('click', () => cb.onRestart());

  // --- level grid (built once, refreshed on progress changes) ---
  const levelButtons = [];
  for (let ch = 0; ch < 3; ch++) {
    const wrap = document.createElement('div');
    wrap.className = 'chap';
    const t = document.createElement('div');
    t.className = 'ctitle';
    t.textContent = `第 ${['一', '二', '三'][ch]} 章 · ${LEVELS[ch * 6].chapterName}`;
    wrap.appendChild(t);
    for (let i = ch * 6; i < ch * 6 + 6; i++) {
      const b = document.createElement('button');
      b.className = 'lv';
      b.innerHTML = `<div class="n">第 ${i + 1} 关</div><div class="nm">${LEVELS[i].name}</div><div class="st">◇◇◇</div>`;
      b.addEventListener('click', () => cb.onLevel(i + 1));
      wrap.appendChild(b);
      levelButtons.push(b);
    }
    el.grid.appendChild(wrap);
  }

  let bannerTimer = 0, toastTimer = 0;
  function banner(main, sub = '', ms = 1500) {
    el.bmain.textContent = main;
    el.bsub.textContent = sub;
    el.banner.classList.add('show');
    clearTimeout(bannerTimer);
    if (ms > 0) bannerTimer = setTimeout(() => el.banner.classList.remove('show'), ms);
  }
  function hideBanner() { el.banner.classList.remove('show'); clearTimeout(bannerTimer); }
  function toast(text, ms = 1800) {
    el.toast.textContent = text;
    el.toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.toast.classList.remove('show'), ms);
  }
  function flash(on) {
    el.flash.classList.toggle('on', !!on);
    if (on) setTimeout(() => el.flash.classList.remove('on'), 220);
  }

  function renderGrid(progress, current) {
    const { starsByLevel, unlocked } = progress;
    for (let i = 0; i < 18; i++) {
      const b = levelButtons[i];
      const n = i + 1;
      const locked = n > unlocked;
      b.classList.toggle('locked', locked);
      b.classList.toggle('cur', n === current && !locked);
      const st = b.querySelector('.st');
      const got = starsByLevel[n] || 0;
      st.innerHTML = [0, 1, 2].map(k => k < got ? '★' : '<span class="off">★</span>').join('');
      const badge = b.querySelector('.badge');
      if (n === unlocked && got === 0 && !locked) {
        if (!badge) { const s = document.createElement('div'); s.className = 'badge'; s.textContent = '新'; b.appendChild(s); }
      } else if (badge) badge.remove();
    }
  }

  function showTitle(v, progress, current) {
    el.title.classList.toggle('hidden', !v);
    el.hud.classList.toggle('hidden', v);
    if (v && progress) {
      renderGrid(progress, current);
      el.titleBest.textContent = `总星 ${progress.totalStars} / 54 · 最佳 ${progress.best}`;
    }
  }
  function showHud(v) { el.hud.classList.toggle('hidden', !v); }
  function showEnd(v) { el.end.classList.toggle('show', !!v); }

  function setHud({ chapter, name, level, shards, lives, time, totalStars }) {
    el.chapter.textContent = chapter;
    el.level.textContent = `第 ${level} 关 · ${name}`;
    el.shards.innerHTML = [0, 1, 2].map(i => i < shards ? '✦' : '<span class="off">✦</span>').join('');
    el.lives.innerHTML = [0, 1, 2].map(i => i < lives ? '♥' : '<span class="off">♥</span>').join('');
    el.time.textContent = `${(time || 0).toFixed(1)}s`;
    el.total.textContent = `总星 ${totalStars} / 54`;
  }

  function endPanel(v) {
    el.endKick.textContent = v.kick;
    el.endHead.textContent = v.heading;
    el.endReason.textContent = v.reason || '';
    el.endStars.innerHTML = [0, 1, 2].map(i => i < v.stars ? '<span>★</span>' : '<span class="off">★</span>').join('');
    el.endShards.textContent = `${v.shards}/3`;
    el.endTime.textContent = `${(v.time || 0).toFixed(1)}s`;
    el.endTotal.textContent = String(v.totalStars);
    el.endNext.classList.toggle('hidden', !v.canNext);
    el.endNext.textContent = v.canNext ? (v.nextLabel || '下一关') : '';
    showEnd(true);
  }

  function setMute(m) { el.mute.textContent = m ? '静' : '声'; el.mute.classList.toggle('on', m); }
  function setPause(p) { el.pause.textContent = p ? '续' : '停'; el.pause.classList.toggle('on', p); }

  // --- touch pad ---
  function bindHold(btn, down, up) {
    const start = (e) => { e.preventDefault(); e.stopPropagation(); btn.classList.add('pressed'); down(); };
    const stop = (e) => { e.preventDefault(); e.stopPropagation(); btn.classList.remove('pressed'); up(); };
    btn.addEventListener('pointerdown', start);
    btn.addEventListener('pointerup', stop);
    btn.addEventListener('pointercancel', stop);
    btn.addEventListener('pointerleave', stop);
    btn.addEventListener('lostpointercapture', stop);
    btn.addEventListener('contextmenu', (e) => e.preventDefault());
  }
  let touchGrab = false, tLeft = false, tRight = false, tIn = false, tOut = false;
  bindHold(el.grab, () => { touchGrab = true; el.grab.classList.add('down'); cb.onGrabDown && cb.onGrabDown(); },
    () => { touchGrab = false; el.grab.classList.remove('down'); cb.onGrabUp && cb.onGrabUp(); });
  bindHold(el.left, () => { tLeft = true; }, () => { tLeft = false; });
  bindHold(el.right, () => { tRight = true; }, () => { tRight = false; });
  bindHold(el.tin, () => { tIn = true; }, () => { tIn = false; });
  bindHold(el.tout, () => { tOut = true; }, () => { tOut = false; });
  // keep the touch pad from grabbing the canvas underneath
  el.touch.addEventListener('pointerdown', (e) => e.stopPropagation());

  function isTouch() {
    return (navigator.maxTouchPoints || 0) > 0;
  }
  function showTouch(v) { el.touch.classList.toggle('on', !!v); }
  const touchState = () => ({ grab: touchGrab, left: tLeft, right: tRight, in: tIn, out: tOut });

  return {
    el, banner, hideBanner, toast, flash, renderGrid, showTitle, showHud, showEnd,
    setHud, endPanel, setMute, setPause, isTouch, showTouch, touchState,
    levelButtons,
  };
}
