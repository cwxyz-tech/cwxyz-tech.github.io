/* Secret: ↑ ↑ ↓ ↓ ← → ← → B A  -> Lines DX hard mode.
   On the Lines DX page it switches the game over directly; anywhere else the screen goes dark and takes you there. */
(function () {
  "use strict";
  var seq = ["ArrowUp","ArrowUp","ArrowDown","ArrowDown","ArrowLeft","ArrowRight","ArrowLeft","ArrowRight","b","a"], pos = 0, running = false;

  document.addEventListener("keydown", function (e) {
    var k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    if (k === seq[pos]) { pos++; if (pos === seq.length) { pos = 0; launch(); } }
    else pos = (k === seq[0]) ? 1 : 0;
  });

  function launch() {
    if (running) return;
    // already on the game: let it handle the switch
    if (window.cwLines && typeof window.cwLines.hard === "function") { window.cwLines.hard(); return; }
    // a page can take over the code entirely (Lucky Flip uses this for a joke)
    if (typeof window.cwKonami === "function") { window.cwKonami(); return; }

    running = true;
    var box = document.createElement("div");
    box.style.cssText = "position:fixed;top:0;left:0;right:0;bottom:0;z-index:2147483000;background:#000;opacity:0;transition:opacity 1.1s ease-in";
    var glow = document.createElement("div");
    glow.style.cssText = "position:absolute;top:0;left:0;right:0;bottom:0;background:radial-gradient(ellipse at center, rgba(120,0,0,0) 30%, rgba(120,0,0,.85) 100%);opacity:0";
    box.appendChild(glow);
    document.body.appendChild(box);
    requestAnimationFrame(function () { box.style.opacity = "1"; });

    // a few uneven red flickers, then off to the game
    var flicks = [500, 650, 820, 900, 1150, 1300];
    flicks.forEach(function (t, i) { setTimeout(function () { glow.style.opacity = i % 2 ? "0" : "1"; }, t); });
    setTimeout(function () { glow.style.opacity = "1"; }, 1450);
    setTimeout(function () { location.href = "/linesdx#hard"; }, 1900);
  }
})();
