# Motion room results

## V1: rejected before the body comparison

Executed15 renderer-based calibration movies,750 frames total, using actual settled Microduck geometry and the full verified Flyvis model. The complete source/model receipt and all samples are retained in [motion-calibration-v1.json.gz](reports/motion-calibration-v1.json.gz); the readable [summary](reports/motion-calibration-v1-summary.json) is separate. The exact pre-run protocol is retained as [PROTOCOL-v1.md](PROTOCOL-v1.md).

| Decoder | Held-out direction | Rate MAE | False-turn frames on flash / flicker / illumination | Admission |
|---|---:|---:|---|---|
| Signed T4/T5 spatial-bin ridge |70/70 correct |0.0844rad/s |19/45,17/45,28/45 |Fail |
| Conventional retinal gradient flow + fitted gain |70/70 correct |0.2368rad/s |0/45,0/45,0/45 |Fail |

Correct direction signs did not establish useful control. The neural decoder assigned motion to large contrast changes. The conventional decoder was almost silent because ill-conditioned training flash transitions produced approximately±9.95rad/s raw estimates, compared with approximately±0.28–0.32rad/s during real training panorama motion. Fitting zero-speed labels to those outliers shrank its gain. This diagnosis used the training movies; the failed held-out set must not be reused for a new acceptance claim.

Both physical routes stayed disabled for V1. No direct-yaw, DNa-current or physical-torque comparison used that rejected calibration. The harness implementation alone is not evidence that those experiments work.

The executable v1 steady-motion score excludes samples before0.6s, because rotation begins at0.4s; stationary/confound scoring excludes only the0.2s preparation interval. Every sample is retained. This clarifies the protocol's brief wording about the initial settling interval; no false-flash samples were dropped on that basis.

## V2: separate candidates and fresh renderer holdout

V2 replaces the failed neural-bin regression with the independently developed neural-map-flow readout. It evaluates motion of raw neural response maps, removes spatially common temporal changes, and reports unavailable/poor-fit estimates. It does not assign a direction to a subtype or subtract a textured reference map before computing motion. A conventional confidence floor and common-illumination correction address its training-only conditioning failure. Neither change inherits validation from v1.

New stripe frequencies and contrast/phase combinations are held out. Flash schedules and flicker frequency also change. All original admission limits remain mandatory; no physical candidate can launch merely because it displays plausible neural maps.

The actual V2 renderer run completed22 movies,1100 binocular camera frames. Both candidates passed the preregistered horizontal-input admission. The full [immutable receipt](reports/motion-calibration-v2.json.gz) includes the executed sources and raw sampled retinal arrays; the [summary](reports/motion-calibration-v2-summary.json) omits bulky model geometry.

| Decoder | Held-out direction | Rate MAE | Stationary MAE | False-turn frames by unchanged / flash / flicker / illumination |
|---|---:|---:|---:|---|
| Raw T4/T5 neural-map-flow v1 + fitted gain |280/280 |0.02539rad/s |0.000473rad/s |0/130,0/45,0/45,0/45 |
| Conditioned conventional retinal flow + fitted gain |280/280 |0.02422rad/s |0.000813rad/s |0/130,0/45,0/45,0/45 |

The neural gradient floor0.0086436657469057 came only from the declared training quantile rule. Of640 held-out moving-eye observations after the initial preparation interval,601 were available. The direction/rate score starts later at0.6s; its denominator includes all280 eligible frames, including frames with an unavailable eye. Every stationary neural observation abstained, leaving only the fitted gain's small intercept. The conventional flicker peak was0.03112rad/s, below the fixed0.05rad/s false-turn threshold.

This admits a controlled **horizontal** physical pilot. It does not repair the independent neural-map-flow v1 synthetic diagonal-grating failure and does not establish biological accuracy. The separate aperture-aware v2 decoder is not substituted into this study.

## V2 physical pilot: circuit route works, neural controller does not earn promotion

Completed42 actual MuJoCo/ONNX body trials: seven conditions, both seed directions, and separate panorama/torque/intentional-turn objectives. These are simulated physical bodies, not hardware robots. All4200 binocular retinal frames and8400 body ticks are retained in the [immutable physical archive](reports/motion-physical-v2-pilot.json.gz). The independent [trace analysis](reports/motion-physical-v2-pilot-analysis.json) verifies complete coverage, the40ms model delay, matched initial body state and exact DNa-output-to-body command equality. It recomputes the heading scores from the recorded body states. There were no execution failures or integrity discrepancies.

The table reports mean error integrals over the two seeds, in radian-seconds. Lower is better. Panorama uses error relative to the rotating panorama; the other objectives use error relative to the commanded world heading. Those objectives must not be pooled.

