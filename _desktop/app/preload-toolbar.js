"use strict";
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("cg", {
  platform: process.platform,
  nav: (i) => ipcRenderer.send("cg-nav", Number(i)),
  restart: () => ipcRenderer.send("cg-restart"),
  fullscreen: () => ipcRenderer.send("cg-fullscreen"),
  menu: (x, y) => ipcRenderer.send("cg-menu", { x: Number(x), y: Number(y) }),
  ready: () => ipcRenderer.send("cg-toolbar-ready"),
  onActive: (fn) => ipcRenderer.on("cg-active", (_e, i) => fn(Number(i)))
});
