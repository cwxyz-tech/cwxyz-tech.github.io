/* A tiny retro seasonal welcome splash for the homepage */
(function () {
  "use strict";

  // Show once per browser tab session, and leave the rest of the website alone.
  try {
    if (sessionStorage.getItem("coles-seasonal-intro-seen")) return;
    sessionStorage.setItem("coles-seasonal-intro-seen", "1");
  } catch (error) {
    // If storage is unavailable, show the brief intro for this page load.
  }

  var month = new Date().getMonth(); // 0 = January
  var season = {
    9: {
      headline: "HAPPY HALLOWEEN!",
      icons: ["🎃", "🎃", "🍂", "🎃"],
      color: "#ff8c00",
      accent: "#b7ff00",
      background: "#170d2e"
    },
    10: {
      headline: "HAPPY THANKSGIVING!",
      icons: ["🦃", "🍁", "🦃", "🍂"],
      color: "#ffb347",
      accent: "#f7ff75",
      background: "#2d160d"
    },
    11: {
      headline: "HAPPY HOLIDAYS!",
      icons: ["🎄", "❄️", "🎁", "⭐"],
      color: "#39e58c",
      accent: "#fff36b",
      background: "#071f2a"
    }
  }[month];

  if (!season || !document.body) return;

  var style = document.createElement("style");
  style.textContent = `
    #cole-seasonal-intro {
      position: fixed;
      inset: 0;
      z-index: 10000;
      display: grid;
      place-items: center;
      padding: 18px;
      background: rgba(0, 0, 0, .42);
      font-family: "Courier New", Courier, monospace;
      opacity: 1;
      transition: opacity .35s ease;
    }
    #cole-seasonal-intro.is-leaving { opacity: 0; pointer-events: none; }
    #cole-seasonal-intro .intro-window {
      position: relative;
      width: min(390px, 100%);
      overflow: hidden;
      color: #fff;
      background: ${season.background};
      border: 3px solid #fff;
      outline: 3px solid #151515;
      box-shadow: 8px 8px 0 rgba(0,0,0,.45);
      text-align: center;
    }
    #cole-seasonal-intro .intro-titlebar {
      padding: 7px 10px;
      background: linear-gradient(90deg, ${season.color}, #5b2aa8);
      color: #fff;
      font-size: 11px;
      font-weight: 900;
      letter-spacing: 1px;
      text-align: left;
      text-shadow: 1px 1px #111;
    }
    #cole-seasonal-intro .intro-content { padding: 18px 20px 16px; }
    #cole-seasonal-intro .intro-icons {
      display: flex;
      justify-content: center;
      gap: 13px;
      min-height: 32px;
      margin-bottom: 8px;
      font-family: sans-serif;
      font-size: 24px;
    }
    #cole-seasonal-intro .intro-icons span {
      display: inline-block;
      animation: cole-intro-bounce .65s steps(2, end) infinite alternate;
    }
    #cole-seasonal-intro .intro-icons span:nth-child(even) { animation-delay: .2s; }
    #cole-seasonal-intro h2 {
      margin: 5px 0 8px;
      color: ${season.accent};
      font-size: clamp(20px, 6vw, 26px);
      line-height: 1.15;
      text-shadow: 3px 3px 0 #d12cff;
    }
    #cole-seasonal-intro .intro-meter {
      height: 12px;
      padding: 2px;
      margin: 0 0 14px;
      border: 2px inset #bbb;
      background: #111;
    }
    #cole-seasonal-intro .intro-meter span {
      display: block;
      width: 100%;
      height: 100%;
      transform-origin: left;
      background: repeating-linear-gradient(90deg, ${season.color} 0 12px, #fff 12px 14px);
      animation: cole-intro-load 2.25s linear forwards;
    }
    #cole-seasonal-intro button {
      padding: 8px 13px;
      border: 3px outset #eee;
      border-radius: 0;
      background: #ddd;
      color: #111;
      font: bold 12px "Courier New", Courier, monospace;
      cursor: pointer;
      box-shadow: 2px 2px 0 #111;
    }
    #cole-seasonal-intro button:active { border-style: inset; transform: translate(1px, 1px); }
    @keyframes cole-intro-bounce {
      from { transform: translateY(2px) rotate(-5deg); }
      to { transform: translateY(-4px) rotate(5deg); }
    }
    @keyframes cole-intro-load { from { transform: scaleX(.08); } to { transform: scaleX(1); } }
    @media (prefers-reduced-motion: reduce) {
      #cole-seasonal-intro, #cole-seasonal-intro * {
        animation: none !important;
        transition: none !important;
      }
    }
  `;
  document.head.appendChild(style);

  var overlay = document.createElement("div");
  overlay.id = "cole-seasonal-intro";
  overlay.setAttribute("role", "dialog");
  overlay.setAttribute("aria-modal", "true");
  overlay.setAttribute("aria-label", "Seasonal welcome");
  overlay.innerHTML =
    '<div class="intro-window">' +
      '<div class="intro-titlebar">★ COLESWEBSITE.XYZ ★</div>' +
      '<div class="intro-content">' +
        '<div class="intro-icons" aria-hidden="true">' +
          season.icons.map(function (icon) { return '<span>' + icon + '</span>'; }).join("") +
        '</div>' +
        '<h2>' + season.headline + '</h2>' +
        '<div class="intro-meter" aria-hidden="true"><span></span></div>' +
        '<button type="button">ENTER SITE &raquo;</button>' +
      '</div>' +
    '</div>';

  function closeIntro() {
    if (!overlay.isConnected || overlay.classList.contains("is-leaving")) return;
    overlay.classList.add("is-leaving");
    window.setTimeout(function () {
      if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
    }, 380);
  }

  overlay.querySelector("button").addEventListener("click", closeIntro);
  document.body.appendChild(overlay);
  window.setTimeout(closeIntro, 10000);
})();
