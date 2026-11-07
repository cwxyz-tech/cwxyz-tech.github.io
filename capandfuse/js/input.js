// Keyboard, mouse and gamepad input with remappable keys.
// Game code asks for actions ("jump", "throw"...) instead of raw keys.

export const ACTIONS = {
  forward: "Move forward", back: "Move back", left: "Move left", right: "Move right",
  jump: "Jump", crouch: "Crouch / dive (in the air)", throw: "Throw cap",
  pound: "Ground pound", interact: "Talk", pause: "Pause",
  camLeft: "Turn camera left", camRight: "Turn camera right",
};
export const KEYS_VERSION = 2;

export const DEFAULT_KEYS = {
  forward: ["KeyW", "ArrowUp"], back: ["KeyS", "ArrowDown"], left: ["KeyA", "ArrowLeft"], right: ["KeyD", "ArrowRight"],
  jump: ["Space"], crouch: ["ShiftLeft", "ShiftRight"], throw: ["ControlLeft", "ControlRight", "MetaLeft", "MetaRight", "Mouse0"],
  pound: ["KeyQ", "Mouse2"], interact: ["KeyE"], pause: ["Escape", "KeyP"],
  camLeft: ["KeyJ"], camRight: ["KeyL"],
};

export function keyLabel(code) {
  if (!code) return "-";
  const map = { Space: "Space", ShiftLeft: "L Shift", ShiftRight: "R Shift", ControlLeft: "L Ctrl", ControlRight: "R Ctrl",
    Mouse0: "Left Click", Mouse1: "Middle Click", Mouse2: "Right Click", MetaLeft: "Cmd", MetaRight: "R Cmd", Escape: "Esc", ArrowUp: "Up", ArrowDown: "Down",
    ArrowLeft: "Left", ArrowRight: "Right", AltLeft: "L Alt", AltRight: "R Alt", Enter: "Enter", Tab: "Tab" };
  if (map[code]) return map[code];
  if (code.startsWith("Key")) return code.slice(3);
  if (code.startsWith("Digit")) return code.slice(5);
  return code;
}

