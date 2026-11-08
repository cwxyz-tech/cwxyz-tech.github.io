// SHELLSHOCK: a giant grumpy hermit crab who hid the Bay's Sparkheart inside
// his shell. Make him slam his claw into the sand (or charge into a rock),
// then cap-bounce up onto his shell and ground pound the glowing gem.
import * as THREE from "../vendor/three.module.min.js";
import { PAL, toon, basic, mesh, damp, clamp, angDiff, textSprite, mergeStatic, rbox } from "./fx.js?v=16";

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const SPH = new THREE.SphereGeometry(1, 20, 14);

export class Shellshock {
  constructor(game, center) {
    this.game = game; this.center = center.clone();
    this.pos = center.clone(); this.facing = Math.PI / 2;
    this.hp = 3; this.state = "sleep"; this.t = 0; this.st = 0; this.seq = []; this.seqI = 0;
    this.active = false; this.dead = false;
    const g = (this.g = new THREE.Group()); g.position.copy(this.pos); game.scene.add(g);
    this.inner = new THREE.Group(); g.add(this.inner);
    // body
    const body = mesh(SPH, toon(0xe8675e), 0, 1.6, 0.6); body.scale.set(2.0, 1.3, 1.6); this.inner.add(body);
    const belly = mesh(SPH, toon(0xf6a48c), 0, 1.3, 1.6); belly.scale.set(1.4, 0.9, 0.7); this.inner.add(belly);
    // legs
    this.legs = [];
    for (const sx of [-1, 1]) for (let k = 0; k < 3; k++) {
      const l = new THREE.Group(); l.position.set(sx * 1.6, 1.0, -0.2 + k * 0.8);
      const seg = mesh(new THREE.CylinderGeometry(0.16, 0.12, 1.6, 8), toon(0xd9564f), sx * 0.5, -0.4, 0); seg.rotation.z = sx * 1.0; l.add(seg);
      this.inner.add(l); this.legs.push(l);
    }
    // eye stalks
    this.eyes = [];
    for (const sx of [-1, 1]) {
      const st = new THREE.Group(); st.position.set(sx * 0.7, 2.6, 1.5);
      st.add(mesh(new THREE.CylinderGeometry(0.1, 0.14, 1.0, 8), toon(0xe8675e), 0, 0.5, 0));
      const eye = mesh(SPH, basic(0xffffff), 0, 1.1, 0); eye.scale.setScalar(0.38); st.add(eye);
      const pu = mesh(SPH, basic(0x1d1f33), 0, 1.08, 0.3); pu.scale.set(0.18, 0.22, 0.1); st.add(pu);
      const brow = mesh(rbox(0.66, 0.16, 0.16), toon(0x3a2430), sx * 0.05, 1.45, 0.2); brow.rotation.z = sx * 0.45; st.add(brow);
      this.inner.add(st); this.eyes.push({ st, pu, eye });
    }
    // mouth
    const mouth = mesh(new THREE.TorusGeometry(0.4, 0.07, 6, 14, Math.PI), basic(0x4a1f33), 0, 1.6, 2.15); this.inner.add(mouth); this.mouth = mouth;
    // claws
    this.claws = [];
    for (const sx of [-1, 1]) {
      const arm = new THREE.Group(); arm.position.set(sx * 2.0, 1.8, 1.4);
      const up = mesh(new THREE.CylinderGeometry(0.28, 0.32, 1.6, 10), toon(0xe0605a), 0, 0, 0.8); up.rotation.x = Math.PI / 2; arm.add(up);
      const claw = new THREE.Group(); claw.position.set(0, 0, 1.8); arm.add(claw);
      const big = mesh(SPH, toon(0xe8675e), 0, 0.15, 0.5); big.scale.set(0.8, 0.55, 0.95); claw.add(big);
      const pinch = mesh(SPH, toon(0xf08a78), 0, -0.45, 0.7); pinch.scale.set(0.55, 0.3, 0.75); claw.add(pinch);
      this.inner.add(arm); this.claws.push({ arm, claw, sx });
    }
    // the big spiral shell
    this.shell = new THREE.Group(); this.shell.position.set(0, 2.4, -0.6); this.inner.add(this.shell);
    for (let i = 0; i < 6; i++) {
      const r = 2.2 - i * 0.32;
      const tor = mesh(new THREE.TorusGeometry(r, 0.55 - i * 0.05, 10, 28), toon(i % 2 ? 0xfaf0e2 : 0xefdcc6), 0, 0.4 + i * 0.55, 0);
      tor.rotation.x = Math.PI / 2; this.shell.add(tor);
    }
    const fill = mesh(new THREE.ConeGeometry(2.3, 3.4, 24), toon(0xefdcc6), 0, 1.6, 0); this.shell.add(fill);
    const topPlate = mesh(new THREE.CylinderGeometry(1.4, 1.5, 0.3, 20), toon(0xfaf0e2), 0, 3.55, 0); this.shell.add(topPlate);
    // gem holding the Bay's Sparkheart
    this.gemMat = new THREE.MeshToonMaterial({ color: 0xf08ad8, emissive: 0xd05ec0, emissiveIntensity: 0.55 }); this.gemMat.defines = { CF_GLOSS: "", CF_SMOOTH: "" };
    this.gem = mesh(new THREE.OctahedronGeometry(0.6, 0), this.gemMat, 0, 4.1, 0); this.shell.add(this.gem);
    this.gemGlow = new THREE.Mesh(SPH, new THREE.MeshBasicMaterial({ color: 0xf6a8e6, transparent: true, opacity: 0.25, depthWrite: false }));
    this.gemGlow.scale.setScalar(1.1); this.gemGlow.position.y = 4.1; this.shell.add(this.gemGlow);
    // sleep bubble
    this.zz = textSprite("Z z z", { color: "#fff", stroke: "#3d4166", height: 0.8 }); this.zz.position.set(0, 7.5, 1); g.add(this.zz);

    // merge the static parts (moving limbs, eyes and the gem stay separate)
    for (const l of this.legs) l.userData.dynamic = true;
    for (const e of this.eyes) { e.st.userData.dynamic = true; e.eye.userData.keep = true; e.pu.userData.keep = true; }
    for (const c of this.claws) c.arm.userData.dynamic = true;
    this.shell.userData.dynamic = true; this.gem.userData.keep = true; this.mouth.userData.keep = true;
    mergeStatic(this.inner);
    // collision: body + standable shell top
    const lv = game.level;
    this.bodySolid = lv.addCyl(this.pos.x, this.pos.z, 2.4, this.pos.y, this.pos.y + 3.6, { unsafe: true, noWallJump: true });
    this.topSolid = lv.addCyl(this.pos.x, this.pos.z - 0.6 * 0, 1.55, this.pos.y + 5.5, this.pos.y + 6.05, { unsafe: true, noWall: true, bossTop: true });
    this.stars = [];
    this.bombs = []; this.waves = []; this.warns = [];
    this.inv = 0;
    this.speedK = 1;
    this.clawI = 0;
  }

