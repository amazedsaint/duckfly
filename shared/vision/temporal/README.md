# Opt-in temporal research loop

This is the frozen `no-pose` decoder from `experiments/temporal/models/v1`, exposed in the guided playground. It is an engineered image-history classifier, **not Flyvis** and not a calibrated collision probability.

The retained physical study failed its false-alarm gate. Existing scene presets leave this loop off. The new Stop, wait, go tile explicitly opts into it and exposes the limitation.

`features.js`, `decoder.js` and `feedback.js` preserve the tested research computations. The quaternion helpers are local so shared runtime code has no dependency on experiment scripts. `loop.js` adds application lifecycle handling and checkpoint integration. Parity tests compare the packaged artifact and numerical predictions with the retained study.

Only calibrated simulated stereo is accepted. Covering either eye or switching to a webcam invalidates decoder history; an existing GF hold remains until valid low-risk observations return and measured speed is low. Webcam input is not supported by this trained model. GF silencing prevents new GF-triggered holds; motion-input silencing suppresses the decoder's sensory pulse. Manual neural pulses remain explicit interventions.

Model file source: `experiments/temporal/models/v1/no-pose.json`. Protocol and decisions: `experiments/temporal/RESULTS.md`. The package does not change circuit or walking-policy weights.
