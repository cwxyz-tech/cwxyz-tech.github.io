// Fuse's controls, Odyssey style: run, crouch, long jump, backflip, side
// jump, a real triple jump, midair double jump, wall jump, roll, ground pound,
// DIVE and the signature cap throw + cap bounce.
import * as THREE from "../vendor/three.module.min.js";
import { FuseModel, buildCap } from "./fuse.js?v=14";
import { PAL, blobShadow, damp, clamp, angDiff, lerp } from "./fx.js?v=14";

// lower gravity + bigger launch speeds = faster and floatier than before
const G = 30, TERMINAL = -24;
const T = {
  walk: 7, run: 10, crouchWalk: 4, accel: 60, decel: 48, airAccel: 28, turnRate: 15,
  jump: 13, jump2: 15.8, jump3: 19.5, dbl: 12.2, chainWindow: 0.24,
  longJumpUp: 10, longJumpSpeed: 15.5, sideJump: 18.5, sideJumpSpeed: 4.5, backflip: 19.5,
  poundJump: 19, capBounce: 15.5, wallJumpUp: 13.5, wallJumpOut: 9.5,
  diveSpeed: 15, diveUp: 6, rollSpeed: 14, coyote: 0.12, buffer: 0.14,
};
// airborne states that keep their animation until they start falling
const AIR = { jump: 0.4, jump2: 0.45, jump3: 0.6, djump: 0.45, longjump: 0.7, sidejump: 0.6, backflip: 0.6, throw: 0.3, spinthrow: 0.35, capbounce: 0.45 };

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
    this.coyote = 0; this.jumpBuf = 0; this.chain = 0; this.chainT = 0;
    this.combo = { n: 0, last: null, groundT: 0, tricks: [] };
    this.flow = 0; // momentum: builds with your combo and makes Fuse faster
  }

  // ---------- combos ----------
  // every trick in a row raises the combo (repeating the same trick doesn't),
  // and touching the ground for too long cashes it in for Sparkbits
  trick(id, label) {
    const c = this.combo;
    if (c.last === id && id !== "capbounce" && id !== "stomp") { this.game.ui.combo(c.n, label, true); return; }
    c.n++; c.last = id; c.groundT = 0; c.tricks.push(label);
    this.game.ui.combo(c.n, label);
    if (c.n >= 2) this.game.audio.sfx("bit", { combo: Math.min(12, c.n) });
  }
  endCombo() {
    const c = this.combo, g = this.game;
    if (c.n >= 3) {
      const bonus = Math.min(30, Math.round(c.n * (c.n - 1) / 2)); // 3 -> 3, 5 -> 10, 8+ -> 28-30
      g.addBits(bonus); g.audio.sfx("buy");
      g.fx.emit({ x: this.pos.x, y: this.pos.y + 1.2, z: this.pos.z, count: 20, color: [PAL.gold, 0xffffff, PAL.peach], speed: 4, up: 3, life: 0.6, size: 0.35 });
      g.ui.comboEnd(c.n, bonus);
      g.stats.bestCombo = Math.max(g.stats.bestCombo || 0, c.n);
    } else g.ui.comboEnd(c.n, 0);
    c.n = 0; c.last = null; c.tricks = []; c.groundT = 0;
  }
  get speedMul() { return 1 + this.flow * 0.2; }

  resetAir() { this.usedDouble = false; this.usedDive = false; this.capBounces = 0; }
  get pos() { return this.body.pos; }
  get vel() { return this.body.vel; }
  get grounded() { return this.body.grounded; }
  get center() { return new THREE.Vector3(this.pos.x, this.pos.y + 0.58, this.pos.z); }

  spawn(x, y, z, facing = 0) {
    this.pos.set(x, y, z); this.vel.set(0, 0, 0); this.facing = facing;
    this.lastSafe.set(x, y, z);
    this.setState("idle"); this.resetAir(); this.cap.reset(); this.chain = 0;
    this.body.grounded = false; this.body.ground = null;
  }

  setState(s) { if (this.state !== s) { this.prevState = this.state; this.state = s; this.stateT = 0; } }
  maxBounces() { return this.game.hasUpgrade("twin") ? 2 : 1; }

  hurt(fromX, fromZ, dmg = 1) {
    if (this.invuln > 0 || this.state === "lose") return false;
    this.hp -= dmg;
    const g = this.game;
    if (this.combo.n > 0) { this.combo.n = 0; this.combo.last = null; g.ui.comboEnd(0, 0, true); } // getting hit drops the combo
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

  lose() { this.setState("lose"); this.vel.set(0, 0, 0); this.game.audio.sfx("fizzle"); this.game.onPlayerLost(); }

  // fell in the sea or off the world: fizzle and pop back to safe ground
  fellOut(splash) {
    const g = this.game;
    if (splash) { g.audio.sfx("splash", { caption: "[Splash!]" }); g.fx.emit({ x: this.pos.x, y: 0.2, z: this.pos.z, count: 30, color: [0xffffff, PAL.mint, PAL.sea], speed: 6, up: 6, gravity: 14, life: 0.8, size: 0.45 }); g.rings.spawn(this.pos.x, 0.05, this.pos.z, 0xffffff, 3, 0.7); }
    this.hp -= 1;
    g.ui.hud();
    if (this.hp <= 0) { this.hp = 0; this.lose(); return; }
    g.audio.sfx("hurt");
    g.ui.toast("Fizzle! Bombs can't swim.", 1.6);
    let sp = this.lastSafe;
    const gnd = g.level.groundBelow(sp.x, sp.z, sp.y + 0.5);
    if (!gnd || (g.world.waterY != null && gnd.top < g.world.waterY)) { const cp = g.world.checkpoints[g.save.checkpoint] || g.world.checkpoints.start; sp = cp.pos; }
    this.spawn(sp.x, sp.y + 0.2, sp.z, this.facing);
    this.invuln = 1.5; this.model.flash = 1.5;
  }

  heal(n = 1) { this.hp = Math.min(this.maxHp, this.hp + n); this.game.ui.hud(); }

  dust(n, spd = 2.5, col = [PAL.peach, 0xffffff, PAL.lime]) {
    this.game.fx.emit({ x: this.pos.x, y: this.pos.y + 0.05, z: this.pos.z, count: n, color: col, speed: spd, life: 0.4, size: 0.38, flat: true });
  }

  update(dt) {
    const g = this.game, inp = g.input, b = this.body, cam = g.cam;
    this.stateT += dt; this.invuln = Math.max(0, this.invuln - dt);
    if (this.state === "lose") { this.model.update(dt, { state: "lose", timer: this.stateT }); this._place(dt); return; }

    const frozen = this.frozen;
    const mv = frozen ? { x: 0, y: 0 } : inp.moveVector();
    const mag = Math.min(1, Math.hypot(mv.x, mv.y));
    const yaw = cam.yaw;
    const fx = -Math.sin(yaw), fz = -Math.cos(yaw), rx = Math.cos(yaw), rz = -Math.sin(yaw);
    let wx = fx * mv.y + rx * mv.x, wz = fz * mv.y + rz * mv.x;
    const wl = Math.hypot(wx, wz); if (wl > 0) { wx /= wl; wz /= wl; }
    const inAng = wl > 0 ? Math.atan2(wx, wz) : this.facing;
    const P = (a) => !frozen && inp.pressed(a), H = (a) => !frozen && inp.held(a);

    if (P("jump")) this.jumpBuf = T.buffer; else this.jumpBuf = Math.max(0, this.jumpBuf - dt);
    if (b.grounded) this.coyote = T.coyote; else this.coyote = Math.max(0, this.coyote - dt);
    if (b.grounded) this.chainT = Math.max(0, this.chainT - dt);

    const st = this.state;
    const hs = Math.hypot(this.vel.x, this.vel.z);
    const sm = this.speedMul;
    let targetSpeed = mag * T.run * sm;
    if (mag < 0.55) targetSpeed = mag * T.walk * 1.3;

    // ---------- midair actions ----------
    if (!b.grounded && P("pound") && !["poundspin", "poundfall", "dive", "hurt"].includes(st)) {
      this.setState("poundspin"); this.vel.set(0, 0, 0); g.audio.sfx("pound1");
    }
    const diveNow = (!b.grounded && P("crouch")) || (st === "poundspin" && P("throw"));
    if (diveNow && !this.usedDive && !["dive", "slide", "hurt", "poundfall", "wall"].includes(st)) this.startDive(inAng);

    // ---------- cap throw (crouch + throw on the ground = roll instead) ----------
    if (P("throw") && b.grounded && (st === "crouch" || st === "crouchwalk")) {
      this.setState("roll"); this.facing = inAng; this.rollAngle = 0; g.audio.sfx("roll"); this.dust(10, 3);
      const sp = Math.max(hs, T.rollSpeed * this.speedMul); this.vel.x = Math.sin(this.facing) * sp; this.vel.z = Math.cos(this.facing) * sp;
      g.tutorialDone("roll"); this.trick("roll", "Roll");
    } else if (P("throw") && !["poundspin", "dive", "slide", "hurt", "roll", "wall"].includes(this.state) && this.cap.state === "held") {
      this.cap.throw();
      if (!b.grounded) { if (this.vel.y < 3) this.vel.y = 3; this.setState("spinthrow"); this.trick("spinthrow", "Spin Throw"); }
      else this.setState("throw");
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
        if (this.jumpBuf > 0) { this.jumpBuf = 0; this.doJump(T.poundJump, "jump3"); g.audio.sfx("jump3"); this.dust(16, 4); this.trick("poundjump", "Pound Jump"); }
        else if (this.stateT > 0.3) this.setState("idle");
        break;
      case "dive":
        if (wl > 0) { const d = angDiff(this.facing, inAng); this.facing += clamp(d, -2.4 * dt, 2.4 * dt); }
        { const dsp = Math.max(Math.hypot(this.vel.x, this.vel.z), 4); this.vel.x = Math.sin(this.facing) * dsp; this.vel.z = Math.cos(this.facing) * dsp; }
        if (b.wall && b.wall.speed > 3) { // bonk
          this.vel.set(b.wall.nx * 5, 6, b.wall.nz * 5); this.setState("bonk"); g.audio.sfx("enemyhit"); g.shake(0.2);
          g.fx.emit({ x: this.pos.x, y: this.pos.y + 0.6, z: this.pos.z, count: 8, color: 0xffffff, speed: 4, life: 0.4 });
        }
        break;
      case "bonk":
        if (b.grounded && this.stateT > 0.2) this.setState("idle");
        break;
      case "slide": {
        const k = Math.exp(-3 * dt); this.vel.x *= k; this.vel.z *= k;
        if (this.stateT % 0.07 < dt) this.dust(2, 1.5);
        if (this.jumpBuf > 0 && this.stateT > 0.05) { this.jumpBuf = 0; const sp = Math.max(hs, 9); this.vel.x = Math.sin(this.facing) * sp; this.vel.z = Math.cos(this.facing) * sp; this.doJump(11, "jump"); g.audio.sfx("jump2"); this.usedDive = false; this.trick("hop", "Dive Hop"); }
        else if (hs < 1.5 || this.stateT > 0.9) this.setState(H("crouch") ? "crouch" : "getup");
        if (!b.grounded && this.state === "slide") this.setState("fall");
        break;
      }
      case "getup":
        this.vel.x = damp(this.vel.x, 0, 12, dt); this.vel.z = damp(this.vel.z, 0, 12, dt);
        if (this.stateT > 0.25 || this.jumpBuf > 0) this.setState("idle");
        break;
      case "roll": {
        this.rollAngle = (this.rollAngle || 0) + hs * dt / 0.5;
        if (wl > 0) { const d = angDiff(this.facing, inAng); this.facing += clamp(d, -3.2 * dt, 3.2 * dt); }
        const keep = this.stateT < 0.55 || H("crouch");
        const sp = keep ? Math.max(hs, T.rollSpeed * this.speedMul) : hs * Math.exp(-4 * dt);
        this.vel.x = Math.sin(this.facing) * sp; this.vel.z = Math.cos(this.facing) * sp;
        if (this.stateT % 0.05 < dt) this.dust(2, 1.2, [PAL.peach, 0xffffff]);
        if (this.jumpBuf > 0) { this.jumpBuf = 0; this.vel.x *= 1.1; this.vel.z *= 1.1; this.doJump(12, "longjump"); g.audio.sfx("jump2"); this.trick("rolljump", "Roll Jump"); }
        else if (P("throw") && this.stateT > 0.2) { this.stateT = 0; g.audio.sfx("roll"); this.dust(8, 3); }
        else if (sp < 4 || (!keep && sp < 8)) this.setState("getup");
        if (b.wall && b.wall.speed > 2) this.facing = Math.atan2(this.vel.x + b.wall.nx * sp, this.vel.z + b.wall.nz * sp);
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
        this.vel.y = Math.max(this.vel.y, -3);
        this.vel.x = -w.nx * 2; this.vel.z = -w.nz * 2;
        this.facing = Math.atan2(-w.nx, -w.nz);
        if (this.stateT % 0.08 < dt) g.fx.emit({ x: this.pos.x - w.nx * 0.4, y: this.pos.y + 0.5, z: this.pos.z - w.nz * 0.4, count: 1, color: 0xffffff, speed: 1, life: 0.3, size: 0.25 });
        if (this.jumpBuf > 0) {
          this.jumpBuf = 0; this.usedDouble = false;
          this.vel.set(w.nx * T.wallJumpOut, T.wallJumpUp, w.nz * T.wallJumpOut);
          this.facing = Math.atan2(w.nx, w.nz);
          this.setState("walljump"); this.airControlLock = 0.18;
          g.audio.sfx("walljump"); g.fx.emit({ x: this.pos.x, y: this.pos.y + 0.6, z: this.pos.z, count: 10, color: [0xffffff, PAL.lime], speed: 3, life: 0.4, size: 0.35 });
          g.tutorialDone("walljump"); this.trick("walljump", "Wall Kick");
        } else if (P("crouch")) { this.setState("fall"); this.vel.x = w.nx * 3; this.vel.z = w.nz * 3; }
        break;
      }
      default: {
        if (b.grounded) this.groundMove(dt, wl, inAng, mag, targetSpeed, hs, P, H);
        else this.airMove(dt, wl, wx, wz, inAng, mag, hs, P, H);
      }
    }

    // gravity (hold jump to float a little higher)
    if (!["poundspin", "poundfall"].includes(this.state)) {
      let grav = G;
      const rising = this.vel.y > 0;
      if (rising && ["jump", "jump2", "djump"].includes(this.state)) grav *= H("jump") ? 0.9 : 2.2;
      if (this.state === "dive") grav = G * 0.7;
      if (this.state === "longjump") grav = G * 0.85;
      if ((this.state === "throw" || this.state === "spinthrow") && !b.grounded && this.vel.y < 0) grav *= 0.5;
      if (!rising && this.vel.y > -6 && !b.grounded) grav *= 0.8; // a floaty hang at the top of every jump
      this.vel.y = Math.max(TERMINAL, this.vel.y - grav * dt);
    }

    // ---------- move & collide ----------
    const wasAir = !b.grounded, vyBefore = this.vel.y;
    const landed = g.level.move(b, dt);
    if (landed && wasAir) this.onLand(vyBefore);
    if (b.bump && AIR[this.state] != null) this.vel.y = Math.min(this.vel.y, 0);

    if (b.grounded && b.ground && !b.ground.path && !b.ground.unsafe && !b.ground.hazard) {
      this.safeT += dt;
      if (this.safeT > 0.35) this.lastSafe.set(this.pos.x, this.pos.y, this.pos.z);
    } else this.safeT = 0;
    if (b.grounded && b.ground && b.ground.hazard) this.hurt(this.pos.x - Math.sin(this.facing), this.pos.z - Math.cos(this.facing));
    if (b.grounded && b.ground && b.ground.bouncy) { this.vel.y = b.ground.bouncy; b.grounded = false; this.setState("jump3"); this.resetAir(); g.audio.sfx("capbounce"); g.fx.emit({ x: this.pos.x, y: this.pos.y, z: this.pos.z, count: 14, color: [PAL.pink, PAL.peach], speed: 4, life: 0.5, size: 0.4 }); }

    if (g.world.waterY != null && this.pos.y < g.world.waterY - 0.6) this.fellOut(true);
    else if (this.pos.y < g.world.killY) this.fellOut(false);

    // footsteps + speed sparkles
    if ((this.state === "run" || this.state === "crouchwalk") && b.grounded) {
      const rate = 6 + hs * 1.1;
      this.phase += dt * rate;
      if (Math.floor(this.phase / Math.PI) !== Math.floor((this.phase - dt * rate) / Math.PI)) {
        g.audio.sfx("step", { pitch: 0.8 + Math.random() * 0.4 });
        if (hs > 10) this.dust(2, 1.2, [PAL.peach, 0xffffff]);
      }
    }
    if (hs > 10.5 && b.grounded && this.stateT % 0.05 < dt) g.fx.emit({ x: this.pos.x, y: this.pos.y + 1.45, z: this.pos.z, count: 1, color: [0xfff1a8, PAL.peach], speed: 1, up: 2, life: 0.3, size: 0.2, gravity: -2 });
    // speed lines when you're really moving
    if (hs > 13 && Math.random() < dt * 60) { const k = 0.06; this.game.fx.emit({ x: this.pos.x + (Math.random() - 0.5) * 1.6, y: this.pos.y + 0.2 + Math.random() * 1.2, z: this.pos.z + (Math.random() - 0.5) * 1.6, count: 1, color: 0xffffff, speed: 0, dir: [-this.vel.x * k * 8, 0, -this.vel.z * k * 8], drag: 0, gravity: 0, life: 0.22, size: 0.18 + this.flow * 0.1 }); }
    // trail sparkles on the big flips
    if (["jump3", "backflip", "sidejump", "longjump"].includes(this.state) && Math.random() < dt * 40) g.fx.emit({ x: this.pos.x, y: this.pos.y + 0.6, z: this.pos.z, count: 1, color: [PAL.mint, PAL.pink, PAL.lime, 0xffffff], speed: 0.5, life: 0.5, size: 0.3, gravity: 0 });

    // combo timer: the combo survives rolls, slides and quick touch-downs
    const c = this.combo;
    if (c.n > 0) {
      const keeps = !b.grounded || ["roll", "slide", "poundland", "skid"].includes(this.state) || (this.state === "crouchwalk" && hs > 8) || this.chainT > 0;
      if (keeps) c.groundT = 0; else { c.groundT += dt; if (c.groundT > 0.45) this.endCombo(); }
    }
    this.flow = damp(this.flow, Math.min(1, c.n / 8), c.n > 0 ? 3 : 1.2, dt);

    this.idleTime = this.state === "idle" ? this.idleTime + dt : 0;
    if (this.idleTime > 20 && Math.random() < dt * 0.8) g.fx.emit({ x: this.pos.x + 0.3, y: this.pos.y + 1.4, z: this.pos.z, count: 1, color: 0xffffff, speed: 0.2, up: 0.8, gravity: -0.3, life: 1.5, size: 0.35, grow: 1 });

    this.cap.update(dt);
    this._place(dt, hs);
  }

  groundMove(dt, wl, inAng, mag, targetSpeed, hs, P, H) {
    const g = this.game, st = this.state;
    // crouch, crouch-walk and the momentum slide when you crouch while running
    if (H("crouch") && st !== "throw") {
      if (st !== "crouch" && st !== "crouchwalk") { this.setState(hs > 7 ? "crouchwalk" : "crouch"); if (hs > 7) { g.audio.sfx("slide"); this.dust(6, 2); } }
      if (wl > 0) { const d = angDiff(this.facing, inAng); this.facing += clamp(d, -8 * dt, 8 * dt); }
      const tsp = wl > 0 ? mag * T.crouchWalk : 0;
      const dec = hs > T.crouchWalk + 0.5 ? 14 : 40; // keep running momentum briefly
      const nsp = approach(hs, tsp, dec * dt);
      this.vel.x = Math.sin(this.facing) * nsp; this.vel.z = Math.cos(this.facing) * nsp;
      this.setState(nsp > 0.6 ? "crouchwalk" : "crouch");
      if (this.jumpBuf > 0) {
        this.jumpBuf = 0;
        if (nsp > 2.2) { // LONG JUMP
          const sp = Math.max(T.longJumpSpeed * this.speedMul, hs * 1.1);
          this.vel.x = Math.sin(this.facing) * sp; this.vel.z = Math.cos(this.facing) * sp;
          this.doJump(T.longJumpUp, "longjump"); g.audio.sfx("dive"); this.dust(12, 3);
          g.tutorialDone("longjump"); this.trick("longjump", "Long Jump");
        } else { // BACKFLIP
          this.vel.x = -Math.sin(this.facing) * 5; this.vel.z = -Math.cos(this.facing) * 5;
          this.doJump(T.backflip, "backflip"); g.audio.sfx("jump3"); this.dust(10, 2.5);
          g.tutorialDone("backflip"); this.trick("backflip", "Backflip");
        }
      }
      return;
    }
    // skid: quickly reverse direction while running
    if (st === "skid") {
      this.vel.x = approach(this.vel.x, 0, 60 * dt); this.vel.z = approach(this.vel.z, 0, 60 * dt);
      if (this.stateT % 0.04 < dt) this.dust(2, 2);
      if (this.jumpBuf > 0) { // SIDE JUMP
        this.jumpBuf = 0;
        this.facing = this.skidTo;
        this.vel.x = Math.sin(this.facing) * T.sideJumpSpeed; this.vel.z = Math.cos(this.facing) * T.sideJumpSpeed;
        this.doJump(T.sideJump, "sidejump"); g.audio.sfx("jump3"); this.dust(12, 3);
        g.tutorialDone("sidejump"); this.trick("sidejump", "Side Flip");
        return;
      }
      if (this.stateT > 0.28) { this.facing = this.skidTo; this.setState("run"); }
      return;
    }
    if (wl > 0) {
      const d = angDiff(this.facing, inAng);
      if (Math.abs(d) > 2.4 && hs > 6) { this.setState("skid"); this.skidTo = inAng; g.audio.sfx("slide"); return; }
      const turn = T.turnRate / (1 + Math.max(0, hs - 10) * 0.08); // heavier turns at high speed
      this.facing += clamp(d, -turn * dt, turn * dt);
      this.turn = clamp(d * 0.25, -0.3, 0.3);
    }
    // MOMENTUM: if you're already going faster than a normal run (after a dive,
    // long jump or roll), you keep most of that speed instead of braking hard
    const carry = wl > 0 && hs > targetSpeed + 0.5;
    const spd = carry ? approach(hs, targetSpeed, 9 * dt) : null;
    if (carry) { this.vel.x = Math.sin(this.facing) * spd; this.vel.z = Math.cos(this.facing) * spd; }
    else {
      const tvx = Math.sin(this.facing) * targetSpeed, tvz = Math.cos(this.facing) * targetSpeed;
      const acc = mag > 0 ? T.accel : T.decel;
      this.vel.x = approach(this.vel.x, wl > 0 ? tvx : 0, acc * dt);
      this.vel.z = approach(this.vel.z, wl > 0 ? tvz : 0, acc * dt);
    }
    if (st === "land" && this.stateT < 0.12) { /* let the squash play */ }
    else if (st === "landheavy" && this.stateT < 0.22) { this.vel.x *= 0.85; this.vel.z *= 0.85; }
    else if (st !== "throw" || this.stateT > 0.3) this.setState(hs > 0.5 ? "run" : "idle");
    // ground jump: jump -> higher jump -> TRIPLE JUMP when chained while moving
    if (this.jumpBuf > 0 && this.coyote > 0) {
      this.jumpBuf = 0; this.coyote = 0;
      const chained = this.chainT > 0 && hs > 5;
      this.chain = chained ? Math.min(this.chain + 1, 2) : 0;
      if (this.chain === 2) { this.doJump(T.jump3, "jump3"); g.audio.sfx("jump3"); this.dust(18, 4, [PAL.pink, PAL.mint, 0xffffff]); g.rings.spawn(this.pos.x, this.pos.y, this.pos.z, PAL.pink, 3, 0.4); g.tutorialDone("triple"); this.trick("triple", "Triple Jump"); }
      else if (this.chain === 1) { this.doJump(T.jump2, "jump2"); g.audio.sfx("jump2"); this.dust(10, 3); this.trick("jump2", "Double Jump"); }
      else { this.doJump(T.jump, "jump"); g.audio.sfx("jump"); this.dust(8, 2.5); }
    }
  }

  airMove(dt, wl, wx, wz, inAng, mag, hs, P, H) {
    const g = this.game, b = this.body;
    this.airControlLock = Math.max(0, (this.airControlLock || 0) - dt);
    const lj = this.state === "longjump";
    if (wl > 0 && this.airControlLock <= 0) {
      const maxAir = Math.max(T.run * this.speedMul, hs);
      const acc = T.airAccel * (lj ? 0.35 : 1);
      this.vel.x = approach(this.vel.x, wx * maxAir * mag, acc * dt);
      this.vel.z = approach(this.vel.z, wz * maxAir * mag, acc * dt);
      if (!["sidejump", "backflip"].includes(this.state)) this.facing += clamp(angDiff(this.facing, inAng), -6 * dt, 6 * dt);
    }
    const minT = AIR[this.state];
    if (minT == null) { if (this.state !== "walljump" || this.stateT > 0.35) this.setState("fall"); }
    else if (this.vel.y < -2 && this.stateT > minT) this.setState("fall");
    // wall slide when pushing into a wall while falling
    if (b.wall && this.vel.y < 2 && !b.wall.s.noWallJump && this.state !== "dive") {
      const into = wl > 0 ? -(wx * b.wall.nx + wz * b.wall.nz) : 0;
      if (into > 0.3 || hs > 5) { this.wallN = b.wall; this.wallLost = 0; this.setState("wall"); return; }
    }
    // double jump in midair
    if (this.jumpBuf > 0 && this.coyote <= 0 && !this.usedDouble) {
      this.jumpBuf = 0; this.usedDouble = true; this.doJump(T.dbl, "djump"); g.audio.sfx("jump2");
      g.fx.emit({ x: this.pos.x, y: this.pos.y, z: this.pos.z, count: 12, color: [PAL.mint, PAL.lime, 0xffffff], speed: 3, life: 0.45, size: 0.4, flat: true });
      g.rings.spawn(this.pos.x, this.pos.y, this.pos.z, PAL.mint, 1.8, 0.35);
      g.tutorialDone("jump"); this.trick("djump", "Air Jump");
    }
    // coyote-time ground jump right after walking off a ledge
    if (this.jumpBuf > 0 && this.coyote > 0) { this.jumpBuf = 0; this.coyote = 0; this.doJump(T.jump, "jump"); g.audio.sfx("jump"); }
  }

  doJump(v, anim) {
    this.vel.y = v; this.body.grounded = false; this.coyote = 0;
    this.setState(anim);
    this.airJump = anim; // remembered through the fall, for the triple-jump chain
  }

  startDive(angle) {
    const g = this.game;
    this.usedDive = true;
    this.facing = angle;
    const hs = Math.max(T.diveSpeed * this.speedMul, Math.hypot(this.vel.x, this.vel.z) * 0.95);
    this.vel.set(Math.sin(angle) * hs, this.body.grounded ? 6.5 : T.diveUp, Math.cos(angle) * hs);
    this.body.grounded = false;
    this.setState("dive"); this.airJump = null;
    g.audio.sfx("dive"); g.input.rumble(0.3, 80);
    g.fx.emit({ x: this.pos.x, y: this.pos.y + 0.6, z: this.pos.z, count: 14, color: [0xffffff, PAL.mint, PAL.peach], speed: 3.5, life: 0.45, size: 0.4 });
    g.tutorialDone("dive"); this.trick("dive", "Dive");
  }

  capBounce() {
    const g = this.game;
    this.capBounces++;
    this.vel.y = T.capBounce + (g.hasUpgrade("spring") ? 2.2 : 0);
    const hs = Math.hypot(this.vel.x, this.vel.z), keep = Math.min(hs, 10 * this.speedMul) / (hs || 1);
    this.vel.x *= keep; this.vel.z *= keep;
    this.usedDive = false; this.usedDouble = false;
    this.setState("capbounce");
    g.audio.sfx("capbounce"); g.input.rumble(0.5, 100);
    const c = this.cap.mesh.position;
    g.fx.emit({ x: c.x, y: c.y, z: c.z, count: 22, color: [PAL.pink, PAL.mint, PAL.lime, 0xffffff], speed: 5, life: 0.6, size: 0.45 });
    g.rings.spawn(c.x, c.y, c.z, PAL.pink, 2.5, 0.4);
    g.tutorialDone("capbounce"); this.trick("capbounce", "Cap Bounce");
    g.stats.capBounces = (g.stats.capBounces || 0) + 1;
  }

  onLand(vy) {
    const g = this.game, from = this.state;
    this.resetAir();
    if (from === "poundfall") {
      this.setState("poundland");
      g.audio.sfx("pound"); g.shake(0.4); g.input.rumble(0.9, 160);
      g.rings.spawn(this.pos.x, this.pos.y, this.pos.z, 0xffffff, 4.5, 0.45);
      g.fx.emit({ x: this.pos.x, y: this.pos.y + 0.1, z: this.pos.z, count: 26, color: [PAL.peach, PAL.lime, 0xffffff], speed: 7, life: 0.5, size: 0.45, flat: true });
      g.onPound(this.pos.x, this.pos.y, this.pos.z);
      g.tutorialDone("pound"); this.trick("pound", "Ground Pound");
      return;
    }
    if (from === "dive" || (from === "longjump" && Math.hypot(this.vel.x, this.vel.z) > 8 && this.game.input.held("crouch"))) {
      this.setState("slide"); g.audio.sfx("slide"); this.dust(12, 3);
      return;
    }
    if (from === "hurt" || from === "bonk") return;
    // keep the triple-jump chain going if you land from jump 1 or 2 (even after it turned into a fall)
    const aj = this.airJump; this.airJump = null;
    if ((aj === "jump" || aj === "jump2") && (from === aj || from === "fall" || from === "throw" || from === "spinthrow")) this.chainT = T.chainWindow; else this.chain = 0;
    if (from === "jump3" || from === "backflip" || from === "sidejump" || vy < -20) {
      g.audio.sfx("land"); this.dust(Math.min(18, (-vy) | 0), 3); if (vy < -20) g.shake(0.15);
      this.setState("landheavy");
    } else if (vy < -8) {
      g.audio.sfx("land"); this.dust(Math.min(14, (-vy) | 0), 2.5);
      this.setState("land");
    } else this.setState(Math.hypot(this.vel.x, this.vel.z) > 0.5 ? "run" : "idle");
  }

  _place(dt, hs = 0) {
    const p = this.pos;
    this.root.position.copy(p);
    this.root.rotation.y = this.facing;
    let anim = this.state;
    if (anim === "land" && this.stateT > 0.14) anim = "idle";
    if (anim === "run" && hs < 5.5) anim = "walk";
    this.model.update(dt, {
      state: anim, speed: hs / T.run, vy: this.vel.y, grounded: this.body.grounded, timer: this.stateT,
      phase: this.phase, sprint: hs > 10.5, idleTime: this.idleTime, turn: this.turn || 0, rollAngle: this.rollAngle || 0,
    });
    if (this.invuln <= 0) this.model.flash = 0;
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
