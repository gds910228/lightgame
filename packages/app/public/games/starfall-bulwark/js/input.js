// Keyboard/mouse input that survives lost key-up events, plus F3 debug panel.
// Ported from guizang-game-skill scripts/input.js (AGPL-3.0), tailored for a
// click-driven tower defense: pointer position, clicks, keys, touch buttons.
export const keys = new Set(), pressed = new Set(), mouse = { x: 0, y: 0 };
const OPP = { KeyW: 'KeyS', KeyS: 'KeyW', KeyA: 'KeyD', KeyD: 'KeyA' }; let log = [];
const note = (s) => { log.push(s); log = log.slice(-8); };
export let touchMode = false;

addEventListener('keydown', (e) => {
  if (e.isComposing || e.keyCode === 229) return;                                   // IME composing: not ours
  if (/^(Meta|Alt|Control)/.test(e.code)) { keys.clear(); return; }                 // shortcuts swallow key-ups: start clean
  if (e.metaKey || e.altKey || e.ctrlKey) return;
  if (!e.repeat) { note('↓' + e.code); if (OPP[e.code]) keys.delete(OPP[e.code]); }
  if (!keys.has(e.code)) pressed.add(e.code); keys.add(e.code);
  if (e.code === 'Space' || e.code === 'Tab') e.preventDefault();
});
addEventListener('keyup', (e) => { note('↑' + e.code); keys.delete(e.code); if (/^(Meta|Alt|Control)/.test(e.code)) keys.clear(); });
for (const ev of ['blur', 'focus', 'pagehide']) addEventListener(ev, () => { note('[' + ev + ']'); keys.clear(); });
document.addEventListener('visibilitychange', () => keys.clear());
addEventListener('mousemove', (e) => { mouse.x = e.clientX / innerWidth * 2 - 1; mouse.y = -(e.clientY / innerHeight) * 2 + 1; });
addEventListener('mousedown', (e) => { if (touchMode) return; if (e.button === 0) { note('click'); pressed.add('Click'); } });
addEventListener('contextmenu', (e) => e.preventDefault());
export function endFrame() { pressed.clear(); }

// F3 panel; extra() supplies game state lines.
export function debugPanel(extra = () => '') {
  const d = document.createElement('div');
  d.style.cssText = 'position:fixed;left:8px;top:60px;z-index:99;font:11px ui-monospace,Menlo,monospace;color:#9fe0c0;background:rgba(0,0,0,.55);padding:6px 8px;white-space:pre;display:none;pointer-events:none';
  document.body.appendChild(d);
  addEventListener('keydown', (e) => { if (e.code === 'F3') { e.preventDefault(); d.style.display = d.style.display === 'none' ? 'block' : 'none'; } }, true);
  return () => { if (d.style.display !== 'none') d.textContent = `held: ${[...keys].join(' ') || '-'}\nfocus: ${document.hasFocus()}\n${extra()}\nrecent: ${log.join(' ')}`; };
}

// --- touch: tap-driven UI; bottom buttons map to key codes (no joystick needed) ---
export function initTouch(onBtn) {
  const root = document.getElementById('touch');
  if (!root) return;
  const setMode = (v) => { touchMode = v; root.classList.toggle('on', v); };
  addEventListener('pointerdown', (e) => { if (e.pointerType === 'touch') setMode(true); }, { passive: true });
  const bind = (id, code, hold) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('pointerdown', (e) => { e.stopPropagation(); e.preventDefault(); if (!hold) pressed.add(code); else keys.add(code); onBtn && onBtn(code, true); });
    const up = () => { if (hold) keys.delete(code); onBtn && onBtn(code, false); };
    for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) el.addEventListener(ev, up);
  };
  bind('twave', 'Space'); bind('tspeed', 'KeyF'); bind('tpause', 'KeyP');
  for (let i = 1; i <= 5; i++) bind('tb' + i, 'Digit' + i);
}
