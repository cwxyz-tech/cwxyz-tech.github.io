// Fuse's controls: run, sprint, jump, double jump, wall jump, ground pound,
// roll, DIVE and the signature cap throw + cap bounce. Plus the camera.
import * as THREE from "../vendor/three.module.min.js";
import { FuseModel, buildCap } from "./fuse.js";
import { PAL, blobShadow, damp, clamp, angDiff, lerp } from "./fx.js";

const G = 38, TERMINAL = -30;
const T = {
  walk: 7, run: 9.5, sprint: 13, accel: 55, decel: 42, airAccel: 24, turnRate: 14,
  jump: 13.6, jump2: 12.8, poundJump: 17, capBounce: 15.2, wallJumpUp: 12.6, wallJumpOut: 8.5,
  diveSpeed: 15.5, diveUp: 5.2, rollSpeed: 14.5, coyote: 0.12, buffer: 0.14,
};

export class Player {
  constructor(game) {
    this.game = game;
    this.model = new FuseModel();
    this.root = new THREE.Group(); this.root.add(this.model.root);
    game.scene.add(this.root);
    this.shadow = blobShadow(1.2); game.scene.add(this.shadow);

    this.cap = new Cap(game, this);
    this.body = { pos: new THREE.Vector3(), vel: new THREE.Vector3(), r: 0.42, h: 1.15, grounded: false, ground: null, wasGrounded: false };
    this.facing = 0; this.state = "idle"; this.stateT = 0;
    this.hp = 3; this.maxHp = 3; this.invuln = 0;
    this.idleTime = 0; this.phase = 0;
    this.lastSafe = new THREE.Vector3(); this.safeT = 0;
    this.frozen = false;
    this.resetAir();
    this.coyote = 0; this.jumpBuf = 0; this.poundJumpT = 0;
    this.stepT = 0;
  }

  resetAir() { this.usedDouble = false; this.usedDive = false; this.capBounces = 0; }
  get pos() { return this.body.pos; }
  get vel() { return this.body.vel; }
  get grounded() { return this.body.grounded; }
  get center() { return new THREE.Vector3(this.pos.x, this.pos.y + 0.58, this.pos.z); }

  spawn(x, y, z, facing = 0) {
    this.pos.set(x, y, z); this.vel.set(0, 0, 0); this.facing = facing;
    this.lastSafe.set(x, y, z);
    this.setState("idle"); this.resetAir(); this.cap.reset();
    this.body.grounded = false; this.body.ground = null;
  }

  setState(s) { if (this.state !== s) { this.state = s; this.stateT = 0; } }

  maxBounces() { return this.game.hasUpgrade("twin") ? 2 : 1; }

  hurt(fromX, fromZ, dmg = 1) {
    if (this.invuln > 0 || this.state === "lose") return false;
    this.hp -= dmg;
    const g = this.game;
    g.audio.sfx("hurt"); g.shake(0.35); g.input.rumble(0.8, 200);
    this.invuln = 1.6; this.model.flash = 1.6;
    const dx = this.pos.x - fromX, dz = this.pos.z - fromZ, d = Math.hypot(dx, dz) || 1;
    this.vel.set((dx / d) * 8, 9, (dz / d) * 8);
    this.body.grounded = false;
    this.setState("hurt");
    g.fx.emit({ x: this.pos.x, y: this.pos.y + 0.8, z: this.pos.z, count: 14, color: [PAL.pink, PAL.peach, 0xffffff], speed: 5, life: 0.5, size: 0.35 });
    if (this.hp <= 0) { this.hp = 0; this.lose(); }
    g.ui.hud();
    return true;
  }

  lose() {
    this.setState("lose");
    this.vel.set(0, 0, 0);
    this.game.audio.sfx("fizzle");
    this.game.onPlayerLost();
  }

