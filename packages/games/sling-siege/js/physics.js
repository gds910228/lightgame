// AABB rigid-body physics for Sling Siege: semi-implicit Euler, mass-weighted
// minimum-translation-vector separation, single impulse resolution per contact,
// ground/platform constraints, grounded-gravity exemption + sleep (anti-jitter,
// same idea as orchard-fusion), and impact callbacks that game.js turns into
// material damage. Bodies are plain objects:
//   {x,y,px,py,halfW,halfH,vx,vy,mass,invMass,grounded,asleep,sleepT,
//    supportOn,dead,kind,...}

export function makePhysics({ groundY, platforms = [], gravity = 1300 }) {
  const REST = 0.16;        // restitution
  const FRICT = 0.55;       // tangential damping on contact
  const ITER = 3;           // solver iterations
  const MAXV = 2600;        // speed clamp (stability)
  const SLEEP_V = 16;       // |vx|+|vy| below this starts sleeping
  const SLEEP_T = 0.22;     // seconds below threshold before falling asleep

  let _blocks = [];
  let onImpact = null;      // (a, b|null, approachSpeed) — b null = ground/platform

  function wake(b) {
    if (!b.asleep) return;
    b.asleep = false; b.sleepT = 0;
    // cascade: anything resting on b must wake too, or it floats
    for (const o of _blocks) {
      if (!o.dead && o.asleep && o.supportOn === b) wake(o);
    }
  }

  // what is this body resting on? (used to store supportOn at sleep time)
  function findSupport(b) {
    const bot = b.y + b.halfH;
    for (const o of _blocks) {
      if (o === b || o.dead) continue;
      const top = o.y - o.halfH;
      if (Math.abs(top - bot) < 5 && b.x + b.halfW > o.x - o.halfW + 2 && b.x - b.halfW < o.x + o.halfW - 2) return o;
    }
    for (const p of platforms) {
      const top = p.cy - p.h / 2;
      if (Math.abs(top - bot) < 5 && b.x + b.halfW > p.cx - p.w / 2 + 2 && b.x - b.halfW < p.cx + p.w / 2 - 2) return p;
    }
    if (Math.abs(bot - groundY) < 5) return 'ground';
    return null;
  }

  function step(blocks, dt) {
    _blocks = blocks;
    const act = [];
    for (const b of blocks) {
      if (b.dead) continue;
      b.px = b.x; b.py = b.y;
      if (b.asleep) continue;
      act.push(b);
      if (!b.grounded) b.vy += gravity * dt;   // grounded bodies skip gravity (anti-jitter)
      const sp = Math.hypot(b.vx, b.vy);
      if (sp > MAXV) { const k = MAXV / sp; b.vx *= k; b.vy *= k; }
      b.x += b.vx * dt; b.y += b.vy * dt;
      b.grounded = false;
    }

    for (let it = 0; it < ITER; it++) {
      // pair separation + impulse
      for (let i = 0; i < blocks.length; i++) {
        const a = blocks[i]; if (a.dead) continue;
        for (let j = i + 1; j < blocks.length; j++) {
          const b = blocks[j]; if (b.dead) continue;
          if (a.asleep && b.asleep) continue;
          const dx = b.x - a.x, dy = b.y - a.y;
          const ox = a.halfW + b.halfW - Math.abs(dx);
          const oy = a.halfH + b.halfH - Math.abs(dy);
          if (ox <= 0 || oy <= 0) continue;
          if (a.asleep) wake(a);
          if (b.asleep) wake(b);
          let nx = 0, ny = 0, pen;
          if (ox < oy) { nx = dx < 0 ? -1 : 1; pen = ox; }
          else { ny = dy < 0 ? -1 : 1; pen = oy; }
          const ima = a.invMass, imb = b.invMass, tm = ima + imb;
          if (tm <= 0) continue;
          const corr = pen * 0.85;
          a.x -= nx * corr * (ima / tm); a.y -= ny * corr * (ima / tm);
          b.x += nx * corr * (imb / tm); b.y += ny * corr * (imb / tm);
          const rvx = b.vx - a.vx, rvy = b.vy - a.vy;
          const vn = rvx * nx + rvy * ny;
          if (vn < 0) {
            const jimp = -(1 + REST) * vn / tm;
            a.vx -= jimp * nx * ima; a.vy -= jimp * ny * ima;
            b.vx += jimp * nx * imb; b.vy += jimp * ny * imb;
            const tx = -ny, ty = nx;
            const vt = rvx * tx + rvy * ty;
            const jt = -vt * FRICT * 0.5 / tm;
            a.vx -= jt * tx * ima; a.vy -= jt * ty * ima;
            b.vx += jt * tx * imb; b.vy += jt * ty * imb;
          }
          if (it === 0) {
            if (ny > 0.7) a.grounded = true;          // a sits on b
            else if (ny < -0.7) b.grounded = true;
          }
          // damage callback once per pair per frame (on first iteration only)
          if (it === 0 && onImpact && vn < -90 && !(a._dmgPair === b && a._dmgF === _frame)) {
            a._dmgPair = b; a._dmgF = _frame;
            onImpact(a, b, -vn);
          }
        }
      }
      // static bounds: ground + platforms
      for (const b of act) {
        if (b.dead) continue;
        // real penetration → clamp + bounce
        if (b.y + b.halfH > groundY) {
          b.y = groundY - b.halfH;
          if (b.vy > 0) {
            if (onImpact && b.vy > 150 && it === 0) onImpact(b, null, b.vy);
            b.vy = b.vy > 100 ? -b.vy * REST : 0;
          }
        }
        // near-contact band → grounded + friction (kept separate from the clamp
        // so a rising body can escape gravity-exemption and settle)
        if (b.y + b.halfH > groundY - 0.8) {
          b.vx *= 0.88;
          b.grounded = true;
        }
        for (const p of platforms) {
          const dx = b.x - p.cx, dy = b.y - p.cy;
          const ox = b.halfW + p.w / 2 - Math.abs(dx);
          const oy = b.halfH + p.h / 2 - Math.abs(dy);
          if (ox <= 0 || oy <= 0) continue;
          if (ox < oy) {
            b.x += (dx < 0 ? -ox : ox);
            if (b.vx * (dx < 0 ? -1 : 1) < 0) b.vx *= -REST;
          } else {
            b.y += (dy < 0 ? -oy : oy);
            if (dy < 0) {   // body above platform top
              if (b.vy > 0) {
                if (onImpact && b.vy > 150 && it === 0) onImpact(b, null, b.vy);
                b.vy = b.vy > 100 ? -b.vy * REST : 0;
              }
              b.vx *= 0.88; b.grounded = true;
            } else if (b.vy < 0) b.vy = 0;
          }
        }
        // sleep bookkeeping: low absolute speed long enough → sleep
        // (grounded flag may alternate on exact-touch frames, so don't gate on it)
        if (it === ITER - 1) {
          if (Math.abs(b.vx) + Math.abs(b.vy) < SLEEP_V) {
            b.sleepT += dt;
            if (b.sleepT >= SLEEP_T) {
              b.asleep = true; b.vx = 0; b.vy = 0;
              b.supportOn = findSupport(b);
            }
          } else b.sleepT = 0;
        }
      }
    }
    _frame++;
  }

  let _frame = 0;

  // AABB overlap test (used by enemy crush / direct hit checks)
  function overlaps(a, b, pad = 0) {
    return Math.abs(a.x - b.x) < a.halfW + b.halfW + pad &&
           Math.abs(a.y - b.y) < a.halfH + b.halfH + pad;
  }

  return {
    step, wake, overlaps, findSupport,
    platforms,
    set onImpact(fn) { onImpact = fn; },
    GRAV: gravity, REST,
  };
}
