// Cole's Games for Windows and Linux.
// The same three games as the Mac app, served from inside the app (offline, nothing from the internet),
// in a native window with a toolbar, keyboard shortcuts, full screen, and each game fitted to the window.
"use strict";

const { app, BaseWindow, WebContentsView, Menu, protocol, ipcMain, shell, nativeTheme, screen,
  systemPreferences, dialog, session } = require("electron");
const fs = require("fs");
const path = require("path");

const SCHEME = "colesgames";
const HOME = SCHEME + "://localhost";
const WWW = path.join(__dirname, "www");
const TOOLBAR_HEIGHT = 46;

const PAGES = [
  { title: "Home", path: "/", key: "0" },
  { title: "Blackjack DX", path: "/blackjack/", key: "1" },
  { title: "Lines DX", path: "/linesdx/", key: "2" },
  { title: "Lucky Flip", path: "/luckyflip/", key: "3" },
  { title: "Music", path: "/#music", key: "4" }
];

// refuse Chromium's remote-control switches, so no other program can drive the app
if (["remote-debugging-port", "remote-debugging-pipe", "remote-debugging-address"].some((s) => app.commandLine.hasSwitch(s))) {
  app.exit(1);
}

app.setName("Cole's Games");
if (process.platform === "win32") app.setAppUserModelId("xyz.coleswebsite.colesgames");
app.commandLine.appendSwitch("enable-gpu-rasterization");
if (process.platform === "linux") app.commandLine.appendSwitch("ozone-platform-hint", "auto");   // native Wayland when available

// one copy at a time: opening it again just brings the window forward
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (!win) return;
    if (win.isMinimized()) win.restore();
    win.show();
    win.focus();
  });
}

// the games are served from colesgames://localhost so they can load their music and keep their saves,
// exactly like on the website
protocol.registerSchemesAsPrivileged([{
  scheme: SCHEME,
  privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true, corsEnabled: false }
}]);

const MIME = {
  ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8", ".png": "image/png", ".gif": "image/gif", ".jpg": "image/jpeg",
  ".ico": "image/x-icon", ".svg": "image/svg+xml", ".mp3": "audio/mpeg", ".woff2": "font/woff2",
  ".txt": "text/plain; charset=utf-8"
};
const fileCache = new Map();   // files are read once, then served from memory

function readBundled(rel) {
  const full = path.normalize(path.join(WWW, rel));
  if (!full.startsWith(WWW + path.sep)) return null;            // never outside the games folder
  let file = full;
  try { if (fs.statSync(file).isDirectory()) file = path.join(file, "index.html"); } catch (e) { return null; }
  if (fileCache.has(file)) return { file, data: fileCache.get(file) };
  try {
    const data = fs.readFileSync(file);
    fileCache.set(file, data);
    return { file, data };
  } catch (e) { return null; }
}

