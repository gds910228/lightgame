// ui.js — DOM 层：分数/准确率/进度条、选曲界面（3 曲 × 3 难度）、结算面板、
// banner/toast、静音/暂停/结束按钮、触屏 4 分区绑定。canvas 侧特效在 game.js。

export function makeUI({ onStart, onPickSong, onPickDiff, onRestart, onBackSelect, onMute, onPause, onQuit, onPad }) {
  const $ = id => document.getElementById(id);
  const el = {
    score: $('score'), acc: $('acc'), songname: $('songname'), songbar: $('songbar'),
    banner: $('banner'), bmain: document.querySelector('#banner .bmain'), bsub: document.querySelector('#banner .bsub'),
    toast: $('toast'), select: $('select'), selbest: $('selbest'), start: $('startbtn'),
    end: $('end'), endh: $('endh'), endgrade: $('endgrade'), endd: $('endd'), go: $('go'), go2: $('go2'),
    mutebtn: $('mutebtn'), pausebtn: $('pausebtn'), quitbtn: $('quitbtn'), pad: $('pad'),
    padzones: [...document.querySelectorAll('.padzone')],
    songcards: [...document.querySelectorAll('.songcard')],
    diffbtns: [...document.querySelectorAll('.diffbtn')],
  };

  el.start.addEventListener('click', () => onStart());
  el.go.addEventListener('click', () => onRestart());
  el.go2.addEventListener('click', () => onBackSelect());
  el.mutebtn.addEventListener('click', () => onMute());
  el.pausebtn.addEventListener('click', () => onPause());
  el.quitbtn.addEventListener('click', () => onQuit());
  el.songcards.forEach(c => c.addEventListener('click', () => onPickSong(+c.dataset.idx)));
  el.diffbtns.forEach(b => b.addEventListener('click', () => onPickDiff(b.dataset.diff)));
  el.padzones.forEach(z => {
    z.addEventListener('pointerdown', e => { e.preventDefault(); onPad(+z.dataset.lane); });
  });

  let bannerT = 0, toastT = 0;
  function showBanner(main, sub = '', ms = 1400) {
    el.bmain.textContent = main; el.bsub.textContent = sub;
    el.banner.classList.add('show');
    clearTimeout(bannerT); bannerT = setTimeout(() => el.banner.classList.remove('show'), ms);
  }
  function showToast(text, ms = 1500) {
    el.toast.textContent = text; el.toast.classList.add('show');
    clearTimeout(toastT); toastT = setTimeout(() => el.toast.classList.remove('show'), ms);
  }

  function setScore(v) { el.score.textContent = String(v); }
  function setAcc(v) { el.acc.textContent = v == null ? '准确率 —' : `准确率 ${v.toFixed(1)}%`; }
  function setProgress(p) { el.songbar.style.width = (Math.max(0, Math.min(1, p)) * 100).toFixed(1) + '%'; }
  function setSongLabel(t) { el.songname.textContent = t; }
  function setSelBest(t) { el.selbest.textContent = t; }

  function markSong(i) { el.songcards.forEach(c => c.classList.toggle('sel', +c.dataset.idx === i)); }
  function markDiff(id) { el.diffbtns.forEach(b => b.classList.toggle('sel', b.dataset.diff === id)); }

  function showSelect(v) { el.select.style.display = v ? 'flex' : 'none'; }
  function showEnd(v) { el.end.style.display = v ? 'flex' : 'none'; }
  function setEnd(grade, gradeColor, head, detail) {
    el.endgrade.textContent = grade;
    el.endgrade.style.color = gradeColor;
    el.endh.textContent = head;
    el.endd.textContent = detail;
  }
  function setMutedIcon(m) { el.mutebtn.textContent = m ? '🔇' : '🔊'; el.mutebtn.classList.toggle('on', m); }
  function setPausedIcon(p) { el.pausebtn.classList.toggle('on', p); }
  function padShow(v) { el.pad.classList.toggle('hide', !v); }

  return { el, showBanner, showToast, setScore, setAcc, setProgress, setSongLabel, setSelBest, markSong, markDiff, showSelect, showEnd, setEnd, setMutedIcon, setPausedIcon, padShow };
}
