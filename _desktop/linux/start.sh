#!/bin/sh
# Starts Cole's Games. Works from anywhere, and from the app menu after ./install.sh.
DIR=$(dirname "$(readlink -f "$0")")
EXTRA=""
# Chromium's security sandbox is always on when this computer allows it.
# It needs either user namespaces or a setup helper owned by root. Some distros (like Ubuntu 24.04)
# block the first, and a download can't ship the second, so ONLY in that case the app starts without it,
# says so here and in a one-time notice in the app. Run ./install.sh (answer yes) to turn the sandbox on for good.
# To refuse to start without it instead, run:  COLESGAMES_REQUIRE_SANDBOX=1 ./start.sh
if [ "$(stat -c %u "$DIR/chrome-sandbox" 2>/dev/null)" != "0" ] || [ ! -u "$DIR/chrome-sandbox" ]; then
  if [ "$(cat /proc/sys/kernel/apparmor_restrict_unprivileged_userns 2>/dev/null)" = "1" ] || \
     [ "$(cat /proc/sys/kernel/unprivileged_userns_clone 2>/dev/null)" = "0" ]; then
    if [ "${COLESGAMES_REQUIRE_SANDBOX:-0}" = "1" ]; then
      echo "Cole's Games: the security sandbox isn't available on this computer, so it won't start (COLESGAMES_REQUIRE_SANDBOX=1)." >&2
      echo "Turn it on with:  sudo chown root:root \"$DIR/chrome-sandbox\" && sudo chmod 4755 \"$DIR/chrome-sandbox\"" >&2
      exit 1
    fi
    echo "Cole's Games: WARNING: starting WITHOUT Chromium's security sandbox (this computer blocks it)." >&2
    echo "  Turn it on with:  sudo chown root:root \"$DIR/chrome-sandbox\" && sudo chmod 4755 \"$DIR/chrome-sandbox\"" >&2
    EXTRA="--no-sandbox"
  fi
fi
exec "$DIR/coles-games" $EXTRA "$@"
