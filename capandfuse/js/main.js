// CAP & FUSE: game boot, main loop and all the glue between systems.
import * as THREE from "../vendor/three.module.min.js";
import { Input, keyLabel, KEYS_VERSION } from "./input.js?v=12";
import { AudioSys } from "./audio.js?v=12";
import * as Save from "./save.js?v=12";
import { PAL, Particles, Rings, toon, basic, mesh, textSprite, damp, ease, SAT, mergeStatic } from "./fx.js?v=12";
import { FuseModel, CAPS, BODIES } from "./fuse.js?v=12";
import { Player } from "./player.js?v=12";
import { CamRig } from "./camera.js?v=12";
import { buildBlossomBay } from "./world.js?v=12";
import { Bits, Sparkheart, Relic, HealthHeart, Checkpoint, NPC, Bloblet, Gullbomb, PearlClam, Shellback, Urchin } from "./actors.js?v=12";
import { Shellshock } from "./boss.js?v=12";
import { Cutscenes } from "./story.js?v=12";
import { UI, Dialog, UPGRADES } from "./ui.js?v=12";

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const DEFAULT_SETTINGS = { music: 0.7, sfx: 0.8, muteMusic: false, muteSfx: false, quality: "high", camSens: 1, invertY: false, captions: true, reducedShake: false, reducedFlash: false, textSpeed: 1, showFps: false, keys: null };

const HEARTS = [
  { id: "lighthouse", name: "Top of the Lighthouse", hint: "Climb the steps that wind around Nell's lighthouse.", pos: V(31, 22.4, -5.7) },
  { id: "sky", name: "Sky Steps Summit", hint: "Hop the floating islands north of the dock.", pos: V(23.5, 12.5, -90) },
  { id: "cave", name: "Behind the Waterfall", hint: "Waterfalls make wonderful curtains...", pos: V(-29, 2.2, -13.6) },
  { id: "crabs", name: "Shellback Roundup", hint: "The shelled bullies on the east beach need a lesson.", pos: V(33, 2.6, 17), hidden: true },
  { id: "kite", name: "Dot's Lost Kite", hint: "Dot, by the north dock, lost something up high.", pos: V(5.5, 2.2, -40), hidden: true },
  { id: "rings", name: "Beach Ring Dash", hint: "Sailor Bo on the south beach runs a race.", pos: V(-39, 2.4, -4), hidden: true },
  { id: "xspot", name: "X Marks the Spot", hint: "Something is buried on the east sand. Pound it!", pos: V(22, 2.2, 33), hidden: true },
  { id: "boss", name: "Shellshock's Treasure", hint: "Get through the gate to Shell Cove.", pos: V(-62, 2.2, 0), hidden: true },
];
const RELICS = [
  { id: "cliff", name: "Weathered Brim", hint: "Somewhere above the waterfall.", lore: "Carved inside: \"Made to carry light to those without.\"", pos: V(-33, 11.2, -14) },
  { id: "cave", name: "Crystal Band", hint: "Deep inside a hidden cave, up high.", lore: "It hums when held near your cap.", pos: V(-30.6, 3.7, -9) },
  { id: "secret", name: "Capwright Star", hint: "A lonely rock floats beside the Sky Steps.", lore: "The Capwrights' sign: a star with a hat on.", pos: V(-16, 11.4, -92) },
];

class Game {
  constructor() {
    this.canvas = document.getElementById("cfCanvas");
    this.settings = { ...DEFAULT_SETTINGS };
    this.mode = "loading";
    this.time = 0; this.stats = {};
    this.heartList = HEARTS; this.relicList = RELICS; this.heartTotal = HEARTS.length;
    this.save = Save.newSave();
    this.saturation = 1; this.satTarget = 1; this.satRate = 1;
    this.slot = 0;
  }

  progress(k, text) {
    const bar = document.getElementById("cfLoadBar"), t = document.getElementById("cfLoadText");
    if (bar) bar.style.width = Math.round(k * 100) + "%";
    if (t && text) t.textContent = text;
    return new Promise((r) => requestAnimationFrame(() => r()));
  }

