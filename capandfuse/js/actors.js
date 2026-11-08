// Collectibles, checkpoints, NPCs and enemies for Blossom Bay.
import * as THREE from "../vendor/three.module.min.js";
import { PAL, toon, basic, mesh, textSprite, damp, clamp, angDiff, mergeStatic } from "./fx.js?v=12";

// mark moving parts, then merge everything else in a model into a few meshes
function bake(root, dynamic = [], keep = []) { for (const d of dynamic) if (d) d.userData.dynamic = true; for (const k of keep) if (k) k.userData.keep = true; mergeStatic(root); }

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const SPH = new THREE.SphereGeometry(1, 16, 12);

// ---------------------------------------------------------------------------
// Sparkbits (instanced so hundreds stay cheap)
// ---------------------------------------------------------------------------
export class Bits {
  constructor(game, max = 400) {
    this.game = game; this.list = [];
    const geo = new THREE.OctahedronGeometry(0.32, 0); geo.scale(1, 1.3, 0.55);
    this.mat = new THREE.MeshToonMaterial({ color: PAL.gold, emissive: 0xffb36b, emissiveIntensity: 0.35 });
    this.im = new THREE.InstancedMesh(geo, this.mat, max);
    this.im.count = 0; this.im.castShadow = true; this.im.frustumCulled = false;
    game.scene.add(this.im);
    this.m = new THREE.Matrix4(); this.q = new THREE.Quaternion(); this.s = new THREE.Vector3(1, 1, 1); this.pv = new THREE.Vector3(); this.e = new THREE.Euler();
    this.combo = 0; this.comboT = 0;
  }
  add(x, y, z, loose = null) {
    if (this.list.length >= 400) this.list = this.list.filter((b) => b.alive); // forget collected bits
    if (this.list.length < 400) this.list.push({ x, y, z, alive: true, ph: Math.random() * 6, loose, t: 0 });
  }
  line(a, b, n) { for (let i = 0; i < n; i++) { const k = n === 1 ? 0 : i / (n - 1); this.add(a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k); } }
  circle(c, r, n, y) { for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2; this.add(c[0] + Math.cos(a) * r, y ?? c[1], c[2] + Math.sin(a) * r); } }
  arc(a, b, h, n) { for (let i = 0; i < n; i++) { const k = i / (n - 1); this.add(a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k + Math.sin(k * Math.PI) * h, a[2] + (b[2] - a[2]) * k); } }
  burst(x, y, z, n) {
    for (let i = 0; i < n; i++) { const a = Math.random() * Math.PI * 2; this.add(x, y + 0.5, z, { vx: Math.cos(a) * 3, vy: 8 + Math.random() * 3, vz: Math.sin(a) * 3 }); }
  }
  get total() { return this.list.length; }
  update(dt, t) {
    const g = this.game, p = g.player, c = p.center, cap = p.cap;
    this.comboT -= dt; if (this.comboT <= 0) this.combo = 0;
    let n = 0;
    for (const b of this.list) {
      if (!b.alive) continue;
      b.t += dt;
      if (b.loose) {
        const L = b.loose; L.vy -= 30 * dt; b.x += L.vx * dt; b.y += L.vy * dt; b.z += L.vz * dt;
        const gr = g.level.groundBelow(b.x, b.z, b.y + 0.5);
        const floorY = (gr ? gr.top : -50) + 0.5;
        if (b.y < floorY) { b.y = floorY; L.vy = Math.abs(L.vy) * 0.4; L.vx *= 0.6; L.vz *= 0.6; if (Math.abs(L.vy) < 1) { b.loose = null; } }
        if (b.y < g.world.waterY - 1) { b.alive = false; continue; }
      }
      const dx = b.x - c.x, dy = b.y - c.y, dz = b.z - c.z;
      const capNear = cap.state !== "held" && Math.hypot(b.x - cap.mesh.position.x, b.y - cap.mesh.position.y, b.z - cap.mesh.position.z) < 1.1;
      if ((dx * dx + dy * dy + dz * dz < 1.15 && (!b.loose || b.t > 0.25)) || capNear) { this.collect(b); continue; }
      this.e.set(0, t * 3 + b.ph, 0); this.q.setFromEuler(this.e);
      const bob = Math.sin(t * 3 + b.ph) * 0.12;
      this.m.compose(this.pv.set(b.x, b.y + bob, b.z), this.q, this.s);
      this.im.setMatrixAt(n++, this.m);
    }
    this.im.count = n; this.im.instanceMatrix.needsUpdate = true;
  }
  collect(b) {
    const g = this.game;
    b.alive = false;
    this.combo = Math.min(this.combo + 1, 12); this.comboT = 0.6;
    g.audio.sfx("bit", { combo: this.combo });
    g.fx.emit({ x: b.x, y: b.y, z: b.z, count: 6, color: [PAL.gold, 0xffffff, PAL.peach], speed: 3, life: 0.35, size: 0.3, gravity: 2 });
    g.addBits(1);
  }
  clear() { this.list = []; this.im.count = 0; }
}

// ---------------------------------------------------------------------------
// Sparkhearts, relics, heart pickups
// ---------------------------------------------------------------------------
let heartGeo;
function heartGeometry() {
  if (heartGeo) return heartGeo;
  const s = new THREE.Shape();
  s.moveTo(0, -0.9); s.bezierCurveTo(-0.2, -0.6, -1, -0.25, -1, 0.25); s.bezierCurveTo(-1, 0.75, -0.45, 0.95, 0, 0.55);
  s.bezierCurveTo(0.45, 0.95, 1, 0.75, 1, 0.25); s.bezierCurveTo(1, -0.25, 0.2, -0.6, 0, -0.9);
  heartGeo = new THREE.ExtrudeGeometry(s, { depth: 0.35, bevelEnabled: true, bevelSize: 0.18, bevelThickness: 0.18, bevelSegments: 3, curveSegments: 16 });
  heartGeo.center();
  return heartGeo;
}

