// karts.js — procedural low-poly kart, roadblock and homing-bolt meshes.
import * as THREE from '../vendor/three.module.min.js';
import { spriteTex } from './track.js';

const wheelGeo = new THREE.CylinderGeometry(.38, .38, .34, 12);
wheelGeo.rotateZ(Math.PI / 2);
wheelGeo.userData.shared = true;

function shadowTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(64, 64, 2, 64, 64, 62);
  grd.addColorStop(0, 'rgba(0,0,0,.62)');
  grd.addColorStop(.55, 'rgba(0,0,0,.36)');
  grd.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grd; g.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.userData.shared = true; return t;
}

let sharedShadow = null;

export function makeKartModel(color, isPlayer) {
  const group = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({
    color, metalness: .46, roughness: .32,
    emissive: new THREE.Color(color).multiplyScalar(.10)
  });
  const dark = new THREE.MeshStandardMaterial({ color: 0x171821, metalness: .65, roughness: .3 });
  const cream = new THREE.MeshStandardMaterial({ color: 0xf3e7cf, roughness: .38, metalness: .22 });
  const glass = new THREE.MeshStandardMaterial({ color: 0x9fe7e1, metalness: .7, roughness: .12, transparent: true, opacity: .82 });

  const nose = new THREE.Mesh(new THREE.BoxGeometry(1.7, .38, 1.45), bodyMat);
  nose.position.set(0, .39, 1.1); group.add(nose);
  const hull = new THREE.Mesh(new THREE.BoxGeometry(1.9, .56, 2.25), bodyMat);
  hull.position.set(0, .58, -.25); group.add(hull);
  const tail = new THREE.Mesh(new THREE.BoxGeometry(2.05, .26, .75), bodyMat);
  tail.position.set(0, .76, -1.22); group.add(tail);
  const cockpit = new THREE.Mesh(new THREE.BoxGeometry(.88, .44, 1.1), dark);
  cockpit.position.set(0, .93, -.05); group.add(cockpit);
  const screen = new THREE.Mesh(new THREE.BoxGeometry(.78, .3, .08), glass);
  screen.position.set(0, 1.0, .52); screen.rotation.x = -.25; group.add(screen);
  const helmet = new THREE.Mesh(new THREE.SphereGeometry(.31, 12, 8), cream);
  helmet.scale.y = .92; helmet.position.set(0, 1.26, -.08); group.add(helmet);
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(.13, .18, .64), bodyMat);
  stripe.position.set(0, 1.3, -.08); group.add(stripe);

  const spoilerBar = new THREE.Mesh(new THREE.BoxGeometry(2.25, .1, .32), dark);
  spoilerBar.position.set(0, 1.25, -1.48); group.add(spoilerBar);
  for (const x of [-.82, .82]) {
    const strut = new THREE.Mesh(new THREE.BoxGeometry(.08, .55, .1), dark);
    strut.position.set(x, .98, -1.4); group.add(strut);
  }

  const wheels = [];
  for (const x of [-1.02, 1.02]) for (const z of [-.88, .92]) {
    const w = new THREE.Mesh(wheelGeo, dark);
    w.position.set(x, .4, z);
    group.add(w); wheels.push(w);
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(.16, .16, .36, 8), cream);
    hub.rotation.z = Math.PI / 2; hub.position.copy(w.position); group.add(hub);
  }

  const glow = new THREE.Sprite(new THREE.SpriteMaterial({
    map: spriteTex(), color, transparent: true, opacity: isPlayer ? .46 : .25,
    blending: THREE.AdditiveBlending, depthWrite: false
  }));
  glow.scale.set(3.8, 1.5, 1); glow.position.set(0, .18, -.4); group.add(glow);

  if (!sharedShadow) sharedShadow = shadowTexture();
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(3.1, 4.1), new THREE.MeshBasicMaterial({
    map: sharedShadow, transparent: true, depthWrite: false, opacity: .82
  }));
  shadow.rotation.x = -Math.PI / 2; shadow.position.y = -0.4;
  group.add(shadow);

  group.userData = { wheels, glow };
  return group;
}

export function makeRoadblock() {
  const g = new THREE.Group();
  const base = new THREE.Mesh(new THREE.BoxGeometry(2.4, .28, .9),
    new THREE.MeshStandardMaterial({ color: 0x242028, roughness: .7, metalness: .3 }));
  base.position.y = .18; g.add(base);
  const barMat = new THREE.MeshStandardMaterial({
    color: 0xdf6b52, emissive: 0x5c140e, emissiveIntensity: .6, roughness: .4, metalness: .3
  });
  for (let i = 0; i < 3; i++) {
    const b = new THREE.Mesh(new THREE.BoxGeometry(.2, .85, .2), barMat);
    b.position.set((i - 1) * .86, .72, 0); g.add(b);
  }
  const top = new THREE.Mesh(new THREE.BoxGeometry(2.15, .2, .2), new THREE.MeshStandardMaterial({
    color: 0xffd08a, emissive: 0xe8a84f, emissiveIntensity: .4
  }));
  top.position.y = 1.16; g.add(top);
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({
    map: spriteTex(), color: 0xff8a4c, opacity: .42, transparent: true,
    blending: THREE.AdditiveBlending, depthWrite: false
  }));
  glow.scale.set(3.6, 2.2, 1); glow.position.y = .8; g.add(glow);
  return g;
}

export function makeMissile(color = 0xffcf7a) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.ConeGeometry(.22, 1.2, 7),
    new THREE.MeshStandardMaterial({ color: 0xf3e7cf, emissive: color, emissiveIntensity: .7, metalness: .4, roughness: .25 }));
  body.rotation.x = Math.PI / 2; g.add(body);
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({
    map: spriteTex(), color, transparent: true, opacity: .8,
    blending: THREE.AdditiveBlending, depthWrite: false
  }));
  glow.scale.set(2.2, 2.2, 1); glow.position.z = -.4; g.add(glow);
  return g;
}

export function makeDustSprite(color = 0x8fe9dc) {
  return new THREE.Sprite(new THREE.SpriteMaterial({
    map: spriteTex(), color, transparent: true, opacity: .7,
    blending: THREE.AdditiveBlending, depthWrite: false
  }));
}
