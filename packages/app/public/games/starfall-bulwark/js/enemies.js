// Enemy definitions, path following (ground = param t along star-road,
// flying = straight portal→core line), armor, slows, shaman heals, boss stomp,
// elite affixes with floating name tags, hit flash, hp bars.
import * as THREE from '../vendor/three.module.min.js';
import { matStd, hpBar, textTag, glowTex } from './assets.js';

export const ENEMY = {
  crawler:  { zh: '爬晶兽', hp: 30,  spd: 1.6, armor: 0, reward: 6,   size: .55, coreDmg: 1, color: 0x9a4a6e },
  runner:   { zh: '疾行虫', hp: 18,  spd: 3.2, armor: 0, reward: 6,   size: .45, coreDmg: 1, color: 0xd07a3a },
  brute:    { zh: '岩甲兽', hp: 90,  spd: 1.0, armor: 3, reward: 14,  size: .85, coreDmg: 1, color: 0x5a6078 },
  wisp:     { zh: '浮游晶母', hp: 26, spd: 2.2, armor: 0, reward: 9,   size: .5,  coreDmg: 1, color: 0x6fe8d8, fly: true },
  shaman:   { zh: '蚀晶巫祝', hp: 55, spd: 1.3, armor: 1, reward: 16,  size: .6,  coreDmg: 1, color: 0x9a5af0 },
  colossus: { zh: '裂地巨像', hp: 900, spd: .65, armor: 4, reward: 120, size: 1.6, coreDmg: 5, color: 0xb04a3a, boss: true },
};
export const AFFIX = {
  swift: { zh: '疾', speed: 1.35, fg: '#ffd77a' },
  vital: { zh: '坚', hp: 1.6, fg: '#7fe89a' },
  ward:  { zh: '磐', armor: 2, fg: '#8ab4ff' },
};

