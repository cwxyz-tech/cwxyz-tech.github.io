// All menus and overlays (built as HTML on top of the 3D canvas).
import { ACTIONS, keyLabel } from "./input.js";
import { SPEAKERS } from "./story.js";
import { CAPS, BODIES } from "./fuse.js";
import { TRACKS, TRACK_ORDER } from "./audio.js";

const $ = (sel, root = document) => root.querySelector(sel);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const fmtTime = (s) => { s = Math.floor(s); const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60); return h ? `${h}h ${String(m).padStart(2, "0")}m` : `${m}m ${String(s % 60).padStart(2, "0")}s`; };
const fmtDate = (t) => { try { return new Date(t).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }); } catch (e) { return ""; } };

export const WORLDS = [
  { id: "blossom", name: "Blossom Bay", blurb: "A sunny coastal paradise. Where it all begins.", color: "#a8e6cf" },
  { id: "candy", name: "Candy Cloud Kingdom", blurb: "Grizzle fled up here. Coming in Chapter 2.", color: "#ffd3b6" },
  { id: "ember", name: "Ember City", blurb: "A clanky, colorful machine city. Coming later.", color: "#ffaaa5" },
  { id: "forest", name: "The Forgotten Forest", blurb: "Glowing plants and old secrets. Coming later.", color: "#dcedc1" },
  { id: "summit", name: "Starfall Summit", blurb: "The mountain at the top of the sky. Coming later.", color: "#ff8b94" },
];

export const UPGRADES = [
  { id: "long", name: "Long Throw", desc: "Your cap flies almost half again as far.", price: 40 },
  { id: "hover", name: "Spin Hover", desc: "Hold the throw button to keep your cap spinning much longer.", price: 60 },
  { id: "spring", name: "Spring Brim", desc: "Cap bounces launch you even higher.", price: 70 },
  { id: "twin", name: "Twin Bounce", desc: "Bounce on your cap twice before landing.", price: 110 },
  { id: "heart", name: "Heart Charm", desc: "+1 max health.", price: 80 },
];

export class UI {
  constructor(game, root) {
    this.game = game; this.root = root;
    root.innerHTML = `
      <div class="cf-hud" id="cfHud" hidden>
        <div class="cf-hp" id="cfHp"></div>
        <div class="cf-counts"><div class="cf-pill" id="cfHearts"><i class="cf-ico heart"></i><b>0</b></div><div class="cf-pill" id="cfBits"><i class="cf-ico bit"></i><b>0</b></div></div>
        <div class="cf-obj" id="cfObj"></div>
        <div class="cf-boss" id="cfBoss" hidden><span>SHELLSHOCK</span><div><i id="cfBossFill"></i></div></div>
      </div>
      <div class="cf-hint" id="cfHint" hidden></div>
      <div class="cf-prompt" id="cfPrompt" hidden></div>
      <div class="cf-toasts" id="cfToasts"></div>
      <div class="cf-caption" id="cfCaption" hidden></div>
      <div class="cf-banner" id="cfBanner" hidden></div>
      <div class="cf-title" id="cfTitleCard" hidden></div>
      <div class="cf-bars" id="cfBars"><i></i><i></i><button class="cf-skip" id="cfSkip">Skip &#9654;&#9654;</button></div>
      <div class="cf-dialog" id="cfDialog" hidden><div class="cf-dname" id="cfDName"></div><div class="cf-dtext" id="cfDText"></div><div class="cf-dnext">&#9660;</div></div>
      <div class="cf-flash" id="cfFlash"></div>
      <div class="cf-fade" id="cfFade"></div>
      <div class="cf-screen" id="cfScreen" hidden></div>
      <div class="cf-confirm" id="cfConfirm" hidden></div>`;
    this.screen = $("#cfScreen", root);
    this.dialogEl = $("#cfDialog", root);
    $("#cfSkip", root).addEventListener("click", () => game.cut.skip());
    this.toastBox = $("#cfToasts", root);
    this.current = null;
    root.addEventListener("click", (e) => { const b = e.target.closest("button"); if (b && !b.disabled) game.audio.sfx("select"); });
    root.addEventListener("mouseover", (e) => { const b = e.target.closest("button"); if (b && b !== this._hov) { this._hov = b; game.audio.sfx("menu"); } });
  }

