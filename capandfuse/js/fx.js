// Shared look: palette, toon materials, particles, shockwave rings.
import * as THREE from "../vendor/three.module.min.js";

export const PAL = {
  mint: 0xa8e6cf, lime: 0xdcedc1, peach: 0xffd3b6, coral: 0xffaaa5, pink: 0xff8b94,
  ink: 0x3d4166, inkDark: 0x2a2d4a, white: 0xfffaf4, cream: 0xfff3e6, wood: 0xdba57f, woodDark: 0xb07a5a,
  stone: 0xeadfd6, sea: 0x6fd3c6, seaDeep: 0x3fb3b0, leaf: 0x7fd6a8, leafDark: 0x5cbf91, gold: 0xffd56b, sky: 0xbff0ea,
};

let gradient;
export function gradientMap() {
  if (gradient) return gradient;
  // soft cel shading: a gentle shadow side with one smooth light/dark edge,
  // instead of hard bands
  const N = 32, data = new Uint8Array(N * 4);
  for (let i = 0; i < N; i++) {
    const t = i / (N - 1), e = Math.min(1, Math.max(0, (t - 0.3) / 0.28)), k = e * e * (3 - 2 * e);
    const v = Math.round(255 * (0.5 + 0.5 * k)); data.set([v, v, v, 255], i * 4);
  }
  gradient = new THREE.DataTexture(data, N, 1, THREE.RGBAFormat);
  gradient.minFilter = gradient.magFilter = THREE.LinearFilter;
  gradient.needsUpdate = true;
  return gradient;
}
const matCache = new Map();
export function toon(color, opts = {}) {
  const key = color + JSON.stringify(opts);
  if (!opts.unique && matCache.has(key)) return matCache.get(key);
  const m = new THREE.MeshToonMaterial({ color, gradientMap: gradientMap(), ...opts.params });
  if (opts.gloss) m.defines = { ...(m.defines || {}), CF_GLOSS: "" };
  if (opts.ground) m.defines = { ...(m.defines || {}), CF_GROUND: "" };
  if (opts.emissive) { m.emissive = new THREE.Color(opts.emissive); m.emissiveIntensity = opts.ei ?? 0.6; }
  if (!opts.unique) matCache.set(key, m);
  return m;
}
export function basic(color, opts = {}) { return new THREE.MeshBasicMaterial({ color, ...opts }); }

export function mesh(geo, mat, x = 0, y = 0, z = 0, cast = true, recv = true) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.castShadow = cast; m.receiveShadow = recv;
  return m;
}

// ---------------- particles ----------------
const PVERT = `
attribute float size; attribute float alpha; attribute vec3 pcolor;
varying float vA; varying vec3 vC;
uniform float uScale;
void main(){ vA = alpha; vC = pcolor; vec4 mv = modelViewMatrix * vec4(position,1.0);
  gl_PointSize = size * uScale / max(0.1, -mv.z); gl_Position = projectionMatrix * mv; }`;
const PFRAG = `
varying float vA; varying vec3 vC;
void main(){ vec2 c = gl_PointCoord - 0.5; float d = length(c); if (d > 0.5) discard;
  float a = smoothstep(0.5, 0.2, d) * vA; gl_FragColor = vec4(vC + (0.25 - d) * 0.6, a); }`;

