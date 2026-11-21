// Shared stealth math: cone checks, line-of-sight against axis-aligned walls,
// circle/rect collision and distance-attenuated noise. Exposed through G.math
// so the autotest can verify each core rule directly.

export const TAU = Math.PI * 2;
export const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
export const dist = (ax, ay, bx, by) => Math.hypot(bx - ax, by - ay);

// signed shortest angular difference in [-PI, PI]
export function angleDiff(a, b) {
  let d = (a - b) % TAU;
  if (d > Math.PI) d -= TAU;
  if (d < -Math.PI) d += TAU;
  return d;
}

// Is a point inside a guard's vision sector (ignoring range/LOS)?
export function inCone(ox, oy, face, half, px, py) {
  const a = Math.atan2(py - oy, px - ox);
  return Math.abs(angleDiff(a, face)) <= half + 1e-9;
}

// Liang–Barsky segment vs axis-aligned rect intersection.
export function segRect(x1, y1, x2, y2, r) {
  const dx = x2 - x1, dy = y2 - y1;
  let t0 = 0, t1 = 1;
  const p = [-dx, dx, -dy, dy];
  const q = [x1 - r.x, r.x + r.w - x1, y1 - r.y, r.y + r.h - y1];
  for (let i = 0; i < 4; i++) {
    if (Math.abs(p[i]) < 1e-12) {
      if (q[i] < 0) return false;
    } else {
      const t = q[i] / p[i];
      if (p[i] < 0) { if (t > t1) return false; if (t > t0) t0 = t; }
      else { if (t < t0) return false; if (t < t1) t1 = t; }
    }
  }
  return true;
}

// Both tall walls and low cover break sight lines. Guards cannot see through
// a crate even though the player may crouch through it.
export function losClear(x1, y1, x2, y2, walls) {
  for (let i = 0; i < walls.length; i++) {
    if (segRect(x1, y1, x2, y2, walls[i])) return false;
  }
  return true;
}

// Sound falls off linearly with distance; walls do not muffle it.
export function noiseStrength(d, radius) {
  if (radius <= 0) return 0;
  return clamp(1 - d / radius, 0, 1);
}

export function circleRect(cx, cy, r, w) {
  const nx = clamp(cx, w.x, w.x + w.w);
  const ny = clamp(cy, w.y, w.y + w.h);
  return (cx - nx) * (cx - nx) + (cy - ny) * (cy - ny) < r * r;
}

// Move a circle with axis-separated collision against the supplied rects.
// Returns the resolved position without mutating input.
export function moveCircle(x, y, dx, dy, r, rects) {
  let nx = x + dx, ny = y;
  for (let i = 0; i < rects.length; i++) {
    const w = rects[i];
    if (!circleRect(nx, ny, r, w)) continue;
    if (dx > 0) nx = w.x - r;
    else if (dx < 0) nx = w.x + w.w + r;
  }
  ny = y + dy;
  for (let i = 0; i < rects.length; i++) {
    const w = rects[i];
    if (!circleRect(nx, ny, r, w)) continue;
    if (dy > 0) ny = w.y - r;
    else if (dy < 0) ny = w.y + w.h + r;
  }
  return { x: nx, y: ny };
}

// How much a guard can perceive the player: 1 at point-blank, 0 at the rim.
export function sightFactor(d, range) {
  return clamp(1 - d / range * 0.65, 0.35, 1);
}
