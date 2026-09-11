# Bounded visual candidate study

Written before the held-out run. The source manifest emitted by `study.mjs` records exact executed files. No detector consumes labels, object positions or family names.

The **engineered compact displacement detector** is inspired by the distinction between small-object displacement and flicker in LC11 experiments. It is not an LC11 simulation. The **engineered silhouette expansion detector** estimates geometric growth of a tracked contrast region; it is not an LPLC2 or LC4 model. Both currently require a sufficiently uniform image border and disclose unavailable evidence otherwise. These candidates remain outside the app.

Calibration uses 8 movies per family. After calibration, source/settings are frozen before 32 independently seeded held-out movies per family. Held-out variation includes capture cadence, size, contrast, position and sensor-like noise. Each movie is the unit of evaluation; frames are correlated. Failure means no promotion, not a reason to retune against the same held-out movies.

Primary selective-readout gates within the declared uniform-border domain:

- Displacement: at least 90% of passing-object and brief-step movies elicit an event; no more than 5% of large-bar, stationary-flicker or global-flash movies do. Report approach-induced pauses separately.
- Expansion: at least 90% of dark and bright approach movies elicit a response, and no more than 5% of dimming, translation or recession movies do. Report simultaneous translation/dimming separately.
- Median onset-relative detection delay must be at most 300 ms. Report every negative delay as a prestimulus false event.
- Report response coverage. Unsupported movies cannot count as correct rejection. At least 95% of post-onset frames in a movie must be supported for that movie to enter conditional selectivity metrics, and all unconditional counts remain visible.

Required controls: existing `MotionOpponent` looming baseline; an equal-input generic temporal-change event baseline; frozen-frame movies; reversed movies. Compare temporal order for expansion and contraction. Reversing a translating target should preserve a displacement response, so that is a positive control, not an expected null. No physical usefulness or neural causality claim is permitted from these image-only tests.

Textured object movies and background rotation are stress tests. They may expose the limited foreground segmentation assumption. Treat rejection as unavailable evidence, not a passed safety test. Keep their raw inputs and outputs alongside in-domain results.

Retain compressed gray8 movies losslessly, frame timestamps and per-frame features, all source hashes, and the literal settings. RGB reconstruction is exact because these stimuli are grayscale. Reset/checkpoint, independent state and capture-clock checks run separately from scientific selectivity gates.