export function makeEnemy(kind, world, opts = {}) {
  const def = ENEMY[kind], glowT = glowTex();
  const S = def.size;
  const group = new THREE.Group();
  const bodies = [];
  const add = (geo, color, ei = 0, x = 0, y = 0, z = 0) => {
    const m = new THREE.Mesh(geo, matStd(color, { emissive: color, ei, rough: .6 }));
    m.position.set(x, y, z); m.rotation.y = Math.random() * 3;
    group.add(m); bodies.push(m); return m;
  };
  let eiBase = [];
  if (kind === 'crawler') {
    add(new THREE.BoxGeometry(.7, .45, .9), def.color, .5, 0, .42, 0);
    for (let i = 0; i < 4; i++) add(new THREE.ConeGeometry(.1, .3, 5), 0xd678a0, .5, (i % 2 ? .18 : -.18), .72, (i < 2 ? .25 : -.25));
    add(new THREE.SphereGeometry(.16, 6, 5), 0xe080b0, .8, 0, .5, .52);
  } else if (kind === 'runner') {
    add(new THREE.BoxGeometry(.34, .3, .8), def.color, .55, 0, .34, 0);
    add(new THREE.BoxGeometry(.2, .1, .3), 0xe8a060, .7, 0, .5, .3);
    add(new THREE.ConeGeometry(.1, .5, 4), def.color, .35, .18, .12, -.15).rotation.z = -1.3;
    add(new THREE.ConeGeometry(.1, .5, 4), def.color, .35, -.18, .12, -.15).rotation.z = 1.3;
  } else if (kind === 'brute') {
    add(new THREE.DodecahedronGeometry(.55, 0), def.color, .3, 0, .62, 0);
    add(new THREE.BoxGeometry(.9, .18, .9), 0x39405c, .25, 0, .18, 0);
    add(new THREE.BoxGeometry(.22, .5, .22), 0x49507a, .25, .55, .45, 0).rotation.z = -.5;
    add(new THREE.BoxGeometry(.22, .5, .22), 0x49507a, .25, -.55, .45, 0).rotation.z = .5;
  } else if (kind === 'wisp') {
    add(new THREE.OctahedronGeometry(.34, 0), def.color, .9, 0, 0, 0);
    const tr = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowT, color: def.color, transparent: true, opacity: .5, depthWrite: false, blending: THREE.AdditiveBlending }));
    tr.scale.set(1.6, 1.6, 1); group.add(tr);
  } else if (kind === 'shaman') {
    add(new THREE.ConeGeometry(.4, .95, 6), def.color, .45, 0, .5, 0);
    add(new THREE.SphereGeometry(.14, 6, 5), 0xd6b0ff, .9, .3, .95, .12);
    add(new THREE.CylinderGeometry(.04, .04, 1, 5), 0x4a2a6e, 0, .3, .5, .12);
  } else { // colossus
    add(new THREE.BoxGeometry(1.5, 1.3, 1.1), def.color, .45, 0, 1.5, 0);
    add(new THREE.BoxGeometry(.5, .8, .5), 0x7a3528, .3, .95, .6, 0);
    add(new THREE.BoxGeometry(.5, .8, .5), 0x7a3528, .3, -.95, .6, 0);
    add(new THREE.BoxGeometry(.45, .7, .5), 0x8a4030, .3, .5, .35, .35);
    add(new THREE.BoxGeometry(.45, .7, .5), 0x8a4030, .3, -.5, .35, .35);
    add(new THREE.BoxGeometry(.7, .5, .6), 0xc05a45, .6, 0, 2.3, 0);
    add(new THREE.SphereGeometry(.1, 6, 5), 0xffb060, 1.4, .16, 2.35, .32);
    add(new THREE.SphereGeometry(.1, 6, 5), 0xffb060, 1.4, -.16, 2.35, .32);
  }
  eiBase = bodies.map(m => m.material.emissiveIntensity);

  // hp bar + affix tags
  const bar = hpBar(); bar.position.y = 1 + S + (def.boss ? 1.1 : .35); bar.scale.set(def.boss ? 1.7 : .8 + S * .4, bar.scale.y, 1);
  bar.visible = false; group.add(bar);
  const tags = [];

  const curveLen = world.curve.getLength();
  const straightLen = new THREE.Vector3(10.5, 0, -9.5).distanceTo(new THREE.Vector3(-5.5, 0, 0));
  const e = {
    kind, def, fly: !!def.fly, boss: !!def.boss,
    t: opts.t ?? 0, flyF: 0,
    maxHp: def.hp * (opts.hpMult || 1), armor: def.armor + (opts.armorAdd || 0),
    baseSpeed: def.spd * (opts.spdMult || 1),
    alive: true, leaked: false, slowT: 0, slowF: 0, flashT: 0, bob: Math.random() * 6,
    healT: 1.2, stompT: 6, affixes: opts.affixes || [],
    group, bar, tags,
    _wobble: Math.random() * 9,
    pos(ground) {
      if (ground && this.fly) return new THREE.Vector3(this.group.position.x, 0, this.group.position.z);
      return this.group.position.clone();
    },
    speedNow() { return this.baseSpeed * (this.slowT > 0 ? 1 - this.slowF : 1); },
    applySlow(f, dur) { if (f > this.slowF || this.slowT <= 0) this.slowF = f; this.slowT = Math.max(this.slowT, dur); },
    heal(n) { if (!this.alive || this.hp >= this.maxHp) return false; this.hp = Math.min(this.maxHp, this.hp + n); this.flashT = .18; this.bar.visible = true; return true; },
    takeHit(dmg) {
      if (!this.alive) return 0;
      const eff = Math.max(1, dmg - this.armor);
      this.hp -= eff; this.flashT = .12; this.bar.visible = true;
      if (this.hp <= 0) this.alive = false;
      return eff;
    },
    update(dt, hooks, allies) {
      if (!this.alive) return;
      if (this.flashT > 0) {
        this.flashT -= dt;
        const f = this.flashT > 0 ? 2.2 : 0;
        bodies.forEach((m, i) => m.material.emissiveIntensity = f || eiBase[i]);
      }
      if (this.slowT > 0) this.slowT -= dt;
      const spd = this.speedNow();
      this.bob += dt * spd * 3.4;
      if (this.fly) {
        this.flyF += spd * dt / straightLen;
        if (this.flyF >= 1) { this.alive = false; this.leaked = true; hooks.onLeak(this); return; }
        this.group.position.set(
          10.5 + (-5.5 - 10.5) * this.flyF,
          1 + Math.sin(this.bob * .6 + this._wobble) * .18,
          -9.5 + 9.5 * this.flyF);
        this.group.rotation.y += dt * .8;
      } else {
        this.t += spd * dt / curveLen;
        if (this.t >= 1) { this.alive = false; this.leaked = true; hooks.onLeak(this); return; }
        const p = world.curve.getPointAt(Math.min(this.t, 1));
        const tg = world.curve.getTangentAt(Math.min(this.t + .01, 1));
        this.group.position.set(p.x, .12 + Math.abs(Math.sin(this.bob)) * .05, p.z);
        this.group.rotation.y = Math.atan2(tg.x, tg.z);
      }
      // shaman aura heal
      if (kind === 'shaman' && allies) {
        this.healT -= dt;
        if (this.healT <= 0) {
          this.healT = 1.2;
          let any = false;
          for (const a of allies()) {
            if (a !== this && a.alive && a.hp < a.maxHp && a.pos().distanceTo(this.pos()) < 3) { a.heal(8); any = true; }
          }
          if (any) hooks.onHeal && hooks.onHeal(this);
        }
      }
      // colossus stomp: disable nearest tower briefly
      if (def.boss) {
        this.stompT -= dt;
        if (this.stompT <= 0) { this.stompT = 6; hooks.onStomp && hooks.onStomp(this); }
      }
      this.bar.position.y = (def.boss ? 2.9 : 1 + S + .2) + (this.fly ? .5 : 0);
    },
    addTag(txt, fg) {
      const sp = textTag(txt, { fg, size: 22, bg: 'rgba(20,8,30,.78)', pad: 5 });
      group.add(sp); tags.push(sp);
      tags.forEach((t, i) => { t.position.set(-.3 + i * .52, 2.1 + (def.boss ? .9 : .3), 0); });
    },
    dispose(scene) { scene.remove(group); },
  };
  e.hp = e.maxHp;
  // elite affixes: apply stat effects and stack name tags
  for (const a of e.affixes) {
    const A = AFFIX[a];
    if (!A) continue;
    if (A.speed) e.baseSpeed *= A.speed;
    if (A.hp) { e.maxHp *= A.hp; e.hp = e.maxHp; }
    if (A.armor) e.armor += A.armor;
    e.addTag(A.zh, A.fg);
  }
  return e;
}
