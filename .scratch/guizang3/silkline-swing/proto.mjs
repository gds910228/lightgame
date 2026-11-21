// Scratch prototype: tune swing physics + autopilot feasibility before building UI.
const DT = 1 / 60;
const P = {
  G: 1300, PUMP: 900, AIR: 300, MAXV: 1650,
  GRAB: 500, LMIN: 90, LMAX: 430, REEL: 330, RAD: 11,
};
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

function mulberry32(a) { return function () { let t = a += 0x6D2B79F5; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

// ---- level generator (prototype) ----
function makeLevel(n) {
  const rng = mulberry32(9173 + n * 7717);
  const chapter = Math.ceil(n / 6);
  const worldW = 2100 + n * 150 + (chapter - 1) * 160;
  const groundY = 650;
  const count = 8 + Math.round((n - 1) * 0.6);
  const anchors = [];
  const startX = 130;
  const startY = groundY - 22;
  const gateX = worldW - 150, gateY = groundY - 110;
  const left = 320, right = gateX - 260;
  const stepX = (right - left) / (count - 1);
  for (let i = 0; i < count; i++) {
    let x = left + stepX * i + (rng() - .5) * 46;
    let y = 250 + (rng() - .5) * 46 + Math.sin(i * .9 + n) * 14;
    let type = 'static';
    if (chapter >= 2 && i > 1 && i % 5 === 3) type = 'moving';
    if (chapter >= 2 && i > 2 && i % 6 === 4) type = 'fragile';
    anchors.push({ x, y, type, ampX: type === 'moving' ? 34 : 0, ampY: type === 'moving' ? 52 : 0, phase: rng() * 6.28, speed: .8 + rng() * .4, broken: false, fragLife: 0 });
  }
  // final anchor sits directly above the flying star gate
  const last = anchors[count - 1];
  last.x = gateX - 120; last.y = groundY - 340; last.type = 'static'; last.ampX = 0; last.ampY = 0;
  const shards = [];
  for (let i = 0; i < 3; i++) {
    const a = anchors[Math.min(anchors.length - 2, 1 + Math.floor((i + .5) * (anchors.length - 1) / 3))];
    shards.push({ x: a.x, y: a.y + [150, 220, 290][i], got: false });
  }
  const platforms = [
    { x: 0, y: groundY, w: 300, h: 200 },
    { x: gateX - 110, y: groundY, w: 260, h: 200 },
  ];
  // some mid ledges
  for (let i = 1; i < 3; i++) {
    const ax = anchors[Math.floor(anchors.length * i / 3)].x;
    platforms.push({ x: ax - 50, y: groundY + 40, w: 100, h: 160 });
  }
  const spikes = [];
  for (let i = 0; i < anchors.length - 1; i++) {
    if (i % 3 === 1) {
      const ax = (anchors[i].x + anchors[i + 1].x) / 2;
      spikes.push({ x: ax - 56, y: groundY - 22, w: 112, h: 22 });
    }
  }
  return {
    id: n, chapter, name: 'L' + n, worldW, groundY, par: 28 + n * 2.2,
    start: { x: startX, y: startY }, gate: { x: gateX - 120, y: groundY - 150, w: 118, h: 270 },
    anchors, shards, platforms, spikes,
    winds: [], checkpoints: [{ x: startX, y: startY, triggerX: 0 }], killY: groundY + 170,
  };
}

function anchorPos(a, t) {
  if (a.type !== 'moving' || a.broken) return a;
  return { x: a.x + Math.sin(t * a.speed + a.phase) * a.ampX, y: a.y + Math.sin(t * a.speed * 1.3 + a.phase) * a.ampY };
}

function dist2(ax, ay, bx, by) { const dx = ax - bx, dy = ay - by; return Math.hypot(dx, dy); }

function chooseAnchor(st, level, t, forward) {
  let bestF = -1, dF = 1e9, bestB = -1, dB = 1e9;
  for (let i = 0; i < level.anchors.length; i++) {
    const a = level.anchors[i];
    if (a.broken) continue;
    if (st.ignore === i && st.ignoreT > 0) continue;
    const ap = anchorPos(a, t);
    const d = dist2(st.x, st.y, ap.x, ap.y);
    if (d > P.GRAB || d < 30) continue;
    const isFwd = (ap.x - st.x) * forward >= -24;
    if (isFwd) { if (d < dF) { dF = d; bestF = i; } }
    else if (d < dB) { dB = d; bestB = i; }
  }
  return bestF >= 0 ? bestF : bestB;
}

function makeState(level) {
  return {
    x: level.start.x, y: level.start.y, vx: 0, vy: 0, anchor: -1, L: 0,
    facing: 1, t: 0, alive: true, shards: 0, deaths: 0, completed: false,
    grounded: true, reached: 0, ropeBrokenT: 0, ignore: -1, ignoreT: 0,
  };
}

function step(st, level, input, dt) {
  st.t += dt; st.ignoreT = Math.max(0, (st.ignoreT || 0) - dt);
  // anchors update time; fragile life
  if (st.anchor >= 0) {
    const a = level.anchors[st.anchor];
    if (a.type === 'fragile') { a.fragLife -= dt; if (a.fragLife <= 0) { a.broken = true; st.anchor = -1; } }
  }
  if (st.anchor >= 0 && !input.grab) { st.ignore = st.anchor; st.ignoreT = 1.1; st.anchor = -1; }
  if (st.anchor < 0 && input.grab) {
    const idx = chooseAnchor(st, level, st.t, st.facing);
    if (idx >= 0) {
      const ap = anchorPos(level.anchors[idx], st.t);
      st.anchor = idx;
      st.L = clamp(dist2(st.x, st.y, ap.x, ap.y) * 0.8, 120, 330);
      const a = level.anchors[idx];
      if (a.type === 'fragile' && a.fragLife <= 0) a.fragLife = 2.6;
    }
  }
  // direction/facing
  if (input.dir) st.facing = Math.sign(input.dir);
  let ax = 0, ay = P.G;
  if (st.anchor >= 0) {
    const ap = anchorPos(level.anchors[st.anchor], st.t);
    if (input.reel) st.L = clamp(st.L + input.reel * P.REEL * dt, P.LMIN, P.LMAX);
    ax += input.dir * P.PUMP;
    // integrate
    st.vx += ax * dt; st.vy += ay * dt;
    st.x += st.vx * dt; st.y += st.vy * dt;
    // rigid rope constraint
    let dx = st.x - ap.x, dy = st.y - ap.y, d = Math.hypot(dx, dy);
    if (d < 1e-6) { dx = 0; dy = st.L; d = st.L; }
    const nx = dx / d, ny = dy / d;
    st.x = ap.x + nx * st.L; st.y = ap.y + ny * st.L;
    const vr = st.vx * nx + st.vy * ny;
    st.vx -= vr * nx; st.vy -= vr * ny;
  } else {
    ax += input.dir * P.AIR;
    st.vx += ax * dt; st.vy += ay * dt;
    st.x += st.vx * dt; st.y += st.vy * dt;
  }
  // speed clamp
  const sp = Math.hypot(st.vx, st.vy);
  if (sp > P.MAXV) { st.vx *= P.MAXV / sp; st.vy *= P.MAXV / sp; }
  // winds
  for (const w of level.winds) {
    if (st.x > w.x && st.x < w.x + w.w && st.y > w.y && st.y < w.y + w.h) st.vx += w.vx * dt;
  }
  // platforms: simple resolve
  st.grounded = false;
  for (const p of level.platforms) {
    const nx = clamp(st.x, p.x, p.x + p.w), ny = clamp(st.y, p.y, p.y + p.h);
    const dx = st.x - nx, dy = st.y - ny, d = Math.hypot(dx, dy);
    if (d < P.RAD) {
      if (d < 1e-6) continue;
      const ux = dx / d, uy = dy / d;
      st.x = nx + ux * P.RAD; st.y = ny + uy * P.RAD;
      const vr = st.vx * ux + st.vy * uy;
      if (vr < 0) { st.vx -= vr * ux; st.vy -= vr * uy; }
      if (uy < -.55) { st.grounded = true; if (st.anchor >= 0) { /* collide */ } }
    }
  }
  // spikes
  for (const s of level.spikes) {
    if (st.x + P.RAD > s.x && st.x - P.RAD < s.x + s.w && st.y + P.RAD > s.y && st.y - P.RAD < s.y + s.h) { st.alive = false; return; }
  }
  if (st.y > level.killY) { st.alive = false; return; }
  // shards
  for (const sh of level.shards) {
    if (!sh.got && dist2(st.x, st.y, sh.x, sh.y) < 48) { sh.got = true; st.shards++; }
  }
  // gate
  if (Math.abs(st.x - level.gate.x) < level.gate.w / 2 + P.RAD && Math.abs(st.y - level.gate.y) < level.gate.h / 2 + P.RAD) st.completed = true;
}

let botHold = 0, freeCd = 0, botRoute = 0;
function resetBot() { botHold = 0; freeCd = 0; botRoute = 0; }
function botInput(st, level, mode = 'auto') {
  const inp = { grab: true, dir: 0, reel: 0 };
  const t = st.t;
  if (st.anchor >= 0) {
    botHold += 1/60; freeCd = 0;
    botRoute = st.anchor + 1;
    const s = Math.hypot(st.vx, st.vy);
    inp.dir = Math.sign(st.vx) || 1;
    const tgt = level.anchors[botRoute];
    if (tgt) {
      const ap = anchorPos(tgt, t);
      const d = dist2(st.x, st.y, ap.x, ap.y);
      if (d < P.GRAB * .62 && botHold > .35 && st.vx > -60) { inp.grab = false; botHold = 0; freeCd = 4; }
    }
    return inp;
  }
  if (freeCd > 0) { freeCd--; inp.grab = false; }
  const tgt = level.anchors[Math.min(botRoute, level.anchors.length - 1)] || level.gate;
  inp.dir = Math.sign(tgt.x - st.x) || 1;
  return inp;
}

function simulate(level, maxS = 90) {
  resetBot();
  const st = makeState(level);
  const trace = [];
  for (let i = 0; i < maxS * 60; i++) {
    const inp = botInput(st, level);
    step(st, level, inp, DT);
    if (st.completed) return { ok: true, t: st.t, shards: st.shards, deaths: st.deaths, st };
    if (!st.alive) return { ok: false, t: st.t, shards: st.shards, st, why: 'died' };
    if (i % 30 === 0) trace.push({ x: +st.x.toFixed(0), y: +st.y.toFixed(0), a: st.anchor, L: +st.L.toFixed(0), s: +Math.hypot(st.vx, st.vy).toFixed(0) });
  }
  return { ok: false, t: st.t, st, why: 'timeout', trace };
}

if (process.env.DBG) {
  const L = makeLevel(+process.env.DBG);
  console.log('gate', L.gate, 'start', L.start);
  L.anchors.forEach((a,i)=>console.log(i, a.type, +a.x.toFixed(0), +a.y.toFixed(0), i?('d='+Math.hypot(a.x-L.anchors[i-1].x,a.y-L.anchors[i-1].y).toFixed(0)):''));
}
for (let n = 1; n <= 18; n++) {
  const L = makeLevel(n);
  const r = simulate(L, 90);
  console.log(n, r.ok ? 'OK' : 'FAIL', r.why || '', 't=' + (r.t || 0).toFixed(1), 'shards=' + r.shards, 'anchors=' + L.anchors.length, 'w=' + L.worldW, r.ok ? '' : JSON.stringify(r.trace ? r.trace.slice(-6) : {}));
}
