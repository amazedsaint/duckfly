# DuckFly playground interface

The app opens on a visual catalog of six scenarios. Each card explains the experiment and the interaction to try. Cards load and start the selected scene; returning home pauses the local simulation and retains the current scene for Continue.

The experiment view pairs the arena with a persistent brain dock. The chosen duck owns both the eye preview and the circuit plot. Selecting a prop preserves that connection. Clicking a duck in the 3D scene, choosing its object chip, or using the brain selector switches the connection. A ring identifies the watched duck; selection graphics are on a camera layer excluded from all sensory cameras.

Props can be dragged, moved with accessible directional buttons, or edited in Scene tools. A running local experiment pauses during a drag and resumes on drop or cancellation. Adding objects intentionally restarts the scene. The quick-add menu explains this before an object is added. Brain configuration, recordings, and research tools remain available in a drawer. On compact screens the drawer occupies the arena region, leaving the brain dock visible.

The cover-eyes button is a reversible sensory intervention. Enabling the device camera connects it to the watched duck immediately; stopping it returns webcam-connected ducks to their own cameras. Camera permission remains an explicit user action. No physical camera is opened by tests.

## Scientific scope

The visible graph is the selected duck's actual 668-neuron DesktopFly circuit. The body follows neural movement intent through Microduck's unchanged walking policy, subject to the existing sensory gates and overrides. Manual and reactive controllers are visibly labeled as bypasses. Neural activity is cleared when resetting or switching scenes.

Marker vision remains the default. The retinal motion scenario explicitly uses the existing experimental compact adapter. Full Flyvis remains available in the reference bench and is not labeled as the body controller. This change makes the experiment easier to use; it does not promote a new neural controller or change the physical model.

## Implementation

- `web/src/lab/workspace-ui.js` owns the screen structure; `scenarios.js` owns the tile descriptions and interaction hints.
- `web/src/main.js` separates connected duck selection from object selection and binds the workflow.
- `web/src/lab/lab-arena.js` adds duck hit testing and sensor-invisible selection graphics.
- Scenario thumbnails are crops of the actual rendered simulator, not conceptual illustrations.
- The Mac host bundles the same web UI, adds image MIME types, and permits compact window sizes.

## Validation

The existing 36 engine tests cover the policy and physics contract, replay, vision interventions, and the full Flyvis reference oracle. Native playground acceptance adds scenario launch, visible brain and vision, reversible eye covering, independent duck selection, prop movement without reset, and honest controller provenance. The rest of the native suite exercises the existing camera, recording, and experiment tools.

Browser visual checks cover desktop, a 563-pixel window, and a 390-pixel viewport. Both camera and brain remain inside the viewport without horizontal overflow. Directly clicking a rendered duck was verified to update the connected brain selector. Retained screenshots and native receipts live in this directory.

## Release

Shipped as Mac version 0.4.0 (build 4), installed in `~/Applications/DuckFly.app`. The previous local bundle is retained under the ignored `mac/build/` directory. The app was opened and its scenario home verified.

Production is deployed to ContextMind at https://duckfly.vercel.app. Deployment: `dpl_CiRRdA4sKeUDyajUKEijsyAi4uQX`; immutable URL: https://duckfly-rbh5u1u6t-contextmind.vercel.app. See `deployment.log` for the successful production build and alias.

`engine-tests.log` records 36 passing tests. `native-smoke.log` records the full native workspace suite, including the initial playground acceptance. The focused `--self-test-playground` receipt in `native-playground.log` verifies the final package, including automatic connection when adding a duck and recovery when removing it.
