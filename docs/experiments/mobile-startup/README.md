# Mobile startup and graphics recovery

September 13, 2026. Baseline: `f780e236fc785bbab92832cfb66966042de09a7f`.

The reported failure was on phones, including an iPhone 11. The exact iOS
version and on-device error were not available. Current WebKit and an iPhone 11
simulator could open the baseline, so this is not evidence of a universal
Safari incompatibility.

## Reproduced problems

Interrupting the production worker download left the visible AR loading screen
at “Loading the robot model…” without a retry control. The error appeared only
on the hidden home screen. See `worker-failure-baseline.json`.

The AR link eagerly requested 16 home/catalog image files totaling 3,729,875
bytes. The revised entry requests none of these while those pages are hidden.
Runtime loading now overlaps appearance loading. Timings from localhost are
not cellular-network measurements.

The first iOS simulator run reported a shader-allocation exception after it was
ready (`ios-simulator-before-recovery.jsonl`). The revised renderer handles
context loss, pauses the experiment, and offers reload if restoration fails.
An unavailable camera frame is rejected before the experiment advances. It is
not interpreted as a dark image. After restoration, the user presses Run.

## Validation

- All 126 Node tests pass. Asset tests cover stalled downloads, active slow
  streams, cancellation, and the gzip fallback. The compatibility probe checks
  actual WASM SIMD support before requesting large assets.
- WebKit and Chromium pass worker failure/reload, failed main imports and
  asset downloads, unsupported features, and gzip fallback. Their visual
  follower travels about 0.292 m by tick 102 without falling.
- The existing gallery acceptance runs all 18 scenes, including the blank
  scene wizard and customization controls. See `catalog.json`.
- WebKit camera-preview acceptance uses a synthetic video stream. Placement,
  object physics edits and adding a second duck work. Exiting stops the tracks;
  denied permission returns to the studio. See `webkit-camera.json`.
- Both browser engines reject a deliberately lost eye frame at tick 0, then
  resume after graphics restoration with no page errors. See the
  `graphics-recovery*.json` receipts.
- An iPhone 11 simulator on iOS 26.0.1 runs the visual follower and the scent,
  air and touch scenes. Every duck remains upright through at least 150 ticks.
  It recovers from graphics loss and resumes. The WKWebView UA reports iOS
  18.7; the installed simulator runtime is iOS 26.0.1. See
  `ios-simulator-recovery.jsonl`.

The phone display caps pixel ratio at 1.5 and disables display multisampling.
The calibrated eye targets and the physical models retain their original
resolution and parameters. No physical iPhone or Android camera/tracking test
was performed. This release does not establish that every phone is supported.

## Repeating the browser checks

Build with `npm run build --prefix web`, serve the result with Vite preview,
and open that origin through `playwright-cli` using WebKit and the iPhone 11
device descriptor. Run `experiments/mobile-startup/browser.js` and
`graphics-browser.js` using `run-code --filename`. The scripts use the current
page's origin. The existing camera and catalog scripts are under
`experiments/ar/` and `experiments/sensory-inputs/`.

For the simulator probe, generate the Xcode project from
`experiments/mobile-startup/ios-probe/project.yml` with XcodeGen. Build for the
iOS simulator, install it on a dedicated device, and launch
`com.duckfly.diagnostics.probe` with the full test URL as its argument. Add
`?ar=1&probe=1` to exercise scenes and graphics recovery. Read
`Documents/probe.jsonl` from the app's simulator data container. This is a
diagnostic app, not a new product target.
