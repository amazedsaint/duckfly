# A focused, editable experiment pack

September 11, 2026. This implements the user's subsequent request to select a few useful areas and let people map available triggers to robot actions. The broader 25-family catalog remains a research roadmap. Its failed visual controllers have not been promoted.

The central addition is a shared **When → Then** connection editor in the setup wizard and the live **Brain → duck** panel. Each duck owns its connections and adaptive state. The live panel shows the signal value against its threshold, whether a rule is active, and what blocked or limited the request. The **Why?** inspector records these decisions alongside their camera evidence.

## Available signals and actions

| Source | Signals |
|---|---|
| Actual 668-cell circuit readouts | DNp09 activity, left/right DNa rate dominance, giant-fiber stop state, MDN activity, pooled loom-pathway activity |
| Engineered camera rules | Pink cue visible/absent, cue on the left/right, image brightness |
| Existing visual adapter | Expansion response; this is a modeled signal, not validated threat recognition |
| Body feedback | Fallen state |

These 13 selectable signals can request any of ten supported actions: forward walking, pause, left/right walking arcs, signed neural steering, left/right head movement, cue-directed head movement, a kick, or a standing attempt. They are functional user mappings, not anatomical rewiring. Full Flyvis spatial cells are inspectable in the bench; they are not quietly substituted for these circuit readouts.

The body policy matters. Tests found that a stationary turn and a 0.15 m/s forward request produced little physical rotation. Arc actions therefore use the existing 0.3 m/s walking request with bounded steering. Strength changes an arc's steering. Lower walking-request strengths remain available but can fall below this policy's effective movement range. Applied commands and measured speed stay separate in the monitor.

## The scene pack

| Scene | Mapping and interaction | What it establishes |
|---|---|---|
| **Build a visual follower** | Pink cue excites DNp09; its activity requests walking and admits signed neural steering. Drag the cue, then change walking into head movement in the editor. | A visible change in a functional connection changes the actual requested and measured body response. |
| **Look without chasing** | DNp09 activity moves only the head toward the cue. A fresh image with no cue requests a leftward look. Hide/reveal controls move a physical wall. | The same source population need not always request walking. The lost-cue rule is explicitly a camera rule, not neural memory. |
| **Reverse the steering** | Two independent circuits use opposite left/right action assignments. Select each duck and inspect its signal, or send a DNa pulse. | Action assignment is separate from circuit activity. The ducks have different cameras; this scene is not a matched-retina experiment. |
| **A neuron requests a kick** | A DNp09 threshold crossing requests a kick once. The existing skill supervisor waits for a steady stance and runs the trained kick policy. | A real neural response can select an existing motor skill. The neuron does not specify the joint trajectory. |

Scenes stay open indefinitely. Existing object editing and physics controls remain available. The four tiles are first in the gallery and use the same reviewed setup path as existing scenes.

## Execution rules

Custom connections replace basic wiring while enabled. Basic wiring remains saved in a collapsed section. No active custom rule means zero forward/turn requests. Rules can have a bounded hold, up to three seconds, and can be disabled independently. Opposing turn requests sum and cancel; pause takes priority over movement. Kick and standing requests occur once per activation, with the existing physical skill checks.

Stale/missing input, an output intervention, body disconnection and the giant-fiber stop cannot be bypassed by wiring. A fallen body accepts a standing attempt, not ordinary movement. Existing near/absent-target gates continue holding a following duck's forward component. The record identifies this separately when an arc can still request yaw. Turning a circuit off or changing camera context clears held state appropriately.

Scene schema 7 prevents older clients from silently ignoring the new wiring. JSON scene links preserve the rules. Checkpoints preserve holds and activation edges. Live edits enter the existing replay timeline; source or mode changes clear obsolete connection state. Malformed imported connection records are rejected before the inspector reads them.

## Evidence and limits

The web suite passes **104 tests**, including all selectable trigger/action pairs for serialization and bounded requests. This matrix check is not physical validation of every pair. Actual circuit/MuJoCo/ONNX tests verify DNp09 remapping to an arc versus walking, independent ducks, source-neuron silencing, body disconnection, exact replay and a complete 25-tick kick. Earlier stationary/slow-turn failures remain in the versioned logs.

The four new scene launch flows pass in a real browser and the packaged WKWebView app. Browser checks include a wizard edit, a live remap with measured travel, recorded trigger inspection, narrow layouts and no page errors. The native flow also remaps walking into a pause. [Browser harness](../../../experiments/visual-behavior/connections-browser.js), [native harness](../../../mac/Tests/connections-smoke.js), [evidence directory](../../../experiments/visual-behavior/reports/).

These are implementation and bounded behavior checks. They do not establish biological fidelity, general object recognition, autonomous recovery success in arbitrary falls, or superiority over conventional vision. The full-reference steering pilot, native hidden-page camera delivery and real RTC transport retain their separate unresolved results. GPU and original trained-decoder studies remain research work outside this selected release.

## Publication

Published to the **contextmind/duckfly** Vercel project and verified at [duckfly.vercel.app](https://duckfly.vercel.app/). All four production scene flows passed, including the threshold-edit regression and measured walking after a live remap. No browser page errors occurred. [Release receipt](../../../experiments/visual-behavior/reports/connections-release.json), [production browser receipt](../../../experiments/visual-behavior/reports/connections-production-browser.json).

The current research Mac bundle is `mac/build/DuckFlyResearch.app`. Its connection flow passes in WKWebView. The installed Mac app was not replaced by this release.
