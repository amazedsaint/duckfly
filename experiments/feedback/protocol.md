# Vision / feedback experiment, 2026-09-10

Baseline: DuckFly `bee6739`. Freeze the walking policy, actuator limits and circuit weights. This protocol is written before running the candidate controller.

## Questions and falsifiers

1. Does compensating image bearing for the measured camera orientation improve pursuit when the head turns? A camera-centered target is not necessarily body-centered. Compare the current adapter, the existing active-head option, and an adapter that converts the captured ray into current body coordinates. No object coordinates may enter the controller.
2. Does stronger bounded gaze tracking help beyond that coordinate correction? The head command remains within the existing ±0.35 rad range. Removing the pose correction is the matched ablation.
3. Does gait feedback have a useful phase-dependent effect? Compare normal ascending input with feedback disabled and with deterministic unrelated phase. A failure to beat unrelated phase does not establish useful proprioception.

A separate motion experiment may test camera-rotation compensation against the failed looming baseline. It must retain approaching-object sensitivity and reject stationary self-motion controls; reducing every response is not a gain.

## First physical study

Use the actual Three.js duck-eye renderer and MuJoCo/ONNX runtime. Render at the existing camera cadence and run physics at the existing 20 ms motor / 5 ms substep schedule. Models only receive pixels and the existing camera/body feedback. True positions are used for evaluation and scene events only.

Four pursuit families: off-axis fixed beacon, lateral moving beacon, a beacon repositioned after two seconds, and temporary physical occlusion. Each trial lasts six simulated seconds. Include all trials, including falls and contacts. Use the same seed and scene events for every controller.

Pilot: four seeds per family. Conditions: original, active head, existing head stabilization, body-coordinate correction, coordinated gaze, coordinated gaze without pose correction, and gait-feedback interventions. Pilot can select between the predeclared coordinate-only and stronger-gaze candidates. Selection criterion is mean final goal error, with no extra falls; no coefficient search is authorized by this protocol.

Lock the selected candidate before evaluation. Evaluation uses 24 fresh seeds per family. Compare original, existing active head, selected candidate, and the selected candidate's matched pose-removal ablation. Separately assess gait-feedback interventions if the pilot supports a phase-specific effect. Pilot results are not held-out evidence.

Primary metric: final horizontal distance to the current beacon. Also retain target-visible fraction, post-reposition recovery, body-heading error, traveled distance, falls and object contacts. Report paired bootstrap 95% intervals with resampling within family (2,000 replicates).

Engineering promotion requires at least 0.03 m mean paired error reduction versus original with the 95% interval above zero; no family mean regression exceeding 0.02 m; no extra falls; no greater than 5 percentage-point increase in trials with contacts. It must outperform the matched pose-removal ablation with a positive paired interval to attribute the gain to pose feedback. This is a bounded engineering screen, not biological validation.

All following controllers must keep forward motion gated when the target is absent, eyes are covered or frames are stale. An imported recording must resume identically, and legacy model semantics must stay available. A failing candidate stays in the research harness; do not change the product default to satisfy a report.

## Source grounding

NeuroMechFly v2 provides a precedent for joint vision/body-loop experiments and head stabilization, but its fly morphology and learned head controller do not establish efficacy for this biped. Our coordinate correction is an engineered adapter, not a reconstructed fly pathway.
https://www.nature.com/articles/s41592-024-02497-y
https://github.com/NeLy-EPFL/flygym/tree/c7affce924cb1c6add16619adf83be5c6b223e89/flygym/examples

## Rotational self-motion study (declared before rotation results)

Warp the prior image into the current measured camera orientation before the existing motion-opponency calculation. Keep its thresholds and the GF gain fixed. This should remove camera rotation while preserving translational approach evidence. It does not estimate depth or remove parallax.

Test the original motion encoder, pose compensation, and compensation with the rotation inverted. Use actual rendered MuJoCo eye views with stationary head scanning, moving-body background, looming approaches and lateral passing objects. Matched seed and environment per condition. Pilot 4 seeds per family, then 24 fresh seeds per family only if worth evaluating. Do not tune the looming threshold after viewing results. The input pose must correspond to each stereo eye; no external object position enters the encoder.

Physical promotion requires at least a 20 percentage-point reduction in false GF stops on control scenes, without an increase in approach contact trials or falls. Approach pre-contact stop detection must not decrease by more than 5 percentage points. Require a positive paired bootstrap interval for reduced false stops versus both original and inverted-pose control. Keep all trials, including failures. A perceptual reduction alone cannot promote body control.

The initial pursuit pilot browser was aborted because a multi-megabyte textarea made the browser unresponsive. Its results were not analyzed. The unchanged controller pilot is rerun as `pilot-v1` with each trial saved directly by the local research server; the report UI contains only compact metrics.

## Follow-up: visual signal versus neural trigger (declared after gain-6 pilot)

The gain-6 rotation pilot reduced control GF alarms from 2/12 to 0/12, but approach pre-contact stops fell from 1/4 to 0/4 and contacts rose from 2/4 to 3/4. Reject gain-6 compensation; do not run a large confirmation of that failed candidate. It retained strong peak approach looming (mean 0.874), so a separate, bounded study will test the sensory-to-GF transfer.

Use the previously supported bench gain **10**, with all image thresholds unchanged. No intermediate gain search. On fresh `gainpilot` seeds (4 per family), compare baseline original at gain 6, original at gain 10, rotation at gain 10 and inverted rotation at gain 10. All comparisons are paired. The candidate must satisfy the existing motion gates versus baseline gain 6, and show a positive false-alarm reduction interval versus original gain 10 and inverted gain 10. If the pilot has extra approach contacts, fewer true detections, extra falls or no reduction in false alarms versus baseline, stop. Otherwise freeze and evaluate 24 fresh seeds per family. This is a distinct follow-up, not retroactive adjustment of the failed gain-6 study.
