// Blossom Bay: the first world. Builds the scenery (sky, sea, island, village,
// lighthouse, waterfall cave, floating Sky Steps, boss cove) and its collision.
import * as THREE from "../vendor/three.module.min.js";
import { PAL, toon, basic, mesh, textSprite, SAT_GLSL, mergeStatic } from "./fx.js?v=11";
import { Level } from "./physics.js?v=11";

const V = (x, y, z) => new THREE.Vector3(x, y, z);

// ---------------- shared scenery shaders ----------------
function skyDome() {
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { top: { value: new THREE.Color(0x9ed8ee) }, mid: { value: new THREE.Color(0xd4f0ea) }, hor: { value: new THREE.Color(0xffd3b6) }, sun: { value: new THREE.Vector3(0.4, 0.35, -0.85).normalize() } },
    vertexShader: `varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: `uniform vec3 top, mid, hor, sun; varying vec3 vP;
      void main(){ float h = vP.y; vec3 c = mix(hor, mid, smoothstep(-0.02, 0.18, h)); c = mix(c, top, smoothstep(0.18, 0.7, h));
        float s = max(0.0, dot(vP, sun)); c += vec3(1.0,0.95,0.85) * (pow(s, 400.0) * 1.2 + pow(s, 12.0) * 0.18);
        if (h < 0.0) c = mix(hor, vec3(0.99,0.72,0.70), smoothstep(0.0, -0.3, h));
        gl_FragColor = vec4(c, 1.0); ${SAT_GLSL} }`,
  });
  const m = new THREE.Mesh(new THREE.SphereGeometry(900, 32, 16), mat);
  m.renderOrder = -10;
  return m;
}

function seaMaterial() {
  return new THREE.ShaderMaterial({
    transparent: true, fog: true,
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uT: { value: 0 }, shallow: { value: new THREE.Color(0x9ff0dc) }, deep: { value: new THREE.Color(0x4fc4c0) }, foam: { value: new THREE.Color(0xffffff) } }]),
    vertexShader: `uniform float uT; varying vec3 vW; varying float vH;
      #include <fog_pars_vertex>
      void main(){ vec3 p = position; vec4 w = modelMatrix * vec4(p,1.0);
        float h = sin(w.x*0.18 + uT*1.3)*0.18 + cos(w.z*0.21 + uT*1.1)*0.16 + sin((w.x+w.z)*0.5 + uT*2.3)*0.05;
        w.y += h; vH = h; vW = w.xyz; vec4 mvPosition = viewMatrix * w; gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: `uniform float uT; uniform vec3 shallow, deep, foam; varying vec3 vW; varying float vH;
      #include <fog_pars_fragment>
      float hash(vec2 p){ return fract(sin(dot(p, vec2(41.3, 289.1))) * 45758.5); }
      void main(){ float d = length(vW.xz);
        float shore = smoothstep(60.0, 44.0, d) ;
        vec3 c = mix(deep, shallow, shore);
        float band = smoothstep(0.92, 1.0, sin(d*1.4 - uT*2.2)*0.5+0.5) * smoothstep(54.0, 46.5, d);
        c = mix(c, foam, band*0.55 + smoothstep(47.5, 46.2, d)*0.6);
        vec2 g = floor(vW.xz*1.5); float sp = step(0.985, hash(g + floor(uT*2.0))) * smoothstep(0.1, 0.25, vH);
        c += sp * 0.5;
        c += vH * 0.25;
        gl_FragColor = vec4(c, 0.93);
        #include <fog_fragment>
        ${SAT_GLSL}
      }`,
  });
}

function waterfallMaterial() {
  const c = document.createElement("canvas"); c.width = 64; c.height = 256;
  const x = c.getContext("2d");
  x.fillStyle = "#c8f5ec"; x.fillRect(0, 0, 64, 256);
  for (let i = 0; i < 90; i++) { x.fillStyle = `rgba(255,255,255,${0.3 + Math.random() * 0.6})`; x.fillRect(Math.random() * 64, Math.random() * 256, 2 + Math.random() * 4, 14 + Math.random() * 40); }
  const tex = new THREE.CanvasTexture(c); tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.colorSpace = THREE.SRGBColorSpace;
  return new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0.85, side: THREE.DoubleSide, depthWrite: false });
}

