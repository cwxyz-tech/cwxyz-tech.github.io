/* Seasonal retro rain — injected on the homepage */
(function () {
  "use strict";

  var now = new Date();
  var month = now.getMonth(); // 0 = January
  var date = now.getDate();

  // Thanksgiving gets its own turkey rain from the fourth Thursday through November 30.
  function isThanksgivingSeason() {
    if (month !== 10) return false;
    var firstDay = new Date(now.getFullYear(), 10, 1).getDay();
    var firstThursday = 1 + ((4 - firstDay + 7) % 7);
    var thanksgiving = firstThursday + 21;
    return date >= thanksgiving;
  }

  var season;
  if (month === 11) {
    season = "christmas";
  } else if (isThanksgivingSeason()) {
    season = "thanksgiving";
  } else if (month === 9) {
    season = "halloween";
  } else {
    return; // Keep the site's usual look for the rest of the year.
  }

  var settings = {
    halloween: {
      label: "October pumpkin rain",
      items: ["🎃", "🎃", "🟠", "🍂"],
      colors: ["#ff7b00", "#f59e0b", "#9b5de5"],
      count: 22
    },
    thanksgiving: {
      label: "Thanksgiving turkey rain",
      items: ["🦃", "🍁", "🍂"],
      colors: ["#9a3412", "#b45309", "#d97706"],
      count: 18
    },
    christmas: {
      label: "Christmas snowfall",
      items: ["🎄", "🎁", "❄", "⭐"],
      colors: ["#c1121f", "#0b7a46", "#f4d35e", "#ffffff"],
      count: 24
    }
  }[season];

  var style = document.createElement("style");
  style.textContent = `
    #seasonal-rain {
      position: fixed;
      inset: 0;
      overflow: hidden;
      pointer-events: none;
      z-index: 999;
      contain: strict;
    }
    #seasonal-rain .seasonal-item {
      position: absolute;
      top: -12vh;
      left: var(--left);
      display: block;
      font-family: "Apple Color Emoji", "Segoe UI Emoji", sans-serif;
      font-size: var(--size);
      line-height: 1;
      opacity: .92;
      filter: drop-shadow(2px 2px 0 rgba(0,0,0,.16));
      animation: seasonal-fall var(--duration) linear var(--delay) infinite;
      will-change: transform;
      user-select: none;
    }
    #seasonal-rain[data-season="halloween"] .seasonal-item {
      image-rendering: pixelated;
      text-shadow: 2px 0 #5a2600, -2px 0 #5a2600, 0 2px #5a2600, 0 -2px #5a2600;
    }
    #seasonal-rain[data-season="thanksgiving"] .seasonal-item {
      text-shadow: 1px 1px 0 #fff0d0;
    }
    #seasonal-rain[data-season="christmas"] .seasonal-item {
      filter: drop-shadow(1px 2px 0 rgba(0,0,0,.2));
    }
    @keyframes seasonal-fall {
      0% { transform: translate3d(0, -8vh, 0) rotate(0deg); }
      50% { transform: translate3d(28px, 54vh, 0) rotate(180deg); }
      100% { transform: translate3d(-18px, 112vh, 0) rotate(360deg); }
    }
    @media (prefers-reduced-motion: reduce) {
      #seasonal-rain .seasonal-item { animation: none; }
      #seasonal-rain .seasonal-item:nth-child(n+7) { display: none; }
    }
  `;
  document.head.appendChild(style);

  var layer = document.createElement("div");
  layer.id = "seasonal-rain";
  layer.dataset.season = season;
  layer.setAttribute("aria-hidden", "true");
  layer.setAttribute("role", "presentation");

  var reduceMotion = window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var itemCount = reduceMotion ? Math.min(6, settings.count) : settings.count;

  for (var i = 0; i < itemCount; i++) {
    var item = document.createElement("span");
    item.className = "seasonal-item";
    item.textContent = settings.items[i % settings.items.length];
    item.style.setProperty("--left", (Math.random() * 100) + "vw");
    item.style.setProperty("--size", (18 + Math.random() * 18) + "px");
    item.style.setProperty("--duration", (8 + Math.random() * 12) + "s");
    item.style.setProperty("--delay", (-Math.random() * 18) + "s");
    item.style.color = settings.colors[i % settings.colors.length];
    layer.appendChild(item);
  }

  document.body.appendChild(layer);
})();
