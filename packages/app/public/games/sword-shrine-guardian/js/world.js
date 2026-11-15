// World: scene assembly (sky, ground, props, lights, fog), camera rig (narrow zoom, focus leash, occluder fade),
// minimal two-pass bloom (peak colors stay <= ~2.3 per skill).
import * as THREE from '../vendor/three.module.min.js';
import { mats, buildProps, skyMat, ARENA } from './assets.js';
import { V } from './rig.js';

const BLOOM_VS = `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0., 1.); }`;
const BRIGHT_FS = `uniform sampler2D tDiffuse; varying vec2 vUv;
  void main(){
    vec3 c = texture2D(tDiffuse, vUv).rgb;
    float l = dot(c, vec3(.299, .587, .114));
    float k = smoothstep(.72, 1.15, l);
    gl_FragColor = vec4(c * k, 1.);
  }`;
const BLUR_FS = `uniform sampler2D tDiffuse; uniform vec2 uDir; varying vec2 vUv;
  void main(){
    vec3 s = vec3(0.);
    s += texture2D(tDiffuse, vUv - uDir * 3.).rgb * .06;
    s += texture2D(tDiffuse, vUv - uDir * 2.).rgb * .12;
    s += texture2D(tDiffuse, vUv - uDir * 1.).rgb * .18;
    s += texture2D(tDiffuse, vUv).rgb * .28;
    s += texture2D(tDiffuse, vUv + uDir * 1.).rgb * .18;
    s += texture2D(tDiffuse, vUv + uDir * 2.).rgb * .12;
    s += texture2D(tDiffuse, vUv + uDir * 3.).rgb * .06;
    gl_FragColor = vec4(s, 1.);
  }`;
const COMBINE_FS = `uniform sampler2D tScene; uniform sampler2D tBloom; varying vec2 vUv;
  void main(){
    vec3 c = texture2D(tScene, vUv).rgb + texture2D(tBloom, vUv).rgb * .85;
    gl_FragColor = vec4(pow(max(c, vec3(0.)), vec3(1. / 2.2)), 1.);   // linear -> sRGB for the default framebuffer
  }`;