export class Sparkheart {
  constructor(game, id, name, pos, opts = {}) {
    this.game = game; this.id = id; this.name = name; this.home = pos.clone();
    this.taken = game.save.hearts.includes(id);
    this.visible = !opts.hidden;
    this.g = new THREE.Group(); this.g.position.copy(pos); game.scene.add(this.g);
    const mat = this.taken ? new THREE.MeshToonMaterial({ color: 0xffffff, transparent: true, opacity: 0.45, emissive: PAL.mint, emissiveIntensity: 0.4 })
      : new THREE.MeshToonMaterial({ color: PAL.pink, emissive: 0xff5f70, emissiveIntensity: 0.45 });
    this.h = mesh(heartGeometry(), mat); this.h.scale.setScalar(0.7); this.g.add(this.h);
    const halo = new THREE.Mesh(SPH, new THREE.MeshBasicMaterial({ color: this.taken ? PAL.mint : PAL.peach, transparent: true, opacity: 0.22, depthWrite: false }));
    halo.scale.setScalar(1.25); this.g.add(halo); this.halo = halo;
    this.g.visible = this.visible;
    this.t = Math.random() * 5; this.done = false;
  }
  reveal(from) {
    this.visible = true; this.g.visible = true;
    if (from) { this.popFrom = from.clone(); this.popT = 0; this.g.position.copy(from); }
    this.game.audio.sfx("notify", { caption: "[A Sparkheart appears!]" });
    this.game.fx.emit({ x: this.home.x, y: this.home.y, z: this.home.z, count: 30, color: [PAL.pink, PAL.peach, 0xffffff], speed: 6, life: 0.8, size: 0.5 });
  }
  update(dt) {
    if (!this.visible || this.done) return;
    this.t += dt;
    if (this.popFrom) {
      this.popT = Math.min(1, this.popT + dt * 1.3);
      const k = this.popT;
      this.g.position.lerpVectors(this.popFrom, this.home, k); this.g.position.y += Math.sin(k * Math.PI) * 3;
      if (k >= 1) this.popFrom = null;
    } else this.g.position.y = this.home.y + Math.sin(this.t * 2) * 0.18;
    this.h.rotation.y = this.t * 1.8;
    this.halo.scale.setScalar(1.2 + Math.sin(this.t * 4) * 0.08);
    const g = this.game;
    if (Math.random() < dt * 8) g.fx.emit({ x: this.g.position.x, y: this.g.position.y, z: this.g.position.z, count: 1, color: this.taken ? PAL.mint : [PAL.pink, PAL.peach, 0xffffff], speed: 1.5, life: 0.8, size: 0.35, gravity: -0.5, jitter: 0.6 });
    if (!this.popFrom && g.player.center.distanceTo(this.g.position) < 1.5 && g.player.state !== "lose") {
      this.done = true; this.g.visible = false;
      g.collectHeart(this);
    }
  }
}

export class Relic {
  constructor(game, id, name, pos) {
    this.game = game; this.id = id; this.name = name;
    this.taken = game.save.relics.includes(id);
    this.g = new THREE.Group(); this.g.position.copy(pos); game.scene.add(this.g);
    const m = new THREE.MeshToonMaterial({ color: PAL.gold, emissive: 0xffc04a, emissiveIntensity: 0.3 });
    const brim = mesh(new THREE.TorusGeometry(0.35, 0.1, 8, 20), m); brim.rotation.x = Math.PI / 2; this.g.add(brim);
    const top = mesh(new THREE.SphereGeometry(0.3, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), m, 0, 0, 0); this.g.add(top);
    const gem = mesh(new THREE.OctahedronGeometry(0.14), new THREE.MeshToonMaterial({ color: PAL.mint, emissive: PAL.mint, emissiveIntensity: 0.6 }), 0, 0.22, 0.25); this.g.add(gem);
    this.g.visible = !this.taken; this.t = 0;
  }
  update(dt) {
    if (this.taken) return;
    this.t += dt;
    this.g.rotation.y = this.t * 1.5; this.g.position.y += Math.sin(this.t * 2.2) * 0.004;
    if (Math.random() < dt * 5) this.game.fx.emit({ x: this.g.position.x, y: this.g.position.y, z: this.g.position.z, count: 1, color: [PAL.gold, PAL.mint], speed: 1, life: 0.7, size: 0.3, gravity: -0.5, jitter: 0.4 });
    if (this.game.player.center.distanceTo(this.g.position) < 1.3) { this.taken = true; this.g.visible = false; this.game.collectRelic(this); }
  }
}

export class HealthHeart {
  constructor(game, pos) {
    this.game = game; this.g = mesh(heartGeometry(), toon(PAL.coral)); this.g.scale.setScalar(0.32);
    this.g.position.copy(pos); this.home = pos.clone(); game.scene.add(this.g); this.t = Math.random() * 3; this.alive = true; this.respawn = 0;
  }
  update(dt) {
    if (!this.alive) { this.respawn -= dt; if (this.respawn <= 0) { this.alive = true; this.g.visible = true; } return; }
    this.t += dt; this.g.rotation.y = this.t * 2.5; this.g.position.y = this.home.y + Math.sin(this.t * 3) * 0.12;
    const p = this.game.player;
    if (p.hp < p.maxHp && p.center.distanceTo(this.g.position) < 1.1) {
      p.heal(1); this.alive = false; this.g.visible = false; this.respawn = 40;
      this.game.audio.sfx("ring"); this.game.fx.emit({ x: this.home.x, y: this.home.y, z: this.home.z, count: 10, color: [PAL.coral, PAL.pink], speed: 3, life: 0.5, size: 0.35 });
    }
  }
}

