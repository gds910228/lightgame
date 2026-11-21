// Shadowspire Ninja — deterministic tower generation.
// The tower is split into 60 rooms of 20 m. Every room carries a safe zig-zag
// route, wall-jump ribs on both edges, lantern dust and a few hazards. A fixed
// PRNG seed makes the climb identical on every run while still feeling handmade.

export const CFG = Object.freeze({
  W: 540,
  H: 960,
  PPM: 18,               // pixels per metre
  WORLD_W: 30,
  WORLD_H: 1200,
  ROOM_H: 20,
  ROOMS: 60,
  CP_STEP: 150,
  CP_COUNT: 7,
  START_Y: 0.8,
  FINISH_Y: 1200,
});

export const ZONES = [
  {
    id: 'wood', name: '木塔', en: 'TIMBER HOLD', from: 0, to: 400,
    ink: '#160f25', deep: '#24152a', mid: '#3a2230', accent: '#d99a55',
    accent2: '#a64f39', jade: '#6aa58d', glow: '#ffd480', line: 'rgba(255,211,145,.32)',
    paper: '#1a1024',
  },
  {
    id: 'wind', name: '风廊', en: 'WIND GALLERY', from: 400, to: 800,
    ink: '#0c1822', deep: '#112a30', mid: '#1b4142', accent: '#80cbb6',
    accent2: '#b06a4b', jade: '#8de0c5', glow: '#d7ffe9', line: 'rgba(157,235,213,.27)',
    paper: '#101b26',
  },
  {
    id: 'star', name: '星阁', en: 'STAR PAVILION', from: 800, to: 1200,
    ink: '#120c26', deep: '#21163d', mid: '#372257', accent: '#e4c06f',
    accent2: '#a64a58', jade: '#7fc7bd', glow: '#fff0b5', line: 'rgba(255,232,164,.3)',
    paper: '#17102e',
  },
];

export function zoneAt(y) {
  const yy = Math.max(0, Math.min(CFG.WORLD_H - 0.001, y));
  return ZONES[yy >= 800 ? 2 : yy >= 400 ? 1 : 0];
}

function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const ROUTE_X = [9.2, 20.4, 10.3, 21.1, 8.1, 19.3, 12.4];
const ROUTE_W = [7.4, 7.8, 7.0, 7.5, 6.8, 7.6, 7.1];

