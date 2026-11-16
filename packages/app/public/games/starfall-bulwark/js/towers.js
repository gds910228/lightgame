// Tower definitions (3 levels each), build/upgrade/sell, targeting
// (furthest-along-the-path first, "first" in classic TD terms), per-type fire
// logic, disable state (boss stomp), range rings and level-up visuals.
import * as THREE from '../vendor/three.module.min.js';
import { matStd, glowTex } from './assets.js';

export const TOWERS = {
  ballista: {
    zh: '弩箭塔', en: 'Ballista', cost: 50, upg: [40, 70], color: 0xffd77a, mh: 1.15, canFly: true,
    lv: [{ dmg: 8, rate: 1.1, range: 5.5 }, { dmg: 14, rate: .95, range: 6 }, { dmg: 24, rate: .8, range: 6.5 }],
    desc: '速射单体·全域',
  },
  frost: {
    zh: '霜牙尖塔', en: 'Frost Spire', cost: 70, upg: [55, 85], color: 0x7fd0ff, mh: 1.3, canFly: true,
    lv: [{ dmg: 4, rate: 1.5, range: 4.5, slow: .35 }, { dmg: 7, rate: 1.35, range: 4.8, slow: .45 }, { dmg: 12, rate: 1.2, range: 5.1, slow: .55 }],
    desc: '冰晶弹·减速',
  },
  totem: {
    zh: '连雷图腾', en: 'Storm Totem', cost: 100, upg: [80, 120], color: 0x9a8aff, mh: 1.35, canFly: true,
    lv: [{ dmg: 12, rate: 1.7, range: 5, chain: 2 }, { dmg: 18, rate: 1.55, range: 5.3, chain: 3 }, { dmg: 26, rate: 1.4, range: 5.6, chain: 4 }],
    desc: '链电·多目标',
  },
  mortar: {
    zh: '熔核迫炮', en: 'Magma Mortar', cost: 110, upg: [90, 140], color: 0xff8a50, mh: .95, canFly: false,
    lv: [{ dmg: 18, rate: 2.6, range: 7, splash: 2 }, { dmg: 30, rate: 2.4, range: 7.5, splash: 2.2 }, { dmg: 48, rate: 2.2, range: 8, splash: 2.5 }],
    desc: '抛射溅射·不击飞行',
  },
  prism: {
    zh: '星光棱镜', en: 'Star Prism', cost: 150, upg: [110, 170], color: 0x6fe8d8, mh: 1.45, canFly: true,
    lv: [{ dmg: 5.5, rate: .25, range: 6.5 }, { dmg: 9.5, rate: .25, range: 7 }, { dmg: 15, rate: .25, range: 7.5 }],
    desc: '持续光束·高伤',
  },
};

export function sellValue(t) { return Math.floor(.7 * t.invested); }

