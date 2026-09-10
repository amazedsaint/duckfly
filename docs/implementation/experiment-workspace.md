# DuckFly experiment workspace: acceptance ledger

Objective: compact, streamlined experiment UI in the standalone Mac app and web app, with all sixteen proposed experiment features. Controls alone do not prove completion.

## Current state

The workspace is implemented and deployed to `https://duckfly.vercel.app` in `contextmind`. The standalone app is installed at `/Users/madhusudanaa/Applications/DuckFly.app` and has been opened and visually inspected. Native Save/Open dialogs have now been exercised through CUA, with valid files inspected and the original scene restored. All scoped feature requirements have supporting runtime or UI evidence below.

All 25 shared engine checks pass. The native WKWebView smoke exercises camera-driven behavior, scene edits, recording serialization/import and isolated comparison/learning batches. The published browser version passes its own interaction and collaboration checks.

## Shared architecture

`mac/` contains the AppKit/WebKit host and standalone packaging. `web/` contains the common experiment UI and runtime. `shared/` contains attributed data and physical model assets. The Mac host serves only bundled assets on a private loopback origin. No Python installation or public simulation backend is required by the workspace.

One MuJoCo world owns all physical ducks and props. Each duck has independent neural state, random state, policy history and BAM state. Vision uses actual head-camera pixels. World coordinates are used for physical simulation, scoring and explicitly modeled scalar fields, not visual object detections.

## Requirement-by-requirement evidence

| ID | Requirement | Evidence inspected | Status |
| --- | --- | --- | --- |
| UI | Compact workspace on desktop and web, with responsive layout | Mac screenshot inspected through CUA; published desktop and 390 px browser screenshots in `output/playwright/lab-desktop.png` and `lab-mobile.png`; browser no-overflow assertion | Verified |
| 1 | Duck-eye camera attached to the physical head, pixels into encoder | `lab-tests.log` physical camera rotation; rendered target approach in `browser-production.log` and `mac-workspace-receipt.json` | Verified |
| 2 | Explicit webcam enable/stop, local visual encoding, denied state | `browser-vision.log`; native denied/synthetic MediaStream tests and track shutdown in `mac-workspace-receipt.json` | Verified with synthetic camera; physical camera was not activated |
| 3 | Visual expansion causes a neural stop, intervention changes response | Rendered threat at ~0.42 s in native/browser receipts; independently expanding image and Giant Fiber ablation in `vision.test.mjs` / `lab-tests.log` | Verified |
| 4 | Pixel-based target following and genuine occlusion | Published camera-driven approach x=0.661 m at ~6 s; wall removes target detection and forward intent; native equivalent passes | Verified |
| 5 | Add/edit/remove physical props, mass/friction, current-run moves and saved scenes | `browser-portability.log`, `browser-drag.log`, native prop edit receipt; measured mass acceleration and sliding response in `lab-tests.log` | Verified, including native file-dialog round trip |
| 6 | Real optical flow, overlay and steering option | Independently translated image and asymmetric-flow steering test in `vision.test.mjs`; camera/flow overlay visually inspected on both platforms | Verified |
| 7 | Independent ducks in one world with real contact | Actual inter-duck contacts and separate action histories in `lab.test.mjs`; three independent cameras/bodies in published and native receipts | Verified |
| 8 | Local companion following and spacing experiment | Camera-visible cyan companion markers; follower movement measured in `browser-production.log`; native companion vision receipt | Verified as an explicit modeled social controller |
| 9 | Active looking with bounded physical head commands and target-loss search | Physical joint moved from -0.0097 to +0.2307 rad with <1 degree tilt; camera orientation changed. Target-loss search and head range tested separately; browser checkbox flow exercised | Verified; no claim of optimal gaze behavior |
| 10 | Editable light and odor fields | Browser/native matched strength 0 vs 3 changes neural input. Light reads rendered brightness; odor reads modeled scalar gradient | Verified |
| 11 | Same-tick causal inspector and recorded event selection | Browser/native inspector tick matches physical/brain state; rewind/import publishes retained causal events and matching recorded frames | Verified |
| 12 | Full brain/body/RNG checkpoint, deterministic rewind and changed-cue branch; export/import | Exact JSON continuation in `lab-tests.log`; browser real download/import preserves body and agents; native blob serialization/import passes. Moving a prop between camera sample ticks is covered | Verified, including native file dialogs |
| 13 | Neural silencing and eye covering; isolated matched comparisons | Eye/output checks in both runtimes; GF causal ablation; comparison reports with matched seeds and placements in independent trial worlds | Verified for bounded target trials |
| 14 | Challenge scoring, reproducible scenes and malformed-input rejection | Physical ball goal and duration stop in browser/native receipts; scene file/share URL round trip and invalid-file preservation in `browser-portability.log` | Verified |
| 15 | Actual sensory-adapter search and held-out promotion gate; import/export | `learning-report.json` and native learning report contain training/evaluation trials. Both retained original weights after no gain. Gate tests reject new falls and regressions | Verified as finite parameter search; no improvement claimed |
| 16 | Two-client synchronization, remote edits, ownership and reconnect | `browser-production-room.log` uses independent browser contexts on the deployed site; exact displayed poses, remote prop edit and reconnect pass. `mac-room-self-test.log` verifies native WebKit transport | Verified via authenticated loopback TURN; external-network connectivity not established |
| Mac | Standalone signed package, installed and opened; native file dialogs | `mac-build.log`, signature verification, installed asset parity and CUA window/screenshot; runtime self-tests and `native-file-dialogs.json` pass | Verified |
| Web | Deploy under Contextmind and verify public runtime | `docs/deployments/experiment-deploy.log`, `experiment-inspect.log`, public HTTP hashes and published browser tests | Verified |

