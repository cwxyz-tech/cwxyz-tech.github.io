/*
 * coleswebsite.xyz terms gate
 * Include in <head> of every page:  <script src="/tos.js"></script>
 * Until the visitor clicks "I Agree", the page content is hidden.
 * Acceptance is logged in the cookie "cw_tos_accepted" (version|ISO timestamp), 1 year.
 * Bump VERSION whenever the terms change to ask everyone to accept again.
 */
(function () {
  "use strict";

  var COOKIE = "cw_tos_accepted";
  var VERSION = "2026-10-11"; // matches the effective date of the terms
  var script = document.currentScript;
  // /terms uses data-readable so the terms can be read without being locked out
  var readable = !!(script && script.hasAttribute("data-readable"));

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

  if (hasAccepted()) return;

  var css = [
    "html.cw-lock{overflow:hidden}",
    "html.cw-lock body>*:not(#cw-tos){display:none!important}",
    "#cw-tos{position:fixed;top:0;left:0;right:0;bottom:0;z-index:2147483647;background:#f5f5f5;display:flex;align-items:center;justify-content:center;padding:12px;box-sizing:border-box;font-family:Arial,Helvetica,sans-serif;color:#000}",
    "#cw-tos .cw-card{background:#fff;border:1px solid #888;max-width:780px;width:100%;max-height:100%;display:flex;flex-direction:column}",
    "#cw-tos .cw-title{background:#E8A800;border-bottom:1px solid #b98600;font-weight:bold;font-size:18px;padding:10px 14px}",
    "#cw-tos .cw-intro{font-size:13px;padding:10px 14px 0 14px;color:#333}",
    "#cw-tos .cw-terms{flex:1;min-height:120px;overflow:auto;margin:10px 14px;border:1px solid #ccc;padding:12px 14px;font-family:'Times New Roman',Times,serif;font-size:14px;line-height:1.5;background:#fafafa}",
    "#cw-tos .cw-foot{padding:0 14px 14px 14px;font-size:14px}",
    "#cw-tos label{display:flex;gap:8px;align-items:flex-start;cursor:pointer;margin-bottom:10px}",
    "#cw-tos .cw-btns{display:flex;gap:10px;flex-wrap:wrap}",
    "#cw-tos button{font-family:Arial,sans-serif;font-size:14px;padding:8px 18px;border:1px solid #888;background:#ddd;cursor:pointer}",
    "#cw-tos button.cw-yes{background:#14149c;color:#fff;border-color:#0c0c6a}",
    "#cw-tos button[disabled]{opacity:.45;cursor:not-allowed}",
    "#cw-tos .cw-note{font-size:12px;color:#666;margin-top:10px}",
    "#cw-tos .cw-warn{font-size:12px;color:#cc0000;margin-top:8px}",
    "#cw-bar{position:fixed;left:0;right:0;bottom:0;z-index:2147483647;background:#14149c;color:#fff;font-family:Arial,sans-serif;font-size:14px;padding:10px 14px;display:flex;gap:12px;align-items:center;justify-content:space-between;flex-wrap:wrap}",
    "#cw-bar button{font-family:Arial,sans-serif;font-size:14px;padding:6px 16px;border:1px solid #6a6aff;background:#E8A800;cursor:pointer}"
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
    title.textContent = "Terms of Service and Conditions of Access";
    card.appendChild(title);

    var intro = document.createElement("div");
    intro.className = "cw-intro";
    intro.textContent = "Please read the terms below. You need to accept them to enter coleswebsite.xyz.";
    card.appendChild(intro);

    var box = document.createElement("div");
    box.className = "cw-terms";
    box.tabIndex = 0;
    box.textContent = "Loading terms...";
    card.appendChild(box);

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

    var foot = document.createElement("div");
    foot.className = "cw-foot";

    var label = document.createElement("label");
    var cb = document.createElement("input");
    cb.type = "checkbox";
    cb.id = "cw-agree-cb";
    var span = document.createElement("span");
    span.textContent = "I have read and understand these Terms of Service and I agree to be bound by them.";
    label.appendChild(cb);
    label.appendChild(span);
    foot.appendChild(label);

    var btns = document.createElement("div");
    btns.className = "cw-btns";

    var yes = document.createElement("button");
    yes.type = "button";
    yes.className = "cw-yes";
    yes.textContent = "I Agree";
    yes.disabled = true;

    var no = document.createElement("button");
    no.type = "button";
    no.textContent = "I Do Not Agree";

    btns.appendChild(yes);
    btns.appendChild(no);
    foot.appendChild(btns);

    var warn = document.createElement("div");
    warn.className = "cw-warn";
    warn.style.display = "none";
    foot.appendChild(warn);

    var note = document.createElement("div");
    note.className = "cw-note";
    note.textContent = "Clicking \"I Agree\" saves a cookie in your browser (cw_tos_accepted) recording the terms version and the time you accepted.";
    foot.appendChild(note);

    card.appendChild(foot);
    gate.appendChild(card);
    document.body.appendChild(gate);

    cb.addEventListener("change", function () {
      yes.disabled = !cb.checked;
    });
    yes.addEventListener("click", function () {
      if (!cb.checked) return;
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
      // Let mobile visitors know the site is desktop-first after they accept the terms.
      if (window.matchMedia && window.matchMedia("(max-width: 700px)").matches) {
        var notice = document.createElement("div");
        notice.id = "cw-mobile-notice";
        notice.setAttribute("role", "dialog");
        notice.setAttribute("aria-modal", "true");
        notice.style.cssText = "position:fixed;inset:0;z-index:2147483646;background:rgba(0,0,0,.72);display:flex;align-items:center;justify-content:center;padding:20px;box-sizing:border-box;font-family:Arial,Helvetica,sans-serif;color:#111";
        var panel = document.createElement("div");
        panel.style.cssText = "width:100%;max-width:420px;background:#fff;border:1px solid #ccc;border-radius:8px;padding:22px;box-sizing:border-box;line-height:1.5";
        var heading = document.createElement("div");
        heading.style.cssText = "font-size:18px;font-weight:bold;margin-bottom:10px";
        heading.textContent = "Quick heads-up";
        var message = document.createElement("p");
        message.style.cssText = "font-size:15px;margin:0 0 18px";
        message.textContent = "Hey, this site is optimized for desktop, so some things might look a little weird on your phone. Just enter knowing that!";
        var enter = document.createElement("button");
        enter.type = "button";
        enter.textContent = "Enter site";
        enter.style.cssText = "font-family:Arial,sans-serif;font-size:14px;padding:9px 18px;border:1px solid #0c0c6a;border-radius:4px;background:#14149c;color:#fff;cursor:pointer";
        enter.addEventListener("click", function () {
          if (notice.parentNode) notice.parentNode.removeChild(notice);
        });
        panel.appendChild(heading);
        panel.appendChild(message);
        panel.appendChild(enter);
        notice.appendChild(panel);
        document.body.appendChild(notice);
      }
    });
    no.addEventListener("click", function () {
      window.location.replace("about:blank");
    });

    cb.focus();
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
