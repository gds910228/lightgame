// DOM UI: code-drawn bars (slant ends, gradient, delayed ghost), skill icons w/ cooldown, boss bar, banners.
// Skill rule: never texture-drawn HP bars; serif type, restrained sizes; hide HUD during cinematics.
import { skillIcon, paintGrain } from './assets.js';

export function makeUI() {
  const $ = (id) => document.getElementById(id);
  const hud = $('hud'), title = $('title'), end = $('end'), banner = $('banner'), toast = $('toast');
  const hpFill = $('hpbar').querySelector('.fill'), hpGhost = $('hpbar').querySelector('.ghost'), hpEdge = $('hpbar').querySelector('.edge');
  const stFill = $('stbar').querySelector('.fill');
  const bossbar = $('bossbar'), bossNm = bossbar.querySelector('.nm'), bossFill = bossbar.querySelector('.bar .fill'), bossPos = bossbar.querySelector('.pbar .fill');
  const hurtfx = $('hurtfx');
  const upgr = $('upgrades'), uplist = $('uplist');
  let bufftag, coinhud;
  hpGhost.style.transition = 'transform .55s ease .3s';   // delayed damage bar
  hpFill.style.transition = 'transform .12s ease-out';
  stFill.style.transition = 'transform .1s linear';

  // grain overlay
  paintGrain($('grain'));

  // skill icons
  const skDefs = [['attack', 'J'], ['parry', 'K'], ['dash', '␣'], ['wave', 'L'], ['rain', 'U']];
  const skEls = skDefs.map(([kind, key]) => {
    const el = document.createElement('div'); el.className = 'sk';
    el.appendChild(skillIcon(kind));
    const k = document.createElement('div'); k.className = 'k'; k.textContent = key; el.appendChild(k);
    const cd = document.createElement('div'); cd.className = 'cd'; el.appendChild(cd);
    $('skills').appendChild(el);
    return el;
  });

  let bannerTimer = null, toastTimer = null;
  const api = {
    showHud(v) { hud.classList.toggle('on', v); },
    showTitle(v) { title.classList.toggle('hide', !v); },
    hud() {
      api.showHud(true); api.showTitle(false);
      $('end').style.display = 'none';
    },
    title() { api.showTitle(true); api.showHud(false); },
    hp(p, pGhost) {
      hpFill.style.transform = `scaleX(${Math.max(0, Math.min(1, p))})`;
      hpGhost.style.transform = `scaleX(${Math.max(0, Math.min(1, pGhost))})`;
      hpEdge.style.left = `calc(${Math.max(0, Math.min(1, p)) * 100}% - 2px)`;
    },
    stamina(p) { stFill.style.transform = `scaleX(${Math.max(0, Math.min(1, p))})`; },
    skillCd(i, pct) { skEls[i].querySelector('.cd').style.setProperty('--p', (pct * 100).toFixed(0) + '%'); },
    skillReady(i) { const el = skEls[i]; el.classList.remove('flash'); void el.offsetWidth; el.classList.add('flash'); },
    boss(show, name, p, pp) {
      bossbar.style.display = show ? 'block' : 'none';
      if (name !== undefined) bossNm.textContent = name;
      if (p !== undefined) bossFill.style.transform = `scaleX(${Math.max(0, Math.min(1, p))})`;
      if (pp !== undefined) bossPos.style.width = (Math.max(0, Math.min(1, pp)) * 100).toFixed(1) + '%';
    },
    banner(t, s = '', dur = 1.6) {
      banner.querySelector('.t').textContent = t;
      banner.querySelector('.s').textContent = s;
      banner.style.opacity = 1;
      clearTimeout(bannerTimer);
      bannerTimer = setTimeout(() => banner.style.opacity = 0, dur * 1000);
    },
    toast(t, dur = 1.4) {
      toast.textContent = t; toast.style.opacity = 1;
      clearTimeout(toastTimer);
      toastTimer = setTimeout(() => toast.style.opacity = 0, dur * 1000);
    },
    hurt() {
      hurtfx.style.opacity = .85;
      setTimeout(() => hurtfx.style.opacity = 0, 130);
    },
    end(title, desc, endlessBtn = false) {
      const e = $('end'); e.style.display = 'flex';
      e.querySelector('.t').textContent = title;
      e.querySelector('.d').textContent = desc;
      // 'block', NOT '': the stylesheet defaults .go2 to display:none, so '' would restore the hidden state
      e.querySelector('.go2').style.display = endlessBtn ? 'block' : 'none';
      hud.classList.remove('on');
    },
    hideEnd() { $('end').style.display = 'none'; },
    hudHidden() { return !hud.classList.contains('on'); },
    titleBest(text) { document.getElementById('titlebest').textContent = text || ''; },
    waveTag(text) { const w = $('wavetag'); w.textContent = text || ''; w.style.display = text ? 'block' : 'none'; },
    bossQuote(text) {
      const q = $('bossquote');
      q.textContent = text; q.style.opacity = 1;
      clearTimeout(api._quoteTimer);
      api._quoteTimer = setTimeout(() => q.style.opacity = 0, 2800);
    },
    impact() {
      const el = $('impactfx');
      el.style.opacity = .55;
      clearTimeout(api._impactTimer);
      api._impactTimer = setTimeout(() => el.style.opacity = 0, 130);
    },
    // --- fog merchant: timed two-offer panel, non-blocking ---
    showMerchant(coins, offers, onBuy) {
      const m = $('merchant');
      const holder = m.querySelector('.moffers');
      holder.innerHTML = '';
      offers.forEach(it => {
        const el = document.createElement('div'); el.className = 'mitem';
        el.innerHTML = `<div class="n">${it.name}</div><div class="d">${it.desc}</div><div class="p">${it.price} 币</div>`;
        el.addEventListener('click', () => { if (onBuy(it.id)) api.refreshMerchantCoins(coins); });
        holder.appendChild(el);
      });
      m.style.display = 'block';
    },
    refreshMerchantCoins(coins) {
      const m = $('merchant');
      m.querySelectorAll('.mitem').forEach(el => {
        const price = +(el.querySelector('.p').textContent.match(/\d+/) || [0])[0];
        el.style.opacity = coins < price ? .4 : 1;
      });
      const left = m.querySelector('.mleft');
      left.textContent = left.textContent.replace(/灵币 \d+/, '灵币 ' + coins);
    },
    closeMerchant() { $('merchant').style.display = 'none'; },
    merchantLeft(text) { const m = $('merchant'); if (m.style.display !== 'none') m.querySelector('.mleft').textContent = text; },
    buffTag(text) {
      if (!bufftag) { bufftag = document.createElement('div'); bufftag.id = 'bufftag'; hud.appendChild(bufftag); }
      bufftag.textContent = text || ''; bufftag.style.display = text ? 'block' : 'none';
    },
    coinHud(text) {
      if (!coinhud) { coinhud = document.createElement('div'); coinhud.id = 'coinhud'; hud.appendChild(coinhud); }
      coinhud.textContent = text;
    },
    // --- wave-clear upgrade choice (+ optional coin shop row) ---
    showUpgrades(cards, onPick, shop) {
      const holder = upgr.querySelector('.cards');
      holder.innerHTML = '';
      cards.forEach((c, i) => {
        const el = document.createElement('div'); el.className = 'up-card';
        el.innerHTML = `<div class="n">${c.name}</div><div class="d">${c.desc}</div><div class="s">${c.stacks ? '已有 ' + c.stacks + ' 层' : ''}</div><div class="k">${i + 1}</div>`;
        el.addEventListener('click', () => onPick(i));
        holder.appendChild(el);
      });
      // shop row
      let row = upgr.querySelector('.shoprow');
      if (shop && shop.items) {
        if (!row) { row = document.createElement('div'); row.className = 'shoprow'; upgr.appendChild(row); }
        row.innerHTML = '';
        const coinLine = document.createElement('div'); coinLine.className = 'shop-coins';
        row.appendChild(coinLine);
        shop.items.forEach(it => {
          const el = document.createElement('div'); el.className = 'shop-item'; el.dataset.price = it.price;
          el.innerHTML = `<div class="n">${it.name}</div><div class="d">${it.desc}</div><div class="p">${it.price} 币</div>`;
          el.addEventListener('click', () => shop.onBuy(it.id));
          row.appendChild(el);
        });
        api.refreshShopCoins(shop.coins);
        row.style.display = 'flex';
      } else if (row) row.style.display = 'none';
      upgr.classList.remove('hide');
    },
    refreshShopCoins(coins) {
      upgr.querySelectorAll('.shop-item').forEach(el => {
        el.classList.toggle('off', coins < +el.dataset.price);
      });
      const line = upgr.querySelector('.shop-coins');
      if (line) line.textContent = '灵币 ' + coins;
    },
    hideUpgrades() { upgr.classList.add('hide'); },
    upgradeList(text) { uplist.textContent = text; uplist.style.display = text ? 'block' : 'none'; },
  };
  return api;
}