// ---------------- props ----------------
function palm(h = 6, lean = 0.2) {
  const g = new THREE.Group();
  const trunkM = toon(PAL.wood), leafM = toon(PAL.leaf), leafM2 = toon(PAL.leafDark), cocoM = toon(0x9a6a4a);
  const segs = 6;
  for (let i = 0; i < segs; i++) {
    const k = i / segs, s = mesh(new THREE.CylinderGeometry(0.22 - k * 0.07, 0.26 - k * 0.07, h / segs + 0.05, 8), trunkM, Math.sin(k * 1.4) * lean * h * 0.3, (i + 0.5) * h / segs, 0);
    s.rotation.z = -lean * 0.4 * k; g.add(s);
  }
  const top = V(Math.sin(1.4) * lean * h * 0.3, h, 0);
  const leafGeo = new THREE.SphereGeometry(1, 10, 6); leafGeo.scale(1.6, 0.12, 0.55); leafGeo.translate(1.4, 0, 0);
  for (let i = 0; i < 7; i++) {
    const l = mesh(leafGeo, i % 2 ? leafM : leafM2, top.x, top.y, top.z);
    l.rotation.y = (i / 7) * Math.PI * 2; l.rotation.z = -0.35 - (i % 2) * 0.15; g.add(l);
  }
  for (let i = 0; i < 3; i++) { const c = mesh(new THREE.SphereGeometry(0.22, 8, 6), cocoM, top.x + Math.cos(i * 2.1) * 0.3, top.y - 0.25, top.z + Math.sin(i * 2.1) * 0.3); g.add(c); }
  g.userData.sway = Math.random() * 6;
  g.userData.dynamic = true;
  return g;
}

function house(wall, roof, w = 5, d = 5, h = 3.5) {
  const g = new THREE.Group();
  g.add(mesh(new THREE.BoxGeometry(w, h, d), toon(wall), 0, h / 2, 0));
  const r = mesh(new THREE.ConeGeometry(Math.max(w, d) * 0.78, h * 0.75, 4), toon(roof), 0, h + h * 0.37, 0);
  r.rotation.y = Math.PI / 4; r.scale.z = d / w; g.add(r);
  const door = mesh(new THREE.BoxGeometry(1.1, 1.9, 0.12), toon(PAL.woodDark), 0, 0.95, d / 2 + 0.03); g.add(door);
  const knob = mesh(new THREE.SphereGeometry(0.07, 6, 6), toon(PAL.gold), 0.35, 0.95, d / 2 + 0.1); g.add(knob);
  for (const sx of [-1, 1]) {
    const win = mesh(new THREE.BoxGeometry(0.9, 0.9, 0.1), basic(0xfff6c9), sx * w * 0.3, h * 0.62, d / 2 + 0.03, false); g.add(win);
    const fr = mesh(new THREE.BoxGeometry(1.05, 0.12, 0.14), toon(PAL.white), sx * w * 0.3, h * 0.62 - 0.5, d / 2 + 0.05); g.add(fr);
    const box = mesh(new THREE.BoxGeometry(1.0, 0.28, 0.35), toon(PAL.woodDark), sx * w * 0.3, h * 0.62 - 0.62, d / 2 + 0.2); g.add(box);
    for (let f = 0; f < 3; f++) g.add(mesh(new THREE.SphereGeometry(0.13, 6, 5), toon([PAL.pink, PAL.peach, PAL.coral][f]), sx * w * 0.3 - 0.3 + f * 0.3, h * 0.62 - 0.42, d / 2 + 0.22));
  }
  const ch = mesh(new THREE.BoxGeometry(0.6, 1.4, 0.6), toon(PAL.stone), w * 0.25, h + h * 0.55, -d * 0.15); g.add(ch);
  g.userData.chimney = V(w * 0.25, h + h * 0.55 + 0.8, -d * 0.15);
  return g;
}

function rock(s = 1, color = PAL.stone) {
  const geo = new THREE.DodecahedronGeometry(s, 0);
  const m = mesh(geo, toon(color));
  m.scale.set(1, 0.7 + Math.random() * 0.3, 1); m.rotation.set(Math.random(), Math.random() * 6, Math.random() * 0.3);
  return m;
}

function cloud(s = 1) {
  const g = new THREE.Group(), m = toon(0xffffff);
  const n = 5 + ((Math.random() * 3) | 0);
  for (let i = 0; i < n; i++) {
    const r = (1.2 + Math.random() * 1.4) * s;
    const b = mesh(new THREE.SphereGeometry(r, 12, 8), m, (i - n / 2) * 1.5 * s, Math.random() * s, (Math.random() - 0.5) * 2 * s, false, false);
    b.scale.y = 0.7; g.add(b);
  }
  return g;
}

