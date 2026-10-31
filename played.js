/*
 * coleswebsite.xyz: which games this browser has played.
 * Sky Glider unlocks once Blackjack DX, Lines DX and Lucky Flip have all been played.
 *
 *   CwPlayed.mark("blackjack")   // call when a hand / game / round actually starts
 *   CwPlayed.status()            // { blackjack: true, linesdx: false, luckyflip: true, count: 2, unlocked: false }
 *
 * Kept in this browser only (localStorage "cw_played"). Anyone who already has progress saved
 * in a game from before this existed gets credit for it.
 */
(function () {
  "use strict";
  if (window.CwPlayed) return;
  var KEY = "cw_played", GAMES = ["blackjack", "linesdx", "luckyflip"];

  function read(k) { try { return JSON.parse(localStorage.getItem(k) || "null"); } catch (e) { return null; } }
  function get() { var p = read(KEY); return p && typeof p === "object" ? p : {}; }

  function mark(id) {
    if (GAMES.indexOf(id) < 0) return;
    var p = get();
    if (p[id]) return;
    p[id] = Date.now();
    try { localStorage.setItem(KEY, JSON.stringify(p)); } catch (e) {}
  }

  // progress saved by the games before this file existed
  function already(id) {
    var s;
    if (id === "blackjack") { s = read("cw_blackjack"); return !!(s && (s.hands > 0 || s.wins > 0 || s.losses > 0)); }
    if (id === "luckyflip") { s = read("cw_flip"); return !!(s && (s.wins > 0 || s.losses > 0 || s.level > 1)); }
    if (id === "linesdx") {
      s = read("lines-plus-save");
      var best = 0; try { best = parseInt(localStorage.getItem("prismfall-best"), 10) || 0; } catch (e) {}
      return best > 0 || !!(s && (s.bestLevel > 0 || s.coins > 0));
    }
    return false;
  }

  function status() {
    var p = get(), out = { count: 0 }, changed = false;
    GAMES.forEach(function (id) {
      if (!p[id] && already(id)) { p[id] = 1; changed = true; }
      out[id] = !!p[id];
      if (out[id]) out.count++;
    });
    if (changed) { try { localStorage.setItem(KEY, JSON.stringify(p)); } catch (e) {} }
    out.unlocked = out.count === GAMES.length;
    return out;
  }

  window.CwPlayed = { mark: mark, status: status, games: GAMES };
})();