  start() {
    this.active = true; this.state = "idle"; this.st = 0; this.zz.visible = false;
    this.buildSeq();
  }
  buildSeq() {
    const ph = 4 - this.hp;
    this.speedK = [1, 1, 1.3, 1.6][ph];
    this.seq = ph === 1 ? ["slam", "slam!", "charge"]
      : ph === 2 ? ["slam", "bombs", "slam", "slam!", "charge"]
        : ["spin", "slam", "bombs", "slam!", "charge", "bombs"];
    this.seqI = 0;
  }
  next() {
    const a = this.seq[this.seqI % this.seq.length]; this.seqI++;
    const p = this.game.player;
    if (a === "slam" || a === "slam!") { this.state = "slamWind"; this.stuckAfter = a === "slam!"; this.clawI ^= 1; this.target = V(p.pos.x, this.center.y, p.pos.z); this.warn(this.target, 2.4); }
    else if (a === "charge") { this.state = "chargeWind"; }
    else if (a === "bombs") { this.state = "bombs"; this.dropBombs(3 + (4 - this.hp)); }
    else if (a === "spin") { this.state = "spin"; this.game.audio.sfx("roar"); }
    this.st = 0;
  }

  warn(pos, r) {
    const m = new THREE.Mesh(new THREE.RingGeometry(r * 0.75, r, 32), new THREE.MeshBasicMaterial({ color: 0xff5f70, transparent: true, opacity: 0.7, depthWrite: false, side: THREE.DoubleSide }));
    m.rotation.x = -Math.PI / 2; m.position.set(pos.x, this.center.y + 0.06, pos.z); this.game.scene.add(m);
    this.warns.push({ m, t: 0, life: 1.2 / this.speedK });
  }

