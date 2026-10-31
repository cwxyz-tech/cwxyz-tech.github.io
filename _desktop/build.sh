#!/bin/bash
# Builds the Cole's Games downloads (Windows, Linux, Mac) from this repository.
# Runs on GitHub's servers when a version tag is pushed (see .github/workflows/desktop-release.yml),
# and works the same on any Linux machine with python3, curl, unzip, zip and tar.
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
SITE="$(cd "$HERE/.." && pwd)"
OUT="$HERE/out"
ELECTRON=v45.1.0
# official checksums from Electron's SHASUMS256.txt for this version: any other file is refused
SHA_WIN=55eaba17abff7b5bba6c3bbc85068967379024fe742fe9c7fdba9118922ccbe2
SHA_LINUX=9dafab2c57ce209f8f716f8f3e4fddd8ffe0820e2455bfbbfc00b0fc13e03a3b
STAMP="2026-10-30 00:00:00 UTC"   # every file gets the same date, so builds don't record when or where they ran

rm -rf "$OUT" && mkdir -p "$OUT/dl" "$OUT/release"

echo "== games"
python3 "$HERE/tools/build_www.py" "$SITE" "$OUT/www"

echo "== electron $ELECTRON"
for p in win32-x64 linux-x64; do
  curl -fsSL --retry 3 -o "$OUT/dl/$p.zip" "https://github.com/electron/electron/releases/download/$ELECTRON/electron-$ELECTRON-$p.zip"
done
echo "$SHA_WIN  $OUT/dl/win32-x64.zip" | sha256sum -c -
echo "$SHA_LINUX  $OUT/dl/linux-x64.zip" | sha256sum -c -

app_into() {   # copies the app and the games into an Electron folder
  rm -f "$1/resources/default_app.asar"
  (cd "$1/locales" && ls | grep -v -x "en-US.pak" | xargs -r rm -f)
  cp -r "$HERE/app" "$1/resources/app"
  cp -r "$OUT/www" "$1/resources/app/www"
}

echo "== windows"
W="$OUT/windows/Cole's Games"
mkdir -p "$W" && unzip -q "$OUT/dl/win32-x64.zip" -d "$W"
python3 "$HERE/tools/fuses.py" "$W/electron.exe"
python3 "$HERE/tools/pe_resources.py" "$W/electron.exe" "$W/Cole's Games.exe" "$HERE/tools/app.res"
rm "$W/electron.exe"
app_into "$W"
cp "$HERE/windows/README.txt" "$OUT/windows/README.txt"

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
find "$OUT/windows" "$OUT/linux" "$OUT/mac" -exec touch -h -d "$STAMP" {} +
# files go into the zips in name order (not the disk's order), so every machine makes the exact same zip
(cd "$OUT/windows" && find README.txt "Cole's Games" | LC_ALL=C sort | zip -qX -9 -@ "$OUT/release/Coles-Games-Windows.zip")
(cd "$OUT/mac" && find ColesGames | LC_ALL=C sort | zip -qX -9 -@ "$OUT/release/Coles-Games-macOS.zip")
(cd "$OUT/linux" && tar --owner=0 --group=0 --numeric-owner --mtime="$STAMP" --sort=name -cf - README.txt "Cole's Games" \
  | gzip -9 -n > "$OUT/release/Coles-Games-Linux.tar.gz")
(cd "$OUT/release" && sha256sum Coles-Games-* > SHA256SUMS.txt && cat SHA256SUMS.txt && ls -la)