  // ---------------- HUD ----------------
  showHud(on) { $("#cfHud", this.root).hidden = !on; if (on) this.hud(); }
  hud() {
    const g = this.game, p = g.player;
    if (!p) return;
    const hp = $("#cfHp", this.root);
    let h = "";
    for (let i = 0; i < p.maxHp; i++) h += `<i class="cf-spark ${i < p.hp ? "on" : ""}"></i>`;
    hp.innerHTML = h;
    hp.classList.toggle("low", p.hp === 1);
    $("#cfHearts b", this.root).textContent = `${g.save.hearts.length} / ${g.heartTotal}`;
    $("#cfBits b", this.root).textContent = g.save.bits;
    $("#cfObj", this.root).textContent = g.objective();
  }
  bump(id) { const el = $(id, this.root); el.classList.remove("bump"); void el.offsetWidth; el.classList.add("bump"); }
  bossBar(k) { const b = $("#cfBoss", this.root); if (k == null) { b.hidden = true; return; } b.hidden = false; $("#cfBossFill", this.root).style.width = Math.max(0, k * 100) + "%"; }

  toast(text, secs = 2) {
    const d = document.createElement("div"); d.className = "cf-toast"; d.textContent = text;
    this.toastBox.appendChild(d);
    while (this.toastBox.children.length > 3) this.toastBox.firstChild.remove();
    setTimeout(() => { d.classList.add("out"); setTimeout(() => d.remove(), 400); }, secs * 1000);
  }
  caption(text) {
    if (!this.game.settings.captions) return;
    const c = $("#cfCaption", this.root); c.textContent = text; c.hidden = false;
    clearTimeout(this._capT); this._capT = setTimeout(() => (c.hidden = true), 1800);
  }
  hint(html) { const h = $("#cfHint", this.root); if (!html) { h.hidden = true; this._hint = null; return; } if (this._hint === html) return; this._hint = html; h.innerHTML = html; h.hidden = false; h.classList.remove("in"); void h.offsetWidth; h.classList.add("in"); }
  prompt(text) { const p = $("#cfPrompt", this.root); if (!text) { p.hidden = true; return; } p.innerHTML = text; p.hidden = false; }
  banner(top, sub, color = "#ff8b94") {
    const b = $("#cfBanner", this.root);
    $("#cfTitleCard", this.root).hidden = true;
    b.innerHTML = `<small>${esc(top)}</small><b style="color:${color}">${esc(sub)}</b>`;
    b.hidden = false; b.classList.remove("in"); void b.offsetWidth; b.classList.add("in");
    clearTimeout(this._banT); this._banT = setTimeout(() => (b.hidden = true), 3200);
  }
  title(big, small) {
    const t = $("#cfTitleCard", this.root); t.innerHTML = `<b>${esc(big)}</b><small>${esc(small)}</small>`;
    t.hidden = false; t.classList.remove("in"); void t.offsetWidth; t.classList.add("in");
    clearTimeout(this._titT); this._titT = setTimeout(() => (t.hidden = true), 3600);
  }
  cinema(on) { $("#cfBars", this.root).classList.toggle("on", on); if (on) { this.showHud(false); this.hint(null); this.prompt(null); } else if (this.game.mode === "play") this.showHud(true); }
  flash() { const f = $("#cfFlash", this.root); f.classList.remove("go"); void f.offsetWidth; f.classList.add("go"); }
  fade(on, ms = 400) { const f = $("#cfFade", this.root); f.style.transitionDuration = ms + "ms"; f.classList.toggle("on", on); return new Promise((r) => setTimeout(r, ms)); }

  // ---------------- screens ----------------
  open(html, cls = "") {
    this.screen.className = "cf-screen " + cls;
    this.screen.innerHTML = html; this.screen.hidden = false;
    const first = this.screen.querySelector("button:not([disabled]), input");
    if (first && this.game.input.lastDevice === "pad") first.focus();
    return this.screen;
  }
  close() { this.screen.hidden = true; this.screen.innerHTML = ""; this.current = null; }
  get isOpen() { return !this.screen.hidden; }
  on(id, fn) { const el = this.screen.querySelector(id); if (el) el.addEventListener("click", fn); return el; }

  confirm(text, yes = "Yes", no = "Cancel") {
    return new Promise((res) => {
      const c = $("#cfConfirm", this.root);
      c.innerHTML = `<div class="cf-card cf-pop"><p>${text}</p><div class="cf-row"><button class="cf-btn danger" data-a="1">${esc(yes)}</button><button class="cf-btn" data-a="0">${esc(no)}</button></div></div>`;
      c.hidden = false;
      c.onclick = (e) => { const b = e.target.closest("button"); if (!b) return; c.hidden = true; c.onclick = null; res(b.dataset.a === "1"); };
      const nb = c.querySelectorAll("button")[1]; if (nb) nb.focus();
    });
  }

  landing() {
    this.current = "landing";
    const s = this.open(`
      <div class="cf-landing">
        <h1 class="cf-logo"><span class="c1">CAP</span><span class="amp">&amp;</span><span class="c2">FUSE</span></h1>
        <p class="cf-tag">A little bomb. A very old hat. A whole lot of bouncing.</p>
        <button class="cf-play" id="cfPlay">&#9654; PLAY</button>
        <p class="cf-small">Keyboard &amp; mouse or a controller. Sound on for the full experience!</p>
      </div>`, "clear");
    this.on("#cfPlay", () => this.game.onPlay());
    $("#cfPlay", s).focus();
  }

