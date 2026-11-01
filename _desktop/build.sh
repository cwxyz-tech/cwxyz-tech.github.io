#!/bin/bash
# Builds the Cole's Games downloads (Linux, Mac) from this repository.
# Runs on GitHub's servers when a version tag is pushed (see .github/workflows/desktop-release.yml),
# and works the same on any Linux machine with python3, curl, unzip, zip and tar.
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
SITE="$(cd "$HERE/.." && pwd)"
OUT="$HERE/out"
ELECTRON=v45.2.1
# official checksums from Electron's SHASUMS256.txt for this version: any other file is refused
SHA_LINUX=616efc1ae4784af1a4f3f0e8774e73e7030e7bd1708da9d09bcf543dfa499beb
STAMP="2026-10-30 00:00:00 UTC"   # every file gets the same date, so builds don't record when or where they ran

rm -rf "$OUT" && mkdir -p "$OUT/dl" "$OUT/release"

echo "== games"
python3 "$HERE/tools/build_www.py" "$SITE" "$OUT/www"

echo "== electron $ELECTRON"
for p in linux-x64; do
  curl -fsSL --retry 3 -o "$OUT/dl/$p.zip" "https://github.com/electron/electron/releases/download/$ELECTRON/electron-$ELECTRON-$p.zip"
done
echo "$SHA_LINUX  $OUT/dl/linux-x64.zip" | sha256sum -c -

app_into() {   # copies the app and the games into an Electron folder
  rm -f "$1/resources/default_app.asar"
  (cd "$1/locales" && ls | grep -v -x "en-US.pak" | xargs -r rm -f)
  cp -r "$HERE/app" "$1/resources/app"
  cp -r "$OUT/www" "$1/resources/app/www"
}

echo "== linux"
L="$OUT/linux/Cole's Games"
mkdir -p "$L" && unzip -q "$OUT/dl/linux-x64.zip" -d "$L"
mv "$L/electron" "$L/coles-games"
python3 "$HERE/tools/fuses.py" "$L/coles-games"
app_into "$L"
cp "$HERE/linux/start.sh" "$HERE/linux/install.sh" "$L/"
chmod 755 "$L/coles-games" "$L/start.sh" "$L/install.sh"
cp "$HERE/linux/README.txt" "$OUT/linux/README.txt"

echo "== mac"
M="$OUT/mac/ColesGames"
mkdir -p "$OUT/mac" && cp -r "$HERE/mac/ColesGames" "$M"
cp -r "$OUT/www" "$M/Resources/www"
chmod 755 "$M/build.sh"

echo "== package"
find "$OUT/linux" "$OUT/mac" -exec touch -h -d "$STAMP" {} +
# files go into the zips in name order (not the disk's order), so every machine makes the exact same zip
(cd "$OUT/mac" && find ColesGames | LC_ALL=C sort | zip -qX -9 -@ "$OUT/release/Coles-Games-macOS.zip")
(cd "$OUT/linux" && tar --owner=0 --group=0 --numeric-owner --mtime="$STAMP" --sort=name -cf - README.txt "Cole's Games" \
  | gzip -9 -n > "$OUT/release/Coles-Games-Linux.tar.gz")
(cd "$OUT/release" && sha256sum Coles-Games-* > SHA256SUMS.txt && cat SHA256SUMS.txt && ls -la)