export class Particles {
  constructor(scene, max = 900) {
    this.max = max;
    this.p = [];
    const g = new THREE.BufferGeometry();
    this.pos = new Float32Array(max * 3); this.col = new Float32Array(max * 3);
    this.size = new Float32Array(max); this.alpha = new Float32Array(max);
    g.setAttribute("position", new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute("pcolor", new THREE.BufferAttribute(this.col, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute("size", new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute("alpha", new THREE.BufferAttribute(this.alpha, 1).setUsage(THREE.DynamicDrawUsage));
    this.mat = new THREE.ShaderMaterial({ vertexShader: PVERT, fragmentShader: PFRAG, transparent: true, depthWrite: false, uniforms: { uScale: { value: 300 } } });
    this.points = new THREE.Points(g, this.mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = 5;
    this.geo = g;
    scene.add(this.points);
    this._c = new THREE.Color();
  }
  setScale(h) { this.mat.uniforms.uScale.value = h * 0.5; }
  emit(o) {
    const n = o.count || 1;
    for (let i = 0; i < n; i++) {
      if (this.p.length >= this.max) this.p.shift();
      const sp = o.speed ?? 3, sprd = o.spread ?? 1;
      let dx = (Math.random() * 2 - 1), dy = (Math.random() * 2 - 1), dz = (Math.random() * 2 - 1);
      const l = Math.hypot(dx, dy, dz) || 1; dx /= l; dy /= l; dz /= l;
      const dir = o.dir || [0, 0, 0];
      const cols = Array.isArray(o.color) ? o.color : [o.color ?? PAL.white];
      this._c.set(cols[(Math.random() * cols.length) | 0]).convertLinearToSRGB(); // shader writes raw sRGB
      const life = (o.life ?? 0.8) * (0.7 + Math.random() * 0.6);
      this.p.push({
        x: o.x + (Math.random() * 2 - 1) * (o.jitter || 0), y: o.y + (Math.random() * 2 - 1) * (o.jitter || 0) * (o.flat ? 0.1 : 1), z: o.z + (Math.random() * 2 - 1) * (o.jitter || 0),
        vx: dir[0] + dx * sp * sprd, vy: dir[1] + (o.flat ? Math.abs(dy) * 0.4 : dy) * sp * sprd + (o.up || 0), vz: dir[2] + dz * sp * sprd,
        g: o.gravity ?? 6, drag: o.drag ?? 1.5, life, max: life, s0: (o.size ?? 0.5) * (0.7 + Math.random() * 0.6), grow: o.grow ?? -0.5,
        r: this._c.r, gg: this._c.g, b: this._c.b,
      });
    }
  }
  update(dt) {
    let j = 0;
    const keep = [];
    for (const q of this.p) {
      q.life -= dt;
      if (q.life <= 0) continue;
      q.vy -= q.g * dt;
      const d = Math.exp(-q.drag * dt); q.vx *= d; q.vy *= d; q.vz *= d;
      q.x += q.vx * dt; q.y += q.vy * dt; q.z += q.vz * dt;
      keep.push(q);
    }
    this.p = keep;
    for (const q of this.p) {
      const k = q.life / q.max;
      this.pos[j * 3] = q.x; this.pos[j * 3 + 1] = q.y; this.pos[j * 3 + 2] = q.z;
      this.col[j * 3] = q.r; this.col[j * 3 + 1] = q.gg; this.col[j * 3 + 2] = q.b;
      this.size[j] = Math.max(0, q.s0 * (1 + q.grow * (1 - k)));
      this.alpha[j] = Math.min(1, k * 2.2);
      j++;
    }
    this.geo.setDrawRange(0, j);
    for (const a of ["position", "pcolor", "size", "alpha"]) this.geo.attributes[a].needsUpdate = true;
  }
  clear() { this.p.length = 0; }
}

// expanding flat rings for landings, ground pounds and boss slams
export class Rings {
  constructor(scene) {
    this.scene = scene; this.list = [];
    this.geo = new THREE.RingGeometry(0.8, 1, 40); this.geo.rotateX(-Math.PI / 2);
  }
  spawn(x, y, z, color = PAL.white, size = 3, life = 0.5, thick = false) {
    const m = new THREE.Mesh(this.geo, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.8, depthWrite: false, side: THREE.DoubleSide }));
    m.position.set(x, y + 0.05, z); m.scale.setScalar(0.2);
    this.scene.add(m);
    this.list.push({ m, t: 0, life, size, thick });
    return m;
  }
  update(dt) {
    this.list = this.list.filter((r) => {
      r.t += dt; const k = r.t / r.life;
      if (k >= 1) { this.scene.remove(r.m); r.m.material.dispose(); return false; }
      const e = 1 - Math.pow(1 - k, 3);
      r.m.scale.setScalar(0.2 + e * r.size);
      r.m.material.opacity = 0.85 * (1 - k);
      return true;
    });
  }
  clear() { for (const r of this.list) { this.scene.remove(r.m); r.m.material.dispose(); } this.list = []; }
}

// soft round shadow blob (always readable, even with shadows turned off)
export function blobShadow(size = 1) {
  const c = document.createElement("canvas"); c.width = c.height = 64;
  const x = c.getContext("2d"), gr = x.createRadialGradient(32, 32, 2, 32, 32, 31);
  gr.addColorStop(0, "rgba(40,30,60,0.55)"); gr.addColorStop(1, "rgba(40,30,60,0)");
  x.fillStyle = gr; x.fillRect(0, 0, 64, 64);
  const tex = new THREE.CanvasTexture(c);
  const m = new THREE.Mesh(new THREE.PlaneGeometry(size, size), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }));
  m.rotation.x = -Math.PI / 2; m.renderOrder = 2;
  return m;
}

// text label sprite (for signs and floating text)
export function textSprite(text, opts = {}) {
  const c = document.createElement("canvas"), x = c.getContext("2d");
  const fs = opts.size || 48, font = `bold ${fs}px "Arial Rounded MT Bold", ui-rounded, "Trebuchet MS", sans-serif`;
  x.font = font; const w = Math.ceil(x.measureText(text).width) + 40;
  c.width = w; c.height = fs + 30;
  x.font = font; x.textAlign = "center"; x.textBaseline = "middle";
  if (opts.bg) { x.fillStyle = opts.bg; roundRect(x, 4, 4, w - 8, c.height - 8, 18); x.fill(); }
  x.lineWidth = 8; x.strokeStyle = opts.stroke || "#3d4166"; x.strokeText(text, w / 2, c.height / 2 + 2);
  x.fillStyle = opts.color || "#fff"; x.fillText(text, w / 2, c.height / 2 + 2);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
  const h = opts.height || 0.8; s.scale.set((h * w) / c.height, h, 1);
  return s;
}
function roundRect(x, a, b, w, h, r) { x.beginPath(); x.moveTo(a + r, b); x.arcTo(a + w, b, a + w, b + h, r); x.arcTo(a + w, b + h, a, b + h, r); x.arcTo(a, b + h, a, b, r); x.arcTo(a, b, a + w, b, r); x.closePath(); }

export const ease = {
  out: (k) => 1 - Math.pow(1 - k, 3),
  inOut: (k) => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2),
  back: (k) => { const c = 1.7; return 1 + (c + 1) * Math.pow(k - 1, 3) + c * Math.pow(k - 1, 2); },
};
export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const damp = (a, b, lambda, dt) => lerp(a, b, 1 - Math.exp(-lambda * dt));
export function angDiff(a, b) { let d = b - a; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; return d; }

