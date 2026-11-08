// Story: dialogue lines and in-engine cutscenes. Every cutscene can be skipped;
// skipping fast-forwards through the steps so the game state always ends right.
import * as THREE from "../vendor/three.module.min.js";
import { PAL, toon, basic, mesh, ease } from "./fx.js?v=12";

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const SPH = new THREE.SphereGeometry(1, 20, 14);

export const SPEAKERS = {
  fuse: { name: "Fuse", color: "#3d4166", voice: 480 },
  grandma: { name: "Grandma Wick", color: "#ffaaa5", voice: 300 },
  mayor: { name: "Mayor Pip", color: "#7fd6a8", voice: 220 },
  coco: { name: "Coco", color: "#ff8b94", voice: 520 },
  nell: { name: "Nell", color: "#f5a97f", voice: 600 },
  dot: { name: "Dot", color: "#ff8b94", voice: 760 },
  bo: { name: "Sailor Bo", color: "#7fd6a8", voice: 340 },
  sal: { name: "Old Sal", color: "#9d8fc0", voice: 160 },
  grizzle: { name: "Grizzle", color: "#6b5a9e", voice: 140 },
  shell: { name: "Shellshock", color: "#ff7a86", voice: 110 },
  sign: { name: "Sign", color: "#b07a5a", voice: 0 },
};

// Grizzle: looks like a cold-hearted storm cloud at first ("stern"), until you learn why ("sad")
export function buildGrizzle(mood = "stern") {
  const sad = mood === "sad";
  const g = new THREE.Group();
  const cm = toon(0x8c7fb8), cm2 = toon(0x6f6399);
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2, b = mesh(SPH, i % 2 ? cm : cm2, Math.cos(a) * 0.9, Math.sin(i * 1.7) * 0.25, Math.sin(a) * 0.55);
    b.scale.setScalar(0.65 + (i % 3) * 0.12); g.add(b);
  }
  const core = mesh(SPH, cm, 0, 0.15, 0.1); core.scale.set(1.1, 0.95, 0.9); g.add(core);
  for (const sx of [-1, 1]) {
    const e = mesh(SPH, basic(0xfff1a8), sx * 0.32, 0.25, 0.9, false); e.scale.set(0.18, 0.12, 0.06); g.add(e);
    const p = mesh(SPH, basic(0x1d1f33), sx * 0.32, 0.23, 0.95, false); p.scale.set(0.07, 0.08, 0.03); g.add(p);
    const brow = mesh(new THREE.BoxGeometry(0.34, 0.07, 0.06), basic(0x2a2440), sx * 0.3, 0.42, 0.94, false); brow.rotation.z = sad ? -sx * 0.35 : sx * 0.45; g.add(brow); // stern V or worried slant
  }
  if (sad) { const frown = mesh(new THREE.TorusGeometry(0.14, 0.035, 6, 14, Math.PI), basic(0x2a2440), 0, -0.12, 0.95, false); g.add(frown); } // a small, tired frown
  else { const line = mesh(new THREE.BoxGeometry(0.34, 0.06, 0.05), basic(0x2a2440), 0, -0.08, 0.96, false); line.rotation.z = 0.12; g.add(line); } // a hard, unreadable line
  // tiny crown
  const crown = mesh(new THREE.CylinderGeometry(0.28, 0.3, 0.2, 5, 1, true), toon(PAL.gold, { params: { side: THREE.DoubleSide } }), 0.1, 1.05, 0); g.add(crown);
  for (let i = 0; i < 5; i++) { const a = (i / 5) * Math.PI * 2, s = mesh(new THREE.ConeGeometry(0.06, 0.18, 4), toon(PAL.gold), 0.1 + Math.cos(a) * 0.28, 1.22, Math.sin(a) * 0.28); g.add(s); }
  // lightning wand
  const wand = new THREE.Group(); wand.position.set(1.2, 0, 0.3); g.add(wand);
  wand.add(mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.9, 6), toon(0x4a4060), 0, -0.2, 0));
  const bolt = mesh(new THREE.OctahedronGeometry(0.22), new THREE.MeshToonMaterial({ color: 0xfff1a8, emissive: 0xffe066, emissiveIntensity: 0.8 }), 0, 0.35, 0); bolt.scale.y = 1.8; wand.add(bolt);
  // raindrops
  const drops = [];
  for (let i = 0; i < 8; i++) { const d = mesh(SPH, basic(0x9fb7e8), (Math.random() - 0.5) * 1.6, -0.8, (Math.random() - 0.5) * 0.8, false); d.scale.set(0.04, 0.1, 0.04); g.add(d); drops.push(d); }
  g.userData.drops = drops;
  g.userData.tick = (t) => { for (const d of drops) { d.position.y -= 0.05; if (d.position.y < -2.5) d.position.y = -0.7; } g.position.y += Math.sin(t * 2) * 0.004; };
  return g;
}

