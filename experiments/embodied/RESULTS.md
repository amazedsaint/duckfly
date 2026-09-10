# Brain and body experiments

The useful result was a better choice of body policy. New visual memory and
feedback currents did not establish better pursuit. They remain research code.
The production walking circuit and walking weights are unchanged.

## What is available in the app

- **See it, kick it** connects the real eye camera to the existing fly circuit.
  A visible pink cue and five motor ticks above 6 Hz in forward neurons request
  a kick. An engineered selector waits for a steady stance, runs the official
  left-kick policy for 0.5 seconds, then returns to walking after a settling period.
  Hide and reveal the cue to rearm. Ball placement is an explicit user action;
  ball coordinates are never supplied to the trigger.
- **Help stand** tries the official standing policy after a fall. It clears the
  fall latch only after a full second below 12 degrees tilt, above 9 cm trunk
  height and below 4 cm/s speed. It stops trying after eight seconds. The scene
  itself has no time limit. Recovery is an attempt, not a guarantee.
- Skill state appears beside the controls and in the selected duck's monitor.
  The Why inspector names the active body policy. Scene links preserve visual
  triggering; recordings preserve skill phase and exact replay state. Body-output
  disconnection and GF cancel a skill. Walking strength does not rescale a
  trained kick or recovery motion.

The fly circuit chooses when to request the visual kick through an engineered
adapter. Microduck's separate learned policy supplies the joint actions. This
does not demonstrate that a fly brain learned to balance or kick.

## Measured outcomes

244 completed physical trials, plus 24 eye-movie trajectories for the offline
feature assay. Partial interrupted collections are retained separately and are
not counted as completed trials. These are simulation results, not robot tests.

| Experiment | Result | Decision |
|---|---|---|
| Remember last visual direction | Mean late target error 37.48 cm versus 37.71 cm baseline; blocked-approach error worsened by 8.83 cm | Below the 3 cm benefit gate; no promotion |
| Graded forward command | Command variation 1.99 versus 0.625 baseline; retained 86.3% of baseline approach progress | Rejected |
| Extra ascending body feedback | Mean late error 43.23 cm versus 37.71 cm; more repeated obstacle contacts | Rejected |
| Small adapter search | A fixed bank evaluated on 60 training trials selected the unchanged baseline | No learned improvement; no confirmation run needed |
| Full Flyvis feature decoder | Validation MSE 0.02753 versus 0.02022 from raw retinal features, 36.1% worse | Failed offline gate; no downstream physical promotion |
| Left kick policy | All eight paired ball placements moved at least 5 cm farther than their no-kick twins; no falls | Added with a steady-stance handoff |
| Recovery policy | 15/16 fall fixtures recovered and cleared the fall latch, versus 0/16 walking-only controls | Added as an explicit bounded attempt |

The recovery confirmation covered sideways and front/back falls at different
angles and headings, allowing 0.8 seconds of physical settling before the
intervention. One pitch fixture became upright but did not satisfy the stable
recovery gate. It remains a failure, with its latch intact.

Four normal neural-trigger trials kicked successfully. Each of the four matched
conditions (forward neurons silenced, eyes covered, body output disconnected,
missing input) prevented a kick in all four trials. Those intervention tests use
a fixed pink image fixture. The packaged Mac UI test separately uses the actual
rendered eye, moves the ball, rearms by hiding/revealing the cue and checks eye
covering through the UI. Restoring checkpoints during recovery and kicking
reproduced identical subsequent physical positions and skill states.

## Limits of the vision assay

The pinned Flyvis model ran all 45,669 cells and 1,513,231 edges at 2 ms steps,
with a one-second fade-in. It received the preceding camera image between
captures, with no future-frame input. The 24 movies are four seconds long,
captured at the existing marker-controller cadence of 10 Hz. Twelve whole
trajectories trained the decoder; twelve separate trajectories evaluated it.

Both decoders have 64 input features and two linear outputs with fixed ridge
regularization of 10. Raw features aggregate the same 721 grayscale receptors;
Flyvis features aggregate spatial T4/T5 readouts. The target is the existing
marker detector's visibility and bearing, a narrow engineering proxy. Aligned
Flyvis features beat reversed/shuffled features, but lost to raw retinal input.
This does not establish that Flyvis is generally unhelpful or biologically
inaccurate. It says this particular readout should not replace our controller.

Memory is a decaying remembered direction, not tracked object identity. The
reacquisition measure is the first loss after a fixed observation time and can
include near-target losses; it is not a dedicated occlusion latency benchmark.
The body-feedback falsifier uses unrelated periodic current, not a perfectly
amplitude-matched shuffle. Neither candidate supports a causal improvement claim.

## Evidence and reproduction

The [protocol](PROTOCOL.md) preceded candidate outcomes. The baseline was
`8d7d64a`; successful collection archives contain hashes and source text for the
executed controller modules. A development reload interrupted `pilot-v1` after
six trials and `eye-train-v1` after nine movies. Fresh run IDs restarted the same
declared seed sets; no result-based exclusions or coefficient tuning occurred.

- [Pilot outcomes](reports/pilot-summary.json), [84 full trials](reports/pilot-v2.json.gz).
- [Adapter choice](reports/adapter-selection.json), [training trials](reports/adapter-train-v1.json.gz).
- [Decoder and fixed weights](reports/decoder.json), [training features](reports/features-train.json.gz), [validation features](reports/features-validation.json.gz).
- [Body policy screen](reports/skills-summary.json), [52 confirmation trials](reports/skills-confirm-summary.json), [confirmation traces and source](reports/skills-confirm.json.gz).
- [Final packaged Mac visual-trigger receipt](reports/mac-release-skills.json).

`node experiments/embodied/confirm-skills.mjs` runs the body confirmation with
the installed Node dependencies in `web/`. `node experiments/embodied/skills.mjs`
runs the initial screen against the current policy-selection API and writes
separate `skills-rerun` results. The original screen source is retained as
`reports/skills-screen-source.mjs`; its runtime was baseline `8d7d64a`.

For the image studies, run Vite with `experiments/embodied/server.mjs` and open
`/tests/embodied-harness.html` or `/tests/embodied-vision.html` with a fresh `run`
parameter. The results endpoint refuses to overwrite completed or duplicate
runs. Retained eye movies feed `flyvis-features.mjs`, followed by `decode.py`.
Raw JSONL is local working data; lossless compressed reports are versioned.

Upstream policy contract: [Microduck manifest documentation](https://github.com/pollen-robotics/microduck/blob/main/docs/policy-manifest.md).
Policy source: [pinned model revision](https://huggingface.co/pollen-robotics/microduck-policies/tree/088524a64e2557dc453256b6071dbb9d23888802).
Hashes and the upstream manifest are in [policy-manifest.json](reports/policy-manifest.json)
and [third-party notices](../../THIRD_PARTY_NOTICES.md).

## Release verification

Version 0.8.0 (build 8) is installed in the user Applications folder and deployed
to ContextMind. All 70 automated tests pass. The Mac catalog audit exercised all
11 scenes, including open-ended clocks and connection controls. The final native
skill check uses the recorded Why event stream: all 25 kick-policy commands were
present, even though UI polling missed the short kick phase. The initial
sampling-only failure is retained; it was not a controller failure. Ball motion,
hide/reveal rearming and covered-eye refusal passed. The final package has 66
files matching the installed copy. [Release receipt](reports/release.json) and
[public asset verification](reports/production-assets.json) retain the details.

The Mac was locked during desktop inspection. Packaged WebKit checks ran
successfully; the browser UI was visually inspected with the selected brain and
eye view visible. No physical robot or notarized distribution was tested.