// ---------------- performance helpers ----------------
// World color saturation (the Bay loses color when the Sparkhearts scatter).
// Done inside every material's shader instead of a CSS filter on the canvas,
// which forced the browser to re-composite the whole screen every frame.
export const SAT = { value: 1 };
export const RES = { value: new THREE.Vector2(1280, 720) };
// final look applied in every shader: saturation, a gentle contrast curve and a soft vignette
export const SAT_GLSL = `gl_FragColor.rgb = mix(vec3(dot(gl_FragColor.rgb, vec3(0.299, 0.587, 0.114))), gl_FragColor.rgb, uSat);
  { vec3 cfc = clamp(gl_FragColor.rgb, 0.0, 1.0); gl_FragColor.rgb = mix(cfc, cfc * cfc * (3.0 - 2.0 * cfc), 0.14);
    vec2 cfq = gl_FragCoord.xy / uRes - 0.5; gl_FragColor.rgb *= 1.0 - dot(cfq, cfq) * 0.32; }`;
// Lit (toon) materials also get: a rim light that outlines shapes against the sky,
// an optional glossy highlight (Fuse, gems, coins), and optional soft color
// variation on the ground so big fields don't look flat.
const LIT_FRAG = `
#ifdef CF_LIT
  { // one lighting model for everything: warm where the sun hits, cool lavender in shade
    float cfL = dot(outgoingLight, vec3(0.3, 0.59, 0.11)) / max(0.03, dot(diffuseColor.rgb, vec3(0.3, 0.59, 0.11)));
    outgoingLight *= mix(vec3(0.88, 0.87, 1.07), vec3(1.04, 1.0, 0.95), smoothstep(0.9, 1.6, cfL));
    vec3 cfV = normalize(vViewPosition);
    float cfNV = clamp(dot(normal, cfV), 0.0, 1.0);
    float cfRim = pow(1.0 - cfNV, 3.0) * smoothstep(-0.2, 0.6, normal.y + 0.35);
    outgoingLight += vec3(1.0, 0.95, 0.88) * cfRim * (0.12 + 0.3 * dot(diffuseColor.rgb, vec3(0.33)));
  #ifdef CF_GLOSS
  #if NUM_DIR_LIGHTS > 0
    vec3 cfH = normalize(directionalLights[0].direction + cfV);
    float cfS = max(dot(normal, cfH), 0.0);
    outgoingLight += directionalLights[0].color * (smoothstep(0.985, 0.995, cfS) * 0.32 + pow(cfS, 14.0) * 0.06);
    outgoingLight += vec3(0.75, 0.85, 1.0) * pow(1.0 - cfNV, 2.0) * 0.12;
  #endif
  #endif
  #ifdef CF_GROUND
    vec2 cfp = vCfW.xz;
    float cfn = cfNoise(cfp * 0.12) * 0.55 + cfNoise(cfp * 0.6) * 0.3 + cfNoise(cfp * 2.4) * 0.15;
    outgoingLight *= 0.9 + 0.18 * cfn;
    outgoingLight += vec3(0.06, 0.05, -0.02) * smoothstep(0.55, 0.85, cfNoise(cfp * 0.07 + 7.3));
  #endif
  }
#endif
`;
const NOISE = `
float cfHash(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float cfNoise(vec2 p){ vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(cfHash(i), cfHash(i + vec2(1, 0)), u.x), mix(cfHash(i + vec2(0, 1)), cfHash(i + vec2(1, 1)), u.x), u.y); }
`;
// every toon material shares the same soft shading ramp, even ones made without it
THREE.Object3D.prototype.onBeforeRender = function (r, s, c, g, m) {
  if (m && m.isMeshToonMaterial && !m.gradientMap) { m.gradientMap = gradientMap(); m.needsUpdate = true; }
};
THREE.Material.prototype.onBeforeCompile = function (shader) {
  shader.uniforms.uSat = SAT; shader.uniforms.uRes = RES;
  let fs = "uniform float uSat;\nuniform vec2 uRes;\n" + shader.fragmentShader;
  if (this.isMeshToonMaterial) {
    shader.defines = shader.defines || {}; shader.defines.CF_LIT = "";
    if (this.defines && this.defines.CF_GROUND !== undefined) {
      shader.vertexShader = "varying vec3 vCfW;\n" + shader.vertexShader.replace("#include <project_vertex>",
        "#include <project_vertex>\n  { vec4 cfw = vec4(transformed, 1.0);\n  #ifdef USE_INSTANCING\n  cfw = instanceMatrix * cfw;\n  #endif\n  vCfW = (modelMatrix * cfw).xyz; }");
      fs = "varying vec3 vCfW;\n" + NOISE + fs;
    }
    fs = fs.replace("#include <opaque_fragment>", LIT_FRAG + "#include <opaque_fragment>");
  }
  shader.fragmentShader = fs.replace("#include <dithering_fragment>", "#include <dithering_fragment>\n  " + SAT_GLSL);
};