// ---------------------------------------------------------------------------
// Checkpoint flags
// ---------------------------------------------------------------------------
export class Checkpoint {
  constructor(game, id, pos) {
    this.game = game; this.id = id; this.pos = pos.clone();
    this.on = game.save.checkpoints.includes(id);
    const g = (this.g = new THREE.Group()); g.position.copy(pos); game.scene.add(g);
    g.add(mesh(new THREE.CylinderGeometry(0.08, 0.1, 2.8, 8), toon(PAL.white), 0, 1.4, 0));
    g.add(mesh(new THREE.SphereGeometry(0.16, 10, 8), toon(PAL.gold), 0, 2.85, 0));
    g.add(mesh(new THREE.CylinderGeometry(0.4, 0.5, 0.2, 12), toon(PAL.stone), 0, 0.1, 0));
    const fg = new THREE.Shape(); fg.moveTo(0, 0); fg.lineTo(1.2, -0.35); fg.lineTo(0, -0.7);
    this.flagMat = toon(this.on ? PAL.pink : 0xc9c3d6, { unique: true });
    this.flag = mesh(new THREE.ShapeGeometry(fg), this.flagMat, 0.08, this.on ? 2.7 : 0.9, 0);
    this.flag.material.side = THREE.DoubleSide; g.add(this.flag);
    this.t = 0;
  }
  update(dt) {
    this.t += dt;
    this.flag.rotation.y = Math.sin(this.t * 3) * 0.25;
    if (this.on) { this.flag.position.y = damp(this.flag.position.y, 2.7, 5, dt); return; }
    const p = this.game.player;
    if (Math.hypot(p.pos.x - this.pos.x, p.pos.z - this.pos.z) < 1.6 && Math.abs(p.pos.y - this.pos.y) < 2.5) {
      this.on = true; this.flagMat.color.set(PAL.pink);
      this.game.activateCheckpoint(this);
    }
  }
}

// ---------------------------------------------------------------------------
// NPC models: all original critters built from rounded shapes
// ---------------------------------------------------------------------------
function eyes(g, y, z, spread = 0.16, size = 1, scale = 1) {
  const list = [];
  for (const sx of [-1, 1]) {
    const e = new THREE.Group(); e.position.set(spread * sx * scale, y, z);
    const w = mesh(SPH, basic(0xffffff), 0, 0, 0, false, false); w.scale.set(0.09 * size, 0.11 * size, 0.05 * size);
    const pu = mesh(SPH, basic(0x1d1f33), 0, -0.005, 0.035 * size, false, false); pu.scale.set(0.055 * size, 0.07 * size, 0.03 * size);
    const gl = mesh(SPH, basic(0xffffff), 0.02, 0.03, 0.06 * size, false, false); gl.scale.setScalar(0.02 * size);
    e.add(w, pu, gl); g.add(e); list.push(e);
  }
  return list;
}
function smile(g, y, z, r = 0.06) {
  const m = mesh(new THREE.TorusGeometry(r, 0.014, 6, 12, Math.PI), basic(0x1d1f33), 0, y, z, false, false); m.rotation.z = Math.PI; g.add(m); return m;
}

