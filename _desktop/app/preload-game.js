// Runs before each game page. Gives the pages the same small bridge the Mac app provides,
// so the exact same game files work in both.
"use strict";
const { contextBridge, ipcRenderer } = require("electron");

// the games report their size here so the app can fit them to the window
contextBridge.exposeInMainWorld("webkit", {
  messageHandlers: {
    cgFit: { postMessage: (m) => ipcRenderer.send("cg-fit", { w: Number(m && m.w), h: Number(m && m.h) }) }
  }
});

// which computer this is, and the system accent color, for the launcher's look
let info = { platform: "", accent: "" };
try { info = ipcRenderer.sendSync("cg-desktop-info") || info; } catch (e) {}
contextBridge.exposeInMainWorld("cgDesktop", { platform: String(info.platform || ""), accent: String(info.accent || "") });

// Ctrl + mouse wheel / trackpad pinch would zoom the page; the app handles sizing itself
window.addEventListener("wheel", (e) => { if (e.ctrlKey) e.preventDefault(); }, { passive: false, capture: true });
