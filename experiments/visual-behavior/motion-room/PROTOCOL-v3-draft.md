# Draft: prospective aperture-aware Motion room study

This is a proposed continuation, pending the numerical replay diagnostic. It is not an executed protocol or an acceptance result. Preserve the rejected V1 calibration and the mixed V2 physical pilot unchanged.

The only controller-path change would be the visual readout: use the independently tested aperture-aware neural-map-flow v2 solver. For a rank-one flow field, estimate a horizontal rate from `normalVelocity / normalAxis.x` only when `abs(normalAxis.x) >= 0.7`. Rank-two fields use their observed horizontal velocity. This is an explicit horizontal-motion assumption; it does not claim to recover unobserved tangential flow. Keep unavailable eyes as zero contributions in the bilateral mean. Keep the existing training-only gradient quantile, confidence thresholds and ridge penalty.

Re-run the unchanged TRAIN renderer movies so the same physical preparation and model conditioning reproduce the replay calibration. Freeze those coefficients before any new held-out sequence. The prospective held-out stripe counts are17/23, contrasts0.35/0.65, phases0.73/2.61 and angular rates±0.18/±0.28rad/s, plus unchanged images. Use a bright flat flash with mean0.9 from0.72–1.12s, patterned5.1Hz flicker, and illumination changing from0.3 to0.85 at1.14s. These parameters are not present in the prior renderer holdout. All existing per-frame false-turn and direction/rate gates remain mandatory.

If that renderer admission passes, compare the same seven physical conditions. Keep the prior body policy and feedback settings, the2s preparation,4s trial, torque0.003N·m for0.16s, panorama rate0.25rad/s and intentional command0.25rad/s. Keep the integrated-error gain1.5 and DNa-current coefficient0.18. A gain change would be a different candidate, not evidence for the new solver.

Use fresh seeds100/101 for the bounded prospective pilot. The seed changes the neural random stream and stimulus phase. Keep both directions and report every trial. Exact source hashes and actual initial states must be retained. The minimum useful torque remains0.02rad of heading separation from the matched no-vision/no-torque trajectory, not merely absolute drift from the initial heading.

Passes in frozen-pose images admit only a controlled physical experiment. Judge physical feasibility using same-seed no-vision comparisons and the DNa lesion; compare conventional flow separately. Do not call parity a neural advantage. The current stale-integral behavior remains a research-only limitation; no product controller is added by this study. A future live adapter needs the outer freshness/instability gate documented in REPLAY-PLAN.md.

Before an ordinary scenario/default change, freeze the required30-seed study with uncertainty estimates and prospective acceptance rules. The two-seed pilot is a stop/continue diagnostic. It cannot supply the final promotion evidence.