export function makeWorld(renderer) {
  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x0a0f18, .028);
  const camera = new THREE.PerspectiveCamera(40, innerWidth / innerHeight, .1, 200);
  mats.init();

  // lights: cold moon key + warm lantern points (night scene per skill)
  const hemi = new THREE.HemisphereLight(0x39465e, 0x141821, .95);
  scene.add(hemi);
  const moon = new THREE.DirectionalLight(0xa9c0e0, 1.25);
  moon.position.set(-14, 22, 10);
  moon.castShadow = true;
  moon.shadow.mapSize.set(1024, 1024);
  moon.shadow.camera.left = -30; moon.shadow.camera.right = 30;
  moon.shadow.camera.top = 30; moon.shadow.camera.bottom = -30;
  moon.shadow.camera.far = 70;
  moon.shadow.bias = -.002;
  scene.add(moon);

  // sky dome + moon sprite
  const sky = new THREE.Mesh(new THREE.SphereGeometry(90, 16, 12), skyMat());
  scene.add(sky);
  const moonSpr = new THREE.Sprite(new THREE.SpriteMaterial({ color: 0xdfe8f4, transparent: true, opacity: .9, depthWrite: false, fog: false }));
  moonSpr.scale.set(5, 5, 1); moonSpr.position.set(-38, 42, 30); scene.add(moonSpr);

  // ground with polar edge falloff
  const gg = new THREE.CircleGeometry(ARENA.R + 4.5, 48);
  const ground = new THREE.Mesh(gg, mats.ground);
  ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true;
  scene.add(ground);
  // dark outer skirt so the arena edge reads as a cliff into mist
  const skirt = new THREE.Mesh(new THREE.RingGeometry(ARENA.R + 3.5, 60, 48), new THREE.MeshBasicMaterial({ color: 0x05070c }));
  skirt.rotation.x = -Math.PI / 2; skirt.position.y = -.12; scene.add(skirt);

  const props = buildProps(scene);
  const colliders = [];
  for (const c of [[0, -7.5, 3.1], [-8, 3.5, .8], [9, 5.2, .9], [5, -13, .8], [-13, 6, 1.7], [12, -4, 1.6], [-6, -16, 1.5], [7, 13, 1.6], [-16, -3, 1.4], [-2.6, -21.6, 1.0], [2.6, -21.6, 1.0]]) {
    colliders.push({ x: c[0], z: c[1], r: c[2] });
  }
  for (let i = 0; i < 4; i++) { const a = Math.PI / 4 + i * Math.PI / 2 + .18; colliders.push({ x: Math.cos(a) * 13.5, z: Math.sin(a) * 13.5, r: 1.15 }); }

  // --- post: bright extract -> blur -> combine (tiny custom bloom, core-only) ---
  const rtScene = new THREE.WebGLRenderTarget(innerWidth, innerHeight, { type: THREE.HalfFloatType });
  const rtA = new THREE.WebGLRenderTarget(innerWidth >> 1, innerHeight >> 1, { type: THREE.HalfFloatType });
  const rtB = new THREE.WebGLRenderTarget(innerWidth >> 1, innerHeight >> 1, { type: THREE.HalfFloatType });
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2));
  const postCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const postScene = new THREE.Scene(); postScene.add(quad);
  const mkPass = (fs, extra = {}) => {
    const m = new THREE.ShaderMaterial({ uniforms: Object.assign({ tDiffuse: { value: null } }, extra), vertexShader: BLOOM_VS, fragmentShader: fs, depthTest: false, depthWrite: false });
    return m;
  };
  const brightM = mkPass(BRIGHT_FS);
  const blurM = mkPass(BLUR_FS, { uDir: { value: new THREE.Vector2(1, 0) } });
  const combineM = mkPass(COMBINE_FS);
  combineM.uniforms.tScene = { value: rtScene.texture };
  const passthroughM = new THREE.MeshBasicMaterial({ map: rtScene.texture });
  passthroughM.toneMapped = false;

  const world = {
    scene, camera, props, colliders, ground,
    bloom: true,
    render() {
      renderer.setRenderTarget(rtScene);
      renderer.render(scene, camera);
      if (this.bloom) {
        quad.material = brightM; brightM.uniforms.tDiffuse.value = rtScene.texture;
        renderer.setRenderTarget(rtA); renderer.render(postScene, postCam);
        blurM.uniforms.tDiffuse.value = rtA.texture;
        blurM.uniforms.uDir.value.set(1 / (innerWidth >> 1), 0);
        quad.material = blurM; renderer.setRenderTarget(rtB); renderer.render(postScene, postCam);
        blurM.uniforms.tDiffuse.value = rtB.texture;
        blurM.uniforms.uDir.value.set(0, 1 / (innerHeight >> 1));
        renderer.setRenderTarget(rtA); renderer.render(postScene, postCam);
        quad.material = combineM;
        renderer.setRenderTarget(null); renderer.render(postScene, postCam);
      } else {
        renderer.setRenderTarget(null);
        quad.material = passthroughM;
        renderer.render(postScene, postCam);
      }
    },
    resize() {
      camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
      renderer.setSize(innerWidth, innerHeight);
      rtScene.setSize(innerWidth, innerHeight); rtA.setSize(innerWidth >> 1, innerHeight >> 1); rtB.setSize(innerWidth >> 1, innerHeight >> 1);
    },
    // night mood for random events: blood moon / thick fog / normal
    setMood(name) {
      const f = scene.fog;
      if (name === 'blood') { f.color.setHex(0x1c0a0c); f.density = .032; hemi.intensity = .8; moon.color.setHex(0xd88a7a); moon.intensity = 1.0; }
      else if (name === 'fog') { f.color.setHex(0x12151c); f.density = .055; hemi.intensity = .75; moon.color.setHex(0x9db4d8); moon.intensity = .9; }
      else { f.color.setHex(0x0a0f18); f.density = .028; hemi.intensity = .95; moon.color.setHex(0xa9c0e0); moon.intensity = 1.25; }
    }
  };

  // --- camera rig: iso angle, narrow zoom, focus leash, occluder fade ---
  const CAM_YAW = Math.PI * .18, CAM_DIST = 15.5;
  const rig = {
    focus: V(), shakeT: 0, shakeAmp: 0,
    update(dt, playerPos, enemies, time) {
      // focus: midpoint toward biggest threat, leashed to <= 3.5m from player (skill: 焦点加缰绳)
      let tgt = playerPos.clone();
      let nearest = null, nd = 1e9;
      for (const e of enemies) if (e.alive) { const d = e.pos.distanceTo(playerPos); if (d < nd) { nd = d; nearest = e; } }
      if (nearest && nd < 9) tgt.lerp(nearest.pos, .3);
      const off = tgt.clone().sub(playerPos);
      if (off.length() > 3.5) off.setLength(3.5);
      const focus = playerPos.clone().add(off);
      rig.focus.lerp(focus, Math.min(1, dt * 6));
      // zoom: locked narrow band based on threat spread
      const spread = nd < 1e8 ? Math.min(1, nd / 10) : 0;
      const zoom = .98 + spread * .3;
      const dist = CAM_DIST * zoom;
      const cx = rig.focus.x + Math.sin(CAM_YAW) * dist * .78;
      const cz = rig.focus.z + Math.cos(CAM_YAW) * dist * .78;
      const cy = dist * .82;
      camera.position.set(cx, cy, cz);
      camera.lookAt(rig.focus.x, 1.1, rig.focus.z);
      // shake
      if (rig.shakeT > 0) {
        rig.shakeT -= dt;
        const a = rig.shakeAmp * Math.max(0, rig.shakeT) * 3;
        camera.position.x += (Math.random() - .5) * a;
        camera.position.y += (Math.random() - .5) * a;
        camera.position.z += (Math.random() - .5) * a;
      }
      // title orbit variant handled by game.js overriding position
      // occluder fade: props near the camera->player line go translucent
      const A = camera.position, B = playerPos;
      const abx = B.x - A.x, abz = B.z - A.z, len2 = abx * abx + abz * abz || 1;
      for (const o of world.props.occluders) {
        const t = ((o.x - A.x) * abx + (o.z - A.z) * abz) / len2;
        let vis = 1;
        if (t > .08 && t < .92) {
          const dx = A.x + abx * t - o.x, dz = A.z + abz * t - o.z;
          const d = Math.hypot(dx, dz);
          if (d < o.r + .9) vis = Math.max(.12, d / (o.r + .9));
        }
        const matsArr = Array.isArray(o.mesh.material) ? o.mesh.material : [o.mesh.material];
        const cur = o.mesh.userData._vis ?? 1;
        const nv = cur + (vis - cur) * Math.min(1, dt * 8);
        o.mesh.userData._vis = nv;
        for (const m of matsArr) { m.transparent = nv < 1; m.opacity = nv; m.depthWrite = nv >= .95; }
      }
    },
    titleOrbit(time, center) {
      const a = time * .1;
      const r = 13;
      camera.position.set(center.x + Math.sin(a) * r, 7.5, center.z + Math.cos(a) * r);
      camera.lookAt(center.x, 1.6, center.z);
    },
    shake(amp) { rig.shakeAmp = Math.max(rig.shakeAmp, amp); rig.shakeT = Math.max(rig.shakeT, .3); },
    reset() { rig.shakeT = 0; rig.focus.set(0, 0, 0); }
  };
  world.rig = rig;
  return world;
}