  mainMenu(hasSave) {
    this.current = "main";
    this.open(`
      <div class="cf-menu-wrap">
        <h1 class="cf-logo small"><span class="c1">CAP</span><span class="amp">&amp;</span><span class="c2">FUSE</span></h1>
        <div class="cf-menu">
          ${hasSave ? `<button class="cf-btn big" id="mContinue">Continue</button>` : ""}
          <button class="cf-btn big" id="mNew">New Game</button>
          <button class="cf-btn" id="mSaves">Save Files</button>
          <button class="cf-btn" id="mSettings">Settings</button>
          <button class="cf-btn" id="mExtras">Extras</button>
          <button class="cf-btn" id="mCredits">Credits</button>
        </div>
        <p class="cf-ver">Chapter 1: Blossom Bay &middot; v1.0</p>
      </div>`, "clear left");
    this.on("#mContinue", () => this.game.continueGame());
    this.on("#mNew", () => this.game.newGameFlow());
    this.on("#mSaves", () => this.saveFiles());
    this.on("#mSettings", () => this.settings(() => this.game.toTitle(true)));
    this.on("#mExtras", () => this.extras());
    this.on("#mCredits", () => this.game.rollCredits(false));
  }

  async saveFiles(mode = "browse") {
    this.current = "saves";
    const slots = await this.game.readAllSlots();
    const card = (n) => {
      const r = slots[n];
      if (r.state === "empty") return `<div class="cf-slot empty"><h3>File ${n}</h3><p class="cf-dim">Empty</p><div class="cf-row"><button class="cf-btn" data-new="${n}">New Game</button></div></div>`;
      if (r.state === "corrupt") return `<div class="cf-slot bad"><h3>File ${n}</h3><p>This save file is damaged and can't be loaded.</p><div class="cf-row">${r.backup ? `<button class="cf-btn" data-restore="${n}">Restore Backup</button>` : ""}<button class="cf-btn danger" data-del="${n}">Delete</button></div></div>`;
      const d = r.data;
      const hearts = Array.from({ length: this.game.heartTotal }, (_, i) => `<i class="cf-mini ${i < d.hearts.length ? "on" : ""}"></i>`).join("");
      return `<div class="cf-slot"><h3>File ${n} <small>${esc(WORLDS.find((w) => w.id === d.world)?.name || "Blossom Bay")}</small></h3>
        <div class="cf-hearts">${hearts}</div>
        <p><b>${d.hearts.length}</b> Sparkhearts &middot; <b>${d.bits}</b> Sparkbits &middot; <b>${d.relics.length}/3</b> relics</p>
        <p class="cf-dim">Played ${fmtTime(d.playtime)} &middot; Last played ${fmtDate(d.lastPlayed)}${d.story.boss ? " &middot; &#9733; Chapter clear" : ""}</p>
        <div class="cf-row"><button class="cf-btn" data-load="${n}">Play</button><button class="cf-btn danger" data-del="${n}">Delete</button></div></div>`;
    };
    const s = this.open(`<div class="cf-panel"><h2>Save Files</h2><div class="cf-slots">${[1, 2, 3].map(card).join("")}</div>
      <p class="cf-dim cf-center">Your progress saves automatically at checkpoints and when you collect Sparkhearts. It's stored in this browser.</p>
      <div class="cf-row center"><button class="cf-btn" id="sBack">Back</button></div></div>`);
    this.on("#sBack", () => this.game.toTitle(true));
    s.querySelectorAll("[data-load]").forEach((b) => b.addEventListener("click", () => this.game.loadSlot(+b.dataset.load)));
    s.querySelectorAll("[data-new]").forEach((b) => b.addEventListener("click", () => this.game.startNew(+b.dataset.new)));
    s.querySelectorAll("[data-del]").forEach((b) => b.addEventListener("click", async () => {
      if (await this.confirm(`Delete File ${b.dataset.del}? This can't be undone.`, "Delete")) { await this.game.deleteSlot(+b.dataset.del); this.saveFiles(); }
    }));
    s.querySelectorAll("[data-restore]").forEach((b) => b.addEventListener("click", async () => { await this.game.restoreSlot(+b.dataset.restore); this.saveFiles(); }));
  }