export function makeTower(key, pad, mods, fx, glowT) {
  const def = TOWERS[key];
  const group = new THREE.Group();
  const bodies = [], eiBase = [];
  const add = (geo, color, ei = 0) => {
    const m = new THREE.Mesh(geo, matStd(color, { emissive: color, ei, rough: .55, metal: .2 }));
    group.add(m); bodies.push(m); eiBase.push(ei); return m;
  };
  const stone = 0x3a3352, wood = 0x8a6a4a, metal = 0x707a94;
  let barrel = null, spin = null;
  if (key === 'ballista') {
    add(new THREE.CylinderGeometry(.5, .6, .5, 6), stone); group.children[0].position.y = .25;
    const yoke = add(new THREE.BoxGeometry(.18, .5, .5), wood); yoke.position.y = .8;
    const limb1 = add(new THREE.BoxGeometry(.9, .08, .08), wood); limb1.position.set(0, 1.05, 0); limb1.rotation.z = .35;
    const limb2 = add(new THREE.BoxGeometry(.9, .08, .08), wood); limb2.position.set(0, 1.05, 0); limb2.rotation.z = -.35;
    barrel = add(new THREE.CylinderGeometry(.07, .07, .95, 6), metal); barrel.rotation.x = Math.PI / 2; barrel.position.set(0, 1.05, .25);
    const tip = add(new THREE.ConeGeometry(.12, .3, 5), def.color, .8); tip.rotation.x = Math.PI / 2; tip.position.set(0, 1.05, .8);
    spin = tip;
  } else if (key === 'frost') {
    add(new THREE.CylinderGeometry(.55, .68, .45, 6), stone); group.children[0].position.y = .22;
    const c1 = add(new THREE.ConeGeometry(.4, 1.0, 6), 0x9fd8ff, .5); c1.position.y = .85;
    const c2 = add(new THREE.ConeGeometry(.26, .7, 6), def.color, .8); c2.position.y = 1.55;
    spin = c2;
  } else if (key === 'totem') {
    add(new THREE.CylinderGeometry(.5, .6, .4, 6), stone); group.children[0].position.y = .2;
    const pole = add(new THREE.BoxGeometry(.34, 1.5, .34), wood); pole.position.y = 1.05;
    const b1 = add(new THREE.TorusGeometry(.28, .05, 6, 14), def.color, .9); b1.rotation.x = Math.PI / 2; b1.position.y = .8;
    const b2 = add(new THREE.TorusGeometry(.26, .05, 6, 14), def.color, .9); b2.rotation.x = Math.PI / 2; b2.position.y = 1.3;
    const orb = add(new THREE.SphereGeometry(.2, 8, 6), def.color, 1.1); orb.position.y = 1.85;
    spin = b2;
  } else if (key === 'mortar') {
    add(new THREE.BoxGeometry(.9, .4, .9), stone); group.children[0].position.y = .2;
    barrel = add(new THREE.CylinderGeometry(.22, .28, 1.0, 8), metal); barrel.rotation.x = -Math.PI / 3.2; barrel.position.set(0, .75, 0);
    const mouth = add(new THREE.SphereGeometry(.2, 8, 6), def.color, .7); mouth.position.set(0, 1.12, .32);
    spin = mouth;
  } else { // prism
    add(new THREE.CylinderGeometry(.55, .7, .35, 6), stone); group.children[0].position.y = .18;
    const ring = add(new THREE.TorusGeometry(.42, .06, 6, 16), def.color, .8); ring.rotation.x = Math.PI / 2; ring.position.y = .6;
    const gem = add(new THREE.OctahedronGeometry(.42, 0), 0xaff5e8, 1.1); gem.position.y = 1.3;
    const tr = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowT, color: def.color, transparent: true, opacity: .45, depthWrite: false, blending: THREE.AdditiveBlending }));
    tr.scale.set(2.2, 2.2, 1); tr.position.y = 1.3; group.add(tr);
    spin = gem;
  }

  group.position.copy(pad.pos); group.position.y = .5;
  pad.mesh.parent.add(group);

  const t = {
    key, def, lv: 0, pad, invested: def.cost,
    group, bodies, eiBase, barrel, spin, mods, fx, glowT,
    cd: .4, disabledT: 0, recoilT: 0, target: null, tickT: 0,
    _beamId: 'beam-' + Math.random().toString(36).slice(2, 8),
    ring: null,
    st() { return def.lv[this.lv]; },
    effRange(fog) {
      return this.st().range * this.mods.range * (fog ? .8 : 1);
    },
    effRate(overcharge) {
      return this.st().rate / (this.mods.rate * (overcharge > 0 ? 1.45 : 1));
    },
    dmgFor() {
      let d = this.st().dmg * this.mods.allDmg;
      if (this.key === 'ballista') d *= this.mods.ballistaDmg;
      if (this.key === 'prism') d *= this.mods.prismDmg;
      return d;
    },
    pick(enemies, fog, flyF) {
      let best = null, bestP = -1;
      const R = this.effRange(fog);
      for (const e of enemies()) {
        if (!e.alive) continue;
        if (e.fly && !this.def.canFly) continue;
        const d = e.pos(true).distanceTo(this.group.position);
        if (d > R) continue;
        const p = e.fly ? e.flyF : e.t;
        if (p > bestP) { bestP = p; best = e; }
      }
      return best;
    },
    muzzle() { return this.group.position.clone().add(new THREE.Vector3(0, this.def.mh, 0)); },
    showRange(on, fog) {
      if (on) {
        if (!this.ring) {
          this.ring = new THREE.Mesh(new THREE.RingGeometry(.94, 1, 40), new THREE.MeshBasicMaterial({ color: this.def.color, transparent: true, opacity: .35, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false }));
          this.ring.rotation.x = -Math.PI / 2; this.pad.mesh.parent.add(this.ring);
        }
        this.ring.position.set(this.pad.pos.x, .09, this.pad.pos.z);
        this.ring.scale.setScalar(this.effRange(fog));
        this.ring.visible = true;
      } else if (this.ring) this.ring.visible = false;
    },
    setDisabled(on) {
      this.bodies.forEach((m, i) => m.material.emissiveIntensity = on ? 0 : this.eiBase[i]);
    },
    update(dt, ctx) {
      if (this.spin) this.spin.rotation.y += dt * 1.6;
      if (this.recoilT > 0) {
        this.recoilT -= dt;
        if (this.barrel) this.barrel.position.z = .25 - Math.max(0, this.recoilT) * 2.2;
      }
      if (this.disabledT > 0) {
        this.disabledT -= dt;
        if (this.disabledT <= 0) this.setDisabled(false);
        return;
      }
      const { enemies, overcharge, fog } = ctx;
      this.cd -= dt;
      const st = this.st();
      if (this.key === 'prism') {
        let tgt = this.target;
        if (!tgt || !tgt.alive || tgt.pos(true).distanceTo(this.group.position) > this.effRange(fog)) {
          tgt = this.pick(enemies, fog); this.target = tgt;
          if (!tgt) { this.fx.beamEnd(this._beamId); return; }
        }
        const tp = tgt.pos();
        this.fx.beam(this._beamId, this.muzzle(), tp, this.def.color);
        this.group.rotation.y = Math.atan2(tp.x - this.group.position.x, tp.z - this.group.position.z);
        this.tickT -= dt;
        if (this.tickT <= 0) {
          this.tickT = st.rate;
          const dealt = tgt.takeHit(this.dmgFor());
          this.fx.burst(tp, this.def.color, 3, .8, .6);
          if (dealt) ctx.hit(this, tgt, dealt);
          if (!tgt.alive) { this.fx.beamEnd(this._beamId); this.target = null; }
        }
        return;
      }
      if (this.cd > 0) return;
      const tgt = this.pick(enemies, fog);
      if (!tgt) return;
      this.cd = this.effRate(overcharge);
      const mz = this.muzzle();
      this.group.rotation.y = Math.atan2(tgt.pos().x - this.group.position.x, tgt.pos().z - this.group.position.z);
      if (this.key === 'ballista') {
        this.fx.bolt(mz, tgt, 0xffe2a0, 15, (e) => {
          const dealt = e.takeHit(this.dmgFor());
          this.fx.burst(e.pos(), 0xffd77a, 5, 1.4, .8);
          if (dealt) ctx.hit(this, e, dealt);
        });
        this.recoilT = .12;
      } else if (this.key === 'frost') {
        this.fx.shard(mz, tgt, 0x9fd8ff, 10, (e) => {
          const dealt = e.takeHit(this.dmgFor());
          e.applySlow(Math.min(.8, st.slow + this.mods.slow), 1.5);
          this.fx.ring(e.pos(true), 0x7fd0ff, .9, .3);
          if (dealt) ctx.hit(this, e, dealt);
        });
      } else if (this.key === 'totem') {
        const chain = st.chain + (this.mods.chain || 0);
        const hitList = [tgt];
        let last = tgt;
        for (let i = 1; i < chain; i++) {
          let best = null, bd = 2.6;
          for (const e of enemies()) {
            if (!e.alive || hitList.includes(e)) continue;
            const d = e.pos().distanceTo(last.pos());
            if (d < bd) { bd = d; best = e; }
          }
          if (!best) break;
          hitList.push(best); last = best;
        }
        const pts = [mz, ...hitList.map(e => e.pos().clone().add(new THREE.Vector3(0, .3, 0)))];
        this.fx.zap(pts, 0xb0a6ff);
        hitList.forEach((e, i) => {
          const dealt = e.takeHit(this.dmgFor() * (i === 0 ? 1 : .8 ** i));
          this.fx.burst(e.pos(), 0x9a8aff, 4, 1.2, .7);
          if (dealt) ctx.hit(this, e, dealt);
        });
      } else if (this.key === 'mortar') {
        const flight = .9;
        const spd = tgt.speedNow();
        const aimT = Math.min(1, tgt.t + spd * flight / world_curveLen);   // predict along path
        const aim = world_curvePoint(aimT);
        this.fx.shell(mz, aim, 0xffa060, flight, (to) => {
          this.fx.ring(to, 0xff8a50, st.splash * this.mods.splash, .4);
          this.fx.burst(to, 0xff8a50, 16, 2.4, 1.6);
          this.fx.flash(to.clone().add(new THREE.Vector3(0, .3, 0)), 0xffc080, .4, 2.0, .25);
          for (const e of enemies()) {
            if (!e.alive || e.fly) continue;
            if (e.pos(true).distanceTo(to) <= st.splash * this.mods.splash) {
              const dealt = e.takeHit(this.dmgFor());
              if (dealt) ctx.hit(this, e, dealt);
            }
          }
        });
        this.recoilT = .18;
      }
    },
    upgrade() {
      if (this.lv >= 2) return false;
      this.lv++;
      const c = this.def.upg[this.lv - 1];
      this.invested += c;
      const band = new THREE.Mesh(new THREE.TorusGeometry(.72, .05, 6, 18), matStd(this.def.color, { emissive: this.def.color, ei: .9 }));
      band.rotation.x = Math.PI / 2; band.position.y = .55 + this.lv * .12;
      this.group.add(band);
      this.group.scale.setScalar(1 + this.lv * .06);
      return c;
    },
    dispose(parent) { this.showRange(false); parent.remove(this.group); },
  };
  return t;
}
let world_curvePoint = null, world_curveLen = 36;
export function bindCurve(w) {
  world_curveLen = w.curve.getLength();
  world_curvePoint = (t) => w.curve.getPointAt(Math.min(Math.max(t, 0), 1));
}
