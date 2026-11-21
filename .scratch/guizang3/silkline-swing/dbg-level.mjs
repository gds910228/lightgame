import { LEVELS, instantiateLevel } from '../../../packages/games/silkline-swing/js/levels.js';
import { probeRoute, makeProbe, probeStep } from '../../../packages/games/silkline-swing/js/physics.js';
const base = LEVELS[0];
console.log('anchors', base.anchors.map(a=>[+a.x.toFixed(0),+a.y.toFixed(0),a.type]));
console.log('gate', base.gate, 'start', base.start, 'spikes', base.spikes);
const inst = instantiateLevel(1);
const bot = makeProbe(inst);
let lastAnchor=-2, last='';
for(let i=0;i<26*60;i++){
  probeStep(bot, inst, 1/60);
  const pl=bot.pl;
  if(pl.anchor!==lastAnchor){ lastAnchor=pl.anchor; console.log('t',pl.t.toFixed(1),'anchor',pl.anchor,'pos',pl.x.toFixed(0),pl.y.toFixed(0),'L',pl.L.toFixed(0),'v',pl.vx.toFixed(0),pl.vy.toFixed(0)); }
  if(i%120===0) last=`${pl.t.toFixed(1)} a=${pl.anchor} x=${pl.x.toFixed(0)} y=${pl.y.toFixed(0)} v=${Math.hypot(pl.vx,pl.vy).toFixed(0)}`;
  if(!pl.alive){ console.log('died', pl.deathReason, pl.t); break;}
  if(Math.abs(pl.x-inst.gate.x)<70 && Math.abs(pl.y-inst.gate.y)<150){ console.log('IN GATE', pl.t, pl.x, pl.y, 'anchor', pl.anchor); break;}
}
console.log('final', last, 'shards', inst.shards.filter(s=>s.got).length);
