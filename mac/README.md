# DuckFly for macOS

A standalone Apple Silicon Mac app containing the same experiment workspace as the web app. AppKit provides the window and native file dialogs; WKWebView runs bundled Three.js and WASM engines. The app starts a private read-only HTTP asset server bound to `127.0.0.1` on an automatically assigned port. No external website or simulation service is needed.

## Build and open

Requires Node 22.12+ and Xcode Command Line Tools on the development machine.

```sh
# From repository root:
./mac/scripts/build.sh
open mac/build/DuckFly.app
```

The signed local build is written to `mac/build/DuckFly.app`. It contains its web assets and engines. Copy it to `~/Applications` to use it independently of the checkout. It is an Apple Silicon build targeting macOS 14+, signed locally rather than notarized for public distribution.

All experiment controls are documented in the [root README](../README.md). Native **Save/Open** use macOS file dialogs. The latest scene is retained in the app's preferences. **Enable webcam** requests camera access after an explicit click; **Stop webcam** releases all tracks. The native permission delegate permits camera requests only from the app's own main frame and denies microphone capture.

## Verification

```sh
mac/build/DuckFly.app/Contents/MacOS/DuckFly --self-test
```

The packaged self-test launches the actual WKWebView and drives the bundled workspace. It uses a nonpersistent data store and does not alter the user's saved scene. Camera checks use a denied stub and synthetic canvas stream; they do not activate the physical camera. Test receipts and visual review are tracked in `docs/implementation/`.

`Host/main.swift` implements the shell, origin restrictions and native downloads. `Tests/workspace-smoke.js` supplies native workspace acceptance checks. `scripts/build-lab.sh` builds the web workspace into a staging app, verifies its signature and replaces the destination bundle.

## Retained native reference implementation

The original SwiftUI/RealityKit app and private Python physics worker remain in `App/`, `Engine/` and `ThirdParty/` for model parity work. They are not bundled in the experiment workspace. To build that reference app, install `uv` and run:

```sh
./mac/scripts/build-reference.sh
open mac/build/DuckFlyReference.app
```

This prepares the private Python 3.12 environment under `mac/.build/python/`. The reference engine checks can then run with:

```sh
mac/.build/python/cpython-3.12.9-macos-aarch64-none/bin/python3.12 mac/Tests/test_engine.py
```

See [source and data terms](../THIRD_PARTY_NOTICES.md). The included FlyWire data requires noncommercial use with attribution. Neural and body adapters are model assumptions, not biological validation or physical robot release evidence.
