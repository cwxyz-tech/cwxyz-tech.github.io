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
    if (/^\/(linesdx|blackjack|luckyflip|skyglider)$/.test(here)) here = "/games";
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
    if (t.closest(".content.pf, .content.bj, .content.fl, .content.sg, .gv")) return;
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
      s.setAttribute("tabindex", "-1");
      var a = document.createElement("a");
      a.href = "#" + s.id;
      a.textContent = text === "FAQ" ? "General" : text;
      a.addEventListener("click", onJump);
      bar.appendChild(a);
    }
    secs[0].parentNode.insertBefore(bar, secs[0]);

    // the bar sticks to the top while you scroll, so a jump has to land just below it
    function fitMargin() {
      var m = bar.offsetHeight + 12;
      for (var j = 0; j < secs.length; j++) secs[j].style.scrollMarginTop = m + "px";
    }
    fitMargin();
    window.addEventListener("resize", fitMargin);

    // a link straight to a topic (/faq#topic-cars): the topics only get their names now, so go there now
    if (location.hash) {
      var t = null;
      try { t = document.getElementById(decodeURIComponent(location.hash.slice(1))); } catch (e) {}
      if (t && t.classList.contains("section-title")) go(t, false);
    }
    window.addEventListener("hashchange", function () {
      var t = null;
      try { t = document.getElementById(decodeURIComponent(location.hash.slice(1))); } catch (e) {}
      if (t && t.classList.contains("section-title")) go(t, false);
    });
  }

  function onJump(e) {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button) return;   // let "open in new tab" work
    var t = document.getElementById(this.getAttribute("href").slice(1));
    if (!t) return;
    e.preventDefault();
    go(t, true);
    // swap the address instead of adding to it, so Back leaves the page instead of stepping through every jump
    try { history.replaceState(history.state, "", "#" + t.id); } catch (err) {}
  }

  function go(t, smooth) {
    var calm = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
    t.scrollIntoView({ behavior: smooth && !calm ? "smooth" : "auto", block: "start" });
    try { t.focus({ preventScroll: true }); } catch (e) {}
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
