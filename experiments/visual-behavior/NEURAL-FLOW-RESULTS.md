# Spatial and temporal structure improves rejection, with a retained direction failure

The first full-map candidate uses an explicit motion equation on signed raw T4/T5 activity. It removes each population's spatially common temporal change before estimating movement. This is an engineering readout of the actual packaged Flyvis checkpoint, not an added HS/VS neuron model.

## Candidate 1

The frozen study ran 286 movies, with 30 fresh held-out seeds for each family. Uniform flicker, illumination change over texture and unchanged-pattern controls were included. Each initial image received the reference one-second fade-in; 99 distinct conditioned checkpoints were reused only when their exact input hashes matched. Test eyes remained independent.

| Gate | Result | Decision |
|---|---|---|
| Moving grating | 23/30 trials within the fixed direction/coverage gate; median relative speed error 16.3% | **Fail** |
| Bright moving edge | 28/30; median relative speed error 7.8% | Pass |
| Dark moving edge | 30/30; median relative speed error 6.3% | Pass |
| Each stationary control family | 0/30 trials with two consecutive available false-motion frames | Pass for the declared sustained-event gate |
| Spatial and history ablations | Motion removed in each of the retained matched probe pairs | Pass for those probes |
| Overall admission | Grating gate failed | **No renderer/body admission from this study** |

The sustained-event result must not be confused with per-frame silence. Uniform flashes produced 15 isolated false-motion frames out of 750 analyzed frames; uniform flicker produced 48/750. The other stationary families had none. A controller consuming every raw frame does not inherit the sustained-event gate.

The neural core took median 16.23 ms and p95 17.52 ms per 20 ms interval. Extraction added median 0.831 ms; this decoder added median 0.173 ms. These are separate component timings, not a measured browser/body loop. Slow intervals remain in the evidence.

Exact replay reproduced all neural-map hashes and every decoder diagnostic for ten selected trials covering the calibration example and every family at held-out seed 4000. It does not claim all trials were independently replayed. All original trials and source hashes remain under `reports/neural-flow-v1/`.

## Why a second candidate is justified

Calibration-only inspection exposed an unsupported tangent estimate. For a horizontal 18-degree grating moving at 60 degrees/s, the original solve gave vx≈61.7 but vy≈118.1. The spatial tensor was nearly rank one, so its small second eigenvalue did not justify estimating that component. A separate synthetic plane-wave check found finite-grid direction bias of only about 1–7.5 degrees, which could not explain the entire observed failure.

Candidate 2 therefore uses symmetric fourth-order hex-grid derivatives and explicitly discards the unresolved tangent eigenmode. Its output reports whether one or both motion components are observed. Analytic tests verify that two physically different stripe motions with identical images produce the same rank-one observation; an invisible tangent is not relabeled zero physical motion.

The actual-WASM candidate 2 evaluation uses fresh seeds and intermediate directions, with the previous gates unchanged. All 30 grating trials and all 60 moving-edge trials passed. Median direction errors were 0.051 degrees for gratings, 0.226 for bright edges and 0.127 for dark edges. Median relative speed errors were 5.5%, 1.7% and 2.3% respectively. Every stationary-control frame was rejected: zero false-motion frames out of 4,500 analyzed frames. The matched spatial/history ablations passed.

Those outcomes are recorded separately under `reports/neural-flow-v2/`; candidate 1 remains an overall failed admission. No claim of physical usefulness follows from these map-level tests alone.

## Coverage audit and confirmation

The intended wavelength ranges were not actually exercised by the original random generators. Consecutive LCG seeds produced a narrow first draw: candidate 1 covered only 17.290–17.380 degrees, and candidate 2 covered 15.491–15.581. Contrast, speed and phase varied broadly. This limits the spatial-frequency interpretation of both runs.

Both summary files now explicitly include actual parameter ranges and the failed generator-coverage audit. Each untouched original summary remains as `summary.pre-coverage.json`; its exact replay hash still points to that archived original. The added annotation is dated and identified as post-execution. Candidate 2's measured pass is retained, but broad admission is held closed until a separate confirmation covers the declared range.

The stratified confirmation uses new identities (8000–8029), disjoint angle values and explicit strata across every intended parameter range. The generator must populate all eight bins per parameter before the model is loaded. Its frozen candidate 2 gradient threshold must exactly match the earlier calibration, so this confirmation cannot quietly retune the decoder. Its results are under `reports/neural-flow-v2-stratified/`.

That confirmation passed. All 90 moving trials met the direction/coverage gates. Median direction errors were 0.071 degrees for gratings, 0.178 for bright edges and 0.325 for dark edges. Median relative rate errors were 6.00%, 1.62% and 1.93%. Every stationary family had zero false-motion frames, totaling 0/4,500 analyzed frames. The declared ablations passed.

Actual wavelengths spanned 11.133–18.867 degrees; speeds spanned 72.6–107.4 degrees/s. Contrast covered 0.407–0.793, with phase distributed across its full intended interval. All eight bins were occupied in every parameter, and the held-out directions were disjoint from the previous sets. The gradient threshold exactly matched the previous candidate 2 calibration: `0.006455187013519394`. No neural parameter, readout parameter or threshold was retuned for the confirmation.

The final one-eye core cost was median 16.12 ms and p95 18.06 ms per 20 ms neural interval. Extraction added median 0.826 ms; the candidate 2 decoder added median 0.283 ms. The largest core interval reached 83.75 ms during this local run and remains in the timing report. These measurements are not a guaranteed two-eye browser budget.

The resulting admission is **visual candidate ready for independent renderer/body comparison**. The physical controller, body-induced camera motion and neural-to-motor bridge still need their own tests. A passed image-motion equation is not a measured improvement in walking, and it cannot recover the unobservable tangent of a striped scene.