  settings(back, inGame = false) {
    const g = this.game, st = g.settings;
    this.current = "settings";
    const keyRows = Object.keys(ACTIONS).map((a) => `<div class="cf-key"><span>${ACTIONS[a]}</span><button class="cf-btn tiny" data-key="${a}">${(g.input.keys[a] || []).map(keyLabel).join(" / ")}</button></div>`).join("");
    const s = this.open(`<div class="cf-panel wide"><h2>Settings</h2>
      <div class="cf-tabs"><button class="cf-tab on" data-tab="audio">Audio</button><button class="cf-tab" data-tab="video">Video</button><button class="cf-tab" data-tab="controls">Controls</button><button class="cf-tab" data-tab="access">Accessibility</button></div>
      <div class="cf-tabpane" data-pane="audio">
        <label class="cf-range">Music volume <input type="range" min="0" max="100" id="stMusic" value="${Math.round(st.music * 100)}"><output>${Math.round(st.music * 100)}</output></label>
        <label class="cf-check"><input type="checkbox" id="stMuteM" ${st.muteMusic ? "checked" : ""}> Mute music</label>
        <label class="cf-range">Sound effects volume <input type="range" min="0" max="100" id="stSfx" value="${Math.round(st.sfx * 100)}"><output>${Math.round(st.sfx * 100)}</output></label>
        <label class="cf-check"><input type="checkbox" id="stMuteS" ${st.muteSfx ? "checked" : ""}> Mute sound effects</label>
      </div>
      <div class="cf-tabpane" data-pane="video" hidden>
        <label class="cf-sel">Graphics quality <select id="stQuality"><option value="low">Low (fastest)</option><option value="medium">Medium</option><option value="high">High (prettiest)</option></select></label>
        <label class="cf-check"><input type="checkbox" id="stFull" ${document.fullscreenElement ? "checked" : ""}> Fullscreen</label>
        <label class="cf-check"><input type="checkbox" id="stFps" ${st.showFps ? "checked" : ""}> Show frame rate</label>
      </div>
      <div class="cf-tabpane" data-pane="controls" hidden>
        <label class="cf-range">Camera sensitivity <input type="range" min="20" max="250" id="stSens" value="${Math.round(st.camSens * 100)}"><output>${Math.round(st.camSens * 100)}%</output></label>
        <label class="cf-check"><input type="checkbox" id="stInv" ${st.invertY ? "checked" : ""}> Invert camera up/down</label>
        <p class="cf-dim">Click a key to change it, then press the new key or mouse button.</p>
        <div class="cf-keys">${keyRows}</div>
        <div class="cf-row"><button class="cf-btn tiny" id="stResetKeys">Reset keys</button></div>
        <p class="cf-dim">Controller: Left stick move &middot; Right stick camera &middot; A jump &middot; X/Y throw cap &middot; B talk &middot; LB/LT ground pound (then X to dive) &middot; RB/RT sprint &middot; Start pause</p>
      </div>
      <div class="cf-tabpane" data-pane="access" hidden>
        <label class="cf-check"><input type="checkbox" id="stCaps" ${st.captions ? "checked" : ""}> Subtitles for sounds (e.g. "[Thunder rumbles]")</label>
        <label class="cf-check"><input type="checkbox" id="stShake" ${st.reducedShake ? "checked" : ""}> Reduce screen shake</label>
        <label class="cf-check"><input type="checkbox" id="stFlash" ${st.reducedFlash ? "checked" : ""}> Reduce bright flashes</label>
        <label class="cf-sel">Dialogue speed <select id="stText"><option value="1">Normal</option><option value="2">Fast</option><option value="99">Instant</option></select></label>
      </div>
      <div class="cf-row center"><button class="cf-btn" id="stBack">Done</button></div></div>`);
    $("#stQuality", s).value = st.quality; $("#stText", s).value = String(st.textSpeed);
    s.querySelectorAll(".cf-tab").forEach((t) => t.addEventListener("click", () => {
      s.querySelectorAll(".cf-tab").forEach((x) => x.classList.toggle("on", x === t));
      s.querySelectorAll(".cf-tabpane").forEach((p) => (p.hidden = p.dataset.pane !== t.dataset.tab));
    }));
    const range = (id, key, k = 100, suffix = "") => { const el = $(id, s); el.addEventListener("input", () => { st[key] = el.value / k; el.nextElementSibling.textContent = el.value + suffix; g.applySettings(); }); };
    range("#stMusic", "music"); range("#stSfx", "sfx"); range("#stSens", "camSens", 100, "%");
    const check = (id, key) => $(id, s).addEventListener("change", (e) => { st[key] = e.target.checked; g.applySettings(); });
    check("#stMuteM", "muteMusic"); check("#stMuteS", "muteSfx"); check("#stInv", "invertY"); check("#stCaps", "captions"); check("#stShake", "reducedShake"); check("#stFlash", "reducedFlash"); check("#stFps", "showFps");
    $("#stQuality", s).addEventListener("change", (e) => { st.quality = e.target.value; st.qualityChosen = true; g.applySettings(); });
    $("#stText", s).addEventListener("change", (e) => { st.textSpeed = +e.target.value; g.applySettings(); });
    $("#stFull", s).addEventListener("change", (e) => g.setFullscreen(e.target.checked));
    s.querySelectorAll("[data-key]").forEach((b) => b.addEventListener("click", () => {
      b.textContent = "Press a key..."; b.classList.add("listening");
      g.input.listening = (code) => {
        b.classList.remove("listening");
        if (code !== "Escape" || b.dataset.key === "pause") {
          const a = b.dataset.key;
          for (const k in g.input.keys) if (k !== a) g.input.keys[k] = g.input.keys[k].filter((c) => c !== code); // no duplicates
          g.input.keys[a] = [code, ...(g.input.keys[a] || []).filter((c) => c !== code)].slice(0, 2);
          st.keys = structuredClone(g.input.keys); g.applySettings();
        }
        this.settings(back, inGame); this.screen.querySelector('[data-tab="controls"]').click();
      };
    }));
    this.on("#stResetKeys", () => { st.keys = null; g.input.setKeys(null); g.applySettings(); this.settings(back, inGame); this.screen.querySelector('[data-tab="controls"]').click(); });
    this.on("#stBack", () => { g.input.listening = null; g.saveSettings(); back(); });
  }

