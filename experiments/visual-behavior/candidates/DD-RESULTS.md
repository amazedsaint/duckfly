# Published displacement model: reproduced, not promoted

The independent equation implementation matches the official model numerically. It improves the synthetic object-versus-flicker comparison, but the frozen action threshold fails the broader rendered-scene test. No candidate from this study is connected to duck controls.

## Exact reproduction

Reference: [Tanaka and Clark, Current Biology 2020](https://doi.org/10.1016/j.cub.2020.04.068), [official DDModel repository at c98d06a](https://github.com/ClarkLabCode/DDModel/tree/c98d06aae1c16b3ad7ed92c609a6b43c617a296a).

`ddmodel-equations.py` independently implements the published computation. It uses a temporal high-pass stage and full-wave rectification, followed by a rectified difference-of-Gaussians filter. A low-pass adaptation state divides the response before spatial and temporal output pooling. Parameters are the source defaults: 180 Hz; 5° sampling; 200 ms high-pass constant; spatial sigmas5°/15° with surround weight3.5; adaptation300 ms with gain1000; output sigma10° and time constant300 ms. The implementation deliberately preserves the reference's unusual boundary padding and its exact time vector.

The upstream repository had no license file or license metadata when inspected. Its source and stimuli are downloaded only into ignored `.cache/`; no upstream source is vendored. An isolated Conda-forge Octave10.3.0 executed the untouched official `.m` function. No model equation or parameter was modified for the oracle. Octave's CSV reader discards trailing empty fields that MATLAB retains, so a format adapter writes zero in the unused final field. The decoded stimulus arrays match exactly.

The comparison covers all20 published center response traces across Fig4F size tuning and Fig4L local flicker, plus every element of the full first-epoch stage arrays for both groups. Maximum center-trace discrepancy is7.55e-17; maximum internal-stage discrepancy is2.29e-15. The prespecified tolerances were absolute1e-9 and relative1e-6. Original-code arrays are retained in `reports/candidates-dd-Fig4*-oracle.mat`; identities and comparison receipts are in `candidates-dd-original-code-parity.json`.

The result establishes equivalence to this published computation on those inputs. It does not establish that DuckFly contains biological LC11 neurons or that model output has a validated connection to stopping.

## Published stimulus checks

Size tuning peaks at15° in the released square-size cohort; output is near zero for≥50° squares. On the released local-stimulus cohort, mean translation response is0.0004384; mean1–20Hz flicker response is0.0002185, approximately a2.0× preference. This is a preference, not total rejection of flicker.

Equation interventions support the intended mechanism. With adaptation removed,1Hz flicker produces0.01309 mean response versus0.00281 for translation. Removing the surround also eliminates the favorable translation-versus-flicker relationship. These interventions are model ablations, not neuron silencing. All traces are retained in `candidates-dd-ablation.json`; baseline original-code equivalence is checked separately.

## Transfer protocol, fixed before the run

The score receives only pixels and their capture times. A14×14 grid at5° spacing lies within the actual75° vertical camera FOV. Pinhole sampling follows the app's projection law; the input is held causally at180Hz between captured frames. This does not recover temporal detail absent from the25Hz source. Four seconds of first-frame conditioning precede each movie.

The operational score is the maximum local output in the observation window minus the maximum during the preceding baseline window. Baseline window:3.2–4.24s. Observation window:4.24–5.8s. The physical movie runs4–5.2s, followed by a held final frame. Threshold0.0007153802979611501 was frozen from calibration to permit at most5% of the pooled specified confounds. No tuning followed held-out or arena results. This threshold and projection are engineering choices; they are not published biological firing thresholds.

| Cohort | Object motion | Confound responses | Decision |
|---|---:|---:|---|
| Calibration, uniform background |16/16 pass/step |1/24 bar/flicker/flash | Pass |
| Retained held-out movies |56/64 pass/step |3/96 bar/flicker/flash | Fail90% recall gate |
| Retained textured passing objects |32/32 |0/32 background rotations | Bounded positive result |
| Initial actual-arena beacon passes |0/2 |0/2 bars;0/2 dimming | Transfer sensitivity fails |

Detected held-out events have median onset-relative latency232ms, range99–516ms. All224 held-out frozen-frame controls remain below threshold. The test is held out from this candidate's calibration, but those movie cohorts were previously used by other candidates; it is not an untouched project-wide test set. Repeated frames do not count as independent trials.

## Broader actual-renderer test

The next fixed cohort uses actual LabArena geometry, floor grid, shadows and materials. It retains66 movies with2046 exact RGBA frames, spanning six size/distance/color/direction combinations per family. Every movie also receives a frozen control and reversed-time control. Camera and props are posed explicitly; no physical controller is run. The contact sheet is `reports/candidates-arena-dd-v1-contact-sheet.png`.

| Rendered family | Responses / movies |
|---|---:|
| Passing target |5/6 |
| Brief target step |4/6 |
| Passing target among static clutter |5/6 |
| Tall moving bar |4/6 |
| Stationary object flicker |1/6 |
| Local object dimming |1/6 |
| Broad scene dimming |0/6 |
| Empty scene camera pan |0/6 |
| Static target during camera pan |1/6 |
| Moving target with camera pan |0/6 |
| Static target |0/6 |

All66 frozen controls are null. Reversing target motion generally preserves responses; no direction selectivity is claimed. The full traces and fixed-threshold decisions are in `candidates-dd-arena-screen-v1*`.

The bar result has a useful geometric explanation, but remains a product-level failure. The same32cm tall bar subtends37.3° at the nearer tested position,26.8° at the middle position and20.9° at the far position. Both37.3° cases are rejected. All four20.9°/26.8° cases cross threshold. Its width is about4.1–7.8°. A large world object can occupy a relatively small retinal patch, and square-size tuning does not establish rejection of every narrow rectangle. The published default sigmas are specified in retinal degrees. Calling every tall scene object a mandatory biological negative would overstate what the model promises. For the proposed app behavior, these unwanted pauses still count against usefulness.

The target-plus-pan cohort also cannot establish a general camera-motion defect by itself. The imposed pan can reduce relative retinal target displacement while adding background motion. Its failure shows that this candidate does not support a promise of persistent world-object tracking during self-motion. Any future motor bridge must distinguish object motion on the retina from motion in the world.

## What is retained, and what stops here

Keep the verified equation implementation as a research comparison and a possible future circuit inspector. Do not lower its threshold after seeing these cases and relabel the same cohort as validation. Do not attach the present score to a stop command. A useful next neural experiment would need independent retinal-angle sampling tests, stronger held-out flicker controls and explicit self-motion conditions before a body-level intervention.

The actual Flyvis T2/T3 sidecar in this folder was derived from verified source node types/coordinates, with all packaged parameter arrays checked against the reference. Its simple adaptive pooling candidate failed: bars and flashes often exceeded object responses. Directly replacing the published DD rectified center-surround inputs with those T3 activations would change the model. The gain units and spatial support need an explicit mapping; there is no evidence here that such substitution preserves tuning. No biological LC11 circuit is claimed from either approach.

Earlier pixel silhouette candidates passed their declared flat-background study but rejected368/372 actual-rendered frames as unsupported. The T4/T5 spatial footprint candidate admitted stationary flicker. Their failures and exact inputs remain available. The evidence does not support promoting any of them as a general camera-to-pause pathway.

## Reproduction

Run `python3 candidates/fetch-ddmodel-reference.py` from the experiment directory, then use NumPy/SciPy for `ddmodel-equations.py`, `ddmodel-transfer.py` and `ddmodel-arena-screen.py`. `fetch-ddmodel-reference.py` verifies the pinned SHA256 values and creates the explicit Octave CSV adapter.

Execute `run-ddmodel-oracle.m` with an available Octave runtime. The isolated Conda build needed `OCTAVE_HOME` and `OCTAVE_EXEC_HOME` set to its own prefix to avoid malformed relocated internal paths. It also needs gnuplot for the original function's hidden figures. The harness writes oracle arrays under `.cache`; copy those generated arrays, unchanged, to the `reports/candidates-dd-<group>-oracle.mat` names before `compare-ddmodel-oracle.py`. The harness's executed SHA256 is32870e81de5b706393fcfc5b32bf9ab1fe82a5a225cc1b6e9cc088459a5ea989.

One intermediate receipt used a path-only revision of the harness that was not executed. It is retained as `candidates-dd-original-code-parity-path-only-revision.json` because some transfer reports reference its hash. The current parity receipt restores the exact executed harness identity; numerical source and oracle arrays are unchanged. This correction affects provenance metadata only.

For the new rendered cohort, run `arena-dd-server.mjs`, load `arena-dd-browser.mjs` in a separate browser on the existing Vite origin and invoke `runArenaDD()`. Close the collector and browser when capture completes. The screen script refuses changes to the frozen DD equation/readout sources. No runtime app files are modified.
