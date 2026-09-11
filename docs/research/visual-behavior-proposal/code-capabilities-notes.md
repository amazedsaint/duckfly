# Code capabilities audit for the visual behavior proposal

Research-only inspection, 10 September 2026. DuckFly checkout: `dc41aa17ce83999bb56efed1f92ae8842eda70ec`. No app implementation, deployment, model fitting, or heavy experiment was performed for this audit. Numerical values below come from the current code and retained artifacts; proposed experiments have not earned a performance claim.

The important distinction is that DuckFly already has several useful descending-neuron populations, but its body interface uses only part of them. Its full Flyvis visual model is a separate bench. We can make richer causal experiments without pretending those modules form one reconstructed fly nervous system.

## Pinned sources and what was verified

- DesktopFly: [`32b00011e83c3dc85fa3ea0b3934155b04f1635d`](https://github.com/DenisSergeevitch/desktop-fly/tree/32b00011e83c3dc85fa3ea0b3934155b04f1635d). `git ls-remote --symref ... HEAD` on 10 September 2026 confirmed that the upstream default branch is `master` and its current HEAD equals this pinned source. Inspected `main.swift`, `FlyModel.swift`, `Sim.swift`, `Locomotor.swift`, and `etl.py` at this exact revision, including raw source. Local `circuit.json` is byte-identical to upstream `data/circuit.json`; SHA-256 `da53640e4dc7071c26892870ec5b28984c4cfc74c1c44d3a3cde0a2913579d0f`, Git blob SHA-1 `10a7d0726571881e77e93e33bd7a23d900025e49`.
- Microduck RL: [`53b8971b61baf5b7f3c16d135dd7cac37623de4b`](https://github.com/pollen-robotics/microduck_rl/tree/53b8971b61baf5b7f3c16d135dd7cac37623de4b). The vendored `infer_policy.py` is byte-identical to pinned upstream `scripts/infer_policy.py`.
- Walking ONNX comes from Microduck policies revision `916c1e1ee11f8460506532e037a4cf1aa110aca6`; standing and left-kick models use revision `088524a64e2557dc453256b6071dbb9d23888802`. These are separate trained body policies, recorded in [local provenance](/Users/madhusudanaa/Documents/GitHub/duckfly/THIRD_PARTY_NOTICES.md:13).
- Flyvis: [`92b3845cc426dd309a1a0e1b3890156c42e14021`](https://github.com/TuragaLab/flyvis/tree/92b3845cc426dd309a1a0e1b3890156c42e14021), published `flow/0000/000/best_chkpt`. The local export records both checkpoint-container hashes and equality of loaded parameter tensors. This audit did not rerun the prior numerical parity experiment.

## What the 668-neuron circuit actually contains

Counted directly from [circuit.json](/Users/madhusudanaa/Documents/GitHub/duckfly/shared/assets/Brain/circuit.json:1). It has 18,968 signed connection rows, including 216 LC4/LPLC2-to-GF rows. A row count is not the number of synaptic contacts.

| Population | Cells | Present function in DuckFly |
|---|---:|---|
| LC4 | 104 | Modeled looming-current input; contributes to looming rate and network propagation |
| LPLC2 | 210 | Modeled looming-current input; selectable compact-motion route into GF |
| DNp01 / Giant Fiber | 2 | A simulated spike starts a one-second stop latch |
| DNa01 and DNa02 | 2 each | Left/right rate difference requests yaw |
| DNp09 | 2 | Rate hysteresis requests walking; can request the existing visual-kick skill |
| MDN | 4 | Simulated and its rate maintained internally; no current backward body readout |
| DNg11 | 6 | Simulated and its rate maintained internally; no current grooming body readout |
| DNp02 / DNp04 / DNp11 | 6 combined | Simulated escape/wing rate maintained internally; no duck wing/flight action |
| Selected partners | 330 | 173 central, 48 optic, 31 descending, 27 ascending, 21 visual centrifugal, 16 sensory, 14 visual projection |

The partner labels are coarse classes, not a complete cell-type inventory. We should not assign them new anatomical roles by guessing from their positions. The upstream extractor selects named core types plus strong partners, then retains within-subgraph connections. It converts transmitter predictions into signs and treats some modulatory labels as half-strength positive weights. This is measured wiring filtered and converted by a model, not measured physiology. [Exact extractor](https://github.com/DenisSergeevitch/desktop-fly/blob/32b00011e83c3dc85fa3ea0b3934155b04f1635d/etl.py#L23-L37), [partner selection and edge construction](https://github.com/DenisSergeevitch/desktop-fly/blob/32b00011e83c3dc85fa3ea0b3934155b04f1635d/etl.py#L78-L132).

For the proposal's specific circuit candidates, **not identified** means no such typed population or supported readout exists in the shipped FlyWire file. The 330 coarse-labeled partners prevent concluding that no underlying member could ever be reannotated as that type. Their source IDs would need a fresh authoritative annotation join. The Flyvis column checks all 65 named model entries, representing 64 biological cell types with CT1 split into `CT1(Lo1)` and `CT1(M10)` compartments, not only the eight displayed readouts.

| Candidate type | Shipped FlyWire circuit | Pinned Flyvis network | Immediate consequence |
|---|---|---|---|
| LC4 | Present, 104 | Absent | Existing looming input population |
| LC6 | Not identified | Absent | New identified extraction/module needed for LC6 claims |
| LC9 | Not identified | Absent | New identified extraction/module needed |
| LC10a | Not identified | Absent | No existing LC10a pursuit path |
| LC11 | Not identified | Absent | No existing typed LC11 small-object path |
| LC12 | Not identified | Absent | New identified extraction/module needed |
| LC15 | Not identified | Absent | New identified extraction/module needed |
| LC16 | Not identified | Absent | New identified extraction/module needed |
| LPLC1 | Not identified | Absent | New identified extraction/module needed |
| LPLC2 | Present, 210 | Absent | Existing injected-current route; no anatomical Flyvis bridge |
| GF / DNp01 | Present, 2 | Absent | Existing spike-triggered stop; no fly takeoff in duck body |
| MDN | Present, 4 | Absent | Can expose activity now; backward body action is separately gated |
| DNa01 / DNa02 | Present, 2 each | Absent | Existing left/right steering readout |
| DNp09 | Present, 2 | Absent | Existing forward/visual-kick trigger |
| HS / VS | Not identified | Absent | An optic-flow stabilization hypothesis needs added/readout circuitry |
| EPG / PEN / PFL | Not identified | Absent | No reconstructed central-complex heading/path-memory circuit |
| KC / MBON | Not identified | Absent | No identified mushroom-body associative-learning module |

All absent/new-circuit entries can still be approximated by an explicitly artificial adapter, but that would not be evidence that the named fly pathway is simulated.

The large background brain point cloud is a visualization. It does not enlarge the simulated circuit. DuckFly constructs `LIFSim(circuit, bus, null, random)`, so the upstream MaleCNS network is not instantiated. [Brain construction](/Users/madhusudanaa/Documents/GitHub/duckfly/web/src/brain.js:25), [runtime loading](/Users/madhusudanaa/Documents/GitHub/duckfly/web/src/lab/lab-runtime.js:9).

## DesktopFly behavior compared with execution

DesktopFly's input is cursor/window geometry, click timing, and ambient desktop signals. It does not reconstruct these stimuli from rendered retinal pixels. Cursor approach and bearing become left/right looming currents; nearby clicks stimulate the selected sensory group. [Cursor and tap implementation](https://github.com/DenisSergeevitch/desktop-fly/blob/32b00011e83c3dc85fa3ea0b3934155b04f1635d/main.swift#L783-L851).

The body is controlled by a population-rate adapter followed by state rules. This is the executable meaning of its behavior claims:

| Upstream trigger | Actual body rule |
|---|---|
| GF spike latch | Requests escape flight if cooldown allows |
| LC population rate / 80 above 0.4 | Starts a short dart with configured speed/duration and an away-from-cursor target |
| DNp09 rate / 10 | Walk/rest hysteresis, with state-age conditions |
| DNg11 rate / 8 | Groom/idle hysteresis, suppressed during stronger looming |
| MDN rate above 8 | Starts a 0.5-second backward interval |
| Escape-DN and population rates | Modulate procedural wing effort; arousal changes the probability of spontaneous flight |
| Sleep input | Ambient idle/time rule enters sleep and directly chooses grooming on wake |

[Rate conversion](https://github.com/DenisSergeevitch/desktop-fly/blob/32b00011e83c3dc85fa3ea0b3934155b04f1635d/main.swift#L655-L676), [behavior state rules](https://github.com/DenisSergeevitch/desktop-fly/blob/32b00011e83c3dc85fa3ea0b3934155b04f1635d/FlyModel.swift#L651-L716). These thresholds and animations are configured models. The code comment claiming every decision reads a neuron rate is too broad: sleep and wake-to-groom also depend directly on a non-neural ambient input. Only the first DesktopFly fly receives the simulated signals; additional flies receive `nil`. [Coordinator](https://github.com/DenisSergeevitch/desktop-fly/blob/32b00011e83c3dc85fa3ea0b3934155b04f1635d/main.swift#L877-L910).

Upstream does contain a separate 1,045-neuron MaleCNS leg circuit with real within-specimen connections. Female FlyWire rates are transferred to male same-type/side descending populations by an explicitly modeled current interface, `min(0.35, rate × 0.004)`. They are not anatomical synapses between the datasets. Its six-leg mechanics cannot be plugged into this biped as if the actuator meanings matched. [Cross-specimen interface](https://github.com/DenisSergeevitch/desktop-fly/blob/32b00011e83c3dc85fa3ea0b3934155b04f1635d/Locomotor.swift#L122-L127), [data/model boundary](https://github.com/DenisSergeevitch/desktop-fly/blob/32b00011e83c3dc85fa3ea0b3934155b04f1635d/data/LOCOMOTOR_PROVENANCE.md#L57-L88).

## What currently connects DuckFly vision, brain, and body

The causal path is camera pixels → custom visual features → custom input currents → extracted LIF circuit → custom movement readout/gates → trained Microduck policy → BAM/MuJoCo → new camera/body measurements. Each duck has a separate seeded circuit and visual history. [Experiment construction and stepping](/Users/madhusudanaa/Documents/GitHub/duckfly/web/src/lab/experiment.js:21).

The default marker detector recognizes pink targets and cyan companions using RGB thresholds, with a five-pixel visibility minimum. Steering and forward currents come from marker bearing/area; light and odor modes use simple sensory differences. The motion option uses an engineered opponent-motion detector and injected LPLC2 current. Neither is Flyvis. Active head looking uses marker tracking or a search sine wave; optional stabilization subtracts a smoothed body-heading change. These head commands do not pass through a reconstructed fly gaze circuit. [Detector](/Users/madhusudanaa/Documents/GitHub/duckfly/web/src/lab/vision.js:5), [adapter and head control](/Users/madhusudanaa/Documents/GitHub/duckfly/web/src/lab/vision.js:66), [motion route](/Users/madhusudanaa/Documents/GitHub/duckfly/web/src/lab/visual-system.js:22).

The brain wrapper exposes walk/left/right/loom stimulation and selected lesions. It injects forward/turn currents for 20 neural milliseconds; GF starts a one-second stop. DNp09 above 6 enables a fixed 0.3 m/s request, below 2 disables it. DNa rate difference minus a slow baseline produces yaw, capped at ±0.65. Thus speed is currently a thresholded request, not a graded neural speed decoder. MDN, grooming, and wing rates already exist in the simulator and checkpoints but are omitted from the wrapper's returned readout. [Wrapper](/Users/madhusudanaa/Documents/GitHub/duckfly/web/src/brain.js:32), [all internal rates](/Users/madhusudanaa/Documents/GitHub/duckfly/web/src/vendor/desktop-fly/sim.js:356).

Body feedback currently injects a sinusoid into 27 selected ascending cells, scaled by measured duck speed and a gait-phase estimate, with random per-cell phase offsets. This supplies closed-loop input but is not neuron-specific receptor tuning. Contact/load observations exist in the body state; they are not an anatomically mapped fly proprioceptive system. [Feedback injection](/Users/madhusudanaa/Documents/GitHub/duckfly/web/src/vendor/desktop-fly/sim.js:295), [body measurements](/Users/madhusudanaa/Documents/GitHub/duckfly/web/src/world.js:94).

Manual/reactive modes bypass neural movement readouts. Visibility, output-off, gain, mapping, and skill supervisors also affect final motion. Interpret an intervention from recorded provenance, not the flashing brain alone. The brain display samples spikes and caps its queue at 256; it is not an exhaustive raster for quantitative analysis. [Command precedence](/Users/madhusudanaa/Documents/GitHub/duckfly/web/src/lab/experiment.js:122), [display sampling](/Users/madhusudanaa/Documents/GitHub/duckfly/web/src/vendor/desktop-fly/sim.js:378), [queue cap](/Users/madhusudanaa/Documents/GitHub/duckfly/web/src/vendor/desktop-fly/sim.js:49).

## Flyvis: real model, missing anatomical bridge

The packaged model contains 45,669 continuous-state cells and 1,513,231 edges. It reproduces one published model, not a spiking brain. Its pinned connectome specification has 65 named entries representing 64 biological cell types, because CT1 has separate lobula and medulla compartments. It has no LC4, LPLC2, GF, or descending body command populations. [Upstream type specification](https://github.com/TuragaLab/flyvis/blob/92b3845cc426dd309a1a0e1b3890156c42e14021/flyvis/connectome/fib25-fib19_v2.2.json), [continuous dynamics](https://github.com/TuragaLab/flyvis/blob/92b3845cc426dd309a1a0e1b3890156c42e14021/flyvis/network/dynamics.py#L190-L217).

DuckFly exports T4a–d and T5a–d, 721 cells per type, with spatial coordinates. The current bench discards that spatial detail in its display output: it averages positive activity changes above the initial baseline over each entire type. Preserve the maps for a future decoder; whole-population means cannot reliably locate a cue or distinguish a local expansion pattern from broad motion. Do not assume each subtype has an ideal textbook direction response: retained tuning probes already report non-ideal responses. [Readout indices and coordinates](/Users/madhusudanaa/Documents/GitHub/duckfly/research/fly-vision/reference.py:37), [current averaging](/Users/madhusudanaa/Documents/GitHub/duckfly/web/src/lab/flyvis.worker.js:26).

The bench worker runs synthetic stimulus movies, reports `gfStop: false`, leaves `loomL/loomR` null, and explicitly marks the body bridge unpromoted. The stage runtime does not import this worker's network. There are no anatomical edges joining its T4/T5 cells to the selected FlyWire circuit. A T4/T5-to-LPLC2 or DNa readout could be a useful engineered hypothesis, but must be labeled and tested as such. [Bench result boundary](/Users/madhusudanaa/Documents/GitHub/duckfly/web/src/lab/flyvis.worker.js:32), [stage runtime](/Users/madhusudanaa/Documents/GitHub/duckfly/web/src/lab/lab-runtime.js:18).

## Body and timing constraints for proposals

Microduck takes 61 observations and returns 14 joint-position offsets. The command segment is 13 values: planar twist, head pose, and body pose. DuckFly fills forward/yaw plus four head slots; lateral velocity and body-pose slots remain zero. The local wrapper clamps forward to **0–0.3 m/s**, yaw to **±0.8 rad/s**, head yaw to **±0.35 rad**, and other head slots to **±0.15 rad**. Negative MDN retreat requests would currently become zero. Outputs become default pose plus action × scale, then BAM actuator targets. [Actual app contract](/Users/madhusudanaa/Documents/GitHub/duckfly/web/src/world.js:38), [pinned upstream command layout](https://github.com/pollen-robotics/microduck_rl/blob/53b8971b61baf5b7f3c16d135dd7cac37623de4b/scripts/infer_policy.py#L460-L493).

Only walking, standing, and left-kick policies are loaded. The visual kick is an engineered DNp09-plus-visible-cue trigger followed by a steady-stance wait; it does not mean the fly learned to kick. It zeros head and movement commands for the specialized policy, consistent with upstream's zero-command behavior-policy contract. Standing attempts recovery but is not a guaranteed get-up policy. [Skill supervisor](/Users/madhusudanaa/Documents/GitHub/duckfly/web/src/lab/body-skills.js:13).

The stage advances 20 ms per body tick, with 20 one-millisecond LIF steps and four 5 ms physics steps. Camera cadence is 10 Hz for marker-only scenes or 25 Hz when motion/temporal mode is enabled. LIF population rates have about 120 ms smoothing; steering baseline adaptation is about eight seconds. A one-millisecond neural integrator does not give a one-millisecond visual reaction. [Tick/camera scheduling](/Users/madhusudanaa/Documents/GitHub/duckfly/web/src/lab/experiment.js:96), [physics/inference](/Users/madhusudanaa/Documents/GitHub/duckfly/web/src/lab/lab-world.js:51), [LIF constants](/Users/madhusudanaa/Documents/GitHub/duckfly/web/src/vendor/desktop-fly/sim.js:226).

Retained WASM parity timing is roughly **1.66 ms median / 2.33 ms p95 per 2 ms Flyvis integration step**, on the earlier measured machine/runtime. This is not a current performance test. The bench performs 20 steps per 40 ms movie frame: roughly 33 ms per eye by median multiplication, before sampling/rendering/readout. Two eyes and multiple ducks are therefore a material real-time risk. This arithmetic is a cost estimate, not an end-to-end latency measurement. Prefer cached offline Flyvis responses first. [Retained parity artifact](/Users/madhusudanaa/Documents/GitHub/duckfly/shared/vision/models/flyvis-000/parity.json:1), [worker stepping](/Users/madhusudanaa/Documents/GitHub/duckfly/web/src/lab/flyvis.worker.js:23).

The scheduler waits for frames and serial policy inference; overload slows wall-clock simulation. Webcam timestamps identify decoded frames, with an explicit decode-arrival fallback and uncalibrated camera geometry. Physical exposure delay is not measured. Distinguish capture, neural, and physical response clocks in every proposed latency metric. [Scheduler](/Users/madhusudanaa/Documents/GitHub/duckfly/web/src/lab/lab.worker.js:11), [webcam timing](/Users/madhusudanaa/Documents/GitHub/duckfly/web/src/lab/capture.js:8).

## Candidate experiments and what they require

| Candidate | Existing resources versus new work | Minimum useful falsifier |
|---|---|---|
| Neural switchboard with graded walk/turn | Existing DNp09/DNa populations and stimulation; expose rate traces and add a bounded readout candidate | Same seeds with neural output silenced, swapped turn outputs, and current thresholded control; compare actual displacement and stability |
| Loom → brake → wait → resume | Existing LC4/LPLC2/GF and measured body speed; compare evidence persistence and release rules | Harmless head scans/receding objects alongside fast threats; preserve false-stop and reaction-time limits |
| Optomotor drum or moving-stripe corridor | Existing full Flyvis T4/T5 maps offline; new spatial decoder into existing DNa currents | Reverse motion, scramble spatial coordinates, and silence DNa; compare to a matched pixel-motion baseline |
| Local expansion versus self-motion | Existing stereo renderer/Flyvis export; new retinotopic pooling and validated timing-based history | Same retinal sequence with correct/incorrect body feedback, plus translation/recession controls |
| MDN retreat demonstration | MDN already simulated; new readout and a separately verified backward body-policy contract | Verify negative velocity tracking, falls, and stop priority before connecting neural triggers; current wrapper cannot retreat |
| Contact-sensitive movement | Measured contacts and existing ascending cells; new explicitly engineered feedback mapping | Real contact phase versus shuffled phase and feedback-off; retain independent neural state and matching body controller |
| DNg11 or arousal behavior demonstration | Populations/tonic modulation exist; expose activity first. A grooming body skill is absent | Neural lesion removes the trigger; any duck head/rest substitute must be named as an engineered expression, not fly grooming |
| Associative cue learning, memory-guided search, courtship | Requires identified additional circuits and learning/state mechanisms, or an openly artificial module | Held-out behavior plus circuit-specific lesions; avoid relabeling marker rules or a generic MLP as those fly circuits |

The best near-term path is **spatial visual readouts offline → matched causal tests → bounded body adapter**, while keeping the current working body policy fixed. A second path can expose unused populations without promising new body capabilities. Direct six-leg motor-network transplantation, generic object understanding, or a “full fly brain” claim is unsupported by this code.

Existing evidence should constrain this plan: the temporal hazard hold reduced contacts but failed its absolute false-stop gate; raising GF gain made harmless-scene alarms much worse; camera/body steering correction did not improve pursuit. Those are completed failed candidates, not reasons to tune on their final test sets. Use fresh held-out scenes and require both discrimination and physical benefit. [Temporal results](/Users/madhusudanaa/Documents/GitHub/duckfly/experiments/temporal/RESULTS.md:3), [feedback results](/Users/madhusudanaa/Documents/GitHub/duckfly/experiments/feedback/RESULTS.md:30). Their historical release wording is not current app authority; the current stage code now exposes the temporal model as an optional research mode.
