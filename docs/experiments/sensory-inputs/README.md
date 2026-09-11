# Direct scene launch and sensory inputs

Prebuilt gallery tiles start their experiment immediately. Customize still opens the setup wizard, and New scene starts a blank setup. The scene gallery retains all existing experiments and adds Follow a scent, Feel the air and Touch and pause.

The mapping editor now exposes 19 signals and 10 robot actions. Six new sensor signals cover scent detection, left and right scent bias, scent loss, an air stimulus and contact with an object. They can drive any action in the same editor. Signal labels distinguish sensor readings from activity measured in the fly circuit.

## Pathways and limits

**Scent:** two head-local sampling points measure a simulated concentration field. A bounded engineered adapter supplies walking and steering currents to the existing movement pathways. Follow a scent covers the duck's eyes to make that contribution visible. The adapter holds still when scent is lost or the source is reached. It does not reconstruct receptor neurons, antennal-lobe circuitry or mushroom-body learning. Turning off either antenna changes only that duck's samples.

**Air:** local field strength supplies current to DesktopFly's existing sensory-cell input. Strong stimulation can recruit its giant-fiber stop response. This is a local stimulus, not a fluid or turbulence model, and the input cells have not been validated as a complete Johnston's-organ circuit.

**Touch:** actual MuJoCo object contacts supply robot-body feedback. Floor contact is excluded. The signal can be mapped to a stop, head movement or another robot action; it is not relabeled as a reconstructed fly tactile neuron.

The existing visual signals still require fresh camera input. Nonvisual sensor signals remain usable with the eyes covered. The Senses monitor shows the selected duck's readings and provides input-disable controls. Selecting a source opens live position and strength controls; source changes are retained in recording and replay alongside duck edits.

## Evidence

`web/tests/senses.test.mjs` checks head-relative sampling, bilateral masking and per-duck isolation. It also checks real physical contacts, nonvisual mappings with no camera, exact replay after live source changes and eyes-covered pursuit through MuJoCo. Scene validation and sharing accept the new sensor settings without dropping older scene formats.

`experiments/sensory-inputs/air-pathway.mjs` probes four fixed seeds with no camera input and no body feedback. It supplies a 20-tick sensory pulse during a 100-tick trial and repeats each condition with the sensory cells silenced. The bundled circuit and brain source hashes are recorded in `air-pathway.json`.

At stimulus strengths 0.8 and 1.0, all four seeds activated the giant-fiber hold. Strength 0.2 activated none; strength 0.5 activated only one seed. Silencing the sensory cells removed the response in every condition. That supports a causal path in this implementation. It does not establish a calibrated biological air-response curve.

`catalog-browser.json` records all 18 gallery entries running for at least five simulated seconds, with finite commands and no fallen ducks. It also checks optional setup, the new mapping options and the sensory filter. These are bounded default-scene checks, not proof of indefinite balance in every edited scene.

`interaction-browser.json` checks source movement and on/off without resetting time, antenna masking in the running engine, air recruitment of the stop reflex and a stop on actual object contact. `native-launch.json` and `native-setup.json` cover the rebuilt Mac host, including direct entry and scene/recording round trips.

## Sources

- [DesktopFly](https://github.com/DenisSergeevitch/desktop-fly): source circuit and sensory-current implementation.
- [FlyGym](https://github.com/NeLy-EPFL/flygym): embodied-fly simulation reference.
- [Bilateral odor sensing study](https://pmc.ncbi.nlm.nih.gov/articles/PMC3590906/): rationale for separate left and right concentration samples.
- [Antennal wind sensing study](https://pmc.ncbi.nlm.nih.gov/articles/PMC2755041/): mechanosensory input as a distinct modality.
- [Giant-fiber sensory integration study](https://pmc.ncbi.nlm.nih.gov/articles/PMC6946141/): biological context for the escape pathway; it does not validate our chosen input gain.