  // fell in the sea or off the world: fizzle and pop back to safe ground
  fellOut(splash) {
    const g = this.game;
    if (splash) { g.audio.sfx("splash", { caption: "[Splash!]" }); g.fx.emit({ x: this.pos.x, y: 0.2, z: this.pos.z, count: 30, color: [0xffffff, PAL.mint, PAL.sea], speed: 6, up: 6, gravity: 14, life: 0.8, size: 0.45 }); g.rings.spawn(this.pos.x, 0.05, this.pos.z, 0xffffff, 3, 0.7); }
    this.hp -= 1;
    g.ui.hud();
    if (this.hp <= 0) { this.hp = 0; this.lose(); return; }
    g.audio.sfx("hurt");
    g.ui.toast("Fizzle! Bombs can't swim...", 1.6);
    let sp = this.lastSafe;
    const gnd = g.level.groundBelow(sp.x, sp.z, sp.y + 0.5);
    if (!gnd || (g.world.waterY != null && gnd.top < g.world.waterY)) { const cp = g.world.checkpoints[g.save.checkpoint] || g.world.checkpoints.start; sp = cp.pos; }
    this.spawn(sp.x, sp.y + 0.2, sp.z, this.facing);
    this.invuln = 1.5; this.model.flash = 1.5;
  }

  heal(n = 1) { this.hp = Math.min(this.maxHp, this.hp + n); this.game.ui.hud(); }

