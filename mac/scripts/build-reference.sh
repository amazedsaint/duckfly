#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")/.."
ROOT="$PWD"
ASSETS="$ROOT/../shared/assets"
PYROOT="$ROOT/.build/python/cpython-3.12.9-macos-aarch64-none"
APP="${DUCKFLY_APP_DEST:-$ROOT/build/DuckFlyReference.app}"
if [[ ! -x "$PYROOT/bin/python3.12" ]]; then
  uv python install 3.12.9 --install-dir "$ROOT/.build/python"
fi
if [[ ! -f "$PYROOT/.duckfly-deps" ]] || ! cmp -s Engine/requirements.lock "$PYROOT/.duckfly-deps"; then
  uv pip install --python "$PYROOT/bin/python3.12" --target "$PYROOT/lib/python3.12/site-packages" -r Engine/requirements.lock
  cp Engine/requirements.lock "$PYROOT/.duckfly-deps"
fi
mkdir -p "$APP/Contents/MacOS" "$APP/Contents/Resources"
"$PYROOT/bin/python3.12" Engine/worker.py --resources "$ASSETS" --export-scene "$ASSETS/scene.json" > .build/export.log 2>&1
rsync -a --delete "$ASSETS/" "$APP/Contents/Resources/"
cp AppIcon.icns "$APP/Contents/Resources/"
rsync -a --exclude __pycache__ Engine/ "$APP/Contents/Resources/Engine/"
rsync -a --exclude __pycache__ ThirdParty/ "$APP/Contents/Resources/ThirdParty/"
cp ../THIRD_PARTY_NOTICES.md ../LICENSE "$APP/Contents/Resources/"
rsync -a --exclude __pycache__ "$PYROOT/" "$APP/Contents/Resources/Python/"
cat > "$APP/Contents/Info.plist" <<'PLIST'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
<key>CFBundleExecutable</key><string>DuckFly</string>
<key>CFBundleIdentifier</key><string>org.duckfly.reference</string>
<key>CFBundleName</key><string>DuckFly</string>
<key>CFBundleIconFile</key><string>AppIcon</string>
<key>CFBundleDisplayName</key><string>DuckFly</string>
<key>CFBundlePackageType</key><string>APPL</string>
<key>CFBundleShortVersionString</key><string>0.1.0</string>
<key>CFBundleVersion</key><string>1</string>
<key>LSMinimumSystemVersion</key><string>14.0</string>
<key>NSHighResolutionCapable</key><true/>
<key>NSHumanReadableCopyright</key><string>DuckFly experimental simulator. Includes separately licensed Microduck, DesktopFly and FlyWire assets.</string>
</dict></plist>
PLIST
xcrun swiftc -O -swift-version 5 -target arm64-apple-macosx14.0 -module-cache-path "$ROOT/.build/swift-cache" \
  App/*.swift ThirdParty/DesktopFly/Sim.swift ThirdParty/DesktopFly/Locomotor.swift ThirdParty/DesktopFly/LegDynamics.swift \
  -o "$APP/Contents/MacOS/DuckFly" -framework AppKit -framework SwiftUI -framework RealityKit
codesign --force --deep --sign - "$APP" > .build/codesign.log 2>&1
printf 'Built %s\n' "$APP"
