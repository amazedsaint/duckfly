#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")/.."
MAC_ROOT="$PWD"
DEST="${DUCKFLY_APP_DEST:-$MAC_ROOT/build/DuckFly.app}"
mkdir -p "$MAC_ROOT/build"
STAGE="$(mktemp -d "$MAC_ROOT/build/.duckfly-stage.XXXXXX")"
trap 'rm -rf "$STAGE"' EXIT
APP="$STAGE/DuckFly.app"
npm run build --prefix ../web
mkdir -p "$APP/Contents/MacOS" "$APP/Contents/Resources/Web" "$MAC_ROOT/.build/swift-cache"
rsync -a --delete --exclude assets/Simulation/microduck.mjb.gz ../web/dist/ "$APP/Contents/Resources/Web/"
cp AppIcon.icns "$APP/Contents/Resources/"
cp Tests/setup-helpers.js "$APP/Contents/Resources/SetupHelpers.js"
cp Tests/setup-smoke.js "$APP/Contents/Resources/SetupSmoke.js"
cp Tests/skills-smoke.js "$APP/Contents/Resources/SkillsSmoke.js"
cp Tests/scenario-audit.js "$APP/Contents/Resources/ScenarioAudit.js"
cp Tests/guided-smoke.js "$APP/Contents/Resources/GuidedSmoke.js"
cp Tests/playground-smoke.js "$APP/Contents/Resources/PlaygroundSmoke.js"
cp Tests/workspace-smoke.js "$APP/Contents/Resources/NativeSmoke.js"
cp Tests/vision-smoke.js "$APP/Contents/Resources/VisionSmoke.js"
cp Tests/room-smoke.js "$APP/Contents/Resources/RoomSmoke.js"
cat > "$APP/Contents/Info.plist" <<'PLIST'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
<key>CFBundleExecutable</key><string>DuckFly</string>
<key>CFBundleIdentifier</key><string>org.duckfly.app</string>
<key>CFBundleName</key><string>DuckFly</string>
<key>CFBundleDisplayName</key><string>DuckFly</string>
<key>CFBundleIconFile</key><string>AppIcon</string>
<key>CFBundlePackageType</key><string>APPL</string>
<key>CFBundleShortVersionString</key><string>0.9.0</string>
<key>CFBundleVersion</key><string>9</string>
<key>LSMinimumSystemVersion</key><string>14.0</string>
<key>NSHighResolutionCapable</key><true/>
<key>NSCameraUsageDescription</key><string>Use your camera as a local sensory input for the duck experiment. Frames are not uploaded.</string>
<key>NSAppTransportSecurity</key><dict><key>NSAllowsLocalNetworking</key><true/></dict>
<key>NSHumanReadableCopyright</key><string>DuckFly experimental simulator. Separately licensed Microduck, DesktopFly and FlyWire assets.</string>
</dict></plist>
PLIST
xcrun swiftc -O -swift-version 5 -target arm64-apple-macosx14.0 -module-cache-path "$MAC_ROOT/.build/swift-cache" \
  Host/*.swift -o "$APP/Contents/MacOS/DuckFly" -framework AppKit -framework WebKit -framework Network
codesign --force --deep --sign - "$APP"
codesign --verify --deep --strict "$APP"
mkdir -p "$DEST"
rsync -a --delete "$APP/" "$DEST/"
codesign --verify --deep --strict "$DEST"
printf 'Built %s\n' "$DEST"