  update(dt) {
    const g = this.game, inp = g.input, b = this.body, cam = g.cam;
    this.stateT += dt; this.invuln = Math.max(0, this.invuln - dt);
    if (this.state === "lose") { this.model.update(dt, { state: "lose", timer: this.stateT }); this._place(dt); return; }

    const frozen = this.frozen;
    const mv = frozen ? { x: 0, y: 0 } : inp.moveVector();
    const mag = Math.min(1, Math.hypot(mv.x, mv.y));
    // camera-relative direction
    const yaw = cam.yaw;
    const fx = -Math.sin(yaw), fz = -Math.cos(yaw), rx = Math.cos(yaw), rz = -Math.sin(yaw);
    let wx = fx * mv.y + rx * mv.x, wz = fz * mv.y + rz * mv.x;
    const wl = Math.hypot(wx, wz); if (wl > 0) { wx /= wl; wz /= wl; }
    const P = (a) => !frozen && inp.pressed(a), H = (a) => !frozen && inp.held(a);

    if (P("jump")) this.jumpBuf = T.buffer; else this.jumpBuf = Math.max(0, this.jumpBuf - dt);
    if (b.grounded) this.coyote = T.coyote; else this.coyote = Math.max(0, this.coyote - dt);
    this.poundJumpT = Math.max(0, this.poundJumpT - dt);

    const st = this.state;
    const sprint = H("sprint") && mag > 0.3;
    const hs = Math.hypot(this.vel.x, this.vel.z);
    let targetSpeed = mag * (sprint ? T.sprint : T.run);
    if (mag < 0.55 && !sprint) targetSpeed = mag * T.walk * 1.3;

    const busy = ["poundspin", "poundfall", "poundland", "dive", "slide", "roll", "hurt", "wall"].includes(st);

    // ---------- ground pound / dive input ----------
    if (!b.grounded && P("pound") && !["poundspin", "poundfall", "dive", "hurt"].includes(st)) {
      this.setState("poundspin"); this.vel.set(0, 0, 0); g.audio.sfx("pound1");
    }
    const diveNow = P("dive") || (st === "poundspin" && P("throw"));
    if (diveNow && !this.usedDive && (!b.grounded || hs > 3) && !["dive", "slide", "hurt", "poundfall"].includes(st)) this.startDive(wl > 0 ? Math.atan2(wx, wz) : this.facing);

    // ---------- cap throw ----------
    if (P("throw") && st !== "poundspin" && st !== "dive" && st !== "slide" && st !== "hurt" && this.cap.state === "held") {
      this.cap.throw();
      if (!b.grounded && this.vel.y < 3) this.vel.y = 3; // tiny midair float
      if (st !== "roll") this.setState("throw");
    }

    // ---------- state logic ----------
    switch (this.state) {
      case "poundspin":
        this.vel.set(0, 0, 0);
        if (this.stateT > 0.24) { this.setState("poundfall"); this.vel.y = -34; }
        break;
      case "poundfall":
        this.vel.x = this.vel.z = 0; this.vel.y = -34;
        break;
      case "poundland":
        this.vel.x = damp(this.vel.x, 0, 20, dt); this.vel.z = damp(this.vel.z, 0, 20, dt);
        if (this.stateT > 0.3) this.setState("idle");
        if (this.jumpBuf > 0) { this.jumpBuf = 0; this.doJump(T.poundJump, "jump3"); g.audio.sfx("jump3"); this.flipSpin(); }
        break;
      case "dive":
        // steer slightly
        if (wl > 0) { const a = Math.atan2(wx, wz), d = angDiff(this.facing, a); this.facing += clamp(d, -2.2 * dt, 2.2 * dt); }
        { const dsp = Math.max(Math.hypot(this.vel.x, this.vel.z), 4); this.vel.x = Math.sin(this.facing) * dsp; this.vel.z = Math.cos(this.facing) * dsp; }
        if (b.wall && b.wall.speed > 3) { // bonk
          this.vel.set(b.wall.nx * 5, 6, b.wall.nz * 5); this.setState("hurt"); g.audio.sfx("enemyhit"); g.shake(0.2);
          g.fx.emit({ x: this.pos.x, y: this.pos.y + 0.6, z: this.pos.z, count: 8, color: 0xffffff, speed: 4, life: 0.4 });
        }
        break;
      case "slide": {
        const k = Math.exp(-3.2 * dt); this.vel.x *= k; this.vel.z *= k;
        if (this.stateT % 0.08 < dt) g.fx.emit({ x: this.pos.x, y: this.pos.y + 0.1, z: this.pos.z, count: 2, color: [PAL.peach, PAL.lime], speed: 1.5, up: 1.5, life: 0.4, size: 0.3 });
        if (this.jumpBuf > 0 && this.stateT > 0.05) { this.jumpBuf = 0; const sp = Math.max(hs, 8); this.vel.x = Math.sin(this.facing) * sp; this.vel.z = Math.cos(this.facing) * sp; this.doJump(10.5, "jump"); g.audio.sfx("jump2"); this.usedDive = false; }
        else if (hs < 1.5 || this.stateT > 0.9) this.setState("crouch");
        if (!b.grounded && this.state === "slide") this.setState("fall");
        break;
      }
      case "roll": {
        this.rollAngle = (this.rollAngle || 0) + hs * dt / 0.5;
        if (wl > 0) { const a = Math.atan2(wx, wz), d = angDiff(this.facing, a); this.facing += clamp(d, -3 * dt, 3 * dt); }
        const sp = this.stateT < 0.6 || H("pound") ? Math.max(hs, T.rollSpeed) : hs * Math.exp(-4 * dt);
        this.vel.x = Math.sin(this.facing) * sp; this.vel.z = Math.cos(this.facing) * sp;
        if (this.stateT % 0.06 < dt) g.fx.emit({ x: this.pos.x, y: this.pos.y + 0.1, z: this.pos.z, count: 2, color: [PAL.peach, 0xffffff], speed: 1.2, up: 1, life: 0.35, size: 0.3 });
        if (this.jumpBuf > 0) { this.jumpBuf = 0; this.doJump(11.5, "jump"); g.audio.sfx("jump2"); }
        else if (P("pound") && this.stateT > 0.2) { this.stateT = 0; g.audio.sfx("roll"); }
        else if (sp < 4 || (this.stateT > 0.6 && !H("pound") && sp < 8)) this.setState("idle");
        if (b.wall && b.wall.speed > 2) { this.facing = Math.atan2(this.vel.x + b.wall.nx * sp, this.vel.z + b.wall.nz * sp); }
        if (!b.grounded && this.coyote <= 0 && this.state === "roll") this.setState("fall");
        break;
      }
      case "hurt":
        if (b.grounded && this.stateT > 0.25) this.setState("idle");
        this.vel.x = damp(this.vel.x, 0, 1.5, dt); this.vel.z = damp(this.vel.z, 0, 1.5, dt);
        break;
      case "wall": {
        const w = this.wallN;
        if (b.grounded) { this.setState("idle"); break; }
        if (!b.wall) { this.wallLost = (this.wallLost || 0) + dt; if (this.wallLost > 0.1) { this.setState("fall"); break; } } else this.wallLost = 0;
        this.vel.y = Math.max(this.vel.y, -3.2);
        this.vel.x = -w.nx * 2; this.vel.z = -w.nz * 2; // stay pressed against it
        this.facing = Math.atan2(-w.nx, -w.nz);
        if (this.stateT % 0.1 < dt) g.fx.emit({ x: this.pos.x - w.nx * 0.4, y: this.pos.y + 0.5, z: this.pos.z - w.nz * 0.4, count: 1, color: 0xffffff, speed: 1, life: 0.3, size: 0.25 });
        if (this.jumpBuf > 0) {
          this.jumpBuf = 0; this.usedDouble = false;
          this.vel.set(w.nx * T.wallJumpOut, T.wallJumpUp, w.nz * T.wallJumpOut);
          this.facing = Math.atan2(w.nx, w.nz);
          this.setState("jump"); this.airControlLock = 0.18;
          g.audio.sfx("walljump"); g.fx.emit({ x: this.pos.x, y: this.pos.y + 0.6, z: this.pos.z, count: 10, color: [0xffffff, PAL.lime], speed: 3, life: 0.4, size: 0.35 });
        } else if (wl > 0 && wx * w.nx + wz * w.nz > 0.6 && this.stateT > 0.15) { this.setState("fall"); this.vel.x = w.nx * 3; this.vel.z = w.nz * 3; }
        break;
      }
      default: {
        // normal ground / air movement
        if (b.grounded) {
          if (wl > 0) {
            const a = Math.atan2(wx, wz), d = angDiff(this.facing, a);
            // quick 180 turn -> skid
            if (Math.abs(d) > 2.6 && hs > 7) { this.setState("skid"); this.vel.multiplyScalar(0.5); }
            this.facing += clamp(d, -T.turnRate * dt, T.turnRate * dt);
            this.turn = clamp(d * 0.25, -0.3, 0.3);
          }
          const tvx = Math.sin(this.facing) * targetSpeed, tvz = Math.cos(this.facing) * targetSpeed;
          const acc = mag > 0 ? T.accel : T.decel;
          this.vel.x = approach(this.vel.x, wl > 0 ? tvx : 0, acc * dt);
          this.vel.z = approach(this.vel.z, wl > 0 ? tvz : 0, acc * dt);
          if (this.state === "skid") { if (this.stateT > 0.18) this.setState("idle"); }
          else if (this.state === "land" && this.stateT < 0.12) { /* let the squash play */ }
          else if (this.state !== "throw" || this.stateT > 0.3) this.setState(hs > 0.5 ? "run" : "idle");
          if (H("pound") && P("pound") && hs > 4) { this.setState("roll"); g.audio.sfx("roll"); this.rollAngle = 0; }
          else if (H("pound") && hs <= 4 && this.state !== "throw") this.setState("crouch");
        } else {
          this.airControlLock = Math.max(0, (this.airControlLock || 0) - dt);
          if (wl > 0 && this.airControlLock <= 0) {
            const maxAir = Math.max(sprint ? T.sprint : T.run, hs);
            const tvx = wx * maxAir * mag, tvz = wz * maxAir * mag;
            this.vel.x = approach(this.vel.x, tvx, T.airAccel * dt);
            this.vel.z = approach(this.vel.z, tvz, T.airAccel * dt);
            const a = Math.atan2(wx, wz); this.facing += clamp(angDiff(this.facing, a), -6 * dt, 6 * dt);
          }
          if (!["jump", "jump2", "jump3", "throw", "capbounce"].includes(this.state) || (this.state !== "throw" && this.vel.y < -2 && this.stateT > 0.45)) {
            if (this.state !== "throw" || this.stateT > 0.3) this.setState("fall");
          }
          // wall slide when pushing into a wall while falling
          if (b.wall && this.vel.y < 2 && !b.wall.s.noWallJump) {
            const into = wl > 0 ? -(wx * b.wall.nx + wz * b.wall.nz) : 0;
            if (into > 0.3 || hs > 5) { this.wallN = b.wall; this.wallLost = 0; this.setState("wall"); }
          }
          // double jump
          if (this.jumpBuf > 0 && this.coyote <= 0 && !this.usedDouble && this.state !== "wall") {
            this.jumpBuf = 0; this.usedDouble = true; this.doJump(T.jump2, "jump2"); g.audio.sfx("jump2");
            g.fx.emit({ x: this.pos.x, y: this.pos.y, z: this.pos.z, count: 12, color: [PAL.mint, PAL.lime, 0xffffff], speed: 3, life: 0.45, size: 0.4, flat: true });
            g.rings.spawn(this.pos.x, this.pos.y, this.pos.z, PAL.mint, 1.8, 0.35);
          }
        }
        // ground jump (with coyote time + buffer)
        if (this.jumpBuf > 0 && this.coyote > 0 && this.state !== "crouch") {
          this.jumpBuf = 0; this.coyote = 0;
          this.doJump(T.jump + (sprint ? 0.8 : 0), "jump"); g.audio.sfx("jump");
          g.fx.emit({ x: this.pos.x, y: this.pos.y + 0.05, z: this.pos.z, count: 8, color: [PAL.lime, 0xffffff], speed: 2.5, life: 0.35, size: 0.35, flat: true });
        } else if (this.jumpBuf > 0 && this.state === "crouch" && b.grounded) { // backflip
          this.jumpBuf = 0; this.vel.x = -Math.sin(this.facing) * 4; this.vel.z = -Math.cos(this.facing) * 4; this.doJump(17, "jump2"); g.audio.sfx("jump3");
        }
      }
    }

    // variable jump height + gravity
    if (!["poundspin", "poundfall"].includes(this.state)) {
      let grav = G;
      if (this.vel.y > 0 && !H("jump") && ["jump", "jump2"].includes(this.state)) grav *= 2.1;
      if (this.state === "dive") grav = G * 0.75;
      if (this.state === "throw" && !b.grounded && this.vel.y < 0) grav *= 0.55;
      this.vel.y = Math.max(TERMINAL, this.vel.y - grav * dt);
    }

    // ---------- move & collide ----------
    const wasAir = !b.grounded, vyBefore = this.vel.y;
    const landed = g.level.move(b, dt);
    if (landed && wasAir) this.onLand(vyBefore);
    if (b.bump && this.state === "jump") this.vel.y = Math.min(this.vel.y, 0);

    // safe spot tracking for respawn
    if (b.grounded && b.ground && !b.ground.path && !b.ground.unsafe && !b.ground.hazard) {
      this.safeT += dt;
      if (this.safeT > 0.35) this.lastSafe.set(this.pos.x, this.pos.y, this.pos.z);
    } else this.safeT = 0;
    if (b.grounded && b.ground && b.ground.hazard) this.hurt(this.pos.x - Math.sin(this.facing), this.pos.z - Math.cos(this.facing));
    if (b.grounded && b.ground && b.ground.bouncy) { this.vel.y = b.ground.bouncy; b.grounded = false; this.setState("jump3"); this.resetAir(); g.audio.sfx("capbounce"); g.fx.emit({ x: this.pos.x, y: this.pos.y, z: this.pos.z, count: 14, color: [PAL.pink, PAL.peach], speed: 4, life: 0.5, size: 0.4 }); }

    // water / void
    if (g.world.waterY != null && this.pos.y < g.world.waterY - 0.6) this.fellOut(true);
    else if (this.pos.y < g.world.killY) this.fellOut(false);

    // footsteps
    if (this.state === "run" && b.grounded) {
      this.phase += dt * (6 + hs * 1.15);
      if (Math.floor(this.phase / Math.PI) !== Math.floor((this.phase - dt * (6 + hs * 1.15)) / Math.PI)) {
        g.audio.sfx("step", { pitch: 0.8 + Math.random() * 0.4 });
        if (hs > 10) g.fx.emit({ x: this.pos.x, y: this.pos.y + 0.05, z: this.pos.z, count: 2, color: [PAL.peach, 0xffffff], speed: 1.2, up: 1, life: 0.35, size: 0.3 });
      }
    }
    if (sprint && b.grounded && this.stateT % 0.05 < dt) g.fx.emit({ x: this.pos.x, y: this.pos.y + 1.45, z: this.pos.z, count: 1, color: [0xfff1a8, PAL.peach], speed: 1, up: 2, life: 0.3, size: 0.2, gravity: -2 });

    this.idleTime = this.state === "idle" ? this.idleTime + dt : 0;
    if (this.idleTime > 14 && Math.random() < dt * 0.8) g.fx.emit({ x: this.pos.x + 0.3, y: this.pos.y + 1.4, z: this.pos.z, count: 1, color: 0xffffff, speed: 0.2, up: 0.8, gravity: -0.3, life: 1.5, size: 0.35, grow: 1 });

    this.cap.update(dt);
    this._place(dt, hs, sprint);
  }