export function buildNPC(kind) {
  const g = new THREE.Group(); const body = new THREE.Group(); g.add(body);
  let eyeList = [], voice = 400, height = 1.6;
  switch (kind) {
    case "grandma": { // Grandma Wick, a kindly old candle
      body.add(mesh(new THREE.CylinderGeometry(0.42, 0.48, 1.3, 20), toon(PAL.cream), 0, 0.65, 0));
      for (let i = 0; i < 5; i++) { const d = mesh(SPH, toon(PAL.cream), Math.cos(i * 1.3) * 0.42, 1.15 - (i % 3) * 0.15, Math.sin(i * 1.3) * 0.42); d.scale.set(0.09, 0.2, 0.09); body.add(d); }
      const shawl = mesh(new THREE.TorusGeometry(0.46, 0.12, 8, 20), toon(PAL.coral), 0, 0.62, 0); shawl.rotation.x = Math.PI / 2; body.add(shawl);
      body.add(mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.18, 6), toon(0x3a3a3a), 0, 1.38, 0));
      const flame = mesh(SPH, basic(0xffd27a), 0, 1.58, 0, false, false); flame.scale.set(0.12, 0.2, 0.12); body.add(flame); g.userData.flame = flame;
      const fl2 = mesh(SPH, basic(0xfff5c9), 0, 1.55, 0.02, false, false); fl2.scale.set(0.06, 0.1, 0.06); body.add(fl2);
      eyeList = eyes(body, 1.05, 0.42, 0.13, 0.9);
      for (const sx of [-1, 1]) { const gl = mesh(new THREE.TorusGeometry(0.075, 0.012, 6, 16), basic(0x7a5a4a), sx * 0.13, 1.05, 0.47, false, false); body.add(gl); }
      smile(body, 0.88, 0.45);
      voice = 300; height = 1.7; break;
    }
    case "mayor": { // Mayor Pip, a turtle in a tall hat
      const shell = mesh(new THREE.SphereGeometry(0.7, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), toon(PAL.leafDark), 0, 0.35, -0.1); shell.scale.y = 0.9; body.add(shell);
      for (let i = 0; i < 6; i++) { const sp = mesh(SPH, toon(PAL.mint), Math.cos(i) * 0.4, 0.75, -0.1 + Math.sin(i) * 0.4); sp.scale.set(0.16, 0.06, 0.16); body.add(sp); }
      body.add(mesh(new THREE.CylinderGeometry(0.72, 0.72, 0.14, 20), toon(0xf0e0b0), 0, 0.33, -0.1));
      const head = mesh(SPH, toon(PAL.lime), 0, 0.9, 0.55); head.scale.setScalar(0.34); body.add(head);
      eyeList = eyes(body, 1.0, 0.82, 0.12, 0.9);
      const stache = mesh(new THREE.TorusGeometry(0.1, 0.035, 6, 12, Math.PI), toon(0xffffff), 0, 0.84, 0.86); stache.rotation.z = Math.PI; body.add(stache);
      const hat = mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.42, 16), toon(PAL.pink), 0, 1.42, 0.5); body.add(hat);
      body.add(mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.04, 16), toon(PAL.pink), 0, 1.22, 0.5));
      body.add(mesh(new THREE.CylinderGeometry(0.205, 0.205, 0.07, 16), toon(PAL.mint), 0, 1.28, 0.5));
      for (const sx of [-1, 1]) { const leg = mesh(SPH, toon(PAL.lime), sx * 0.4, 0.15, 0.3); leg.scale.set(0.16, 0.15, 0.16); body.add(leg); }
      voice = 220; height = 1.8; break;
    }
    case "coco": { // Coco the crab shopkeeper
      const b = mesh(SPH, toon(PAL.coral), 0, 0.55, 0); b.scale.set(0.6, 0.42, 0.45); body.add(b);
      for (const sx of [-1, 1]) {
        body.add(mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.35, 6), toon(PAL.coral), sx * 0.18, 1.05, 0.15));
        const claw = mesh(SPH, toon(PAL.pink), sx * 0.75, 0.75, 0.25); claw.scale.set(0.24, 0.18, 0.2); body.add(claw);
        for (let k = 0; k < 3; k++) { const l = mesh(new THREE.CylinderGeometry(0.035, 0.03, 0.4, 5), toon(PAL.coral), sx * (0.35 + k * 0.12), 0.2, -0.1 + k * 0.1); l.rotation.z = sx * 0.7; body.add(l); }
      }
      eyeList = [];
      for (const sx of [-1, 1]) { const e = new THREE.Group(); e.position.set(sx * 0.18, 1.25, 0.15); const w = mesh(SPH, basic(0xffffff)); w.scale.setScalar(0.1); const p = mesh(SPH, basic(0x1d1f33), 0, 0, 0.07); p.scale.setScalar(0.05); e.add(w, p); body.add(e); eyeList.push(e); }
      const apron = mesh(new THREE.BoxGeometry(0.5, 0.35, 0.05), toon(0xffffff), 0, 0.45, 0.45); body.add(apron);
      smile(body, 0.62, 0.45, 0.08);
      voice = 520; height = 1.4; break;
    }
    case "nell": { // Nell the owl, lighthouse keeper
      const b = mesh(SPH, toon(PAL.peach), 0, 0.75, 0); b.scale.set(0.55, 0.7, 0.5); body.add(b);
      const belly = mesh(SPH, toon(PAL.cream), 0, 0.65, 0.2); belly.scale.set(0.38, 0.48, 0.35); body.add(belly);
      for (const sx of [-1, 1]) { const w = mesh(SPH, toon(PAL.coral), sx * 0.5, 0.75, -0.05); w.scale.set(0.14, 0.4, 0.3); w.rotation.z = sx * 0.2; body.add(w); const tuft = mesh(new THREE.ConeGeometry(0.1, 0.3, 6), toon(PAL.coral), sx * 0.3, 1.4, 0); tuft.rotation.z = -sx * 0.4; body.add(tuft); }
      eyeList = eyes(body, 1.05, 0.38, 0.17, 1.4);
      for (const sx of [-1, 1]) { const ring = mesh(new THREE.TorusGeometry(0.15, 0.02, 6, 16), basic(0xb07a5a), sx * 0.17, 1.05, 0.46, false, false); body.add(ring); }
      const beak = mesh(new THREE.ConeGeometry(0.06, 0.15, 6), toon(PAL.gold), 0, 0.88, 0.48); beak.rotation.x = Math.PI / 2 + 0.3; body.add(beak);
      const cap = mesh(new THREE.CylinderGeometry(0.28, 0.32, 0.18, 16), toon(0x6b7fc2), 0, 1.5, 0); body.add(cap);
      body.add(mesh(new THREE.BoxGeometry(0.4, 0.04, 0.2), toon(0x3d4166), 0, 1.42, 0.3));
      voice = 600; height = 1.8; break;
    }
    case "dot": { // Dot, a tiny puffball kid
      const b = mesh(SPH, toon(PAL.pink), 0, 0.42, 0); b.scale.setScalar(0.4); body.add(b);
      for (let i = 0; i < 14; i++) { const a = i * 2.39, h = ((i * 0.37) % 1) * 2 - 1, r = Math.sqrt(1 - h * h); const sp = mesh(new THREE.ConeGeometry(0.05, 0.16, 5), toon(PAL.coral), Math.cos(a) * r * 0.42, 0.42 + h * 0.42, Math.sin(a) * r * 0.42); sp.lookAt(sp.position.clone().multiplyScalar(2).sub(V(0, 0.42, 0))); sp.rotateX(Math.PI / 2); if (sp.position.z > 0.25 && Math.abs(sp.position.y - 0.5) < 0.2) continue; body.add(sp); }
      eyeList = eyes(body, 0.5, 0.36, 0.12, 1.1);
      const beanie = mesh(new THREE.SphereGeometry(0.32, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), toon(PAL.mint), 0, 0.72, 0); body.add(beanie);
      body.add(mesh(new THREE.SphereGeometry(0.08, 8, 6), toon(PAL.white), 0, 1.04, 0));
      smile(body, 0.36, 0.39, 0.05);
      voice = 760; height = 1.1; break;
    }
    case "bo": { // Sailor Bo, a frog who runs the beach races
      const b = mesh(SPH, toon(PAL.leaf), 0, 0.55, 0); b.scale.set(0.55, 0.5, 0.5); body.add(b);
      const belly = mesh(SPH, toon(PAL.lime), 0, 0.45, 0.22); belly.scale.set(0.38, 0.32, 0.3); body.add(belly);
      eyeList = [];
      for (const sx of [-1, 1]) { const e = new THREE.Group(); e.position.set(sx * 0.22, 1.02, 0.15); const lid = mesh(SPH, toon(PAL.leaf)); lid.scale.setScalar(0.16); const w = mesh(SPH, basic(0xffffff), 0, 0, 0.07); w.scale.setScalar(0.11); const p = mesh(SPH, basic(0x1d1f33), 0, 0, 0.15); p.scale.setScalar(0.055); e.add(lid, w, p); body.add(e); eyeList.push(e); }
      smile(body, 0.66, 0.48, 0.14);
      const hat = mesh(new THREE.CylinderGeometry(0.3, 0.34, 0.16, 16), toon(0xffffff), 0, 1.2, -0.05); body.add(hat);
      body.add(mesh(new THREE.CylinderGeometry(0.31, 0.31, 0.05, 16), toon(0x7cc7e8), 0, 1.21, -0.05));
      const scarf = mesh(new THREE.TorusGeometry(0.42, 0.06, 6, 20), toon(PAL.coral), 0, 0.82, 0); scarf.rotation.x = Math.PI / 2; body.add(scarf);
      voice = 340; height = 1.4; break;
    }
    case "sal": { // Old Sal the walrus
      const b = mesh(SPH, toon(0xc3b4d6), 0, 0.7, 0); b.scale.set(0.85, 0.7, 0.7); body.add(b);
      const snout = mesh(SPH, toon(0xe0d4ea), 0, 0.72, 0.58); snout.scale.set(0.38, 0.22, 0.2); body.add(snout);
      for (const sx of [-1, 1]) { const t = mesh(new THREE.ConeGeometry(0.06, 0.4, 6), toon(0xffffff), sx * 0.15, 0.48, 0.66); t.rotation.x = Math.PI; body.add(t); }
      eyeList = eyes(body, 1.02, 0.6, 0.22, 0.8);
      const hat = mesh(new THREE.ConeGeometry(0.3, 0.4, 12), toon(PAL.peach), 0, 1.45, 0); body.add(hat);
      voice = 160; height = 1.6; break;
    }
  }
  g.userData = { ...g.userData, body, eyes: eyeList, voice, height };
  bake(body, eyeList, [g.userData.flame]);
  return g;
}