export function buildGreatHeart() {
  const s = new THREE.Shape();
  s.moveTo(0, -0.9); s.bezierCurveTo(-0.2, -0.6, -1, -0.25, -1, 0.25); s.bezierCurveTo(-1, 0.75, -0.45, 0.95, 0, 0.55);
  s.bezierCurveTo(0.45, 0.95, 1, 0.75, 1, 0.25); s.bezierCurveTo(1, -0.25, 0.2, -0.6, 0, -0.9);
  const geo = new THREE.ExtrudeGeometry(s, { depth: 0.4, bevelEnabled: true, bevelSize: 0.2, bevelThickness: 0.2, bevelSegments: 3 }); geo.center();
  const g = new THREE.Group();
  const h = mesh(geo, new THREE.MeshToonMaterial({ color: 0xffd56b, emissive: 0xffb36b, emissiveIntensity: 0.7 })); g.add(h);
  const halo = new THREE.Mesh(SPH, new THREE.MeshBasicMaterial({ color: 0xfff1a8, transparent: true, opacity: 0.3, depthWrite: false })); halo.scale.setScalar(1.5); g.add(halo);
  g.userData.heart = h;
  return g;
}

// ---------------------------------------------------------------------------
// Cutscene runner
// ---------------------------------------------------------------------------
export class Cutscenes {
  constructor(game) { this.game = game; this.active = false; this.skipping = false; this.timers = []; this.ticks = []; }

  wait(s) {
    if (this.skipping) return Promise.resolve();
    return new Promise((res) => this.timers.push({ t: s, res }));
  }
  update(dt) {
    for (const t of this.timers) { t.t -= dt; if (t.t <= 0 || this.skipping) { t.done = true; t.res(); } }
    this.timers = this.timers.filter((t) => !t.done);
    for (const f of this.ticks) f(dt);
  }
  say(lines) { return this.skipping ? Promise.resolve() : this.game.dialog.play(lines); }
  shot(...a) { if (!this.skipping) this.game.cam.shot(...a); }
  skip() {
    if (!this.active || this.skipping) return;
    this.skipping = true; this.game.dialog.close(true);
    for (const t of this.timers) t.res(); this.timers = [];
  }

  async run(name) {
    const g = this.game;
    this.active = true; this.skipping = false; this.ticks = [];
    g.ui.cinema(true);
    g.player.frozen = true; g.input.releaseLock();
    try { await this[name](); } catch (e) { console.error(e); }
    this.ticks = [];
    for (const o of this.temp || []) g.scene.remove(o);
    this.temp = [];
    g.cam.release(); g.cam.snap(g.player.pos, g.player.facing + Math.PI);
    g.player.frozen = false;
    g.ui.cinema(false);
    this.active = false; this.skipping = false;
    g.afterCutscene(name);
  }
  add(o) { this.game.scene.add(o); (this.temp = this.temp || []).push(o); return o; }