  doJump(v, anim) {
    this.vel.y = v; this.body.grounded = false; this.coyote = 0;
    this.setState(anim);
  }
  flipSpin() {}

  startDive(angle) {
    const g = this.game;
    this.usedDive = true;
    this.facing = angle;
    const hs = Math.max(T.diveSpeed, Math.hypot(this.vel.x, this.vel.z) * 0.9);
    this.vel.set(Math.sin(angle) * hs, this.body.grounded ? 6.5 : T.diveUp, Math.cos(angle) * hs);
    this.body.grounded = false;
    this.setState("dive");
    g.audio.sfx("dive"); g.input.rumble(0.3, 80);
    g.fx.emit({ x: this.pos.x, y: this.pos.y + 0.6, z: this.pos.z, count: 14, color: [0xffffff, PAL.mint, PAL.peach], speed: 3.5, life: 0.45, size: 0.4 });
    g.tutorialDone("dive");
  }

  capBounce() {
    const g = this.game;
    this.capBounces++;
    this.vel.y = T.capBounce + (g.hasUpgrade("spring") ? 2.2 : 0);
    // keep a bit of the dive momentum but not all of it
    const hs = Math.hypot(this.vel.x, this.vel.z), keep = Math.min(hs, 9) / (hs || 1);
    this.vel.x *= keep; this.vel.z *= keep;
    this.usedDive = false; this.usedDouble = false;
    this.setState("capbounce");
    g.audio.sfx("capbounce"); g.input.rumble(0.5, 100);
    const c = this.cap.mesh.position;
    g.fx.emit({ x: c.x, y: c.y, z: c.z, count: 22, color: [PAL.pink, PAL.mint, PAL.lime, 0xffffff], speed: 5, life: 0.6, size: 0.45 });
    g.rings.spawn(c.x, c.y, c.z, PAL.pink, 2.5, 0.4);
    g.tutorialDone("capbounce");
    g.stats.capBounces = (g.stats.capBounces || 0) + 1;
  }

