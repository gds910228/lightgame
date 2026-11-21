import { LEVELS, instantiateLevel } from '../../../packages/games/silkline-swing/js/levels.js';
import { probeRoute } from '../../../packages/games/silkline-swing/js/physics.js';
for (const l of LEVELS) {
  console.log(l.id, l.name, 'anchors', l.anchors.length, 'W', l.worldW, 'probe', l.probe.ok, 'shards', l.probe.shards, 't', l.probe.time);
}
let allOk = true;
for (const l of LEVELS) {
  const inst = instantiateLevel(l.id);
  const r = probeRoute(inst, 30);
  if (!r.ok || r.shards < 3) { allOk = false; console.log('FAIL', l.id, r.ok, r.shards, r.t); }
}
console.log('all routes + 3 shards:', allOk);
