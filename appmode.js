/*
 * XYZ Games app mode
 * Load in <head> right after the viewport meta tag.
 * When a page is opened from the home screen icon, it adds the "cw-app" class
 * to <html> and turns off zooming so it feels like a real app.
 */
(function () {
  "use strict";
  var app = (window.matchMedia && matchMedia("(display-mode: standalone)").matches) || navigator.standalone === true;
  if (!app) return;

  var root = document.documentElement;
  root.classList.add("cw-app");

  var vp = document.querySelector('meta[name="viewport"]');
  if (!vp) {
    vp = document.createElement("meta");
    vp.name = "viewport";
    document.head.appendChild(vp);
  }
  vp.setAttribute("content", "width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover");

  // No double-tap zoom
  var style = document.createElement("style");
  style.textContent =
    "html.cw-app, html.cw-app body { touch-action: manipulation; -webkit-text-size-adjust: 100%; }" +
    // No text highlighting, long-press menus or grey tap flashes (typing in boxes still works)
    "html.cw-app * { -webkit-user-select: none; user-select: none; -webkit-touch-callout: none; -webkit-tap-highlight-color: transparent; }" +
    "html.cw-app input, html.cw-app textarea, html.cw-app [contenteditable] { -webkit-user-select: text; user-select: text; }";
  document.head.appendChild(style);

  // No pinch zoom (iPhone ignores user-scalable on its own sometimes)
  ["gesturestart", "gesturechange", "gestureend"].forEach(function (type) {
    document.addEventListener(type, function (e) { e.preventDefault(); }, { passive: false });
  });
  document.addEventListener("touchmove", function (e) {
    if (e.touches && e.touches.length > 1) e.preventDefault();
  }, { passive: false });
})();
