# DuckFly visual-system development recommendation

Research date: 2026-09-10. Scope: source review, literature research and synthetic probes of the existing code. No application behavior or deployment was changed.

**Recommended direction:** retain Microduck's walking policy and replace the visual front end through a validated, interchangeable model interface. Use Flyvis as the numerical reference for early visual processing. Validate a bounded looming pathway before extending pursuit. Package an equivalent inference core for both app surfaces only after the reference responses pass. Improve capture timing and experimental controls first.

The intended scientific result is that a biologically constrained visual model reproduces specified neural response properties and causally changes a duck's response to approaching objects. Better biological correspondence and better robot control are separate outcomes.

## Evidence from the current checkout

`checkout-manifest.json` records hashes of inspected application files and the pinned walking policy. This checkout has no committed baseline; Git reports the project folders as untracked. Make an initial reviewed baseline before implementing the proposed changes.

All existing 25 tests pass (`current-tests.log`). The additional research probes expose limitations that those tests do not cover. Run them with:

```sh
node docs/research/2026-09-10-vision/probe-current-vision.mjs
```

| Finding | Current evidence | Consequence |
|---|---|---|
| Looming depends on threat color | An expanding red disk produces loom 1.0; the corresponding black disk produces 0.0 in the synthetic pair test | It is currently a colored-prop experiment, with limited support for general looming |
| Appearance is confused with expansion | A red disk appearing at its final size produces loom 1.0 | Area increase alone does not distinguish an approaching object from an abrupt appearance |
| A flash can recruit the escape pathway | A uniform red flash produces loom [1,1] and a Giant Fiber stop in the circuit probe | A downstream neuron intervention cannot validate the upstream visual interpretation |
| Source selection changes the algorithm | The same expanding grayscale texture produces loom [0,0] as duck-eye input and approximately [0.976,0.976] as webcam input | Identical images need a shared model path, with source differences confined to calibration |
| The eyes are image halves | `lab-arena.js:56` constructs one 75-degree perspective camera per duck; `vision.js:13-15` masks image halves | The current eye-covering experiment does not represent two compound eyes |
| Vision normally updates at 10 simulated Hz | `experiment.js:33,44,49` samples every fifth 20 ms tick | High-frequency visual tuning and response timing cannot be inferred from this cadence |
| Webcam acquisition has no capture clock | `main.js:74,102` reads the available video image; `experiment.js:49` assigns simulation time | Simulation slowdown can alter estimated motion speed; repeated old images can be relabeled as fresh |
| Head behavior is a target-bearing rule | `vision.js:88` tracks the marker or issues a sinusoidal search command | This does not stabilize the retinal image against walking-induced head/body motion |
| Direct pathways bypass the neural circuit | Target-loss gating and head commands are set outside `Brain`; reactive/manual modes override neural movement | Record the origin of every action so circuit effects can be separated from engineered behavior |
| The comparison task has weak scope | `benchmarks.js` has two held-out target placements and uses the same task for the default GF intervention | There is no approaching threat in that comparison; it is a weak assay of the looming pathway |
| Controller comparison uses different gains | Reactive motion uses 0.25 m/s while neural forward intent uses 0.30 m/s | Equalize limits and give both controllers the same calibration budget before interpreting performance differences |

These are synthetic and source-level findings. The webcam relabeling probe does not reproduce a physical camera freeze. The red-flash probe verifies a circuit stop event, not a complete physical stopping trajectory. See `current-vision-probes.json` for raw results.

## What the research changes about the plan

### Flyvis is the preferred early-vision reference