  // ---------------- OPENING ----------------
  async intro() {
    const g = this.game, W = g.world, P = g.player;
    g.setSaturation(1, true);
    g.audio.play("home", 0.5);
    const heart = this.add(buildGreatHeart()); heart.position.copy(W.lanternPos).add(V(0, 2.4, 0)); heart.scale.setScalar(1.3);
    const minis = [];
    for (let i = 0; i < 8; i++) { const m = this.add(mesh(SPH, new THREE.MeshToonMaterial({ color: PAL.pink, emissive: 0xff5f70, emissiveIntensity: 0.5 }))); m.scale.setScalar(0.28); minis.push(m); }
    let orbit = true, tt = 0;
    this.ticks.push((dt) => { tt += dt; heart.rotation.y += dt; minis.forEach((m, i) => { if (orbit) m.position.set(heart.position.x + Math.cos(tt * 1.5 + i * 0.785) * 2.4, heart.position.y + Math.sin(tt * 3 + i) * 0.3, heart.position.z + Math.sin(tt * 1.5 + i * 0.785) * 2.4); }); });
    // Fuse asleep in the hammock
    P.pos.copy(W.hammock); P.facing = Math.PI / 2; P.root.position.copy(P.pos); P.root.rotation.y = P.facing;
    P.forceAnim = "sleep";
    g.ui.title("Blossom Bay", "A sleepy morning");
    this.shot([-60, 30, 90], [10, 18, 34], [0, 6, 0], [31, 20, -9], 6.5);
    await this.wait(6.5);
    this.shot([22, 14, 40], [8, 4.5, 36], W.hammock.toArray(), W.hammock.toArray(), 4);
    await this.say([{ who: "sign", text: "Every morning, the Great Sparkheart shines from the lighthouse and fills Blossom Bay with color." }, { who: "sign", text: "And every morning, Fuse sleeps right through it." }]);
    await this.wait(0.6);
    // storm rolls in
    g.audio.play(null, 1.5);
    g.audio.sfx("roar", { pitch: 0.5, caption: "[Thunder rumbles]" }); g.shake(0.6); g.flash();
    const griz = this.add(buildGrizzle()); griz.position.set(60, 30, -30); griz.scale.setScalar(1.6);
    this.ticks.push((dt) => griz.userData.tick(tt));
    this.shot([20, 22, 6], [22, 24, 2], [31, 22, -9], [31, 23, -9], 5);
    const gp = griz.position.clone(), target = W.lanternPos.clone().add(V(4, 3, 3));
    let k = 0; this.ticks.push((dt) => { k = Math.min(1, k + dt / 2.5); griz.position.lerpVectors(gp, target, ease.out(k)); griz.lookAt(20, 20, 6); });
    await this.wait(2.6);
    g.audio.play("finalboss", 1);
    await this.say([
      { who: "grizzle", text: "So this is the Great Sparkheart. Bright enough to light an entire sky." },
      { who: "grizzle", text: "You've kept it to yourselves long enough, Blossom Bay." },
      { who: "grizzle", text: "Don't come looking for it. You won't like what you find up there." },
    ]);
    // he swallows the Great Sparkheart
    const hp = heart.position.clone(); k = 0;
    this.ticks.push((dt) => { k = Math.min(1, k + dt / 1.2); heart.position.lerpVectors(hp, griz.position, ease.inOut(k)); heart.scale.setScalar(1.3 * (1 - k * 0.9)); });
    await this.wait(1.2); heart.visible = false;
    g.audio.sfx("boom"); g.shake(1); g.flash();
    // the little Sparkhearts scatter across the bay and the colors drain
    orbit = false;
    const spots = g.heartSpots();
    minis.forEach((m, i) => { const a = m.position.clone(), b = (spots[i] || V(0, 5, 0)).clone(); let q = 0; this.ticks.push((dt) => { q = Math.min(1, q + dt / 2); m.position.lerpVectors(a, b, ease.out(q)); m.position.y += Math.sin(q * Math.PI) * 12; if (q >= 1) m.visible = false; }); });
    g.setSaturation(g.targetSaturation(), false, 3);
    this.shot([10, 30, 20], [0, 40, 50], [20, 15, -5], [0, 5, 0], 3);
    await this.wait(2.5);
    await this.say([{ who: "grizzle", text: "Let the colors go. It's only fair." }]);
    k = 0; const gp2 = griz.position.clone();
    this.ticks.push((dt) => { k = Math.min(1, k + dt / 2); griz.position.lerpVectors(gp2, V(-40, 70, -140), ease.inOut(k)); });
    await this.wait(1.5);
    // Fuse wakes up... by falling out of the hammock
    g.audio.play(null, 1);
    this.shot([8, 3.2, 35.5], [7, 2.8, 34.5], W.hammock.toArray(), [3.5, 1.5, 30.5], 2.5);
    await this.wait(0.8);
    g.audio.sfx("roar", { pitch: 0.6, caption: "[Thunder]" }); g.shake(0.4);
    P.forceAnim = "surprised"; P.model.setFace("surprised", 2);
    let fy = 0; this.ticks.push((dt) => { if (P.forceAnim === "surprised" && fy < 1) { fy = Math.min(1, fy + dt * 2.2); P.root.position.set(W.hammock.x + 0.8 * fy, W.hammock.y + Math.sin(fy * Math.PI) * 0.6 - fy * 1.05, W.hammock.z + 1.2 * fy); P.root.rotation.z = fy * 1.2; } });
    await this.wait(0.6);
    g.audio.sfx("land");
    await this.wait(0.4);
    P.root.rotation.z = 0; P.pos.set(4.3, 1, 31.7); P.facing = Math.PI * 0.85; P.forceAnim = "idle";
    await this.say([{ who: "fuse", text: "Wha-? Huh? Five more minutes..." , face: "sleep"}, { who: "fuse", text: "...Wait. Why is everything so GRAY?!", face: "surprised" }]);
    // Grandma Wick arrives
    const gm = g.npcById("grandma");
    this.shot([0, 3.5, 36], [-1, 3, 35], [1.5, 1.6, 30], [0, 1.6, 29], 2);
    g.audio.play("emotional", 1);
    await this.say([
      { who: "grandma", text: "Fuse! Oh, thank goodness you're all right. That wicked storm cloud stole the Great Sparkheart! The old sailors called him Grizzle the Gloomcloud." },
      { who: "grandma", text: "Without it, the Bay's little Sparkhearts flew off every which way. That's why the colors are fading." },
      { who: "fuse", text: "Then I'll go get them back! ...How do I get them back?", face: "determined" },
      { who: "grandma", text: "Your cap, dear. Look, it's glowing." },
    ]);
    // the cap glows
    let cg = 0; this.ticks.push((dt) => { cg += dt; if (cg < 3 && Math.random() < 0.6) g.fx.emit({ x: P.root.position.x, y: P.root.position.y + 1.2, z: P.root.position.z, count: 2, color: [PAL.pink, PAL.mint, PAL.gold], speed: 2, life: 0.6, size: 0.35, gravity: -1 }); });
    this.shot([5.5, 2.4, 34], [5.2, 2.3, 33.6], [4.3, 1.6, 31.7], [4.3, 1.7, 31.7], 2);
    g.audio.sfx("heart");
    await this.say([
      { who: "grandma", text: "That cap was your grandpa's. Before that, it belonged to the Capwrights, the folks who made the very first Sparkhearts." },
      { who: "grandma", text: "It can sense them. And between you and me, it can bounce you higher than any bomb has ever gone." },
      { who: "fuse", text: "My hat is ANCIENT?! I've been sleeping in it!", face: "surprised" },
      { who: "grandma", text: "Find Blossom Bay's Sparkhearts. With four of them, the gate to Shell Cove will open. The storm cloud left something big guarding the last one." },
      { who: "grandma", text: "Now go on. And don't blow up!" },
      { who: "fuse", text: "That was ONE time!", face: "open" },
    ]);
  }

