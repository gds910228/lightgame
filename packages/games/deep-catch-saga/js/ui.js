// DOM UI layer for Deep Catch Saga — wood-sign + parchment style.
// HUD (score/coins/dex%/depth), top-right buttons, hint line, reel button,
// banner/toast, title screen, dex panel (42 cells), shop panel, catch card.

import { FISH, LAYERS, QUALITIES } from './fish.js';

export function makeUI(cb) {
  // cb: { onStart, onContinue, onDex, onShop, onCloseDex, onCloseShop, onMute,
  //       onPause, onReelHold(v), onBuy(i) }
  const $ = id => document.getElementById(id);
  const el = {
    score: $('score'), coins: $('coins'), dexPct: $('dexpct'), depth: $('depth'),
    banner: $('banner'), bmain: document.querySelector('#banner .bmain'), bsub: document.querySelector('#banner .bsub'),
    toast: $('toast'), hint: $('hint'), reelbtn: $('reelbtn'),
    title: $('title'), start: $('startbtn'), titlebest: $('titlebest'),
    dexpanel: $('dexpanel'), dexgrid: $('dexgrid'), dexbar: $('dexbar'), dexstat: $('dexstat'), dexclose: $('dexclose'),
    shoppanel: $('shoppanel'), shoprows: $('shoprows'), shopcoins: $('shopcoins'), shopclose: $('shopclose'),
    rescard: $('rescard'), rescv: $('rescv'), resname: $('resname'), resq: $('resq'), resinfo: $('resinfo'), resbtn: $('resbtn'),
    mutebtn: $('mutebtn'), pausebtn: $('pausebtn'), dexbtn: $('dexbtn'), shopbtn: $('shopbtn'),
  };

  el.start.addEventListener('click', () => cb.onStart());
  el.resbtn.addEventListener('click', () => cb.onContinue());
  el.dexbtn.addEventListener('click', () => cb.onDex());
  el.shopbtn.addEventListener('click', () => cb.onShop());
  el.dexclose.addEventListener('click', () => cb.onCloseDex());
  el.shopclose.addEventListener('click', () => cb.onCloseShop());
  el.mutebtn.addEventListener('click', () => cb.onMute());
  el.pausebtn.addEventListener('click', () => cb.onPause());
  const reelDown = e => { e.preventDefault(); cb.onReelHold(true); };
  const reelUp = () => cb.onReelHold(false);
  el.reelbtn.addEventListener('pointerdown', reelDown);
  el.reelbtn.addEventListener('pointerup', reelUp);
  el.reelbtn.addEventListener('pointercancel', reelUp);
  el.reelbtn.addEventListener('pointerleave', reelUp);

  let bannerT = 0, toastT = 0;
  function showBanner(main, sub = '', ms = 1400) {
    el.bmain.textContent = main; el.bsub.textContent = sub;
    el.banner.classList.add('show');
    clearTimeout(bannerT); bannerT = setTimeout(() => el.banner.classList.remove('show'), ms);
  }
  function showToast(text, ms = 1900) {
    el.toast.textContent = text; el.toast.classList.add('show');
    clearTimeout(toastT); toastT = setTimeout(() => el.toast.classList.remove('show'), ms);
  }

  function setScore(v) { el.score.textContent = String(v); }
  function setCoins(v) { el.coins.textContent = String(v); }
  function setDexPct(v) { el.dexPct.textContent = v.toFixed(1) + '%'; }
  let lastDepthTxt = '';
  function setDepth(m, layerName) {
    const txt = '深度 ' + Math.max(0, Math.round(m)) + 'm · ' + layerName;
    if (txt !== lastDepthTxt) { lastDepthTxt = txt; el.depth.textContent = txt; }
  }
  function hint(t) { el.hint.textContent = t; }
  function setReelBtn(v) { el.reelbtn.style.display = v ? 'flex' : 'none'; }

  function showTitle(v) { el.title.classList.toggle('hide', !v); }
  function showDex(v) { el.dexpanel.classList.toggle('hide', !v); }
  function showShop(v) { el.shoppanel.classList.toggle('hide', !v); }
  function showResult(v) { el.rescard.classList.toggle('hide', !v); }
  function setBestLine(top, dexPct) {
    el.titlebest.textContent = top > 0
      ? '最高单鱼分 ' + top + ' · 图鉴收集 ' + dexPct.toFixed(1) + '%'
      : '还没有纪录，抛竿试试吧！';
  }
  function setMutedIcon(m) { el.mutebtn.textContent = m ? '🔇' : '🔊'; el.mutebtn.classList.toggle('on', m); }
  function setPausedIcon(p) { el.pausebtn.classList.toggle('on', p); }

  // ---------- dex panel ----------
  const dexCells = [];
  function buildDex() {
    if (dexCells.length) return;
    el.dexgrid.innerHTML = '';
    for (let l = 0; l < 6; l++) {
      const h = document.createElement('div');
      h.className = 'lhead';
      h.textContent = LAYERS[l].name + ' ' + LAYERS[l].range[0] + '-' + LAYERS[l].range[1] + 'm';
      el.dexgrid.appendChild(h);
      const row = document.createElement('div');
      row.className = 'lrow';
      for (let q = 0; q < 7; q++) {
        const f = FISH[l * 7 + q];
        const cell = document.createElement('div');
        cell.className = 'fcell';
        const cv = document.createElement('canvas');
        cv.width = 76; cv.height = 56;
        const name = document.createElement('div');
        name.className = 'fname';
        const wtxt = document.createElement('div');
        wtxt.className = 'fwtxt';
        cell.appendChild(cv); cell.appendChild(name); cell.appendChild(wtxt);
        cell.title = QUALITIES[q].name;
        row.appendChild(cell);
        dexCells.push({ f, cv, name, wtxt, cell });
      }
      el.dexgrid.appendChild(row);
    }
  }
  function refreshDex(dexMap, pct) {
    buildDex();
    let got = 0;
    for (const d of dexCells) {
      const w = dexMap[d.f.id] || 0;
      const c = d.cv.getContext('2d');
      c.clearRect(0, 0, d.cv.width, d.cv.height);
      if (w > 0) {
        got++;
        d.cell.classList.add('got');
        d.name.textContent = d.f.name;
        d.wtxt.textContent = '最大 ' + w + 'kg';
        cb.drawFishCell(c, d.f, false);
      } else {
        d.cell.classList.remove('got');
        d.name.textContent = '？？？';
        d.wtxt.textContent = QUALITIES[d.f.q].name;
        cb.drawFishCell(c, d.f, true);
      }
    }
    el.dexbar.style.width = pct.toFixed(1) + '%';
    el.dexstat.textContent = '已收集 ' + got + ' / 42 · 收集度 ' + pct.toFixed(1) + '%';
  }

  // ---------- shop panel ----------
  function refreshShop(upgrades, coins, defs) {
    el.shopcoins.textContent = '金币 ' + coins;
    el.shoprows.innerHTML = '';
    defs.forEach((u, i) => {
      const lvl = upgrades[i] | 0;
      const row = document.createElement('div');
      row.className = 'srow';
      const info = document.createElement('div');
      info.className = 'sinfo';
      info.innerHTML = '<b>' + u.name + '</b><span>' + u.desc + '</span>';
      const right = document.createElement('div');
      right.className = 'sright';
      const pips = document.createElement('div');
      pips.className = 'pips';
      for (let p = 0; p < u.costs.length; p++) {
        const s = document.createElement('i');
        if (p < lvl) s.className = 'on';
        pips.appendChild(s);
      }
      const btn = document.createElement('button');
      if (lvl >= u.costs.length) { btn.textContent = '已满级'; btn.className = 'max'; btn.disabled = true; }
      else { btn.textContent = '升级 ' + u.costs[lvl] + '🪙'; btn.disabled = coins < u.costs[lvl]; }
      btn.addEventListener('click', () => cb.onBuy(i));
      right.appendChild(pips); right.appendChild(btn);
      row.appendChild(info); row.appendChild(right);
      el.shoprows.appendChild(row);
    });
  }

  // ---------- catch card ----------
  function showCatch(fish, weight, gain, coinGain, qualityName, qualityColor) {
    el.resname.textContent = fish.name;
    el.resq.textContent = qualityName;
    el.resq.style.background = qualityColor;
    el.resinfo.textContent = '体重 ' + weight + 'kg · +' + gain + ' 分 · +' + coinGain + ' 金币';
    const c = el.rescv.getContext('2d');
    c.clearRect(0, 0, el.rescv.width, el.rescv.height);
    cb.drawFishCell(c, fish, false);
    showResult(true);
  }

  return {
    el, showBanner, showToast, setScore, setCoins, setDexPct, setDepth, hint, setReelBtn,
    showTitle, showDex, showShop, showResult, setBestLine, setMutedIcon, setPausedIcon,
    buildDex, refreshDex, refreshShop, showCatch,
  };
}