| Condition | Panorama tracking | Torque: world heading | Intentional turn: world heading |
|---|---:|---:|---:|
| Flyvis → direct yaw |0.7866 |0.6444 |0.4659 |
| Conventional → direct yaw |0.4824 |0.2087 |0.2759 |
| No vision → direct yaw |0.9989 |0.5000 |0.4974 |
| Flyvis → DNa current → body |0.8370 |0.7836 |0.4851 |
| Conventional → DNa current → body |0.4013 |0.3947 |0.4946 |
| No vision → DNa route |1.1412 |1.0106 |0.8465 |
| Flyvis with both DNa readouts silenced |0.9989 |0.5000 |1.0054 |

The neural candidate's final turn follows the panorama in only one of two directions, for both direct and DNa routes. Conventional flow follows both. The pooled positive neural response must not hide that failed direction. On torque recovery, full-model direct control is worse than its no-vision counterpart. The DNa route improves its mean error over the noisy no-vision DNa route, but remains worse than conventional input. Its intentional-turn mean is close to conventional; two seeds do not establish equivalence or an advantage. No condition maintains the0.03rad recovery bound for0.5s within the four-second trial window.

Every trial stays upright, with zero collisions and maximum tilt4.48degrees. The eight-tick torque pulse is delivered for0.16s. Against same-seed no-vision/no-torque trajectories, it produces0.0528–0.1058rad of additional heading separation. The disturbance is therefore measurable beyond natural gait drift; its sign and force history are retained.

The engineering bridge has a real causal route: DNa current alters actual population rates, and the actual neural yaw readout drives the body without an extra direct-yaw override. Silencing both DNa readout populations yields exactly zero left/right rates and neural yaw in all six lesion trials. This lesion also removes intentional DNa steering, so it is not a selective visual-neuron lesion. No anatomical Flyvis→FlyWire synapses are added by this experiment.

Fixed-pose visual admission did not predict gait robustness. For example, the same moving-body camera frame at3.0s in the first panorama trial produces a full-model prediction+0.727rad/s and conventional−0.266rad/s. Body-induced camera motion and the v1 solver's unresolved tangent response are candidates for diagnosis, not established explanations. The next bounded test uses the separately developed aperture-aware solver and replay checks described in [REPLAY-PLAN.md](REPLAY-PLAN.md); body gains stay fixed.

On this run, full model core processing across both eyes takes63.1ms median /67.3ms p95 per40ms model interval; extraction adds2.1ms median. Conventional flow on the same samples takes0.1ms median /0.2ms p95 across both eyes. These are observed component timings in the research process, not an isolated production benchmark. All methods run in shadow, so overall trial throughput cannot be attributed to a single controller. The current full binocular core exceeds the25Hz real-time budget before rendering or body work.

**Decision:** preserve the failed candidate; do not enable an ordinary scene/default controller or scale this candidate to30seeds. The result supports a functioning custom circuit adapter and exposes an unqualified visual controller. A fresh renderer/body protocol is required after a successful diagnostic. No broad neural advantage or full-proposal completion is claimed.

## Aperture-aware replay: accurate reconstruction, no demonstrated gait fix

The [replay diagnostic](reports/aperture-v2-replay-diagnostic-1-summary.json) regenerates28 recorded movies,1700 frames, including all six no-vision/direct body trajectories. Every conditioned neural baseline matches exactly; original v1 flow diagnostics differ by at most1.14e−13. The [archive](reports/aperture-v2-replay-diagnostic-1.json.gz) retains raw signed T4/T5 maps for600 physical frames, along with source/model identity. The new solver therefore faces the same input history.

The aperture-aware v2 solver with the declared horizontal constraint slightly improves the **reused** frozen-pose rate score,0.02539→0.02327rad/s, while retaining zero false-turn frames. This is diagnostic reuse of previously inspected data, not a fresh held-out acceptance result. On each recorded body trajectory, its error against the approximate panorama-minus-trunk-yaw rate is slightly worse than v1; the first panorama trajectory changes0.984→1.015rad/s, with conventional flow0.694rad/s. Peak decoded rates are not reduced.

That proxy excludes head motion and camera pitch/roll or translation, so it cannot establish the true retinal flow error. It does show that changing the aperture solver alone has not yet explained the physical result. The [prospective V3 draft](PROTOCOL-v3-draft.md) remains inactive. Next diagnosis reconstructs the actual camera poses using the archived physical runtime and recorded applied commands, requiring body-state parity and sampled-retina parity before any reconstructed pose is accepted. Reconstructed poses must be labeled as such; they are not retroactive original measurements.
