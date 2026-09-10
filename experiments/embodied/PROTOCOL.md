# Embodied brain/duck improvements

Written before candidate results. Baseline: 8d7d64a / application 11cdb8f. Existing circuit and walking-policy assets stay frozen. Prior failed confirmation sets are descriptive references only; new seeds use the `embodied-v1` prefix.

## Separate questions

1. Does a decaying remembered visual direction improve reacquisition compared with the current sinusoidal head search? Test inverted memory as a causal falsifier. Remember pixels/camera pose only; never pass object coordinates into the controller. Lost, covered or stale vision must still block forward walking.
2. Does graded, acceleration-limited conversion of forward-neuron activity improve approach smoothness without losing useful progress? Compare with the current binary conversion; do not change the balance policy.
3. Does measured command error and foot contact provide useful ascending feedback? Compare actual feedback with unrelated delayed/scrambled feedback. Any mapping into fly neurons is an engineered hypothesis. Compare blocked motion and perturbed footing with ordinary following.
4. Does full Flyvis provide useful visual features on the duck's eye movies? First run the pinned 45,669-cell model with its actual integration cadence. Compare a small downstream decoder with raw retinal features on whole held-out trajectories. Incorrect/reversed temporal features are a falsifier. Numerical parity alone cannot promote a controller.
5. Can a small adapter selected by physical trial reward improve unfamiliar scenes? Restrict the candidate bank before training, compare with unchanged weights and permuted training rewards, then freeze the selected adapter before a fresh evaluation. No connectome or walking-policy training is implied.
6. Can a distinct upstream body-skill policy run correctly in our body model? First check policy availability and input/output semantics, then test physical execution and handoff. Shape equality alone is insufficient. Reject incompatible artifacts and retain an explicit blocked/no-promotion result if no compatible trained policy exists.

## Physical screen and confirmation

Use actual Three.js eye images, MuJoCo and the pinned ONNX policy at 50 Hz motor ticks. A trial is eight simulated seconds. Families: lateral moving target, temporary occlusion, target reposition, blocked approach, and slippery contact. Include a fixed-target control. Pilot uses two seeds per family and each declared candidate. Stop a candidate with extra falls, unsafe forward commands, or no benefit on its stated metric. Coefficients are fixed in candidates.js before pilot; no post-hoc tuning against confirmation.

Promote pursuit only after a new confirmation (eight seeds per family) improves mean late target distance by at least 3 cm with a positive paired 95% bootstrap interval, no family regression above 2 cm, no additional falls, and no more than five percentage points additional contact trials. Remembered direction must beat inverted memory on reacquisition to support a memory claim.

Smooth movement must reduce command total variation by at least 20%, retain at least 95% of baseline mean approach progress, and add no falls or contact trials. Body-feedback promotion must improve the perturbed/blocked outcomes against both original and unrelated feedback without worsening ordinary following; a mere change in firing is insufficient. Small pilots can reject candidates but cannot establish general reliability.

Learning uses a separate training split and whole-scene evaluation. A selected candidate must meet the pursuit gates; shuffled rewards must not reproduce the benefit. Full Flyvis first faces an offline gate: improve held-out decoder error by at least 10% versus the equal-capacity raw-retina decoder and outperform shuffled features. It then needs latency-matched physical confirmation under the same safety gates. If the offline gate fails, retain the model in the visual bench.

## Product integration

Only tested behavior is offered. A failed performance gate never becomes a claimed improvement. Useful causal experiments may remain explicitly optional and default off. Every opened scene remains unlimited in duration. New controller state/settings must round trip through scenes and replay; output cuts and stale/covered vision remain authoritative. Validate desktop/mobile UI and packaged Mac execution, then deploy the accepted build to the existing ContextMind project. Retain all trials and model/source hashes.
