# Temporal vision and hazard feedback, 2026-09-10

Baseline `8107e3b`. Written before collecting training sequences or fitting a decoder. Keep the 668-neuron circuit weights, GF gain 6, ONNX walking policy and motor limits fixed.

## Model and data

Collect actual MuJoCo / Three.js stereo camera sequences at 25 Hz while the fixed walking policy moves or stands. Use eight scene families: incoming object that stops short then retreats; parked blocker; lateral crossing; approaching near-miss; receding object; empty walkway; stationary head scanning; blocker moved away. Randomize placements, object size and grayscale polarity, with bounded head movement and independently scheduled pauses during collection.

Training: 32 seeds per family. Validation: 8 different seeds per family. Five simulated seconds per sequence. Entire trajectories are disjoint across splits. Reserve fresh evaluation seeds; do not inspect them during model selection. Scene coordinates and programmed object velocities are used only for labels and evaluation, never for inference.

The label asks whether resuming forward travel at 0.12 m/s would bring the duck within the object's physical radius plus 0.09 m in the next 3 seconds, under constant relative velocity. This is an engineered collision-risk label, not fly physiology or exact future physics. Retain post-contact frames but exclude them from fitting. The decoder must work from camera sequences and measured body/camera feedback.

Input: five stereo luminance snapshots (16 × 8 per eye) separated by 120 ms, spanning 480 ms, plus local camera angular velocity, head/body alignment and measured gait feedback. Fit a small MLP (64 and 32 hidden units), binary cross-entropy, Adam, at most 40 epochs; select the epoch by trajectory-balanced validation loss. Fixed training seed. Retrain matched static-history and no-pose controls using the same capacity and optimization budget. No architecture or coefficient search on held-out data.

Select the neural trigger threshold from [0.6, 0.7, 0.8, 0.9, 0.95, 0.98] on validation only: at most 10% of truly harmless trajectories may trigger, and maximize timely detection of hazardous trajectories. Require validation AUROC ≥0.90 and timely hazard detection ≥80% to proceed to physical evaluation. Evaluate incorrect pose and shuffled temporal order as inference interventions. If temporal or pose information is not useful, report that boundary explicitly.

Operational definitions frozen after the eight-trajectory plumbing smoke test, before train/validation collection: Adam learning rate 0.001, batch size 256, seed 20260910, 40 epochs, no additional feature scaling. Give each trajectory equal total loss weight. Exclude frames at or after the first contact or fall from fitting and perception metrics. A hazardous trajectory has at least one positive retained label; a harmless trajectory has none. Timely detection means a threshold exceedance from 0.5 seconds before its first positive label through 0.5 seconds after that label, capped at 0.12 seconds before contact. Resolve threshold ties toward the higher threshold. Static and no-pose controls select their own threshold by the same rule. The order intervention reverses history deterministically. Scripted velocity changes occur on the regular 25 Hz capture cadence.

Physical hazard strata are fixed by scene family, independently of any controller outcome: incoming, parked, crossing and retreat are potential-hazard environments; near-miss, receding, empty and scan are controls. Report family-level outcomes so this coarse grouping cannot hide benign crossing cases. Use a matched per-case bootstrap with 10,000 draws and seed 20260910. AUROC and confidence intervals describe this procedural simulator distribution only.

## Neural bridge and feedback state

An isolated 20-seed bridge check, retained in `reports/bridge-probe.json`, found that a 200 ms unit input to the existing combined LC4/LPLC2 route reliably recruited GF at gain 6; the LPLC2-only route did not. Use the combined existing route with explicit engineered-adapter provenance. Do not alter circuit weights or directly manufacture GF activity.

A decoder threshold crossing produces a bounded 200 ms loom-input pulse. Rearm after fresh low-risk evidence. Compare the existing timed stop with a hazard-aware supervisor engaged only by an actual GF event. The supervisor holds forward/yaw output at zero until fresh risk stays below half the trigger threshold for 400 ms and measured speed stays below 0.04 m/s for 120 ms. It must hold through stale or covered input, and cannot authorize motion when the underlying controller or an intervention disables it. A deliberately silenced GF must prevent the new supervisor from engaging.

## Physical gates

After freezing weights and threshold, evaluate 16 fresh seeds per family. Matched conditions: existing compact-motion baseline; compact motion with the same combined neural route; temporal decoder with timed stop; temporal decoder with hazard feedback; static-history decoder with hazard feedback; temporal decoder with GF silenced. Same environment and neural seed per condition. Five seconds per trial, all outcomes retained.

Promotion requires a ≥20 percentage-point reduction in contact trials on hazardous environments versus the original baseline, with a positive paired 95% bootstrap interval. No extra falls. On harmless environments, false-stop incidence ≤10% and no more than 5 percentage points above baseline; mean forward progress ≥90% of baseline. The hazard-aware loop must not increase contacts versus the same decoder with a timed stop. Report benefit and limitations of each component separately; a passing perception metric alone cannot promote a controller.

Before app integration: tests for fresh-input recovery, covered eyes and source changes; speed feedback and hysteresis; GF/output interventions; exact state replay across JSON export; numerical agreement between Python and browser decoder. Legacy recordings and default model semantics remain available. If physical gates fail, retain runnable research code and evidence without changing production defaults.
