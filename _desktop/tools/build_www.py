# Builds the offline game bundle the desktop apps use, from the website files in this repository.
# usage: python3 build_www.py SITE_DIR OUT_DIR
import os, re, shutil, sys

site, out = sys.argv[1], sys.argv[2]
if os.path.exists(out): shutil.rmtree(out)
os.makedirs(out)

GAMES = [("blackjack", "Blackjack DX"), ("linesdx", "Lines DX"), ("luckyflip", "Lucky Flip")]

# what every game page gets inside the app: no website header/menu/footer, a way back to the launcher,
# and no web-page right-click menu
APP_CSS = """<style>
  /* Cole's Games app: just the game, centered on the teal desktop, no website around it */
  .header, .goldbar, .navbar, .footer, .gm-appbar, .gm-appfoot { display: none !important; }
  .wrap { max-width: none !important; margin: 0 auto !important; background: transparent !important; border: 0 !important;
    box-shadow: none !important; padding-bottom: 24px; }
  html, body { -webkit-user-select: none; user-select: none; }
  input, textarea { -webkit-user-select: text; user-select: text; }
  /* no scrollbar beside the game (the wheel still scrolls to the help below) */
  html::-webkit-scrollbar { display: none; }
  html { scrollbar-width: none; }
  /* Lines DX sizes its board to the browser height; in the app the whole game scales to the window instead */
  .pf-well { height: 640px !important; }
</style>"""
# Tells the app how big the game's window is, so the app can scale it to fill the Mac window,
# and centers it vertically. Runs again whenever the window or the game's size changes.
APP_JS = """<script>
(function () {
  document.addEventListener("contextmenu", function (e) { if (!/input|textarea/i.test(e.target.tagName)) e.preventDefault(); });
  var post = window.webkit && webkit.messageHandlers && webkit.messageHandlers.cgFit;
  function game() {
    var c = document.querySelector(".content"), t = c && c.querySelector(".box-title"), b = t && t.nextElementSibling;
    return t && b ? [t, b] : null;
  }
  var queued = false, lastSent = "";
  function fit() {
    queued = false;
    var g = game(), wrap = document.querySelector(".wrap");
    if (!g || !wrap) return;
    var r1 = g[0].getBoundingClientRect(), r2 = g[1].getBoundingClientRect();
    var w = Math.ceil(Math.max(r1.width, r2.width)), h = Math.ceil(r2.bottom - r1.top);
    // put the game's top edge where it's centered (at least 8px down), whatever padding the page has
    var cur = parseFloat(wrap.style.marginTop) || 0;
    var naturalTop = r1.top + window.scrollY - cur;
    var shift = Math.round(Math.max(8, (window.innerHeight - h) / 2) - naturalTop);
    if (Math.abs(shift - cur) > 1) wrap.style.setProperty("margin-top", shift + "px", "important");
    var msg = w + "x" + h;
    if (post && msg !== lastSent) { lastSent = msg; post.postMessage({ w: w, h: h }); }
  }
  function queue() { if (!queued) { queued = true; requestAnimationFrame(fit); } }
  window.addEventListener("resize", function () { lastSent = ""; queue(); });
  window.addEventListener("load", queue);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(queue);
  var g = game();
  if (g && window.ResizeObserver) new ResizeObserver(queue).observe(g[1]);
  queue();
})();
</script>"""

def copy(rel):
    src = os.path.join(site, rel); dst = os.path.join(out, rel)
    os.makedirs(os.path.dirname(dst), exist_ok=True)
    shutil.copy2(src, dst)

