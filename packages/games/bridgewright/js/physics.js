// Bridgewright — small, deterministic spring/Verlet hybrid.
// Nodes use semi-implicit integration at 240 Hz; beams work in compression and
// tension, cables only in tension, stone pillars are very stiff vertical springs
// anchored to the canyon floor. Stress is the axial spring force normalised by
// each material's safe working load.

import { MATERIALS, FAIL_Y, GROUND_Y, MAX_SPAN, memberCost } from './levels.js';

const GRAV = 980;
const NODE_MASS = .62;
const SUBSTEPS = 4;
const GLOBAL_DAMP = .997;
const MAX_V = 2300;

export function makePhysics() {
  let level = null;
  let nodes = [];
  let members = [];
  let nodeById = new Map();
  let deckIds = [];
  let deckNodes = [];
  let deckMember = new Map();       // "i:j" sorted index key -> beam member
  let nextMid = 1;
  let car = null;
  let elapsed = 0;
  let peakStress = 0;
  let failure = '';
  let events = [];

  function pairKey(a, b) {
    const ia = typeof a === 'number' ? a : nodes.indexOf(a);
    const ib = typeof b === 'number' ? b : nodes.indexOf(b);
    return ia < ib ? `${ia}:${ib}` : `${ib}:${ia}`;
  }
  function findNode(ref) {
    if (ref == null) return null;
    if (typeof ref === 'object') return ref;
    if (typeof ref === 'number') return nodes[ref] || null;
    return nodeById.get(ref) || null;
  }
  function nodeIndex(ref) { return nodes.indexOf(findNode(ref)); }

  function loadLevel(cfg) {
    level = cfg;
    nodes = cfg.nodes.map(n => ({
      ...n, x: n.x0, y: n.y0, vx: 0, vy: 0,
      mass: NODE_MASS, invMass: n.fixed ? 0 : 1 / NODE_MASS,
    }));
    nodeById = new Map(nodes.map(n => [n.id, n]));
    deckIds = cfg.deck.slice();
    deckNodes = deckIds.map(id => nodeById.get(id));
    members = [];
    deckMember = new Map();
    nextMid = 1;
    elapsed = 0;
    peakStress = 0;
    failure = '';
    events = [];
    car = {
      x: deckNodes[0].x0 - 42, y: deckNodes[0].y0, vx: 0, vy: 0,
      mass: cfg.car.mass, speed: cfg.car.speed, support: -1, supported: true,
      t: 0, pitch: 0, load: 0, wheelSpin: 0, reached: false, unsupportedT: 0,
    };
    return { nodes, members, car };
  }

  function canBuild(aRef, bRef, type) {
    if (!level || !MATERIALS[type]) return { ok: false, why: '未知材料' };
    const a = findNode(aRef);
    if (!a) return { ok: false, why: '节点不存在' };
    if (type === 'pillar') {
      if (a.fixed) return { ok: false, why: '只能在桥面节点落柱' };
      const h = GROUND_Y - a.y0;
      if (h < 48) return { ok: false, why: '此处离地太近' };
      if (members.some(m => m.type === 'pillar' && m.a === a)) return { ok: false, why: '该节点已有石柱' };
      return { ok: true, a, b: null, len: 0, height: h };
    }
    const b = findNode(bRef);
    if (!b) return { ok: false, why: '节点不存在' };
    if (a === b) return { ok: false, why: '不能连到同一个节点' };
    if (members.some(m => (m.a === a && m.b === b) || (m.a === b && m.b === a))) {
      return { ok: false, why: '这两个节点之间已有构件' };
    }
    const len = Math.hypot(b.x0 - a.x0, b.y0 - a.y0);
    if (len > MAX_SPAN) return { ok: false, why: '跨距太长' };
    if (len < 30) return { ok: false, why: '距离太短' };
    return { ok: true, a, b, len, height: 0 };
  }

  function build(aRef, bRef, type) {
    const chk = canBuild(aRef, bRef, type);
    if (!chk.ok) return { ok: false, why: chk.why };
    const def = MATERIALS[type];
    const a = chk.a, b = chk.b;
    const cost = type === 'pillar'
      ? memberCost(type, 0, chk.height)
      : memberCost(type, chk.len, 0);
    let pseudoB = b;
    if (type === 'pillar') {
      pseudoB = {
        id: '__ground_' + a.id, x: a.x0, y: GROUND_Y, x0: a.x0, y0: GROUND_Y,
        fixed: true, invMass: 0, mass: 0, vx: 0, vy: 0, kind: 'ground',
      };
    }
    const m = {
      mid: nextMid++, type, a, b: pseudoB, rest: type === 'pillar' ? GROUND_Y - a.y0 : chk.len,
      k: def.k, maxForce: def.maxForce, zeta: def.zeta, tensionOnly: !!def.tensionOnly,
      vertical: !!def.vertical, cost, length: chk.len, stress: 0, stressNow: 0,
      overT: 0, force: 0, snapped: false, load: 0,
    };
    members.push(m);
    if (type === 'beam') {
      const ia = deckNodes.indexOf(a), ib = deckNodes.indexOf(b);
      if (ia >= 0 && ib >= 0 && Math.abs(ia - ib) === 1) {
        deckMember.set(pairKey(a, b), m);
      }
    }
    events.push({ type: 'build', member: m });
    return { ok: true, member: m, cost };
  }

  function removeMember(m) {
    const i = members.indexOf(m);
    if (i < 0) return false;
    for (const [k, v] of deckMember) if (v === m) deckMember.delete(k);
    members.splice(i, 1);
    events.push({ type: 'remove', member: m });
    return true;
  }
  function removeLast() {
    if (!members.length) return null;
    const m = members[members.length - 1];
    removeMember(m);
    return m;
  }
  function clearMembers() {
    members.length = 0;
    deckMember.clear();
    events.push({ type: 'clear' });
  }

  function deckKey(i, j) { return i < j ? `${i}:${j}` : `${j}:${i}`; }
  function hasDeckBeam(i, j) {
    return deckMember.has(deckKey(i, j));
  }
  function deckConnected() {
    for (let i = 0; i < deckNodes.length - 1; i++) if (!hasDeckBeam(i, i + 1)) return false;
    return true;
  }

  function resetSim() {
    for (const n of nodes) {
      n.x = n.x0; n.y = n.y0; n.vx = 0; n.vy = 0;
      n.fx = 0; n.fy = 0;
    }
    for (const m of members) {
      m.stress = 0; m.stressNow = 0; m.overT = 0; m.force = 0; m.snapped = false; m.load = 0;
    }
    elapsed = 0; peakStress = 0; failure = ''; events = [];
    car.x = deckNodes[0].x0 - 42; car.y = deckNodes[0].y0;
    car.vx = car.speed; car.vy = 0; car.support = 0; car.supported = true;
    car.t = 0; car.pitch = 0; car.load = 0; car.wheelSpin = 0;
    car.reached = false; car.unsupportedT = 0;
  }

  function segmentForX(x) {
    const xs = deckNodes.map(n => n.x0);
    if (x < xs[0] || x > xs[xs.length - 1]) return null;
    for (let i = 0; i < xs.length - 1; i++) {
      if (x >= xs[i] && x <= xs[i + 1]) {
        const span = Math.max(1e-6, xs[i + 1] - xs[i]);
        return { i, t: Math.max(0, Math.min(1, (x - xs[i]) / span)) };
      }
    }
    return null;
  }

  function applyCarLoad() {
    car.load = 0;
    car.loadA = 0; car.loadB = 0;
    if (!car || car.reached) return;
    const seg = segmentForX(car.x);
    if (!seg) return;
    const a = deckNodes[seg.i], b = deckNodes[seg.i + 1];
    if (!hasDeckBeam(seg.i, seg.i + 1)) return;
    const f = car.mass * GRAV;
    car.load = f;
    car.loadA = f * (1 - seg.t);
    car.loadB = f * seg.t;
    a.fy += car.loadA;
    b.fy += car.loadB;
  }

  function step(dt, testing = false) {
    if (!level) return;
    if (testing) elapsed += dt;
    const h = dt / SUBSTEPS;
    for (let sub = 0; sub < SUBSTEPS; sub++) {
      for (const n of nodes) {
        n.fx = 0;
        n.fy = n.fixed ? 0 : n.mass * GRAV;
      }
      if (testing) applyCarLoad();

      for (const m of members) {
        if (m.snapped) continue;
        const a = m.a, b = m.b;
        const dx = b.x - a.x, dy = b.y - a.y;
        let dist = Math.hypot(dx, dy);
        if (dist < .0001) dist = .0001;
        let ext = dist - m.rest;
        if (m.tensionOnly && ext <= 0) { m.force = 0; continue; }
        const ux = dx / dist, uy = dy / dist;
        const rel = (b.vx - a.vx) * ux + (b.vy - a.vy) * uy;
        const c = 2 * m.zeta * Math.sqrt(m.k * NODE_MASS);
        let F;
        if (m.vertical) {
          const raw = (dy - m.rest);
          const cvy = -(a.vy);
          F = m.k * raw + c * cvy;
          if (F > m.maxForce * 3) F = m.maxForce * 3;
          if (F < -m.maxForce * 3) F = -m.maxForce * 3;
          a.fy += F;
        } else {
          F = m.k * ext + c * rel;
          if (m.tensionOnly && F < 0) F = 0;
          if (F > m.maxForce * 3) F = m.maxForce * 3;
          if (F < -m.maxForce * 3) F = -m.maxForce * 3;
          const fx = F * ux, fy = F * uy;
          if (!a.fixed) { a.fx += fx; a.fy += fy; }
          if (!b.fixed) { b.fx -= fx; b.fy -= fy; }
        }
        m.force = Math.abs(F);
        m.load = F;
      }

      for (const n of nodes) {
        if (n.fixed) continue;
        n.vx = (n.vx + (n.fx / n.mass) * h) * GLOBAL_DAMP;
        n.vy = (n.vy + (n.fy / n.mass) * h) * GLOBAL_DAMP;
        if (n.vx > MAX_V) n.vx = MAX_V; if (n.vx < -MAX_V) n.vx = -MAX_V;
        if (n.vy > MAX_V) n.vy = MAX_V; if (n.vy < -MAX_V) n.vy = -MAX_V;
        n.x += n.vx * h;
        n.y += n.vy * h;
        if (!Number.isFinite(n.x) || !Number.isFinite(n.y)) {
          n.x = n.x0; n.y = n.y0; n.vx = 0; n.vy = 0;
          failure = failure || '数值失稳';
        }
      }
    }

    // stress bookkeeping / member failure
    for (const m of members) {
      if (m.snapped) continue;
      m.stressNow = m.force / m.maxForce;
      m.stress = m.stress * .72 + Math.min(1.6, m.stressNow) * .28;
      if (testing) {
        peakStress = Math.max(peakStress, m.stress);
        if (m.stressNow > 1.16) {
          m.snapped = true;
          failure = failure || (MATERIALS[m.type].zh + '断裂');
          events.push({ type: 'snap', member: m });
        } else if (m.stressNow > 1.0) {
          m.overT += dt;
          if (m.overT > .30) {
            m.snapped = true;
            failure = failure || (MATERIALS[m.type].zh + '断裂');
            events.push({ type: 'snap', member: m });
          }
        } else {
          m.overT = Math.max(0, m.overT - dt * 2.2);
        }
      }
    }

    if (testing) {
      // vehicle rides the current deck segment; if it has no beam it falls
      const prevY = car.y;
      const seg = segmentForX(car.x);
      let supported = false;
      if (!seg) {
        supported = !(car.x > deckNodes[0].x0 && car.x < deckNodes[deckNodes.length - 1].x0);
        car.y = seg ? car.y : (car.x <= deckNodes[0].x0 ? deckNodes[0].y0 : deckNodes[deckNodes.length - 1].y0);
        car.pitch = 0;
        car.support = -1;
      } else if (hasDeckBeam(seg.i, seg.i + 1)) {
        const a = deckNodes[seg.i], b = deckNodes[seg.i + 1];
        car.y = a.y * (1 - seg.t) + b.y * seg.t;
        car.pitch = Math.atan2(b.y - a.y, Math.max(1, b.x - a.x));
        car.support = seg.i;
        supported = true;
      } else {
        car.support = -1;
      }
      car.supported = supported;
      if (supported) {
        car.vy = (car.y - prevY) / Math.max(1e-6, dt);
        car.unsupportedT = 0;
        car.vx = car.speed;
      } else {
        car.vx = 0;
        car.vy += GRAV * dt;
        car.y += car.vy * dt;
        car.unsupportedT += dt;
        if (car.unsupportedT > .8) failure = failure || '桥面断裂，矿车坠落';
      }
      car.x += car.vx * dt;
      car.wheelSpin += car.vx * dt / 8;
      car.t = elapsed;
      if (car.x > deckNodes[deckNodes.length - 1].x0 + 26) car.reached = true;
      if (car.y > FAIL_Y - 24) failure = failure || '矿车坠入深谷';
    }

    for (const n of nodes) {
      if (n.fixed) continue;
      if (n.y > FAIL_Y || n.x < 12 || n.x > 948) {
        failure = failure || '桥面节点越界';
        break;
      }
      if (!Number.isFinite(n.x + n.y + n.vx + n.vy)) { failure = failure || '数值失稳'; break; }
    }
  }

  function state() {
    return {
      levelId: level ? level.id : 0,
      elapsed, failure, peakStress,
      members: members.length, nodes: nodes.length,
      deckConnected: deckConnected(),
      car: car ? {
        x: car.x, y: car.y, vx: car.vx, vy: car.vy, mass: car.mass,
        support: car.support, supported: car.supported, load: car.load,
        loadA: car.loadA || 0, loadB: car.loadB || 0,
        pitch: car.pitch, t: car.t, reached: car.reached,
      } : null,
    };
  }

  return {
    loadLevel, resetSim, build, canBuild, removeMember, removeLast, clearMembers,
    step, state,
    drainEvents: () => { const e = events; events = []; return e; },
    nodes: () => nodes, members: () => members, car: () => car,
    level: () => level, deckNodes: () => deckNodes, deckConnected, hasDeckBeam,
    findNode, nodeIndex, segmentForX,
    pillarHeight: (id) => { const n = nodeById.get(id); return n ? GROUND_Y - n.y0 : 0; },
    nudgeNode: (idx, dx, dy) => { const n = nodes[idx]; if (n && !n.fixed) { n.x += dx; n.y += dy; } },
    cutMember: (i) => { const m = members[i]; if (!m) return false; removeMember(m); return true; },
    setCarMass: (v) => { if (car) car.mass = Math.max(.1, +v || .1); },
    setCarX: (v) => { if (car) car.x = +v; },
    stressList: () => members.map(m => m.stress),
    GROUND_Y, GRAV,
  };
}
