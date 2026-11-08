// Fuse: the little bomb hero. Model is built from simple shapes and animated
// procedurally (squash, stretch, swings, flips) so every move has character.
import * as THREE from "../vendor/three.module.min.js";
import { PAL, toon, basic, mesh, damp, lerp, clamp } from "./fx.js?v=15";

export const CAPS = {
  classic: { name: "Classic Cap", dome: PAL.pink, band: PAL.mint, brim: 0xff7a86, star: PAL.lime, price: 0 },
  mint: { name: "Mint Cap", dome: PAL.mint, band: PAL.pink, brim: 0x8fd9bb, star: PAL.peach, price: 60 },
  sunny: { name: "Sunny Cap", dome: PAL.peach, band: PAL.coral, brim: 0xffc09c, star: PAL.white, price: 80 },
  sailor: { name: "Sailor Cap", dome: PAL.white, band: 0x7cc7e8, brim: 0x7cc7e8, star: PAL.coral, price: 120 },
  relic: { name: "Capwright Crown", dome: PAL.gold, band: PAL.mint, brim: 0xf5c04a, star: PAL.pink, price: -1 }, // from relics
};
export const BODIES = {
  classic: { name: "Classic Fuse", body: 0x56699a, price: 0 },
  rose: { name: "Rose Fuse", body: 0xc76b86, price: 100 },
  seafoam: { name: "Seafoam Fuse", body: 0x3f8f8a, price: 100 },
  midnight: { name: "Midnight Fuse", body: 0x22233a, price: 150 },
};

const SPH = new THREE.SphereGeometry(1, 28, 20), SPH_HI = new THREE.SphereGeometry(1, 48, 32);
const ease3 = (k) => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2);

export function buildCap(style = "classic") {
  const c = CAPS[style] || CAPS.classic;
  const g = new THREE.Group();
  const dome = mesh(new THREE.SphereGeometry(0.36, 28, 14, 0, Math.PI * 2, 0, Math.PI / 2), toon(c.dome));
  dome.scale.set(1, 0.85, 1);
  const band = mesh(new THREE.CylinderGeometry(0.365, 0.37, 0.08, 28, 1, true), toon(c.band, { params: { side: THREE.DoubleSide } }), 0, 0.03, 0);
  const brim = mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.04, 28, 1, false, -Math.PI * 0.45, Math.PI * 0.9), toon(c.brim), 0, 0.0, 0.14);
  brim.scale.set(1, 1, 1.15);
  const button = mesh(new THREE.SphereGeometry(0.05, 10, 8), toon(c.band), 0, 0.31, 0);
  // little spark emblem on the front
  const star = new THREE.Mesh(starGeo(), toon(c.star));
  star.position.set(0, 0.16, 0.33); star.rotation.x = -0.45; star.scale.setScalar(0.11);
  g.add(dome, band, brim, button, star);
  g.userData.style = style;
  return g;
}
let _star;
function starGeo() {
  if (_star) return _star;
  const s = new THREE.Shape();
  for (let i = 0; i < 10; i++) { const r = i % 2 ? 0.45 : 1, a = (i / 10) * Math.PI * 2 + Math.PI / 2; const x = Math.cos(a) * r, y = Math.sin(a) * r; i ? s.lineTo(x, y) : s.moveTo(x, y); }
  _star = new THREE.ExtrudeGeometry(s, { depth: 0.3, bevelEnabled: true, bevelSize: 0.12, bevelThickness: 0.1, bevelSegments: 2 });
  _star.center();
  return _star;
}