  onLand(vy) {
    const g = this.game;
    this.resetAir();
    if (this.state === "poundfall") {
      this.setState("poundland"); this.poundJumpT = 0.3;
      g.audio.sfx("pound"); g.shake(0.4); g.input.rumble(0.9, 160);
      g.rings.spawn(this.pos.x, this.pos.y, this.pos.z, 0xffffff, 4.5, 0.45);
      g.fx.emit({ x: this.pos.x, y: this.pos.y + 0.1, z: this.pos.z, count: 26, color: [PAL.peach, PAL.lime, 0xffffff], speed: 7, life: 0.5, size: 0.45, flat: true });
      g.onPound(this.pos.x, this.pos.y, this.pos.z);
      g.tutorialDone("pound");
      return;
    }
    if (this.state === "dive") {
      this.setState("slide"); g.audio.sfx("slide");
      g.fx.emit({ x: this.pos.x, y: this.pos.y + 0.1, z: this.pos.z, count: 12, color: [PAL.peach, 0xffffff], speed: 3, life: 0.4, size: 0.4, flat: true });
      return;
    }
    if (this.state === "hurt") return;
    if (vy < -8) {
      g.audio.sfx("land");
      g.fx.emit({ x: this.pos.x, y: this.pos.y + 0.05, z: this.pos.z, count: Math.min(16, (-vy) | 0), color: [PAL.peach, 0xffffff, PAL.lime], speed: 2.5, life: 0.35, size: 0.35, flat: true });
      if (vy < -22) g.shake(0.15);
      this.setState("land");
    } else this.setState(Math.hypot(this.vel.x, this.vel.z) > 0.5 ? "run" : "idle");
  }

