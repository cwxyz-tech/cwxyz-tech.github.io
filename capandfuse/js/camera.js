// Third-person orbit camera that follows Fuse, eases behind him when he runs,
// keeps a calm height while he jumps, and never goes inside walls.
import * as THREE from "../vendor/three.module.min.js";
import { damp, clamp, angDiff, lerp, ease } from "./fx.js?v=11";

export class CamRig {
  constructor(camera, game) {
    this.camera = camera; this.game = game;
    this.yaw = 0; this.pitch = 0.32; this.dist = 8.5;
    this.target = new THREE.Vector3(); this.focusY = 0;
    this.shakeAmt = 0; this.manualT = 0;
    this.cine = null;
    this.tmp = new THREE.Vector3();
  }
  snap(p, yaw) { this.yaw = yaw ?? this.yaw; this.target.set(p.x, p.y + 1.3, p.z); this.focusY = p.y; this.update(0.0001, true); }
  shake(a) { if (!this.game.settings.reducedShake) this.shakeAmt = Math.max(this.shakeAmt, a); else this.shakeAmt = Math.max(this.shakeAmt, a * 0.2); }

  // cinematic shot: from/to positions and look targets over time
  shot(from, to, lookFrom, lookTo, dur, easing = ease.inOut) {
    this.cine = { from: new THREE.Vector3(...from), to: new THREE.Vector3(...to), lf: new THREE.Vector3(...lookFrom), lt: new THREE.Vector3(...lookTo), dur, t: 0, easing };
  }
  release() { this.cine = null; }

  update(dt, force) {
    const g = this.game, cam = this.camera;
    if (this.cine) {
      const c = this.cine; c.t = Math.min(c.dur, c.t + dt);
      const k = c.easing(c.dur > 0 ? c.t / c.dur : 1);
      cam.position.lerpVectors(c.from, c.to, k);
      this.tmp.lerpVectors(c.lf, c.lt, k);
      cam.lookAt(this.tmp);
      this._fov(55, dt);
      this._shake(dt);
      return;
    }
    const p = g.player;
    if (!p) return;
    const inp = g.input, sens = g.settings.camSens || 1;
    const inv = g.settings.invertY ? -1 : 1;
    // manual control
    let my = inp.mouseDX * 0.0028 * sens, mp = inp.mouseDY * 0.0022 * sens * inv;
    my += inp.padState.cam.x * 2.6 * dt * sens; mp += inp.padState.cam.y * 1.8 * dt * sens * inv;
    if (inp.held("camLeft")) my -= 2.2 * dt * sens;
    if (inp.held("camRight")) my += 2.2 * dt * sens;
    if (Math.abs(my) + Math.abs(mp) > 0.0001) this.manualT = 1.6;
    this.manualT = Math.max(0, this.manualT - dt);
    this.yaw -= my; this.pitch = clamp(this.pitch + mp, -0.35, 1.25);

    // drift behind Fuse while he runs (only when the player isn't steering the camera)
    const hs = Math.hypot(p.vel.x, p.vel.z);
    if (this.manualT <= 0 && hs > 4 && !["wall", "hurt"].includes(p.state)) {
      const behind = p.facing + Math.PI;
      const d = angDiff(this.yaw, behind);
      if (Math.abs(d) < 2.5) this.yaw += d * Math.min(1, dt * 0.9 * (hs / 10));
    }

    // follow height: hold steady while airborne, unless he goes far up or down
    if (p.grounded || p.state === "wall") this.focusY = damp(this.focusY, p.pos.y, 6, dt);
    else if (p.pos.y < this.focusY - 2.5 || p.pos.y > this.focusY + 4) this.focusY = damp(this.focusY, p.pos.y, 4, dt);
    const tx = p.pos.x, tz = p.pos.z, ty = lerp(this.focusY, p.pos.y, 0.35) + 1.3;
    const fk = force ? 1 : 1 - Math.exp(-12 * dt);
    this.target.x += (tx - this.target.x) * fk; this.target.z += (tz - this.target.z) * fk;
    this.target.y += (ty - this.target.y) * (force ? 1 : 1 - Math.exp(-7 * dt));

    // speed makes the camera pull back and widen a little: you feel fast
    const sp = Math.hypot(p.vel.x, p.vel.z), flow = p.flow || 0;
    this._fov(55 + Math.min(12, Math.max(0, sp - 12) * 0.9) + flow * 3, dt);
    this.speedPull = damp(this.speedPull || 0, Math.min(1, Math.max(0, sp - 12) / 10), 3, dt);
    const dist = this.dist * (g.zoomOut || 1) * (1 + this.speedPull * 0.14 + flow * 0.06);
    const cx = this.target.x + Math.sin(this.yaw) * Math.cos(this.pitch) * dist;
    const cz = this.target.z + Math.cos(this.yaw) * Math.cos(this.pitch) * dist;
    const cy = this.target.y + Math.sin(this.pitch) * dist;
    // pull in if something is between the camera and Fuse
    const f = g.level.segment(this.target.x, this.target.y, this.target.z, cx, cy, cz, 0.25);
    const fd = Math.max(1.6, f * dist - 0.3) / dist;
    const want = this.tmp.set(this.target.x + (cx - this.target.x) * fd, this.target.y + (cy - this.target.y) * fd, this.target.z + (cz - this.target.z) * fd);
    if (g.world.waterY != null) want.y = Math.max(want.y, g.world.waterY + 0.5);
    if (force) cam.position.copy(want); else cam.position.lerp(want, 1 - Math.exp(-(fd < 0.98 ? 20 : 14) * dt));
    cam.lookAt(this.target);
    this._shake(dt);
  }
  _fov(target, dt) {
    const c = this.camera, f = damp(c.fov, target, 4, dt);
    if (Math.abs(f - c.fov) > 0.02) { c.fov = f; c.updateProjectionMatrix(); }
  }
  _shake(dt) {
    if (this.shakeAmt > 0) {
      const a = this.shakeAmt * 0.35;
      this.camera.position.x += (Math.random() - 0.5) * a; this.camera.position.y += (Math.random() - 0.5) * a; this.camera.position.z += (Math.random() - 0.5) * a;
      this.shakeAmt = Math.max(0, this.shakeAmt - dt * 1.8);
    }
  }
}