def build_game(slug, title):
    head_html = open(os.path.join(site, slug, "index.html"), encoding="utf-8").read()
    body_html = open(os.path.join(site, "pages", slug + ".html"), encoding="utf-8").read()
    h = head_html
    # the website's terms gate and home-screen helper aren't part of the app
    h = re.sub(r'<script src="/tos\.js[^"]*"[^>]*></script>\n?', "", h)
    h = re.sub(r'<script src="/appmode\.js[^"]*"></script>\n?', "", h)
    h = re.sub(r'<noscript>.*?</noscript>\n?', "", h, flags=re.S)
    # social-media preview tags and web icons don't matter inside an app
    h = re.sub(r'<meta (property="og:|name="twitter:)[^>]*>\n?', "", h)
    h = re.sub(r'<link rel="(icon|apple-touch-icon)"[^>]*>\n?', "", h)
    h = re.sub(r'<title>.*?</title>', "<title>" + title + " - Cole's Games</title>", h)
    h = h.replace("</head>", APP_CSS + "\n</head>")
    b = body_html
    # links back to the games list go to the app's launcher instead
    b = b.replace('href="/games"', 'href="/"')
    assert "<body>" in h and "</body>" in h
    h = h.replace("</body>", b + "\n" + APP_JS + "\n</body>")
    os.makedirs(os.path.join(out, slug), exist_ok=True)
    open(os.path.join(out, slug, "index.html"), "w", encoding="utf-8").write(h)
    # music for this game
    for f in sorted(os.listdir(os.path.join(site, slug))):
        if f.endswith(".mp3"): copy(os.path.join(slug, f))

for slug, title in GAMES: build_game(slug, title)
for rel in ["site.css", "juice.js", "konami.js", "logo.png", "fonts/ComicNeue-Regular.woff2", "fonts/ComicNeue-Bold.woff2",
            "fonts/ComicNeue-OFL.txt", "games/blackjack.gif", "games/linesdx.gif", "games/luckyflip.gif",
            "music/cover-256.png", "music/cover-512.png"]:
    copy(rel)
for f in ["lucky-lounge", "on-fire", "all-in", "lines-main-theme", "lines-hard-mode", "lines-the-shop", "lucky-flip"]:
    copy("music/tracks/" + f + ".mp3")

# the launcher, in the Mac's own style (system font, light and dark mode)
INFO = {
    "blackjack": ("Card game", "Beat the dealer to 21 and stack up your chips. Win in a row to heat up and multiply your winnings."),
    "linesdx": ("Puzzle", "Stack the falling pieces, clear lines, land T-spins and fire off special moves."),
    "luckyflip": ("Puzzle", "Flip tiles, dodge bombs and multiply your coins. The number clues show where the bombs hide."),
}
CARDS = ""
for i, (slug, title) in enumerate(GAMES):
    kind, desc = INFO[slug]
    CARDS += f'''
    <a class="card" href="/{slug}/">
      <div class="shot"><img src="/games/{slug}.gif" alt="" width="480" height="398"></div>
      <div class="info">
        <div class="kind">{kind}</div>
        <h2>{title}</h2>
        <p>{desc}</p>
        <div class="row"><span class="play">Play</span><kbd>&#8984;{i + 1}</kbd></div>
      </div>
    </a>'''