  // ---------------- BOSS INTRO ----------------
  async bossIntro() {
    const g = this.game, B = g.boss, P = g.player, c = B.center;
    g.audio.play(null, 1);
    P.pos.set(c.x + 11, c.y, c.z); P.facing = -Math.PI / 2; P.vel.set(0, 0, 0);
    this.shot([c.x + 16, c.y + 3, c.z + 6], [c.x + 9, c.y + 5, c.z + 9], [c.x, c.y + 3, c.z], [c.x, c.y + 4, c.z], 3.5);
    await this.wait(2.5);
    await this.say([{ who: "fuse", text: "Is that... a rock? A really snore-y rock?", face: "worried" }]);
    g.audio.sfx("roar"); g.shake(0.8); B.zz.visible = false;
    this.shot([c.x + 8, c.y + 2, c.z + 3], [c.x + 7, c.y + 2.5, c.z + 2], [c.x, c.y + 3.5, c.z], [c.x, c.y + 3.5, c.z], 0.6);
    await this.say([
      { who: "shell", text: "WHO DARES WAKE THE MIGHTY SHELLSHOCK?!" },
      { who: "shell", text: "...Oh. It's a tiny bomb. Shoo, tiny bomb." },
      { who: "fuse", text: "Hey! You've got our Sparkheart stuck on your shell!", face: "determined" },
      { who: "grizzle", text: "(a cold voice from the clouds) Shellshock. Keep it safe. Remember what I promised you." },
      { who: "shell", text: "A promise is a promise. Sorry, tiny bomb." },
    ]);
    g.ui.title("Shellshock", "The Grumpy Hermit Crab");
    this.shot([c.x + 14, c.y + 6, c.z + 10], [c.x + 16, c.y + 7, c.z], [c.x, c.y + 3, c.z], [c.x + 4, c.y + 2, c.z], 2);
    await this.wait(1.6);
    g.ui.toast("Make him slam or charge, then cap-bounce up and ground pound the gem!", 4);
  }

