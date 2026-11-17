// World: nebula canyon track — three lanes, recycled floor tiles, neon pylons,
// star sky, tunnel sections, two-pass bloom (replicated from verified
// starfall-bulwark / sword-shrine-guardian pipeline).
import * as THREE from '../vendor/three.module.min.js';

const LANES = [-3, 0, 3];
const VIEW_FAR = 140;

export function makeWorld() {
  const renderer = new THREE.WebGLRenderer({ canvas: document.getElementById('gl'), antialias: true });
  renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0b0820);
  scene.fog = new THREE.Fog(0x0b0820, 30, VIEW_FAR);

  const camera = new THREE.PerspectiveCamera(64, innerWidth / innerHeight, .1, 300);
  camera.position.set(0, 4.2, 9.5);
  camera.lookAt(0, 1.6, -14);

  scene.add(new THREE.HemisphereLight(0x8ab4ff, 0x241a48, .9));
  const dir = new THREE.DirectionalLight(0xbfd4ff, 1.1); dir.position.set(4, 10, 6); scene.add(dir);
  const rim = new THREE.DirectionalLight(0xff8a5c, .5); rim.position.set(-6, 4, -10); scene.add(rim);

  const matStd = (color, { emissive = 0x000000, ei = 0, rough = .8, metal = .1 } = {}) =>
    new THREE.MeshStandardMaterial({ color, emissive, emissiveIntensity: ei, roughness: rough, metalness: metal });

  // --- star sky (static points, far above fog via scene.background stays dark) ---
  {
    const n = 700, pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, r = 90 + Math.random() * 120;
      pos[i * 3] = Math.cos(a) * r; pos[i * 3 + 1] = 12 + Math.random() * 90; pos[i * 3 + 2] = Math.sin(a) * r - 60;
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    scene.add(new THREE.Points(g, new THREE.PointsMaterial({ color: 0xaac4ff, size: .7, sizeAttenuation: true, fog: false, transparent: true, opacity: .8 })));
  }

  // --- floor tiles: recycled strips (player fixed at z=0, world moves +z) ---
  const TILE_L = 26, TILES = 9;
  const tiles = [];
  {
    const geo = new THREE.BoxGeometry(11.4, .5, TILE_L);
    const g2 = new THREE.BoxGeometry(13.6, .34, TILE_L);
    for (let i = 0; i < TILES; i++) {
      const m = new THREE.Mesh(geo, matStd(0x1a1638, { rough: .92 }));
      const edge = new THREE.Mesh(g2, matStd(0x241d50, { rough: .9 }));
      edge.position.y = -.09;
      m.add(edge);
      // neon lane strips
      const strip = new THREE.Mesh(new THREE.BoxGeometry(.16, .06, TILE_L), matStd(0x3c78e8, { emissive: 0x3c9af0, ei: 1.4 }));
      strip.position.set(-3, .28, 0);
      const strip2 = strip.clone(); strip2.position.x = 3;
      m.add(strip, strip2);
      m.position.set(0, -.25, -i * TILE_L + TILE_L);
      scene.add(m); tiles.push(m);
    }
  }

  // --- side pylons: recycled neon posts + canyon walls ---
  const pylons = [];
  {
    const geo = new THREE.BoxGeometry(.5, 5.2, .5);
    const glowGeo = new THREE.BoxGeometry(.62, 3.4, .62);
    for (let i = 0; i < 22; i++) {
      const m = new THREE.Mesh(geo, matStd(0x2a2258, { rough: .7 }));
      const glow = new THREE.Mesh(glowGeo, matStd(i % 2 ? 0x6fe8d8 : 0xff8a5c, { emissive: i % 2 ? 0x4ad8c8 : 0xe8704a, ei: 1.5 }));
      glow.position.y = .4; m.add(glow);
      m.position.set(i % 2 ? 8.6 : -8.6, 2.4, -i * 7);
      scene.add(m); pylons.push(m);
    }
  }

  // --- tunnel arches (visible only during tunnel sections) ---
  const arches = [];
  {
    const geo = new THREE.TorusGeometry(8.2, .5, 8, 20, Math.PI);
    for (let i = 0; i < 8; i++) {
      const m = new THREE.Mesh(geo, matStd(0x4a2a8e, { emissive: 0x8a5cff, ei: 1.2 }));
      m.rotation.y = Math.PI / 2; m.rotation.z = Math.PI;
      m.position.set(0, .2, -1000); m.visible = false;
      scene.add(m); arches.push(m);
    }
  }

  // --- drift particles (speed feel) ---
  const dust = (() => {
    const n = 160, pos = new Float32Array(n * 3), spd = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      pos[i * 3] = (Math.random() * 2 - 1) * 12; pos[i * 3 + 1] = Math.random() * 7; pos[i * 3 + 2] = -Math.random() * 110;
      spd[i] = 8 + Math.random() * 26;
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const pts = new THREE.Points(g, new THREE.PointsMaterial({ color: 0x9fc8ff, size: .16, transparent: true, opacity: .6 }));
    pts.userData.spd = spd; scene.add(pts); return pts;
  })();

  // --- bloom (verified two-pass pipeline) ---
  const BMP = `varying vec2 vUv; void main(){ vUv=uv; gl_Position=vec4(position.xy,0.,1.); }`;
  const rtScene = new THREE.WebGLRenderTarget(2, 2, { type: THREE.HalfFloatType });
  const rtA = new THREE.WebGLRenderTarget(2, 2, { type: THREE.HalfFloatType });
  const rtB = new THREE.WebGLRenderTarget(2, 2, { type: THREE.HalfFloatType });
  const brightM = new THREE.ShaderMaterial({
    uniforms: { tex: { value: rtScene.texture }, thr: { value: .55 } },
    vertexShader: BMP,
    fragmentShader: `uniform sampler2D tex; uniform float thr; varying vec2 vUv;
      void main(){ vec3 c=texture2D(tex,vUv).rgb; float l=dot(c,vec3(.299,.587,.114));
        gl_FragColor=vec4(c*smoothstep(thr,thr+.35,l),1.); }`, depthTest: false, depthWrite: false
  });
  const blurM = new THREE.ShaderMaterial({
    uniforms: { tex: { value: rtA.texture }, dir: { value: new THREE.Vector2(1, 0) }, res: { value: new THREE.Vector2(2, 2) } },
    vertexShader: BMP,
    fragmentShader: `uniform sampler2D tex; uniform vec2 dir,res; varying vec2 vUv;
      void main(){ vec2 o=dir/res; vec3 s=texture2D(tex,vUv).rgb*.227;
        s+=texture2D(tex,vUv+o*1.38).rgb*.316; s+=texture2D(tex,vUv-o*1.38).rgb*.316;
        s+=texture2D(tex,vUv+o*3.23).rgb*.07; s+=texture2D(tex,vUv-o*3.23).rgb*.07;
        gl_FragColor=vec4(s,1.); }`, depthTest: false, depthWrite: false
  });
  const combineM = new THREE.ShaderMaterial({
    uniforms: { scene: { value: rtScene.texture }, bloom: { value: rtB.texture }, str: { value: .7 } },
    vertexShader: BMP,
    fragmentShader: `uniform sampler2D scene,bloom; uniform float str; varying vec2 vUv;
      void main(){ vec3 c=texture2D(scene,vUv).rgb + texture2D(bloom,vUv).rgb*str;
        c=vec3(pow(clamp(c,0.,1.),vec3(1./2.2)));
        gl_FragColor=vec4(c,1.); }`, toneMapped: false, depthTest: false, depthWrite: false
  });
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), combineM);
  const quadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const quadScene = new THREE.Scene(); quadScene.add(quad);

  function size() {
    const w = innerWidth, h = innerHeight;
    renderer.setSize(w, h); camera.aspect = w / h; camera.updateProjectionMatrix();
    const pw = Math.max(2, w >> 1), ph = Math.max(2, h >> 1);
    rtScene.setSize(w, h); rtA.setSize(pw, ph); rtB.setSize(pw, ph);
    blurM.uniforms.res.value.set(pw, ph);
  }
  size(); addEventListener('resize', size);

  // --- camera shake ---
  let shakeT = 0, shakeAmp = 0;
  function shake(amp = .3, t = .3) { shakeAmp = Math.max(shakeAmp, amp); shakeT = Math.max(shakeT, t); }

  let time = 0, tunnelOn = false;
  function update(dt, speed) {
    time += dt;
    // move floor & pylons +z, recycle
    for (const t of tiles) {
      t.position.z += speed * dt;
      if (t.position.z > TILE_L * 1.2) t.position.z -= TILES * TILE_L;
    }
    for (const p of pylons) {
      p.position.z += speed * dt;
      if (p.position.z > 12) { p.position.z -= 22 * 7; p.position.x = (Math.random() < .5 ? -8.6 : 8.6) + (Math.random() * 2 - 1); }
    }
    // dust drift
    const pos = dust.geometry.attributes.position, spd = dust.userData.spd;
    for (let i = 0; i < spd.length; i++) {
      let z = pos.getZ(i) + (spd[i] + speed) * dt;
      if (z > 12) { z = -110 - Math.random() * 20; pos.setX(i, (Math.random() * 2 - 1) * 12); pos.setY(i, Math.random() * 7); }
      pos.setZ(i, z);
    }
    pos.needsUpdate = true;
    // tunnel arches
    if (tunnelOn) for (const a of arches) {
      a.visible = true;
      a.position.z += speed * dt;
      if (a.position.z > 10) a.position.z -= 8 * 9;
    } else for (const a of arches) a.visible = false;
    // camera
    shakeT = Math.max(0, shakeT - dt);
    const sh = shakeT > 0 ? shakeAmp * shakeT : 0;
    camera.position.set((Math.random() * 2 - 1) * sh, 4.2 + (Math.random() * 2 - 1) * sh, 9.5);
    camera.lookAt(0, 1.6, -14);
    scene.fog.color.setHex(tunnelOn ? 0x181038 : 0x0b0820);
  }

  function setTunnel(on) { tunnelOn = on; }

  // adaptive quality: sustained low fps → drop one blur iteration
  let quality = 2, perfN = 0, perfT = performance.now();
  function render() {
    renderer.setRenderTarget(rtScene); renderer.render(scene, camera);
    quad.material = brightM; renderer.setRenderTarget(rtA); renderer.render(quadScene, quadCam);
    const iters = quality >= 2 ? 2 : 1;
    for (let i = 0; i < iters; i++) {
      blurM.uniforms.tex.value = rtA.texture; blurM.uniforms.dir.value.set(1, 0);
      quad.material = blurM; renderer.setRenderTarget(rtB); renderer.render(quadScene, quadCam);
      blurM.uniforms.tex.value = rtB.texture; blurM.uniforms.dir.value.set(0, 1);
      quad.material = blurM; renderer.setRenderTarget(rtA); renderer.render(quadScene, quadCam);
    }
    combineM.uniforms.bloom.value = rtA.texture;
    quad.material = combineM; renderer.setRenderTarget(null); renderer.render(quadScene, quadCam);
    perfN++;
    const now = performance.now();
    if (now - perfT > 4000) {
      const fps = perfN * 1000 / (now - perfT);
      if (fps < 38 && quality > 1) quality = 1;
      perfN = 0; perfT = now;
    }
  }

  return { renderer, scene, camera, LANES, tiles, pylons, update, render, shake, setTunnel, get time() { return time; }, get tunnelOn() { return tunnelOn; }, matStd };
}
