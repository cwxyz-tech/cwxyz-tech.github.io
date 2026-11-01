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
Comment=Blackjack DX, Lines DX, Lucky Flip and Sky Glider from coleswebsite.xyz
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

# Chromium's security sandbox: on some distros it only works once its helper is owned by root.
SB="$DIR/chrome-sandbox"
if [ -f "$SB" ] && { [ "$(stat -c %u "$SB" 2>/dev/null)" != "0" ] || [ ! -u "$SB" ]; }; then
  echo ""
  echo "Recommended: turn on Chromium's security sandbox. This needs your password once."
  if [ -t 0 ]; then
    printf "Set it up now? [Y/n] "
    read -r ans
    case "$ans" in
      n|N|no|NO) echo "Skipped. You can run this later:";
                 echo "    sudo chown root:root \"$SB\" && sudo chmod 4755 \"$SB\"" ;;
      *) if sudo chown root:root "$SB" && sudo chmod 4755 "$SB"; then echo "Sandbox is on."; else echo "Couldn't set it up. You can try again later with the command above."; fi ;;
    esac
  else
    echo "    sudo chown root:root \"$SB\" && sudo chmod 4755 \"$SB\""
  fi
fi
