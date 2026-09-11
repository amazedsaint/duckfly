# AR scenes

Open [Create an AR scene](https://makeduckfly.com/?ar=1), or choose **View in AR** in any experiment. The browser checks which viewing modes it supports before requesting access.

**Surface AR** uses WebXR hit tests to place the experiment on a horizontal floor or table. Aim the placement ring, then choose **Place scene & run**. The scene stays in that reference space as the viewer moves. Objects & placement contains the object tray and physics controls. Display scale changes the presentation, not the simulated robot's dimensions or dynamics.

**Camera preview** shows the simulation over local camera video when surface AR is unavailable. Tap the view to choose a virtual placement point. It has no room tracking: moving the phone does not move the viewpoint around a fixed real-world anchor. The mode label states this while it is running.

The live fly brain stays visible. Add another duck and use the monitor's selector to inspect its independent circuit. Return to the studio to change neural connections or edit sensor settings. Ducks and props keep their current positions when an object is added or its physics changes; the controllers restart. Exiting AR pauses the experiment and returns its stage and monitors to the editor.

## What is simulated

The existing MuJoCo and robot-controller loop remains responsible for movement and contact. Ducks see the virtual scene through their own cameras. The phone camera supplies the background, not neural input. Real furniture is not reconstructed, and virtual objects do not collide with it. The placement plane supplies a visual reference, not a new scanned physics model.

Scent sources and air currents are simulated fields. AR does not give the phone a chemical or wind sensor. Fields can be placed from the object tray and edited in the studio.

Scene format 10 stores an optional `presentation.view: "ar"` preference. Scene sharing preserves the experiment, not a private room scan or a spatial anchor. Every new viewing session requires placement. The app does not record or upload the AR background video. Leaving camera preview stops all of its media tracks.

## Browser support

Surface AR requires a secure context and `immersive-ar` with `hit-test` and `dom-overlay`. The overlay is required so the live controls and brain monitor remain available. A browser can report immersive support and still reject the required features; that failure returns to the mode picker with camera preview available when supported. No browser-name check substitutes for capability detection.

A user must start either mode. Camera denial returns to the studio without losing the scene. Hidden or untracked XR sessions pause the simulation; restoring tracking requires pressing Run. A reference-space reset requires placing the scene again. Hiding camera preview ends its camera session.

## Verification

The retained browser tests use desktop Chrome. **No physical phone or headset was tested.** Tracking quality, battery use and mobile frame rate remain device acceptance checks.

- `web/tests/ar.test.mjs` covers coordinate conversion under scale and rotation, horizontal-surface rejection, capability failures, scene sharing and object placement constraints.
- `experiments/ar/xr-browser.js` uses Meta's IWER 2.4.0 with SEM's office fixture. It checks hit-test placement, tracked walking, pause on tracking loss and restoration to the studio. It compares the full eye summary, neural state and body at tick 100 in a rotated half-scale AR scene against the same studio simulation.
- `experiments/ar/camera-browser.js` supplies a synthetic video stream to the real camera-preview code. It exercises object placement and physics editing, independent duck selection, phone-sized layouts, media cleanup and camera refusal.

The emulator exposes DOM-overlay support to exercise the app's existing DOM controls. IWER 2.4 also snapshots the full viewer tilt when it creates a local reference space, so the repeat-session test starts upright before aiming at the floor. This is not a test of a browser vendor's native overlay compositor. IWER and SEM are development dependencies and are not imported into the production app.

The continuity comparison first failed: Three's XR background compositing also cleared the duck's offscreen eye targets to transparent black. This changed brightness and optical flow while the beacon follower happened to retain the same body motion. `LabArena.captureEyes()` now clears its virtual background explicitly and prevents the XR background pass from clearing it again. The failed and corrected results are retained in `xr-background-regression.json` and `xr-browser.json`.

Run the browser scripts against the dev server at `http://127.0.0.1:5195` using the repository's Playwright CLI workflow. Open `?ar=1` on a physical phone for device acceptance: place on a floor, walk around it, add a prop, switch apps, resume and exit. Verify that the camera indicator turns off after exit.

## References

- [WebXR hit-test sample](https://immersive-web.github.io/webxr-samples/hit-test.html): placing content on detected surfaces.
- [WebXR DOM Overlays specification](https://immersive-web.github.io/dom-overlays/): interactive controls and `beforexrselect` event handling.
- [Meta IWER](https://github.com/meta-quest/immersive-web-emulation-runtime): development-only XR emulation.
- [Three.js WebXR examples](https://threejs.org/examples/?q=ar#webxr_ar_hittest): renderer integration reference.