  async boot() {
    await this.progress(0.15, "Starting graphics...");
    // phones and tablets (and ?safe=1) start on low graphics: Safari on iPhone/iPad
    // reloads a page that uses too much graphics memory, which looks like endless loading
    const touch = navigator.maxTouchPoints > 0 && (/iPhone|iPad|iPod|Android|Mobile/i.test(navigator.userAgent) || (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1));
    this.safeMode = /[?&]safe=1/.test(location.search) || touch;
    let r;
    try { r = this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: !this.safeMode, powerPreference: "high-performance" }); }
    catch (e) { throw new Error("WebGL couldn't start (" + (e && e.message) + ")"); }
    r.outputColorSpace = THREE.SRGBColorSpace;
    r.toneMapping = THREE.NeutralToneMapping; r.toneMappingExposure = 1.0;
    r.shadowMap.enabled = true; r.shadowMap.type = THREE.PCFSoftShadowMap;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(55, 1, 0.1, 1200);
    this.input = new Input(this.canvas);
    this.audio = new AudioSys();
    this.audio.onCaption = (t) => this.ui && this.ui.caption(t);
    this.fx = new Particles(this.scene); this.rings = new Rings(this.scene);
    this.ui = new UI(this, document.getElementById("cfUI"));
    this.dialog = new Dialog(this, this.ui);
    this.cut = new Cutscenes(this);
    this.cam = new CamRig(this.camera, this);

    // lights
    this.hemi = new THREE.HemisphereLight(0xdff7ff, 0xffd3b6, 1.25); this.scene.add(this.hemi);
    const sun = (this.sun = new THREE.DirectionalLight(0xfff1e0, 1.9));
    sun.position.set(30, 50, 20); sun.castShadow = true;
    const sc = sun.shadow.camera; sc.left = sc.bottom = -36; sc.right = sc.top = 36; sc.near = 1; sc.far = 160;
    sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.04;
    this.scene.add(sun, sun.target);

    const stored = await Save.readSettings();
    if (stored) Object.assign(this.settings, stored);
    if (this.safeMode && !this.settings.qualityChosen) this.settings.quality = "low";
    if (this.settings.keysVersion !== KEYS_VERSION) { this.settings.keys = null; this.settings.keysVersion = KEYS_VERSION; } // new control scheme
    // closing the tab by accident (Cmd+W while throwing your cap) asks first
    addEventListener("beforeunload", (e) => { if (this.mode === "play" || this.mode === "paused") { e.preventDefault(); e.returnValue = ""; } });
    this.input.setKeys(this.settings.keys);
    this.applySettings();

    await this.progress(0.35, "Building Blossom Bay...");
    this.world = buildBlossomBay(this.scene);
    this.level = this.world.level;
    await this.progress(0.7, "Loading characters...");
    this.player = new Player(this);
    this.player.root.visible = false; this.player.shadow.visible = false;
    this.bits = new Bits(this);
    this.buildMenuFuse();
    await this.progress(0.9, "Almost ready...");
    this.resize(); addEventListener("resize", () => this.resize());
    document.addEventListener("fullscreenchange", () => this.resize());
    document.addEventListener("webkitfullscreenchange", () => this.resize());
    this.canvas.addEventListener("click", () => { if (this.mode === "play" && !this.cut.active && !this.dialog.open) this.input.requestLock(); });
    document.addEventListener("pointerlockchange", () => {
      if (!document.pointerLockElement && this.mode === "play" && !this.cut.active && !this.dialog.open && !this.ui.isOpen && !this._unlocking) this.pause();
      this._unlocking = false;
    });
    document.addEventListener("visibilitychange", () => { if (document.hidden && this.mode === "play" && !this.cut.active) this.pause(); });
    this.canvas.addEventListener("webglcontextlost", (e) => { e.preventDefault(); this.ui.toast("Graphics hiccup! Reloading the scene...", 3); });

    // render one frame so shaders compile behind the loader
    this.cam.shot([-1, 5, 11.5], [-1, 5, 11.5], [-1.8, 4.4, 6], [-1.8, 4.4, 6], 1);
    this.cam.update(0.016);
    this.renderer.render(this.scene, this.camera);
    await this.progress(1, "Starting...");
    document.getElementById("cfLoader").classList.add("done");
    setTimeout(() => document.getElementById("cfLoader").remove(), 700);
    this.mode = "landing";
    this.ui.landing();
    this.last = performance.now();
    requestAnimationFrame((t) => this.loop(t));
    window.cfGame = this; // handy for testing in the console
  }

  buildMenuFuse() {
    const m = (this.menuFuse = new FuseModel());
    m.root.position.set(0, 3.8, 6); m.root.rotation.y = 0.2;
    this.scene.add(m.root);
  }

  resize() {
    const w = innerWidth, h = innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h; this.camera.updateProjectionMatrix();
    this.fx.setScale(h * this.renderer.getPixelRatio());
  }

  applySettings() {
    const s = this.settings;
    if (this.audio) this.audio.setVolumes({ musicVol: s.music, sfxVol: s.sfx, musicMuted: s.muteMusic, sfxMuted: s.muteSfx });
    if (this.renderer) {
      const pr = s.quality === "low" ? 1 : s.quality === "medium" ? Math.min(1.5, devicePixelRatio) : Math.min(2, devicePixelRatio);
      this.renderer.setPixelRatio(pr);
      const shadows = s.quality !== "low";
      if (this.sun) { this.sun.castShadow = shadows; this.sun.shadow.mapSize.set(s.quality === "high" ? 2048 : 1024, s.quality === "high" ? 2048 : 1024); if (this.sun.shadow.map) { this.sun.shadow.map.dispose(); this.sun.shadow.map = null; } }
      this.renderer.shadowMap.enabled = shadows;
      this.scene && this.scene.traverse((o) => { if (o.material && o.material.needsUpdate !== undefined && !o.isPoints) o.material.needsUpdate = true; });
      this.resize();
    }
    if (this.input) this.input.setKeys(s.keys);
    const fps = document.getElementById("cfFps"); if (fps) fps.hidden = !s.showFps;
  }
  saveSettings() { Save.writeSettings(this.settings); }
  setFullscreen(on) {
    try {
      const el = document.documentElement, fs = document.fullscreenElement || document.webkitFullscreenElement;
      if (on && !fs) { const req = el.requestFullscreen || el.webkitRequestFullscreen; const p = req && req.call(el); if (!req) this.ui.toast("Fullscreen isn't available here.", 2); else if (p && p.catch) p.catch(() => this.ui.toast("Fullscreen isn't available here.", 2)); }
      else if (!on && fs) (document.exitFullscreen || document.webkitExitFullscreen).call(document);
    } catch (e) { this.ui.toast("Fullscreen isn't available here.", 2); }
  }

  // ---------------- flow ----------------
  async onPlay() {
    this.audio.unlock();
    this.applySettings();
    this.audio.play("menu", 0.3);
    this.toTitle(true);
  }
  async toTitle(keepMusic) {
    this.mode = "title";
    this.ui.showHud(false); this.ui.bossBar(null);
    if (!keepMusic) this.audio.play("menu");
    this.audio.ambience(false);
    const last = await Save.lastSlot();
    let has = false;
    if (last) { const r = await Save.readSlot(last); has = r.state === "ok"; }
    if (!has) for (const n of Save.SLOTS) { const r = await Save.readSlot(n); if (r.state === "ok") { has = true; break; } }
    this.ui.mainMenu(has);
  }
  async readAllSlots() { const o = {}; for (const n of Save.SLOTS) o[n] = await Save.readSlot(n); return o; }
  async continueGame() {
    let n = await Save.lastSlot();
    let r = n ? await Save.readSlot(n) : { state: "empty" };
    if (r.state !== "ok") {
      // newest valid file
      let best = null;
      for (const s of Save.SLOTS) { const q = await Save.readSlot(s); if (q.state === "ok" && (!best || q.data.lastPlayed > best.data.lastPlayed)) best = { n: s, ...q }; }
      if (!best) return this.ui.saveFiles();
      n = best.n;
    }
    this.loadSlot(n);
  }
  async newGameFlow() {
    for (const n of Save.SLOTS) { const r = await Save.readSlot(n); if (r.state === "empty") return this.startNew(n); }
    this.ui.toast("All 3 save files are in use. Pick one to replace, or delete one first.", 3);
    this.ui.saveFiles();
  }
  async startNew(n) {
    const r = await Save.readSlot(n);
    if (r.state === "ok" && !(await this.ui.confirm(`Start a new game in File ${n}? The old file will be replaced.`, "Replace"))) return;
    this.slot = n; this.save = Save.newSave();
    await this.saveNow(false);
    await Save.setLastSlot(n);
    this.enterWorld(true);
  }
  async loadSlot(n) {
    const r = await Save.readSlot(n);
    if (r.state !== "ok") { this.ui.toast("That save file can't be loaded.", 2); return this.ui.saveFiles(); }
    this.slot = n; this.save = r.data;
    await Save.setLastSlot(n);
    this.enterWorld(false);
  }
  async deleteSlot(n) { await Save.deleteSlot(n); if ((await Save.lastSlot()) === n) await Save.setLastSlot(0); }
  async restoreSlot(n) { const ok = await Save.restoreBackup(n); this.ui.toast(ok ? "Backup restored!" : "No backup was found.", 2); }

  async saveNow(manual) {
    if (!this.slot) return false;
    try {
      if (this.player && this.mode === "play" && manual) { /* position resumes at the latest checkpoint */ }
      await Save.writeSlot(this.slot, this.save);
      this.flashSaveIcon();
      return true;
    } catch (e) { console.warn(e); if (manual) this.ui.toast("Saving failed. Is browser storage turned off?", 3); return false; }
  }
  flashSaveIcon() { const s = document.getElementById("cfSaving"); if (!s) return; s.classList.remove("on"); void s.offsetWidth; s.classList.add("on"); }

  async enterWorld(fresh) {
    this.ui.close();
    await this.ui.fade(true, 350);
    this.mode = "play";
    this.menuFuse.root.visible = false;
    this.populate();
    const p = this.player;
    p.root.visible = true; p.shadow.visible = true;
    p.maxHp = this.hasUpgrade("heart") ? 4 : 3; p.hp = p.maxHp;
    this.wear(this.save.wearing, this.save.body, true);
    const cp = this.world.checkpoints[this.save.checkpoint] || this.world.checkpoints.start;
    p.spawn(cp.pos.x, cp.pos.y + 0.1, cp.pos.z, cp.yaw + Math.PI);
    this.cam.snap(p.pos, cp.yaw);
    this.setSaturation(this.targetSaturation(), true);
    this.audio.ambience(true);
    this.playStart = performance.now();
    await this.ui.fade(false, 450);
    if (!this.save.story.intro) {
      await this.cut.run("intro");
    } else {
      this.ui.showHud(true);
      this.ui.title(this.world.name, this.save.story.boss ? "Free roam" : `${this.save.hearts.length} of ${this.heartTotal} Sparkhearts`);
    }
  }

  // build every actor for the world from the save state
  populate() {
    const g = this, W = this.world, sv = this.save;
    // clear old actors
    for (const a of [...(this.actors || []), ...(this.npcs || [])]) { if (a.g) this.scene.remove(a.g); if (a.model) this.scene.remove(a.model); if (a.solid) this.level.remove(a.solid); }
    for (const h of this.hearts || []) this.scene.remove(h.g);
    for (const r of this.relics || []) this.scene.remove(r.g);
    for (const c of this.checkpointObjs || []) this.scene.remove(c.g);
    for (const o of this.extra || []) this.scene.remove(o);
    if (this.boss) { this.scene.remove(this.boss.g); this.level.remove(this.boss.bodySolid); this.level.remove(this.boss.topSolid); this.boss = null; }
    this.fx.clear(); this.rings.clear(); this.bits.clear();
    this.actors = []; this.npcs = []; this.extra = [];
    this.bossActive = false; this.ui.bossBar(null);

    this.hearts = HEARTS.map((h) => new Sparkheart(this, h.id, h.name, h.pos, { hidden: h.hidden && !sv.hearts.includes(h.id) }));
    // already-collected hidden hearts show as ghosts where they were found
    this.relics = RELICS.map((r) => new Relic(this, r.id, r.name, r.pos));
    this.checkpointObjs = Object.entries(W.checkpoints).filter(([id]) => id !== "start").map(([id, c]) => new Checkpoint(this, id, c.pos));
    for (const p of [V(-4, 1.6, 14), V(20, 7.8, -2), V(-21, 1.6, 4), V(3, 1, -40).add(V(0, 0.6, 0)), V(-44, 1.1, 6), V(24, 11.6, -84)]) this.actors.push(new HealthHeart(this, p));

    // NPCs
    const N = (kind, id, name, pos, f) => { const n = new NPC(this, kind, id, name, pos, f); this.npcs.push(n); return n; };
    N("grandma", "grandma", "Grandma Wick", V(-3.5, 1, 26.5), 0.6);
    N("mayor", "mayor", "Mayor Pip", V(4.2, 1, 10.5), -0.4);
    N("coco", "coco", "Coco", V(11, 1, 10.4), 0);
    N("nell", "nell", "Nell", V(27, 7.25, -3.5), -0.8);
    N("dot", "dot", "Dot", V(4, 0.45, -42), Math.PI);
    N("bo", "bo", "Sailor Bo", V(-11, 0.45, 41.5), 0.5);
    N("sal", "sal", "Old Sal", V(-23.5, 1, 2.5), -0.7);

    // enemies
    const E = (C, pos) => { const e = new C(this, pos); this.actors.push(e); return e; };
    for (const p of [V(8, 1, 24), V(-14, 1, -1), V(15, 1, 6), V(-4, 1, -22), V(18, 1, -20), V(-24, 1, 12)]) E(Bloblet, p);
    for (const p of [V(10, 9, -30), V(24, 14, -12), V(-18, 9, 22), V(-4, 12, -70)]) E(Gullbomb, p);
    for (const p of [V(-30, 0.45, 30), V(-41, 0.45, 12), V(16, 0.45, 41)]) E(PearlClam, p);
    for (const p of [V(-26, 0.45, 35), V(13, 0.45, 42.5), V(41, 0.45, -8), V(-2, 0.45, -41.5)]) E(Urchin, p);
    this.crabsLeft = 3;
    for (const p of [V(34, 0.45, 19), V(39, 0.45, 9), V(30, 0.45, 27)]) {
      const c = E(Shellback, p);
      c.onDefeat = () => { this.crabsLeft--; if (this.crabsLeft > 0) this.ui.toast(`Shellbacks left: ${this.crabsLeft}`, 1.5); else this.revealHeart("crabs", c.pos.clone().add(V(0, 1, 0))); };
    }

    // Sparkbits: trails that lead the eye toward goals
    const B = this.bits;
    B.line([1, 1.6, 21], [1, 1.6, 12], 6);
    B.arc([5, 2.8, 20], [7.2, 4, 17.6], 1, 3); B.arc([7.2, 4, 17.6], [9.6, 5.6, 15], 1, 3);
    B.line([10.5, 6.2, 14], [13, 8.1, 12], 3);
    B.circle([0, 0, 6], 6.5, 12, 1.6);
    B.line([7.6, 2.2, -2.4], [19, 7.7, -2.4], 10);
    for (const s of W.spiral) this.bits.add(s.x, s.y + s.hy + 0.6, s.z);
    B.line([-14.3, 2, 18], [-14.3, 6.5, 18], 4);
    B.circle([-14.3, 0, 18], 1, 4, 8);
    B.line([-21, 2, -6], [-21, 9.4, -6], 6);
    B.circle([-30, 0, -10], 3, 8, 10.8);
    B.line([-29, 1.6, -5], [-29, 1.6, -11], 5);
    B.line([0, 1.2, -44], [0, 1.2, -51], 5);
    for (let i = 0; i < W.steps.length - 1; i++) { const a = W.steps[i].s, b = W.steps[i + 1].s; B.arc([a.x, a.y + a.hy + 0.8, a.z], [b.x, b.y + b.hy + 0.8, b.z], 3, 6); }
    B.circle([26, 0, -88], 2.5, 8, 11.8);
    B.circle([22, 0, 33], 3, 8, 1.2);
    B.line([-40, 1.1, 30], [-20, 1.1, 40], 8);
    B.line([25, 1.1, 30], [38, 1.1, 14], 7);
    B.circle([-29, 0, -1], 3.5, 8, 1.7);
    B.line([-30, 1.6, 14], [-30, 1.6, 2], 6);
    B.circle([-66, 0, 0], 8, 14, 1.2);
    B.line([-6, 1.6, 12], [-6, 9, 12], 5);

    // X marks the spot
    const xs = new THREE.Group(); xs.position.copy(W.xSpot).add(V(0, 0.03, 0));
    for (const a of [Math.PI / 4, -Math.PI / 4]) { const bar = mesh(new THREE.BoxGeometry(2.4, 0.04, 0.45), toon(PAL.coral), 0, 0, 0, false); bar.rotation.y = a; xs.add(bar); }
    xs.visible = !sv.hearts.includes("xspot"); this.scene.add(xs); this.extra.push(xs); this.xMark = xs;

    // Dot's kite on top of the tall rock
    const kite = new THREE.Group();
    const kshape = new THREE.Shape(); kshape.moveTo(0, 0.7); kshape.lineTo(0.45, 0); kshape.lineTo(0, -0.9); kshape.lineTo(-0.45, 0); kshape.closePath();
    const km = mesh(new THREE.ShapeGeometry(kshape), new THREE.MeshToonMaterial({ color: PAL.pink, side: THREE.DoubleSide })); kite.add(km);
    const k2 = mesh(new THREE.ShapeGeometry(kshape), new THREE.MeshToonMaterial({ color: PAL.mint, side: THREE.DoubleSide }), 0, 0, 0.01); k2.scale.set(0.5, 0.5, 1); kite.add(k2);
    for (let i = 0; i < 4; i++) { const bow = mesh(new THREE.SphereGeometry(0.08, 6, 5), toon([PAL.gold, PAL.coral][i % 2]), 0, -1 - i * 0.25, 0); kite.add(bow); }
    kite.position.set(-9, 11.2, -72);
    this.kite = kite; this.scene.add(kite); this.extra.push(kite);
    kite.visible = !sv.hearts.includes("kite");
    this.carryingKite = sv.story.quests.kite === "carry" && !sv.hearts.includes("kite");

    // ring race
    this.raceRings = [];
    const rp = [[-24, 1.9, 39], [-33, 2.4, 31], [-40, 4.5, 21], [-44, 2.2, 10], [-43, 6.2, 1.5], [-39, 2.4, -4]];
    for (const p of rp) {
      const m = mesh(new THREE.TorusGeometry(1.5, 0.16, 8, 32), new THREE.MeshToonMaterial({ color: PAL.gold, emissive: PAL.gold, emissiveIntensity: 0.3 }), p[0], p[1], p[2], false);
      m.visible = false; this.scene.add(m); this.extra.push(m); this.raceRings.push({ m, p: V(...p), got: false });
    }
    for (let i = 0; i < rp.length; i++) { const a = this.raceRings[i].p, b = this.raceRings[i + 1] ? this.raceRings[i + 1].p : a; this.raceRings[i].m.lookAt(b.x === a.x && b.z === a.z ? V(a.x + 1, a.y, a.z) : b); }
    this.race = null;

    // gate + boss
    this.updateGate();
    this.boss = new Shellshock(this, V(W.arena.x, 0.5, W.arena.z));
    if (sv.story.boss) { this.boss.dead = true; this.boss.deadT = 5; this.boss.slept = true; this.boss.gem.visible = this.boss.gemGlow.visible = false; this.boss.inner.position.y = -0.6; this.boss.zz.visible = true; this.boss.sync(); }

    // tutorial zones
    this.tutZones = [
      { id: "move", pos: V(2, 1, 23), r: 7, html: () => `<b>Move</b> ${this.k("forward")}${this.k("left")}${this.k("back")}${this.k("right")} &middot; <b>Camera</b> mouse (click the game first) or ${this.k("camLeft")}${this.k("camRight")}` },
      { id: "jump", pos: V(6, 1, 19), r: 4, html: () => `<b>Jump</b> ${this.k("jump")} &middot; press again in the air to <b>double jump</b> &middot; jump 3 times in a row while running for a <b>triple jump</b>` },
      { id: "capbounce", pos: V(9.6, 5, 15), r: 3, html: () => `<b>Throw your cap</b> ${this.k("throw")}, then jump into it in midair to <b>bounce</b>! Hold ${this.k("throw")} to make it hover longer.` },
      { id: "walljump", pos: V(-14.3, 1, 18), r: 4, html: () => `<b>Wall jump</b>: jump into a wall, then press ${this.k("jump")} again while sliding down it.` },
      { id: "dive", pos: V(0, 0.5, -46), r: 6, html: () => `<b>Dive</b>: press ${this.k("crouch")} in the air. Dive into your cap to bounce again.` },
      { id: "pound", pos: W.xSpot, r: 5, html: () => `<b>Ground pound</b>: press ${this.k("pound")} in the air. Jump right as you land for a super jump!` },
      { id: "flip", pos: V(34, 0.45, 17), r: 9, html: () => `Shellbacks are too hard to stomp. <b>Hit them with your cap</b> to flip them first!` },
      { id: "longjump", pos: V(1, 1, 12), r: 3.5, html: () => `<b>Long jump</b>: hold ${this.k("crouch")} while moving, then ${this.k("jump")} &middot; <b>Backflip</b>: hold ${this.k("crouch")} standing still, then ${this.k("jump")}` },
      { id: "sidejump", pos: V(-4, 1, 3), r: 4, html: () => `<b>Side jump</b>: while running, turn around and press ${this.k("jump")} &middot; <b>Roll</b>: ${this.k("crouch")} + ${this.k("throw")}` },
    ];
    this.objectiveCache = null;
    this.gameOverPending = false;
  }

  k(a) { return (this.input.keys[a] || []).slice(0, 1).map((c) => `<kbd>${keyLabel(c)}</kbd>`).join(""); }
  tutorialDone(id) { if (this.save.story.tutorial[id]) return; this.save.story.tutorial[id] = true; }

  heartSpots() { return HEARTS.map((h) => h.pos); }
  npcById(id) { return this.npcs.find((n) => n.id === id); }
  npcByKind(k) { return this.npcs && this.npcs.find((n) => n.kind === k); }
  hasUpgrade(id) { return this.save.upgrades.includes(id); }

  objective() {
    const sv = this.save, n = sv.hearts.length;
    if (this.race) return `Ring Dash: ${this.race.got}/6 rings, ${Math.max(0, this.race.time).toFixed(1)}s`;
    if (this.carryingKite) return "Bring the kite back to Dot by the north dock";
    if (this.bossActive) return "Defeat Shellshock!";
    if (sv.story.boss) return n < this.heartTotal ? `Find the last Sparkhearts (${n}/${this.heartTotal})` : "Blossom Bay is fully restored!";
    if (n < 4) return `Find Sparkhearts to open Shell Cove (${n}/4)`;
    return "The gate to Shell Cove is open! Head west across the bridge";
  }

  targetSaturation() { return this.save.story.boss ? 1 : 0.55 + 0.4 * Math.min(1, this.save.hearts.length / this.heartTotal); }
  setSaturation(v, instant, secs = 2) { this.satTarget = v; if (instant) this.saturation = v; this.satRate = 1 / secs; }

  updateGate() {
    const open = this.save.hearts.length >= 4 || this.save.story.boss;
    const W = this.world;
    W.gateSolid.enabled = !open; W.gateMesh.visible = !open;
    W.gateSign.visible = !open;
  }

  // ---------------- collecting ----------------
  addBits(n) {
    this.save.bits += n; this.save.bitsTotalEarned += n;
    const el = document.querySelector("#cfBits b"); if (el) el.textContent = this.save.bits;
    this.ui.bump("#cfBits");
  }

  revealHeart(id, from) {
    const h = this.hearts.find((x) => x.id === id);
    if (!h || (h.visible && !h.done)) return;
    if (h.done) return;
    h.reveal(from);
  }

  async collectHeart(h) {
    const sv = this.save, p = this.player;
    const fresh = !sv.hearts.includes(h.id);
    this.fx.emit({ x: h.g.position.x, y: h.g.position.y, z: h.g.position.z, count: 50, color: [PAL.pink, PAL.peach, PAL.mint, 0xffffff, PAL.gold], speed: 8, life: 1, size: 0.6 });
    this.rings.spawn(p.pos.x, p.pos.y, p.pos.z, PAL.pink, 5, 0.6);
    if (!fresh) { this.audio.sfx("ring"); this.ui.toast("You already found this one!", 1.5); return; }
    sv.hearts.push(h.id);
    this.audio.sfx("heart"); this.audio.jingle("victory");
    this.input.rumble(0.7, 300);
    // little celebration: Fuse freezes in a victory pose
    p.frozen = true; p.vel.set(0, Math.max(p.vel.y, 0), 0); this.celebrate = 1.8;
    this.ui.banner("Sparkheart found", h.name);
    this.setSaturation(this.targetSaturation(), false, 2.5);
    this.updateGate();
    if (sv.hearts.length === 4 && !sv.story.boss) setTimeout(() => { this.ui.toast("The gate to Shell Cove is open!", 3); this.audio.sfx("door", { caption: "[A gate rumbles open in the west]" }); }, 2200);
    this.ui.hud();
    this.saveNow(false);
    if (h.id === "boss") {
      sv.story.boss = true; sv.unlocked.includes("candy") || sv.unlocked.push("candy");
      this.setSaturation(1, false, 4);
      await this.cut.wait(2.2);
      await this.cut.run("chapterEnd");
    }
  }

  collectRelic(r) {
    const sv = this.save;
    if (!sv.relics.includes(r.id)) sv.relics.push(r.id);
    const info = RELICS.find((x) => x.id === r.id);
    this.audio.sfx("relic");
    this.ui.banner("Capwright Relic found", info.name, "#e0a93a");
    this.fx.emit({ x: r.g.position.x, y: r.g.position.y, z: r.g.position.z, count: 30, color: [PAL.gold, PAL.mint, 0xffffff], speed: 6, life: 0.8, size: 0.5 });
    setTimeout(() => this.ui.toast(info.lore, 4), 1600);
    if (sv.relics.length === 3 && !sv.cosmetics.includes("relic")) { sv.cosmetics.push("relic"); setTimeout(() => { this.ui.toast("All 3 relics! The Capwright Crown is now in your Wardrobe (pause menu).", 5); this.audio.sfx("notify"); }, 4500); }
    this.saveNow(false);
  }

  activateCheckpoint(c) {
    const sv = this.save;
    if (!sv.checkpoints.includes(c.id)) sv.checkpoints.push(c.id);
    sv.checkpoint = c.id;
    this.audio.sfx("checkpoint");
    this.fx.emit({ x: c.pos.x, y: c.pos.y + 2.6, z: c.pos.z, count: 24, color: [PAL.pink, PAL.mint, 0xffffff], speed: 4, life: 0.7, size: 0.4 });
    this.player.heal(3);
    this.ui.toast(`Checkpoint: ${this.world.checkpoints[c.id].name}`, 1.8);
    this.saveNow(false);
  }

  // remember a checkpoint without needing to touch its flag (used for the boss fight)
  setCheckpoint(id) {
    const sv = this.save;
    if (!sv.checkpoints.includes(id)) sv.checkpoints.push(id);
    sv.checkpoint = id;
    const flag = (this.checkpointObjs || []).find((c) => c.id === id);
    if (flag && !flag.on) { flag.on = true; flag.flagMat.color.set(PAL.pink); }
    this.saveNow(false);
  }

  wear(cap, body, silent) {
    const sv = this.save;
    if (cap && (sv.cosmetics.includes(cap) || cap === "classic")) { sv.wearing = cap; this.player.model.setCap(cap); this.player.cap.setStyle(cap); }
    if (body && (body === "classic" || sv.cosmetics.includes("b_" + body))) { sv.body = body; this.player.model.setBody(body); }
    if (!silent) this.saveNow(false);
  }
  buy(kind, id) {
    const sv = this.save;
    const price = kind === "up" ? UPGRADES.find((u) => u.id === id).price : kind === "cap" ? CAPS[id].price : BODIES[id].price;
    if (sv.bits < price) { this.audio.sfx("nope"); return; }
    sv.bits -= price;
    if (kind === "up") { sv.upgrades.push(id); if (id === "heart") { this.player.maxHp = 4; this.player.hp = 4; } }
    else if (kind === "cap") { sv.cosmetics.push(id); this.wear(id, null, true); }
    else { sv.cosmetics.push("b_" + id); this.wear(null, id, true); }
    this.audio.sfx("buy");
    this.npcByKind("coco").happy = 1.2;
    this.ui.toast("Thanks for shopping!", 1.4);
    this.ui.hud();
    this.saveNow(false);
  }

  // things the thrown cap touches
  capHits(pos, cap) {
    for (const a of this.actors) {
      if (!a.alive || !a.hitByCap || cap.hits.has(a)) continue;
      const c = a.g.position;
      const dy = pos.y - (c.y + 0.5);
      if (Math.hypot(pos.x - c.x, pos.z - c.z) < (a.r || 0.7) + 0.4 && Math.abs(dy) < 1.2) { cap.hits.add(a); a.hitByCap(cap); }
      if (a.capPearls) a.capPearls(pos);
    }
  }

  onPound(x, y, z) {
    for (const a of this.actors) if (a.alive && a.hitByCap && a.g && a.g.position.distanceTo(V(x, y, z)) < 2.2 && !(a instanceof Urchin)) { if (a instanceof Shellback) a.defeat(5); else if (a instanceof PearlClam) { if (a.open > 0.4) a.defeat(4); } else a.defeat(3); }
    const W = this.world;
    if (!this.save.hearts.includes("xspot") && Math.hypot(x - W.xSpot.x, z - W.xSpot.z) < 1.8) {
      this.xMark.visible = false; this.audio.sfx("boom");
      this.fx.emit({ x: W.xSpot.x, y: W.xSpot.y + 0.3, z: W.xSpot.z, count: 40, color: [PAL.peach, 0xffffff], speed: 7, up: 4, life: 0.7, size: 0.5 });
      this.revealHeart("xspot", W.xSpot.clone());
    }
  }

  onBossHit(hp) {
    this.audio.intensity = 3 - hp;
    if (this.player.hp < this.player.maxHp) { const hh = new HealthHeart(this, V(this.world.arena.x + 7, 1.4, (Math.random() - 0.5) * 8)); hh.respawn = 1e9; this.actors.push(hh); this.bossHearts = (this.bossHearts || []).concat(hh); }
    this.ui.toast(hp === 2 ? "He's getting angry!" : "One more hit!", 1.8);
  }
  async onBossDefeated() {
    this.bossActive = false;
    this.ui.bossBar(null);
    this.audio.intensity = 0;
    this.audio.sfx("roar", { pitch: 0.7 });
    await this.cut.wait(2.8);
    await this.cut.run("bossOutro");
  }

  onPlayerLost() {
    if (this.gameOverPending) return;
    this.gameOverPending = true;
    setTimeout(() => {
      if (this.mode !== "play") return;
      this.mode = "gameover"; this.input.releaseLock(); this._unlocking = true;
      this.audio.play(null, 0.8);
      this.ui.showHud(false);
      this.ui.gameOver();
    }, 1600);
  }
  async retry() {
    this.ui.close();
    const lost = Math.min(10, this.save.bits); this.save.bits -= lost;
    await this.ui.fade(true, 300);
    this.mode = "play"; this.gameOverPending = false;
    if (this.bossActive || (!this.save.story.boss && this.boss && this.boss.active)) this.resetBoss();
    const p = this.player; p.maxHp = this.hasUpgrade("heart") ? 4 : 3; p.hp = p.maxHp;
    const cp = this.world.checkpoints[this.save.checkpoint] || this.world.checkpoints.start;
    p.spawn(cp.pos.x, cp.pos.y + 0.1, cp.pos.z, cp.yaw + Math.PI); p.invuln = 1.5;
    this.cam.snap(p.pos, cp.yaw);
    this.ui.showHud(true);
    await this.ui.fade(false, 400);
    if (lost) this.ui.toast(`Dropped ${lost} Sparkbits...`, 2);
  }
  resetBoss() {
    for (const hh of this.bossHearts || []) { this.scene.remove(hh.g); this.actors = this.actors.filter((x) => x !== hh); }
    this.bossHearts = [];
    this.scene.remove(this.boss.g); this.level.remove(this.boss.bodySolid); this.level.remove(this.boss.topSolid);
    for (const w of this.boss.waves) this.scene.remove(w.m); for (const b of this.boss.bombs) this.scene.remove(b.m); for (const w of this.boss.warns) this.scene.remove(w.m);
    this.boss = new Shellshock(this, V(this.world.arena.x, 0.5, this.world.arena.z));
    this.bossActive = false; this.ui.bossBar(null); this.audio.intensity = 0;
  }

  async fastTravel(id) {
    const c = this.world.checkpoints[id]; if (!c) return;
    this.ui.close();
    await this.ui.fade(true, 300);
    if (this.bossActive) this.resetBoss();
    this.save.checkpoint = id;
    this.player.spawn(c.pos.x, c.pos.y + 0.1, c.pos.z, c.yaw + Math.PI);
    this.cam.snap(this.player.pos, c.yaw);
    this.mode = "play"; this.ui.showHud(true);
    await this.ui.fade(false, 300);
  }

  pause() {
    if (this.mode !== "play" || this.cut.active) return;
    this.mode = "paused"; this._unlocking = true; this.input.releaseLock();
    this.ui.showHud(false); this.ui.hint(null);
    this.ui.pause();
    this.audio.sfx("menu");
  }
  resume() {
    this.ui.close(); this.mode = "play"; this.ui.showHud(true);
    this.input.requestLock();
  }
  closeShop() { this.ui.close(); this.mode = "play"; this.ui.showHud(true); this.input.requestLock(); }
  async quitToTitle() {
    this.ui.close();
    await this.saveNow(false);
    await this.ui.fade(true, 300);
    this.mode = "title"; this.player.root.visible = false; this.player.shadow.visible = false; this.player.cap.reset();
    if (this.bossActive) this.resetBoss();
    this.menuFuse.root.visible = true;
    this.setSaturation(1, true);
    this.cam.shot([-1, 5, 11.5], [-1, 5, 11.5], [-1.8, 4.4, 6], [-1.8, 4.4, 6], 1);
    this.toTitle(false);
    await this.ui.fade(false, 300);
  }

  rollCredits(afterGame) {
    this.mode = "credits"; this.audio.play("credits", 1);
    this.ui.showHud(false);
    this.ui.credits(afterGame);
  }
  async creditsDone(afterGame) {
    if (this._credDone) return; this._credDone = true; setTimeout(() => (this._credDone = false), 500);
    this.ui.close();
    if (afterGame) { this.mode = "play"; this.ui.showHud(true); this.audio.play("blossom", 1.5); this.ui.toast("Keep exploring! Can you find every Sparkheart and relic?", 4); }
    else { this.audio.play("menu"); this.toTitle(true); }
  }

  async afterCutscene(name) {
    const sv = this.save;
    if (name === "intro") {
      sv.story.intro = true;
      this.player.forceAnim = null;
      // put Fuse back on the ground beside the hammock
      this.player.spawn(4.3, 1.05, 31.2, Math.PI);
      this.cam.snap(this.player.pos, 0);
      this.ui.showHud(true);
      this.audio.play("home", 1);
      this.ui.title("Blossom Bay", "Find the Sparkhearts!");
      this.saveNow(false);
    } else if (name === "bossIntro") {
      sv.story.bossIntro = true;
      this.setCheckpoint("gate");
      this.boss.start(); this.bossActive = true; this.ui.bossBar(1);
      this.audio.play("boss", 0.5);
      this.ui.showHud(true);
    } else if (name === "bossOutro") {
      this.ui.showHud(true);
      { // put the reward between the crab and the bridge so it's never stuck inside him
        const h = this.hearts.find((x) => x.id === "boss"), b = this.boss.pos, c = this.world.arena;
        let dx = -46 - b.x, dz = 0 - b.z; const d = Math.hypot(dx, dz) || 1; dx /= d; dz /= d;
        let hx = b.x + dx * 4.5, hz = b.z + dz * 4.5;
        const dc = Math.hypot(hx - c.x, hz - c.z); if (dc > 11) { hx = c.x + (hx - c.x) * 11 / dc; hz = c.z + (hz - c.z) * 11 / dc; }
        if (h) h.home.set(hx, 2, hz);
      }
      this.revealHeart("boss", this.boss.pos.clone().add(V(0, 6, 0)));
      this.audio.play("blossom", 2);
    } else if (name === "chapterEnd") {
      this.player.forceAnim = null;
      this.player.spawn(23.5, 7.3, -6.5, -Math.PI / 2);
      this.mode = "victory"; this.ui.showHud(false);
      this.ui.victory({ hearts: sv.hearts.length, total: this.heartTotal, relics: sv.relics.length, bits: sv.bits, time: sv.playtime });
      this.saveNow(false);
    }
  }

  // ---------------- talking ----------------
  async talk(n) {
    const sv = this.save, q = sv.story.quests, H = (id) => sv.hearts.includes(id);
    this.input.releaseLock(); this._unlocking = true;
    this.player.frozen = true; n.talking = true;
    const lines = [];
    const L = (who, text, face) => lines.push({ who, text, face });
    const first = !sv.story.met[n.id]; sv.story.met[n.id] = true;
    switch (n.id) {
      case "grandma":
        if (sv.story.boss) { L("grandma", "My brave little Fuse. Your grandpa would be bursting with pride. Carefully, of course."); L("grandma", "When you're ready, the cap will show you the way up to the clouds."); }
        else if (sv.hearts.length === 0) { L("grandma", "Sparkhearts love high places and hidden corners. Try the lighthouse, or behind that noisy waterfall."); L("grandma", "And practice with your cap on those crates by the house. Throw it, then jump right into it!"); }
        else L("grandma", ["The Bay already looks brighter, dear!", "Remember: if you fall in the sea, you'll just pop back. Bombs float... briefly.", "Coco sells wonderful cap upgrades. Spend those Sparkbits!"][sv.hearts.length % 3]);
        break;
      case "mayor": {
        if (first) { L("mayor", "Ahem! Mayor Pip, at your service. This is a crisis! A CRISIS! That villain Grizzle has robbed us blind! I've written seventeen speeches about it."); L("fuse", "Have you tried looking for the Sparkhearts?", "worried"); L("mayor", "...I have not. That's what YOU'RE for! Splendid!"); }
        else if (sv.story.boss) L("mayor", "Grizzle was trying to save his own people? Goodness. I may need to rewrite all seventeen speeches.");
        const miss = HEARTS.filter((h) => !H(h.id));
        if (miss.length) L("mayor", `The rumor around town: "${miss[(Math.floor(this.time / 10)) % miss.length].hint}"`);
        else L("mayor", "Every Sparkheart home! I shall declare a holiday. Possibly two.");
        if (sv.hearts.length >= 4 && !sv.story.boss) L("mayor", "The gate to Shell Cove is glowing open! It's west, past the waterfall. Do be careful!");
        break;
      }
      case "coco":
        L("coco", first ? "Ooh, a customer! Welcome to Coco's Caps and Charms! Snip snap, everything's for sale!" : "Back again? My claws are ready for business!");
        await this.dialog.play(lines); n.talking = false; this.player.frozen = false;
        this.mode = "shop"; this.ui.showHud(false); this.ui.shop(); return;
      case "nell":
        if (!H("lighthouse")) { L("nell", "Hoo! The Great Sparkheart sat right up top in my lantern for a hundred years. Now it's gone!"); L("nell", "One little Sparkheart got stuck on the balcony. The steps wind around the tower. Some of them move, so time your jumps!"); }
        else if (!sv.story.boss) { L("nell", "Thank you, Fuse! From up there you can see the whole Bay. Even that grumpy crab in Shell Cove, snoring away."); L("nell", "Funny thing... I saw that storm cloud up close when he took the heart. Everyone calls him a monster, but his eyes weren't angry. Just tired. Hoo, maybe I imagined it."); }
        else L("nell", "Shellshock moved into the cove below my tower. He snores like a foghorn. I love it.");
        break;
      case "dot":
        if (H("kite")) L("dot", "My kite flies SO high now! Thanks, Fuse! You're the coolest bomb ever!");
        else if (this.carryingKite) {
          L("dot", "MY KITE! You found it! You're the best!");
          await this.dialog.play(lines);
          this.carryingKite = false; q.kite = "done"; this.kite.visible = false; n.happy = 2;
          this.revealHeart("kite", n.pos.clone().add(V(0, 1, 0)));
          n.talking = false; this.player.frozen = false; return;
        } else { L("dot", "Is the scary storm cloud gonna come back? Mom says he eats colors!"); L("dot", "Waaah! And the storm blew my kite away! It's stuck on top of that tall rock, way out on the Sky Steps."); L("dot", "You'd have to jump really, really high... like, cap-bounce high!"); }
        break;
      case "bo":
        if (H("rings")) L("bo", "Ribbit! Fastest bomb on the beach! Want to race again just for fun? Talk to me twice!");
        if (this.race) { L("bo", "Go go go!"); break; }
        if (!H("rings") || sv.story.quests.raceAgain) {
          L("bo", "Ahoy! It's the Beach Ring Dash! Run through all 6 gold rings in 16 seconds."); L("bo", "Long jumps, dives, whatever it takes! Ready? GO!");
          await this.dialog.play(lines); n.talking = false; this.player.frozen = false; this.startRace(); return;
        }
        sv.story.quests.raceAgain = true;
        break;
      case "sal":
        L("sal", "Mmmrrph... Old Sal's been sitting by this waterfall for forty years.");
        L("sal", ["Funny thing... sometimes I hear an echo coming from BEHIND the water.", "See that skinny gap by the cliff? Young'uns jump back and forth up it, wall to wall.", "Lost something up high? Throw your cap and jump on it. Works for hats. Works for bombs.", "My grandpappy talked about Nimbus Hollow, a town up in the clouds. Used to see its lights twinkle at night. Haven't seen them in a hundred years."][Math.floor(this.time / 7) % 4]);
        break;
    }
    await this.dialog.play(lines);
    n.talking = false; this.player.frozen = false;
  }

  startRace() {
    const r = (this.race = { time: 16, got: 0, started: false });
    for (const ring of this.raceRings) { ring.got = false; ring.m.visible = true; ring.m.material.color.set(PAL.gold); }
    this.ui.toast("GO!", 1); this.audio.sfx("notify");
    r.started = true;
  }
  updateRace(dt) {
    const r = this.race; if (!r) return;
    r.time -= dt;
    const p = this.player.center;
    const next = this.raceRings[r.got];
    if (next) {
      next.m.scale.setScalar(1 + Math.sin(this.time * 8) * 0.08);
      if (p.distanceTo(next.p) < 1.9) {
        next.got = true; next.m.material.color.set(PAL.mint); r.got++;
        this.audio.sfx("ring", { pitch: 1 + r.got * 0.08 });
        this.fx.emit({ x: next.p.x, y: next.p.y, z: next.p.z, count: 20, color: [PAL.gold, 0xffffff], speed: 5, life: 0.5, size: 0.4 });
        setTimeout(() => (next.m.visible = false), 300);
      }
    }
    if (r.got >= 6) {
      this.race = null;
      this.ui.toast("You did it!", 2);
      if (!this.save.hearts.includes("rings")) this.revealHeart("rings", this.raceRings[5].p.clone());
      else { this.audio.sfx("buy"); this.addBits(10); }
    } else if (r.time <= 0) {
      this.race = null; this.audio.sfx("nope");
      for (const ring of this.raceRings) ring.m.visible = false;
      this.ui.toast("Out of time! Talk to Sailor Bo to try again.", 2.5);
    }
  }

  // ---------------- main loop ----------------
  loop(now) {
    requestAnimationFrame((t) => this.loop(t));
    let dt = (now - this.last) / 1000; this.last = now;
    if (!(dt > 0)) dt = 0.016;
    dt = Math.min(dt, 1 / 30);
    this.input.poll();
    try { this.update(dt); } catch (e) { console.error(e); }
    this.renderer.render(this.scene, this.camera);
    this.input.endFrame();
    this.autoQuality(now);
    this.fpsAcc = (this.fpsAcc || 0) + dt; this.fpsN = (this.fpsN || 0) + 1;
    if (this.fpsAcc > 0.5) { const f = document.getElementById("cfFps"); if (f && !f.hidden) f.textContent = Math.round(this.fpsN / this.fpsAcc) + " fps"; this.fpsAcc = 0; this.fpsN = 0; }
  }

  // if the computer is struggling, step graphics down once (unless the player chose a quality)
  autoQuality(now) {
    if (this.settings.qualityChosen || this._aqDone) return;
    if (!this._aq) { this._aq = { t0: now, n: 0 }; return; }
    const a = this._aq; a.n++;
    if (now - a.t0 < 4000) return;
    const fps = a.n / ((now - a.t0) / 1000);
    if (fps < 40 && this.settings.quality !== "low") {
      this.settings.quality = fps < 24 ? "low" : this.settings.quality === "high" ? "medium" : "low";
      this.applySettings();
      a.t0 = now; a.n = 0; // measure again at the new setting
      if (this.settings.quality === "low") this._aqDone = true;
      return;
    }
    this._aqDone = true;
  }

  update(dt) {
    this.time += dt;
    const inp = this.input;
    this.world.update(this.time, dt);
    this.level.update(dt, this.time);
    // saturation fade (the world's color comes back as you find Sparkhearts)
    this.saturation += Math.sign(this.satTarget - this.saturation) * Math.min(Math.abs(this.satTarget - this.saturation), dt * this.satRate);
    SAT.value = this.saturation;

    // menu / title scene
    if (this.mode === "landing" || this.mode === "title" || this.mode === "credits" && !this.player.root.visible) {
      const m = this.menuFuse;
      const t = this.time;
      this.world.jet.visible = false;
      m.update(dt, { state: Math.sin(t * 0.25) > 0.85 ? "celebrate" : "idle", timer: t % 3, idleTime: 3, lookAt: Math.sin(t * 0.6) * 0.6 });
      m.root.rotation.y = 0.15 + Math.sin(t * 0.4) * 0.2;
      if (!this.cam.cine) this.cam.shot([-1, 5, 11.5], [-1, 5, 11.5], [-1.8, 4.4, 6], [-1.8, 4.4, 6], 1);
      const c = this.cam.cine; c.from.set(-0.6 + Math.sin(t * 0.15) * 0.8, 4.9 + Math.sin(t * 0.2) * 0.2, 11.2); c.to.copy(c.from); c.lf.set(-1.9, 4.5, 6); c.lt.copy(c.lf);
      this.cam.update(dt);
      this.fx.update(dt); this.rings.update(dt);
      this.updateSun(V(0, 4, 6));
      return;
    }

    // pause toggle
    if ((inp.pressed("pause") || inp.padHit(9)) && !this.cut.active) {
      if (this.mode === "play" && !this.dialog.open) { this.pause(); return; }
      if (this.mode === "play" && this.dialog.open && !this.cut.active) { this.dialog.close(); }
      if (this.mode === "paused" && this.ui.current === "pause") { this.resume(); return; }
      if (this.mode === "shop") { this.closeShop(); return; }
    }
    if (this.cut.active && (inp.pressed("pause") || inp.padHit(9))) this.cut.skip();

    if (this.mode === "paused" || this.mode === "gameover" || this.mode === "shop" || this.mode === "victory" || this.mode === "credits") {
      this.cam.update(0); this.fx.update(dt * 0.0); return;
    }

    if (this.mode === "play") {
      const p = this.player;
      this.world.jet.visible = true;
      this.dialog.update(dt);
      if (!this.cut.active) this.save.playtime += dt;
      if (this.cut.active) {
        // actors keep idling during cutscenes, Fuse plays his scripted pose
        p.model.update(dt, { state: p.forceAnim || "idle", timer: this.time % 2, idleTime: p.forceAnim === "sleep" ? 20 : 0, talking: p.talking });
        p.root.position.copy(p.pos); p.root.rotation.y = p.facing;
        p.shadow.visible = false;
        this.cut.update(dt);
        for (const n of this.npcs) n.update(dt);
        if (this.boss) this.boss.update(dt);
        this.cam.update(dt);
        this.fx.update(dt); this.rings.update(dt);
        this.updateSun(p.pos);
        return;
      }
      p.shadow.visible = true;
      this.cut.update(dt);

      if (this.celebrate > 0) {
        this.celebrate -= dt;
        p.model.update(dt, { state: "celebrate", timer: 1.8 - this.celebrate });
        if (this.celebrate <= 0) p.frozen = false;
      } else if (!this.dialog.open) p.update(dt);
      else p.model.update(dt, { state: "talk", talking: p.talking });

      if (this.boss) this.boss.update(dt);
      for (const a of this.actors) a.update(dt);
      for (const h of this.hearts) h.update(dt);
      for (const r of this.relics) r.update(dt);
      for (const c of this.checkpointObjs) c.update(dt);
      for (const n of this.npcs) n.update(dt);
      this.bits.update(dt, this.time);
      this.updateRace(dt);

      // kite pickup & carry
      if (this.kite.visible && !this.carryingKite && !this.save.hearts.includes("kite") && p.center.distanceTo(this.kite.position) < 1.6) {
        this.carryingKite = true; this.save.story.quests.kite = "carry"; this.audio.sfx("relic"); this.ui.banner("Item found", "Dot's Kite", "#7fd6a8");
      }
      if (this.carryingKite) {
        const tgt = p.pos.clone().add(V(-Math.sin(p.facing) * 1.2, 2.4 + Math.sin(this.time * 3) * 0.2, -Math.cos(p.facing) * 1.2));
        this.kite.position.lerp(tgt, 1 - Math.exp(-8 * dt)); this.kite.rotation.y = p.facing; this.kite.rotation.z = Math.sin(this.time * 2) * 0.2;
      } else if (this.kite.visible) this.kite.rotation.z = Math.sin(this.time * 2) * 0.15;

      // talk prompt
      const near = !this.dialog.open && performance.now() - (this.dialog.closedAt || 0) > 350 && this.npcs.find((n) => n.near);
      if (near) {
        this.ui.prompt(`${this.k("interact")} Talk to <b>${near.name}</b>`);
        if (inp.pressed("interact") || inp.padHit(1)) this.talk(near);
      } else this.ui.prompt(null);

      // tutorial hints
      let hint = null;
      for (const z of this.tutZones) if (!this.save.story.tutorial[z.id] && Math.hypot(p.pos.x - z.pos.x, p.pos.z - z.pos.z) < z.r && Math.abs(p.pos.y - z.pos.y) < 6) { hint = z.html(); break; }
      this.ui.hint(this.dialog.open ? null : hint);
      if (!this.save.story.tutorial.move && Math.hypot(p.pos.x - 2, p.pos.z - 23) > 6) this.tutorialDone("move");
      if (p.state === "jump2") this.tutorialDone("jump");
      if (p.state === "wall" && p.stateT > 0.1 && p.vel.y > 0) this.tutorialDone("walljump");
      if (p.state === "jump" && p.airControlLock > 0) this.tutorialDone("walljump");

      if (this.bossActive && p.pos.x > -47) { this.resetBoss(); this.ui.toast("Shellshock went back to sleep.", 2); }
      // the boss fight starts when you step into Shell Cove
      if (!this.save.story.boss && !this.bossActive && p.pos.x < -52.5 && p.grounded && !this.boss.dead) {
        if (!this.save.story.bossIntro) this.cut.run("bossIntro");
        else { this.setCheckpoint("gate"); this.boss.start(); this.bossActive = true; this.ui.bossBar(1); this.audio.play("boss", 0.6); this.ui.toast("Round two, Shellshock!", 2); }
      }
      // music follows where you are
      if (!this.race) { const want = this.world.musicAt(p.pos, this); if (this.audio.trackName !== want) this.audio.play(want, 2); }

      // autosave every 45 seconds of play
      this.autoT = (this.autoT || 0) + dt;
      if (this.autoT > 45) { this.autoT = 0; this.saveNow(false); }
      if (Math.floor(this.time * 2) !== Math.floor((this.time - dt) * 2)) { const o = document.getElementById("cfObj"); const txt = this.objective(); if (o && o.textContent !== txt) o.textContent = txt; }

      this.cam.update(dt);
      this.fx.update(dt); this.rings.update(dt);
      this.updateSun(p.pos);
    }
  }

  updateSun(focus) {
    const s = this.sun;
    s.position.set(focus.x + 30, focus.y + 50, focus.z + 20);
    s.target.position.copy(focus);
  }

  shake(a) { this.cam.shake(a); }
  flash() { if (!this.settings.reducedFlash) this.ui.flash(); }
}

// boot
const game = new Game();
game.boot().catch((e) => {
  console.error(e);
  if (window.cfShowError) window.cfShowError(e && (e.message || String(e)));
});