export class NPC {
  constructor(game, kind, id, name, pos, facing = 0) {
    this.game = game; this.kind = kind; this.id = id; this.name = name;
    this.model = buildNPC(kind); this.model.position.copy(pos); this.model.rotation.y = facing;
    this.voice = this.model.userData.voice; this.facing = facing; this.baseFacing = facing;
    game.scene.add(this.model);
    this.pos = pos; this.t = Math.random() * 4; this.talking = false; this.blink = 3;
    this.solid = game.level.addCyl(pos.x, pos.z, 0.6, pos.y, pos.y + this.model.userData.height, { noWall: true });
    const bubble = textSprite("E", { bg: "#ff8b94", color: "#fff", stroke: "#ff8b94", height: 0.45 });
    bubble.position.set(0, this.model.userData.height + 0.6, 0); this.model.add(bubble); bubble.visible = false; this.bubble = bubble;
    this.happy = 0;
  }
  update(dt) {
    this.t += dt;
    const b = this.model.userData.body, p = this.game.player;
    const d = Math.hypot(p.pos.x - this.pos.x, p.pos.z - this.pos.z);
    const near = d < 3.2 && Math.abs(p.pos.y - this.pos.y) < 2;
    this.near = near;
    this.bubble.visible = near && !this.game.dialog.open;
    if (this.bubble.visible) this.bubble.position.y = this.model.userData.height + 0.6 + Math.sin(this.t * 4) * 0.08;
    const want = near || this.talking ? Math.atan2(p.pos.x - this.pos.x, p.pos.z - this.pos.z) : this.baseFacing;
    this.facing += angDiff(this.facing, want) * Math.min(1, dt * 5);
    this.model.rotation.y = this.facing;
    // idle bounce, hop when happy
    this.happy = Math.max(0, this.happy - dt);
    const hop = this.happy > 0 ? Math.abs(Math.sin(this.t * 10)) * 0.4 : 0;
    b.position.y = hop + Math.sin(this.t * 2.2) * 0.02;
    b.scale.y = 1 + Math.sin(this.t * 2.2) * 0.03 + (this.talking ? Math.sin(this.t * 18) * 0.03 : 0);
    // blink
    this.blink -= dt; const closed = this.blink < 0.12;
    for (const e of this.model.userData.eyes) e.scale.y = closed ? 0.1 : 1;
    if (this.blink < 0) this.blink = 2 + Math.random() * 3;
    if (this.model.userData.flame) this.model.userData.flame.scale.set(0.12, 0.2 + Math.sin(this.t * 20) * 0.03, 0.12);
  }
}

// ---------------------------------------------------------------------------
// Enemies
// ---------------------------------------------------------------------------
class Enemy {
  constructor(game, pos) {
    this.game = game; this.home = pos.clone(); this.pos = pos.clone(); this.vel = V(0, 0, 0);
    this.alive = true; this.t = Math.random() * 5; this.g = new THREE.Group(); this.g.position.copy(pos); game.scene.add(this.g);
    this.r = 0.6; this.h = 0.9; this.dead = 0; this.facing = Math.random() * 6; this.stun = 0;
  }
  playerContact() {
    const p = this.game.player;
    if (!this.alive || p.state === "lose") return null;
    const dx = p.pos.x - this.pos.x, dz = p.pos.z - this.pos.z, d = Math.hypot(dx, dz);
    if (d > this.r + 0.45 || p.pos.y > this.pos.y + this.h + 0.3 || p.pos.y + 1.1 < this.pos.y) return null;
    const above = p.vel.y < 0 && p.pos.y > this.pos.y + this.h * 0.45;
    return { above, attack: ["poundfall", "dive", "roll", "slide"].includes(p.state), dx, dz, d };
  }
  defeat(bits = 3, how = "pop") {
    const g = this.game;
    this.alive = false; this.dead = 0.001;
    g.audio.sfx("pop"); g.shake(0.08);
    g.fx.emit({ x: this.pos.x, y: this.pos.y + 0.5, z: this.pos.z, count: 22, color: [PAL.mint, PAL.lime, PAL.peach, 0xffffff], speed: 5, life: 0.55, size: 0.45 });
    g.rings.spawn(this.pos.x, this.pos.y + 0.1, this.pos.z, 0xffffff, 2.2, 0.35);
    g.bits.burst(this.pos.x, this.pos.y, this.pos.z, bits);
    g.stats.enemies = (g.stats.enemies || 0) + 1;
    if (this.onDefeat) this.onDefeat(this);
  }
  stompBounce() { const p = this.game.player; p.vel.y = 14; p.body.grounded = false; p.setState("jump"); p.resetAir(); this.game.audio.sfx("stomp"); p.trick("stomp", "Stomp"); }
  ground() { const gr = this.game.level.groundBelow(this.pos.x, this.pos.z, this.pos.y + 0.6, 0.3); return gr ? gr.top : this.home.y; }
  deathAnim(dt) {
    this.dead += dt;
    this.g.scale.set(1 + this.dead * 3, Math.max(0.01, 1 - this.dead * 6), 1 + this.dead * 3);
    if (this.dead > 0.18) { this.g.visible = false; }
  }
}