  // ---------------- BOSS DEFEATED / CHAPTER END ----------------
  async bossOutro() {
    const g = this.game, B = g.boss, P = g.player, c = B.center;
    g.audio.play(null, 0.6);
    this.shot([c.x + 10, c.y + 5, c.z + 8], [c.x + 7, c.y + 4, c.z + 6], [c.x, c.y + 3, c.z], [c.x, c.y + 2, c.z], 3);
    await this.wait(3);
    g.audio.play("emotional", 1);
    await this.say([
      { who: "shell", text: "Owww... Okay. Okay. You win, tiny bomb." },
      { who: "shell", text: "I just wanted a shell big enough to feel like home. Mine's so... cramped." },
      { who: "fuse", text: "You could live by the lighthouse! Nell says the cove there is HUGE.", face: "happy" },
      { who: "shell", text: "...You'd let me stay? After all that? *sniff* Nobody's ever been nice to Shellshock." },
      { who: "shell", text: "Except him. Grizzle. He asked me so politely, tiny bomb. Said please and everything." },
      { who: "shell", text: "He's not what everybody says he is. Ask him why he did it." },
      { who: "fuse", text: "...Why WOULD a bad guy say please?", face: "worried" },
    ]);
  }

  async chapterEnd() {
    const g = this.game, P = g.player, W = g.world;
    g.audio.play("emotional", 1);
    // in front of the lighthouse, everyone gathers
    P.pos.set(23.5, 7.25, -6.5); P.facing = -Math.PI / 2;
    this.shot([16, 10, 6], [18, 9, 2], [28, 9, -6], [28, 9, -6], 3);
    await this.wait(1);
    await this.say([
      { who: "nell", text: "Hoo! Look at the Bay, Fuse. Every color is back!" },
      { who: "fuse", text: "But the Great Sparkheart's still gone. Grizzle has it.", face: "sad" },
    ]);
    // the cap projects a trail into the clouds
    g.audio.sfx("heart");
    const trail = [];
    for (let i = 0; i < 30; i++) { const m = this.add(mesh(SPH, new THREE.MeshBasicMaterial({ color: [PAL.pink, PAL.mint, PAL.gold][i % 3], transparent: true, opacity: 0.85 }))); m.scale.setScalar(0.25); m.visible = false; trail.push(m); }
    let tt = 0;
    this.ticks.push((dt) => { tt += dt; trail.forEach((m, i) => { const k = (i / 30); if (tt > k * 2) { m.visible = true; m.position.set(26 + k * -60, 9 + k * 60 + Math.sin(tt * 2 + i) * 0.5, -4 - k * 120); } }); });
    this.shot([22, 9, 2], [20, 14, 6], [26, 9, -4], [-20, 50, -90], 4);
    await this.wait(2);
    await this.say([
      { who: "grandma", text: "The cap is pointing the way. Up past the clouds... the Candy Cloud Kingdom." },
      { who: "grandma", text: "The Capwrights made Sparkhearts to share light with anyone who had none." },
      { who: "fuse", text: "Then I'm going up there to get it back!", face: "determined" },
    ]);
    // Grizzle comes back, and this time he tells the truth
    const griz = this.add(buildGrizzle("sad")); griz.position.set(-10, 34, -60); griz.scale.setScalar(2.4);
    this.ticks.push(() => { griz.userData.tick(tt); griz.lookAt(26, 9, -4); });
    this.shot([20, 12, 0], [18, 13, -2], [-10, 34, -60], [-10, 34, -60], 2);
    g.audio.play("finalboss", 0.6);
    await this.say([
      { who: "fuse", text: "Grizzle! Give back the Great Sparkheart!", face: "determined" },
      { who: "grizzle", text: "..." },
    ]);
    g.audio.play("emotional", 1.5);
    await this.say([
      { who: "grizzle", text: "You found every piece of your light. Your people are lucky to have you, Fuse." },
      { who: "fuse", text: "Shellshock said you're not what everyone thinks. So why'd you take it? Everyone here was so scared!", face: "worried" },
      { who: "grizzle", text: "Because mine have been scared for a hundred years. Nimbus Hollow's Sparkheart went dark long before you were born, and nobody down here ever looked up." },
      { who: "grizzle", text: "In Nimbus Hollow, my people are fading to gray, one by one. The youngest can't even remember what color looks like." },
      { who: "grizzle", text: "I know what this costs your bay. I feel every bit of it. But if I give it back, my people disappear." },
      { who: "fuse", text: "Then why act like a villain?!", face: "surprised" },
      { who: "grizzle", text: "Because it was easier to be hated than to ask for help nobody would give. If you all hate me, none of this falls on you." },
      { who: "fuse", text: "There has to be a way where nobody fades.", face: "sad" },
      { who: "grizzle", text: "Maybe. I've spent years looking for one. If you find it first... I'll be waiting above the clouds." },
    ]);
    let k = 0; const gp = griz.position.clone();
    this.ticks.push((dt) => { k = Math.min(1, k + dt / 2); griz.position.lerpVectors(gp, V(-60, 120, -260), ease.inOut(k)); });
    await this.wait(1.6);
    this.shot([29, 8.6, -1], [28.5, 8.4, -1.6], [26, 8, -4], [26, 8.1, -4], 2);
    await this.say([
      { who: "fuse", text: "He's not a bad guy. He's just out of options.", face: "sad" },
      { who: "fuse", text: "So I'll go find him one!", face: "determined" },
    ]);
    P.forceAnim = "celebrate";
    P.forceAnim = null;
    g.audio.play("credits", 1);
  }
}
