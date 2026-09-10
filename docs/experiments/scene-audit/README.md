# Scene and feedback-loop audit

The duck was not disconnected from its brain. Its camera could see too little of the beacon to classify it. Think of a traffic light between the circuit and the body: the circuit can request a step while the visual gate keeps the forward command at zero.

## What changed

The live monitor shows the neural request beside the delivered forward/turn command. It also shows measured speed and the gait feedback returned to the fly circuit. Stop reasons come from the actual causal event. Paused readouts carry their sample time, so changing a switch cannot rewrite the last delivered command.

Every scene now has an Experiment controls panel. Body commands and body feedback can be disconnected independently for the selected duck. Command strength scales forward and turn commands between zero and full strength. It leaves the neural request intact; Microduck's existing policy still balances the body. Step advances five motor ticks (0.1 seconds) and pauses with a fresh camera observation. A queued pulse explains that Run or Step is needed. Every scene is open-ended. The duration cap and automatic pause on hiding the window/tab are removed. The browser may throttle background work. Recording history remains a bounded rolling window, so open-ended scenes do not accumulate unlimited camera frames. Explicit comparison tools retain their own fixed measurement windows.

Follow the beacon gets cue placement buttons. Out of sight gets hide/reveal controls. Flock controls switch the watched duck and position the leader's beacon. The threat scene can restart with a retreating or stationary object. The motion scene exposes eye and steering interventions. Free play offers neural pulses and can connect an added beacon to the visual controller. Existing guided experiments retain their interventions, with the common body controls alongside them.

Stop, wait, go now retains its first five-second observation without stopping the scene. Motor ticks identify that observation, avoiding a floating-point boundary error. The user can continue changing the encounter.

## Object behavior and physics

Select an object in the scene or object tray to open Behavior & physics. The presets distinguish a fixed object from a body governed by gravity. Light pushable bodies use 80 g; heavy bodies use 1 kg. The slippery preset lowers friction to 0.05. These properties feed the actual MuJoCo model.

Back-and-forth and circular motion are scripted environmental stimuli. Users choose their speed and travel radius. Changing a path keeps the current clock and neural state, begins at the object's current position, and creates no jump. Dragging a moving prop stops its path. A dotted guide uses the main-camera UI layer and is excluded from the duck-eye cameras. Physical type or weight changes explicitly restart the scene to rebuild the physical model. Reset keeps added objects and their physics. Custom object physics disables the original encounter script. Choosing a new stop-and-go encounter restores its test object while preserving added props and body connection settings. No learned object behaviors are claimed.

The controls occupy a dedicated scroll area below the arena; opening a long prop editor cannot scroll away the brain or the scene toolbar.

## Rendered-camera baseline

All ten presets ran through the actual WKWebView renderer, selected fly circuit, MuJoCo physics and ONNX walking policy. Samples were collected every half-second through five seconds. These are bounded smoke checks, not a guarantee for arbitrary edits or long runs. Distances are accumulated travel; the flock row lists each duck.

| Scene | Travel after five seconds (m) | Upright |
| --- | --- | --- |
| Follow the beacon | 0.77 | Yes |
| Stop, wait, go | 0.01 | Yes |
| Find it again | 0.86 | Yes |
| Brain switchboard | 0.87 | Yes |
| Bump and recover | 0.88 | Yes |
| Out of sight | 0.01 | Yes |
| Follow the flock | 0.87/0.93/0.92 | Yes |
| Approaching threat | 0.31 | Yes |
| Retinal motion lab | 0.89 | Yes |
| Your own playground | 0.09 | Yes |

The wall scene's stationary duck is expected: the wall hides the cue. Stop, wait, go deliberately holds during a hazard. Free play can move spontaneously because its direct brain controller does not require a beacon; it is not guaranteed to remain at rest without a pulse.

## Failure reproduction and recovery

A 7 cm beacon at x=1.63 m, y=0 occupies two classified pixels. The existing detector requires five. The duck accumulates only about 4 mm over three seconds and sends no forward command. The UI now reports the tiny cue explicitly. Bring beacon ahead places the cue 65 cm ahead of the body as a user-directed scene edit. In the native regression, the same duck then accumulated about 44 cm of travel over the next three seconds. Covering the eyes blocked forward following again.

A proposed two-pixel threshold fails a simple falsifier: two unrelated pink specks would count as a target. That candidate was rejected. We did not weaken the detector or promote an autonomous search controller. The duck can still lose a cue after approaching it, and the existing active-look controller remains optional. Recovery buttons make that limitation visible and actionable. No controller is given hidden target coordinates.

## Verification

- 63 Node tests pass, including actual physics, identical neural/body replay, stale/covered-camera behavior, portable output controls and the stray-pixel falsifier. New tests cover motion bounds and identical physics replay after live behavior edits.
- The native catalog audit tests every preset's motor disconnect, feedback disconnect, bounded Step and reduced command strength. The updated open-scene audit also checks continued running beyond five seconds in all scenes and beyond 30 seconds in Follow the beacon. Neural spikes continue with body commands disconnected. The distant-beacon case also checks physical recovery and paused pulse queuing.
- Native playground acceptance checks selecting another duck, prop interactions, adding/removing objects and layout preservation. The guided acceptance check still reproduces zero contacts with the experimental hold and two contacts with the original timer; disconnecting GF removes GF events. These examples do not override the retained study's failed false-alarm gate.
- Browser UI checks at 1280×720, 390×844 and 560×640 cover visible controls, cue hide/reveal, independent flock connections, free-play beacon attachment and motion/eye interventions. Focus preserves the paused scene; the eye view and brain remain visible on small layouts.

New optional motor settings and scripted prop behaviors use scene version 4 when edited. Older scene versions migrate with a connected body and 100% strength. Older clients reject version 4 rather than silently ignoring a disconnected motor. The circuit and walking policy assets are unchanged. [Asset provenance](asset-provenance.json) also records a pre-existing mismatch in the older research manifest: world.js gained configurable nudge strength in commit 9126e84. That historical manifest was preserved.

Reproduce after building:

```sh
npm test --prefix web
bash mac/scripts/build.sh
mac/build/DuckFly.app/Contents/MacOS/DuckFly --self-test-scenarios
mac/build/DuckFly.app/Contents/MacOS/DuckFly --self-test-playground
mac/build/DuckFly.app/Contents/MacOS/DuckFly --self-test-guided
```

Retained evidence: [baseline](baseline.json), [first control pass](controls-first-pass.json), [final open-scene audit](open-native.json), [test output](open-tests.log), [native playground](final-playground-native.log), [native guided experiments](final-guided-native.log). Earlier interrupted audit logs are retained. One found the old background auto-pause, now removed; another exposed a same-scene navigation race in the test harness. The final audit waits for the new running scene before checking live motion edits.

The acceptance scope is defined in [PLAN.md](PLAN.md). This release adds open-ended scenes and improves experimental control. It does not establish biological fidelity or autonomous pursuit reliability. Physical hardware was not tested.

## Released build

Source commit `11cdb8f` is deployed to [duckfly.vercel.app](https://duckfly.vercel.app/) in ContextMind and installed as Mac version 0.7.0 (build 7). The public index and 11 runtime/code assets match the local build. All 62 installed Mac files match the signed package. Live checks opened the installed app and exercised the public website. [Release receipt](release.json), [public asset checks](web-production.json), [Mac package checks](mac-install.json), and [browser observations](ui-verification.json) retain the evidence.