## Important corrections found during acceptance

The lightweight editable template now preserves all native physical parameters and collision geometry; its camera points outward through the head. Physical template parity is retained in `lab-template-evidence.json`.

MuJoCo's WebAssembly state getter did not populate the supplied output array. Checkpoints now retain the complete integration state explicitly and reconstruct the final substep's sensor/constraint caches. This is what makes exact continuation possible, rather than restoring positions alone.

Recording imports preserve pending camera refresh after a prop move. Rewind/import restores the matching camera preview and causal events; replay does not duplicate events. Invalid imports are prepared in a separate candidate experiment so a failure preserves the current world.

Edited prop friction initially lost to the floor's contact parameters. Props now have contact priority so their configured friction takes effect against the floor. With identical initial velocity, the measured low-friction block travels 0.805 m versus 0.138 m for the grippy block. The lighter prop accelerates 20 times farther under the same force in the short suspended-body check. The priority rule follows [MuJoCo contact parameter mixing](https://mujoco.readthedocs.io/en/stable/modeling.html#contact-parameters).

## Reproduce the checks

```sh
npm test --prefix web
npm run build --prefix web
npm run preview --prefix web
./mac/scripts/build.sh
mac/build/DuckFly.app/Contents/MacOS/DuckFly --self-test
```

Browser scripts are Playwright CLI `run-code` functions. Use a named browser session at the local preview or published URL. The bundled Playwright wrapper did not provide its CLI in this environment; the working invocation is `npx --yes --package @playwright/cli playwright-cli`.

Collaboration acceptance used a disposable relay restricted to loopback. It is not an application dependency or a production service:

```sh
npm install --prefix /tmp/duckfly-turn-check --no-save --ignore-scripts node-turn@0.0.6
NODE_PATH=/tmp/duckfly-turn-check/node_modules node web/tests/turn-fixture.cjs
# In another terminal:
mac/build/DuckFly.app/Contents/MacOS/DuckFly --self-test-room
```

Run `web/tests/browser-room.js` through Playwright on the chosen site for independent-context pairing, edits and reconnect. Stop the relay after testing. A direct connection failed on this managed Mac, so relay verification must not be described as proof that every network connects without configuration.

## Claim boundaries

This is a selected 668-neuron circuit with modeled sensory tuning and a separately trained biped walking policy. Companion behavior is driven by explicit visual markers and spacing rules. The adapter learner searches a small parameter set, with fixed held-out placements. These experiments do not establish biological validity, generalized learning, connectome superiority or physical-robot readiness.

Synthetic webcam tests verify frame processing and shutdown without reading the user's physical camera. Native automated payload tests substitute the download sink and feed a File object through the real import handler. A separate CUA acceptance pass exercised the actual NSSavePanel and NSOpenPanel, inspected the saved JSON, loaded a recorded run and a scene fixture, then restored the original scene. See `native-file-dialogs.json`.

## Final consistency audit

The final audit matched the current source hashes to `release-manifest.json`, compared all 29 web output files with the installed Mac bundle, verified its code signature, and compared the public HTML and hashed JavaScript/CSS bundles with the local build. The retained 25-test engine result, 14 native workspace receipts, native room test and published browser receipts were inspected against the requirement rows above. No required implementation or acceptance item remains open. The scientific and network limits stated above remain part of the delivered behavior.