export function buildLevel() {
  const rng = mulberry32(0x5A0D5A17);
  const platforms = [];
  const walls = [];
  const hazards = [];
  const pickups = [];
  const gates = [];
  const lanterns = [];

  // starting deck
  platforms.push({
    x: 5.0, y: CFG.START_Y, w: 20.0, h: 1.1, route: true,
    room: -1, zone: 'wood', kind: 'start',
  });

  // the main climbing stitch: seven one-way ledges per room
  for (let r = 0; r < CFG.ROOMS; r++) {
    const base = r * CFG.ROOM_H;
    for (let i = 0; i < 7; i++) {
      const gi = r * 7 + i;
      const y = base + (i + 1) * (CFG.ROOM_H / 7);
      const slot = gi % ROUTE_X.length;
      const jitter = (rng() - 0.5) * 0.8;
      const w = ROUTE_W[slot] + (rng() - 0.5) * 0.45;
      const x = Math.max(1.7, Math.min(CFG.WORLD_W - 1.7 - w, ROUTE_X[slot] + jitter));
      platforms.push({
        x, y, w, h: 0.55, route: true, room: r, gi,
        zone: zoneAt(y).id, kind: 'route', seed: rng(),
      });
    }

    // side rest ledges (optional, but inviting for wall jumps)
    if (r % 2 === 0) {
      platforms.push({
        x: 1.45, y: base + 7.5, w: 3.5, h: 0.5, route: false,
        room: r, zone: zoneAt(base + 7.5).id, kind: 'ledge', seed: rng(),
      });
    } else {
      platforms.push({
        x: CFG.WORLD_W - 4.95, y: base + 12.6, w: 3.5, h: 0.5, route: false,
        room: r, zone: zoneAt(base + 12.6).id, kind: 'ledge', seed: rng(),
      });
    }

    // wall-jump ribs. Left and right alternate so the chimney rhythm stays alive.
    const lStart = base + 1.8 + (r % 3) * 0.55;
    const rStart = base + 8.2 + (r % 4) * 0.5;
    walls.push({ x: 0, y: lStart, w: 1.15, h: 5.2, side: -1, room: r, zone: zoneAt(lStart).id });
    walls.push({ x: CFG.WORLD_W - 1.15, y: rStart, w: 1.15, h: 5.0, side: 1, room: r, zone: zoneAt(rStart).id });

    if (r % 4 === 1) {
      walls.push({
        x: 5.9 + (r % 2) * 11.1, y: base + 4.1, w: 1.25, h: 5.6,
        side: 1, room: r, inner: true, zone: zoneAt(base + 4.1).id,
      });
    }

    // dust motes: near route ledges, a little off the safe centre
    const dustCount = 2 + (r % 2);
    for (let d = 0; d < dustCount; d++) {
      const anchor = platforms[platforms.length - 1 - (d % 7)];
      const useWall = d === dustCount - 1 && r % 3 === 0;
      pickups.push({
        x: useWall ? (r % 2 ? CFG.WORLD_W - 3.2 : 3.2) : Math.max(2, Math.min(CFG.WORLD_W - 2, anchor.x + anchor.w * (0.28 + rng() * 0.44))),
        y: useWall ? anchor.y + 2.2 + rng() * 2 : anchor.y + 1.15 + rng() * 1.8,
        r: 0.48, taken: false, phase: rng() * Math.PI * 2, kind: 'dust', room: r,
      });
    }

    // static caltrops on unused edges (never the centre landing pad)
    if (r >= 4 && rng() < 0.55) {
      const p = platforms[platforms.length - 1 - Math.floor(rng() * 7)];
      const side = rng() < 0.5;
      const hx = side ? p.x + 0.45 : p.x + p.w - 1.25;
      hazards.push({
        x: hx, y: p.y, w: 0.8, h: 0.52, kind: 'caltrop', room: r,
        phase: rng() * 5, active: true, warn: false, static: true,
      });
    }

    // pressure spike-traps with a clear warning beat
    if (r >= 6 && rng() < 0.42) {
      const p = platforms[platforms.length - 1 - Math.floor(rng() * 7)];
      const hx = p.x + p.w * (0.62 + rng() * 0.18);
      hazards.push({
        x: Math.max(1.8, Math.min(CFG.WORLD_W - 2.6, hx)), y: p.y, w: 1.45, h: 0.78,
        kind: 'trap', room: r, phase: rng() * 4.2, cycle: 3.8, warnDur: 1.05, activeDur: 0.72,
        active: false, warn: false, static: false,
      });
    }

    // hanging paper lanterns / wind chimes / star lamps for depth
    if (r % 2 === 0) {
      lanterns.push({
        x: 3.4 + rng() * 3.0, y: base + 4.5 + rng() * 5,
        zone: zoneAt(base + 4).id, phase: rng() * 6.28, scale: 0.8 + rng() * 0.35,
      });
    }
    if (r % 3 === 1) {
      lanterns.push({
        x: CFG.WORLD_W - 4.0 - rng() * 3.0, y: base + 11 + rng() * 5,
        zone: zoneAt(base + 11).id, phase: rng() * 6.28, scale: 0.75 + rng() * 0.4,
      });
    }
  }

  // checkpoint decks sit exactly on the 150 m grid
  for (let k = 1; k <= CFG.CP_COUNT; k++) {
    const y = k * CFG.CP_STEP;
    const deck = {
      x: 8.5, y, w: 13.0, h: 0.72, route: true, checkpoint: y,
      room: Math.floor(y / CFG.ROOM_H), zone: zoneAt(y).id, kind: 'checkpoint',
    };
    platforms.push(deck);
    gates.push({ x: 15, y, height: y, active: false, zone: zoneAt(y).id, idx: k });
  }

  // keep the checkpoint landings clean: no spike may overlap the lamp decks
  const safe = [];
  for (const h of hazards) {
    let blocked = false;
    for (let k = 1; k <= CFG.CP_COUNT; k++) {
      const cy = k * CFG.CP_STEP;
      if (Math.abs(h.y - cy) < 3.2 && h.x + h.w > 8.5 && h.x < 21.5) { blocked = true; break; }
    }
    if (!blocked) safe.push(h);
  }
  hazards.length = 0;
  hazards.push(...safe);

  // summit deck and moon gate
  platforms.push({
    x: 8.5, y: CFG.FINISH_Y, w: 13.0, h: 0.9, route: true,
    room: 59, zone: 'star', kind: 'finish',
  });
  gates.push({ x: 15, y: CFG.FINISH_Y, height: CFG.FINISH_Y, active: false, zone: 'star', idx: 8, finish: true });

  // a couple of tutorial motes so the first ten seconds can pay out
  pickups.push({ x: 3.0, y: 6.5, r: 0.5, taken: false, phase: 0.4, kind: 'dust', room: 0, tutorial: true });
  pickups.push({ x: 4.4, y: 8.9, r: 0.5, taken: false, phase: 2.1, kind: 'dust', room: 0, tutorial: true });
  pickups.push({ x: 15.0, y: 4.4, r: 0.5, taken: false, phase: 4.2, kind: 'dust', room: 0, tutorial: true });

  // all walkable landing surfaces (used by the debug spawn helper)
  const surfaces = platforms
    .concat(walls.map(w => ({ x: w.x, y: w.y + w.h, w: w.w, h: 0.32, wallCap: true })))
    .sort((a, b) => a.y - b.y);

  return { platforms, walls, hazards, pickups, gates, lanterns, surfaces };
}

export function surfaceBelow(level, y, xHint = CFG.WORLD_W / 2) {
  let best = null;
  for (const s of level.surfaces) {
    if (s.y > y + 0.001) continue;
    const inside = xHint >= s.x - 0.5 && xHint <= s.x + s.w + 0.5;
    const score = (inside ? 10 : 0) + s.y * 0.01;
    if (!best || score > best.score || (score === best.score && s.y > best.s.y)) best = { s, score };
  }
  return best ? best.s : null;
}

export function routeStats(level) {
  const route = level.platforms.filter(p => p.route).sort((a, b) => a.y - b.y || a.x - b.x);
  let maxDy = 0, maxEdgeGap = 0;
  for (let i = 1; i < route.length; i++) {
    const a = route[i - 1], b = route[i];
    maxDy = Math.max(maxDy, b.y - a.y);
    const aR = a.x + a.w, bR = b.x + b.w;
    const edge = b.x > aR ? b.x - aR : a.x > bR ? a.x - bR : 0;
    maxEdgeGap = Math.max(maxEdgeGap, edge);
  }
  return { count: route.length, maxDy, maxEdgeGap, top: route[route.length - 1].y };
}
