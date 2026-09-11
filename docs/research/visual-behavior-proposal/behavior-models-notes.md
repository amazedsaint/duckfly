# Fly visual behavior and embodied-model research notes

Checked 2026-09-11 UTC. Research only. The robot mappings below are proposed experiments, not claims about circuits currently implemented in DuckFly or improvements already measured in its body controller.

The useful analogy is a driver learning to use an unfamiliar vehicle. Fly circuits can supply evidence about what to attend to and which way to move. A six-legged fly's descending signal cannot be treated as a ready-made set of joint commands for a two-legged duck. The body adapter remains an explicit, testable part of the experiment.

## Practical recommendation

Prioritize a calibrated, stateful visual model driving pursuit with continuous steering, then test independent head movement. These make the brain-to-body link visible and permit strong controls with the same body policy. Introduce active stopping as a separate motor skill; zero forward command is not necessarily a stable stop. A remembered heading is a useful next experiment because it can distinguish present vision from internal state without claiming a full spatial map.

Backward retreat is biologically well supported but should wait for a duck controller that can demonstrably step backward without falling. Social-state modulation is interesting after visual pursuit works. It should be presented as a change in sensory gain or following motivation, without claiming recognition of another duck's identity or intentions.

Do not start by wiring every named descending neuron to an independent animation. Descending networks recruit partners, and the same apparent command can have different consequences depending on movement state.

## Biological evidence and transfer boundaries

### Forward walking and pursuit: P9 is DNp09

