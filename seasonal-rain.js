/* Minimal holiday greeting shown only on the holiday itself. */
(function () {
  "use strict";

  var now = new Date();
  var month = now.getMonth();
  var day = now.getDate();
  var headline = "";

  if (month === 9 && day === 31) {
    headline = "HAPPY HALLOWEEN!";
  } else if (month === 10 && now.getDay() === 4 && day >= 22 && day <= 28) {
    // U.S. Thanksgiving: the fourth Thursday in November.
    headline = "HAPPY THANKSGIVING!";
  } else if (month === 11 && day === 25) {
    headline = "MERRY CHRISTMAS!";
  }

  if (!headline || !document.body) return;

  try {
    if (sessionStorage.getItem("coles-seasonal-intro-seen")) return;
    sessionStorage.setItem("coles-seasonal-intro-seen", "1");
  } catch (error) {
    // Continue if session storage is unavailable.
  }

  var style = document.createElement("style");
  style.textContent = `
    #cole-seasonal-intro {
      position: fixed;
      inset: 0;
      z-index: 10000;
      display: grid;
      place-items: center;
      padding: 20px;
      background: rgba(0, 0, 0, .65);
      font-family: inherit;
      opacity: 1;
      transition: opacity .3s ease;
      cursor: pointer;
    }
    #cole-seasonal-intro.is-leaving {
      opacity: 0;
      pointer-events: none;
    }
    #cole-seasonal-intro h2 {
      margin: 0;
      color: #fff;
      font-size: clamp(28px, 7vw, 48px);
      text-align: center;
      text-shadow: 3px 3px 0 #000;
    }
    @media (prefers-reduced-motion: reduce) {
      #cole-seasonal-intro { transition: none; }
    }
  `;
  document.head.appendChild(style);

  var overlay = document.createElement("div");
  overlay.id = "cole-seasonal-intro";
  overlay.setAttribute("role", "dialog");
  overlay.setAttribute("aria-modal", "true");
  overlay.setAttribute("aria-label", headline);
  var heading = document.createElement("h2");
  heading.textContent = headline;
  overlay.appendChild(heading);

  function closeIntro() {
    if (!overlay.isConnected || overlay.classList.contains("is-leaving")) return;
    overlay.classList.add("is-leaving");
    window.setTimeout(function () {
      if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
    }, 320);
  }

  overlay.addEventListener("click", closeIntro);
  document.body.appendChild(overlay);
  window.setTimeout(closeIntro, 10000);
})();
