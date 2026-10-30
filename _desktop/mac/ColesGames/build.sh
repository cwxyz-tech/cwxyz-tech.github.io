#!/bin/bash
# Builds "Cole's Games.app" for Apple silicon Macs.
# Needs only Apple's free Command Line Tools (if they're missing, this tells you how to get them).
set -euo pipefail
cd "$(dirname "$0")"

APP="build/Cole's Games.app"

if ! xcrun --find swiftc >/dev/null 2>&1; then
  echo "Apple's Command Line Tools aren't installed yet."
  echo "Run this, click Install, wait for it to finish, then run ./build.sh again:"
  echo "    xcode-select --install"
  exit 1
fi

echo "Building Cole's Games..."
rm -rf build
mkdir -p "$APP/Contents/MacOS" "$APP/Contents/Resources"

xcrun swiftc -O -swift-version 5 \
  -target arm64-apple-macos13.0 \
  -sdk "$(xcrun --show-sdk-path --sdk macosx)" \
  -framework Cocoa -framework WebKit \
  Sources/main.swift \
  -o "$APP/Contents/MacOS/ColesGames"

cp Info.plist "$APP/Contents/Info.plist"
printf 'APPL????' > "$APP/Contents/PkgInfo"
cp Resources/AppIcon.icns "$APP/Contents/Resources/AppIcon.icns"
cp -R Resources/www "$APP/Contents/Resources/www"

# Apple silicon only runs signed apps; a local ("ad-hoc") signature is enough for your own Mac
codesign --force --deep --sign - "$APP"

echo ""
echo "Done! Your app is at: $(pwd)/$APP"
echo "To install it, drag it into your Applications folder, or run:"
echo "    mv \"$APP\" /Applications/"
open build