  _place(dt, hs = 0, sprint = false) {
    const p = this.pos;
    this.root.position.copy(p);
    const shown = this.state === "dive" || this.state === "slide" || this.state === "roll" ? this.facing : this.facing;
    this.root.rotation.y = shown;
    let anim = this.state;
    if (anim === "land" && this.stateT > 0.14) anim = "idle";
    this.model.update(dt, {
      state: anim, speed: hs / T.run, vy: this.vel.y, grounded: this.body.grounded, timer: this.stateT,
      phase: this.phase, sprint, idleTime: this.idleTime, turn: this.turn || 0, rollAngle: this.rollAngle || 0,
    });
    if (this.invuln <= 0) this.model.flash = 0;
    // blob shadow on the ground below
    const gb = this.game.level.groundBelow(p.x, p.z, p.y + 0.3, 0.05);
    const water = this.game.world.waterY;
    let sy = gb ? gb.top : water ?? -100;
    if (water != null && (!gb || gb.top < water)) sy = water;
    this.shadow.position.set(p.x, sy + 0.03, p.z);
    const hgt = Math.max(0, p.y - sy);
    this.shadow.scale.setScalar(Math.max(0.3, 1 - hgt * 0.06));
    this.shadow.material.opacity = Math.max(0.15, 1 - hgt * 0.05);
    this.shadow.visible = hgt < 30;
  }
}

