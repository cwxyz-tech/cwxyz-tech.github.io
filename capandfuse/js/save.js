// Save files: 3 slots in IndexedDB (falls back to localStorage), each with a
// checksum so a damaged save is caught instead of crashing the game. The
// previous good copy of every slot is kept as a backup for recovery.

const DB = "capandfuse", STORE = "kv", VERSION = 1, SAVE_VER = 1;
export const SLOTS = [1, 2, 3];

function hash(str) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
  return h.toString(36);
}

export function newSave() {
  return {
    v: SAVE_VER,
    world: "blossom", checkpoint: "start", unlocked: ["blossom"],
    hearts: [], relics: [], bits: 0, bitsTaken: [], bitsTotalEarned: 0,
    upgrades: [], cosmetics: ["classic"], wearing: "classic", body: "classic",
    story: { intro: false, met: {}, boss: false, gate: false, quests: {}, tutorial: {} },
    checkpoints: ["start"],
    playtime: 0, created: Date.now(), lastPlayed: Date.now(),
  };
}

// fill in anything missing so older or partial saves still load
export function repair(d) {
  const base = newSave();
  if (!d || typeof d !== "object") return base;
  for (const k in base) {
    if (d[k] == null || typeof d[k] !== typeof base[k] || Array.isArray(base[k]) !== Array.isArray(d[k])) d[k] = base[k];
  }
  for (const k in base.story) if (d.story[k] === undefined || typeof d.story[k] !== typeof base.story[k]) d.story[k] = base.story[k];
  d.bits = Math.max(0, Math.floor(+d.bits || 0));
  d.playtime = Math.max(0, +d.playtime || 0);
  if (!d.unlocked.includes("blossom")) d.unlocked.unshift("blossom");
  if (!d.checkpoints.includes("start")) d.checkpoints.unshift("start");
  d.hearts = [...new Set(d.hearts.filter((x) => typeof x === "string"))];
  return d;
}

class Store {
  constructor() { this.db = null; this.mode = "none"; }
  async open() {
    if (this.mode !== "none") return;
    try {
      if (!window.indexedDB) throw 0;
      this.db = await new Promise((res, rej) => {
        const r = indexedDB.open(DB, VERSION);
        r.onupgradeneeded = () => r.result.createObjectStore(STORE);
        r.onsuccess = () => res(r.result);
        r.onerror = () => rej(r.error);
        r.onblocked = () => rej(new Error("blocked"));
        setTimeout(() => rej(new Error("timeout")), 4000);
      });
      this.mode = "idb";
    } catch (e) {
      try { localStorage.setItem("cf_test", "1"); localStorage.removeItem("cf_test"); this.mode = "ls"; }
      catch (e2) { this.mode = "mem"; this.mem = {}; }
    }
  }
  async get(k) {
    await this.open();
    if (this.mode === "idb") return new Promise((res) => {
      try { const r = this.db.transaction(STORE).objectStore(STORE).get(k); r.onsuccess = () => res(r.result ?? null); r.onerror = () => res(null); }
      catch (e) { res(null); }
    });
    if (this.mode === "ls") { const v = localStorage.getItem("cf_" + k); return v == null ? null : v; }
    return this.mem[k] ?? null;
  }
  async set(k, v) {
    await this.open();
    if (this.mode === "idb") return new Promise((res, rej) => {
      try { const tx = this.db.transaction(STORE, "readwrite"); tx.objectStore(STORE).put(v, k); tx.oncomplete = () => res(true); tx.onerror = () => rej(tx.error); }
      catch (e) { rej(e); }
    });
    if (this.mode === "ls") { localStorage.setItem("cf_" + k, v); return true; }
    this.mem[k] = v; return true;
  }
  async del(k) {
    await this.open();
    if (this.mode === "idb") return new Promise((res) => {
      try { const tx = this.db.transaction(STORE, "readwrite"); tx.objectStore(STORE).delete(k); tx.oncomplete = () => res(true); tx.onerror = () => res(false); }
      catch (e) { res(false); }
    });
    if (this.mode === "ls") { localStorage.removeItem("cf_" + k); return true; }
    delete this.mem[k]; return true;
  }
}
export const store = new Store();

function pack(data) {
  const json = JSON.stringify(data);
  return JSON.stringify({ sum: hash(json), json });
}
function unpack(raw) {
  if (raw == null) return { state: "empty" };
  try {
    const o = JSON.parse(raw);
    if (!o || typeof o.json !== "string" || hash(o.json) !== o.sum) return { state: "corrupt" };
    return { state: "ok", data: repair(JSON.parse(o.json)) };
  } catch (e) { return { state: "corrupt" }; }
}

export async function readSlot(n) {
  const main = unpack(await store.get("slot" + n));
  if (main.state !== "corrupt") return main;
  const bak = unpack(await store.get("slot" + n + "_bak"));
  return bak.state === "ok" ? { state: "corrupt", backup: bak.data } : { state: "corrupt" };
}

export async function writeSlot(n, data) {
  data.lastPlayed = Date.now();
  const packed = pack(data);
  const prev = await store.get("slot" + n);
  if (prev && unpack(prev).state === "ok") await store.set("slot" + n + "_bak", prev);
  await store.set("slot" + n, packed);
  // read back to be sure it really stuck
  const check = unpack(await store.get("slot" + n));
  if (check.state !== "ok") throw new Error("save verify failed");
  return true;
}

export async function deleteSlot(n) {
  await store.del("slot" + n);
  await store.del("slot" + n + "_bak");
}

export async function restoreBackup(n) {
  const r = await readSlot(n);
  if (!r.backup) return false;
  await store.set("slot" + n, pack(r.backup));
  return true;
}

export async function readSettings() {
  try { const v = await store.get("settings"); return v ? JSON.parse(v) : null; } catch (e) { return null; }
}
export async function writeSettings(s) { try { await store.set("settings", JSON.stringify(s)); } catch (e) {} }
export async function lastSlot() { try { return +(await store.get("last")) || 0; } catch (e) { return 0; } }
export async function setLastSlot(n) { try { await store.set("last", String(n)); } catch (e) {} }
export function storageMode() { return store.mode; }
