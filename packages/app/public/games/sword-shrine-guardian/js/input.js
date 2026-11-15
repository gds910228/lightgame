// Keyboard/mouse input that survives lost key-up events, plus F3 debug panel.
// Ported from guizang-game-skill scripts/input.js (AGPL-3.0) with touch joystick bridge.
export const keys = new Set(), pressed = new Set(), mouse = { x: 0, y: 0 };
const OPP = { KeyW: 'KeyS', KeyS: 'KeyW', KeyA: 'KeyD', KeyD: 'KeyA' }; let log = [];
const note = (s) => { log.push(s); log = log.slice(-8); };
export let touchMode = false;

addEventListener('keydown', (e) => {
  if (e.isComposing || e.keyCode === 229) return;                                   // IME composing: not ours
  if (/^(Meta|Alt|Control)/.test(e.code)) { keys.clear(); return; }                 // shortcuts swallow key-ups: start clean
  if (e.metaKey || e.altKey || e.ctrlKey) return;
  if (!e.repeat) { note('↓' + e.code); if (OPP[e.code]) keys.delete(OPP[e.code]); } // pressing a dir drops a phantom opposite
  if (!keys.has(e.code)) pressed.add(e.code); keys.add(e.code);
  if (e.code === 'Space' || e.code === 'Tab') e.preventDefault();
});
addEventListener('keyup', (e) => { note('↑' + e.code); keys.delete(e.code); if (/^(Meta|Alt|Control)/.test(e.code)) keys.clear(); });
for (const ev of ['blur', 'focus', 'pagehide']) addEventListener(ev, () => { note('[' + ev + ']'); keys.clear(); });
document.addEventListener('visibilitychange', () => keys.clear());
addEventListener('mousemove', (e) => { if (!(e.buttons & 2)) keys.delete('RMB'); mouse.x = e.clientX / innerWidth * 2 - 1; mouse.y = -(e.clientY / innerHeight) * 2 + 1; });
addEventListener('mousedown', (e) => { if (touchMode) return; if (e.button === 0) pressed.add('KeyJ'); if (e.button === 2) { pressed.add('KeyK'); keys.add('KeyK'); } });
addEventListener('mouseup', (e) => { if (e.button === 2) keys.delete('KeyK'); });
addEventListener('contextmenu', (e) => e.preventDefault());
export function endFrame() { pressed.clear(); }

// Shift is deliberately NOT a modifier here: games use it as a sprint key.
// Do not infer releases from missing auto-repeat, and never poll hasFocus() to clear keys.

// F3 panel; extra() supplies game state lines.
export function debugPanel(extra = () => '') {
  const d = document.createElement('div');
  d.style.cssText = 'position:fixed;left:8px;top:60px;z-index:99;font:11px ui-monospace,Menlo,monospace;color:#9fe0c0;background:rgba(0,0,0,.55);padding:6px 8px;white-space:pre;display:none;pointer-events:none';
  document.body.appendChild(d);
  addEventListener('keydown', (e) => { if (e.code === 'F3') { e.preventDefault(); d.style.display = d.style.display === 'none' ? 'block' : 'none'; } }, true);
  return () => { if (d.style.display !== 'none') d.textContent = `held: ${[...keys].join(' ') || '-'}\nfocus: ${document.hasFocus()}\n${extra()}\nrecent: ${log.join(' ')}`; };
}

// --- touch: left-half floating joystick feeds analog move; right buttons map to key codes ---
export const stick = { x: 0, y: 0, active: false };
export function initTouch(onBtn) {
  const root = document.getElementById('touch'), joy = document.getElementById('joy'), knob = document.getElementById('joyk');
  let jid = -1, cx = 0, cy = 0;
  const setMode = (v) => { touchMode = v; root.classList.toggle('on', v); };
  addEventListener('pointerdown', (e) => {
    if (e.pointerType !== 'touch') return; setMode(true);
    if (e.clientX < innerWidth * 0.45 && jid < 0) {
      jid = e.pointerId; cx = e.clientX; cy = e.clientY; stick.active = true;
      joy.style.display = 'block'; joy.style.left = (cx - 56) + 'px'; joy.style.top = (cy - 56) + 'px';
      knob.style.left = '33px'; knob.style.top = '33px';
    }
  }, { passive: true });
  addEventListener('pointermove', (e) => {
    if (e.pointerId !== jid) return;
    let dx = e.clientX - cx, dy = e.clientY - cy; const m = Math.hypot(dx, dy), max = 46;
    if (m > max) { dx *= max / m; dy *= max / m; }
    knob.style.left = (33 + dx) + 'px'; knob.style.top = (33 + dy) + 'px';
    stick.x = dx / max; stick.y = dy / max;
  }, { passive: true });
  const rel = (e) => { if (e.pointerId !== jid) return; jid = -1; stick.active = false; stick.x = stick.y = 0; joy.style.display = 'none'; };
  addEventListener('pointerup', rel, { passive: true }); addEventListener('pointercancel', rel, { passive: true });
  const bind = (id, code, hold) => {
    const el = document.getElementById(id);
    el.addEventListener('pointerdown', (e) => { e.stopPropagation(); if (!hold) pressed.add(code); else keys.add(code); onBtn && onBtn(code, true); });
    const up = () => { if (hold) keys.delete(code); onBtn && onBtn(code, false); };
    for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) el.addEventListener(ev, up);
  };
  bind('tatk', 'KeyJ'); bind('tpry', 'KeyK', true); bind('tdsh', 'Space'); bind('tskl', 'KeyL'); bind('tsku', 'KeyU'); bind('tstp', 'KeyE');
}
