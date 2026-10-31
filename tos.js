/*
 * coleswebsite.xyz terms gate
 * Include in <head> of every page:  <script src="/tos.js?v=3"></script>
 * Until the visitor clicks "I Agree", the page content is hidden.
 * Acceptance is logged in the cookie "cw_tos_accepted" (version|ISO timestamp), 1 year.
 * Bump VERSION whenever the terms change to ask everyone to accept again.
 */
(function () {
  "use strict";

  // refuse to be shown inside another site's frame (stops clickjacking)
  if (window.top !== window.self) {
    try { window.top.location = window.self.location.href; } catch (e) {}
    document.documentElement.style.display = "none";
    return;
  }

  var COOKIE = "cw_tos_accepted";
  var VERSION = "2026-10-11"; // matches the effective date of the terms
  var script = document.currentScript;
  // /terms uses data-readable so the terms can be read without being locked out
  var readable = !!(script && script.hasAttribute("data-readable"));
  // Pages keep their content in a separate file (data-page) that only loads after acceptance
  var pageSrc = script ? script.getAttribute("data-page") : null;
  var pageLoaded = false;

  // Re-run the page's scripts in order (scripts added via HTML don't run on their own)
  function runScripts(list, i) {
    if (i >= list.length) {
      if (location.hash) {
        var target = null;
        try { target = document.getElementById(decodeURIComponent(location.hash.slice(1))); } catch (e) {}   // a mangled link shouldn't stop the page
        if (target) target.scrollIntoView();
      }
      try { document.dispatchEvent(new CustomEvent("cw:page-loaded")); } catch (e) {}
      return;
    }
    var old = list[i], s = document.createElement("script");
    for (var a = 0; a < old.attributes.length; a++) s.setAttribute(old.attributes[a].name, old.attributes[a].value);
    if (old.src) {
      s.onload = s.onerror = function () { runScripts(list, i + 1); };
      old.parentNode.replaceChild(s, old);
    } else {
      s.textContent = old.textContent;
      old.parentNode.replaceChild(s, old);
      runScripts(list, i + 1);
    }
  }

  // The home screen app has no refresh button, so a failed load can't strand anyone:
  // it retries on its own, then shows a Try Again button, and tries again when the connection comes back.
  var tries = 0, errBox = null, RETRY_MS = [400, 1200, 2500];
  // download started early (while the rest of the page is still being read), used once by the first load
  var early = null;

  function getPage() {
    if (early && tries === 0) { var p = early; early = null; return p; }
    early = null;
    // first try a normal fresh request; retries skip every cache with a throwaway query
    var url = pageSrc, opts = { credentials: "same-origin" };
    if (tries === 0) opts.cache = "no-cache";
    else { url += (url.indexOf("?") < 0 ? "?" : "&") + "r=" + Date.now(); opts.cache = "reload"; }
    return fetch(url, opts).then(function (r) {
      if (!r.ok) throw new Error("bad status");
      return r.text();
    });
  }

  // 1 in 10 page views, the tagline under the logo shows a verse instead
  function swapTagline() {
    if (Math.random() >= 0.1) return;
    var t = document.querySelectorAll(".tagline");
    for (var i = 0; i < t.length; i++) {
      t[i].textContent = "Est. 2023... rejoice always, God is good!";
      t[i].title = "Philippians 4:4";
    }
  }
  document.addEventListener("DOMContentLoaded", function () { if (!pageSrc) swapTagline(); });

  function showPage(html) {
    if (errBox && errBox.parentNode) errBox.parentNode.removeChild(errBox);
    errBox = null;
    var holder = document.createElement("div");
    holder.innerHTML = html;
    var nodes = Array.prototype.slice.call(holder.childNodes);
    for (var n = 0; n < nodes.length; n++) document.body.appendChild(nodes[n]);
    swapTagline();
    runScripts(Array.prototype.slice.call(document.body.querySelectorAll("script")), 0);
  }

  function showError() {
    pageLoaded = false;
    if (errBox) return;
    errBox = document.createElement("div");
    errBox.style.cssText = "max-width:600px;margin:60px auto;padding:20px;background:#c0c0c0;border:3px outset #fff;font-family:'Times New Roman',Times,serif;font-size:16px";
    var msg = document.createElement("p");
    msg.style.margin = "0 0 14px";
    msg.textContent = "Oops! This page couldn't load. Check your connection and try again.";
    var btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = "Try Again";
    btn.style.cssText = "font-family:'Times New Roman',Times,serif;font-size:16px;font-weight:bold;padding:10px 22px;min-height:44px;border:2px outset #fff;background:#c0c0c0;cursor:pointer";
    btn.addEventListener("click", function () { btn.textContent = "Loading..."; tries = 0; loadPage(); });
    errBox.appendChild(msg);
    errBox.appendChild(btn);
    document.body.appendChild(errBox);
  }

  function loadPage() {
    if (!pageSrc || pageLoaded) return;
    pageLoaded = true;
    getPage().then(showPage, function () {
      if (tries < RETRY_MS.length) {
        setTimeout(function () { tries++; pageLoaded = false; loadPage(); }, RETRY_MS[tries]);
      } else {
        showError();
        var b = errBox && errBox.querySelector("button");
        if (b) b.textContent = "Try Again";
      }
    });
  }

  // back online, or the app brought back to the front: try again by itself
  function retrySoon() { if (errBox && !pageLoaded) { tries = 0; loadPage(); } }
  window.addEventListener("online", retrySoon);
  document.addEventListener("visibilitychange", function () { if (!document.hidden) retrySoon(); });

  function readCookie() {
    var m = document.cookie.match(new RegExp("(?:^|; )" + COOKIE + "=([^;]*)"));
    return m ? decodeURIComponent(m[1]) : null;
  }

  function hasAccepted() {
    var v = readCookie();
    return !!v && v.split("|")[0] === VERSION;
  }

  function saveCookie() {
    var value = VERSION + "|" + new Date().toISOString();
    document.cookie =
      COOKIE + "=" + encodeURIComponent(value) +
      "; max-age=31536000; path=/; SameSite=Lax" +
      (location.protocol === "https:" ? "; Secure" : "");
    return hasAccepted();
  }

  if (hasAccepted()) {
    // start downloading the page content right away instead of waiting for the page to finish loading
    if (pageSrc && document.readyState === "loading") {
      early = getPage();
      early.catch(function () {});
    }
    var start = function () { loadPage(); };
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
    else start();
    return;
  }

  var css = [
    "html.cw-lock{overflow:hidden}",
    "html.cw-lock body>*:not(#cw-tos){display:none!important}",
    "#cw-tos{position:fixed;top:0;left:0;right:0;bottom:0;z-index:2147483647;background:#008080;display:flex;align-items:center;justify-content:center;padding:12px;box-sizing:border-box;font-family:'Times New Roman',Times,serif;color:#000}",
    "#cw-tos .cw-card{background:#c0c0c0;border:3px outset #fff;box-shadow:4px 4px 0 #000;max-width:600px;width:100%;max-height:100%;display:flex;flex-direction:column}",
    "#cw-tos .cw-title{background:linear-gradient(90deg,#000080,#1084d0);color:#fff;font-weight:bold;font-size:18px;padding:6px 10px}",
    "#cw-tos .cw-intro{font-size:16px;padding:14px 14px 0 14px;color:#000}",
    "#cw-tos .cw-terms{flex:1;min-height:120px;overflow:auto;margin:10px 14px;border:2px inset #808080;padding:12px 14px;font-family:'Times New Roman',Times,serif;font-size:14px;line-height:1.5;background:#fff}",
    "#cw-tos .cw-terms[hidden]{display:none}",
    "#cw-tos .cw-read{padding:10px 14px 0 14px;font-size:14px}",
    "#cw-tos .cw-read a{color:#0000ee;text-decoration:underline;cursor:pointer}",
    "#cw-tos .cw-foot{padding:12px 14px 14px 14px;font-size:14px}",
    "#cw-tos label{display:flex;gap:8px;align-items:flex-start;cursor:pointer;margin-bottom:10px}",
    "#cw-tos .cw-btns{display:flex;gap:10px;flex-wrap:wrap}",
    "#cw-tos button{font-family:'Times New Roman',Times,serif;font-size:14px;padding:8px 18px;border:2px outset #fff;background:#c0c0c0;font-weight:bold;cursor:pointer}",
    "#cw-tos button.cw-yes{background:#b4ebcf;color:#000;font-size:17px;padding-left:22px;padding-right:22px}",
    "#cw-tos button[disabled]{opacity:.45;cursor:not-allowed}",
    "#cw-tos .cw-note{font-size:12px;color:#666;margin-top:10px}",
    "#cw-tos .cw-warn{font-size:12px;color:#cc0000;margin-top:8px}",
    "#cw-bar{position:fixed;left:0;right:0;bottom:0;z-index:2147483647;background:#000080;color:#fff;border-top:2px outset #fff;font-family:'Times New Roman',Times,serif;font-size:14px;padding:10px 14px;display:flex;gap:12px;align-items:center;justify-content:space-between;flex-wrap:wrap}",
    "#cw-bar button{font-family:'Times New Roman',Times,serif;font-size:14px;padding:6px 16px;border:2px outset #fff;background:#c0c0c0;font-weight:bold;cursor:pointer}"
  ].join("\n");
  var style = document.createElement("style");
  style.id = "cw-tos-style";
  style.textContent = css;
  document.head.appendChild(style);

  if (!readable) document.documentElement.classList.add("cw-lock");

  function unlock(root) {
    var ok = saveCookie();
    if (root && root.parentNode) root.parentNode.removeChild(root);
    document.documentElement.classList.remove("cw-lock");
    loadPage();
    try {
      document.dispatchEvent(new CustomEvent("cw:tos-accepted", { detail: { cookieSaved: ok } }));
    } catch (e) {}
    return ok;
  }

  function buildBar() {
    var bar = document.createElement("div");
    bar.id = "cw-bar";
    bar.innerHTML = "<span>You haven't accepted these terms yet. The rest of the site stays locked until you do.</span>";
    var btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = "I Agree";
    btn.addEventListener("click", function () {
      unlock(bar);
    });
    bar.appendChild(btn);
    document.body.appendChild(bar);
  }

  function buildGate() {
    var gate = document.createElement("div");
    gate.id = "cw-tos";
    gate.setAttribute("role", "dialog");
    gate.setAttribute("aria-modal", "true");
    gate.setAttribute("aria-labelledby", "cw-tos-title");

    var card = document.createElement("div");
    card.className = "cw-card";

    var title = document.createElement("div");
    title.className = "cw-title";
    title.id = "cw-tos-title";
    title.textContent = "Welcome to coleswebsite.xyz!";
    card.appendChild(title);

    var intro = document.createElement("div");
    intro.className = "cw-intro";
    intro.textContent = "Before you come in, please accept the Terms of Service. You only have to do this once.";
    card.appendChild(intro);

    // the terms stay tucked away until the visitor clicks to read them
    var read = document.createElement("div");
    read.className = "cw-read";
    var toggle = document.createElement("a");
    toggle.href = "/terms/";
    toggle.setAttribute("role", "button");
    toggle.setAttribute("aria-expanded", "false");
    toggle.textContent = "Read the Terms of Service";
    read.appendChild(toggle);
    card.appendChild(read);

    var box = document.createElement("div");
    box.className = "cw-terms";
    box.id = "cw-terms-box";
    box.tabIndex = 0;
    box.hidden = true;
    box.textContent = "Loading terms...";
    toggle.setAttribute("aria-controls", "cw-terms-box");
    card.appendChild(box);

    var termsFetched = false;
    toggle.addEventListener("click", function (ev) {
      ev.preventDefault();
      box.hidden = !box.hidden;
      toggle.setAttribute("aria-expanded", String(!box.hidden));
      toggle.textContent = box.hidden ? "Read the Terms of Service" : "Hide the Terms of Service";
      if (!box.hidden) { box.scrollTop = 0; if (!termsFetched) { termsFetched = true; fetchTerms(); } }
    });

    function fetchTerms() {
    fetch("/terms/", { credentials: "same-origin" })
      .then(function (r) {
        if (!r.ok) throw new Error("bad status");
        return r.text();
      })
      .then(function (html) {
        var doc = new DOMParser().parseFromString(html, "text/html");
        var src = doc.getElementById("terms-text");
        if (!src) throw new Error("no terms");
        box.textContent = "";
        box.appendChild(document.importNode(src, true));
      })
      .catch(function () {
        box.innerHTML = 'The terms could not be loaded here. <a href="/terms/" target="_blank" rel="noopener">Read them on this page</a>, then come back and accept.';
      });
    }

    var foot = document.createElement("div");
    foot.className = "cw-foot";

    var label = document.createElement("p");
    label.style.margin = "0 0 10px";
    label.textContent = "By clicking \"I Agree\" you accept the Terms of Service and Conditions of Access.";
    foot.appendChild(label);

    var btns = document.createElement("div");
    btns.className = "cw-btns";

    var yes = document.createElement("button");
    yes.type = "button";
    yes.className = "cw-yes";
    yes.innerHTML = "I Agree &#8212; Enter";

    var no = document.createElement("button");
    no.type = "button";
    no.textContent = "No Thanks";

    btns.appendChild(yes);
    btns.appendChild(no);
    foot.appendChild(btns);

    var warn = document.createElement("div");
    warn.className = "cw-warn";
    warn.style.display = "none";
    foot.appendChild(warn);

    var note = document.createElement("div");
    note.className = "cw-note";
    note.textContent = "Agreeing saves one small cookie (cw_tos_accepted) with the terms version and the time, so you're only asked once a year.";
    foot.appendChild(note);

    card.appendChild(foot);
    gate.appendChild(card);
    document.body.appendChild(gate);

    yes.addEventListener("click", function () {
      var ok = unlock(gate);
      if (!ok) {
        // cookies are blocked: let them in for this page view, but be upfront
        var w = document.createElement("div");
        w.id = "cw-bar";
        w.textContent = "Your browser blocked the acceptance cookie, so you'll be asked again on the next page.";
        document.body.appendChild(w);
        setTimeout(function () {
          if (w.parentNode) w.parentNode.removeChild(w);
        }, 6000);
      }
    });
    no.addEventListener("click", function () {
      window.location.replace("about:blank");
    });

    yes.focus();
  }

  function init() {
    if (readable) buildBar();
    else buildGate();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