Bidaye and colleagues identify P9/DNp09 as a pathway supporting forward walking with ipsilateral turning. Unilateral activation produced that combination, and silencing P9 or its visual input LC9 impaired male pursuit. BPN, the Bolt Protocerebral Neurons, instead supported longer, faster and straighter walking. These are distinct pathways. The paper also reports a material qualification to earlier DNp09 freezing claims: walking initiation appeared across tested driver/reporter combinations, while freezing appeared in only one. Sex matters here: some connectivity comes from a female brain, whereas the pursuit assay concerns males. [Primary paper, Neuron 2020](https://pmc.ncbi.nlm.nih.gov/articles/PMC9435592/).

**Proposed transfer:** a lateralized seek-and-turn drive, with a separate straight-cruise mode. Keep neural evidence distinct from the engineered conversion into duck forward velocity and yaw. A P9-associated readout is not sufficient evidence that the whole LC9-to-motor pathway is present.

### Walking steering: DNa01 and DNa02

Paired recordings show that left-right DNa02 activity differences predict steering, with a transient, higher-gain contribution; DNa01 has slower and more sustained dynamics. The work ties DNa02 to sensory responses, central-complex heading signals and locomotor state. Direct activation does not reliably produce a simple ipsilateral turn in every condition, so “one neuron equals one steering button” is too strong. [Rayshubskiy et al., eLife, Version of Record 2025](https://elifesciences.org/articles/102230).

Independent work connects DNa02 and DNg13 to different leg-level steering mechanisms: shortening inside strides versus extending outside strides. The effects depend on locomotor phase. [Fine-grained descending control of steering in walking Drosophila, Cell 2024](https://www.sciencedirect.com/science/article/pii/S0092867424009620).

**Proposed transfer:** compare a fast corrective turn channel with a slower tracking channel while retaining the existing duck locomotion policy. The biology motivates the decomposition; tuning those gains for a biped is engineering. Do not copy measured fly latencies directly into duck actuation.

### Stopping is an active, context-dependent action

Foxglove and Bluebell are GABAergic cells that suppress different components of walking and participate in feeding-related halts. Brake neurons are ascending VNC neurons that help arrest movement and stabilize joints during grooming. The paper supports distinct stopping mechanisms with neural perturbations and joint-level analysis. A command to stop walking can therefore differ from a command to hold the body steady. [Neural circuit mechanisms underlying context-specific halting in Drosophila, Nature 2024](https://www.nature.com/articles/s41586-024-07854-7).

**Proposed transfer:** compare “coast to a stop” with a verified stance controller. A visual warning could trigger the latter through an explicitly engineered adapter. This does not establish a natural visual input pathway into Foxglove, Bluebell or Brake. The world and body physics should continue during a halt.

### Backward retreat: MDN and MAN

Moonwalker descending neurons are necessary for backward walking at an impassable barrier and sufficient to induce it under ordinarily forward-walking conditions. Moonwalker ascending neurons promote persistent backward walking; the original account qualifies forward-walking inhibition as a possible mechanism. [Neuronal control of Drosophila walking direction, Science 2014](https://pubmed.ncbi.nlm.nih.gov/24700860/).

LC16 visual projection neurons respond to looming stimuli, and MDNs mediate visually evoked retreat through an indirect pathway. That is stronger evidence for visually triggered walking retreat than reusing an escape neuron as a generic reverse switch. [Moonwalker Descending Neurons Mediate Visually Evoked Retreat in Drosophila, Current Biology 2017](https://pubmed.ncbi.nlm.nih.gov/28238656/). Work on downstream motor circuits further resolves distinct leg-power and leg-lift contributions. [Distributed control of motor circuits for backward walking in Drosophila, 2020](https://pubmed.ncbi.nlm.nih.gov/33268800/).

**Proposed transfer:** a looming-triggered retreat experiment, gated on a tested backward locomotion skill. If the duck cannot safely reverse, a stop-and-turn adapter is a defensible engineering experiment, but it should not be described as reproducing fly backward walking.

### Giant fiber: escape/takeoff, not a biological walking brake

LPLC2 and LC4 provide complementary looming information to the giant fiber pathway: angular size and angular velocity respectively. Physiological and silencing experiments support this feature integration and its role in escape. Giant fiber activity contributes to escape takeoff, not simply to stopping an ongoing walk. [Neural Basis for Looming Size and Velocity Encoding in the Drosophila Giant Fiber Escape Pathway, Current Biology 2019](https://www.sciencedirect.com/science/article/pii/S0960982219301381).

**Proposed transfer:** label a GF-to-duck-brake connection as an engineered mapping. Test size and expansion rate separately, as well as false alarms during camera rotation. A more accurate neural looming detector and a useful duck avoidance policy are separate claims requiring separate measurements.

### Head movement changes the visual computation

Head-free versus head-fixed flight experiments show that active head movements alter retinal input and improve coordination of wing responses to visual motion. Replaying visual error signals helps separate properties of the image stream from the benefits of active movement. These are flight experiments, not a demonstrated duck gait mechanism. [Cellini and Mongeau, Active vision shapes and coordinates flight motor responses in flies, PNAS 2020](https://pmc.ncbi.nlm.nih.gov/articles/PMC7502703/).

**Proposed transfer:** decouple the rendered eye/head pose from body yaw, with measured pose fed back into the visual pipeline. Test head-fixed, passive stabilization and active gaze configurations against matched retinal replays. Body stability should remain a separate outcome from visual tracking quality.

DNg02 is a population implicated in flight motor regulation, with recruitment affecting wingbeat amplitude. Its optomotor contribution includes coordinated movements outside the wings. It should not be sold as an experimentally validated walking-steering controller. [Population of descending neurons that regulate the flight motor, 2022](https://pmc.ncbi.nlm.nih.gov/articles/PMC9206711/); [DNg02 optomotor study, official author repository, 2023](https://authors.library.caltech.edu/records/drvbj-nkj15/latest).

### Heading memory and goal-directed steering

EPG heading signals, FC2 goal-related signals and PFL outputs provide a biologically grounded way to compare current orientation with a desired heading. Perturbations that reposition goal-related activity alter chosen headings; PFL3 populations carry opposing turn contributions and PFL2 helps regulate steering gain. This is evidence about directional goals, not an arbitrary two-dimensional map or general route planning. [Converting an allocentric goal into an egocentric steering signal, Nature 2024](https://www.nature.com/articles/s41586-023-07006-3); [Transforming a head direction signal into a goal-oriented steering command, Nature 2024](https://www.nature.com/articles/s41586-024-07039-2).

**Proposed transfer:** let a duck continue toward a remembered direction after a beacon disappears. Any ring attractor or simpler memory used initially must be labeled as a modeled component. A gyro-like heading observation is different from secretly reading the target's world coordinates. The [Maimon Lab analysis repository](https://github.com/MaimonLab/Converting_allo_goal_to_ego_steering) provides study code, not a ready-made duck controller.

### State changes vision: LC10a and pursuit

In male courtship, P1-related arousal raises the visual sensitivity of LC10a-associated circuitry to a moving target and supports pursuit. The evidence supports state-dependent visual gain. It does not show generic semantic recognition of a partner from any camera image. [Sexual arousal gates visual processing during Drosophila courtship, Nature 2021](https://www.nature.com/articles/s41586-021-03714-w). Female social state can also modify visual processing through distinct mechanisms, reinforcing the need to keep sex and circuit provenance explicit. [Social state alters vision using three circuit mechanisms in Drosophila, Nature 2025](https://www.nature.com/articles/s41586-024-08255-6).

**Proposed transfer:** a user-visible “following drive” parameter that changes visual processing before the motor adapter. Compare it with merely increasing motor gain. A duck chasing another duck is a useful stimulus arrangement, not evidence of social understanding.

### Grooming and descending population coordination

DNg11 activation supports front-leg rubbing. Guo et al. identify anatomical input from the visual system, but describe that input as suggesting possible integration of diverse signals. Their functional pathway evidence concerns mechanosensory action selection, including Johnston's-organ-related inhibition. This source does not establish a causal camera-image-to-DNg11 grooming response. DNg12 coordinates anterior grooming, while aDN cells relate to antennal grooming. [Descending neurons coordinate anterior grooming behavior in Drosophila, Current Biology 2022](https://www.sciencedirect.com/science/article/pii/S0960982221017425); [author manuscript with circuit details](https://par.nsf.gov/servlets/purl/10384044).

Broader experiments show that activating DNp09 or aDN2 recruits other descending neurons and that complete actions depend on the recruited network. MDN-mediated backward walking has a different dependence on this broader recruitment. [Descending networks transform command signals into population motor control, Nature 2024](https://www.nature.com/articles/s41586-024-07523-9).

**Proposed transfer:** treat DNg11 as a modeled grooming output unless stronger visual causality is supplied. A biped grooming pose also needs its own balance controller. When adding a neural circuit, compare a readout-only model with one retaining relevant local partners instead of assuming isolated command cells reproduce the behavior.

## Names that should remain distinct in the proposal

| Name | Supported interpretation and caution |
| --- | --- |
| P9 / DNp09 | Same named descending pathway in the forward-walking study; freezing reports require genotype/context qualification. |
| DNa01 / DNa02 | Walking-steering cells; distinct from the similarly written antennal-grooming aDN names. |
| aDN / aDN2 | Antennal grooming in the cited work; not a DNa02 alias. |
| MDN / MAN | Descending backward-walking command and ascending persistence contribution. |
| Brake / BRK | Ascending VNC cells involved in active arrest; not a generic descending speed command. |
| DNg02 | Flight motor/optomotor population; transferring to walking is a hypothesis. |
| GF | Escape pathway; a stop command for the duck is a chosen body mapping. |
| DNg11 | Front-leg rubbing with candidate visual anatomical input, not established visual grooming causality. |

## What the open-source implementations actually provide

### NeuroMechFly / FlyGym: a useful reference for integration

The [NeuroMechFly v2 paper](https://doi.org/10.1038/s41592-024-02497-y) and [official project](https://github.com/NeLy-EPFL/flygym/) connect visual processing with an embodied fly and provide valuable ablations. Their biological body differs substantially from Microduck.

The published-style vision examples were inspected at **FlyGym v1.2.1**, commit `c7affce924cb1c6add16619adf83be5c6b223e89`. The current main branch inspected was `38c8ec61034cd59bc5ba0de20688d4a3c0000d60`. FlyGym 2.x changes the API; the [changelog](https://neuromechfly.org/changelog/) and legacy tutorial context need checking before reproducing examples. Pin the example version and dependencies together.

In [follow_fly_closed_loop.py](https://github.com/NeLy-EPFL/flygym/blob/c7affce924cb1c6add16619adf83be5c6b223e89/flygym/examples/vision/follow_fly_closed_loop.py), the code normalizes selected visual-cell activity against baseline and creates thresholded object masks. Retinal mask positions and sizes produce turning bias, which is converted into two abstract descending drives for the locomotion controller. A group named `lc910_inputs` denotes selected input cell types; this does not instantiate a full LC9/LC10-to-DN pathway. The example supplies an excellent comparison design, but its engineered decoder must remain visible in any scientific claim.

The [realistic_vision.py adapter](https://github.com/NeLy-EPFL/flygym/blob/c7affce924cb1c6add16619adf83be5c6b223e89/flygym/examples/vision/realistic_vision.py) uses a selected pretrained Flyvis checkpoint, retinal mapping and a fade-in initialization. [vision_network.py](https://github.com/NeLy-EPFL/flygym/blob/c7affce924cb1c6add16619adf83be5c6b223e89/flygym/examples/vision/vision_network.py) implements persistent, single-step neural state for a closed loop. “RealTime” in a class name is not a measured browser performance guarantee. Each duck needs isolated temporal state, with explicit eye identity and reset semantics.

The [head stabilization model](https://github.com/NeLy-EPFL/flygym/blob/c7affce924cb1c6add16619adf83be5c6b223e89/flygym/examples/head_stabilization/model.py) is a trained MLP taking joint angles and contact flags and predicting roll/pitch corrections. That is a practical learned controller, not a reconstructed fly neck circuit. Reusing its design requires training or validating for duck morphology.

### Flyvis: an evidence-based visual subsystem, not a complete brain

The [Flyvis paper](https://www.nature.com/articles/s41586-024-07939-3) models 64 visual cell types, constrains connectivity from anatomy and optimizes unknown parameters on a motion task. Its ensemble predicts held-out neural responses. This supports visual response modeling; it does not imply complete vision, descending action selection or a motor system. Continuous model activity also requires an explicit adapter if the receiving brain model uses spikes.

Inspected current commit: `92b3845cc426dd309a1a0e1b3890156c42e14021`. The [connectome configuration](https://github.com/TuragaLab/flyvis/blob/92b3845cc426dd309a1a0e1b3890156c42e14021/flyvis/config/network/connectome/connectome.yaml) selects `fib25-fib19_v2.2.json` with extent 15. The [dynamics configuration](https://github.com/TuragaLab/flyvis/blob/92b3845cc426dd309a1a0e1b3890156c42e14021/flyvis/config/network/dynamics/dynamics.yaml) uses `PPNeuronIGRSynapses` with ReLU activation. These are concrete model choices to retain in provenance. The [official documentation](https://turagalab.github.io/flyvis/) covers stimulus analysis and model ensembles.

**Proposed use:** use the already ported DuckFly reference offline before promoting a new live body bridge. Check neural response direction and contrast selectivity, then compare body behavior with a much simpler image controller. Report variation across fixed ensemble members rather than picking the model that happens to win on the final test scene.

### Whole-brain LIF models: useful hypotheses, incomplete embodiment

Shiu et al. provide a connectome-based whole-brain spiking model with experimentally tested sensorimotor predictions, including feeding and grooming. This is evidence for specified assays, not general visual intelligence or successful biped control. [A Drosophila computational brain model reveals sensorimotor processing, Nature 2024](https://pmc.ncbi.nlm.nih.gov/articles/PMC11446845/).

The [official repository](https://github.com/philshiu/Drosophila_brain_model) was inspected at commit `91bdd1e7dcf193f3e7ca5a8933497fcef63b7960`. Its [model.py](https://github.com/philshiu/Drosophila_brain_model/blob/91bdd1e7dcf193f3e7ca5a8933497fcef63b7960/model.py) and README expose externally stimulated populations, synaptic silencing and spike outputs. A complete path from live retinal input through descending outputs into a duck body is additional work. A connectome is not a specification for missing sensory calibration or low-level control.

The parent proposal separately reviews Eon's March 2026 embodiment report, including its stated visual influence limitations. Do not use that demonstration as proof that a functioning visual closed loop already exists in DuckFly.

## Candidate experiments and ways to disprove them

All entries below are new proposals. Success should require a behavioral improvement under held-out conditions, with the neural response supporting the claimed mechanism. An attractive scene or moving readout alone is insufficient.

| Experiment | User-visible interaction | Comparison and falsifier | Primary outcome |
| --- | --- | --- | --- |
| Follow without wobbling | Drag a beacon through sharp turns, then smooth curves. Inspect fast/slow steering channels. | Compare with one fixed-gain image controller; swap lateral readouts, silence one channel and replay images from a different trajectory. | Tracking error and overshoot at matched speed, with falls reported separately. |
| Keep your eyes on it | Move a target while the duck's head can turn independently. Toggle head fixation. | Active head control versus stabilization and matched retinal replay; wrong-sign pose feedback should impair the predicted benefit. | Target retention and retinal slip; body stability must not deteriorate. |
| Stop with balance | Approach a visual barrier, then remove it to permit movement again. | Zero desired speed versus active stance control; compare visual trigger with a matched timed stop and test false warnings. | Stop distance and restart reliability, with slip/fall rate as a gate. |
| Back away | Expand a looming object in front of a stationary or walking duck. | Looming versus receding and constant-size translation; compare retreat with turn-away and stopping. Backward policy must pass a separate body test first. | Collision clearance without a fall; visual response must precede contact. |
| Remember the direction | Hide a beacon after the duck aligns with it. Disturb its heading. | Same current image with different cue histories; independently perturb heading estimate and remembered goal; shuffle history. | Signed correction and maintained heading across held-out occlusion durations. |
| Stay with one target | Add distractors and cross two identical-looking moving targets. | Compare target continuity with frame-by-frame salience; mask, swap or replay input. Keep any identity tracking explicitly engineered. | Target switches and recovery after occlusion. |
| Change the urge to follow | Adjust a visible following-drive control while the visual target remains unchanged. | Sensory gain change versus motor-only gain at matched output activity; vary distractor contrast independently. | Change in detection/tracking selectivity, not just faster walking. |

## Shared experimental rules

- Define a source manifest before modeling: paper, neuronal identity and hemisphere, dataset version, sex where relevant, code commit, checkpoint hash, units and time step. Distinguish a published circuit from a convenient engineered readout.
- Validate visual responses before judging the robot. Direction selectivity, contrast polarity and expansion-rate dependence need controlled pixel stimuli. A body moving in the expected direction can conceal a mislabeled neural channel.
- Keep decision inputs honest. The behavioral controller may consume retinal images and declared proprioception; withheld target world position can be used for scoring only. A camera frozen on old frames should not continue tracking a moved object through hidden state from the scene graph.
- Preserve state separately for every duck and eye. Log observation age and neural integration time. Display a stale-input indication when a camera or worker stalls instead of attributing old activity to current vision.
- Freeze parameters before the evaluation batch. Compare the existing controller with the proposed model using matched initial states and seeds, then test withheld motion patterns and appearance. Friction and body disturbances are separate stress tests.
- Apply causal controls at a named boundary. Input replay tests dependence on the real scene; neural silencing tests the proposed pathway; readout replacement tests whether the fancy network contributes more than a simple image statistic. Equalize gains where possible so an ablation does not merely remove all movement.
- Report uncertainty across stimulus variants and model instances. Neural fit and useful behavior are separate axes. A model can match a response yet make control worse, or produce good control for the wrong reason.
- Offline test episodes may have a fixed measurement horizon while the user-facing scenes remain open-ended. Save failed runs as well as successes. If the preregistered benefit disappears under matched controls, retain the scene as an exploratory comparison instead of promoting a mechanism claim.

No experiment in this note has been executed in DuckFly. No app code was changed by this research task.