  extras() {
    this.current = "extras";
    const s = this.open(`<div class="cf-panel"><h2>Extras</h2>
      <h3>Sound Test</h3><p class="cf-dim">Every song in Cap &amp; Fuse, including themes for worlds still to come.</p>
      <div class="cf-tracks">${TRACK_ORDER.map((k, i) => `<button class="cf-btn tiny track" data-t="${k}">${String(i + 1).padStart(2, "0")} &middot; ${esc(TRACKS[k].title)}</button>`).join("")}</div>
      <h3>Version Notes</h3><p class="cf-dim"><b>v1.0</b> &middot; Chapter 1: Blossom Bay is here! Explore, find the Sparkhearts and face Shellshock.</p>
      <div class="cf-row center"><button class="cf-btn" id="xControls">How to Play</button><button class="cf-btn" id="xBack">Back</button></div></div>`);
    s.querySelectorAll("[data-t]").forEach((b) => b.addEventListener("click", () => {
      s.querySelectorAll(".track").forEach((x) => x.classList.remove("on")); b.classList.add("on");
      const t = b.dataset.t; if (TRACKS[t].jingle) this.game.audio.jingle(t); else this.game.audio.play(t, 0.5);
    }));
    this.on("#xControls", () => this.howTo(() => this.extras()));
    this.on("#xBack", () => { this.game.audio.play("menu"); this.game.toTitle(true); });
  }

  howTo(back) {
    const k = (a) => (this.game.input.keys[a] || []).map(keyLabel).map((x) => `<kbd>${esc(x)}</kbd>`).join(" ");
    this.open(`<div class="cf-panel"><h2>How to Play</h2>
      <div class="cf-howto">
        <div><b>Move</b> ${k("forward")} ${k("left")} ${k("back")} ${k("right")}</div>
        <div><b>Camera</b> Mouse (click the game to lock the pointer) or ${k("camLeft")} ${k("camRight")}</div>
        <div><b>Jump</b> ${k("jump")} &middot; press again in the air to <b>double jump</b></div>
        <div><b>Sprint</b> hold ${k("sprint")}</div>
        <div><b>Throw cap</b> ${k("throw")} &middot; hold to keep it hovering</div>
        <div><b>Cap bounce</b> jump into your hovering cap in midair</div>
        <div><b>Dive</b> ${k("dive")} &middot; or ground pound then throw. Dive into your cap to bounce again!</div>
        <div><b>Ground pound</b> ${k("pound")} in the air &middot; jump right after landing for a <b>super jump</b></div>
        <div><b>Roll</b> ${k("pound")} while running &middot; tap again to keep rolling</div>
        <div><b>Backflip</b> hold ${k("pound")} standing still, then jump</div>
        <div><b>Wall jump</b> jump while sliding down a wall</div>
        <div><b>Talk</b> ${k("interact")} &middot; <b>Pause</b> ${k("pause")}</div>
      </div>
      <p class="cf-dim"><b>Pro combo:</b> jump &rarr; throw cap &rarr; dive into it &rarr; bounce &rarr; double jump &rarr; dive. Covers huge gaps!</p>
      <div class="cf-row center"><button class="cf-btn" id="hBack">Back</button></div></div>`);
    this.on("#hBack", back);
  }

