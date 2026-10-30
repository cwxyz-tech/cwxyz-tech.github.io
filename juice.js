/*
 * coleswebsite.xyz game effects ("juice"), the same pixel effects Lucky Flip uses, shared by the other games.
 * Pixel particles, flying coins, rainbow confetti, floating numbers, screen flashes, board shakes, rolling numbers.
 *
 *   var fx = CwJuice.create({ font: '"CwComic", "Comic Sans MS", cursive', off: function () { return !effectsOn; } });
 *   fx.burst(x, y, 3); fx.coins(x, y, targetEl, 10, onEachCoin); fx.confetti(rect); fx.float(x, y, "+500", "x3");
 *   fx.flash(el, "white"); fx.quake(el); fx.roll(el, from, to, ms, format); fx.restart(el, "cw-bump");
 *
 * Everything is drawn on one fixed canvas over the page, so it never touches the game's own layout.
 * Phones and slower computers get the same effects with fewer particles so it stays smooth,
 * and if frames still run slow while effects play, it cuts the particle count down on its own.
 */
(function () {
  "use strict";
  if (window.CwJuice) return;

  var CSS =
    ".cw-fx { position: fixed; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none; z-index: 90; image-rendering: pixelated; image-rendering: crisp-edges; }" +
    ".cw-floats { position: fixed; top: 0; left: 0; right: 0; bottom: 0; pointer-events: none; z-index: 91; overflow: hidden; }" +
    ".cw-float { position: absolute; transform: translate(-50%, -50%); font-weight: bold; font-size: 26px; line-height: 1; color: #fff;" +
    "  text-shadow: 2px 2px 0 #000, -1px -1px 0 #000; white-space: nowrap; text-align: center; animation: cw-rise 1.1s steps(11) forwards; will-change: transform; }" +
    ".cw-float small { display: block; font-size: 14px; color: #fff; margin-top: 2px; }" +
    ".cw-float.x1 { font-size: 18px; color: #e0e0e0; animation-duration: .7s; }" +
    ".cw-float.x2 { font-size: 32px; color: #60a0ff; }" +
    ".cw-float.x3 { font-size: 40px; color: #ff3030; }" +
    ".cw-float.x3 small { color: #ffee00; }" +
    ".cw-float.gold { font-size: 32px; color: #ffd700; }" +
    ".cw-float.green { font-size: 22px; color: #00ff00; }" +
    ".cw-float.purple { font-size: 32px; color: #ff99ff; }" +
    ".cw-float.red { font-size: 30px; color: #ff3030; }" +
    "@keyframes cw-rise { 0% { transform: translate(-50%, -30%) scale(.5); } 18% { transform: translate(-50%, -80%) scale(1.3); }" +
    "  30% { transform: translate(-50%, -90%) scale(1); opacity: 1; } 100% { transform: translate(-50%, -280%) scale(1); opacity: 0; } }" +
    ".cw-flash { position: absolute; inset: 0; pointer-events: none; opacity: 0; z-index: 5; }" +
    ".cw-flash.white { animation: cw-fw .3s steps(1) 1; }" +
    ".cw-flash.red { animation: cw-fr .35s ease-out 1; }" +
    ".cw-flash.gold { animation: cw-fg .45s steps(1) 1; }" +
    "@keyframes cw-fw { 0% { background: #fff; opacity: .9; } 33% { opacity: 0; } 66% { background: #fff; opacity: .5; } 100% { opacity: 0; } }" +
    "@keyframes cw-fr { 0% { background: #ff2000; opacity: .35; } 100% { background: #ff2000; opacity: 0; } }" +
    "@keyframes cw-fg { 0% { background: #ffee00; opacity: .55; } 25% { opacity: 0; } 50% { background: #ffee00; opacity: .35; } 100% { opacity: 0; } }" +
    ".cw-quake { animation: cw-bquake .3s steps(6) 1; will-change: transform; }" +
    ".cw-quakebig { animation: cw-bquakebig .55s steps(11) 1; will-change: transform; }" +
    "@keyframes cw-bquake { 16% { transform: translate(-3px, 1px); } 33% { transform: translate(3px, -2px); } 50% { transform: translate(-2px, -1px); } 66% { transform: translate(2px, 1px); } 83% { transform: translate(-1px, 0); } 100% { transform: none; } }" +
    "@keyframes cw-bquakebig { 10% { transform: translate(-7px, 3px); } 20% { transform: translate(6px, -5px); } 30% { transform: translate(-5px, -3px); } 40% { transform: translate(5px, 4px); } 50% { transform: translate(-4px, 2px); } 60% { transform: translate(3px, -3px); } 70% { transform: translate(-2px, 2px); } 80% { transform: translate(2px, -1px); } 100% { transform: none; } }" +
    ".cw-bump { animation: cw-grow .25s steps(3) 1; display: inline-block; }" +
    "@keyframes cw-grow { 0% { transform: scale(1.7); } 100% { transform: scale(1); } }" +
    ".cw-blink { animation: cw-blinky .5s steps(1) 2; }" +
    "@keyframes cw-blinky { 50% { background: #ffff00; } }" +
    ".cw-hop { display: inline-block; animation: cw-hop .4s steps(4) backwards; }" +
    "@keyframes cw-hop { 0% { transform: translateY(-34px) scale(2.2); opacity: 0; } 60% { transform: translateY(4px) scale(.9); opacity: 1; } 100% { transform: none; } }" +
    "@media (prefers-reduced-motion: reduce) { .cw-quake, .cw-quakebig, .cw-flash { animation: none !important; } }";

  var RAINBOW = ["#ff0000", "#ff9900", "#ffff00", "#00cc00", "#00cccc", "#0000ff", "#cc00cc"];
  function rnd(a, b) { return a + Math.random() * (b - a); }
  function pick(a) { return a[Math.floor(Math.random() * a.length)]; }
  function center(el) { var q = el.getBoundingClientRect(); return { x: q.left + q.width / 2, y: q.top + q.height / 2, w: q.width, h: q.height }; }
  function restart(el, cls) { if (!el) return; el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls); }

  function create(opts) {
    opts = opts || {};
    var off = opts.off || function () { return false; };
    if (!document.getElementById("cw-juice-css")) {
      var st = document.createElement("style");
      st.id = "cw-juice-css"; st.textContent = CSS;
      document.head.appendChild(st);
    }
    var LOW = false;
    try {
      LOW = window.matchMedia("(pointer: coarse)").matches || window.innerWidth < 720 ||
        (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4) || (navigator.deviceMemory && navigator.deviceMemory <= 4);
    } catch (e) {}
    var PM = LOW ? 0.5 : 1, MAX_PARTS = LOW ? 170 : 420, MAX_FLOATS = LOW ? 5 : 10;
    function many(n) { return Math.max(1, Math.round(n * PM)); }

    var cv = document.createElement("canvas");
    cv.className = "cw-fx"; cv.setAttribute("aria-hidden", "true");
    var floats = document.createElement("div");
    floats.className = "cw-floats"; floats.setAttribute("aria-hidden", "true");
    if (opts.font) floats.style.fontFamily = opts.font;
    document.body.appendChild(cv); document.body.appendChild(floats);
    var g = cv.getContext("2d"), parts = [], dpr = 0, cw = 0, ch = 0, running = false, lastT = 0;
    // Phones fire "resize" every time the address bar slides in or out, and resizing a canvas throws away its whole
    // bitmap and makes a new one. So the canvas only gets a new size when the width changes or it needs to grow taller.
    function size() {
      var nd = LOW ? 1 : Math.min(2, window.devicePixelRatio || 1), w = window.innerWidth, h = window.innerHeight;
      if (nd === dpr && w === cw && h <= ch) return;
      ch = (nd !== dpr || w !== cw) ? h : Math.max(ch, h);
      cw = w; dpr = nd;
      cv.width = Math.round(cw * dpr); cv.height = Math.round(ch * dpr);
      cv.style.width = cw + "px"; cv.style.height = ch + "px";
      dirty = null;
    }
    // last frame's drawn area, so each frame only clears what it drew instead of the whole screen
    var dirty = null, slow = 1 / 60, frames = 0;
    size();
    window.addEventListener("resize", size);
    function kick() { if (!running) { running = true; lastT = performance.now(); frames = 0; requestAnimationFrame(tick); } }

    function chip(x, y, o) {
      if (off() || parts.length >= MAX_PARTS) return;
      var sp = o.sp || 260;
      parts.push({ k: "chip", x: x, y: y,
        vx: o.vx != null ? o.vx : rnd(-1, 1) * sp,
        vy: o.vy != null ? o.vy : rnd(-1, 0.3) * sp - (o.up != null ? o.up : 120),
        g: o.g != null ? o.g : 900, s: o.s || rnd(3, 7), c: o.c, life: o.life || rnd(0.5, 1.1),
        age: 0, drag: o.drag || 0, grow: o.grow || 0, blink: !!o.blink });
      kick();
    }
    function ring(x, y, n, sp, cols, s) {
      n = many(n);
      for (var k = 0; k < n; k++) {
        var a = k / n * Math.PI * 2;
        chip(x, y, { vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, g: 0, drag: 5, c: cols[k % cols.length], life: 0.45, s: s || 5 });
      }
    }
    // one flying coin: pops up, then homes in on the target element and calls onArrive
    function coin(x, y, target, delay, onArrive) {
      if (off() || !target) { if (onArrive) setTimeout(onArrive, 150 + delay * 300); return; }
      var now = performance.now();
      if (!target._fxAt || now - target._fxAt > 300) { target._fxRect = center(target); target._fxAt = now; }
      parts.push({ k: "coin", x: x, y: y, vx: rnd(-240, 240), vy: rnd(-420, -150), g: 1000, age: 0,
        delay: delay, t: target._fxRect, onArrive: onArrive, spin: rnd(0, 6) });
      kick();
    }
    function coins(x, y, target, n, onEach, start) {
      n = many(n);
      for (var k = 0; k < n; k++) coin(x, y, target, (start == null ? 0.15 : start) + k * 0.035, onEach);
    }
    function drawCoin(x, y, spin) {
      var w = [10, 8, 4, 2, 4, 8][Math.floor(spin) % 6], h = 10;
      x = Math.round(x - w / 2); y = Math.round(y - h / 2);
      g.fillStyle = "#6a4a00";
      g.fillRect(x, y + 1, w, h - 2);
      if (w > 2) g.fillRect(x + 1, y, w - 2, h);
      if (w > 2) {
        g.fillStyle = "#ffd700"; g.fillRect(x + 1, y + 1, w - 2, h - 2);
        g.fillStyle = "#fff6a0"; g.fillRect(x + 2, y + 2, w > 4 ? 2 : 1, 3);
      }
    }
    // particles are drawn grouped by colour: switching colours is the slow part of canvas drawing on phones
    var buckets = {}, used = [], arrived = [];
    function tick(now) {
      var dt = Math.min(0.05, (now - lastT) / 1000), W = cw, H = ch;
      lastT = now;
      // if frames keep running slow while effects play, quietly use fewer particles from then on
      if (parts.length > 30 && ++frames > 10) {
        slow = slow * 0.9 + dt * 0.1;
        if (slow > 0.026 && PM > 0.25) { PM = Math.max(0.25, PM * 0.75); MAX_PARTS = Math.max(60, Math.round(MAX_PARTS * 0.75)); slow = 1 / 60; }
      }
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (dirty) g.clearRect(dirty[0], dirty[1], dirty[2] - dirty[0], dirty[3] - dirty[1]);
      var x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9, j = 0, i, p, s, px, py, b;
      used.length = 0; arrived.length = 0;
      for (i = 0; i < parts.length; i++) {
        p = parts[i];
        p.age += dt;
        if (p.k === "chip") {
          if (p.age >= p.life || p.y > H + 40 || p.x < -40 || p.x > W + 40) continue;
          p.vy += p.g * dt;
          if (p.drag) { p.vx *= Math.max(0, 1 - p.drag * dt); p.vy *= Math.max(0, 1 - p.drag * dt); }
          p.x += p.vx * dt; p.y += p.vy * dt; p.s += p.grow * dt;
          parts[j++] = p;
          if (p.blink && p.age > p.life * 0.6 && Math.floor(p.age * 20) % 2) continue;
          s = Math.max(1, Math.round(p.s)); px = Math.round(p.x - s / 2); py = Math.round(p.y - s / 2);
          b = buckets[p.c];
          if (!b) b = buckets[p.c] = [];
          if (!b.length) used.push(p.c);
          b.push(px, py, s);
          if (px < x0) x0 = px; if (py < y0) y0 = py; if (px + s > x1) x1 = px + s; if (py + s > y1) y1 = py + s;
        } else {
          p.spin += dt * 16;
          if (p.age < p.delay) {
            p.vy += p.g * dt; p.vx *= Math.max(0, 1 - 2 * dt);
            p.x += p.vx * dt; p.y += p.vy * dt;
          } else {
            if (!p.sp) p.sp = 250;
            p.sp += 3000 * dt;
            var dx = p.t.x - p.x, dy = p.t.y - p.y, d = Math.sqrt(dx * dx + dy * dy);
            if (d <= p.sp * dt + 4) { if (p.onArrive) arrived.push(p.onArrive); continue; }
            p.x += dx / d * p.sp * dt; p.y += dy / d * p.sp * dt;
          }
          parts[j++] = p;
          drawCoin(p.x, p.y, p.spin);
          if (p.x - 6 < x0) x0 = p.x - 6; if (p.y - 6 < y0) y0 = p.y - 6; if (p.x + 6 > x1) x1 = p.x + 6; if (p.y + 6 > y1) y1 = p.y + 6;
        }
      }
      parts.length = j;
      for (i = 0; i < used.length; i++) {
        b = buckets[used[i]];
        g.fillStyle = used[i];
        for (var k = 0; k < b.length; k += 3) g.fillRect(b[k], b[k + 1], b[k + 2], b[k + 2]);
        b.length = 0;
      }
      dirty = x1 > x0 ? [Math.floor(x0) - 2, Math.floor(y0) - 2, Math.ceil(x1) + 2, Math.ceil(y1) + 2] : null;
      if (parts.length) requestAnimationFrame(tick);
      else { running = false; g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, cv.width, cv.height); dirty = null; }
      for (i = 0; i < arrived.length; i++) arrived[i]();
    }

    // kind 1 = small grey puff, 2 = blue sparkle, 3 = big red/gold pop, "purple" = T-spin style, "green" = money
    function burst(x, y, kind) {
      var k;
      if (kind === 1) {
        for (k = 0; k < many(8); k++) chip(x, y, { sp: 150, up: 60, c: pick(["#808080", "#c0c0c0", "#ffffff"]), life: rnd(0.3, 0.6), s: rnd(2, 5) });
      } else if (kind === 2) {
        for (k = 0; k < many(24); k++) chip(x, y, { sp: 320, c: pick(["#0000aa", "#4080ff", "#ffffff", "#ffd700"]), blink: true });
        ring(x, y, 12, 330, ["#4080ff", "#ffffff"]);
      } else if (kind === "purple") {
        for (k = 0; k < many(30); k++) chip(x, y, { sp: 360, c: pick(["#b07be0", "#ff99ff", "#ffffff", "#d8b6f2"]), blink: true });
        ring(x, y, 16, 380, ["#ff99ff", "#ffffff"], 6);
      } else if (kind === "green") {
        for (k = 0; k < many(28); k++) chip(x, y, { sp: 340, up: 160, c: pick(["#00cc00", "#00ff00", "#ffd700", "#ffffff"]), blink: true });
        ring(x, y, 14, 360, ["#00ff00", "#ffd700"], 5);
      } else {
        for (k = 0; k < many(44); k++) chip(x, y, { sp: 440, up: 180, c: pick(["#cc0000", "#ff9900", "#ffff00", "#ffffff"]), s: rnd(3, 8), blink: true });
        ring(x, y, 18, 460, ["#ffff00", "#ff0000", "#ffffff"], 6);
      }
    }
    function explode(x, y, big) {
      var k, n = big ? 46 : 26;
      for (k = 0; k < many(n); k++) chip(x, y, { sp: big ? 420 : 300, up: 120, c: pick(["#202020", "#606060", "#ff3300", "#ff9900", "#ffee00"]), s: rnd(3, big ? 8 : 6), life: rnd(0.35, big ? 0.8 : 0.6) });
      ring(x, y, big ? 20 : 14, big ? 420 : 300, ["#ffee00", "#ff9900", "#ff3300"], 5);
    }
    // a line of debris across a strip (a cleared row), coloured per cell
    function strip(x0, x1, y, colors, per, hot) {
      var n = colors.length, w = (x1 - x0) / n;
      for (var c = 0; c < n; c++) {
        if (!colors[c]) continue;
        for (var k = 0; k < many(per); k++) chip(x0 + (c + 0.5) * w, y, { sp: hot ? 380 : 260, up: hot ? 200 : 120, c: Math.random() < 0.25 ? "#ffffff" : colors[c], s: rnd(3, hot ? 8 : 6), blink: true, life: rnd(0.5, 1) });
      }
    }
    function confetti(rect, amount) {
      var q = rect || { left: 0, right: window.innerWidth, bottom: window.innerHeight }, n = many(amount || 70);
      for (var side = 0; side < 2; side++) {
        for (var k = 0; k < n; k++) {
          chip(side ? q.right : q.left, q.bottom, { vx: (side ? -1 : 1) * rnd(80, 440), vy: -rnd(500, 950), g: 700, drag: 1.3,
            c: pick(RAINBOW), s: rnd(4, 8), life: rnd(1.4, 2.4), blink: true });
        }
      }
    }
    // gold coins raining down from the top of an element
    function shower(rect, amount) {
      var n = many(amount || 30);
      for (var k = 0; k < n; k++) chip(rnd(rect.left, rect.right), rect.top - rnd(0, 30), { vx: rnd(-40, 40), vy: rnd(0, 120), g: 900, c: pick(["#ffd700", "#fff6a0", "#c89600"]), s: rnd(4, 7), life: rnd(0.8, 1.4), blink: true });
    }
    function float(x, y, html, cls, color) {
      if (off()) return;
      // too many at once just pile up unreadably and cost a lot on phones, so the oldest makes room
      while (floats.childElementCount >= MAX_FLOATS) floats.removeChild(floats.firstChild);
      var d = document.createElement("div");
      d.className = "cw-float " + (cls || "");
      d.innerHTML = html;
      if (color) d.style.color = color;
      d.style.left = Math.round(x) + "px"; d.style.top = Math.round(y) + "px";
      floats.appendChild(d);
      setTimeout(function () { if (d.parentNode) d.parentNode.removeChild(d); }, 1400);
    }
    // a flash over an element (it needs position: relative); the flash layer is added once
    function flash(el, kind) {
      if (off() || !el) return;
      var f = el._cwFlash;
      if (!f) { f = document.createElement("div"); f.className = "cw-flash"; el.appendChild(f); el._cwFlash = f; }
      f.className = "cw-flash"; void f.offsetWidth; f.className = "cw-flash " + kind;
    }
    function quake(el, big) {
      if (off() || !el) return;
      el.classList.remove("cw-quake"); el.classList.remove("cw-quakebig");
      void el.offsetWidth; el.classList.add(big ? "cw-quakebig" : "cw-quake");
    }
    function bump(el) { if (!off()) restart(el, "cw-bump"); }
    function blink(el) { if (!off()) restart(el, "cw-blink"); }
    // rolling numbers: counts from one value to another with an ease-out
    function roll(el, from, to, ms, fmt, onStep) {
      fmt = fmt || function (v) { return String(v); };
      var t0 = performance.now(), id = (el._cwRoll || 0) + 1;
      el._cwRoll = id;
      if (off() || from === to) { el.textContent = fmt(to); return; }
      (function step(now) {
        if (el._cwRoll !== id) return;
        var k = Math.min(1, (now - t0) / ms), e = 1 - Math.pow(1 - k, 3), v = Math.round(from + (to - from) * e);
        el.textContent = fmt(v);
        if (onStep) onStep(v);
        if (k < 1) requestAnimationFrame(step);
      })(t0);
    }
    // letters drop in one by one (for callouts)
    function hop(text, step) {
      return String(text).split("").map(function (ch, i) {
        return ch === " " ? " " : '<span class="cw-hop" style="animation-delay:' + (i * (step || 0.03)).toFixed(2) + 's">' + ch + "</span>";
      }).join("");
    }

    return { low: LOW, many: many, chip: chip, ring: ring, coin: coin, coins: coins, burst: burst, explode: explode, strip: strip,
      confetti: confetti, shower: shower, float: float, flash: flash, quake: quake, bump: bump, blink: blink, roll: roll, hop: hop,
      restart: restart, center: center, rnd: rnd, pick: pick, RAINBOW: RAINBOW,
      clear: function () { parts.length = 0; floats.innerHTML = ""; } };
  }

  window.CwJuice = { create: create };
})();
