# Spatial Flyvis readout

`spatial.js` extracts the eight exported T4/T5 populations without reducing their maps. It adds no neuron dynamics and never commands a duck. It verifies the complete pinned manifest, actual parameter bytes and WASM bytes before accepting the model. Coordinates are checked as bijections and each neuron index is checked for range and uniqueness.

```js
const readout = await createSpatialFlyvisReadout({ manifest, arrays, wasmBytes });
const baseline = readout.baseline(eye.checkpoint(), {
  id: 'neutral-reference', neuralTime: 0,
  method: 'one-second-neutral-fade-in', conditioningSeconds: 1,
});
const response = readout.extract(activity, baseline, {
  duckId: 'duck-1', eyeId: 'right', sourceId: 'camera-1', frameId: 0,
  captureTime: 0, neuralStartTime: 0, neuralEndTime: .04, clock: 'simulation',
});
```

`activity` must be a full finite `Float32Array(45669)` from the verified runtime. The WASM runtime returns a live memory view; callers should take `.slice()` before another step or allocation if they retain that full state. Extracted maps are independent copies.

Store `readout.metadata` once per report. `metadata.populations[type]` supplies `nodeIndices` and matching `{u,v,azimuth,elevation}` coordinates. Signed baseline maps live in `baseline.populations[type]`. Every response contains signed `populations[type].raw` and `populations[type].delta` arrays with `delta = Float32(raw − baseline)`. Keep baseline maps once alongside a response sequence. Any averages, positive clipping or normalization must be named derived displays/readouts rather than substituted for these maps.

`spatialToJSON(value)` creates plain-array records without rounding. A saved baseline can be restored with `readout.restoreBaseline(serialized)`. Restore checks model/checkpoint/manifest identity and units, validates all maps and baseline timing, then copies the record into immutable storage. Passing an arbitrary JSON baseline directly to `extract` fails. A baseline is a reference state, not a moving adaptation estimate; callers must separately retain the recurrent eye checkpoint to resume neural simulation exactly.

Camera capture time is the time the held image became available. Neural start/end mark the actual integration interval, which must contain whole 2 ms steps. The extractor rejects future images and intervals earlier than the baseline. It does not infer missing frames, run integration or decide clock conversions. Replaying a stale image should preserve its original capture time while advancing neural times explicitly.

The angular projection is DuckFly's experimental 2.3-degree axial grid. It is not the measured nonuniform projection of an entire fly eye. Positive azimuth is image-right; positive elevation is image-up. The checkpoint's anatomical reference is a right eye. Reusing its dynamics for another camera does not produce a reconstructed left optic lobe, and subtype names do not automatically specify a body-relative direction.

Validation is deliberately narrow: exact numerical extraction is distinct from physiology, reliable visual discrimination and robot control. The upstream checkpoint has nonideal individual subtype tuning. Calibration and falsifiers belong with each derived readout.

Run the bounded study from the repository root:

```sh
node --test experiments/visual-behavior/spatial.test.mjs
node experiments/visual-behavior/run-spatial.mjs experiments/visual-behavior/reports/new-spatial-run
node experiments/visual-behavior/replay-spatial.mjs experiments/visual-behavior/reports/new-spatial-run
```

See `experiments/visual-behavior/SPATIAL-PROTOCOL.md` for frozen conditions, gates and retained evidence formats.

## Experimental motion readout

`neural-map-flow-v2.js` exports `createNeuralMapFlow(metadata)` for a separately tested engineering decoder. Call `estimate(previousSpatial, currentSpatial, { minimumGradient })` on consecutive records from the same duck, eye and source. It uses signed **raw** maps, removes common temporal change within each population, and fits spatial displacement. The baseline-subtracted map must not replace raw activity here: subtracting an initial textured image would superimpose a fixed pattern on the moving response.

The returned velocity is in image degrees per neural second. `available` and `reason` must be checked before consuming it. A false `available` is missing usable motion evidence, not proof of zero physical movement. The decoder rejects stale images and mixed histories. It is a pure pairwise function; recording both input responses suffices to reproduce its local calculation, while neural-state replay still requires the eye checkpoint.

`observedRank: 1` and `tangentObserved: false` mean only motion across an oriented pattern was observed. The minimum-norm vector sets the unknown tangent to zero for representation, but does not claim physical tangent speed is zero. `normalAxis` and `normalVelocity` expose the measured component. Body/yaw interpretation needs a declared camera geometry and an observability check, or a scene with sufficient two-dimensional texture.

The frozen candidate 2 synthetic threshold is `minimumGradient: 0.006455187013519394`, with `minimumExplained: 0.2` and `maximumSpeed: 360`. This threshold passed the separately stratified study. A different renderer must transfer it explicitly or calibrate a new threshold on declared training cases before touching its held-out cases. Neither a synthetic pass nor a new calibration permits automatic body promotion.

The earlier `neural-map-flow.js` is retained as candidate 1 for exact historical replay. It failed the broad direction gate and must not silently replace candidate 2. The renderer/physical experiments may have their own explicitly narrower lineage. See `experiments/visual-behavior/NEURAL-FLOW-RESULTS.md` for the failures, coverage audit and final stratified result.
