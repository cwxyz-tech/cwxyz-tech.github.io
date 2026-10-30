/* coleswebsite.xyz: small usability helpers shared by every page.
   - the menu shows which page you're on
   - every window's title bar has a working minimize button (double-click the title bar works too)
   - long pages with topics (the FAQ) get a "Jump to" bar
   Runs once the page content is on screen (pages load in after the terms check). */
(function () {
  "use strict";
  var done = false;

  function norm(p) {
    p = (p || "/").split("#")[0].split("?")[0].replace(/\/index\.html$/, "/").replace(/\/+$/, "");
    return p || "/";
  }

  function markNav() {
    var here = norm(location.pathname);
    // each game counts as part of the Games section
    if (/^\/(linesdx|blackjack|luckyflip)$/.test(here)) here = "/games";
    var links = document.querySelectorAll(".navbar a[href^='/']");
    for (var i = 0; i < links.length; i++) {
      if (norm(links[i].getAttribute("href")) === here) links[i].setAttribute("aria-current", "page");
    }
  }

  function windows() {
    var titles = document.querySelectorAll(".box-title");
    for (var i = 0; i < titles.length; i++) setupWindow(titles[i]);
  }

  function setupWindow(t) {
    // the games have their own title bars and controls
    if (t.closest(".content.pf, .content.bj, .content.fl, .gv")) return;
    var body = t.nextElementSibling;
    if (!body) return;
    var name = (t.textContent || "").trim();
    t.classList.add("ux-win");
    var b = document.createElement("button");
    b.type = "button";
    b.className = "ux-min";
    function paint() {
      var shut = body.hidden;
      b.textContent = shut ? "□" : "_";
      b.title = shut ? "Restore" : "Minimize";
      b.setAttribute("aria-label", (shut ? "Restore " : "Minimize ") + name);
      b.setAttribute("aria-expanded", String(!shut));
      t.classList.toggle("ux-shut", shut);
    }
    function toggle() { body.hidden = !body.hidden; paint(); }
    b.addEventListener("click", function (e) { e.stopPropagation(); toggle(); });
    t.addEventListener("dblclick", function (e) {
      if (e.target.closest("a, button, input")) return;
      toggle();
      if (window.getSelection) window.getSelection().removeAllRanges();
    });
    t.appendChild(b);
    paint();
  }

  function jumpBar() {
    var secs = document.querySelectorAll(".section-title");
    if (secs.length < 3) return;
    var bar = document.createElement("nav");
    bar.className = "ux-jump";
    bar.setAttribute("aria-label", "Jump to a topic");
    var label = document.createElement("span");
    label.textContent = "Jump to:";
    bar.appendChild(label);
    for (var i = 0; i < secs.length; i++) {
      var s = secs[i], text = (s.textContent || "").trim();
      if (!s.id) s.id = "topic-" + (text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || i);
      var a = document.createElement("a");
      a.href = "#" + s.id;
      a.textContent = text === "FAQ" ? "General" : text;
      bar.appendChild(a);
    }
    secs[0].parentNode.insertBefore(bar, secs[0]);
  }

  function run() {
    if (done || !document.querySelector(".navbar")) return;
    done = true;
    markNav();
    windows();
    jumpBar();
  }

  document.addEventListener("cw:page-loaded", run);
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", run);
  else run();
})();
