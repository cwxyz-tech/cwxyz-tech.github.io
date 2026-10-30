#!/bin/sh
# Adds Cole's Games to your app menu (no admin needed). Run it again after moving this folder.
set -e
DIR=$(dirname "$(readlink -f "$0")")
APPS="${XDG_DATA_HOME:-$HOME/.local/share}/applications"
ICONS="${XDG_DATA_HOME:-$HOME/.local/share}/icons/hicolor"
mkdir -p "$APPS" "$ICONS/512x512/apps" "$ICONS/256x256/apps"
cp "$DIR/resources/app/icons/coles-games-512.png" "$ICONS/512x512/apps/coles-games.png"
cp "$DIR/resources/app/icons/coles-games-256.png" "$ICONS/256x256/apps/coles-games.png"
cat > "$APPS/coles-games.desktop" <<DESKTOP
[Desktop Entry]
Type=Application
Name=Cole's Games
Comment=Blackjack DX, Lines DX and Lucky Flip from coleswebsite.xyz
Exec="$DIR/start.sh" %U
Icon=coles-games
Terminal=false
Categories=Game;CardGame;BlocksGame;
StartupWMClass=Cole's Games
DESKTOP
chmod +x "$APPS/coles-games.desktop"
command -v update-desktop-database >/dev/null 2>&1 && update-desktop-database "$APPS" >/dev/null 2>&1 || true
command -v gtk-update-icon-cache >/dev/null 2>&1 && gtk-update-icon-cache -q "$ICONS" >/dev/null 2>&1 || true
echo "Cole's Games is in your app menu now."
echo ""
echo "Optional: to turn on Chromium's full security sandbox, run this once (asks for your password):"
echo "    sudo chown root:root \"$DIR/chrome-sandbox\" && sudo chmod 4755 \"$DIR/chrome-sandbox\""