// Merge every static mesh under `root` into one mesh per material, so the
// GPU draws a whole house (or the whole island) in a handful of calls.
// Objects with userData.dynamic keep moving on their own and are merged
// separately inside themselves.
const EMPTY = new THREE.BufferGeometry();
EMPTY.setAttribute("position", new THREE.BufferAttribute(new Float32Array(0), 3));
export function mergeStatic(root) {
  root.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(root.matrixWorld).invert();
  const groups = new Map(), victims = [];
  const visit = (o, top) => {
    for (const c of o.children.slice()) {
      if (c.userData.dynamic && c !== top) { mergeStatic(c); continue; }
      if (c.isMesh && !c.isInstancedMesh && !c.isSkinnedMesh && c.material && !Array.isArray(c.material) && !c.userData.keep &&
          !(c.material.map) && !c.material.isShaderMaterial && !c.material.transparent && c.visible) {
        const key = c.material.uuid + (c.castShadow ? "s" : "") + (c.receiveShadow ? "r" : "");
        if (!groups.has(key)) groups.set(key, { mat: c.material, cast: c.castShadow, recv: c.receiveShadow, geos: [] });
        const m = new THREE.Matrix4().multiplyMatrices(inv, c.matrixWorld);
        let geo = c.geometry.index ? c.geometry.toNonIndexed() : c.geometry.clone();
        for (const name of Object.keys(geo.attributes)) if (name !== "position" && name !== "normal") geo.deleteAttribute(name);
        if (!geo.attributes.normal) geo.computeVertexNormals();
        geo.applyMatrix4(m);
        groups.get(key).geos.push(geo);
        victims.push(c);
      }
      if (!c.isMesh || c.children.length) visit(c, top);
    }
  };
  visit(root, root);
  let merged = 0;
  for (const g of groups.values()) {
    if (g.geos.length < 2) { continue; }
    let n = 0; for (const geo of g.geos) n += geo.attributes.position.count;
    const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3);
    let o = 0;
    for (const geo of g.geos) { pos.set(geo.attributes.position.array, o * 3); nor.set(geo.attributes.normal.array, o * 3); o += geo.attributes.position.count; geo.dispose(); }
    const out = new THREE.BufferGeometry();
    out.setAttribute("position", new THREE.BufferAttribute(pos, 3)); out.setAttribute("normal", new THREE.BufferAttribute(nor, 3));
    out.computeBoundingSphere();
    const mm = new THREE.Mesh(out, g.mat); mm.castShadow = g.cast; mm.receiveShadow = g.recv; mm.userData.merged = true;
    root.add(mm); merged++;
    g.done = true;
  }
  // remove the originals that were merged
  for (const c of victims) {
    const key = c.material.uuid + (c.castShadow ? "s" : "") + (c.receiveShadow ? "r" : "");
    const g = groups.get(key);
    if (g && g.done && c.children.length === 0) c.parent.remove(c);
    else if (g && g.done) c.geometry = EMPTY; // keep it as a parent for its children, but draw nothing
  }
  return merged;
}

