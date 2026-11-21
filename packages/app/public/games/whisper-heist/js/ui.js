// DOM UI layer for Whisper Heist: HUD, title, 12-level select, pause and
// results overlays, banners/toasts and the touch control shell.

import { CHAPTERS, LEVELS } from './levels.js';

export function makeUI(handlers) {
  const $ = id => document.getElementById(id);
  const el = {
    hud: $('hud'), score: $('score'), timer: $('timer'), relicnum: $('relicnum'),
    alarmfill: $('alarmfill'), alarmtag: $('alarmtag'), levelname: $('levelname'),
    besttag: $('besttag'), decoynum: $('decoynum'),
    mutebtn: $('mutebtn'), pausebtn: $('pausebtn'),
    title: $('title'), titlebest: $('titlebest'), titleprog: $('titleprog'), progdots: $('progdots'),
    startbtn: $('startbtn'), selectbtn: $('selectbtn'),
    select: $('select'), levelgrid: $('levelgrid'), selback: $('selback'),
    end: $('end'), endh: $('endh'), endd: $('endd'), endscore: $('endscore'),
    retrybtn: $('retrybtn'), nextbtn: $('nextbtn'), homebtn: $('homebtn'), sharebtn: $('sharebtn'),
    pause: $('pause'), resumebtn: $('resumebtn'), prestart: $('prestart'), phome: $('phome'),
    banner: $('banner'), bmain: document.querySelector('#banner .bmain'), bsub: document.querySelector('#banner .bsub'),
    toast: $('toast'),
    touch: $('touch'), stickzone: $('stickzone'), stickknob: $('stickknob'),
    tdecoy: $('tdecoy'), tinteract: $('tinteract'), tcrouch: $('tcrouch'),
    tpause: $('tpause2'), tmute: $('tmute2'), prompt: $('prompt'),
  };

  el.startbtn.addEventListener('click', () => handlers.onStart());
  el.selectbtn.addEventListener('click', () => handlers.onSelect());
  el.selback.addEventListener('click', () => handlers.onBackTitle());
  el.retrybtn.addEventListener('click', () => handlers.onRetry());
  el.nextbtn.addEventListener('click', () => handlers.onNext());
  el.homebtn.addEventListener('click', () => handlers.onBackTitle());
  el.sharebtn.addEventListener('click', () => handlers.onShare());
  el.resumebtn.addEventListener('click', () => handlers.onPause());
  el.prestart.addEventListener('click', () => handlers.onRetry());
  el.phome.addEventListener('click', () => handlers.onBackTitle());
  el.mutebtn.addEventListener('click', () => handlers.onMute());
  el.pausebtn.addEventListener('click', () => handlers.onPause());
  el.tpause.addEventListener('click', () => handlers.onPause());
  el.tmute.addEventListener('click', () => handlers.onMute());
  el.tcrouch.addEventListener('click', () => handlers.onCrouch());
  el.tdecoy.addEventListener('click', () => handlers.onDecoy());
  el.tinteract.addEventListener('click', () => handlers.onInteract());

  let bannerT = 0, toastT = 0;
  function showBanner(main, sub = '', ms = 1800) {
    el.bmain.textContent = main; el.bsub.textContent = sub;
    el.banner.classList.add('show');
    clearTimeout(bannerT);
    bannerT = setTimeout(() => el.banner.classList.remove('show'), ms);
  }
  function hideBanner() { clearTimeout(bannerT); el.banner.classList.remove('show'); }
  function showToast(text, ms = 1800) {
    el.toast.textContent = text; el.toast.classList.add('show');
    clearTimeout(toastT);
    toastT = setTimeout(() => el.toast.classList.remove('show'), ms);
  }
  function hideToast() { clearTimeout(toastT); el.toast.classList.remove('show'); }

  function setScore(v) { el.score.textContent = String(v | 0); }
  function setTimer(sec) {
    const s = Math.max(0, Math.ceil(sec));
    el.timer.textContent = `${String((s / 60) | 0).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
    el.timer.classList.toggle('low', s <= 30);
  }
  function setRelics(taken, total) { el.relicnum.textContent = `${taken}/${total}`; }
  function setDecoys(n) { el.decoynum.textContent = String(n); el.tdecoy.classList.toggle('empty', n <= 0); }
  function setAlarm(v) {
    const a = Math.max(0, Math.min(100, v));
    el.alarmfill.style.width = `${a}%`;
    const tag = a >= 66 ? '追捕' : a >= 25 ? '搜索' : a > 2 ? '察觉' : '平静';
    el.alarmtag.textContent = tag;
    el.alarmfill.className = a >= 66 ? 'hot' : a >= 25 ? 'warm' : '';
    el.hud.classList.toggle('danger', a >= 66);
  }
  function setLevelName(txt) { el.levelname.textContent = txt; }
  function setBest(v) { el.besttag.textContent = v > 0 ? `最高 ${v}` : '尚无纪录'; }
  function setMutedIcon(m) {
    el.mutebtn.textContent = m ? '🔇' : '🔊';
    el.tmute.textContent = m ? '🔇' : '🔊';
    el.mutebtn.classList.toggle('on', m);
  }
  function setPausedIcon(p) { el.pausebtn.classList.toggle('on', p); }
  function setCrouchIcon(on) { el.tcrouch.classList.toggle('on', on); }

  function progDots(cleared) {
    el.progdots.innerHTML = '';
    for (let i = 0; i < LEVELS.length; i++) {
      const d = document.createElement('span');
      d.className = 'dot' + (i < cleared ? ' done' : '');
      el.progdots.appendChild(d);
    }
  }
  function setProgress(cleared, best) {
    cleared = Math.max(0, Math.min(LEVELS.length, cleared | 0));
    el.titleprog.textContent = cleared >= LEVELS.length ? '十二铺全部得手 · 灯匠夜游圆满' : `已得手 ${cleared} / ${LEVELS.length} 铺`;
    el.titlebest.textContent = best > 0 ? `最高单铺得分 ${best}` : '尚无纪录 · 今夜第一铺';
    progDots(cleared);
    return cleared;
  }

  function buildLevelGrid(unlocked) {
    el.levelgrid.innerHTML = '';
    CHAPTERS.forEach((ch, ci) => {
      const head = document.createElement('div');
      head.className = 'chhead';
      head.textContent = ch.zh;
      el.levelgrid.appendChild(head);
      const row = document.createElement('div');
      row.className = 'chrow';
      for (let k = 0; k < 4; k++) {
        const i = ci * 4 + k;
        const b = document.createElement('button');
        b.className = 'lvlbtn';
        b.dataset.level = String(i);
        const num = document.createElement('span'); num.className = 'lnum'; num.textContent = String(i + 1).padStart(2, '0');
        const nm = document.createElement('span'); nm.className = 'lname'; nm.textContent = LEVELS[i].name;
        b.appendChild(num); b.appendChild(nm);
        if (i > unlocked) {
          b.classList.add('locked');
          b.appendChild(document.createTextNode(' 🔒'));
          b.title = '尚未解锁';
        }
        b.addEventListener('click', () => handlers.onSelectLevel(i));
        row.appendChild(b);
      }
      el.levelgrid.appendChild(row);
    });
  }

  function showTitle(v) { el.title.classList.toggle('hide', !v); if (v) el.select.classList.add('hide'); }
  function showSelect(v, unlocked) {
    if (v) buildLevelGrid(unlocked);
    el.select.classList.toggle('hide', !v);
    if (v) el.title.classList.add('hide');
  }
  function showEnd(v) { el.end.classList.toggle('hide', !v); }
  function setEnd(o) {
    el.endh.textContent = o.head;
    el.endh.className = o.win ? 'win' : 'lose';
    el.endd.textContent = o.detail;
    el.endscore.textContent = `得分 ${o.score}`;
    el.nextbtn.style.display = o.hasNext ? '' : 'none';
    el.sharebtn.style.display = o.win ? '' : 'none';
  }
  function showPause(v) { el.pause.classList.toggle('hide', !v); }
  function showHud(v) { el.hud.classList.toggle('hide', !v); }
  function setPrompt(txt) {
    el.prompt.textContent = txt || '';
    el.prompt.classList.toggle('show', !!txt);
  }

  return {
    el, showBanner, hideBanner, showToast, hideToast, setScore, setTimer, setRelics, setDecoys, setAlarm,
    setLevelName, setBest, setMutedIcon, setPausedIcon, setCrouchIcon, setProgress,
    buildLevelGrid, showTitle, showSelect, showEnd, setEnd, showPause, showHud, setPrompt,
  };
}