function approach(v, t, d) { return v < t ? Math.min(t, v + d) : Math.max(t, v - d); }

// ---------------------------------------------------------------------------
// The cap: thrown forward, spins, hovers (hold the button to hover longer),
// then flies home. Bounce on it in midair for extra height.
// ---------------------------------------------------------------------------
class Cap {
  constructor(game, player) {
    this.game = game; this.player = player;
    this.mesh = new THREE.Group();
    this.inner = buildCap(); this.mesh.add(this.inner);
    this.mesh.visible = false;
    game.scene.add(this.mesh);
    this.trail = [];
    this.state = "held"; this.t = 0;
    this.vel = new THREE.Vector3();
    this.hits = new Set();
  }
  setStyle(style) { this.mesh.remove(this.inner); this.inner = buildCap(style); this.mesh.add(this.inner); }
  reset() { this.state = "held"; this.mesh.visible = false; this.player.model.showCap(true); }

  throw() {
    const p = this.player, g = this.game;
    const dist = g.hasUpgrade("long") ? 1.45 : 1;
    const f = p.facing;
    this.mesh.position.set(p.pos.x + Math.sin(f) * 0.6, p.pos.y + 0.75, p.pos.z + Math.cos(f) * 0.6);
    const sp = 22 * dist;
    this.vel.set(Math.sin(f) * sp, 0, Math.cos(f) * sp);
    // aim a little upward when the player is falling so the cap is easy to catch
    if (!p.grounded && p.vel.y < -4) this.vel.y = -2;
    this.state = "out"; this.t = 0; this.hits.clear();
    this.mesh.visible = true; p.model.showCap(false);
    g.audio.sfx("throw"); g.input.rumble(0.25, 60);
    g.tutorialDone("throw");
  }

