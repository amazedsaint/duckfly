# DuckFly, explained simply

Updated 10 September 2026. This is the explanation and plan for the guided experiment release.

Think of DuckFly as a driver and a pair of legs. A small fly-derived neural circuit is the driver. Microduck's pretrained walking policy is the part that knows how to move the joints without falling over. We built an adapter between the camera and that driver, then put the whole thing in a physical simulator.

The loop is: the world changes the camera image; the adapter produces neural input; fly neurons produce movement intent; the walking policy moves the duck; the new body pose changes the next image. Body speed and gait phase can also return to the fly circuit. The adapter and those feedback connections are modeling choices. The fly connectome did not learn biped balance.

## What we have built

The standalone Mac app contains the web workspace and its local simulation assets. The browser version runs the same experiment on Vercel. Platform files remain under `mac/` and `web/`; models and reusable vision code live under `shared/`. No server runs the physics or sees camera frames.

There is a physical Microduck, with rendered camera images and a fixed 61-observation / 14-action walking policy. Each duck has its own selected 668-neuron FlyWire circuit. Props can block the view or collide with the body. People can change a circuit pathway while watching its activity. Recording captures the internal state and images so we can rewind and branch.

We replaced a crowded control surface with scenario tiles and kept the selected duck's eyes and brain visible. Multiple ducks share the arena but have independent neural state. Webcam input is optional; it uses a separate modeled adapter, and is not a calibrated pair of fly eyes.

We also ported a full Flyvis reference model to a separate WASM bench. Its 45,669 cells and 1,513,231 edges reproduce the pinned Python oracle. That establishes a numerical port, not a validated connection to duck behavior. Full Flyvis still does not control these playground ducks. [Reference-model evidence](../../../research/fly-vision/README.md).

## What the experiments taught us

| Question | Measured result | Decision |
| --- | --- | --- |
| Does active head looking improve pursuit? | 1.67 cm less final error on average, below the 3 cm adoption gate. | Keep it optional. |
| Does correcting image bearing into body coordinates help? | Target visibility improved, but final pursuit error worsened by 2.91 cm. | Reject that candidate. |
| Does removing rotational image motion solve false stops? | Some false alarms disappeared, while hazard contacts increased. | Do not adopt it. |
| Does stronger looming input solve collision avoidance? | It can stop hazards, but also stops on harmless motion. | Gain alone is not the solution. |
| Does waiting for danger to clear help? | In 64 hazard scenes, contacts fell from 14 with the temporal decoder plus timer to 0 with the same decoder plus hold. | Keep studying the feedback rule. |
| Is that temporal hold ready as a default? | GF events occurred in 12/64 control trials, above the 10% gate. | No. Research only. |

The stop study included 768 physical trials across six conditions. The 12 control-scene GF events included ten triggered by the adapter and two spontaneous GF events during standing scans. The temporal-versus-static physical advantage was not established. A recovered Vite module-cache discrepancy affected motion timing; it is retained in the study report, and a source guard now checks what code a research run actually loaded. These limits matter when interpreting the result.

The control labels also need care: one nominal near-miss example contacted the duck when GF was disconnected. Its label was based on the study's approximate geometric rule, not a guarantee about the actual trajectory. The playground therefore uses `tv-confirm-near-miss-15` as its false-alarm example: both the original controller and the GF-disconnected condition had no contacts, while the temporal hold stopped twice. This is a selected teaching example, not a changed study gate.

A new check on the retained traces tested a tempting explanation: perhaps false alarms come from padding the camera history at startup. Only one of the ten visually triggered false-alarm trials first pulsed at startup. The others first pulsed between 0.8 and 4.8 seconds. That makes a startup-delay fix inadequate as an explanation of the observed failures. It does not establish the counterfactual effect of a delay, because changing a stop also changes later camera input. [Retained diagnosis](false-alarm-diagnosis.json).

Sources within this repository: [pursuit and feedback results](../../../experiments/feedback/RESULTS.md), [temporal study and limitations](../../../experiments/temporal/RESULTS.md).

## What the upstream projects suggest

The following public repository heads were resolved on 10 September 2026. They are research references, not dependencies that were silently upgraded.

