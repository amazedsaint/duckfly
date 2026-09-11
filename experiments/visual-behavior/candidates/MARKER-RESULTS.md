# Clear-marker tracking: fewer wrong positions, excessive abstention remains

Two independent prototypes and their held-out runs are retained. Neither is connected to the app or duck controls. The current candidate is `marker-tracker-v2.mjs`.

The useful result is specific: when another magenta object appears, tracking separate components avoids the existing encoder's average-of-both position. On the v2 held-out separated-distractor cohort, the current whole-image centroid is more than3 pixels from the intended target on1112/1248 eligible frames. The candidate has0 wrong positions and1248/1248 measured positions. This is an engineering baseline using the app's existing color predicate, not an LC10/LC9 model.

The stricter overall gate still fails. V2 stops too readily on fragmented images and partial occlusion. The result does not yet justify promising automatic following through clutter.

## Candidate and inference boundary

`ClearMarkerTracker.step({pixels, captureTime, frameId, sourceId})` accepts only96×64 RGBA and capture identity. It never receives a scene-object ID, world pose or target label. Stream IDs are compared for equality only. The output contains `visible`, `center`, `bearing`, `area`, `status` and an internally generated identity counter. Bearing matches the existing encoder convention: positive means left. If observation is unavailable or ambiguous, center/bearing/area are null. Predicted target positions are not exposed as live measurements.

Acquisition needs one compact candidate persisting for120ms and at least three frames. Components use the exact current magenta pixel predicate. V2 joins mask fragments within2.5 pixels and ranks association candidates by their distance from a bounded motion prediction. Similar candidates with nearly tied distances trigger uncertainty. Area-growth and close-boundary guards also trigger uncertainty. A merge, extended loss or capture gap requires an explicit reset; the tracker never silently adopts a new identity after that latch.

`checkpoint()` and `restore(saved)` support exact continuation in the same source/clock. `reset()` starts fresh. A source change clears the association and waits for acquisition again. Duplicate captures abstain without mutating state; out-of-order captures throw. A gap over300ms latches `capture-gap`. These are capture-sequence checks. The eventual app integration would still need its existing camera-age gate before a body command.

## Protocol and retained failures

`MARKER-PLAN.md` preceded v1 implementation. Calibration used6 seeds per family, followed by24 new seeds per family across11 families. The first calibration version missed its conservative pre-merge ambiguity boundary on two frames; widening the guard by2 pixels fixed that before held-out testing. The earlier calibration source and outcomes are retained as `marker-tracker-calibration-v0.mjs` and `candidates-marker-calibration-v0-*`.

V1 passed its pooled synthetic coverage gates, but a movie-level audit found4/72 ordinary tracking movies that never acquired a target. Its real-rendered separated-distractor coverage was87.5%, below the90% gate. No wrong target position was observed on the measured, nonambiguous frames.

`MARKER-PLAN-v2.md` records the repair before fresh v2 testing. It also strengthens coverage to require90% in every ordinary tracking movie. V2 uses new random seeds; v1 held-out data is not relabeled as v2 validation. The additional rendered cohort changes marker size and distance, as well as movement speed.

| V2 held-out family | Coverage after initialization | Wrong measured positions |
|---|---:|---:|
| Isolated marker |1206/1248,96.6% pooled |0 |
| Separated same-color distractor |1248/1248,100% |0 |
| Camera-like image shift |1248/1248,100% |0 |

One isolated-marker movie reaches only8.7% coverage before latching uncertainty. That fails the per-movie gate despite the high pooled result. Its sampled color is[238,59,110], near the original predicate's boundary. Changing binary edge fragments produces apparent area growth. This is a false ambiguity alarm, not evidence of a second object.

Across the264 held-out movies, there are zero confident outputs during the prespecified unresolved-identity intervals and zero acquisitions on no-marker/brief-flash movies. The whole-image centroid reports a target on256 brief-flash frames. All reported, nonambiguous positions across every family were within3 pixels of the labeled center; that conditional precision must be read alongside the abstention counts.

Short synthetic occlusion recovers in16/24 cases, on the next available25ms or40ms capture after the last hidden frame. The eight50ms-cadence cases exceed the240ms grace from the last visible capture and latch lost. This exposes a sampling-phase effect in the current grace check. It is not robust occlusion recovery.

## Actual rendered transfer

Each prototype has a separate32-movie LabArena cohort, with51 exact RGBA frames per movie. The renderer, default floor and materials are unchanged. Target movement and an opaque box provide real projected occlusion; a rendered magenta panel provides the broad flash. Scene geometry and object IDs are used only by the benchmark for labels. The inference call still receives pixels only. No physical walking policy is run.

V2 measures all184/184 eligible isolated-marker frames correctly. With a separated distractor, it measures159/184 frames correctly and abstains on the rest,86.4% coverage. One movie fails the per-movie gate. The current whole-image centroid is wrong on168/184 separated-distractor frames. Neither system's object positions establish a physical control improvement without a body-level test.

Both crossing and ambiguous-occlusion cohorts elicit uncertainty before the labeled ambiguous interval, with no confident identity substitution. All no-target and brief-flash rendered cases are rejected. Yet all four single-target opaque-occlusion trials latch uncertainty and never resume. A single sphere seen on both sides of the pole becomes two magenta components. The tracker cannot currently distinguish that split from two possible identities.

The contact sheet `reports/candidates-arena-marker-v1-contact-sheet.png` shows these scenes. The v2 renderer inputs and labels are retained separately in `candidates-arena-marker-v2.json.gz`; exact candidate and baseline outputs are in `candidates-marker-v2-arena-screen-traces.json.gz`.

## Verification and decision

Five lifecycle tests pass for each version, covering exact checkpoint continuation and the source/reset boundaries. `verify-marker-evidence.mjs` verifies all input hashes and replays every retained synthetic frame exactly:660 unique movies and37,180 frames across both calibration and held-out cohorts. Calibration/held-out IDs and complete movie hashes are disjoint. Repeated frames are not treated as independent trials; per-movie failures are available in `candidates-marker-diagnostics.json`.

Do not promote this candidate as completed Follow through clutter. The precision benefit over a pooled color centroid is established within the tested conditions. Coverage and partial-occlusion handling need another bounded revision. The next useful change would distinguish a predicted target splitting around an occluder from a competing object's arrival, using component-area history and appearance support. It must retain refusal when identical objects genuinely merge or exchange behind an occluder. That requires new held-out movies after the change. Simply widening the association gate or extending the loss grace could create identity substitutions.

There is also a fundamental limit: a persistent impostor with indistinguishable appearance cannot be identified as wrong from these images alone. A product can ask the user to choose again, or use visually distinct markers, but it should not report invented certainty. The present initial-acquisition rule also assumes a single eligible marker; it does not choose among several initially visible identical objects.

## Run the retained experiment

From the repo root:

```sh
node --test experiments/visual-behavior/candidates/marker-tracker-v2.test.mjs
node experiments/visual-behavior/candidates/verify-marker-evidence.mjs
node experiments/visual-behavior/candidates/marker-diagnostics.mjs
```

The study runners reproduce calibration/held-out artifacts and should write to a new revision name for any changed algorithm. Do not overwrite the sealed v1/v2 outcomes with a tuned variant. The renderer collectors are local, short-lived research tools; all candidate browser sessions and collectors were closed after capture.
