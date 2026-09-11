# Visual trigger families for a DuckFly proposal

Research notes, 2026-09-10. This is a bounded literature and official-model survey, not an exhaustive account of fly vision. No app implementation, test run, or deployment was performed for this research task.

## Main finding

Build a **visual stimulus → measured model response → proposed duck action** experiment. These are separate claims. A known response in a biological neuron does not establish that a downloaded model reproduces it, and a model response does not establish a useful robot behavior.

Flyvis provides the strongest starting point for early motion signals. Higher-level object and looming detectors are useful extensions, with separate labels and validation. The most interesting near-term comparison is not “does every visual event make the duck move?” It is whether different circuits distinguish the same event from its confounds.

## What official Flyvis actually covers

Lappalainen et al., *Nature* (2024), model a partial right-eye motion network with simplified non-spiking voltage dynamics. Connectivity and optic-flow task training constrain its parameters. The study compares predictions with physiology from 26 studies; ON/OFF preference and T4/T5 direction selectivity are strong results. It does not establish a complete fly brain, all visual behaviors, or a trained duck controller. [Paper](https://doi.org/10.1038/s41586-024-07939-3)

The official custom-stimulus example uses a grayscale box-filter retina on a hexagonal lattice, ordinarily 721 sampling locations. It initializes the recurrent state before evaluating a sequence. That matters for our proposal: scene startup should not be mistaken for a sustained visual response. This input pipeline provides neither measured UV nor polarization. [Official custom-stimulus tutorial](https://turagalab.github.io/flyvis/examples/07_flyvision_providing_custom_stimuli/)

I inspected the current official `fib25-fib19_v2.2.json` directly. It lists R1–R8, lamina and medulla types, T2/T2a/T3, T4a–d/T5a–d, and several Tm/TmY types. It contains **no HS, VS, LC10, LC11, LC4, LPLC2, LPi, Dm8, Dm9, DmDRA, or giant-fiber unit**. There are 65 named entries because CT1 has separate medulla and lobula compartments; this is compatible with the paper's 64 cell-type description. Presence of R7/R8 or Tm5 labels does not validate color computation with grayscale stimulation. [Official model specification](https://github.com/TuragaLab/flyvis/blob/main/flyvis/connectome/fib25-fib19_v2.2.json)

Inspected model-spec SHA-256: `bfbb0766251ff09e22723d0ebbf7b14793e70b3ae8ad0eea64eac9d28223351a`. The link tracks upstream main; pin a commit and checkpoint before implementation. These are upstream coverage findings, not an audit of the model currently loaded in DuckFly.

## Evidence and readiness

- **Causal biology:** perturbations support participation in a behavior, within the reported experimental context.
- **Neural physiology:** measured stimulus tuning; a specific motor outcome is not established by tuning alone.
- **Model support:** the official Flyvis model can expose the relevant named early-neuron response, with stimulus-specific validation still required in DuckFly.
- **Extension:** a missing cell class or behavioral readout must be added and explicitly described as a model/proposal.

All duck actions below are **engineering proposals**, not claims that a fly neuron naturally commands a robot joint.

| Candidate visual trigger | Biological response and evidence | Flyvis readiness | Proposed duck experiment and falsifier |
|---|---|---|---|
| 1. Local light increment, ON flash | Early visual channels separate increment/decrement responses. Polarity depends on the neuron and synaptic sign; “L1 is an ON neuron” is too simple. [F1, F2] | Model support; use signed response traces and an ON-preferring downstream cell rather than naming every lamina signal ON. | Flash a tile; visualize ON activity and optionally request a head orient. Equal-mean no-change frames must remain quiet. |
| 2. Local light decrement, OFF flash | OFF-preferring channels respond differently to darkening. This is not equivalent to detecting a predator. [F1, F2] | Model support. | Toggle a dark patch; compare OFF versus ON channels. A darkening-only stimulus must not automatically count as looming. |
| 3. Bright-edge directional motion | T4 subtypes are selective for different motion directions in the ON pathway. [F1] | Strongest existing model target. | Move a bright edge around the eye. Opponent horizontal outputs may request turns; reverse the movie and require a sign reversal. |
| 4. Dark-edge directional motion | T5 supplies corresponding OFF-motion channels. [F1] | Strong model target. | Repeat the edge experiment with reversed contrast. Check both preferred direction and polarity, not just any activity. |
| 5. Temporal-frequency and pattern-speed changes | T4/T5 grating responses were temporal-frequency tuned, while behavioral slowing used a different computation. One activity amplitude is not a universal speedometer. [S1] | Early responses available; a calibrated speed readout is an extension. | Change stripe spacing at fixed angular speed, then hold temporal frequency fixed. A claimed speed estimate must survive the spacing manipulation. |
| 6. Panoramic horizontal flow / yaw perturbation | HS neurons influence turning bidirectionally; unilateral and bilateral manipulations have different effects. [S2] | T4/T5 available; HS and binocular integration absent. | A rotating striped room tests course stabilization. Distinguish global background rotation from a moving beacon. |
| 7. Vertical flow / pitch-roll disturbance | VS-cell motion-response gain changes with flight state. These are broad visual-motion signals, not literal “move the head up” commands. [S3] | Vertical T4/T5 available; VS absent. | Use horizon/panorama drift to request a bounded head correction. A whole-eye projection and frame calibration must precede pitch/roll claims. |
| 8. Fast translational flow near surfaces | Walking flies slow with faster nearby visual motion; the observed slowing can occur for either flow direction. [S1] | Requires pooling and a behavioral readout. | A narrowing corridor tests slowing before contact. Control for equal-contrast textures with different spacing and matched open-loop replay. |
| 9. Local radial expansion, especially dark looming | LPLC2 combines outward-motion excitation and opposing inhibition; it rejects important non-looming patterns. Causal escape evidence exists. [L1] | LPLC2/LPi absent; a biologically inspired extension could consume T4/T5. | An approaching ball requests stop or turn-away. Matched darkening and sideways translation must not trigger the same response. |
| 10. Looming angular size versus expansion rate | LPLC2 and LC4 provide separable size/rate components to giant-fiber input. [L2] | Missing higher-level units. | Two objects with equal apparent size but different expansion rates test urgency. Do not label a single threshold as exact time-to-collision. |
| 11. Receding object / radial contraction | LPLC2's weak response to contraction is a useful negative result. It does not prove a generic receding-object pursuit command elsewhere. [L1] | Proposed opposite-flow readout; no validated “receding neuron” supplied. | Shrink the same disk or move a ball away. Suppress escape; any re-approach behavior needs its own declared controller and evidence. |
| 12. Small translating object | LC11 favors small moving objects, with weak responses to large bars or flicker; original measurements show a dark-object preference and little direction selectivity. [O1] | LC11 absent; upstream T2/T3 present is not equivalent. | Move a bead past the duck. Detect it without inferring identity; elongating it into a bar should change the response. |
| 13. Brief object displacement prompting a pause | LC11 perturbations support short-term stopping in walking flies; a spatial-pooling/adaptation model accounts for displacement selectivity. [O2] | Extension; distinct from a generic delayed OFF→ON coincidence detector. | “Something moved”: pause briefly, then resume. Compare displacement with a stationary flickering patch and large bar. |
| 14. Figure moving relative to background | LC9 and AOT-projecting populations were tested with motion-defined figures and figure/background disparity. This is feature discrimination, not semantic segmentation. [O3] | Relevant early signals exist, but named downstream detectors are absent. | A camouflage beacon moves over a moving patterned wall. Compare object-only, background-only, and locked-together motion. Treat this as a research branch. |
| 15. Context-dependent target pursuit | LC10a target gain rises during male courtship and is linked to P1-mediated state. A small visual target does not inherently mean “follow.” [O4] | LC10a/P1 absent. Published separate model is available. | Two ducks see the same target with explicit “investigate” versus “watch” mode. This is a proposed state gate, not simulated sexual behavior. |
| 16. Ambient brightness / contrast under changing light | L1–L3 carry mixed contrast/luminance information, contributing across ON/OFF pathways; L3 is particularly relevant in dim contexts. [B1] | Those early units exist; faithful gain/adaptation must be checked. | Dim the room while holding object contrast fixed, then vary contrast at fixed luminance. Test whether tracking degrades gracefully rather than inventing motion. |
| 17. Spectral contrast, including UV-related channels | R7/R8 chromatic opponency includes local interactions and Dm9-mediated comparisons; Dm8 participates in UV-versus-green phototaxis. [C1, C2] | Not validated by grayscale Flyvis; Dm8/Dm9 absent. | Start with explicitly synthetic receptor channels and an equal-luminance color-choice test. RGB camera footage cannot reveal unmeasured UV. |
| 18. Skylight polarization angle | Specialized dorsal-rim R7/R8 feed a polarization pathway including DmDRA1 and MeTu; later stages convey orientation information toward the central complex. [P1] | Absent from standard input and network. | A virtual polarization compass can test maintaining heading. Real-camera use requires suitable polarization measurements, not inference from arbitrary RGB brightness. |

## Geometry and interpretation gates

A 2025 study links the compound eye's nonuniform sampling to spatial variation in preferred directions. “T4b = screen-right everywhere” is therefore not a defensible whole-eye rule. The work combines anatomy with H2 physiology and eye geometry. A realistic upgrade should retain the calibrated mapping between pixel coordinates, retinal sampling, head orientation and body coordinates. Compare a uniform flat retina with an eye-aware projection before adopting the latter. [Eye structure shapes neuron function in Drosophila motion vision, *Nature* (2025)](https://doi.org/10.1038/s41586-025-09276-5)

A separate 2025 connectomic inventory describes roughly 53,000 neurons in 732 types in one male right visual system. This supports a much broader discovery catalogue than the motion model. It does not mean 732 experimentally validated trigger-to-action mappings, and its types and names should not be silently equated with another dataset's labels. [Connectome-driven neural inventory of a complete visual system, *Nature* (2025)](https://doi.org/10.1038/s41586-025-08746-0)

## Suggested proposal order

**First, a stimulus bench.** Offer controlled flashes and moving edges with direct plots of named model neurons. Include polarity reversal, direction reversal and static-frame controls. Record the actual image input, model/checkpoint identity, time step and retinal projection.

**Then, useful closed-loop experiments.** Prioritize corridor slowing and course stabilization. Add a separately labeled LPLC2-inspired looming head only after it rejects darkening, contraction and translating objects. Compare with a simple conventional vision controller under identical latency and input restrictions.

**Next, competing object responses.** Test pause versus pursuit with explicit state. Do not force all objects into one “follow beacon” action. Include disappearance/reappearance and moving-background conditions.

**Later, spectral and polarization branches.** They require distinct sensory channels and additional circuitry; an ordinary webcam route should stay honestly labeled RGB vision.

These proposed gates apply across the matrix:

- Validate the visual feature first; then confirm the intended model units carry it. Only then connect a motor mapping.
- Preserve negative results. A neuron that does not respond is useful evidence when the stimulus is a confound.
- Match input bandwidth and delays between controllers. Give all compared paths the same camera frames and no privileged scene-object coordinates.
- Keep outputs within the duck's available behavior envelope. A fly escape jump does not establish a stable Microduck jump policy.
- Benchmark model responses separately from movement success. A passing neural tuning test can coexist with a failing controller.
- Use human-readable attribution in the UI: “Flyvis T4/T5 response,” “LPLC2-inspired readout,” and “duck action mapping.”

## Primary sources and access notes

**F1.** Lappalainen et al. (2024), *Nature*, “Connectome-constrained networks predict neural activity across the fly visual system.” DOI [10.1038/s41586-024-07939-3](https://doi.org/10.1038/s41586-024-07939-3). Main text and modeling/results sections read via [Europe PMC full text](https://www.ebi.ac.uk/europepmc/webservices/rest/PMC11525180/fullTextXML).

**F2.** TuragaLab, official [flash-response tutorial](https://turagalab.github.io/flyvis/examples/03_flyvision_flash_responses/) and [connectome tutorial](https://turagalab.github.io/flyvis/examples/01_flyvision_connectome/). Signed responses and flash-index definition inspected. These are model diagnostics, not animal behavior evidence.

**S1.** Creamer, Mano & Clark (2018), *Neuron* 100, 1460–1473.e6, “Visual control of walking speed in Drosophila.” [Full text](https://pmc.ncbi.nlm.nih.gov/articles/PMC6405217/), DOI [10.1016/j.neuron.2018.10.028](https://doi.org/10.1016/j.neuron.2018.10.028). Read results including closed-loop hallway, counterphase control and temporal-frequency tuning.

**S2.** Busch et al. (2018), *Current Biology*, “Bi-directional Control of Walking Behavior by Horizontal Optic Flow Sensors.” DOI [10.1016/j.cub.2018.11.010](https://doi.org/10.1016/j.cub.2018.11.010). [Publisher record](https://www.sciencedirect.com/science/article/pii/S0960982218314763). Publisher summary accessible; full paper not retrieved in this pass. Keep proposed implementation details provisional.

**S3.** Maimon, Straw & Dickinson (2010), *Nature Neuroscience* 13, 393–399, “Active flight increases the gain of visual motion processing in Drosophila.” DOI [10.1038/nn.2492](https://doi.org/10.1038/nn.2492). Primary abstract read; no detailed VS model adopted here.

**L1.** Klapoetke et al. (2017), *Nature* 551, 237–241, “Ultra-selective looming detection from radial motion opponency.” DOI [10.1038/nature24626](https://doi.org/10.1038/nature24626). Full main results read via [Europe PMC](https://www.ebi.ac.uk/europepmc/webservices/rest/PMC7457385/fullTextXML), including non-looming controls and inhibitory contributions.

**L2.** Ache et al. (2019), *Current Biology* 29, 1073–1081.e4, “Neural Basis for Looming Size and Velocity Encoding in the Drosophila Giant Fiber Escape Pathway.” DOI [10.1016/j.cub.2019.01.079](https://doi.org/10.1016/j.cub.2019.01.079). [Author institution record](https://www.janelia.org/publication/neural-basis-for-looming-size-and-velocity-encoding-in-the-drosophila-giant-fiber-escape). Primary summary accessed; mathematical implementation requires full methods review.

**O1.** Keleş & Frye (2017), *Current Biology* 27, 680–687, “Object-Detecting Neurons in Drosophila.” DOI [10.1016/j.cub.2017.01.012](https://doi.org/10.1016/j.cub.2017.01.012). [Full article](https://pmc.ncbi.nlm.nih.gov/articles/PMC5340600/). Cached primary text inspected, including contrast/direction tests and the absence of a clear flight-avoidance silencing phenotype.

**O2.** Tanaka & Clark (2020), *Current Biology* 30, 2532–2550.e8, “Object displacement-sensitive visual neurons drive freezing in Drosophila.” DOI [10.1016/j.cub.2020.04.068](https://doi.org/10.1016/j.cub.2020.04.068). [Full text](https://pmc.ncbi.nlm.nih.gov/articles/PMC8716191/). Read causal stopping experiments and explicit model-falsification comparisons.

**O3.** Aptekar et al. (2015), *Journal of Neuroscience* 35, 7587–7599, “Neurons Forming Optic Glomeruli Compute Figure–Ground Discriminations in Drosophila.” [Primary record](https://pubmed.ncbi.nlm.nih.gov/25972183/) and [article](https://pmc.ncbi.nlm.nih.gov/articles/PMC4429157/). Cached primary results/discussion portions accessible; full continuous article access was unreliable. This branch needs a deeper replication-method review before coding.

**O4.** Hindmarsh Sten et al. (2021), *Nature* 595, 549–553, “Sexual arousal gates visual processing during Drosophila courtship.” DOI [10.1038/s41586-021-03714-w](https://doi.org/10.1038/s41586-021-03714-w). Primary abstract and extended-data experimental descriptions read; linked [author model repository](https://github.com/rutalaboratory/LC10NetworkModel) is a separate candidate, not part of Flyvis.

**B1.** Ketkar et al. (2022), *eLife* 11:e74937, “First-order visual interneurons distribute distinct contrast and luminance information across ON and OFF pathways to achieve stable behavior.” DOI [10.7554/eLife.74937](https://doi.org/10.7554/eLife.74937). [Full text](https://www.ebi.ac.uk/europepmc/webservices/rest/PMC8967382/fullTextXML) read. Do not promote textbook L1=ON/L2=OFF labels into exclusive wiring assumptions.

**C1.** Heath et al. (2020), *Current Biology* 30, 264–275.e8, “Circuit mechanisms underlying chromatic encoding in Drosophila photoreceptors.” DOI [10.1016/j.cub.2019.11.075](https://doi.org/10.1016/j.cub.2019.11.075). [Primary full article](https://pmc.ncbi.nlm.nih.gov/articles/PMC6981066/) accessed.

**C2.** Gao et al. (2008), *Neuron*, “The Neural Substrate of Spectral Preference in Drosophila.” [Primary article](https://pmc.ncbi.nlm.nih.gov/articles/PMC2665173/). Primary summary accessed; detailed modern color-circuit replication should extend beyond this early phototaxis result.

**P1.** Hardcastle et al. (2021), *eLife* 10:e63225, “A visual pathway for skylight polarization processing in Drosophila.” DOI [10.7554/eLife.63225](https://doi.org/10.7554/eLife.63225). [Full text](https://www.ebi.ac.uk/europepmc/webservices/rest/PMC8051946/fullTextXML) read, including polarizer-removed controls and downstream pathway evidence.

**G1.** “Eye structure shapes neuron function in Drosophila motion vision” (2025), *Nature*. DOI [10.1038/s41586-025-09276-5](https://doi.org/10.1038/s41586-025-09276-5). [Full text](https://www.ebi.ac.uk/europepmc/webservices/rest/PMC12488493/fullTextXML) read for the geometry and direction-mapping result.

**G2.** Nern et al. (2025), *Nature* 641, 1225–1237, “Connectome-driven neural inventory of a complete visual system.” DOI [10.1038/s41586-025-08746-0](https://doi.org/10.1038/s41586-025-08746-0). Main inventory, cell-typing and coordinate-system sections read.