  pause() {
    this.current = "pause";
    const g = this.game;
    this.open(`<div class="cf-panel narrow cf-pop"><h2>Paused</h2>
      <p class="cf-dim cf-center">${esc(g.world.name)} &middot; ${g.save.hearts.length}/${g.heartTotal} Sparkhearts &middot; ${fmtTime(g.save.playtime)}</p>
      <div class="cf-menu">
        <button class="cf-btn big" id="pResume">Resume</button>
        <button class="cf-btn" id="pMap">World Map</button>
        <button class="cf-btn" id="pCollect">Collection &amp; Wardrobe</button>
        <button class="cf-btn" id="pSave">Save Game</button>
        <button class="cf-btn" id="pHow">How to Play</button>
        <button class="cf-btn" id="pSettings">Settings</button>
        <button class="cf-btn" id="pFull">${document.fullscreenElement ? "Exit Fullscreen" : "Fullscreen"}</button>
        <button class="cf-btn danger" id="pQuit">Quit to Title</button>
      </div></div>`, "dim");
    this.on("#pResume", () => g.resume());
    this.on("#pMap", () => this.worldMap());
    this.on("#pCollect", () => this.collection());
    this.on("#pSave", async () => { const ok = await g.saveNow(true); this.toast(ok ? "Game saved!" : "Couldn't save. Check your browser storage settings.", 2); });
    this.on("#pHow", () => this.howTo(() => this.pause()));
    this.on("#pSettings", () => this.settings(() => this.pause(), true));
    this.on("#pFull", () => { g.setFullscreen(!document.fullscreenElement); setTimeout(() => this.pause(), 200); });
    this.on("#pQuit", async () => { if (await this.confirm("Quit to the title screen? Your progress since the last checkpoint will be saved.", "Quit")) g.quitToTitle(); });
  }