function serve(request) {
  const url = new URL(request.url);
  let rel = decodeURIComponent(url.pathname);
  if (rel.endsWith("/")) rel += "index.html";
  const hit = readBundled(rel);
  if (!hit) return new Response("Not found", { status: 404, headers: { "Content-Type": "text/plain" } });
  const type = MIME[path.extname(hit.file).toLowerCase()] || "application/octet-stream";
  const size = hit.data.length;
  const headers = { "Content-Type": type, "Accept-Ranges": "bytes", "Cache-Control": "no-cache" };
  // the music player asks for pieces of a song ("Range: bytes=start-end")
  const range = /^bytes=(\d*)-(\d*)$/.exec(request.headers.get("Range") || "");
  if (range && (range[1] || range[2])) {
    let start, end;
    if (range[1] === "") { start = Math.max(0, size - Number(range[2])); end = size - 1; }
    else { start = Number(range[1]); end = range[2] === "" ? size - 1 : Math.min(Number(range[2]), size - 1); }
    if (start <= end && start < size) {
      headers["Content-Range"] = `bytes ${start}-${end}/${size}`;
      headers["Content-Length"] = String(end - start + 1);
      return new Response(hit.data.subarray(start, end + 1), { status: 206, headers });
    }
    return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${size}` } });
  }
  headers["Content-Length"] = String(size);
  return new Response(hit.data, { status: 200, headers });
}

// ---------- window size and place, remembered between launches ----------
const stateFile = () => path.join(app.getPath("userData"), "window-state.json");
function loadState() {
  try {
    const s = JSON.parse(fs.readFileSync(stateFile(), "utf8"));
    const area = screen.getDisplayMatching(s).workArea;
    const visible = s.x < area.x + area.width - 100 && s.x + s.width > area.x + 100 && s.y >= area.y - 10 && s.y < area.y + area.height - 100;
    return visible ? s : { width: s.width, height: s.height, maximized: s.maximized };
  } catch (e) { return null; }
}
function saveState() {
  try {
    const b = win.getNormalBounds();
    fs.writeFileSync(stateFile(), JSON.stringify({ ...b, maximized: win.isMaximized() }));
  } catch (e) {}
}

// ---------- the window ----------
let win = null, toolbar = null, game = null, gameSize = null, currentIndex = 0;

function themeColors() {
  const dark = nativeTheme.shouldUseDarkColors;
  if (process.platform === "win32") return { bar: dark ? "#202020" : "#f3f3f3", page: dark ? "#1e1e1e" : "#ececec" };
  return { bar: dark ? "#2e2e32" : "#ebebed", page: dark ? "#1e1e1e" : "#ececec" };
}

function accentColor() {
  if (process.platform === "win32") {
    try { const c = systemPreferences.getAccentColor(); if (c) return "#" + c.slice(0, 6); } catch (e) {}
    return "#0067c0";
  }
  return "#3584e4";   // GNOME's default blue
}

function createWindow() {
  const state = loadState() || {};
  const colors = themeColors();
  const icon = path.join(__dirname, process.platform === "win32" ? "icons/coles-games.ico" : "icons/coles-games-512.png");
  win = new BaseWindow({
    width: state.width || 1180, height: state.height || 860, x: state.x, y: state.y,
    minWidth: 840, minHeight: 620,
    title: "Cole's Games", icon, show: false, backgroundColor: colors.page,
    autoHideMenuBar: true          // the menu bar stays out of the way; Alt shows it, and every shortcut works
  });
  win.setMenuBarVisibility(false);

  toolbar = new WebContentsView({
    webPreferences: { preload: path.join(__dirname, "preload-toolbar.js"), sandbox: true, contextIsolation: true, spellcheck: false }
  });
  toolbar.setBackgroundColor(colors.bar);
  game = new WebContentsView({
    webPreferences: { preload: path.join(__dirname, "preload-game.js"), sandbox: true, contextIsolation: true,
      spellcheck: false, backgroundThrottling: true, autoplayPolicy: "no-user-gesture-required" }
  });
  game.setBackgroundColor(colors.page);
  win.contentView.addChildView(game);
  win.contentView.addChildView(toolbar);

  const gc = game.webContents;
  gc.on("did-finish-load", () => { gc.setVisualZoomLevelLimits(1, 1).catch(() => {}); });   // no pinch zoom
  gc.on("will-navigate", (e, url) => { if (!url.startsWith(SCHEME + ":")) { e.preventDefault(); openOutside(url); } });
  gc.setWindowOpenHandler(({ url }) => {
    if (url.startsWith(SCHEME + ":")) gc.loadURL(url).catch(() => {}); else openOutside(url);
    return { action: "deny" };
  });
  gc.on("did-start-navigation", (details) => {
    if (details.isMainFrame && !details.isSameDocument) { gameSize = null; gc.setZoomFactor(1); }
  });
  gc.on("did-navigate", syncChrome);
  gc.on("did-navigate-in-page", syncChrome);
  gc.on("render-process-gone", () => gc.reload());   // a crashed game comes back instead of a blank window
  gc.on("before-input-event", (e, input) => {
    if (input.type !== "keyDown") return;
    if (input.key === "F5") { e.preventDefault(); gc.reload(); }
    if (input.key === "F11") { e.preventDefault(); win.setFullScreen(!win.isFullScreen()); }
  });

  win.on("resize", layout);
  win.on("enter-full-screen", layout);
  win.on("leave-full-screen", layout);
  win.on("close", saveState);
  win.on("closed", () => { win = null; });

  layout();
  toolbar.webContents.loadFile(path.join(__dirname, "toolbar.html")).catch(() => {});
  gc.loadURL(HOME + "/").catch(() => {});
  gc.once("did-finish-load", () => {
    if (state.maximized) win.maximize();
    win.show();
    gc.focus();
  });
}

function openOutside(url) {
  if (/^(https?|mailto):/i.test(url)) shell.openExternal(url);
}

function layout() {
  if (!win) return;
  const [w, h] = win.getContentSize();
  toolbar.setBounds({ x: 0, y: 0, width: w, height: TOOLBAR_HEIGHT });
  game.setBounds({ x: 0, y: TOOLBAR_HEIGHT, width: w, height: Math.max(0, h - TOOLBAR_HEIGHT) });
  fit();
}

// each game page reports its size; the whole page is zoomed so the game fills the window
// at the right shape, sharp at any size (real zoom, not a stretched picture)
function fit() {
  if (!gameSize || !game) return;
  const b = game.getBounds();
  if (!b.width || !b.height) return;
  let zoom = Math.min((b.width - 16) / gameSize.w, (b.height - 16) / gameSize.h);
  zoom = Math.min(zoom, b.width / 800);     // keep the games' desktop layout (their phone layout starts below 720)
  zoom = Math.max(0.6, Math.min(2.5, zoom));
  if (Math.abs(game.webContents.getZoomFactor() - zoom) > 0.005) game.webContents.setZoomFactor(zoom);
}

function show(i) {
  if (!PAGES[i] || !game) return;
  game.webContents.loadURL(HOME + PAGES[i].path).catch(() => {});   // a newer click can cancel an older load
  game.webContents.focus();
}

function syncChrome() {
  if (!game || !win) return;
  const url = new URL(game.webContents.getURL() || HOME + "/");
  let i = 0;
  if (url.pathname.startsWith("/blackjack")) i = 1;
  else if (url.pathname.startsWith("/linesdx")) i = 2;
  else if (url.pathname.startsWith("/luckyflip")) i = 3;
  else if (url.hash === "#music") i = 4;
  currentIndex = i;
  win.setTitle(i === 0 || i === 4 ? "Cole's Games" : PAGES[i].title + " - Cole's Games");
  toolbar.webContents.send("cg-active", i);
}

// ---------- menus (hidden menu bar for the shortcuts, and the toolbar's menu button) ----------
function menuTemplate() {
  return [
    {
      label: "&Games",
      submenu: [
        ...PAGES.map((p, i) => ({ label: p.title, accelerator: "CmdOrCtrl+" + p.key, click: () => show(i) })),
        { type: "separator" },
        { label: "Restart Game", accelerator: "CmdOrCtrl+R", click: () => game && game.webContents.reload() },
        { type: "separator" },
        { label: "Quit", accelerator: "CmdOrCtrl+Q", click: () => app.quit() }
      ]
    },
    {
      label: "&View",
      submenu: [{ label: "Full Screen", accelerator: "F11", click: () => win && win.setFullScreen(!win.isFullScreen()) }]
    },
    {
      label: "&Help",
      submenu: [
        { label: "Visit coleswebsite.xyz", click: () => shell.openExternal("https://coleswebsite.xyz/") },
        { label: "About Cole's Games", click: showAbout }
      ]
    }
  ];
}

function showAbout() {
  dialog.showMessageBox(win, {
    type: "none",
    title: "About Cole's Games",
    message: "Cole's Games",
    detail: "Version " + app.getVersion() + "\n\nBlackjack DX, Lines DX and Lucky Flip\nfrom coleswebsite.xyz\n\n© 2023 - 2026 coleswebsite.xyz",
    icon: path.join(__dirname, "icons/coles-games-256.png"),
    buttons: ["OK"]
  });
}

// ---------- messages from the pages ----------
ipcMain.on("cg-fit", (e, size) => {
  if (!game || e.sender !== game.webContents) return;
  const w = Number(size && size.w), h = Number(size && size.h);
  if (!(w > 0 && h > 0)) return;
  gameSize = { w, h };
  fit();
});
ipcMain.on("cg-desktop-info", (e) => { e.returnValue = { platform: process.platform, accent: accentColor() }; });
ipcMain.on("cg-nav", (e, i) => { if (toolbar && e.sender === toolbar.webContents) show(Number(i)); });
ipcMain.on("cg-restart", (e) => { if (toolbar && e.sender === toolbar.webContents && game) game.webContents.reload(); });
ipcMain.on("cg-fullscreen", (e) => { if (toolbar && e.sender === toolbar.webContents && win) win.setFullScreen(!win.isFullScreen()); });
ipcMain.on("cg-menu", (e, at) => {
  if (!toolbar || e.sender !== toolbar.webContents || !win) return;
  Menu.buildFromTemplate([
    ...PAGES.map((p, i) => ({ label: p.title, type: "radio", checked: i === currentIndex, accelerator: "CmdOrCtrl+" + p.key, click: () => show(i) })),
    { type: "separator" },
    { label: "Restart Game", accelerator: "CmdOrCtrl+R", click: () => game.webContents.reload() },
    { label: "Full Screen", accelerator: "F11", click: () => win.setFullScreen(!win.isFullScreen()) },
    { type: "separator" },
    { label: "Visit coleswebsite.xyz", click: () => shell.openExternal("https://coleswebsite.xyz/") },
    { label: "About Cole's Games", click: showAbout },
    { type: "separator" },
    { label: "Quit", accelerator: "CmdOrCtrl+Q", click: () => app.quit() }
  ]).popup({ window: win, x: Math.round(at && at.x || 0), y: Math.round(at && at.y || TOOLBAR_HEIGHT) });
});
ipcMain.on("cg-toolbar-ready", (e) => { if (toolbar && e.sender === toolbar.webContents) syncChrome(); });

nativeTheme.on("updated", () => {
  if (!win) return;
  const c = themeColors();
  toolbar.setBackgroundColor(c.bar);
  game.setBackgroundColor(c.page);
});

app.whenReady().then(() => {
  // the app never goes online: no spellcheck dictionary downloads (there's no typing in the games anyway)
  try { session.defaultSession.setSpellCheckerLanguages([]); } catch (e) {}
  session.defaultSession.setSpellCheckerEnabled(false);
  protocol.handle(SCHEME, serve);
  Menu.setApplicationMenu(Menu.buildFromTemplate(menuTemplate()));
  createWindow();
});

app.on("window-all-closed", () => app.quit());
