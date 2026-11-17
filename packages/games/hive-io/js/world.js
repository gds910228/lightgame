// World: circular flower-field arena (R=120) with thorn hedge boundary,
// flower patches (nectar-rich, thorn hazards), bloom pipeline (replicated
// from verified starfall-bulwark implementation), follow camera.
import * as THREE from '../vendor/three.module.min.js';

export const ARENA_R = 120;
export const FLOWERS = [];   // {x,z,r} patches (exported for AI/tests)

export function makeWorld() {
  const renderer = new THREE.WebGLRenderer({ canvas: document.getElementById('gl'), antialias: true });
  renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x143020);
  scene.fog = new THREE.Fog(0x143020, 60, 210);

  const camera = new THREE.PerspectiveCamera(55, innerWidth / innerHeight, .1, 400);

  scene.add(new THREE.HemisphereLight(0xd8ffd0, 0x2a4020, .95));
  const sun = new THREE.DirectionalLight(0xfff2c8, 1.15); sun.position.set(30, 60, 20); scene.add(sun);

  const matStd = (color, { emissive = 0x000000, ei = 0, rough = .85, metal = .05 } = {}) =>
    new THREE.MeshStandardMaterial({ color, emissive, emissiveIntensity: ei, roughness: rough, metalness: metal });

  // --- ground: big circle + subtle checker via two tones ---
  {
    const g = new THREE.CircleGeometry(ARENA_R + 6, 72);
    const ground = new THREE.Mesh(g, matStd(0x2e6e3c, { rough: .95 }));
    ground.rotation.x = -Math.PI / 2; ground.position.y = 0;
    scene.add(ground);
    const outer = new THREE.Mesh(new THREE.CircleGeometry(ARENA_R + 60, 72), matStd(0x1c4228, { rough: 1 }));
    outer.rotation.x = -Math.PI / 2; outer.position.y = -.1;
    scene.add(outer);
  }

  // --- boundary: thorn hedge ring (torus + spikes) ---
  {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(ARENA_R, 2.2, 8, 90), matStd(0x1e3a20, { rough: .9 }));
    ring.rotation.x = -Math.PI / 2; ring.position.y = 1.4;
    scene.add(ring);
    const glow = new THREE.Mesh(new THREE.TorusGeometry(ARENA_R, .5, 6, 90), matStd(0x8ad84a, { emissive: 0x6ac23a, ei: 1.2 }));
    glow.rotation.x = -Math.PI / 2; glow.position.y = 2.8;
    scene.add(glow);
  }

  // --- flower patches: nectar-rich zones with thorn hazards ---
  const thorns = [];
  {
    const petalGeo = new THREE.CircleGeometry(1, 6);
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2 + Math.random() * .4;
      const rr = 28 + Math.random() * 74;
      const x = Math.cos(a) * rr, z = Math.sin(a) * rr;
      const r = 9 + Math.random() * 6;
      FLOWERS.push({ x, z, r });
      // visual petals ring
      for (let p = 0; p < 8; p++) {
        const pa = (p / 8) * Math.PI * 2;
        const petal = new THREE.Mesh(petalGeo, matStd(i % 2 ? 0xffd166 : 0xff8ab0, { emissive: i % 2 ? 0xd9a018 : 0xd85a88, ei: .5 }));
        petal.rotation.x = -Math.PI / 2;
        petal.position.set(x + Math.cos(pa) * r * .82, .06, z + Math.sin(pa) * r * .82);
        petal.scale.setScalar(r * .16);
        scene.add(petal);
      }
      const core = new THREE.Mesh(new THREE.CircleGeometry(r * .3, 20), matStd(0xfff0b8, { emissive: 0xd9c868, ei: .6 }));
      core.rotation.x = -Math.PI / 2; core.position.set(x, .07, z);
      scene.add(core);
      // thorn hazards inside patch (2-3)
      const n = 2 + Math.floor(Math.random() * 2);
      for (let t = 0; t < n; t++) {
        const ta = Math.random() * Math.PI * 2, tr = Math.random() * r * .7;
        const tx = x + Math.cos(ta) * tr, tz = z + Math.sin(ta) * tr;
        thorns.push({ x: tx, z: tz, r: 2.2 });
        const cone = new THREE.Mesh(new THREE.ConeGeometry(1.6, 2.6, 7), matStd(0x4a6830, { emissive: 0x385018, ei: .4 }));
        cone.position.set(tx, 1.2, tz);
        scene.add(cone);
        const warn = new THREE.Mesh(new THREE.CircleGeometry(2.2, 16), new THREE.MeshBasicMaterial({ color: 0xff5050, transparent: true, opacity: .22 }));
        warn.rotation.x = -Math.PI / 2; warn.position.set(tx, .08, tz);
        scene.add(warn);
      }
    }
  }

  // --- decorative hives ---
  {
    const hive = new THREE.Mesh(new THREE.SphereGeometry(6, 10, 8), matStd(0xd8a838, { rough: .6 }));
    hive.position.set(0, 3, -ARENA_R * .55); hive.scale.y = 1.25;
    scene.add(hive);
    const hive2 = hive.clone(); hive2.position.set(ARENA_R * .55, 3, ARENA_R * .3); hive2.scale.setScalar(.8);
    scene.add(hive2);
  }

  // --- bloom (verified two-pass pipeline) ---
  const BMP = `varying vec2 vUv; void main(){ vUv=uv; gl_Position=vec4(position.xy,0.,1.); }`;
  const rtScene = new THREE.WebGLRenderTarget(2, 2, { type: THREE.HalfFloatType });
  const rtA = new THREE.WebGLRenderTarget(2, 2, { type: THREE.HalfFloatType });
  const rtB = new THREE.WebGLRenderTarget(2, 2, { type: THREE.HalfFloatType });
  const brightM = new THREE.ShaderMaterial({
    uniforms: { tex: { value: rtScene.texture }, thr: { value: .62 } },
    vertexShader: BMP,
    fragmentShader: `uniform sampler2D tex; uniform float thr; varying vec2 vUv;
      void main(){ vec3 c=texture2D(tex,vUv).rgb; float l=dot(c,vec3(.299,.587,.114));
        gl_FragColor=vec4(c*smoothstep(thr,thr+.3,l),1.); }`, depthTest: false, depthWrite: false
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
    uniforms: { scene: { value: rtScene.texture }, bloom: { value: rtB.texture }, str: { value: .55 } },
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

  let shakeT = 0, shakeAmp = 0;
  function shake(a = .4, t = .3) { shakeAmp = Math.max(shakeAmp, a); shakeT = Math.max(shakeT, t); }

  function follow(px, pz, angle) {
    const sh = shakeT > 0 ? shakeAmp * shakeT : 0;
    shakeT = Math.max(0, shakeT - 1 / 60);
    const camDist = 15, camH = 13.5;
    const cx = px - Math.cos(angle) * camDist + (Math.random() * 2 - 1) * sh;
    const cz = pz - Math.sin(angle) * camDist + (Math.random() * 2 - 1) * sh;
    camera.position.set(cx, camH + sh * .6, cz);
    camera.lookAt(px + Math.cos(angle) * 5, 0, pz + Math.sin(angle) * 5);
  }

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

  return { renderer, scene, camera, matStd, follow, shake, render, thorns, FLOWERS, ARENA_R };
}