LAUNCHER = f'''<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; media-src 'self'; font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'self'; form-action 'none'">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light dark">
<title>Cole's Games</title>
<style>
  :root {{
    --bg: #ececec; --card: #ffffff; --text: #1d1d1f; --text2: #6e6e73; --line: rgba(0,0,0,.09);
    --accent: #007aff; --accent-text: #ffffff; --shadow: 0 1px 2px rgba(0,0,0,.06), 0 6px 18px rgba(0,0,0,.08);
  }}
  @media (prefers-color-scheme: dark) {{
    :root {{ --bg: #1e1e1e; --card: #2a2a2c; --text: #f5f5f7; --text2: #a1a1a6; --line: rgba(255,255,255,.08);
      --accent: #0a84ff; --shadow: 0 1px 2px rgba(0,0,0,.4), 0 8px 24px rgba(0,0,0,.35); }}
  }}
  * {{ box-sizing: border-box; }}
  ::-webkit-scrollbar {{ width: 12px; }}
  ::-webkit-scrollbar-track {{ background: transparent; }}
  ::-webkit-scrollbar-thumb {{ background: rgba(127,127,127,.4); border-radius: 6px; border: 3px solid var(--bg); }}
  ::-webkit-scrollbar-thumb:hover {{ background: rgba(127,127,127,.6); }}
  html, body {{ margin: 0; background: var(--bg); color: var(--text); -webkit-user-select: none; user-select: none; cursor: default; }}
  body {{ font: 13px/1.4 -apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI Variable Text", "Segoe UI", system-ui, Cantarell, Ubuntu, "Helvetica Neue", sans-serif; -webkit-font-smoothing: antialiased; }}
  body.win {{ font-size: 14px; }}
  main {{ max-width: 1080px; margin: 0 auto; padding: 28px 32px 32px; }}
  header {{ margin-bottom: 20px; }}
  h1 {{ margin: 0; font: 700 28px/1.15 -apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI Variable Display", "Segoe UI", system-ui, sans-serif; letter-spacing: -.01em; }}
  header p {{ margin: 4px 0 0; color: var(--text2); font-size: 14px; }}
  .grid {{ display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 20px; }}
  .card {{ display: flex; flex-direction: column; background: var(--card); border-radius: 12px; overflow: hidden; text-decoration: none; color: inherit;
    box-shadow: var(--shadow); outline: 1px solid var(--line); outline-offset: -1px; transition: transform .15s ease, box-shadow .15s ease; }}
  .card:hover {{ transform: translateY(-2px); box-shadow: 0 2px 4px rgba(0,0,0,.08), 0 12px 28px rgba(0,0,0,.14); }}
  .card:active {{ transform: translateY(0) scale(.99); }}
  .card:focus-visible {{ outline: 3px solid var(--accent); outline-offset: 2px; }}
  .shot {{ aspect-ratio: 480 / 398; background: #000; overflow: hidden; }}
  .shot img {{ width: 100%; height: 100%; object-fit: cover; display: block; image-rendering: pixelated; }}
  .info {{ display: flex; flex-direction: column; gap: 4px; padding: 14px 16px 16px; flex: 1; }}
  .kind {{ font-size: 11px; font-weight: 600; letter-spacing: .04em; text-transform: uppercase; color: var(--text2); }}
  h2 {{ margin: 0; font: 600 18px/1.2 -apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI Variable Display", "Segoe UI", system-ui, sans-serif; }}
  .info p {{ margin: 2px 0 10px; color: var(--text2); }}
  .row {{ margin-top: auto; display: flex; align-items: center; justify-content: space-between; }}
  .play {{ background: var(--accent); color: var(--accent-text); font-weight: 600; font-size: 13px; padding: 4px 16px; border-radius: 999px; }}
  kbd {{ font: inherit; font-size: 12px; color: var(--text2); }}
  /* Windows and Linux: squarer corners and the system's accent color (sent in by the app) */
  body.win .card, body.win .player {{ border-radius: 8px; }} body.win .play, body.win .pill {{ border-radius: 4px; }}
  footer {{ margin-top: 22px; text-align: center; color: var(--text2); font-size: 12px; }}
  /* the coleswebsite.xyz-style logo: heavy Times, navy and red */
  .logo {{ font: bold 64px/1 "Times New Roman", Times, serif; letter-spacing: -2.5px; white-space: nowrap; }}
  .logo .l1 {{ color: #0a0a6e; }} .logo .l2 {{ color: #c40000; margin-left: 14px; }}
  @media (prefers-color-scheme: dark) {{ .logo .l1 {{ color: #8a8aff; }} .logo .l2 {{ color: #ff4040; }} }}
  .rainbow {{ height: 8px; margin: 10px 0 8px; border-top: 1px solid #000; border-bottom: 1px solid #000;
    background: repeating-linear-gradient(90deg, #ff0000 0 24px, #ff9900 24px 48px, #ffff00 48px 72px, #00cc00 72px 96px,
      #00cccc 96px 120px, #0000ff 120px 144px, #cc00cc 144px 168px); }}
  .section {{ margin: 22px 0 10px; font-weight: 600; font-size: 15px; color: var(--text); }}
  /* music player */
  .player {{ background: var(--card); border-radius: 12px; box-shadow: var(--shadow); outline: 1px solid var(--line); outline-offset: -1px; overflow: hidden; }}
  .now {{ display: flex; gap: 16px; padding: 16px; border-bottom: 1px solid var(--line); align-items: center; }}
  .cover {{ width: 112px; height: 112px; border-radius: 8px; image-rendering: pixelated; flex: none; box-shadow: 0 2px 8px rgba(0,0,0,.2); }}
  .meta {{ flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 4px; }}
  .np-title {{ font-weight: 600; font-size: 17px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }}
  .np-game {{ color: var(--text2); }}
  .bar {{ display: flex; align-items: center; gap: 8px; font-size: 11px; color: var(--text2); font-variant-numeric: tabular-nums; margin-top: 4px; }}
  .bar input {{ flex: 1; accent-color: var(--accent); }}
  .ctrls {{ display: flex; align-items: center; gap: 6px; }}
  .ib {{ width: 32px; height: 32px; border-radius: 50%; border: 0; background: transparent; color: var(--text); font-size: 15px; cursor: default; }}
  .ib:hover {{ background: var(--line); }}
  .ib.big {{ width: 40px; height: 40px; font-size: 18px; background: var(--accent); color: #fff; }}
  .ib.big:hover {{ filter: brightness(1.08); background: var(--accent); }}
  .pill {{ margin-left: 8px; border: 1px solid var(--line); background: transparent; color: var(--text); border-radius: 999px; padding: 3px 10px; font: inherit; font-size: 12px; }}
  .pill[aria-pressed="true"] {{ background: var(--accent); border-color: var(--accent); color: #fff; }}
  .vol {{ margin-left: auto; display: flex; align-items: center; gap: 6px; color: var(--text2); }}
  .vol input {{ width: 90px; accent-color: var(--accent); }}
  .tracks {{ list-style: none; margin: 0; padding: 6px; }}
  .tracks li {{ display: grid; grid-template-columns: 28px 1fr 1fr 48px; align-items: center; gap: 8px; padding: 7px 10px; border-radius: 6px; }}
  .tracks li:nth-child(even) {{ background: rgba(127,127,127,.06); }}
  .tracks li:hover {{ background: var(--line); }}
  .tracks li.on {{ background: var(--accent); color: #fff; }}
  .tracks li.on .g, .tracks li.on .n, .tracks li.on .d {{ color: rgba(255,255,255,.85); }}
  .tracks .n, .tracks .g, .tracks .d {{ color: var(--text2); }}
  .tracks .n, .tracks .d {{ font-variant-numeric: tabular-nums; }} .tracks .d {{ text-align: right; }}
  .tracks .t {{ font-weight: 500; }}
  @media (max-width: 860px) {{ .grid {{ grid-template-columns: repeat(2, minmax(0, 1fr)); }} }}
</style>
</head>
<body>
  <main>
    <header>
      <div class="logo" role="img" aria-label="Cole's Games"><span class="l1">Cole's</span><span class="l2">Games</span></div>
      <div class="rainbow"></div>
      <p>Three games from coleswebsite.xyz. Your progress saves on <span id="thisComputer">this Mac</span>.</p>
    </header>
    <h3 class="section">Games</h3>
    <div class="grid">{CARDS}
    </div>
    <h3 class="section" id="music">Music</h3>
    <section class="player" aria-label="Game music">
      <div class="now">
        <img class="cover" src="/music/cover-256.png" alt="" width="128" height="128">
        <div class="meta">
          <div class="np-title" id="npTitle">Pick a song</div>
          <div class="np-game" id="npGame">Every song from the games</div>
          <div class="bar"><span id="npTime">0:00</span><input type="range" id="npSeek" min="0" max="1000" value="0" aria-label="Position"><span id="npLen">0:00</span></div>
          <div class="ctrls">
            <button class="ib" id="npPrev" aria-label="Previous">&#9198;&#xFE0E;</button>
            <button class="ib big" id="npPlay" aria-label="Play">&#9654;&#xFE0E;</button>
            <button class="ib" id="npNext" aria-label="Next">&#9197;&#xFE0E;</button>
            <button class="pill" id="npLoop" aria-pressed="false">Repeat One</button>
            <label class="vol"><span aria-hidden="true">&#128264;&#xFE0E;</span><input type="range" id="npVol" min="0" max="100" value="80" aria-label="Volume"></label>
          </div>
        </div>
      </div>
      <ol class="tracks" id="npList"></ol>
    </section>
    <audio id="npAudio" preload="none"></audio>
    <footer>&copy; 2023 - 2026 coleswebsite.xyz</footer>
  </main>
<script src="/konami.js?v=3" defer></script>
<script>
document.addEventListener("contextmenu", function (e) {{ e.preventDefault(); }});
(function () {{
  var mac = /Mac OS X|Macintosh/.test(navigator.userAgent);
  if (!mac) {{
    document.body.classList.add(/Windows/.test(navigator.userAgent) ? "win" : "linux");
    [].forEach.call(document.querySelectorAll("kbd"), function (k) {{ k.textContent = k.textContent.replace("\u2318", "Ctrl+"); }});
    document.getElementById("thisComputer").textContent = /Windows/.test(navigator.userAgent) ? "this PC" : "this computer";
  }}
  var d = window.cgDesktop;
  if (d && d.accent) document.documentElement.style.setProperty("--accent", d.accent);
}})();
(function () {{
  // the jukebox cuts of every game song: the loop, then a gentle fade out. Repeat One loops without the fade.
  var PAD = 0.5, TAIL = 7;
  var T = [
    {{ title: "Lucky Lounge", game: "Blackjack DX", src: "/music/tracks/lucky-lounge.mp3",     loop: 32 * 4 * 60 / 90 }},
    {{ title: "On Fire",      game: "Blackjack DX", src: "/music/tracks/on-fire.mp3",          loop: 32 * 4 * 60 / 150 }},
    {{ title: "All In",       game: "Blackjack DX", src: "/music/tracks/all-in.mp3",           loop: 32 * 4 * 60 / 128 }},
    {{ title: "Main Theme",   game: "Lines DX",     src: "/music/tracks/lines-main-theme.mp3", loop: 64 * 60 / 132 }},
    {{ title: "Hard Mode",    game: "Lines DX",     src: "/music/tracks/lines-hard-mode.mp3",  loop: 64 * 60 / 96 }},
    {{ title: "The Shop",     game: "Lines DX",     src: "/music/tracks/lines-the-shop.mp3",   loop: 64 * 60 / 104 }},
    {{ title: "Lucky Flip",   game: "Lucky Flip",   src: "/music/tracks/lucky-flip.mp3",       loop: 64 * 60 / 150 }}
  ];
  var $ = function (id) {{ return document.getElementById(id); }};
  var a = $("npAudio"), list = $("npList"), seek = $("npSeek"), cur = -1, repeat = false, seeking = false;
  function fmt(s) {{ s = Math.max(0, Math.floor(s)); return Math.floor(s / 60) + ":" + ("0" + s % 60).slice(-2); }}
  function len(t) {{ return repeat ? t.loop : t.loop + TAIL; }}
  T.forEach(function (t, i) {{
    var li = document.createElement("li");
    li.innerHTML = '<span class="n">' + (i + 1) + '</span><span class="t"></span><span class="g"></span><span class="d">' + fmt(t.loop + TAIL) + '</span>';
    li.children[1].textContent = t.title; li.children[2].textContent = t.game;
    li.addEventListener("click", function () {{ if (i === cur) toggle(); else play(i); }});
    list.appendChild(li);
  }});
  function paint() {{
    var t = T[cur], on = cur >= 0 && !a.paused;
    $("npTitle").textContent = t ? t.title : "Pick a song";
    $("npGame").textContent = t ? t.game : "Every song from the games";
    $("npPlay").innerHTML = on ? "&#9208;&#xFE0E;" : "&#9654;&#xFE0E;";
    $("npPlay").setAttribute("aria-label", on ? "Pause" : "Play");
    [].forEach.call(list.children, function (li, i) {{ li.classList.toggle("on", i === cur); }});
  }}
  function play(i) {{
    cur = (i + T.length) % T.length;
    var t = T[cur];
    a.src = t.src;
    a.addEventListener("loadedmetadata", function go() {{ a.removeEventListener("loadedmetadata", go); try {{ a.currentTime = PAD; }} catch (e) {{}} a.play().catch(function () {{}}); }});
    a.load();
    $("npLen").textContent = fmt(len(t));
    if ("mediaSession" in navigator) try {{
      navigator.mediaSession.metadata = new MediaMetadata({{ title: t.title, artist: t.game, album: "Cole's Games",
        artwork: [{{ src: "/music/cover-512.png", sizes: "512x512", type: "image/png" }}] }});
    }} catch (e) {{}}
    paint();
  }}
  function toggle() {{ if (cur < 0) {{ play(0); return; }} if (a.paused) a.play().catch(function () {{}}); else a.pause(); }}
  $("npPlay").addEventListener("click", toggle);
  $("npNext").addEventListener("click", function () {{ play(cur + 1); }});
  $("npPrev").addEventListener("click", function () {{ if (cur >= 0 && a.currentTime - PAD > 3) a.currentTime = PAD; else play(cur < 0 ? 0 : cur - 1); }});
  $("npLoop").addEventListener("click", function () {{
    repeat = !repeat; this.setAttribute("aria-pressed", repeat); if (cur >= 0) $("npLen").textContent = fmt(len(T[cur]));
  }});
  $("npVol").addEventListener("input", function () {{ a.volume = this.value / 100; }});
  a.volume = 0.8;
  seek.addEventListener("input", function () {{ seeking = true; }});
  seek.addEventListener("change", function () {{ seeking = false; if (cur >= 0) a.currentTime = PAD + seek.value / 1000 * len(T[cur]); }});
  a.addEventListener("timeupdate", function () {{
    if (cur < 0) return;
    var t = T[cur], now = a.currentTime;
    // Repeat One: jump back at the loop point (the second after it holds the top of the song again, so it's seamless)
    if (repeat && now >= PAD + t.loop && now < PAD + t.loop + 1) {{ a.currentTime = now - t.loop; return; }}
    var pos = Math.min(len(t), Math.max(0, now - PAD));
    $("npTime").textContent = fmt(pos);
    if (!seeking) seek.value = Math.round(pos / len(t) * 1000);
  }});
  a.addEventListener("ended", function () {{ if (repeat) {{ a.currentTime = PAD; a.play().catch(function () {{}}); }} else play(cur + 1); }});
  ["play", "pause"].forEach(function (e) {{ a.addEventListener(e, paint); }});
  if ("mediaSession" in navigator) try {{
    navigator.mediaSession.setActionHandler("play", function () {{ a.play(); }});
    navigator.mediaSession.setActionHandler("pause", function () {{ a.pause(); }});
    navigator.mediaSession.setActionHandler("nexttrack", function () {{ play(cur + 1); }});
    navigator.mediaSession.setActionHandler("previoustrack", function () {{ play(cur - 1); }});
  }} catch (e) {{}}
  // Music in the toolbar or menu bar jumps here, even when the launcher is already showing
  function toMusic() {{ if (location.hash === "#music") $("music").scrollIntoView({{ behavior: "smooth", block: "start" }}); }}
  window.addEventListener("hashchange", toMusic);
  if (location.hash === "#music") $("music").scrollIntoView();
  paint();
}})();
</script>
</body>
</html>
'''
open(os.path.join(out, "index.html"), "w", encoding="utf-8").write(LAUNCHER)
total = sum(os.path.getsize(os.path.join(d, f)) for d, _, fs in os.walk(out) for f in fs)
print("bundle:", out, "%.1f MB" % (total / 1e6))