// Bloblet: a wobbly jelly that hops at you. Stomp it or cap it.
export class Bloblet extends Enemy {
  constructor(game, pos) {
    super(game, pos);
    const mat = new THREE.MeshToonMaterial({ color: PAL.mint, transparent: true, opacity: 0.88 });
    this.body = mesh(SPH, mat, 0, 0.45, 0); this.body.scale.set(0.6, 0.48, 0.6); this.g.add(this.body);
    const core = mesh(SPH, toon(PAL.leafDark), 0, 0.42, 0); core.scale.setScalar(0.22); this.g.add(core);
    this.eyes = eyes(this.g, 0.6, 0.5, 0.18, 1.2);
    const brow = mesh(new THREE.BoxGeometry(0.4, 0.05, 0.05), basic(0x1d1f33), 0, 0.78, 0.5, false); brow.rotation.z = 0; this.g.add(brow); this.brow = brow;
    this.hop = 0; this.state = "wander"; this.r = 0.6; this.h = 0.95; this.target = this.home.clone();
  }
  update(dt) {
    if (!this.alive) return this.deathAnim(dt);
    this.t += dt; const p = this.game.player;
    const toP = Math.hypot(p.pos.x - this.pos.x, p.pos.z - this.pos.z);
    if (this.stun > 0) { this.stun -= dt; this.g.rotation.z = Math.sin(this.t * 20) * 0.2; }
    else {
      this.state = toP < 8 && Math.abs(p.pos.y - this.pos.y) < 3 ? "chase" : "wander";
      if (this.state === "wander" && (this.t % 3 < dt)) this.target.set(this.home.x + (Math.random() - 0.5) * 6, 0, this.home.z + (Math.random() - 0.5) * 6);
      const tx = this.state === "chase" ? p.pos.x : this.target.x, tz = this.state === "chase" ? p.pos.z : this.target.z;
      const want = Math.atan2(tx - this.pos.x, tz - this.pos.z); this.facing += angDiff(this.facing, want) * Math.min(1, dt * 6);
      this.hop += dt * (this.state === "chase" ? 3.2 : 1.8);
      const air = Math.sin(this.hop * Math.PI);
      const sp = this.state === "chase" ? 4.2 : 1.6;
      if (air > 0 && Math.hypot(tx - this.pos.x, tz - this.pos.z) > 0.5) { this.pos.x += Math.sin(this.facing) * sp * dt; this.pos.z += Math.cos(this.facing) * sp * dt; }
      // stay near home
      const hd = Math.hypot(this.pos.x - this.home.x, this.pos.z - this.home.z);
      if (hd > 10) { this.pos.x = this.home.x + (this.pos.x - this.home.x) * 10 / hd; this.pos.z = this.home.z + (this.pos.z - this.home.z) * 10 / hd; }
      if (this.game.level.pointInside(this.pos.x, this.pos.y + 0.5, this.pos.z, 0.4)) { this.pos.x -= Math.sin(this.facing) * sp * dt * 2; this.pos.z -= Math.cos(this.facing) * sp * dt * 2; this.facing += 1; }
      this.pos.y = this.ground() + Math.max(0, air) * 0.7;
      const sq = air > 0 ? 1 + air * 0.15 : 1 - 0.12;
      this.body.scale.set(0.6 / Math.sqrt(sq), 0.48 * sq, 0.6 / Math.sqrt(sq));
      this.brow.rotation.z = this.state === "chase" ? 0.0 : 0; this.brow.visible = this.state === "chase";
      this.g.rotation.z = 0;
    }
    this.g.position.copy(this.pos); this.g.rotation.y = this.facing;
    const c = this.playerContact();
    if (c) {
      if (c.above || c.attack) { if (c.above && !c.attack) this.stompBounce(); this.defeat(3); }
      else p.hurt(this.pos.x, this.pos.z);
    }
  }
  hitByCap() { this.defeat(3); }
}

// Gullbomb: a cranky seagull that circles and swoops down at you
export class Gullbomb extends Enemy {
  constructor(game, pos) {
    super(game, pos);
    const b = mesh(SPH, toon(0xffffff), 0, 0, 0); b.scale.set(0.42, 0.36, 0.6); this.g.add(b);
    const head = mesh(SPH, toon(0xffffff), 0, 0.25, 0.45); head.scale.setScalar(0.27); this.g.add(head);
    const beak = mesh(new THREE.ConeGeometry(0.08, 0.32, 6), toon(PAL.gold), 0, 0.2, 0.78); beak.rotation.x = Math.PI / 2; this.g.add(beak);
    this.wings = [];
    for (const sx of [-1, 1]) { const w = new THREE.Group(); w.position.set(sx * 0.3, 0.08, 0); const wm = mesh(SPH, toon(0xdfe6f2), sx * 0.55, 0, 0); wm.scale.set(0.6, 0.06, 0.28); w.add(wm); const tip = mesh(SPH, toon(0x3d4166), sx * 1.05, 0, -0.02); tip.scale.set(0.14, 0.05, 0.18); w.add(tip); this.g.add(w); this.wings.push(w); }
    const e = eyes(this.g, 0.34, 0.66, 0.11, 0.7);
    bake(this.g, [...this.wings, ...e]);
    const brow = mesh(new THREE.BoxGeometry(0.3, 0.04, 0.04), basic(0x1d1f33), 0, 0.45, 0.68, false); brow.rotation.z = 0.0; this.g.add(brow);
    this.ang = Math.random() * 6; this.state = "circle"; this.r = 0.7; this.h = 0.8; this.swoopT = 0; this.cool = 2;
  }
  update(dt) {
    if (!this.alive) { this.pos.y -= dt * 6; this.g.position.copy(this.pos); return this.deathAnim(dt); }
    this.t += dt; const p = this.game.player;
    const flap = Math.sin(this.t * (this.state === "swoop" ? 6 : 12));
    for (let i = 0; i < 2; i++) this.wings[i].rotation.z = (i ? -1 : 1) * flap * 0.6;
    this.cool -= dt;
    if (this.stun > 0) { this.stun -= dt; this.pos.y -= dt * 2; }
    else if (this.state === "circle") {
      this.ang += dt * 0.7;
      const tx = this.home.x + Math.cos(this.ang) * 5, tz = this.home.z + Math.sin(this.ang) * 5;
      this.pos.x = damp(this.pos.x, tx, 2, dt); this.pos.z = damp(this.pos.z, tz, 2, dt); this.pos.y = damp(this.pos.y, this.home.y + Math.sin(this.t) * 0.5, 2, dt);
      this.facing = Math.atan2(-Math.sin(this.ang), Math.cos(this.ang));
      const hd = Math.hypot(p.pos.x - this.pos.x, p.pos.z - this.pos.z);
      if (hd < 11 && this.cool <= 0 && p.pos.y < this.pos.y && p.pos.y > this.pos.y - 14) {
        this.state = "warn"; this.swoopT = 0; this.game.audio.sfx("gasp", { pitch: 1.8, caption: "[Gull squawks!]" });
      }
    } else if (this.state === "warn") {
      this.swoopT += dt; this.facing = Math.atan2(p.pos.x - this.pos.x, p.pos.z - this.pos.z);
      this.pos.y += dt * 2; this.g.rotation.x = -0.4;
      if (this.swoopT > 0.6) { this.state = "swoop"; this.swoopT = 0; const d = V(p.pos.x - this.pos.x, p.pos.y + 0.6 - this.pos.y, p.pos.z - this.pos.z).normalize(); this.vel.copy(d.multiplyScalar(14)); }
    } else if (this.state === "swoop") {
      this.swoopT += dt; this.pos.addScaledVector(this.vel, dt); this.g.rotation.x = 0.5;
      if (this.swoopT > 1.3 || this.game.level.pointInside(this.pos.x, this.pos.y, this.pos.z, 0.3)) { this.state = "rise"; this.swoopT = 0; }
    } else if (this.state === "rise") {
      this.pos.y = damp(this.pos.y, this.home.y, 1.5, dt); this.g.rotation.x = -0.3;
      if (Math.abs(this.pos.y - this.home.y) < 0.6) { this.state = "circle"; this.cool = 3; this.g.rotation.x = 0; }
    }
    this.g.position.copy(this.pos); this.g.rotation.y = this.facing;
    const pc = p.center, d = pc.distanceTo(this.pos);
    if (d < 1.1 && p.state !== "lose") {
      if (p.vel.y < 0 && pc.y > this.pos.y + 0.2) { this.stompBounce(); this.defeat(4); }
      else if (["dive", "roll", "poundfall"].includes(p.state)) this.defeat(4);
      else p.hurt(this.pos.x, this.pos.z);
    }
  }
  hitByCap() { this.defeat(4); }
}

