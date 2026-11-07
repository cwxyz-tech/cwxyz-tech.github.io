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
  const data = new Uint8Array([90, 90, 90, 255, 170, 170, 170, 255, 225, 225, 225, 255, 255, 255, 255, 255]);
  gradient = new THREE.DataTexture(data, 4, 1, THREE.RGBAFormat);
  gradient.minFilter = gradient.magFilter = THREE.NearestFilter;
  gradient.needsUpdate = true;
  return gradient;
}
const matCache = new Map();
export function toon(color, opts = {}) {
  const key = color + JSON.stringify(opts);
  if (!opts.unique && matCache.has(key)) return matCache.get(key);
  const m = new THREE.MeshToonMaterial({ color, gradientMap: gradientMap(), ...opts.params });
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
THREE.Material.prototype.onBeforeCompile = function (shader) {
  shader.uniforms.uSat = SAT;
  shader.fragmentShader = "uniform float uSat;\n" + shader.fragmentShader.replace(
    "#include <dithering_fragment>",
    "#include <dithering_fragment>\n  gl_FragColor.rgb = mix(vec3(dot(gl_FragColor.rgb, vec3(0.299, 0.587, 0.114))), gl_FragColor.rgb, uSat);");
};
export const SAT_GLSL = "gl_FragColor.rgb = mix(vec3(dot(gl_FragColor.rgb, vec3(0.299, 0.587, 0.114))), gl_FragColor.rgb, uSat);";

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