  update(dt) {
    const g = this.game, p = this.player;
    if (this.state === "held") return;
    this.t += dt;
    const m = this.mesh;
    const hoverMax = g.hasUpgrade("hover") ? 2.4 : 1.3;
    if (this.state === "out") {
      const k = Math.exp(-5.5 * dt);
      this.vel.multiplyScalar(k);
      const nx = m.position.x + this.vel.x * dt, ny = m.position.y + this.vel.y * dt, nz = m.position.z + this.vel.z * dt;
      if (g.level.pointInside(nx, ny, nz, 0.3)) { this.vel.set(0, 0, 0); this.state = "hover"; this.t = 0; g.audio.sfx("enemyhit", { pitch: 1.6 }); }
      else m.position.set(nx, ny, nz);
      if (this.t > 0.32) { this.state = "hover"; this.t = 0; }
    } else if (this.state === "hover") {
      m.position.y += Math.sin(this.t * 10) * 0.004;
      const holding = g.input.held("throw");
      if (this.t > (holding ? hoverMax : 0.75)) { this.state = "return"; this.t = 0; }
    } else if (this.state === "return") {
      const target = p.center; target.y += 0.4;
      const d = target.sub(m.position), dl = d.length();
      const sp = 18 + this.t * 30;
      if (dl < 0.8) { this.state = "held"; m.visible = false; p.model.showCap(true); g.audio.sfx("capreturn"); return; }
      m.position.addScaledVector(d.normalize(), Math.min(dl, sp * dt));
    }
    // spin + wobble
    this.inner.rotation.y += dt * (this.state === "hover" ? 26 : 34);
    this.inner.rotation.z = Math.sin(this.t * 7) * 0.12;
    if (Math.random() < dt * 30) g.fx.emit({ x: m.position.x, y: m.position.y, z: m.position.z, count: 1, color: [PAL.pink, PAL.mint, PAL.lime], speed: 0.6, life: 0.4, size: 0.3, gravity: 0 });
    if (Math.floor(this.t * 9) !== Math.floor((this.t - dt) * 9)) g.audio.sfx("capspin");

    // bounce check (generous sphere, so Fuse never "misses" the cap)
    if ((this.state === "out" || this.state === "hover") && !p.grounded && p.capBounces < p.maxBounces() && p.state !== "hurt" && p.state !== "poundfall") {
      const c = p.center;
      const dx = c.x - m.position.x, dz = c.z - m.position.z, dy = c.y - m.position.y;
      const near = Math.hypot(dx, dz) < 1.05 && dy > -1.0 && dy < 1.1;
      if (near && (this.t > 0.08 || this.state === "hover")) {
        if (p.state === "poundspin") p.setState("fall");
        p.capBounce();
        this.state = "return"; this.t = 0;
      }
    }
    // the cap hits things
    if (this.state !== "held") g.capHits(m.position, this);
  }
}