// Pearl Clam: sits still, opens up and spits pearls. Only open clams can be beaten.
export class PearlClam extends Enemy {
  constructor(game, pos) {
    super(game, pos);
    this.bottom = mesh(new THREE.SphereGeometry(0.75, 16, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), toon(PAL.coral), 0, 0.4, 0); this.g.add(this.bottom);
    this.lid = new THREE.Group(); this.lid.position.set(0, 0.4, -0.7); this.g.add(this.lid);
    const top = mesh(new THREE.SphereGeometry(0.75, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), toon(PAL.pink), 0, 0, 0.7); this.lid.add(top);
    for (let i = 0; i < 5; i++) { const r = mesh(new THREE.TorusGeometry(0.75, 0.025, 4, 16, Math.PI), toon(0xffffff), 0, 0, 0.7); r.rotation.y = (i - 2) * 0.3; r.rotation.x = 0; this.lid.add(r); }
    const inner = mesh(SPH, toon(0xffe0ea), 0, 0.45, 0); inner.scale.set(0.55, 0.12, 0.55); this.g.add(inner);
    this.ee = eyes(this.g, 0.62, 0.35, 0.16, 1); this.ee.forEach((e) => (e.visible = false));
    bake(this.g, [this.lid, ...this.ee]);
    this.pearls = []; this.cycle = Math.random() * 2; this.open = 0; this.r = 0.85; this.h = 0.9;
  }
  update(dt) {
    for (const pr of this.pearls) {
      pr.t += dt; pr.m.position.addScaledVector(pr.v, dt);
      const p = this.game.player;
      if (pr.alive && p.center.distanceTo(pr.m.position) < 0.7) { pr.alive = false; p.hurt(pr.m.position.x, pr.m.position.z); }
      if (pr.alive && this.game.level.pointInside(pr.m.position.x, pr.m.position.y, pr.m.position.z, 0.1)) pr.alive = false;
      if (pr.t > 3) pr.alive = false;
      if (!pr.alive) { this.game.scene.remove(pr.m); this.game.fx.emit({ x: pr.m.position.x, y: pr.m.position.y, z: pr.m.position.z, count: 4, color: 0xffffff, speed: 2, life: 0.3, size: 0.25 }); }
    }
    this.pearls = this.pearls.filter((p) => p.alive);
    if (!this.alive) return this.deathAnim(dt);
    this.t += dt; const p = this.game.player;
    const d = Math.hypot(p.pos.x - this.pos.x, p.pos.z - this.pos.z);
    this.facing += angDiff(this.facing, Math.atan2(p.pos.x - this.pos.x, p.pos.z - this.pos.z)) * Math.min(1, dt * 3);
    this.cycle += dt;
    const active = d < 16;
    const ph = this.cycle % 3;
    const opening = active && ph > 1.0 && ph < 2.6;
    this.open = damp(this.open, opening ? 1 : 0, 10, dt);
    this.lid.rotation.x = -this.open * 0.9;
    this.ee.forEach((e) => (e.visible = this.open > 0.4));
    if (active && ph > 1.6 && ph - dt <= 1.6) this.shoot();
    this.g.rotation.y = this.facing;
    const c = this.playerContact();
    if (c) {
      if ((c.above || c.attack) && this.open > 0.4) { if (c.above) this.stompBounce(); this.defeat(4); }
      else if (c.above) { this.stompBounce(); this.game.audio.sfx("enemyhit"); }
      else p.hurt(this.pos.x, this.pos.z);
    }
  }
  shoot() {
    const g = this.game, p = g.player;
    const m = mesh(SPH, new THREE.MeshToonMaterial({ color: 0xfff7f2, emissive: 0xffd3e0, emissiveIntensity: 0.4 }), this.pos.x, this.pos.y + 0.6, this.pos.z, true, false); m.scale.setScalar(0.25);
    g.scene.add(m);
    const v = V(p.pos.x - this.pos.x, p.pos.y + 0.6 - (this.pos.y + 0.6), p.pos.z - this.pos.z).normalize().multiplyScalar(9);
    this.pearls.push({ m, v, t: 0, alive: true });
    g.audio.sfx("pop", { pitch: 0.7 });
  }
  hitByCap(cap) {
    if (this.open > 0.4) this.defeat(4);
    else { this.open = 0; this.game.audio.sfx("enemyhit", { pitch: 1.4 }); cap.state = "return"; }
  }
  capPearls(cpos) {
    for (const pr of this.pearls) if (pr.alive && pr.m.position.distanceTo(cpos) < 0.8) pr.alive = false;
  }
}

