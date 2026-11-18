// Code-drawn DOM UI (skill rule: never texture bars). Dusk palette,
// top-left core/essence/wave, bottom build cards, tower panel, boss bar,
// banner/toast, blessing draft, title & end screens, touch buttons.
import { TOWERS } from './towers.js';

const $ = (id) => document.getElementById(id);

const SKILL_META = [
  { key: 'Q', glyph: '☄', zh: '星陨术 — 三连陨石轰击敌群' },
  { key: 'E', glyph: '❄', zh: '冰封新星 — 冻结全场 2.5s' },
  { key: 'R', glyph: '⚡', zh: '过载脉冲 — 全塔射速 +45% 10s' },
];

export function makeUI(cb) {
  const ui = {};

  // --- actives skill bar (built once, updated per frame) ---
  const skillEls = [];
  {
    const bar = $('skills');
    for (const m of SKILL_META) {
      const d = document.createElement('div');
      d.className = 'skill';
      d.title = m.zh;
      d.innerHTML = `<div class="scd"></div><div class="sg">${m.glyph}</div><div class="sk">${m.key}</div>`;
      d.onclick = () => cb.onSkill && cb.onSkill(m.key);
      bar.appendChild(d);
      skillEls.push(d);
    }
  }
  ui.skills = (arr) => {
    arr.forEach((s, i) => {
      const el = skillEls[i];
      if (!el) return;
      el.querySelector('.scd').style.height = (Math.min(1, Math.max(0, s.cdFrac)) * 100) + '%';
      el.classList.toggle('ready', !!s.ready);
    });
  };

  // --- HUD ---
  ui.hud = ({ core, coreMax, essence, wave, endless, preview, best }) => {
    const cf = Math.max(0, core / coreMax);
    $('corefill').style.width = (cf * 100) + '%';
    $('corefill').style.background = cf > .5 ? 'linear-gradient(90deg,#2ec9b8,#7fe8d8)' : cf > .25 ? 'linear-gradient(90deg,#c9902e,#e8c37f)' : 'linear-gradient(90deg,#c92e2e,#e87f7f)';
    $('corenum').textContent = Math.ceil(core) + '/' + coreMax;
    $('essence').textContent = '✦ ' + essence;
    $('wavetag').textContent = endless ? ('无尽 第 ' + wave + ' 波') : ('第 ' + wave + ' / 10 波');
    $('preview').textContent = preview || '';
    $('besttag').textContent = best > 0 ? '最高 ' + best : '';
  };

  ui.boss = (name, frac) => {
    const el = $('bossbar');
    if (!name) { el.style.display = 'none'; return; }
    el.style.display = 'block';
    $('bossfill').style.width = (Math.max(0, frac) * 100) + '%';
    $('bossname').textContent = name;
  };

  ui.essencePop = (delta) => {
    const el = $('epop');
    el.textContent = (delta >= 0 ? '+' : '') + delta + ' ✦';
    el.classList.remove('pop'); void el.offsetWidth; el.classList.add('pop');
  };

  // --- build cards ---
  ui.cards = (padSel, afford) => {
    const bar = $('cards');
    bar.classList.toggle('on', !!padSel);
    bar.querySelectorAll('.card').forEach((c) => {
      c.classList.toggle('dim', !afford[c.dataset.key]);
    });
    $('cardeh').textContent = padSel ? '选择哨塔建造（1-5）' : '点击发光石台建造';
  };

  // --- tower panel ---
  ui.towerPanel = (t) => {
    const el = $('tpanel');
    if (!t) { el.style.display = 'none'; return; }
    el.style.display = 'block';
    const st = t.st(), upCost = t.lv < 2 ? t.def.upg[t.lv] : null;
    $('tpname').textContent = t.def.zh + ' · Lv' + (t.lv + 1);
    const dps = t.dmgFor() / t.effRate(0);
    $('tpstats').textContent =
      (t.key === 'prism' ? `每跳 ${t.dmgFor().toFixed(1)} × 4/s` : `伤害 ${t.dmgFor().toFixed(1)}`)
      + ` · 射程 ${t.effRange(false).toFixed(1)} · ${t.key === 'totem' ? '链电 ' + (st.chain + (t.mods.chain || 0)) + ' 跳' : t.key === 'frost' ? '减速 ' + Math.round((st.slow + t.mods.slow) * 100) + '%' : t.key === 'mortar' ? '溅射 ' + (st.splash * t.mods.splash).toFixed(1) + 'm' : ''}`;
    $('tpeh').textContent = t.disabledT > 0 ? '★ 停机中' : '输出 DPS ≈ ' + dps.toFixed(1);
    const ub = $('tpup'), sb = $('tpsell');
    ub.textContent = upCost ? '升级 ▲ ' + upCost : '已满级';
    ub.classList.toggle('off', !upCost);
    sb.textContent = '出售 ⛃ ' + Math.floor(.7 * t.invested);
  };

  // --- banner / toast / flash ---
  let bannerT = 0;
  ui.banner = (main, sub = '', hold = 2.2) => {
    $('banner').innerHTML = `<div class="bmain">${main}</div>${sub ? `<div class="bsub">${sub}</div>` : ''}`;
    $('banner').classList.add('on'); bannerT = hold;
  };
  let toastT = 0;
  ui.toast = (text) => { $('toast').textContent = text; $('toast').classList.add('on'); toastT = 2.6; };
  ui.flash = () => { const f = $('flash'); f.classList.remove('on'); void f.offsetWidth; f.classList.add('on'); };

  // --- wave-call button ---
  ui.callBtn = (visible, bonusReady, tLeft) => {
    const b = $('callbtn');
    b.style.display = visible ? 'block' : 'none';
    b.textContent = bonusReady ? `▶ 召唤下一波 (+15✦)` : `▶ 下一波 ${tLeft ? Math.ceil(tLeft) + 's' : ''}`;
    b.classList.toggle('bonus', bonusReady);
  };

  // --- blessing draft ---
  ui.draft = (cards, onPick) => {
    const el = $('draft');
    el.style.display = 'flex';
    el.querySelector('.dtitle').textContent = '★ 祝福降临 — 三选一';
    const box = el.querySelector('.dcards'); box.innerHTML = '';
    cards.forEach((c, i) => {
      const d = document.createElement('div');
      d.className = 'dcard';
      d.innerHTML = `<div class="dg">${c.glyph}</div><div class="dn">${c.zh}</div><div class="dd">${c.desc}</div><div class="dk">${i + 1}</div>`;
      d.onclick = () => { pick(i); };
      box.appendChild(d);
    });
    const pick = (i) => { el.style.display = 'none'; onPick(i); };
    el._pick = pick;
  };
  ui.hideDraft = () => { $('draft').style.display = 'none'; };

  // --- title ---
  ui.title = ({ best }, onStart) => {
    const el = $('title');
    el.style.display = 'flex';
    $('titlebest').textContent = best > 0 ? `最高坚守：第 ${best} 波` : '守住坠落的星核，撑过 10 波来袭';
    $('startbtn').onclick = () => { el.style.display = 'none'; onStart(); };
  };
  ui.hideTitle = () => { $('title').style.display = 'none'; };

  // --- end screen ---
  ui.end = ({ win, waves, best, newBest }, handlers) => {
    const el = $('end');
    el.style.display = 'flex';
    $('endh').textContent = win ? '壁垒不倒' : '星核碎了';
    $('endd').textContent = (win ? `十波尽退，星核长明。` : `第 ${waves} 波破防。`) + (newBest ? '  新纪录！' : '') + `  最高：第 ${best} 波`;
    const eb = $('go2');
    eb.style.display = win ? 'block' : 'none';
    eb.onclick = () => { el.style.display = 'none'; handlers.endless && handlers.endless(); };
    $('go').onclick = () => { el.style.display = 'none'; handlers.restart(); };
  };
  ui.hideEnd = () => { $('end').style.display = 'none'; };

  // --- speed / pause button states ---
  ui.speed = (v) => { $('speedbtn').textContent = v + '×'; };
  ui.pause = (on) => { $('pausebtn').textContent = on ? '▷' : '❚❚'; $('pausebtn').classList.toggle('on', on); };
  ui.mute = (m) => { $('mutebtn').textContent = m ? '🔇' : '🔊'; };

  // --- per-frame decay ---
  ui.update = (dt) => {
    if (bannerT > 0) { bannerT -= dt; if (bannerT <= 0) $('banner').classList.remove('on'); }
    if (toastT > 0) { toastT -= dt; if (toastT <= 0) $('toast').classList.remove('on'); }
  };

  // --- wiring ---
  $('speedbtn').onclick = () => cb.onSpeed && cb.onSpeed();
  $('pausebtn').onclick = () => cb.onPause && cb.onPause();
  $('mutebtn').onclick = () => cb.onMute && cb.onMute();
  $('callbtn').onclick = () => cb.onCall && cb.onCall();
  $('tpup').onclick = () => cb.onUpgrade && cb.onUpgrade();
  $('tpsell').onclick = () => cb.onSell && cb.onSell();
  $('tpx').onclick = () => cb.onDeselect && cb.onDeselect();
  const cardsBox = $('cards');
  for (const key of Object.keys(TOWERS)) {
    const d = TOWERS[key];
    const c = document.createElement('div');
    c.className = 'card'; c.dataset.key = key;
    c.innerHTML = `<div class="glyph" style="color:#${d.color.toString(16).padStart(6, '0')}">◈</div><div class="cn">${d.zh}</div><div class="cc">${d.cost}✦</div><div class="ck">${Object.keys(TOWERS).indexOf(key) + 1}</div>`;
    c.title = d.desc;
    c.onclick = () => cb.onBuild && cb.onBuild(key);
    cardsBox.appendChild(c);
  }
  return ui;
}