Flyvis implements a motion-processing network constrained by measured connectivity. The published model uses about 45,700 neurons across 64 biological cell types, with unknown physiological parameters optimized for motion estimation. It was evaluated against neural response measurements. Its output is continuous neural activity, not a spike train. These properties make it a useful reference for the sensory part of DuckFly. [Lappalainen et al., Nature 2024](https://www.nature.com/articles/s41586-024-07939-3)

The current source represents 65 named units because CT1 has separate modeled compartments. Its output list includes T4/T5 and transmedullary populations. It does **not** contain LPLC2, LC4, LC10, DNa01, DNa02 or DNp09. `flyvis-source-audit.json` records this check. It therefore cannot directly replace the whole DuckFly controller. [Pinned connectome specification](https://github.com/TuragaLab/flyvis/blob/92b3845cc426dd309a1a0e1b3890156c42e14021/flyvis/connectome/fib25-fib19_v2.2.json)

The default dynamics are sparse weighted sums of rectified activity followed by a first-order state update. The time-constant denominator is clamped against the integration step. A port that changes step size carelessly can change effective neural dynamics. Preserve the exact equations and exported parameters before attempting a reduced approximation. [Pinned dynamics](https://github.com/TuragaLab/flyvis/blob/92b3845cc426dd309a1a0e1b3890156c42e14021/flyvis/network/dynamics.py)

### NeuroMechFly already provides the streaming pattern

The NeuroMechFly v2 study integrated Flyvis one frame at a time with independent eye states, sampling vision and neural dynamics at 500 Hz in the reported experiment. It also examined head stabilization during following. That provides a stronger integration precedent than assembling a new connection from the library README alone. Its following readout remains a modeled transformation; it is not evidence of a complete visual-to-descending connectome. [NeuroMechFly v2, Nature Methods 2024](https://www.nature.com/articles/s41592-024-02497-y)

The retained FlyGym v1.2.1 example implements state initialization/fade-in and explicit step-by-step updates. `RetinaMapper` reorders the 721 ommatidia because FlyGym and Flyvis use different index conventions. Matching array lengths is insufficient. The example forces CPU operation; that is not a performance measurement for our Mac. [Streaming implementation](https://github.com/NeLy-EPFL/flygym/blob/c7affce924cb1c6add16619adf83be5c6b223e89/flygym/examples/vision/vision_network.py)

Pin this reference. FlyGym 2.x is a rewrite and current main no longer has the same example paths. Importing an unpinned latest package would not reproduce this integration. [FlyGym changelog](https://neuromechfly.org/changelog/)

### Looming has a better first validation target than general pursuit

LPLC2's radial-motion computation supplies specific tests involving expansion and motion opponency. Implement its spatial inputs with explicit receptive-field coordinates and inhibition, then compare response properties to published experiments. Do not derive visual receptive fields from neuron soma coordinates in `brain_points.json`. [Klapoetke et al., Nature 2017](https://www.nature.com/articles/nature24626)

Clark Lab's shallow collision models are useful alternative baselines. Their study found different solutions with strong task performance, only one of which matched the relevant LPLC2 organization. This supports separate biological and behavioral gates. The code is a research pipeline, not a ready browser runtime; its complete training instructions call for substantial resources. [Paper](https://elifesciences.org/articles/72067), [implementation](https://github.com/ClarkLabCode/LoomDetectionANN)

The first bridge should use the LPLC2 branch into GF with documented omissions. LC4 requires its own visual model and tests; do not feed a generic expansion scalar identically into both populations. The existing sixfold GF-input gain must become an explicit tested parameter, not an implicit anatomical fact.

### Pursuit should be a later, separate pathway

The Murthy Lab model predicts activity at an LC population bottleneck and behavior in a specific social context. It is useful as a comparison for later visual tracking, but it has a different granularity from our individual spiking cells. It is not a substitute for a retina-to-optic-lobe model. [Cowley et al., Nature 2024](https://www.nature.com/articles/s41586-024-07451-8)

Research on walking steering distinguishes sustained and transient descending control and supports a role for bilateral DNa02 activity differences. Our current pooled DNa01/02 readout is a simplification. A later pursuit extension should preserve the populations separately and fit a declared readout; directly exciting them from a colored centroid remains an engineered baseline. [Rayshubskiy et al., eLife 2025](https://elifesciences.org/articles/102230)

## Options and decision

| Option | Useful contribution | Decision |
|---|---|---|
| Flyvis reference with an equivalent portable inference core | Published early-vision model; per-cell response tests; one numerical definition across app surfaces | Main direction, contingent on reference reproduction and runtime profiling |
| Compact motion-detector/LPLC2 model | Small experimental baseline; easier to diagnose and execute locally | Implement or reproduce as a benchmark opponent, then compare on the same inputs |
| LC population model trained on social behavior | Learned visual representations associated with identified populations | Later pursuit comparison; do not silently treat population output as individual spikes |
| Whole-brain replacement or MaleCNS motor transplant | More anatomy and a larger experimental scope | Defer. Neither supplies a validated mapping to a 14-actuator biped or resolves present input defects |

## Proposed implementation sequence

### Change 1: Make time and action provenance explicit

Split acquisition from encoding. Introduce frame packets with source ID, monotonically increasing frame ID, acquisition timestamp and simulation timestamp. Include camera calibration and physical pose. Simulation frames use the simulator clock; webcam frames use their actual capture/media clock. Repeated frame IDs do not become new observations. Define an explicit pause/resume policy for live input.

Unify the vision algorithm across image sources. Keep differences in source calibration and input bandwidth visible. A 30 fps webcam cannot supply 500 distinct images each second. The neural integrator may substep with a held observation, but metadata must retain the actual capture cadence.

Record neural intent separately from the final command. Attach reasons to target-loss gates and head commands. Preserve current presets as the marker-based baseline.

Acceptance: clock-slowdown and frozen-stream fixtures behave predictably; the same calibrated frame sequence yields identical features regardless of source label. Existing recording and scene files continue to load through a schema migration.

### Change 2: Add a retinal stimulus bench and calibrated eyes

Provide one canonical movie format for synthetic stimuli and recorded cameras. Add separate virtual eye views with a versioned ommatidial index map and an explicit angular calibration. Maintain independent state for each eye and duck.

Use moving ON/OFF edges, expanding/receding disks, lateral translation, uniform flashes and body/head rotations. Include texture changes and objects entering the field of view. Evaluate motion caused by the duck separately from motion caused by an approaching object.

Add a bounded head-stabilization experiment using available body orientation and joint feedback. Keep it distinct from target tracking. Assess retinal jitter as well as false alarms. Avoid subtracting all self-motion: forward motion toward an obstacle produces useful collision evidence.

Acceptance: verify left/right mapping with known stimuli, physical head rotations and wall occlusion. Test the index-map round trip and actual neighboring receptive fields. Set reference stimuli in visual degrees, not only pixels or world meters.

### Change 3: Reproduce the reference and test the looming bridge offline

Use an isolated Python research environment with pinned Flyvis/FlyGym source and a hash-verified published checkpoint. Start with reference initialization and its original integration settings. Export neural response fixtures, including full state needed for continuation. Run more than one checkpoint for scientific robustness after one reference reproduces successfully.

Construct the bounded LPLC2 bridge from spatial T4/T5 activity with literature-based parameters or a separately fitted physiological model. Convert continuous activity to the downstream model's input through an explicitly calibrated interface. Record the units and fitted parameters. Disable the old color-based looming injection for this experimental condition.

Acceptance: reproduce the reference's ON/OFF and directional response properties, then evaluate LPLC2 tuning using held-out published stimuli where suitable data can be retrieved. Data access and preprocessing have not yet been reproduced in this turn. Fit a measurement model when comparing simulated voltage or spikes with calcium recordings.

A stop after arbitrary current injection is not an acceptance test for vision. Require changes under T4/T5 or LPLC2 interventions upstream, alongside the downstream GF intervention. If the response only works with a narrow arbitrary gain, report the failed robustness test and revise the bridge.

### Change 4: Build one portable inference implementation

The first packaging candidate is a sparse Float32 state update in a shared WebAssembly core, with explicit state input/output. Keep the Python implementation as the numerical oracle. Consider ONNX only after verifying that a single-step export preserves sparse operations and runs efficiently on the actual target execution providers. Avoid a dense neuron-by-neuron matrix.

Start with the complete reference field of view. Pruning recurrent ancestors or reducing the retinal lattice changes the model and needs its own validation. Distillation is a later option, with a separate model identity and the same response tests.

WebGPU is an optional acceleration path. The existing native app is a WKWebView host supporting macOS 14; a result in Chromium does not establish compatibility with that host. WebAssembly provides the broadest current shared baseline, but performance must be measured. [ONNX Runtime Web execution providers](https://onnxruntime.ai/docs/get-started/with-javascript/web.html)

Acceptance: per-step and long-sequence numerical comparisons against the pinned reference, downstream trigger-time agreement, full checkpoint/replay, and actual Chrome/Safari/native profiling. Define numerical tolerances before export tuning. Measure p95 time for the whole camera-to-action loop as well as inference alone. A reasonable initial product target is real time for one duck with a 50 Hz motor controller; retinal cadence must also pass a convergence study. Slower exact simulation remains a valid reference mode.

### Change 5: Run matched closed-loop experiments

Freeze the walking policy and actuator limits. Compare the current marker model with the new visual model on matched physical scenes. Give the simple controller equal input access and the same tuning budget. Calibrate on a training set, then lock parameters before evaluation.

Use separate experiment families for looming and following. The initial looming suite should vary contrast and approach geometry, with flash/translation controls and motion induced by the duck. Use at least 30 matched seeds per family as an initial engineering study, with confidence intervals; this is a proposed study size, not a biological power calculation. Count every failed or fallen run.

Keep two gates: neural-response fidelity and physical task outcomes. Measure false stops and missed approaches, plus the time remaining before contact. For the duck body, a zero-speed command is not an instantaneous brake, so measure its actual stopping distance and residual collisions.

If testing whether connectome topology itself helps, use degree/sign-aware random controls and matched initialization/training. Shuffling a trained model can show sensitivity without proving an advantage over a properly trained alternative. A 2026 preprint illustrates this confound, but the recommendation does not depend on accepting that preprint's result. [Dhiman, arXiv 2026, not peer-reviewed here](https://arxiv.org/abs/2604.04033)

### Change 6: Expand to tracking and multiple ducks

After the bounded pathway passes, add an explicitly modeled object/pursuit readout, then inspect its relation to LC/DNa physiology. Keep neurons with different known time courses separate. Validate tracking under background motion and partial occlusion before claiming an improvement over marker following.

Share immutable weights across ducks while keeping visual history and neural state independent. Batch eye processing where it improves measured cost. Only restore an eight-duck performance target after profiling the single-duck model and checking that resource limits never silently change sensory timing.

## Folder boundaries

The eventual split should preserve the user's mac/web separation while adding shared numerical authority:

```text
mac/                         native host, permissions and packaging
web/                         editor, camera acquisition and browser workers
shared/vision/               model manifests, retinal maps and portable core
shared/vision/fixtures/      reference inputs and expected neural responses
research/fly-vision/         pinned Python oracle and reference export tools
experiments/vision/          stimulus definitions, matched suites and reports
docs/research/               decisions and retained evidence
```

These are proposed directories, not an implemented refactor. Production users should not need a Python environment. Vercel can continue hosting the browser app and model assets; client inference keeps the existing local camera-processing model. No new hosted inference service is needed for the proposed architecture if the portable runtime meets the target.

## What remains unverified

The pretrained Flyvis model was not installed or executed in this turn. No browser export or model-speed benchmark was performed. Physiological recording data were identified through the papers, not downloaded and reproduced. The model bridge and proposed head stabilization are hypotheses awaiting the stated gates. The evidence produced now is source inspection and reproducible probes of our existing implementation.

Source commit pins and file hashes are in `source-manifest.json`. Additional reviewed repositories: DesktopFly `32b00011e83c3dc85fa3ea0b3934155b04f1635d`, Murthy Lab `211e49886f74bd954866ded2474cace72187f4a6`, Clark Lab `e496e77a481cced4bc188449940ed4d94bd66a43`. Code licenses observed: Flyvis MIT, FlyGym Apache-2.0, Murthy Lab GPL-3.0, Clark Lab AGPL-3.0. Check model/data terms separately when selecting artifacts for redistribution; these observations are not a license compatibility determination.
