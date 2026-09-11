# Motion room V2: bounded physical study

This harness is an unpromoted experiment. It adds no scenario, wizard mapping, or default controller to the product. It uses the actual `Experiment`, rendered `LabArena` eye images, fixed Microduck walking ONNX policy and BAM/MuJoCo plant.

Two primary questions remain separate:

1. **Panorama motion:** does the duck turn in the direction of a rotating visual panorama? This tests an optomotor response. It is not world-heading stabilization, because the body is not externally rotated.
2. **Physical yaw perturbation:** with the panorama fixed, does the duck recover its initial commanded world heading after an applied trunk torque? Score world heading only in the evaluator. The visual decoder and controller receive no body/target positions.

An intentional-turn control tests whether visual correction fights a commanded turn. The command is a declared input; it is not reconstructed from hidden scene state.

## Fixed representation and calibration

Use the verified full Flyvis export through `web/src/lab/flyvis-runtime.js`. Each camera has an independent recurrent state. Reusing the right-eye reference for the left camera is an engineered representation, not an anatomical left-eye reconstruction. Fade each eye from bias into its initial image for one model second, then retain that image-conditioned baseline. Each 40 ms camera interval contains20 model steps; response records identify the declared 40 ms model delay. No current frame's response may act before its model interval ends.

The neural candidate is the pinned `createNeuralMapFlow` implementation in `shared/vision/readouts/neural-map-flow.js` (v1). It measures motion in raw T4/T5 maps, removing each population's common temporal change. It does not compute flow on delta maps, because a textured subtracted baseline would introduce an artificial fixed pattern. A population name is never assigned a direction by hand. Apply the fixed explained-variance threshold0.2 and maximum image speed360degrees/s. Set the minimum gradient to one quarter of the tenth percentile of moving TRAIN camera observations, before examining held-out results. Average admitted horizontal estimates from the two eyes, retaining unavailable values and reasons as zero contributions, then fit a one-feature standardized ridge gain to known panorama rates. Raw128 spatial-bin summaries remain recorded for inspection but no longer drive the candidate.

The conventional comparator uses the same721 samples per eye and two-dimensional gradient flow, removes the common temporal change, and rejects gradient energy below0.1. That floor is chosen from v1 TRAIN evidence: moving scenes have energy at least4.35, while flat-flash residual gradients peak at0.0306. It is not tuned against held-out v1 outcomes. Fit its rate gain on the exact same calibration observations/labels. Both candidates use the same declared model delay and downstream controller parameters.

Calibration movies are rendered around the same settled physical duck pose. They are open-loop visual calibration, not physical-trial evidence. Fit on stripe counts12 and24, contrast0.8, phase0 and rates±0.25rad/s. The fresh V2 holdout uses stripe counts15/21, contrasts0.45/0.7, phases1.17/2.11 and rates±0.2/±0.3rad/s, plus unchanged images. Explicit zero-motion confounds include flat flashes, patterned stationary flicker and large illumination changes. Training flicker remains0.8Hz; fresh held-out flicker is3.3Hz. The held-out flat flash darkens to0.08 between0.56–1.04s; the illumination control changes from0.2 to0.75 during its active interval. No v1 held-out sequence supplies a v2 acceptance sample. Ridge penalty0.1 remains fixed.

Rotation begins at0.4s. Fit/score steady nonzero-rate samples only from0.6s onward; stationary and confound scoring begins at0.2s, before their events. Retain preparation samples and all event transitions with timestamps, including values omitted from the steady-motion score. Every movie contains50frames at40ms cadence. V2 comprises9 training movies and13 held-out movies. Report unavailable eye observations as well as directional accuracy over all eligible moving frames.

Engineering admission limits, fixed before calibration:

- At least90% correct direction on held-out nonstationary frames.
- Mean absolute angular-rate error at most0.08rad/s on those frames.
- Mean absolute stationary decoded rate at most0.03rad/s.
- At most5% false-turn frames above0.05rad/s in each held-out unchanged/flash/flicker/illumination family; report each family's coverage and peak error, not only their pooled mean.
- Finite outputs and explicit source/model identity for every sample.