// Shellback: a crab with a hard shell. Flip it with the cap first, then stomp!
export class Shellback extends Enemy {
  constructor(game, pos) {
    super(game, pos);
    this.inner = new THREE.Group(); this.g.add(this.inner);
    const shell = mesh(new THREE.SphereGeometry(0.75, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), toon(0x9b8ec4), 0, 0.35, 0); shell.scale.y = 0.85; this.inner.add(shell);
    for (let i = 0; i < 6; i++) { const sp = mesh(new THREE.ConeGeometry(0.12, 0.3, 6), toon(PAL.white), Math.cos(i) * 0.45, 0.85, Math.sin(i) * 0.45); this.inner.add(sp); }
    const belly = mesh(new THREE.CylinderGeometry(0.72, 0.72, 0.12, 16), toon(PAL.peach), 0, 0.34, 0); this.inner.add(belly);
    for (const sx of [-1, 1]) { const cl = mesh(SPH, toon(PAL.coral), sx * 0.85, 0.5, 0.35); cl.scale.set(0.22, 0.16, 0.2); this.inner.add(cl); for (let k = 0; k < 3; k++) { const l = mesh(new THREE.CylinderGeometry(0.04, 0.03, 0.42, 5), toon(PAL.coral), sx * (0.5 + k * 0.08), 0.18, -0.2 + k * 0.2); l.rotation.z = sx * 0.8; this.inner.add(l); } }
    this.ee = eyes(this.inner, 0.62, 0.62, 0.16, 1);
    bake(this.inner, this.ee);
    this.flipped = 0; this.dir = 1; this.r = 0.8; this.h = 1.0;
  }
  update(dt) {
    if (!this.alive) return this.deathAnim(dt);
    this.t += dt; const p = this.game.player;
    if (this.flipped > 0) {
      this.flipped -= dt;
      this.inner.rotation.z = damp(this.inner.rotation.z, Math.PI, 12, dt); this.inner.position.y = damp(this.inner.position.y, 0.75, 12, dt);
      this.inner.rotation.y = Math.sin(this.t * 14) * 0.15;
      if (this.flipped <= 0) this.game.audio.sfx("enemyhit", { pitch: 0.8 });
    } else {
      this.inner.rotation.z = damp(this.inner.rotation.z, 0, 12, dt); this.inner.position.y = damp(this.inner.position.y, 0, 12, dt);
      // scuttle sideways, turning to face the player
      this.facing += angDiff(this.facing, Math.atan2(p.pos.x - this.pos.x, p.pos.z - this.pos.z)) * Math.min(1, dt * 2);
      const side = this.facing + Math.PI / 2;
      if (this.t % 2.4 < dt) this.dir *= -1;
      const nx = this.pos.x + Math.sin(side) * this.dir * 2.2 * dt, nz = this.pos.z + Math.cos(side) * this.dir * 2.2 * dt;
      if (Math.hypot(nx - this.home.x, nz - this.home.z) < 5 && !this.game.level.pointInside(nx, this.pos.y + 0.5, nz, 0.5)) { this.pos.x = nx; this.pos.z = nz; } else this.dir *= -1;
      this.inner.position.y = Math.abs(Math.sin(this.t * 12)) * 0.05;
    }
    this.pos.y = this.ground();
    this.g.position.copy(this.pos); this.g.rotation.y = this.facing;
    const c = this.playerContact();
    if (c) {
      if (this.flipped > 0) { if (c.above && !c.attack) this.stompBounce(); this.defeat(5); }
      else if (c.above) { this.stompBounce(); this.game.audio.sfx("enemyhit"); this.game.ui.toast("Too hard! Flip it with your cap first.", 1.6); }
      else p.hurt(this.pos.x, this.pos.z);
    }
  }
  hitByCap(cap) {
    if (this.flipped > 0) { this.defeat(5); return; }
    this.flipped = 3.2; this.game.audio.sfx("stomp", { pitch: 1.3 }); this.game.tutorialDone("flip");
    this.game.fx.emit({ x: this.pos.x, y: this.pos.y + 0.8, z: this.pos.z, count: 10, color: [0xffffff, PAL.gold], speed: 3, life: 0.4, size: 0.3 });
    cap.state = "return";
  }
}

// Spiky urchin: a hazard. Don't touch!
export class Urchin {
  constructor(game, pos) {
    this.game = game; this.pos = pos; this.alive = true; this.t = Math.random() * 4;
    this.g = new THREE.Group(); this.g.position.copy(pos); game.scene.add(this.g);
    const core = mesh(SPH, toon(0x8a6fb8), 0, 0.5, 0); core.scale.setScalar(0.42); this.g.add(core);
    for (let i = 0; i < 22; i++) { const a = i * 2.39, h = ((i * 0.618) % 1) * 2 - 1, r = Math.sqrt(1 - h * h); const sp = mesh(new THREE.ConeGeometry(0.07, 0.45, 5), toon(0xd6c4f0), Math.cos(a) * r * 0.45, 0.5 + h * 0.45, Math.sin(a) * r * 0.45); sp.lookAt(V(Math.cos(a) * r, 0.5 + h, Math.sin(a) * r).multiplyScalar(3)); sp.rotateX(Math.PI / 2); this.g.add(sp); }
    bake(this.g, eyes(this.g, 0.62, 0.38, 0.13, 0.9));
  }
  update(dt) {
    this.t += dt; this.g.rotation.y = Math.sin(this.t) * 0.3; this.g.scale.setScalar(1 + Math.sin(this.t * 4) * 0.04);
    const p = this.game.player, c = p.center;
    if (Math.hypot(c.x - this.pos.x, c.z - this.pos.z) < 0.95 && Math.abs(c.y - (this.pos.y + 0.5)) < 1.0) p.hurt(this.pos.x, this.pos.z);
  }
  hitByCap(cap) { cap.state = "return"; this.game.audio.sfx("enemyhit", { pitch: 0.8 }); }
}
