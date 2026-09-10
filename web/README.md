# DuckFly experiment workspace

The browser app and native Mac package share this UI and runtime. Production output is a static site with local computation, built by Vite. There are no server functions or required environment variables.

```sh
npm ci
npm run dev
npm run build
npm run preview
npm test
```

Development uses port 5173 and production preview uses port 4173. Build copies attributed assets from `../shared/` into generated `public/` folders, then creates `dist/`. Deploy from the repository root using `vercel.json`.

## Runtime map

- `src/main.js` and `src/style.css`: compact scene tree, arena and inspector; responsive layout; recording, comparison and collaboration controls.
- `src/lab/lab.worker.js`: serialized commands and fixed simulation ticks. Each tick advances 20 neural milliseconds and four 5 ms physical steps. Slow machines run slower in wall time without skipping physical steps. Background tabs pause except while hosting a room or running a batch.
- `src/lab/experiment.js`: one shared world with independent per-duck circuits, sensory state and reproducible random sources; complete checkpoints and recorded camera inputs.
- `src/lab/lab-world.js`: compiles the editable MJCF template into a shared MuJoCo model. Ducks and movable props physically collide. State restoration includes MuJoCo integration history and controller memory.
- `src/lab/lab-arena.js` and `vision.js`: actual head-camera rendering, color detections, block-matched optical flow and looming. Only image-derived detections feed visual control. Odor fields use an explicitly modeled scalar gradient; light seeking reads rendered brightness.
- `src/brain.js`, `world.js` and `bam.js`: selected DesktopFly circuit, the original 61-observation/14-action walking-policy contract and BAM motor response. Per-duck controller state is independent.
- `src/lab/benchmarks.js`: isolated matched comparisons and a finite sensory-weight search with held-out acceptance gates.
- `src/lab/room.js`: one host and one guest over encrypted WebRTC data channels, explicit invitation/reply pairing, chunked snapshots and host ownership of time.

The normal runtime loads the approximately 4.9 MB compressed physical template, reuses collision meshes across ducks and loads the pinned ONNX policy. The old 32 MB compiled reference model stays outside the deployed output. Runtime versions are locked in `package-lock.json`; all engine files are served from the app origin.

## Experiments and limits

Scenes support up to eight ducks, forty physical props and sixteen sensory fields. Rendering and inference cost grow with the number of ducks. The camera encoder samples 96 × 64 images at 10 simulated frames per second. Active head commands are bounded within the supported walking-policy inputs. Colored companion markers make the modeled social cue explicit.

Recordings retain recent checkpoints; their time window shrinks with duck count to limit memory. Saved recordings contain low-resolution camera pixels, including webcam input when enabled. Scene sharing includes only scene parameters and the seed. Peer collaboration sends poses and derived signals, without camera frames.

Manual WebRTC pairing works without a signaling backend. Restricted networks may need an authenticated TURN server entered by the user. A local TURN relay has been exercised with independent browser contexts; cross-network behavior and a hosted relay are not included in that evidence.

Requires WebGL2, WebAssembly SIMD, module workers and `DecompressionStream`. Chromium and the Mac WKWebView are the acceptance targets. Narrow-layout checks do not prove performance on every phone/GPU. Engines use single-threaded WASM and do not require SharedArrayBuffer or cross-origin isolation.

## Validation and model regeneration

`npm test` runs the actual WASM physics and ONNX policy, including independent Python reference vectors, physical head movement, real inter-duck contacts, exact replay and pixel-encoder controls. Browser acceptance scripts in `tests/browser-*.js` are functions for Playwright CLI `run-code`; run the preview first. The current experiment evidence is under `../docs/implementation/`. Older baseline evidence remains under `../docs/validation/web/`.

To regenerate physical templates after changing the source body, use Python 3.12 with the reference engine dependencies:

```sh
# From repository root, after preparing the reference runtime:
mac/.build/python/cpython-3.12.9-macos-aarch64-none/bin/python3.12 web/scripts/export-lab-template.py
npm test --prefix web
```

The exporter retains original physical inertia, collision meshes and motor parameters. It corrects the head camera orientation for outward vision. `lab-template-evidence.json` records parity of the physical model against the native source. Source provenance and licenses are in `../THIRD_PARTY_NOTICES.md`.
