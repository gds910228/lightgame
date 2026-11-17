// Circle physics for the merge jar: semi-implicit Euler, positional correction
// with mass-weighted separation, single impulse resolution, wall constraints.
// Bodies are plain objects: {x,y,vx,vy,r,tier,...}; mass = r*r.

export function makePhysics(world) {
  // world: {left, right, floor} interior bounds (top open)
  const G = 2000;                    // gravity px/s^2
  const REST = 0.12;                 // restitution
  const FRICT = 0.72;                // tangential velocity damping on contact
  const ITER = 3;                    // solver iterations
  const MAXV = 3200;                 // speed clamp (stability)

  function step(bodies, dt) {
    const n = bodies.length;
    // integrate (skip gravity for bodies grounded last frame — kills stack jitter)
    for (const b of bodies) {
      if (!b.ground) b.vy += G * dt;
      const sp = Math.hypot(b.vx, b.vy);
      if (sp > MAXV) { const k = MAXV / sp; b.vx *= k; b.vy *= k; }
      b.x += b.vx * dt; b.y += b.vy * dt;
      b.ground = false;
    }
    // pair separation + impulse, a few iterations
    for (let it = 0; it < ITER; it++) {
      for (let i = 0; i < n; i++) {
        const a = bodies[i];
        for (let j = i + 1; j < n; j++) {
          const b = bodies[j];
          const dx = b.x - a.x, dy = b.y - a.y;
          const rr = a.r + b.r;
          const d2 = dx * dx + dy * dy;
          if (d2 >= rr * rr || d2 === 0) continue;
          const d = Math.sqrt(d2);
          const nx = dx / d, ny = dy / d;
          const ma = a.r * a.r, mb = b.r * b.r, tm = ma + mb;
          // positional correction proportional to inverse mass
          const pen = (rr - d) * 0.92;
          a.x -= nx * pen * (mb / tm); a.y -= ny * pen * (mb / tm);
          b.x += nx * pen * (ma / tm); b.y += ny * pen * (ma / tm);
          // impulse only if approaching
          const rvx = b.vx - a.vx, rvy = b.vy - a.vy;
          const vn = rvx * nx + rvy * ny;
          if (vn < 0) {
            const jimp = -(1 + REST) * vn / (1 / ma + 1 / mb);
            const jx = jimp * nx, jy = jimp * ny;
            a.vx -= jx / ma; a.vy -= jy / ma;
            b.vx += jx / mb; b.vy += jy / mb;
            // tangential friction
            const tx = -ny, ty = nx;
            const vt = rvx * tx + rvy * ty;
            const jt = -vt * FRICT * 0.5 / (1 / ma + 1 / mb);
            a.vx -= jt * tx / ma; a.vy -= jt * ty / ma;
            b.vx += jt * tx / mb; b.vy += jt * ty / mb;
            a.hit = b.hit = true;
          }
          // support flag: mostly-vertical contact grounds the upper body (anti-jitter)
          if (it === 0) { if (ny > .65) a.ground = true; else if (ny < -.65) b.ground = true; }
        }
      }
    }
    // walls
    for (const b of bodies) {
      if (b.x - b.r < world.left) { b.x = world.left + b.r; if (b.vx < 0) b.vx *= -REST; }
      if (b.x + b.r > world.right) { b.x = world.right - b.r; if (b.vx > 0) b.vx *= -REST; }
      if (b.y + b.r > world.floor) { b.y = world.floor - b.r; if (b.vy > 0) b.vy *= -REST; b.vx *= 0.92; b.ground = true; }
      // ceiling safety (never happens in play, but keep bodies in-world)
      if (b.y - b.r < world.floor - 4000) { b.y = world.floor - 4000 + b.r; if (b.vy < 0) b.vy = 0; }
    }
  }

  // deterministic merge scan: deepest-penetration same-tier pair first.
  // Max-tier bodies never merge (two watermelons just coexist, like Suika).
  function findMerge(bodies, maxTier) {
    let best = null, bestPen = 0;
    for (let i = 0; i < bodies.length; i++) {
      const a = bodies[i];
      if (a.tier >= maxTier) continue;
      for (let j = i + 1; j < bodies.length; j++) {
        const b = bodies[j];
        if (b.tier !== a.tier || b.tier >= maxTier || a.dead || b.dead) continue;
        const d = Math.hypot(b.x - a.x, b.y - a.y);
        const pen = a.r + b.r - d;
        if (pen > 0 && pen > bestPen) { bestPen = pen; best = [a, b]; }
      }
    }
    return best;
  }

  return { step, findMerge, GRAV: G };
}