| Project | Reviewed revision | Useful lesson for DuckFly |
| --- | --- | --- |
| DesktopFly | `32b00011e83c3dc85fa3ea0b3934155b04f1635d` | Its new MaleCNS extract has 1,045 neurons and 17,224 directed connections. Neural motor output moves articulated legs, with measured joint/contact state returning as feedback. Its evaluation distinguishes measured anatomy from calibrated dynamics and an explicitly modeled female-to-male circuit bridge. We should keep equally explicit boundaries. [Evaluation](https://github.com/DenisSergeevitch/desktop-fly/blob/32b00011e83c3dc85fa3ea0b3934155b04f1635d/EVALUATION.md). |
| Microduck RL | `53b8971b61baf5b7f3c16d135dd7cac37623de4b` | The upstream suite now covers fall recovery and additional actions, with ONNX deployment and a shared observation contract. It models actuator behavior and randomizes physical conditions. New body skills need matching policies and joint semantics; a new button cannot give our pinned walking policy a new skill. [README](https://github.com/pollen-robotics/microduck_rl/blob/53b8971b61baf5b7f3c16d135dd7cac37623de4b/README.md). |
| Microduck runtime | `6507d2e960417aaa4ecd38eccf59b2dcf586ecd2` | The roadmap describes a 50 Hz control library, policy manifests and bounded runtime responsibilities. A future hardware bridge should exchange explicit intent and versioned observations. Roadmap status is not hardware validation of DuckFly. [Roadmap](https://github.com/pollen-robotics/microduck/blob/6507d2e960417aaa4ecd38eccf59b2dcf586ecd2/docs/project/roadmap.md). |
| Flyvis | `92b3845cc426dd309a1a0e1b3890156c42e14021` | This is a connectome-constrained visual network, with task training and controlled stimulus experiments. It is the strongest available direction here for studying real fly visual computations, while our decoder is an engineered risk adapter. [Official project](https://github.com/TuragaLab/flyvis/tree/92b3845cc426dd309a1a0e1b3890156c42e14021). |
| FlyGym / NeuroMechFly | `38c8ec61034cd59bc5ba0de20688d4a3c0000d60` | Its published examples connect embodied sensing to behavior, including head stabilization from body feedback and fly following with connectome-constrained vision. The lesson is to test the full closed loop, with matched interventions. Its fly controllers cannot simply replace a biped policy. [Official release notes](https://github.com/NeLy-EPFL/flygym/releases), [research paper](https://doi.org/10.1038/s41592-024-02497-y). |

My inference: DuckFly's most useful role is an interactive sensorimotor laboratory. It can expose where an anatomically informed model helps, and where an engineered bridge is doing the work. Adding more neurons without a tested interface would make that distinction harder to see.

## Implemented experiments

**Stop, wait, go** lets people choose an approaching object or a harmless passing/receding object. A fixed camera-sequence model feeds the fly visual pathway. Compare the GF timer with a GF-triggered hold, or silence GF. The hold cannot invent a walk command. It only suppresses motion until fresh low scores persist and the body slows. The selected examples come from the retained study, so playing them is a demonstration, not new held-out evidence. The model's failed false-alarm gate stays visible.

**Find it again** moves the beacon off-axis and places an actual wall between it and the camera. Toggle active looking. Camera visibility and neural intent are measured live. No hidden target coordinates are passed into the adapter; object positions are used only to stage the scene.

**Brain switchboard** cuts forward/turn populations or disconnects body commands. Neural firing remains visible. It answers a causal question: does this pathway affect the resulting movement, or is another part of the system responsible?

**Bump and recover** applies 2.5 N sideways for 0.2 seconds and exposes the circuit-feedback toggle. Live foot contact and tilt help interpret the response. The walking policy's proprioception stays active; this experiment does not claim that the fly circuit performs balance or automatic get-up.

Each experiment has direct controls below the arena. The stop lab saves completed demonstration summaries, including their scene settings. Full recordings retain the image history, neural state and supervisor state. Guided scenes use scene version 3. Recording version 3 prevents older applications from silently accepting a recording whose new feedback state they cannot restore; imports of older versions remain supported.

## The next research plan

1. **Reduce false alarms before adding complexity.** Build a new training split rich in passing objects and camera motion. Keep the previous confirmation split sealed. Compare the same frozen hold with a static decoder and the current temporal decoder. Require at most 10% harmless-trial GF events, reduced hazard contacts, and at least 95% of baseline harmless-scene progress. Count spontaneous GF events separately but keep them in the total behavior gate. Stop if the gate fails.
2. **Test whether full Flyvis earns its cost.** Record the same stereo movies and body state. Run our existing reference model offline and fit a small downstream adapter. Compare it with raw-image and static controls on unseen scenes; include shuffled-time and silenced-pathway controls. Match inference latency in physical trials. Promote only for a behavioral gain, not a better neural-looking display.
3. **Study gaze as an intervention.** Compare fixed head with active looking at matched movement effort. Measure reacquisition latency and final pursuit error; keep camera-shake false alarms in the same evaluation. A visible target alone is not success.
4. **Add a verified body skill later.** Audit one upstream recovery policy against our observation order and BAM model. Test handoff continuity and fall recovery in an isolated simulator. Only then consider a visual cue that selects recovery. Keep any real-robot work as a separate task with physical validation.

The first priority is a more trustworthy perception-to-stop interface. The interesting next leap is using actual Flyvis features in that same falsifiable comparison. Neither requires pretending that a whole biological fly has been transplanted into a duck.
