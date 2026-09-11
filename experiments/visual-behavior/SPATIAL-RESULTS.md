# Spatial extraction passes; pooled direction fails its confounds

The final API study ran 338 actual packaged-WASM trials, using 81,120 integration steps. Exact extraction passed. Every saved raw/delta snapshot matched the earlier run byte for byte after explicit baseline restoration was added. A fresh replay checked 415,296 retained values across a calibration example and all paired conditions/families from held-out seed 1000, with exact equality. Six software tests cover the upstream oracle and signed extraction, metadata corruption, independent eyes and baseline restoration.

| Frozen gate | Final result | Decision |
|---|---|---|
| Full spatial extraction | Every sampled raw value equals its named full-state index; delta is Float32(raw−baseline) | Pass for spatial inspection |
| Local flash location | Correct image half in 60/60 OFF and 60/60 ON cases; each Wilson 95% interval approximately 94.0–100% | Pass in this synthetic location assay |
| Intermediate-angle direction | Correct hemisphere in 58/60 OFF and 52/60 ON; median errors 40.7° and 49.3° | Passes the deliberately coarse direction screen |
| Blank control | 0/30 strong false directions | Pass |
| Uniform flash control | 15/30 strong false directions | **Fail** |
| Uniform flicker control | 30/30 strong false directions | **Fail** |
| One-eye core runtime | Median 16.24 ms, p95 16.91 ms per 20 ms neural interval; maximum 48.49 ms | Component timing pass, occasional slow intervals retained |
| Extraction runtime | Median 0.834 ms, p95 1.048 ms per frame | Additional cost, outside the core interval timing |

The direction results cannot be sold as a useful motion detector. The same pooled readout treats nonmoving brightness changes as confident movement. Its successful edge tuning is real, but insufficient. Individual subtypes also have nonideal tuning, so an anatomical subtype name must not be displayed as a calibrated image direction by default.

The location result is a bounded image-half readout of absolute signed response changes. It does not establish LC11 selectivity, object recognition or an automatic gaze command. The exact map records are now suitable for separately tested spatial readouts and visual inspection.

Runtime numbers are measured on this Mac under Node, for one eye. Rendering, camera acquisition and additional ducks are excluded. The single-eye timing gate does not establish an interactive multi-eye budget, and summed percentile timings are not a measurement of combined loop latency.

## Evidence and reproduction

- Final immutable study: `reports/spatial-v2/summary.json`, including source/model hashes and every denominator.
- Full spatial metadata and baseline: `reports/spatial-v2/metadata.json`.
- Exact input samples: `reports/spatial-v2/inputs.f32.gz`.
- Indexed raw/delta snapshots: `reports/spatial-v2/snapshots.f32.gz`, approximately 43 MB, with offsets in `trials.json.gz`.
- Replay: `reports/spatial-v2/replay.json` and its log. Default replay is a declared subset; `--all` replays every trial.
- Original API screen: `reports/spatial-v1/`. Its source is retained under `sources/`; identical large input/snapshot binaries are relative links to the final run. Neither the original failure nor any denominator was removed.

The final study used the same frozen protocol as the first. Adding explicit baseline restoration did not change neural dynamics, stimuli or the decoder; exact input and snapshot SHA-256 values agree between runs. No neural/body bridge is promoted. The next candidate will test local spatial and temporal structure with fresh held-out movies, rather than tune this failed scalar readout on its test set.
