// World: dream board for the pearl cascade — back panel, side walls, peg/ball
// bucket 3D primitives, bloom (replicated verified pipeline), fixed camera.
import * as THREE from '../vendor/three.module.min.js';

export const BW = 40, BH = 30;             // board logical size (x: -20..20, y: 0..30)

export function makeWorld() {
  const renderer = new THREE.WebGLRenderer({ canvas: document.getElementById('gl'), antialias: true });
  renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x150f2e);
  scene.fog = new THREE.Fog(0x150f2e, 60, 160);

  const camera = new THREE.PerspectiveCamera(50, innerWidth / innerHeight, .1, 300);
  camera.position.set(0, 13.2, 41);
  camera.lookAt(0, 13, 0);

  scene.add(new THREE.HemisphereLight(0xb8aaff, 0x241a48, 1));
  const dir = new THREE.DirectionalLight(0xfff0d8, 1.1); dir.position.set(10, 24, 26); scene.add(dir);

  const matStd = (color, { emissive = 0x000000, ei = 0, rough = .8, metal = .1 } = {}) =>
    new THREE.MeshStandardMaterial({ color, emissive, emissiveIntensity: ei, roughness: rough, metalness: metal });

  // back panel with dreamy gradient (vertex-colored plane)
  {
    const g = new THREE.PlaneGeometry(BW + 4, BH + 3, 1, 6);
    const colors = [];
    const top = new THREE.Color(0x241a54), bot = new THREE.Color(0x0e0a24);
    const pos = g.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const t = (pos.getY(i) + (BH + 3) / 2) / (BH + 3);
      const c = bot.clone().lerp(top, t);
      colors.push(c.r, c.g, c.b);
    }
    g.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    const panel = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .9 }));
    panel.position.set(0, BH / 2, -1.2);
    scene.add(panel);
    // star sprinkle on panel
    const n = 130, sp = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      sp[i * 3] = (Math.random() * 2 - 1) * (BW / 2 + 1);
      sp[i * 3 + 1] = Math.random() * (BH + 2);
      sp[i * 3 + 2] = -1.05;
    }
    const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(sp, 3));
    scene.add(new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xb8a8ff, size: .18, transparent: true, opacity: .7 })));
  }

  // side walls
  {
    const wl = new THREE.Mesh(new THREE.BoxGeometry(1.2, BH + 3, 2.2), matStd(0x3a2a78, { emissive: 0x2a1a60, ei: .5, rough: .5 }));
    wl.position.set(-BW / 2 - .6, BH / 2, 0);
    const wr = wl.clone(); wr.position.x = BW / 2 + .6;
    scene.add(wl, wr);
    // floor lip
    const lip = new THREE.Mesh(new THREE.BoxGeometry(BW + 3, 1.4, 2.4), matStd(0x3a2a78, { rough: .6 }));
    lip.position.set(0, -0.8, 0);
    scene.add(lip);
  }

  // --- bloom (verified pipeline, adaptive quality) ---
  const BMP = `varying vec2 vUv; void main(){ vUv=uv; gl_Position=vec4(position.xy,0.,1.); }`;
  const rtScene = new THREE.WebGLRenderTarget(2, 2, { type: THREE.HalfFloatType });
  const rtA = new THREE.WebGLRenderTarget(2, 2, { type: THREE.HalfFloatType });
  const rtB = new THREE.WebGLRenderTarget(2, 2, { type: THREE.HalfFloatType });
  const brightM = new THREE.ShaderMaterial({
    uniforms: { tex: { value: rtScene.texture }, thr: { value: .55 } },
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
    uniforms: { scene: { value: rtScene.texture }, bloom: { value: rtB.texture }, str: { value: .65 } },
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

  let shakeT = 0;
  function shake(a = .3, t = .25) { shakeT = Math.max(shakeT, t); }
  function updateCam(dt) {
    shakeT = Math.max(0, shakeT - dt);
    const sh = shakeT > 0 ? .5 * shakeT : 0;
    camera.position.set((Math.random() * 2 - 1) * sh, 13.2 + (Math.random() * 2 - 1) * sh, 41);
    camera.lookAt(0, 13, 0);
  }

  return { renderer, scene, camera, matStd, render, updateCam, shake, BW, BH };
}