  worldMap() {
    this.current = "map";
    const g = this.game, W = g.world;
    const cps = Object.entries(W.checkpoints).filter(([id]) => g.save.checkpoints.includes(id));
    const worlds = WORLDS.map((w, i) => {
      const open = g.save.unlocked.includes(w.id);
      const got = w.id === "blossom" ? `${g.save.hearts.length}/${g.heartTotal} &#9829;` : open ? "" : "&#128274;";
      return `<div class="cf-world ${open ? "" : "locked"} ${w.id === g.save.world ? "here" : ""}" style="--wc:${w.color}"><i class="cf-isle"></i><b>${esc(w.name)}</b><span>${got}</span><small>${esc(w.blurb)}</small></div>`;
    }).join(`<i class="cf-path"></i>`);
    const s = this.open(`<div class="cf-panel wide cf-pop"><h2>World Map</h2>
      <div class="cf-worlds">${worlds}</div>
      <h3>Fast travel in ${esc(W.name)}</h3>
      <div class="cf-travel">${cps.map(([id, c]) => `<button class="cf-btn tiny" data-cp="${id}">&#9873; ${esc(c.name)}</button>`).join("")}</div>
      <p class="cf-dim">Touch a checkpoint flag to add it here.</p>
      <div class="cf-row center"><button class="cf-btn" id="wBack">Back</button></div></div>`, "dim");
    s.querySelectorAll("[data-cp]").forEach((b) => b.addEventListener("click", () => g.fastTravel(b.dataset.cp)));
    this.on("#wBack", () => this.pause());
  }

  collection() {
    this.current = "collection";
    const g = this.game, sv = g.save;
    const hearts = g.heartList.map((h) => `<div class="cf-item ${sv.hearts.includes(h.id) ? "got" : ""}"><i class="cf-ico heart"></i><span>${sv.hearts.includes(h.id) ? esc(h.name) : "???"}</span><small>${sv.hearts.includes(h.id) ? "" : esc(h.hint)}</small></div>`).join("");
    const relics = g.relicList.map((r) => `<div class="cf-item ${sv.relics.includes(r.id) ? "got" : ""}"><i class="cf-ico relic"></i><span>${sv.relics.includes(r.id) ? esc(r.name) : "???"}</span><small>${sv.relics.includes(r.id) ? esc(r.lore) : esc(r.hint)}</small></div>`).join("");
    const ups = UPGRADES.map((u) => `<div class="cf-item ${sv.upgrades.includes(u.id) ? "got" : ""}"><i class="cf-ico up"></i><span>${esc(u.name)}</span><small>${sv.upgrades.includes(u.id) ? esc(u.desc) : "Sold at Coco's"}</small></div>`).join("");
    const caps = Object.entries(CAPS).map(([id, c]) => { const own = sv.cosmetics.includes(id); return `<button class="cf-btn tiny ${sv.wearing === id ? "on" : ""}" ${own ? "" : "disabled"} data-cap="${id}">${own ? esc(c.name) : "&#128274; " + esc(c.name)}</button>`; }).join("");
    const bodies = Object.entries(BODIES).map(([id, c]) => { const own = sv.cosmetics.includes("b_" + id) || id === "classic"; return `<button class="cf-btn tiny ${sv.body === id ? "on" : ""}" ${own ? "" : "disabled"} data-body="${id}">${own ? esc(c.name) : "&#128274; " + esc(c.name)}</button>`; }).join("");
    const s = this.open(`<div class="cf-panel wide cf-pop"><h2>Collection</h2>
      <p class="cf-center"><b>${sv.hearts.length}/${g.heartTotal}</b> Sparkhearts &middot; <b>${sv.relics.length}/3</b> Capwright Relics &middot; <b>${sv.bits}</b> Sparkbits (${sv.bitsTotalEarned} found all-time)</p>
      <h3>Sparkhearts</h3><div class="cf-grid">${hearts}</div>
      <h3>Capwright Relics (hidden treasures)</h3><div class="cf-grid">${relics}</div>
      <h3>Cap Upgrades</h3><div class="cf-grid">${ups}</div>
      <h3>Wardrobe</h3><p class="cf-dim">Caps</p><div class="cf-travel">${caps}</div><p class="cf-dim">Colors</p><div class="cf-travel">${bodies}</div>
      <div class="cf-row center"><button class="cf-btn" id="cBack">Back</button></div></div>`, "dim");
    s.querySelectorAll("[data-cap]").forEach((b) => b.addEventListener("click", () => { g.wear(b.dataset.cap, null); this.collection(); }));
    s.querySelectorAll("[data-body]").forEach((b) => b.addEventListener("click", () => { g.wear(null, b.dataset.body); this.collection(); }));
    this.on("#cBack", () => this.pause());
  }

  shop() {
    this.current = "shop";
    const g = this.game, sv = g.save;
    const row = (id, name, desc, price, owned, kind) => `<div class="cf-shopitem ${owned ? "owned" : ""}"><div><b>${esc(name)}</b><small>${esc(desc)}</small></div>
      ${owned ? `<span class="cf-owned">Owned</span>` : `<button class="cf-btn tiny" data-buy="${kind}:${id}" ${sv.bits < price ? "disabled" : ""}><i class="cf-ico bit"></i> ${price}</button>`}</div>`;
    const ups = UPGRADES.map((u) => row(u.id, u.name, u.desc, u.price, sv.upgrades.includes(u.id), "up")).join("");
    const caps = Object.entries(CAPS).filter(([, c]) => c.price > 0).map(([id, c]) => row(id, c.name, "A fresh new cap style.", c.price, sv.cosmetics.includes(id), "cap")).join("");
    const bodies = Object.entries(BODIES).filter(([, c]) => c.price > 0).map(([id, c]) => row(id, c.name, "A new coat of paint for Fuse.", c.price, sv.cosmetics.includes("b_" + id), "body")).join("");
    const s = this.open(`<div class="cf-panel wide cf-pop"><h2>Coco's Caps &amp; Charms</h2>
      <p class="cf-center">You have <b><i class="cf-ico bit"></i> ${sv.bits}</b> Sparkbits</p>
      <h3>Cap Upgrades</h3>${ups}<h3>Caps</h3>${caps}<h3>Colors</h3>${bodies}
      <div class="cf-row center"><button class="cf-btn" id="shBack">Thanks, Coco!</button></div></div>`, "dim");
    s.querySelectorAll("[data-buy]").forEach((b) => b.addEventListener("click", () => { const [k, id] = b.dataset.buy.split(":"); g.buy(k, id); this.shop(); }));
    this.on("#shBack", () => g.closeShop());
  }

  gameOver() {
    this.current = "gameover";
    this.open(`<div class="cf-panel narrow cf-pop cf-center"><h2 class="cf-sad">Fuse fizzled!</h2><p>Don't worry, he's tougher than he looks.</p>
      <div class="cf-menu"><button class="cf-btn big" id="goRetry">Try Again</button><button class="cf-btn" id="goQuit">Quit to Title</button></div></div>`, "dim");
    this.on("#goRetry", () => this.game.retry());
    this.on("#goQuit", () => this.game.quitToTitle());
  }

  victory(stats) {
    this.current = "victory";
    this.open(`<div class="cf-panel cf-pop cf-center cf-victory"><small>CHAPTER 1 CLEAR</small><h2>Blossom Bay is saved!</h2>
      <div class="cf-stats"><div><b>${stats.hearts}/${stats.total}</b>Sparkhearts</div><div><b>${stats.relics}/3</b>Relics</div><div><b>${stats.bits}</b>Sparkbits</div><div><b>${fmtTime(stats.time)}</b>Play time</div></div>
      <p>To be continued in the Candy Cloud Kingdom...</p>
      <div class="cf-menu"><button class="cf-btn big" id="vCredits">See the Credits</button></div></div>`, "dim");
    this.on("#vCredits", () => this.game.rollCredits(true));
  }

  credits(afterGame) {
    this.current = "credits";
    const s = this.open(`<div class="cf-credits"><div class="cf-roll" id="cfRoll">
      <h1 class="cf-logo small"><span class="c1">CAP</span><span class="amp">&amp;</span><span class="c2">FUSE</span></h1>
      <h3>Chapter 1: Blossom Bay</h3>
      <p><small>Concept, Direction &amp; Game Design</small>Cole</p>
      <p><small>Starring</small>Fuse, a little bomb with a big cap</p>
      <p><small>Featuring</small>Grandma Wick &middot; Mayor Pip &middot; Coco &middot; Nell &middot; Dot &middot; Sailor Bo &middot; Old Sal</p>
      <p><small>And introducing</small>Shellshock, who found a home after all<br>Grizzle the Gloomcloud, who still has the Great Sparkheart</p>
      <p><small>Original 8-bit Soundtrack</small>12 original chiptunes, played live on a little NES-style sound chip</p>
      <p><small>Built with</small>three.js (MIT License) &middot; Web Audio</p>
      <p><small>Playtesters</small>Everyone who jumps into their cap for the first time</p>
      <p><small>Special Thanks</small>You, for playing!</p>
      <h3>See you in the clouds.</h3>
    </div><button class="cf-btn cf-credskip" id="crBack">${afterGame ? "Keep Exploring" : "Back"}</button></div>`, "credits");
    const roll = $("#cfRoll", s);
    roll.style.animationDuration = "38s";
    roll.addEventListener("animationend", () => this.game.creditsDone(afterGame));
    this.on("#crBack", () => this.game.creditsDone(afterGame));
  }

  // ---------------- dialogue box ----------------
  dialog() { return this.dialogEl; }
}

// Dialogue player: typewriter text with little voice blips, advance with
// Jump / Talk / Enter or a click.
export class Dialog {
  constructor(game, ui) {
    this.game = game; this.ui = ui; this.open = false; this.queue = []; this.res = null;
    this.el = ui.dialogEl; this.nameEl = $("#cfDName", ui.root); this.textEl = $("#cfDText", ui.root);
    this.el.addEventListener("click", () => this.advance());
  }
  play(lines) {
    return new Promise((res) => {
      this.queue = lines.slice(); this.res = res; this.open = true; this.el.hidden = false;
      this.next();
    });
  }
  next() {
    const l = this.queue.shift();
    if (!l) { this.close(); return; }
    const sp = SPEAKERS[l.who] || SPEAKERS.sign;
    this.nameEl.textContent = sp.name; this.nameEl.style.background = sp.color;
    this.nameEl.hidden = l.who === "sign";
    this.full = l.text; this.shown = 0; this.voice = sp.voice; this.textEl.textContent = "";
    this.cur = l;
    const g = this.game;
    if (l.who === "fuse" && g.player) { g.player.model.setFace(l.face || "smile", 3); }
    const npc = g.npcByKind && g.npcByKind(l.who); if (npc) { npc.talking = true; this.talkNpc = npc; }
    if (l.face && l.who !== "fuse" && npc) npc.happy = l.face === "happy" ? 1 : 0;
  }
  update(dt) {
    if (!this.open || this.full == null) return;
    const spd = this.game.settings.textSpeed || 1;
    if (this.shown < this.full.length) {
      const before = Math.floor(this.shown);
      this.shown = Math.min(this.full.length, this.shown + dt * 45 * spd);
      const now = Math.floor(this.shown);
      if (now !== before) {
        this.textEl.textContent = this.full.slice(0, now);
        if (this.voice && now % 2 === 0 && /\w/.test(this.full[now - 1] || "")) this.game.audio.sfx("talk", { voice: this.voice });
      }
    }
    if (this.cur && this.cur.who === "fuse" && this.game.player) this.game.player.talking = this.shown < this.full.length;
    const inp = this.game.input;
    if (inp.pressed("jump") || inp.pressed("interact") || inp.down.has("Enter") && inp.pressedFrame.has("Enter") || inp.padHit(0) || inp.padHit(1)) this.advance();
  }
  advance() {
    if (!this.open) return;
    if (this.shown < this.full.length) { this.shown = this.full.length; this.textEl.textContent = this.full; return; }
    if (this.talkNpc) { this.talkNpc.talking = false; this.talkNpc = null; }
    this.game.audio.sfx("menu");
    this.next();
  }
  close(silent) {
    this.closedAt = performance.now();
    this.open = false; this.el.hidden = true; this.full = null;
    if (this.talkNpc) { this.talkNpc.talking = false; this.talkNpc = null; }
    if (this.game.player) this.game.player.talking = false;
    const r = this.res; this.res = null; if (r) r();
  }
}
