#!/bin/sh
# Starts Cole's Games. Works from anywhere, and from the app menu after ./install.sh.
DIR=$(dirname "$(readlink -f "$0")")
EXTRA=""
# Chromium's security sandbox needs either user namespaces or a setup helper owned by root.
# Some distros (like Ubuntu 24.04) block the first and the download can't ship the second,
# so in that case the app starts without it. (install.sh can set the helper up properly.)
if [ "$(stat -c %u "$DIR/chrome-sandbox" 2>/dev/null)" != "0" ] || [ ! -u "$DIR/chrome-sandbox" ]; then
  if [ "$(cat /proc/sys/kernel/apparmor_restrict_unprivileged_userns 2>/dev/null)" = "1" ] || \
     [ "$(cat /proc/sys/kernel/unprivileged_userns_clone 2>/dev/null)" = "0" ]; then
    EXTRA="--no-sandbox"
  fi
fi
exec "$DIR/coles-games" $EXTRA "$@"