  dropBombs(n) {
    const p = this.game.player;
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, r = i === 0 ? 0 : 2 + Math.random() * 5;
      let x = p.pos.x + Math.cos(a) * r, z = p.pos.z + Math.sin(a) * r;
      const dc = Math.hypot(x - this.center.x, z - this.center.z); if (dc > 12) { x = this.center.x + (x - this.center.x) * 12 / dc; z = this.center.z + (z - this.center.z) * 12 / dc; }
      const m = new THREE.Group();
      const ball = mesh(SPH, toon(0x8a5a3a), 0, 0, 0); ball.scale.setScalar(0.55); m.add(ball);
      m.add(mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.3, 5), toon(PAL.wood), 0, 0.6, 0));
      m.position.set(x, 22 + i * 3, z); this.game.scene.add(m);
      const target = V(x, this.center.y, z); this.warn(target, 1.8);
      this.bombs.push({ m, v: 0, target });
    }
    this.game.audio.sfx("gasp", { pitch: 0.6, caption: "[Coconuts falling!]" });
  }

  vulnerable() { return this.state === "stuck" || this.state === "dizzy"; }

  update(dt) {
    const g = this.game, p = g.player;
    this.t += dt; this.st += dt; this.inv = Math.max(0, this.inv - dt);
    const k = this.speedK;
    // idle breathing / sleep
    const breathe = Math.sin(this.t * 2) * 0.04;
    this.inner.scale.set(1 + breathe, 1 - breathe, 1 + breathe);
    this.zz.position.y = 7.5 + Math.sin(this.t * 1.5) * 0.3;
    // gem glow when it can be hit
    const vul = this.vulnerable();
    this.gemMat.color.set(vul ? PAL.mint : 0xf08ad8); this.gemMat.emissive.set(vul ? PAL.mint : 0xd05ec0);
    this.gemGlow.material.color.set(vul ? PAL.mint : PAL.pink);
    this.gemGlow.scale.setScalar((vul ? 1.5 : 1.1) + Math.sin(this.t * 8) * 0.12);
    this.gem.rotation.y += dt * 2;

    const toP = Math.atan2(p.pos.x - this.pos.x, p.pos.z - this.pos.z);
    for (const e of this.eyes) { e.pu.position.x = clamp(angDiff(this.facing, toP), -0.5, 0.5) * 0.25; }

    if (this.dead) { this.updateDeath(dt); this.sync(); return; }
    if (!this.active) { this.sync(); return; }

    switch (this.state) {
      case "idle": {
        this.facing += angDiff(this.facing, toP) * Math.min(1, dt * 3 * k);
        this.walkAnim(dt, 1);
        if (this.st > 1.1 / k) this.next();
        break;
      }
      case "slamWind": {
        const c = this.claws[this.clawI];
        this.facing += angDiff(this.facing, Math.atan2(this.target.x - this.pos.x, this.target.z - this.pos.z)) * Math.min(1, dt * 5);
        c.arm.rotation.x = damp(c.arm.rotation.x, -1.3, 8, dt);
        if (this.st > 0.9 / k) { this.state = "slam"; this.st = 0; }
        break;
      }
      case "slam": {
        const c = this.claws[this.clawI];
        c.arm.rotation.x = damp(c.arm.rotation.x, 0.75, 30, dt);
        if (this.st > 0.08 && !this.slammed) {
          this.slammed = true;
          const cp = c.claw.getWorldPosition(V(0, 0, 0));
          g.audio.sfx("boom"); g.shake(0.6); g.input.rumble(1, 250);
          g.fx.emit({ x: cp.x, y: this.center.y + 0.2, z: cp.z, count: 40, color: [PAL.peach, 0xffffff, PAL.lime], speed: 8, up: 4, life: 0.7, size: 0.55 });
          this.wave(cp.x, cp.z);
          if (4 - this.hp >= 2) this.pendingWave = { t: 0.45, x: cp.x, z: cp.z };
        }
        if (this.st > 0.5) {
          this.slammed = false;
          if (this.stuckAfter) { this.state = "stuck"; this.st = 0; g.audio.sfx("gasp", { pitch: 0.5, caption: "[Shellshock's claw is stuck!]" }); g.ui.toast("His claw is stuck! Get on his shell and ground pound the gem!", 2.4); }
          else { this.state = "recover"; this.st = 0; }
        }
        break;
      }
      case "recover": {
        for (const c of this.claws) c.arm.rotation.x = damp(c.arm.rotation.x, 0, 6, dt);
        if (this.st > 0.5 / k) { this.state = "idle"; this.st = 0; }
        break;
      }
      case "stuck": {
        const c = this.claws[this.clawI];
        c.arm.rotation.x = 0.75 + Math.sin(this.t * 30) * 0.05;
        this.inner.rotation.z = Math.sin(this.t * 18) * 0.03;
        if (this.st % 0.3 < dt) g.fx.emit({ x: this.pos.x, y: this.center.y + 0.3, z: this.pos.z + 3, count: 3, color: PAL.peach, speed: 2, up: 2, life: 0.4, size: 0.4 });
        if (this.st > [0, 3.8, 3.2, 2.7][4 - this.hp]) { this.state = "recover"; this.st = 0; this.inner.rotation.z = 0; this.shakeOff(); }
        break;
      }
      case "chargeWind": {
        this.facing += angDiff(this.facing, toP) * Math.min(1, dt * 6);
        this.inner.position.z = -Math.sin(this.st * 30) * 0.08;
        if (this.st % 0.12 < dt) g.fx.emit({ x: this.pos.x - Math.sin(this.facing) * 2, y: this.center.y + 0.2, z: this.pos.z - Math.cos(this.facing) * 2, count: 3, color: [PAL.peach, 0xffffff], speed: 2, up: 2, life: 0.5, size: 0.5 });
        if (this.st > 0.9 / k) { this.state = "charge"; this.st = 0; g.audio.sfx("roar"); this.chargeDir = this.facing; }
        break;
      }
      case "charge": {
        const sp = 15 * (0.9 + 0.15 * (4 - this.hp));
        this.pos.x += Math.sin(this.chargeDir) * sp * dt; this.pos.z += Math.cos(this.chargeDir) * sp * dt;
        this.walkAnim(dt, 3);
        if (this.st % 0.06 < dt) g.fx.emit({ x: this.pos.x, y: this.center.y + 0.2, z: this.pos.z, count: 3, color: [PAL.peach, 0xffffff], speed: 3, up: 2, life: 0.5, size: 0.5 });
        const dc = Math.hypot(this.pos.x - this.center.x, this.pos.z - this.center.z);
        if (dc > 10.5) {
          this.state = "dizzy"; this.st = 0; g.audio.sfx("boom"); g.shake(0.7); g.input.rumble(1, 300);
          g.fx.emit({ x: this.pos.x + Math.sin(this.chargeDir) * 2.5, y: this.center.y + 2, z: this.pos.z + Math.cos(this.chargeDir) * 2.5, count: 30, color: [PAL.stone, 0xffffff], speed: 6, life: 0.6, size: 0.5 });
          this.makeStars();
          g.ui.toast("He's dizzy! Get on top of his shell!", 2);
        }
        break;
      }
      case "dizzy": {
        this.inner.rotation.y = Math.sin(this.t * 6) * 0.15;
        for (const s of this.stars) { s.a += dt * 3; s.m.position.set(Math.cos(s.a) * 1.5, 8 + Math.sin(s.a * 2) * 0.2, Math.sin(s.a) * 1.5); s.m.rotation.y += dt * 4; }
        if (this.st > [0, 3.6, 3.0, 2.6][4 - this.hp]) { this.clearStars(); this.inner.rotation.y = 0; this.state = "returnHome"; this.st = 0; this.shakeOff(); }
        break;
      }
      case "returnHome": {
        const d = V(this.center.x - this.pos.x, 0, this.center.z - this.pos.z); const dl = d.length();
        this.facing += angDiff(this.facing, Math.atan2(d.x, d.z)) * Math.min(1, dt * 5);
        if (dl > 0.3) { const sp = Math.min(dl, 7 * k * dt); this.pos.x += (d.x / dl) * sp; this.pos.z += (d.z / dl) * sp; this.walkAnim(dt, 1.5); }
        if (dl < 4 || this.st > 2.5) { this.state = "idle"; this.st = 0; }
        break;
      }
      case "bombs": {
        this.inner.rotation.z = Math.sin(this.t * 10) * 0.05; for (const c of this.claws) c.arm.rotation.x = -0.8 + Math.sin(this.t * 10 + c.sx) * 0.4;
        if (this.st > 1.6) { this.inner.rotation.z = 0; this.state = "recover"; this.st = 0; }
        break;
      }
      case "spin": {
        this.inner.rotation.y += dt * 9;
        for (const c of this.claws) c.arm.rotation.y = c.sx * 0.9;
        const d = V(p.pos.x - this.pos.x, 0, p.pos.z - this.pos.z), dl = d.length();
        if (dl > 1) { const sp = 4.5 * dt; this.pos.x += (d.x / dl) * sp; this.pos.z += (d.z / dl) * sp; }
        if (dl > 2.4 && dl < 4.6 && p.pos.y < this.center.y + 1.6) p.hurt(this.pos.x, this.pos.z);
        if (this.st % 0.25 < dt) g.audio.sfx("throw", { pitch: 0.6 });
        if (this.st > 4) { this.state = "recover"; this.st = 0; this.inner.rotation.y = 0; for (const c of this.claws) c.arm.rotation.y = 0; }
        break;
      }
      case "hurt": {
        this.inner.rotation.z = Math.sin(this.t * 30) * 0.12 * Math.max(0, 1 - this.st);
        if (this.st > 1.4) { this.inner.rotation.z = 0; this.state = "returnHome"; this.st = 0; this.buildSeq(); }
        break;
      }
    }
    // stay inside the cove
    const dc = Math.hypot(this.pos.x - this.center.x, this.pos.z - this.center.z);
    if (dc > 11) { this.pos.x = this.center.x + (this.pos.x - this.center.x) * 11 / dc; this.pos.z = this.center.z + (this.pos.z - this.center.z) * 11 / dc; }

    this.updateHazards(dt);
    this.sync();
    this.checkPlayer();
  }

  walkAnim(dt, sp) { this.legs.forEach((l, i) => (l.rotation.x = Math.sin(this.t * 8 * sp + i * 1.7) * 0.35)); }

  wave(x, z) {
    const m = new THREE.Mesh(new THREE.TorusGeometry(1, 0.22, 6, 48), new THREE.MeshToonMaterial({ color: PAL.white, emissive: PAL.peach, emissiveIntensity: 0.4 }));
    m.rotation.x = Math.PI / 2; m.position.set(x, this.center.y + 0.25, z); this.game.scene.add(m);
    this.waves.push({ m, x, z, r: 1, hit: false });
  }

  updateHazards(dt) {
    const g = this.game, p = g.player;
    if (this.pendingWave) { this.pendingWave.t -= dt; if (this.pendingWave.t <= 0) { const w = this.pendingWave; this.pendingWave = null; this.wave(w.x, w.z); } }
    for (const w of this.waves) {
      w.r += dt * 9.5 * this.speedK;
      w.m.scale.set(w.r, w.r, 1);
      const d = Math.hypot(p.pos.x - w.x, p.pos.z - w.z);
      if (!w.hit && Math.abs(d - w.r) < 0.55 && p.pos.y < this.center.y + 0.65) { w.hit = true; p.hurt(w.x, w.z); }
      if (w.r > 16) { g.scene.remove(w.m); w.done = true; }
    }
    this.waves = this.waves.filter((w) => !w.done);
    for (const b of this.bombs) {
      b.v -= 26 * dt; b.m.position.y += b.v * dt; b.m.rotation.x += dt * 4;
      if (b.m.position.y <= this.center.y + 0.5) {
        g.scene.remove(b.m); b.done = true;
        g.audio.sfx("boom"); g.shake(0.25);
        g.fx.emit({ x: b.target.x, y: this.center.y + 0.5, z: b.target.z, count: 26, color: [PAL.coral, PAL.peach, 0xfff1a8], speed: 7, life: 0.5, size: 0.5 });
        g.rings.spawn(b.target.x, this.center.y, b.target.z, PAL.coral, 3.2, 0.35);
        if (Math.hypot(p.pos.x - b.target.x, p.pos.z - b.target.z) < 1.9 && p.pos.y < this.center.y + 2) p.hurt(b.target.x, b.target.z);
      }
    }
    this.bombs = this.bombs.filter((b) => !b.done);
    for (const w of this.warns) { w.t += dt; w.m.material.opacity = 0.4 + Math.sin(w.t * 20) * 0.3; if (w.t > w.life + 0.6) { g.scene.remove(w.m); w.done = true; } }
    this.warns = this.warns.filter((w) => !w.done);
  }

  makeStars() {
    this.clearStars();
    for (let i = 0; i < 4; i++) {
      const m = mesh(new THREE.OctahedronGeometry(0.3), new THREE.MeshToonMaterial({ color: PAL.gold, emissive: PAL.gold, emissiveIntensity: 0.6 }));
      this.g.add(m); this.stars.push({ m, a: (i / 4) * Math.PI * 2 });
    }
  }
  clearStars() { for (const s of this.stars) this.g.remove(s.m); this.stars = []; }

  // direction from a point toward the middle of the cove (so Fuse never gets flung into the sea)
  inward(x, z, fallback) {
    const dx = this.center.x - x, dz = this.center.z - z, d = Math.hypot(dx, dz);
    if (d < 2) return fallback;
    return Math.atan2(dx, dz);
  }
  shakeOff() {
    const p = this.game.player;
    if (p.body.ground === this.topSolid) {
      const a = this.inward(this.pos.x, this.pos.z, this.facing + Math.PI);
      p.vel.set(Math.sin(a) * 7, 12, Math.cos(a) * 7); p.body.grounded = false; p.setState("jump");
      this.game.audio.sfx("roar");
    }
  }

  checkPlayer() {
    const g = this.game, p = g.player;
    if (p.state === "lose") return;
    // ground pound the gem while he's stuck or dizzy
    if (p.body.ground === this.topSolid && p.state === "poundland" && p.stateT < 0.1 && this.inv <= 0) {
      if (this.vulnerable()) this.takeHit();
      else { this.shakeOff(); g.ui.toast("The gem is shielded! Wait for an opening.", 1.6); }
      return;
    }
    // standing on top when not vulnerable gets you shaken off
    if (p.body.ground === this.topSolid && !this.vulnerable() && p.grounded && this.state !== "hurt") {
      this.shakeT = (this.shakeT || 0) + 1 / 60;
      if (this.shakeT > 0.5) { this.shakeT = 0; this.shakeOff(); }
    }
    // touching his body or claws hurts during attacks
    const d = Math.hypot(p.pos.x - this.pos.x, p.pos.z - this.pos.z);
    const dangerous = ["charge", "slam", "spin"].includes(this.state);
    if (d < 2.95 && p.pos.y < this.pos.y + 3.4 && dangerous) p.hurt(this.pos.x, this.pos.z);
    // the slamming claw
    if (this.state === "slam" && this.st < 0.25) {
      const cp = this.claws[this.clawI].claw.getWorldPosition(V(0, 0, 0));
      if (Math.hypot(p.pos.x - cp.x, p.pos.z - cp.z) < 1.8 && p.pos.y < cp.y + 1) p.hurt(cp.x, cp.z);
    }
  }

  takeHit() {
    const g = this.game, p = g.player;
    this.hp--; this.inv = 1.2;
    this.clearStars();
    g.audio.sfx("bosshit"); g.shake(0.8); g.input.rumble(1, 300);
    g.fx.emit({ x: this.pos.x, y: this.pos.y + 6.2, z: this.pos.z, count: 50, color: [PAL.pink, PAL.mint, 0xffffff, PAL.gold], speed: 9, life: 0.8, size: 0.6 });
    g.rings.spawn(this.pos.x, this.pos.y + 6, this.pos.z, PAL.mint, 5, 0.5);
    // launch Fuse off safely
    const a = this.inward(this.pos.x, this.pos.z, this.facing + Math.PI);
    p.vel.set(Math.sin(a) * 6.5, 15, Math.cos(a) * 6.5); p.body.grounded = false; p.setState("jump3"); p.resetAir();
    g.ui.bossBar(this.hp / 3);
    if (this.hp <= 0) { this.die(); return; }
    this.state = "hurt"; this.st = 0;
    for (const c of this.claws) c.arm.rotation.x = 0;
    g.onBossHit(this.hp);
  }

  die() {
    const g = this.game;
    this.dead = true; this.deadT = 0; this.active = false; this.pendingWave = null;
    for (const w of this.waves) g.scene.remove(w.m); this.waves = [];
    for (const b of this.bombs) g.scene.remove(b.m); this.bombs = [];
    for (const w of this.warns) g.scene.remove(w.m); this.warns = [];
    g.onBossDefeated();
  }
  updateDeath(dt) {
    this.deadT += dt;
    const k = Math.min(1, this.deadT / 2.5);
    this.inner.rotation.z = Math.sin(this.deadT * 25) * 0.15 * (1 - k);
    this.inner.position.y = -k * 1.2;
    this.eyes.forEach((e) => (e.eye.scale.y = 0.38 * (1 - k * 0.9)));
    if (Math.random() < dt * 12 && k < 1) this.game.fx.emit({ x: this.pos.x + (Math.random() - 0.5) * 4, y: this.pos.y + Math.random() * 5, z: this.pos.z + (Math.random() - 0.5) * 4, count: 6, color: [PAL.pink, PAL.peach, 0xffffff], speed: 4, life: 0.5, size: 0.5 });
    if (this.deadT > 1.6) { this.gem.visible = false; this.gemGlow.visible = false; }
    if (this.deadT > 2.6 && !this.slept) { this.slept = true; this.zz.visible = true; this.mouth.rotation.z = 0; }
  }

  sync() {
    this.g.position.copy(this.pos); this.g.rotation.y = this.facing;
    const bs = this.bodySolid, ts = this.topSolid;
    bs.dx = this.pos.x - bs.x; bs.dz = this.pos.z - bs.z; bs.dy = 0; bs.x = this.pos.x; bs.z = this.pos.z;
    // shell top sits over the back of the shell
    const tx = this.pos.x - Math.sin(this.facing) * 0.6, tz = this.pos.z - Math.cos(this.facing) * 0.6;
    ts.dx = tx - ts.x; ts.dz = tz - ts.z; ts.dy = 0; ts.x = tx; ts.z = tz;
    if (this.dead) { bs.enabled = true; ts.enabled = true; }
  }
  gemWorld() { return this.gem.getWorldPosition(V(0, 0, 0)); }
}
