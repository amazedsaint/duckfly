# Vision lab v0.3

The timing foundation and retinal experiment bench are implemented. The full
Flyvis reference runs locally in both Chromium and the standalone Mac app.
The new body-control pathway failed its physical promotion gate, so the
established marker controller remains the default. **Retinal motion lab** is an
explicit experimental preset.

## What changed

- Versioned frame packets retain source identity and decoded-frame identity,
  capture timestamps, simulation time, calibration and physical camera pose.
  Repeated/out-of-order frames cannot renew freshness. A live-camera resume clears
  the motion history and requires a newly decoded observation. A stalled input
  gates camera-driven approach after 300 ms.
- WKWebView canvas streams can return a constant media timestamp. These sources
  use an explicitly labeled `decode-arrival` clock based on callback arrival.
  This is an acquisition-time estimate, not recovered exposure timing. Webcam
  angular calibration remains marked unknown.
- The experimental preset has separate perspective eye views, 36 mm separation,
  ±25° yaw, with 721 hexagonal samples per eye. The map uses explicit axial
  coordinates and has a tested bijection to Flyvis input ordering. The bounded
  field of view is a modeling choice, not a full anatomical eye reconstruction.
- The compact motion-opponency baseline handles ON/OFF contrast. It requires
  opposing spatial motion to support expansion. It sends modeled current into
  LPLC2 without also driving LC4. Interventions can remove motion input or silence
  LPLC2, and the GF coupling multiplier is exposed as a parameter.
- The retinal bench displays synthetic movies and neural response traces, with
  JSON export. Its full Flyvis option uses all 45,669 modeled cells and 1,513,231
  edges. Its T4/T5 outputs are continuous model activity, not spike or calcium
  recordings. This reference has no promoted LPLC2/body bridge.
- Action records distinguish neural intent from controller gates and head
  commands. Optional bounded head yaw stabilization remains a separate
  engineered control, with no claim of improved retinal stability yet.
- Scene/recording v2 retains packet metadata. Old scenes retain their original
  marker-model semantics, including the historical image-half eye intervention.
  Archived recordings load and replay; current-runtime continuation remains
  exact. The cross-engine archived fixture differs only at floating-point
  roundoff in physical state and derived gait drive.
- Physical looming trials are separate from target following. Both primary
  conditions use 0.30 m/s forward limits. Reports retain stop intent and actual
  stopping distance separately, including contacts after a stop.

## Evidence

`tests.log` records **36 passing tests**, including the original body/policy tests.
`fixed-controller.json` verifies that the walking policy, robot controller source
and selected FlyWire circuit data have unchanged hashes.

The Flyvis source and dependency environment are pinned in
`research/fly-vision/`. The published model archive passes its SHA-256 check.
The weights loaded by NetworkView equal the published checkpoint tensor by
tensor. Both container hashes are retained in the model manifest.

The WASM oracle comparison covers a 1 s fade-in and 1,000 subsequent 2 ms steps.
Complete neural states are compared at 122 retained checkpoints; observed maximum
absolute difference is **0** under the predeclared absolute/relative tolerance
of 2e-5. Checkpoint continuation and eye-state independence also pass. Small golden
fixtures permit offline regression tests without Python.

The full Flyvis bench measured approximately **35 ms p95 in Chromium** and
**31 ms p95 in WKWebView** for one eye processing 40 ms of held input at 500 Hz.
These are local measurements, not a multi-duck or camera-to-actuator performance
claim. The bench has 25 Hz distinct images; it does not imply 500 camera images
per second.

Native workspace acceptance passed, including recording round trips and physical
wall occlusion. The new native test also validates the Flyvis bench and a decoded
camera stall while physics continues. Webcam checks used synthetic streams;
physical webcam exposure timing was not measured. See `native-vision.json`,
`native-workspace.log` and `browser-receipt.json`.

## Failed promotion gate

The compact detector passed all 300 variations of the synthetic stimulus bench.
Each family has 30 cases; perfect accuracy has a Wilson 95% interval of roughly
0.886–1.000. This establishes bounded synthetic discrimination only.

A sustained LPLC2-current sensitivity sweep produced GF stops in 10/30 seeded
runs at gain 6 and 30/30 at gain 10. The calibration is therefore consequential.
These are arbitrary model-current units, not a measured physiological conversion.

The 30-seed physical study used a three-second observation window per trial:

| Condition | Approach contacts / 30 | Lateral stop intents / 30 | Falls / 60 |
| --- | ---: | ---: | ---: |
| Compact motion → LPLC2 → GF | 25 | 7 | 1 |
| Reactive motion rule | 21 | 30 | 0 |
| LPLC2 silenced | 27 | 1 | 0 |
| GF silenced | 29 | 0 | 1 |

Raw outcomes, stopping distances and confidence intervals are retained in
`experiments/vision/reports/physical-30-seeds.json` and `physical-summary.json`.
The synthetic image tests missed motion arising from the duck's own movement and
rendered scene. This is a concrete reason to keep the candidate experimental.
The comparison does not establish connectome superiority.

## Next gate

Fit and validate a spatial T4/T5-to-LPLC2 response model against held-out
physiological stimuli, then repeat the physical study with locked calibration.
The current one-checkpoint tuning probe is not that validation. Pursuit circuitry
and large Flyvis flocks remain deferred. End users can run the current bench and
both app surfaces without Python or a hosted inference service.