export class FuseModel {
  constructor(opts = {}) {
    const root = (this.root = new THREE.Group());
    const body = (this.body = new THREE.Group());
    body.position.y = 0.58;
    root.add(body);
    this.bodyMat = toon(BODIES[opts.body || "classic"].body, { unique: true, gloss: true });
    const ball = mesh(SPH_HI, this.bodyMat); ball.scale.setScalar(0.5); ball.receiveShadow = false; body.add(ball);
    const shine = mesh(SPH, basic(0xffffff, { transparent: true, opacity: 0.55 }), -0.2, 0.22, 0.28, false, false);
    shine.scale.set(0.09, 0.06, 0.04); shine.rotation.z = 0.6; shine.visible = false; body.add(shine); // real highlight now comes from the gloss shader
    // metal collar + fuse
    const collar = mesh(new THREE.CylinderGeometry(0.14, 0.17, 0.12, 16), toon(0xc9c3d6), 0, 0.5, 0); body.add(collar);
    const curve = new THREE.CatmullRomCurve3([new THREE.Vector3(0, 0.55, 0), new THREE.Vector3(0.02, 0.7, -0.04), new THREE.Vector3(0.12, 0.8, -0.1), new THREE.Vector3(0.2, 0.84, -0.06)]);
    this.fuseRope = mesh(new THREE.TubeGeometry(curve, 12, 0.035, 6), toon(PAL.wood), 0, 0, 0);
    body.add(this.fuseRope);
    this.spark = new THREE.Group(); this.spark.position.set(0.21, 0.85, -0.06); body.add(this.spark);
    this.sparkCore = mesh(SPH, basic(0xfff1a8), 0, 0, 0, false, false); this.sparkCore.scale.setScalar(0.06); this.spark.add(this.sparkCore);
    this.sparkGlow = new THREE.Mesh(SPH, new THREE.MeshBasicMaterial({ color: PAL.peach, transparent: true, opacity: 0.45, depthWrite: false }));
    this.sparkGlow.scale.setScalar(0.13); this.spark.add(this.sparkGlow);

    // face
    this.face = new THREE.Group(); body.add(this.face);
    const eyeW = basic(0x0d0e1a), pupilM = basic(0x0d0e1a);
    this.eyes = [];
    for (const sx of [-1, 1]) {
      const eye = new THREE.Group(); eye.position.set(0.15 * sx, 0.12, 0.41); eye.rotation.y = 0.32 * sx;
      const white = mesh(SPH, eyeW, 0, 0, 0, false, false); white.scale.set(0.11, 0.21, 0.06);
      const pupil = mesh(SPH, pupilM, 0, -0.01, 0.045, false, false); pupil.scale.set(0.075, 0.105, 0.03);
      const glint = mesh(SPH, eyeW, 0.025 * sx, 0.04, 0.07, false, false); glint.scale.set(0.028, 0.034, 0.01);
      pupil.visible = false; glint.visible = false; // solid black eyes
      eye.add(white, pupil, glint);
      eye.userData = { pupil, white, glint };
      this.face.add(eye); this.eyes.push(eye);
    }
    // mouths
    this.mouths = {};
    const smile = mesh(new THREE.TorusGeometry(0.07, 0.018, 6, 14, Math.PI), basic(0x1d1f33), 0, -0.07, 0.47, false, false);
    smile.rotation.z = Math.PI; this.mouths.smile = smile;
    const open = new THREE.Group(); open.position.set(0, -0.09, 0.46);
    const om = mesh(SPH, basic(0x4a1f33), 0, 0, 0, false, false); om.scale.set(0.075, 0.065, 0.03);
    const tongue = mesh(SPH, basic(PAL.pink), 0, -0.03, 0.012, false, false); tongue.scale.set(0.05, 0.028, 0.02);
    open.add(om, tongue); this.mouths.open = open;
    const flat = mesh(new THREE.BoxGeometry(0.1, 0.02, 0.02), basic(0x1d1f33), 0, -0.08, 0.47, false, false); this.mouths.flat = flat;
    const frown = mesh(new THREE.TorusGeometry(0.06, 0.016, 6, 14, Math.PI), basic(0x1d1f33), 0, -0.11, 0.465, false, false); this.mouths.frown = frown;
    for (const k in this.mouths) { this.face.add(this.mouths[k]); this.mouths[k].visible = false; }

    // cap
    this.capHolder = new THREE.Group(); this.capHolder.position.set(0, 0.38, 0.02); this.capHolder.rotation.x = -0.18;
    body.add(this.capHolder);
    this.setCap(opts.cap || "classic");

    // arms
    const handM = toon(PAL.white), shoeM = toon(PAL.coral), legM = toon(0x2f3253);
    this.arms = [];
    for (const sx of [-1, 1]) {
      const pivot = new THREE.Group(); pivot.position.set(0.44 * sx, 0.0, 0);
      const arm = mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.16, 8), legM, 0.06 * sx, -0.07, 0); arm.rotation.z = 0.7 * sx;
      const hand = mesh(SPH, handM, 0.13 * sx, -0.13, 0); hand.scale.setScalar(0.1);
      pivot.add(arm, hand); body.add(pivot); this.arms.push(pivot);
    }
    this.legs = [];
    for (const sx of [-1, 1]) {
      const pivot = new THREE.Group(); pivot.position.set(0.18 * sx, 0.16, 0);
      const leg = mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.14, 8), legM, 0, -0.07, 0);
      const shoe = mesh(SPH, shoeM, 0, -0.14, 0.05); shoe.scale.set(0.12, 0.08, 0.16);
      pivot.add(leg, shoe); root.add(pivot); this.legs.push(pivot);
    }

    this.t = 0; this.blinkT = 2; this.blink = 0; this.lookX = 0; this.lookY = 0; this.lookT = 0;
    this.faceName = "smile"; this.faceTimer = 0;
    this.capOn = true;
    this.flash = 0;
    this.j = { lean: 0, tiltX: 0, roll: 0, sq: 1, armL: 0, armR: 0, armLz: 0, armRz: 0, legL: 0, legR: 0, bob: 0, spin: 0, flip: 0, bodyY: 0.58 };
  }

  setCap(style) {
    if (this.cap) this.capHolder.remove(this.cap);
    this.cap = buildCap(style); this.capHolder.add(this.cap);
    this.capStyle = style;
  }
  setBody(style) { this.bodyMat.color.set((BODIES[style] || BODIES.classic).body); }
  showCap(on) { this.capOn = on; this.capHolder.visible = on; }

  setFace(name, hold = 0) {
    this.faceName = name; this.faceTimer = hold;
  }
  _applyFace(name, talking) {
    let m = "smile", eyeS = 1, pupS = 1;
    switch (name) {
      case "open": case "laugh": case "happy": m = "open"; break;
      case "surprised": m = "open"; pupS = 0.6; eyeS = 1.15; break;
      case "ouch": m = "frown"; eyeS = 0.3; break;
      case "sleep": m = "flat"; eyeS = 0.08; break;
      case "determined": m = "flat"; eyeS = 0.75; break;
      case "sad": m = "frown"; eyeS = 0.85; break;
      case "worried": m = "frown"; eyeS = 1; pupS = 0.8; break;
    }
    if (talking) m = Math.sin(this.t * 22) > 0 ? "open" : (name === "sad" || name === "worried" ? "frown" : "smile");
    for (const k in this.mouths) this.mouths[k].visible = false; // Fuse has no mouth
    const b = 1 - this.blink;
    for (const e of this.eyes) {
      e.scale.y = Math.max(0.06, eyeS * b);
      e.userData.pupil.scale.set(0.075 * pupS, 0.105 * pupS, 0.03);
      e.userData.pupil.position.x = this.lookX * 0.03;
      e.userData.pupil.position.y = -0.01 + this.lookY * 0.03;
    }
  }

  // s: { state, speed, vy, grounded, timer, talking }
  update(dt, s = {}) {
    this.t += dt;
    const j = this.j, t = this.t, st = s.state || "idle", sp = s.speed || 0, tm = s.timer || 0;
    // targets
    let lean = 0, tiltX = 0, roll = 0, sq = 1, aL = 0, aR = 0, aLz = 0, aRz = 0, lL = 0, lR = 0, bob = 0, flip = 0, by = 0.58;
    let face = this.faceTimer > 0 ? this.faceName : "smile";
    this.faceTimer = Math.max(0, this.faceTimer - dt);
    const phase = (s.phase ?? t * 10);

    let sflip = 0, capUp = 0, capSpin = 0;
    const flipK = (dur) => clamp(tm / dur, 0, 1);
    switch (st) {
      case "idle": {
        bob = Math.sin(t * 2.4) * 0.025; sq = 1 + Math.sin(t * 2.4) * 0.025;
        aL = Math.sin(t * 2.4) * 0.1; aR = -aL;
        const it = s.idleTime || 0;
        if (it > 20) { face = "sleep"; bob = Math.sin(t * 1.2) * 0.04; sq = 1 + Math.sin(t * 1.2) * 0.05; tiltX = 0.2; aL = aR = 0.3; break; }
        if (it > 3) {
          // little idle bits so he never just stands there
          const v = Math.floor((it - 3) / 4.5) % 4, k = ((it - 3) % 4.5) / 4.5;
          if (v === 0) { this.lookX = Math.sin(k * Math.PI * 2) * 0.9; roll = Math.sin(k * Math.PI * 2) * 0.1; }
          else if (v === 1) { const e = Math.sin(clamp(k * 1.6, 0, 1) * Math.PI); aL = aR = -2.9 * e; aLz = 0.4 * e; sq = 1 + 0.14 * e; tiltX = -0.15 * e; if (e > 0.6) face = "sleep"; } // big stretch
          else if (v === 2) { lR = Math.max(0, Math.sin(t * 14)) * -0.5; bob = Math.max(0, Math.sin(t * 14)) * 0.02; aL = 0.4; aR = 0.4; aLz = 0.9; } // foot tap, hands on hips
          else { const e = clamp(k * 1.4, 0, 1), up = Math.sin(((e * 3) % 1) * Math.PI); capUp = up * 0.9; capSpin = e * Math.PI * 6; aR = -2.4 * (0.5 + up * 0.5); this.lookY = up * 0.8; } // juggles his cap
        }
        break;
      }
      case "walk": {
        const k = clamp(sp * 1.6, 0, 1), sw = Math.sin(phase);
        lL = sw * 0.7 * k; lR = -lL; aL = -sw * 0.5 * k; aR = -aL;
        bob = Math.abs(Math.cos(phase)) * 0.05 * k; sq = 1 + (Math.abs(Math.cos(phase)) - 0.5) * 0.05 * k;
        tiltX = 0.06 * k; roll = sw * 0.08 * k; lean = s.turn || 0;
        break;
      }
      case "run": {
        const k = clamp(sp, 0, 1.4), sw = Math.sin(phase);
        lL = sw * 1.15 * k; lR = -lL; aL = -sw * 1.3 * k; aR = -aL; aLz = 0.25;
        bob = Math.abs(Math.cos(phase)) * 0.11 * k; sq = 1 + (Math.abs(Math.cos(phase)) - 0.5) * 0.1 * k;
        tiltX = 0.2 * k + (s.sprint ? 0.12 : 0); roll = sw * 0.05 * k; lean = (s.turn || 0) * 1.3;
        if (s.sprint) face = "open";
        break;
      }
      case "skid": tiltX = -0.5; sq = 0.88; aL = -2.2 + Math.sin(t * 30) * 0.3; aR = -2.2 - Math.sin(t * 30) * 0.3; aLz = 1; lL = lR = -0.9; roll = Math.sin(t * 40) * 0.05; face = "surprised"; break;
      case "jump": sq = 1.2 - Math.min(tm * 2, 0.2); tiltX = -0.1; aL = aR = -2.5; aLz = 0.3; lL = 0.7; lR = -0.5; face = "open"; break;
      case "jump2": { const k = flipK(0.45); sq = 1.15 - k * 0.15; aL = -2.9; aR = -0.8; aRz = 0.9; lL = 1.1 * Math.sin(k * 9); lR = -lL; this.j.spin += dt * 12 * Math.max(0, 1 - k); face = "happy"; break; } // scissor kick + twirl
      case "jump3": { const k = flipK(0.55); flip = ease3(k) * Math.PI * 2; sq = k < 0.85 ? 0.82 : 1.1; aL = aR = k < 0.85 ? 0.6 : -2.8; aLz = 1.1; lL = lR = k < 0.85 ? 1.5 : 0.4; face = "happy"; break; } // tucked front flip
      case "djump": { const k = flipK(0.42); flip = k * Math.PI * 2; aL = aR = -1.5; aLz = 0.8; lL = lR = 0.9; face = "happy"; break; }
      case "backflip": { const k = flipK(0.6); flip = -ease3(k) * Math.PI * 2; sq = k < 0.85 ? 0.85 : 1.05; aL = aR = -2.6; aLz = 0.5; lL = lR = 1.2; face = "happy"; break; }
      case "sidejump": { const k = flipK(0.6); sflip = ease3(k) * Math.PI * 2; aL = aR = -1.6; aLz = 1.4; lL = 0.5; lR = -0.5; sq = 1.05; face = "happy"; break; } // cartwheel
      case "longjump": tiltX = 1.0; sq = 1.12; aL = aR = 1.3; aLz = 0.3; lL = lR = -1.1; by = 0.62; face = "open"; break; // superman stretch
      case "walljump": sq = 1.15; tiltX = -0.2; aL = aR = -2.6; lL = 1.2; lR = -0.3; face = "determined"; break;
      case "fall": { const fast = (s.vy || 0) < -14; sq = 1 + clamp(-(s.vy || 0) * 0.008, 0, 0.12); aL = -2.0 + Math.sin(t * (fast ? 24 : 16)) * (fast ? 0.6 : 0.2); aR = -2.0 - Math.sin(t * (fast ? 24 : 16)) * (fast ? 0.6 : 0.2); aLz = 0.7; lL = 0.3 + (fast ? Math.sin(t * 20) * 0.4 : 0); lR = -0.2; face = fast ? "surprised" : "open"; break; }
      case "land": sq = 1 - 0.28 * Math.max(0, 1 - tm / 0.14); aL = aR = 0.6; break;
      case "landheavy": { const k = clamp(tm / 0.22, 0, 1); sq = 0.6 + k * 0.4; by = 0.5 + k * 0.08; aL = aR = -0.4; aLz = 1.4 * (1 - k); lL = lR = -0.4 * (1 - k); break; }
      case "throw": { const k = clamp(tm / 0.25, 0, 1); aR = lerp(-2.6, 1.4, k); aRz = -0.3; tiltX = 0.15; roll = -0.15; face = "determined"; if (!s.grounded) { lL = 0.4; lR = -0.3; } break; }
      case "spinthrow": { const k = flipK(0.32); this.j.spin += dt * 20 * Math.max(0, 1 - k); aR = -1.6; aRz = 1.4; aL = -1.0; aLz = 1.4; lL = 0.4; lR = -0.4; face = "determined"; break; }
      case "capbounce": sq = 1.2 - clamp(tm, 0, 0.2); aL = aR = -2.9; lL = lR = 0.4; face = "happy"; this.j.spin += dt * 22 * Math.max(0, 1 - tm * 1.5); break;
      case "poundspin": flip = flipK(0.24) * Math.PI * 2; sq = 0.85; aL = aR = -0.5; aLz = 1.2; lL = lR = 1.4; face = "determined"; break;
      case "poundfall": sq = 1.12; aL = aR = 0.8; aLz = 1.4; lL = lR = 0.4; face = "determined"; break;
      case "poundland": sq = 0.62 + clamp(tm / 0.3, 0, 1) * 0.38; aL = aR = -0.8; aLz = 1.4; face = "determined"; break;
      case "dive": tiltX = Math.PI / 2 * 0.95; aL = aR = -3.0; aLz = 0.25; lL = lR = 0.2; sq = 1.05; face = "open"; break;
      case "slide": tiltX = Math.PI / 2; by = 0.42; aL = aR = -3.0; lL = lR = 0.2; face = "happy"; sq = 0.95; roll = Math.sin(t * 18) * 0.06; break;
      case "getup": { const k = clamp(tm / 0.25, 0, 1); tiltX = (1 - ease3(k)) * Math.PI / 2; by = 0.42 + k * 0.16; aL = aR = -1.5 * (1 - k); sq = 0.9 + k * 0.1; break; }
      case "bonk": tiltX = -0.6; roll = Math.sin(t * 25) * 0.25; aL = aR = -1.8; aLz = 1.2; face = "ouch"; break;
      case "roll": flip = (s.rollAngle || 0); by = 0.5; aL = aR = 0.8; aLz = 1.3; lL = lR = 1.6; face = "happy"; break;
      case "crouch": sq = 0.74 + Math.sin(t * 3) * 0.01; by = 0.47; aL = aR = 0.5; aLz = 0.4; lL = lR = -0.5; break;
      case "crouchwalk": { const sw = Math.sin(phase); sq = 0.76; by = 0.47; roll = sw * 0.15; aL = aR = 0.5; aLz = 0.5; lL = sw * 0.5 - 0.4; lR = -sw * 0.5 - 0.4; tiltX = 0.1; break; } // waddle
      case "wall": tiltX = -0.25; aL = -2.6; aR = -0.4; lL = 0.5; lR = -0.2; sq = 1.05; face = "determined"; break;
      case "hurt": tiltX = -0.5; roll = Math.sin(t * 30) * 0.3; aL = aR = -2.2; aLz = 1.0; flip = -flipK(0.5) * Math.PI * 2 * 0.5; face = "ouch"; break;
      case "celebrate": case "win": { const k = Math.sin(tm * 9); by = 0.58 + Math.max(0, k) * 0.35; aL = aR = -2.9 + Math.sin(tm * 16) * 0.2; sq = 1 + k * 0.1; this.j.spin += dt * 6; face = "happy"; break; }
      case "laugh": bob = Math.abs(Math.sin(t * 14)) * 0.06; roll = Math.sin(t * 7) * 0.1; aL = aR = 0.5; aLz = 0.9; face = "laugh"; break;
      case "surprised": sq = 1.12; aL = aR = -2.4; aLz = 0.9; face = "surprised"; break;
      case "talk": bob = Math.sin(t * 3) * 0.02; aL = Math.sin(t * 4) * 0.4 - 0.3; aR = Math.sin(t * 3.3) * 0.3; roll = Math.sin(t * 2) * 0.04; face = this.faceTimer > 0 ? this.faceName : "smile"; break;
      case "lose": { const k = clamp(tm / 1, 0, 1); sq = 1 - k * 0.3; tiltX = -k * 0.6; roll = Math.sin(t * 20) * 0.1 * (1 - k); aL = aR = 0.8 * k; aLz = 1.2; by = 0.58 - k * 0.12; face = "ouch"; break; }
      case "sleep": face = "sleep"; bob = Math.sin(t * 1.2) * 0.04; sq = 1 + Math.sin(t * 1.2) * 0.05; tiltX = 0.25; break;
    }
    this.capHolder.position.y = damp(this.capHolder.position.y, 0.38 + capUp, 30, dt);
    this.capHolder.rotation.y = capSpin;
    if (this.faceTimer > 0) face = this.faceName;

    // springy smoothing
    const L = (k, v, r = 16) => (j[k] = damp(j[k], v, r, dt));
    L("lean", lean, 8); L("tiltX", tiltX, 14); L("roll", roll, 12); L("sq", sq, 22);
    L("armL", aL, 18); L("armR", aR, 18); L("armLz", aLz, 14); L("armRz", aRz, 14); L("legL", lL, 20); L("legR", lR, 20); L("bob", bob, 18); L("bodyY", by, 14);
    j.flip = flip; j.sflip = sflip;
    if (!["capbounce", "jump2", "spinthrow", "celebrate", "win"].includes(st)) j.spin = damp(j.spin, Math.round(j.spin / (Math.PI * 2)) * Math.PI * 2, 10, dt);

    const b = this.body;
    b.position.y = j.bodyY + j.bob;
    b.scale.set(1 / Math.sqrt(j.sq), j.sq, 1 / Math.sqrt(j.sq));
    b.rotation.set(j.tiltX + j.flip, j.spin, j.roll + j.lean + (j.sflip || 0), "YXZ");
    if (st === "roll") b.rotation.x = j.flip;
    this.arms[0].rotation.set(j.armL, 0, -j.armLz); this.arms[1].rotation.set(j.armR, 0, j.armLz + j.armRz);
    this.legs[0].rotation.x = j.legL; this.legs[1].rotation.x = j.legR;
    const hideLegs = st === "roll";
    this.legs[0].visible = this.legs[1].visible = !hideLegs;
    if (st === "slide" || st === "dive" || st === "longjump") { this.legs[0].position.set(-0.18, 0.4, -0.45); this.legs[1].position.set(0.18, 0.4, -0.45); this.legs[0].rotation.x = this.legs[1].rotation.x = 1.6; }
    else { this.legs[0].position.set(-0.18, 0.16, 0); this.legs[1].position.set(0.18, 0.16, 0); }

    // blink + look
    this.blinkT -= dt;
    if (this.blinkT < 0) { this.blink = 1; this.blinkT = 2 + Math.random() * 3; }
    this.blink = Math.max(0, this.blink - dt * 9);
    this.lookT -= dt;
    if (this.lookT < 0 && st !== "idle") { this.lookX = damp(this.lookX, 0, 6, dt); this.lookY = damp(this.lookY, 0, 6, dt); }
    if (s.lookAt !== undefined) this.lookX = damp(this.lookX, s.lookAt, 6, dt);
    this._applyFace(face, s.talking);

    // the spark on the fuse flickers, burns brighter when sprinting
    const hot = s.sprint || st === "dive" || st === "roll" ? 1.6 : 1;
    const fl = 0.8 + Math.sin(t * 40) * 0.15 + Math.random() * 0.15;
    this.sparkCore.scale.setScalar(0.06 * fl * hot);
    this.sparkGlow.scale.setScalar(0.14 * fl * hot);

    // hurt flash
    if (this.flash > 0) { this.flash -= dt; this.root.visible = Math.floor(this.flash * 14) % 2 === 0; } else this.root.visible = true;
  }

  sparkWorldPos(v) { return this.spark.getWorldPosition(v); }
}