export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.keys = structuredClone(DEFAULT_KEYS);
    this.down = new Set();
    this.pressedFrame = new Set();
    this.mouseDX = 0; this.mouseDY = 0;
    this.locked = false;
    this.enabled = true;
    this.padIndex = null;
    this.padPrev = [];
    this.padState = { move: { x: 0, y: 0 }, cam: { x: 0, y: 0 } };
    this.lastDevice = "keyboard";
    this.listening = null; // remap capture callback

    addEventListener("keydown", (e) => {
      if (this.listening) { e.preventDefault(); const cb = this.listening; this.listening = null; cb(e.code); return; }
      if (this._isGameKey(e.code) && this.enabled) e.preventDefault();
      if (!this.down.has(e.code)) this.pressedFrame.add(e.code);
      this.down.add(e.code);
      this.lastDevice = "keyboard";
    });
    addEventListener("keyup", (e) => {
      this.down.delete(e.code);
      // macOS swallows key-ups while Cmd is held, so let go of everything when Cmd comes up
      if (e.key === "Meta") this.down.clear();
    });
    addEventListener("blur", () => { this.down.clear(); });
    canvas.addEventListener("mousedown", (e) => {
      const code = "Mouse" + e.button;
      if (this.listening) { const cb = this.listening; this.listening = null; cb(code); return; }
      if (!this.down.has(code)) this.pressedFrame.add(code);
      this.down.add(code);
      this.lastDevice = "keyboard";
    });
    addEventListener("mouseup", (e) => { this.down.delete("Mouse" + e.button); });
    canvas.addEventListener("contextmenu", (e) => e.preventDefault());
    addEventListener("mousemove", (e) => {
      if (this.locked) { this.mouseDX += e.movementX || 0; this.mouseDY += e.movementY || 0; }
      else if (this.down.has("Mouse1")) { this.mouseDX += e.movementX || 0; this.mouseDY += e.movementY || 0; }
    });
    document.addEventListener("pointerlockchange", () => { this.locked = document.pointerLockElement === canvas; });
    addEventListener("gamepadconnected", (e) => { if (this.padIndex == null) this.padIndex = e.gamepad.index; });
    addEventListener("gamepaddisconnected", (e) => { if (this.padIndex === e.gamepad.index) this.padIndex = null; });
  }

  _isGameKey(code) {
    for (const a in this.keys) if (this.keys[a] && this.keys[a].includes(code)) return true;
    return code === "Tab";
  }

  setKeys(k) {
    const merged = structuredClone(DEFAULT_KEYS);
    if (k) for (const a in merged) if (Array.isArray(k[a]) && k[a].length) merged[a] = k[a].slice(0, 3);
    this.keys = merged;
  }

  requestLock() {
    if (this.locked || !this.canvas.requestPointerLock) return;
    try { const p = this.canvas.requestPointerLock(); if (p && p.catch) p.catch(() => {}); } catch (e) {}
  }
  releaseLock() { if (document.pointerLockElement) document.exitPointerLock(); }

  // Gamepad buttons per action (standard mapping)
  static PAD = { jump: [0], interact: [1], throw: [2, 3], crouch: [4, 6], pound: [5, 7], pause: [9] };

  poll() {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    let pad = this.padIndex != null ? pads[this.padIndex] : null;
    if (!pad) for (const p of pads) if (p) { pad = p; this.padIndex = p.index; break; }
    this.pad = pad;
    this.padPressed = new Set();
    this.padState.move.x = this.padState.move.y = this.padState.cam.x = this.padState.cam.y = 0;
    if (!pad) return;
    const dz = (v) => (Math.abs(v) < 0.18 ? 0 : (v - Math.sign(v) * 0.18) / 0.82);
    this.padState.move.x = dz(pad.axes[0] || 0);
    this.padState.move.y = dz(pad.axes[1] || 0);
    this.padState.cam.x = dz(pad.axes[2] || 0);
    this.padState.cam.y = dz(pad.axes[3] || 0);
    pad.buttons.forEach((b, i) => {
      const pressed = b.pressed || b.value > 0.5;
      if (pressed && !this.padPrev[i]) { this.padPressed.add(i); this.lastDevice = "pad"; }
      this.padPrev[i] = pressed;
    });
    if (Math.abs(this.padState.move.x) + Math.abs(this.padState.move.y) > 0.3) this.lastDevice = "pad";
  }

  held(action) {
    if (!this.enabled) return false;
    for (const c of this.keys[action] || []) if (this.down.has(c)) return true;
    const pb = Input.PAD[action];
    if (this.pad && pb) for (const i of pb) { const b = this.pad.buttons[i]; if (b && (b.pressed || b.value > 0.5)) return true; }
    return false;
  }

  pressed(action) {
    if (!this.enabled) return false;
    for (const c of this.keys[action] || []) if (this.pressedFrame.has(c)) return true;
    const pb = Input.PAD[action];
    if (this.padPressed && pb) for (const i of pb) if (this.padPressed.has(i)) return true;
    return false;
  }

  // raw pad button press helper for menus
  padHit(i) { return this.padPressed && this.padPressed.has(i); }

  moveVector() {
    if (!this.enabled) return { x: 0, y: 0 };
    let x = 0, y = 0;
    if (this.held("left")) x -= 1;
    if (this.held("right")) x += 1;
    if (this.held("forward")) y += 1;
    if (this.held("back")) y -= 1;
    const l = Math.hypot(x, y);
    if (l > 1) { x /= l; y /= l; }
    const pm = this.padState.move;
    if (Math.abs(pm.x) + Math.abs(pm.y) > Math.abs(x) + Math.abs(y)) { x = pm.x; y = -pm.y; const pl = Math.hypot(x, y); if (pl > 1) { x /= pl; y /= pl; } }
    return { x, y };
  }

  rumble(strength = 0.5, ms = 120) {
    const p = this.pad;
    try { if (p && p.vibrationActuator) p.vibrationActuator.playEffect("dual-rumble", { duration: ms, strongMagnitude: strength, weakMagnitude: strength * 0.6 }); } catch (e) {}
  }

  endFrame() { this.pressedFrame.clear(); this.mouseDX = 0; this.mouseDY = 0; }
}
