// Echo Hour — DOM UI: HUD, dual timeline, title grid, end panel, touch controls.
import { LEVELS, CHAPTERS } from './levels.js';

export function makeUI(cb) {
  const $ = (id) => document.getElementById(id);
  const el = {
    hud: $('hud'), chapter: $('hud-chapter'), level: $('hud-level'),
    keys: $('hud-keys'), lives: $('hud-lives'), time: $('hud-time'), rewinds: $('hud-rewinds'),
    total: $('hud-total'), mute: $('mutebtn'), pause: $('pausebtn'), restart: $('restartbtn'),
    timeline: $('timeline'), recfill: $('recfill'), rewfill: $('rewfill'),
    recrow: $('recrow'), rewrow: $('rewrow'), reclabel: $('reclabel'), rewlabel: $('rewlabel'),
    title: $('title'), grid: $('level-grid'), titleBest: $('title-best'), start: $('startbtn'),
    end: $('end'), endKick: $('end-kicker'), endHead: $('end-heading'), endReason: $('end-reason'),
    endStars: $('end-stars'), endKeys: $('end-keys'), endTime: $('end-time'),
    endRewinds: $('end-rewinds'), endTotal: $('end-total'),
    endNext: $('end-next'), endRetry: $('end-retry'), endHome: $('end-home'),
    banner: $('banner'), bmain: document.querySelector('#banner .bmain'), bsub: document.querySelector('#banner .bsub'),
    toast: $('toast'), flash: $('flash'), guide: $('guide'), touch: $('touch'),
    tleft: $('tleft'), tright: $('tright'), tjump: $('tjump'), trec: $('trec'), trew: $('trew'),
  };

  el.start.addEventListener('click', () => cb.onStart());
  el.endNext.addEventListener('click', () => cb.onNext());
  el.endRetry.addEventListener('click', () => cb.onRetry());
  el.endHome.addEventListener('click', () => cb.onHome());
  el.mute.addEventListener('click', () => cb.onMute());
  el.pause.addEventListener('click', () => cb.onPause());
  el.restart.addEventListener('click', () => cb.onRestart());

  // ---- level grid (3 chapters × 4) ----
  const levelButtons = [];
  for (let ch = 0; ch < 3; ch++) {
    const wrap = document.createElement('div');
    wrap.className = 'chap';
    const t = document.createElement('div');
    t.className = 'ctitle';
    t.textContent = `第 ${['一', '二', '三'][ch]} 章 · ${CHAPTERS[ch].name}`;
    wrap.appendChild(t);
    for (let i = ch * 4; i < ch * 4 + 4; i++) {
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
  function banner(main, sub = '', ms = 1600) {
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
    for (let i = 0; i < LEVELS.length; i++) {
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
    el.timeline.classList.toggle('hidden', v);
    if (v && progress) {
      renderGrid(progress, current);
      el.titleBest.textContent = `总星 ${progress.totalStars} / ${LEVELS.length * 3} · 最佳 ${progress.best}`;
    }
  }
  function showHud(v) {
    el.hud.classList.toggle('hidden', !v);
    el.timeline.classList.toggle('hidden', !v);
  }
  function showEnd(v) { el.end.classList.toggle('show', !!v); }

  function setHud(v) {
    el.chapter.textContent = `第${['一', '二', '三'][(v.chapter || 1) - 1]}章 · ${v.chapterName || ''}`;
    el.level.textContent = `第 ${v.level} 关 · ${v.name}`;
    const keyTotal = Math.max(1, v.keyTotal || 2);
    el.keys.innerHTML = Array.from({ length: keyTotal }, (_, i) =>
      i < v.keys ? '✦' : '<span class="off">✦</span>').join('');
    el.lives.innerHTML = [0, 1, 2].map(i => i < v.lives ? '♥' : '<span class="off">♥</span>').join('');
    el.time.textContent = `${(v.time || 0).toFixed(1)}s`;
    el.rewinds.textContent = `溯 ${v.rewinds || 0}`;
    el.total.textContent = `总星 ${v.totalStars || 0} / ${LEVELS.length * 3}`;
  }

  function setTimeline(v) {
    el.recfill.style.width = `${Math.max(0, Math.min(1, v.recFrac || 0)) * 100}%`;
    el.rewfill.style.width = `${Math.max(0, Math.min(1, v.rewFrac || 0)) * 100}%`;
    el.recrow.classList.toggle('rec', !!v.recording);
    el.rewrow.classList.toggle('on', !!v.rewinding);
    el.reclabel.textContent = v.recording ? `录制中 ${(v.recFrac * 8).toFixed(1)}s` : '回声录制 8s';
    el.rewlabel.textContent = v.rewinding ? `倒流中 ${(v.rewFrac * 3).toFixed(1)}s` : '倒流缓冲 3s';
  }

  function endPanel(v) {
    el.endKick.textContent = v.kick;
    el.endHead.textContent = v.heading;
    el.endReason.textContent = v.reason || '';
    el.endStars.innerHTML = [0, 1, 2].map(i => i < v.stars ? '<span>★</span>' : '<span class="off">★</span>').join('');
    el.endKeys.textContent = `${v.keys}/${v.keyTotal}`;
    el.endTime.textContent = `${(v.time || 0).toFixed(1)}s`;
    el.endRewinds.textContent = String(v.rewinds || 0);
    el.endTotal.textContent = String(v.totalStars || 0);
    el.endNext.classList.toggle('hidden', !v.canNext);
    el.endNext.textContent = v.canNext ? (v.nextLabel || '下一关') : '';
    showEnd(true);
  }

  function setMute(m) { el.mute.textContent = m ? '静' : '声'; el.mute.classList.toggle('on', !!m); }
  function setPause(p) { el.pause.textContent = p ? '续' : '停'; el.pause.classList.toggle('on', !!p); }

  // ---- touch controls ----
  function bindHold(btn, down, up) {
    const start = (e) => { e.preventDefault(); e.stopPropagation(); btn.classList.add('down'); down(); };
    const stop = (e) => { e.preventDefault(); e.stopPropagation(); btn.classList.remove('down'); up(); };
    btn.addEventListener('pointerdown', start);
    btn.addEventListener('pointerup', stop);
    btn.addEventListener('pointercancel', stop);
    btn.addEventListener('pointerleave', stop);
    btn.addEventListener('lostpointercapture', stop);
    btn.addEventListener('contextmenu', (e) => e.preventDefault());
  }
  let tLeft = false, tRight = false, tJump = false, tRewind = false, jumpEdge = false;
  bindHold(el.tleft, () => { tLeft = true; }, () => { tLeft = false; });
  bindHold(el.tright, () => { tRight = true; }, () => { tRight = false; });
  bindHold(el.tjump, () => { tJump = true; jumpEdge = true; }, () => { tJump = false; });
  bindHold(el.trec, () => { cb.onRecord && cb.onRecord(); }, () => { });
  bindHold(el.trew, () => { tRewind = true; }, () => { tRewind = false; });
  el.touch.addEventListener('pointerdown', (e) => e.stopPropagation());

  function isTouch() {
    return (navigator.maxTouchPoints > 0 && matchMedia('(pointer:coarse)').matches) || innerWidth < 760;
  }
  function showTouch(v) { el.touch.classList.toggle('on', !!v); }
  function consumeJump() { const v = jumpEdge; jumpEdge = false; return v; }
  const touchState = () => ({ left: tLeft, right: tRight, jump: tJump, rewind: tRewind });

  return {
    el, banner, hideBanner, toast, flash, renderGrid, showTitle, showHud, showEnd,
    setHud, setTimeline, endPanel, setMute, setPause, isTouch, showTouch,
    touchState, consumeJump, levelButtons,
  };
}
