// Scene, dusk lighting, canyon terrain, star-road curve, build pads, star core,
// void portal, ember particles, two-pass bloom and fixed isometric camera.
// Bloom pipeline replicated from the verified sword-shrine-guardian implementation.
import * as THREE from '../vendor/three.module.min.js';
import { groundTex, pathTex, glowTex, streakTex, matStd, rngSeed } from './assets.js';

const CAM_POS = new THREE.Vector3(4.5, 15.5, 17.5), CAM_LOOK = new THREE.Vector3(0.5, 0, -0.5);

export function makeWorld(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.outputColorSpace = THREE.LinearSRGBColorSpace;   // manual sRGB in combine pass
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x2a1c33, 0.016);

  const camera = new THREE.PerspectiveCamera(42, 1, 1, 140);
  camera.position.copy(CAM_POS); camera.lookAt(CAM_LOOK);

  // --- lights: dusk hemisphere + low warm sun + teal core light ---
  const hemi = new THREE.HemisphereLight(0xffb98a, 0x241a38, 0.75); scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xffa25c, 1.5); sun.position.set(-14, 9, 6); scene.add(sun);
  const coreLight = new THREE.PointLight(0x6fe8d8, 2.2, 16, 1.8); coreLight.position.set(-5.5, 1.6, 0); scene.add(coreLight);

  // --- sky dome: dusk gradient + stars + mountain silhouette ---
  {
    const [c, g] = cv(16, 256);
    const gr = g.createLinearGradient(0, 0, 0, 256);
    gr.addColorStop(0, '#0d0b1e'); gr.addColorStop(.45, '#2b1a3e'); gr.addColorStop(.72, '#7c3a52'); gr.addColorStop(.88, '#e08a5a'); gr.addColorStop(1, '#f2b47c');
    g.fillStyle = gr; g.fillRect(0, 0, 16, 256);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
    const sky = new THREE.Mesh(new THREE.SphereGeometry(60, 24, 16), new THREE.MeshBasicMaterial({ map: t, side: THREE.BackSide, fog: false, depthWrite: false }));
    scene.add(sky);
    const R = rngSeed(11), pos = [];
    for (let i = 0; i < 220; i++) {
      const a = R() * Math.PI * 2, e = Math.asin(R()), r = 55;
      pos.push(Math.cos(a) * Math.cos(e) * r, Math.sin(e) * r + 4, Math.sin(a) * Math.cos(e) * r);
    }
    const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    scene.add(new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xcfd8ff, size: .16, sizeAttenuation: true, fog: false, transparent: true, opacity: .8 })));
    const mountM = new THREE.MeshBasicMaterial({ color: 0x191426, fog: false });
    for (let i = 0; i < 16; i++) {
      const a = i / 16 * Math.PI * 2 + R() * .2, r = 30 + R() * 6, h = 4 + R() * 6;
      const m = new THREE.Mesh(new THREE.ConeGeometry(4 + R() * 4, h, 5), mountM);
      m.position.set(Math.cos(a) * r, h / 2 - .5, Math.sin(a) * r); m.rotation.y = R() * 3;
      scene.add(m);
    }
  }
  function cv(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')]; }

  // --- ground ---
  {
    const gt = groundTex();
    const ground = new THREE.Mesh(new THREE.CircleGeometry(34, 40), new THREE.MeshStandardMaterial({ map: gt, roughness: .95 }));
    ground.rotation.x = -Math.PI / 2; scene.add(ground);
  }

  // --- star-road: CatmullRom curve + ribbon mesh ---
  const PTS = [[10.5, -9.5], [7.5, -7.5], [7.0, -2.5], [3.0, -0.5], [3.0, 4.0], [-1.0, 6.5], [-5.0, 6.0], [-6.5, 2.0], [-5.5, 0.0]]
    .map(p => new THREE.Vector3(p[0], 0, p[1]));
  const curve = new THREE.CatmullRomCurve3(PTS, false, 'catmullrom', .35);
  {
    const N = 160, W = 1.15, pos = [], uv = [], idx = [];
    for (let i = 0; i <= N; i++) {
      const t = i / N, p = curve.getPointAt(t), tg = curve.getTangentAt(t);
      const nx = -tg.z, nz = tg.x;
      pos.push(p.x + nx * W, .02, p.z + nz * W, p.x - nx * W, .02, p.z - nz * W);
      uv.push(0, t * 22, 1, t * 22);
      if (i < N) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    geo.setIndex(idx); geo.computeVertexNormals();
    const road = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: pathTex(), roughness: .8, emissive: 0x2f7a7e, emissiveIntensity: 1.25 }));
    scene.add(road);
  }

  // --- scattered obsidian away from the road ---
  {
    const R = rngSeed(31), rockM = matStd(0x241f33, { rough: .9 });
    const shardM = matStd(0x2c2547, { emissive: 0x3a2a6a, ei: .5, rough: .6 });
    let tries = 0;
    for (let i = 0; i < 40 && tries < 300; ) {
      tries++;
      const x = (R() - .5) * 26, z = (R() - .5) * 26;
      if (Math.hypot(x, z) > 15) continue;
      let near = 0;
      for (let s = 0; s <= 40; s++) { const p = curve.getPointAt(s / 40); if (Math.hypot(p.x - x, p.z - z) < 3.4) { near = 1; break; } }
      if (near) continue;
      const s2 = .3 + R() * .8;
      const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(s2, 0), R() < .3 ? shardM : rockM);
      rock.position.set(x, s2 * .55, z); rock.rotation.set(R() * 3, R() * 3, R() * 3);
      scene.add(rock); i++;
    }
  }

  // --- build pads: hex platforms beside the road ---
  const pads = [];
  const padSpec = [[.055, 1], [.115, -1], [.175, 1], [.245, -1], [.315, 1], [.385, -1], [.455, 1], [.525, -1], [.595, 1], [.665, -1], [.735, 1], [.86, -1]];
  const hexGeo = new THREE.CylinderGeometry(1.15, 1.3, .5, 6);
  const glowT = glowTex();
  for (const [t, side] of padSpec) {
    const p = curve.getPointAt(t), tg = curve.getTangentAt(t);
    const nx = -tg.z * side, nz = tg.x * side;
    const pos = new THREE.Vector3(p.x + nx * 2.3, .25, p.z + nz * 2.3);
    const mesh = new THREE.Mesh(hexGeo, matStd(0x2e2946, { rough: .7, emissive: 0x3d3358, ei: .25 }));
    mesh.position.copy(pos); mesh.rotation.y = Math.PI / 6;
    scene.add(mesh);
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowT, color: 0x6fe8d8, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
    glow.scale.set(3, 3, 1); glow.position.set(pos.x, .1, pos.z); scene.add(glow);
    pads.push({ mesh, pos, tower: null, glow, t, side });
  }

  // --- star core: faceted crystal + orbit shards + ground halo ---
  const core = new THREE.Group();
  {
    const crystal = new THREE.Mesh(new THREE.IcosahedronGeometry(.95, 0), matStd(0x9ff2e4, { emissive: 0x35c9b8, ei: 1.4, rough: .25, metal: .1 }));
    crystal.name = 'crystal'; core.add(crystal);
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowT, color: 0x6fe8d8, transparent: true, opacity: .5, depthWrite: false, blending: THREE.AdditiveBlending }));
    halo.scale.set(5, 5, 1); halo.position.y = .2; core.add(halo);
    const shards = new THREE.Group(); shards.name = 'shards';
    for (let i = 0; i < 6; i++) {
      const s = new THREE.Mesh(new THREE.OctahedronGeometry(.14, 0), matStd(0xbff5ea, { emissive: 0x49d6c4, ei: 1.2, rough: .3 }));
      s.position.set(Math.cos(i / 6 * Math.PI * 2) * 1.7, .2 + (i % 3) * .25, Math.sin(i / 6 * Math.PI * 2) * 1.7);
      shards.add(s);
    }
    core.add(shards);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1.55, .05, 8, 40), new THREE.MeshBasicMaterial({ color: 0x54d8c8, transparent: true, opacity: .55 }));
    ring.rotation.x = Math.PI / 2.4; ring.name = 'ring'; core.add(ring);
    core.position.set(-5.5, 1.35, 0); scene.add(core);
    const base = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.8, .55, 6), matStd(0x332c50, { emissive: 0x1d4a4d, ei: .5 }));
    base.position.set(-5.5, .27, 0); scene.add(base);
  }

  // --- void portal at the road head ---
  const portal = new THREE.Group();
  {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1.35, .16, 10, 32), matStd(0x4a2a6e, { emissive: 0x8a4adf, ei: 1.1, rough: .4 }));
    ring.position.y = 1.5; ring.rotation.y = Math.PI / 2; portal.add(ring);
    const disc = new THREE.Mesh(new THREE.CircleGeometry(1.2, 24), new THREE.MeshBasicMaterial({ color: 0x1b0e33, transparent: true, opacity: .85, side: THREE.DoubleSide }));
    disc.position.y = 1.5; disc.rotation.y = Math.PI / 2; disc.name = 'disc'; portal.add(disc);
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowT, color: 0x9a5af0, transparent: true, opacity: .4, depthWrite: false, blending: THREE.AdditiveBlending }));
    glow.scale.set(6, 6, 1); glow.position.y = 1.5; portal.add(glow);
    portal.position.set(10.5, 0, -9.5); scene.add(portal);
  }

  // --- ember particles ---
  let embers;
  {
    const R = rngSeed(53), N = 130, pos = [], spd = [];
    for (let i = 0; i < N; i++) { pos.push((R() - .5) * 30, R() * 7, (R() - .5) * 30); spd.push(.25 + R() * .55); }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    embers = new THREE.Points(geo, new THREE.PointsMaterial({ color: 0xffb070, size: .07, map: glowT, transparent: true, opacity: .75, depthWrite: false, blending: THREE.AdditiveBlending }));
    embers.userData.spd = spd; scene.add(embers);
  }

  // --- bloom: two-pass bright extract + separable blur + combine (manual sRGB) ---
  const BMP = `varying vec2 vUv; void main(){ vUv=uv; gl_Position=vec4(position.xy,0.,1.); }`;
  const rtScene = new THREE.WebGLRenderTarget(2, 2, { type: THREE.HalfFloatType });
  const rtA = new THREE.WebGLRenderTarget(2, 2, { type: THREE.HalfFloatType });
  const rtB = new THREE.WebGLRenderTarget(2, 2, { type: THREE.HalfFloatType });
  const brightM = new THREE.ShaderMaterial({
    uniforms: { tex: { value: rtScene.texture }, thr: { value: .58 } },
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
    uniforms: { scene: { value: rtScene.texture }, bloom: { value: rtB.texture }, str: { value: .85 } },
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

  const raycaster = new THREE.Raycaster();
  function raycast(ndc, objs) {
    raycaster.setFromCamera(ndc, camera);
    return raycaster.intersectObjects(objs, true)[0] || null;
  }

  let time = 0;
  function update(dt) {
    time += dt;
    core.getObjectByName('crystal').rotation.y += dt * .7; core.getObjectByName('crystal').rotation.x += dt * .22;
    const shards = core.getObjectByName('shards');
    shards.rotation.y -= dt * 1.1;
    shards.children.forEach((s, i) => { s.position.y = .2 + Math.sin(time * 1.6 + i * 1.3) * .18; });
    core.getObjectByName('ring').rotation.z += dt * .5;
    core.position.y = 1.35 + Math.sin(time * 1.2) * .07;
    const disc = portal.getObjectByName('disc');
    disc.rotation.z += dt * 2.2;
    portal.children[2].material.opacity = .34 + Math.sin(time * 2.1) * .1;
    const p = embers.geometry.attributes.position, spd = embers.userData.spd;
    for (let i = 0; i < spd.length; i++) {
      let y = p.getY(i) + spd[i] * dt;
      if (y > 7.5) y = 0;
      p.setY(i, y); p.setX(i, p.getX(i) + Math.sin(time + i) * dt * .12);
    }
    p.needsUpdate = true;
    // idle camera sway
    camera.position.set(CAM_POS.x + Math.sin(time * .22) * .35, CAM_POS.y, CAM_POS.z + Math.cos(time * .18) * .3);
    camera.lookAt(CAM_LOOK);
  }

  function setCoreFrac(f) {
    const c = core.getObjectByName('crystal');
    c.material.emissiveIntensity = .25 + f * 1.3;
    coreLight.intensity = .6 + f * 1.8;
    core.getObjectByName('ring').material.opacity = .2 + f * .4;
  }

  function padPulse(i, on, color = 0x6fe8d8) {
    const g = pads[i].glow;
    g.material.color.set(color); g.material.opacity = on ? .5 + Math.sin(time * 4) * .15 : 0;
  }

  function render() {
    renderer.setRenderTarget(rtScene); renderer.render(scene, camera);
    quad.material = brightM; renderer.setRenderTarget(rtA); renderer.render(quadScene, quadCam);
    for (let i = 0; i < 2; i++) {
      blurM.uniforms.tex.value = rtA.texture; blurM.uniforms.dir.value.set(1, 0);
      quad.material = blurM; renderer.setRenderTarget(rtB); renderer.render(quadScene, quadCam);
      blurM.uniforms.tex.value = rtB.texture; blurM.uniforms.dir.value.set(0, 1);
      quad.material = blurM; renderer.setRenderTarget(rtA); renderer.render(quadScene, quadCam);
    }
    combineM.uniforms.bloom.value = rtA.texture;
    quad.material = combineM; renderer.setRenderTarget(null); renderer.render(quadScene, quadCam);
  }

  return { renderer, scene, camera, curve, pads, core, portal, update, render, raycast, setCoreFrac, padPulse, get time() { return time; } };
}
