# Guided scene setup

Released to the ContextMind Vercel project on 2026-09-10. Production: https://duckfly.vercel.app. Mac package: 0.9.0, build 9.

Every scenario tile and preset selector opens an isolated wizard. The user chooses ducks, connects neural outputs to body actions, then arranges objects and their physical behavior on an interactive starting-layout map. Nothing in the draft reaches the simulation until Apply. Cancelling resumes a previously running scene and discards the draft.

Forward neurons can request walking, a visually triggered kick, or no forward action. Turn requests can be followed, reversed, or disconnected. These are engineered connections to Microduck policies; they do not change fly anatomy or train a new body controller. The existing visual freshness and stop gates still apply. Manual and direct camera comparison modes explicitly bypass this mapping.

Edit setup reopens the same configuration. Duck-setting changes are recorded worker actions and retain the current clock, physical state, and other ducks' neural state. The review identifies changes that rebuild the scene. Object physics and starting-layout edits rebuild from the configured positions. The live Brain → duck panel edits the same per-duck fields. Object selection opens its behavior panel; stage controls collapse into a bottom rail, with a separate persistent brain/eye monitor.

Scene schema 6 stores canonical mappings. Recording format 5 adds an ordered, bounded duck-setting timeline. Rewinding across a mapping change now reproduces the original neural and physical trajectory; the previous implementation diverged by 6.20 cm in the retained regression. Older scenes and recording formats 1–4 remain readable. Other actions such as prop moves and pushes retain the earlier checkpoint behavior; this release does not claim a complete action-event replay system.

## Verification

- 87 Node tests passed, including actual MuJoCo/ONNX movement, mapped kicks, independent ducks, stop/reflex guards, legacy import, and replay across mapping edits. See `unit-tests.log`.
- Native scenario audit passed all 11 presets, including open-ended runs, output/feedback controls, visibility checks, and prop behavior. See `native-scenarios.json`.
- Native setup acceptance passed: an independently disconnected duck kept neural activity while receiving zero forward/turn commands, the walking duck moved, and a newly configured heavy ball settled under gravity. Reconnection restored movement. Input-only names, live edits without restart, exact scene/recording roundtrips, and cancel/resume passed. See `native-setup-current.json`.
- The full native workspace passed all 14 checks, including camera input, scene editing, rewind, synthetic webcam/permission refusal, field input, comparisons, and learning. Learning correctly returned no promotion. See `native-workspace-release.json`.
- Native playground regression passed, including the new collapsed-panel defaults, selection, manual controls, object edits, and presentation-state isolation. See `native-playground-current.json`.
- Browser CUA checks at 1280×720 and 390×844 verified the actual rendered UI, dragging with millimetre-precision positions, typed values surviving Continue/Start, and live output disconnection. Phone stage height was 400 px with the brain/eye panel still within the viewport. No browser console errors were captured. See `browser-checks.json` and screenshots.

The Mac was locked during verification. Native tests verified WebKit DOM geometry and functional behavior; browser screenshots provide visual acceptance of the shared UI. A suspended native animation frame was removed as an unnecessary dependency of the functional layout test. No manual native paint acceptance is claimed.

`production.json` retains the deployment ID and matching production/local asset hashes. `mac-install.json` records the signed bundle, backup location, and file-by-file verification. Relaunch an already-open Mac app to load the installed update.