// ---------------------------------------------------------------------------
export function buildBlossomBay(scene) {
  const level = new Level();
  const root = new THREE.Group(); scene.add(root);
  const anim = []; // things that move every frame
  const W = { level, root, anim, waterY: 0, killY: -20, name: "Blossom Bay", id: "blossom" };

  scene.background = new THREE.Color(0xffd3b6);
  scene.fog = new THREE.Fog(0xffe2cf, 70, 330);
  const sky = skyDome(); root.add(sky); W.sky = sky;

  // sea
  const seaGeo = new THREE.PlaneGeometry(700, 700, 120, 120); seaGeo.rotateX(-Math.PI / 2);
  const seaMat = seaMaterial();
  const sea = new THREE.Mesh(seaGeo, seaMat); sea.position.y = -0.05; sea.receiveShadow = false; root.add(sea);
  anim.push((t) => { seaMat.uniforms.uT.value = t; });
  // sandy sea floor glow under shallow water
  const floor = mesh(new THREE.CircleGeometry(62, 48), toon(0xf7c9ad), 0, -1.6, 0, false, false); floor.rotation.x = -Math.PI / 2; root.add(floor);

  // ---- main island ----
  const sandM = toon(PAL.peach), grassM = toon(PAL.mint), grass2 = toon(PAL.lime);
  const beach = mesh(new THREE.CylinderGeometry(46, 48, 4, 72), sandM, 0, 0.45 - 2, 0); root.add(beach);
  level.addCyl(0, 0, 46, -3.55, 0.45, { name: "beach" });
  const rim = mesh(new THREE.CylinderGeometry(40, 41.5, 4, 72), toon(0xc8eeb6), 0, 0.72 - 2, 0); root.add(rim);
  level.addCyl(0, 0, 40, -3.3, 0.72);
  const grass = mesh(new THREE.CylinderGeometry(38, 39.5, 4, 72), grassM, 0, 1 - 2, 0); root.add(grass);
  level.addCyl(0, 0, 38, -3, 1.0);
  // lime meadow patches
  for (const [x, z, r] of [[-14, 14, 7], [16, 18, 6], [-6, -20, 8], [14, -24, 5], [-20, -2, 5]]) {
    const p = mesh(new THREE.CircleGeometry(r, 24), grass2, x, 1.01, z, false, true); p.rotation.x = -Math.PI / 2; root.add(p);
  }
  // sandy path from home to plaza to the north dock
  const pathM = toon(0xffe4cc);
  for (let i = 0; i < 30; i++) {
    const z = 26 - i * 2.1, x = Math.sin(i * 0.35) * 1.5;
    const s = mesh(new THREE.CircleGeometry(1.25 + Math.sin(i) * 0.2, 12), pathM, x, 1.015, z, false, true); s.rotation.x = -Math.PI / 2; root.add(s);
  }

  // ---- props helper with collision ----
  const solidBox = (x, y, z, sx, sy, sz, color, o = {}) => {
    const m = mesh(new THREE.BoxGeometry(sx, sy, sz), toon(color), x, y, z); root.add(m);
    const s = level.addBox(x, y, z, sx, sy, sz, { mesh: m, ...o });
    return s;
  };
  const solidCyl = (x, z, r, y0, y1, color, o = {}) => {
    const m = mesh(new THREE.CylinderGeometry(r, r * (o.taper || 1), y1 - y0, o.seg || 24), toon(color), x, (y0 + y1) / 2, z); root.add(m);
    return level.addCyl(x, z, r, y0, y1, { mesh: m, ...o });
  };
  W.solidBox = solidBox; W.solidCyl = solidCyl;

  // ---- Fuse's home ----
  const home = house(PAL.lime, PAL.pink, 6, 5, 3.6); home.position.set(-7, 1, 26); root.add(home);
  level.addBox(-7, 1 + 1.8, 26, 6, 3.6, 5); level.addBox(-7, 1 + 3.6 + 0.6, 26, 4.4, 1.2, 3.6);
  const sign = textSprite("Fuse's House", { bg: "#fff3e6", color: "#ff8b94", height: 0.6 }); sign.position.set(-7, 6.3, 28.8); root.add(sign);
  // hammock between two palms
  const p1 = palm(5, 0.1); p1.position.set(1, 1, 30); root.add(p1); level.addCyl(1, 30, 0.35, 1, 6);
  const p2 = palm(5.2, -0.1); p2.position.set(6, 1, 31); p2.rotation.y = Math.PI; root.add(p2); level.addCyl(6, 31, 0.35, 1, 6);
  const ham = mesh(new THREE.CylinderGeometry(0.6, 0.6, 4.6, 12, 1, true, 0, Math.PI), toon(PAL.coral, { params: { side: THREE.DoubleSide } }), 3.5, 2.2, 30.5);
  ham.rotation.set(0, 0.2, Math.PI / 2); ham.rotation.order = "YXZ"; root.add(ham); W.hammock = V(3.5, 2.05, 30.5);
  // mailbox + fence
  const mb = mesh(new THREE.BoxGeometry(0.5, 0.45, 0.7), toon(PAL.pink), -2.8, 2.1, 28.5); root.add(mb);
  root.add(mesh(new THREE.CylinderGeometry(0.06, 0.06, 1.1, 6), toon(PAL.wood), -2.8, 1.55, 28.5));
  for (let i = 0; i < 9; i++) { const f = mesh(new THREE.BoxGeometry(0.16, 0.9, 0.16), toon(PAL.white), -11.5 + i * 1.1, 1.45, 30.5); root.add(f); }
  root.add(mesh(new THREE.BoxGeometry(9.5, 0.12, 0.1), toon(PAL.white), -7.1, 1.75, 30.5));
  level.addBox(-7.1, 1.45, 30.5, 9.6, 0.9, 0.3);

  // ---- tutorial crates near home ----
  const crateM = PAL.wood;
  solidBox(5, 1.6, 20, 1.2, 1.2, 1.2, crateM);
  solidBox(7.2, 2.2, 17.6, 1.6, 2.4, 1.6, crateM);
  solidBox(9.6, 3.0, 15.0, 1.6, 4.0, 1.6, 0xc9906b);
  // wall jump practice walls near home
  solidBox(-13, 4, 18, 1, 6, 4, PAL.stone, { name: "wjA" });
  solidBox(-15.6, 4, 18, 1, 6, 4, PAL.stone, { name: "wjB" });
  solidBox(-14.3, 7.2, 18, 3.6, 0.4, 4, PAL.coral);

  // ---- village plaza ----
  const plaza = mesh(new THREE.CylinderGeometry(9, 9, 0.1, 40), toon(0xfff0e0), 0, 1.04, 6, false, true); root.add(plaza);
  for (let i = 0; i < 16; i++) { const a = (i / 16) * Math.PI * 2, t = mesh(new THREE.BoxGeometry(1.6, 0.06, 0.6), toon(i % 2 ? PAL.coral : PAL.mint), Math.cos(a) * 8.4, 1.1, 6 + Math.sin(a) * 8.4, false); t.rotation.y = -a; root.add(t); }
  solidCyl(0, 6, 3, 1, 1.8, PAL.stone, { seg: 32 });
  const fw = mesh(new THREE.CylinderGeometry(2.7, 2.7, 0.1, 32), basic(0x9ff0dc), 0, 1.72, 6, false); root.add(fw);
  solidCyl(0, 6, 0.55, 1.8, 3.4, PAL.coral);
  const bowl = mesh(new THREE.CylinderGeometry(1.4, 0.6, 0.5, 20), toon(PAL.stone), 0, 3.55, 6); root.add(bowl);
  level.addCyl(0, 6, 1.4, 3.3, 3.8);
  const jet = mesh(new THREE.ConeGeometry(0.5, 1.6, 12, 1, true), basic(0xd9fbf3, { transparent: true, opacity: 0.7 }), 0, 4.5, 6, false); root.add(jet);
  anim.push((t) => { jet.scale.y = 1 + Math.sin(t * 6) * 0.08; });
  W.jet = jet;
  W.fountain = V(0, 3.8, 6);

  const houses = [
    { x: -13, z: 4, wall: PAL.pink, roof: PAL.mint, w: 5, d: 5, h: 3.4, rot: 0 },
    { x: 13, z: -2, wall: PAL.mint, roof: PAL.coral, w: 5.5, d: 5, h: 4, rot: 0 },
    { x: -11, z: -10, wall: PAL.peach, roof: PAL.pink, w: 5, d: 6, h: 3.2, rot: 0 },
    { x: 7, z: -13, wall: PAL.coral, roof: PAL.lime, w: 5, d: 5, h: 3.6, rot: 0 },
  ];
  W.chimneys = [];
  for (const hs of houses) {
    const hh = house(hs.wall, hs.roof, hs.w, hs.d, hs.h); hh.position.set(hs.x, 1, hs.z); root.add(hh);
    level.addBox(hs.x, 1 + hs.h / 2, hs.z, hs.w, hs.h, hs.d);
    level.addBox(hs.x, 1 + hs.h + 0.5, hs.z, hs.w * 0.7, 1, hs.d * 0.7);
    level.addBox(hs.x, 1 + hs.h + 1.4, hs.z, hs.w * 0.35, 0.8, hs.d * 0.35);
    W.chimneys.push(V(hs.x + hh.userData.chimney.x, 1 + hh.userData.chimney.y, hs.z + hh.userData.chimney.z));
  }
  // shop stall
  const stall = new THREE.Group(); stall.position.set(11, 1, 9); root.add(stall);
  stall.add(mesh(new THREE.BoxGeometry(3.4, 1.1, 1.4), toon(PAL.wood), 0, 0.55, 0));
  for (const sx of [-1.6, 1.6]) stall.add(mesh(new THREE.CylinderGeometry(0.09, 0.09, 2.6, 6), toon(PAL.white), sx, 1.3, -0.6));
  for (let i = 0; i < 6; i++) { const st = mesh(new THREE.BoxGeometry(0.62, 0.08, 2.2), toon(i % 2 ? PAL.pink : PAL.white), -1.55 + i * 0.62, 2.65, -0.1); st.rotation.x = 0.25; stall.add(st); }
  const shopSign = textSprite("Coco's Caps & Charms", { bg: "#ff8b94", color: "#fff", height: 0.5 }); shopSign.position.set(11, 4.4, 9); root.add(shopSign);
  level.addBox(11, 1.55, 9, 3.4, 1.1, 1.4);

  // bouncy flower near the plaza (big coral bloom)
  const bloom = (x, y, z, power = 22) => {
    const g = new THREE.Group(); g.position.set(x, y, z); g.userData.dynamic = true; root.add(g);
    for (let i = 0; i < 6; i++) { const p = mesh(new THREE.SphereGeometry(0.75, 10, 6), toon(PAL.coral), Math.cos(i) * 0.75, 0.25, Math.sin(i) * 0.75); p.scale.y = 0.35; g.add(p); }
    g.add(mesh(new THREE.SphereGeometry(0.55, 12, 8), toon(PAL.gold), 0, 0.42, 0));
    g.add(mesh(new THREE.CylinderGeometry(0.12, 0.18, 0.3, 6), toon(PAL.leafDark), 0, 0.05, 0));
    const s = level.addCyl(x, z, 1.1, y - 0.2, y + 0.45, { bouncy: power, unsafe: true });
    anim.push((t) => { g.scale.y = 1 + Math.sin(t * 3 + x) * 0.06; });
    return g;
  };
  bloom(-6, 1, 12); bloom(18, 1, 6); bloom(-26, 1, 6, 24);

  // ---- lighthouse cliff (east) ----
  const cliffM = PAL.stone;
  const cliff = mesh(new THREE.BoxGeometry(16, 10, 16), toon(cliffM), 28, 2, -6); root.add(cliff);
  level.addBox(28, 2, -6, 16, 10, 16);
  const cliffTop = mesh(new THREE.BoxGeometry(16.4, 0.5, 16.4), grassM, 28, 7.05, -6); root.add(cliffTop);
  // stairs up the cliff
  for (let i = 0; i < 16; i++) {
    const h = 0.375 * (i + 1);
    const st = mesh(new THREE.BoxGeometry(0.82, h, 3.2), toon(i % 2 ? 0xf3e6dc : PAL.stone), 7.4 + i * 0.8, 1 + h / 2, -2.4); root.add(st);
    level.addBox(7.4 + i * 0.8, 1 + h / 2, -2.4, 0.82, h, 3.2);
  }
  // lighthouse tower
  const tower = new THREE.Group(); tower.position.set(31, 7, -9); root.add(tower);
  for (let i = 0; i < 7; i++) tower.add(mesh(new THREE.CylinderGeometry(2.3 - i * 0.05, 2.4 - i * 0.05, 2, 28), toon(i % 2 ? PAL.pink : PAL.white), 0, 1 + i * 2, 0));
  level.addCyl(31, -9, 2.4, 7, 21);
  const balcony = mesh(new THREE.CylinderGeometry(3.8, 3.6, 0.4, 32), toon(PAL.coral), 0, 14.2, 0); tower.add(balcony);
  level.addCyl(31, -9, 3.8, 20.8, 21.2);
  for (let i = 0; i < 20; i++) { const a = (i / 20) * Math.PI * 2; tower.add(mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.9, 5), toon(PAL.white), Math.cos(a) * 3.6, 14.8, Math.sin(a) * 3.6)); }
  const ringRail = mesh(new THREE.TorusGeometry(3.6, 0.07, 6, 40), toon(PAL.white), 0, 15.25, 0); ringRail.rotation.x = Math.PI / 2; tower.add(ringRail);
  const lantern = mesh(new THREE.CylinderGeometry(1.6, 1.6, 2.4, 16), new THREE.MeshToonMaterial({ color: 0xfff6d0, transparent: true, opacity: 0.55, emissive: 0xffe9a8, emissiveIntensity: 0.4 }), 0, 15.6, 0, false); tower.add(lantern);
  level.addCyl(31, -9, 1.6, 21.2, 23.6);
  const roofL = mesh(new THREE.ConeGeometry(2.2, 1.8, 20), toon(PAL.pink), 0, 17.7, 0); tower.add(roofL);
  level.addCyl(31, -9, 1.2, 23.6, 25.5);
  W.lanternPos = V(31, 22.6, -9);
  // spiral steps around the tower
  W.spiral = [];
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI * 0.75 + i * 0.95, r = 4.0;
    const x = 31 + Math.cos(a) * r, z = -9 + Math.sin(a) * r, y = 8.2 + i * 1.3;
    const moving = i === 4 || i === 7;
    const s = solidBox(x, y, z, 1.9, 0.45, 1.9, i % 2 ? PAL.mint : PAL.peach, moving ? { path: { a: [x, y, z], b: [x, y + 1.6, z], period: 3, phase: i } } : {});
    if (moving) s.mesh.userData.keep = true;
    W.spiral.push(s);
  }
  // little door + keeper's porch
  tower.add(mesh(new THREE.BoxGeometry(1.2, 2, 0.3), toon(PAL.woodDark), 0, 1, 2.35));

  // ---- waterfall cliff + hidden cave (west) ----
  const wcM = 0xe6d5c8;
  solidBox(-34.5, 3.5, -10, 7, 13, 12, wcM);   // x -38..-31
  solidBox(-24.5, 3.5, -10, 5, 13, 12, wcM);   // x -27..-22
  solidBox(-29, 7, -10, 4, 6, 12, wcM, { camThrough: false });       // above the tunnel (y 4..10)
  solidBox(-29, 1.5, -15.5, 4, 3, 1, wcM);     // tunnel back wall
  const capTop = mesh(new THREE.BoxGeometry(16.4, 0.5, 12.4), grassM, -30, 10.05, -10); root.add(capTop);
  // cave glow inside
  const caveFloor = mesh(new THREE.BoxGeometry(4, 0.05, 11), toon(0xd8c2e8), -29, 1.03, -10, false); root.add(caveFloor);
  W.crystals = [];
  for (let i = 0; i < 7; i++) {
    const c = mesh(new THREE.OctahedronGeometry(0.35 + Math.random() * 0.3), new THREE.MeshToonMaterial({ color: [PAL.mint, PAL.pink, PAL.lime][i % 3], emissive: [PAL.mint, PAL.pink, PAL.lime][i % 3], emissiveIntensity: 0.6, gradientMap: null }), -30.6 + (i % 2) * 3.2, 1.4 + Math.random() * 2, -6 - i * 1.3, false);
    c.scale.y = 1.8; c.userData.keep = true; root.add(c); W.crystals.push(c);
  }
  const caveLight = new THREE.PointLight(0xffb3d1, 3, 10, 1.5); caveLight.position.set(-29, 3, -12); root.add(caveLight);
  // waterfall curtain + pool
  const wfMat = waterfallMaterial();
  const wf = mesh(new THREE.PlaneGeometry(6, 9.2), wfMat, -29, 5.6, -3.85, false, false); root.add(wf);
  anim.push((t) => { wfMat.map.offset.y = t * 1.6; });
  const pool = mesh(new THREE.CircleGeometry(5, 32), basic(0xb5f3e3, { transparent: true, opacity: 0.85 }), -29, 1.04, -1, false); pool.rotation.x = -Math.PI / 2; root.add(pool);
  W.waterfallBase = V(-29, 1.2, -3.2);
  // wall-jump chimney up to the cliff top
  solidBox(-19.4, 3.5, -8, 2, 13, 4, wcM);
  const wjSign = textSprite("Wall Jump!", { bg: "#a8e6cf", color: "#3d4166", stroke: "#fff", height: 0.55 }); wjSign.position.set(-20.6, 2.6, -5.4); root.add(wjSign);

  // ---- north dock + floating Sky Steps ----
  solidBox(0, 0.3, -48, 3.2, 0.6, 8, PAL.wood);
  for (let i = 0; i < 4; i++) for (const sx of [-1.4, 1.4]) root.add(mesh(new THREE.CylinderGeometry(0.15, 0.15, 2.6, 6), toon(PAL.woodDark), sx, -0.5, -45 - i * 2.2));
  const islet = (x, y, z, r, opts = {}) => {
    const g = new THREE.Group(); g.position.set(x, y, z); root.add(g);
    g.add(mesh(new THREE.CylinderGeometry(r, r * 0.95, 0.6, 24), toon(PAL.mint), 0, -0.3, 0));
    const under = mesh(new THREE.ConeGeometry(r * 0.95, r * 1.6, 9), toon(0xe9c7b4), 0, -0.6 - r * 0.8, 0); under.rotation.x = Math.PI; g.add(under);
    for (let i = 0; i < 5; i++) { const f = mesh(new THREE.SphereGeometry(0.16, 6, 5), toon([PAL.pink, PAL.peach, PAL.lime][i % 3]), Math.cos(i * 1.3) * r * 0.7, 0.08, Math.sin(i * 1.3) * r * 0.7); g.add(f); }
    const s = level.addCyl(x, z, r, y - 0.6, y, { mesh: g, ...opts });
    return { g, s };
  };
  W.steps = [
    islet(0, 3.5, -60, 3), islet(-9, 5.5, -72, 2.6), islet(-2, 8, -86, 2.4), islet(12, 10, -96, 2.2), islet(26, 11, -88, 4.2),
  ];
  // the kite pillar on step 2
  solidCyl(-9, -72, 0.7, 5.5, 10.2, 0xe9c7b4, { taper: 1.3 });
  // secret relic rock off to the side of step 3
  const secret = islet(-16, 10.5, -92, 1.4);
  // sign at the dock
  const skySign = textSprite("Sky Steps", { bg: "#dcedc1", color: "#ff8b94", height: 0.6 }); skySign.position.set(0, 3.2, -44.5); root.add(skySign);
  // warp ring back home on the last step
  W.warpRing = V(29, 11.8, -86);
  const warp = mesh(new THREE.TorusGeometry(1.2, 0.18, 10, 32), new THREE.MeshToonMaterial({ color: PAL.mint, emissive: PAL.mint, emissiveIntensity: 0.6, gradientMap: null }), 29, 12.3, -86, false); root.add(warp);
  warp.userData.keep = true;
  anim.push((t) => { warp.rotation.y = t * 1.5; warp.position.y = 12.3 + Math.sin(t * 2) * 0.12; });

  // ---- boss cove (west, past the gate) ----
  solidBox(-48.5, 0.3, 0, 7, 0.6, 5, PAL.wood); // bridge x -52..-45
  for (const z of [-2.6, 2.6]) for (let i = 0; i < 4; i++) root.add(mesh(new THREE.CylinderGeometry(0.1, 0.1, 1, 6), toon(PAL.woodDark), -51.5 + i * 2, 1.1, z));
  const arena = mesh(new THREE.CylinderGeometry(15, 16, 4, 48), sandM, -66, 0.5 - 2, 0); root.add(arena);
  level.addCyl(-66, 0, 15, -3.5, 0.5, { name: "arena" });
  const arenaRing = mesh(new THREE.TorusGeometry(12, 0.25, 6, 60), toon(PAL.coral), -66, 0.55, 0, false); arenaRing.rotation.x = Math.PI / 2; root.add(arenaRing);
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2; if (Math.abs(Math.cos(a) - 1) < 0.15) continue; // gap toward the bridge
    const x = -66 + Math.cos(a) * 15, z = Math.sin(a) * 15, r = rock(1.4 + Math.random() * 0.6, i % 2 ? PAL.stone : 0xf2c7b8); r.position.set(x, 1.2, z); root.add(r);
    level.addCyl(x, z, 1.4, 0, 3);
  }
  W.arena = { x: -66, z: 0, r: 13 };
  // the gate (opens with 4 Sparkhearts)
  const gate = new THREE.Group(); gate.position.set(-46, 0.6, 0); root.add(gate);
  for (const z of [-2.6, 2.6]) gate.add(mesh(new THREE.CylinderGeometry(0.5, 0.6, 5, 10), toon(PAL.coral), 0, 2.5, z));
  gate.add(mesh(new THREE.BoxGeometry(1, 0.8, 6.4), toon(PAL.pink), 0, 5.2, 0));
  const barrier = mesh(new THREE.BoxGeometry(0.4, 4.6, 4.8), new THREE.MeshToonMaterial({ color: PAL.pink, transparent: true, opacity: 0.55, emissive: PAL.pink, emissiveIntensity: 0.5, gradientMap: null }), 0, 2.3, 0, false); gate.add(barrier);
  level.addCyl(-46, -2.6, 0.6, 0, 5.6); level.addCyl(-46, 2.6, 0.6, 0, 5.6);
  W.gateSolid = level.addBox(-46, 3, 0, 0.6, 6, 4.8, { name: "gate" });
  W.gateMesh = barrier;
  const gateSign = textSprite("Shell Cove: 4 Sparkhearts to enter", { bg: "#fff3e6", color: "#ff8b94", height: 0.45 }); gateSign.position.set(-44.5, 6.6, 0); root.add(gateSign); W.gateSign = gateSign;
  anim.push((t) => { barrier.material.opacity = 0.45 + Math.sin(t * 3) * 0.12; });

  // ---- scenery dressing ----
  const palms = [[-18, 26], [-24, 18], [18, 28], [24, 22], [-30, 22], [30, 30], [-34, 6], [34, 10], [-4, -32], [10, -34], [-20, -28], [20, -26], [-12, -36], [36, -20], [14, 36], [-6, 38], [-38, -18], [-16, 32]];
  W.palms = [];
  for (const [x, z] of palms) {
    const d = Math.hypot(x, z), y = d > 40 ? 0.45 : d > 38 ? 0.72 : 1;
    const p = palm(4.5 + Math.random() * 2.5, (Math.random() - 0.5) * 0.6); p.position.set(x, y, z); p.rotation.y = Math.random() * 6; root.add(p);
    level.addCyl(x, z, 0.32, y, y + 5); W.palms.push(p);
  }
  for (const p of [W.steps[1], W.steps[4]]) { const pp = palm(3.6, 0.2); pp.position.set(0.8, 0, 0.6); p.g.add(pp); }
  // rocks around the beach
  for (let i = 0; i < 26; i++) {
    const a = Math.random() * Math.PI * 2, d = 41 + Math.random() * 5, s = 0.5 + Math.random() * 1.2;
    const r = rock(s, i % 3 ? PAL.stone : 0xf2c7b8); r.position.set(Math.cos(a) * d, 0.45, Math.sin(a) * d);
    if ((Math.abs(r.position.x) < 4 && r.position.z < -38) || (r.position.x < -40 && Math.abs(r.position.z) < 5)) continue; // keep the dock & bridge clear
    root.add(r);
    if (s > 0.9) level.addCyl(r.position.x, r.position.z, s * 0.8, 0.45, 0.45 + s * 0.6);
  }
  // instanced flowers and grass tufts
  const flowerGeo = new THREE.SphereGeometry(0.14, 6, 4);
  const flowerCols = [PAL.pink, PAL.peach, PAL.coral, 0xffffff, PAL.gold];
  const fl = new THREE.InstancedMesh(flowerGeo, toon(0xffffff), 420);
  const stemGeo = new THREE.SphereGeometry(0.22, 6, 4); stemGeo.scale(1, 0.75, 1);
  const tufts = new THREE.InstancedMesh(stemGeo, toon(0x8fdcb8), 700);
  const mtx = new THREE.Matrix4(), col = new THREE.Color(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), ps = new THREE.Vector3();
  let fi = 0, ti = 0;
  const clearSpot = (x, z) => level.pointInside(x, 2.2, z, 0.5) || Math.hypot(x, z - 6) < 9.5 || (Math.abs(x) < 2.5 && z > -40 && z < 28);
  let guard = 0;
  while (fi < 420 && guard++ < 20000) {
    const a = Math.random() * Math.PI * 2, d = Math.sqrt(Math.random()) * 37, x = Math.cos(a) * d, z = Math.sin(a) * d;
    if (clearSpot(x, z)) continue;
    ps.set(x, 1.1, z); sc.setScalar(0.6 + Math.random() * 0.5); mtx.compose(ps, q, sc); fl.setMatrixAt(fi, mtx);
    fl.setColorAt(fi, col.set(flowerCols[fi % 5])); fi++;
  }
  guard = 0;
  while (ti < 700 && guard++ < 20000) {
    const a = Math.random() * Math.PI * 2, d = Math.sqrt(Math.random()) * 37.5, x = Math.cos(a) * d, z = Math.sin(a) * d;
    if (clearSpot(x, z)) continue;
    ps.set(x, 1.05, z); q.identity(); sc.set(0.45 + Math.random() * 0.4, 0.5 + Math.random() * 0.5, 0.45 + Math.random() * 0.4); mtx.compose(ps, q, sc); tufts.setMatrixAt(ti++, mtx);
  }
  fl.count = fi; tufts.count = ti;
  q.identity();
  fl.castShadow = false; tufts.castShadow = false; fl.receiveShadow = tufts.receiveShadow = true;
  root.add(fl, tufts);

  // boats bobbing in the bay
  for (const [x, z, c] of [[-20, 52, PAL.coral], [30, 50, PAL.mint], [52, -10, PAL.peach]]) {
    const b = new THREE.Group(); b.position.set(x, 0, z); b.userData.dynamic = true; root.add(b);
    const hull = mesh(new THREE.CylinderGeometry(1, 0.6, 3.6, 10, 1, false, 0, Math.PI), toon(c), 0, 0.2, 0); hull.rotation.set(Math.PI / 2, 0, Math.PI); b.add(hull);
    b.add(mesh(new THREE.CylinderGeometry(0.06, 0.06, 3, 6), toon(PAL.white), 0, 1.5, 0));
    const sail = mesh(new THREE.ConeGeometry(1, 2.4, 3), toon(PAL.white), 0.5, 1.8, 0); sail.scale.z = 0.08; b.add(sail);
    anim.push((t) => { b.position.y = Math.sin(t * 1.3 + x) * 0.15; b.rotation.z = Math.sin(t * 1.1 + z) * 0.06; b.rotation.x = Math.cos(t * 0.9 + x) * 0.04; });
  }
  // distant islands on the horizon
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2 + 0.3, d = 150 + Math.random() * 60;
    const g = new THREE.Group(); g.position.set(Math.cos(a) * d, 0, Math.sin(a) * d); root.add(g);
    const r = 8 + Math.random() * 10;
    g.add(mesh(new THREE.SphereGeometry(r, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), toon(i % 2 ? PAL.mint : PAL.lime), 0, -r * 0.3, 0, false, false));
    for (let k = 0; k < 3; k++) { const p = palm(5, 0.2); p.scale.setScalar(1.6); p.position.set((k - 1) * r * 0.4, r * 0.5, 0); g.add(p); }
  }
  // clouds
  W.clouds = [];
  for (let i = 0; i < 18; i++) {
    const c = cloud(1 + Math.random() * 1.5); c.userData.dynamic = true;
    const a = Math.random() * Math.PI * 2, d = 40 + Math.random() * 160;
    c.position.set(Math.cos(a) * d, 26 + Math.random() * 30, Math.sin(a) * d);
    root.add(c); W.clouds.push(c);
  }
  anim.push((t, dt) => {
    for (const c of W.clouds) { c.position.x += dt * 1.2; if (c.position.x > 220) c.position.x = -220; }
    for (const p of W.palms) p.rotation.z = Math.sin(t * 0.9 + p.userData.sway) * 0.025;
    for (const c of W.crystals) c.rotation.y += dt * 0.6;
  });

  // ---- spots ----
  W.checkpoints = {
    start: { pos: V(2, 1, 23), yaw: 0, name: "Fuse's House" },
    plaza: { pos: V(-5, 1, 11), yaw: 0, name: "Village Plaza" },
    cliff: { pos: V(22, 7.25, -3), yaw: -Math.PI / 2, name: "Lighthouse Cliff" },
    falls: { pos: V(-21, 1, 2), yaw: Math.PI / 2, name: "Waterfall" },
    dock: { pos: V(-3, 0.45, -42), yaw: 0, name: "North Dock" },
    sky: { pos: V(23, 11, -86), yaw: -Math.PI / 2, name: "Top of the Sky Steps" },
    gate: { pos: V(-42, 0.45, 5), yaw: Math.PI / 2, name: "Shell Cove Gate" },
  };
  W.secretRock = V(-16, 10.5, -92);
  W.xSpot = V(22, 0.45, 33);
  W.ringStart = V(-14, 0.45, 41);

  // music zones: near home plays Fuse's Home, the cove plays the boss theme
  W.musicAt = (p, game) => {
    if (p.x < -51 && game.bossActive) return "boss";
    if (Math.hypot(p.x + 3, p.z - 27) < 11) return "home";
    return "blossom";
  };
  W.update = (t, dt) => { for (const f of anim) f(t, dt); };
  W.merged = mergeStatic(root);
  return W;
}

// The same island, simplified, as a backdrop for the title screen
export { palm, house, cloud, rock };
