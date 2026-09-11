# Neural-map motion, candidate 1

The prior pooled direction decoder falsely called motion for uniform flash and flicker. This candidate instead estimates pattern displacement from the **full signed raw T4/T5 maps**, using spatial derivatives in angular coordinates and differences between consecutive neural times. Each population's spatially common temporal change is removed before fitting motion. Baseline-subtracted maps are retained by the extractor but are not used as the optical-flow image: subtracting the first textured view would add a fixed pattern to a moving one.

This is an engineered Lucas–Kanade-style readout of modeled neural activity, not an HS/VS model or an anatomical visual-to-body bridge. The aperture problem remains: a single oriented pattern reveals normal motion, not its unobserved tangent component. No neuron label is assigned a cardinal direction.

## Fixed calibration and fresh held-out split

Calibration contains 16 drifting-grating trials: cardinal image directions, wavelengths 10/18 degrees and speeds 60/120 degrees per second, contrast 0.65. These determine only a minimum spatial-gradient strength: one quarter of the tenth percentile of calibration frame gradient RMS during the analysis window. No directional or speed coefficients are fitted.

Held-out seeds 4000–4029 are disjoint from the previous study. They use intermediate image directions, wavelengths from 11–19 degrees, speeds from 72–108 degrees per second, varied contrast and phase. Each seed has drifting grating, bright edge and dark edge trials. Controls are blank, uniform flash, uniform flicker, an unchanged patterned scene, counterphase pattern flicker and illumination change over that unchanged pattern. Total: 286 trials. The unchanged, counterphase and illumination controls share their initial pattern with the corresponding drifting trial.

Each independently initialized eye fades from gray into the actual initial image for one second at the reference 500 Hz. Identical initial images reuse an exact conditioned checkpoint; recurrent test state remains separate. Movies last 0.6 s, captured every 20 ms and held for ten WASM steps per frame. The analysis window starts at 0.1 s. Uniform flashes begin at 0.12 s, inside that window. No actual stimulus motion occurs in the counterphase or illumination controls.

## Gates fixed before execution

- The motion equation must explain at least 20% of residual temporal variation and stay below 360 degrees/s; otherwise the output abstains. Spatial signal must exceed the calibration-only threshold.
- At least 90% of trials in each moving family must have ≥50% available frames and median-vector direction error ≤30 degrees. Unavailable outputs count against coverage. Median relative speed error must be ≤35%; unavailable trial estimates count as zero speed rather than being dropped.
- A stationary trial is a false turn if at least two consecutive analyzed frames return available motion above 3 degrees/s. Each control family may have at most 5% such trials. Also retain the fraction of analyzed frames that would request a false turn.
- Spatial-mean ablation and temporal-history ablation must eliminate available motion for retained matched probe pairs. This establishes dependence on spatial/temporal neural records, not superiority over conventional pixel vision.
- Report runtime costs separately. Even a successful synthetic gate only authorizes comparison in the actual renderer/body harness, not production control.

Every held-out failure remains in the denominator. All sampled inputs, per-frame neural-map hashes and fitted diagnostics are retained with model/source hashes. Calibration freezes before held-out trials are analyzed. Representative exact replays verify the retained neural-map hashes and diagnostics. Any revised thresholds or algorithm require a separately identified candidate and fresh held-out seeds.