// ---------------- shared shape language ----------------
// Every block in the game uses softly rounded edges (no sharp default cubes),
// so houses, crates, steps and props all read as one hand-made set.
const rboxCache = new Map();
export function rbox(w, h, d, radius) {
  const r = Math.max(0.005, Math.min(radius ?? Math.min(0.3, 0.05 + Math.min(w, h, d) * 0.06), Math.min(w, h, d) * 0.22));
  const key = [w, h, d, r].map((v) => v.toFixed(3)).join(",");
  if (rboxCache.has(key)) return rboxCache.get(key);
  const geo = new THREE.BoxGeometry(1, 1, 1, 5, 5, 5);
  const half = [w / 2, h / 2, d / 2];
  const coords = (hh) => [-hh, -hh + r * 0.29, -hh + r, hh - r, hh - r * 0.29, hh];
  const C = half.map(coords), inner = half.map((hh) => hh - r);
  const p = geo.attributes.position, n = geo.attributes.normal;
  const v = new THREE.Vector3(), c = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    const a = [p.getX(i), p.getY(i), p.getZ(i)].map((u, k) => C[k][Math.round((u + 0.5) * 5)]);
    v.set(a[0], a[1], a[2]);
    c.set(Math.max(-inner[0], Math.min(inner[0], a[0])), Math.max(-inner[1], Math.min(inner[1], a[1])), Math.max(-inner[2], Math.min(inner[2], a[2])));
    v.sub(c); const len = v.length() || 1; v.multiplyScalar(1 / len);
    n.setXYZ(i, v.x, v.y, v.z);
    p.setXYZ(i, c.x + v.x * r, c.y + v.y * r, c.z + v.z * r);
  }
  geo.deleteAttribute("uv");
  geo.computeBoundingBox(); geo.computeBoundingSphere();
  rboxCache.set(key, geo);
  return geo;
}

// Painted wooden sign board, readable from both sides (replaces floating labels).
export function signBoard(text, opts = {}) {
  const fs = 64, font = `bold ${fs}px "Arial Rounded MT Bold", ui-rounded, "Trebuchet MS", sans-serif`;
  const c = document.createElement("canvas"), x = c.getContext("2d");
  x.font = font; const tw = Math.ceil(x.measureText(text).width);
  c.width = tw + 90; c.height = fs + 54;
  x.fillStyle = opts.bg || "#fff3e6"; x.fillRect(0, 0, c.width, c.height);
  // a few soft brush strokes so the paint doesn't look printed
  for (let i = 0; i < 26; i++) { x.fillStyle = `rgba(${i % 2 ? "255,255,255" : "120,80,60"},${0.03 + Math.random() * 0.04})`; x.fillRect(0, Math.random() * c.height, c.width, 2 + Math.random() * 5); }
  x.font = font; x.textAlign = "center"; x.textBaseline = "middle";
  x.fillStyle = opts.color || "#3d4166"; x.fillText(text, c.width / 2, c.height / 2 + 3);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  const h = opts.height || 0.6, w = (h * c.width) / c.height;
  const g = new THREE.Group();
  const wood = toon(PAL.woodDark);
  g.add(mesh(rbox(w + 0.22, h + 0.22, 0.14, 0.06), wood, 0, 0, 0));
  const face = new THREE.MeshToonMaterial({ map: tex, gradientMap: gradientMap() });
  for (const side of [1, -1]) {
    const pl = new THREE.Mesh(new THREE.PlaneGeometry(w, h), face);
    pl.position.z = 0.072 * side; if (side < 0) pl.rotation.y = Math.PI;
    pl.receiveShadow = true; g.add(pl);
  }
  if (opts.post) for (const sx of [-1, 1]) g.add(mesh(rbox(0.14, opts.post, 0.14, 0.04), wood, sx * (w / 2 - 0.1), -opts.post / 2 - h / 2, -0.0));
  g.userData.keep = false;
  return g;
}