These limits are a test of this decoder/input geometry. They are not published biological acceptance thresholds. A failed readout cannot enter the physical comparison through this harness. Retain failure and revise with a new protocol/version and calibration split if necessary. Do not tune on the held-out movies.

The earlier pooled positive-delta direction baseline and rendered spatial-bin ridge failed flash/flicker controls. Their reports remain intact. The neural-map-flow v1 synthetic screen also failed its overall grating-direction gate, though its sustained-confound event gate passed. Thus V2 renderer admission is a narrower test of horizontal panorama inputs, not a general motion-model validation. It inherits no success from those earlier candidates. Its own stricter per-frame confound gates remain mandatory.

## Physical matrix

Compare `flyvis-direct`, `conventional-direct`, and `none-direct` as diagnostic visual-to-body adapters. Also compare `flyvis-dna`, `conventional-dna`, and `none-dna`, using the existing DNa populations and actual neural yaw readout. `flyvis-dna-silenced` disables both DNa left/right readout populations while keeping the visual input and upstream simulation; it tests whether the proposed circuit route contributes to turning. Direct-yaw results alone do not implement the fly-vision→fly-circuit→duck claim.

All conditions preserve constant forward current0.12 into DNp09, original neural forward output and GF stop. A shared bounded controller integrates decoded scene angular rate plus the declared intentional-yaw command into a visual heading error; gain1.5 converts this error to a yaw request, capped±0.65rad/s. The DNa route converts that request to current with coefficient0.18, capped±0.12; the existing neural adapter converts actual DNa rates to yaw. These are explicit engineering coefficients, not measured synapses. No-vision conditions disable visual correction while preserving the forward-drive task. They are interventions, not the product policy for missing camera data.

Settle each actual body for2 simulation seconds with the same fixed0.3m/s forward command, visual steering disabled and zero imposed yaw; active trial forward output then returns to the actual DNp09 readout. Trial duration4s. Panorama rotates±0.25rad/s between0.8 and2.4s. In the separate perturbation case, apply a world-z torque of±0.003N·m for0.16s beginning0.8s. The harness wraps `applyPush` after the world clears external forces; it does not teleport or directly modify joint/heading state. Retain torque and measured angular response. A disturbance too small to produce0.02rad heading error in the paired no-vision condition is invalid evidence, not successful stabilization.

All models run in shadow on the same delivered retinal samples inside each trial, while only the assigned condition controls movement. This supports equal-input diagnostic predictions. Physical closed-loop trials naturally diverge; they remain paired by seed, initial state and stimulus. Shadow-model compute makes wall-clock throughput unsuitable for comparing product latency. Record each component's elapsed compute time and simulation ratio separately.

Retain every trial, including falls, model errors and incomplete runs. Save sampled retina arrays and feature vectors with frame clocks, decoded rates, requested/applied commands, actual neural rates and measured body state. Ground-truth headings/torque are used only for scoring. The report's source guard verifies consumed source hashes against disk before starting and again before accepting trial/complete records.

## Promotion remains a separate decision

Calibration and a small physical pilot do not satisfy the proposal's final physical gate. Before promotion, freeze a fresh matched study with at least30seeds/condition, report uncertainty and all failures, and evaluate both primary questions separately. Compare heading-error integrals/recovery on perturbation, direction response on panorama, falls/collisions and intentional-turn interference. To claim an advantage, require a confidence interval supporting an improvement over the equal-input conventional controller; parity only supports feasibility. DNa ablation must remove the candidate's directional contribution. Do not replace either primary question with a stimulus-only result.

Run server separately from the product preview: from the repository root, `web/node_modules/.bin/vite --config experiments/visual-behavior/motion-room/server.mjs`. It binds127.0.0.1:5198. The page begins idle. Calibration and physical requests have explicit buttons; evidence is retained under this directory's `reports/`. No deployment or default integration is performed.
